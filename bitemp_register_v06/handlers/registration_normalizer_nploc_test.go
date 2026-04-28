package handlers

import (
	"encoding/json"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Integratietest voor Fase 1 (geneste full-shape registratie) op het np_loc-domein.
//
// Dit is een E2E-test van de JSON-pijplijn (RepresentatiePlusNaam.UnmarshalJSON,
// kind-key strip, RawPayload-capture) plus de normalizer (NormaliseerWijziging),
// op het echte np_loc-metaregistry. De DB-laag wordt niet aangeroepen — dat
// gebeurt in de bestaande sqlmock-tests in registration_handlers_test.go.

// TestNormaliseer_NPLoc_GenesteOpvoer_E2E verifieert dat een geneste payload
// in de full-shape (zoals GET /full/natuurlijk_personen/:id retourneert)
// correct wordt gesplitst in platte wijzigingen, één per representatie,
// en dat de inhoud van elke sub-payload behouden blijft.
// Belangrijk: de child-payloads bevatten GEEN `natuurlijkpersoon_id`; de
// normalizer injecteert de FK automatisch op basis van de parent-ID (Fase 1.1).
func TestNormaliseer_NPLoc_GenesteOpvoer_E2E(t *testing.T) {
	payload := `{
		"opvoer": {
			"natuurlijkpersoon": {
				"id": 42,
				"persoonsidentificaties": {
					"rel_id": 1,
					"bsn": "123456789",
					"ingezetene": true
				},
				"namen": {
					"rel_id": 1,
					"voorletters": "A.",
					"roepnaam": "Anna",
					"tussenvoegsel": "van",
					"achternaam": "Dijk"
				},
				"aanvang": {
					"datum": "1980-05-17"
				},
				"einde": {
					"datum": "2030-01-01"
				}
			}
		}
	}`

	var w model.WijzigingRequest
	if err := json.Unmarshal([]byte(payload), &w); err != nil {
		t.Fatalf("unmarshal mislukt: %v", err)
	}

	out, err := NormaliseerWijziging(w)
	if err != nil {
		t.Fatalf("normaliseer mislukt: %v", err)
	}

	// Verwacht 5 wijzigingen: NP, Persoonsidentificatie, Naam, Aanvang, Einde.
	wantTypen := []string{
		"NatuurlijkPersoon",
		"NatuurlijkPersoon_Persoonsidentificatie",
		"NatuurlijkPersoon_Naam",
		"NatuurlijkPersoon_Aanvang",
		"NatuurlijkPersoon_Einde",
	}
	if len(out) != len(wantTypen) {
		var typen []string
		for _, w := range out {
			if w.Opvoer != nil {
				typen = append(typen, w.Opvoer.Representatienaam)
			}
		}
		t.Fatalf("verwacht %d wijzigingen %v, kreeg %d (%v)",
			len(wantTypen), wantTypen, len(out), typen)
	}
	for i, want := range wantTypen {
		if out[i].Opvoer == nil {
			t.Fatalf("wijziging[%d] mist opvoer", i)
		}
		if out[i].Opvoer.Representatienaam != want {
			t.Errorf("wijziging[%d]: verwacht type %s, kreeg %s",
				i, want, out[i].Opvoer.Representatienaam)
		}
	}

	// Top-level NatuurlijkPersoon-payload mag geen kind-keys meer bevatten.
	var topMap map[string]json.RawMessage
	if err := json.Unmarshal(out[0].Opvoer.RawPayload, &topMap); err != nil {
		t.Fatalf("top-level RawPayload niet als object te lezen: %v", err)
	}
	for _, verboden := range []string{
		"persoonsidentificaties", "namen", "aanvang", "einde",
	} {
		if _, present := topMap[verboden]; present {
			t.Errorf("top-level NatuurlijkPersoon bevat nog kind-key '%s'", verboden)
		}
	}
	// Maar id moet wel behouden zijn.
	if _, ok := topMap["id"]; !ok {
		t.Errorf("top-level NatuurlijkPersoon mist 'id' na strippen")
	}

	// Persoonsidentificatie-payload moet BSN behouden hebben.
	pidWijz := out[1]
	var pidMap map[string]any
	if err := json.Unmarshal(pidWijz.Opvoer.RawPayload, &pidMap); err != nil {
		t.Fatalf("persoonsidentificatie RawPayload niet als object te lezen: %v", err)
	}
	if pidMap["bsn"] != "123456789" {
		t.Errorf("persoonsidentificatie: verwacht bsn=123456789, kreeg %v", pidMap["bsn"])
	}
	// FK-injectie: normalizer moet `natuurlijkpersoon_id` hebben injecteerd
	// ook al stond dat NIET in de input-payload.
	if pidMap["natuurlijkpersoon_id"] != float64(42) {
		t.Errorf("persoonsidentificatie: verwacht natuurlijkpersoon_id=42 (geïnjecteerd), kreeg %v", pidMap["natuurlijkpersoon_id"])
	}

	// Naam-payload moet inhoudelijke velden behouden hebben + FK geïnjecteerd.
	naamWijz := out[2]
	var naamMap map[string]any
	if err := json.Unmarshal(naamWijz.Opvoer.RawPayload, &naamMap); err != nil {
		t.Fatalf("naam RawPayload niet als object te lezen: %v", err)
	}
	if naamMap["achternaam"] != "Dijk" {
		t.Errorf("naam: verwacht achternaam=Dijk, kreeg %v", naamMap["achternaam"])
	}
	if naamMap["roepnaam"] != "Anna" {
		t.Errorf("naam: verwacht roepnaam=Anna, kreeg %v", naamMap["roepnaam"])
	}
	if naamMap["natuurlijkpersoon_id"] != float64(42) {
		t.Errorf("naam: verwacht natuurlijkpersoon_id=42 (geïnjecteerd), kreeg %v", naamMap["natuurlijkpersoon_id"])
	}

	// Aanvang-payload moet datum behouden hebben + FK geïnjecteerd.
	aanvangWijz := out[3]
	var aanvangMap map[string]any
	if err := json.Unmarshal(aanvangWijz.Opvoer.RawPayload, &aanvangMap); err != nil {
		t.Fatalf("aanvang RawPayload niet als object te lezen: %v", err)
	}
	if aanvangMap["datum"] != "1980-05-17" {
		t.Errorf("aanvang: verwacht datum=1980-05-17, kreeg %v", aanvangMap["datum"])
	}
	if aanvangMap["natuurlijkpersoon_id"] != float64(42) {
		t.Errorf("aanvang: verwacht natuurlijkpersoon_id=42 (geïnjecteerd), kreeg %v", aanvangMap["natuurlijkpersoon_id"])
	}
}

// TestNormaliseer_NPLoc_PlatteOpvoer_BackCompat verifieert dat een
// klassieke "platte" payload (één representatie per wijziging) ongewijzigd
// blijft — backward compatibility.
func TestNormaliseer_NPLoc_PlatteOpvoer_BackCompat(t *testing.T) {
	payload := `{
		"opvoer": {
			"natuurlijkpersoon": { "id": 99 }
		}
	}`

	var w model.WijzigingRequest
	if err := json.Unmarshal([]byte(payload), &w); err != nil {
		t.Fatalf("unmarshal mislukt: %v", err)
	}

	out, err := NormaliseerWijziging(w)
	if err != nil {
		t.Fatalf("normaliseer mislukt: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("platte payload moet 1 wijziging blijven, kreeg %d", len(out))
	}
	if out[0].Opvoer == nil || out[0].Opvoer.Representatienaam != "NatuurlijkPersoon" {
		t.Fatalf("verwacht enkele NatuurlijkPersoon-wijziging, kreeg %+v", out[0].Opvoer)
	}
}

// TestNormaliseer_NPLoc_GenesteAfvoer_E2E: ook bij afvoer moet de geneste
// boom worden gesplitst in losse afvoer-wijzigingen per representatie.
// De child-payload bevat geen `natuurlijkpersoon_id`; de normalizer injecteert
// deze automatisch (FK-propagatie, Fase 1.1).
func TestNormaliseer_NPLoc_GenesteAfvoer_E2E(t *testing.T) {
	payload := `{
		"afvoer": {
			"natuurlijkpersoon": {
				"id": 42,
				"namen": { "rel_id": 1 }
			}
		}
	}`

	var w model.WijzigingRequest
	if err := json.Unmarshal([]byte(payload), &w); err != nil {
		t.Fatalf("unmarshal mislukt: %v", err)
	}

	out, err := NormaliseerWijziging(w)
	if err != nil {
		t.Fatalf("normaliseer mislukt: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("verwacht 2 afvoer-wijzigingen (NP + Naam), kreeg %d", len(out))
	}
	if out[0].Afvoer == nil || out[0].Afvoer.Representatienaam != "NatuurlijkPersoon" {
		t.Fatalf("verwacht NatuurlijkPersoon-afvoer eerst, kreeg %+v", out[0])
	}
	if out[1].Afvoer == nil || out[1].Afvoer.Representatienaam != "NatuurlijkPersoon_Naam" {
		t.Fatalf("verwacht NatuurlijkPersoon_Naam-afvoer, kreeg %+v", out[1])
	}
}
