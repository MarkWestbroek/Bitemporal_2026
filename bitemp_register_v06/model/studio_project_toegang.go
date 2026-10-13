package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// StudioProjectToegang: wie een Studio-project mag lezen of wijzigen (uitnodigen-plan
// 2026-10-12 §5, besluit Mark 13-10: "alles dicht tenzij", rechten op niveau model).
// Zonder rij heb je geen toegang; de eigenaar en een beheerder altijd (handlers/
// studio_project_toegang.go). Subject "*" = iedereen die is ingelogd.
//
// Plumbing, net als studio_projecten: komt later in het modelregister/de beleidsbundel (PAP).
type StudioProjectToegang struct {
	bun.BaseModel  `bun:"table:studio_project_toegang"`
	ProjectID      string    `json:"project_id" bun:"project_id,pk"`
	Subject        string    `json:"subject" bun:"subject,pk"`  // gebruikersnaam, of "*"
	Recht          string    `json:"recht" bun:"recht,notnull"` // lezen | schrijven
	Aangemaakt     time.Time `json:"aangemaakt" bun:"aangemaakt,notnull,default:current_timestamp"`
	AangemaaktDoor string    `json:"aangemaakt_door" bun:"aangemaakt_door"`
}

// StudioMigratie markeert eenmalige datamigraties rond de Studio (bv. "project_toegang_v1").
type StudioMigratie struct {
	bun.BaseModel `bun:"table:studio_migraties"`
	Naam          string    `bun:"naam,pk"`
	Uitgevoerd    time.Time `bun:"uitgevoerd,notnull,default:current_timestamp"`
}

// GebruikerUitnodiging: een uitnodiging per mail of link (uitnodigen-plan 2026-10-12 §2).
// Alleen de sha256 van de token staat hier; de token zelf gaat één keer naar de beheerder
// (link) en de genodigde (mail). Plumbing: de bitemporele variant in domein beheer volgt.
type GebruikerUitnodiging struct {
	bun.BaseModel  `bun:"table:gebruiker_uitnodiging"`
	ID             int64           `json:"id" bun:"id,pk,autoincrement"`
	Email          string          `json:"email" bun:"email,notnull"`
	Weergavenaam   string          `json:"weergavenaam" bun:"weergavenaam"`
	Rol            string          `json:"rol" bun:"rol,notnull"`
	Projecten      json.RawMessage `json:"projecten" bun:"projecten,type:jsonb"` // [{"id":…, "recht":"lezen|schrijven"}]
	TokenHash      string          `json:"-" bun:"token_hash,notnull,unique"`
	Aangemaakt     time.Time       `json:"aangemaakt" bun:"aangemaakt,notnull,default:current_timestamp"`
	AangemaaktDoor string          `json:"aangemaakt_door" bun:"aangemaakt_door"`
	Verloopt       time.Time       `json:"verloopt" bun:"verloopt,notnull"`
	GeaccepteerdOp *time.Time      `json:"geaccepteerd_op,omitempty" bun:"geaccepteerd_op"`
	Gebruikersnaam string          `json:"gebruikersnaam,omitempty" bun:"gebruikersnaam"` // gekozen bij accepteren
	IngetrokkenOp  *time.Time      `json:"ingetrokken_op,omitempty" bun:"ingetrokken_op"`
}
