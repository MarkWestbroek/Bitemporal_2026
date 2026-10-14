package meldingen

import (
	"strings"
	"testing"
)

func TestValideerMelding(t *testing.T) {
	in := MeldingInvoer{Soort: " bug ", Titel: " Knop doet niets ", Context: map[string]string{
		"pad": "Map/Element", "onderwerpid": "uc_1", "onbekend": "weg", "browser": strings.Repeat("x", 300),
	}}
	if msg := valideerMelding(&in); msg != "" {
		t.Fatalf("goed geval: %s", msg)
	}
	if in.Soort != "bug" || in.Titel != "Knop doet niets" {
		t.Errorf("niet getrimd: %+v", in)
	}
	if _, ok := in.Context["onbekend"]; ok {
		t.Error("onbekend contextveld moet weg")
	}
	if len(in.Context["browser"]) != maxContextVal {
		t.Errorf("contextwaarde niet ingekort: %d", len(in.Context["browser"]))
	}
	for naam, m := range map[string]MeldingInvoer{
		"onbekende soort": {Soort: "klacht", Titel: "x"},
		"geen titel":      {Soort: "wens", Titel: "  "},
		"titel te lang":   {Soort: "vraag", Titel: strings.Repeat("x", 256)},
	} {
		m := m
		if valideerMelding(&m) == "" {
			t.Errorf("%s: verwacht een fout", naam)
		}
	}
}

func TestSchoneNaamEnUUID(t *testing.T) {
	if got := schoneNaam(`../a/b<c>.png`); strings.ContainsAny(got, `/\<>`) {
		t.Errorf("schoneNaam: %q", got)
	}
	if schoneNaam("  ") != "bijlage" {
		t.Error("lege naam")
	}
	a, b := nieuwUUID(), nieuwUUID()
	if a == b || len(a) != 36 || a[14] != '4' {
		t.Errorf("uuid: %s %s", a, b)
	}
}
