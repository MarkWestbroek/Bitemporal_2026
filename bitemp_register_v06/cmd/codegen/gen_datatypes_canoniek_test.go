package main

// gen_datatypes_canoniek_test.go — het domein gegevenstypen wordt uit het model gegenereerd
// (besluit Mark 07-11-2026). Het gegenereerde bestand moet dezelfde vorm hebben als het vroegere
// handgemaakte gegevenstypen_datatype_registry.go en mag niets verliezen: externe referentie en
// alle weergavevelden gaan mee, en de init vervangt duplicaten uit andere domeinen.
//
// De volledige vergelijking (alle datatypes van het register → V3-export → codegen → dezelfde
// snapshots, en een tweede ronde byte-gelijk) staat in docs/CODEGEN.md §7.3f.

import (
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestDatatypeRegistry_GegevenstypenIsCanoniek(t *testing.T) {
	dec := 2
	v3 := model.V3Model{Datatypes: []model.V3Datatype{
		{Naam: "Kleur", Basistype: "string", Format: "color-hex", Domein: "gegevenstypen",
			Weergave: &model.V3Weergave{Placeholder: "#1a2b3c", Widget: "color"}},
		{Naam: "Bedrag", Basistype: "number", Domein: "gegevenstypen",
			Weergave: &model.V3Weergave{Prefix: "€", Suffix: "EUR", Multiline: true, Decimalen: &dec, Scheiding: ";"}},
		{Naam: "OIN", Basistype: "string", Domein: "gegevenstypen",
			ExterneReferentie: "https://example.org/oin"},
		{Naam: "Ander", Basistype: "string", Domein: "CG"},
	}}
	src, err := generateDatatypeRegistryAdditive(v3, codegenOptions{domein: "gegevenstypen", prefix: "gegevenstypen"})
	if err != nil {
		t.Fatal(err)
	}
	for _, moet := range []string{
		"func initGegevenstypenDatatypeRegistry() {",
		"registreerOfVervangDatatype(dt)",
		"func gegevenstypen() []V3Datatype {",
		`Widget:      "color"`,
		`Prefix:      "€"`,
		`Suffix:      "EUR"`,
		"Multiline:   true",
		"Decimalen:   intPtr(2)",
		`Scheiding:   ";"`,
		`ExterneReferentie: "https://example.org/oin"`,
	} {
		if !strings.Contains(src, moet) {
			t.Errorf("gegenereerde gegevenstypen-registry mist %q:\n%s", moet, src)
		}
	}
	if strings.Contains(src, "append(DatatypeRegistry") {
		t.Errorf("gegevenstypen moet vervangen, niet toevoegen:\n%s", src)
	}
	if strings.Contains(src, `"Ander"`) {
		t.Errorf("datatype uit een ander domein hoort niet in gegevenstypen:\n%s", src)
	}

	// Een gewoon domein blijft additief, maar krijgt dezelfde extra velden mee.
	src, err = generateDatatypeRegistryAdditive(model.V3Model{Datatypes: []model.V3Datatype{
		{Naam: "Ander", Basistype: "string", Domein: "CG", ExterneReferentie: "https://example.org/x",
			Weergave: &model.V3Weergave{Widget: "textarea"}},
	}}, codegenOptions{domein: "CG", prefix: "cg"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(src, "append(DatatypeRegistry") || strings.Contains(src, "registreerOfVervangDatatype") {
		t.Errorf("gewoon domein moet additief blijven:\n%s", src)
	}
	if !strings.Contains(src, `ExterneReferentie: "https://example.org/x"`) || !strings.Contains(src, `Widget:      "textarea"`) {
		t.Errorf("gewoon domein mist externe referentie of widget:\n%s", src)
	}
}
