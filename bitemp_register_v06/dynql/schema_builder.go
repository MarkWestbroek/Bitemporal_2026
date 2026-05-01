package dynql

// schema_builder assembleert het volledige GraphQL schema vanuit de MetaRegistry.
// Wordt eenmalig bij startup aangeroepen. Produceert een graphql.Schema met:
// - Per entiteit: full_<padnaam>(id, peiltijdstip) query en <padnaam>(limit, offset) lijst query
// - registratie(id) en registraties(limit, offset) queries
// - registreer, corrigeer, maak_ongedaan mutations

import (
	"fmt"
	"reflect"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
)

// BuildSchema bouwt het volledige GraphQL schema vanuit de MetaRegistry.
// Moet na InitDB() worden aangeroepen.
func BuildSchema(database *bun.DB) (*graphql.Schema, error) {
	InitDB(database)

	// Bouw alle output types
	outputTypes := BuildOutputTypes()

	// Query velden
	queryFields := graphql.Fields{}

	// Per entiteit: full query en list query
	for typenaam, meta := range model.MetaRegistry {
		if meta.Metatype != model.MetatypeEntiteit {
			continue
		}
		if meta.Factory == nil || meta.SliceFactory == nil {
			continue
		}

		objType, ok := outputTypes[typenaam]
		if !ok {
			continue
		}

		padnaam := meta.Padnaam
		if padnaam == "" {
			padnaam = meta.Veldnaam
		}

		// full_<padnaam>(id, peiltijdstip) — één entiteit met alle geneste GE's/relaties
		fullName := "full_" + padnaam
		idArgType := inferIDArgType(meta)
		queryFields[fullName] = &graphql.Field{
			Type:        objType,
			Description: fmt.Sprintf("Volledige %s met alle onderliggende gegevenselementen en relaties", meta.Typenaam),
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{
					Type:        graphql.NewNonNull(idArgType),
					Description: "ID van de entiteit",
				},
				"peiltijdstip": &graphql.ArgumentConfig{
					Type:        DateTimeScalar,
					Description: "Formeel peiltijdstip (ISO 8601). Optioneel; als leeg: actuele situatie.",
				},
				"t": &graphql.ArgumentConfig{
					Type:        graphql.Int,
					Description: "Shorthand peiltijdstip: integer t wordt vertaald naar 2026-01-01T00:00:00Z + t uur + t µs. Als peiltijdstip ook is meegegeven, krijgt peiltijdstip voorrang.",
				},
			},
			Resolve: makeFullEntityResolver(meta),
		}

		// <padnaam>(limit, offset) — lijst van entiteiten
		queryFields[padnaam] = &graphql.Field{
			Type:        graphql.NewList(objType),
			Description: fmt.Sprintf("Lijst van %s", meta.Typenaam),
			Args: graphql.FieldConfigArgument{
				"limit": &graphql.ArgumentConfig{
					Type:         graphql.Int,
					DefaultValue: 20,
					Description:  "Maximum aantal resultaten (max 100)",
				},
				"offset": &graphql.ArgumentConfig{
					Type:         graphql.Int,
					DefaultValue: 0,
					Description:  "Offset voor paginering",
				},
			},
			Resolve: makeListResolver(meta),
		}

		// full_<padnaam>_list(limit, offset) — lijst met alle onderliggende GE's/relaties (geflattened)
		queryFields[fullName+"_list"] = &graphql.Field{
			Type:        graphql.NewList(objType),
			Description: fmt.Sprintf("Lijst van %s met alle onderliggende gegevenselementen en relaties (geflattened)", meta.Typenaam),
			Args: graphql.FieldConfigArgument{
				"limit": &graphql.ArgumentConfig{
					Type:         graphql.Int,
					DefaultValue: 20,
					Description:  "Maximum aantal resultaten (max 100)",
				},
				"offset": &graphql.ArgumentConfig{
					Type:         graphql.Int,
					DefaultValue: 0,
					Description:  "Offset voor paginering",
				},
			},
			Resolve: makeFullListResolver(meta),
		}
	}

	// Registratie queries
	queryFields["registratie"] = &graphql.Field{
		Type:        RegistratieType,
		Description: "Eén registratie ophalen op ID",
		Args: graphql.FieldConfigArgument{
			"id": &graphql.ArgumentConfig{
				Type:        graphql.NewNonNull(graphql.Int),
				Description: "ID van de registratie",
			},
		},
		Resolve: makeRegistratieResolver(),
	}

	queryFields["registraties"] = &graphql.Field{
		Type:        graphql.NewList(RegistratieType),
		Description: "Lijst van registraties (nieuwste eerst)",
		Args: graphql.FieldConfigArgument{
			"limit": &graphql.ArgumentConfig{
				Type:         graphql.Int,
				DefaultValue: 20,
				Description:  "Maximum aantal resultaten",
			},
			"offset": &graphql.ArgumentConfig{
				Type:         graphql.Int,
				DefaultValue: 0,
				Description:  "Offset voor paginering",
			},
		},
		Resolve: makeRegistratiesResolver(),
	}

	// Mutation velden
	mutationFields := graphql.Fields{"registreer": &graphql.Field{
		Type:        JSONScalar,
		Description: "Registreer nieuwe gegevens. Input is identiek aan het REST POST /registratie/<padnaam> format.",
		Args: graphql.FieldConfigArgument{
			"input": &graphql.ArgumentConfig{
				Type:        graphql.NewNonNull(JSONScalar),
				Description: "Volledige registratie-request als JSON (zelfde format als REST endpoint)",
			},
		},
		Resolve: makeRegistreerMutationResolver(),
	},
		"corrigeer": &graphql.Field{
			Type:        JSONScalar,
			Description: "Corrigeer een eerdere registratie. Input bevat corrigeert_registratie_id.",
			Args: graphql.FieldConfigArgument{
				"input": &graphql.ArgumentConfig{
					Type:        graphql.NewNonNull(JSONScalar),
					Description: "Correctie-request als JSON",
				},
			},
			Resolve: makeCorrigeerMutationResolver(),
		},
		"maak_ongedaan": &graphql.Field{
			Type:        JSONScalar,
			Description: "Maak een eerdere registratie ongedaan.",
			Args: graphql.FieldConfigArgument{
				"input": &graphql.ArgumentConfig{
					Type:        graphql.NewNonNull(JSONScalar),
					Description: "Ongedaanmaking-request als JSON",
				},
			},
			Resolve: makeMaakOngedaanMutationResolver(),
		},
		"maakRegistratieOngedaan": &graphql.Field{
			Type:        JSONScalar,
			Description: "Maak een eerdere registratie ongedaan op basis van registratie_id (typed variant van maak_ongedaan).",
			Args: graphql.FieldConfigArgument{
				"registratie_id": &graphql.ArgumentConfig{
					Type:        graphql.NewNonNull(graphql.Int),
					Description: "ID van de registratie die ongedaan moet worden gemaakt",
				},
				"opmerking": &graphql.ArgumentConfig{
					Type:        graphql.String,
					Description: "Optionele toelichting op de ongedaanmaking",
				},
			},
			Resolve: makeMaakRegistratieOngedaanResolver(),
		},
	}

	// Per-ENT typed mutations: wijzig<X>, corrigeer<X>, voer<X>Af.
	// Hergebruikt de WijzigEntiteitCore / VoerEntiteitAfCore pure functies.
	// BuildPatchInputTypes vult patchInputTypeCache; getPatchInputType leest er uit.
	BuildPatchInputTypes()
	for _, meta := range model.MetaRegistry {
		AddTypedMutationsForEntiteit(mutationFields, meta)
	}

	// Bouw het schema
	schema, err := graphql.NewSchema(graphql.SchemaConfig{
		Query: graphql.NewObject(graphql.ObjectConfig{
			Name:   "Query",
			Fields: queryFields,
		}),
		Mutation: graphql.NewObject(graphql.ObjectConfig{
			Name:   "Mutation",
			Fields: mutationFields,
		}),
	})
	if err != nil {
		return nil, fmt.Errorf("GraphQL schema bouwen mislukt: %v", err)
	}

	return &schema, nil
}

// inferIDArgType bepaalt het GraphQL argumenttype voor `id` op basis van het
// daadwerkelijke Go-type van de ID-kolom van de entiteit.
// Dit gebeurt eenmalig bij schema-opbouw (startup), niet per request.
func inferIDArgType(meta model.TypeMeta) graphql.Input {
	rep := makeMetaRepresentative(meta)
	if rep == nil {
		return graphql.String
	}

	t := reflect.TypeOf(rep)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return graphql.String
	}

	fieldType, ok := findFieldTypeByBunKolom(t, meta.IDKolom)
	if !ok {
		return graphql.String
	}

	for fieldType.Kind() == reflect.Ptr {
		fieldType = fieldType.Elem()
	}

	switch fieldType.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return graphql.Int
	case reflect.String:
		return graphql.String
	default:
		return graphql.String
	}
}

func makeMetaRepresentative(meta model.TypeMeta) interface{} {
	if meta.DBFactory != nil {
		return meta.DBFactory()
	}
	if meta.Factory != nil {
		return meta.Factory()
	}
	return nil
}

func findFieldTypeByBunKolom(t reflect.Type, kolom string) (reflect.Type, bool) {
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)

		// Embedded structs (zoals bun.BaseModel) recursief inspecteren.
		if f.Anonymous {
			embeddedType := f.Type
			if embeddedType.Kind() == reflect.Ptr {
				embeddedType = embeddedType.Elem()
			}
			if embeddedType.Kind() == reflect.Struct {
				if ft, ok := findFieldTypeByBunKolom(embeddedType, kolom); ok {
					return ft, true
				}
			}
		}

		bunTag := f.Tag.Get("bun")
		if bunTag == "" {
			continue
		}

		// Eerste deel van bun tag is kolomnaam, bijv. `id,pk`.
		col := bunTag
		for j := 0; j < len(col); j++ {
			if col[j] == ',' {
				col = col[:j]
				break
			}
		}

		if col == kolom {
			return f.Type, true
		}
	}

	return nil, false
}
