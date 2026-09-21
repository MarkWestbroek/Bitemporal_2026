package handlers

// Tests voor de gedeelde beheerwachtwoord-controle (BE-review 2026-07-07, §3.3).

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestControleerBeheerWachtwoord_DevDefaultBuitenProductie(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("GIN_MODE", "debug")

	// Geen geconfigureerd wachtwoord → dev-default "1234" geldt.
	if status, err := controleerBeheerWachtwoord("1234", ""); err != nil {
		t.Errorf("dev-default buiten productie moet werken, kreeg %d/%v", status, err)
	}
	if status, err := controleerBeheerWachtwoord("fout", ""); err == nil || status != http.StatusUnauthorized {
		t.Errorf("verkeerd wachtwoord: wil 401, kreeg %d/%v", status, err)
	}
}

func TestControleerBeheerWachtwoord_GeenDefaultInProductie(t *testing.T) {
	t.Setenv("APP_ENV", "production")

	status, err := controleerBeheerWachtwoord("1234", "")
	if err == nil || status != http.StatusForbidden {
		t.Errorf("in productie zonder geconfigureerd wachtwoord: wil 403, kreeg %d/%v", status, err)
	}

	// Met expliciet geconfigureerd wachtwoord werkt het wel in productie.
	if status, err := controleerBeheerWachtwoord("lang-en-geheim", "lang-en-geheim"); err != nil {
		t.Errorf("geconfigureerd wachtwoord in productie moet werken, kreeg %d/%v", status, err)
	}
}

func TestAangebodenBeheerWachtwoord_HeaderGaatVoorPadParam(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/admin/rebuild/padwachtwoord", nil)
	ctx.Params = gin.Params{{Key: "password", Value: "padwachtwoord"}}

	if got := aangebodenBeheerWachtwoord(ctx); got != "padwachtwoord" {
		t.Errorf("zonder header: wil padparam, kreeg %q", got)
	}

	ctx.Request.Header.Set(BeheerWachtwoordHeader, "headerwachtwoord")
	if got := aangebodenBeheerWachtwoord(ctx); got != "headerwachtwoord" {
		t.Errorf("met header: wil headerwaarde, kreeg %q", got)
	}
}
