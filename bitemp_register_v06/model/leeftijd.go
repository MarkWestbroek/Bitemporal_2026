package model

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

// leeftijd.go — gedeelde afleiding van leeftijd uit een geboortedatum.
//
// Gebruikt als CEL-functie `leeftijd(geboortedatum[, peildatum])` in afgeleide
// velden. Deze helper is de enige bron van waarheid voor de leeftijdsberekening
// aan de backend-kant (zowel de full-REST-API als de GraphQL-resolvers roepen
// hem aan). De front-end heeft een equivalente implementatie in
// web/vite/src/shared/celEvaluator.js — houd beide in de pas.
//
// DatumIncompleet (BRP: onbekende component = 00) volgt de midpoint-conventie:
//   - alleen jaar bekend        → 1 juli van dat jaar
//   - jaar + maand bekend        → de 15e van die maand
//   - jaar onbekend / lege datum → niet bepaalbaar (nil)

var datumComponentenRe = regexp.MustCompile(`^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$`)

// datumComponenten ontleedt een datum-string naar jaar/maand/dag. Onbekende
// BRP-componenten (00 of ontbrekend) komen als 0 terug. Accepteert
// "JJJJ-MM-DD", "JJJJ-MM", "JJJJ" en een ISO date-time (het T-deel wordt
// genegeerd). ok is false als de string niet als datum te ontleden is.
func datumComponenten(s string) (jaar, maand, dag int, ok bool) {
	datumDeel := strings.SplitN(strings.TrimSpace(s), "T", 2)[0]
	m := datumComponentenRe.FindStringSubmatch(datumDeel)
	if m == nil {
		return 0, 0, 0, false
	}
	jaar, _ = strconv.Atoi(m[1])
	if m[2] != "" {
		maand, _ = strconv.Atoi(m[2])
	}
	if m[3] != "" {
		dag, _ = strconv.Atoi(m[3])
	}
	return jaar, maand, dag, true
}

// geboortedatumNaarTijd zet een (mogelijk incomplete) datum om naar een concrete
// dag (UTC) via de midpoint-conventie. ok is false als het jaar onbekend is of
// de string onparsbaar.
func geboortedatumNaarTijd(s string) (time.Time, bool) {
	jaar, maand, dag, ok := datumComponenten(s)
	if !ok || jaar == 0 {
		return time.Time{}, false
	}
	if maand == 0 {
		maand = 7 // juli
		dag = 1
	} else if dag == 0 {
		dag = 15
	}
	return time.Date(jaar, time.Month(maand), dag, 0, 0, 0, 0, time.UTC), true
}

// BerekenLeeftijd berekent de leeftijd in hele jaren op een peilmoment.
// peil == nil → vandaag (wandklok, UTC). Retourneert nil als de leeftijd niet
// bepaalbaar is (jaar onbekend, lege of onparsbare geboortedatum).
func BerekenLeeftijd(geboorte string, peil *time.Time) *int {
	g, ok := geboortedatumNaarTijd(geboorte)
	if !ok {
		return nil
	}

	var p time.Time
	if peil == nil {
		nu := time.Now().UTC()
		p = time.Date(nu.Year(), nu.Month(), nu.Day(), 0, 0, 0, 0, time.UTC)
	} else {
		pu := peil.UTC()
		p = time.Date(pu.Year(), pu.Month(), pu.Day(), 0, 0, 0, 0, time.UTC)
	}

	jaren := p.Year() - g.Year()
	if p.Month() < g.Month() || (p.Month() == g.Month() && p.Day() < g.Day()) {
		jaren-- // verjaardag op het peilmoment nog niet geweest
	}
	if jaren < 0 {
		return nil
	}
	return &jaren
}

// BerekenLeeftijdVanArgs is de string-variant zoals aangeroepen vanuit de
// CEL-evaluatoren: een lege peildatum betekent "vandaag". Een opgegeven
// peildatum wordt met dezelfde midpoint-conventie ontleed.
func BerekenLeeftijdVanArgs(geboorte, peil string) *int {
	if strings.TrimSpace(peil) == "" {
		return BerekenLeeftijd(geboorte, nil)
	}
	pt, ok := geboortedatumNaarTijd(peil)
	if !ok {
		return nil
	}
	return BerekenLeeftijd(geboorte, &pt)
}

// ─── Gedeelde parse-helpers voor functie-aanroepen in afgeleide velden ───────
//
// De backend-evaluatoren (handlers/full_handlers.go en dynql/query_resolvers.go)
// ondersteunen concatenatie met + plus een beperkte set functie-aanroepen zoals
// leeftijd(...). Deze pure string-helpers worden door beide gedeeld; de eigenlijke
// evaluatie van de argumenten (pad-navigatie) verschilt per pakket en blijft daar.

// ParseAfgeleideFunctieAanroep ontleedt een expressie van de vorm
// "naam(arg1, arg2, ...)" naar de functienaam en de rauwe (nog niet
// geëvalueerde) argument-strings. Top-level komma's worden gesplitst; quotes
// en geneste haakjes worden gerespecteerd. ok is false als expr geen enkele
// top-level functie-aanroep is. Argumenten mogen geen top-level '+' bevatten —
// dat wordt door de concatenatie-evaluator afgehandeld, niet hier.
func ParseAfgeleideFunctieAanroep(expr string) (naam string, args []string, ok bool) {
	expr = strings.TrimSpace(expr)
	open := strings.IndexByte(expr, '(')
	if open <= 0 || !strings.HasSuffix(expr, ")") {
		return "", nil, false
	}
	naam = strings.TrimSpace(expr[:open])
	if !isIdentifier(naam) {
		return "", nil, false
	}
	binnen := expr[open+1 : len(expr)-1]
	return naam, splitFunctieArgumenten(binnen), true
}

func isIdentifier(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r != '_' && !(r >= 'a' && r <= 'z') && !(r >= 'A' && r <= 'Z') && !(r >= '0' && r <= '9') {
			return false
		}
	}
	return true
}

func splitFunctieArgumenten(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	var args []string
	var cur strings.Builder
	inString := false
	depth := 0
	for i := 0; i < len(s); i++ {
		ch := s[i]
		switch {
		case ch == '"':
			inString = !inString
			cur.WriteByte(ch)
		case !inString && ch == '(':
			depth++
			cur.WriteByte(ch)
		case !inString && ch == ')':
			depth--
			cur.WriteByte(ch)
		case !inString && depth == 0 && ch == ',':
			args = append(args, strings.TrimSpace(cur.String()))
			cur.Reset()
		default:
			cur.WriteByte(ch)
		}
	}
	args = append(args, strings.TrimSpace(cur.String()))
	return args
}
