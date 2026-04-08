package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
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

func TestSchemaModelCodeEndpoint_ReturnsCodeModelMetadataAndDatatypes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("SCHEMA_CODE_MODEL_NAAM", "Registermodel uit code")
	t.Setenv("SCHEMA_CODE_MODEL_VERSIE", "v06-code-2026-03-22")
	t.Setenv("SCHEMA_CODE_OPMERKING", "Actuele code-export voor editor en codegen")
	t.Setenv("SCHEMA_CODE_GO_MODULE", "github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06")

	r := NewRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/schema/model/code", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var data map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &data); err != nil {
		t.Fatalf("invalid json: %v", err)
	}

	if data["bron"] != "code" {
		t.Fatalf("expected bron=code, got %#v", data["bron"])
	}
	if data["model_bron"] != "code" {
		t.Fatalf("expected model_bron=code, got %#v", data["model_bron"])
	}
	if data["model_naam"] != "Registermodel uit code" {
		t.Fatalf("expected env-backed model_naam, got %#v", data["model_naam"])
	}
	if data["model_versie"] != "v06-code-2026-03-22" {
		t.Fatalf("expected env-backed model_versie, got %#v", data["model_versie"])
	}
	if data["opmerking"] != "Actuele code-export voor editor en codegen" {
		t.Fatalf("expected env-backed opmerking, got %#v", data["opmerking"])
	}

	modelPayload, ok := data["model"].(map[string]any)
	if !ok {
		t.Fatalf("expected model object, got %#v", data["model"])
	}
	if modelPayload["naam"] != "Registermodel uit code" {
		t.Fatalf("expected model.naam from env, got %#v", modelPayload["naam"])
	}
	if modelPayload["versie"] != "v06-code-2026-03-22" {
		t.Fatalf("expected model.versie from env, got %#v", modelPayload["versie"])
	}

	datatypes, ok := modelPayload["datatypes"].([]any)
	if !ok || len(datatypes) < 2 {
		t.Fatalf("expected at least 2 datatypes in code model, got %#v", modelPayload["datatypes"])
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

func TestRegistratieEndpoint_InvalidJSON_ReturnsBadRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := NewRouter()
	req := httptest.NewRequest(http.MethodPost, "/registratie/", strings.NewReader(`{"registratie":`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}
