package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// NatuurlijkPersoon — Entiteit A met materiële tijdlijn en onderliggende representaties U, V, W en Rel_A_B.
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

// Locatie — Entiteit B met materiële tijdlijn en onderliggende representaties X en Y.
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

/* ================================================================
   REFERENTIELIJST — generieke entiteit voor alle referentielijsten.
   Individuele lijsten (Landenlijst, EULidstaten, etc.) zijn records in deze tabel.
   ================================================================ */

// Referentielijst — generieke referentielijst-entiteit.
// Elke referentielijst (bijv. Landenlijst) is een record in deze tabel.
type Referentielijst struct {
	bun.BaseModel                 `bun:"table:register_referentielijst,alias:register_referentielijst"`
	ID                            int                           `json:"id" bun:"id,pk,autoincrement"`
	Systeemnaam                   string                        `json:"systeemnaam" bun:"systeemnaam,unique"`
	Opvoer                        *time.Time                    `json:"opvoer,omitempty"`
	Afvoer                        *time.Time                    `json:"afvoer,omitempty"`
	Referentielijstnamen          []Referentielijstnaam         `bun:"rel:has-many,join:id=referentielijst_id" json:"referentielijstnamen,omitempty"`
	Referentielijstomschrijvingen []Referentielijstomschrijving `bun:"rel:has-many,join:id=referentielijst_id" json:"referentielijstomschrijvingen,omitempty"`
	LandenlijstLanden             []LandenlijstLand             `bun:"rel:has-many,join:id=referentielijst_id" json:"landenlijst_landen,omitempty"`
	Aanvang                       []Referentielijst_Aanvang     `bun:"rel:has-many,join:id=referentielijst_id" json:"aanvang,omitempty"`
	Einde                         []Referentielijst_Einde       `bun:"rel:has-many,join:id=referentielijst_id" json:"einde,omitempty"`
}

// Referentielijst_Aanvang — aanvangsdatum van Referentielijst.
type Referentielijst_Aanvang struct {
	bun.BaseModel      `bun:"table:referentielijst_aanvang,alias:referentielijst_aanvang"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum              *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// Referentielijst_Einde — einddatum van Referentielijst.
type Referentielijst_Einde struct {
	bun.BaseModel      `bun:"table:referentielijst_einde,alias:referentielijst_einde"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum              *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

/* ================================================================
   LAND — referentielijst-item-entiteit (record per individueel land).
   ================================================================ */

// Land — referentielijst-item-entiteit voor individuele landen.
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

// Land_Aanvang — aanvangsdatum van referentielijst-item Land.
type Land_Aanvang struct {
	bun.BaseModel `bun:"table:land_aanvang,alias:land_aanvang"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Land_Einde — einddatum van referentielijst-item Land.
type Land_Einde struct {
	bun.BaseModel `bun:"table:land_einde,alias:land_einde"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
