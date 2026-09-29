package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// nepRenderSvc speelt de Node-sidecar na.
func nepRenderSvc(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if strings.Contains(string(body), `"fout"`) {
			w.Header().Set("Content-Type", "application/problem+json; charset=utf-8")
			w.WriteHeader(http.StatusUnprocessableEntity)
			_, _ = w.Write([]byte(`{"type":"urn:omnium:render:ongeldig-model","status":422,"element":"X"}`))
			return
		}
		w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
		_, _ = w.Write([]byte(`<svg viewBox="0 0 1 1"/>`))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func renderRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/render/svg", MaakRenderSvgHandler())
	return r
}

func TestRenderSvg_DoorgevenEnETag(t *testing.T) {
	t.Setenv("RENDER_SVC_URL", nepRenderSvc(t).URL)
	r := renderRouter()

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/render/svg", strings.NewReader(`{"taal":"v3"}`)))
	if w.Code != http.StatusOK || !strings.HasPrefix(w.Header().Get("Content-Type"), "image/svg+xml") {
		t.Fatalf("status %d, type %q", w.Code, w.Header().Get("Content-Type"))
	}
	etag := w.Header().Get("ETag")
	if etag == "" {
		t.Fatal("geen ETag")
	}

	req := httptest.NewRequest(http.MethodPost, "/api/render/svg", strings.NewReader(`{"taal":"v3"}`))
	req.Header.Set("If-None-Match", etag)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req)
	if w2.Code != http.StatusNotModified {
		t.Fatalf("If-None-Match: verwacht 304, kreeg %d", w2.Code)
	}
}

func TestRenderSvg_ProbleemWordtDoorgegeven(t *testing.T) {
	t.Setenv("RENDER_SVC_URL", nepRenderSvc(t).URL)
	w := httptest.NewRecorder()
	renderRouter().ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/render/svg", strings.NewReader(`{"fout":1}`)))
	if w.Code != http.StatusUnprocessableEntity || !strings.Contains(w.Body.String(), `"element":"X"`) {
		t.Fatalf("status %d body %s", w.Code, w.Body.String())
	}
}

func TestRenderSvg_SidecarOnbereikbaar(t *testing.T) {
	t.Setenv("RENDER_SVC_URL", "http://127.0.0.1:1")
	w := httptest.NewRecorder()
	renderRouter().ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/render/svg", strings.NewReader(`{}`)))
	if w.Code != http.StatusBadGateway || !strings.HasPrefix(w.Header().Get("Content-Type"), "application/problem+json") {
		t.Fatalf("status %d type %q", w.Code, w.Header().Get("Content-Type"))
	}
}

// nepModelOpslag vervangt laadModelVersie (geen DB nodig) en onthoudt de vraag.
func nepModelOpslag(t *testing.T) *[]string {
	t.Helper()
	var vragen []string
	oud := laadModelVersie
	laadModelVersie = func(c *gin.Context, naam, versie string, asOf *time.Time) (*gevondenModel, error) {
		v := naam + "|" + versie
		if asOf != nil {
			v += "|" + asOf.UTC().Format(time.RFC3339)
		}
		vragen = append(vragen, v)
		if naam != "Kennis" {
			return nil, nil
		}
		return &gevondenModel{Naam: "Kennis", Versie: "1.3", Tijdstip: time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC), JSON: json.RawMessage(`{"entiteiten":[]}`)}, nil
	}
	t.Cleanup(func() { laadModelVersie = oud })
	return &vragen
}

// nepViewsSvc speelt de sidecar na en onthoudt de body van de laatste aanroep.
func nepViewsSvc(t *testing.T, laatste *map[string]any) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, laatste)
		if r.URL.Path == "/views" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"diagrammen":["Overzicht"],"domeinen":["kennis"]}`))
			return
		}
		w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
		_, _ = w.Write([]byte(`<svg viewBox="0 0 1 1"/>`))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func modelRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/models/:naam/diagram.svg", MaakModelDiagramSvgHandler())
	r.GET("/api/models/:naam/views.json", MaakModelViewsHandler())
	return r
}

func TestModelDiagram_NaamVersieAsOfEnParameters(t *testing.T) {
	vragen := nepModelOpslag(t)
	var laatste map[string]any
	t.Setenv("RENDER_SVC_URL", nepViewsSvc(t, &laatste).URL)

	w := httptest.NewRecorder()
	modelRouter().ServeHTTP(w, httptest.NewRequest(http.MethodGet,
		"/api/models/Kennis/diagram.svg?versie=1.3&asOf=2026-09-30T00:00:00Z&domein=kennis&theme=dark", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if (*vragen)[0] != "Kennis|1.3|2026-09-30T00:00:00Z" {
		t.Fatalf("vraag aan opslag: %q", (*vragen)[0])
	}
	if laatste["domein"] != "kennis" || laatste["theme"] != "dark" || laatste["taal"] != "v3" || laatste["versie"] != nil {
		t.Fatalf("body naar sidecar: %v", laatste)
	}
	if w.Header().Get("ETag") == "" || w.Header().Get("Last-Modified") != "Tue, 01 Sep 2026 12:00:00 GMT" {
		t.Fatalf("headers: %v", w.Header())
	}
}

func TestModelDiagram_Fouten(t *testing.T) {
	nepModelOpslag(t)
	var laatste map[string]any
	t.Setenv("RENDER_SVC_URL", nepViewsSvc(t, &laatste).URL)
	for pad, status := range map[string]int{
		"/api/models/Onbekend/diagram.svg":             http.StatusNotFound,
		"/api/models/Kennis/diagram.svg?kleur=rood":    http.StatusBadRequest,
		"/api/models/Kennis/diagram.svg?asOf=gisteren": http.StatusBadRequest,
	} {
		w := httptest.NewRecorder()
		modelRouter().ServeHTTP(w, httptest.NewRequest(http.MethodGet, pad, nil))
		if w.Code != status || !strings.HasPrefix(w.Header().Get("Content-Type"), "application/problem+json") {
			t.Errorf("%s: status %d type %q", pad, w.Code, w.Header().Get("Content-Type"))
		}
	}
}

func TestModelViews(t *testing.T) {
	nepModelOpslag(t)
	var laatste map[string]any
	t.Setenv("RENDER_SVC_URL", nepViewsSvc(t, &laatste).URL)
	w := httptest.NewRecorder()
	modelRouter().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/models/Kennis/views.json", nil))
	var uit map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &uit)
	if w.Code != http.StatusOK || uit["versie"] != "1.3" || uit["naam"] != "Kennis" || uit["domeinen"] == nil {
		t.Fatalf("status %d body %s", w.Code, w.Body.String())
	}
}
