package model

import "testing"

// Het doeltype van een relatie komt expliciet uit DoelTypenaam; alleen oudere registries zonder
// dat veld vallen terug op de kolomnaam (ook doel_<x>_id van een zelf-relatie).
func TestDoelTypenaamVanRelatie(t *testing.T) {
	expliciet := TypeMeta{Typenaam: "Rel", SecondaireEntiteitIDKolom: "iets_anders_id", DoelTypenaam: "Gemeentedeel"}
	if got := DoelTypenaamVanRelatie(expliciet); got != "Gemeentedeel" {
		t.Fatalf("expliciet: %q", got)
	}
	if got := DoelTypenaamVanRelatie(TypeMeta{Typenaam: "GE"}); got != "" {
		t.Fatalf("geen relatie: %q", got)
	}
	if _, ok := MetaRegistry["Locatie"]; ok {
		if got := DoelTypenaamVanRelatie(TypeMeta{SecondaireEntiteitIDKolom: "locatie_id"}); got != "Locatie" {
			t.Fatalf("heuristiek locatie_id: %q", got)
		}
		if got := DoelTypenaamVanRelatie(TypeMeta{SecondaireEntiteitIDKolom: "doel_locatie_id"}); got != "Locatie" {
			t.Fatalf("heuristiek doel_locatie_id: %q", got)
		}
	}
	if got := DoelTypenaamVanRelatie(TypeMeta{SecondaireEntiteitIDKolom: "onbekend_id"}); got != "Onbekend" {
		t.Fatalf("fallback: %q", got)
	}
}
