package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestLeesSamenvoegAntwoord_EnOpsRijen(t *testing.T) {
	antw := map[string]json.RawMessage{
		"conflicten": json.RawMessage(`[]`),
		"buitenMap":  json.RawMessage(`[]`),
		"opsMain":    json.RawMessage(`[{"store":"model:uml","op":"patchElementen","args":[{"zet":{},"wis":["x"]}]}]`),
		"opsTak":     json.RawMessage(`[]`),
		"basis":      json.RawMessage(`{"formaat":"studio-project"}`),
	}
	sv, err := leesSamenvoegAntwoord(antw)
	if err != nil || len(sv.OpsMain) != 1 || len(sv.OpsTak) != 0 || string(sv.Basis) != `{"formaat":"studio-project"}` {
		t.Fatalf("lezen: %v %+v", err, sv)
	}
	rijen := opsRijen("p1", sv.OpsMain, 7, "mark", time.Unix(0, 0))
	if len(rijen) != 1 || rijen[0].Volgnummer != 8 || rijen[0].ClientID != samenvoegClientID || rijen[0].Actor != "mark" || rijen[0].Store != "model:uml" {
		t.Fatalf("rijen: %+v", rijen)
	}
	if b := bereik(nil, 7); b["aantal"] != 0 || b["laatsteVolgnummer"] != int64(7) {
		t.Fatalf("leeg bereik: %v", b)
	}
}

// POST …/samenvoegen schrijft opsMain op de ouder en opsTak op de branch, en vervangt de basis.
// De sidecar is een nep-server.
func TestStudioProject_Samenvoegen(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()

	antwoord := `{"conflicten":[],"buitenMap":[],"telling":{"nieuw":1},
		"opsMain":[{"store":"model:uml","op":"patchElementen","args":[{"zet":{"t1":{"id":"t1"}},"wis":[]}]}],
		"opsTak":[{"store":"model:uml","op":"patchElementen","args":[{"zet":{"m1":{"id":"m1"}},"wis":[]}]},{"store":"structuur","op":"patchStructuur","args":[{}]}],
		"basis":{"formaat":"studio-project","versie":3,"samengevoegd":true}}`
	sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/samenvoegen" {
			http.NotFound(w, r)
			return
		}
		_, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(antwoord))
	}))
	defer sidecar.Close()
	t.Setenv("RENDER_SVC_URL", sidecar.URL)

	r := afsplitsenRouter()
	r.POST("/api/studio/projecten/:id/samenvoegen", MaakStudioProjectSamenvoegenHandler())

	inhoud := map[string]any{"formaat": "studio-project", "versie": 3}
	studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-smv-ouder", "naam": "O", "inhoud": inhoud})
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-smv-ouder/ops", opsBatch("a", 2, nil))
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-smv-ouder/afsplitsen", map[string]any{"id": "test-smv-tak01", "naam": "T", "mapId": "m1"}); rec.Code != http.StatusCreated {
		t.Fatalf("afsplitsen: %d %s", rec.Code, rec.Body.String())
	}
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-smv-ouder/ops", opsBatch("b", 1, nil)) // main → 3
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-smv-tak01/ops", opsBatch("c", 2, nil)) // tak → 4

	// Gewoon project → 404.
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-smv-ouder/samenvoegen", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("gewoon project: %d", rec.Code)
	}

	rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-smv-tak01/samenvoegen", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("samenvoegen: %d %s", rec.Code, rec.Body.String())
	}
	var antw struct {
		Main struct {
			Ops struct {
				Aantal            int   `json:"aantal"`
				LaatsteVolgnummer int64 `json:"laatsteVolgnummer"`
			} `json:"ops"`
		} `json:"main"`
		Tak struct {
			Ops struct {
				Aantal            int   `json:"aantal"`
				LaatsteVolgnummer int64 `json:"laatsteVolgnummer"`
			} `json:"ops"`
		} `json:"tak"`
		BasisVolgnummer int64 `json:"basisVolgnummer"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &antw)
	if antw.Main.Ops.Aantal != 1 || antw.Main.Ops.LaatsteVolgnummer != 4 || antw.Tak.Ops.Aantal != 2 || antw.Tak.Ops.LaatsteVolgnummer != 6 || antw.BasisVolgnummer != 4 {
		t.Fatalf("antwoord: %s", rec.Body.String())
	}

	ctx := context.Background()
	var ops []model.StudioProjectOp
	if err := db.NewSelect().Model(&ops).Where("project_id = ? AND volgnummer = 4", "test-smv-ouder").Scan(ctx); err != nil || len(ops) != 1 || ops[0].ClientID != samenvoegClientID {
		t.Fatalf("op op de ouder: %v %+v", err, ops)
	}
	basis := new(model.StudioProjectBasis)
	if err := db.NewSelect().Model(basis).Where("project_id = ?", "test-smv-tak01").Scan(ctx); err != nil {
		t.Fatalf("basis: %v", err)
	}
	var b map[string]any
	_ = json.Unmarshal(basis.Inhoud, &b)
	if b["samengevoegd"] != true || basis.BasisVolgnummer != 4 || basis.TotVolgnummer != 4 || string(basis.Ops) != "[]" {
		t.Fatalf("nieuwe basis: %+v %s", basis, basis.Inhoud)
	}
	tak := new(model.StudioProject)
	if err := db.NewSelect().Model(tak).Where("id = ?", "test-smv-tak01").Scan(ctx); err != nil || tak.BasisVolgnummer != 4 {
		t.Fatalf("herkomst branch: %v %d", err, tak.BasisVolgnummer)
	}

	// Conflict → 409 "conflicten", en er wordt niets geschreven.
	antwoord = `{"conflicten":[{"soort":"element","profielId":"uml","id":"E"}],"buitenMap":[],"opsMain":[],"opsTak":[],"basis":null}`
	rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/test-smv-tak01/samenvoegen", nil)
	if rec.Code != http.StatusConflict || !json.Valid(rec.Body.Bytes()) {
		t.Fatalf("conflict: %d %s", rec.Code, rec.Body.String())
	}
	var fout struct {
		Reden string `json:"reden"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &fout)
	if fout.Reden != "conflicten" {
		t.Fatalf("reden: %s", rec.Body.String())
	}

	// Buiten de map → 409 zonder bevestiging, 200 met.
	antwoord = `{"conflicten":[],"buitenMap":[{"id":"x"}],"opsMain":[],"opsTak":[],"basis":{"formaat":"studio-project"}}`
	rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/test-smv-tak01/samenvoegen", nil)
	_ = json.Unmarshal(rec.Body.Bytes(), &fout)
	if rec.Code != http.StatusConflict || fout.Reden != "buiten_map" {
		t.Fatalf("buiten de map: %d %s", rec.Code, rec.Body.String())
	}
	rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/test-smv-tak01/samenvoegen", map[string]any{"ookBuitenMap": true})
	if rec.Code != http.StatusOK {
		t.Fatalf("buiten de map bevestigd: %d %s", rec.Code, rec.Body.String())
	}
}
