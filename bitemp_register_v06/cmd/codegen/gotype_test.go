package main

import (
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Een extern V3-model (type/format/datatype, geen goType) krijgt een afgeleid goType; niet
// verplicht = pointer; een enum-veld krijgt het enum-type.
func TestGoTypeUitOAS(t *testing.T) {
	gevallen := []struct {
		veld model.V3Veld
		want string
	}{
		{model.V3Veld{Type: "string", Verplicht: true}, "string"},
		{model.V3Veld{Type: "string"}, "*string"},
		{model.V3Veld{Type: "string", Datatype: "KorteTekst"}, "*string"},
		{model.V3Veld{Type: "string", Format: "date", Verplicht: true}, "Date"},
		{model.V3Veld{Type: "string", Format: "date-time"}, "*time.Time"},
		{model.V3Veld{Type: "integer", Verplicht: true}, "int"},
		{model.V3Veld{Type: "number"}, "*float64"},
		{model.V3Veld{Type: "boolean", Verplicht: true}, "bool"},
		{model.V3Veld{Type: "string", Enum: "UitrolStatus", Verplicht: true}, "UitrolStatus"},
		{model.V3Veld{Enum: "UitrolStatus"}, "*UitrolStatus"},
		{model.V3Veld{}, "*string"},
	}
	for _, g := range gevallen {
		if got := goTypeUitOAS(g.veld); got != g.want {
			t.Errorf("%+v → %q, verwacht %q", g.veld, got, g.want)
		}
	}
}

func TestVulGoTypesAan_EnOnbekendDatatype(t *testing.T) {
	v3 := model.V3Model{Versie: "v3", Entiteiten: []model.V3Entiteit{{
		Typenaam: "Component", Meervoud: "componenten",
		Gegevenselementen: []model.V3Gegevenselement{{Naam: "Naam", Meervoud: "namen", Momentvoorkomen: "enkelvoudig",
			Velden: []model.V3Veld{
				{Naam: "naam", Type: "string", Datatype: "AN40", Verplicht: true}, // AN40 is een MIM-datatype in het register
				{Naam: "weergavenaam", Type: "string", Datatype: "KorteTekst"},
				{Naam: "vreemd", Type: "string", Datatype: "BestaatNietDatatype"},
				{Naam: "al_getypeerd", GoType: "int"},
			}}},
	}}}
	meldingen := vulGoTypesAan(&v3)
	velden := v3.Entiteiten[0].Gegevenselementen[0].Velden
	if velden[0].GoType != "string" || velden[1].GoType != "*string" || velden[3].GoType != "int" || len(meldingen) != 3 {
		t.Fatalf("goTypes: %+v (meldingen %v)", velden, meldingen)
	}
	errs := strings.Join(validateV3Model(v3, ""), "\n")
	if !strings.Contains(errs, "datatype 'BestaatNietDatatype' bestaat niet") {
		t.Fatalf("verwacht fout over BestaatNietDatatype, kreeg:\n%s", errs)
	}
	if strings.Contains(errs, "'AN40'") || strings.Contains(errs, "'KorteTekst'") { // de voorbeeldtekst in de melding noemt KorteTekst zonder quotes
		t.Fatalf("AN40 en KorteTekst bestaan in het register en horen geen fout te geven:\n%s", errs)
	}
}

func TestTypeGegevenstypeFouten(t *testing.T) {
	v3 := model.V3Model{Entiteiten: []model.V3Entiteit{
		{Typenaam: "Zaak", Domein: "zaken", Gegevenselementen: []model.V3Gegevenselement{{Naam: "ZaakGegevens", Velden: []model.V3Veld{
			{Naam: "volgnummer", Type: "string", Datatype: "Geheel"},               // fout: integer
			{Naam: "actief", Datatype: "JaNee"},                                    // fout: leeg type = string
			{Naam: "startdatum", Type: "string", Datatype: "Datum"},                // fout: format ontbreekt
			{Naam: "einddatum", Type: "string", Format: "date", Datatype: "Datum"}, // goed
			{Naam: "aantal", Type: "integer", Datatype: "Geheel"},                  // goed
			{Naam: "bsn", Type: "string", Datatype: "BSN"},                         // goed
			{Naam: "oud", GoType: "*string", Type: "string", Datatype: "Geheel"},   // goType gegeven: niet onze zaak
			{Naam: "soort", Type: "string", Enum: "Soort", Datatype: "Geheel"},     // enum bepaalt het type
			{Naam: "vreemd", Type: "string", Datatype: "BestaatNiet"},              // meldt validateV3Model
		}}}},
		{Typenaam: "Document", Domein: "documenten", Gegevenselementen: []model.V3Gegevenselement{{Naam: "G", Velden: []model.V3Veld{
			{Naam: "versie", Type: "string", Datatype: "Geheel"}, // ander domein
		}}}},
	}}
	fouten := typeGegevenstypeFouten(v3, "zaken")
	if len(fouten) != 3 {
		t.Fatalf("verwacht 3 fouten, kreeg %d: %v", len(fouten), fouten)
	}
	for i, deel := range []string{"ZaakGegevens.volgnummer", "ZaakGegevens.actief", "ZaakGegevens.startdatum"} {
		if !strings.Contains(fouten[i], deel) {
			t.Errorf("fout %d noemt %s niet: %s", i, deel, fouten[i])
		}
	}
	if alle := typeGegevenstypeFouten(v3, ""); len(alle) != 4 {
		t.Errorf("zonder domein verwacht 4 fouten, kreeg %d: %v", len(alle), alle)
	}
}
