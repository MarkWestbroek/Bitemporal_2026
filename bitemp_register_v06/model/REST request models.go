package model

import (
	"encoding/json"
	"fmt"
	"os"
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
	Representatie     Representatie `json:"-"`
	Representatienaam string        `json:"-"` // Type-naam (bijv. A, B, A_U, Rel_A_B)
	Veldnaam          string        `json:"-"` // JSON veldnaam (bijv. a, b, u, rel_a_b)
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
		meta, ok := chooseMetaByPayload(veldnaam, payload)
		if !ok {
			return fmt.Errorf("unsupported representatie key '%s'", veldnaam)
		}

		representatie := meta.Factory()
		if err := json.Unmarshal(payload, representatie); err != nil {
			return err
		}

		rep.Representatienaam = meta.Typenaam
		rep.Veldnaam = veldnaam
		rep.Representatie = representatie

		if debugLogsEnabled() {
			fmt.Printf("MODELS: representatienaam=%s veldnaam=%s metatype=%s id=%v\n", meta.Typenaam, veldnaam, representatie.Metatype(), representatie.GetID())
		}
	}

	return nil
}

// chooseMetaByPayload lost ambiguïteit op wanneer meerdere types dezelfde
// Veldnaam delen (bijv. "naam" → ApiStandaard_Naam_Data / NatuurlijkPersoon_Naam_Data).
// De juiste TypeMeta wordt gekozen door te kijken welk EntiteitIDKolom als
// JSON-sleutel in de payload voorkomt.
func chooseMetaByPayload(veldnaam string, payload json.RawMessage) (TypeMeta, bool) {
	candidates := MetaRegistry.GetAllByVeldnaam(veldnaam)
	if len(candidates) == 0 {
		return TypeMeta{}, false
	}
	if len(candidates) == 1 {
		return candidates[0], true
	}

	// Meerdere matches: inspecteer de payload-sleutels om te disambigueren.
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(payload, &keys); err != nil {
		// Bij parsefout: neem de eerste kandidaat als fallback.
		return candidates[0], true
	}
	for _, meta := range candidates {
		if meta.EntiteitIDKolom != "" {
			if _, found := keys[meta.EntiteitIDKolom]; found {
				return meta, true
			}
		}
	}

	// Geen match op EntiteitIDKolom: log een waarschuwing, neem de eerste.
	fmt.Fprintf(os.Stderr, "WARN chooseMetaByPayload: geen disambiguatie mogelijk voor veldnaam %q (%d candidates)\n", veldnaam, len(candidates))
	return candidates[0], true
}

// Legacy AsA/AsB/OpvoerAfvoerA/OpvoerAfvoerB verwijderd — niet meer
// nodig; v06 registratie is volledig generiek via MetaRegistry.
