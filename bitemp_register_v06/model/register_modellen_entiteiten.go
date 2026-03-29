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
	ID                            int                           `json:"id" bun:"id,pk,autoincrement"`
	Systeemnaam                   string                        `json:"systeemnaam" bun:"systeemnaam,unique"`
	Opvoer                        *time.Time                    `json:"opvoer,omitempty"`
	Afvoer                        *time.Time                    `json:"afvoer,omitempty"`
	Referentielijstnamen          []Referentielijstnaam         `bun:"rel:has-many,join:id=referentielijst_id" json:"referentielijstnamen,omitempty"`
	Referentielijstomschrijvingen []Referentielijstomschrijving `bun:"rel:has-many,join:id=referentielijst_id" json:"referentielijstomschrijvingen,omitempty"`
	Visibilities                  []ReferentielijstVisibility     `bun:"rel:has-many,join:id=referentielijst_id" json:"visibilities,omitempty"`
	Internetadressen              []ReferentielijstInternetadres  `bun:"rel:has-many,join:id=referentielijst_id" json:"internetadressen,omitempty"`
	// Domein-specifieke items-relaties (velden hier, MetaRegistry-koppeling in domeinbestand):
	LandenlijstLanden             []LandenlijstLand               `bun:"rel:has-many,join:id=referentielijst_id" json:"landenlijst_landen,omitempty"`
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
