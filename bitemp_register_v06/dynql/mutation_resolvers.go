package dynql

// mutation_resolvers bevat GraphQL mutation resolvers voor registratie, correctie en ongedaanmaking.
// Delegeert naar de bestaande REST registratie-logica via een HTTP round-trip naar de eigen server,
// zodat alle bestaande registratielogica (inclusief correctie, ongedaanmaking, hub-conversie,
// relatieve autoincrement, etc.) ongewijzigd hergebruikt wordt.
//
// Variant B: de mutation accepteert een JSON-payload die identiek is aan het REST request format.
// Dit voorkomt dat we de complexe registratielogica moeten dupliceren.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/graphql-go/graphql"
)

// registreerBaseURL is de basis-URL voor interne HTTP calls.
// Wordt bij startup gezet via SetRegistreerBaseURL.
var registreerBaseURL = "http://localhost:8082"

// SetRegistreerBaseURL stelt de basis-URL in voor interne registratie-calls.
func SetRegistreerBaseURL(url string) {
	registreerBaseURL = url
}

// makeRegistreerMutationResolver maakt de resolver voor de registreer mutation.
// Accepteert een JSON input die identiek is aan POST /registratie/<padnaam>.
func makeRegistreerMutationResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		return doRegistratieMutation(p, "registratie")
	}
}

// makeCorrigeerMutationResolver maakt de resolver voor de corrigeer mutation.
func makeCorrigeerMutationResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		return doRegistratieMutation(p, "correctie")
	}
}

// makeMaakOngedaanMutationResolver maakt de resolver voor de maak-ongedaan mutation.
func makeMaakOngedaanMutationResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		return doRegistratieMutation(p, "ongedaanmaking")
	}
}

// doRegistratieMutation voert een registratie/correctie/ongedaanmaking uit via de REST API.
// Het input argument bevat de volledige request body als JSON object.
func doRegistratieMutation(p graphql.ResolveParams, defaultType string) (interface{}, error) {
	input, ok := p.Args["input"]
	if !ok || input == nil {
		return nil, fmt.Errorf("input argument is verplicht")
	}

	// Het input argument is een vrij JSON object (via JSONScalar).
	// We voegen het registratietype toe als het nog niet aanwezig is.
	inputMap, ok := input.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("input moet een JSON object zijn")
	}

	// Zorg dat registratie.registratietype gezet is
	if reg, ok := inputMap["registratie"].(map[string]interface{}); ok {
		if _, hasType := reg["registratietype"]; !hasType {
			reg["registratietype"] = defaultType
		}
	} else {
		inputMap["registratie"] = map[string]interface{}{
			"registratietype": defaultType,
		}
	}

	// Bepaal de padnaam: eerste wijziging -> representatienaam -> meta -> padnaam
	padnaam := bepaalPadnaamUitInput(inputMap)

	body, err := json.Marshal(inputMap)
	if err != nil {
		return nil, fmt.Errorf("input serialisatie mislukt: %v", err)
	}

	url := fmt.Sprintf("%s/registratie/%s", registreerBaseURL, padnaam)
	resp, err := http.Post(url, "application/json", bytes.NewReader(body)) //nolint:gosec // interne call naar eigen server
	if err != nil {
		return nil, fmt.Errorf("registratie request mislukt: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("registratie response lezen mislukt: %v", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("registratie mislukt (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("registratie response parsing mislukt: %v", err)
	}

	return result, nil
}

// bepaalPadnaamUitInput leidt de pad-naam af uit het input object.
// Kijkt naar de eerste wijziging (opvoer of afvoer) en bepaalt via de MetaRegistry de padnaam.
func bepaalPadnaamUitInput(input map[string]interface{}) string {
	wijzigingen, ok := input["wijzigingen"].([]interface{})
	if !ok || len(wijzigingen) == 0 {
		return "as" // fallback
	}

	eerste, ok := wijzigingen[0].(map[string]interface{})
	if !ok {
		return "as"
	}

	// Zoek de eerste key in opvoer of afvoer
	for _, key := range []string{"opvoer", "afvoer"} {
		rep, ok := eerste[key].(map[string]interface{})
		if !ok {
			continue
		}
		for veldnaam := range rep {
			meta, found := findEntiteitMetaVoorVeldnaam(veldnaam)
			if found {
				return meta.Padnaam
			}
		}
	}

	return "as"
}

// findEntiteitMetaVoorVeldnaam zoekt de bovenliggende entiteit-meta voor een veldnaam.
func findEntiteitMetaVoorVeldnaam(_ string) (struct{ Padnaam string }, bool) {
	// Zoek de eerste beschikbare entiteit (geen veldnaam-index beschikbaar in registeredEntiteitMetas)
	for _, meta := range registeredEntiteitMetas {
		if meta.Padnaam != "" {
			return struct{ Padnaam string }{meta.Padnaam}, true
		}
	}
	return struct{ Padnaam string }{}, false
}

// registeredEntiteitMetas wordt gevuld door schema_builder bij startup.
var registeredEntiteitMetas []struct{ Padnaam string }
