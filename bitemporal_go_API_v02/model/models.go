package model

import (
	"time"

	"github.com/uptrace/bun"
)

// WijzigingstypeEnum defines the possible values for Wijzigingstype
type WijzigingstypeEnum string

const (
	WijzigingstypeOpvoer WijzigingstypeEnum = "opvoer"
	WijzigingstypeAfvoer WijzigingstypeEnum = "afvoer"
)

// RegistratietypeEnum defines the possible values for Registratietype
type RegistratietypeEnum string

const (
	RegistratietypeRegistratie    RegistratietypeEnum = "registratie"
	RegistratietypeCorrectie      RegistratietypeEnum = "correctie"
	RegistratietypeOngedaanmaking RegistratietypeEnum = "ongedaanmaking"
)

// HasID allows generic handlers to access an entity's ID
type HasID interface {
	GetID() any
}

func (a A) GetID() any             { return a.ID }
func (b B) GetID() any             { return b.ID }
func (r Rel_A_B) GetID() any       { return r.ID }
func (au A_U) GetID() any          { return au.Rel_ID }
func (av A_V) GetID() any          { return av.Rel_ID }
func (bx B_X) GetID() any          { return bx.Rel_ID }
func (by B_Y) GetID() any          { return by.Rel_ID }
func (reg Registratie) GetID() any { return reg.ID }
func (wij Wijziging) GetID() any   { return wij.ID }

// Entiteiten
type A struct {
	bun.BaseModel `bun:"table:a"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer
	//Aanvang *time.Time `json:"aanvang,omitempty"` // afgeleid van A_Aanvang
	//Einde   *time.Time `json:"einde,omitempty"`   // afgeleid van A_Einde
}

type B struct {
	bun.BaseModel `bun:"table:b"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	//Aanvang *time.Time `json:"aanvang,omitempty"`
	//Einde   *time.Time `json:"einde,omitempty"`
}

// Relaties
type Rel_A_B struct {
	bun.BaseModel `bun:"table:rel_a_b"`
	ID            int        `json:"id" bun:"id,pk"`
	A_ID          int        `json:"a_id"`
	B_ID          int        `json:"b_id"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	//Aanvang *time.Time `json:"aanvang,omitempty"`
	//Einde   *time.Time `json:"einde,omitempty"`
}

// Gegevenselementen
// A (1) - (1) U
type A_U struct {
	bun.BaseModel `bun:"table:a_u"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	A_ID          int        `json:"a_id"`
	Aaa           string     `json:"aaa"`
	Bbb           string     `json:"bbb"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A (1) - (*) V
type A_V struct {
	bun.BaseModel `bun:"table:a_v"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	A_ID          int        `json:"a_id"`
	Ccc           string     `json:"ccc"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B (1) - (1) X
type B_X struct {
	bun.BaseModel `bun:"table:b_x"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	B_ID          int        `json:"b_id"`
	Fff           string     `json:"fff"`
	Ggg           string     `json:"ggg"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B (1) - (1) Y
type B_Y struct {
	bun.BaseModel `bun:"table:b_y"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	B_ID          int        `json:"b_id"`
	Hhh           string     `json:"hhh"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Wijziging zit tussen Registratie en om het even welke representatie in
type Wijziging struct {
	bun.BaseModel     `bun:"table:wijziging"`
	ID                int64              `json:"id" bun:"id,pk,autoincrement"`
	Wijzigingstype    WijzigingstypeEnum `json:"wijzigingstype"`
	RegistratieID     int64              `json:"registratie_id"`
	Representatienaam string             `json:"representatienaam"`
	RepresentatieID   string             `json:"representatie_id"` // Changed to string to support both numeric and string IDs
	Tijdstip          time.Time          `json:"tijdstip"`         //afgeleid van registratie tijdstip
}

type WijzigingCompact struct {
	Wijzigingstype WijzigingstypeEnum `json:"wijzigingstype"`
}

// Registratie, Correctie, Ongedaanmaking
type Registratie struct {
	bun.BaseModel              `bun:"table:registratie"`
	ID                         int64               `json:"id" bun:"id,pk,autoincrement"`
	Registratietype            RegistratietypeEnum `json:"registratietype"`
	Tijdstip                   time.Time           `json:"tijdstip"`
	Opmerking                  *string             `json:"opmerking,omitempty"`
	CorrigeertRegistratieID    *int64              `json:"corrigeert_registratie_id,omitempty"`
	MaaktOngedaanRegistratieID *int64              `json:"maakt_ongedaan_registratie_id,omitempty"`
}
