package model

// Hub + _Data structs voor register-domein gegevenselementen en relaties.
// Bevat: Referentielijstnaam, Referentielijstomschrijving, ReferentielijstVisibility,
// ReferentielijstInternetadres + bijbehorende enum ReferentielijstAdrestype.

import (
	"time"

	"github.com/uptrace/bun"
)

// ReferentielijstAdrestype — enumtype voor soort internetadres (URL of URN).
type ReferentielijstAdrestype string

const (
	ReferentielijstAdrestypeURL ReferentielijstAdrestype = "URL"
	ReferentielijstAdrestypeURN ReferentielijstAdrestype = "URN"
)

/* ================================================================
   Referentielijstnaam + _Data
   ================================================================ */

// Referentielijstnaam — enkelvoudig GE voor de leesbare naam van een referentielijst.
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

/* ================================================================
   Referentielijstomschrijving + _Data
   ================================================================ */

// Referentielijstomschrijving — enkelvoudig GE voor de omschrijving van een referentielijst.
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

/* ================================================================
   ReferentielijstVisibility + _Data
   ================================================================ */

// ReferentielijstVisibility — enkelvoudig GE voor de domeinzichtbaarheid van een referentielijst.
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
	Domein             string     `json:"domein" schema_desc:"Domeinzichtbaarheid: 'register', modelspecifiek domein, of 'extern'."`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

/* ================================================================
   ReferentielijstInternetadres + _Data
   ================================================================ */

// ReferentielijstInternetadres — meervoudig GE: een extern internet-adres van een referentielijst.
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
	Adrestype          ReferentielijstAdrestype `json:"adrestype" schema_desc:"Type adres: URL of URN."`
	Adres              string                   `json:"adres" schema_desc:"Het volledige internet-adres (URL of URN)."`
	Organisatie        string                   `json:"organisatie" schema_desc:"Verantwoordelijke organisatie voor dit adres."`
	Opvoer             *time.Time               `json:"opvoer,omitempty"`
	Afvoer             *time.Time               `json:"afvoer,omitempty"`
}
