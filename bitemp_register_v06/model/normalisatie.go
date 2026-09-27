package model

// normalisatie.go — V3Datatype.Normalisatie op de server (27-09-2026).
//
// Een datatype kan een normalisatie hebben ("trim,uppercase_letters"): de waarde wordt eerst in
// een vaste vorm gebracht en pas daarna gecontroleerd — en ZO opgeslagen. Voorheen deed alleen
// de browser dit (web/vite/src/umleditor/validatie/normaliseer.js): die keurde "1234 ab" goed
// als "1234 AB", terwijl de server de ruwe waarde controleerde en opsloeg. Nu doen beide
// hetzelfde; de gedeelde testset (testdata/validatie/vectoren.json, "normalisatie") bewaakt dat.
//
// Namen (gelijk aan de JS-kant): trim, lowercase, uppercase, uppercase_letters, strip_spaces,
// strip_dashes. Onbekende namen worden overgeslagen.

import (
	"reflect"
	"sort"
	"strings"
	"unicode"
)

var normalisaties = map[string]func(string) string{
	"trim":      strings.TrimSpace,
	"lowercase": strings.ToLower,
	"uppercase": strings.ToUpper,
	// Alleen a–z naar hoofdletters (zoals de JS-kant); overige tekens blijven staan.
	"uppercase_letters": func(s string) string {
		return strings.Map(func(r rune) rune {
			if r >= 'a' && r <= 'z' {
				return unicode.ToUpper(r)
			}
			return r
		}, s)
	},
	"strip_spaces": func(s string) string {
		return strings.Map(func(r rune) rune {
			if unicode.IsSpace(r) {
				return -1
			}
			return r
		}, s)
	},
	"strip_dashes": func(s string) string { return strings.ReplaceAll(s, "-", "") },
}

// NormalisatieNamen: de bekende normalisaties (voor de Studio en de docs).
func NormalisatieNamen() []string {
	uit := make([]string, 0, len(normalisaties))
	for n := range normalisaties {
		uit = append(uit, n)
	}
	sort.Strings(uit)
	return uit
}

// Normaliseer past een normalisatie-spec ("trim,uppercase_letters") toe.
func Normaliseer(waarde, spec string) string {
	if spec == "" {
		return waarde
	}
	for _, stap := range strings.Split(spec, ",") {
		if fn, ok := normalisaties[strings.TrimSpace(stap)]; ok {
			waarde = fn(waarde)
		}
	}
	return waarde
}

// NormaliseerWaarde normaliseert volgens het datatype (onbekend datatype of geen spec: ongewijzigd).
func NormaliseerWaarde(datatypeNaam, waarde string) string {
	dt, ok := FindDatatype(datatypeNaam)
	if !ok || dt.Normalisatie == "" {
		return waarde
	}
	return Normaliseer(waarde, dt.Normalisatie)
}

// NormaliseerRepresentatie normaliseert IN PLAATS elke string-waarde van `rep` (een pointer
// naar een struct) waarvan de schema-tag een datatype met een normalisatie aanwijst, zodat de
// genormaliseerde vorm wordt gevalideerd én opgeslagen. Geeft het aantal gewijzigde velden.
func NormaliseerRepresentatie(rep any) int {
	if rep == nil {
		return 0
	}
	v := reflect.ValueOf(rep)
	for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
		if v.IsNil() {
			return 0
		}
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return 0
	}
	t := v.Type()
	n := 0
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		if !field.IsExported() {
			continue
		}
		dt := ParseSchemaTag(field.Tag.Get("schema")).Datatype
		if dt == "" {
			continue
		}
		fv := v.Field(i)
		for fv.Kind() == reflect.Ptr && !fv.IsNil() {
			fv = fv.Elem()
		}
		if fv.Kind() != reflect.String || !fv.CanSet() || fv.String() == "" {
			continue
		}
		if nieuw := NormaliseerWaarde(dt, fv.String()); nieuw != fv.String() {
			fv.SetString(nieuw)
			n++
		}
	}
	return n
}
