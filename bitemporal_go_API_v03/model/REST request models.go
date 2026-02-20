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
en op basis van de representatienaam de juiste struct (Full_A, Full_B, Rel_A_B, A_U, A_V, B_X of B_Y) unmarshal't.

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
		meta, ok := MetaRegistry.GetByVeldnaam(veldnaam)
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

func (rep *RepresentatiePlusNaam) AsA() (*OpvoerAfvoerA, error) {
	if rep == nil || rep.Representatie == nil {
		return nil, nil
	}

	switch value := rep.Representatie.(type) {
	case *Full_A:
		return &OpvoerAfvoerA{A: value}, nil
	case *A_U:
		return &OpvoerAfvoerA{U: value}, nil
	case *A_V:
		return &OpvoerAfvoerA{V: value}, nil
	case *Rel_A_B:
		return &OpvoerAfvoerA{Rel_A_B: value}, nil
	default:
		return nil, fmt.Errorf("representatie '%T' is not valid for A-flow", rep.Representatie)
	}
}

func (rep *RepresentatiePlusNaam) AsB() (*OpvoerAfvoerB, error) {
	if rep == nil || rep.Representatie == nil {
		return nil, nil
	}

	switch value := rep.Representatie.(type) {
	case *Full_B:
		return &OpvoerAfvoerB{B: value}, nil
	case *B_X:
		return &OpvoerAfvoerB{X: value}, nil
	case *B_Y:
		return &OpvoerAfvoerB{Y: value}, nil
	default:
		return nil, fmt.Errorf("representatie '%T' is not valid for B-flow", rep.Representatie)
	}
}

// OpvoerAfvoerA can contain either a full entity or individual data elements
type OpvoerAfvoerA struct {
	// Voor opvoer/afvoer van hele entiteit A
	A *Full_A `json:"a,omitempty"`

	// Voor opvoer/afvoer van individuele gegevenselementen
	U *A_U `json:"u,omitempty"`
	V *A_V `json:"v,omitempty"`

	// Voor opvoer/afvoer van relaties
	Rel_A_B *Rel_A_B `json:"rel_a_b,omitempty"`

	// Voor batch opvoer/afvoer van meerdere gegevenselementen van hetzelfde type
	Us []A_U `json:"us,omitempty"`
	Vs []A_V `json:"vs,omitempty"`

	// Voor batch opvoer/afvoer van meerdere relaties
	Rel_A_Bs []Rel_A_B `json:"rel_a_bs,omitempty"`
}

// OpvoerAfvoerB can contain either a full entity or individual data elements
type OpvoerAfvoerB struct {
	// Voor opvoer/afvoer van hele entiteit B
	B *Full_B `json:"b,omitempty"`

	// Voor opvoer/afvoer van individuele gegevenselementen
	X *B_X `json:"x,omitempty"`
	Y *B_Y `json:"y,omitempty"`

	// Voor batch opvoer/afvoer van meerdere gegevenselementen van hetzelfde type
	Xs []B_X `json:"xs,omitempty"`
	Ys []B_Y `json:"ys,omitempty"`
}
