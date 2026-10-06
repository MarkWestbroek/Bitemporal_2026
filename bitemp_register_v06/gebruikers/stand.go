// Package gebruikers bevat het gebruikersbeheer bovenop de gegenereerde, bitemporele entiteit
// Gebruiker (domein beheer, model/beheer_*.go). Ontwerp en besluiten:
// docs/plans/gebruikersbeheer/.
//
//   - Wie iemand is, de status en de rollen staan in het register (met geschiedenis en
//     materiële geldigheid). Die lees je hier "nu" (stand.go).
//   - Wachtwoord-hash en laatste login staan in de plumbing-tabel gebruiker_inlog
//     (model.GebruikerInlog) en komen nooit in een registratie of de gegenereerde API.
//   - Aanmaken gaat via de registratie-engine (aanmaken.go); seed en migratie van de oude
//     tabel in seed.go en migratie.go; login en wachtwoorden in handlers.go.
//
// Dit is een eigen package omdat het dynql (lezen) én handlers (engine) nodig heeft, en dynql
// zelf handlers importeert.
package gebruikers

import (
	"context"
	"fmt"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
)

// Typenamen uit model/beheer_metaregistry.go.
const (
	typeGebruiker      = "Gebruiker"
	typeIdentiteit     = "Gebruiker_GebruikerIdentiteit"
	typeStatus         = "Gebruiker_GebruikerStatus"
	typeRoltoewijzing  = "Gebruiker_GebruikerRoltoewijzing"
	rolIdentiteiten    = "gebruiker_identiteiten"
	rolStatussen       = "gebruiker_statussen"
	rolRoltoewijzingen = "gebruiker_roltoewijzingen"

	StatusActief      = "actief"
	StatusGeblokkeerd = "geblokkeerd"
)

// Rol is één geldige roltoewijzing.
type Rol struct {
	Rol    string `json:"rol"`
	Domein string `json:"domein,omitempty"` // leeg = alle domeinen
}

// Stand is een gebruiker zoals die op een moment in het register staat.
type Stand struct {
	ID             int    `json:"id"`
	Gebruikersnaam string `json:"gebruikersnaam"`
	Weergavenaam   string `json:"weergavenaam,omitempty"`
	Email          string `json:"email,omitempty"`
	Status         string `json:"status"` // actief of geblokkeerd; zonder status-GE: actief
	Rollen         []Rol  `json:"rollen"`
}

var rolNiveau = map[string]int{"viewer": 1, "editor": 2, "admin": 3}

// HoogsteRol is de hoogste rol zonder domein ("voor alle domeinen"); leeg als er geen is.
// Rollen met een domein tellen nog niet mee: die zijn voor de autorisatielaag (FTV/PIP).
func (s Stand) HoogsteRol() string {
	beste := ""
	for _, r := range s.Rollen {
		if r.Domein == "" && rolNiveau[r.Rol] > rolNiveau[beste] {
			beste = r.Rol
		}
	}
	return beste
}

// MagInloggen: niet geblokkeerd en minstens één geldige rol.
func (s Stand) MagInloggen() bool {
	return s.Status != StatusGeblokkeerd && s.HoogsteRol() != ""
}

// LaadAlle geeft alle gebruikers die op `nu` bestaan (formeel actueel en materieel geldig).
func LaadAlle(ctx context.Context, nu time.Time) ([]Stand, error) {
	rijen, err := dynql.LaadActueleEntiteiten(ctx, typeGebruiker, nu)
	if err != nil {
		return nil, err
	}
	uit := make([]Stand, 0, len(rijen))
	for _, m := range rijen {
		if !dynql.EntiteitMaterieelGeldig(m, typeGebruiker, nu) {
			continue // afgevoerd (einde) of nog niet begonnen (aanvang)
		}
		s := Stand{ID: geheel(m["id"]), Status: StatusActief, Rollen: []Rol{}}
		if id := dynql.GeldigeHub(m[rolIdentiteiten], typeIdentiteit, nu); id != nil {
			s.Gebruikersnaam = tekst(id["gebruikersnaam"])
			s.Weergavenaam = tekst(id["weergavenaam"])
			s.Email = tekst(id["email"])
		}
		if st := dynql.GeldigeHub(m[rolStatussen], typeStatus, nu); st != nil && tekst(st["status"]) != "" {
			s.Status = tekst(st["status"])
		}
		for _, r := range dynql.GeldigeHubs(m[rolRoltoewijzingen], typeRoltoewijzing, nu) {
			if rol := tekst(r["rol"]); rol != "" {
				s.Rollen = append(s.Rollen, Rol{Rol: rol, Domein: tekst(r["domein"])})
			}
		}
		if s.Gebruikersnaam != "" {
			uit = append(uit, s)
		}
	}
	return uit, nil
}

// Zoek geeft de gebruiker met deze gebruikersnaam op `nu`, of nil.
func Zoek(ctx context.Context, gebruikersnaam string, nu time.Time) (*Stand, error) {
	alle, err := LaadAlle(ctx, nu)
	if err != nil {
		return nil, err
	}
	for i := range alle {
		if alle[i].Gebruikersnaam == gebruikersnaam {
			return &alle[i], nil
		}
	}
	return nil, nil
}

// Resolver is de opzoekfunctie voor de middleware (middleware.ZetGebruikerResolver): rol en
// status per verzoek uit het register (besluit B).
func Resolver(ctx context.Context, gebruikersnaam string) (middleware.GebruikerStand, bool, error) {
	s, err := Zoek(ctx, gebruikersnaam, time.Now())
	if err != nil {
		return middleware.GebruikerStand{}, false, err
	}
	if s == nil || !s.MagInloggen() {
		return middleware.GebruikerStand{}, false, nil
	}
	return middleware.GebruikerStand{Rol: s.HoogsteRol(), Email: s.Email}, true, nil
}

func tekst(v interface{}) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case *string:
		if t == nil {
			return ""
		}
		return *t
	default:
		return fmt.Sprint(t)
	}
}

func geheel(v interface{}) int {
	switch t := v.(type) {
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	default:
		return 0
	}
}
