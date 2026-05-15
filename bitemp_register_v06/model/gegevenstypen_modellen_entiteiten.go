package model

// TestEntiteitGegevenstypen — entiteit die alle valideerbare gegevenstypen
// in één GE verzamelt, uitsluitend bedoeld voor validatie-integratietests.
// Handmatig aangemaakt in het gegevenstypen-domein.

import (
	"time"

	"github.com/uptrace/bun"
)

// TestEntiteitGegevenstypen — testentiteit voor alle gegevenstypen-validatie.
// Geen materiële tijdlijn; alleen formele opvoer/afvoer.
type TestEntiteitGegevenstypen struct {
	bun.BaseModel `bun:"table:testentiteitgegevenstypen,alias:testentiteitgegevenstypen"`
	ID            int                                             `json:"id" bun:"id,pk"`
	Opvoer        *time.Time                                      `json:"opvoer,omitempty"`
	Afvoer        *time.Time                                      `json:"afvoer,omitempty"`
	TestGEs       []TestEntiteitGegevenstypen_TestGEGegevenstypen `bun:"rel:has-many,join:id=testentiteitgegevenstypen_id" json:"testgegegevenstypen,omitempty"`
}
