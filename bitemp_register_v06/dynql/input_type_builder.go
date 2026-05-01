package dynql

// input_type_builder.go — bouwt typed GraphQL InputObject types voor ENT-patch arguments.
//
// FASE 3B-full (2026-05-xx):
// Vervangt het vrije JSON scalar in wijzig<X>/corrigeer<X> door volledig
// getypeerde inputs die zijn afgeleid uit de MetaRegistry + Go-structs.
//
// Structuur per ENT:
//   <Typenaam>PatchInput {
//     <jsonRolnaam>: [<GETypenaam>Input]   // voor elke GE/REL hub
//     ...
//   }
//
// Structuur per GE/REL hub:
//   <GETypenaam>Input {
//     rel_id:              Int              — optioneel hub-ID
//     <inhoud-veld>:       <scalar>         — van _Data struct via reflection
//     <secundaire_fk_id>:  Int              — alleen bij relaties
//     aanvang:             PlumbingDatumInput — alleen bij materieel
//     einde:               PlumbingDatumInput — alleen bij materieel
//   }
//
// Plumbing Aanvang/Einde sub-types (GESubtype aanvang/einde) worden NIET
// opgenomen in de PatchInput — die worden intern door de engine verwerkt.
//
// De resolvers in typed_mutations.go zijn ONVERANDERD: graphql-go
// deserialiseert InputObject-waarden naar map[string]interface{}, en
// json.Marshal(patch) produceert dezelfde JSON als voorheen.

import (
	"reflect"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
)

// inputTypeCache voorkomt dubbele aanmaak van GE/REL-level InputObject types.
var inputTypeCache = map[string]*graphql.InputObject{}

// patchInputTypeCache: key = ENT Typenaam, value = <Typenaam>PatchInput.
var patchInputTypeCache = map[string]*graphql.InputObject{}

// PlumbingDatumInput is het gedeelde InputObject voor materieel aanvang/einde.
var PlumbingDatumInput = graphql.NewInputObject(graphql.InputObjectConfig{
	Name:        "PlumbingDatumInput",
	Description: "Materieel aanvang- of eindedatum (YYYY-MM-DD)",
	Fields: graphql.InputObjectConfigFieldMap{
		"datum": &graphql.InputObjectFieldConfig{
			Type:        DateScalar,
			Description: "Datum (YYYY-MM-DD)",
		},
	},
})

// BuildPatchInputTypes bouwt typed InputObject types voor alle ENT-patch args.
//
// Stap 1: bouw GE/REL hub input types (alle typen met GESubtype == hub).
// Stap 2: bouw ENT patch input types (verwijzen naar GE input types via
//
//	OnderliggendeGegevenselementen).
//
// Roep aan vóór AddTypedMutationsForEntiteit in schema_builder.BuildSchema.
func BuildPatchInputTypes() map[string]*graphql.InputObject {
	// Stap 1: GE/REL hub input types
	for typenaam, meta := range model.MetaRegistry {
		if meta.GESubtype == model.GESubtypeHub {
			buildGEInputType(typenaam, meta)
		}
	}

	// Stap 2: ENT patch input types
	for typenaam, meta := range model.MetaRegistry {
		if meta.Metatype == model.MetatypeEntiteit && meta.Factory != nil {
			if _, ok := patchInputTypeCache[typenaam]; !ok {
				patchInputTypeCache[typenaam] = buildEntiteitPatchInputType(typenaam, meta)
			}
		}
	}

	return patchInputTypeCache
}

// buildGEInputType bouwt een InputObject voor een GE/REL hub-type.
// Bevat: rel_id, inhoudsvelden uit _Data, secundaire FK (bij relaties),
// aanvang/einde (bij materieel).
func buildGEInputType(typenaam string, meta model.TypeMeta) *graphql.InputObject {
	if cached, ok := inputTypeCache[typenaam]; ok {
		return cached
	}

	// Registreer vóór het invullen om potentiële circulaire verwijzingen te voorkomen.
	var obj *graphql.InputObject
	obj = graphql.NewInputObject(graphql.InputObjectConfig{
		Name:        sanitizeTypeName(typenaam) + "Input",
		Description: meta.Description + " (invoer)",
		Fields: graphql.InputObjectConfigFieldMapThunk(func() graphql.InputObjectConfigFieldMap {
			fields := graphql.InputObjectConfigFieldMap{}

			// rel_id: optioneel bij nieuwe opvoer, verplicht bij correctie.
			fields["rel_id"] = &graphql.InputObjectFieldConfig{
				Type:        graphql.Int,
				Description: "Hub rel_id (optioneel bij opvoer, verplicht bij correctie)",
			}

			// FK naar secundaire entiteit (alleen bij relatie-types).
			if meta.SecondaireEntiteitIDKolom != "" {
				fields[meta.SecondaireEntiteitIDKolom] = &graphql.InputObjectFieldConfig{
					Type:        graphql.Int,
					Description: "ID van de secundaire entiteit",
				}
			}

			// Inhoudsvelden uit de _Data struct via reflection.
			skipSet := buildInputSkipSet(meta)
			if meta.DataTypenaam != "" {
				dataMeta, ok := model.MetaRegistry.GetTypeMeta(meta.DataTypenaam)
				if ok && dataMeta.DBFactory != nil {
					addStructInputFields(fields, dataMeta.DBFactory(), skipSet)
				}
			} else if meta.DBFactory != nil {
				// Geen apart _Data type — velden zitten op de hub zelf.
				addStructInputFields(fields, meta.DBFactory(), skipSet)
			}

			// Materieel plumbing: aanvang / einde sub-input.
			if meta.IsMaterieel {
				fields["aanvang"] = &graphql.InputObjectFieldConfig{
					Type:        PlumbingDatumInput,
					Description: "Aanvangdatum (materiële tijd, YYYY-MM-DD)",
				}
				fields["einde"] = &graphql.InputObjectFieldConfig{
					Type:        PlumbingDatumInput,
					Description: "Eindedatum (materiële tijd, YYYY-MM-DD)",
				}
			}

			return fields
		}),
	})

	inputTypeCache[typenaam] = obj
	return obj
}

// buildEntiteitPatchInputType bouwt <Typenaam>PatchInput voor een ENT.
// Eén veld per GE/REL hub uit OnderliggendeGegevenselementen (plumbing-subtypes overgeslagen).
func buildEntiteitPatchInputType(typenaam string, meta model.TypeMeta) *graphql.InputObject {
	return graphql.NewInputObject(graphql.InputObjectConfig{
		Name:        sanitizeTypeName(typenaam) + "PatchInput",
		Description: "Patch-invoer voor " + typenaam + ": één of meer onderliggende GE's/RELs",
		Fields: graphql.InputObjectConfigFieldMapThunk(func() graphql.InputObjectConfigFieldMap {
			fields := graphql.InputObjectConfigFieldMap{}

			for _, child := range meta.OnderliggendeGegevenselementen {
				// Alleen hub-types opnemen; aanvang/einde plumbing wordt intern afgehandeld.
				childMeta, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype)
				if !ok {
					continue
				}
				if childMeta.GESubtype != model.GESubtypeHub {
					continue
				}

				childInput := buildGEInputType(child.Doeltype, childMeta)

				// Altijd een lijst — een patch kan meerdere GE-exemplaren bevatten.
				fields[child.JSONRolnaam] = &graphql.InputObjectFieldConfig{
					Type:        graphql.NewList(childInput),
					Description: "Patch voor " + child.Doeltype,
				}
			}

			return fields
		}),
	})
}

// getPatchInputType geeft het PatchInput type voor een ENT terug,
// of valt terug op JSONScalar als het (nog) niet beschikbaar is.
func getPatchInputType(typenaam string) graphql.Input {
	if cached, ok := patchInputTypeCache[typenaam]; ok {
		return cached
	}
	return JSONScalar
}

// buildInputSkipSet bepaalt de JSON-veldnamen die bij data-veldextractie worden overgeslagen.
func buildInputSkipSet(meta model.TypeMeta) map[string]struct{} {
	skip := map[string]struct{}{
		"versie": {},
		"opvoer": {},
		"afvoer": {},
		"rel_id": {}, // wordt apart als eerste veld toegevoegd
	}
	if meta.EntiteitIDKolom != "" {
		skip[meta.EntiteitIDKolom] = struct{}{}
	}
	// SecondaireEntiteitIDKolom ook skippen — wordt apart als FK-veld toegevoegd.
	if meta.SecondaireEntiteitIDKolom != "" {
		skip[meta.SecondaireEntiteitIDKolom] = struct{}{}
	}
	return skip
}

// addStructInputFields reflecteert over een struct en voegt scalaire velden toe
// aan een InputObjectConfigFieldMap. Slaat arrays en bun-relaties over.
func addStructInputFields(fields graphql.InputObjectConfigFieldMap, v interface{}, skipSet map[string]struct{}) {
	if v == nil {
		return
	}
	t := reflect.TypeOf(v)
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return
	}

	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.PkgPath != "" {
			continue // unexported
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
		if _, shouldSkip := skipSet[name]; shouldSkip {
			continue
		}

		goType, format := schemaTypeVoorReflectType(f.Type)
		// Skip arrays/slices (bun-relaties, _Data[]/_Aanvang[]/_Einde[] etc.).
		if strings.HasPrefix(format, "array") {
			continue
		}

		enumValues := resolveEnumWaarden(f)
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

		gqlType := goTypeToGraphQLInput(enumGoType, format, enumValues)
		if gqlType == nil {
			continue
		}

		description := strings.TrimSpace(f.Tag.Get("schema_desc"))
		fields[name] = &graphql.InputObjectFieldConfig{
			Type:        gqlType,
			Description: description,
		}
	}
}

// goTypeToGraphQLInput mapt een Go type-string naar graphql.Input.
// Analoog aan goTypeToGraphQL in scalars.go maar produceert graphql.Input
// i.p.v. graphql.Output (beiden zijn interfaces van de graphql-go lib).
// graphql.*Enum implementeert beide interfaces, scalars ook.
func goTypeToGraphQLInput(goType string, format string, enumValues []string) graphql.Input {
	if len(enumValues) > 0 {
		// makeEnumType retourneert *graphql.Enum die graphql.Input implementeert.
		return makeEnumType(goType, enumValues)
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
