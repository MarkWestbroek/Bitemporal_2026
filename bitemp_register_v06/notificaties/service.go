package notificaties

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
)

// Service verbindt registraties met definities en bezorgers.
type Service struct {
	DB     *bun.DB
	Cfg    Config
	Schema *graphql.Schema
	Client *http.Client
	// Injecteerbaar voor tests.
	Webhook    func(ctx context.Context, client *http.Client, a Abonnee, ce CloudEvent) (int, error)
	Email      func(cfg SMTPConfig, aan, onderwerp, tekst string) error
	Filter     func(ctx context.Context, typenaam string, id int, filter string) (bool, error)
	Definities func(ctx context.Context, nu time.Time) ([]Definitie, error)
	Nu         func() time.Time
	Slaap      func(d time.Duration)
	Async      bool
	wg         sync.WaitGroup
}

// Nieuw maakt de service met de standaardbezorgers.
func Nieuw(db *bun.DB, cfg Config, schema *graphql.Schema) *Service {
	s := &Service{DB: db, Cfg: cfg, Schema: schema, Client: &http.Client{Timeout: cfg.Timeout}, Async: true}
	s.Webhook = VerstuurWebhook
	s.Email = VerstuurEmail
	s.Filter = func(ctx context.Context, typenaam string, id int, filter string) (bool, error) {
		return dynql.EntiteitVoldoetAanFilter(ctx, s.Schema, typenaam, id, filter)
	}
	s.Definities = LaadDefinities
	s.Nu = time.Now
	s.Slaap = time.Sleep
	return s
}

// Wacht op lopende bezorgingen (tests, nette afsluiting).
func (s *Service) Wacht() { s.wg.Wait() }

// NaRegistratie is de hook na een geslaagde registratie: gebeurtenissen afleiden uit de
// wijziging-rijen en (asynchroon) bezorgen. Fouten worden gelogd, nooit teruggegeven.
func (s *Service) NaRegistratie(ctx context.Context, registratieID int64, reg model.Registratie) {
	gs, err := s.Gebeurtenissen(ctx, registratieID, reg)
	if err != nil {
		fmt.Println("notificaties: gebeurtenissen afleiden mislukt:", err)
		return
	}
	if len(gs) == 0 {
		return
	}
	defs, err := s.Definities(ctx, s.Nu())
	if err != nil {
		fmt.Println("notificaties: definities laden mislukt:", err)
		return
	}
	actief := defs[:0:0]
	for _, d := range defs {
		if d.Actief() {
			actief = append(actief, d)
		}
	}
	if len(actief) == 0 {
		return
	}
	achtergrond := context.WithoutCancel(ctx)
	if s.Async {
		s.wg.Add(1)
		go func() { defer s.wg.Done(); s.Verwerk(achtergrond, gs, actief) }()
	} else {
		s.Verwerk(achtergrond, gs, actief)
	}
}

// Gebeurtenissen leidt per geraakte entiteit één gebeurtenis af uit de wijziging-rijen.
func (s *Service) Gebeurtenissen(ctx context.Context, registratieID int64, reg model.Registratie) ([]Gebeurtenis, error) {
	var rijen []model.Wijziging
	if err := s.DB.NewSelect().Model(&rijen).Where("registratie_id = ?", registratieID).OrderExpr("id ASC").Scan(ctx); err != nil {
		return nil, err
	}
	return GebeurtenissenUit(rijen, reg), nil
}

// GebeurtenissenUit — puur: groepeer wijzigingen per (entiteit, id); volgorde van eerste voorkomen.
func GebeurtenissenUit(rijen []model.Wijziging, reg model.Registratie) []Gebeurtenis {
	type sleutel struct{ typenaam, id string }
	index := map[sleutel]int{}
	uit := []Gebeurtenis{}
	bron := ""
	if reg.Bron != nil {
		bron = *reg.Bron
	}
	for _, w := range rijen {
		typenaam, id := w.Entiteitnaam, w.EntiteitID
		if typenaam == "" {
			// De entiteit zelf: Representatienaam is dan het entiteittype.
			if m, ok := model.MetaRegistry.GetTypeMeta(w.Representatienaam); ok && m.Metatype == model.MetatypeEntiteit {
				typenaam, id = m.Typenaam, w.RepresentatieID
			}
		}
		if typenaam == "" || id == "" {
			continue
		}
		meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
		if !ok || meta.Metatype != model.MetatypeEntiteit {
			continue
		}
		k := sleutel{typenaam, id}
		if i, gezien := index[k]; gezien {
			uit[i].Wijzigingstypen = voegToe(uit[i].Wijzigingstypen, strings.ToLower(string(w.Wijzigingstype)))
			continue
		}
		index[k] = len(uit)
		uit = append(uit, Gebeurtenis{
			RegistratieID: reg.ID, Volgnummer: len(uit), Registratietype: string(reg.Registratietype),
			Tijdstip: reg.Tijdstip, Bron: bron, Entiteit: meta, EntiteitID: id,
			Wijzigingstypen: []string{strings.ToLower(string(w.Wijzigingstype))},
		})
	}
	return uit
}

func voegToe(lijst []string, s string) []string {
	for _, x := range lijst {
		if x == s {
			return lijst
		}
	}
	return append(lijst, s)
}

// Verwerk matcht gebeurtenissen met definities en bezorgt per abonnee (met herpogingen).
// Retourneert het aantal geslaagde bezorgingen (voor tests).
func (s *Service) Verwerk(ctx context.Context, gs []Gebeurtenis, defs []Definitie) int {
	geslaagd := 0
	for _, g := range gs {
		ce := BouwCloudEvent(g, s.Cfg)
		for _, d := range defs {
			if !d.Past(g) {
				continue
			}
			if d.Filter != "" && s.Filter != nil {
				id, _ := strconv.Atoi(g.EntiteitID)
				ok, err := s.Filter(ctx, g.Entiteit.Typenaam, id, d.Filter)
				if err != nil {
					fmt.Printf("notificaties: filter van definitie %d mislukt: %v\n", d.ID, err)
					continue
				}
				if !ok {
					continue
				}
			}
			for _, a := range d.Abonnees {
				if s.bezorgMetHerpogingen(ctx, d, a, g, ce) {
					geslaagd++
				}
			}
		}
	}
	return geslaagd
}

func (s *Service) bezorgMetHerpogingen(ctx context.Context, d Definitie, a Abonnee, g Gebeurtenis, ce CloudEvent) bool {
	pogingen := s.Cfg.Pogingen
	if pogingen <= 0 {
		pogingen = 1
	}
	for poging := 1; poging <= pogingen; poging++ {
		status, err := s.bezorgEenmaal(ctx, d, a, g, ce)
		if err == nil {
			s.log(ctx, g, ce, d, a, poging, "bezorgd", status, nil)
			return true
		}
		laatste := poging == pogingen
		if laatste {
			s.log(ctx, g, ce, d, a, poging, "opgegeven", status, err)
			fmt.Printf("notificaties: %s → %s %s opgegeven na %d pogingen: %v\n", ce.ID, a.Kanaal, a.Adres, poging, err)
			return false
		}
		s.log(ctx, g, ce, d, a, poging, "mislukt", status, err)
		wacht := time.Minute
		if poging-1 < len(s.Cfg.Backoff) {
			wacht = s.Cfg.Backoff[poging-1]
		}
		if s.Slaap != nil {
			s.Slaap(wacht)
		}
	}
	return false
}

func (s *Service) bezorgEenmaal(ctx context.Context, d Definitie, a Abonnee, g Gebeurtenis, ce CloudEvent) (int, error) {
	switch a.Kanaal {
	case "webhook":
		return s.Webhook(ctx, s.Client, a, ce)
	case "email":
		onderwerp := d.Onderwerp
		if onderwerp == "" {
			onderwerp = StandaardOnderwerp(g, ce)
		}
		tekst := d.Tekst
		if tekst == "" {
			tekst = StandaardTekst(g, ce, s.Cfg)
		}
		return 0, s.Email(s.Cfg.SMTP, a.Adres, VulSjabloon(onderwerp, g, ce, s.Cfg), VulSjabloon(tekst, g, ce, s.Cfg))
	default:
		return 0, fmt.Errorf("onbekend kanaal %q", a.Kanaal)
	}
}

func (s *Service) log(ctx context.Context, g Gebeurtenis, ce CloudEvent, d Definitie, a Abonnee, poging int, status string, httpStatus int, err error) {
	if s.DB == nil {
		return
	}
	rij := model.NotificatieBezorging{
		GebeurtenisID: ce.ID, RegistratieID: g.RegistratieID, Type: ce.Type, DefinitieID: d.ID,
		Kanaal: a.Kanaal, Adres: a.Adres, Poging: poging, Tijdstip: s.Nu().UTC(), Status: status,
	}
	if httpStatus > 0 {
		rij.HTTPStatus = &httpStatus
	}
	if err != nil {
		f := err.Error()
		rij.Fout = &f
	}
	if b, jerr := json.Marshal(ce); jerr == nil {
		rij.Bericht = b
	}
	if _, ierr := s.DB.NewInsert().Model(&rij).Exec(ctx); ierr != nil {
		fmt.Println("notificaties: bezorglog schrijven mislukt:", ierr)
	}
}
