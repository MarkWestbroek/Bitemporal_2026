package model

import "testing"

// De exporter geeft de constantenaam uit EnumConstNamen terug; zonder registry-entry de
// standaardafleiding. Zo blijft een rebuild uit een export dezelfde constanten genereren als
// de handgeschreven code gebruikt (IdeBestandFormaatJSON, niet …json).
func TestEnumConstNaam_RegistryGaatVoorStandaard(t *testing.T) {
	const goType = "TestEnumConstNaamSoort"
	t.Cleanup(func() {
		delete(EnumConstNamen, goType)
		delete(EnumWaarden, goType)
	})
	EnumWaarden[goType] = []string{"json", "model_snapshot", "overig"}
	EnumConstNamen[goType] = map[string]string{"json": goType + "JSON", "model_snapshot": goType + "ModelSnapshot"}

	if got := EnumConstNaam(goType, "json"); got != goType+"JSON" {
		t.Fatalf("json → %q", got)
	}
	if got := EnumConstNaam(goType, "overig"); got != goType+"overig" {
		t.Fatalf("overig (niet in registry) → %q, verwacht standaardafleiding", got)
	}
	if got := StandaardEnumConstNaam(goType, "model_snapshot"); got != goType+"model_snapshot" {
		t.Fatalf("standaard → %q", got)
	}

	enum := buildV3Enum(goType)
	if enum == nil || len(enum.Waarden) != 3 {
		t.Fatalf("buildV3Enum: %+v", enum)
	}
	if enum.Waarden[1].ConstNaam != goType+"ModelSnapshot" || enum.Waarden[2].ConstNaam != goType+"overig" {
		t.Fatalf("export: %+v", enum.Waarden)
	}
}
