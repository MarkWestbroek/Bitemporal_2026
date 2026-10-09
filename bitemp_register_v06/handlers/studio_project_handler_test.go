package handlers

// Tests voor de Studio-projecten (plan 2026-10-07 Projectsync, stap 1).
//
// De validatie is zuiver en draait altijd. De handler-roundtrip (aanmaken,
// opslaan met versiecontrole, 409 bij conflict, verwijderen) draait alleen
// tegen een echte PostgreSQL, net als dynql/filter_pg_test.go:
//
//	STUDIO_TEST_PG_DSN='postgres://postgres:filtertest@127.0.0.1:55439/postgres?sslmode=disable' \
//	  go test ./handlers -run TestStudioProject -v

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func TestValideerStudioProjectInvoer(t *testing.T) {
	goed := json.RawMessage(`{"formaat":"studio-project","versie":2}`)
	gevallen := []struct {
		naam          string
		inhoud        json.RawMessage
		naamVerplicht bool
		wilFout       bool
	}{
		{"Mijn project", goed, true, false},
		{"", goed, true, true},                                            // naam verplicht bij POST
		{"", goed, false, false},                                          // naam optioneel bij PUT
		{"x", nil, true, true},                                            // inhoud ontbreekt
		{"x", json.RawMessage(`{"formaat":"iets-anders"}`), true, true},   // verkeerd formaat
		{"x", json.RawMessage(`[1,2]`), true, true},                       // geen object
		{"x", json.RawMessage(`{"formaat":"studio-project"`), true, true}, // kapotte JSON
	}
	for _, g := range gevallen {
		msg := valideerStudioProjectInvoer(g.naam, g.inhoud, g.naamVerplicht)
		if (msg != "") != g.wilFout {
			t.Errorf("naam=%q inhoud=%s verplicht=%v: fout=%q, verwacht fout=%v", g.naam, g.inhoud, g.naamVerplicht, msg, g.wilFout)
		}
	}
}

func studioTestDB(t *testing.T) *bun.DB {
	t.Helper()
	dsn := os.Getenv("STUDIO_TEST_PG_DSN")
	if dsn == "" {
		t.Skip("STUDIO_TEST_PG_DSN niet gezet; integratietest overgeslagen")
	}
	db := bun.NewDB(sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn))), pgdialect.New())
	ctx := context.Background()
	if _, err := db.NewCreateTable().Model((*model.StudioProject)(nil)).IfNotExists().Exec(ctx); err != nil {
		t.Fatalf("tabel aanmaken: %v", err)
	}
	if _, err := db.ExecContext(ctx, `ALTER TABLE studio_projecten ADD COLUMN IF NOT EXISTS tot_volgnummer BIGINT NOT NULL DEFAULT 0`); err != nil {
		t.Fatalf("kolom toevoegen: %v", err)
	}
	if _, err := db.NewCreateTable().Model((*model.StudioProjectOp)(nil)).IfNotExists().Exec(ctx); err != nil {
		t.Fatalf("ops-tabel aanmaken: %v", err)
	}
	if _, err := db.NewCreateTable().Model((*model.StudioWerkruimte)(nil)).IfNotExists().Exec(ctx); err != nil {
		t.Fatalf("werkruimte-tabel aanmaken: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.NewDelete().Model((*model.StudioWerkruimte)(nil)).Where("project_id LIKE 'test-%'").Exec(ctx)
		_, _ = db.NewDelete().Model((*model.StudioProjectOp)(nil)).Where("project_id LIKE 'test-%'").Exec(ctx)
		_, _ = db.NewDelete().Model((*model.StudioProject)(nil)).Where("id LIKE 'test-%'").Exec(ctx)
		_ = db.Close()
	})
	return db
}

func studioDoe(r *gin.Engine, methode, pad string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(methode, pad, &buf)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func TestStudioProject_Roundtrip(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/studio/projecten", MaakStudioProjectenLijstHandler())
	r.GET("/api/studio/projecten/:id", MaakStudioProjectOphalenHandler())
	r.POST("/api/studio/projecten", MaakStudioProjectAanmakenHandler())
	r.PUT("/api/studio/projecten/:id", MaakStudioProjectOpslaanHandler())
	r.DELETE("/api/studio/projecten/:id", MaakStudioProjectVerwijderenHandler())

	inhoud := map[string]any{"formaat": "studio-project", "versie": 2, "profielen": map[string]any{}}

	// Aanmaken
	rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-roundtrip", "naam": "Roundtrip", "inhoud": inhoud})
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST: %d %s", rec.Code, rec.Body.String())
	}
	var meta StudioProjectMeta
	_ = json.Unmarshal(rec.Body.Bytes(), &meta)
	if meta.Versie != 1 || meta.Naam != "Roundtrip" {
		t.Fatalf("POST meta: %+v", meta)
	}

	// Nogmaals aanmaken met hetzelfde id → 409
	rec = studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-roundtrip", "naam": "Dubbel", "inhoud": inhoud})
	if rec.Code != http.StatusConflict {
		t.Fatalf("POST dubbel: %d %s", rec.Code, rec.Body.String())
	}

	// Opslaan met de juiste versie → versie 2
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/test-roundtrip", map[string]any{"inhoud": inhoud, "versie": 1})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT: %d %s", rec.Code, rec.Body.String())
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &meta)
	if meta.Versie != 2 {
		t.Fatalf("PUT versie: %+v", meta)
	}

	// Opslaan met een verouderde versie → 409 met de servermeta
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/test-roundtrip", map[string]any{"inhoud": inhoud, "versie": 1})
	if rec.Code != http.StatusConflict {
		t.Fatalf("PUT verouderd: %d %s", rec.Code, rec.Body.String())
	}
	var conflict struct {
		Server StudioProjectMeta `json:"server"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &conflict)
	if conflict.Server.Versie != 2 {
		t.Fatalf("409 servermeta: %+v", conflict.Server)
	}

	// Lijst bevat het project zonder inhoud; ophalen geeft de inhoud
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten", nil)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(`"test-roundtrip"`)) || bytes.Contains(rec.Body.Bytes(), []byte(`"inhoud"`)) {
		t.Fatalf("GET lijst: %d %s", rec.Code, rec.Body.String())
	}
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-roundtrip", nil)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(`"studio-project"`)) {
		t.Fatalf("GET één: %d %s", rec.Code, rec.Body.String())
	}

	// Verwijderen, daarna 404
	rec = studioDoe(r, http.MethodDelete, "/api/studio/projecten/test-roundtrip", nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE: %d %s", rec.Code, rec.Body.String())
	}
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-roundtrip", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("GET na DELETE: %d", rec.Code)
	}
}

func TestValideerStudioOpsBatch(t *testing.T) {
	goed := &studioOpsBatchInvoer{ClientID: "tab1", Ops: []studioOpInvoer{{LokaalNr: 1, Store: "model:uml", Op: "addElement", Args: json.RawMessage(`[{"id":"A"}]`)}}}
	if msg := valideerStudioOpsBatch(goed); msg != "" {
		t.Fatalf("goede batch afgekeurd: %s", msg)
	}
	fout := []*studioOpsBatchInvoer{
		nil,
		{Ops: nil},
		{Ops: []studioOpInvoer{{Store: "", Op: "x", Args: json.RawMessage(`[]`)}}},
		{Ops: []studioOpInvoer{{Store: "model:uml", Op: "", Args: json.RawMessage(`[]`)}}},
		{Ops: []studioOpInvoer{{Store: "model:uml", Op: "x"}}},
		{Ops: []studioOpInvoer{{Store: "model:uml", Op: "x", Args: json.RawMessage(`{"a":1}`)}}},
	}
	for i, b := range fout {
		if msg := valideerStudioOpsBatch(b); msg == "" {
			t.Errorf("geval %d: verwacht een fout", i)
		}
	}
}

func TestStudioProjectOps_Roundtrip(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/studio/projecten", MaakStudioProjectAanmakenHandler())
	r.GET("/api/studio/projecten/:id", MaakStudioProjectOphalenHandler())
	r.PUT("/api/studio/projecten/:id", MaakStudioProjectOpslaanHandler())
	r.DELETE("/api/studio/projecten/:id", MaakStudioProjectVerwijderenHandler())
	r.POST("/api/studio/projecten/:id/ops", MaakStudioProjectOpsToevoegenHandler())
	r.GET("/api/studio/projecten/:id/ops", MaakStudioProjectOpsLijstHandler())

	inhoud := map[string]any{"formaat": "studio-project", "versie": 2}
	rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-ops-0001", "naam": "Ops", "inhoud": inhoud})
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST project: %d %s", rec.Code, rec.Body.String())
	}

	// Onbekend project → 404
	rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/test-ops-nope/ops", map[string]any{"clientId": "a", "ops": []any{map[string]any{"store": "s", "op": "o", "args": []any{}}}})
	if rec.Code != http.StatusNotFound {
		t.Fatalf("POST ops onbekend: %d", rec.Code)
	}

	// Batch van 2 → volgnummers 1..2; tweede batch van client b → 3..4
	batch := func(client string, n int) map[string]any {
		ops := make([]any, 0, n)
		for i := 0; i < n; i++ {
			ops = append(ops, map[string]any{"lokaalNr": i + 1, "store": "model:uml", "op": "addElement", "args": []any{map[string]any{"id": client + "-" + string(rune('A'+i))}}})
		}
		return map[string]any{"clientId": client, "ops": ops}
	}
	rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/test-ops-0001/ops", batch("a", 2))
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST ops: %d %s", rec.Code, rec.Body.String())
	}
	var uit struct {
		Van, Tot, LaatsteLokaalNr int64
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &uit)
	if uit.Van != 1 || uit.Tot != 2 || uit.LaatsteLokaalNr != 2 {
		t.Fatalf("eerste batch: %+v", uit)
	}
	rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/test-ops-0001/ops", batch("b", 2))
	_ = json.Unmarshal(rec.Body.Bytes(), &uit)
	if uit.Van != 3 || uit.Tot != 4 {
		t.Fatalf("tweede batch: %+v", uit)
	}

	// Lezen vanaf 2 → 3 en 4, in volgorde, met clientId
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-ops-0001/ops?vanaf=2", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET ops: %d %s", rec.Code, rec.Body.String())
	}
	var lijst struct {
		Ops     []StudioOpUit `json:"ops"`
		Laatste int64         `json:"laatste"`
		Meer    bool          `json:"meer"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &lijst)
	if len(lijst.Ops) != 2 || lijst.Ops[0].Volgnummer != 3 || lijst.Ops[1].ClientID != "b" || lijst.Laatste != 4 || lijst.Meer {
		t.Fatalf("GET ops vanaf 2: %s", rec.Body.String())
	}
	// Limiet 1 → meer=true
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-ops-0001/ops?vanaf=0&limiet=1", nil)
	_ = json.Unmarshal(rec.Body.Bytes(), &lijst)
	if len(lijst.Ops) != 1 || !lijst.Meer || lijst.Laatste != 1 {
		t.Fatalf("GET ops limiet: %s", rec.Body.String())
	}

	// Snapshot-grens via PUT (compactie: operaties t/m 3 weg, 4 blijft); project-GET toont
	// tot_volgnummer en laatste_volgnummer. Een grens voorbij het log wordt afgekapt.
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/test-ops-0001", map[string]any{"inhoud": inhoud, "versie": 1, "tot_volgnummer": 3})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT snapshot: %d %s", rec.Code, rec.Body.String())
	}
	nOps, _ := db.NewSelect().Model((*model.StudioProjectOp)(nil)).Where("project_id = 'test-ops-0001'").Count(context.Background())
	if nOps != 1 {
		t.Fatalf("compactie: %d operaties over, verwacht 1", nOps)
	}
	// Te oud volgnummer → snapshot nodig; op de grens → gewoon de rest.
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-ops-0001/ops?vanaf=2", nil)
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"snapshotNodig":true`)) || !bytes.Contains(rec.Body.Bytes(), []byte(`"totVolgnummer":3`)) {
		t.Fatalf("GET ops vóór de grens: %s", rec.Body.String())
	}
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-ops-0001/ops?vanaf=3", nil)
	_ = json.Unmarshal(rec.Body.Bytes(), &lijst)
	if len(lijst.Ops) != 1 || lijst.Ops[0].Volgnummer != 4 {
		t.Fatalf("GET ops op de grens: %s", rec.Body.String())
	}
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/test-ops-0001", map[string]any{"inhoud": inhoud, "versie": 2, "tot_volgnummer": 99})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT snapshot 2: %d %s", rec.Code, rec.Body.String())
	}
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-ops-0001", nil)
	var proj struct {
		TotVolgnummer     int64 `json:"tot_volgnummer"`
		LaatsteVolgnummer int64 `json:"laatste_volgnummer"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &proj)
	if proj.TotVolgnummer != 4 || proj.LaatsteVolgnummer != 4 {
		t.Fatalf("GET project na snapshot (grens afgekapt op het log): %s", rec.Body.String())
	}

	// Verwijderen ruimt ook het log op
	rec = studioDoe(r, http.MethodDelete, "/api/studio/projecten/test-ops-0001", nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE: %d %s", rec.Code, rec.Body.String())
	}
	n, _ := db.NewSelect().Model((*model.StudioProjectOp)(nil)).Where("project_id = 'test-ops-0001'").Count(context.Background())
	if n != 0 {
		t.Fatalf("operatielog niet opgeruimd: %d rijen", n)
	}
}

func TestStudioPollMs(t *testing.T) {
	gevallen := map[string]int{"": 5000, "abc": 5000, "0": 5000, "100": 500, "2000": 2000, "999999": 120000}
	for in, wil := range gevallen {
		t.Setenv("STUDIO_SYNC_POLL_MS", in)
		if uit := StudioPollMs(); uit != wil {
			t.Errorf("STUDIO_SYNC_POLL_MS=%q: %d, verwacht %d", in, uit, wil)
		}
	}
}

func TestStudioWerkruimte_LaatsteSchrijverWint(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/studio/projecten", MaakStudioProjectAanmakenHandler())
	r.GET("/api/studio/projecten/:id/werkruimte", MaakStudioWerkruimteOphalenHandler())
	r.PUT("/api/studio/projecten/:id/werkruimte", MaakStudioWerkruimteOpslaanHandler())

	const pid = "test-wr-00001"
	rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": pid, "naam": "WR", "inhoud": map[string]any{"formaat": "studio-project", "versie": 3}})
	if rec.Code != http.StatusCreated {
		t.Fatalf("project: %d %s", rec.Code, rec.Body.String())
	}
	// Nog geen werkruimte → 404
	if rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/"+pid+"/werkruimte", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("GET leeg: %d", rec.Code)
	}
	// Onbekend project → 404 bij PUT
	if rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/test-wr-nope/werkruimte", map[string]any{"inhoud": map[string]any{"tabs": []any{}}}); rec.Code != http.StatusNotFound {
		t.Fatalf("PUT onbekend: %d %s", rec.Code, rec.Body.String())
	}
	// Opslaan met tijd t2, daarna een oudere t1 → genegeerd, nieuwere t3 → overgenomen
	t1 := "2026-10-08T10:00:00Z"
	t2 := "2026-10-08T10:05:00Z"
	t3 := "2026-10-08T10:10:00Z"
	put := func(tabs string, tijd string) {
		rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+pid+"/werkruimte", map[string]any{"inhoud": map[string]any{"tabs": []any{tabs}}, "bijgewerkt": tijd})
		if rec.Code != http.StatusOK {
			t.Fatalf("PUT %s: %d %s", tabs, rec.Code, rec.Body.String())
		}
	}
	put("t2", t2)
	put("t1", t1)
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/"+pid+"/werkruimte", nil)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(`"t2"`)) {
		t.Fatalf("oudere schrijver mocht niet winnen: %d %s", rec.Code, rec.Body.String())
	}
	put("t3", t3)
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/"+pid+"/werkruimte", nil)
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"t3"`)) {
		t.Fatalf("nieuwere schrijver moest winnen: %s", rec.Body.String())
	}
}
