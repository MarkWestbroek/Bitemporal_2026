package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// SchemaVersieStatus definieert de lifecycle-status van een schema-versie.
type SchemaVersieStatus string

const (
	SchemaVersieStatusProposed SchemaVersieStatus = "proposed"
	SchemaVersieStatusActive   SchemaVersieStatus = "active"
	SchemaVersieStatusArchived SchemaVersieStatus = "archived"
)

// SchemaVersie slaat een volledige modeldefinitie op als JSONB-blob.
// Zie ontwerpkeuzen.md §7 voor de lifecycle (proposed → active → archived).
type SchemaVersie struct {
	bun.BaseModel     `bun:"table:schema_versies"`
	ID                int64              `json:"id" bun:"id,pk,autoincrement"`
	Tijdstip          time.Time          `json:"tijdstip" bun:"tijdstip,default:current_timestamp"`
	SchemaJSON        json.RawMessage    `json:"schema_json" bun:"schema_json,type:jsonb,notnull"`
	Bron              string             `json:"bron,omitempty" bun:"bron"`                             // bijv. "metaregistry", "upload"
	Indiener          string             `json:"indiener,omitempty" bun:"indiener"`                     // wie plaatste dit
	ModelVersie       string             `json:"model_versie,omitempty" bun:"model_versie"`             // uit V3Model.Versie
	ModelNaam         string             `json:"model_naam,omitempty" bun:"model_naam"`                 // uit V3Model.Naam
	ModelBeschrijving string             `json:"model_beschrijving,omitempty" bun:"model_beschrijving"` // uit V3Model.Beschrijving
	BuildVersie       string             `json:"build_versie,omitempty" bun:"build_versie"`
	GoModule          string             `json:"go_module,omitempty" bun:"go_module"`
	Status            SchemaVersieStatus `json:"status" bun:"status,notnull,default:'proposed'"`
	Opmerking         string             `json:"opmerking,omitempty" bun:"opmerking"`
}
