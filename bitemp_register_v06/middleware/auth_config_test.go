package middleware

// auth_config_test — tests voor ValideerAuthConfiguratie en de
// rolToegestaan-aanscherping (BE-review 2026-07-07, actiepunt 3).

import "testing"

func TestValideerAuthConfiguratie_LeegSecretWeigert(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	if err := ValideerAuthConfiguratie(false); err == nil {
		t.Error("verwacht fout bij leeg JWT_SECRET, kreeg nil")
	}
	if err := ValideerAuthConfiguratie(true); err == nil {
		t.Error("verwacht fout bij leeg JWT_SECRET in productie, kreeg nil")
	}
}

func TestValideerAuthConfiguratie_DevDefault(t *testing.T) {
	t.Setenv("JWT_SECRET", defaultDevJWTSecret)
	// Buiten productie: alleen waarschuwing, geen fout.
	if err := ValideerAuthConfiguratie(false); err != nil {
		t.Errorf("dev-default buiten productie moet zijn toegestaan (met warning), kreeg fout: %v", err)
	}
	// In productie: fout.
	if err := ValideerAuthConfiguratie(true); err == nil {
		t.Error("verwacht fout bij dev-default JWT_SECRET in productie, kreeg nil")
	}
}

func TestValideerAuthConfiguratie_EigenSecretOK(t *testing.T) {
	t.Setenv("JWT_SECRET", "een-eigen-lang-en-willekeurig-secret-1234567890")
	if err := ValideerAuthConfiguratie(true); err != nil {
		t.Errorf("eigen secret in productie moet zijn toegestaan, kreeg fout: %v", err)
	}
}

func TestRolToegestaan_OnbekendeVereisteRolIsDeny(t *testing.T) {
	// Een typo in RequireRol("editer") mag niet fail-open zijn.
	if rolToegestaan("viewer", "editer") {
		t.Error("onbekende vereiste rol moet deny zijn, kreeg allow")
	}
	if rolToegestaan("", "onbekend") {
		t.Error("onbekende huidige én vereiste rol moet deny zijn, kreeg allow")
	}
}

func TestRolToegestaan_Hierarchie(t *testing.T) {
	tests := []struct {
		huidig, vereist string
		want            bool
	}{
		{"admin", "viewer", true},
		{"admin", "admin", true},
		{"editor", "editor", true},
		{"editor", "admin", false},
		{"viewer", "editor", false},
		{"onbekend", "viewer", false},
	}
	for _, tt := range tests {
		if got := rolToegestaan(tt.huidig, tt.vereist); got != tt.want {
			t.Errorf("rolToegestaan(%q, %q) = %v, want %v", tt.huidig, tt.vereist, got, tt.want)
		}
	}
}
