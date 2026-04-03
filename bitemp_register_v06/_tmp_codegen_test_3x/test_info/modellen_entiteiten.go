package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// A — Entiteit A met materiele tijdlijn en onderliggende representaties U, V, W en Rel_A_B.
type A struct {
	bun.BaseModel `bun:"table:a,alias:a"`
	ID            int         `json:"id" bun:"id,pk"`
	Opvoer        *time.Time  `json:"opvoer,omitempty"`
	Afvoer        *time.Time  `json:"afvoer,omitempty"`
	AUs           []A_U       `bun:"rel:has-many,join:id=a_id" json:"a_us,omitempty"`
	AVs           []A_V       `bun:"rel:has-many,join:id=a_id" json:"a_vs,omitempty"`
	AWs           []A_W       `bun:"rel:has-many,join:id=a_id" json:"a_ws,omitempty"`
	RelABs        []Rel_A_B   `bun:"rel:has-many,join:id=a_id" json:"rel_a_bs,omitempty"`
	Aanvang       []A_Aanvang `bun:"rel:has-many,join:id=a_id" json:"aanvang,omitempty"`
	Einde         []A_Einde   `bun:"rel:has-many,join:id=a_id" json:"einde,omitempty"`
}

// A_Aanvang — aanvangdatum van entiteit A.
type A_Aanvang struct {
	bun.BaseModel `bun:"table:a_aanvang,alias:a_aanvang"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A_Einde — eindedatum van entiteit A.
type A_Einde struct {
	bun.BaseModel `bun:"table:a_einde,alias:a_einde"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// AdellijkeTitel — Referentielijst-item: adellijke titel.
type AdellijkeTitel struct {
	bun.BaseModel        `bun:"table:adellijketitel,alias:adellijketitel"`
	ID                   int                   `json:"id" bun:"id,pk"`
	Opvoer               *time.Time            `json:"opvoer,omitempty"`
	Afvoer               *time.Time            `json:"afvoer,omitempty"`
	AdellijkeTitelTitels []AdellijkeTitelTitel `bun:"rel:has-many,join:id=adellijketitel_id" json:"adellijke_titel_titels,omitempty"`
}

// B — Entiteit B met materiele tijdlijn en onderliggende representaties X en Y.
type B struct {
	bun.BaseModel `bun:"table:b,alias:b"`
	ID            int         `json:"id" bun:"id,pk"`
	Opvoer        *time.Time  `json:"opvoer,omitempty"`
	Afvoer        *time.Time  `json:"afvoer,omitempty"`
	BXs           []B_X       `bun:"rel:has-many,join:id=b_id" json:"b_xs,omitempty"`
	BYs           []B_Y       `bun:"rel:has-many,join:id=b_id" json:"b_ys,omitempty"`
	Aanvang       []B_Aanvang `bun:"rel:has-many,join:id=b_id" json:"aanvang,omitempty"`
	Einde         []B_Einde   `bun:"rel:has-many,join:id=b_id" json:"einde,omitempty"`
}

// B_Aanvang — aanvangdatum van entiteit B.
type B_Aanvang struct {
	bun.BaseModel `bun:"table:b_aanvang,alias:b_aanvang"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B_Einde — eindedatum van entiteit B.
type B_Einde struct {
	bun.BaseModel `bun:"table:b_einde,alias:b_einde"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

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

// Referentielijst — Generieke referentielijst-entiteit. Individuele lijsten (Landenlijst, EULidstaten, etc.) zijn records.
type Referentielijst struct {
	bun.BaseModel                 `bun:"table:referentielijst,alias:referentielijst"`
	ID                            int                            `json:"id" bun:"id,pk"`
	Opvoer                        *time.Time                     `json:"opvoer,omitempty"`
	Afvoer                        *time.Time                     `json:"afvoer,omitempty"`
	Referentielijstnamen          []Referentielijstnaam          `bun:"rel:has-many,join:id=referentielijst_id" json:"referentielijstnamen,omitempty"`
	Referentielijstomschrijvingen []Referentielijstomschrijving  `bun:"rel:has-many,join:id=referentielijst_id" json:"referentielijstomschrijvingen,omitempty"`
	Visibilities                  []ReferentielijstVisibility    `bun:"rel:has-many,join:id=referentielijst_id" json:"visibilities,omitempty"`
	Internetadressen              []ReferentielijstInternetadres `bun:"rel:has-many,join:id=referentielijst_id" json:"internetadressen,omitempty"`
	LandenlijstLanden             []LandenlijstLand              `bun:"rel:has-many,join:id=referentielijst_id" json:"landenlijst_landen,omitempty"`
	AdellijkeTitelsTitels         []AdellijkeTitelsTitel         `bun:"rel:has-many,join:id=referentielijst_id" json:"adellijke_titels_titels,omitempty"`
	Aanvang                       []Referentielijst_Aanvang      `bun:"rel:has-many,join:id=referentielijst_id" json:"aanvang,omitempty"`
	Einde                         []Referentielijst_Einde        `bun:"rel:has-many,join:id=referentielijst_id" json:"einde,omitempty"`
}

// Referentielijst_Aanvang — aanvangdatum van entiteit Referentielijst.
type Referentielijst_Aanvang struct {
	bun.BaseModel      `bun:"table:referentielijst_aanvang,alias:referentielijst_aanvang"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum              *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// Referentielijst_Einde — eindedatum van entiteit Referentielijst.
type Referentielijst_Einde struct {
	bun.BaseModel      `bun:"table:referentielijst_einde,alias:referentielijst_einde"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum              *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}
