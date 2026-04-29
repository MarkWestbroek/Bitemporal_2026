package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Kennisartikel struct {
	bun.BaseModel `bun:"table:kennisartikel,alias:kennisartikel"`
	ID            int                          `json:"id" bun:"id,pk"`
	Opvoer        *time.Time                   `json:"opvoer,omitempty"`
	Afvoer        *time.Time                   `json:"afvoer,omitempty"`
	Kennissecties []Kennisartikel_Kennissectie `bun:"rel:has-many,join:id=kennisartikel_id" json:"kennissecties,omitempty"`
}
