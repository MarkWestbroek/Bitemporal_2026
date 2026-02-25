package model

import "testing"

func TestGetBovenliggendeRelatieMeta(t *testing.T) {
	t.Run("finds parent for A_U", func(t *testing.T) {
		// Given: childtype A_U.
		// When: parent-relatie metadata wordt opgevraagd.
		// Then: parent is A en momentvoorkomen is Enkelvoudig.
		relMeta, ok := MetaRegistry.GetBovenliggendeRelatieMeta("A_U")
		if !ok {
			t.Fatal("expected parent relation metadata for A_U")
		}
		if relMeta.ParentType.Typenaam != "A" {
			t.Fatalf("expected parent type A, got %s", relMeta.ParentType.Typenaam)
		}
		if relMeta.Relatie.Momentvoorkomen != Enkelvoudig {
			t.Fatalf("expected Enkelvoudig, got %v", relMeta.Relatie.Momentvoorkomen)
		}
	})

	t.Run("finds parent for A_V", func(t *testing.T) {
		// Given: childtype A_V.
		// When: parent-relatie metadata wordt opgevraagd.
		// Then: parent is A en momentvoorkomen is Meervoudig.
		relMeta, ok := MetaRegistry.GetBovenliggendeRelatieMeta("A_V")
		if !ok {
			t.Fatal("expected parent relation metadata for A_V")
		}
		if relMeta.ParentType.Typenaam != "A" {
			t.Fatalf("expected parent type A, got %s", relMeta.ParentType.Typenaam)
		}
		if relMeta.Relatie.Momentvoorkomen != Meervoudig {
			t.Fatalf("expected Meervoudig, got %v", relMeta.Relatie.Momentvoorkomen)
		}
	})

	t.Run("returns false for unknown child type", func(t *testing.T) {
		// Given: een onbekend childtype.
		// When: parent-relatie metadata wordt opgevraagd.
		// Then: er wordt geen match gevonden (ok == false).
		_, ok := MetaRegistry.GetBovenliggendeRelatieMeta("UNKNOWN_TYPE")
		if ok {
			t.Fatal("expected no parent relation metadata for unknown type")
		}
	})
}
