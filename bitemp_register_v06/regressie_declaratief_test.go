//go:build integration

// regressie_declaratief_test.go — declaratieve regressiescenario's.
//
// Naast de gecodeerde scenario's in regressie_np_loc_test.go kunnen scenario's
// als JSON worden vastgelegd in regressie/scenarios/*.json. Die zijn zonder
// Go-kennis te schrijven (ook via de regressie-UI op /admin/regressie) en
// draaien als sub-subtests van scenario "90". Ze draaien ná de seed en ná de
// gecodeerde scenario's; gebruik dus eigen id's die niet met de seed botsen.
//
// Formaat (één bestand per scenario, bestandsnaam <id>-<slug>.json):
//
//	{
//	  "id": "20",
//	  "naam": "locatie via padnaam",
//	  "beschrijving": "optioneel",
//	  "stappen": [
//	    {
//	      "method": "POST", "path": "/locaties", "body": {"id": 42},
//	      "verwacht": {"status": 201, "json": {"registratie_id": ">0"}},
//	      "bewaar": {"regId": "registratie_id"}
//	    },
//	    {"method": "GET", "path": "/registraties/{{regId}}",
//	     "verwacht": {"status": 200, "json": {"registratietype": "registratie"}}}
//	  ]
//	}
//
// Verwachtingen: `status` (default 200), `bevat` (substring van de body) en
// `json` (map van gepunt pad → waarde; waarde mag ">0", ">=1", "<10", "!=null"
// of "null" zijn, anders gelijkheid op tekst). `bewaar` slaat een JSON-pad op
// als variabele; variabelen zijn als {{naam}} bruikbaar in path en body.
// Ingebouwd: {{seedLaatsteRegistratieID}}.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
)

const declaratieveScenarioMap = "regressie/scenarios"

type declStap struct {
	Method   string          `json:"method"`
	Path     string          `json:"path"`
	Body     json.RawMessage `json:"body,omitempty"`
	Verwacht struct {
		Status int            `json:"status"`
		JSON   map[string]any `json:"json,omitempty"`
		Bevat  string         `json:"bevat,omitempty"`
	} `json:"verwacht"`
	Bewaar map[string]string `json:"bewaar,omitempty"`
}

type declScenario struct {
	ID           string     `json:"id"`
	Naam         string     `json:"naam"`
	Beschrijving string     `json:"beschrijving,omitempty"`
	Stappen      []declStap `json:"stappen"`
	bestand      string
}

// laadDeclaratieveScenarios leest alle *.json uit regressie/scenarios, gesorteerd op id.
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
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func vervangVars(s string, vars map[string]string) string {
	for k, v := range vars {
		s = strings.ReplaceAll(s, "{{"+k+"}}", v)
	}
	return s
}

// jsonPad navigeert een gepunt pad ("namen.0.data.0.achternaam") door geparste JSON.
func jsonPad(v any, pad string) (any, bool) {
	huidig := v
	for _, deel := range strings.Split(pad, ".") {
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
		case strings.HasPrefix(s, ">=") || strings.HasPrefix(s, "<=") || strings.HasPrefix(s, ">") || strings.HasPrefix(s, "<"):
			op := s[:1]
			rest := s[1:]
			if strings.HasPrefix(s, ">=") || strings.HasPrefix(s, "<=") {
				op = s[:2]
				rest = s[2:]
			}
			grens, err := strconv.ParseFloat(strings.TrimSpace(rest), 64)
			if err != nil {
				return fmt.Errorf("ongeldige numerieke verwachting %q", s)
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

// voerDeclaratiefUit speelt de stappen van één scenario af.
func (o *regressieOmgeving) voerDeclaratiefUit(t *testing.T, sc declScenario, vars map[string]string) {
	t.Helper()
	for i, stap := range sc.Stappen {
		method := strings.ToUpper(strings.TrimSpace(stap.Method))
		if method == "" {
			method = "GET"
		}
		pad := vervangVars(stap.Path, vars)
		var body any
		if len(stap.Body) > 0 && string(stap.Body) != "null" {
			body = []byte(vervangVars(string(stap.Body), vars))
		}
		wil := stap.Verwacht.Status
		if wil == 0 {
			wil = 200
		}

		status, parsed, raw := o.do(method, pad, body)
		label := fmt.Sprintf("stap %d (%s %s)", i+1, method, pad)
		if status != wil {
			t.Fatalf("%s: wil status %d, kreeg %d\n%s", label, wil, status, kort(raw))
		}
		if stap.Verwacht.Bevat != "" && !strings.Contains(string(raw), vervangVars(stap.Verwacht.Bevat, vars)) {
			t.Errorf("%s: body bevat niet %q\n%s", label, stap.Verwacht.Bevat, kort(raw))
		}

		var generiek any
		_ = json.Unmarshal(raw, &generiek)
		if generiek == nil && parsed != nil {
			generiek = parsed
		}
		for pad, verwacht := range stap.Verwacht.JSON {
			// Variabelen ook in verwachtingswaarden toestaan (bv. "id": "{{regId}}").
			if s, isStr := verwacht.(string); isStr {
				verwacht = vervangVars(s, vars)
			}
			actueel, ok := jsonPad(generiek, pad)
			if !ok {
				if s, isStr := verwacht.(string); isStr && s == "null" {
					continue // ontbrekend veld telt als null
				}
				t.Errorf("%s: json-pad %q niet gevonden\n%s", label, pad, kort(raw))
				continue
			}
			if err := checkVerwachting(actueel, verwacht); err != nil {
				t.Errorf("%s: %s: %v", label, pad, err)
			}
		}
		for naam, pad := range stap.Bewaar {
			waarde, ok := jsonPad(generiek, pad)
			if !ok {
				t.Fatalf("%s: bewaar %q: json-pad %q niet gevonden\n%s", label, naam, pad, kort(raw))
			}
			if f, isF := waarde.(float64); isF && f == float64(int64(f)) {
				vars[naam] = strconv.FormatInt(int64(f), 10)
			} else {
				vars[naam] = fmt.Sprint(waarde)
			}
		}
	}
}
