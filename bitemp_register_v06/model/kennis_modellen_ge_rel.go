package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Taal string

const (
	Taalnl Taal = "nl"
	Taalen Taal = "en"
	Taalde Taal = "de"
)

type Kennissectietype string

const (
	Kennissectietypetitel                 Kennissectietype = "titel"
	Kennissectietypesamenvatting          Kennissectietype = "samenvatting"
	Kennissectietypeinhoud                Kennissectietype = "inhoud"
	KennissectietypeprocedureBeschrijving Kennissectietype = "procedureBeschrijving"
	Kennissectietypebewijs                Kennissectietype = "bewijs"
)

type Kennisartikel_Kennissectie struct {
	bun.BaseModel       `bun:"table:kennisartikel_kennissectie,alias:kennisartikel_kennissectie"`
	Kennisartikel_ID    int                               `json:"kennisartikel_id" bun:"kennisartikel_id,pk" schema_desc:"ID van de Kennisartikel-entiteit"`
	Rel_ID              int                               `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentKennisartikel *Kennisartikel                    `json:"-" bun:"rel:belongs-to,join:kennisartikel_id=id,on_delete:cascade"`
	Opvoer              *time.Time                        `json:"opvoer,omitempty"`
	Afvoer              *time.Time                        `json:"afvoer,omitempty"`
	Data                []Kennisartikel_Kennissectie_Data `bun:"rel:has-many,join:kennisartikel_id=kennisartikel_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Kennisartikel_Kennissectie_Data — geversioned inhoud van Kennisartikel_Kennissectie.
type Kennisartikel_Kennissectie_Data struct {
	bun.BaseModel    `bun:"table:kennisartikel_kennissectie_data,alias:kennisartikel_kennissectie_data"`
	Kennisartikel_ID int              `json:"kennisartikel_id" bun:"kennisartikel_id,pk"`
	Rel_ID           int              `json:"rel_id" bun:"rel_id,pk"`
	Versie           int64            `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Type             Kennissectietype `json:"type" schema:"enum=Kennissectietype"`
	Taal             Taal             `json:"taal" schema:"enum=Taal"`
	Inhoud           string           `json:"inhoud"`
	Positie          int              `json:"positie"`
	Opvoer           *time.Time       `json:"opvoer,omitempty"`
	Afvoer           *time.Time       `json:"afvoer,omitempty"`
}
