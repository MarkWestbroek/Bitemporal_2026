package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func valideerPost(t *testing.T, body string) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/valideer", MaakValideerHandler())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/valideer", strings.NewReader(body)))
	var uit map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &uit)
	return w.Code, uit
}

func TestValideerAPIEen(t *testing.T) {
	code, uit := valideerPost(t, `{"datatype":"BSN","waarde":"123456789"}`)
	if code != 200 || uit["geldig"] != false || uit["bekend"] != true {
		t.Fatalf("BSN 123456789: %d %v", code, uit)
	}
	code, uit = valideerPost(t, `{"datatype":"NLPostcode","waarde":"1234 ab"}`)
	if code != 200 || uit["geldig"] != true || uit["genormaliseerd"] != "1234 AB" {
		t.Fatalf("postcode: %d %v", code, uit)
	}
	code, uit = valideerPost(t, `{"datatype":"BestaatNiet","waarde":"x"}`)
	if code != 200 || uit["bekend"] != false || uit["geldig"] != true {
		t.Fatalf("onbekend datatype: %d %v", code, uit)
	}
}

func TestValideerAPIBatch(t *testing.T) {
	code, uit := valideerPost(t, `{"items":[{"datatype":"IBAN","waarde":"NL91ABNA0417164300","veld":"iban"},{"datatype":"BSN","waarde":"12345","veld":"bsn"}]}`)
	items, _ := uit["items"].([]any)
	if code != 200 || uit["geldig"] != false || len(items) != 2 {
		t.Fatalf("batch: %d %v", code, uit)
	}
	if items[0].(map[string]any)["geldig"] != true || items[1].(map[string]any)["veld"] != "bsn" {
		t.Fatalf("items: %v", items)
	}
	if code, _ := valideerPost(t, `{}`); code != http.StatusBadRequest {
		t.Fatalf("zonder datatype: %d", code)
	}
}
