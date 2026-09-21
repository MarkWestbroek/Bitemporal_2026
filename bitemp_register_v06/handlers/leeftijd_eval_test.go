package handlers

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Test de leeftijd()-integratie in de full-API CEL-evaluator met een directe
// (niet-genavigeerde) geboortedatum op de entity-map.
func TestEvalueerCELSegment_Leeftijd(t *testing.T) {
	meta := model.TypeMeta{}
	em := map[string]any{"geboortedatum": "1990-06-15"}

	// Expliciete peildatum
	if got := evalueerCELSegment(em, `leeftijd(geboortedatum, "2026-07-09")`, meta); got != "36" {
		t.Fatalf("verwachtte 36, kreeg %q", got)
	}
	// Dag vóór verjaardag
	if got := evalueerCELSegment(em, `leeftijd(geboortedatum, "2026-06-14")`, meta); got != "35" {
		t.Fatalf("verwachtte 35, kreeg %q", got)
	}
	// Onbepaalbaar → lege string in concatenatie-context
	emLeeg := map[string]any{"geboortedatum": "0000-00-00"}
	if got := evalueerCELSegment(emLeeg, `leeftijd(geboortedatum, "2026-07-09")`, meta); got != "" {
		t.Fatalf("verwachtte lege string, kreeg %q", got)
	}
}

// Test dat een afgeleid veld met leeftijd(...) als int-waarde wordt teruggegeven
// (getypeerd), niet als string.
func TestEvalueerAfgeleidVeldWaarde_LeeftijdIsInt(t *testing.T) {
	meta := model.TypeMeta{}
	em := map[string]any{"geboortedatum": "1990-06-15"}
	av := model.AfgeleidVeld{Naam: "leeftijd", GoType: "int", Afleidingsregel: `leeftijd(geboortedatum, "2026-07-09")`}

	got := evalueerAfgeleidVeldWaarde(em, av, meta)
	i, ok := got.(int)
	if !ok {
		t.Fatalf("verwachtte int, kreeg %T (%v)", got, got)
	}
	if i != 36 {
		t.Fatalf("verwachtte 36, kreeg %d", i)
	}

	// Onbepaalbaar → nil
	emLeeg := map[string]any{"geboortedatum": ""}
	if got := evalueerAfgeleidVeldWaarde(emLeeg, av, meta); got != nil {
		t.Fatalf("verwachtte nil, kreeg %v", got)
	}
}

// Test dat leeftijd() ook binnen een concatenatie-expressie (weergavenaam) werkt.
func TestEvalueerCELConcatenatie_LeeftijdInWeergavenaam(t *testing.T) {
	meta := model.TypeMeta{}
	em := map[string]any{"achternaam": "Jansen", "geboortedatum": "1990-06-15"}
	expr := `achternaam + " (" + leeftijd(geboortedatum, "2026-07-09") + ")"`
	if got := evalueerCELConcatenatie(em, expr, meta); got != "Jansen (36)" {
		t.Fatalf("verwachtte \"Jansen (36)\", kreeg %q", got)
	}
}
