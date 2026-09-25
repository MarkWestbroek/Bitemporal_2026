// Package notificaties — gebeurtenissen en notificaties (NORA/FDS "Architectuur Notificeren",
// NL GOV profile for CloudEvents). Ontwerp: docs/plans/2026-09-25 Notificeren en dashboards —
// NORA FDS verwerkt (ontwerp).md.
//
// Een gebeurtenis is een afgeleide van een registratie: na de commit worden de geraakte
// entiteiten (uit de wijziging-rijen) omgezet in CloudEvents-berichten (informatiearm: id's en
// verwijzingen, geen veldwaarden). De actieve NotificatieDefinities (configuratiedomein) bepalen
// wie wat krijgt: e-mail of webhook. Bezorging is asynchroon, at-least-once met Idempotency-Key,
// met herpogingen (exponential backoff) en een bezorglog (model.NotificatieBezorging).
package notificaties

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Config komt uit de omgeving; zie .env.example.
type Config struct {
	Source     string // CloudEvents source: urn:nld:kvknr:<KvK>:<instantie>
	TypePrefix string // reverse-DNS voorvoegsel van het type; leeg = "nl.<domein>"
	BasisURL   string // publieke basis-URL van de instantie (voor dataref en links)
	SMTP       SMTPConfig
	Pogingen   int             // maximaal aantal bezorgpogingen per abonnee
	Backoff    []time.Duration // wachttijd vóór poging 2, 3, …
	Timeout    time.Duration   // per webhook-aanroep
}

// SMTPConfig — leeg host = er wordt geen e-mail verstuurd (bezorglog: mislukt/opgegeven).
// Host = mail.<domein> (certificaat *.<domein>), gebruiker = volledig mailadres van de mailbox.
type SMTPConfig struct {
	Host, User, Wachtwoord, Afzender string
	Poort                            int
}

// ConfigUitEnv leest NOTIFICATIE_* en SMTP_*.
func ConfigUitEnv() Config {
	// Quickhost (en de meeste Plesk-hosting): poort 465 met TLS vanaf de verbinding; 587 met
	// STARTTLS geeft daar "454 Temporary authentication failure". Zie docs/VPS_DEPLOYMENT.md §9.
	poort, _ := strconv.Atoi(strings.TrimSpace(os.Getenv("SMTP_PORT")))
	if poort == 0 {
		poort = 465
	}
	pogingen, _ := strconv.Atoi(strings.TrimSpace(os.Getenv("NOTIFICATIE_POGINGEN")))
	if pogingen <= 0 {
		pogingen = 5
	}
	return Config{
		Source:     strings.TrimSpace(os.Getenv("NOTIFICATIE_SOURCE")),
		TypePrefix: strings.TrimSpace(os.Getenv("NOTIFICATIE_TYPE_PREFIX")),
		BasisURL:   strings.TrimRight(strings.TrimSpace(os.Getenv("NOTIFICATIE_BASIS_URL")), "/"),
		SMTP: SMTPConfig{
			Host: strings.TrimSpace(os.Getenv("SMTP_HOST")), Poort: poort,
			User: os.Getenv("SMTP_USER"), Wachtwoord: os.Getenv("SMTP_PASS"),
			Afzender: strings.TrimSpace(os.Getenv("SMTP_FROM")),
		},
		Pogingen: pogingen,
		// NORA "hoog niveau": exponential backoff. Poging 1 direct; daarna 1 m, 5 m, 30 m, 2 u, 12 u.
		Backoff: []time.Duration{time.Minute, 5 * time.Minute, 30 * time.Minute, 2 * time.Hour, 12 * time.Hour},
		Timeout: 15 * time.Second,
	}
}

// Gebeurtenis — één geraakte entiteit in één registratie (de eenheid van notificeren).
type Gebeurtenis struct {
	RegistratieID   int64
	Volgnummer      int // index binnen de registratie (voor het id)
	Registratietype string
	Tijdstip        time.Time
	Bron            string
	Entiteit        model.TypeMeta
	EntiteitID      string
	Wijzigingstypen []string
}

// Soort vertaalt het registratietype naar het gebeurtenis-achtervoegsel in het CloudEvents-type.
func (g Gebeurtenis) Soort() string {
	switch strings.ToLower(g.Registratietype) {
	case "correctie":
		return "gecorrigeerd"
	case "ongedaanmaking":
		return "ongedaangemaakt"
	default:
		return "geregistreerd"
	}
}

// ID — persistent en reproduceerbaar (NLgov: persistent id boven random UUID); tevens de
// Idempotency-Key.
func (g Gebeurtenis) ID() string { return fmt.Sprintf("reg-%d-w%d", g.RegistratieID, g.Volgnummer) }

// Type — reverse-DNS: <prefix>.<entiteit>.<soort>; prefix uit de config of "nl.<domein>".
// Geen organisatie- of productnaam (NLgov); de instantie zit in `source`.
func (g Gebeurtenis) Type(cfg Config) string {
	prefix := cfg.TypePrefix
	if prefix == "" {
		prefix = "nl." + strings.ToLower(strings.ReplaceAll(g.Entiteit.Domein, " ", "-"))
	}
	return prefix + "." + strings.ToLower(g.Entiteit.Typenaam) + "." + g.Soort()
}

// Subject — <entiteit>/<id> in de context van de producer.
func (g Gebeurtenis) Subject() string {
	return strings.ToLower(g.Entiteit.Typenaam) + "/" + g.EntiteitID
}

// Link naar de entiteit in de Studio (voor mensen) en de REST-URL (dataref, voor systemen).
func (g Gebeurtenis) DataRef(cfg Config) string {
	return cfg.BasisURL + "/full/" + g.Entiteit.Padnaam + "/" + g.EntiteitID
}
func (g Gebeurtenis) Link(cfg Config) string {
	return cfg.BasisURL + "/viz/react/inhoud.html#/t/" + g.Entiteit.Padnaam + "/" + g.EntiteitID
}

// CloudEvent — het bericht volgens het NL GOV profile for CloudEvents (informatiearm).
type CloudEvent struct {
	SpecVersion     string         `json:"specversion"`
	ID              string         `json:"id"`
	Source          string         `json:"source"`
	Type            string         `json:"type"`
	Subject         string         `json:"subject"`
	Time            string         `json:"time"`
	Sequence        string         `json:"sequence"`
	DataContentType string         `json:"datacontenttype"`
	DataSchema      string         `json:"dataschema,omitempty"`
	DataRef         string         `json:"dataref,omitempty"`
	Data            map[string]any `json:"data"`
}

// BouwCloudEvent maakt het bericht voor een gebeurtenis.
func BouwCloudEvent(g Gebeurtenis, cfg Config) CloudEvent {
	source := cfg.Source
	if source == "" {
		source = "urn:nld:onbekend:omnium" // NOTIFICATIE_SOURCE niet gezet; zie opstartlog
	}
	ce := CloudEvent{
		SpecVersion:     "1.0",
		ID:              g.ID(),
		Source:          source,
		Type:            g.Type(cfg),
		Subject:         g.Subject(),
		Time:            g.Tijdstip.UTC().Format(time.RFC3339),
		Sequence:        fmt.Sprintf("%012d", g.RegistratieID), // monotoon, niet gegarandeerd aaneengesloten: geen sequencetype
		DataContentType: "application/json",
		Data: map[string]any{
			"registratieId":   g.RegistratieID,
			"registratietype": strings.ToLower(g.Registratietype),
			"entiteit":        g.Entiteit.Typenaam,
			"id":              g.EntiteitID,
			"wijzigingstypen": g.Wijzigingstypen,
		},
	}
	if g.Bron != "" {
		ce.Data["bron"] = g.Bron
	}
	if cfg.BasisURL != "" {
		ce.DataSchema = cfg.BasisURL + "/notificaties/schema/gebeurtenis-v1.json"
		ce.DataRef = g.DataRef(cfg)
	}
	return ce
}

// Gebeurtenistype beschrijft één catalogusregel (NORA functie 1: catalogus van gebeurtenistypes).
type Gebeurtenistype struct {
	Type         string `json:"type"`
	Entiteit     string `json:"entiteit"`
	Domein       string `json:"domein"`
	Soort        string `json:"gebeurtenis"`
	Omschrijving string `json:"omschrijving"`
}

// Catalogus leidt alle gebeurtenistypes af uit de MetaRegistry: per entiteit drie soorten.
func Catalogus(cfg Config) []Gebeurtenistype {
	uit := []Gebeurtenistype{}
	namen := make([]string, 0, len(model.MetaRegistry))
	for naam := range model.MetaRegistry {
		namen = append(namen, naam)
	}
	sort.Strings(namen)
	for _, naam := range namen {
		meta := model.MetaRegistry[naam]
		if meta.Metatype != model.MetatypeEntiteit {
			continue
		}
		for _, rt := range []string{"registratie", "correctie", "ongedaanmaking"} {
			g := Gebeurtenis{Registratietype: rt, Entiteit: meta}
			uit = append(uit, Gebeurtenistype{
				Type: g.Type(cfg), Entiteit: meta.Typenaam, Domein: meta.Domein, Soort: g.Soort(),
				Omschrijving: fmt.Sprintf("%s %s (%s)", meta.Klassenaam, g.Soort(), rt),
			})
		}
	}
	return uit
}
