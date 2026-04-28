package model

import (
	"encoding/json"
	"fmt"
)

/*
Algemene structs voor registratie requests (bitemporele registratie)
Dit is eigenlijk ook plumbing
*/

/*
RegistreerRequest is het request format voor POST /registreer/{entiteitnaam}s

	(bijv. /registreer/as of /registreer/bs)
	Het bevat de Registratie data en een lijst van Wijzigingen, waarbij elke Wijziging een opvoer of afvoer kan bevatten van een volledige entiteit of individuele gegevenselementen of relaties.
*/
type RegistreerRequest struct {
	Registratie Registratie        `json:"registratie"`
	Wijzigingen []WijzigingRequest `json:"wijzigingen"`
}

type WijzigingRequest struct {
	Opvoer *RepresentatiePlusNaam `json:"opvoer,omitempty"`
	Afvoer *RepresentatiePlusNaam `json:"afvoer,omitempty"`
}

/*
De representatie (interface) plus velden voor:
- de type-naam van de representatie (A, B, Rel_A_B, A_U, A_V, B_X, B_Y)
- de JSON veldnaam in de request (a, b, rel_a_b, u, v, x, y)

Deze struct heeft een custom UnmarshalJSON functie die de JSON data inspecteert, de representatienaam en payload eruit haalt,
en op basis van de representatienaam de juiste struct (A, B, Rel_A_B, A_U, A_V, B_X of B_Y) unmarshal't.

De RepresentatiePlusNaam struct heeft ook helper methoden AsA() en AsB().
Deze proberen de representatie te casten naar een type dat geldig is voor A of B flow, geven een fout terug als dat niet mogelijk is.

Deze aanpak maakt het mogelijk om in de WijzigingRequest struct flexibele opvoer/afvoer velden te hebben

	die verschillende soorten representaties kunnen bevatten,
	terwijl we toch duidelijkheid hebben over wat er in die velden zit en hoe ermee om te gaan in de handlers.
*/
type RepresentatiePlusNaam struct {
	Representatie     Representatie   `json:"-"`
	Representatienaam string          `json:"-"` // Type-naam (bijv. A, B, A_U, Rel_A_B)
	Veldnaam          string          `json:"-"` // JSON veldnaam (bijv. a, b, u, rel_a_b)
	RawPayload        json.RawMessage `json:"-"` // Originele JSON-payload van de representatie (vóór unmarshal naar de typed struct). Bewaard zodat de normalizer (handlers/registration_normalizer.go) geneste onderliggende GE's/relaties uit de boom kan splitsen.
}

func (rep RepresentatiePlusNaam) MarshalJSON() ([]byte, error) {
	if rep.Representatie == nil {
		return []byte("null"), nil
	}

	veldnaam := rep.Veldnaam
	if veldnaam == "" && rep.Representatienaam != "" {
		meta, ok := MetaRegistry.GetTypeMeta(rep.Representatienaam)
		if ok {
			veldnaam = meta.Veldnaam
		}
	}

	if veldnaam == "" {
		return nil, fmt.Errorf("cannot marshal representatie zonder veldnaam (typenaam=%s)", rep.Representatienaam)
	}

	return json.Marshal(map[string]Representatie{veldnaam: rep.Representatie})
}

func (rep *RepresentatiePlusNaam) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		return nil
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	if len(raw) != 1 {
		return fmt.Errorf("Er mag in opvoer/afvoer maar één representatie aanwezig zijn, maar er zijn %d gevonden", len(raw))
	}

	for veldnaam, payload := range raw {
		// Extraheer de JSON-sleutels uit de payload voor disambiguatie
		// (bijv. "apistandaard_id" vs "natuurlijk_persoon_id" bij veldnaam "naam").
		var payloadMap map[string]json.RawMessage
		payloadKeys := make(map[string]struct{})
		if err := json.Unmarshal(payload, &payloadMap); err == nil {
			for k := range payloadMap {
				payloadKeys[k] = struct{}{}
			}
		}
		meta, ok := MetaRegistry.GetByVeldnaamMetPayload(veldnaam, payloadKeys)
		if !ok {
			return fmt.Errorf("unsupported representatie key '%s'", veldnaam)
		}

		// Bewaar de originele (mogelijk geneste) payload zodat de normalizer
		// (handlers/registration_normalizer.go, Fase 1) onderliggende
		// GE's/relaties uit de boom kan splitsen.
		fullPayload := append(json.RawMessage(nil), payload...)

		// Voor het unmarshallen naar de typed Representatie strippen we
		// kind-keys (JSONRolnaam van OnderliggendeGegevenselementen) uit de
		// payload. De typed structvelden voor hub-children zijn arrays
		// (`[]<Child>`), terwijl een geneste full-shape vaak een enkel
		// object per kind aanlevert; bovendien horen die kinderen straks
		// als aparte WijzigingRequests verwerkt te worden, niet als
		// nested-attribute op de typed parent.
		typedPayload := payload
		if len(meta.OnderliggendeGegevenselementen) > 0 && len(payloadMap) > 0 {
			gestript := make(map[string]json.RawMessage, len(payloadMap))
			kindKeys := make(map[string]struct{}, len(meta.OnderliggendeGegevenselementen))
			for _, og := range meta.OnderliggendeGegevenselementen {
				if og.JSONRolnaam != "" {
					kindKeys[og.JSONRolnaam] = struct{}{}
				}
			}
			for k, v := range payloadMap {
				if _, isKind := kindKeys[k]; isKind {
					continue
				}
				gestript[k] = v
			}
			if buf, err := json.Marshal(gestript); err == nil {
				typedPayload = buf
			}
		}

		representatie := meta.Factory()
		if err := json.Unmarshal(typedPayload, representatie); err != nil {
			return err
		}

		rep.Representatienaam = meta.Typenaam
		rep.Veldnaam = veldnaam
		rep.Representatie = representatie
		rep.RawPayload = fullPayload

		if debugLogsEnabled() {
			fmt.Printf("MODELS: representatienaam=%s veldnaam=%s metatype=%s id=%v\n", meta.Typenaam, veldnaam, representatie.Metatype(), representatie.GetID())
		}
	}

	return nil
}

// Legacy AsA/AsB/OpvoerAfvoerA/OpvoerAfvoerB verwijderd — niet meer
// nodig; v06 registratie is volledig generiek via MetaRegistry.
