package handlers

// full_handlers_weergavenaam_test.go — unit tests voor de weergavenaam-berekening
// in full_handlers.go: evalueerCELConcatenatie, navigeerAfgeleidPad,
// berekenWeergavenaamVanEntiteit.
//
// Tests zijn puur in-memory: geen database nodig.

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// ─── helpers ────────────────────────────────────────────────────────────────

// maakTestMeta bouwt een minimale TypeMeta met een of meer AfgeleideVelden.
func maakTestMeta(afgeleideVelden []model.AfgeleidVeld, onderliggende []model.OnderliggendGegevenselement) model.TypeMeta {
	return model.TypeMeta{
		Typenaam:                       "TestType",
		OnderliggendeGegevenselementen: onderliggende,
		AfgeleideVelden:                afgeleideVelden,
	}
}

// maakWeergaveVeld bouwt een AfgeleidVeld met IsWeergaveVeld=true.
func maakWeergaveVeld(regel string) model.AfgeleidVeld {
	return model.AfgeleidVeld{
		Naam:            "weergavenaam",
		IsWeergaveVeld:  true,
		Afleidingsregel: regel,
	}
}

// ─── evalueerCELConcatenatie ─────────────────────────────────────────────────

func TestEvalueerCELConcatenatie_EenvoudigPad(t *testing.T) {
	// Expressie zonder +: eenvoudig pad-navigatie
	meta := maakTestMeta(nil, []model.OnderliggendGegevenselement{
		{Rolnaam: "GemeenteGegevens", JSONRolnaam: "gemeente_gegevens", Doeltype: "Gemeente_GemeenteGegevens"},
	})
	// Neem een platte map zonder kinderen: direct veld
	entityMap := map[string]any{
		"gemeente_gegevens": []any{
			map[string]any{"naam": "Amsterdam", "afvoer": nil},
		},
	}

	// Pad navigeert via OnderliggendeGegevenselementen (rolnaam match case-insensitive)
	result := evalueerCELConcatenatie(entityMap, "GemeenteGegevens.naam", meta)
	if result != "Amsterdam" {
		t.Errorf("verwacht 'Amsterdam', got %q", result)
	}
}

func TestEvalueerCELConcatenatie_Concatenatie(t *testing.T) {
	// Expressie met +: naam + " (" + code + ")"
	meta := maakTestMeta(nil, []model.OnderliggendGegevenselement{
		{Rolnaam: "GemeenteGegevens", JSONRolnaam: "gemeente_gegevens", Doeltype: "Gemeente_GemeenteGegevens"},
	})
	entityMap := map[string]any{
		"gemeente_gegevens": []any{
			map[string]any{"naam": "Utrecht", "code": "0344", "afvoer": nil},
		},
	}

	result := evalueerCELConcatenatie(entityMap, `GemeenteGegevens.naam + " (" + GemeenteGegevens.code + ")"`, meta)
	if result != "Utrecht (0344)" {
		t.Errorf("verwacht 'Utrecht (0344)', got %q", result)
	}
}

func TestEvalueerCELConcatenatie_StringLiteralMetEscapesInConcatenatie(t *testing.T) {
	// Escaped aanhalingsteken in string-literal als onderdeel van concatenatie
	meta := maakTestMeta(nil, nil)
	entityMap := map[string]any{"naam": "Test"}

	result := evalueerCELConcatenatie(entityMap, `naam + " (\"quoted\")"`, meta)
	expected := `Test ("quoted")`
	if result != expected {
		t.Errorf("verwacht %q, got %q", expected, result)
	}
}

func TestEvalueerCELConcatenatie_OntbrekendVeld(t *testing.T) {
	meta := maakTestMeta(nil, []model.OnderliggendGegevenselement{
		{Rolnaam: "GemeenteGegevens", JSONRolnaam: "gemeente_gegevens", Doeltype: "Gemeente_GemeenteGegevens"},
	})
	entityMap := map[string]any{
		"gemeente_gegevens": []any{
			map[string]any{"naam": "Rotterdam", "afvoer": nil},
		},
	}

	// Veld "code" bestaat niet: leeg segment, dus haakjes sluiten direct
	result := evalueerCELConcatenatie(entityMap, `GemeenteGegevens.naam + " (" + GemeenteGegevens.code + ")"`, meta)
	if result != "Rotterdam ()" {
		t.Errorf("verwacht 'Rotterdam ()', got %q", result)
	}
}

func TestEvalueerCELConcatenatie_DirectVeldZonderOnderliggende(t *testing.T) {
	// Als het pad niet via OnderliggendeGegevenselementen loopt: direct veld
	meta := maakTestMeta(nil, nil)
	entityMap := map[string]any{"rol": "Realiseert"}

	result := evalueerCELConcatenatie(entityMap, "rol", meta)
	if result != "Realiseert" {
		t.Errorf("verwacht 'Realiseert', got %q", result)
	}
}

// ─── navigeerAfgeleidPad ─────────────────────────────────────────────────────

func TestNavigeerAfgeleidPad_DirectVeld(t *testing.T) {
	meta := maakTestMeta(nil, nil)
	entityMap := map[string]any{"naam": "direct"}

	result := navigeerAfgeleidPad(entityMap, "naam", meta)
	if result != "direct" {
		t.Errorf("verwacht 'direct', got %q", result)
	}
}

func TestNavigeerAfgeleidPad_NestedVeld(t *testing.T) {
	meta := maakTestMeta(nil, []model.OnderliggendGegevenselement{
		{Rolnaam: "DomeinGegevens", JSONRolnaam: "domein_gegevens", Doeltype: "Domein_DomeinGegevens"},
	})
	entityMap := map[string]any{
		"domein_gegevens": []any{
			map[string]any{"naam": "Standaarden", "afvoer": nil},
		},
	}

	result := navigeerAfgeleidPad(entityMap, "DomeinGegevens.naam", meta)
	if result != "Standaarden" {
		t.Errorf("verwacht 'Standaarden', got %q", result)
	}
}

func TestNavigeerAfgeleidPad_AfgevoerdItemWordtOvergeslagen(t *testing.T) {
	meta := maakTestMeta(nil, []model.OnderliggendGegevenselement{
		{Rolnaam: "DomeinGegevens", JSONRolnaam: "domein_gegevens", Doeltype: "Domein_DomeinGegevens"},
	})
	afgevoerd := "2026-01-01T00:00:00Z"
	entityMap := map[string]any{
		"domein_gegevens": []any{
			map[string]any{"naam": "Oud", "afvoer": afgevoerd},
			map[string]any{"naam": "Nieuw", "afvoer": nil},
		},
	}

	result := navigeerAfgeleidPad(entityMap, "DomeinGegevens.naam", meta)
	if result != "Nieuw" {
		t.Errorf("verwacht 'Nieuw' (eerste niet-afgevoerde), got %q", result)
	}
}

func TestNavigeerAfgeleidPad_LegePad(t *testing.T) {
	meta := maakTestMeta(nil, nil)
	entityMap := map[string]any{}

	result := navigeerAfgeleidPad(entityMap, "ontbreekt", meta)
	if result != "" {
		t.Errorf("verwacht lege string voor ontbrekend veld, got %q", result)
	}
}

// ─── berekenWeergavenaamVanEntiteit ─────────────────────────────────────────

func TestBerekenWeergavenaamVanEntiteit_NietGevonden_LeggeString(t *testing.T) {
	meta := maakTestMeta([]model.AfgeleidVeld{
		{Naam: "ander_veld", IsWeergaveVeld: false, Afleidingsregel: "naam"},
	}, nil)
	entityMap := map[string]any{"naam": "Test"}

	result := berekenWeergavenaamVanEntiteit(entityMap, meta)
	if result != "" {
		t.Errorf("verwacht lege string als geen IsWeergaveVeld, got %q", result)
	}
}

func TestBerekenWeergavenaamVanEntiteit_EenvoudigPad(t *testing.T) {
	meta := maakTestMeta([]model.AfgeleidVeld{
		maakWeergaveVeld("naam"),
	}, nil)
	entityMap := map[string]any{"naam": "Mijn Naam"}

	result := berekenWeergavenaamVanEntiteit(entityMap, meta)
	if result != "Mijn Naam" {
		t.Errorf("verwacht 'Mijn Naam', got %q", result)
	}
}

func TestBerekenWeergavenaamVanEntiteit_ConcatenatiePad(t *testing.T) {
	meta := maakTestMeta(
		[]model.AfgeleidVeld{
			maakWeergaveVeld(`GemeenteGegevens.naam + " (" + GemeenteGegevens.code + ")"`),
		},
		[]model.OnderliggendGegevenselement{
			{Rolnaam: "GemeenteGegevens", JSONRolnaam: "gemeente_gegevens", Doeltype: "Gemeente_GemeenteGegevens"},
		},
	)
	entityMap := map[string]any{
		"gemeente_gegevens": []any{
			map[string]any{"naam": "Groningen", "code": "0014", "afvoer": nil},
		},
	}

	result := berekenWeergavenaamVanEntiteit(entityMap, meta)
	if result != "Groningen (0014)" {
		t.Errorf("verwacht 'Groningen (0014)', got %q", result)
	}
}
