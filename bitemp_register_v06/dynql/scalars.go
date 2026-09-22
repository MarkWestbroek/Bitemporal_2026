package dynql

// Custom scalar types voor de dynamische GraphQL-laag.
// DateTime = ISO 8601 tijdstip, Date = YYYY-MM-DD, JSON = vrije JSON-payload.

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/ast"
)

// DateTimeScalar is een GraphQL scalar voor time.Time (ISO 8601).
var DateTimeScalar = graphql.NewScalar(graphql.ScalarConfig{
	Name:        "DateTime",
	Description: "ISO 8601 datum-tijdstip (bijv. 2024-01-15T10:30:00Z)",
	Serialize: func(value interface{}) interface{} {
		switch v := value.(type) {
		case time.Time:
			return v.Format(time.RFC3339)
		case *time.Time:
			if v == nil {
				return nil
			}
			return v.Format(time.RFC3339)
		case string:
			// De resolvers zetten entiteiten om via een JSON-roundtrip (entityToMap), dus
			// tijdstippen komen hier als tekst binnen (RFC 3339, zoals REST ze geeft).
			// Zonder deze case was elk tijdstip in GraphQL null (opgelost 22-09-2026).
			if v == "" {
				return nil
			}
			return v
		default:
			return nil
		}
	},
	ParseValue: func(value interface{}) interface{} {
		switch v := value.(type) {
		case string:
			t, err := time.Parse(time.RFC3339, v)
			if err != nil {
				return nil
			}
			return t
		default:
			return nil
		}
	},
	ParseLiteral: func(valueAST ast.Value) interface{} {
		switch v := valueAST.(type) {
		case *ast.StringValue:
			t, err := time.Parse(time.RFC3339, v.Value)
			if err != nil {
				return nil
			}
			return t
		default:
			return nil
		}
	},
})

// DateScalar is een GraphQL scalar voor model.Date (YYYY-MM-DD).
var DateScalar = graphql.NewScalar(graphql.ScalarConfig{
	Name:        "Date",
	Description: "Datum in formaat YYYY-MM-DD (bijv. 2024-01-15)",
	Serialize: func(value interface{}) interface{} {
		switch v := value.(type) {
		case model.Date:
			if v.Time.IsZero() {
				return nil
			}
			return v.String()
		case *model.Date:
			if v == nil || v.Time.IsZero() {
				return nil
			}
			return v.String()
		case string:
			// Via de JSON-roundtrip in entityToMap komt een datum als tekst binnen
			// ("2020-03-12"). Zie DateTimeScalar; tot 22-09-2026 werd dit null.
			if v == "" {
				return nil
			}
			return v
		default:
			return nil
		}
	},
	ParseValue: func(value interface{}) interface{} {
		switch v := value.(type) {
		case string:
			t, err := time.Parse("2006-01-02", v)
			if err != nil {
				return nil
			}
			return model.Date{Time: t}
		default:
			return nil
		}
	},
	ParseLiteral: func(valueAST ast.Value) interface{} {
		switch v := valueAST.(type) {
		case *ast.StringValue:
			t, err := time.Parse("2006-01-02", v.Value)
			if err != nil {
				return nil
			}
			return model.Date{Time: t}
		default:
			return nil
		}
	},
})

// JSONScalar is een GraphQL scalar voor vrije JSON-payloads (gebruikt in mutations).
var JSONScalar = graphql.NewScalar(graphql.ScalarConfig{
	Name:        "JSON",
	Description: "Vrije JSON-payload",
	Serialize: func(value interface{}) interface{} {
		return value
	},
	ParseValue: func(value interface{}) interface{} {
		return value
	},
	ParseLiteral: func(valueAST ast.Value) interface{} {
		// Converteer AST naar Go map/slice/primitives
		b, err := json.Marshal(valueAST.GetValue())
		if err != nil {
			return nil
		}
		var result interface{}
		if err := json.Unmarshal(b, &result); err != nil {
			return nil
		}
		return result
	},
})

// goTypeToGraphQL mapt een Go reflect.Type naar het juiste graphql.Output type.
// Wordt gebruikt door field_builder om struct-velden te vertalen.
//
// Enum-velden worden in de UITVOER een gewone String met de echte waarde (bijv.
// "Doorontwikkeling en beheer"), niet een GraphQL-enum. Een GraphQL-enum geeft zijn
// naam terug, en die mag alleen [_A-Za-z0-9] bevatten (sanitizeEnumValue): de gebruiker
// zag dan "Doorontwikkeling_en_beheer", terwijl REST de echte waarde toont. Voor INVOER
// (mutaties, goTypeToGraphQLInput) blijft het een enum, zodat waarden gecontroleerd worden.
// Gewijzigd 22-09-2026; zie docs/API_REFERENCE.md §11.
func goTypeToGraphQL(goType string, format string, enumValues []string) graphql.Output {
	if len(enumValues) > 0 {
		return graphql.String
	}

	switch goType {
	case "string":
		if format == "date-time" {
			return DateTimeScalar
		}
		if format == "date" {
			return DateScalar
		}
		return graphql.String
	case "integer":
		return graphql.Int
	case "boolean":
		return graphql.Boolean
	case "number":
		return graphql.Float
	default:
		return graphql.String
	}
}

// enumTypeCache voorkomt dat we dezelfde enum meerdere keren aanmaken.
var enumTypeCache = map[string]*graphql.Enum{}

func makeEnumType(name string, values []string) *graphql.Enum {
	if cached, ok := enumTypeCache[name]; ok {
		return cached
	}
	valueMap := graphql.EnumValueConfigMap{}
	for _, v := range values {
		valueMap[sanitizeEnumValue(v)] = &graphql.EnumValueConfig{
			Value:       v,
			Description: v,
		}
	}
	enum := graphql.NewEnum(graphql.EnumConfig{
		Name:   fmt.Sprintf("%sEnum", name),
		Values: valueMap,
	})
	enumTypeCache[name] = enum
	return enum
}

// sanitizeEnumValue maakt een string geschikt als GraphQL enum value name.
// GraphQL enum values mogen alleen [_A-Za-z0-9] bevatten.
func sanitizeEnumValue(s string) string {
	result := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' {
			result = append(result, c)
		} else if c == ' ' || c == '-' {
			result = append(result, '_')
		}
	}
	if len(result) == 0 {
		return "_"
	}
	// Mag niet met een cijfer beginnen
	if result[0] >= '0' && result[0] <= '9' {
		result = append([]byte{'_'}, result...)
	}
	return string(result)
}
