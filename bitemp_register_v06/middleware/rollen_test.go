package middleware

import (
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
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

// Een melding noemt de rol zoals de UI hem kent: de oude aliassen worden de nieuwe namen,
// met hetzelfde niveau (FUNDAMENT 23-11: "Vereist: editor" bestond niet in de keuzelijst).
func TestToekenbareNaam(t *testing.T) {
	for alias, nieuw := range map[string]string{"viewer": "lezer", "editor": "bouwer", "admin": "beheerder"} {
		if got := ToekenbareNaam(alias); got != nieuw {
			t.Errorf("%s: %q, verwacht %q", alias, got, nieuw)
		}
		if RolNiveau(alias) != RolNiveau(nieuw) || !IsToekenbareRol(nieuw) {
			t.Errorf("%s → %s: ander niveau of niet toekenbaar", alias, nieuw)
		}
	}
	for _, r := range append(ToekenbareRollen, "onbekend", "") {
		if ToekenbareNaam(r) != r {
			t.Errorf("%q hoort gelijk te blijven", r)
		}
	}
}

func TestControleerRol_MeldingNoemtNieuweNaam(t *testing.T) {
	t.Setenv("AUTH_ENABLED", "true")
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/registratie/", nil)
	c.Set(ContextKeyGebruiker, &JWTClaims{Rol: "modelleur"})
	if ControleerRol(c, "editor") {
		t.Fatal("modelleur hoort geen editor-route te mogen")
	}
	if w.Code != 403 || !strings.Contains(w.Body.String(), "Vereist: bouwer, huidig: modelleur") {
		t.Errorf("melding: %d %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "editor") {
		t.Errorf("de oude naam hoort niet in de melding: %s", w.Body.String())
	}
}
