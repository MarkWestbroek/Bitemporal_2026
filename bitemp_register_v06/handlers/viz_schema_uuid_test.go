package handlers

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Het platte schema (/api/viz/schema en /api/schema/model/code) geeft de uuid uit de Studio
// door: op het type uit TypeMeta.UUID, op de velden uit de tag uuid:"…" die codegen op het
// _Data-veld zet (31-10-2026, BACKLOG §40; vraag OMNIUM-UI voor de ModelPicker-fallback).
type proefUUIDData struct {
	ID      int64  `json:"id" bun:"id,pk"`
	Status  string `json:"status" schema_desc:"Status van de zaak" uuid:"b1000000-0000-4000-8000-000000000002"`
	Notitie string `json:"notitie,omitempty"`
}

func (p *proefUUIDData) GetID() any               { return p.ID }
func (p *proefUUIDData) Metatype() model.Metatype { return model.MetatypeGegevenselement }
func (p *proefUUIDData) String() string           { return "proefUUIDData" }

func TestVizSchema_UUIDOpTypeEnVelden(t *testing.T) {
	meta := model.TypeMeta{
		Typenaam:   "Proef_ZaakStatus_Data",
		Klassenaam: "ZaakStatus",
		UUID:       "c1000000-0000-4000-8000-000000000001",
		Metatype:   model.MetatypeGegevenselement,
		Factory:    func() model.Representatie { return &proefUUIDData{} },
	}

	dto := vizSchemaTypeDTOVanMeta(meta)
	if dto.UUID != meta.UUID {
		t.Errorf("type-uuid %q, verwacht %q", dto.UUID, meta.UUID)
	}

	velden := reflectedVeldenVoorMeta(meta)
	perNaam := map[string]vizSchemaFieldDTO{}
	for _, v := range velden {
		perNaam[v.Naam] = v
	}
	if got := perNaam["status"].UUID; got != "b1000000-0000-4000-8000-000000000002" {
		t.Errorf("veld status: uuid %q", got)
	}
	if got := perNaam["notitie"].UUID; got != "" {
		t.Errorf("veld notitie zonder tag kreeg uuid %q", got)
	}
}
