package model

import (
	"testing"
)

// TestExportMetaRegistryToV3_RuntimeVelden controleert dat V3.1 runtime-velden
// correct worden gevuld vanuit de MetaRegistry.
func TestExportMetaRegistryToV3_RuntimeVelden(t *testing.T) {
	v3 := ExportMetaRegistryToV3()

	if len(v3.Entiteiten) == 0 {
		t.Fatal("geen entiteiten in V3 export")
	}

	// Zoek entiteit A
	var entA *V3Entiteit
	for i := range v3.Entiteiten {
		if v3.Entiteiten[i].Typenaam == "A" {
			entA = &v3.Entiteiten[i]
			break
		}
	}
	if entA == nil {
		t.Fatal("entiteit A niet gevonden in V3 export")
	}

	// Entiteit A moet runtime hebben
	if entA.Runtime == nil {
		t.Fatal("entiteit A heeft geen runtime")
	}
	if entA.Runtime.Padnaam == "" {
		t.Error("entiteit A runtime.padnaam is leeg")
	}
	if entA.Runtime.Tabelnaam == "" {
		t.Error("entiteit A runtime.tabelnaam is leeg")
	}
	if entA.Runtime.IDKolom == "" {
		t.Error("entiteit A runtime.idKolom is leeg")
	}

	// Zoek GE "U" onder A
	var geU *V3Gegevenselement
	for i := range entA.Gegevenselementen {
		if entA.Gegevenselementen[i].Naam == "U" {
			geU = &entA.Gegevenselementen[i]
			break
		}
	}
	if geU == nil {
		t.Fatal("gegevenselement U niet gevonden onder entiteit A")
	}

	// GE U moet runtime hebben
	if geU.Runtime == nil {
		t.Fatal("GE U heeft geen runtime")
	}
	if geU.Runtime.Padnaam == "" {
		t.Error("GE U runtime.padnaam is leeg")
	}
	if geU.Runtime.Tabelnaam == "" {
		t.Error("GE U runtime.tabelnaam is leeg")
	}
	if geU.Runtime.HeeftPFK != true {
		t.Error("GE U runtime.heeftPFK zou true moeten zijn")
	}
	if geU.Runtime.EntiteitIDKolom == "" {
		t.Error("GE U runtime.entiteitIDKolom is leeg")
	}
}

// TestExportMetaRegistryToV3_VeldTypeFormat controleert dat V3.1 OAS type/format
// correct wordt gevuld op inhoudsvelden.
func TestExportMetaRegistryToV3_VeldTypeFormat(t *testing.T) {
	v3 := ExportMetaRegistryToV3()

	// Zoek entiteit A, GE U
	var entA *V3Entiteit
	for i := range v3.Entiteiten {
		if v3.Entiteiten[i].Typenaam == "A" {
			entA = &v3.Entiteiten[i]
			break
		}
	}
	if entA == nil {
		t.Fatal("entiteit A niet gevonden")
	}

	var geU *V3Gegevenselement
	for i := range entA.Gegevenselementen {
		if entA.Gegevenselementen[i].Naam == "U" {
			geU = &entA.Gegevenselementen[i]
			break
		}
	}
	if geU == nil {
		t.Fatal("GE U niet gevonden")
	}

	if len(geU.Velden) == 0 {
		t.Fatal("GE U heeft geen velden")
	}

	// Elk veld moet een OAS type hebben
	for _, v := range geU.Velden {
		if v.Type == "" {
			t.Errorf("veld %q heeft geen OAS type", v.Naam)
		}
	}
}

// TestExportMetaRegistryToV3_RelatieRuntime controleert runtime op relaties.
func TestExportMetaRegistryToV3_RelatieRuntime(t *testing.T) {
	v3 := ExportMetaRegistryToV3()

	var entA *V3Entiteit
	for i := range v3.Entiteiten {
		if v3.Entiteiten[i].Typenaam == "A" {
			entA = &v3.Entiteiten[i]
			break
		}
	}
	if entA == nil {
		t.Fatal("entiteit A niet gevonden")
	}

	if len(entA.Relaties) == 0 {
		t.Skip("entiteit A heeft geen relaties")
	}

	for _, rel := range entA.Relaties {
		if rel.Runtime == nil {
			t.Errorf("relatie %q heeft geen runtime", rel.Naam)
			continue
		}
		if rel.Runtime.Padnaam == "" {
			t.Errorf("relatie %q runtime.padnaam is leeg", rel.Naam)
		}
		if rel.Runtime.Tabelnaam == "" {
			t.Errorf("relatie %q runtime.tabelnaam is leeg", rel.Naam)
		}
	}
}
