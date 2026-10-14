// Package meldingen — bugs, wensen en vragen melden vanuit Omnium (plan
// docs/plans/meldingen/2026-10-14 Bugs en wensen melden vanuit Omnium (voorstel).md).
//
// Een melding is een gewone bitemporele entiteit (domein meldingen, gegenereerd). Via de
// generieke routes is dat domein alleen voor beheerders (routes/leestoegang.go); een melder
// werkt via de endpoints hier, die de eigen meldingen tonen en als systeemaanroep registreren.
package meldingen

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
)

// Typenamen uit model/meldingen_metaregistry.go.
const (
	typeMelding     = "Melding"
	typeInhoud      = "Melding_MeldingInhoud"
	typeContext     = "Melding_MeldingContext"
	typeBijlage     = "Melding_MeldingBijlage"
	typeStatus      = "Melding_MeldingStatus"
	typePrioriteit  = "Melding_MeldingPrioriteit"
	typeReactie     = "Melding_MeldingReactie"
	typeMelder      = "MeldingMelder"
	typeBehandelaar = "MeldingBehandelaar"

	rolInhoud      = "melding_inhouden"
	rolContext     = "melding_contexten"
	rolBijlagen    = "melding_bijlagen"
	rolStatussen   = "melding_statussen"
	rolPrioriteit  = "melding_prioriteiten"
	rolReacties    = "melding_reacties"
	rolMelder      = "melding_melders"
	rolBehandelaar = "melding_behandelaars"
)

// Reactie is één bericht in het gesprek.
type Reactie struct {
	Tekst   string     `json:"tekst"`
	Auteur  string     `json:"auteur"`
	Wanneer *time.Time `json:"wanneer,omitempty"`
}

// Bijlage verwijst naar een MeldingBestand.
type Bijlage struct {
	Bestand      string `json:"bestand"`
	Omschrijving string `json:"omschrijving,omitempty"`
}

// Melding is de stand van een melding op een moment.
type Melding struct {
	ID           int               `json:"id"`
	Soort        string            `json:"soort"`
	Titel        string            `json:"titel"`
	Beschrijving string            `json:"beschrijving,omitempty"`
	Status       string            `json:"status"`
	Toelichting  string            `json:"toelichting,omitempty"`
	Prioriteit   string            `json:"prioriteit,omitempty"`
	MelderID     int               `json:"-"`
	Melder       string            `json:"melder,omitempty"`
	Behandelaar  string            `json:"behandelaar,omitempty"`
	GemeldOp     *time.Time        `json:"gemeld_op,omitempty"`
	Context      map[string]string `json:"context,omitempty"`
	Bijlagen     []Bijlage         `json:"bijlagen"`
	Reacties     []Reactie         `json:"reacties"`
}

// contextVelden: de velden van MeldingContext, in volgorde.
var contextVelden = []string{"studioversie", "activiteit", "plek", "projectid", "pad", "onderwerpid", "browser"}

// LaadAlle geeft alle meldingen op `nu`, nieuwste eerst. namen: gebruiker-id → gebruikersnaam.
func LaadAlle(ctx context.Context, nu time.Time, namen map[int]string) ([]Melding, error) {
	rijen, err := dynql.LaadActueleEntiteiten(ctx, typeMelding, nu)
	if err != nil {
		return nil, err
	}
	uit := make([]Melding, 0, len(rijen))
	for _, m := range rijen {
		uit = append(uit, uitMap(m, nu, namen))
	}
	sort.Slice(uit, func(i, j int) bool { return uit[i].ID > uit[j].ID })
	return uit, nil
}

func uitMap(m map[string]interface{}, nu time.Time, namen map[int]string) Melding {
	mel := Melding{ID: geheel(m["id"]), Status: "nieuw", GemeldOp: tijd(m["opvoer"]), Bijlagen: []Bijlage{}, Reacties: []Reactie{}}
	if h := dynql.GeldigeHub(m[rolInhoud], typeInhoud, nu); h != nil {
		mel.Soort, mel.Titel, mel.Beschrijving = tekst(h["soort"]), tekst(h["titel"]), tekst(h["beschrijving"])
	}
	if h := dynql.GeldigeHub(m[rolContext], typeContext, nu); h != nil {
		mel.Context = map[string]string{}
		for _, k := range contextVelden {
			if v := tekst(h[k]); v != "" {
				mel.Context[k] = v
			}
		}
	}
	if h := dynql.GeldigeHub(m[rolStatussen], typeStatus, nu); h != nil && tekst(h["status"]) != "" {
		mel.Status, mel.Toelichting = tekst(h["status"]), tekst(h["toelichting"])
	}
	if h := dynql.GeldigeHub(m[rolPrioriteit], typePrioriteit, nu); h != nil {
		mel.Prioriteit = tekst(h["prioriteit"])
	}
	if h := dynql.GeldigeHub(m[rolMelder], typeMelder, nu); h != nil {
		mel.MelderID = geheel(h["gebruiker_id"])
		mel.Melder = namen[mel.MelderID]
	}
	if h := dynql.GeldigeHub(m[rolBehandelaar], typeBehandelaar, nu); h != nil {
		mel.Behandelaar = namen[geheel(h["gebruiker_id"])]
	}
	for _, b := range dynql.GeldigeHubs(m[rolBijlagen], typeBijlage, nu) {
		mel.Bijlagen = append(mel.Bijlagen, Bijlage{Bestand: tekst(b["bestand"]), Omschrijving: tekst(b["omschrijving"])})
	}
	for _, r := range dynql.GeldigeHubs(m[rolReacties], typeReactie, nu) {
		mel.Reacties = append(mel.Reacties, Reactie{Tekst: tekst(r["tekst"]), Auteur: tekst(r["auteur"]), Wanneer: tijd(r["opvoer"])})
	}
	sort.SliceStable(mel.Reacties, func(i, j int) bool {
		a, b := mel.Reacties[i].Wanneer, mel.Reacties[j].Wanneer
		return a != nil && b != nil && a.Before(*b)
	})
	return mel
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
	}
	return 0
}

func tijd(v interface{}) *time.Time {
	switch t := v.(type) {
	case time.Time:
		return &t
	case *time.Time:
		return t
	case string:
		if p, err := time.Parse(time.RFC3339Nano, t); err == nil {
			return &p
		}
	}
	return nil
}
