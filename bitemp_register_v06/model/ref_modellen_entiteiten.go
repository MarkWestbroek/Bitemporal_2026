package model

// Entiteitstructs voor referentielijsten (testmodel: Landenlijst, Land).
// Referentielijst-subtypes gedragen zich als gewone entiteiten;
// het onderscheid zit in EntiteitSubtype in de MetaRegistry.

import (
	"time"

	"github.com/uptrace/bun"
)

// RegisterReferentielijst — systeemtabel: één record per referentielijst in het MetaRegistry.
// Wordt bij API-opstart gesynchroniseerd vanuit de MetaRegistry (zie dbsetup/createtables.go).
type RegisterReferentielijst struct {
	bun.BaseModel `bun:"table:register_referentielijst,alias:register_referentielijst"`
	ID            int    `json:"id" bun:"id,pk,autoincrement"`
	Typenaam      string `json:"typenaam" bun:"typenaam,unique"`
	Naam          string `json:"naam"`
	Beschrijving  string `json:"beschrijving,omitempty"`
	IsMaterieel   bool   `json:"is_materieel"`
}

// Landenlijst — referentielijst-entiteit voor landen.
type Landenlijst struct {
	bun.BaseModel     `bun:"table:landenlijst,alias:landenlijst"`
	ID                int                   `json:"id" bun:"id,pk"`
	Opvoer            *time.Time            `json:"opvoer,omitempty"`
	Afvoer            *time.Time            `json:"afvoer,omitempty"`
	LandenlijstLanden []Landenlijst_Land    `bun:"rel:has-many,join:id=landenlijst_id" json:"landenlijst_landen,omitempty"`
	Aanvang           []Landenlijst_Aanvang `bun:"rel:has-many,join:id=landenlijst_id" json:"aanvang,omitempty"`
	Einde             []Landenlijst_Einde   `bun:"rel:has-many,join:id=landenlijst_id" json:"einde,omitempty"`
}

// Landenlijst_Aanvang — aanvangsdatum van referentielijst Landenlijst.
type Landenlijst_Aanvang struct {
	bun.BaseModel  `bun:"table:landenlijst_aanvang,alias:landenlijst_aanvang"`
	Landenlijst_ID int        `json:"landenlijst_id" bun:"landenlijst_id,pk"`
	Versie         int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum          *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer         *time.Time `json:"opvoer,omitempty"`
	Afvoer         *time.Time `json:"afvoer,omitempty"`
}

// Landenlijst_Einde — einddatum van referentielijst Landenlijst.
type Landenlijst_Einde struct {
	bun.BaseModel  `bun:"table:landenlijst_einde,alias:landenlijst_einde"`
	Landenlijst_ID int        `json:"landenlijst_id" bun:"landenlijst_id,pk"`
	Versie         int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum          *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer         *time.Time `json:"opvoer,omitempty"`
	Afvoer         *time.Time `json:"afvoer,omitempty"`
}

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
