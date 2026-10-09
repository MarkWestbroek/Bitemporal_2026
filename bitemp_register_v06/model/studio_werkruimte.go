package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// StudioWerkruimte is de werkruimte van één gebruiker in één Studio-project:
// open tabs, actieve tab, open/dicht mappen (plan 2026-10-07 Projectsync,
// "werkruimte los van project"). Van jou, niet gedeeld: laatste schrijver wint,
// geen operaties, geen SSE. Zonder auth is de gebruiker leeg (één werkruimte
// per project).
type StudioWerkruimte struct {
	bun.BaseModel `bun:"table:studio_werkruimtes"`
	ProjectID     string          `json:"project_id" bun:"project_id,pk"`
	Gebruiker     string          `json:"gebruiker" bun:"gebruiker,pk"`
	Inhoud        json.RawMessage `json:"inhoud" bun:"inhoud,type:jsonb,notnull"` // {tabs, actieveTab, mapOpen}
	Bijgewerkt    time.Time       `json:"bijgewerkt" bun:"bijgewerkt,notnull"`
}
