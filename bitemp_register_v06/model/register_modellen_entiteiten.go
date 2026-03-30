package model

// Entiteit-structs en materiële plumbing (Aanvang/Einde) voor het register-domein.
// Bevat: Referentielijst (generieke referentielijst-entiteit).

import (
	"time"

	"github.com/uptrace/bun"
)

/* ================================================================
   REFERENTIELIJST — generieke entiteit voor alle referentielijsten.
   Individuele lijsten (Landenlijst, EULidstaten, etc.) zijn records in deze tabel.
   ================================================================ */

// Referentielijst — generieke referentielijst-entiteit.
// Elke referentielijst (bijv. Landenlijst) is een record in deze tabel.
// Domein-specifieke velden (bijv. LandenlijstLanden) worden via het domein-bestand
// toegevoegd aan de Referentielijst struct; het struct-veld moet hier al bestaan
// zodat Bun het correct kan laden.
type Referentielijst struct {
	bun.BaseModel                 `bun:"table:register_referentielijst,alias:register_referentielijst"`
	ID                            int                            `json:"id" bun:"id,pk,autoincrement"`
	Systeemnaam                   string                         `json:"systeemnaam" bun:"systeemnaam,unique"`
	Opvoer                        *time.Time                     `json:"opvoer,omitempty"`
	Afvoer                        *time.Time                     `json:"afvoer,omitempty"`
	Referentielijstnamen          []Referentielijstnaam          `bun:"rel:has-many,join:id=referentielijst_id" json:"referentielijstnamen,omitempty"`
	Referentielijstomschrijvingen []Referentielijstomschrijving  `bun:"rel:has-many,join:id=referentielijst_id" json:"referentielijstomschrijvingen,omitempty"`
	Visibilities                  []ReferentielijstVisibility    `bun:"rel:has-many,join:id=referentielijst_id" json:"visibilities,omitempty"`
	Internetadressen              []ReferentielijstInternetadres `bun:"rel:has-many,join:id=referentielijst_id" json:"internetadressen,omitempty"`
	// Domein-specifieke items-relaties (velden hier, MetaRegistry-koppeling in domeinbestand):
	LandenlijstLanden     []LandenlijstLand         `bun:"rel:has-many,join:id=referentielijst_id" json:"landenlijst_landen,omitempty"`
	AdellijkeTitelsTitels []AdellijkeTitelsTitel    `bun:"rel:has-many,join:id=referentielijst_id" json:"adellijke_titels_titels,omitempty"`
	Aanvang               []Referentielijst_Aanvang `bun:"rel:has-many,join:id=referentielijst_id" json:"aanvang,omitempty"`
	Einde                 []Referentielijst_Einde   `bun:"rel:has-many,join:id=referentielijst_id" json:"einde,omitempty"`
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
