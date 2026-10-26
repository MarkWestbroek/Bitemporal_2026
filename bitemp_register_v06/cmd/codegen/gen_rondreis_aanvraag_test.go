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

func TestOnbekendDomeinFout(t *testing.T) {
	v3 := model.V3Model{Naam: "cg-test", Entiteiten: []model.V3Entiteit{
		{Typenaam: "Artefact", Domein: "inrichting"}, {Typenaam: "Aanvraag", Domein: "aanvraag"}, {Typenaam: "Basis"},
	}, Datatypes: []model.V3Datatype{{Naam: "Los", Domein: "alleendatatype"}}}
	for _, goed := range []string{"inrichting", "aanvraag", "register", "cg-test", "alleendatatype"} {
		if f := onbekendDomeinFout(v3, goed); f != "" {
			t.Errorf("%s: onverwachte fout %s", goed, f)
		}
	}
	f := onbekendDomeinFout(v3, "inrichting,aanvraag")
	if !strings.Contains(f, `"inrichting,aanvraag"`) || !strings.Contains(f, "aanvraag, inrichting") || !strings.Contains(f, "aparte runs") {
		t.Errorf("melding = %s", f)
	}
}

func TestTypenaamBotsingen(t *testing.T) {
	// NatuurlijkPersoon bestaat in np-loc (entiteit), Contactpersoon in CG; Partij niet.
	v3 := model.V3Model{Entiteiten: []model.V3Entiteit{
		{Typenaam: "Partij", Meervoud: "partijen", Domein: "relatiebeheer"},
		{Typenaam: "NatuurlijkPersoon", Meervoud: "rb_natuurlijke_personen", Domein: "relatiebeheer", Erft: "Partij"},
		{Typenaam: "Contactpersoon", Meervoud: "rb_contactpersonen", Domein: "relatiebeheer", Erft: "Partij"},
	}}
	errs := typenaamBotsingen(v3, "relatiebeheer")
	samen := strings.Join(errs, "\n")
	for _, want := range []string{"'NatuurlijkPersoon' bestaat al in domein np-loc", "'Contactpersoon' bestaat al in domein CG"} {
		if !strings.Contains(samen, want) {
			t.Errorf("verwacht %q, kreeg:\n%s", want, samen)
		}
	}
	if strings.Contains(samen, "'Partij'") {
		t.Errorf("Partij hoort niet te botsen")
	}
	// Het eigen domein opnieuw genereren mag.
	if errs := typenaamBotsingen(model.V3Model{Entiteiten: []model.V3Entiteit{{Typenaam: "NatuurlijkPersoon", Meervoud: "natuurlijk_personen", Domein: "np-loc"}}}, "np-loc"); len(errs) != 0 {
		t.Errorf("eigen domein: %v", errs)
	}
}

func TestTabelnaamTeLang(t *testing.T) {
	v3 := model.V3Model{Entiteiten: []model.V3Entiteit{{
		Typenaam: "NatuurlijkPersoonZonderRegistratie", Meervoud: "npzrs", Domein: "rb",
		Gegevenselementen: []model.V3Gegevenselement{
			{Naam: "NatuurlijkPersoonZonderRegistratieGegevens", Meervoud: "x", Momentvoorkomen: "enkelvoudig", Velden: []model.V3Veld{{Naam: "a", GoType: "string"}}},
			{Naam: "Kort", Meervoud: "korten", Momentvoorkomen: "enkelvoudig", Velden: []model.V3Veld{{Naam: "a", GoType: "string"}}},
		},
	}}}
	errs := tabelnaamTeLang(v3, "rb")
	if len(errs) == 0 || !strings.Contains(errs[0], "natuurlijkpersoonzonderregistratie_natuurlijkpersoonzonderregistratiegegevens") {
		t.Fatalf("verwacht fout over de lange tabelnaam, kreeg %v", errs)
	}
	for _, e := range errs {
		if strings.Contains(e, "_kort") {
			t.Errorf("korte tabelnaam ten onrechte gemeld: %s", e)
		}
	}
}
