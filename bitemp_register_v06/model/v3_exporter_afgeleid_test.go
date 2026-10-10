package model

import (
	"reflect"
	"testing"
)

// Een afgeleide relatie (TypeMeta.AfgeleideRelaties) komt bij de export terug als
// V3Relatie{Afgeleid: true}, met regel en layout; anders verdwijnt ze via de rebuild.
func TestExportMetaRegistryToV3_AfgeleideRelatieRondreis(t *testing.T) {
	orig, ok := MetaRegistry["A"]
	if !ok {
		t.Skip("entiteit A niet in MetaRegistry")
	}
	t.Cleanup(func() { MetaRegistry["A"] = orig })

	metAfgeleid := orig
	metAfgeleid.AfgeleideRelaties = []AfgeleideRelatie{{
		Naam: "Afgeleid_B", Meervoud: "afgeleide-bs", Rolnaam: "AfgeleideBs", JSONRolnaam: "afgeleide-bs",
		DoelEntiteit: "B", Momentvoorkomen: Meervoudig, Directioneel: true, Geordend: true,
		NaamLabelHeen: "via", AfleidingsregelTaal: "cel", Afleidingsregel: "rel_a_bs",
		Layout: &EditorLayout{Positie: &V3Positie{X: 1, Y: 2}, DoelEdgeID: "e-doel"},
	}}
	MetaRegistry["A"] = metAfgeleid

	var gevonden *V3Relatie
	for _, ent := range ExportMetaRegistryToV3().Entiteiten {
		if ent.Typenaam != "A" {
			continue
		}
		for i := range ent.Relaties {
			if ent.Relaties[i].Naam == "Afgeleid_B" {
				gevonden = &ent.Relaties[i]
			}
		}
	}
	if gevonden == nil {
		t.Fatal("afgeleide relatie Afgeleid_B niet geëxporteerd")
	}
	want := V3Relatie{
		Naam: "Afgeleid_B", Meervoud: "afgeleide-bs", Momentvoorkomen: "meervoudig", DoelEntiteit: "B",
		Directioneel: true, Geordend: true, NaamLabelHeen: "via",
		Afgeleid: true, AfleidingsregelTaal: "cel", Afleidingsregel: "rel_a_bs",
		Positie: &V3Positie{X: 1, Y: 2}, DoelID: "e-doel",
	}
	if !reflect.DeepEqual(*gevonden, want) {
		t.Fatalf("geëxporteerd:\n%+v\nverwacht:\n%+v", *gevonden, want)
	}
}

func TestV3RelatieVanMeta_Geordend(t *testing.T) {
	rel := v3RelatieVanMeta(TypeMeta{Typenaam: "R", Geordend: true}, OnderliggendGegevenselement{})
	if !rel.Geordend {
		t.Fatal("Geordend gaat verloren bij de export van een relatie")
	}
}
