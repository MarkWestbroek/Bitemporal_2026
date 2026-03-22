package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// NatuurlijkPersoon — Entiteit A met materiële tijdlijn en onderliggende representaties U, V, W en Rel_A_B.
type NatuurlijkPersoon struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon"`
	ID int `json:"id" bun:"id,pk"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	PersoonsIdentificaties []NatuurlijkPersoon_PersoonsIdentificatie `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"persoonsidentificaties,omitempty"`
	Naams []NatuurlijkPersoon_Naam `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"naams,omitempty"`
	Burgerschaps []NatuurlijkPersoon_Burgerschap `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"burgerschaps,omitempty"`
	Bereikbaarheids []Bereikbaarheid `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"bereikbaarheids,omitempty"`
	Aanvang []NatuurlijkPersoon_Aanvang `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"aanvang,omitempty"`
	Einde []NatuurlijkPersoon_Einde `bun:"rel:has-many,join:id=natuurlijkpersoon_id" json:"einde,omitempty"`
}

// NatuurlijkPersoon_Aanvang — aanvangdatum van entiteit NatuurlijkPersoon.
type NatuurlijkPersoon_Aanvang struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_aanvang"`
	NATUURLIJKPERSOON_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum *Date `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Einde — eindedatum van entiteit NatuurlijkPersoon.
type NatuurlijkPersoon_Einde struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_einde"`
	NATUURLIJKPERSOON_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum *Date `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

// Locatie — Entiteit B met materiële tijdlijn en onderliggende representaties X en Y.
type Locatie struct {
	bun.BaseModel `bun:"table:locatie"`
	ID int `json:"id" bun:"id,pk"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	Adress []Locatie_Adres `bun:"rel:has-many,join:id=locatie_id" json:"adress,omitempty"`
	BAGlocaties []Locatie_BAGlocatie `bun:"rel:has-many,join:id=locatie_id" json:"baglocaties,omitempty"`
	Aanvang []Locatie_Aanvang `bun:"rel:has-many,join:id=locatie_id" json:"aanvang,omitempty"`
	Einde []Locatie_Einde `bun:"rel:has-many,join:id=locatie_id" json:"einde,omitempty"`
}

// Locatie_Aanvang — aanvangdatum van entiteit Locatie.
type Locatie_Aanvang struct {
	bun.BaseModel `bun:"table:locatie_aanvang"`
	LOCATIE_ID int `json:"locatie_id" bun:"locatie_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum *Date `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

// Locatie_Einde — eindedatum van entiteit Locatie.
type Locatie_Einde struct {
	bun.BaseModel `bun:"table:locatie_einde"`
	LOCATIE_ID int `json:"locatie_id" bun:"locatie_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum *Date `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

