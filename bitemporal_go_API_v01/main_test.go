package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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