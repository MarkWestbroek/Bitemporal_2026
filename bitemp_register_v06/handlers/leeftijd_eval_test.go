package handlers

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// leeftijd() in de full-API: sinds 11-10-2026 via de gedeelde CEL-evaluator (afleiding/celexpr).
// Deze tests bewaken het gedrag van de vroegere eigen evaluator.

// Een afgeleid veld met leeftijd(...) wordt als int teruggegeven (getypeerd), niet als string;
// onbepaalbaar → nil.
func TestEvalueerAfgeleidVeldWaarde_LeeftijdIsInt(t *testing.T) {
	meta := model.TypeMeta{}
	em := map[string]any{"geboortedatum": "1990-06-15"}
	av := model.AfgeleidVeld{Naam: "leeftijd", GoType: "int", Afleidingsregel: `leeftijd(geboortedatum, "2026-07-09")`}

	got := evalueerAfgeleidVeldWaarde(em, av, meta)
	if i, ok := got.(int); !ok || i != 36 {
		t.Fatalf("verwachtte int 36, kreeg %T (%v)", got, got)
	}
	av.Afleidingsregel = `leeftijd(geboortedatum, "2026-06-14")`
	if got := evalueerAfgeleidVeldWaarde(em, av, meta); got != 35 {
		t.Fatalf("dag vóór verjaardag: verwachtte 35, kreeg %v", got)
	}
	if got := evalueerAfgeleidVeldWaarde(map[string]any{"geboortedatum": ""}, av, meta); got != nil {
		t.Fatalf("verwachtte nil, kreeg %v", got)
	}
}

// leeftijd() binnen een samenvoeging (weergavenaam); onbepaalbaar telt als "".
func TestAfgeleidTekstveld_LeeftijdInSamenvoeging(t *testing.T) {
	meta := model.TypeMeta{}
	em := map[string]any{"achternaam": "Jansen", "geboortedatum": "1990-06-15"}
	av := model.AfgeleidVeld{GoType: "string", Afleidingsregel: `achternaam + " (" + leeftijd(geboortedatum, "2026-07-09") + ")"`}
	if got := evalueerAfgeleidVeldWaarde(em, av, meta); got != "Jansen (36)" {
		t.Fatalf("verwachtte \"Jansen (36)\", kreeg %q", got)
	}
	em["geboortedatum"] = "0000-00-00"
	if got := evalueerAfgeleidVeldWaarde(em, av, meta); got != "Jansen ()" {
		t.Fatalf("verwachtte \"Jansen ()\", kreeg %q", got)
	}
}
