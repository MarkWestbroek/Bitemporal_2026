//go:build !devtools

package main

// Verifieert de veiligheidsgarantie van BE-review 2026-07-07 §3.3: in een
// default build (zonder -tags devtools) bestaan de admin-/devloop-endpoints
// niet — zelfs niet met de juiste flags en wachtwoorden.

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAdminRoutesNietGeregistreerdZonderDevtoolsTag(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ALLOW_DROP_TABLES", "true")
	t.Setenv("DEVLOOP", "true")

	r := NewRouter()

	paden := []struct {
		method string
		path   string
	}{
		{http.MethodDelete, "/admin/db/droptables/1234"},
		{http.MethodDelete, "/admin/db/droptables"},
		{http.MethodPost, "/admin/db/createtables"},
		{http.MethodPost, "/admin/rebuild/1234"},
		{http.MethodPost, "/admin/rebuild"},
		{http.MethodGet, "/admin/rebuild/status"},
		{http.MethodPost, "/admin/diff/1234"},
	}

	for _, p := range paden {
		req := httptest.NewRequest(p.method, p.path, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusNotFound {
			t.Errorf("%s %s: verwacht 404 (route niet meegecompileerd), kreeg %d", p.method, p.path, w.Code)
		}
	}
}
