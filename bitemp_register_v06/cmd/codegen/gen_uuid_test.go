package main

import (
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// uuid (31-10-2026, besluit Mark): de Studio geeft elk modelelement een `uuid`; codegen neemt hem
// over in de code (TypeMeta.UUID, EnumUUIDs, DatatypeRegistry, ReferentielijstInstantieRegistry en
// een uuid-tag op _Data-velden), zodat uit de code herleidbaar is uit welk model(element) een type
// komt en de V3-export (model/v3_exporter.go) hem bij de rondreis teruggeeft.
func uuidTestModel() model.V3Model {
	return model.V3Model{
		Versie:    "v3",
		Datatypes: []model.V3Datatype{{UUID: "d1000000-0000-4000-8000-000000000001", Naam: "Postcode", Basistype: "string", Format: "nl-postcode"}},
		Enums: []model.V3Enum{{UUID: "e1000000-0000-4000-8000-000000000001", GoType: "Kleur", BaseType: "string",
			Waarden: []model.V3EnumWaarde{{ConstNaam: "KleurRood", Waarde: "rood"}}}},
		ReferentielijstInstanties: []model.V3ReferentielijstInstantie{{UUID: "f1000000-0000-4000-8000-000000000001", Systeemnaam: "Landenlijst", Naam: "Landen"}},
		Entiteiten: []model.V3Entiteit{
			{
				UUID: "a1000000-0000-4000-8000-000000000001", Typenaam: "Zaak", Meervoud: "zaken", Domein: "proef",
				Gegevenselementen: []model.V3Gegevenselement{
					{UUID: "c1000000-0000-4000-8000-000000000001", Naam: "ZaakStatus", Meervoud: "zaak_statussen", Momentvoorkomen: "enkelvoudig",
						Velden: []model.V3Veld{{UUID: "B1000000-0000-4000-8000-000000000002", Naam: "status", GoType: "string"}}},
				},
				Relaties: []model.V3Relatie{{UUID: "c2000000-0000-4000-8000-000000000001", Naam: "ZaakBehandelaar", Meervoud: "zaak_behandelaars",
					Momentvoorkomen: "enkelvoudig", DoelEntiteit: "Medewerker",
					Velden: []model.V3Veld{{UUID: "b1000000-0000-4000-8000-000000000003", Naam: "rol", GoType: "string"}}}},
			},
			{Typenaam: "Medewerker", Meervoud: "medewerkers", Domein: "proef"},
		},
	}
}

func TestUUID_InRegistryStructsEnRegisters(t *testing.T) {
	v3 := uuidTestModel()

	reg, err := generateMetaRegistry(v3, codegenOptions{domein: "proef", prefix: "proef"})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		`UUID:        "a1000000-0000-4000-8000-000000000001",`, // entiteit
		`UUID:        "c1000000-0000-4000-8000-000000000001",`, // GE-hub
		`UUID:        "c2000000-0000-4000-8000-000000000001",`, // relatie-hub
	} {
		if !strings.Contains(reg, want) {
			t.Errorf("registry mist %q", want)
		}
	}
	// Medewerker heeft geen uuid: geen UUID-regel in zijn entry.
	medewerker := reg[strings.Index(reg, `"Medewerker": {`):]
	medewerker = medewerker[:strings.Index(medewerker, "\n\t},")]
	if strings.Contains(medewerker, "UUID") {
		t.Errorf("Medewerker zonder uuid hoort geen UUID-regel te krijgen:\n%s", medewerker)
	}

	// Referentielijst-instanties schrijft alleen de additieve generator (per domein).
	add, err := generateMetaRegistryAdditive(v3, codegenOptions{domein: "proef", prefix: "proef"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(add, `ReferentielijstInstantieRegistry["Landenlijst"] = ReferentielijstInstantieInfo{`+"\n\t\tUUID: \"f1000000-0000-4000-8000-000000000001\",") {
		t.Errorf("additieve registry mist de uuid van de referentielijst-instantie")
	}

	enums, err := generateEnumRegistryStandalone(v3, codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(enums, `EnumUUIDs["Kleur"] = "e1000000-0000-4000-8000-000000000001"`) {
		t.Errorf("enum-registry mist EnumUUIDs:\n%s", enums)
	}

	dts, err := generateDatatypeRegistry(v3, codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(dts, `UUID:      "d1000000-0000-4000-8000-000000000001",`) {
		t.Errorf("datatype-registry mist UUID:\n%s", dts)
	}

	geRel, err := generateGeRelWithOpts(v3, codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	// Veld-uuid als tag op het _Data-veld (kleine letters), niet op _Input.
	if !strings.Contains(geRel, `uuid:"b1000000-0000-4000-8000-000000000002"`) || !strings.Contains(geRel, `uuid:"b1000000-0000-4000-8000-000000000003"`) {
		t.Errorf("ge_rel mist de uuid-tags op de _Data-velden")
	}
	input, err := generateInputWithOpts(v3, codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(input, `uuid:"`) {
		t.Errorf("_Input hoort geen uuid-tag te krijgen")
	}
}

func TestUuidTag(t *testing.T) {
	if got := uuidTag(" A1000000-0000-4000-8000-000000000001 "); got != ` uuid:"a1000000-0000-4000-8000-000000000001"` {
		t.Errorf("uuidTag normaliseert niet: %q", got)
	}
	for _, slecht := range []string{"", "niet-een-uuid", "a1\"b", "a1`b"} {
		if got := uuidTag(slecht); got != "" {
			t.Errorf("uuidTag(%q) hoort leeg te zijn, kreeg %q", slecht, got)
		}
	}
}
