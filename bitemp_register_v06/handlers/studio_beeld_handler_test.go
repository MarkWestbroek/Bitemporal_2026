package handlers

// Tests voor de gedeelde plaatjes (handlers/studio_beeld_handler.go). De validatie draait altijd;
// de roundtrip alleen tegen PostgreSQL (STUDIO_TEST_PG_DSN, zie studio_project_handler_test.go).

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/filestore"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// Twee kleine geldige PNG's met een verschillende inhoud.
const (
	testPNG1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
	testPNG2 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
)

func TestLeesPNG(t *testing.T) {
	if _, fout := leesPNG(testPNG1); fout != "" {
		t.Fatalf("kale base64: %s", fout)
	}
	if _, fout := leesPNG("data:image/png;base64," + testPNG1); fout != "" {
		t.Fatalf("data-URL: %s", fout)
	}
	if _, fout := leesPNG("data:image/svg+xml;base64," + testPNG1); fout == "" {
		t.Fatal("svg-data-URL moet geweigerd worden")
	}
	if _, fout := leesPNG(base64.StdEncoding.EncodeToString([]byte("<svg/>"))); fout == "" {
		t.Fatal("geen PNG moet geweigerd worden")
	}
	if _, fout := leesPNG("!!!"); fout == "" {
		t.Fatal("ongeldige base64 moet geweigerd worden")
	}
}

func TestValideerBeeldInvoer(t *testing.T) {
	goed := beeldInvoer{ProfielID: "usecase05", DiagramID: "d_1"}
	if fout := valideerBeeldInvoer(&goed); fout != "" || goed.Soort != beeldSoortMoment {
		t.Fatalf("standaard momentopname: %q %q", fout, goed.Soort)
	}
	for naam, in := range map[string]beeldInvoer{
		"soort":     {ProfielID: "p", DiagramID: "d", Soort: "live"},
		"diagram":   {ProfielID: "p", DiagramID: "d/../x"},
		"profiel":   {DiagramID: "d"},
		"maat":      {ProfielID: "p", DiagramID: "d", Breedte: -1},
		"bijwerken": {ProfielID: "p", DiagramID: "d", Soort: beeldSoortMoment, AlleenBijwerken: true},
	} {
		in := in
		if valideerBeeldInvoer(&in) == "" {
			t.Errorf("%s: had geweigerd moeten worden", naam)
		}
	}
}

func TestStudioBeeld_Roundtrip(t *testing.T) {
	draaiBeeldRoundtrip(t, "test-beeld-0001")
}

// Zelfde ronde met de plaatjes in MinIO (filestore), zoals op de VPS. Draait alleen met
// MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY/MINIO_BUCKET (bv. de lokale bitemp-minio-v06).
func TestStudioBeeld_MinIO(t *testing.T) {
	if os.Getenv("MINIO_ENDPOINT") == "" {
		t.Skip("MINIO_ENDPOINT niet gezet; MinIO-test overgeslagen")
	}
	if err := filestore.Init(); err != nil || !filestore.Beschikbaar {
		t.Fatalf("filestore: %v", err)
	}
	defer func() { filestore.Beschikbaar = false }()
	key := draaiBeeldRoundtrip(t, "test-beeld-0002")
	if key == "" {
		t.Fatal("met MinIO hoort het plaatje een object_key te hebben")
	}
	if ok, _ := filestore.Huidig().Bestaat(context.Background(), key); ok {
		t.Fatalf("object %s had na intrekken weg moeten zijn", key)
	}
}

// draaiBeeldRoundtrip: delen, ophalen, bijwerken, lijst, intrekken. Geeft de object_key van het
// ingetrokken actuele plaatje terug ("" zonder MinIO).
func draaiBeeldRoundtrip(t *testing.T, pid string) string {
	t.Helper()
	db := studioTestDB(t)
	ctx := context.Background()
	if _, err := db.NewCreateTable().Model((*model.StudioGedeeldBeeld)(nil)).IfNotExists().Exec(ctx); err != nil {
		t.Fatalf("tabel: %v", err)
	}
	for _, q := range []string{
		`ALTER TABLE studio_gedeeld_beeld ADD COLUMN IF NOT EXISTS object_key VARCHAR`,
		`ALTER TABLE studio_gedeeld_beeld ALTER COLUMN inhoud DROP NOT NULL`,
	} {
		if _, err := db.ExecContext(ctx, q); err != nil {
			t.Fatalf("kolommen: %v", err)
		}
	}
	if _, err := db.ExecContext(ctx, `CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_gedeeld_beeld_actueel
		ON studio_gedeeld_beeld (project_id, profiel_id, diagram_id) WHERE soort = 'actueel' AND ingetrokken_op IS NULL`); err != nil {
		t.Fatalf("index: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.NewDelete().Model((*model.StudioGedeeldBeeld)(nil)).Where("project_id LIKE 'test-%'").Exec(ctx)
	})
	oud := DB
	DB = db
	defer func() { DB = oud }()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/studio/projecten", MaakStudioProjectAanmakenHandler())
	r.POST("/api/studio/projecten/:id/beelden", MaakStudioBeeldDelenHandler())
	r.GET("/api/studio/projecten/:id/beelden", MaakStudioBeeldenLijstHandler())
	r.DELETE("/api/studio/projecten/:id/beelden/:token", MaakStudioBeeldIntrekkenHandler())
	r.GET("/api/beeld/:bestand", MaakBeeldOpenbaarHandler())

	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": pid, "naam": "Beeld", "inhoud": map[string]any{"formaat": "studio-project", "versie": 3}}); rec.Code != http.StatusCreated {
		t.Fatalf("project: %d %s", rec.Code, rec.Body.String())
	}
	deel := func(soort, png string, alleenBijwerken bool) (int, BeeldMeta) {
		rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/"+pid+"/beelden", map[string]any{
			"profiel_id": "usecase05", "diagram_id": "d_1", "diagram_naam": "Overzicht", "soort": soort,
			"png": "data:image/png;base64," + png, "breedte": 1, "hoogte": 1, "alleen_bijwerken": alleenBijwerken,
		})
		var m BeeldMeta
		_ = json.Unmarshal(rec.Body.Bytes(), &m)
		return rec.Code, m
	}
	haal := func(pad, inm string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, pad, nil)
		if inm != "" {
			req.Header.Set("If-None-Match", inm)
		}
		return studioDoeReq(r, req)
	}

	// Momentopname: zelfde plaatje = zelfde adres, ander plaatje = nieuw adres.
	code, m1 := deel("momentopname", testPNG1, false)
	if code != http.StatusCreated || len(m1.Token) != 32 || !strings.HasSuffix(m1.Pad, m1.Token+".png") {
		t.Fatalf("momentopname: %d %+v", code, m1)
	}
	if code, m := deel("momentopname", testPNG1, false); code != http.StatusOK || m.Token != m1.Token {
		t.Fatalf("zelfde plaatje moest hetzelfde adres geven: %d %+v", code, m)
	}
	if _, m := deel("momentopname", testPNG2, false); m.Token == m1.Token {
		t.Fatal("ander plaatje moest een nieuw adres krijgen")
	}
	rec := haal(m1.Pad, "")
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/png" || !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Fatalf("openbaar ophalen: %d %v", rec.Code, rec.Header())
	}
	if rec.Header().Get("Cross-Origin-Resource-Policy") != "cross-origin" {
		t.Fatal("CORP cross-origin ontbreekt")
	}
	if rec = haal(m1.Pad, rec.Header().Get("ETag")); rec.Code != http.StatusNotModified {
		t.Fatalf("If-None-Match: %d", rec.Code)
	}

	// Actueel: alleen-bijwerken zonder adres = 404; daarna één adres dat meegaat.
	if code, _ := deel("actueel", testPNG1, true); code != http.StatusNotFound {
		t.Fatalf("alleen bijwerken zonder adres: %d", code)
	}
	code, a1 := deel("actueel", testPNG1, false)
	if code != http.StatusCreated {
		t.Fatalf("actueel: %d", code)
	}
	code, a2 := deel("actueel", testPNG2, true)
	if code != http.StatusOK || a2.Token != a1.Token || !a2.Gewijzigd || a2.Hash == a1.Hash {
		t.Fatalf("actueel bijwerken: %d %+v", code, a2)
	}
	if _, a3 := deel("actueel", testPNG2, true); a3.Gewijzigd {
		t.Fatal("zelfde plaatje is geen wijziging")
	}
	rec = haal(a1.Pad, `"`+a1.Hash+`"`)
	if rec.Code != http.StatusOK || rec.Header().Get("ETag") != `"`+a2.Hash+`"` || rec.Header().Get("Cache-Control") != "public, no-cache" {
		t.Fatalf("actueel moet het nieuwe plaatje geven: %d %v", rec.Code, rec.Header())
	}

	// Lijst en intrekken.
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/"+pid+"/beelden", nil)
	var lijst struct{ Beelden []BeeldMeta }
	_ = json.Unmarshal(rec.Body.Bytes(), &lijst)
	if len(lijst.Beelden) != 3 {
		t.Fatalf("lijst: %d %s", len(lijst.Beelden), rec.Body.String())
	}
	var rij model.StudioGedeeldBeeld
	if err := db.NewSelect().Model(&rij).Where("token = ?", a1.Token).Scan(ctx); err != nil {
		t.Fatalf("rij lezen: %v", err)
	}
	if (rij.ObjectKey != "") == (len(rij.Inhoud) > 0) {
		t.Fatalf("precies één van object_key en inhoud hoort gevuld: key=%q inhoud=%d", rij.ObjectKey, len(rij.Inhoud))
	}
	if rec = studioDoe(r, http.MethodDelete, "/api/studio/projecten/"+pid+"/beelden/"+a1.Token, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("intrekken: %d %s", rec.Code, rec.Body.String())
	}
	if rec = haal(a1.Pad, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("ingetrokken adres moet 404 geven: %d", rec.Code)
	}
	if code, _ := deel("actueel", testPNG1, true); code != http.StatusNotFound {
		t.Fatal("na intrekken stopt bijwerken")
	}
	if rec = haal("/api/beeld/kort.png", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("ongeldig token: %d", rec.Code)
	}
	return rij.ObjectKey
}
