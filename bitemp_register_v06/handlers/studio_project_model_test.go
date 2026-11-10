package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// GET …/model/:profiel stuurt het profiel en alleen zijn eigen ops naar de sidecar en geeft het
// nagespeelde profiel terug met het laatste volgnummer van het hele project.
func TestStudioProject_Model(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()

	var ontvangen struct {
		ProfielID string            `json:"profielId"`
		Profiel   map[string]any    `json:"profiel"`
		Ops       []json.RawMessage `json:"ops"`
	}
	sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/materialiseer" {
			http.NotFound(w, r)
			return
		}
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &ontvangen)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"profiel":{"elements":[{"id":"e1"}],"diagrams":[]},"nagespeeld":2,"overgeslagen":0,"meldingen":[],"renderVersie":"test"}`))
	}))
	defer sidecar.Close()
	t.Setenv("RENDER_SVC_URL", sidecar.URL)

	r := afsplitsenRouter()
	r.GET("/api/studio/projecten/:id/model/:profiel", MaakStudioProjectModelHandler())
	inhoud := map[string]any{"formaat": "studio-project", "versie": 2,
		"profielen": map[string]any{"formulierdiagram": map[string]any{"elements": []any{}, "diagrams": []any{}}}}
	studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-model-0001", "naam": "M", "inhoud": inhoud})
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-model-0001/ops", opsBatch("a", 2, nil)) // store model:uml
	batch := map[string]any{"clientId": "b", "ops": []any{
		map[string]any{"store": "model:formulierdiagram", "op": "addElement", "args": []any{map[string]any{"id": "e1"}}},
		map[string]any{"store": "structuur", "op": "zetPlaatsing", "args": []any{"x"}},
		map[string]any{"store": "model:formulierdiagram", "op": "updateElement", "args": []any{"e1", map[string]any{}}},
	}}
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-model-0001/ops", batch) // 3..5

	rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/test-model-0001/model/formulierdiagram", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("model: %d %s", rec.Code, rec.Body.String())
	}
	var antw struct {
		Elements          []map[string]any `json:"elements"`
		LaatsteVolgnummer int64            `json:"laatsteVolgnummer"`
		Nagespeeld        int              `json:"nagespeeld"`
		ProfielID         string           `json:"profielId"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &antw)
	if len(antw.Elements) != 1 || antw.LaatsteVolgnummer != 5 || antw.Nagespeeld != 2 || antw.ProfielID != "formulierdiagram" {
		t.Fatalf("antwoord: %s", rec.Body.String())
	}
	if ontvangen.ProfielID != "formulierdiagram" || len(ontvangen.Ops) != 2 || ontvangen.Profiel["elements"] == nil {
		t.Fatalf("naar de sidecar: %+v", ontvangen)
	}

	// Onbekend profiel → 404 geen_profiel; ongeldig id → 400; sidecar te oud → 502.
	if rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/test-model-0001/model/bestaatniet", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("onbekend profiel: %d", rec.Code)
	}
	if rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/test-model-0001/model/a%20b", nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("ongeldig profiel: %d", rec.Code)
	}
	oudeSidecar := httptest.NewServer(http.NotFoundHandler())
	defer oudeSidecar.Close()
	t.Setenv("RENDER_SVC_URL", oudeSidecar.URL)
	if rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/test-model-0001/model/formulierdiagram", nil); rec.Code != http.StatusBadGateway {
		t.Fatalf("oude sidecar: %d", rec.Code)
	}
}

// Afsplitsen met een mapId waarvoor al een branch bestaat → 409 branch_bestaat met het id.
func TestStudioProject_AfsplitsenBranchBestaat(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	r := afsplitsenRouter()
	inhoud := map[string]any{"formaat": "studio-project", "versie": 2}
	studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-dubbel-ouder", "naam": "O", "inhoud": inhoud})
	pad := "/api/studio/projecten/test-dubbel-ouder/afsplitsen"
	if rec := studioDoe(r, http.MethodPost, pad, map[string]any{"id": "test-dubbel-br01", "naam": "A", "mapId": "m1"}); rec.Code != http.StatusCreated {
		t.Fatalf("eerste: %d %s", rec.Code, rec.Body.String())
	}
	rec := studioDoe(r, http.MethodPost, pad, map[string]any{"naam": "B", "mapId": "m1"})
	var fout struct {
		Reden     string `json:"reden"`
		ProjectID string `json:"projectId"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &fout)
	if rec.Code != http.StatusConflict || fout.Reden != "branch_bestaat" || fout.ProjectID != "test-dubbel-br01" {
		t.Fatalf("tweede: %d %s", rec.Code, rec.Body.String())
	}
	// Andere map en zonder map: wel toegestaan.
	if rec := studioDoe(r, http.MethodPost, pad, map[string]any{"id": "test-dubbel-br02", "naam": "C", "mapId": "m2"}); rec.Code != http.StatusCreated {
		t.Fatalf("andere map: %d", rec.Code)
	}
	for i, id := range []string{"test-dubbel-br03", "test-dubbel-br04"} {
		if rec := studioDoe(r, http.MethodPost, pad, map[string]any{"id": id, "naam": "D"}); rec.Code != http.StatusCreated {
			t.Fatalf("zonder map %d: %d", i, rec.Code)
		}
	}
	// Na archiveren mag er weer een.
	if _, err := db.ExecContext(t.Context(), `UPDATE studio_projecten SET gearchiveerd = true WHERE id = 'test-dubbel-br01'`); err != nil {
		t.Fatal(err)
	}
	if rec := studioDoe(r, http.MethodPost, pad, map[string]any{"id": "test-dubbel-br05", "naam": "E", "mapId": "m1"}); rec.Code != http.StatusCreated {
		t.Fatalf("na archiveren: %d %s", rec.Code, rec.Body.String())
	}
}
