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
	// Snapshot-compactie (stap 2, onderdeel 6): de blob geldt tot en met dit volgnummer
	// in studio_project_ops; een client laadt de blob en haalt de operaties daarna op.
	TotVolgnummer int64 `json:"tot_volgnummer" bun:"tot_volgnummer,notnull"`
	// Herkomst van een afgeleid project, een "branch" (werkplaats-plan §4B, stap 1; zie
	// handlers/studio_project_afsplitsen.go). Leeg = een gewoon project. De ouder kan later
	// verwijderd zijn; de herkomst blijft dan als gegeven staan.
	OuderProjectID  string `json:"ouder_project_id,omitempty" bun:"ouder_project_id,nullzero"`
	BasisVolgnummer int64  `json:"basis_volgnummer,omitempty" bun:"basis_volgnummer,notnull,default:0"`
	MapID           string `json:"map_id,omitempty" bun:"map_id,nullzero"`
	// Gearchiveerd: de branch is samengevoegd of opgegeven en blijft alleen voor de
	// historie bestaan (gezet door de merge van stap 3; nu nog nergens).
	Gearchiveerd bool `json:"gearchiveerd,omitempty" bun:"gearchiveerd,notnull,default:false"`
}

// StudioProjectBasis is de onveranderlijke basis van een afgeleid project: de stand van de
// ouder op het moment van afsplitsen, rauw bewaard zoals de server hem kent. Dat is de
// blob (geldig t/m TotVolgnummer) plus de staart-operaties daarna t/m BasisVolgnummer. De
// server speelt geen operaties af; de Studio of de sidecar materialiseert de basis voor
// een 3-weg-merge (basis, branch, ouder). Nodig omdat de compactie operaties weggooit.
type StudioProjectBasis struct {
	bun.BaseModel   `bun:"table:studio_project_basis"`
	ProjectID       string          `json:"project_id" bun:"project_id,pk"` // het afgeleide project
	OuderProjectID  string          `json:"ouder_project_id" bun:"ouder_project_id,notnull"`
	BasisVolgnummer int64           `json:"basis_volgnummer" bun:"basis_volgnummer,notnull"`
	TotVolgnummer   int64           `json:"tot_volgnummer" bun:"tot_volgnummer,notnull"`
	Inhoud          json.RawMessage `json:"inhoud" bun:"inhoud,type:jsonb,notnull"`
	Ops             json.RawMessage `json:"ops" bun:"ops,type:jsonb,notnull"` // StudioOpUit-lijst, oudste eerst
	Aangemaakt      time.Time       `json:"aangemaakt" bun:"aangemaakt,notnull,default:current_timestamp"`
	AangemaaktDoor  string          `json:"aangemaakt_door" bun:"aangemaakt_door"`
}

// StudioProjectHerkomstDDL voegt de herkomstkolommen toe aan een bestaande
// studio_projecten-tabel, en `namens` aan studio_project_ops (dbsetup en de integratietests
// gebruiken dezelfde lijst; draai hem na het aanmaken van beide tabellen).
var StudioProjectHerkomstDDL = []string{
	`ALTER TABLE studio_projecten ADD COLUMN IF NOT EXISTS ouder_project_id VARCHAR`,
	`ALTER TABLE studio_projecten ADD COLUMN IF NOT EXISTS basis_volgnummer BIGINT NOT NULL DEFAULT 0`,
	`ALTER TABLE studio_projecten ADD COLUMN IF NOT EXISTS map_id VARCHAR`,
	`ALTER TABLE studio_projecten ADD COLUMN IF NOT EXISTS gearchiveerd BOOLEAN NOT NULL DEFAULT false`,
	// namens op het operatielog (werkplaats-plan §4B; handlers/studio_namens.go)
	`ALTER TABLE studio_project_ops ADD COLUMN IF NOT EXISTS namens VARCHAR`,
}
