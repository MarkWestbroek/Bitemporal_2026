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
