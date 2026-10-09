package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// maakRepo zet een nep-checkout neer (.git als map) met de gegeven bestanden.
func maakRepo(t *testing.T, ouder, naam string, bestanden ...string) string {
	t.Helper()
	dir := filepath.Join(ouder, naam)
	if err := os.MkdirAll(filepath.Join(dir, ".git"), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, b := range bestanden {
		pad := filepath.Join(dir, filepath.FromSlash(b))
		_ = os.MkdirAll(filepath.Dir(pad), 0o755)
		if err := os.WriteFile(pad, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func TestZoekEaReposEnBestanden(t *testing.T) {
	wortel := t.TempDir()
	ggm := maakRepo(t, wortel, "GGM", "v2.3.0/model EA16.qea", "v3.0.0/GGM.qeax", "v2.3.0/leesmij.md",
		"node_modules/x/verstopt.qea", ".git/objects/ook.qea")
	maakRepo(t, wortel, "Ander", "model.qea")
	_ = os.MkdirAll(filepath.Join(wortel, "geen-repo"), 0o755)
	// Tweede ingestelde map is zelf een checkout met dezelfde naam → volgnummer.
	los := maakRepo(t, t.TempDir(), "GGM", "los.qea")

	repos := zoekEaRepos([]string{wortel, los, filepath.Join(wortel, "bestaat-niet")})
	namen := []string{}
	for _, r := range repos {
		namen = append(namen, r.Naam)
	}
	if strings.Join(namen, ",") != "Ander,GGM,GGM-2" {
		t.Errorf("repos: %v", namen)
	}

	bestanden := zoekEaBestanden(ggm)
	paden := []string{}
	for _, b := range bestanden {
		paden = append(paden, b.Pad)
	}
	if len(paden) != 2 || !strings.Contains(strings.Join(paden, "|"), "v2.3.0/model EA16.qea") || !strings.Contains(strings.Join(paden, "|"), "v3.0.0/GGM.qeax") {
		t.Errorf("bestanden: %v (node_modules en .git horen er niet bij)", paden)
	}

	repo := EaRepo{Naam: "GGM", Map: ggm}
	if pad, ok := eaBestandInRepo(repo, "v2.3.0/model EA16.qea"); !ok || !strings.HasSuffix(filepath.ToSlash(pad), "GGM/v2.3.0/model EA16.qea") {
		t.Errorf("bestaand bestand: %q %v", pad, ok)
	}
	for _, slecht := range []string{"", "../Ander/model.qea", "node_modules/x/verstopt.qea", "v2.3.0/leesmij.md", filepath.Join(ggm, "v2.3.0", "model EA16.qea")} {
		if _, ok := eaBestandInRepo(repo, slecht); ok {
			t.Errorf("%q: had geweigerd moeten worden", slecht)
		}
	}
}

func TestValideerEaImportVelden(t *testing.T) {
	gevallen := []struct {
		in   eaImportInvoer
		fout bool
	}{
		{eaImportInvoer{Pakket: "328"}, false},
		{eaImportInvoer{Pakket: " Model / Zandbak MW ", Map: "Import / GGM"}, false},
		{eaImportInvoer{Pakket: ""}, true},
		{eaImportInvoer{Pakket: "--droog"}, true},
		{eaImportInvoer{Pakket: "1", Map: "--token"}, true},
		{eaImportInvoer{Pakket: "1\nx"}, false}, // eerste teken telt; node krijgt het als één argument
	}
	for i, g := range gevallen {
		in := g.in
		if msg := valideerEaImportVelden(&in); (msg != "") != g.fout {
			t.Errorf("geval %d: %+v → %q", i, g.in, msg)
		}
	}
}

func eaImportTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/studio/ea-import/repos", MaakStudioEaImportReposHandler())
	r.GET("/api/studio/ea-import/repos/:repo/bestanden", MaakStudioEaImportBestandenHandler())
	r.GET("/api/studio/ea-import/repos/:repo/pakketten", MaakStudioEaImportPakkettenHandler())
	r.POST("/api/studio/projecten/:id/ea-import", MaakStudioEaImportStartHandler())
	r.GET("/api/studio/projecten/:id/ea-import", MaakStudioEaImportTaakHandler())
	r.GET("/api/studio/projecten/:id/ea-import/:taak", MaakStudioEaImportTaakHandler())
	return r
}

func doeJSON(r *gin.Engine, methode, pad string, body any) *httptest.ResponseRecorder {
	var b []byte
	if body != nil {
		b, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(methode, pad, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func wachtOpStatus(t *testing.T, r *gin.Engine, pad, status string) *httptest.ResponseRecorder {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for {
		w := doeJSON(r, "GET", pad, nil)
		if strings.Contains(w.Body.String(), `"status":"`+status+`"`) || time.Now().After(deadline) {
			return w
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestEaImportTaakLevensloop(t *testing.T) {
	wortel := t.TempDir()
	maakRepo(t, wortel, "GGM", "v2.3.0/model.qea", "v3.0.0/nieuw.qea")
	t.Setenv("STUDIO_EA_IMPORT_MAPPEN", wortel)
	t.Setenv("STUDIO_EA_IMPORT_PULL", "")
	oudRunner, oudBestaat, oudLezer := eaImportRunner, eaImportProjectBestaat, eaImportPakkettenLezer
	defer func() {
		eaImportRunner, eaImportProjectBestaat, eaImportPakkettenLezer = oudRunner, oudBestaat, oudLezer
	}()
	eaImportProjectBestaat = func(_ context.Context, id string) (bool, error) { return id == "proj-aanwezig-1", nil }
	eaImportPakkettenLezer = func(_ context.Context, qea string, _ eaImportConfig) (json.RawMessage, error) {
		if !strings.HasSuffix(filepath.ToSlash(qea), "GGM/v3.0.0/nieuw.qea") {
			t.Errorf("lezer kreeg %q", qea)
		}
		return json.RawMessage(`[{"id":328,"pad":"Model / Zandbak MW"}]`), nil
	}
	klaar := make(chan struct{})
	var gezien EaImportTaak
	var gezienPad string
	eaImportRunner = func(_ context.Context, tk *EaImportTaak, repo EaRepo, qea string, _ eaImportConfig, _ string) ([]byte, string, string, string, error) {
		gezien, gezienPad = *tk, qea
		<-klaar
		return []byte(`{"operaties":5}`), "log", "Werkbranche", "abc123", nil
	}
	r := eaImportTestRouter()

	w := doeJSON(r, "GET", "/api/studio/ea-import/repos", nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"naam":"GGM"`) || strings.Contains(w.Body.String(), filepath.ToSlash(wortel)) || strings.Contains(w.Body.String(), `"pull":true`) {
		t.Errorf("repos: %d %s (geen paden naar buiten; pull standaard uit)", w.Code, w.Body.String())
	}
	w = doeJSON(r, "GET", "/api/studio/ea-import/repos/GGM/bestanden", nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "v3.0.0/nieuw.qea") {
		t.Errorf("bestanden: %d %s", w.Code, w.Body.String())
	}
	if w := doeJSON(r, "GET", "/api/studio/ea-import/repos/Nee/bestanden", nil); w.Code != 404 {
		t.Errorf("onbekende repo: %d", w.Code)
	}
	w = doeJSON(r, "GET", "/api/studio/ea-import/repos/GGM/pakketten?bestand="+url.QueryEscape("v3.0.0/nieuw.qea"), nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Zandbak") {
		t.Errorf("pakketten: %d %s", w.Code, w.Body.String())
	}
	if w := doeJSON(r, "GET", "/api/studio/ea-import/repos/GGM/pakketten?bestand="+url.QueryEscape("../x.qea"), nil); w.Code != 404 {
		t.Errorf("bestand buiten de repo: %d", w.Code)
	}

	if w := doeJSON(r, "POST", "/api/studio/projecten/proj-onbekend-1/ea-import", gin.H{"repo": "GGM", "bestand": "v2.3.0/model.qea", "pakket": "328"}); w.Code != 404 {
		t.Errorf("onbekend project: %d %s", w.Code, w.Body.String())
	}
	if w := doeJSON(r, "POST", "/api/studio/projecten/proj-aanwezig-1/ea-import", gin.H{"repo": "GGM", "bestand": "elders.qea", "pakket": "328"}); w.Code != 400 {
		t.Errorf("onbekend bestand: %d", w.Code)
	}
	w = doeJSON(r, "POST", "/api/studio/projecten/proj-aanwezig-1/ea-import", gin.H{"repo": "GGM", "bestand": "v2.3.0/model.qea", "pakket": "328", "map": "Import", "pull": true, "droog": true})
	if w.Code != 202 {
		t.Fatalf("start: %d %s", w.Code, w.Body.String())
	}
	var start struct{ Taak string }
	_ = json.Unmarshal(w.Body.Bytes(), &start)
	if w := doeJSON(r, "POST", "/api/studio/projecten/proj-aanwezig-1/ea-import", gin.H{"repo": "GGM", "bestand": "v2.3.0/model.qea", "pakket": "1"}); w.Code != 409 {
		t.Errorf("tweede tegelijk: %d", w.Code)
	}
	close(klaar)
	w = wachtOpStatus(t, r, "/api/studio/projecten/proj-aanwezig-1/ea-import/"+start.Taak, "klaar")
	var taak EaImportTaak
	_ = json.Unmarshal(w.Body.Bytes(), &taak)
	if taak.Status != "klaar" || taak.Commit != "abc123" || taak.Branch != "Werkbranche" || string(taak.Verslag) != `{"operaties":5}` || !taak.Droog || !taak.Pull || taak.Bestand != "v2.3.0/model.qea" {
		t.Errorf("taak: %+v", taak)
	}
	if gezien.Pakket != "328" || !strings.HasSuffix(filepath.ToSlash(gezienPad), "GGM/v2.3.0/model.qea") {
		t.Errorf("runner kreeg: %+v %q", gezien, gezienPad)
	}

	// Zonder `pull` in de body geldt de serverstandaard (uit); een fout komt in `fout`.
	eaImportRunner = func(_ context.Context, tk *EaImportTaak, _ EaRepo, _ string, _ eaImportConfig, _ string) ([]byte, string, string, string, error) {
		gezien = *tk
		return nil, "stderr…", "", "", errors.New("sidecar mislukt: kapot")
	}
	if w := doeJSON(r, "POST", "/api/studio/projecten/proj-aanwezig-1/ea-import", gin.H{"repo": "GGM", "bestand": "v2.3.0/model.qea", "pakket": "328"}); w.Code != 202 {
		t.Fatalf("herstart: %d %s", w.Code, w.Body.String())
	}
	w = wachtOpStatus(t, r, "/api/studio/projecten/proj-aanwezig-1/ea-import", "fout")
	if !strings.Contains(w.Body.String(), "sidecar mislukt") || gezien.Pull {
		t.Errorf("fout/pull: %s pull=%v", w.Body.String(), gezien.Pull)
	}
	if w := doeJSON(r, "GET", "/api/studio/projecten/proj-anders-1/ea-import/"+start.Taak, nil); w.Code != 404 {
		t.Errorf("taak van ander project: %d", w.Code)
	}
}

func TestEaImportZonderInrichting(t *testing.T) {
	t.Setenv("STUDIO_EA_IMPORT_MAPPEN", "")
	r := eaImportTestRouter()
	if w := doeJSON(r, "GET", "/api/studio/ea-import/repos", nil); w.Code != 200 || !strings.Contains(w.Body.String(), `"repos":[]`) || !strings.Contains(w.Body.String(), `"ingericht":false`) {
		t.Errorf("repos leeg: %d %s", w.Code, w.Body.String())
	}
	if w := doeJSON(r, "POST", "/api/studio/projecten/proj-aanwezig-1/ea-import", gin.H{"repo": "GGM", "bestand": "x.qea", "pakket": "328"}); w.Code != http.StatusNotImplemented {
		t.Errorf("niet ingericht: %d", w.Code)
	}
}

// De echte sidecar: pakketlijst uit een fixture-bron (slaat over zonder node).
func TestEaImportPakkettenLezerMetNode(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("geen node")
	}
	dir, _ := filepath.Abs(filepath.Join("..", "web", "vite"))
	fixture := filepath.Join(dir, "src", "diagramprofielen", "ea", "fixtures", "dienstverlening.qea.json")
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "node", "--import", "./test/register-aliases.mjs", "scripts/importeer-qea.mjs", "--bron", fixture, "--lijst-pakketten", "--json")
	cmd.Dir = dir
	uit, err := cmd.Output()
	if err != nil {
		t.Fatalf("sidecar: %v", err)
	}
	var lijst []struct {
		ID  int    `json:"id"`
		Pad string `json:"pad"`
	}
	if err := json.Unmarshal(bytes.TrimSpace(uit), &lijst); err != nil || len(lijst) == 0 || lijst[0].Pad == "" {
		t.Errorf("pakketlijst: %v %s", err, uit)
	}
}
