package model

import "testing"

// De V3-export geeft de uuid uit TypeMeta, EnumUUIDs en ReferentielijstInstantieRegistry terug
// (31-10-2026, BACKLOG §40). De registers zijn gegenereerd zonder uuid's; de test zet ze tijdelijk.
func TestExportMetaRegistryToV3_UUIDRondreis(t *testing.T) {
	oudA, ok := MetaRegistry["A"]
	if !ok {
		t.Skip("testregister zonder entiteit A")
	}
	metUUID := oudA
	metUUID.UUID = "a1000000-0000-4000-8000-000000000001"
	MetaRegistry["A"] = metUUID
	EnumUUIDs["Naamgebruiksoort"] = "e1000000-0000-4000-8000-000000000001"
	t.Cleanup(func() {
		MetaRegistry["A"] = oudA
		delete(EnumUUIDs, "Naamgebruiksoort")
	})

	v3 := ExportMetaRegistryToV3()
	gevonden := false
	for _, ent := range v3.Entiteiten {
		if ent.Typenaam == "A" {
			gevonden = true
			if ent.UUID != metUUID.UUID {
				t.Errorf("entiteit A: uuid %q, verwacht %q", ent.UUID, metUUID.UUID)
			}
		} else if ent.UUID != "" && ent.Typenaam != "A" {
			// andere entiteiten hebben in het testregister geen uuid
			t.Errorf("entiteit %s kreeg onverwacht uuid %q", ent.Typenaam, ent.UUID)
		}
	}
	if !gevonden {
		t.Fatal("entiteit A niet in de export")
	}

	enumGevonden := false
	for _, e := range ExportMetaRegistryToV3("np-loc").Enums {
		if e.GoType == "Naamgebruiksoort" {
			enumGevonden = true
			if e.UUID != "e1000000-0000-4000-8000-000000000001" {
				t.Errorf("enum Naamgebruiksoort: uuid %q", e.UUID)
			}
		}
	}
	if !enumGevonden {
		t.Error("enum Naamgebruiksoort niet in de np-loc-export")
	}
}
