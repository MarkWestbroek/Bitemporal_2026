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

	t.Run("finds parent for A_W", func(t *testing.T) {
		// Given: childtype A_W.
		// When: parent-relatie metadata wordt opgevraagd.
		// Then: parent is A en momentvoorkomen is Meervoudig.
		relMeta, ok := MetaRegistry.GetBovenliggendeRelatieMeta("A_W")
		if !ok {
			t.Fatal("expected parent relation metadata for A_W")
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

func TestGetBovenliggendeEntiteitMeta_ViaHubChild(t *testing.T) {
	entMeta, ok := MetaRegistry.GetBovenliggendeEntiteitMeta("Locatie_BAGlocatie_Data")
	if !ok {
		t.Fatalf("expected root entity for hub child data type")
	}
	if entMeta.Typenaam != "Locatie" {
		t.Fatalf("expected Locatie, got %s", entMeta.Typenaam)
	}
}

func TestGetByVeldnaamMetPayload_PadnaamFallback(t *testing.T) {
	// GetByVeldnaamMetPayload moet ook Padnaam (meervoud) accepteren als fallback,
	// zodat flat-format payloads zowel "naam" als "namen" kunnen gebruiken.
	t.Run("veldnaam enkelvoud werkt", func(t *testing.T) {
		meta, ok := MetaRegistry.GetByVeldnaamMetPayload("naam", map[string]struct{}{"natuurlijkpersoon_id": {}})
		if !ok {
			t.Fatal("expected match for veldnaam 'naam'")
		}
		if meta.Typenaam != "NatuurlijkPersoon_Naam" {
			t.Fatalf("expected NatuurlijkPersoon_Naam, got %s", meta.Typenaam)
		}
	})

	t.Run("padnaam meervoud werkt als fallback", func(t *testing.T) {
		meta, ok := MetaRegistry.GetByVeldnaamMetPayload("namen", map[string]struct{}{"natuurlijkpersoon_id": {}})
		if !ok {
			t.Fatal("expected match for padnaam 'namen'")
		}
		if meta.Typenaam != "NatuurlijkPersoon_Naam" {
			t.Fatalf("expected NatuurlijkPersoon_Naam, got %s", meta.Typenaam)
		}
	})

	t.Run("persoonsidentificaties (padnaam) werkt als fallback", func(t *testing.T) {
		meta, ok := MetaRegistry.GetByVeldnaamMetPayload("persoonsidentificaties", map[string]struct{}{"natuurlijkpersoon_id": {}})
		if !ok {
			t.Fatal("expected match for padnaam 'persoonsidentificaties'")
		}
		if meta.Typenaam != "NatuurlijkPersoon_Persoonsidentificatie" {
			t.Fatalf("expected NatuurlijkPersoon_Persoonsidentificatie, got %s", meta.Typenaam)
		}
	})

	t.Run("onbekend type geeft false terug", func(t *testing.T) {
		_, ok := MetaRegistry.GetByVeldnaamMetPayload("bestaantniet", map[string]struct{}{})
		if ok {
			t.Fatal("expected no match for unknown key")
		}
	})
}
