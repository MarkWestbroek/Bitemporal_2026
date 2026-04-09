package model

import (
	"encoding/json"
	"testing"
)

// TestVeldnaamDisambiguatie controleert dat dubbele veldnamen zoals "naam" en
// "contactgegevens" deterministisch worden opgelost op basis van de payload.
// Dit is een regressietest voor de bug waarbij Go-map-iteratie soms het
// verkeerde TypeMeta retourneerde.

func TestGetByVeldnaamMetPayload_Naam(t *testing.T) {
	t.Run("apistandaard_id selecteert ApiStandaard_Naam", func(t *testing.T) {
		keys := map[string]struct{}{"apistandaard_id": {}, "naam": {}}
		meta, ok := MetaRegistry.GetByVeldnaamMetPayload("naam", keys)
		if !ok {
			t.Fatal("expected match for veldnaam 'naam'")
		}
		if meta.Typenaam != "ApiStandaard_Naam" {
			t.Fatalf("expected ApiStandaard_Naam, got %s", meta.Typenaam)
		}
	})

	t.Run("natuurlijkpersoon_id selecteert NatuurlijkPersoon_Naam", func(t *testing.T) {
		keys := map[string]struct{}{"natuurlijkpersoon_id": {}, "voorletters": {}}
		meta, ok := MetaRegistry.GetByVeldnaamMetPayload("naam", keys)
		if !ok {
			t.Fatal("expected match for veldnaam 'naam'")
		}
		if meta.Typenaam != "NatuurlijkPersoon_Naam" {
			t.Fatalf("expected NatuurlijkPersoon_Naam, got %s", meta.Typenaam)
		}
	})
}

func TestGetByVeldnaamMetPayload_Contactgegevens(t *testing.T) {
	t.Run("organisatie_id selecteert Organisatie_Contactgegevens", func(t *testing.T) {
		keys := map[string]struct{}{"organisatie_id": {}, "url": {}}
		meta, ok := MetaRegistry.GetByVeldnaamMetPayload("contactgegevens", keys)
		if !ok {
			t.Fatal("expected match for veldnaam 'contactgegevens'")
		}
		if meta.Typenaam != "Organisatie_Contactgegevens" {
			t.Fatalf("expected Organisatie_Contactgegevens, got %s", meta.Typenaam)
		}
	})

	t.Run("persoon_id selecteert Persoon_Contactgegevens", func(t *testing.T) {
		keys := map[string]struct{}{"persoon_id": {}, "email": {}}
		meta, ok := MetaRegistry.GetByVeldnaamMetPayload("contactgegevens", keys)
		if !ok {
			t.Fatal("expected match for veldnaam 'contactgegevens'")
		}
		if meta.Typenaam != "Persoon_Contactgegevens" {
			t.Fatalf("expected Persoon_Contactgegevens, got %s", meta.Typenaam)
		}
	})
}

// TestUnmarshalJSON_NaamDisambiguatie test dat de UnmarshalJSON van
// RepresentatiePlusNaam de juiste TypeMeta kiest bij dubbele veldnamen.
// Dit is de end-to-end regressietest die breekt als de fix wordt teruggedraaid.
func TestUnmarshalJSON_NaamDisambiguatie(t *testing.T) {
	t.Run("naam met apistandaard_id wordt ApiStandaard_Naam_Data", func(t *testing.T) {
		input := `{"naam": {"apistandaard_id": 5, "naam": "ZGW API"}}`
		var rep RepresentatiePlusNaam
		if err := json.Unmarshal([]byte(input), &rep); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}
		if rep.Representatienaam != "ApiStandaard_Naam" {
			t.Fatalf("expected ApiStandaard_Naam, got %s", rep.Representatienaam)
		}
	})

	// Run this 20 times to catch non-deterministic map iteration.
	t.Run("deterministic over 20 iterations", func(t *testing.T) {
		input := `{"naam": {"apistandaard_id": 3, "naam": "Test standaard"}}`
		for i := 0; i < 20; i++ {
			var rep RepresentatiePlusNaam
			if err := json.Unmarshal([]byte(input), &rep); err != nil {
				t.Fatalf("iteration %d: unmarshal error: %v", i, err)
			}
			if rep.Representatienaam != "ApiStandaard_Naam" {
				t.Fatalf("iteration %d: expected ApiStandaard_Naam, got %s", i, rep.Representatienaam)
			}
		}
	})
}
