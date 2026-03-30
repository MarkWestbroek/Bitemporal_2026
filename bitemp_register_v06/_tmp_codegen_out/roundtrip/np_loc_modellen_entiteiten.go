package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// Land — Referentielijst-item: individueel land.
type Land struct {
	bun.BaseModel `bun:"table:land,alias:land"`
	ID            int            `json:"id" bun:"id,pk"`
	Opvoer        *time.Time     `json:"opvoer,omitempty"`
	Afvoer        *time.Time     `json:"afvoer,omitempty"`
	Landcodes     []Landcode     `bun:"rel:has-many,join:id=land_id" json:"landcodes,omitempty"`
	Landnamen     []Landnaam     `bun:"rel:has-many,join:id=land_id" json:"landnamen,omitempty"`
	Aanvang       []Land_Aanvang `bun:"rel:has-many,join:id=land_id" json:"aanvang,omitempty"`
	Einde         []Land_Einde   `bun:"rel:has-many,join:id=land_id" json:"einde,omitempty"`
}

// Land_Aanvang — aanvangdatum van entiteit Land.
type Land_Aanvang struct {
	bun.BaseModel `bun:"table:land_aanvang,alias:land_aanvang"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Land_Einde — eindedatum van entiteit Land.
type Land_Einde struct {
	bun.BaseModel `bun:"table:land_einde,alias:land_einde"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Locatie — Fysiek bezoekbare locatie gelegen op het aardoppervlak.
type Locatie struct {
	bun.BaseModel `bun:"table:locatie,alias:locatie"`
	ID            int                  `json:"id" bun:"id,pk"`
	Opvoer        *time.Time           `json:"opvoer,omitempty"`
	Afvoer        *time.Time           `json:"afvoer,omitempty"`
	Adressen      []Locatie_Adres      `bun:"rel:has-many,join:id=locatie_id" json:"adressen,omitempty"`
	Baglocaties   []Locatie_BAGlocatie `bun:"rel:has-many,join:id=locatie_id" json:"baglocaties,omitempty"`
	Aanvang       []Locatie_Aanvang    `bun:"rel:has-many,join:id=locatie_id" json:"aanvang,omitempty"`
	Einde         []Locatie_Einde      `bun:"rel:has-many,join:id=locatie_id" json:"einde,omitempty"`
}

// Locatie_Aanvang — aanvangdatum van entiteit Locatie.
type Locatie_Aanvang struct {
	bun.BaseModel `bun:"table:locatie_aanvang,alias:locatie_aanvang"`
	Locatie_ID    int        `json:"locatie_id" bun:"locatie_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Locatie_Einde — eindedatum van entiteit Locatie.
type Locatie_Einde struct {
	bun.BaseModel `bun:"table:locatie_einde,alias:locatie_einde"`
	Locatie_ID    int        `json:"locatie_id" bun:"locatie_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon — Een mens voor zover deze door Nederlandse wetgeving met rechten en plichten wordt bekleed.
type NatuurlijkPersoon struct {
	bun.BaseModel          `bun:"table:natuurlijkpersoon,alias:natuurlijkpersoon"`
	ID                     int                                       `json:"id" bun:"id,pk"`
	Opvoer                 *time.Time                                `json:"opvoer,omitempty"`
	Afvoer                 *time.Time                                `json:"afvoer,omitempty"`
	Persoonsidentificaties []NatuurlijkPersoon_Persoonsidentificatie `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"persoonsidentificaties,omitempty"`
	Namen                  []NatuurlijkPersoon_Naam                  `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"namen,omitempty"`
	Burgerschappen         []NatuurlijkPersoon_Burgerschap           `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"burgerschappen,omitempty"`
	Partnernamen           []NatuurlijkPersoon_Partnernaam           `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"partnernamen,omitempty"`
	Naamgebruiken          []NatuurlijkPersoon_Naamgebruik           `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"naamgebruiken,omitempty"`
	Bereikbaarheden        []Bereikbaarheid                          `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"bereikbaarheden,omitempty"`
	Aanvang                []NatuurlijkPersoon_Aanvang               `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"aanvang,omitempty"`
	Einde                  []NatuurlijkPersoon_Einde                 `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"einde,omitempty"`
}

// NatuurlijkPersoon_Aanvang — aanvangdatum van entiteit NatuurlijkPersoon.
type NatuurlijkPersoon_Aanvang struct {
	bun.BaseModel        `bun:"table:natuurlijkpersoon_aanvang,alias:natuurlijkpersoon_aanvang"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Einde — eindedatum van entiteit NatuurlijkPersoon.
type NatuurlijkPersoon_Einde struct {
	bun.BaseModel        `bun:"table:natuurlijkpersoon_einde,alias:natuurlijkpersoon_einde"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}
