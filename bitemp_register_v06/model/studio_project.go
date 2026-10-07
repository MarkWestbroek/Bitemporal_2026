package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// StudioProject is de parkeerplaats voor een Studio-project op de server: het hele
// project-werkbestand (formaat "studio-project", zie modellerenActivity.jsx) als één
// JSONB-blob, met een naam en een versieteller voor optimistische vergrendeling.
//
// Bewust géén bitemporele entiteit en geen domein: dit is de tussenstap uit
// docs/plans/2026-10-07 Projectsync (stap 1). De echte structuur komt met het
// modelregister (plan 2026-10-06); dat leest deze blob dan via een migratie-import.
type StudioProject struct {
	bun.BaseModel  `bun:"table:studio_projecten"`
	ID             string          `json:"id" bun:"id,pk"`                                   // UUID, door de client gekozen
	Naam           string          `json:"naam" bun:"naam,notnull"`                          // zichtbaar voor iedereen die is ingelogd
	Eigenaar       string          `json:"eigenaar" bun:"eigenaar"`                          // gebruikersnaam van de maker (leeg zonder auth)
	Versie         int64           `json:"versie" bun:"versie,notnull,default:1"`            // telt op bij elke opslag
	Inhoud         json.RawMessage `json:"inhoud,omitempty" bun:"inhoud,type:jsonb,notnull"` // het studio-project-JSON
	Aangemaakt     time.Time       `json:"aangemaakt" bun:"aangemaakt,default:current_timestamp"`
	Bijgewerkt     time.Time       `json:"bijgewerkt" bun:"bijgewerkt,default:current_timestamp"`
	BijgewerktDoor string          `json:"bijgewerkt_door" bun:"bijgewerkt_door"`
}
