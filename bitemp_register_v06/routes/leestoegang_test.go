package routes

// leestoegang_test — de leespoort (LEESTOEGANG=documenten): anoniem lezen van registerdata
// geeft 401, configuratie en referentielijsten blijven open, en met LEESTOEGANG=open (de
// default) verandert er niets. De guard breekt af vóór de handler, dus er is geen database
// nodig; voor routes die de handler wél bereiken vangt gin.Recovery de nil-database op als 500
// — genoeg om te zien dat de poort níet heeft geblokkeerd.

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func routerMetLeespoort(t *testing.T, leestoegang string) *gin.Engine {
	t.Helper()
	t.Setenv("AUTH_ENABLED", "true")
	t.Setenv("AUTHZ_PDP_ENABLED", "false")
	t.Setenv("LEESTOEGANG", leestoegang)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	SetupMiddleware(router)
	AddRoutes(router)
	return router
}

func get(router *gin.Engine, pad string, rol string) int {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, pad, nil)
	if rol != "" {
		// Claims direct in de context zetten kan niet van buitenaf; simuleer een ingelogde
		// gebruiker via een geldig JWT-cookie.
		token, err := middleware.GenereerJWT("t", rol, "t@example.com")
		if err != nil {
			panic(err)
		}
		req.AddCookie(&http.Cookie{Name: middleware.CookieNaam, Value: token})
	}
	router.ServeHTTP(rec, req)
	return rec.Code
}

func TestOpenbaarLeesbaar_UitHetModel(t *testing.T) {
	cases := map[string]bool{
		"WeergaveDefinitie": true, // configuratie-domein
		"QueryDefinitie":    true,
		"Gemeente":          true, // referentielijst_item
		"Referentielijst":   true,
		"Initiatief":        false,
		"NatuurlijkPersoon": false,
	}
	for typenaam, verwacht := range cases {
		meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
		if !ok {
			t.Logf("%s niet in het model, overgeslagen", typenaam)
			continue
		}
		if got := OpenbaarLeesbaar(meta); got != verwacht {
			t.Errorf("OpenbaarLeesbaar(%s) = %v, verwacht %v", typenaam, got, verwacht)
		}
	}
}

func TestLeespoort_Documenten(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-voor-leespoort-0123456789")
	router := routerMetLeespoort(t, middleware.LeesToegangDocumenten)

	dicht := []string{
		"/full/initiatieven", "/full/initiatieven/1", "/initiatieven", "/initiatieven/1",
		"/full/natuurlijk_personen", "/registraties", "/wijzigingen/1", "/full/registraties",
		"/tests", "/api/bestanden/1/download",
	}
	for _, pad := range dicht {
		if code := get(router, pad, ""); code != http.StatusUnauthorized {
			t.Errorf("anoniem GET %s: verwacht 401, kreeg %d", pad, code)
		}
	}

	open := []string{
		"/full/weergave_definities", "/weergave_definities/1", "/full/query_definities",
		"/referentielijsten", "/full/referentielijsten/gemeenten",
	}
	for _, pad := range open {
		if code := get(router, pad, ""); code == http.StatusUnauthorized || code == http.StatusForbidden {
			t.Errorf("anoniem GET %s hoort open te zijn, kreeg %d", pad, code)
		}
	}

	// Met een rol (viewer volstaat) gaat de poort open.
	for _, pad := range []string{"/full/initiatieven", "/registraties"} {
		if code := get(router, pad, "viewer"); code == http.StatusUnauthorized || code == http.StatusForbidden {
			t.Errorf("viewer GET %s: verwacht toegang, kreeg %d", pad, code)
		}
	}
}

func TestLeespoort_OpenIsDefault(t *testing.T) {
	router := routerMetLeespoort(t, "")
	if middleware.LeesToegang() != middleware.LeesToegangOpen {
		t.Fatalf("zonder LEESTOEGANG hoort de modus open te zijn, kreeg %q", middleware.LeesToegang())
	}
	for _, pad := range []string{"/full/initiatieven", "/registraties", "/tests"} {
		if code := get(router, pad, ""); code == http.StatusUnauthorized || code == http.StatusForbidden {
			t.Errorf("LEESTOEGANG=open: anoniem GET %s hoort niet geblokkeerd te zijn, kreeg %d", pad, code)
		}
	}
}

func TestLeespoort_GeenEffectZonderAuth(t *testing.T) {
	t.Setenv("AUTH_ENABLED", "false")
	t.Setenv("LEESTOEGANG", middleware.LeesToegangDocumenten)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	SetupMiddleware(router)
	AddRoutes(router)
	if code := get(router, "/full/initiatieven", ""); code == http.StatusUnauthorized {
		t.Errorf("zonder AUTH_ENABLED hoort de poort een no-op te zijn, kreeg 401")
	}
}
