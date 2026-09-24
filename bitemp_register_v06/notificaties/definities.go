package notificaties

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
)

// Abonnee — één ontvanger uit NotificatiedefinitieAbonnee.
type Abonnee struct {
	Kanaal string // email | webhook
	Adres  string
	Geheim string
}

// Definitie — een NotificatieDefinitie zoals die op `nu` geldt (formeel actueel, per GE het
// materieel geldige record).
type Definitie struct {
	ID              int
	Naam            string
	Beschrijving    string
	Doeltype        string
	Registratietype string // registratie | correctie | ongedaanmaking | alle
	Bron            string
	Filter          string // JSON in de vorm van <Doeltype>Filter, leeg = geen filter
	Abonnees        []Abonnee
	Onderwerp       string
	Tekst           string
	QueryDefinitie  string
	Status          string
	Reden           string
}

const (
	defTypenaam    = "NotificatieDefinitie"
	geNaam         = "NotificatieDefinitie_NotificatiedefinitieNaam"
	geGebeurtenis  = "NotificatieDefinitie_NotificatiedefinitieGebeurtenis"
	geAbonnee      = "NotificatieDefinitie_NotificatiedefinitieAbonnee"
	geInhoud       = "NotificatieDefinitie_NotificatiedefinitieInhoud"
	geStatus       = "NotificatieDefinitie_NotificatiedefinitieStatus"
	rolNaam        = "notificatie_definitie_namen"
	rolGebeurtenis = "notificatie_definitie_gebeurtenissen"
	rolAbonnee     = "notificatie_definitie_abonnees"
	rolInhoud      = "notificatie_definitie_inhouden"
	rolStatus      = "notificatie_definitie_statussen"
)

func tekst(r map[string]interface{}, veld string) string {
	if r == nil {
		return ""
	}
	switch v := r[veld].(type) {
	case string:
		return v
	case nil:
		return ""
	default:
		return fmt.Sprint(v)
	}
}

// LaadDefinities leest alle NotificatieDefinities die op `nu` gelden (ook inactieve; filter met
// Actief). Volgorde: id.
func LaadDefinities(ctx context.Context, nu time.Time) ([]Definitie, error) {
	rijen, err := dynql.LaadActueleEntiteiten(ctx, defTypenaam, nu)
	if err != nil {
		return nil, err
	}
	uit := []Definitie{}
	for _, m := range rijen {
		if !dynql.EntiteitMaterieelGeldig(m, defTypenaam, nu) {
			continue
		}
		d := Definitie{}
		if id, ok := m["id"].(float64); ok {
			d.ID = int(id)
		}
		naam := dynql.GeldigeHub(m[rolNaam], geNaam, nu)
		d.Naam, d.Beschrijving = tekst(naam, "naam"), tekst(naam, "beschrijving")
		geb := dynql.GeldigeHub(m[rolGebeurtenis], geGebeurtenis, nu)
		d.Doeltype, d.Registratietype = tekst(geb, "doeltype"), strings.ToLower(tekst(geb, "registratietype"))
		d.Bron, d.Filter = tekst(geb, "bron"), tekst(geb, "filter")
		for _, a := range dynql.GeldigeHubs(m[rolAbonnee], geAbonnee, nu) {
			d.Abonnees = append(d.Abonnees, Abonnee{Kanaal: strings.ToLower(tekst(a, "kanaal")), Adres: strings.TrimSpace(tekst(a, "adres")), Geheim: tekst(a, "geheim")})
		}
		inh := dynql.GeldigeHub(m[rolInhoud], geInhoud, nu)
		d.Onderwerp, d.Tekst, d.QueryDefinitie = tekst(inh, "onderwerp"), tekst(inh, "tekst"), tekst(inh, "querydefinitie")
		st := dynql.GeldigeHub(m[rolStatus], geStatus, nu)
		d.Status, d.Reden = strings.ToLower(tekst(st, "status")), tekst(st, "reden")
		uit = append(uit, d)
	}
	sort.Slice(uit, func(i, j int) bool { return uit[i].ID < uit[j].ID })
	return uit, nil
}

// Actief — alleen definities met status actief en minstens één abonnee doen mee.
func (d Definitie) Actief() bool {
	return d.Status == "actief" && len(d.Abonnees) > 0 && d.Doeltype != ""
}

// Past zegt of de gebeurtenis bij de definitie hoort (nog zonder het filter, zie Service).
func (d Definitie) Past(g Gebeurtenis) bool {
	if !strings.EqualFold(d.Doeltype, g.Entiteit.Typenaam) {
		return false
	}
	if d.Registratietype != "" && d.Registratietype != "alle" && d.Registratietype != strings.ToLower(g.Registratietype) {
		return false
	}
	if d.Bron != "" && !strings.EqualFold(d.Bron, g.Bron) {
		return false
	}
	return true
}

// Beschrijf — korte regel voor het opstartlog.
func (d Definitie) Beschrijf() string {
	kanalen := make([]string, 0, len(d.Abonnees))
	for _, a := range d.Abonnees {
		kanalen = append(kanalen, a.Kanaal)
	}
	extra := ""
	if d.Bron != "" {
		extra += " bron=" + d.Bron
	}
	if d.Filter != "" {
		extra += " +filter"
	}
	return fmt.Sprintf("NotificatieDefinitie %d %q [%s]: %s/%s%s → %d abonnee(s) %v", d.ID, d.Naam, d.Status, d.Doeltype, d.Registratietype, extra, len(d.Abonnees), kanalen)
}
