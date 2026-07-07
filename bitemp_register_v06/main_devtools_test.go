//go:build devtools

package main

// Tests voor de droptables-endpoints. Deze routes bestaan alleen in builds
// met -tags devtools (BE-review 2026-07-07, §3.3); draai deze tests dus met:
//   go test -tags devtools ./...

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/gin-gonic/gin"
)

func TestDropTablesEndpoint_WrongPassword(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ALLOW_DROP_TABLES", "true")
	t.Setenv("ADMIN_DROP_PASSWORD", "1234")

	handlers.DB = nil
	r := NewRouter()

	req := httptest.NewRequest(http.MethodDelete, "/admin/db/droptables/wrong", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", w.Code)
	}
}

func TestDropTablesEndpoint_DBNotInitialized(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ALLOW_DROP_TABLES", "true")
	t.Setenv("ADMIN_DROP_PASSWORD", "1234")

	handlers.DB = nil
	r := NewRouter()

	req := httptest.NewRequest(http.MethodDelete, "/admin/db/droptables/1234", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", w.Code)
	}
}

func TestDropTablesEndpoint_CustomEnvPassword_DBNotInitialized(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ALLOW_DROP_TABLES", "true")
	t.Setenv("ADMIN_DROP_PASSWORD", "secret-xyz")

	handlers.DB = nil
	r := NewRouter()

	req := httptest.NewRequest(http.MethodDelete, "/admin/db/droptables/secret-xyz", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", w.Code)
	}
}

func TestDropTablesEndpoint_DisabledByDefault(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ALLOW_DROP_TABLES", "false")
	t.Setenv("ADMIN_DROP_PASSWORD", "1234")

	handlers.DB = nil
	r := NewRouter()

	req := httptest.NewRequest(http.MethodDelete, "/admin/db/droptables/1234", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d", w.Code)
	}
}

func TestDropTablesEndpoint_WithDomein_DBNotInitialized(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ALLOW_DROP_TABLES", "true")
	t.Setenv("ADMIN_DROP_PASSWORD", "1234")

	handlers.DB = nil
	r := NewRouter()

	req := httptest.NewRequest(http.MethodDelete, "/admin/db/droptables/1234?domein=np-loc", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", w.Code)
	}
}

func TestDropTablesEndpoint_WithDomein_WrongPassword(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ALLOW_DROP_TABLES", "true")
	t.Setenv("ADMIN_DROP_PASSWORD", "1234")

	handlers.DB = nil
	r := NewRouter()

	req := httptest.NewRequest(http.MethodDelete, "/admin/db/droptables/wrong?domein=np-loc", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", w.Code)
	}
}
