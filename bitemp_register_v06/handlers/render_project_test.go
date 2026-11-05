package handlers

// Tests voor het projectdiagram als SVG (handlers/render_project.go, stap 6 van het plan Eén
// tekenaar; privacy-besluit Mark 05-11-2026). Zonder database: de laders zijn variabelen, de
// sidecar is een nepserver (render_svg_test.go).

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

const (
	testProjectID = "p1234567-aaaa-bbbb"
	testSvgToken  = "abcdefghijklmnopqrstuvwxyzABCDEF" // 32 tekens, zoals nieuwBeeldToken
)

// nepProject speelt studio_projecten na: één project met twee profielen.
type nepProject struct {
	stand      projectStand
	profielen  map[string]string
	deelVragen int // hoe vaak de inhoud is geladen (de cache moet dat beperken)
}

func nepProjectOpslag(t *testing.T) *nepProject {
	t.Helper()
	n := &nepProject{
		stand: projectStand{Naam: "Proefproject", Versie: 3, TotVolgnummer: 40, Bijgewerkt: time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)},
		profielen: map[string]string{
			"usecase05":   `{"diagramTypeId":"usecase05","elements":{},"diagrams":{"d1":{"id":"d1","naam":"Overzicht"},"d2":{"naam":""}}}`,
			"archimate05": `{"diagramTypeId":"archimate05","elements":{},"diagrams":{"a1":{"id":"a1","naam":"Lagen"}}}`,
		},
	}
	oudStand, oudDeel, oudLink, oudAchterstand := laadProjectStand, laadProjectDeel, laadSvgLink, projectAchterstand
	laadProjectStand = func(_ context.Context, id string) (*projectStand, error) {
		if id != testProjectID {
			return nil, nil
		}
		s := n.stand
		return &s, nil
	}
	laadProjectDeel = func(_ context.Context, id, profiel string) (*projectStand, json.RawMessage, error) {
		if id != testProjectID {
			return nil, nil, nil
		}
		n.deelVragen++
		s := n.stand
		if profiel != "" {
			p, ok := n.profielen[profiel]
			if !ok {
				return &s, nil, nil
			}
			return &s, json.RawMessage(p), nil
		}
		alle := map[string]json.RawMessage{}
		for id, p := range n.profielen {
			alle[id] = json.RawMessage(p)
		}
		deel, _ := json.Marshal(alle)
		return &s, deel, nil
	}
	laadSvgLink = func(_ context.Context, token string) (*model.StudioGedeeldBeeld, error) {
		if token != testSvgToken {
			return nil, nil
		}
		return &model.StudioGedeeldBeeld{Token: token, ProjectID: testProjectID, ProfielID: "usecase05", DiagramID: "d1", Soort: beeldSoortSvg}, nil
	}
	projectAchterstand = func(context.Context, string, int64) int64 { return 7 }
	leegProjectSvgCache()
	t.Cleanup(func() {
		laadProjectStand, laadProjectDeel, laadSvgLink, projectAchterstand = oudStand, oudDeel, oudLink, oudAchterstand
		leegProjectSvgCache()
	})
	return n
}

func projectRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/studio/projecten/:id/diagram.svg", MaakStudioProjectDiagramSvgHandler())
	r.GET("/api/studio/projecten/:id/views.json", MaakStudioProjectViewsHandler())
	r.GET("/api/beeld/:bestand", MaakBeeldOpenbaarHandler())
	return r
}

func haal(t *testing.T, pad string, kop ...string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, pad, nil)
	for i := 0; i+1 < len(kop); i += 2 {
		req.Header.Set(kop[i], kop[i+1])
	}
	w := httptest.NewRecorder()
	projectRouter().ServeHTTP(w, req)
	return w
}

func TestProjectDiagram_StuurtAlleenHetProfiel(t *testing.T) {
	nepProjectOpslag(t)
	var laatste map[string]any
	t.Setenv("RENDER_SVC_URL", nepViewsSvc(t, &laatste).URL)

	w := haal(t, "/api/studio/projecten/"+testProjectID+"/diagram.svg?profiel=usecase05&diagram=d1&theme=dark")
	if w.Code != http.StatusOK || !strings.HasPrefix(w.Header().Get("Content-Type"), "image/svg+xml") {
		t.Fatalf("status %d, type %q, body %s", w.Code, w.Header().Get("Content-Type"), w.Body.String())
	}
	// Naar de sidecar: taal=studio, alleen het gevraagde profiel, de projectnaam voor de titel.
	if laatste["taal"] != "studio" || laatste["profiel"] != "usecase05" || laatste["diagram"] != "d1" || laatste["theme"] != "dark" {
		t.Errorf("invoer voor de sidecar: %v", laatste)
	}
	if _, ok := laatste["idPrefix"]; ok {
		t.Errorf("een lege idPrefix hoort niet mee te gaan: %v", laatste)
	}
	m, _ := laatste["model"].(map[string]any)
	profielen, _ := m["profielen"].(map[string]any)
	if len(profielen) != 1 || profielen["usecase05"] == nil {
		t.Errorf("alleen usecase05 hoort mee te gaan, kreeg %v", profielen)
	}
	if p, _ := m["project"].(map[string]any); p["naam"] != "Proefproject" {
		t.Errorf("project.naam ontbreekt: %v", m["project"])
	}
	// Antwoord: achter inloggen, met de stand van de snapshot.
	h := w.Header()
	if h.Get("Cache-Control") != "private, no-cache" || h.Get("ETag") == "" || h.Get("Last-Modified") == "" {
		t.Errorf("kopregels: Cache-Control %q, ETag %q, Last-Modified %q", h.Get("Cache-Control"), h.Get("ETag"), h.Get("Last-Modified"))
	}
	if h.Get("X-Omnium-Project-Versie") != "3" || h.Get("X-Omnium-Achterstand") != "7" {
		t.Errorf("versie %q, achterstand %q", h.Get("X-Omnium-Project-Versie"), h.Get("X-Omnium-Achterstand"))
	}
	w2 := haal(t, "/api/studio/projecten/"+testProjectID+"/diagram.svg?profiel=usecase05&diagram=d1&theme=dark", "If-None-Match", h.Get("ETag"))
	if w2.Code != http.StatusNotModified {
		t.Errorf("If-None-Match: verwacht 304, kreeg %d", w2.Code)
	}
}

func TestProjectDiagram_CacheOpProjectversie(t *testing.T) {
	n := nepProjectOpslag(t)
	var laatste map[string]any
	t.Setenv("RENDER_SVC_URL", nepViewsSvc(t, &laatste).URL)
	pad := "/api/studio/projecten/" + testProjectID + "/diagram.svg?profiel=usecase05&diagram=d1"

	for i := 0; i < 3; i++ {
		if w := haal(t, pad); w.Code != http.StatusOK {
			t.Fatalf("aanvraag %d: status %d", i, w.Code)
		}
	}
	if n.deelVragen != 1 {
		t.Errorf("zelfde projectversie: de inhoud hoort één keer geladen te zijn, was %d", n.deelVragen)
	}
	// Een andere opmaak is een andere tekening.
	haal(t, pad+"&theme=dark")
	if n.deelVragen != 2 {
		t.Errorf("ander thema: verwacht 2 keer laden, was %d", n.deelVragen)
	}
	// Een nieuwe snapshot (versie telt op) geeft een nieuwe tekening.
	n.stand.Versie++
	haal(t, pad)
	if n.deelVragen != 3 {
		t.Errorf("nieuwe projectversie: verwacht 3 keer laden, was %d", n.deelVragen)
	}
}

func TestProjectDiagram_Fouten(t *testing.T) {
	nepProjectOpslag(t)
	t.Setenv("RENDER_SVC_URL", nepRenderSvc(t).URL)
	basis := "/api/studio/projecten/" + testProjectID + "/diagram.svg"

	for naam, geval := range map[string]struct {
		pad    string
		status int
		bevat  string
	}{
		"onbekende parameter": {basis + "?domein=x", http.StatusBadRequest, "domein"},
		"ongeldig profiel-id": {basis + "?profiel=a/b", http.StatusBadRequest, "profiel"},
		"ongeldig project-id": {"/api/studio/projecten/x/diagram.svg", http.StatusBadRequest, "project-id"},
		"onbekend project":    {"/api/studio/projecten/q7654321-zzzz/diagram.svg", http.StatusNotFound, "Project niet gevonden"},
		"onbekend profiel":    {basis + "?profiel=bpmn05", http.StatusNotFound, "bpmn05"},
		// Wie hier komt mag het project lezen: het probleem van de sidecar gaat ongewijzigd door.
		"fout van de sidecar": {basis + "?profiel=usecase05&diagram=fout", http.StatusUnprocessableEntity, `"element":"X"`},
	} {
		w := haal(t, geval.pad)
		if w.Code != geval.status || !strings.Contains(w.Body.String(), geval.bevat) {
			t.Errorf("%s: status %d (verwacht %d), body %s", naam, w.Code, geval.status, w.Body.String())
		}
		if !strings.HasPrefix(w.Header().Get("Content-Type"), "application/problem+json") {
			t.Errorf("%s: content-type %q", naam, w.Header().Get("Content-Type"))
		}
	}

	t.Setenv("RENDER_SVC_URL", "http://127.0.0.1:1")
	if w := haal(t, basis+"?profiel=usecase05&diagram=d1"); w.Code != http.StatusBadGateway {
		t.Errorf("sidecar onbereikbaar: verwacht 502, kreeg %d", w.Code)
	}
}

func TestProjectViews(t *testing.T) {
	nepProjectOpslag(t)
	w := haal(t, "/api/studio/projecten/"+testProjectID+"/views.json")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var uit struct {
		Naam              string            `json:"naam"`
		Versie            int64             `json:"versie"`
		TotVolgnummer     int64             `json:"tot_volgnummer"`
		LaatsteVolgnummer int64             `json:"laatste_volgnummer"`
		Weergaven         []ProjectWeergave `json:"weergaven"`
		Diagrammen        []string          `json:"diagrammen"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &uit); err != nil {
		t.Fatal(err)
	}
	if uit.Naam != "Proefproject" || uit.Versie != 3 || uit.TotVolgnummer != 40 || uit.LaatsteVolgnummer != 47 {
		t.Errorf("stand: %+v", uit)
	}
	// Op profiel, dan naam; een diagram zonder id of naam krijgt zijn sleutel.
	verwacht := []ProjectWeergave{{"a1", "Lagen", "archimate05"}, {"d1", "Overzicht", "usecase05"}, {"d2", "d2", "usecase05"}}
	if len(uit.Weergaven) != len(verwacht) {
		t.Fatalf("weergaven: %+v", uit.Weergaven)
	}
	for i, v := range verwacht {
		if uit.Weergaven[i] != v {
			t.Errorf("weergave %d: %+v, verwacht %+v", i, uit.Weergaven[i], v)
		}
	}
	if strings.Join(uit.Diagrammen, ",") != "Lagen,Overzicht,d2" {
		t.Errorf("diagrammen: %v", uit.Diagrammen)
	}
	if w := haal(t, "/api/studio/projecten/"+testProjectID+"/views.json?x=1"); w.Code != http.StatusBadRequest {
		t.Errorf("onbekende parameter: verwacht 400, kreeg %d", w.Code)
	}
}

func TestBeeldSvgLink_Openbaar(t *testing.T) {
	nepProjectOpslag(t)
	var laatste map[string]any
	t.Setenv("RENDER_SVC_URL", nepViewsSvc(t, &laatste).URL)

	w := haal(t, "/api/beeld/"+testSvgToken+".svg?theme=dark")
	if w.Code != http.StatusOK || !strings.HasPrefix(w.Header().Get("Content-Type"), "image/svg+xml") {
		t.Fatalf("status %d, type %q, body %s", w.Code, w.Header().Get("Content-Type"), w.Body.String())
	}
	// De link legt profiel en diagram vast; de lezer kiest alleen de opmaak.
	if laatste["profiel"] != "usecase05" || laatste["diagram"] != "d1" || laatste["theme"] != "dark" {
		t.Errorf("invoer voor de sidecar: %v", laatste)
	}
	h := w.Header()
	if h.Get("Cache-Control") != "public, no-cache" || h.Get("Cross-Origin-Resource-Policy") != "cross-origin" ||
		!strings.Contains(h.Get("X-Robots-Tag"), "noindex") || h.Get("ETag") == "" {
		t.Errorf("kopregels: %v", h)
	}
	// Geen projectgegevens op een openbaar adres.
	if h.Get("X-Omnium-Project-Versie") != "" || h.Get("X-Omnium-Achterstand") != "" {
		t.Errorf("de openbare link hoort geen projectstand te noemen: %v", h)
	}
	if w2 := haal(t, "/api/beeld/"+testSvgToken+".svg?theme=dark", "If-None-Match", h.Get("ETag")); w2.Code != http.StatusNotModified {
		t.Errorf("If-None-Match: verwacht 304, kreeg %d", w2.Code)
	}

	for naam, geval := range map[string]struct {
		pad    string
		status int
	}{
		"onbekend token":      {"/api/beeld/" + strings.Repeat("z", 32) + ".svg", http.StatusNotFound},
		"ongeldig token":      {"/api/beeld/kort.svg", http.StatusNotFound},
		"onbekende parameter": {"/api/beeld/" + testSvgToken + ".svg?diagram=a1", http.StatusBadRequest},
	} {
		if w := haal(t, geval.pad); w.Code != geval.status {
			t.Errorf("%s: status %d, verwacht %d", naam, w.Code, geval.status)
		}
	}
}

// Het token ontsluit één diagram. Een fout van de sidecar noemt andere diagrammen ("keuzes") of
// een element; dat mag niet op het openbare adres terechtkomen.
func TestBeeldSvgLink_LektGeenDetail(t *testing.T) {
	nepProjectOpslag(t)
	for status, verwacht := range map[int]int{
		http.StatusNotFound:            http.StatusNotFound,
		http.StatusUnprocessableEntity: http.StatusUnprocessableEntity,
		http.StatusInternalServerError: http.StatusBadGateway,
	} {
		status := status
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/problem+json; charset=utf-8")
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"detail":"Geen diagram 'd1'","diagrammen":[{"id":"x","naam":"Geheim diagram"}],"element":"Geheim element"}`))
		}))
		t.Setenv("RENDER_SVC_URL", srv.URL)
		leegProjectSvgCache()
		w := haal(t, "/api/beeld/"+testSvgToken+".svg")
		srv.Close()
		if w.Code != verwacht {
			t.Errorf("sidecar %d: status %d, verwacht %d", status, w.Code, verwacht)
		}
		if strings.Contains(w.Body.String(), "Geheim") {
			t.Errorf("sidecar %d: het antwoord lekt het detail van de sidecar: %s", status, w.Body.String())
		}
		if !strings.HasPrefix(w.Header().Get("Content-Type"), "application/problem+json") {
			t.Errorf("sidecar %d: content-type %q", status, w.Header().Get("Content-Type"))
		}
	}
}

func TestValideerBeeldInvoer_Svg(t *testing.T) {
	goed := beeldInvoer{ProfielID: "usecase05", DiagramID: "d1", Soort: beeldSoortSvg}
	if fout := valideerBeeldInvoer(&goed); fout != "" {
		t.Fatalf("soort svg zonder png hoort goed te zijn: %s", fout)
	}
	metPNG := beeldInvoer{ProfielID: "usecase05", DiagramID: "d1", Soort: beeldSoortSvg, PNG: testPNG1}
	if valideerBeeldInvoer(&metPNG) == "" {
		t.Error("soort svg met een png hoort geweigerd te worden")
	}
	bijwerken := beeldInvoer{ProfielID: "usecase05", DiagramID: "d1", Soort: beeldSoortSvg, AlleenBijwerken: true}
	if valideerBeeldInvoer(&bijwerken) == "" {
		t.Error("alleen_bijwerken hoort alleen bij actueel")
	}
	// Het adres volgt de soort.
	if pad := beeldMeta(&model.StudioGedeeldBeeld{Token: testSvgToken, Soort: beeldSoortSvg}).Pad; pad != "/api/beeld/"+testSvgToken+".svg" {
		t.Errorf("pad van een svg-link: %s", pad)
	}
	if pad := beeldMeta(&model.StudioGedeeldBeeld{Token: testSvgToken, Soort: beeldSoortActueel}).Pad; pad != "/api/beeld/"+testSvgToken+".png" {
		t.Errorf("pad van een plaatje: %s", pad)
	}
}

// De hele ronde tegen een echte PostgreSQL (STUDIO_TEST_PG_DSN, zie studio_project_handler_test.go):
// de database knipt het profiel uit de snapshot, de link van soort "svg" wordt opgeslagen (één per
// diagram), getoond in de lijst, getekend op <token>.svg en ingetrokken.
func TestProjectDiagram_Roundtrip(t *testing.T) {
	db := studioTestDB(t)
	ctx := context.Background()
	if _, err := db.NewCreateTable().Model((*model.StudioGedeeldBeeld)(nil)).IfNotExists().Exec(ctx); err != nil {
		t.Fatalf("tabel: %v", err)
	}
	for _, q := range []string{
		`ALTER TABLE studio_gedeeld_beeld ADD COLUMN IF NOT EXISTS object_key VARCHAR`,
		`ALTER TABLE studio_gedeeld_beeld ALTER COLUMN inhoud DROP NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_gedeeld_beeld_svg
			ON studio_gedeeld_beeld (project_id, profiel_id, diagram_id) WHERE soort = 'svg' AND ingetrokken_op IS NULL`,
	} {
		if _, err := db.ExecContext(ctx, q); err != nil {
			t.Fatalf("schema: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.NewDelete().Model((*model.StudioGedeeldBeeld)(nil)).Where("project_id LIKE 'test-%'").Exec(ctx)
	})
	oud := DB
	DB = db
	defer func() { DB = oud }()
	leegProjectSvgCache()
	defer leegProjectSvgCache()
	var laatste map[string]any
	t.Setenv("RENDER_SVC_URL", nepViewsSvc(t, &laatste).URL)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/studio/projecten", MaakStudioProjectAanmakenHandler())
	r.POST("/api/studio/projecten/:id/beelden", MaakStudioBeeldDelenHandler())
	r.GET("/api/studio/projecten/:id/beelden", MaakStudioBeeldenLijstHandler())
	r.DELETE("/api/studio/projecten/:id/beelden/:token", MaakStudioBeeldIntrekkenHandler())
	r.GET("/api/studio/projecten/:id/diagram.svg", MaakStudioProjectDiagramSvgHandler())
	r.GET("/api/studio/projecten/:id/views.json", MaakStudioProjectViewsHandler())
	r.GET("/api/beeld/:bestand", MaakBeeldOpenbaarHandler())

	const pid = "test-render-0001"
	inhoud := map[string]any{
		"formaat": "studio-project", "versie": 3, "structuur": map[string]any{"groot": strings.Repeat("x", 4096)},
		"profielen": map[string]any{
			"usecase05":   map[string]any{"diagramTypeId": "usecase05", "elements": map[string]any{}, "diagrams": map[string]any{"d_1": map[string]any{"id": "d_1", "naam": "Overzicht", "nodes": []any{}}}},
			"archimate05": map[string]any{"diagramTypeId": "archimate05", "elements": map[string]any{}, "diagrams": map[string]any{"a_1": map[string]any{"id": "a_1", "naam": "Lagen", "nodes": []any{}}}},
		},
	}
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": pid, "naam": "Render", "inhoud": inhoud}); rec.Code != http.StatusCreated {
		t.Fatalf("project: %d %s", rec.Code, rec.Body.String())
	}

	// Ingelogde route: de database levert alleen het gevraagde profiel.
	rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/"+pid+"/diagram.svg?profiel=usecase05&diagram=d_1", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("diagram.svg: %d %s", rec.Code, rec.Body.String())
	}
	m, _ := laatste["model"].(map[string]any)
	profielen, _ := m["profielen"].(map[string]any)
	if len(profielen) != 1 || profielen["usecase05"] == nil || m["structuur"] != nil {
		t.Errorf("naar de sidecar hoort alleen profiel usecase05 te gaan: %v", m)
	}
	if p, _ := m["project"].(map[string]any); p["naam"] != "Render" {
		t.Errorf("project.naam: %v", m["project"])
	}
	if rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/"+pid+"/diagram.svg?profiel=bpmn05", nil); rec.Code != http.StatusNotFound {
		t.Errorf("onbekend profiel: %d %s", rec.Code, rec.Body.String())
	}
	// Zonder profiel gaan alle profielen mee; de sidecar zoekt het diagram.
	leegProjectSvgCache()
	if rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/"+pid+"/diagram.svg?diagram=Lagen", nil); rec.Code != http.StatusOK {
		t.Fatalf("zonder profiel: %d %s", rec.Code, rec.Body.String())
	}
	m, _ = laatste["model"].(map[string]any)
	if profielen, _ = m["profielen"].(map[string]any); len(profielen) != 2 {
		t.Errorf("zonder profiel horen beide profielen mee te gaan: %v", profielen)
	}

	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/"+pid+"/views.json", nil)
	var views struct {
		Naam      string            `json:"naam"`
		Weergaven []ProjectWeergave `json:"weergaven"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &views)
	if rec.Code != http.StatusOK || views.Naam != "Render" || len(views.Weergaven) != 2 || views.Weergaven[0] != (ProjectWeergave{"a_1", "Lagen", "archimate05"}) {
		t.Errorf("views.json: %d %s", rec.Code, rec.Body.String())
	}

	// De link: één per diagram, adres op .svg, zichtbaar in de lijst.
	link := func() (int, BeeldMeta) {
		rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/"+pid+"/beelden", map[string]any{
			"profiel_id": "usecase05", "diagram_id": "d_1", "diagram_naam": "Overzicht", "soort": "svg",
		})
		var uit BeeldMeta
		_ = json.Unmarshal(rec.Body.Bytes(), &uit)
		return rec.Code, uit
	}
	code, eerste := link()
	if code != http.StatusCreated || !strings.HasSuffix(eerste.Pad, ".svg") || eerste.Soort != beeldSoortSvg {
		t.Fatalf("link maken: %d %+v", code, eerste)
	}
	if code, tweede := link(); code != http.StatusOK || tweede.Token != eerste.Token {
		t.Errorf("tweede keer hoort dezelfde link te geven: %d %+v", code, tweede)
	}
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/"+pid+"/beelden", nil)
	if !strings.Contains(rec.Body.String(), eerste.Pad) {
		t.Errorf("de link hoort in de lijst te staan: %s", rec.Body.String())
	}

	leegProjectSvgCache()
	rec = studioDoe(r, http.MethodGet, eerste.Pad, nil)
	if rec.Code != http.StatusOK || rec.Header().Get("Cache-Control") != "public, no-cache" {
		t.Fatalf("openbare link: %d %s", rec.Code, rec.Body.String())
	}
	if laatste["profiel"] != "usecase05" || laatste["diagram"] != "d_1" {
		t.Errorf("de link tekent het vastgelegde diagram: %v", laatste)
	}
	// Een SVG-link heeft geen plaatje.
	if rec := studioDoe(r, http.MethodGet, "/api/beeld/"+eerste.Token+".png", nil); rec.Code != http.StatusNotFound {
		t.Errorf(".png op een svg-link: %d", rec.Code)
	}

	// Intrekken: het adres geeft meteen 404, ook al staat de tekening nog in de cache.
	if rec := studioDoe(r, http.MethodDelete, "/api/studio/projecten/"+pid+"/beelden/"+eerste.Token, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("intrekken: %d %s", rec.Code, rec.Body.String())
	}
	if rec := studioDoe(r, http.MethodGet, eerste.Pad, nil); rec.Code != http.StatusNotFound {
		t.Errorf("na intrekken: %d", rec.Code)
	}
	// Daarna mag er een nieuwe link komen, met een ander token.
	if code, nieuw := link(); code != http.StatusCreated || nieuw.Token == eerste.Token {
		t.Errorf("nieuwe link na intrekken: %d %+v", code, nieuw)
	}
}
