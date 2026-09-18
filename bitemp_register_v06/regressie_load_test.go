//go:build integration

// regressie_load_test.go — load-/performancetest op basis van declaratieve scenario's.
//
// Hergebruikt het scenarioformaat uit regressie_declaratief_test.go: elk scenario met
// request-stappen kan als loadtest draaien. N virtuele gebruikers (vus) spelen elk
// `iteraties` keer de stappen af, in-process tegen de échte API + Postgres. Per stap
// worden latenties gemeten; drempels uit `load.drempels` laten de test falen
// (performance-regressie) — hetzelfde idee als k6-thresholds, maar dan tegen dezelfde
// in-process omgeving als de functionele suite.
//
//	LOAD_SCENARIO=30 LOAD_VUS=8 LOAD_ITERATIES=25 \
//	  go test -tags integration -run TestLoadNpLoc -v -count=1 .
//
// Rollen (gemengde belasting): een scenario met `load.mix` speelt meerdere scenario's
// TEGELIJK af, elk met eigen vus/iteraties — bv. 3 schrijvers (sc 31) naast 20 lezers
// (sc 32). Zo test je opvragen terwijl er geregistreerd wordt.
//
// Omgevingsvariabelen:
//
//	LOAD_SCENARIO    id van het scenario (verplicht)
//	LOAD_VUS, LOAD_ITERATIES   overschrijven het loadprofiel (bij mix: van elke rol)
//	LOAD_BEHOUD=1    database NIET resetten/seeden: draai op de bestaande (gevulde) dataset
//	LOAD_SEED        seed voor {{rnd:a-b}} en `kans` (default 1; zelfde seed = zelfde reeks)
//	LOAD_VARS        "npTot=2000;locTot=2000" — overschrijft scenario-`vars`
//	REGRESSIE_SEEDS  replay-bestanden voor de seed (bij reset), bv. een dik gegenereerd bestand
//	LOAD_UIT         pad voor het JSON-resultaat
//
// Variabelen per uitvoering: {{vu}} (1..vus, doorlopend over rollen), {{iter}} en
// {{uniek}} (= 100000 + vu*10000 + iter — uniek per vu/iteratie, bruikbaar als entiteit-id;
// bij LOAD_BEHOUD schuift de basis mee met de klok, zodat herhaalde runs niet botsen).
// Replay- en actie-stappen worden in een loadtest overgeslagen (wel gelogd).
//
// Resultaat: tabel in de testoutput, en als JSON naar LOAD_UIT (indien gezet) en naar
// perf-results/regressie-load-<scenario>-<tijdstip>.json.
package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

type loadStapResultaat struct {
	Rol    string  `json:"rol,omitempty"`
	Naam   string  `json:"naam"`
	Aantal int     `json:"aantal"`
	Fouten int     `json:"fouten"`
	GemMs  float64 `json:"gem_ms"`
	P50Ms  float64 `json:"p50_ms"`
	P95Ms  float64 `json:"p95_ms"`
	P99Ms  float64 `json:"p99_ms"`
	MaxMs  float64 `json:"max_ms"`
}

type loadRolResultaat struct {
	Scenario  string `json:"scenario"`
	Naam      string `json:"naam"`
	VUs       int    `json:"vus"`
	Iteraties int    `json:"iteraties"`
}

type loadResultaat struct {
	Scenario      string              `json:"scenario"`
	Naam          string              `json:"naam"`
	Tijdstip      time.Time           `json:"tijdstip"`
	VUs           int                 `json:"vus"`
	Iteraties     int                 `json:"iteraties"`
	Rollen        []loadRolResultaat  `json:"rollen,omitempty"`
	Behoud        bool                `json:"behoud"`
	Seed          int64               `json:"seed"`
	Vars          map[string]string   `json:"vars,omitempty"`
	DuurS         float64             `json:"duur_s"`
	Requests      int                 `json:"requests"`
	RPS           float64             `json:"rps"`
	Fouten        int                 `json:"fouten"`
	FoutPct       float64             `json:"fout_pct"`
	P95Ms         float64             `json:"p95_ms"`
	Stappen       []loadStapResultaat `json:"stappen"`
	Voorbeelden   []string            `json:"fout_voorbeelden,omitempty"`
	DrempelP95Ms  float64             `json:"drempel_p95_ms,omitempty"`
	DrempelFout   float64             `json:"drempel_fout_pct"`
	DrempelsOK    bool                `json:"drempels_ok"`
	DrempelReden  []string            `json:"drempel_reden,omitempty"`
	Overgeslagen  []string            `json:"overgeslagen_stappen,omitempty"`
	GoTestCommand string              `json:"commando,omitempty"`
}

func percentiel(gesorteerd []float64, p float64) float64 {
	if len(gesorteerd) == 0 {
		return 0
	}
	idx := int(math.Ceil(p/100*float64(len(gesorteerd)))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(gesorteerd) {
		idx = len(gesorteerd) - 1
	}
	return gesorteerd[idx]
}

func rond(f float64) float64 { return math.Round(f*100) / 100 }

func envInt(naam string, standaard int) int {
	if v, err := strconv.Atoi(strings.TrimSpace(os.Getenv(naam))); err == nil && v > 0 {
		return v
	}
	return standaard
}

// envVars leest "k=v;k2=v2" (LOAD_VARS).
func envVars(naam string) map[string]string {
	out := map[string]string{}
	for _, deel := range strings.Split(os.Getenv(naam), ";") {
		if k, v, ok := strings.Cut(deel, "="); ok && strings.TrimSpace(k) != "" {
			out[strings.TrimSpace(k)] = strings.TrimSpace(v)
		}
	}
	return out
}

// loadStap is een request-stap in een loadtest, met zijn positie in het scenario.
type loadStap struct {
	index int
	stap  declStap
}

// loadRol is één gelijktijdig afgespeelde groep vus met eigen scenario-stappen.
type loadRol struct {
	sc        declScenario
	naam      string // "" bij een enkel scenario; anders "<id> <naam>"
	vus       int
	iteraties int
	stappen   []loadStap
	eersteVU  int // doorlopende vu-nummering over rollen → {{uniek}} blijft uniek
}

// loadStappen filtert de request-stappen van een scenario (replay/actie/uit worden gelogd).
func loadStappen(sc declScenario) (stappen []loadStap, overgeslagen []string) {
	for i, s := range sc.Stappen {
		if s.Uit || s.Replay != "" || s.Actie != "" {
			overgeslagen = append(overgeslagen, sc.ID+": "+stapLabel(i, s, s.Replay))
			continue
		}
		stappen = append(stappen, loadStap{i, s})
	}
	return stappen, overgeslagen
}

func TestLoadNpLoc(t *testing.T) {
	scenarioID := strings.TrimSpace(os.Getenv("LOAD_SCENARIO"))
	if scenarioID == "" {
		t.Skip("LOAD_SCENARIO niet gezet (bv. LOAD_SCENARIO=30); loadtest overgeslagen")
	}

	alle := laadDeclaratieveScenarios(t)
	zoek := func(id string) *declScenario {
		for _, kandidaat := range alle {
			if kandidaat.ID == id {
				k := kandidaat
				return &k
			}
		}
		return nil
	}
	sc := zoek(scenarioID)
	if sc == nil {
		t.Fatalf("scenario %q niet gevonden in %s", scenarioID, declaratieveScenarioMap)
	}

	// Loadprofiel van het hoofdscenario.
	vus, iteraties := 5, 20
	var drempelP95, drempelFout float64
	if sc.Load != nil {
		if sc.Load.VUs > 0 {
			vus = sc.Load.VUs
		}
		if sc.Load.Iteraties > 0 {
			iteraties = sc.Load.Iteraties
		}
		drempelP95, drempelFout = sc.Load.Drempels.P95Ms, sc.Load.Drempels.FoutPct
	}
	envVUs, envIter := envInt("LOAD_VUS", 0), envInt("LOAD_ITERATIES", 0)
	behoud := os.Getenv("LOAD_BEHOUD") == "1" || strings.EqualFold(os.Getenv("LOAD_BEHOUD"), "true")
	seed := int64(envInt("LOAD_SEED", 1))
	extraVars := envVars("LOAD_VARS")

	// Rollen: het scenario zelf, of (bij load.mix) de genoemde scenario's naast elkaar.
	var rollen []*loadRol
	var overgeslagen []string
	if sc.isMix() {
		for _, m := range sc.Load.Mix {
			rsc := zoek(strings.TrimSpace(m.Scenario))
			if rsc == nil {
				t.Fatalf("load.mix: scenario %q niet gevonden", m.Scenario)
			}
			rol := &loadRol{sc: *rsc, naam: rsc.ID + " " + rsc.Naam, vus: vus, iteraties: iteraties}
			if rsc.Load != nil && m.VUs == 0 && rsc.Load.VUs > 0 {
				rol.vus = rsc.Load.VUs
			}
			if rsc.Load != nil && m.Iteraties == 0 && rsc.Load.Iteraties > 0 {
				rol.iteraties = rsc.Load.Iteraties
			}
			if m.VUs > 0 {
				rol.vus = m.VUs
			}
			if m.Iteraties > 0 {
				rol.iteraties = m.Iteraties
			}
			rollen = append(rollen, rol)
		}
		// Eigen stappen van het mix-scenario draaien als extra rol (zelden nodig, wel consequent).
		if len(sc.Stappen) > 0 {
			rollen = append(rollen, &loadRol{sc: *sc, naam: sc.ID + " " + sc.Naam, vus: vus, iteraties: iteraties})
		}
	} else {
		rollen = append(rollen, &loadRol{sc: *sc, vus: vus, iteraties: iteraties})
	}
	totaalVUs, volgendeVU := 0, 1
	for _, rol := range rollen {
		if envVUs > 0 {
			rol.vus = envVUs
		}
		if envIter > 0 {
			rol.iteraties = envIter
		}
		var over []string
		rol.stappen, over = loadStappen(rol.sc)
		overgeslagen = append(overgeslagen, over...)
		if len(rol.stappen) == 0 {
			t.Fatalf("scenario %s heeft geen request-stappen voor een loadtest", rol.sc.ID)
		}
		rol.eersteVU = volgendeVU
		volgendeVU += rol.vus
		totaalVUs += rol.vus
	}

	// Omgeving: reset + seed, of de bestaande dataset behouden.
	o := nieuweRegressieOmgevingMet(t, behoud)
	var seedLaatste int64
	if behoud {
		seedLaatste = o.laatsteRegistratieID()
	} else {
		seedLaatste = o.seedViaReplay()
	}
	// {{uniek}}: bij reset start elke run op dezelfde schone database, dus een vaste basis is
	// herhaalbaar. Bij behoud zouden id's van een eerdere run botsen; dan schuift de basis mee
	// met de klok (id's zijn bigint, en blijven ruim onder 2^53 voor JSON).
	uniekBasis := int64(100000)
	if behoud {
		uniekBasis += (time.Now().Unix() - 1_780_000_000) * 10_000_000
	}
	for k, v := range sc.Env {
		t.Setenv(k, v)
	}
	for _, rol := range rollen {
		for k, v := range rol.sc.Env {
			if sc.Env[k] != v {
				t.Logf("let op: env %s=%q van rol %s geldt niet (env is procesbreed; zet het op het mix-scenario)", k, v, rol.sc.ID)
			}
		}
	}

	// Gedeelde meetstaat: per rol per stap latenties en fouten.
	var mu sync.Mutex
	type meting struct {
		latenties []float64
		fouten    int
	}
	metingen := make([][]*meting, len(rollen))
	for ri, rol := range rollen {
		metingen[ri] = make([]*meting, len(rol.stappen))
		for si := range rol.stappen {
			metingen[ri][si] = &meting{}
		}
	}
	var voorbeelden []string

	if sc.isMix() {
		t.Logf("loadtest scenario %s «%s» (mix, %d rollen, %d vus totaal, seed %d, behoud=%v)", sc.ID, sc.Naam, len(rollen), totaalVUs, seed, behoud)
		for _, rol := range rollen {
			t.Logf("  rol %s: %d vus × %d iteraties × %d stappen", rol.naam, rol.vus, rol.iteraties, len(rol.stappen))
		}
	} else {
		t.Logf("loadtest scenario %s «%s»: %d vus × %d iteraties × %d stappen (seed %d, behoud=%v)", sc.ID, sc.Naam, rollen[0].vus, rollen[0].iteraties, len(rollen[0].stappen), seed, behoud)
	}

	start := time.Now()
	var wg sync.WaitGroup
	for ri, rol := range rollen {
		for k := 0; k < rol.vus; k++ {
			vu := rol.eersteVU + k
			wg.Add(1)
			go func(ri int, rol *loadRol, vu int) {
				defer wg.Done()
				globaal := map[string]string{} // per vu eigen "globale" variabelen
				for iter := 1; iter <= rol.iteraties; iter++ {
					basis := basisVars(seedLaatste)
					basis["vu"] = strconv.Itoa(vu)
					basis["iter"] = strconv.Itoa(iter)
					basis["uniek"] = strconv.FormatInt(uniekBasis+int64(vu)*10000+int64(iter), 10)
					vars := nieuweDeclVars(globaal, basis).metSeed(seed*1000003 + int64(vu)*7919 + int64(iter))
					vars.zetAlle(sc.Vars)
					vars.zetAlle(rol.sc.Vars)
					vars.zetAlle(extraVars)
					for si, as := range rol.stappen {
						if bereidStapVoor(as.stap, vars) {
							continue // kans niet gehaald
						}
						method := strings.ToUpper(strings.TrimSpace(as.stap.Method))
						if method == "" {
							method = "GET"
						}
						pad := vars.vervang(as.stap.Path)
						var body []byte
						if len(as.stap.Body) > 0 && string(as.stap.Body) != "null" {
							body = []byte(vars.vervang(string(as.stap.Body)))
						}
						t0 := time.Now()
						status, header, raw, err := o.doRaw(method, pad, body)
						ms := float64(time.Since(t0).Microseconds()) / 1000

						var meldingen []string
						fataal := false
						if err != nil {
							meldingen, fataal = []string{err.Error()}, true
						} else {
							stapZonderTeller := as.stap
							stapZonderTeller.MaxQueries = 0 // query-teller is niet betekenisvol onder concurrency
							meldingen, fataal = controleerStap(stapZonderTeller, vars, status, header, raw, 0)
						}
						mu.Lock()
						m := metingen[ri][si]
						m.latenties = append(m.latenties, ms)
						if len(meldingen) > 0 {
							m.fouten++
							if len(voorbeelden) < 8 {
								// Inclusief het begin van de response-body: zonder die tekst is een 500 niet te duiden.
								voorbeelden = append(voorbeelden, fmt.Sprintf("vu %d iter %d %s: %s", vu, iter, stapLabel(as.index, as.stap, pad), kortTekstLoad(strings.Join(strings.Fields(meldingen[0]), " "), 360)))
							}
						}
						mu.Unlock()
						if fataal {
							break // rest van deze iteratie heeft geen zin
						}
					}
				}
			}(ri, rol, vu)
		}
	}
	wg.Wait()
	duur := time.Since(start).Seconds()

	res := loadResultaat{
		Scenario: sc.ID, Naam: sc.Naam, Tijdstip: time.Now().UTC(), VUs: totaalVUs, Iteraties: rollen[0].iteraties,
		Behoud: behoud, Seed: seed, Vars: extraVars,
		DuurS: rond(duur), DrempelP95Ms: drempelP95, DrempelFout: drempelFout, DrempelsOK: true,
		Voorbeelden: voorbeelden, Overgeslagen: overgeslagen,
	}
	if sc.isMix() {
		for _, rol := range rollen {
			res.Rollen = append(res.Rollen, loadRolResultaat{Scenario: rol.sc.ID, Naam: rol.sc.Naam, VUs: rol.vus, Iteraties: rol.iteraties})
		}
	}
	var alleLat []float64
	for ri, rol := range rollen {
		for si, as := range rol.stappen {
			m := metingen[ri][si]
			l := append([]float64(nil), m.latenties...)
			sort.Float64s(l)
			som := 0.0
			for _, v := range l {
				som += v
			}
			naam := as.stap.Naam
			if naam == "" {
				naam = strings.ToUpper(as.stap.Method) + " " + as.stap.Path
			}
			sr := loadStapResultaat{Rol: rol.naam, Naam: naam, Aantal: len(l), Fouten: m.fouten}
			if len(l) > 0 {
				sr.GemMs, sr.P50Ms, sr.P95Ms, sr.P99Ms, sr.MaxMs = rond(som/float64(len(l))), rond(percentiel(l, 50)), rond(percentiel(l, 95)), rond(percentiel(l, 99)), rond(l[len(l)-1])
			}
			res.Stappen = append(res.Stappen, sr)
			res.Requests += len(l)
			res.Fouten += m.fouten
			alleLat = append(alleLat, l...)
		}
	}
	sort.Float64s(alleLat)
	res.P95Ms = rond(percentiel(alleLat, 95))
	if duur > 0 {
		res.RPS = rond(float64(res.Requests) / duur)
	}
	if res.Requests > 0 {
		res.FoutPct = rond(100 * float64(res.Fouten) / float64(res.Requests))
	}
	if drempelP95 > 0 && res.P95Ms > drempelP95 {
		res.DrempelsOK = false
		res.DrempelReden = append(res.DrempelReden, fmt.Sprintf("p95 %.2f ms > drempel %.2f ms", res.P95Ms, drempelP95))
	}
	if res.FoutPct > drempelFout {
		res.DrempelsOK = false
		res.DrempelReden = append(res.DrempelReden, fmt.Sprintf("foutpercentage %.2f%% > drempel %.2f%%", res.FoutPct, drempelFout))
	}

	// Rapportage.
	t.Logf("%d requests in %.2fs → %.1f req/s, fouten %d (%.2f%%), p95 totaal %.2f ms", res.Requests, duur, res.RPS, res.Fouten, res.FoutPct, res.P95Ms)
	t.Logf("%-36s %7s %7s %9s %9s %9s %9s %9s", "stap", "n", "fouten", "gem", "p50", "p95", "p99", "max")
	for _, s := range res.Stappen {
		naam := s.Naam
		if s.Rol != "" {
			naam = strings.SplitN(s.Rol, " ", 2)[0] + " · " + naam
		}
		t.Logf("%-36s %7d %7d %9.2f %9.2f %9.2f %9.2f %9.2f", kortTekstLoad(naam, 36), s.Aantal, s.Fouten, s.GemMs, s.P50Ms, s.P95Ms, s.P99Ms, s.MaxMs)
	}
	for _, v := range voorbeelden {
		t.Logf("fout-voorbeeld: %s", v)
	}

	uit, _ := json.MarshalIndent(res, "", "  ")
	if pad := strings.TrimSpace(os.Getenv("LOAD_UIT")); pad != "" {
		if err := os.WriteFile(pad, uit, 0o644); err != nil {
			t.Errorf("kan LOAD_UIT niet schrijven: %v", err)
		}
	}
	if err := os.MkdirAll("perf-results", 0o750); err == nil {
		naam := fmt.Sprintf("regressie-load-%s-%s.json", sc.ID, time.Now().Format("20060102-150405"))
		_ = os.WriteFile(filepath.Join("perf-results", naam), uit, 0o644)
		t.Logf("resultaat: perf-results/%s", naam)
	}

	for _, reden := range res.DrempelReden {
		t.Errorf("drempel overschreden: %s", reden)
	}
}

func kortTekstLoad(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
