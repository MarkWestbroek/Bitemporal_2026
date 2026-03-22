package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Persoon_Naam struct {
	bun.BaseModel `bun:"table:persoon_naam"`
	Persoon_ID int `json:"persoon_id" bun:"persoon_id,pk" schema_desc:"ID van de Persoon-entiteit"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentPersoon *Persoon `json:"-" bun:"rel:belongs-to,join:persoon_id=id,on_delete:cascade"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	Data []Persoon_Naam_Data `bun:"rel:has-many,join:persoon_id=persoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Persoon_Naam_Data — geversioned inhoud van Persoon_Naam.
type Persoon_Naam_Data struct {
	bun.BaseModel `bun:"table:persoon_naam_data,alias:persoon_naam_data"`
	PERSOON_ID int `json:"persoon_id" bun:"persoon_id,pk"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	VolledigeNaam string `json:"volledige_naam"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

