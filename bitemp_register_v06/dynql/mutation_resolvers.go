package dynql

// mutation_resolvers — GraphQL mutations voor registratie, correctie en ongedaanmaking.
//
// FASE 3A (2026-04-30): de oude HTTP-roundtrip naar de eigen server is vervangen
// door een directe aanroep van `handlers.RegistreerJSONCore`. Daarmee:
//   - geen poort/URL-configuratie meer nodig (`registreerBaseURL` weg);
//   - één transactiemodel/audit-pad gedeeld met REST + PATCH/DELETE;
//   - geen serialisatie-overhead voor interne calls.
//
// De geaccepteerde input blijft een vrij JSON-object identiek aan de REST POST
// /registratie/-body — back-compat voor bestaande clients en GraphiQL-snippets.

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
)

// SetRegistreerBaseURL is behouden als no-op zodat externe callers niet breken;
// de mutations gebruiken geen HTTP meer.
//
// Deprecated: heeft geen effect sinds Fase 3A; verwijder bij volgende major.
func SetRegistreerBaseURL(_ string) {}

func makeRegistreerMutationResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		return doRegistratieMutation(p, model.RegistratietypeRegistratie)
	}
}

func makeCorrigeerMutationResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		return doRegistratieMutation(p, model.RegistratietypeCorrectie)
	}
}

func makeMaakOngedaanMutationResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		return doRegistratieMutation(p, model.RegistratietypeOngedaanmaking)
	}
}

// makeMaakRegistratieOngedaanResolver — typed variant van maak_ongedaan.
// Werkt op een registratie_id (geen entiteit/GE/REL) en bouwt de
// ongedaanmaking-payload server-side, zodat de cliënt geen JSON-body hoeft op
// te stellen.
func makeMaakRegistratieOngedaanResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		regID, ok := p.Args["registratie_id"].(int)
		if !ok || regID <= 0 {
			return nil, fmt.Errorf("registratie_id is verplicht en moet > 0 zijn")
		}
		opmerking, _ := p.Args["opmerking"].(string)

		payload := map[string]interface{}{
			"registratie": map[string]interface{}{
				"registratietype":           string(model.RegistratietypeOngedaanmaking),
				"corrigeert_registratie_id": regID,
				"opmerking":                 opmerking,
			},
			"wijzigingen": []interface{}{},
		}
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("payload serialisatie mislukt: %v", err)
		}

		ctx := contextFromResolve(p)
		audit := handlers.AuditMeta{
			RawBody:       body,
			RequestPath:   "/graphql",
			RequestMethod: "POST",
		}
		res, rerr := handlers.RegistreerJSONCore(ctx, body, model.RegistratietypeOngedaanmaking, audit)
		if rerr != nil {
			return nil, fmt.Errorf("ongedaanmaking mislukt (status %d): %s", rerr.Status, rerr.Msg)
		}
		return map[string]interface{}{
			"message":        res.Message,
			"registratie_id": res.RegistratieID,
			"registratieId":  res.RegistratieID,
			"tijdstip":       res.Tijdstip,
			"wijzigingen":    res.Wijzigingen,
		}, nil
	}
}

// doRegistratieMutation roept RegistreerJSONCore direct aan — geen HTTP.
func doRegistratieMutation(p graphql.ResolveParams, defaultType model.RegistratietypeEnum) (interface{}, error) {
	input, ok := p.Args["input"]
	if !ok || input == nil {
		return nil, fmt.Errorf("input argument is verplicht")
	}
	body, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("input serialisatie mislukt: %v", err)
	}

	ctx := contextFromResolve(p)
	audit := handlers.AuditMeta{
		RawBody:       body,
		RequestPath:   "/graphql",
		RequestMethod: "POST",
	}
	res, rerr := handlers.RegistreerJSONCore(ctx, body, defaultType, audit)
	if rerr != nil {
		return nil, fmt.Errorf("registratie mislukt (status %d): %s", rerr.Status, rerr.Msg)
	}

	return map[string]interface{}{
		"message":        res.Message,
		"registratie_id": res.RegistratieID,
		"registratieId":  res.RegistratieID,
		"tijdstip":       res.Tijdstip,
		"wijzigingen":    res.Wijzigingen,
	}, nil
}

// contextFromResolve haalt de context uit ResolveParams; valt terug op Background
// als (oude versies van) graphql-go geen Context propageren.
func contextFromResolve(p graphql.ResolveParams) context.Context {
	if p.Context != nil {
		return p.Context
	}
	return context.Background()
}
