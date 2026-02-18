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

type Metatype string

const (
	MetatypeEntiteit        Metatype = "entiteit"
	MetatypeRelatie         Metatype = "relatie"
	MetatypeGegevenselement Metatype = "gegevenselement"
)

type Metatyped interface {
	Metatype() Metatype
}

func IsEntiteit(v Metatyped) bool {
	return v.Metatype() == MetatypeEntiteit
}

func IsRelatie(v Metatyped) bool {
	return v.Metatype() == MetatypeRelatie
}

func IsGegevenselement(v Metatyped) bool {
	return v.Metatype() == MetatypeGegevenselement
}

type Representatie interface {
	HasID
	Metatyped
}

func (reg Registratie) GetID() any { return reg.ID }
func (wij Wijziging) GetID() any   { return wij.ID }

// Wijziging zit tussen Registratie en om het even welke representatie in
// gebruikt om de gegevens in de database te zetten
type Wijziging struct {
	bun.BaseModel     `bun:"table:wijziging"`
	ID                int64              `json:"id" bun:"id,pk,autoincrement"`
	Wijzigingstype    WijzigingstypeEnum `json:"wijzigingstype"`
	RegistratieID     int64              `json:"registratie_id"`
	Representatienaam string             `json:"representatienaam"`
	RepresentatieID   string             `json:"representatie_id"` // Changed to string to support both numeric and string IDs
	Tijdstip          time.Time          `json:"tijdstip"`         //afgeleid van registratie tijdstip
}

// not used (yet?)
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
