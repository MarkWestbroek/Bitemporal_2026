package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// GET …/vergelijk stelt basis, tak en main samen en geeft het sidecar-antwoord door,
// aangevuld met de laatste volgnummers. De sidecar is hier een nep-server.
func TestStudioProject_Vergelijk(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()

	var ontvangen map[string]json.RawMessage
	sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/vergelijk" {
			http.NotFound(w, r)
			return
		}
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &ontvangen)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"verschillen":[{"soort":"element","id":"e1","status":"nieuw"}],"telling":{"nieuw":1},"scope":[],"meldingen":[],"renderVersie":"test"}`))
	}))
	defer sidecar.Close()
	t.Setenv("RENDER_SVC_URL", sidecar.URL)

	r := afsplitsenRouter()
	r.GET("/api/studio/projecten/:id/vergelijk", MaakStudioProjectVergelijkHandler())

	inhoud := map[string]any{"formaat": "studio-project", "versie": 2}
	studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-vgl-ouder", "naam": "O", "inhoud": inhoud})
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-vgl-ouder/ops", opsBatch("a", 2, nil))
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-vgl-ouder/afsplitsen", map[string]any{"id": "test-vgl-tak01", "naam": "T", "mapId": "m1"}); rec.Code != http.StatusCreated {
		t.Fatalf("afsplitsen: %d %s", rec.Code, rec.Body.String())
	}
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-vgl-ouder/ops", opsBatch("b", 3, nil)) // main → 5
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-vgl-tak01/ops", opsBatch("c", 1, nil))  // tak → 3

	// Gewoon project → 404.
	if rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/test-vgl-ouder/vergelijk", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("gewoon project: %d", rec.Code)
	}

	rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/test-vgl-tak01/vergelijk", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("vergelijk: %d %s", rec.Code, rec.Body.String())
	}
	var antw struct {
		Verschillen []map[string]any `json:"verschillen"`
		Main        struct {
			LaatsteVolgnummer int64 `json:"laatsteVolgnummer"`
		} `json:"main"`
		Tak struct {
			LaatsteVolgnummer int64 `json:"laatsteVolgnummer"`
		} `json:"tak"`
		RenderVersie string `json:"renderVersie"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &antw)
	if len(antw.Verschillen) != 1 || antw.Main.LaatsteVolgnummer != 5 || antw.Tak.LaatsteVolgnummer != 3 || antw.RenderVersie != "test" {
		t.Fatalf("antwoord: %s", rec.Body.String())
	}

	// Wat de sidecar kreeg: basis 2 ops, tak 3 (2 gekopieerd + 1), main 5, mapId.
	tel := func(sleutel string) int {
		var kant struct {
			Profiel map[string]any    `json:"profiel"`
			Ops     []json.RawMessage `json:"ops"`
		}
		_ = json.Unmarshal(ontvangen[sleutel], &kant)
		if kant.Profiel["formaat"] != "studio-project" {
			t.Fatalf("%s zonder profiel", sleutel)
		}
		return len(kant.Ops)
	}
	if b, tk, m := tel("basis"), tel("tak"), tel("main"); b != 2 || tk != 3 || m != 5 {
		t.Fatalf("ops naar sidecar: basis %d, tak %d, main %d", b, tk, m)
	}
	if string(ontvangen["mapId"]) != `"m1"` {
		t.Fatalf("mapId: %s", ontvangen["mapId"])
	}

	// Sidecar weg → 502 sidecar.
	t.Setenv("RENDER_SVC_URL", "http://127.0.0.1:1")
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-vgl-tak01/vergelijk", nil)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("sidecar weg: %d", rec.Code)
	}
}
