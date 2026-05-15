package model

// validation_walker.go — Reflectie-helpers om een Representatie te valideren
// op basis van `schema:"datatype:<naam>"` struct-tags.
//
// Plan B.A.2 (zie docs/BACKLOG_UITVOERING_INCREMENTEN.md).

import (
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
		schemaTag := field.Tag.Get("schema")
		if !strings.HasPrefix(schemaTag, "datatype:") {
			continue
		}
		datatypeNaam := strings.TrimPrefix(schemaTag, "datatype:")
		if datatypeNaam == "" {
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

		fouten = append(fouten, ValideerWaarde(datatypeNaam, s, veldPad)...)
	}
	return fouten
}
