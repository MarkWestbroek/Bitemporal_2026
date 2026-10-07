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
	t.Cleanup(func() {
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
