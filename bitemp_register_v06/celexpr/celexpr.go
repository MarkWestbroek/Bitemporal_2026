// Package celexpr is de expressietaal van afgeleide velden en afgeleide relaties: de
// CEL-subset van web/vite/src/shared/celEvaluator.js, één-op-één naar Go gebracht, plus
// navigatie (docs/plans/2026-10-11 Afgeleide relaties backend — ontwerp.md §3).
//
// Ondersteund (gelijk aan de frontend):
//   - literals: 'tekst' / "tekst", getallen, true, false, null
//   - paden: ident, ident.veld, a.b.c — hoofdletterongevoelig, exacte treffer gaat voor
//   - operatoren: + (tekst-samenvoeging), == != > >= < <=, && || !, cond ? a : b, ( … )
//   - lijsten: l.filter(x, pred), l.map(x, expr), l.exists(x, pred), l.all(x, pred),
//     l.size(), l[n]
//   - functies: string(v), size(v), int(v), leeftijd(geboortedatum[, peildatum])
//
// Navigatie (nieuw, ontwerp §3.3): een veld opvragen op een lijst past het veld toe op elk
// element en zet de uitkomsten plat in één lijst, zonder null (OCL-collect). Zo werkt
// `ouders.ouders`. De frontend gaf hier null.
//
// Het pakket kent geen MetaRegistry en geen database: waarden zijn JSON-achtig
// (nil, bool, float64, string, []any, map[string]any) of een Object dat zelf zijn velden
// oplevert (zo kijkt een relatie-voorkomen door naar zijn doelentiteit, zie pakket afleiding).
// Net als de frontend is evaluatie mild: een ontbrekend veld of een onzinnige bewerking
// levert null op, geen fout. Alleen parsen kan falen.
package celexpr

import (
	"fmt"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

// Object is een waarde die zijn velden zelf oplevert (bijv. een entiteit of een
// relatie-voorkomen met doorkijk). Veld zoekt hoofdletterongevoelig, met voorrang voor een
// exacte treffer; ok=false betekent "onbekend veld" (de evaluator maakt er null van).
type Object interface {
	Veld(naam string) (any, bool)
}

// Expr is een geparste expressie, herbruikbaar en veilig voor gelijktijdig gebruik.
type Expr struct {
	bron string
	root *node
}

// Bron geeft de oorspronkelijke expressietekst.
func (e *Expr) Bron() string { return e.bron }

// Parse ontleedt een expressie. Anders dan de frontend (die tekst na een volledige
// expressie negeert) is dit strikt: overgebleven tokens zijn een fout.
func Parse(expressie string) (*Expr, error) {
	p := &parser{tokens: tokenize(expressie)}
	root, err := p.parseExprSafe()
	if err != nil {
		return nil, err
	}
	if t := p.peek(); t.typ != tEOF {
		return nil, fmt.Errorf("onverwacht %s na de expressie", t.typ)
	}
	return &Expr{bron: expressie, root: root}, nil
}

// MustParse is Parse die bij een fout paniekt (voor tests en vaste expressies).
func MustParse(expressie string) *Expr {
	e, err := Parse(expressie)
	if err != nil {
		panic(err)
	}
	return e
}

// Eval evalueert de expressie met ctx als context (een map[string]any of een Object).
func (e *Expr) Eval(ctx any) any {
	return evaluate(e.root, scope{root: ctx})
}

// Evalueer parset en evalueert in één keer; bij een parsefout is de uitkomst nil
// (zoals evalueerCelExpressie in de frontend) en wordt de fout teruggegeven.
func Evalueer(expressie string, ctx any) (any, error) {
	e, err := Parse(expressie)
	if err != nil {
		return nil, err
	}
	return e.Eval(ctx), nil
}

// Nu levert "vandaag" voor leeftijd() zonder peildatum (wandklok, zoals de frontend).
// Tests kunnen hem vervangen.
var Nu = time.Now

// ── Tokenizer ───────────────────────────────────────────────────────────

type tokenType string

const (
	tString   tokenType = "STRING"
	tNumber   tokenType = "NUMBER"
	tNull     tokenType = "NULL"
	tTrue     tokenType = "TRUE"
	tFalse    tokenType = "FALSE"
	tIdent    tokenType = "IDENT"
	tDot      tokenType = "DOT"
	tPlus     tokenType = "PLUS"
	tEq       tokenType = "EQ"
	tNeq      tokenType = "NEQ"
	tGt       tokenType = "GT"
	tGte      tokenType = "GTE"
	tLt       tokenType = "LT"
	tLte      tokenType = "LTE"
	tAnd      tokenType = "AND"
	tOr       tokenType = "OR"
	tNot      tokenType = "NOT"
	tQuestion tokenType = "QUESTION"
	tColon    tokenType = "COLON"
	tLParen   tokenType = "LPAREN"
	tRParen   tokenType = "RPAREN"
	tLBracket tokenType = "LBRACKET"
	tRBracket tokenType = "RBRACKET"
	tComma    tokenType = "COMMA"
	tEOF      tokenType = "EOF"
)

type token struct {
	typ tokenType
	str string
	num float64
}

func isCijfer(r rune) bool { return r >= '0' && r <= '9' }
func isIdentStart(r rune) bool {
	return r == '_' || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
}
func isIdentDeel(r rune) bool { return isIdentStart(r) || isCijfer(r) }

func tokenize(expr string) []token {
	rs := []rune(expr)
	var tokens []token
	at := func(i int) rune {
		if i < len(rs) {
			return rs[i]
		}
		return 0
	}
	for i := 0; i < len(rs); {
		ch := rs[i]
		switch {
		case ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r':
			i++
		case ch == '\'' || ch == '"':
			quote := ch
			var sb strings.Builder
			i++
			for i < len(rs) && rs[i] != quote {
				if rs[i] == '\\' && i+1 < len(rs) {
					sb.WriteRune(rs[i+1])
					i += 2
				} else {
					sb.WriteRune(rs[i])
					i++
				}
			}
			i++ // sluitend aanhalingsteken
			tokens = append(tokens, token{typ: tString, str: sb.String()})
		case isCijfer(ch) || (ch == '-' && isCijfer(at(i+1))):
			start := i
			i++
			for i < len(rs) && (isCijfer(rs[i]) || rs[i] == '.') {
				i++
			}
			n, err := strconv.ParseFloat(string(rs[start:i]), 64)
			if err != nil {
				n = math.NaN() // zoals Number("1.2.3") in JS
			}
			tokens = append(tokens, token{typ: tNumber, num: n})
		case ch == '!' && at(i+1) == '=':
			tokens, i = append(tokens, token{typ: tNeq}), i+2
		case ch == '=' && at(i+1) == '=':
			tokens, i = append(tokens, token{typ: tEq}), i+2
		case ch == '&' && at(i+1) == '&':
			tokens, i = append(tokens, token{typ: tAnd}), i+2
		case ch == '|' && at(i+1) == '|':
			tokens, i = append(tokens, token{typ: tOr}), i+2
		case ch == '>' && at(i+1) == '=':
			tokens, i = append(tokens, token{typ: tGte}), i+2
		case ch == '<' && at(i+1) == '=':
			tokens, i = append(tokens, token{typ: tLte}), i+2
		case isIdentStart(ch):
			start := i
			for i < len(rs) && isIdentDeel(rs[i]) {
				i++
			}
			switch ident := string(rs[start:i]); ident {
			case "null":
				tokens = append(tokens, token{typ: tNull})
			case "true":
				tokens = append(tokens, token{typ: tTrue})
			case "false":
				tokens = append(tokens, token{typ: tFalse})
			default:
				tokens = append(tokens, token{typ: tIdent, str: ident})
			}
		default:
			enkel := map[rune]tokenType{
				'+': tPlus, '!': tNot, '>': tGt, '<': tLt, '?': tQuestion, ':': tColon,
				'(': tLParen, ')': tRParen, '[': tLBracket, ']': tRBracket, ',': tComma, '.': tDot,
			}
			if t, ok := enkel[ch]; ok {
				tokens = append(tokens, token{typ: t})
			}
			i++ // onbekend teken: overslaan (zoals de frontend)
		}
	}
	return append(tokens, token{typ: tEOF})
}

// ── Parser (recursive descent, zelfde grammatica als de frontend) ─────────

type nodeKind int

const (
	nString nodeKind = iota
	nNumber
	nBool
	nNull
	nIdent
	nField
	nIndex
	nMethod
	nFuncall
	nBinary
	nNot
	nTernary
)

type node struct {
	kind    nodeKind
	str     string // string-literal, ident-naam, veldnaam, methode-/functienaam, binaire operator
	num     float64
	b       bool
	obj     *node   // field/index/method: het object
	key     *node   // index: de sleutel
	args    []*node // funcall/method zonder lambda
	varName string  // method met lambda
	body    *node   // method met lambda
	left    *node   // binary
	right   *node
	cond    *node // ternary
	dan     *node
	anders  *node
}

var lambdaMethoden = map[string]bool{"filter": true, "map": true, "exists": true, "all": true}

type parseFout struct{ msg string }

type parser struct {
	tokens []token
	pos    int
}

func (p *parser) peek() token {
	if p.pos < len(p.tokens) {
		return p.tokens[p.pos]
	}
	return token{typ: tEOF}
}

func (p *parser) advance() token {
	t := p.peek()
	p.pos++
	return t
}

func (p *parser) expect(t tokenType) token {
	got := p.advance()
	if got.typ != t {
		panic(parseFout{fmt.Sprintf("verwacht %s, kreeg %s", t, got.typ)})
	}
	return got
}

func (p *parser) parseExprSafe() (n *node, err error) {
	defer func() {
		if r := recover(); r != nil {
			pf, ok := r.(parseFout)
			if !ok {
				panic(r)
			}
			err = fmt.Errorf("%s", pf.msg)
		}
	}()
	return p.parseExpr(), nil
}

func (p *parser) parseExpr() *node { return p.parseTernary() }

func (p *parser) parseTernary() *node {
	n := p.parseOr()
	if p.peek().typ == tQuestion {
		p.advance()
		dan := p.parseExpr()
		p.expect(tColon)
		anders := p.parseExpr()
		n = &node{kind: nTernary, cond: n, dan: dan, anders: anders}
	}
	return n
}

func (p *parser) parseOr() *node {
	left := p.parseAnd()
	for p.peek().typ == tOr {
		p.advance()
		left = &node{kind: nBinary, str: "||", left: left, right: p.parseAnd()}
	}
	return left
}

func (p *parser) parseAnd() *node {
	left := p.parseComparison()
	for p.peek().typ == tAnd {
		p.advance()
		left = &node{kind: nBinary, str: "&&", left: left, right: p.parseComparison()}
	}
	return left
}

var vergelijkOps = map[tokenType]string{tEq: "==", tNeq: "!=", tGt: ">", tGte: ">=", tLt: "<", tLte: "<="}

func (p *parser) parseComparison() *node {
	left := p.parseAddition()
	if op, ok := vergelijkOps[p.peek().typ]; ok {
		p.advance()
		return &node{kind: nBinary, str: op, left: left, right: p.parseAddition()}
	}
	return left
}

func (p *parser) parseAddition() *node {
	left := p.parseUnary()
	for p.peek().typ == tPlus {
		p.advance()
		left = &node{kind: nBinary, str: "+", left: left, right: p.parseUnary()}
	}
	return left
}

func (p *parser) parseUnary() *node {
	if p.peek().typ == tNot {
		p.advance()
		return &node{kind: nNot, obj: p.parseUnary()}
	}
	return p.parsePostfix()
}

func (p *parser) parseArgs() []*node {
	var args []*node
	for p.peek().typ != tRParen && p.peek().typ != tEOF {
		args = append(args, p.parseExpr())
		if p.peek().typ == tComma {
			p.advance()
		}
	}
	p.expect(tRParen)
	return args
}

func (p *parser) parsePostfix() *node {
	n := p.parseAtom()
	for {
		switch p.peek().typ {
		case tDot:
			p.advance()
			naam := p.expect(tIdent).str
			if p.peek().typ != tLParen {
				n = &node{kind: nField, obj: n, str: naam}
				continue
			}
			p.advance()
			if lambdaMethoden[naam] {
				varName := p.expect(tIdent).str
				p.expect(tComma)
				body := p.parseExpr()
				p.expect(tRParen)
				n = &node{kind: nMethod, obj: n, str: naam, varName: varName, body: body}
			} else {
				n = &node{kind: nMethod, obj: n, str: naam, args: p.parseArgs()}
			}
		case tLBracket:
			p.advance()
			key := p.parseExpr()
			p.expect(tRBracket)
			n = &node{kind: nIndex, obj: n, key: key}
		default:
			return n
		}
	}
}

func (p *parser) parseAtom() *node {
	t := p.peek()
	switch t.typ {
	case tString:
		p.advance()
		return &node{kind: nString, str: t.str}
	case tNumber:
		p.advance()
		return &node{kind: nNumber, num: t.num}
	case tNull:
		p.advance()
		return &node{kind: nNull}
	case tTrue, tFalse:
		p.advance()
		return &node{kind: nBool, b: t.typ == tTrue}
	case tLParen:
		p.advance()
		inner := p.parseExpr()
		p.expect(tRParen)
		return inner
	case tIdent:
		p.advance()
		if p.peek().typ == tLParen {
			p.advance()
			return &node{kind: nFuncall, str: t.str, args: p.parseArgs()}
		}
		return &node{kind: nIdent, str: t.str}
	}
	panic(parseFout{fmt.Sprintf("onverwacht token: %s", t.typ)})
}

// ── Evaluator ──────────────────────────────────────────────────────────

// scope is de context plus de lambda-variabelen (x in l.filter(x, …)).
type scope struct {
	root any
	vars map[string]any
}

func (s scope) met(naam string, waarde any) scope {
	vars := make(map[string]any, len(s.vars)+1)
	for k, v := range s.vars {
		vars[k] = v
	}
	vars[naam] = waarde
	return scope{root: s.root, vars: vars}
}

func (s scope) zoek(naam string) any {
	if v, ok := s.vars[naam]; ok {
		return v
	}
	if v, ok := LeesVeld(s.root, naam); ok {
		return v
	}
	for k, v := range s.vars {
		if strings.EqualFold(k, naam) {
			return v
		}
	}
	return nil
}

// LeesVeld leest een veld van een map of Object, hoofdletterongevoelig met voorrang voor een
// exacte treffer. Bij meerdere treffers zonder exacte wint de alfabetisch eerste sleutel
// (deterministisch; de frontend kiest de eerst ingevoegde).
func LeesVeld(bron any, naam string) (any, bool) {
	switch b := bron.(type) {
	case Object:
		return b.Veld(naam)
	case map[string]any:
		if v, ok := b[naam]; ok {
			return v, true
		}
		var sleutels []string
		for k := range b {
			if strings.EqualFold(k, naam) {
				sleutels = append(sleutels, k)
			}
		}
		if len(sleutels) == 0 {
			return nil, false
		}
		sort.Strings(sleutels)
		return b[sleutels[0]], true
	}
	return nil, false
}

// veldVan is veldtoegang `obj.veld`, met collect over lijsten (ontwerp §3.3).
func veldVan(obj any, naam string) any {
	if lijst, ok := obj.([]any); ok {
		uit := []any{}
		for _, el := range lijst {
			switch v := veldVan(el, naam).(type) {
			case nil:
			case []any:
				for _, w := range v {
					if w != nil {
						uit = append(uit, w)
					}
				}
			default:
				uit = append(uit, v)
			}
		}
		return uit
	}
	v, _ := LeesVeld(obj, naam)
	return v
}

func evaluate(n *node, s scope) any {
	switch n.kind {
	case nString:
		return n.str
	case nNumber:
		return n.num
	case nBool:
		return n.b
	case nNull:
		return nil
	case nIdent:
		return s.zoek(n.str)
	case nField:
		return veldVan(evaluate(n.obj, s), n.str)
	case nIndex:
		obj, key := evaluate(n.obj, s), evaluate(n.key, s)
		if obj == nil || key == nil {
			return nil
		}
		if lijst, ok := obj.([]any); ok {
			idx := naarGetal(key)
			if idx >= 0 && idx < float64(len(lijst)) && idx == math.Trunc(idx) {
				return lijst[int(idx)]
			}
			return nil
		}
		v, _ := LeesVeld(obj, Tekst(key))
		return v
	case nMethod:
		return evalMethode(n, s)
	case nFuncall:
		return evalFunctie(n, s)
	case nNot:
		return !Waar(evaluate(n.obj, s))
	case nTernary:
		if Waar(evaluate(n.cond, s)) {
			return evaluate(n.dan, s)
		}
		return evaluate(n.anders, s)
	case nBinary:
		return evalBinair(n, s)
	}
	return nil
}

func evalMethode(n *node, s scope) any {
	obj := evaluate(n.obj, s)
	lijst, isLijst := obj.([]any)
	switch n.str {
	case "size":
		return grootte(obj)
	case "filter":
		uit := []any{}
		for _, el := range lijst {
			if Waar(evaluate(n.body, s.met(n.varName, el))) {
				uit = append(uit, el)
			}
		}
		return uit
	case "map":
		uit := []any{}
		for _, el := range lijst {
			uit = append(uit, evaluate(n.body, s.met(n.varName, el)))
		}
		return uit
	case "exists":
		for _, el := range lijst {
			if Waar(evaluate(n.body, s.met(n.varName, el))) {
				return true
			}
		}
		return false
	case "all":
		if !isLijst {
			return true
		}
		for _, el := range lijst {
			if !Waar(evaluate(n.body, s.met(n.varName, el))) {
				return false
			}
		}
		return true
	}
	return nil
}

func evalFunctie(n *node, s scope) any {
	arg := func(i int) any {
		if i < len(n.args) {
			return evaluate(n.args[i], s)
		}
		return nil
	}
	switch n.str {
	case "string":
		v := arg(0)
		if v == nil {
			return ""
		}
		return Tekst(v)
	case "size":
		return grootte(arg(0))
	case "int":
		v := arg(0)
		if v == nil {
			return float64(0)
		}
		return parseIntJS(Tekst(v))
	case "leeftijd":
		var geboorte, peil any = arg(0), nil
		if len(n.args) > 1 {
			peil = arg(1)
		}
		if lft := Leeftijd(geboorte, peil); lft != nil {
			return float64(*lft)
		}
		return nil
	}
	return nil
}

func evalBinair(n *node, s scope) any {
	switch n.str {
	case "&&":
		return Waar(evaluate(n.left, s)) && Waar(evaluate(n.right, s))
	case "||":
		return Waar(evaluate(n.left, s)) || Waar(evaluate(n.right, s))
	}
	l, r := evaluate(n.left, s), evaluate(n.right, s)
	switch n.str {
	case "+":
		// Zoals de frontend: + voegt altijd tekst samen; null telt als "".
		lt, rt := "", ""
		if l != nil {
			lt = Tekst(l)
		}
		if r != nil {
			rt = Tekst(r)
		}
		return lt + rt
	case "==":
		return gelijk(l, r)
	case "!=":
		return !gelijk(l, r)
	case ">", ">=", "<", "<=":
		return vergelijk(n.str, l, r)
	}
	return nil
}

// ── JS-semantiek van waarden ────────────────────────────────────────────

// Waar is JavaScript-truthiness: null, false, 0, NaN en "" zijn onwaar; al het andere waar.
func Waar(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	}
	if f, ok := alsGetal(v); ok {
		return f != 0 && !math.IsNaN(f)
	}
	return true
}

// Tekst is String(v) in JavaScript: getallen zonder overbodige decimalen, lijsten
// samengevoegd met komma's (null als ""), objecten als "[object Object]", null als "null".
func Tekst(v any) string {
	switch x := v.(type) {
	case nil:
		return "null"
	case string:
		return x
	case bool:
		return strconv.FormatBool(x)
	case []any:
		delen := make([]string, len(x))
		for i, el := range x {
			if el != nil {
				delen[i] = Tekst(el)
			}
		}
		return strings.Join(delen, ",")
	}
	if f, ok := alsGetal(v); ok {
		return getalTekst(f)
	}
	return "[object Object]"
}

func getalTekst(f float64) string {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	}
	return strconv.FormatFloat(f, 'f', -1, 64)
}

// alsGetal geeft de numerieke waarde van een Go-getaltype.
func alsGetal(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case float32:
		return float64(x), true
	case int:
		return float64(x), true
	case int64:
		return float64(x), true
	case int32:
		return float64(x), true
	}
	return 0, false
}

// naarGetal is ToNumber in JavaScript (voor < en >): null→0, bool→0/1, tekst geparsed
// (leeg→0, ongeldig→NaN), overig NaN.
func naarGetal(v any) float64 {
	switch x := v.(type) {
	case nil:
		return 0
	case bool:
		if x {
			return 1
		}
		return 0
	case string:
		t := strings.TrimSpace(x)
		if t == "" {
			return 0
		}
		f, err := strconv.ParseFloat(t, 64)
		if err != nil {
			return math.NaN()
		}
		return f
	}
	if f, ok := alsGetal(v); ok {
		return f
	}
	return math.NaN()
}

// gelijk is === in JavaScript: zelfde soort en waarde; lijsten en objecten alleen als het
// dezelfde zijn.
func gelijk(l, r any) bool {
	if l == nil || r == nil {
		return l == nil && r == nil
	}
	lf, lIsGetal := alsGetal(l)
	rf, rIsGetal := alsGetal(r)
	if lIsGetal || rIsGetal {
		return lIsGetal && rIsGetal && lf == rf
	}
	switch lx := l.(type) {
	case string:
		rx, ok := r.(string)
		return ok && lx == rx
	case bool:
		rx, ok := r.(bool)
		return ok && lx == rx
	}
	lv, rv := reflect.ValueOf(l), reflect.ValueOf(r)
	if lv.Type() != rv.Type() {
		return false
	}
	switch lv.Kind() {
	case reflect.Map, reflect.Slice, reflect.Pointer:
		return lv.Pointer() == rv.Pointer() && (lv.Kind() != reflect.Slice || lv.Len() == rv.Len())
	}
	if lv.Type().Comparable() {
		return l == r
	}
	return false
}

// vergelijk is < <= > >= in JavaScript: twee teksten lexicografisch (op UTF-16), anders
// numeriek (NaN maakt alles onwaar).
func vergelijk(op string, l, r any) bool {
	ls, lok := l.(string)
	rs, rok := r.(string)
	var c int
	if lok && rok {
		c = vergelijkUTF16(ls, rs)
	} else {
		lf, rf := naarGetal(l), naarGetal(r)
		if math.IsNaN(lf) || math.IsNaN(rf) {
			return false
		}
		switch {
		case lf < rf:
			c = -1
		case lf > rf:
			c = 1
		}
	}
	switch op {
	case ">":
		return c > 0
	case ">=":
		return c >= 0
	case "<":
		return c < 0
	}
	return c <= 0
}

func vergelijkUTF16(a, b string) int {
	ua, ub := utf16.Encode([]rune(a)), utf16.Encode([]rune(b))
	for i := 0; i < len(ua) && i < len(ub); i++ {
		if ua[i] != ub[i] {
			if ua[i] < ub[i] {
				return -1
			}
			return 1
		}
	}
	switch {
	case len(ua) < len(ub):
		return -1
	case len(ua) > len(ub):
		return 1
	}
	return 0
}

// grootte is size(): lengte van een lijst of tekst (in UTF-16-eenheden, zoals JS), anders 0.
func grootte(v any) float64 {
	switch x := v.(type) {
	case []any:
		return float64(len(x))
	case string:
		return float64(len(utf16.Encode([]rune(x))))
	}
	return 0
}

// parseIntJS is parseInt(s, 10): optionele witruimte en teken, dan zoveel mogelijk cijfers;
// geen cijfers → NaN (als null teruggegeven, want JSON kent geen NaN).
func parseIntJS(s string) any {
	s = strings.TrimSpace(s)
	i := 0
	if i < len(s) && (s[i] == '+' || s[i] == '-') {
		i++
	}
	start := i
	for i < len(s) && s[i] >= '0' && s[i] <= '9' {
		i++
	}
	if i == start {
		return nil
	}
	f, err := strconv.ParseFloat(s[:i], 64)
	if err != nil {
		return nil
	}
	return f
}

// ── leeftijd() ─────────────────────────────────────────────────────────

// Leeftijd is berekenLeeftijd uit de frontend: hele jaren tussen geboortedatum en peildatum.
// Een incomplete datum (BRP: 00 voor onbekend) krijgt het midden: alleen jaar → 1 juli,
// jaar+maand → de 15e. Geen peildatum = vandaag (Nu). nil = niet bepaalbaar.
func Leeftijd(geboorte, peil any) *int {
	gs, ok := geboorte.(string)
	if !ok {
		return nil
	}
	g, ok := datumMidden(gs)
	if !ok {
		return nil
	}
	var p time.Time
	switch x := peil.(type) {
	case nil:
		nu := Nu()
		p = time.Date(nu.Year(), nu.Month(), nu.Day(), 0, 0, 0, 0, time.UTC)
	case string:
		if x == "" {
			nu := Nu()
			p = time.Date(nu.Year(), nu.Month(), nu.Day(), 0, 0, 0, 0, time.UTC)
		} else if p, ok = datumMidden(x); !ok {
			return nil
		}
	default:
		return nil
	}
	jaren := p.Year() - g.Year()
	if p.Month() < g.Month() || (p.Month() == g.Month() && p.Day() < g.Day()) {
		jaren--
	}
	if jaren < 0 {
		return nil
	}
	return &jaren
}

func datumMidden(s string) (time.Time, bool) {
	deel := strings.SplitN(strings.TrimSpace(s), "T", 2)[0]
	stukken := strings.Split(deel, "-")
	if len(stukken) == 0 || len(stukken) > 3 || len(stukken[0]) != 4 {
		return time.Time{}, false
	}
	getal := func(t string, lengte int) (int, bool) {
		if len(t) != lengte {
			return 0, false
		}
		n, err := strconv.Atoi(t)
		return n, err == nil && n >= 0
	}
	jaar, ok := getal(stukken[0], 4)
	if !ok || jaar == 0 {
		return time.Time{}, false
	}
	maand, dag := 0, 0
	if len(stukken) > 1 {
		if maand, ok = getal(stukken[1], 2); !ok {
			return time.Time{}, false
		}
	}
	if len(stukken) > 2 {
		if dag, ok = getal(stukken[2], 2); !ok {
			return time.Time{}, false
		}
	}
	if maand == 0 {
		maand, dag = 7, 1
	} else if dag == 0 {
		dag = 15
	}
	return time.Date(jaar, time.Month(maand), dag, 0, 0, 0, 0, time.UTC), true
}
