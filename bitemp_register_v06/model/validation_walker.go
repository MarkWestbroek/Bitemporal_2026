package model

// validation_walker.go — Reflectie-helpers om een Representatie te valideren
// op basis van `schema:"datatype:<naam>"` struct-tags.
//
// Plan B.A.2 (zie docs/BACKLOG_UITVOERING_INCREMENTEN.md).

import (
	"fmt"
	"reflect"
	"strings"
)

// ValideerRepresentatie loopt over alle exported velden van `rep` en
// valideert elke string-waarde waarvan de struct-tag `schema:"datatype:..."`
// een bekend V3Datatype aanwijst. Niet-string velden worden overgeslagen
// (numerieke datatypes komen in een latere increment).
//
// `padPrefix` wordt vooraan elke ValidatieFout.Veld geplaatst (bijv.
// "voornaam_data"). Leeg laten voor top-level velden.
func ValideerRepresentatie(rep any, padPrefix string) []ValidatieFout {
	if rep == nil {
		return nil
	}
	v := reflect.ValueOf(rep)
	for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
		if v.IsNil() {
			return nil
		}
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return nil
	}
	t := v.Type()

	var fouten []ValidatieFout
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		if !field.IsExported() {
			continue
		}
		// Ondersteunde schema-tags: `datatype:<V3Datatype>` en `enum=<EnumNaam>`
		// (enum-validatie toegevoegd 2026-09-16 n.a.v. regressietest scenario 13).
		// De tag per komma-deel lezen: codegen schrijft "enum=X,datatype:Y" (ParseSchemaTag).
		tag := ParseSchemaTag(field.Tag.Get("schema"))
		datatypeNaam, enumNaam := tag.Datatype, tag.Enum
		if datatypeNaam == "" && enumNaam == "" {
			continue
		}

		fv := v.Field(i)
		// Dereference pointers.
		for fv.Kind() == reflect.Ptr {
			if fv.IsNil() {
				break
			}
			fv = fv.Elem()
		}
		if fv.Kind() == reflect.Ptr || !fv.IsValid() {
			continue
		}
		// Alleen strings nu (alle datatypes met regex/lengte zijn string-basistype).
		if fv.Kind() != reflect.String {
			continue
		}
		s := fv.String()
		if s == "" {
			continue
		}

		// Pad: padPrefix + "." + jsonNaam (jsonNaam afgeleid uit json-tag of veldnaam).
		jsonNaam := field.Name
		if tag := field.Tag.Get("json"); tag != "" && tag != "-" {
			jsonNaam = strings.SplitN(tag, ",", 2)[0]
		}
		veldPad := jsonNaam
		if padPrefix != "" {
			veldPad = padPrefix + "." + jsonNaam
		}

		if enumNaam != "" {
			// Lijst van enum-waarden in één veld (datatype met Scheiding, bv. EnumLijst):
			// elke waarde afzonderlijk tegen het enum.
			if scheiding := LijstScheiding(datatypeNaam); scheiding != "" {
				for _, w := range SplitsLijstwaarde(s, scheiding) {
					fouten = append(fouten, valideerEnumWaarde(enumNaam, w, veldPad)...)
				}
				continue
			}
			fouten = append(fouten, valideerEnumWaarde(enumNaam, s, veldPad)...)
			continue
		}
		fouten = append(fouten, ValideerWaarde(datatypeNaam, s, veldPad)...)
	}
	return fouten
}

// valideerEnumWaarde controleert een waarde tegen EnumWaarden[enumNaam] (gevuld
// door de gegenereerde *_enum_registry.go). Een onbekende enum-naam levert geen
// fout op (registry niet geladen); een waarde buiten de lijst wel.
func valideerEnumWaarde(enumNaam, waarde, pad string) []ValidatieFout {
	toegestaan, ok := EnumWaarden[enumNaam]
	if !ok {
		return nil
	}
	for _, t := range toegestaan {
		if t == waarde {
			return nil
		}
	}
	return []ValidatieFout{{
		Veld:     pad,
		Datatype: enumNaam,
		Code:     "enum",
		Bericht:  fmt.Sprintf("waarde %q is geen geldige %s (toegestaan: %s)", waarde, enumNaam, strings.Join(toegestaan, ", ")),
		Waarde:   waarde,
		Severity: SeverityError,
	}}
}
