package model

import (
	"time"

	"github.com/uptrace/bun"
)

/* ======= GENERIEKE REPRESENTATIE INTERFACES EN HELPERS ====== */

// Representatie is de gemeenschappelijke interface voor alle representaties (entiteiten, relaties, gegevenselementen)
type Representatie interface {
	HasID
	Metatyped
	String() string // voor debuggen
}

// FormeleRepresentatie combineert de Representatie interface met opvoer/afvoer (formele tijdslijn)
type FormeleRepresentatie interface {
	Representatie
	HeeftOpvoerAfvoer
}

// MaterieleRepresentatie combineert de FormeleRepresentatie interface met aanvang/einde (materiële tijdslijn)
type MaterieleRepresentatie interface {
	FormeleRepresentatie
	HeeftAanvangEinde
}

// HasID allows generic handlers to access an entity's ID
type HasID interface {
	GetID() any
}

type Metatype string

const (
	MetatypeEntiteit        Metatype = "entiteit"
	MetatypeRelatie         Metatype = "relatie"
	MetatypeGegevenselement Metatype = "gegevenselement"
)

type Metatyped interface {
	Metatype() Metatype
}

// HeeftOpvoerAfvoer beschrijft representaties met opvoer/afvoer tijdstippen.
// Setters gebruiken pointer receivers op de concrete types.
type HeeftOpvoerAfvoer interface {
	GetOpvoer() *time.Time
	SetOpvoer(*time.Time)
	GetAfvoer() *time.Time
	SetAfvoer(*time.Time)
}

// HeeftAanvangEinde beschrijft representaties met aanvang/einde tijdstippen.
type HeeftAanvangEinde interface {
	GetAanvang() *time.Time
	SetAanvang(*time.Time)
	GetEinde() *time.Time
	SetEinde(*time.Time)
}

// helper functies voor type checks
func IsEntiteit(v Metatyped) bool {
	return v.Metatype() == MetatypeEntiteit
}

func IsRelatie(v Metatyped) bool {
	return v.Metatype() == MetatypeRelatie
}

func IsGegevenselement(v Metatyped) bool {
	return v.Metatype() == MetatypeGegevenselement
}

/* ====== WIJZIGING EN REGISTRATIE STRUCTUREN ====== */

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

// Wijziging zit tussen Registratie en om het even welke representatie in
// gebruikt om de gegevens in de database te zetten
type Wijziging struct {
	bun.BaseModel     `bun:"table:wijziging"`
	ID                int64              `json:"id" bun:"id,pk,autoincrement"`
	Wijzigingstype    WijzigingstypeEnum `json:"wijzigingstype"`    // Opvoer of Afvoer
	RegistratieID     int64              `json:"registratie_id"`    // verwijzing naar de registratie waarbij deze wijziging hoort
	Representatienaam string             `json:"representatienaam"` // zachte link naar de representatie, zoals "a", "b", "rel_a_b", "u", "v", "x" of "y"
	RepresentatieID   string             `json:"representatie_id"`  // Bewust een string to support both numeric and string IDs, or for instance UUIDs
	Tijdstip          time.Time          `json:"tijdstip"`          //afgeleid van registratie tijdstip
	// TODO TIJDSTIP ook REGISTRATIETIJDSTIP noemen?
}

// not used (yet?)
type WijzigingCompact struct {
	Wijzigingstype WijzigingstypeEnum `json:"wijzigingstype"`
}

// Registratie, Correctie, Ongedaanmaking
type Registratie struct {
	bun.BaseModel              `bun:"table:registratie"`
	ID                         int64               `json:"id" bun:"id,pk,autoincrement"`
	Registratietype            RegistratietypeEnum `json:"registratietype"`                         // Registratie, Correctie, Ongedaanmaking
	Tijdstip                   time.Time           `json:"tijdstip"`                                // Het tijdstip van de registratie, correctie of ongedaanmaking
	Opmerking                  *string             `json:"opmerking,omitempty"`                     // optioneel veld voor extra informatie
	CorrigeertRegistratieID    *int64              `json:"corrigeert_registratie_id,omitempty"`     // bij correcties: verwijzing naar de registratie die gecorrigeerd wordt
	MaaktOngedaanRegistratieID *int64              `json:"maakt_ongedaan_registratie_id,omitempty"` // bij ongedaanmakings: verwijzing naar de registratie die ongedaan wordt gemaakt
}

// methodes op registratie en wijziging om ID te kunnen ophalen in de generic handlers
func (reg Registratie) GetID() any { return reg.ID } // waarschijnlijk niet nodig, want Registratie is geen representatie
func (wij Wijziging) GetID() any   { return wij.ID } //waarschijnlijk niet nodig, want Wijziging is geen representatie
