package main

// Rondreis-punten uit de controle van het aanvraag-model (FUNDAMENT, 25-10-2026): veldbeschrijving,
// time-import in modellen_input.go, kardinaliteiten van gewone relaties.

import (
	"go/format"
	"reflect"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestSchemaDescTag_OpDataEnInput(t *testing.T) {
	v := model.V3Veld{Naam: "aanvraagnummer", GoType: "string", Description: "Uniek `nummer` met \"aanhalingstekens\""}
	for naam, f := range map[string]StructField{"data": contentField(v), "input": inputContentField(v)} {
		tag := reflect.StructTag(strings.Trim(f.Tags, "`"))
		got, ok := tag.Lookup("schema_desc")
		if !ok || got != `Uniek 'nummer' met "aanhalingstekens"` {
			t.Errorf("%s: schema_desc = %q (ok=%v), tags: %s", naam, got, ok, f.Tags)
		}
	}
	if f := contentField(model.V3Veld{Naam: "x", GoType: "string"}); strings.Contains(f.Tags, "schema_desc") {
		t.Errorf("veld zonder beschrijving kreeg schema_desc: %s", f.Tags)
	}
}

func TestGenerateInput_TimeImportAlleenBijTimeTime(t *testing.T) {
	maak := func(goType string) string {
		v3 := model.V3Model{Versie: "v3", Entiteiten: []model.V3Entiteit{{
			Typenaam: "Aanvraag", Meervoud: "aanvragen",
			Gegevenselementen: []model.V3Gegevenselement{{
				Naam: "Indiening", Meervoud: "indieningen", Momentvoorkomen: "enkelvoudig",
				Velden: []model.V3Veld{{Naam: "ingediendOp", GoType: goType}},
			}},
		}}}
		code, err := generateInput(v3)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := format.Source([]byte(code)); err != nil {
			t.Fatalf("%s: geen geldige Go: %v\n%s", goType, err, code)
		}
		return code
	}
	if code := maak("time.Time"); !strings.Contains(code, `import "time"`) {
		t.Errorf("time.Time-veld zonder import:\n%s", code)
	}
	if code := maak("string"); strings.Contains(code, `import "time"`) {
		t.Errorf("onnodige time-import:\n%s", code)
	}
}

func TestMetaRegistry_KardinaliteitGewoneRelatie(t *testing.T) {
	v3 := afgeleidTestModel()
	v3.Entiteiten[0].Relaties[0].DoelKardinaliteit = "1"
	v3.Entiteiten[0].Relaties[0].BronKardinaliteit = "0..*"
	code, err := generateMetaRegistry(v3, codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{`DoelKardinaliteit: "1"`, `BronKardinaliteit: "0..*"`} {
		if !strings.Contains(strings.Join(strings.Fields(code), " "), want) {
			t.Errorf("ontbreekt in metaregistry: %s", want)
		}
	}
}
