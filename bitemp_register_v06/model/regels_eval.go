package model

// regels_eval.go — Generieke evaluator voor V3Validatie.Regels.
//
// Plan B.A.2 (zie docs/BACKLOG_UITVOERING_INCREMENTEN.md), refactor R1.
//
// Drie regel-types worden ondersteund, parallel aan de frontend
// (web/vite/src/umleditor/validatie/regels.js):
//
//   - "checksum": expressie wordt geëvalueerd over `d1..dN` placeholders,
//     één per cijfer in de waarde. Voorbeeld (BSN 11-proef):
//       "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0"
//
//   - "formula": expressie krijgt `value` als variabele. Voorbeeld:
//       "value > 0"
//
//   - "function": expressie is een functienaam uit `validatieFuncties`.
//     Bedoeld als ontsnappingsluik voor regels die niet in een eenvoudige
//     expressie passen (bijv. IBAN mod-97 met letter→cijfer-mapping).
//     De namen leven in de V3-data; deze map bepaalt welke namen daadwerkelijk
//     uitvoerbaar zijn in Go (frontend heeft eigen, parallelle map).
//
// De expressie-evaluator gebruikt go/parser + een eigen AST-walker. Dat
// houdt ons in pure stdlib (geen externe expression engines) en geeft de
// modelleur vertrouwde Go-syntax. Ondersteunde operatoren:
//
//	+ - * / %    ==  !=  <  <=  >  >=    &&  ||  !    ( )
//
// Literals: integer- en float-literals. Variabelen: alles dat de caller
// in de env meegeeft. Geen functie-aanroepen, geen indexing — bewust
// minimaal en safe (geen side effects mogelijk).

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"strconv"
	"strings"
	"sync"
)

// ValidatieFunctie is het signature voor een named function-regel.
// Krijgt de (al genormaliseerde) waarde binnen en geeft true terug
// als de waarde geldig is. De error is voor uitvoerings- of inputfouten
// (niet voor "ongeldige waarde" — dat is `false, nil`).
type ValidatieFunctie func(waarde string) (bool, error)

// validatieFuncties is de Go-zijde dispatch-tabel voor regels van type
// "function". Sleutel = de naam zoals die in V3Regel.Expressie staat.
//
// Klein houden: alleen voor regels die echt niet als "checksum"/"formula"
// expressie te schrijven zijn. Frontend heeft een parallelle map in
// web/vite/src/umleditor/validatie/regels.js.
var validatieFuncties = map[string]ValidatieFunctie{
	"iban_mod97":      valideerIbanMod97,
	"bsn_11proef":     valideerBsn11Proef, // legacy alias; checksum-regel doet hetzelfde
	"geo_range":       valideerGeoRange,
	"isbn10_mod11":    valideerIsbn10Mod11,
	"lei_mod97":       valideerLeiMod97,
	"geolijn_geojson": valideerGeoLijnGeoJson,
	"geovlak_geojson": valideerGeoVlakGeoJson,
}

// RegistreerValidatieFunctie maakt een Go-validatiefunctie beschikbaar onder
// de gegeven naam, zodat een V3Regel met type="function" en expressie=naam
// hem kan aanroepen. Bedoeld voor uitbreiding vanuit andere packages of tests.
func RegistreerValidatieFunctie(naam string, fn ValidatieFunctie) {
	validatieFuncties[naam] = fn
}

// ValidatieFunctieNamen geeft de namen terug die momenteel als function-regel
// gebruikt kunnen worden. Handig voor IDE-suggestielijst en docs.
func ValidatieFunctieNamen() []string {
	namen := make([]string, 0, len(validatieFuncties))
	for n := range validatieFuncties {
		namen = append(namen, n)
	}
	return namen
}

// ============================================================================
// Regel-evaluatie
// ============================================================================

// evalueerRegel voert één V3Regel uit op `waarde` en retourneert een
// ValidatieFout als de regel niet voldoet (of niet uitvoerbaar bleek).
// Retourneert (nil, nil) als de regel slaagt.
func evalueerRegel(regel V3Regel, waarde string) *ValidatieFout {
	switch regel.Type {
	case "checksum":
		ok, err := evalueerChecksum(regel.Expressie, waarde)
		if err != nil {
			return &ValidatieFout{
				Code: "regel-checksum-fout", Severity: SeverityError,
				Bericht: fmt.Sprintf("Checksum-regel %q kon niet worden geëvalueerd: %v", regel.Naam, err),
				Waarde:  waarde,
			}
		}
		if !ok {
			return &ValidatieFout{
				Code: "checksum", Severity: SeverityError,
				Bericht: fmt.Sprintf("Waarde voldoet niet aan %s", regelNaam(regel)),
				Waarde:  waarde,
			}
		}
	case "formula":
		ok, err := evalueerFormula(regel.Expressie, waarde)
		if err != nil {
			return &ValidatieFout{
				Code: "regel-formula-fout", Severity: SeverityError,
				Bericht: fmt.Sprintf("Formula-regel %q kon niet worden geëvalueerd: %v", regel.Naam, err),
				Waarde:  waarde,
			}
		}
		if !ok {
			return &ValidatieFout{
				Code: "formula", Severity: SeverityError,
				Bericht: fmt.Sprintf("Waarde voldoet niet aan %s", regelNaam(regel)),
				Waarde:  waarde,
			}
		}
	case "function":
		fn, ok := validatieFuncties[strings.TrimSpace(regel.Expressie)]
		if !ok {
			// Onbekende functie = waarschuwing maar geen blocker, anders
			// blokkeert een type per ongeluk alle requests.
			return &ValidatieFout{
				Code: "regel-function-onbekend", Severity: SeverityWarning,
				Bericht: fmt.Sprintf("Onbekende validatiefunctie %q (regel %q)", regel.Expressie, regel.Naam),
				Waarde:  waarde,
			}
		}
		ok2, err := fn(waarde)
		if err != nil {
			return &ValidatieFout{
				Code: "regel-function-fout", Severity: SeverityError,
				Bericht: fmt.Sprintf("Functie %q faalde: %v", regel.Expressie, err),
				Waarde:  waarde,
			}
		}
		if !ok2 {
			return &ValidatieFout{
				Code: "function", Severity: SeverityError,
				Bericht: fmt.Sprintf("Waarde voldoet niet aan %s", regelNaam(regel)),
				Waarde:  waarde,
			}
		}
	default:
		// Onbekend regeltype: waarschuwing, niet blokkerend.
		return &ValidatieFout{
			Code: "regel-onbekend", Severity: SeverityWarning,
			Bericht: fmt.Sprintf("Onbekend regeltype %q (regel %q)", regel.Type, regel.Naam),
			Waarde:  waarde,
		}
	}
	return nil
}

// regelNaam geeft een leesbare aanduiding voor een regel terug.
func regelNaam(r V3Regel) string {
	if r.Naam != "" {
		return r.Naam
	}
	return r.Type + "-regel"
}

// ============================================================================
// Generieke expressie-evaluator (pure stdlib via go/parser)
// ============================================================================

// evalueerChecksum splitst de waarde in losse cijfers, bindt ze aan d1..dN
// en evalueert de expressie. Niet-cijfertekens worden overgeslagen, zodat
// "1234 AB" of "NL91 ABNA …" netjes werken voor zover de expressie zinnig is.
// De expressie moet een booleans-resultaat opleveren.
func evalueerChecksum(expressie string, waarde string) (bool, error) {
	cijfers := haalCijfers(waarde)
	env := make(map[string]any, len(cijfers)+1)
	for i, c := range cijfers {
		env[fmt.Sprintf("d%d", i+1)] = int64(c)
	}
	env["n"] = int64(len(cijfers))
	res, err := evalueerExpressie(expressie, env)
	if err != nil {
		return false, err
	}
	b, ok := res.(bool)
	if !ok {
		return false, fmt.Errorf("checksum-expressie levert geen boolean op (kreeg %T)", res)
	}
	return b, nil
}

// evalueerFormula evalueert een expressie met `value` (en, als de waarde
// een geldig getal is, ook als numerieke waarde via `valueNum`).
func evalueerFormula(expressie string, waarde string) (bool, error) {
	env := map[string]any{
		"value": waarde,
	}
	if f, err := strconv.ParseFloat(waarde, 64); err == nil {
		env["valueNum"] = f
	}
	if i, err := strconv.ParseInt(waarde, 10, 64); err == nil {
		env["valueInt"] = i
	}
	res, err := evalueerExpressie(expressie, env)
	if err != nil {
		return false, err
	}
	b, ok := res.(bool)
	if !ok {
		return false, fmt.Errorf("formula-expressie levert geen boolean op (kreeg %T)", res)
	}
	return b, nil
}

// haalCijfers extraheert alle decimale cijfers uit een string (in volgorde).
func haalCijfers(s string) []int {
	out := make([]int, 0, len(s))
	for _, r := range s {
		if r >= '0' && r <= '9' {
			out = append(out, int(r-'0'))
		}
	}
	return out
}

// expressieAstCache bewaart geparste expressies (parsen is duurder dan eval).
var (
	expressieCacheMu sync.RWMutex
	expressieCache   = map[string]ast.Expr{}
)

// evalueerExpressie parset de expressie (met cache) en evalueert hem in env.
func evalueerExpressie(expressie string, env map[string]any) (any, error) {
	expressieCacheMu.RLock()
	parsed, ok := expressieCache[expressie]
	expressieCacheMu.RUnlock()
	if !ok {
		p, err := parser.ParseExpr(expressie)
		if err != nil {
			return nil, fmt.Errorf("parsen mislukt: %w", err)
		}
		expressieCacheMu.Lock()
		expressieCache[expressie] = p
		expressieCacheMu.Unlock()
		parsed = p
	}
	return evalAst(parsed, env)
}

// evalAst is de eigenlijke recursieve evaluator over een Go-AST.
// Ondersteunt:
//   - BasicLit:    INT, FLOAT, STRING
//   - Ident:       lookup in env (true/false/nil literal voor gemak)
//   - ParenExpr:   doorgeven
//   - UnaryExpr:   - en !
//   - BinaryExpr:  + - * / % == != < <= > >= && ||
func evalAst(node ast.Expr, env map[string]any) (any, error) {
	switch n := node.(type) {
	case *ast.ParenExpr:
		return evalAst(n.X, env)

	case *ast.BasicLit:
		switch n.Kind {
		case token.INT:
			i, err := strconv.ParseInt(n.Value, 0, 64)
			if err != nil {
				return nil, fmt.Errorf("ongeldig integer-literal %q: %w", n.Value, err)
			}
			return i, nil
		case token.FLOAT:
			f, err := strconv.ParseFloat(n.Value, 64)
			if err != nil {
				return nil, fmt.Errorf("ongeldig float-literal %q: %w", n.Value, err)
			}
			return f, nil
		case token.STRING:
			s, err := strconv.Unquote(n.Value)
			if err != nil {
				return nil, fmt.Errorf("ongeldig string-literal %q: %w", n.Value, err)
			}
			return s, nil
		default:
			return nil, fmt.Errorf("niet-ondersteund literal-type %v", n.Kind)
		}

	case *ast.Ident:
		switch n.Name {
		case "true":
			return true, nil
		case "false":
			return false, nil
		case "nil":
			return nil, nil
		}
		v, ok := env[n.Name]
		if !ok {
			return nil, fmt.Errorf("onbekende variabele %q", n.Name)
		}
		return v, nil

	case *ast.UnaryExpr:
		x, err := evalAst(n.X, env)
		if err != nil {
			return nil, err
		}
		switch n.Op {
		case token.SUB:
			switch v := x.(type) {
			case int64:
				return -v, nil
			case float64:
				return -v, nil
			default:
				return nil, fmt.Errorf("kan geen unair minus toepassen op %T", x)
			}
		case token.NOT:
			b, ok := x.(bool)
			if !ok {
				return nil, fmt.Errorf("kan geen ! toepassen op %T", x)
			}
			return !b, nil
		default:
			return nil, fmt.Errorf("niet-ondersteunde unary operator %v", n.Op)
		}

	case *ast.BinaryExpr:
		// Short-circuit voor && en ||.
		if n.Op == token.LAND || n.Op == token.LOR {
			left, err := evalAst(n.X, env)
			if err != nil {
				return nil, err
			}
			lb, ok := left.(bool)
			if !ok {
				return nil, fmt.Errorf("linkerkant van %v moet bool zijn, was %T", n.Op, left)
			}
			if n.Op == token.LAND && !lb {
				return false, nil
			}
			if n.Op == token.LOR && lb {
				return true, nil
			}
			right, err := evalAst(n.Y, env)
			if err != nil {
				return nil, err
			}
			rb, ok := right.(bool)
			if !ok {
				return nil, fmt.Errorf("rechterkant van %v moet bool zijn, was %T", n.Op, right)
			}
			return rb, nil
		}
		left, err := evalAst(n.X, env)
		if err != nil {
			return nil, err
		}
		right, err := evalAst(n.Y, env)
		if err != nil {
			return nil, err
		}
		return evalBinop(n.Op, left, right)

	default:
		return nil, fmt.Errorf("niet-ondersteund AST-knooppunt %T", node)
	}
}

// evalBinop voert numerieke en vergelijkings-operatoren uit.
// Ints worden naar floats gepromoveerd zodra een van beide operanden float is.
func evalBinop(op token.Token, l, r any) (any, error) {
	// Vergelijking op strings.
	if ls, lok := l.(string); lok {
		if rs, rok := r.(string); rok {
			switch op {
			case token.EQL:
				return ls == rs, nil
			case token.NEQ:
				return ls != rs, nil
			default:
				return nil, fmt.Errorf("operator %v niet ondersteund voor strings", op)
			}
		}
	}
	// Numeriek pad.
	lf, lIsFloat, lerr := alsGetal(l)
	if lerr != nil {
		return nil, lerr
	}
	rf, rIsFloat, rerr := alsGetal(r)
	if rerr != nil {
		return nil, rerr
	}
	useFloat := lIsFloat || rIsFloat
	switch op {
	case token.ADD:
		if useFloat {
			return lf + rf, nil
		}
		return int64(lf) + int64(rf), nil
	case token.SUB:
		if useFloat {
			return lf - rf, nil
		}
		return int64(lf) - int64(rf), nil
	case token.MUL:
		if useFloat {
			return lf * rf, nil
		}
		return int64(lf) * int64(rf), nil
	case token.QUO:
		if rf == 0 {
			return nil, fmt.Errorf("deling door 0")
		}
		if useFloat {
			return lf / rf, nil
		}
		return int64(lf) / int64(rf), nil
	case token.REM:
		if rf == 0 {
			return nil, fmt.Errorf("modulo door 0")
		}
		return int64(lf) % int64(rf), nil
	case token.EQL:
		return lf == rf, nil
	case token.NEQ:
		return lf != rf, nil
	case token.LSS:
		return lf < rf, nil
	case token.LEQ:
		return lf <= rf, nil
	case token.GTR:
		return lf > rf, nil
	case token.GEQ:
		return lf >= rf, nil
	default:
		return nil, fmt.Errorf("niet-ondersteunde operator %v", op)
	}
}

func alsGetal(v any) (float64, bool, error) {
	switch x := v.(type) {
	case int64:
		return float64(x), false, nil
	case int:
		return float64(x), false, nil
	case float64:
		return x, true, nil
	default:
		return 0, false, fmt.Errorf("verwacht numerieke waarde, kreeg %T", v)
	}
}

// ============================================================================
// Named functions (escape hatch voor regels die niet in expressies passen)
// ============================================================================

// valideerBsn11Proef is een legacy alias; de checksum-regel op BSN doet
// inhoudelijk hetzelfde (en is de canonieke uitvoering).
func valideerBsn11Proef(s string) (bool, error) {
	cijfers := haalCijfers(s)
	if len(cijfers) != 9 {
		return false, nil
	}
	sum := 0
	for i := 0; i < 8; i++ {
		sum += cijfers[i] * (9 - i)
	}
	sum -= cijfers[8]
	return sum%11 == 0, nil
}

// valideerIbanMod97 voert ISO-7064 mod-97 controle uit op een IBAN.
// Letters worden vervangen door cijfers (A=10..Z=35); de eerste 4 tekens
// (landcode + controlecijfers) worden naar achteren verplaatst.
func valideerIbanMod97(s string) (bool, error) {
	clean := strings.ToUpper(strings.ReplaceAll(s, " ", ""))
	if len(clean) < 5 || len(clean) > 34 {
		return false, nil
	}
	herschikt := clean[4:] + clean[:4]
	var sb strings.Builder
	for _, r := range herschikt {
		switch {
		case r >= '0' && r <= '9':
			sb.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			sb.WriteString(strconv.Itoa(int(r - 'A' + 10)))
		default:
			return false, fmt.Errorf("ongeldig teken %q", r)
		}
	}
	rem := 0
	for _, r := range sb.String() {
		rem = (rem*10 + int(r-'0')) % 97
	}
	return rem == 1, nil
}

// valideerGeoRange parseert "lat,lng" en checkt lat ∈ [-90,90] en lng ∈ [-180,180].
func valideerGeoRange(s string) (bool, error) {
	parts := strings.SplitN(strings.TrimSpace(s), ",", 2)
	if len(parts) != 2 {
		return false, nil
	}
	lat, err := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	if err != nil {
		return false, nil
	}
	lng, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	if err != nil {
		return false, nil
	}
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180, nil
}

// valideerIsbn10Mod11 voert de ISBN-10 (mod-11) controle uit.
// Het 10e teken mag '0'-'9' of 'X' (=10) zijn. Koppeltekens worden gestript.
// Formule: (10*d1 + 9*d2 + 8*d3 + 7*d4 + 6*d5 + 5*d6 + 4*d7 + 3*d8 + 2*d9 + d10) % 11 == 0
func valideerIsbn10Mod11(s string) (bool, error) {
	clean := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(s), "-", ""))
	if len(clean) != 10 {
		return false, nil
	}
	sum := 0
	for i := 0; i < 9; i++ {
		c := clean[i]
		if c < '0' || c > '9' {
			return false, nil
		}
		sum += int(c-'0') * (10 - i)
	}
	last := clean[9]
	switch {
	case last == 'X':
		sum += 10
	case last >= '0' && last <= '9':
		sum += int(last - '0')
	default:
		return false, nil
	}
	return sum%11 == 0, nil
}

// valideerGeoLijnGeoJson controleert of de waarde een geldig GeoJSON LineString-
// object is met minimaal 2 coördinatenparen (RFC 7946). De coördinaten worden
// niet op WGS84-range gecontroleerd — dat doet geo_range indien gecombineerd.
func valideerGeoLijnGeoJson(s string) (bool, error) {
	s = strings.TrimSpace(s)
	var geom struct {
		Type        string      `json:"type"`
		Coordinates [][]float64 `json:"coordinates"`
	}
	if err := json.Unmarshal([]byte(s), &geom); err != nil {
		return false, fmt.Errorf("ongeldige JSON voor GeoLijn: %w", err)
	}
	if geom.Type != "LineString" {
		return false, nil
	}
	if len(geom.Coordinates) < 2 {
		return false, nil
	}
	return true, nil
}

// valideerGeoVlakGeoJson controleert of de waarde een geldig GeoJSON Polygon-
// object is met minimaal 4 coördinatenparen in de eerste ring en een gesloten
// ring (eerste == laatste coördinaat) conform RFC 7946.
func valideerGeoVlakGeoJson(s string) (bool, error) {
	s = strings.TrimSpace(s)
	var geom struct {
		Type        string        `json:"type"`
		Coordinates [][][]float64 `json:"coordinates"`
	}
	if err := json.Unmarshal([]byte(s), &geom); err != nil {
		return false, fmt.Errorf("ongeldige JSON voor GeoVlak: %w", err)
	}
	if geom.Type != "Polygon" {
		return false, nil
	}
	if len(geom.Coordinates) == 0 {
		return false, nil
	}
	ring := geom.Coordinates[0]
	if len(ring) < 4 {
		return false, nil
	}
	// RFC 7946: eerste en laatste coördinaat moeten gelijk zijn (gesloten ring)
	first, last := ring[0], ring[len(ring)-1]
	if len(first) < 2 || len(last) < 2 {
		return false, nil
	}
	if first[0] != last[0] || first[1] != last[1] {
		return false, nil
	}
	return true, nil
}

// valideerLeiMod97 voert de ISO 17442 / ISO 7064 (mod-97) controle uit op een LEI.
// Letters worden vervangen door hun numerieke waarde (A=10..Z=35); de volledige
// 20-teken reeks wordt als één groot getal behandeld en mag geen rest geven bij
// deling door 97 behalve 1. Geen herplaatsing van tekens nodig (verschil met IBAN).
func valideerLeiMod97(s string) (bool, error) {
	clean := strings.ToUpper(strings.TrimSpace(s))
	if len(clean) != 20 {
		return false, nil
	}
	var sb strings.Builder
	for _, r := range clean {
		switch {
		case r >= '0' && r <= '9':
			sb.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			sb.WriteString(strconv.Itoa(int(r-'A') + 10))
		default:
			return false, fmt.Errorf("ongeldig teken %q in LEI", r)
		}
	}
	rem := 0
	for _, r := range sb.String() {
		rem = (rem*10 + int(r-'0')) % 97
	}
	return rem == 1, nil
}
