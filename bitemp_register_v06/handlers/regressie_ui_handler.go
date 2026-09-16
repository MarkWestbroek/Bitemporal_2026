//go:build devtools

// Package handlers — regressie_ui_handler.go (alleen in devtools-builds)
//
// Regressie-UI: een pagina die de scenario's uit regressie_np_loc_test.go toont,
// ze (alle of een selectie) afspeelt via `go test -tags integration -json` en
// het resultaat live laat zien. Zie docs/REGRESSIETEST.md.
//
//	GET  /admin/regressie            → HTML-pagina (inline, geen CDN)
//	GET  /admin/regressie/scenarios  → JSON: scenario's (geparsed uit het testbestand)
//	GET  /admin/regressie/status     → JSON: snapshot van de (laatste) run
//	POST /admin/regressie/run        → start een run; body {"scenarios":[...],"dsn":"...","devtools":bool}
//	                                   vereist DEVLOOP=true + X-Beheer-Wachtwoord (DEVLOOP_PASSWORD)
//
// Beveiligingsringen zoals de overige /admin/*-routes: alleen meegecompileerd met
// -tags devtools, rol "admin" bij AUTH_ENABLED=true, en de run-actie achter de
// devloop-vlag + wachtwoord. Eén run tegelijk (mutex); een tweede krijgt 409.
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
	regressieTestBestand = "regressie_np_loc_test.go"
	regressieTestNaam    = "TestRegressieNpLoc"
	regressieDefaultDSN  = "postgres://postgres:1234@127.0.0.1:5433/bitemp_regressie_np_loc?sslmode=disable"
)

// regressieAfhankelijkheden: scenario's die state van een eerder scenario nodig
// hebben. "00" (seed) is altijd impliciet.
var regressieAfhankelijkheden = map[string][]string{
	"06": {"05"},
	"09": {"08"},
}

type regressieScenario struct {
	ID   string `json:"id"`
	Naam string `json:"naam"`
}

type regressieResultaat struct {
	ID     string   `json:"id"`
	Naam   string   `json:"naam"`
	Status string   `json:"status"` // wachtend | bezig | pass | fail | skip
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
	router.GET("/admin/regressie/status", admin, regressieStatus)
	router.POST("/admin/regressie/run", admin, regressieStart)
}

// leesRegressieScenarios parseert `t.Run("NN naam", …)` uit het testbestand.
func leesRegressieScenarios() ([]regressieScenario, error) {
	pad := filepath.Join(resolveAppDir(), regressieTestBestand)
	src, err := os.ReadFile(pad)
	if err != nil {
		return nil, fmt.Errorf("kan %s niet lezen: %w", pad, err)
	}
	re := regexp.MustCompile(`t\.Run\("([0-9]+[a-z]?) ([^"]+)"`)
	var out []regressieScenario
	for _, m := range re.FindAllStringSubmatch(string(src), -1) {
		out = append(out, regressieScenario{ID: m[1], Naam: m[2]})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("geen scenario's gevonden in %s", pad)
	}
	return out, nil
}

func regressieScenarios(c *gin.Context) {
	sc, err := leesRegressieScenarios()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"scenarios":        sc,
		"afhankelijkheden": regressieAfhankelijkheden,
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

// regressieStart start een run. Selectie wordt aangevuld met "00" en afhankelijkheden.
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

	alle, err := leesRegressieScenarios()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	bekend := map[string]regressieScenario{}
	for _, s := range alle {
		bekend[s.ID] = s
	}

	// Selectie bepalen: leeg = alles; anders aanvullen met seed + afhankelijkheden.
	selectie := map[string]bool{}
	if len(req.Scenarios) == 0 {
		for _, s := range alle {
			selectie[s.ID] = true
		}
	} else {
		var voegToe func(id string)
		voegToe = func(id string) {
			if selectie[id] {
				return
			}
			if _, ok := bekend[id]; !ok {
				return
			}
			selectie[id] = true
			for _, dep := range regressieAfhankelijkheden[id] {
				voegToe(dep)
			}
		}
		voegToe("00")
		for _, id := range req.Scenarios {
			voegToe(strings.TrimSpace(id))
		}
	}
	ids := make([]string, 0, len(selectie))
	for id := range selectie {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	if len(ids) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "geen (bekende) scenario's geselecteerd"})
		return
	}

	// -run patroon: subtestnaam begint met "<id>_" (go test vervangt spaties door _).
	patroon := fmt.Sprintf("^%s$/^(%s)_", regressieTestNaam, strings.Join(ids, "|"))
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
	cmd.Stderr = cmd.Stdout // go test -json schrijft buildfouten naar stderr; samen loggen
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
			regressieLog(run, lijn) // geen JSON (bv. buildfout) → rauw loggen
			continue
		}
		if !strings.HasPrefix(ev.Test, prefix) {
			if ev.Action == "output" {
				regressieLog(run, strings.TrimRight(ev.Output, "\n"))
			}
			continue
		}
		id, _, _ := strings.Cut(strings.TrimPrefix(ev.Test, prefix), "_")
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
			// Niet gedraaid (bv. buildfout of afgebroken parent) → als fout markeren.
			run.Resultaten[i].Status = "niet gedraaid"
		}
	}
	run.Samenvat = fmt.Sprintf("%d pass, %d fail, %d skip", pass, fail, skip)
	if fout != "" && fail == 0 && pass == 0 {
		run.Fout = fout // run kwam niet tot testen (buildfout, DB onbereikbaar, …)
	} else if fout != "" && fail == 0 {
		run.Fout = fout
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
  h1 { font-size: 20px; margin: 0 0 4px; } .sub { color: var(--muted); margin-bottom: 16px; }
  .rij { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
  input[type=text], input[type=password] { padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; min-width: 260px; }
  button { padding: 7px 14px; border-radius: 6px; border: 1px solid var(--line); cursor: pointer; background: #f3f4f6; }
  button.primair { background: #2563eb; color: #fff; border-color: #2563eb; } button:disabled { opacity: .5; cursor: default; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #fff; background: var(--muted); }
  .pass { background: var(--ok); } .fail { background: var(--fail); } .skip { background: var(--skip); } .bezig { background: #2563eb; }
  pre { font-size: 12px; background: #11182708; padding: 8px; border-radius: 6px; max-height: 260px; overflow: auto; white-space: pre-wrap; margin: 4px 0 0; }
  details summary { cursor: pointer; color: var(--muted); font-size: 12px; }
  .samenvatting { font-weight: 600; margin: 10px 0; }
  .waarschuwing { color: var(--fail); }
</style>
</head>
<body>
<h1>Regressietest np-loc</h1>
<div class="sub">Speelt scenario's uit <code>regressie_np_loc_test.go</code> af via <code>go test -tags integration -json</code> tegen een dedicated database. Seed (00) en afhankelijkheden worden automatisch meegenomen.</div>

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

<script>
(function () {
  const $ = (id) => document.getElementById(id);
  let scenarios = [], deps = {}, poller = null;

  const pw = sessionStorage.getItem('regressie_pw'); if (pw) $('pw').value = pw;

  async function laadScenarios() {
    const r = await fetch('/admin/regressie/scenarios'); const d = await r.json();
    if (!r.ok) { $('melding').textContent = d.error || 'kan scenario’s niet laden'; return; }
    scenarios = d.scenarios; deps = d.afhankelijkheden || {};
    if (!$('dsn').value) $('dsn').value = d.default_dsn || '';
    if (!d.devloop) $('melding').textContent = 'DEVLOOP staat uit op de API; runs worden geweigerd (wel te bekijken).';
    render({});
  }

  function render(resultaten) {
    const map = {}; (resultaten || []).forEach(r => map[r.id] = r);
    $('rijen').innerHTML = scenarios.map(s => {
      const r = map[s.id]; const st = r ? r.status : '';
      const klasse = { pass: 'pass', fail: 'fail', skip: 'skip', bezig: 'bezig' }[st] || '';
      const badge = st ? '<span class="badge ' + klasse + '">' + st + '</span>' : '';
      const duur = r && r.duur_s ? r.duur_s.toFixed(2) + 's' : '';
      const out = r && r.output && r.output.length ? '<details><summary>output (' + r.output.length + ')</summary><pre>' + esc(r.output.join('\n')) + '</pre></details>' : '';
      const vast = s.id === '00' ? ' checked disabled title="seed draait altijd mee"' : '';
      const keep = document.querySelector('input[data-id="' + s.id + '"]');
      const checked = keep ? (keep.checked ? ' checked' : '') : '';
      return '<tr><td><input type="checkbox" data-id="' + s.id + '"' + (vast || checked) + '></td><td>' + s.id + '</td><td>' + esc(s.naam) + out + '</td><td>' + badge + '</td><td>' + duur + '</td></tr>';
    }).join('');
  }
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

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

  $('alles').onclick = () => start(true);
  $('selectie').onclick = () => start(false);
  $('geen').onclick = () => document.querySelectorAll('input[data-id]:not(:disabled)').forEach(e => e.checked = false);
  laadScenarios().then(status);
})();
</script>
</body>
</html>`
