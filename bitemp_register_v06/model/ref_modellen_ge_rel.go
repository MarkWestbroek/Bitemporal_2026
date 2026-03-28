package model

// Hub + _Data structs voor gegevenselementen en relaties van het referentielijst-testmodel.
// Landcode, Landnaam (GE-hubs van Land), Landenlijst_Land (relatie-hub).

import (
	"time"

	"github.com/uptrace/bun"
)

// Landcode — enkelvoudig gegevenselement landcode van entiteit Land.
type Landcode struct {
	bun.BaseModel `bun:"table:landcode,alias:landcode"`
	Land_ID       int             `json:"land_id" bun:"land_id,pk" schema_desc:"ID van de Land-entiteit"`
	Rel_ID        int             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLand    *Land           `json:"-" bun:"rel:belongs-to,join:land_id=id,on_delete:cascade"`
	Opvoer        *time.Time      `json:"opvoer,omitempty"`
	Afvoer        *time.Time      `json:"afvoer,omitempty"`
	Data          []Landcode_Data `bun:"rel:has-many,join:land_id=land_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Landcode_Data — geversioned inhoud van gegevenselement Landcode.
type Landcode_Data struct {
	bun.BaseModel `bun:"table:landcode_data,alias:landcode_data"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Code          string     `json:"code"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Landnaam — enkelvoudig gegevenselement landnaam van entiteit Land.
type Landnaam struct {
	bun.BaseModel `bun:"table:landnaam,alias:landnaam"`
	Land_ID       int             `json:"land_id" bun:"land_id,pk" schema_desc:"ID van de Land-entiteit"`
	Rel_ID        int             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLand    *Land           `json:"-" bun:"rel:belongs-to,join:land_id=id,on_delete:cascade"`
	Opvoer        *time.Time      `json:"opvoer,omitempty"`
	Afvoer        *time.Time      `json:"afvoer,omitempty"`
	Data          []Landnaam_Data `bun:"rel:has-many,join:land_id=land_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Landnaam_Data — geversioned inhoud van gegevenselement Landnaam.
type Landnaam_Data struct {
	bun.BaseModel `bun:"table:landnaam_data,alias:landnaam_data"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string     `json:"naam"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Landenlijst_Land — koppelrelatie (referentielijst_items) tussen Landenlijst en Land.
type Landenlijst_Land struct {
	bun.BaseModel     `bun:"table:landenlijst_land,alias:landenlijst_land"`
	Landenlijst_ID    int                     `json:"landenlijst_id" bun:"landenlijst_id,pk" schema_desc:"ID van de Landenlijst-entiteit"`
	Rel_ID            int                     `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLandenlijst *Landenlijst            `json:"-" bun:"rel:belongs-to,join:landenlijst_id=id,on_delete:cascade"`
	Land_ID           int                     `json:"land_id"`
	Opvoer            *time.Time              `json:"opvoer,omitempty"`
	Afvoer            *time.Time              `json:"afvoer,omitempty"`
	Data              []Landenlijst_Land_Data `bun:"rel:has-many,join:landenlijst_id=landenlijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Landenlijst_Land_Data — geversioned inhoud van koppelrelatie Landenlijst_Land.
// Momenteel geen inhoudelijke velden; de relatie is puur structureel.
type Landenlijst_Land_Data struct {
	bun.BaseModel  `bun:"table:landenlijst_land_data,alias:landenlijst_land_data"`
	Landenlijst_ID int        `json:"landenlijst_id" bun:"landenlijst_id,pk"`
	Rel_ID         int        `json:"rel_id" bun:"rel_id,pk"`
	Versie         int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer         *time.Time `json:"opvoer,omitempty"`
	Afvoer         *time.Time `json:"afvoer,omitempty"`
}
