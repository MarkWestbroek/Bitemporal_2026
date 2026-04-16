package dynql

// field_builder vertaalt representatie-structs naar graphql.Fields via reflectie.
// Volgt hetzelfde patroon als handlers/viz_schema_handler.go:reflectedVeldenVoorMeta
// maar produceert graphql.Field entries in plaats van schema-DTOs.

import (
	"reflect"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
)

var (
	timeType = reflect.TypeOf(time.Time{})
	dateType = reflect.TypeOf(model.Date{})
)

// skipVelden zijn technische velden die niet in het GraphQL schema horen.
var skipVelden = map[string]struct{}{
	"opvoer": {},
	"afvoer": {},
}

// fieldsVoorMeta bouwt graphql.Fields voor de struct achter meta.Factory().
// Slaat opvoer/afvoer over (die worden apart gemapped door de type_builder).
func fieldsVoorMeta(meta model.TypeMeta) graphql.Fields {
	rep := meta.Factory()
	if rep == nil {
		return graphql.Fields{}
	}
	t := reflect.TypeOf(rep)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return graphql.Fields{}
	}

	fields := graphql.Fields{}
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.PkgPath != "" {
			continue // skip unexported
		}

		name, _, skip := parseJSONTag(f.Tag.Get("json"))
		if skip {
			continue
		}
		if name == "" {
			if f.Anonymous {
				continue
			}
			name = strings.ToLower(f.Name)
		}
		if _, shouldSkip := skipVelden[strings.ToLower(name)]; shouldSkip {
			continue
		}

		goType, format := schemaTypeVoorReflectType(f.Type)
		enumValues := resolveEnumWaarden(f)

		// Gebruik de Go-typenaam als enum-naam (bijv. "Gemeenterol") i.p.v.
		// de generieke "string", om collisies in enumTypeCache te voorkomen:
		// alle string-based enums zouden anders dezelfde cache-key delen.
		enumGoType := goType
		if len(enumValues) > 0 {
			ft := f.Type
			for ft.Kind() == reflect.Ptr {
				ft = ft.Elem()
			}
			if ft.Name() != "" && ft.Name() != "string" {
				enumGoType = ft.Name()
			}
		}
		gqlType := goTypeToGraphQL(enumGoType, format, enumValues)

		// Array-formaten
		if strings.HasPrefix(format, "array") {
			gqlType = graphql.NewList(gqlType)
		}

		description := strings.TrimSpace(f.Tag.Get("schema_desc"))

		fields[name] = &graphql.Field{
			Type:        gqlType,
			Description: description,
		}
	}
	return fields
}

// fieldsVoorFormeleRepresentatie voegt opvoer/afvoer toe aan een bestaand fieldsset.
func fieldsVoorFormeleRepresentatie(fields graphql.Fields) {
	fields["opvoer"] = &graphql.Field{
		Type:        DateTimeScalar,
		Description: "Tijdstip van opvoer (formele tijd)",
	}
	fields["afvoer"] = &graphql.Field{
		Type:        DateTimeScalar,
		Description: "Tijdstip van afvoer (formele tijd)",
	}
}

// --- Hulpfuncties (geporteerd uit viz_schema_handler.go) ---

func parseJSONTag(tag string) (name string, hasOmitEmpty bool, skip bool) {
	if tag == "-" {
		return "", false, true
	}
	if tag == "" {
		return "", false, false
	}
	parts := strings.Split(tag, ",")
	name = strings.TrimSpace(parts[0])
	for i := 1; i < len(parts); i++ {
		if strings.TrimSpace(parts[i]) == "omitempty" {
			hasOmitEmpty = true
			break
		}
	}
	if name == "-" {
		return "", hasOmitEmpty, true
	}
	return name, hasOmitEmpty, false
}

func schemaTypeVoorReflectType(t reflect.Type) (string, string) {
	if t == nil {
		return "string", ""
	}
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}

	isArray := false
	for t.Kind() == reflect.Slice || t.Kind() == reflect.Array {
		isArray = true
		t = t.Elem()
		for t.Kind() == reflect.Ptr {
			t = t.Elem()
		}
	}

	if t == timeType {
		if isArray {
			return "string", "array:date-time"
		}
		return "string", "date-time"
	}
	if t == dateType {
		if isArray {
			return "string", "array:date"
		}
		return "string", "date"
	}

	switch t.Kind() {
	case reflect.Bool:
		if isArray {
			return "boolean", "array"
		}
		return "boolean", ""
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		if isArray {
			return "integer", "array"
		}
		return "integer", ""
	case reflect.Float32:
		if isArray {
			return "number", "array:float32"
		}
		return "number", "float32"
	case reflect.Float64:
		if isArray {
			return "number", "array:float64"
		}
		return "number", "float64"
	case reflect.String:
		if isArray {
			return "string", "array"
		}
		return "string", ""
	default:
		if isArray {
			return t.Name(), "array"
		}
		if t.Name() != "" {
			return t.Name(), ""
		}
		return "string", ""
	}
}

func resolveEnumWaarden(f reflect.StructField) []string {
	tagValues := enumValuesFromSchemaTag(f.Tag.Get("schema"))
	if len(tagValues) > 1 {
		return tagValues
	}
	if len(tagValues) == 1 {
		if waarden, ok := model.EnumWaarden[tagValues[0]]; ok {
			return waarden
		}
		return tagValues
	}
	ft := f.Type
	for ft.Kind() == reflect.Ptr {
		ft = ft.Elem()
	}
	if ft.Kind() == reflect.String && ft.Name() != "string" && ft.Name() != "" {
		if waarden, ok := model.EnumWaarden[ft.Name()]; ok {
			return waarden
		}
	}
	return nil
}

func enumValuesFromSchemaTag(tag string) []string {
	if tag == "" {
		return nil
	}
	for _, part := range strings.Split(tag, ",") {
		trimmed := strings.TrimSpace(part)
		if !strings.HasPrefix(trimmed, "enum=") {
			continue
		}
		rawValues := strings.Split(strings.TrimPrefix(trimmed, "enum="), "|")
		values := make([]string, 0, len(rawValues))
		for _, rawValue := range rawValues {
			value := strings.TrimSpace(rawValue)
			if value != "" {
				values = append(values, value)
			}
		}
		if len(values) > 0 {
			return values
		}
	}
	return nil
}
