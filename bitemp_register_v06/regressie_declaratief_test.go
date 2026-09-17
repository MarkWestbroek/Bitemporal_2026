//go:build integration

// regressie_declaratief_test.go — runner voor declaratieve regressiescenario's (formaat v2).
//
// Alle testcases van de np-loc regressiesuite staan als JSON in
// regressie/scenarios/*.json: zonder Go-kennis te lezen, te bewerken, te
// herordenen en te kopiëren (ook via de suite-editor op /admin/regressie).
// Alleen scenario 00 (database-reset + seed via replay) is nog Go-code, omdat
// dat de testomgeving zelf opbouwt.
//
// Scenario (één bestand, naam <id>-<slug>.json):
//
//	{
//	  "id": "05", "naam": "…", "beschrijving": "…",
//	  "volgorde": 50,                  // sorteersleutel (dan id)
//	  "vereist": ["04"],               // scenario's waarvan dit scenario state gebruikt
//	  "dekt": ["UC-12", "REQ-7"],      // traceability: use cases / requirements
//	  "tags": ["engine"],
//	  "uit": false,                    // true = overslaan
//	  "env": {"AUTH_ENABLED": "true"}, // omgevingsvariabelen tijdens dit scenario
//	  "load": {"vus": 5, "iteraties": 20, "drempels": {"p95_ms": 250, "fout_pct": 0}},
//	  "stappen": [ … ]
//	}
//
// Stap — precies één van: request (path), replay, actie:
//
//	{"naam": "…", "method": "POST", "path": "/locaties", "body": {…},
//	 "verwacht": {"status": 201, "status_in": [200,201], "bevat": "…", "bevat_niet": "sql:",
//	              "header": {"Content-Type": "problem+json"},
//	              "json": {"registratie_id": ">0", "namen[afvoer=null].data[afvoer=null].achternaam": "Vries"}},
//	 "max_queries": 40,
//	 "bewaar": {"regId": "registratie_id", "$globaal": "registratie_id"}}
//	{"replay": "replay files/x.json"}      → zet {{laatsteRegistratieID}} en {{replayAantal}}
//	{"actie": "seed_admin"}                → ingebouwde actie
//
// JSON-paden: gepunt, met array-index (`a.0.b`) of filter (`a[veld=waarde]`,
// `a[afvoer=null]` = eerste element waar het veld ontbreekt/null is).
// Verwachtingswaarden: letterlijk, of ">0" ">=1" "<10" "<=5" "!=null" "null".
//
// Variabelen: {{naam}} in path, body, replay en verwachtingen. Namen die met `$`
// beginnen zijn globaal (blijven bestaan voor latere scenario's). Ingebouwd:
// {{seedLaatsteRegistratieID}}, {{vu}}, {{iter}}, {{uniek}} (uniek per vu/iteratie;
// in een gewone run 1/1). Functies: {{synthtijd:var}} (synthetisch tijdstip van een
// registratie-id), {{min1:var}} (waarde − 1). Schrijf "{{int:var}}" (mét de quotes)
// om een variabele als kaal getal in een JSON-body te zetten.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
)

const declaratieveScenarioMap = "regressie/scenarios"

type declVerwacht struct {
	Status    int               `json:"status,omitempty"`
	StatusIn  []int             `json:"status_in,omitempty"`
	JSON      map[string]any    `json:"json,omitempty"`
	Bevat     string            `json:"bevat,omitempty"`
	BevatNiet string            `json:"bevat_niet,omitempty"`
	Header    map[string]string `json:"header,omitempty"`
}

type declStap struct {
	Naam       string            `json:"naam,omitempty"`
	Uit        bool              `json:"uit,omitempty"`
	Replay     string            `json:"replay,omitempty"`
	Actie      string            `json:"actie,omitempty"`
	Method     string            `json:"method,omitempty"`
	Path       string            `json:"path,omitempty"`
	Body       json.RawMessage   `json:"body,omitempty"`
	Verwacht   declVerwacht      `json:"verwacht"`
	MaxQueries int64             `json:"max_queries,omitempty"`
	Bewaar     map[string]string `json:"bewaar,omitempty"`
}

type declLoad struct {
	VUs       int `json:"vus,omitempty"`
	Iteraties int `json:"iteraties,omitempty"`
	Drempels  struct {
		P95Ms   float64 `json:"p95_ms,omitempty"`
		FoutPct float64 `json:"fout_pct"`
	} `json:"drempels"`
}

type declScenario struct {
	ID           string            `json:"id"`
	Naam         string            `json:"naam"`
	Beschrijving string            `json:"beschrijving,omitempty"`
	Volgorde     int               `json:"volgorde,omitempty"`
	Vereist      []string          `json:"vereist,omitempty"`
	Dekt         []string          `json:"dekt,omitempty"`
	Tags         []string          `json:"tags,omitempty"`
	Uit          bool              `json:"uit,omitempty"`
	Env          map[string]string `json:"env,omitempty"`
	Load         *declLoad         `json:"load,omitempty"`
	Stappen      []declStap        `json:"stappen"`
	bestand      string
}

// laadDeclaratieveScenarios leest alle *.json uit regressie/scenarios, gesorteerd op (volgorde, id).
func laadDeclaratieveScenarios(t *testing.T) []declScenario {
	t.Helper()
	paden, _ := filepath.Glob(filepath.Join(declaratieveScenarioMap, "*.json"))
	var out []declScenario
	for _, pad := range paden {
		raw, err := os.ReadFile(pad)
		if err != nil {
			t.Errorf("scenario %s: lezen mislukt: %v", pad, err)
			continue
		}
		var sc declScenario
		if err := json.Unmarshal(raw, &sc); err != nil {
			t.Errorf("scenario %s: ongeldige JSON: %v", pad, err)
			continue
		}
		if sc.ID == "" || len(sc.Stappen) == 0 {
			t.Errorf("scenario %s: id en minimaal één stap zijn verplicht", pad)
			continue
		}
		sc.bestand = filepath.Base(pad)
		out = append(out, sc)
	}
	sort.SliceStable(out, func(i, j int) bool {
		vi, vj := out[i].Volgorde, out[j].Volgorde
		if vi == 0 {
			vi = 1 << 30
		}
		if vj == 0 {
			vj = 1 << 30
		}
		if vi != vj {
			return vi < vj
		}
		return out[i].ID < out[j].ID
	})
	return out
}

// ── Variabelen ──────────────────────────────────────────────────────────────

// declVars houdt scenario-lokale en globale ($-prefix) variabelen bij.
type declVars struct {
	lokaal  map[string]string
	globaal map[string]string
}

func nieuweDeclVars(globaal map[string]string, basis map[string]string) *declVars {
	v := &declVars{lokaal: map[string]string{}, globaal: globaal}
	for k, w := range basis {
		v.lokaal[k] = w
	}
	return v
}

func (v *declVars) zet(naam, waarde string) {
	if strings.HasPrefix(naam, "$") {
		v.globaal[naam] = waarde
		return
	}
	v.lokaal[naam] = waarde
}

func (v *declVars) haal(naam string) (string, bool) {
	if w, ok := v.lokaal[naam]; ok {
		return w, true
	}
	w, ok := v.globaal[naam]
	return w, ok
}

var declVarRE = regexp.MustCompile(`"\{\{int:([^}]+)\}\}"|\{\{(?:(synthtijd|min1|int):)?([^}]+)\}\}`)

// synthetischTijdstip spiegelt handlers.tijdstipUitT: 2026-01-01T00:00:00Z + id uur + id µs.
func synthetischTijdstip(id int64) time.Time {
	return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).
		Add(time.Duration(id) * time.Hour).
		Add(time.Microsecond * time.Duration(id))
}

// vervang substitueert {{var}}, {{functie:var}} en "{{int:var}}" (mét quotes → kaal getal).
// Onbekende variabelen blijven letterlijk staan, zodat de fout zichtbaar is in de melding.
func (v *declVars) vervang(s string) string {
	return declVarRE.ReplaceAllStringFunc(s, func(m string) string {
		sub := declVarRE.FindStringSubmatch(m)
		if sub[1] != "" { // "{{int:naam}}" inclusief quotes
			if w, ok := v.haal(strings.TrimSpace(sub[1])); ok {
				return w
			}
			return m
		}
		functie, naam := sub[2], strings.TrimSpace(sub[3])
		w, ok := v.haal(naam)
		if !ok {
			return m
		}
		switch functie {
		case "synthtijd":
			if id, err := strconv.ParseInt(w, 10, 64); err == nil {
				return synthetischTijdstip(id).Format(time.RFC3339Nano)
			}
		case "min1":
			if n, err := strconv.ParseInt(w, 10, 64); err == nil {
				return strconv.FormatInt(n-1, 10)
			}
		}
		return w
	})
}

// ── JSON-paden en verwachtingen ─────────────────────────────────────────────

var declFilterRE = regexp.MustCompile(`^([^\[\]]*)\[([^=\]]+)=([^\]]*)\]$`)

// splitsPad splitst op punten, maar niet binnen [ ].
func splitsPad(pad string) []string {
	var delen []string
	diepte, start := 0, 0
	for i, r := range pad {
		switch r {
		case '[':
			diepte++
		case ']':
			diepte--
		case '.':
			if diepte == 0 {
				delen = append(delen, pad[start:i])
				start = i + 1
			}
		}
	}
	return append(delen, pad[start:])
}

// jsonPad navigeert een pad ("namen[afvoer=null].data.0.achternaam") door geparste JSON.
func jsonPad(v any, pad string) (any, bool) {
	huidig := v
	for _, deel := range splitsPad(pad) {
		if m := declFilterRE.FindStringSubmatch(deel); m != nil {
			sleutel, veld, wil := m[1], m[2], m[3]
			if sleutel != "" {
				obj, ok := huidig.(map[string]any)
				if !ok {
					return nil, false
				}
				if huidig, ok = obj[sleutel]; !ok {
					return nil, false
				}
			}
			lijst, ok := huidig.([]any)
			if !ok {
				return nil, false
			}
			gevonden := false
			for _, el := range lijst {
				obj, ok := el.(map[string]any)
				if !ok {
					continue
				}
				waarde, heeft := obj[veld]
				match := false
				if wil == "null" {
					match = !heeft || waarde == nil
				} else {
					match = heeft && fmt.Sprint(waarde) == wil
				}
				if match {
					huidig, gevonden = obj, true
					break
				}
			}
			if !gevonden {
				return nil, false
			}
			continue
		}
		switch h := huidig.(type) {
		case map[string]any:
			w, ok := h[deel]
			if !ok {
				return nil, false
			}
			huidig = w
		case []any:
			i, err := strconv.Atoi(deel)
			if err != nil || i < 0 || i >= len(h) {
				return nil, false
			}
			huidig = h[i]
		default:
			return nil, false
		}
	}
	return huidig, true
}

// checkVerwachting vergelijkt een JSON-waarde met een verwachting (zie bestandskop).
func checkVerwachting(actueel any, verwacht any) error {
	if s, ok := verwacht.(string); ok {
		switch {
		case s == "null":
			if actueel != nil {
				return fmt.Errorf("wil null, kreeg %v", actueel)
			}
			return nil
		case s == "!=null":
			if actueel == nil {
				return fmt.Errorf("wil niet-null, kreeg null")
			}
			return nil
		case strings.HasPrefix(s, ">") || strings.HasPrefix(s, "<"):
			op, rest := s[:1], s[1:]
			if strings.HasPrefix(rest, "=") {
				op, rest = s[:2], s[2:]
			}
			grens, err := strconv.ParseFloat(strings.TrimSpace(rest), 64)
			if err != nil {
				break // geen numerieke vergelijking → letterlijke vergelijking hieronder
			}
			getal, ok := actueel.(float64)
			if !ok {
				return fmt.Errorf("wil getal %s %v, kreeg %v (%T)", op, grens, actueel, actueel)
			}
			okVergelijk := map[string]bool{">": getal > grens, ">=": getal >= grens, "<": getal < grens, "<=": getal <= grens}[op]
			if !okVergelijk {
				return fmt.Errorf("wil %s %v, kreeg %v", op, grens, getal)
			}
			return nil
		}
	}
	if fmt.Sprint(actueel) != fmt.Sprint(verwacht) {
		return fmt.Errorf("wil %v, kreeg %v", verwacht, actueel)
	}
	return nil
}

// controleerStap vergelijkt een response met de verwachtingen van een stap en geeft
// alle afwijkingen terug (leeg = ok). Gedeeld door de regressie- en de load-runner.
func controleerStap(stap declStap, vars *declVars, status int, header map[string][]string, raw []byte, queries int64) (fouten []string, fataal bool) {
	wil := stap.Verwacht.Status
	if len(stap.Verwacht.StatusIn) > 0 {
		ok := false
		for _, s := range stap.Verwacht.StatusIn {
			if s == status {
				ok = true
			}
		}
		if !ok {
			return []string{fmt.Sprintf("wil status in %v, kreeg %d\n%s", stap.Verwacht.StatusIn, status, kort(raw))}, true
		}
	} else {
		if wil == 0 {
			wil = 200
		}
		if status != wil {
			return []string{fmt.Sprintf("wil status %d, kreeg %d\n%s", wil, status, kort(raw))}, true
		}
	}
	if b := stap.Verwacht.Bevat; b != "" && !strings.Contains(string(raw), vars.vervang(b)) {
		fouten = append(fouten, fmt.Sprintf("body bevat niet %q\n%s", b, kort(raw)))
	}
	if b := stap.Verwacht.BevatNiet; b != "" && strings.Contains(strings.ToLower(string(raw)), strings.ToLower(vars.vervang(b))) {
		fouten = append(fouten, fmt.Sprintf("body bevat ongewenst %q\n%s", b, kort(raw)))
	}
	for naam, wilDeel := range stap.Verwacht.Header {
		kreeg := ""
		for k, w := range header {
			if strings.EqualFold(k, naam) && len(w) > 0 {
				kreeg = w[0]
			}
		}
		if !strings.Contains(kreeg, wilDeel) {
			fouten = append(fouten, fmt.Sprintf("header %s: wil iets met %q, kreeg %q", naam, wilDeel, kreeg))
		}
	}
	if stap.MaxQueries > 0 && queries > stap.MaxQueries {
		fouten = append(fouten, fmt.Sprintf("%d queries, grens %d (N+1-regressie?)", queries, stap.MaxQueries))
	}

	var generiek any
	_ = json.Unmarshal(raw, &generiek)
	paden := make([]string, 0, len(stap.Verwacht.JSON))
	for pad := range stap.Verwacht.JSON {
		paden = append(paden, pad)
	}
	sort.Strings(paden)
	for _, pad := range paden {
		verwacht := stap.Verwacht.JSON[pad]
		if s, isStr := verwacht.(string); isStr {
			verwacht = vars.vervang(s)
		}
		actueel, ok := jsonPad(generiek, vars.vervang(pad))
		if !ok {
			if s, isStr := verwacht.(string); isStr && s == "null" {
				continue // ontbrekend veld telt als null
			}
			fouten = append(fouten, fmt.Sprintf("json-pad %q niet gevonden\n%s", pad, kort(raw)))
			continue
		}
		if err := checkVerwachting(actueel, verwacht); err != nil {
			fouten = append(fouten, fmt.Sprintf("%s: %v", pad, err))
		}
	}

	namen := make([]string, 0, len(stap.Bewaar))
	for naam := range stap.Bewaar {
		namen = append(namen, naam)
	}
	sort.Strings(namen)
	for _, naam := range namen {
		pad := stap.Bewaar[naam]
		waarde, ok := jsonPad(generiek, pad)
		if !ok {
			return append(fouten, fmt.Sprintf("bewaar %q: json-pad %q niet gevonden\n%s", naam, pad, kort(raw))), true
		}
		if f, isF := waarde.(float64); isF && f == float64(int64(f)) {
			vars.zet(naam, strconv.FormatInt(int64(f), 10))
		} else {
			vars.zet(naam, fmt.Sprint(waarde))
		}
	}
	return fouten, false
}

func stapLabel(i int, stap declStap, pad string) string {
	kop := fmt.Sprintf("stap %d", i+1)
	if stap.Naam != "" {
		kop += " «" + stap.Naam + "»"
	}
	switch {
	case stap.Replay != "":
		return kop + " (replay " + filepath.Base(pad) + ")"
	case stap.Actie != "":
		return kop + " (actie " + stap.Actie + ")"
	}
	return fmt.Sprintf("%s (%s %s)", kop, strings.ToUpper(stap.Method), pad)
}

// voerActieUit voert een ingebouwde actie uit.
func voerActieUit(actie string) error {
	switch actie {
	case "seed_admin":
		return handlers.SeedAdminGebruiker(context.Background())
	}
	return fmt.Errorf("onbekende actie %q (bekend: seed_admin)", actie)
}

// voerDeclaratiefUit speelt de stappen van één scenario af.
func (o *regressieOmgeving) voerDeclaratiefUit(t *testing.T, sc declScenario, vars *declVars) {
	t.Helper()
	for i, stap := range sc.Stappen {
		if stap.Uit {
			t.Logf("stap %d overgeslagen (uit)", i+1)
			continue
		}
		switch {
		case stap.Replay != "":
			pad := vars.vervang(stap.Replay)
			aantal, laatste := o.replay(pad)
			t.Logf("%s → %d entries, laatste registratie_id=%d", stapLabel(i, stap, pad), aantal, laatste)
			vars.zet("laatsteRegistratieID", strconv.FormatInt(laatste, 10))
			vars.zet("replayAantal", strconv.Itoa(aantal))
			continue
		case stap.Actie != "":
			if err := voerActieUit(stap.Actie); err != nil {
				t.Fatalf("%s: %v", stapLabel(i, stap, ""), err)
			}
			continue
		}

		method := strings.ToUpper(strings.TrimSpace(stap.Method))
		if method == "" {
			method = "GET"
		}
		pad := vars.vervang(stap.Path)
		var body []byte
		if len(stap.Body) > 0 && string(stap.Body) != "null" {
			body = []byte(vars.vervang(string(stap.Body)))
		}

		o.teller.reset()
		status, header, raw, err := o.doRaw(method, pad, body)
		queries := o.teller.aantal()
		label := stapLabel(i, stap, pad)
		if err != nil {
			t.Fatalf("%s: %v", label, err)
		}
		if stap.MaxQueries > 0 {
			t.Logf("%s → %d queries (grens %d)", label, queries, stap.MaxQueries)
		}
		fouten, fataal := controleerStap(stap, vars, status, header, raw, queries)
		for _, f := range fouten {
			t.Errorf("%s: %s", label, f)
		}
		if fataal {
			t.FailNow()
		}
	}
}
