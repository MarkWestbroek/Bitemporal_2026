//go:build integration

// regressie_load_test.go — load-/performancetest op basis van een declaratief scenario.
//
// Hergebruikt het scenarioformaat uit regressie_declaratief_test.go: elk scenario met
// request-stappen kan als loadtest draaien. N virtuele gebruikers (vus) spelen elk
// `iteraties` keer de stappen af, in-process tegen de échte API + Postgres (na reset
// en seed). Per stap worden latenties gemeten; drempels uit `load.drempels` laten de
// test falen (performance-regressie) — hetzelfde idee als k6-thresholds, maar dan
// tegen dezelfde in-process omgeving als de functionele suite.
//
//	LOAD_SCENARIO=30 LOAD_VUS=8 LOAD_ITERATIES=25 \
//	  go test -tags integration -run TestLoadNpLoc -v -count=1 .
//
// Variabelen per uitvoering: {{vu}} (1..vus), {{iter}} (1..iteraties) en {{uniek}}
// (= 100000 + vu*10000 + iter — uniek per vu/iteratie, bruikbaar als entiteit-id).
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
	Naam   string  `json:"naam"`
	Aantal int     `json:"aantal"`
	Fouten int     `json:"fouten"`
	GemMs  float64 `json:"gem_ms"`
	P50Ms  float64 `json:"p50_ms"`
	P95Ms  float64 `json:"p95_ms"`
	P99Ms  float64 `json:"p99_ms"`
	MaxMs  float64 `json:"max_ms"`
}

type loadResultaat struct {
	Scenario      string              `json:"scenario"`
	Naam          string              `json:"naam"`
	Tijdstip      time.Time           `json:"tijdstip"`
	VUs           int                 `json:"vus"`
	Iteraties     int                 `json:"iteraties"`
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

func TestLoadNpLoc(t *testing.T) {
	scenarioID := strings.TrimSpace(os.Getenv("LOAD_SCENARIO"))
	if scenarioID == "" {
		t.Skip("LOAD_SCENARIO niet gezet (bv. LOAD_SCENARIO=30); loadtest overgeslagen")
	}

	var sc *declScenario
	for _, kandidaat := range laadDeclaratieveScenarios(t) {
		if kandidaat.ID == scenarioID {
			k := kandidaat
			sc = &k
		}
	}
	if sc == nil {
		t.Fatalf("scenario %q niet gevonden in %s", scenarioID, declaratieveScenarioMap)
	}

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
	vus, iteraties = envInt("LOAD_VUS", vus), envInt("LOAD_ITERATIES", iteraties)

	o := nieuweRegressieOmgeving(t)
	seedLaatste := o.seedViaReplay()
	for k, v := range sc.Env {
		t.Setenv(k, v)
	}

	// Alleen request-stappen doen mee.
	type actieveStap struct {
		index int
		stap  declStap
	}
	var stappen []actieveStap
	var overgeslagen []string
	for i, s := range sc.Stappen {
		if s.Uit || s.Replay != "" || s.Actie != "" {
			overgeslagen = append(overgeslagen, stapLabel(i, s, s.Replay))
			continue
		}
		stappen = append(stappen, actieveStap{i, s})
	}
	if len(stappen) == 0 {
		t.Fatalf("scenario %s heeft geen request-stappen voor een loadtest", sc.ID)
	}

	var mu sync.Mutex
	latenties := make([][]float64, len(stappen))
	fouten := make([]int, len(stappen))
	var voorbeelden []string

	t.Logf("loadtest scenario %s «%s»: %d vus × %d iteraties × %d stappen", sc.ID, sc.Naam, vus, iteraties, len(stappen))
	start := time.Now()
	var wg sync.WaitGroup
	for vu := 1; vu <= vus; vu++ {
		wg.Add(1)
		go func(vu int) {
			defer wg.Done()
			globaal := map[string]string{} // per vu eigen "globale" variabelen
			for iter := 1; iter <= iteraties; iter++ {
				basis := basisVars(seedLaatste)
				basis["vu"] = strconv.Itoa(vu)
				basis["iter"] = strconv.Itoa(iter)
				basis["uniek"] = strconv.Itoa(100000 + vu*10000 + iter)
				vars := nieuweDeclVars(globaal, basis)
				for si, as := range stappen {
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
					latenties[si] = append(latenties[si], ms)
					if len(meldingen) > 0 {
						fouten[si]++
						if len(voorbeelden) < 5 {
							voorbeelden = append(voorbeelden, fmt.Sprintf("vu %d iter %d %s: %s", vu, iter, stapLabel(as.index, as.stap, pad), strings.SplitN(meldingen[0], "\n", 2)[0]))
						}
					}
					mu.Unlock()
					if fataal {
						break // rest van deze iteratie heeft geen zin
					}
				}
			}
		}(vu)
	}
	wg.Wait()
	duur := time.Since(start).Seconds()

	res := loadResultaat{
		Scenario: sc.ID, Naam: sc.Naam, Tijdstip: time.Now().UTC(), VUs: vus, Iteraties: iteraties,
		DuurS: rond(duur), DrempelP95Ms: drempelP95, DrempelFout: drempelFout, DrempelsOK: true,
		Voorbeelden: voorbeelden, Overgeslagen: overgeslagen,
	}
	var alle []float64
	for si, as := range stappen {
		l := append([]float64(nil), latenties[si]...)
		sort.Float64s(l)
		som := 0.0
		for _, v := range l {
			som += v
		}
		naam := as.stap.Naam
		if naam == "" {
			naam = strings.ToUpper(as.stap.Method) + " " + as.stap.Path
		}
		sr := loadStapResultaat{Naam: naam, Aantal: len(l), Fouten: fouten[si]}
		if len(l) > 0 {
			sr.GemMs, sr.P50Ms, sr.P95Ms, sr.P99Ms, sr.MaxMs = rond(som/float64(len(l))), rond(percentiel(l, 50)), rond(percentiel(l, 95)), rond(percentiel(l, 99)), rond(l[len(l)-1])
		}
		res.Stappen = append(res.Stappen, sr)
		res.Requests += len(l)
		res.Fouten += fouten[si]
		alle = append(alle, l...)
	}
	sort.Float64s(alle)
	res.P95Ms = rond(percentiel(alle, 95))
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
	t.Logf("%-28s %7s %7s %9s %9s %9s %9s %9s", "stap", "n", "fouten", "gem", "p50", "p95", "p99", "max")
	for _, s := range res.Stappen {
		t.Logf("%-28s %7d %7d %9.2f %9.2f %9.2f %9.2f %9.2f", kortTekstLoad(s.Naam, 28), s.Aantal, s.Fouten, s.GemMs, s.P50Ms, s.P95Ms, s.P99Ms, s.MaxMs)
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
