package middleware

import (
	"net/http"
	"testing"
)

func TestBepaalAuthZENActie(t *testing.T) {
	tests := []struct {
		method string
		path   string
		want   string
	}{
		// GET = read
		{http.MethodGet, "/as", "read"},
		{http.MethodGet, "/full/as/1", "read"},
		{http.MethodGet, "/api/schema/model", "read"},
		{http.MethodHead, "/version", "read"},
		{http.MethodOptions, "/as", "read"},

		// POST/PUT/PATCH/DELETE = write
		{http.MethodPost, "/registratie/", "write"},
		{http.MethodPost, "/api/schema/model", "write"},
		{http.MethodPost, "/api/bestanden/upload", "write"},
		{http.MethodPut, "/tests/1", "write"},
		{http.MethodPatch, "/registraties/1", "write"},
		{http.MethodDelete, "/tests/1", "write"},

		// Admin routes
		{http.MethodPost, "/admin/rebuild/secret", "admin"},
		{http.MethodDelete, "/admin/db/droptables/secret", "admin"},
		{http.MethodGet, "/admin/rebuild/status", "admin"},
	}

	for _, tt := range tests {
		got := BepaalAuthZENActie(tt.method, tt.path)
		if got != tt.want {
			t.Errorf("BepaalAuthZENActie(%s, %s) = %q, want %q", tt.method, tt.path, got, tt.want)
		}
	}
}

func TestBepaalAuthZENResource(t *testing.T) {
	tests := []struct {
		path     string
		wantType string
		wantID   string
	}{
		// Auth routes
		{"/api/auth/login", "auth", "auth"},
		{"/api/auth/me", "auth", "auth"},

		// Admin routes
		{"/admin/rebuild/secret", "api", "admin"},
		{"/admin/db/droptables/secret", "api", "admin"},

		// Schema API
		{"/api/schema/model", "api", "schema"},
		{"/api/schema/versies", "api", "schema"},

		// Bestanden API
		{"/api/bestanden/upload", "api", "bestanden"},
		{"/api/bestanden/1/download", "api", "bestanden"},

		// Viz API
		{"/api/viz/schema", "api", "viz"},

		// Registratie
		{"/registratie/", "api", "registratie"},

		// Full entity routes
		{"/full/as/1", "api", "as"},
		{"/full/rel_a_bs/42", "api", "rel_a_bs"},
		{"/full/registraties/1", "api", "registraties"},

		// MetaRegistry paden
		{"/as", "api", "as"},
		{"/as/1", "api", "as"},
		{"/rel_a_bs", "api", "rel_a_bs"},
		{"/tests", "api", "tests"},
		{"/registraties", "api", "registraties"},
		{"/wijzigingen", "api", "wijzigingen"},

		// Bekende niet-API paden
		{"/docs", "api", "docs"},
		{"/version", "api", "version"},
	}

	for _, tt := range tests {
		gotType, gotID := BepaalAuthZENResource(tt.path)
		if gotType != tt.wantType || gotID != tt.wantID {
			t.Errorf("BepaalAuthZENResource(%s) = (%q, %q), want (%q, %q)",
				tt.path, gotType, gotID, tt.wantType, tt.wantID)
		}
	}
}

func TestIsPubliekPad(t *testing.T) {
	publiek := []struct {
		path   string
		method string
	}{
		{"/api/auth/login", http.MethodPost},
		{"/api/auth/status", http.MethodGet},
		{"/viz/react/index.html", http.MethodGet},
		{"/docs", http.MethodGet},
		{"/docs/readme", http.MethodGet},
		{"/", http.MethodGet},
		{"/version", http.MethodGet},
		{"/openapi.json", http.MethodGet},
		{"/openapi.yaml", http.MethodGet},
		{"/openapi/np_loc", http.MethodGet},
		{"/swagger", http.MethodGet},
		{"/redoc", http.MethodGet},
		{"/graphql/playground", http.MethodGet},
		// OPTIONS altijd publiek
		{"/as", http.MethodOptions},
		{"/admin/rebuild/secret", http.MethodOptions},
	}

	for _, tt := range publiek {
		if !isPubliekPad(tt.path, tt.method) {
			t.Errorf("isPubliekPad(%s, %s) = false, verwacht true", tt.path, tt.method)
		}
	}

	nietPubliek := []struct {
		path   string
		method string
	}{
		{"/as", http.MethodGet},
		{"/full/as/1", http.MethodGet},
		{"/registratie/", http.MethodPost},
		{"/admin/rebuild/secret", http.MethodPost},
		{"/api/schema/model", http.MethodGet},
		{"/graphql/query", http.MethodPost},
	}

	for _, tt := range nietPubliek {
		if isPubliekPad(tt.path, tt.method) {
			t.Errorf("isPubliekPad(%s, %s) = true, verwacht false", tt.path, tt.method)
		}
	}
}
