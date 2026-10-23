package main

import (
	"go/format"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/naamgeving"
)

// Een zelf-relatie (Artefact → Artefact, bv. ArtefactAfhankelijkheid) kreeg tot 23-10-2026 twee
// keer de kolom artefact_id (eigenaar én doel) en compileerde niet. Nu: eigenaarskolom
// artefact_id, verwijskolom doel_artefact_id, en het doeltype expliciet in de MetaRegistry.
func TestZelfRelatie_EigenVerwijskolomEnDoelTypenaam(t *testing.T) {
	if got := naamgeving.SecondaireIDKolom("Artefact", "Artefact"); got != "doel_artefact_id" {
		t.Fatalf("zelf-relatie: %q", got)
	}
	if got := naamgeving.SecondaireIDKolom("NatuurlijkPersoon", "Locatie"); got != "locatie_id" {
		t.Fatalf("gewone relatie: %q", got)
	}

	v3 := model.V3Model{Versie: "v3", Entiteiten: []model.V3Entiteit{{
		Typenaam: "Artefact", Meervoud: "artefacten", Domein: "inrichting",
		Relaties: []model.V3Relatie{
			{Naam: "ArtefactAfhankelijkheid", Meervoud: "afhankelijkheden", Momentvoorkomen: "meervoudig", DoelEntiteit: "Artefact",
				Velden: []model.V3Veld{{Naam: "reden", GoType: "string"}}},
			{Naam: "ArtefactDoelcomponent", Meervoud: "doelcomponent", Momentvoorkomen: "enkelvoudig", DoelEntiteit: "Component"},
		},
	}, {Typenaam: "Component", Meervoud: "componenten", Domein: "inrichting"}}}
	if errs := validateV3Model(v3, ""); len(errs) > 0 {
		t.Fatalf("validatie: %v", errs)
	}
	opts := codegenOptions{domein: "inrichting"}

	structs, err := generateGeRelWithOpts(v3, opts)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := format.Source([]byte(structs)); err != nil {
		t.Fatalf("ge_rel is geen geldige Go: %v", err)
	}
	hub := structs[strings.Index(structs, "type ArtefactAfhankelijkheid struct"):]
	hub = hub[:strings.Index(hub, "\n}\n")]
	// Let op: "Artefact_ID " zit ook in "DoelArtefact_ID "; tel daarom op het begin van de regel.
	if strings.Count(hub, "\n\tArtefact_ID ") != 1 || !strings.Contains(hub, "DoelArtefact_ID") || !strings.Contains(hub, `json:"doel_artefact_id"`) {
		t.Fatalf("hub-struct hoort artefact_id (eigenaar) + doel_artefact_id (verwezen) te hebben:\n%s", hub)
	}

	input, err := generateInputWithOpts(v3, opts)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(input, `json:"doel_artefact_id"`) {
		t.Fatalf("input-struct mist doel_artefact_id:\n%s", input)
	}

	reg, err := generateMetaRegistry(v3, opts)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		`SecondaireEntiteitIDKolom: "doel_artefact_id"`, `DoelTypenaam: "Artefact"`,
		`SecondaireEntiteitIDKolom: "component_id"`, `DoelTypenaam: "Component"`,
	} {
		if !strings.Contains(reg, want) {
			t.Errorf("MetaRegistry mist %q", want)
		}
	}
}
