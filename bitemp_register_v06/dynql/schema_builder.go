package dynql

// schema_builder assembleert het volledige GraphQL schema vanuit de MetaRegistry.
// Wordt eenmalig bij startup aangeroepen. Produceert een graphql.Schema met:
// - Per entiteit: full_<padnaam>(id, peiltijdstip) query en <padnaam>(limit, offset) lijst query
// - registratie(id) en registraties(limit, offset) queries
// - registreer, corrigeer, maak_ongedaan mutations

import (
	"fmt"

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
		queryFields[fullName] = &graphql.Field{
			Type:        objType,
			Description: fmt.Sprintf("Volledige %s met alle onderliggende gegevenselementen en relaties", meta.Typenaam),
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{
					Type:        graphql.NewNonNull(graphql.String),
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

		// Registreer de padnaam voor mutations
		registeredEntiteitMetas = append(registeredEntiteitMetas, struct{ Padnaam string }{padnaam})
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
	mutationFields := graphql.Fields{
		"registreer": &graphql.Field{
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
