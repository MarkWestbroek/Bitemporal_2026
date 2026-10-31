package model

import (
	"encoding/json"
	"testing"
)

// De Studio geeft elk modelelement bij een V3-export een `uuid` (identiteit binnen de tool,
// besluit Mark 31-10-2026, BACKLOG §40). De API doet er niets mee, maar moet hem doorlaten:
// POST /api/schema/model unmarshalt naar V3Model en marshalt weer naar schema_versies, en de
// delta-import in de Studio leest hem daarna terug uit de API. Zeven soorten dragen een uuid:
// entiteit, gegevenselement, relatie, veld, enumeratie, gegevenstype en referentielijst-instantie.
func TestV3_UUIDOverleeftRondreis(t *testing.T) {
	bron := `{
	  "versie": "v3",
	  "datatypes": [{"uuid": "d1000000-0000-4000-8000-000000000001", "naam": "Postcode", "basistype": "string", "format": "nl-postcode"}],
	  "enums": [{"uuid": "e1000000-0000-4000-8000-000000000001", "goType": "Kleur", "baseType": "string",
	             "waarden": [{"constNaam": "KleurRood", "waarde": "rood"}]}],
	  "referentielijstInstanties": [{"uuid": "f1000000-0000-4000-8000-000000000001", "systeemnaam": "Landenlijst"}],
	  "entiteiten": [{
	    "uuid": "a1000000-0000-4000-8000-000000000001",
	    "typenaam": "Zaak", "meervoud": "zaken", "domein": "proef",
	    "gegevenselementen": [{
	      "uuid": "c1000000-0000-4000-8000-000000000001",
	      "naam": "ZaakStatus", "meervoud": "zaak_statussen", "momentvoorkomen": "enkelvoudig",
	      "velden": [{"uuid": "b1000000-0000-4000-8000-000000000002", "naam": "status", "goType": "string"}]
	    }],
	    "relaties": [{
	      "uuid": "c2000000-0000-4000-8000-000000000001",
	      "naam": "ZaakBehandelaar", "meervoud": "zaak_behandelaars", "momentvoorkomen": "enkelvoudig",
	      "doelEntiteit": "Medewerker",
	      "velden": [{"uuid": "b1000000-0000-4000-8000-000000000003", "naam": "rol", "goType": "string"}]
	    }]
	  }, {"typenaam": "Medewerker", "meervoud": "medewerkers", "domein": "proef"}]
	}`

	var v3 V3Model
	if err := json.Unmarshal([]byte(bron), &v3); err != nil {
		t.Fatal(err)
	}
	// Zoals de schema-handler doet: opnieuw marshallen en weer inlezen.
	uit, err := json.Marshal(v3)
	if err != nil {
		t.Fatal(err)
	}
	var terug V3Model
	if err := json.Unmarshal(uit, &terug); err != nil {
		t.Fatal(err)
	}

	ent := terug.Entiteiten[0]
	controles := map[string]string{
		"datatype":                 terug.Datatypes[0].UUID,
		"enum":                     terug.Enums[0].UUID,
		"referentielijstInstantie": terug.ReferentielijstInstanties[0].UUID,
		"entiteit":                 ent.UUID,
		"gegevenselement":          ent.Gegevenselementen[0].UUID,
		"veld op gegevenselement":  ent.Gegevenselementen[0].Velden[0].UUID,
		"relatie":                  ent.Relaties[0].UUID,
		"veld op relatie":          ent.Relaties[0].Velden[0].UUID,
	}
	verwacht := map[string]string{
		"datatype":                 "d1000000-0000-4000-8000-000000000001",
		"enum":                     "e1000000-0000-4000-8000-000000000001",
		"referentielijstInstantie": "f1000000-0000-4000-8000-000000000001",
		"entiteit":                 "a1000000-0000-4000-8000-000000000001",
		"gegevenselement":          "c1000000-0000-4000-8000-000000000001",
		"veld op gegevenselement":  "b1000000-0000-4000-8000-000000000002",
		"relatie":                  "c2000000-0000-4000-8000-000000000001",
		"veld op relatie":          "b1000000-0000-4000-8000-000000000003",
	}
	for soort, want := range verwacht {
		if controles[soort] != want {
			t.Errorf("%s: uuid %q verloren of gewijzigd (verwacht %q)", soort, controles[soort], want)
		}
	}

	// Zonder uuid blijft V3 geldig en wordt er geen lege sleutel geschreven.
	if terug.Entiteiten[1].UUID != "" {
		t.Errorf("Medewerker zonder uuid kreeg er een: %q", terug.Entiteiten[1].UUID)
	}
	var generiek map[string]any
	if err := json.Unmarshal(uit, &generiek); err != nil {
		t.Fatal(err)
	}
	medewerker := generiek["entiteiten"].([]any)[1].(map[string]any)
	if _, ok := medewerker["uuid"]; ok {
		t.Errorf("lege uuid hoort weggelaten te worden (omitempty), kreeg %v", medewerker["uuid"])
	}

	// FilterV3ModelStrictByDomein kopieert hele structs (en kijkt in de MetaRegistry, waar dit
	// proefmodel niet in staat); een uuid gaat daar dus niet verloren.
}
