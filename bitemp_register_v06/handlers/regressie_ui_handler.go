//go:build devtools

// Package handlers — regressie_ui_handler.go (alleen in devtools-builds)
//
// Regressie-UI: een pagina die de scenario's van de np-loc regressietest toont
// (gecodeerd in regressie_np_loc_test.go én declaratief in regressie/scenarios/*.json),
// ze alle of een selectie afspeelt via `go test -tags integration -json`, het
// resultaat live laat zien, en waarmee je declaratieve scenario's kunt toevoegen.
// Zie docs/REGRESSIETEST.md.
//
//	GET  /admin/regressie            → HTML-pagina (inline, geen CDN)
//	GET  /admin/regressie/scenarios  → JSON: scenario's incl. inhoud (Go-broncode of JSON)
//	GET  /admin/regressie/status     → JSON: snapshot van de (laatste) run
//	POST /admin/regressie/run        → start een run; body {"scenarios":[...],"dsn":"...","devtools":bool}
//	POST /admin/regressie/scenarios  → declaratief scenario opslaan in regressie/scenarios/<id>-<slug>.json
//	                                   (beide POSTs: DEVLOOP=true + X-Beheer-Wachtwoord = DEVLOOP_PASSWORD)
//
// Beveiligingsringen zoals de overige /admin/*-routes: alleen meegecompileerd met
// -tags devtools, rol "admin" bij AUTH_ENABLED=true, en de muterende acties achter
// de devloop-vlag + wachtwoord. Eén run tegelijk (mutex); een tweede krijgt 409.
package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	regressieTestBestand  = "regressie_np_loc_test.go"
	regressieTestNaam     = "TestRegressieNpLoc"
	regressieDeclaratiefD = "regressie/scenarios"
	regressieDeclParentID = "90" // gecodeerde parent-subtest waaronder de JSON-scenario's draaien
	regressieDefaultDSN   = "postgres://postgres:1234@127.0.0.1:5433/bitemp_regressie_np_loc?sslmode=disable"
)

// regressieAfhankelijkheden: scenario's die state van een eerder scenario nodig
// hebben. "00" (seed) is altijd impliciet.
var regressieAfhankelijkheden = map[string][]string{
	"06": {"05"},
	"09": {"08"},
}

var (
	regressieIDPatroon = regexp.MustCompile(`^[0-9]{2,3}[a-z]?$`)
	regressieRunRE     = regexp.MustCompile(`t\.Run\("([0-9]+[a-z]?) ([^"]+)"`)
)

type regressieScenario struct {
	ID      string `json:"id"`
	Naam    string `json:"naam"`
	Soort   string `json:"soort"`             // "go" (gecodeerd) | "json" (declaratief)
	Bestand string `json:"bestand,omitempty"` // bij json: bestandsnaam
	Inhoud  string `json:"inhoud"`            // Go-broncode van de subtest, of de JSON
}

type regressieResultaat struct {
	ID     string   `json:"id"`
	Naam   string   `json:"naam"`
	Status string   `json:"status"` // wachtend | bezig | pass | fail | skip | niet gedraaid
	Duur   float64  `json:"duur_s"`
	Output []string `json:"output,omitempty"`
}

type regressieRun struct {
	Bezig      bool                 `json:"bezig"`
	Gestart    *time.Time           `json:"gestart,omitempty"`
	Klaar      *time.Time           `json:"klaar,omitempty"`
	Selectie   []string             `json:"selectie"`
	Commando   string               `json:"commando"`
	Resultaten []regressieResultaat `json:"resultaten"`
	Log        []string             `json:"log"`
	Fout       string               `json:"fout,omitempty"`
	Samenvat   string               `json:"samenvatting,omitempty"`
}

var (
	regressieMu  sync.Mutex
	regressieRnn *regressieRun
)

// RegistreerRegressieRoutes hangt de regressie-UI aan de router (devtools-variant).
func RegistreerRegressieRoutes(router gin.IRoutes, admin gin.HandlerFunc) {
	router.GET("/admin/regressie", admin, regressiePagina)
	router.GET("/admin/regressie/scenarios", admin, regressieScenarios)
	router.POST("/admin/regressie/scenarios", admin, regressieScenarioOpslaan)
	router.GET("/admin/regressie/status", admin, regressieStatus)
	router.POST("/admin/regressie/run", admin, regressieStart)
}

// leesGecodeerdeScenarios parseert `t.Run("NN naam", …)` uit het testbestand en
// neemt per subtest de broncode mee (tot de afsluitende `\t})` op subtest-niveau).
func leesGecodeerdeScenarios() ([]regressieScenario, error) {
	pad := filepath.Join(resolveAppDir(), regressieTestBestand)
	raw, err := os.ReadFile(pad)
	if err != nil {
		return nil, fmt.Errorf("kan %s niet lezen: %w", pad, err)
	}
	src := string(raw)
	var out []regressieScenario
	for _, loc := range regressieRunRE.FindAllStringSubmatchIndex(src, -1) {
		id, naam := src[loc[2]:loc[3]], src[loc[4]:loc[5]]
		// Broncode: vanaf het begin van de regel tot de eerstvolgende "\n\t})" (einde subtest).
		start := strings.LastIndex(src[:loc[0]], "\n") + 1
		einde := strings.Index(src[loc[1]:], "\n\t})")
		inhoud := src[start:]
		if einde >= 0 {
			inhoud = src[start : loc[1]+einde+len("\n\t})")]
		}
		out = append(out, regressieScenario{ID: id, Naam: naam, Soort: "go", Inhoud: inhoud})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("geen scenario's gevonden in %s", pad)
	}
	return out, nil
}

// leesDeclaratieveScenarios leest regressie/scenarios/*.json (id/naam uit de inhoud).
func leesDeclaratieveScenarios() []regressieScenario {
	paden, _ := filepath.Glob(filepath.Join(resolveAppDir(), regressieDeclaratiefD, "*.json"))
	sort.Strings(paden)
	var out []regressieScenario
	for _, pad := range paden {
		raw, err := os.ReadFile(pad)
		if err != nil {
			continue
		}
		var kop struct {
			ID   string `json:"id"`
			Naam string `json:"naam"`
		}
		if err := json.Unmarshal(raw, &kop); err != nil || kop.ID == "" {
			out = append(out, regressieScenario{ID: "?", Naam: "ONGELDIG: " + filepath.Base(pad), Soort: "json", Bestand: filepath.Base(pad), Inhoud: string(raw)})
			continue
		}
		out = append(out, regressieScenario{ID: kop.ID, Naam: kop.Naam, Soort: "json", Bestand: filepath.Base(pad), Inhoud: string(raw)})
	}
	return out
}

func leesAlleScenarios() ([]regressieScenario, error) {
	gecodeerd, err := leesGecodeerdeScenarios()
	if err != nil {
		return nil, err
	}
	alle := append(gecodeerd, leesDeclaratieveScenarios()...)
	sort.SliceStable(alle, func(i, j int) bool { return alle[i].ID < alle[j].ID })
	return alle, nil
}

func regressieScenarios(c *gin.Context) {
	sc, err := leesAlleScenarios()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"scenarios":        sc,
		"afhankelijkheden": regressieAfhankelijkheden,
		"declaratief_map":  regressieDeclaratiefD,
		"default_dsn":      defaultRegressieDSNUitEnv(),
		"devloop":          isDevloopEnabled(),
	})
}

func defaultRegressieDSNUitEnv() string {
	if v := strings.TrimSpace(os.Getenv("REGRESSIE_DATABASE_URL")); v != "" {
		return v
	}
	return regressieDefaultDSN
}

func regressieStatus(c *gin.Context) {
	regressieMu.Lock()
	defer regressieMu.Unlock()
	if regressieRnn == nil {
		c.JSON(http.StatusOK, gin.H{"bezig": false, "resultaten": []any{}, "log": []string{}})
		return
	}
	c.JSON(http.StatusOK, regressieRnn)
}

// slug maakt een bestandsnaam-veilige variant van een naam.
func slug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 60 {
		s = s[:60]
	}
	return s
}

// regressieScenarioOpslaan schrijft een declaratief scenario naar regressie/scenarios/.
func regressieScenarioOpslaan(c *gin.Context) {
	if !isDevloopEnabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "scenario's opslaan is alleen beschikbaar in devloop modus (DEVLOOP=true)"})
		return
	}
	if !eisBeheerWachtwoord(c, "DEVLOOP_PASSWORD") {
		return
	}
	var sc struct {
		ID           string            `json:"id"`
		Naam         string            `json:"naam"`
		Beschrijving string            `json:"beschrijving,omitempty"`
		Stappen      []json.RawMessage `json:"stappen"`
		Overschrijf  bool              `json:"overschrijf"`
	}
	if err := c.ShouldBindJSON(&sc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige JSON: " + err.Error()})
		return
	}
	sc.ID = strings.TrimSpace(sc.ID)
	sc.Naam = strings.TrimSpace(sc.Naam)
	if !regressieIDPatroon.MatchString(sc.ID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id moet 2–3 cijfers zijn, optioneel gevolgd door een letter (bv. 20 of 21a)"})
		return
	}
	if sc.Naam == "" || len(sc.Stappen) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "naam en minimaal één stap zijn verplicht"})
		return
	}
	gecodeerd, _ := leesGecodeerdeScenarios()
	for _, g := range gecodeerd {
		if g.ID == sc.ID {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("id %s is al in gebruik door een gecodeerd scenario", sc.ID)})
			return
		}
	}
	for _, d := range leesDeclaratieveScenarios() {
		if d.ID == sc.ID && !sc.Overschrijf {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("id %s bestaat al (%s); vink 'overschrijven' aan om te vervangen", sc.ID, d.Bestand)})
			return
		}
	}

	// Stappen valideren op vorm (method/path/verwacht) door ze te parsen.
	for i, raw := range sc.Stappen {
		var stap struct {
			Method string `json:"method"`
			Path   string `json:"path"`
		}
		if err := json.Unmarshal(raw, &stap); err != nil || strings.TrimSpace(stap.Path) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("stap %d: 'path' is verplicht en de stap moet een JSON-object zijn", i+1)})
			return
		}
	}

	uit := map[string]any{"id": sc.ID, "naam": sc.Naam, "stappen": sc.Stappen}
	if sc.Beschrijving != "" {
		uit["beschrijving"] = sc.Beschrijving
	}
	inhoud, _ := json.MarshalIndent(uit, "", "  ")
	dir := filepath.Join(resolveAppDir(), regressieDeclaratiefD)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "kan scenario-map niet aanmaken: " + err.Error()})
		return
	}
	// Bij overschrijven: oude bestand(en) met dit id opruimen (naam/slug kan veranderd zijn).
	if sc.Overschrijf {
		oud, _ := filepath.Glob(filepath.Join(dir, sc.ID+"-*.json"))
		for _, p := range oud {
			_ = os.Remove(p)
		}
	}
	bestand := filepath.Join(dir, sc.ID+"-"+slug(sc.Naam)+".json")
	if err := os.WriteFile(bestand, append(inhoud, '\n'), 0o644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "kan scenario niet schrijven: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"bestand": filepath.Base(bestand), "id": sc.ID})
}

// regressieStart start een run. Selectie wordt aangevuld met "00" en afhankelijkheden;
// declaratieve id's draaien als sub-subtest onder "90".
func regressieStart(c *gin.Context) {
	if !isDevloopEnabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "regressie-run is alleen beschikbaar in devloop modus (DEVLOOP=true)"})
		return
	}
	if !eisBeheerWachtwoord(c, "DEVLOOP_PASSWORD") {
		return
	}

	var req struct {
		Scenarios []string `json:"scenarios"`
		DSN       string   `json:"dsn"`
		Devtools  bool     `json:"devtools"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige body: " + err.Error()})
		return
	}

	alle, err := leesAlleScenarios()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	bekend := map[string]regressieScenario{}
	for _, s := range alle {
		bekend[s.ID] = s
	}

	// Selectie bepalen: leeg = alles (dan geen -run-filter op subtests).
	goIDs := map[string]bool{}
	jsonIDs := map[string]bool{}
	allesGeselecteerd := len(req.Scenarios) == 0
	if allesGeselecteerd {
		for _, s := range alle {
			if s.Soort == "go" {
				goIDs[s.ID] = true
			} else {
				jsonIDs[s.ID] = true
			}
		}
	} else {
		var voegToe func(id string)
		voegToe = func(id string) {
			s, ok := bekend[id]
			if !ok || goIDs[id] || jsonIDs[id] {
				return
			}
			if s.Soort == "json" {
				jsonIDs[id] = true
				goIDs[regressieDeclParentID] = true
				return
			}
			goIDs[id] = true
			for _, dep := range regressieAfhankelijkheden[id] {
				voegToe(dep)
			}
		}
		voegToe("00")
		for _, id := range req.Scenarios {
			voegToe(strings.TrimSpace(id))
		}
	}
	ids := make([]string, 0, len(goIDs)+len(jsonIDs))
	for id := range goIDs {
		ids = append(ids, id)
	}
	for id := range jsonIDs {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	if len(ids) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "geen (bekende) scenario's geselecteerd"})
		return
	}

	// -run patroon per subtest-niveau: subtestnamen beginnen met "<id>_" (go test
	// vervangt spaties door _). Niveau 3 alleen filteren bij een deelselectie van
	// declaratieve scenario's; als "90" zelf gekozen is draaien ze allemaal.
	patroon := fmt.Sprintf("^%s$", regressieTestNaam)
	if !allesGeselecteerd {
		lvl2 := make([]string, 0, len(goIDs))
		for id := range goIDs {
			lvl2 = append(lvl2, id)
		}
		sort.Strings(lvl2)
		patroon += fmt.Sprintf("/^(%s)_", strings.Join(lvl2, "|"))
		expliciet90 := false
		for _, id := range req.Scenarios {
			if strings.TrimSpace(id) == regressieDeclParentID {
				expliciet90 = true
			}
		}
		if len(jsonIDs) > 0 && !expliciet90 {
			lvl3 := make([]string, 0, len(jsonIDs))
			for id := range jsonIDs {
				lvl3 = append(lvl3, id)
			}
			sort.Strings(lvl3)
			patroon += fmt.Sprintf("/^(%s)_", strings.Join(lvl3, "|"))
		}
	}
	tags := "integration"
	if req.Devtools {
		tags = "integration devtools"
	}
	dsn := strings.TrimSpace(req.DSN)
	if dsn == "" {
		dsn = defaultRegressieDSNUitEnv()
	}
	if strings.Contains(dsn, "bitemp_go_db_v06") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "weiger de dev-database als regressie-DSN; gebruik een dedicated database"})
		return
	}

	regressieMu.Lock()
	if regressieRnn != nil && regressieRnn.Bezig {
		regressieMu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "er loopt al een regressie-run"})
		return
	}
	nu := time.Now()
	run := &regressieRun{Bezig: true, Gestart: &nu, Selectie: ids}
	for _, id := range ids {
		run.Resultaten = append(run.Resultaten, regressieResultaat{ID: id, Naam: bekend[id].Naam, Status: "wachtend"})
	}
	cmd := exec.Command("go", "test", "-tags", tags, "-run", patroon, "-json", "-count=1", ".")
	cmd.Dir = resolveAppDir()
	cmd.Env = append(os.Environ(), "REGRESSIE_DATABASE_URL="+dsn)
	run.Commando = fmt.Sprintf("go test -tags %q -run %q -json -count=1 .", tags, patroon)
	regressieRnn = run
	regressieMu.Unlock()

	go voerRegressieRunUit(run, cmd)

	c.JSON(http.StatusAccepted, gin.H{"gestart": true, "selectie": ids, "commando": run.Commando})
}

// voerRegressieRunUit draait `go test -json` en verwerkt de events in de run-status.
func voerRegressieRunUit(run *regressieRun, cmd *exec.Cmd) {
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		regressieAfronden(run, "kan stdout niet openen: "+err.Error())
		return
	}
	cmd.Stderr = cmd.Stdout // buildfouten samen met de json-events loggen
	if err := cmd.Start(); err != nil {
		regressieAfronden(run, "kan go test niet starten: "+err.Error())
		return
	}

	type event struct {
		Action  string  `json:"Action"`
		Test    string  `json:"Test"`
		Output  string  `json:"Output"`
		Elapsed float64 `json:"Elapsed"`
	}
	prefix := regressieTestNaam + "/"
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		lijn := scanner.Text()
		var ev event
		if err := json.Unmarshal([]byte(lijn), &ev); err != nil {
			regressieLog(run, lijn)
			continue
		}
		if !strings.HasPrefix(ev.Test, prefix) {
			if ev.Action == "output" {
				regressieLog(run, strings.TrimRight(ev.Output, "\n"))
			}
			continue
		}
		// Id = eerste segment van het laatste subtest-niveau (niveau 2 voor gecodeerd,
		// niveau 3 voor declaratief onder "90").
		niveaus := strings.Split(strings.TrimPrefix(ev.Test, prefix), "/")
		id, _, _ := strings.Cut(niveaus[len(niveaus)-1], "_")
		regressieMu.Lock()
		for i := range run.Resultaten {
			r := &run.Resultaten[i]
			if r.ID != id {
				continue
			}
			switch ev.Action {
			case "run":
				r.Status = "bezig"
			case "pass", "fail", "skip":
				r.Status = ev.Action
				r.Duur = ev.Elapsed
			case "output":
				regel := strings.TrimSpace(ev.Output)
				// Ruis weglaten: go test-markers en GIN-accesslog; wat overblijft zijn
				// t.Log/t.Error-regels en engine-meldingen — dat wil je zien.
				if regel == "" || strings.HasPrefix(regel, "=== RUN") || strings.HasPrefix(regel, "--- ") || strings.HasPrefix(regel, "[GIN]") {
					break
				}
				if len(r.Output) < 80 {
					r.Output = append(r.Output, regel)
				}
			}
		}
		regressieMu.Unlock()
	}

	fout := ""
	if err := cmd.Wait(); err != nil {
		fout = err.Error()
	}
	regressieAfronden(run, fout)
}

func regressieLog(run *regressieRun, regel string) {
	regressieMu.Lock()
	defer regressieMu.Unlock()
	run.Log = append(run.Log, regel)
	if len(run.Log) > 200 {
		run.Log = run.Log[len(run.Log)-200:]
	}
}

func regressieAfronden(run *regressieRun, fout string) {
	regressieMu.Lock()
	defer regressieMu.Unlock()
	nu := time.Now()
	run.Bezig = false
	run.Klaar = &nu
	pass, fail, skip := 0, 0, 0
	for i := range run.Resultaten {
		switch run.Resultaten[i].Status {
		case "pass":
			pass++
		case "fail":
			fail++
		case "skip":
			skip++
		default:
			run.Resultaten[i].Status = "niet gedraaid"
		}
	}
	run.Samenvat = fmt.Sprintf("%d pass, %d fail, %d skip", pass, fail, skip)
	if fout != "" && fail == 0 {
		run.Fout = fout // run kwam niet (goed) tot testen: buildfout, DB onbereikbaar, …
	}
}

func regressiePagina(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(regressiePaginaHTML))
}

const regressiePaginaHTML = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Regressietest np-loc</title>
<style>
  :root { color-scheme: light dark; --ok:#16a34a; --fail:#dc2626; --skip:#d97706; --muted:#6b7280; --line:#e5e7eb; }
  body { font: 14px/1.45 system-ui, sans-serif; margin: 0; padding: 20px; max-width: 1100px; }
  h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 20px 0 6px; } .sub { color: var(--muted); margin-bottom: 16px; }
  .rij { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
  input[type=text], input[type=password] { padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; min-width: 260px; }
  textarea { width: 100%; min-height: 220px; font: 12px/1.4 ui-monospace, monospace; padding: 8px; border: 1px solid var(--line); border-radius: 6px; box-sizing: border-box; }
  button { padding: 7px 14px; border-radius: 6px; border: 1px solid var(--line); cursor: pointer; background: #f3f4f6; }
  button.primair { background: #2563eb; color: #fff; border-color: #2563eb; } button:disabled { opacity: .5; cursor: default; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #fff; background: var(--muted); }
  .pass { background: var(--ok); } .fail { background: var(--fail); } .skip { background: var(--skip); } .bezig { background: #2563eb; }
  .soort { font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; margin-left: 6px; }
  pre { font-size: 12px; background: #11182708; padding: 8px; border-radius: 6px; max-height: 320px; overflow: auto; white-space: pre-wrap; margin: 4px 0 0; }
  details summary { cursor: pointer; color: var(--muted); font-size: 12px; }
  .samenvatting { font-weight: 600; margin: 10px 0; }
  .waarschuwing { color: var(--fail); } .ok { color: var(--ok); }
</style>
</head>
<body>
<h1>Regressietest np-loc</h1>
<div class="sub">Speelt scenario's uit <code>regressie_np_loc_test.go</code> (gecodeerd) en <code id="declmap">regressie/scenarios/*.json</code> (declaratief) af via <code>go test -tags integration -json</code> tegen een dedicated database. Seed (00) en afhankelijkheden worden automatisch meegenomen.</div>

<div class="rij">
  <label>DSN <input type="text" id="dsn" placeholder="postgres://…/bitemp_regressie_np_loc"></label>
  <label>Wachtwoord <input type="password" id="pw" placeholder="DEVLOOP_PASSWORD"></label>
  <label><input type="checkbox" id="devtools"> devtools-build (mét /admin/*)</label>
</div>
<div class="rij">
  <button class="primair" id="alles">▶ Alles afspelen</button>
  <button id="selectie">▶ Selectie afspelen</button>
  <button id="geen">selectie wissen</button>
  <span id="melding" class="waarschuwing"></span>
</div>

<div class="samenvatting" id="samenvatting"></div>
<table>
  <thead><tr><th style="width:34px"></th><th style="width:60px">#</th><th>Scenario</th><th style="width:110px">Status</th><th style="width:70px">Duur</th></tr></thead>
  <tbody id="rijen"></tbody>
</table>
<details style="margin-top:12px"><summary>Run-log (buildfouten, go test-output)</summary><pre id="log"></pre></details>

<h2>Nieuw declaratief scenario</h2>
<div class="sub">Wordt opgeslagen als <code>regressie/scenarios/&lt;id&gt;-&lt;naam&gt;.json</code> en draait daarna mee onder scenario 90. Variabelen: <code>{{naam}}</code> uit <code>bewaar</code>, plus <code>{{seedLaatsteRegistratieID}}</code>. Verwachtingen in <code>json</code>: waarde, <code>"&gt;0"</code>, <code>"!=null"</code>, <code>"null"</code>.</div>
<div class="rij">
  <label>Id <input type="text" id="nid" placeholder="21" style="min-width:80px"></label>
  <label>Naam <input type="text" id="nnaam" placeholder="korte omschrijving"></label>
  <label><input type="checkbox" id="noverschrijf"> overschrijven als id bestaat</label>
</div>
<textarea id="nstappen"></textarea>
<div class="rij">
  <button class="primair" id="opslaan">Opslaan</button>
  <span id="nmelding"></span>
</div>

<script>
(function () {
  const $ = (id) => document.getElementById(id);
  let scenarios = [], poller = null;
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  const pw = sessionStorage.getItem('regressie_pw'); if (pw) $('pw').value = pw;
  $('nstappen').value = JSON.stringify([
    { method: 'POST', path: '/locaties', body: { id: 43 }, verwacht: { status: 201, json: { registratie_id: '>0' } }, bewaar: { regId: 'registratie_id' } },
    { method: 'GET', path: '/registraties/{{regId}}', verwacht: { status: 200, json: { registratietype: 'registratie' } } }
  ], null, 2);

  async function laadScenarios() {
    const r = await fetch('/admin/regressie/scenarios'); const d = await r.json();
    if (!r.ok) { $('melding').textContent = d.error || 'kan scenario’s niet laden'; return; }
    scenarios = d.scenarios;
    if (d.declaratief_map) $('declmap').textContent = d.declaratief_map + '/*.json';
    if (!$('dsn').value) $('dsn').value = d.default_dsn || '';
    if (!d.devloop) $('melding').textContent = 'DEVLOOP staat uit op de API; runs en opslaan worden geweigerd (bekijken kan wel).';
    render([]);
  }

  function render(resultaten) {
    const map = {}; (resultaten || []).forEach(r => map[r.id] = r);
    const gekozen = {}; document.querySelectorAll('input[data-id]').forEach(e => gekozen[e.dataset.id] = e.checked);
    $('rijen').innerHTML = scenarios.map(s => {
      const r = map[s.id]; const st = r ? r.status : '';
      const klasse = { pass: 'pass', fail: 'fail', skip: 'skip', bezig: 'bezig' }[st] || '';
      const badge = st ? '<span class="badge ' + klasse + '">' + esc(st) + '</span>' : '';
      const duur = r && r.duur_s ? r.duur_s.toFixed(2) + 's' : '';
      const out = r && r.output && r.output.length ? '<details><summary>output (' + r.output.length + ')</summary><pre>' + esc(r.output.join('\n')) + '</pre></details>' : '';
      const inhoud = s.inhoud ? '<details><summary>inhoud (' + (s.soort === 'json' ? esc(s.bestand || 'json') : 'Go') + ')</summary><pre>' + esc(s.inhoud) + '</pre></details>' : '';
      const vast = s.id === '00' ? ' checked disabled title="seed draait altijd mee"' : (gekozen[s.id] ? ' checked' : '');
      return '<tr><td><input type="checkbox" data-id="' + esc(s.id) + '"' + vast + '></td><td>' + esc(s.id) + '</td><td>' + esc(s.naam) + '<span class="soort">' + esc(s.soort) + '</span>' + inhoud + out + '</td><td>' + badge + '</td><td>' + duur + '</td></tr>';
    }).join('');
  }

  async function status() {
    const r = await fetch('/admin/regressie/status'); const d = await r.json();
    render(d.resultaten);
    $('samenvatting').textContent = (d.bezig ? '⏳ bezig… ' : '') + (d.samenvatting || '') + (d.fout ? '  — fout: ' + d.fout : '');
    $('log').textContent = (d.log || []).join('\n');
    $('alles').disabled = $('selectie').disabled = !!d.bezig;
    if (!d.bezig && poller) { clearInterval(poller); poller = null; }
  }

  async function start(alle) {
    $('melding').textContent = '';
    sessionStorage.setItem('regressie_pw', $('pw').value);
    const gekozen = alle ? [] : Array.from(document.querySelectorAll('input[data-id]:checked')).map(e => e.dataset.id);
    if (!alle && gekozen.length <= 1) { $('melding').textContent = 'Selecteer minimaal één scenario.'; return; }
    const r = await fetch('/admin/regressie/run', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Beheer-Wachtwoord': $('pw').value },
      body: JSON.stringify({ scenarios: gekozen, dsn: $('dsn').value, devtools: $('devtools').checked }) });
    const d = await r.json();
    if (!r.ok) { $('melding').textContent = d.error || ('fout ' + r.status); return; }
    if (!poller) poller = setInterval(status, 1000);
    status();
  }

  async function opslaan() {
    $('nmelding').className = ''; $('nmelding').textContent = '';
    sessionStorage.setItem('regressie_pw', $('pw').value);
    let stappen;
    try { stappen = JSON.parse($('nstappen').value); } catch (e) { $('nmelding').className = 'waarschuwing'; $('nmelding').textContent = 'stappen is geen geldige JSON: ' + e.message; return; }
    if (!Array.isArray(stappen)) { $('nmelding').className = 'waarschuwing'; $('nmelding').textContent = 'stappen moet een array zijn'; return; }
    const r = await fetch('/admin/regressie/scenarios', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Beheer-Wachtwoord': $('pw').value },
      body: JSON.stringify({ id: $('nid').value, naam: $('nnaam').value, stappen: stappen, overschrijf: $('noverschrijf').checked }) });
    const d = await r.json();
    if (!r.ok) { $('nmelding').className = 'waarschuwing'; $('nmelding').textContent = d.error || ('fout ' + r.status); return; }
    $('nmelding').className = 'ok'; $('nmelding').textContent = 'opgeslagen als ' + d.bestand;
    await laadScenarios(); status();
  }

  $('alles').onclick = () => start(true);
  $('selectie').onclick = () => start(false);
  $('geen').onclick = () => document.querySelectorAll('input[data-id]:not(:disabled)').forEach(e => e.checked = false);
  $('opslaan').onclick = opslaan;
  laadScenarios().then(status);
})();
</script>
</body>
</html>`
