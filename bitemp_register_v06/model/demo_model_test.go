package model

import (
	"reflect"
	"strings"
	"testing"
)

// Regressietest voor het demo-model np-loc-org+geo (FTV-demo Toegangsspraak,
// 15 september 2026; zie docs/plans/2026-09-10 Opdracht demo-model
// np-loc-org-geo en OAS-naar-canoniek.md).
//
// De toegang-activity leest het model via /api/schema/model/code en bouwt daar
// veldpaden van de vorm "Entiteit.rol.veld" uit. De beleidstekst van de demo
// hangt op die rollen en veldnamen; wijzigen ze, dan resolven de ketens niet
// meer. Deze test bewaakt de Go-kant, de JS-kant staat in
// web/vite/src/studio/activities/toegangDemoModel.test.js.

// jsonRolnaamVoor zoekt de JSON-rolnaam waarmee doeltype onder typenaam hangt.
func jsonRolnaamVoor(t *testing.T, typenaam, doeltype string) string {
	t.Helper()
	meta, ok := MetaRegistry.GetTypeMeta(typenaam)
	if !ok {
		t.Fatalf("type %q ontbreekt in de MetaRegistry", typenaam)
	}
	for _, kind := range meta.OnderliggendeGegevenselementen {
		if kind.Doeltype == doeltype {
			return kind.JSONRolnaam
		}
	}
	t.Fatalf("%q heeft geen onderliggend %q", typenaam, doeltype)
	return ""
}

// heeftJSONVeld controleert of het (data-)type een veld met deze JSON-naam heeft.
func heeftJSONVeld(t *testing.T, typenaam, jsonNaam string) bool {
	t.Helper()
	meta, ok := MetaRegistry.GetTypeMeta(typenaam)
	if !ok {
		t.Fatalf("type %q ontbreekt in de MetaRegistry", typenaam)
	}
	if meta.Factory == nil {
		t.Fatalf("type %q heeft geen Factory", typenaam)
	}
	rt := reflect.TypeOf(meta.Factory())
	for rt.Kind() == reflect.Ptr {
		rt = rt.Elem()
	}
	for i := 0; i < rt.NumField(); i++ {
		naam := strings.Split(rt.Field(i).Tag.Get("json"), ",")[0]
		if naam == jsonNaam {
			return true
		}
	}
	return false
}

func TestDemoModelNpLocOrgGeo_RollenEnVelden(t *testing.T) {
	// De rolnamen die de demo-beleidstekst gebruikt. Let op het enkelvoud:
	// "de aanspreektitel van de aanspraak van …" resolvet alleen als de rol
	// "aanspraak" heet, niet "aanspraken".
	rollen := []struct{ entiteit, doeltype, rol string }{
		{"NatuurlijkPersoon", "NatuurlijkPersoon_Geslacht", "geslacht"},
		{"NatuurlijkPersoon", "NatuurlijkPersoon_Aanspraak", "aanspraak"},
		{"NatuurlijkPersoon", "Woonlocatie", "woonlocatie"},
		{"Locatie", "Gebiedsligging", "gebiedsligging"},
		{"Gemeentedeel", "Gemeentedeel_Wijkaanduiding", "wijkaanduiding"},
		{"Medewerker", "Medewerker_Aanstelling", "aanstelling"},
		{"Medewerker", "Medewerker_Contactkanaal", "kanalen"},
		{"Medewerker", "Medewerkerafdeling", "afdeling"},
		{"Afdeling", "Afdeling_Afdelingsnaam", "afdelingsnaam"},
		{"Afdeling", "Afdelingsorganisatie", "organisatie"},
		{"Gemeentedeel", "Gemeentedeelgemeente", "gemeente"},
	}
	for _, r := range rollen {
		if got := jsonRolnaamVoor(t, r.entiteit, r.doeltype); got != r.rol {
			t.Errorf("%s → %s: rol = %q, verwacht %q", r.entiteit, r.doeltype, got, r.rol)
		}
	}

	// De velden waar de beleidstekst op toetst, met hun JSON-naam.
	velden := []struct{ datatype, veld string }{
		{"NatuurlijkPersoon_Geslacht_Data", "geslacht"},
		{"NatuurlijkPersoon_Aanspraak_Data", "aanspreektitel"},
		{"NatuurlijkPersoon_Aanspraak_Data", "formeelAanspreken"},
		{"Gemeentedeel_Wijkaanduiding_Data", "wijk"},
		{"Medewerker_Aanstelling_Data", "rol"},
		{"Medewerker_Contactkanaal_Data", "kanaal"},
		{"Afdeling_Afdelingsnaam_Data", "naam"},
	}
	for _, v := range velden {
		if !heeftJSONVeld(t, v.datatype, v.veld) {
			t.Errorf("%s mist JSON-veld %q", v.datatype, v.veld)
		}
	}
}

func TestDemoModelNpLocOrgGeo_RelatiesWijzenNaarDeJuisteEntiteit(t *testing.T) {
	// De relaties overbruggen de registers: np-loc → org-geo → CG.
	verwacht := map[string]string{
		"Woonlocatie":          "locatie_id",
		"Gebiedsligging":       "gemeentedeel_id",
		"Medewerkerafdeling":   "afdeling_id",
		"Afdelingsorganisatie": "organisatie_id",
		"Gemeentedeelgemeente": "gemeente_id",
	}
	for typenaam, kolom := range verwacht {
		meta, ok := MetaRegistry.GetTypeMeta(typenaam)
		if !ok {
			t.Errorf("relatie %q ontbreekt in de MetaRegistry", typenaam)
			continue
		}
		if meta.Metatype != MetatypeRelatie {
			t.Errorf("%s: metatype = %q, verwacht relatie", typenaam, meta.Metatype)
		}
		if meta.SecondaireEntiteitIDKolom != kolom {
			t.Errorf("%s: secondaire ID-kolom = %q, verwacht %q", typenaam, meta.SecondaireEntiteitIDKolom, kolom)
		}
	}
}

func TestDemoModelNpLocOrgGeo_Enums(t *testing.T) {
	verwacht := map[string][]string{
		"Geslachtsaanduiding": {"man", "vrouw", "X"},
		"Aanspreektitel":      {"meneer", "mevrouw", "hen"},
		"Gemeentedeelsoort":   {"Stadsdeel", "Wijk", "Buurt"},
		"Medewerkerrol":       {"medewerker", "behandelaar", "leidinggevende"},
		"Kanaalsoort":         {"balie", "telefoon", "email", "post"},
	}
	for naam, waarden := range verwacht {
		got, ok := EnumWaarden[naam]
		if !ok {
			t.Errorf("enum %q ontbreekt in EnumWaarden", naam)
			continue
		}
		if strings.Join(got, ",") != strings.Join(waarden, ",") {
			t.Errorf("enum %s = %v, verwacht %v", naam, got, waarden)
		}
	}
}
