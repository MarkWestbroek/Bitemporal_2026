package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Persoon struct {
	bun.BaseModel `bun:"table:persoon"`
	ID int `json:"id" bun:"id,pk"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	Naams []Persoon_Naam `bun:"rel:has-many,join:id=persoon_id" json:"naams,omitempty"`
}

