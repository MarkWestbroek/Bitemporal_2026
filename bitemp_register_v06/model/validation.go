package model

// validation.go — Runtime validatie van waarden tegen V3Datatype-definities.
//
// Plan B.A.2 (zie docs/BACKLOG_UITVOERING_INCREMENTEN.md), refactor R1
// (zie docs/validatie.md).
//
// Deze laag is volledig **datadriven**: alle validatie-uitspraken komen uit
// V3Datatype.Validatie (Pattern, MinLength, MaxLength, Regels) plus de
// generieke regel-evaluator in `regels_eval.go`. Er zijn geen per-type
// hardgecodeerde validators meer — een modelleur kan dus nieuwe types met
// eigen regels in de IDE introduceren zonder Go-code te wijzigen.
//
// Strengheid:
//   - StrengheidStrict       → fouten = hard fail (HTTP 422 + rollback).
//   - StrengheidLenient      → fouten gerapporteerd, registratie gaat door.
//   - StrengheidWarningsOnly → fouten worden waarschuwingen (niet-blokkerend).
//
// Foutformaat: ValidatieResultaat is intern; voor HTTP-responses is er
// `BuildProblemDetails()` dat naar RFC 9457 + NL API Strategie mapt
// (invalidParams-array zoals voorgeschreven in NL API DR foutafhandeling).

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
)

// Validatiestrengheid bepaalt of validatiefouten blokkerend zijn.
type Validatiestrengheid string

const (
	StrengheidStrict       Validatiestrengheid = "strict"
	StrengheidLenient      Validatiestrengheid = "lenient"
	StrengheidWarningsOnly Validatiestrengheid = "warnings-only"
)

// IsBlokkerend geeft aan of strengheid hard moet falen op fouten.
func (s Validatiestrengheid) IsBlokkerend() bool {
	return s == "" || s == StrengheidStrict
}

// ParseStrengheid normaliseert een string-input tot een geldige strengheid.
// Lege string → StrengheidStrict (default = veiligste keuze).
func ParseStrengheid(raw string) Validatiestrengheid {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", string(StrengheidStrict):
		return StrengheidStrict
	case string(StrengheidLenient):
		return StrengheidLenient
	case string(StrengheidWarningsOnly), "warnings", "warn":
		return StrengheidWarningsOnly
	default:
		return StrengheidStrict
	}
}

// Severity onderscheidt blokkerende fouten van waarschuwingen.
type Severity string

const (
	SeverityError   Severity = "error"
	SeverityWarning Severity = "warning"
)

// ValidatieFout beschrijft één geconstateerde fout/waarschuwing.
//
// Sluit conceptueel aan bij NL API Strategie `invalidParams[]`:
//   - Veld     → `name`
//   - Code     → `code`
//   - Bericht  → `reason`
//
// (zie BuildProblemDetails voor de exacte mapping).
type ValidatieFout struct {
	Veld     string   `json:"veld,omitempty"`     // pad naar het veld (bijv. "voornaam" of "adres.postcode")
	Datatype string   `json:"datatype,omitempty"` // naam van het V3Datatype (bijv. "BSN")
	Code     string   `json:"code"`               // korte code (pattern, length, checksum, …)
	Bericht  string   `json:"bericht"`            // mensleesbare boodschap
	Waarde   string   `json:"waarde,omitempty"`   // (afgekapte) waarde t.b.v. debugging
	Severity Severity `json:"severity"`
}

// ValidatieResultaat bundelt fouten en waarschuwingen.
type ValidatieResultaat struct {
	Fouten         []ValidatieFout `json:"fouten,omitempty"`
	Waarschuwingen []ValidatieFout `json:"waarschuwingen,omitempty"`
}

// HeeftFouten geeft true indien er minimaal één blokkerende fout is.
func (r ValidatieResultaat) HeeftFouten() bool { return len(r.Fouten) > 0 }

// patternCache cached gecompileerde regexen per Pattern-string.
var (
	patternCacheMu sync.RWMutex
	patternCache   = map[string]*regexp.Regexp{}
)

func compilePattern(p string) (*regexp.Regexp, error) {
	patternCacheMu.RLock()
	re, ok := patternCache[p]
	patternCacheMu.RUnlock()
	if ok {
		return re, nil
	}
	re, err := regexp.Compile(p)
	if err != nil {
		return nil, err
	}
	patternCacheMu.Lock()
	patternCache[p] = re
	patternCacheMu.Unlock()
	return re, nil
}

// FindDatatype zoekt een V3Datatype in de DatatypeRegistry op naam.
func FindDatatype(naam string) (*V3Datatype, bool) {
	for i := range DatatypeRegistry {
		if DatatypeRegistry[i].Naam == naam {
			return &DatatypeRegistry[i], true
		}
	}
	return nil, false
}

// ValideerWaarde valideert één waarde tegen het opgegeven datatype.
// Retourneert lege slice als geldig (of als datatype onbekend / geen validatie).
// `pad` wordt opgenomen in ValidatieFout.Veld voor context (bijv. "adres.postcode").
//
// Volgorde van checks:
//  1. Lengte (Min/MaxLength)
//  2. Regex-pattern
//  3. Regels uit V3Validatie.Regels (checksum / formula / function)
//
// Lege waarden (na string-conversie) worden overgeslagen — de "verplicht"-check
// hoort op een ander niveau (struct-tag of bovenliggend GE).
func ValideerWaarde(datatypeNaam string, waarde any, pad string) []ValidatieFout {
	if waarde == nil {
		return nil
	}
	dt, ok := FindDatatype(datatypeNaam)
	if !ok {
		return nil // onbekend datatype = best effort, geen fout
	}
	str := waardeAlsString(waarde)
	if str == "" {
		return nil
	}

	var fouten []ValidatieFout
	v := dt.Validatie
	if v == nil {
		return nil
	}

	// 1. Lengte.
	if v.MinLength != nil && len(str) < *v.MinLength {
		fouten = append(fouten, ValidatieFout{
			Veld: pad, Datatype: datatypeNaam, Waarde: str, Severity: SeverityError,
			Code:    "min-length",
			Bericht: fmt.Sprintf("Waarde is te kort (minimaal %d tekens)", *v.MinLength),
		})
	}
	if v.MaxLength != nil && len(str) > *v.MaxLength {
		fouten = append(fouten, ValidatieFout{
			Veld: pad, Datatype: datatypeNaam, Waarde: str, Severity: SeverityError,
			Code:    "max-length",
			Bericht: fmt.Sprintf("Waarde is te lang (maximaal %d tekens)", *v.MaxLength),
		})
	}

	// 2. Pattern.
	if v.Pattern != "" {
		re, err := compilePattern(v.Pattern)
		if err == nil && !re.MatchString(str) {
			bericht := v.Foutmelding
			if bericht == "" {
				bericht = fmt.Sprintf("Waarde voldoet niet aan patroon (%s)", v.Pattern)
			}
			fouten = append(fouten, ValidatieFout{
				Veld: pad, Datatype: datatypeNaam, Waarde: str, Severity: SeverityError,
				Code:    "pattern",
				Bericht: bericht,
			})
		}
	}

	// 3. Regels (generiek; geen type-naam hardcoding meer).
	for _, regel := range v.Regels {
		if fout := evalueerRegel(regel, str); fout != nil {
			fout.Veld = pad
			fout.Datatype = datatypeNaam
			fouten = append(fouten, *fout)
		}
	}

	return fouten
}

// waardeAlsString converteert een any naar een geschikte string-representatie
// voor validatie. Pointer-types worden gederefereerd.
func waardeAlsString(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case *string:
		if x == nil {
			return ""
		}
		return *x
	case fmt.Stringer:
		return x.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

// ============================================================================
// RFC 9457 / NL API Strategie problem-details mapping
// ============================================================================

// ProblemDetails is de standaard fout-payload conform RFC 9457
// ("Problem Details for HTTP APIs") met de NL API Strategie aanvullingen
// (`code`, `instance`, `invalidParams`).
//
// Zie:
//   - https://www.rfc-editor.org/rfc/rfc9457
//   - https://gitdocumentatie.logius.nl/publicatie/api/adr/ (DR-foutafhandeling)
type ProblemDetails struct {
	Type          string         `json:"type,omitempty"`          // URI naar fout-categorie
	Title         string         `json:"title"`                   // korte, generieke titel
	Status        int            `json:"status"`                  // HTTP-status
	Detail        string         `json:"detail,omitempty"`        // mensleesbare uitleg specifiek aan dit incident
	Instance      string         `json:"instance,omitempty"`      // URI/pad van het incident (request-pad)
	Code          string         `json:"code,omitempty"`          // korte foutcode (NL API Strategie aanvulling)
	InvalidParams []InvalidParam `json:"invalidParams,omitempty"` // per-veld foutdetails
}

// InvalidParam beschrijft één veld-specifieke fout, conform NL API Strategie.
type InvalidParam struct {
	Name   string `json:"name"`            // veldpad (JSON-pointer-stijl, bijv. "naam.voornaam")
	Code   string `json:"code"`            // korte foutcode (pattern, min-length, checksum, …)
	Reason string `json:"reason"`          // mensleesbare reden
	Value  string `json:"value,omitempty"` // (afgekapte) waarde t.b.v. debugging
}

// BuildProblemDetails verpakt een ValidatieResultaat in een RFC 9457-payload.
// `instance` is het request-pad (bijv. "/registratie/natuurlijk_personen").
// Status is altijd 422 (Unprocessable Entity) voor validatiefouten.
func BuildProblemDetails(res ValidatieResultaat, instance string) ProblemDetails {
	pd := ProblemDetails{
		Type:     "https://api.bitemporeel/problemen/validatie",
		Title:    "Validatiefout",
		Status:   422,
		Code:     "validation_error",
		Instance: instance,
	}
	pd.InvalidParams = make([]InvalidParam, 0, len(res.Fouten))
	for _, f := range res.Fouten {
		pd.InvalidParams = append(pd.InvalidParams, InvalidParam{
			Name:   f.Veld,
			Code:   f.Code,
			Reason: f.Bericht,
			Value:  f.Waarde,
		})
	}
	pd.Detail = fmt.Sprintf("%d veldfout(en) gevonden tijdens validatie", len(res.Fouten))
	return pd
}
