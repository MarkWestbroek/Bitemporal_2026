package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type ReferentielijstAdrestype string

const (
	ReferentielijstAdrestypeURL ReferentielijstAdrestype = "URL"
	ReferentielijstAdrestypeURN ReferentielijstAdrestype = "URN"
)

// Land_Landcode — Enkelvoudig gegevenselement landcode van Land.
type Land_Landcode struct {
	bun.BaseModel `bun:"table:land_landcode,alias:land_landcode"`
	Land_ID       int                  `json:"land_id" bun:"land_id,pk" schema_desc:"ID van de Land-entiteit"`
	Rel_ID        int                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLand    *Land                `json:"-" bun:"rel:belongs-to,join:land_id=id,on_delete:cascade"`
	Opvoer        *time.Time           `json:"opvoer,omitempty"`
	Afvoer        *time.Time           `json:"afvoer,omitempty"`
	Data          []Land_Landcode_Data `bun:"rel:has-many,join:land_id=land_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Land_Landcode_Data — geversioned inhoud van Land_Landcode.
type Land_Landcode_Data struct {
	bun.BaseModel `bun:"table:land_landcode_data,alias:land_landcode_data"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Code          string     `json:"code"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Land_Landnaam — Enkelvoudig gegevenselement landnaam van Land.
type Land_Landnaam struct {
	bun.BaseModel `bun:"table:land_landnaam,alias:land_landnaam"`
	Land_ID       int                  `json:"land_id" bun:"land_id,pk" schema_desc:"ID van de Land-entiteit"`
	Rel_ID        int                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLand    *Land                `json:"-" bun:"rel:belongs-to,join:land_id=id,on_delete:cascade"`
	Opvoer        *time.Time           `json:"opvoer,omitempty"`
	Afvoer        *time.Time           `json:"afvoer,omitempty"`
	Data          []Land_Landnaam_Data `bun:"rel:has-many,join:land_id=land_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Land_Landnaam_Data — geversioned inhoud van Land_Landnaam.
type Land_Landnaam_Data struct {
	bun.BaseModel `bun:"table:land_landnaam_data,alias:land_landnaam_data"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string     `json:"naam"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Referentielijst_Referentielijstnaam — Leesbare naam van een referentielijst.
type Referentielijst_Referentielijstnaam struct {
	bun.BaseModel         `bun:"table:referentielijst_referentielijstnaam,alias:referentielijst_referentielijstnaam"`
	Referentielijst_ID    int                                        `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                                        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                           `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                                 `json:"opvoer,omitempty"`
	Afvoer                *time.Time                                 `json:"afvoer,omitempty"`
	Data                  []Referentielijst_Referentielijstnaam_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Referentielijst_Referentielijstnaam_Data — geversioned inhoud van Referentielijst_Referentielijstnaam.
type Referentielijst_Referentielijstnaam_Data struct {
	bun.BaseModel      `bun:"table:referentielijst_referentielijstnaam_data,alias:referentielijst_referentielijstnaam_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam               string     `json:"naam"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// Referentielijst_Referentielijstomschrijving — Omschrijving van een referentielijst.
type Referentielijst_Referentielijstomschrijving struct {
	bun.BaseModel         `bun:"table:referentielijst_referentielijstomschrijving,alias:referentielijst_referentielijstomschrijving"`
	Referentielijst_ID    int                                                `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                                                `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                                   `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                                         `json:"opvoer,omitempty"`
	Afvoer                *time.Time                                         `json:"afvoer,omitempty"`
	Data                  []Referentielijst_Referentielijstomschrijving_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Referentielijst_Referentielijstomschrijving_Data — geversioned inhoud van Referentielijst_Referentielijstomschrijving.
type Referentielijst_Referentielijstomschrijving_Data struct {
	bun.BaseModel      `bun:"table:referentielijst_referentielijstomschrijving_data,alias:referentielijst_referentielijstomschrijving_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Omschrijving       string     `json:"omschrijving"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// Referentielijst_ReferentielijstVisibility — Domeinzichtbaarheid van een referentielijst (register, modelspecifiek, extern).
type Referentielijst_ReferentielijstVisibility struct {
	bun.BaseModel         `bun:"table:referentielijst_referentielijstvisibility,alias:referentielijst_referentielijstvisibility"`
	Referentielijst_ID    int                                              `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                                              `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                                 `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                                       `json:"opvoer,omitempty"`
	Afvoer                *time.Time                                       `json:"afvoer,omitempty"`
	Data                  []Referentielijst_ReferentielijstVisibility_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Referentielijst_ReferentielijstVisibility_Data — geversioned inhoud van Referentielijst_ReferentielijstVisibility.
type Referentielijst_ReferentielijstVisibility_Data struct {
	bun.BaseModel      `bun:"table:referentielijst_referentielijstvisibility_data,alias:referentielijst_referentielijstvisibility_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Domein             string     `json:"domein"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// Referentielijst_ReferentielijstInternetadres — Internetadres (URL/URN) van een referentielijst.
type Referentielijst_ReferentielijstInternetadres struct {
	bun.BaseModel         `bun:"table:referentielijst_referentielijstinternetadres,alias:referentielijst_referentielijstinternetadres"`
	Referentielijst_ID    int                                                 `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                                                 `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                                    `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                                          `json:"opvoer,omitempty"`
	Afvoer                *time.Time                                          `json:"afvoer,omitempty"`
	Data                  []Referentielijst_ReferentielijstInternetadres_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Referentielijst_ReferentielijstInternetadres_Data — geversioned inhoud van Referentielijst_ReferentielijstInternetadres.
type Referentielijst_ReferentielijstInternetadres_Data struct {
	bun.BaseModel      `bun:"table:referentielijst_referentielijstinternetadres_data,alias:referentielijst_referentielijstinternetadres_data"`
	Referentielijst_ID int                      `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int                      `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64                    `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Adrestype          ReferentielijstAdrestype `json:"adrestype" schema:"enum=ReferentielijstAdrestype"`
	Adres              string                   `json:"adres"`
	Organisatie        string                   `json:"organisatie"`
	Opvoer             *time.Time               `json:"opvoer,omitempty"`
	Afvoer             *time.Time               `json:"afvoer,omitempty"`
}

// LandenlijstLand — Koppeling van een land aan referentielijst-instantie Landenlijst (referentielijst-items relatie).
type LandenlijstLand struct {
	bun.BaseModel         `bun:"table:landenlijstland,alias:landenlijstland"`
	Referentielijst_ID    int                    `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                    `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst       `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Land_ID               int                    `json:"land_id"`
	Opvoer                *time.Time             `json:"opvoer,omitempty"`
	Afvoer                *time.Time             `json:"afvoer,omitempty"`
	Data                  []LandenlijstLand_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// LandenlijstLand_Data — geversioned inhoud van LandenlijstLand.
type LandenlijstLand_Data struct {
	bun.BaseModel      `bun:"table:landenlijstland_data,alias:landenlijstland_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// AdellijkeTitelsTitel — Koppeling van een adellijke titel aan referentielijst-instantie AdellijkeTitels (referentielijst-items relatie).
type AdellijkeTitelsTitel struct {
	bun.BaseModel         `bun:"table:adellijketitelstitel,alias:adellijketitelstitel"`
	Referentielijst_ID    int                         `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                         `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst            `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Adellijketitel_ID     int                         `json:"adellijketitel_id"`
	Opvoer                *time.Time                  `json:"opvoer,omitempty"`
	Afvoer                *time.Time                  `json:"afvoer,omitempty"`
	Data                  []AdellijkeTitelsTitel_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// AdellijkeTitelsTitel_Data — geversioned inhoud van AdellijkeTitelsTitel.
type AdellijkeTitelsTitel_Data struct {
	bun.BaseModel      `bun:"table:adellijketitelstitel_data,alias:adellijketitelstitel_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}
