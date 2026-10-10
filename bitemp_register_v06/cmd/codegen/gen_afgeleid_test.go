package main

import (
	"go/format"
	"reflect"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// afgeleidTestModel: Persoon met een gewone relatie Woonadres → Adres en een afgeleide
// relatie Woonwijk → Wijk (geen tabel, alleen lezen).
func afgeleidTestModel() model.V3Model {
	return model.V3Model{
		Versie: "v3",
		Entiteiten: []model.V3Entiteit{
			{
				Typenaam: "Persoon",
				Meervoud: "personen",
				Gegevenselementen: []model.V3Gegevenselement{{
					Naam: "Naam", Meervoud: "namen", Momentvoorkomen: "enkelvoudig",
					Velden: []model.V3Veld{{Naam: "achternaam", GoType: "string"}},
				}},
				Relaties: []model.V3Relatie{
					{Naam: "Woonadres", Meervoud: "woonadres", Momentvoorkomen: "enkelvoudig", DoelEntiteit: "Adres"},
					{
						Naam: "Woonwijk", Meervoud: "woonwijk", Momentvoorkomen: "enkelvoudig", DoelEntiteit: "Wijk",
						Directioneel: true, Geordend: true,
						Afgeleid: true, AfleidingsregelTaal: "cel", Afleidingsregel: `woonadres.ligging`,
						Positie: &model.V3Positie{X: 10, Y: 20},
					},
				},
			},
			{Typenaam: "Adres", Meervoud: "adressen"},
			{Typenaam: "Wijk", Meervoud: "wijken"},
		},
	}
}

func TestValidateV3Model_AfgeleideRelatieGeldig(t *testing.T) {
	if errs := validateV3Model(afgeleidTestModel(), ""); len(errs) > 0 {
		t.Fatalf("verwacht geen validatiefouten, kreeg: %v", errs)
	}
}

func TestValidateV3Model_AfgeleideRelatieRegels(t *testing.T) {
	v3 := afgeleidTestModel()
	rel := &v3.Entiteiten[0].Relaties[1]
	rel.Afleidingsregel = " "
	rel.AfleidingsregelTaal = "ocl"
	rel.Velden = []model.V3Veld{{Naam: "x", GoType: "string"}}
	rel.RelatieSubtype = "referentielijst_items"

	errs := strings.Join(validateV3Model(v3, ""), "\n")
	for _, want := range []string{"geen afleidingsregel", "afleidingsregelTaal 'ocl'", "mag geen velden", "mag geen relatieSubtype"} {
		if !strings.Contains(errs, want) {
			t.Errorf("verwacht fout met %q, kreeg:\n%s", want, errs)
		}
	}
}

func TestSplitsAfgeleideRelaties(t *testing.T) {
	v3 := afgeleidTestModel()
	origineel := v3.Entiteiten[0].Relaties

	afgeleid := splitsAfgeleideRelaties(&v3)

	if got := v3.Entiteiten[0].Relaties; len(got) != 1 || got[0].Naam != "Woonadres" {
		t.Fatalf("verwacht alleen Woonadres over, kreeg %+v", got)
	}
	if got := afgeleid["Persoon"]; len(got) != 1 || got[0].Naam != "Woonwijk" {
		t.Fatalf("verwacht Woonwijk als afgeleide relatie, kreeg %+v", got)
	}
	if len(origineel) != 2 || origineel[1].Naam != "Woonwijk" {
		t.Fatalf("oorspronkelijke slice is aangetast: %+v", origineel)
	}
}

// Een afgeleide relatie krijgt geen hub-, _Data- of Input-type en geen regel in
// OnderliggendeGegevenselementen, maar wel een AfgeleideRelaties-blok op de entiteit.
func TestGenereer_AfgeleideRelatieGeenTabelWelMetaRegistry(t *testing.T) {
	v3 := afgeleidTestModel()
	opts := codegenOptions{domein: "test", afgeleideRelaties: splitsAfgeleideRelaties(&v3)}

	reg, err := generateMetaRegistry(v3, opts)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := format.Source([]byte(reg)); err != nil {
		t.Fatalf("gegenereerde MetaRegistry is geen geldige Go: %v\n%s", err, reg)
	}
	for _, want := range []string{
		"AfgeleideRelaties: []AfgeleideRelatie{",
		`Naam: "Woonwijk",`,
		`JSONRolnaam: "woonwijk",`,
		`DoelEntiteit: "Wijk",`,
		`AfleidingsregelTaal: "cel",`,
		`Afleidingsregel: "woonadres.ligging",`,
		"Geordend: true,",
		"Positie: &V3Positie{X: 10, Y: 20}",
	} {
		if !strings.Contains(reg, want) {
			t.Errorf("verwacht %q in MetaRegistry", want)
		}
	}
	for _, nietGewenst := range []string{`"Woonwijk": {`, "Woonwijk_Data", `Doeltype: "Woonwijk"`} {
		if strings.Contains(reg, nietGewenst) {
			t.Errorf("onverwacht %q in MetaRegistry (afgeleide relatie hoort geen hub te krijgen)", nietGewenst)
		}
	}

	for naam, gen := range map[string]func(model.V3Model, codegenOptions) (string, error){
		"ge_rel": generateGeRelWithOpts, "input": generateInputWithOpts, "methods": generateMethodsWithOpts, "entiteiten": generateEntiteitenWithOpts,
	} {
		code, err := gen(v3, opts)
		if err != nil {
			t.Fatalf("%s: %v", naam, err)
		}
		if strings.Contains(code, "Woonwijk") {
			t.Errorf("%s: onverwacht Woonwijk in gegenereerde code", naam)
		}
		if naam == "ge_rel" && !strings.Contains(code, "Woonadres") {
			t.Errorf("ge_rel: gewone relatie Woonadres ontbreekt")
		}
	}
}

// Een afgeleid veld krijgt een afleiding-tag die de exporter weer leest (rondreis).
func TestContentField_AfgeleidVeldKrijgtAfleidingTag(t *testing.T) {
	f := contentField(model.V3Veld{Naam: "volledig", GoType: "string", Afgeleid: true, Afleidingsregel: `a + " " + b`})
	tag := reflect.StructTag(strings.Trim(f.Tags, "`"))
	got, ok := tag.Lookup("afleiding")
	if !ok || got != `a + " " + b` {
		t.Fatalf("afleiding-tag = %q (ok=%v), tags: %s", got, ok, f.Tags)
	}
	if gewoon := contentField(model.V3Veld{Naam: "x", GoType: "string"}); strings.Contains(gewoon.Tags, "afleiding") {
		t.Fatalf("gewoon veld kreeg een afleiding-tag: %s", gewoon.Tags)
	}
}
