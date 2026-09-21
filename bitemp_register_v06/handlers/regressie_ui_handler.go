//go:build devtools

// Package handlers — regressie-UI / suite-editor (alleen in devtools-builds).
//
// Een pagina op /admin/regressie waarmee je de np-loc testsuite beheert en draait:
// scenario's bekijken, bewerken, herordenen, dupliceren, (selecties van) stappen naar
// een nieuw scenario kopiëren, replay-bestanden importeren als bewerkbaar scenario,
// de suite of een selectie afspelen, loadtests draaien en scenario's exporteren naar
// k6/Hurl. Scenario's staan als JSON in regressie/scenarios/ (formaat: zie
// regressie_declaratief_test.go); alleen 00 (DB-reset + seed) is Go-code.
//
// Bestanden:
//
//	regressie_ui_handler.go  routes, scenario's lezen, regressie-run + status
//	regressie_ui_beheer.go   opslaan, verwijderen, volgorde, replay-import
//	regressie_ui_load.go     loadtest-run + status
//	regressie_ui_export.go   export naar k6 en Hurl
//	regressie_ui_pagina.go   de HTML/JS van de pagina
//
// Beveiligingsringen zoals de overige /admin/*-routes: alleen meegecompileerd met
// -tags devtools, rol "admin" bij AUTH_ENABLED=true, en alle muterende/uitvoerende
// acties achter DEVLOOP=true + X-Beheer-Wachtwoord (DEVLOOP_PASSWORD). Eén run
// (regressie of load) tegelijk; een tweede krijgt 409.
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
	regressieLoadTestNaam = "TestLoadNpLoc"
	regressieDeclaratiefD = "regressie/scenarios"
	regressieDefaultDSN   = "postgres://postgres:1234@127.0.0.1:5433/bitemp_regressie_np_loc?sslmode=disable"
)

var (
	regressieIDPatroon = regexp.MustCompile(`^[0-9]{2,3}[a-z]?$`)
	regressieRunRE     = regexp.MustCompile(`t\.Run\("([0-9]+[a-z]?) ([^"]+)"`)
	regressieSeedsRE   = regexp.MustCompile(`(?s)defaultSeeds = \[\]string\{(.*?)\}`)
)

// regressieScenarioDef is de scenario-JSON zoals die op schijf staat. Stappen en load
// blijven rauw, zodat de editor er vrij in kan zijn en niets verloren gaat.
type regressieScenarioDef struct {
	ID           string            `json:"id"`
	Naam         string            `json:"naam"`
	Beschrijving string            `json:"beschrijving,omitempty"`
	Volgorde     int               `json:"volgorde,omitempty"`
	Vereist      []string          `json:"vereist,omitempty"`
	Dekt         []string          `json:"dekt,omitempty"`
	Tags         []string          `json:"tags,omitempty"`
	Uit          bool              `json:"uit,omitempty"`
	Env          map[string]string `json:"env,omitempty"`
	Vars         map[string]string `json:"vars,omitempty"`
	Load         json.RawMessage   `json:"load,omitempty"`
	Stappen      []json.RawMessage `json:"stappen"`
}

// regressieScenario is wat de UI per scenario krijgt.
type regressieScenario struct {
	ID        string                `json:"id"`
	Naam      string                `json:"naam"`
	Soort     string                `json:"soort"` // "go" (alleen 00) | "json"
	Bestand   string                `json:"bestand,omitempty"`
	Inhoud    string                `json:"inhoud"`
	Definitie *regressieScenarioDef `json:"definitie,omitempty"`
	Seeds     []regressieSeed       `json:"seeds,omitempty"`
	Fout      string                `json:"fout,omitempty"`
}

// regressieSeed is één replay-bestand dat scenario 00 afspeelt.
type regressieSeed struct {
	Bestand      string   `json:"bestand"`
	Aantal       int      `json:"aantal"`
	Samenvatting []string `json:"samenvatting"`
	Inhoud       string   `json:"inhoud"`
	Fout         string   `json:"fout,omitempty"`
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
	regressieLd  *regressieLoadRun
)

// RegistreerRegressieRoutes hangt de suite-editor aan de router (devtools-variant).
func RegistreerRegressieRoutes(router gin.IRoutes, admin gin.HandlerFunc) {
	router.GET("/admin/regressie", admin, regressiePagina)
	router.GET("/admin/regressie/scenarios", admin, regressieScenarios)
	router.POST("/admin/regressie/scenarios", admin, regressieScenarioOpslaan)
	router.DELETE("/admin/regressie/scenarios/:id", admin, regressieScenarioVerwijderen)
	router.POST("/admin/regressie/volgorde", admin, regressieVolgordeOpslaan)
	router.POST("/admin/regressie/import-replay", admin, regressieImportReplay)
	router.GET("/admin/regressie/status", admin, regressieStatus)
	router.POST("/admin/regressie/run", admin, regressieStart)
	router.GET("/admin/regressie/load/status", admin, regressieLoadStatus)
	router.POST("/admin/regressie/load", admin, regressieLoadStart)
	router.GET("/admin/regressie/export/:formaat", admin, regressieExport)
}

// eisRegressieMutatie bundelt de checks voor muterende/uitvoerende acties.
func eisRegressieMutatie(c *gin.Context) bool {
	if !isDevloopEnabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "deze actie is alleen beschikbaar in devloop modus (DEVLOOP=true)"})
		return false
	}
	return eisBeheerWachtwoord(c, "DEVLOOP_PASSWORD")
}

func regressieScenarioDir() string {
	return filepath.Join(resolveAppDir(), regressieDeclaratiefD)
}

// ── Scenario's lezen ────────────────────────────────────────────────────────

// leesGecodeerdeScenarios parseert `t.Run("NN naam", …)` uit het testbestand (in de
// praktijk alleen 00) en neemt de broncode + seed-bestanden mee.
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
		start := strings.LastIndex(src[:loc[0]], "\n") + 1
		einde := strings.Index(src[loc[1]:], "\n\t})")
		inhoud := src[start:]
		if einde >= 0 {
			inhoud = src[start : loc[1]+einde+len("\n\t})")]
		}
		sc := regressieScenario{ID: id, Naam: naam, Soort: "go", Inhoud: inhoud}
		if id == "00" {
			sc.Seeds = leesRegressieSeeds(src)
		}
		out = append(out, sc)
	}
	return out, nil
}

// leesDeclaratieveScenarios leest regressie/scenarios/*.json, gesorteerd op (volgorde, id).
func leesDeclaratieveScenarios() []regressieScenario {
	paden, _ := filepath.Glob(filepath.Join(regressieScenarioDir(), "*.json"))
	var out []regressieScenario
	for _, pad := range paden {
		raw, err := os.ReadFile(pad)
		if err != nil {
			continue
		}
		sc := regressieScenario{Soort: "json", Bestand: filepath.Base(pad), Inhoud: string(raw)}
		var def regressieScenarioDef
		if err := json.Unmarshal(raw, &def); err != nil || def.ID == "" {
			sc.ID, sc.Naam, sc.Fout = "?", "ONGELDIG: "+filepath.Base(pad), "ongeldige scenario-JSON"
			if err != nil {
				sc.Fout = err.Error()
			}
		} else {
			sc.ID, sc.Naam, sc.Definitie = def.ID, def.Naam, &def
		}
		out = append(out, sc)
	}
	sort.SliceStable(out, func(i, j int) bool {
		vi, vj := 1<<30, 1<<30
		if out[i].Definitie != nil && out[i].Definitie.Volgorde > 0 {
			vi = out[i].Definitie.Volgorde
		}
		if out[j].Definitie != nil && out[j].Definitie.Volgorde > 0 {
			vj = out[j].Definitie.Volgorde
		}
		if vi != vj {
			return vi < vj
		}
		return out[i].ID < out[j].ID
	})
	return out
}

func leesAlleScenarios() ([]regressieScenario, error) {
	gecodeerd, err := leesGecodeerdeScenarios()
	if err != nil {
		return nil, err
	}
	return append(gecodeerd, leesDeclaratieveScenarios()...), nil
}

// leesRegressieSeeds bepaalt de seed-bestanden (REGRESSIE_SEEDS, anders defaultSeeds
// uit het testbestand) en leest ze in met een samenvatting per replay-entry.
func leesRegressieSeeds(testSrc string) []regressieSeed {
	var paden []string
	if env := strings.TrimSpace(os.Getenv("REGRESSIE_SEEDS")); env != "" {
		for _, p := range strings.Split(env, ";") {
			if p = strings.TrimSpace(p); p != "" {
				paden = append(paden, p)
			}
		}
	} else if m := regressieSeedsRE.FindStringSubmatch(testSrc); len(m) == 2 {
		for _, q := range regexp.MustCompile(`"([^"]+)"`).FindAllStringSubmatch(m[1], -1) {
			paden = append(paden, q[1])
		}
	}
	var out []regressieSeed
	for _, pad := range paden {
		out = append(out, leesReplaySamenvatting(pad))
	}
	return out
}

type replayEntry struct {
	RequestPath          string          `json:"request_path"`
	RequestMethod        string          `json:"request_method"`
	RequestBody          json.RawMessage `json:"request_body"`
	ExpectedResponseCode *int            `json:"expected_response_code"`
}

// leesReplayEntries leest de entries van een replay-bestand (pad relatief aan de app-map).
func leesReplayEntries(pad string) ([]replayEntry, []byte, error) {
	raw, err := os.ReadFile(filepath.Join(resolveAppDir(), pad))
	if err != nil {
		return nil, nil, fmt.Errorf("kan bestand niet lezen: %w", err)
	}
	var rb struct {
		Entries []replayEntry `json:"entries"`
	}
	if err := json.Unmarshal(raw, &rb); err != nil {
		return nil, raw, fmt.Errorf("geen geldig replay-bestand: %w", err)
	}
	return rb.Entries, raw, nil
}

// replayEntryKop haalt registratietype, opmerking en de opvoer/afvoer-sleutels uit een entry.
func replayEntryKop(e replayEntry) (regtype, opmerking string, delen []string) {
	var body struct {
		Registratie struct {
			Registratietype string `json:"registratietype"`
			Opmerking       string `json:"opmerking"`
		} `json:"registratie"`
		Wijzigingen []map[string]map[string]any `json:"wijzigingen"`
	}
	_ = json.Unmarshal(e.RequestBody, &body)
	telling := map[string]int{}
	for _, w := range body.Wijzigingen {
		for modus, rep := range w {
			for veldnaam := range rep {
				telling[modus[:1]+":"+veldnaam]++
			}
		}
	}
	for k, n := range telling {
		if n > 1 {
			k = fmt.Sprintf("%s×%d", k, n)
		}
		delen = append(delen, k)
	}
	sort.Strings(delen)
	return body.Registratie.Registratietype, body.Registratie.Opmerking, delen
}

func leesReplaySamenvatting(pad string) regressieSeed {
	seed := regressieSeed{Bestand: pad}
	entries, raw, err := leesReplayEntries(pad)
	seed.Inhoud = string(raw)
	if err != nil {
		seed.Fout = err.Error()
		return seed
	}
	seed.Aantal = len(entries)
	for i, e := range entries {
		regtype, opmerking, delen := replayEntryKop(e)
		verwacht := 201
		if e.ExpectedResponseCode != nil {
			verwacht = *e.ExpectedResponseCode
		}
		seed.Samenvatting = append(seed.Samenvatting, fmt.Sprintf("%2d  %-14s %-42s → %d  [%s]",
			i, regtype, kortTekst(opmerking, 42), verwacht, strings.Join(delen, " ")))
	}
	return seed
}

func kortTekst(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}

func regressieScenarios(c *gin.Context) {
	sc, err := leesAlleScenarios()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Dekking (traceability): referentie → scenario-id's.
	dekking := map[string][]string{}
	for _, s := range sc {
		if s.Definitie == nil {
			continue
		}
		for _, ref := range s.Definitie.Dekt {
			dekking[ref] = append(dekking[ref], s.ID)
		}
	}

	var replays []string
	if paden, _ := filepath.Glob(filepath.Join(resolveAppDir(), "replay files", "*.json")); len(paden) > 0 {
		for _, p := range paden {
			replays = append(replays, "replay files/"+filepath.Base(p))
		}
		sort.Strings(replays)
	}
	c.JSON(http.StatusOK, gin.H{
		"scenarios":        sc,
		"dekking":          dekking,
		"declaratief_map":  regressieDeclaratiefD,
		"replay_bestanden": replays,
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

// ── Regressie-run ───────────────────────────────────────────────────────────

func regressieStatus(c *gin.Context) {
	regressieMu.Lock()
	defer regressieMu.Unlock()
	if regressieRnn == nil {
		c.JSON(http.StatusOK, gin.H{"bezig": false, "resultaten": []any{}, "log": []string{}})
		return
	}
	c.JSON(http.StatusOK, regressieRnn)
}

// ietsBezig meldt of er een regressie- of loadrun loopt (mutex moet vastgehouden zijn).
func ietsBezig() bool {
	return (regressieRnn != nil && regressieRnn.Bezig) || (regressieLd != nil && regressieLd.Bezig)
}

// regressieStart start een run. Een selectie wordt aangevuld met 00 (seed) en, transitief,
// de scenario's uit `vereist`.
func regressieStart(c *gin.Context) {
	if !eisRegressieMutatie(c) {
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

	selectie := map[string]bool{}
	allesGeselecteerd := len(req.Scenarios) == 0
	if allesGeselecteerd {
		for _, s := range alle {
			selectie[s.ID] = true
		}
	} else {
		var voegToe func(id string)
		voegToe = func(id string) {
			s, ok := bekend[id]
			if !ok || selectie[id] {
				return
			}
			selectie[id] = true
			if s.Definitie != nil {
				for _, dep := range s.Definitie.Vereist {
					voegToe(dep)
				}
			}
		}
		voegToe("00")
		for _, id := range req.Scenarios {
			voegToe(strings.TrimSpace(id))
		}
	}
	// Resultaatvolgorde = suitevolgorde.
	var ids []string
	for _, s := range alle {
		if selectie[s.ID] {
			ids = append(ids, s.ID)
		}
	}
	if len(ids) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "geen (bekende) scenario's geselecteerd"})
		return
	}

	// Subtestnamen beginnen met "<id>_" (go test vervangt spaties door _).
	patroon := fmt.Sprintf("^%s$", regressieTestNaam)
	if !allesGeselecteerd {
		gesorteerd := append([]string(nil), ids...)
		sort.Strings(gesorteerd)
		patroon += fmt.Sprintf("/^(%s)_", strings.Join(gesorteerd, "|"))
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
	if ietsBezig() {
		regressieMu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "er loopt al een run (regressie of load)"})
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
	cmd.Stderr = cmd.Stdout
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
				if regel == "" || strings.HasPrefix(regel, "=== RUN") || strings.HasPrefix(regel, "--- ") || strings.HasPrefix(regel, "[GIN]") {
					break
				}
				// Bestandsverwijzing van de testhelper weglaten: leest rustiger.
				regel = regexp.MustCompile(`^\S+_test\.go:\d+: `).ReplaceAllString(regel, "")
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
