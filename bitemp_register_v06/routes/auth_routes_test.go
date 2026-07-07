package routes

// auth_routes_test — verifieert dat muterende routes zijn afgeschermd met
// RequireRol("editor") zodra AUTH_ENABLED=true (BE-review 2026-07-07,
// actiepunt 3). De middleware breekt af vóór de handler, dus er is geen
// database nodig: een anonieme mutatie moet 401 opleveren.

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func nieuweTestRouterMetAuth(t *testing.T) *gin.Engine {
	t.Helper()
	t.Setenv("AUTH_ENABLED", "true")
	// PDP uitzetten zodat alleen de lokale rolcheck getest wordt.
	t.Setenv("AUTHZ_PDP_ENABLED", "false")

	gin.SetMode(gin.TestMode)
	router := gin.New()
	SetupMiddleware(router)
	AddRoutes(router)
	return router
}

// TestMuterendeRoutesVereisenAuth: anonieme mutaties → 401.
func TestMuterendeRoutesVereisenAuth(t *testing.T) {
	router := nieuweTestRouterMetAuth(t)

	mutaties := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/registratie/"},
		{http.MethodPatch, "/registraties/1"},
		{http.MethodPost, "/tests"},
		{http.MethodPut, "/tests/1"},
		{http.MethodDelete, "/tests/1"},
		{http.MethodPost, "/api/bestanden/upload"},
	}

	for _, m := range mutaties {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(m.method, m.path, nil)
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s zonder login: verwacht 401, kreeg %d", m.method, m.path, rec.Code)
		}
	}
}

// TestMuterendeMetaRoutesVereisenAuth: ook de per-padnaam POST/DELETE routes
// uit de MetaRegistry moeten 401 geven zonder login.
func TestMuterendeMetaRoutesVereisenAuth(t *testing.T) {
	router := nieuweTestRouterMetAuth(t)

	for _, route := range router.Routes() {
		if route.Method == http.MethodGet {
			continue
		}
		if route.Path == "/*path" { // OPTIONS preflight catch-all
			continue
		}
		rec := httptest.NewRecorder()
		// Vervang parameters door concrete waarden.
		pad := strings.NewReplacer(":id", "1", ":typenaam", "x").Replace(route.Path)
		req := httptest.NewRequest(route.Method, pad, nil)
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s zonder login: verwacht 401, kreeg %d", route.Method, route.Path, rec.Code)
		}
	}
}

// TestGetRoutesBlijvenPubliekZonderPDP: lees-routes worden door de lokale
// rolcheck NIET geblokkeerd (ze mogen wel om andere redenen falen, maar geen 401).
func TestGetRoutesBlijvenPubliekZonderPDP(t *testing.T) {
	router := nieuweTestRouterMetAuth(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/registraties", nil)

	// GET raakt de database; met DB=nil kan dat een 500 of panic-recovery zijn,
	// maar géén 401. We vangen een eventuele panic af omdat gin.New() zonder
	// Recovery draait en handlers.DB in tests niet gezet is.
	defer func() {
		if r := recover(); r != nil {
			// Panic in de handler betekent: middleware liet het request door — goed.
			t.Logf("GET /registraties bereikte de handler (panic op DB=nil): %v", r)
		}
	}()
	router.ServeHTTP(rec, req)
	if rec.Code == http.StatusUnauthorized {
		t.Errorf("GET /registraties zonder login: verwacht géén 401 (lezen is publiek zonder PDP), kreeg %d", rec.Code)
	}
}
