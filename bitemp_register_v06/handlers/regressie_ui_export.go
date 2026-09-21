//go:build devtools

// regressie_ui_export.go — export van een declaratief scenario naar k6 of Hurl.
//
// Doel: niet zelf een load-tool of CI-runner nabouwen. Het eigen formaat is de bron
// (omdat alleen de in-process runner DB-reset, seed, query-teller en env-vlaggen kan),
// maar een scenario is te exporteren naar de standaardtools:
//
//	GET /admin/regressie/export/k6?id=30    → k6-script (load/performance tegen een draaiende API)
//	GET /admin/regressie/export/hurl?id=05  → .hurl-bestand (functioneel, CI-vriendelijk)
//
// EXPERIMENTEEL: de export dekt request-stappen met status-, bevat- en eenvoudige
// json-verwachtingen en `bewaar`. Filterpaden (a[veld=waarde]), max_queries, env en
// acties bestaan daar niet en worden als commentaar meegegeven. Replay-stappen worden
// uitgeschreven als losse requests.
package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type exportStap struct {
	Naam     string          `json:"naam"`
	Uit      bool            `json:"uit"`
	Replay   string          `json:"replay"`
	Actie    string          `json:"actie"`
	Method   string          `json:"method"`
	Path     string          `json:"path"`
	Body     json.RawMessage `json:"body"`
	Verwacht struct {
		Status    int            `json:"status"`
		StatusIn  []int          `json:"status_in"`
		JSON      map[string]any `json:"json"`
		Bevat     string         `json:"bevat"`
		BevatNiet string         `json:"bevat_niet"`
	} `json:"verwacht"`
	MaxQueries int64             `json:"max_queries"`
	Zet        map[string]string `json:"zet"`
	Kans       float64           `json:"kans"`
	Bewaar     map[string]string `json:"bewaar"`
}

// exportStappen vlakt een scenario af tot request-stappen (replay uitgeschreven).
func exportStappen(def *regressieScenarioDef) (stappen []exportStap, notities []string) {
	for i, raw := range def.Stappen {
		var s exportStap
		if err := json.Unmarshal(raw, &s); err != nil || s.Uit {
			continue
		}
		switch {
		case s.Actie != "":
			notities = append(notities, fmt.Sprintf("stap %d: actie %q bestaat alleen in de in-process runner en is overgeslagen", i+1, s.Actie))
		case s.Replay != "":
			entries, _, err := leesReplayEntries(s.Replay)
			if err != nil {
				notities = append(notities, fmt.Sprintf("stap %d: replay %s niet leesbaar: %v", i+1, s.Replay, err))
				continue
			}
			for j, e := range entries {
				r := exportStap{Naam: fmt.Sprintf("replay %d/%d", j+1, len(entries)), Method: e.RequestMethod, Path: e.RequestPath, Body: e.RequestBody}
				if r.Method == "" {
					r.Method = "POST"
				}
				if r.Path == "" {
					r.Path = "/registratie/"
				}
				r.Verwacht.Status = 201
				if e.ExpectedResponseCode != nil {
					r.Verwacht.Status = *e.ExpectedResponseCode
				}
				stappen = append(stappen, r)
			}
		default:
			if s.Method == "" {
				s.Method = "GET"
			}
			s.Method = strings.ToUpper(s.Method)
			if s.MaxQueries > 0 {
				notities = append(notities, fmt.Sprintf("stap %d: max_queries=%d kan alleen de in-process runner meten", i+1, s.MaxQueries))
			}
			stappen = append(stappen, s)
		}
	}
	if len(def.Env) > 0 {
		notities = append(notities, "env-variabelen van het scenario moeten op de draaiende API zelf gezet zijn")
	}
	return stappen, notities
}

func gesorteerdeSleutels[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func regressieExport(c *gin.Context) {
	formaat := strings.ToLower(c.Param("formaat"))
	id := strings.TrimSpace(c.Query("id"))
	var def *regressieScenarioDef
	for _, s := range leesDeclaratieveScenarios() {
		if s.ID == id {
			def = s.Definitie
		}
	}
	if def == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "scenario niet gevonden: " + id})
		return
	}
	var inhoud, bestandsnaam string
	switch formaat {
	case "k6":
		inhoud, bestandsnaam = exportK6(def), fmt.Sprintf("k6-%s-%s.js", def.ID, slug(def.Naam))
	case "hurl":
		inhoud, bestandsnaam = exportHurl(def), fmt.Sprintf("%s-%s.hurl", def.ID, slug(def.Naam))
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "onbekend formaat (k6 of hurl)"})
		return
	}
	if c.Query("download") == "1" {
		c.Header("Content-Disposition", "attachment; filename=\""+bestandsnaam+"\"")
	}
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(inhoud))
}

// ── k6 ──────────────────────────────────────────────────────────────────────

// jsString geeft een veilige JavaScript-stringliteral (JSON-strings zijn geldige JS).
func jsString(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

const k6Prelude = `import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8082';

// Gepunt pad met index en filter: "a.0.b" en "a[veld=waarde]" / "a[veld=null]".
function pad(v, p) {
  const delen = [];
  let diepte = 0, start = 0;
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '[') diepte++; else if (ch === ']') diepte--;
    else if (ch === '.' && diepte === 0) { delen.push(p.slice(start, i)); start = i + 1; }
  }
  delen.push(p.slice(start));
  for (const deel of delen) {
    if (v === null || v === undefined) return undefined;
    const m = deel.match(/^([^\[\]]*)\[([^=\]]+)=([^\]]*)\]$/);
    if (m) {
      if (m[1] !== '') v = v[m[1]];
      if (!Array.isArray(v)) return undefined;
      v = v.find((el) => el && (m[3] === 'null' ? (el[m[2]] === undefined || el[m[2]] === null) : String(el[m[2]]) === m[3]));
    } else {
      v = Array.isArray(v) ? v[Number(deel)] : v[deel];
    }
  }
  return v;
}

// Verwachting: letterlijk, of ">0" ">=1" "<10" "<=5" "!=null" "null".
function voldoet(actueel, verwacht) {
  if (typeof verwacht === 'string') {
    if (verwacht === 'null') return actueel === null || actueel === undefined;
    if (verwacht === '!=null') return actueel !== null && actueel !== undefined;
    const m = verwacht.match(/^(>=|<=|>|<)\s*(-?[0-9.]+)$/);
    if (m) {
      const g = Number(m[2]);
      return m[1] === '>' ? actueel > g : m[1] === '>=' ? actueel >= g : m[1] === '<' ? actueel < g : actueel <= g;
    }
  }
  return String(actueel) === String(verwacht);
}

function synthtijd(id) {
  const ms = Date.UTC(2026, 0, 1) + Number(id) * 3600000;
  const micros = String(Number(id) % 1000000).padStart(6, '0').replace(/0+$/, '');
  return new Date(ms).toISOString().replace(/\.\d+Z$/, micros ? '.' + micros + 'Z' : 'Z');
}

// {{rnd:a-b}}: a en b zijn getallen of variabelen. k6 kent geen geseede generator, dus
// (anders dan de in-process runner) is de reeks hier niet herhaalbaar.
function getalOfVar(x, vars) {
  x = x.trim();
  const n = Number(/^-?[0-9]+$/.test(x) ? x : vars[x]);
  return Number.isFinite(n) ? n : undefined;
}

function vervang(s, vars) {
  return s
    .replace(/"\{\{int:([^}]+)\}\}"/g, (m, n) => (vars[n.trim()] !== undefined ? vars[n.trim()] : m))
    .replace(/\{\{(?:(synthtijd|min1|int|rnd):)?([^}]+)\}\}/g, (m, f, n) => {
      if (f === 'rnd') {
        const i = n.indexOf('-', 1);
        const a = getalOfVar(n.slice(0, i), vars), b = getalOfVar(n.slice(i + 1), vars);
        if (i < 0 || a === undefined || b === undefined) return m;
        const lo = Math.min(a, b), hi = Math.max(a, b);
        return String(lo + Math.floor(Math.random() * (hi - lo + 1)));
      }
      const w = vars[n.trim()];
      if (w === undefined) return m;
      if (f === 'synthtijd') return synthtijd(w);
      if (f === 'min1') return String(Number(w) - 1);
      return w;
    });
}

function jsonVan(res) { try { return res.json(); } catch (e) { return null; } }

// -e VARS="npVan=1;npTot=2000" overschrijft de scenariovariabelen.
function envVars() {
  const uit = {};
  for (const deel of (__ENV.VARS || '').split(';')) {
    const i = deel.indexOf('=');
    if (i > 0) uit[deel.slice(0, i).trim()] = deel.slice(i + 1).trim();
  }
  return uit;
}

// Inloggen per vu (k6 houdt cookies per vu bij). Alleen als LOGIN_USER gezet is; nodig voor
// muterende stappen tegen een API met AUTH_ENABLED=true.
function login() {
  if (!__ENV.LOGIN_USER) return;
  const res = http.post(BASE + '/api/auth/login', JSON.stringify({ gebruikersnaam: __ENV.LOGIN_USER, wachtwoord: __ENV.LOGIN_PASSWORD || '' }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'login: status 200': (r) => r.status === 200 });
}

// De doeldatabase wordt niet gereset, dus {{uniek}} moet ook over runs heen uniek zijn:
// de basis schuift mee met de klok (of zet hem vast met -e UNIEK_BASIS=...).
export function setup() {
  const basis = __ENV.UNIEK_BASIS ? Number(__ENV.UNIEK_BASIS) : 100000 + (Math.floor(Date.now() / 1000) - 1780000000) * 10000000;
  return { basis: basis };
}

function beginVars(data, vuOffset, scVars) {
  const vu = vuOffset + __VU;
  return Object.assign({ vu: String(vu), iter: String(__ITER + 1), uniek: String(data.basis + vu * 10000 + __ITER + 1) }, scVars, envVars());
}
`

// k6Profiel leest vus/iteraties/drempels/mix uit het load-blok van een scenario.
type k6Profiel struct {
	VUs       int `json:"vus"`
	Iteraties int `json:"iteraties"`
	Drempels  struct {
		P95Ms   float64 `json:"p95_ms"`
		FoutPct float64 `json:"fout_pct"`
	} `json:"drempels"`
	Mix []struct {
		Scenario  string `json:"scenario"`
		VUs       int    `json:"vus"`
		Iteraties int    `json:"iteraties"`
	} `json:"mix"`
}

func leesK6Profiel(def *regressieScenarioDef) k6Profiel {
	var l k6Profiel
	if def != nil && len(def.Load) > 0 {
		_ = json.Unmarshal(def.Load, &l)
	}
	return l
}

// k6Rol is één k6-scenario (exec-functie) in het script.
type k6Rol struct {
	def       *regressieScenarioDef
	functie   string
	vus       int
	iteraties int
}

func exportK6(def *regressieScenarioDef) string {
	hoofd := leesK6Profiel(def)
	vus, iteraties := 5, 20
	if hoofd.VUs > 0 {
		vus = hoofd.VUs
	}
	if hoofd.Iteraties > 0 {
		iteraties = hoofd.Iteraties
	}

	// Rollen: het scenario zelf, of (load.mix) de genoemde scenario's als gelijktijdige k6-scenario's.
	var rollen []k6Rol
	var notities []string
	if len(hoofd.Mix) > 0 {
		alle := leesDeclaratieveScenarios()
		for _, m := range hoofd.Mix {
			var rdef *regressieScenarioDef
			for _, sc := range alle {
				if sc.ID == strings.TrimSpace(m.Scenario) {
					rdef = sc.Definitie
				}
			}
			if rdef == nil {
				notities = append(notities, fmt.Sprintf("load.mix: scenario %q niet gevonden; rol overgeslagen", m.Scenario))
				continue
			}
			rol := k6Rol{def: rdef, functie: "sc" + rdef.ID, vus: vus, iteraties: iteraties}
			if p := leesK6Profiel(rdef); true {
				if p.VUs > 0 {
					rol.vus = p.VUs
				}
				if p.Iteraties > 0 {
					rol.iteraties = p.Iteraties
				}
			}
			if m.VUs > 0 {
				rol.vus = m.VUs
			}
			if m.Iteraties > 0 {
				rol.iteraties = m.Iteraties
			}
			rollen = append(rollen, rol)
		}
	}
	if len(def.Stappen) > 0 || len(rollen) == 0 {
		rollen = append(rollen, k6Rol{def: def, functie: "sc" + def.ID, vus: vus, iteraties: iteraties})
	}

	var kop, lijf strings.Builder
	vuOffset := 0
	var k6Scenarios []string
	for _, rol := range rollen {
		stappen, n := exportStappen(rol.def)
		for _, x := range n {
			notities = append(notities, rol.def.ID+": "+x)
		}
		k6Scenarios = append(k6Scenarios, fmt.Sprintf("    %s: { executor: 'per-vu-iterations', vus: %d, iterations: %d, exec: %s, maxDuration: '60m' },",
			rol.functie, rol.vus, rol.iteraties, jsString(rol.functie)))
		scVars, _ := json.Marshal(mergeVars(def.Vars, rol.def.Vars))
		fmt.Fprintf(&lijf, "// ── scenario %s «%s» ──\nexport function %s(data) {\n", rol.def.ID, rol.def.Naam, rol.functie)
		fmt.Fprintf(&lijf, "  if (__ITER === 0) login();\n  const vars = beginVars(data, %d, %s);\n", vuOffset, string(scVars))
		lijf.WriteString("  const kop = { headers: { 'Content-Type': 'application/json' } };\n  let res, doc;\n\n")
		for i, s := range stappen {
			k6Stap(&lijf, i, s)
		}
		lijf.WriteString("}\n\n")
		vuOffset += rol.vus
	}

	fmt.Fprintf(&kop, "// k6-script gegenereerd uit regressiescenario %s «%s» (EXPERIMENTEEL).\n", def.ID, def.Naam)
	kop.WriteString("// Draaien tegen een draaiende API:\n")
	kop.WriteString("//   k6 run -e BASE_URL=https://host -e VARS=\"npVan=1;npTot=2000\" -e LOGIN_USER=... -e LOGIN_PASSWORD=... <dit bestand>\n")
	kop.WriteString("// Let op: k6 reset/seedt de database niet; zorg zelf voor een passende begintoestand, en test\n")
	kop.WriteString("// alleen tegen een omgeving waar testdata mag ontstaan.\n")
	for _, n := range notities {
		kop.WriteString("// NB " + n + "\n")
	}
	kop.WriteString("\n" + k6Prelude + "\n")
	kop.WriteString("export const options = {\n  scenarios: {\n" + strings.Join(k6Scenarios, "\n") + "\n  },\n  thresholds: {\n")
	if hoofd.Drempels.P95Ms > 0 {
		fmt.Fprintf(&kop, "    http_req_duration: ['p(95)<%s'],\n", strconv.FormatFloat(hoofd.Drempels.P95Ms, 'f', -1, 64))
	}
	fmt.Fprintf(&kop, "    checks: ['rate>=%s'],\n  },\n};\n\n", strconv.FormatFloat((100-hoofd.Drempels.FoutPct)/100, 'f', -1, 64))
	return kop.String() + lijf.String()
}

// mergeVars: variabelen van het hoofdscenario, overschreven door die van de rol.
func mergeVars(hoofd, rol map[string]string) map[string]string {
	uit := map[string]string{}
	for k, v := range hoofd {
		uit[k] = v
	}
	for k, v := range rol {
		uit[k] = v
	}
	return uit
}

// k6Stap schrijft één request-stap: zet, kans, request, checks, bewaar.
func k6Stap(b *strings.Builder, i int, s exportStap) {
	label := fmt.Sprintf("stap %d", i+1)
	if s.Naam != "" {
		label += " " + s.Naam
	}
	in := "  "
	fmt.Fprintf(b, "  // %s\n", label)
	if s.Kans > 0 && s.Kans < 1 {
		fmt.Fprintf(b, "  if (Math.random() < %s) {\n", strconv.FormatFloat(s.Kans, 'f', -1, 64))
		in = "    "
	}
	for _, naam := range gesorteerdeSleutels(s.Zet) {
		fmt.Fprintf(b, "%svars[%s] = vervang(%s, vars);\n", in, jsString(naam), jsString(s.Zet[naam]))
	}
	body := "null"
	if len(s.Body) > 0 && string(s.Body) != "null" {
		var compact bytes.Buffer
		tekst := string(s.Body)
		if json.Compact(&compact, s.Body) == nil {
			tekst = compact.String()
		}
		body = "vervang(" + jsString(tekst) + ", vars)"
	}
	fmt.Fprintf(b, "%sres = http.request(%s, BASE + vervang(%s, vars), %s, Object.assign({ tags: { name: %s } }, kop));\n%sdoc = jsonVan(res);\n",
		in, jsString(s.Method), jsString(s.Path), body, jsString(label), in)

	var checks []string
	switch {
	case len(s.Verwacht.StatusIn) > 0:
		lijst, _ := json.Marshal(s.Verwacht.StatusIn)
		checks = append(checks, fmt.Sprintf("%s  %s: (r) => %s.includes(r.status),", in, jsString(label+": status in "+string(lijst)), string(lijst)))
	default:
		wil := s.Verwacht.Status
		if wil == 0 {
			wil = 200
		}
		checks = append(checks, fmt.Sprintf("%s  %s: (r) => r.status === %d,", in, jsString(fmt.Sprintf("%s: status %d", label, wil)), wil))
	}
	if s.Verwacht.Bevat != "" {
		checks = append(checks, fmt.Sprintf("%s  %s: (r) => r.body.includes(vervang(%s, vars)),", in, jsString(label+": bevat"), jsString(s.Verwacht.Bevat)))
	}
	if s.Verwacht.BevatNiet != "" {
		checks = append(checks, fmt.Sprintf("%s  %s: (r) => !r.body.toLowerCase().includes(%s),", in, jsString(label+": bevat niet"), jsString(strings.ToLower(s.Verwacht.BevatNiet))))
	}
	for _, p := range gesorteerdeSleutels(s.Verwacht.JSON) {
		w, _ := json.Marshal(s.Verwacht.JSON[p])
		verwacht := string(w)
		if _, isStr := s.Verwacht.JSON[p].(string); isStr {
			verwacht = "vervang(" + verwacht + ", vars)"
		}
		checks = append(checks, fmt.Sprintf("%s  %s: () => voldoet(pad(doc, %s), %s),", in, jsString(label+": "+p), jsString(p), verwacht))
	}
	b.WriteString(in + "check(res, {\n" + strings.Join(checks, "\n") + "\n" + in + "});\n")
	for _, naam := range gesorteerdeSleutels(s.Bewaar) {
		fmt.Fprintf(b, "%svars[%s] = String(pad(doc, %s));\n", in, jsString(naam), jsString(s.Bewaar[naam]))
	}
	if in == "    " {
		b.WriteString("  }\n")
	}
	b.WriteString("\n")
}

// ── Hurl ────────────────────────────────────────────────────────────────────

var hurlIndexRE = regexp.MustCompile(`^\d+$`)

// hurlJSONPath vertaalt een gepunt pad naar JSONPath; filters worden niet vertaald.
func hurlJSONPath(p string) (string, bool) {
	if strings.ContainsAny(p, "[]") {
		return "", false
	}
	var b strings.Builder
	b.WriteString("$")
	for _, deel := range strings.Split(p, ".") {
		if hurlIndexRE.MatchString(deel) {
			b.WriteString("[" + deel + "]")
		} else {
			b.WriteString("." + deel)
		}
	}
	return b.String(), true
}

func exportHurl(def *regressieScenarioDef) string {
	stappen, notities := exportStappen(def)
	var b strings.Builder
	fmt.Fprintf(&b, "# Hurl-bestand gegenereerd uit regressiescenario %s «%s» (EXPERIMENTEEL).\n", def.ID, def.Naam)
	b.WriteString("# Draaien:  hurl --test --variable base=http://localhost:8082 --variable uniek=110001 <dit bestand>\n")
	b.WriteString("# Let op: Hurl reset/seedt de database niet; zorg zelf voor een passende begintoestand.\n")
	for _, n := range notities {
		b.WriteString("# NB " + n + "\n")
	}
	intRE := regexp.MustCompile(`"\{\{int:([^}]+)\}\}"`)
	functieRE := regexp.MustCompile(`\{\{(synthtijd|min1):([^}]+)\}\}`)
	naarHurl := func(s string) string {
		s = intRE.ReplaceAllString(s, "{{$1}}") // Hurl-variabelen zijn ongetypeerd: kaal invoegen
		return strings.ReplaceAll(s, "{{$", "{{g_")
	}
	for i, s := range stappen {
		fmt.Fprintf(&b, "\n# stap %d %s\n", i+1, s.Naam)
		if len(s.Zet) > 0 || s.Kans > 0 {
			b.WriteString("# let op: zet/kans/{{rnd}} kent Hurl niet; geef de variabelen mee met --variable of gebruik de k6-export\n")
		}
		if functieRE.MatchString(s.Path) || functieRE.MatchString(string(s.Body)) {
			b.WriteString("# NB functies {{synthtijd:…}}/{{min1:…}} bestaan niet in Hurl; bereken de waarde zelf.\n")
		}
		fmt.Fprintf(&b, "%s {{base}}%s\n", s.Method, naarHurl(s.Path))
		if len(s.Body) > 0 && string(s.Body) != "null" {
			bodyTekst := string(s.Body)
			var compact bytes.Buffer
			if json.Compact(&compact, s.Body) == nil {
				bodyTekst = compact.String()
			}
			b.WriteString("Content-Type: application/json\n" + naarHurl(bodyTekst) + "\n")
		}
		switch {
		case len(s.Verwacht.StatusIn) > 0:
			b.WriteString("HTTP *\n")
		case s.Verwacht.Status == 0:
			b.WriteString("HTTP 200\n")
		default:
			fmt.Fprintf(&b, "HTTP %d\n", s.Verwacht.Status)
		}
		if len(s.Bewaar) > 0 {
			b.WriteString("[Captures]\n")
			for _, naam := range gesorteerdeSleutels(s.Bewaar) {
				if jp, ok := hurlJSONPath(s.Bewaar[naam]); ok {
					fmt.Fprintf(&b, "%s: jsonpath \"%s\"\n", strings.Replace(naam, "$", "g_", 1), jp)
				} else {
					fmt.Fprintf(&b, "# %s: filterpad %q niet vertaald\n", naam, s.Bewaar[naam])
				}
			}
		}
		var asserts []string
		if len(s.Verwacht.StatusIn) > 0 {
			asserts = append(asserts, fmt.Sprintf("# status moet één van %v zijn (Hurl kent geen 'in'; controleer handmatig of splits de stap)", s.Verwacht.StatusIn))
		}
		if s.Verwacht.Bevat != "" {
			asserts = append(asserts, "body contains "+jsString(naarHurl(s.Verwacht.Bevat)))
		}
		if s.Verwacht.BevatNiet != "" {
			asserts = append(asserts, "body not contains "+jsString(s.Verwacht.BevatNiet))
		}
		for _, p := range gesorteerdeSleutels(s.Verwacht.JSON) {
			jp, ok := hurlJSONPath(p)
			if !ok {
				asserts = append(asserts, fmt.Sprintf("# %s: filterpad niet vertaald (verwacht %v)", p, s.Verwacht.JSON[p]))
				continue
			}
			w := s.Verwacht.JSON[p]
			if str, isStr := w.(string); isStr {
				switch {
				case str == "null":
					asserts = append(asserts, fmt.Sprintf("jsonpath \"%s\" not exists", jp))
				case str == "!=null":
					asserts = append(asserts, fmt.Sprintf("jsonpath \"%s\" exists", jp))
				case regexp.MustCompile(`^(>=|<=|>|<)\s*-?[0-9.]+$`).MatchString(str):
					m := regexp.MustCompile(`^(>=|<=|>|<)\s*(-?[0-9.]+)$`).FindStringSubmatch(str)
					asserts = append(asserts, fmt.Sprintf("jsonpath \"%s\" %s %s", jp, m[1], m[2]))
				case functieRE.MatchString(str):
					asserts = append(asserts, fmt.Sprintf("# %s: verwachting %q gebruikt een functie; niet vertaald", p, str))
				case strings.Contains(str, "{{"):
					asserts = append(asserts, fmt.Sprintf("jsonpath \"%s\" toString == \"%s\"", jp, naarHurl(str)))
				default:
					asserts = append(asserts, fmt.Sprintf("jsonpath \"%s\" == %s", jp, jsString(str)))
				}
			} else {
				lit, _ := json.Marshal(w)
				asserts = append(asserts, fmt.Sprintf("jsonpath \"%s\" == %s", jp, string(lit)))
			}
		}
		if len(asserts) > 0 {
			b.WriteString("[Asserts]\n" + strings.Join(asserts, "\n") + "\n")
		}
	}
	return b.String()
}
