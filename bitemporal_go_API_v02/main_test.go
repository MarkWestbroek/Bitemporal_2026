package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v02/handlers"
	"github.com/gin-gonic/gin"
)

func TestVersionEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := NewRouter()

	req := httptest.NewRequest(http.MethodGet, "/version", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var data map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &data); err != nil {
		t.Fatalf("invalid json: %v", err)
	}

	if data["commit"] == "" {
		t.Error("expected non-empty commit")
	}
	if data["build_time"] == "" {
		t.Error("expected non-empty build_time")
	}
}

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

func TestIsProductionEnvironment_AppEnvProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("GIN_MODE", "debug")

	if !isProductionEnvironment() {
		t.Fatal("expected production environment when APP_ENV=production")
	}
}

func TestIsProductionEnvironment_GinReleaseMode(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("GIN_MODE", gin.ReleaseMode)

	if !isProductionEnvironment() {
		t.Fatal("expected production environment when GIN_MODE=release")
	}
}

func TestIsProductionEnvironment_NonProduction(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("GIN_MODE", "debug")

	if isProductionEnvironment() {
		t.Fatal("expected non-production environment")
	}
}
