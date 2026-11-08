package handlers

// rebuild_startup_standaard_test.go — de startup-rebuild genereert van het standaardpakket alleen
// wat bij de rebuild van de actieve versie expliciet uit het model gegenereerd is. Op cg-test
// (08-11-2026) genereerde hij ide_bestanden uit het Studio-model; dat paste niet bij de
// handgeschreven handlers, de build faalde en elke nieuwe pod startte zonder inrichting.

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func runPrefixen(runs []RebuildDomeinSpec) []string {
	var p []string
	for _, r := range runs {
		p = append(p, r.Prefix)
	}
	return p
}

var startupModelRuns = []RebuildDomeinSpec{
	{Domein: "inrichting", Prefix: "inrichting"},
	{Domein: "register", Prefix: "register"},
	{Domein: "ide-bestanden", Prefix: "ide_bestanden"},
	{Domein: "beheer", Prefix: "beheer"},
	{Domein: "gegevenstypen", Prefix: "gegevenstypen"},
	{Domein: "np-loc", Prefix: "np_loc"}, // in het model, niet op de lijst
}

func TestStartupRuns_NieuwFormaatAlleenGegenereerd(t *testing.T) {
	// Zoals markeerGegenereerd het na een rebuild met domeinen [inrichting, register] vastlegt.
	aanwezig := []model.GebouwdDomein{
		{Domein: "inrichting", Prefix: "inrichting"}, {Domein: "register", Prefix: "register"},
		{Domein: "ide-bestanden", Prefix: "ide_bestanden"}, {Domein: "beheer", Prefix: "beheer"},
		{Domein: "gegevenstypen", Prefix: "gegevenstypen"},
	}
	gebouwd := markeerGegenereerd(aanwezig, []RebuildDomeinSpec{{Domein: "inrichting", Prefix: "inrichting"}, {Domein: "register", Prefix: "register"}})

	// De vlag overleeft de opslag in schema_versies (JSONB).
	b, _ := json.Marshal(gebouwd)
	var terug []model.GebouwdDomein
	if err := json.Unmarshal(b, &terug); err != nil {
		t.Fatal(err)
	}
	got := runPrefixen(startupRuns(startupModelRuns, terug))
	if want := []string{"inrichting", "register"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("startupRuns = %v, want %v (ide_bestanden/beheer/gegevenstypen blijven zoals het image ze heeft)", got, want)
	}

	// Expliciet gegenereerd gegevenstypen gaat wél mee.
	gebouwd = markeerGegenereerd(aanwezig, []RebuildDomeinSpec{{Prefix: "inrichting"}, {Prefix: "gegevenstypen"}})
	got = runPrefixen(startupRuns(startupModelRuns, gebouwd))
	if want := []string{"inrichting", "gegevenstypen"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("startupRuns = %v, want %v", got, want)
	}
}

// Een lijst van vóór 08-11-2026 (zonder vlaggen, zoals versie 5/6 op cg-test): van het
// standaardpakket alleen register.
func TestStartupRuns_OudeLijst(t *testing.T) {
	oud := []model.GebouwdDomein{
		{Domein: "inrichting", Prefix: "inrichting"}, {Domein: "register", Prefix: "register"},
		{Domein: "ide-bestanden", Prefix: "ide_bestanden"}, {Domein: "beheer", Prefix: "beheer"},
		{Domein: "gegevenstypen", Prefix: "gegevenstypen"},
	}
	got := runPrefixen(startupRuns(startupModelRuns, oud))
	if want := []string{"inrichting", "register"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("startupRuns = %v, want %v", got, want)
	}
}
