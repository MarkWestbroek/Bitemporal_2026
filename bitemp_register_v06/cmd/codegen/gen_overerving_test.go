package main

// Overerving (erft) over domeinen heen — gevonden bij FUNDAMENT's gehandicaptenparkeerkaart-aanvraag
// (26-10-2026): een subtype met eigen GE's kwam niet door de zelftest omdat de hub-kinderen naar
// kolom "id" van de entiteit verwezen, terwijl een subtype als sleutel de PFK "<ouder>_id" heeft.

import (
	"go/format"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func subtypeTestModel() model.V3Model {
	return model.V3Model{
		Versie: "v3",
		Entiteiten: []model.V3Entiteit{
			{
				Typenaam: "GpkAanvraag", Meervoud: "gpk_aanvragen", Domein: "parkeren", Erft: "Aanvraag", IsMaterieel: true,
				Gegevenselementen: []model.V3Gegevenselement{{
					Naam: "GpkGegevens", Meervoud: "gpk_gegevens", Momentvoorkomen: "enkelvoudig",
					Velden: []model.V3Veld{{Naam: "kenteken", GoType: "string"}},
				}},
				Relaties: []model.V3Relatie{{Naam: "GpkVoertuig", Meervoud: "gpk_voertuigen", Momentvoorkomen: "enkelvoudig", DoelEntiteit: "Voertuig"}},
			},
			{Typenaam: "Voertuig", Meervoud: "voertuigen", Domein: "parkeren"},
		},
	}
}

func TestGeRel_SubtypeHubKinderenVerwijzenNaarPFK(t *testing.T) {
	code, err := generateGeRelWithOpts(subtypeTestModel(), codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := format.Source([]byte(code)); err != nil {
		t.Fatalf("geen geldige Go: %v", err)
	}
	// GE-hub en relatie-hub onder het subtype: belongs-to naar de PFK aanvraag_id, niet naar id.
	for _, want := range []string{
		`join:gpkaanvraag_id=aanvraag_id,on_delete:cascade`,
	} {
		if strings.Count(code, want) < 2 {
			t.Errorf("verwacht %q voor GE-hub én relatie-hub; code:\n%s", want, code)
		}
	}
	if strings.Contains(code, `join:gpkaanvraag_id=id,`) {
		t.Errorf("hub-kind van een subtype verwijst nog naar kolom id")
	}
	// Een gewone entiteit (Voertuig) houdt =id.
	code2, _ := generateGeRelWithOpts(model.V3Model{Versie: "v3", Entiteiten: []model.V3Entiteit{{
		Typenaam: "Voertuig", Meervoud: "voertuigen",
		Gegevenselementen: []model.V3Gegevenselement{{Naam: "Kenteken", Meervoud: "kentekens", Momentvoorkomen: "enkelvoudig", Velden: []model.V3Veld{{Naam: "nr", GoType: "string"}}}},
	}}}, codegenOptions{})
	if !strings.Contains(code2, `join:voertuig_id=id,on_delete:cascade`) {
		t.Errorf("gewone entiteit: belongs-to hoort naar id te verwijzen")
	}
}

func TestEntiteitPKKolom(t *testing.T) {
	if k := entiteitPKKolom(model.V3Entiteit{Typenaam: "A"}); k != "id" {
		t.Errorf("zonder erft: %s", k)
	}
	if k := entiteitPKKolom(model.V3Entiteit{Typenaam: "GpkAanvraag", Erft: "Aanvraag"}); k != "aanvraag_id" {
		t.Errorf("met erft: %s", k)
	}
}

func TestEntiteiten_SubtypeToontIDInJSON(t *testing.T) {
	code, err := generateEntiteitenWithOpts(subtypeTestModel(), codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(code, "`json:\"id\" bun:\"aanvraag_id,pk\"`") {
		t.Errorf("subtype hoort zijn PFK in JSON als id te tonen; code:\n%s", code)
	}
	if strings.Contains(code, "`json:\"aanvraag_id\"") {
		t.Errorf("aanvraag_id hoort niet in de JSON van het subtype")
	}
}
