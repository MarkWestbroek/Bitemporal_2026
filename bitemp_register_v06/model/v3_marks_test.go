package model

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestPasRegisterMarksToe(t *testing.T) {
	const bron = `{
	  "versie": "3.1",
	  "entiteiten": [{
	    "typenaam": "Rol", "domein": "zaken",
	    "gegevenselementen": [{"naam": "RolNatuurlijkPersoon", "velden": [
	      {"naam": "bsn", "uuid": "u-bsn", "goType": "string"},
	      {"naam": "geslachtsnaam", "uuid": "u-naam", "goType": "string"}
	    ]}],
	    "relaties": [{"naam": "RolRoltype", "doelEntiteit": "Roltype", "velden": [
	      {"naam": "sinds", "uuid": "u-sinds", "goType": "*Date"}
	    ]}]
	  }],
	  "marks": {"context": ["algemeen"], "marks": [
	    {"doel": {"soort": "veld", "uuid": "u-bsn"}, "soort": "register.zoeksleutel", "waarde": true},
	    {"doel": {"soort": "veld", "uuid": "u-sinds"}, "soort": "register.sorteerbaar", "waarde": true},
	    {"doel": {"soort": "veld", "uuid": "u-naam"}, "soort": "register.zoeksleutel", "waarde": false},
	    {"doel": {"soort": "veld", "uuid": "u-weg"}, "soort": "register.zoeksleutel", "waarde": true},
	    {"doel": {"soort": "element", "uuid": "u-bsn"}, "soort": "register.sorteerbaar", "waarde": true},
	    {"doel": {"soort": "veld", "uuid": "u-naam"}, "soort": "register.sorteerbaar", "waarde": "ja"},
	    {"doel": {"soort": "veld", "uuid": "u-naam"}, "soort": "register.tekstzoeken", "waarde": true},
	    {"doel": {"soort": "veld", "uuid": "u-naam"}, "soort": "gzac.verberg", "waarde": true}
	  ]}
	}`
	var v3 V3Model
	if err := json.Unmarshal([]byte(bron), &v3); err != nil {
		t.Fatal(err)
	}
	meldingen := PasRegisterMarksToe(&v3)

	ge := v3.Entiteiten[0].Gegevenselementen[0].Velden
	rel := v3.Entiteiten[0].Relaties[0].Velden
	if !ge[0].Zoeksleutel || ge[0].Sorteerbaar {
		t.Errorf("bsn: zoeksleutel verwacht, kreeg %+v", ge[0])
	}
	if ge[1].Zoeksleutel || ge[1].Sorteerbaar {
		t.Errorf("geslachtsnaam: waarde false, tekst-waarde, gereserveerde en vreemde soort horen niets te zetten: %+v", ge[1])
	}
	if !rel[0].Sorteerbaar {
		t.Errorf("veld op een relatie hoort ook een mark te kunnen dragen: %+v", rel[0])
	}
	if len(meldingen) != 3 {
		t.Fatalf("verwacht 3 meldingen (onbekende uuid, verkeerd doel, geen ja/nee), kreeg %d: %v", len(meldingen), meldingen)
	}
	for i, deel := range []string{"u-weg", "element", "geen ja/nee"} {
		if !strings.Contains(meldingen[i], deel) {
			t.Errorf("melding %d noemt %q niet: %s", i, deel, meldingen[i])
		}
	}

	// De vlaggen staan niet in de JSON van het veld: de mark blijft een bijlage.
	uit, _ := json.Marshal(v3.Entiteiten[0].Gegevenselementen[0].Velden[0])
	if strings.Contains(strings.ToLower(string(uit)), "zoeksleutel") {
		t.Errorf("zoeksleutel hoort niet op het veld te staan: %s", uit)
	}
	// Zonder bijlage: niets, geen meldingen.
	if m := PasRegisterMarksToe(&V3Model{}); m != nil {
		t.Errorf("zonder marks: %v", m)
	}
}

func TestParseSchemaTag_Marks(t *testing.T) {
	tag := ParseSchemaTag("datatype:BSN,zoeksleutel,sorteerbaar")
	if tag.Datatype != "BSN" || !tag.Zoeksleutel || !tag.Sorteerbaar {
		t.Errorf("kreeg %+v", tag)
	}
	if tag := ParseSchemaTag("datatype:BSN,uniek=entiteit"); tag.Zoeksleutel || tag.Sorteerbaar {
		t.Errorf("zonder marks: %+v", tag)
	}
}
