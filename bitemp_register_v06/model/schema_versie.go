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
	// Herkomst bij een rebuild uit een Studio-project (07-11-2026): welk project, welke
	// projectversie en t/m welk volgnummer van het operatielog. Leeg bij andere bronnen.
	BronProjectID     string `json:"bron_project_id,omitempty" bun:"bron_project_id"`
	BronProjectVersie *int64 `json:"bron_project_versie,omitempty" bun:"bron_project_versie"`
	BronTotVolgnummer *int64 `json:"bron_tot_volgnummer,omitempty" bun:"bron_tot_volgnummer"`
	// GebouwdeDomeinen: de domeinen die het register na de rebuild van deze versie had (07-11-2026,
	// besluit Mark: "expliciet wat er gegenereerd wordt"). De startup-rebuild bouwt precies deze
	// (plus het standaardpakket) en laat de rest weg, ook als het model meer domeinen heeft. Leeg
	// bij oudere versies: dan bouwt de startup-rebuild zoals vroeger alle domeinen van het model
	// bovenop de ingebakken code. Zie docs/DEVLOOP.md §"Domeinen van het register".
	GebouwdeDomeinen []GebouwdDomein `json:"gebouwde_domeinen,omitempty" bun:"gebouwde_domeinen,type:jsonb"`
}

// GebouwdDomein is één domein van het register: de domeinnaam uit het model en de prefix van
// de gegenereerde bestanden (model/<prefix>_*.go), bv. {"CG", "cg"} of {"np-loc", "np_loc"}.
type GebouwdDomein struct {
	Domein string `json:"domein"`
	Prefix string `json:"prefix"`
	// Gegenereerd: dit domein is bij de rebuild van deze versie uit het model gegenereerd (sinds
	// 08-11-2026). Een domein van het standaardpakket zonder deze vlag stond er al zoals het image
	// het meebrengt; de startup-rebuild genereert het dan niet opnieuw uit het model (cg-test,
	// 08-11-2026: ide_bestanden uit het Studio-model paste niet bij de handgeschreven handlers).
	Gegenereerd bool `json:"gegenereerd,omitempty"`
}
