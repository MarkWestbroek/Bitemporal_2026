package toegang

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Subject is wie het verzoek doet. Voorlopig (besluit Mark 12-10) alleen een ingelogde
// gebruiker met kenmerken, of anoniem. Het rijkere subjectmodel (organisatie, medewerker,
// partij) komt later; de kenmerken-map is daar al op voorbereid.
type Subject struct {
	Anoniem   bool
	Kenmerken map[string][]string // bv. "rol": {"medewerker"}, "afdeling": {"West"}
}

// Verzoek is de context van één beslissing.
type Verzoek struct {
	Subject    Subject
	Handeling  string         // "bekijken", "opvoeren", …
	Peilmoment time.Time      // voor de geldigheid van het beleid; nul = nu
	Aanvraag   map[string]any // contextwaarden: "doel", "grondslag", "jaar", …
	// Betrokkene geeft een veldwaarde van het record waarover beslist wordt (absoluut
	// registerpad). Nil of ok=false = onbekend → voorwaarden erover zijn onbepaald.
	Betrokkene func(pad string) (waarde any, ok bool)
}

// Besluit is de uitkomst voor één registerpad.
type Besluit struct {
	Toegestaan bool
	Regel      string   // id van de doorslaggevende regel; "" = standaard (weigeren)
	Plichten   []string // plichten van de toestemming die gold
	// Voorwaardelijk: toestemmingen die alleen door een onbepaalde voorwaarde niet golden
	// (bv. een veld van de betrokkene dat de PDP niet kent). Aanknopingspunt voor een
	// latere filter-op-waarde.
	Voorwaardelijk []string
}

// Beslis bepaalt of het subject deze handeling op dit registerpad mag uitvoeren.
func (b *Bundel) Beslis(v Verzoek, pad string) Besluit {
	moment := v.Peilmoment
	if moment.IsZero() {
		moment = time.Now()
	}
	if !b.isGeldigOp(moment.Format("2006-01-02")) {
		// Buiten de geldigheid geldt het beleid niet: dan geldt ook de standaard niet, en
		// weigert de PDP (fail-closed).
		return Besluit{}
	}
	var toe, verbod *Regel
	var voorwaardelijk []string
	for _, r := range b.regelsVoor(v.Handeling, pad) {
		if !subjectVoldoet(r.Subject, v.Subject) {
			continue
		}
		uitkomst := waar
		if r.Voorwaarden != nil {
			uitkomst = evalueer(*r.Voorwaarden, v)
		}
		if r.Effect == "verbieden" {
			// Fail-closed: een verbod met een onbepaalde voorwaarde geldt.
			if uitkomst != onwaar {
				if b.Conflict == "eerste-geldt" {
					return Besluit{Regel: r.ID}
				}
				if verbod == nil {
					verbod = r
				}
			}
			continue
		}
		switch uitkomst {
		case waar:
			if b.Conflict == "eerste-geldt" {
				return Besluit{Toegestaan: true, Regel: r.ID, Plichten: r.Plichten}
			}
			if toe == nil {
				toe = r
			}
		case onbepaald:
			// Fail-closed: telt niet mee. Overslaan is ook bij eerste-geldt veilig: een
			// latere toestemming had dezelfde uitkomst, een later verbod weigert.
			voorwaardelijk = append(voorwaardelijk, r.ID)
		}
	}
	if b.Conflict == "toestemming-wint" && toe != nil {
		return Besluit{Toegestaan: true, Regel: toe.ID, Plichten: toe.Plichten}
	}
	if verbod != nil {
		return Besluit{Regel: verbod.ID}
	}
	if toe != nil {
		return Besluit{Toegestaan: true, Regel: toe.ID, Plichten: toe.Plichten}
	}
	return Besluit{Toegestaan: b.Standaard == "toestaan", Voorwaardelijk: voorwaardelijk}
}

// ToegestanePaden beslist voor een lijst registerpaden tegelijk (bv. alle veldpaden van een
// entiteit). Bedoeld om per subject te cachen: het resultaat is feitelijk een subschema.
func (b *Bundel) ToegestanePaden(v Verzoek, paden []string) map[string]Besluit {
	uit := make(map[string]Besluit, len(paden))
	for _, p := range paden {
		uit[p] = b.Beslis(v, p)
	}
	return uit
}

// subjectVoldoet: geen eis = iedereen (ook anoniem); anders moet het subject bekend zijn en
// elk geëist kenmerk hebben (hoofdletterongevoelig).
func subjectVoldoet(eis *SubjectEis, s Subject) bool {
	if eis == nil {
		return true
	}
	if s.Anoniem {
		return false
	}
	for _, k := range eis.Kenmerken {
		if !bevatWaarde(kenmerkWaarden(s, k.Kenmerk), k.Waarde) {
			return false
		}
	}
	return true
}

func kenmerkWaarden(s Subject, kenmerk string) []string {
	if w, ok := s.Kenmerken[kenmerk]; ok {
		return w
	}
	for k, w := range s.Kenmerken {
		if normaliseer(k) == normaliseer(kenmerk) {
			return w
		}
	}
	return nil
}

func bevatWaarde(lijst []string, w string) bool {
	for _, x := range lijst {
		if normaliseer(x) == normaliseer(w) {
			return true
		}
	}
	return false
}

// ── drieweg-logica ───────────────────────────────────────────────────────────

type drieweg int

const (
	onwaar drieweg = iota
	waar
	onbepaald
)

func uitBool(b bool) drieweg {
	if b {
		return waar
	}
	return onwaar
}

func evalueer(vw Voorwaarde, v Verzoek) drieweg {
	switch {
	case vw.En != nil:
		uit := waar
		for _, d := range vw.En {
			switch evalueer(d, v) {
			case onwaar:
				return onwaar
			case onbepaald:
				uit = onbepaald
			}
		}
		return uit
	case vw.Of != nil:
		uit := onwaar
		for _, d := range vw.Of {
			switch evalueer(d, v) {
			case waar:
				return waar
			case onbepaald:
				uit = onbepaald
			}
		}
		return uit
	case vw.Xof != nil:
		aantalWaar, onbekend := 0, false
		for _, d := range vw.Xof {
			switch evalueer(d, v) {
			case waar:
				aantalWaar++
			case onbepaald:
				onbekend = true
			}
		}
		if aantalWaar > 1 {
			return onwaar
		}
		if onbekend {
			return onbepaald
		}
		return uitBool(aantalWaar == 1)
	case vw.Bestaat != nil:
		// PIP-vraag; nog geen PIP aangesloten.
		return onbepaald
	case vw.Links != nil:
		return vergelijk(vw, v)
	}
	return onbepaald
}

// waarden geeft de waarde(n) van een term; ok=false = onbekend.
func waarden(t *Term, v Verzoek) ([]any, bool) {
	if t == nil {
		return nil, false
	}
	switch t.Anker {
	case "":
		if t.Pad == "" { // literal
			return []any{t.Waarde}, true
		}
		return betrokkeneWaarde(t.Pad, v)
	case "aanvrager":
		// Gesloten wereld: de kenmerken van het subject komen volledig uit de PIP. Een
		// ontbrekend kenmerk is dus bekend-leeg (niet onbepaald); een anoniem subject heeft er geen.
		w := kenmerkWaarden(v.Subject, t.Pad)
		if v.Subject.Anoniem || w == nil {
			return []any{}, true
		}
		uit := make([]any, len(w))
		for i, x := range w {
			uit[i] = x
		}
		return uit, true
	case "aanvraag":
		sleutel := t.Pad
		if sleutel == "" {
			return nil, false
		}
		if w, ok := v.Aanvraag[sleutel]; ok {
			return []any{w}, true
		}
		if sleutel == "tijdstip" {
			m := v.Peilmoment
			if m.IsZero() {
				m = time.Now()
			}
			return []any{m.Format(time.RFC3339)}, true
		}
		return nil, false
	case "betrokkene", "gegevens":
		return betrokkeneWaarde(t.Pad, v)
	}
	return nil, false
}

func betrokkeneWaarde(pad string, v Verzoek) ([]any, bool) {
	if v.Betrokkene == nil || pad == "" {
		return nil, false
	}
	w, ok := v.Betrokkene(pad)
	if !ok {
		return nil, false
	}
	if lijst, isLijst := w.([]any); isLijst {
		return lijst, true
	}
	return []any{w}, true
}

// vergelijk evalueert één vergelijking. Bij meerdere linkerwaarden (een meervoudig
// kenmerk of veld) geldt de vergelijking als één ervan voldoet — behalve bij "is niet",
// dat voor alle waarden moet gelden.
func vergelijk(vw Voorwaarde, v Verzoek) drieweg {
	links, ok := waarden(vw.Links, v)
	switch vw.Op {
	case "isBekend":
		return uitBool(ok && heeftWaarde(links))
	case "isOnbekend":
		if !ok {
			// Onbekend voor de PDP is niet hetzelfde als leeg in het register.
			return onbepaald
		}
		return uitBool(!heeftWaarde(links))
	}
	if !ok {
		return onbepaald
	}
	var rechts []any
	switch vw.Op {
	case "isAnyOf":
		for i := range vw.Lijst {
			w, ok := waarden(&vw.Lijst[i], v)
			if !ok {
				return onbepaald
			}
			rechts = append(rechts, w...)
		}
	case "tussen":
		lo, ok1 := waarden(vw.Rechts, v)
		hi, ok2 := waarden(vw.Rechts2, v)
		if !ok1 || !ok2 || len(lo) == 0 || len(hi) == 0 {
			return onbepaald
		}
		for _, l := range links {
			if cmp(l, lo[0]) >= 0 && cmp(l, hi[0]) <= 0 {
				return waar
			}
		}
		return onwaar
	default:
		r, ok := waarden(vw.Rechts, v)
		if !ok || len(r) == 0 {
			return onbepaald
		}
		rechts = r
	}

	if vw.Op == "neq" {
		for _, l := range links {
			if cmp(l, rechts[0]) == 0 {
				return onwaar
			}
		}
		return waar
	}
	for _, l := range links {
		for _, r := range rechts {
			if test(vw.Op, l, r) {
				return waar
			}
		}
	}
	if _, bekend := operatoren[vw.Op]; !bekend {
		return onbepaald // onbekende operator (bv. geo, isPartOf): niet beslisbaar
	}
	return onwaar
}

var operatoren = map[string]bool{
	"eq": true, "lt": true, "gt": true, "lteq": true, "gteq": true,
	"isAnyOf": true, "begintMet": true, "eindigtOp": true, "bevat": true,
}

func test(op string, l, r any) bool {
	switch op {
	case "eq", "isAnyOf":
		return cmp(l, r) == 0
	case "lt":
		return cmp(l, r) < 0
	case "gt":
		return cmp(l, r) > 0
	case "lteq":
		return cmp(l, r) <= 0
	case "gteq":
		return cmp(l, r) >= 0
	case "begintMet":
		return strings.HasPrefix(normaliseer(tekst(l)), normaliseer(tekst(r)))
	case "eindigtOp":
		return strings.HasSuffix(normaliseer(tekst(l)), normaliseer(tekst(r)))
	case "bevat":
		return strings.Contains(normaliseer(tekst(l)), normaliseer(tekst(r)))
	}
	return false
}

func heeftWaarde(w []any) bool {
	for _, x := range w {
		if x != nil && tekst(x) != "" {
			return true
		}
	}
	return false
}

// cmp vergelijkt numeriek als beide kanten een getal zijn, anders als tekst
// (hoofdletterongevoelig; ISO-datums sorteren zo ook goed).
func cmp(a, b any) int {
	fa, oka := getal(a)
	fb, okb := getal(b)
	if oka && okb {
		switch {
		case fa < fb:
			return -1
		case fa > fb:
			return 1
		}
		return 0
	}
	return strings.Compare(normaliseer(tekst(a)), normaliseer(tekst(b)))
}

func getal(x any) (float64, bool) {
	switch n := x.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(n), 64)
		return f, err == nil
	}
	return 0, false
}

func tekst(x any) string {
	switch s := x.(type) {
	case nil:
		return ""
	case string:
		return s
	case fmt.Stringer:
		return s.String()
	}
	return fmt.Sprint(x)
}
