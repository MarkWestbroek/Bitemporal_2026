package main

// gen_commentaar_test.go — een beschrijving uit de Studio mag meerdere regels hebben. In een
// Go-commentaar werd de regel na de regelovergang code, en de build brak ("non-declaration
// statement outside function body", rebuild Inrichten op cg-test, 08-11-2026). Elke gegenereerde
// bron moet dus parsen, ook met regelovergangen, lege regels en een apostrof.

import (
	"go/parser"
	"go/token"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

const meerregelig = "ReferentielijstItem\nEen soort aanvraag (de keuzelijst 'Soort aanvraag').\r\n\nOmdat het materieel is…\n"

func TestGoCommentaar(t *testing.T) {
	got := goCommentaar("a\r\nb\n\nc  \n")
	want := "a\n// b\n//\n// c"
	if got != want {
		t.Errorf("goCommentaar = %q, want %q", got, want)
	}
	if goCommentaar("één regel") != "één regel" {
		t.Error("één regel moet ongewijzigd blijven")
	}
}

func TestGegenereerdeBronnenParsenMetMeerregeligeBeschrijving(t *testing.T) {
	v3 := model.V3Model{
		Entiteiten: []model.V3Entiteit{{
			Typenaam: "AanvraagtypeDefinitie", Domein: "proef", EntiteitSubtype: "referentielijst_item", Meervoud: "aanvraagtypen",
			Description: meerregelig,
			Gegevenselementen: []model.V3Gegevenselement{{Naam: "Gegevens", Meervoud: "gegevens", Momentvoorkomen: "enkelvoudig", Description: meerregelig,
				Velden: []model.V3Veld{{Naam: "code", GoType: "string", Type: "string", Verplicht: true, Description: meerregelig}}}},
			Relaties: []model.V3Relatie{{Naam: "Aanvraagtype", RelatieSubtype: "referentielijst_items", Momentvoorkomen: "meervoudig",
				DoelEntiteit: "Referentielijst", IsMaterieel: true, Description: meerregelig}},
		}},
		Datatypes: []model.V3Datatype{{Naam: "ProefCode", Basistype: "string", Domein: "proef", Description: meerregelig}},
	}
	opts := codegenOptions{domein: "proef", prefix: "proef", additive: true}
	bronnen := map[string]func() (string, error){
		"entiteiten": func() (string, error) { return generateEntiteiten(v3) },
		"ge_rel":     func() (string, error) { return generateGeRel(v3) },
		"metareg":    func() (string, error) { return generateMetaRegistryAdditive(v3, opts) },
		"datatypes":  func() (string, error) { return generateDatatypeRegistryAdditive(v3, opts) },
		"aliases":    func() (string, error) { return generateDatatypeAliases(v3, opts) },
	}
	for naam, gen := range bronnen {
		src, err := gen()
		if err != nil {
			t.Fatalf("%s: %v", naam, err)
		}
		if _, err := parser.ParseFile(token.NewFileSet(), naam+".go", src, parser.AllErrors); err != nil {
			regels := strings.Split(src, "\n")
			if len(regels) > 60 {
				regels = regels[:60]
			}
			t.Errorf("%s parset niet: %v\n%s", naam, err, strings.Join(regels, "\n"))
		}
	}
}
