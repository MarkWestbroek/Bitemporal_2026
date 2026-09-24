package handlers

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Contactpersoon (Organisatie → Persoon) heeft zelf geen weergaveveld, Persoon wel: de
// relatie moet toch verrijkt worden (inhoud-tabel toonde "persoon_id 36 — PO").
func TestBepaalVerrijkingTargets_DoelentiteitMetWeergaveveldTelt(t *testing.T) {
	org, ok := model.MetaRegistry.GetTypeMeta("Organisatie")
	if !ok {
		t.Skip("CG-model niet aanwezig")
	}
	targets := bepaalVerrijkingTargets(org)
	for _, tg := range targets {
		if tg.jsonRolnaam == "contactpersonen" {
			if tg.doelMeta.Typenaam != "Persoon" || tg.fkJSONNaam != "persoon_id" {
				t.Fatalf("target = %+v", tg)
			}
			return
		}
	}
	t.Fatalf("contactpersonen ontbreekt in %v", targets)
}
