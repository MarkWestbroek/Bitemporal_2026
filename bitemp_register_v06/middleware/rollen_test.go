package middleware

import (
	"reflect"
	"testing"
)

func TestRolNiveauEnAliassen(t *testing.T) {
	gevallen := map[string]int{"lezer": 1, "viewer": 1, "modelleur": 2, "ontwerper": 3,
		"bouwer": 4, "editor": 4, "beheerder": 5, "admin": 5, "": 0, "onbekend": 0}
	for rol, wil := range gevallen {
		if got := RolNiveau(rol); got != wil {
			t.Errorf("RolNiveau(%q) = %d, wil %d", rol, got, wil)
		}
	}
	// Bestaande RequireRol-aanroepen houden hun betekenis.
	for _, g := range []struct {
		huidig, vereist string
		mag             bool
	}{
		{"editor", "editor", true}, {"bouwer", "editor", true}, {"ontwerper", "editor", false},
		{"modelleur", "modelleur", true}, {"lezer", "modelleur", false}, {"viewer", "viewer", true},
		{"beheerder", "admin", true}, {"admin", "beheerder", true}, {"bouwer", "admin", false},
		{"admin", "onbekend", false},
	} {
		if got := rolToegestaan(g.huidig, g.vereist); got != g.mag {
			t.Errorf("rolToegestaan(%q, %q) = %v, wil %v", g.huidig, g.vereist, got, g.mag)
		}
	}
	if !IsBeheerder("admin") || !IsBeheerder("beheerder") || IsBeheerder("bouwer") {
		t.Error("IsBeheerder klopt niet")
	}
	if IsToekenbareRol("admin") || !IsToekenbareRol("modelleur") {
		t.Error("IsToekenbareRol: alleen de nieuwe namen zijn toe te kennen")
	}
}

func TestRollenTotEnMet(t *testing.T) {
	if got := RollenTotEnMet("ontwerper"); !reflect.DeepEqual(got, []string{"ontwerper", "modelleur", "lezer", "viewer"}) {
		t.Errorf("ontwerper: %v", got)
	}
	if got := RollenTotEnMet("editor"); !reflect.DeepEqual(got, []string{"editor", "bouwer", "ontwerper", "modelleur", "lezer", "viewer"}) {
		t.Errorf("editor: %v", got)
	}
	if got := RollenTotEnMet("medewerker"); !reflect.DeepEqual(got, []string{"medewerker"}) {
		t.Errorf("onbekende rol: %v", got)
	}
	if RollenTotEnMet("") != nil {
		t.Error("lege rol: nil")
	}
}
