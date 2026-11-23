package handlers

// Tests voor de centrale plek (studio_centraal.go; plan Sidecar-project §8, stap 5).
// De zuivere delen draaien altijd; de handlers tegen PostgreSQL (STUDIO_TEST_PG_DSN, zie
// studio_project_handler_test.go).

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func TestSemver(t *testing.T) {
	if _, ok := parseSemver("0.3.0"); !ok {
		t.Fatal("0.3.0 moet geldig zijn")
	}
	for _, fout := range []string{"", "1", "1.2", "01.2.3", "1.2.3-rc1", "v1.2.3", "1.2.3.4"} {
		if _, ok := parseSemver(fout); ok {
			t.Errorf("%q hoort ongeldig te zijn", fout)
		}
	}
	if vergelijkSemver("0.10.0", "0.9.9") <= 0 || vergelijkSemver("1.0.0", "1.0.0") != 0 || vergelijkSemver("0.1.2", "0.2.0") >= 0 {
		t.Fatal("vergelijkSemver: numeriek, niet als tekst")
	}
	if h := hoogsteVersie([]string{"0.2.0", "0.10.0", "0.9.0"}); h != "0.10.0" {
		t.Fatalf("hoogste: %s", h)
	}
	if hoogsteVersie(nil) != "" {
		t.Fatal("lege lijst: geen hoogste")
	}
}

func TestInhoudVoorUitgave(t *testing.T) {
	goed := json.RawMessage(`{"formaat":"studio-project","versie":4,"project":{"id":"omnium-sidecar","naam":"S","soort":"profielen","versie":"0.1.0","concept":true},"profielen":{}}`)
	uit, soort, msg := inhoudVoorUitgave(goed, "0.2.0")
	if msg != "" || soort != "profielen" {
		t.Fatalf("goed: soort=%q msg=%q", soort, msg)
	}
	var doc struct {
		Project map[string]any `json:"project"`
	}
	_ = json.Unmarshal(uit, &doc)
	if doc.Project["versie"] != "0.2.0" || doc.Project["concept"] != nil || doc.Project["id"] != "omnium-sidecar" {
		t.Fatalf("kop: %+v", doc.Project)
	}
	for _, fout := range []string{
		`{"formaat":"studio-project","project":{"soort":"model"}}`, // een gewoon project
		`{"formaat":"studio-project"}`,                             // geen kop
		`{"formaat":"iets"}`,                                       // geen werkbestand
	} {
		if _, _, msg := inhoudVoorUitgave(json.RawMessage(fout), "0.1.0"); msg == "" {
			t.Errorf("%s hoort geweigerd te worden", fout)
		}
	}
}

func centraalRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/studio/projecten", MaakStudioProjectAanmakenHandler())
	r.POST("/api/studio/projecten/:id/ops", MaakStudioProjectOpsToevoegenHandler())
	r.POST("/api/studio/projecten/:id/uitbrengen", MaakStudioProjectUitbrengenHandler())
	r.GET("/api/studio/centraal", MaakStudioCentraalLijstHandler())
	r.GET("/api/studio/centraal/:soort/:versie", MaakStudioCentraalOphalenHandler())
	return r
}

func sidecarInhoud(versie string) map[string]any {
	return map[string]any{"formaat": "studio-project", "versie": 4,
		"project":   map[string]any{"id": "test-centraal-p", "naam": "Profielen", "soort": "profielen", "versie": versie, "concept": true},
		"profielen": map[string]any{}}
}

func TestStudioCentraal_UitbrengenEnOphalen(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	t.Setenv("CENTRAAL_URL", "")
	_, _ = db.NewDelete().Model((*model.StudioProjectUitgave)(nil)).Where("soort = 'profielen'").Exec(t.Context())
	r := centraalRouter()

	rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-centraal-p", "naam": "Profielen", "inhoud": sidecarInhoud("0.1.0")})
	if rec.Code != http.StatusCreated {
		t.Fatalf("aanmaken: %d %s", rec.Code, rec.Body.String())
	}
	breng := func(versie string, tot int64, extra map[string]any) *httptest.ResponseRecorder {
		body := map[string]any{"versie": versie, "inhoud": sidecarInhoud("0.1.0"), "totVolgnummer": tot}
		for k, v := range extra {
			body[k] = v
		}
		return studioDoe(r, http.MethodPost, "/api/studio/projecten/test-centraal-p/uitbrengen", body)
	}

	// De eerste versie: geen ouders.
	rec = breng("0.1.0", 0, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("uitbrengen 0.1.0: %d %s", rec.Code, rec.Body.String())
	}
	var u model.StudioProjectUitgave
	_ = json.Unmarshal(rec.Body.Bytes(), &u)
	if u.Soort != "profielen" || string(u.Ouders) != "[]" || len(u.Inhoud) != 0 {
		t.Fatalf("0.1.0: %+v", u)
	}
	// Niet hoger: geweigerd.
	if rec = breng("0.1.0", 0, nil); rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "versie_niet_hoger") {
		t.Fatalf("dubbel: %d %s", rec.Code, rec.Body.String())
	}
	// Een operatie op de server die het werkbestand niet kent: achterstand.
	rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/test-centraal-p/ops", map[string]any{
		"clientId": "c1", "ops": []map[string]any{{"store": "modelleren", "op": "patchStructuur", "args": []any{map[string]any{}}}}})
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("ops: %d %s", rec.Code, rec.Body.String())
	}
	if rec = breng("0.2.0", 0, nil); rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "achterstand") {
		t.Fatalf("achterstand: %d %s", rec.Code, rec.Body.String())
	}
	// Bijgewerkt werkbestand: 0.2.0 met ouder 0.1.0.
	rec = breng("0.2.0", 1, map[string]any{"notitie": "eerste wijziging"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("uitbrengen 0.2.0: %d %s", rec.Code, rec.Body.String())
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &u)
	if string(u.Ouders) != `[{"versie": "0.1.0"}]` && string(u.Ouders) != `[{"versie":"0.1.0"}]` {
		t.Fatalf("ouders 0.2.0: %s", u.Ouders)
	}
	// Een ouder die niet bestaat: geweigerd.
	if rec = breng("0.3.0", 1, map[string]any{"ouders": []string{"0.9.0"}}); rec.Code != http.StatusBadRequest {
		t.Fatalf("onbekende ouder: %d %s", rec.Code, rec.Body.String())
	}

	// Lijst: twee versies, zonder inhoud.
	rec = studioDoe(r, http.MethodGet, "/api/studio/centraal", nil)
	if rec.Code != http.StatusOK || strings.Contains(rec.Body.String(), `"inhoud"`) || !strings.Contains(rec.Body.String(), `"0.2.0"`) {
		t.Fatalf("lijst: %d %s", rec.Code, rec.Body.String())
	}
	// Ophalen: de kop draagt de uitgebrachte versie, zonder concept.
	rec = studioDoe(r, http.MethodGet, "/api/studio/centraal/profielen/0.2.0", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("ophalen: %d %s", rec.Code, rec.Body.String())
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &u)
	var doc struct {
		Project map[string]any `json:"project"`
	}
	_ = json.Unmarshal(u.Inhoud, &doc)
	if doc.Project["versie"] != "0.2.0" || doc.Project["concept"] != nil {
		t.Fatalf("kop: %+v", doc.Project)
	}
	if rec = studioDoe(r, http.MethodGet, "/api/studio/centraal/profielen/9.9.9", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("onbekende versie: %d", rec.Code)
	}
}

func TestStudioCentraal_Spiegel(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	_, _ = db.NewDelete().Model((*model.StudioProjectUitgave)(nil)).Where("soort = 'weergaven'").Exec(t.Context())

	// Een nep-centrale die het leestoken controleert.
	var tokens []string
	centrale := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		tokens = append(tokens, req.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		switch req.URL.Path {
		case "/api/studio/centraal":
			_, _ = w.Write([]byte(`{"centrale":"","versies":[{"soort":"weergaven","versie":"0.4.0","projectId":"test-centraal-w","ouders":[]}]}`))
		case "/api/studio/centraal/weergaven/0.4.0":
			_, _ = w.Write([]byte(`{"soort":"weergaven","versie":"0.4.0","projectId":"test-centraal-w","ouders":[],"inhoud":{"formaat":"studio-project","project":{"soort":"weergaven","versie":"0.4.0"}}}`))
		default:
			http.NotFound(w, req)
		}
	}))
	defer centrale.Close()
	t.Setenv("CENTRAAL_URL", centrale.URL+"/")
	t.Setenv("CENTRAAL_TOKEN", "leestoken-x")
	r := centraalRouter()

	// Een spiegel brengt niet uit.
	rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-centraal-w/uitbrengen", map[string]any{"versie": "0.5.0"})
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "spiegel") {
		t.Fatalf("spiegel brengt uit: %d %s", rec.Code, rec.Body.String())
	}
	// De lijst noemt de versie van de centrale (nog niet hier).
	rec = studioDoe(r, http.MethodGet, "/api/studio/centraal", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"hier":false`) {
		t.Fatalf("lijst spiegel: %d %s", rec.Code, rec.Body.String())
	}
	// Ophalen haalt bij de centrale en bewaart; daarna staat hij hier.
	rec = studioDoe(r, http.MethodGet, "/api/studio/centraal/weergaven/0.4.0", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"bron":"`+centrale.URL) {
		t.Fatalf("ophalen spiegel: %d %s", rec.Code, rec.Body.String())
	}
	rec = studioDoe(r, http.MethodGet, "/api/studio/centraal", nil)
	if !strings.Contains(rec.Body.String(), `"hier":true`) {
		t.Fatalf("na ophalen: %s", rec.Body.String())
	}
	for _, tk := range tokens {
		if tk != "Bearer leestoken-x" {
			t.Fatalf("leestoken niet meegestuurd: %q", tk)
		}
	}
}
