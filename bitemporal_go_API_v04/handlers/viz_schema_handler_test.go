package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

type vizSchemaResponseTest struct {
	Versie string `json:"versie"`
	Types  []struct {
		Typenaam string `json:"typenaam"`
	} `json:"types"`
}

func TestMaakVizSchemaHandler_GeeftSchemaTerug(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/viz/schema", MaakVizSchemaHandler())

	req := httptest.NewRequest(http.MethodGet, "/viz/schema", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var body vizSchemaResponseTest
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode json response: %v", err)
	}

	if body.Versie != "v1" {
		t.Fatalf("expected versie v1, got %q", body.Versie)
	}

	if len(body.Types) == 0 {
		t.Fatal("expected at least one type in schema")
	}

	foundA := false
	for _, item := range body.Types {
		if item.Typenaam == "A" {
			foundA = true
			break
		}
	}

	if !foundA {
		t.Fatal("expected type A in schema response")
	}
}
