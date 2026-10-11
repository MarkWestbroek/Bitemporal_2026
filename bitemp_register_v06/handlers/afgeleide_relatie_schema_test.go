package handlers

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// afgeleideRelatieTestMeta: de echte NatuurlijkPersoon-meta (np-loc) met een afgeleide
// relatie /woonwijk → Gemeentedeel erbij.
func afgeleideRelatieTestMeta(t *testing.T) model.TypeMeta {
	meta, ok := model.MetaRegistry.GetTypeMeta("NatuurlijkPersoon")
	if !ok {
		t.Skip("NatuurlijkPersoon niet in MetaRegistry")
	}
	meta.AfgeleideRelaties = []model.AfgeleideRelatie{{
		Naam: "Woonwijk", Rolnaam: "Woonwijk", JSONRolnaam: "woonwijk", DoelEntiteit: "Gemeentedeel",
		Momentvoorkomen: model.Enkelvoudig, AfleidingsregelTaal: "cel", Afleidingsregel: "woonlocatie.gebiedsligging",
	}}
	return meta
}

// De schema-API meldt een afgeleide relatie als alleen-lezen, met de sleutel van het doel-id.
func TestVizSchema_AfgeleideRelatie(t *testing.T) {
	dto := vizSchemaTypeDTOVanMeta(afgeleideRelatieTestMeta(t))
	if len(dto.AfgeleideRelaties) != 1 {
		t.Fatalf("verwacht 1 afgeleide relatie, kreeg %+v", dto.AfgeleideRelaties)
	}
	ar := dto.AfgeleideRelaties[0]
	if ar.JSONRolnaam != "woonwijk" || ar.DoelIDSleutel != "gemeentedeel_id" || !ar.AlleenLezen ||
		ar.Afleidingsregel != "woonlocatie.gebiedsligging" || ar.Momentvoorkomen != "enkelvoudig" {
		t.Fatalf("onverwachte DTO: %+v", ar)
	}
}

// In het Full-schema van de OAS staat de afgeleide relatie als readOnly array (maxItems 1).
func TestOpenAPIFullSchema_AfgeleideRelatieReadOnly(t *testing.T) {
	schema := genereerFullSchemaVoorEntiteit(afgeleideRelatieTestMeta(t))
	props := schema["allOf"].([]oasMap)[1]["properties"].(oasMap)
	prop, ok := props["woonwijk"].(oasMap)
	if !ok {
		t.Fatalf("woonwijk ontbreekt in Full-schema: %+v", props)
	}
	if prop["readOnly"] != true || prop["maxItems"] != 1 || prop["type"] != "array" {
		t.Fatalf("verwacht readOnly array met maxItems 1, kreeg %+v", prop)
	}
	itemProps := prop["items"].(oasMap)["properties"].(oasMap)
	if _, ok := itemProps["gemeentedeel_id"]; !ok {
		t.Fatalf("items missen gemeentedeel_id: %+v", itemProps)
	}
	if _, ok := props["woonlocatie"]; !ok {
		t.Fatal("gewone relatie woonlocatie ontbreekt")
	}
}
