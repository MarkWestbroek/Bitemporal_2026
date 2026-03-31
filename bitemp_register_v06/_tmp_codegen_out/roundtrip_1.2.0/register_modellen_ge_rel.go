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

// Landcode — Enkelvoudig gegevenselement landcode van Land.
type Landcode struct {
	bun.BaseModel `bun:"table:landcode,alias:landcode"`
	Land_ID       int             `json:"land_id" bun:"land_id,pk" schema_desc:"ID van de Land-entiteit"`
	Rel_ID        int             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLand    *Land           `json:"-" bun:"rel:belongs-to,join:land_id=id,on_delete:cascade"`
	Opvoer        *time.Time      `json:"opvoer,omitempty"`
	Afvoer        *time.Time      `json:"afvoer,omitempty"`
	Data          []Landcode_Data `bun:"rel:has-many,join:land_id=land_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Landcode_Data — geversioned inhoud van Landcode.
type Landcode_Data struct {
	bun.BaseModel `bun:"table:landcode_data,alias:landcode_data"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Code          string     `json:"code"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Landnaam — Enkelvoudig gegevenselement landnaam van Land.
type Landnaam struct {
	bun.BaseModel `bun:"table:landnaam,alias:landnaam"`
	Land_ID       int             `json:"land_id" bun:"land_id,pk" schema_desc:"ID van de Land-entiteit"`
	Rel_ID        int             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLand    *Land           `json:"-" bun:"rel:belongs-to,join:land_id=id,on_delete:cascade"`
	Opvoer        *time.Time      `json:"opvoer,omitempty"`
	Afvoer        *time.Time      `json:"afvoer,omitempty"`
	Data          []Landnaam_Data `bun:"rel:has-many,join:land_id=land_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Landnaam_Data — geversioned inhoud van Landnaam.
type Landnaam_Data struct {
	bun.BaseModel `bun:"table:landnaam_data,alias:landnaam_data"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string     `json:"naam"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Referentielijstnaam — Leesbare naam van een referentielijst.
type Referentielijstnaam struct {
	bun.BaseModel         `bun:"table:referentielijstnaam,alias:referentielijstnaam"`
	Referentielijst_ID    int                        `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst           `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                 `json:"opvoer,omitempty"`
	Afvoer                *time.Time                 `json:"afvoer,omitempty"`
	Data                  []Referentielijstnaam_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Referentielijstnaam_Data — geversioned inhoud van Referentielijstnaam.
type Referentielijstnaam_Data struct {
	bun.BaseModel      `bun:"table:referentielijstnaam_data,alias:referentielijstnaam_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam               string     `json:"naam"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// Referentielijstomschrijving — Omschrijving van een referentielijst.
type Referentielijstomschrijving struct {
	bun.BaseModel         `bun:"table:referentielijstomschrijving,alias:referentielijstomschrijving"`
	Referentielijst_ID    int                                `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                                `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                   `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                         `json:"opvoer,omitempty"`
	Afvoer                *time.Time                         `json:"afvoer,omitempty"`
	Data                  []Referentielijstomschrijving_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Referentielijstomschrijving_Data — geversioned inhoud van Referentielijstomschrijving.
type Referentielijstomschrijving_Data struct {
	bun.BaseModel      `bun:"table:referentielijstomschrijving_data,alias:referentielijstomschrijving_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Omschrijving       string     `json:"omschrijving"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// ReferentielijstVisibility — Domeinzichtbaarheid van een referentielijst (register, modelspecifiek, extern).
type ReferentielijstVisibility struct {
	bun.BaseModel         `bun:"table:referentielijstvisibility,alias:referentielijstvisibility"`
	Referentielijst_ID    int                              `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                              `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                 `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                       `json:"opvoer,omitempty"`
	Afvoer                *time.Time                       `json:"afvoer,omitempty"`
	Data                  []ReferentielijstVisibility_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// ReferentielijstVisibility_Data — geversioned inhoud van ReferentielijstVisibility.
type ReferentielijstVisibility_Data struct {
	bun.BaseModel      `bun:"table:referentielijstvisibility_data,alias:referentielijstvisibility_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Domein             string     `json:"domein"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// ReferentielijstInternetadres — Internetadres (URL/URN) van een referentielijst.
type ReferentielijstInternetadres struct {
	bun.BaseModel         `bun:"table:referentielijstinternetadres,alias:referentielijstinternetadres"`
	Referentielijst_ID    int                                 `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                                 `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                    `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                          `json:"opvoer,omitempty"`
	Afvoer                *time.Time                          `json:"afvoer,omitempty"`
	Data                  []ReferentielijstInternetadres_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// ReferentielijstInternetadres_Data — geversioned inhoud van ReferentielijstInternetadres.
type ReferentielijstInternetadres_Data struct {
	bun.BaseModel      `bun:"table:referentielijstinternetadres_data,alias:referentielijstinternetadres_data"`
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
