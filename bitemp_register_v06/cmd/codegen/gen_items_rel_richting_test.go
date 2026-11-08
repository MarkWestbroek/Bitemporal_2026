package main

// gen_items_rel_richting_test.go — een items-relatie in de nieuwe richting (plan 2026-11-07
// Referentielijst-instanties, §1): ze staat op het referentielijst-item en wijst naar
// Referentielijst. Twee fouten die cg-test op 08-11-2026 zou raken:
//   A. de relatie heet zoals het item vroeger (Aanvraagtype naast AanvraagtypeDefinitie); met
//      tabelnaam = relatienaam hergebruikte de nieuwe relatietabel de tabel van de oude entiteit.
//      Nu: <item>_<relatie>.
//   B. codegen hing de relatie óók onder Referentielijst (VoegOnderliggendGEToe), daar koppelend
//      via <item>_id = referentielijst.id. Nu alleen in de oude richting.

import (
	"regexp"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func itemsRelModel(materieel bool) model.V3Model {
	return model.V3Model{
		Entiteiten: []model.V3Entiteit{
			{Typenaam: "AanvraagtypeDefinitie", Domein: "proef", EntiteitSubtype: "referentielijst_item", Meervoud: "aanvraagtype_definities",
				Gegevenselementen: []model.V3Gegevenselement{{Naam: "Omschrijving", Meervoud: "omschrijvingen", Momentvoorkomen: "enkelvoudig",
					Velden: []model.V3Veld{{Naam: "omschrijving", GoType: "string", Type: "string", Verplicht: true}}}},
				Relaties: []model.V3Relatie{{Naam: "Aanvraagtype", RelatieSubtype: "referentielijst_items", ReferentielijstInstantie: "Aanvraagtypen",
					Meervoud: "aanvraagtypen", Momentvoorkomen: "meervoudig", DoelEntiteit: "Referentielijst", IsMaterieel: materieel}}},
		},
		ReferentielijstInstanties: []model.V3ReferentielijstInstantie{{Systeemnaam: "Aanvraagtypen", Naam: "Aanvraagtypen"}},
	}
}

func TestItemsRelOpItem_EigenTabelEnNietOnderReferentielijst(t *testing.T) {
	v3 := itemsRelModel(true)
	reg, err := generateMetaRegistryAdditive(v3, codegenOptions{domein: "proef", prefix: "proef", additive: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, moet := range []string{
		`"aanvraagtypedefinitie_aanvraagtype",`,
		`"aanvraagtypedefinitie_aanvraagtype_data"`,
		`"aanvraagtypedefinitie_aanvraagtype_aanvang"`,
		`"aanvraagtypedefinitie_aanvraagtype_einde"`,
		`"referentielijst_id"`,
		`MetaRegistry["Aanvraagtype"]`, // de Go-typenaam blijft de relatienaam
	} {
		if !strings.Contains(reg, moet) {
			t.Errorf("metaregistry mist %s", moet)
		}
	}
	if regexp.MustCompile(`Tabelnaam:\s*"aanvraagtype(_data)?"`).MatchString(reg) {
		t.Errorf("relatietabel heet nog als de relatie (botst met de oude entiteit Aanvraagtype):\n%s", reg)
	}
	if strings.Contains(reg, "VoegOnderliggendGEToe") {
		t.Errorf("items-relatie op het item hoort niet onder Referentielijst:\n%s", reg)
	}

	structs, err := generateGeRel(v3)
	if err != nil {
		t.Fatal(err)
	}
	for _, moet := range []string{
		`bun:"table:aanvraagtypedefinitie_aanvraagtype,alias:aanvraagtypedefinitie_aanvraagtype"`,
		`bun:"table:aanvraagtypedefinitie_aanvraagtype_data,`,
		`bun:"table:aanvraagtypedefinitie_aanvraagtype_aanvang,`,
		`bun:"table:aanvraagtypedefinitie_aanvraagtype_einde,`,
		"type Aanvraagtype struct",
		// Een gegevenselement houdt zijn tabel.
		`bun:"table:aanvraagtypedefinitie_omschrijving,`,
		`bun:"table:aanvraagtypedefinitie_omschrijving_data,`,
	} {
		if !strings.Contains(structs, moet) {
			t.Errorf("structs missen %s", moet)
		}
	}
}

// De oude richting (relatie op Referentielijst, bv. LandenlijstLand) verandert niet: tabel =
// relatienaam, en als Referentielijst niet in de run zit de VoegOnderliggendGEToe.
func TestItemsRelOudeRichting_Ongewijzigd(t *testing.T) {
	v3 := model.V3Model{Entiteiten: []model.V3Entiteit{
		{Typenaam: "Referentielijst", Domein: "register", EntiteitSubtype: "referentielijst", Meervoud: "referentielijsten",
			Relaties: []model.V3Relatie{{Naam: "LandenlijstLand", RelatieSubtype: "referentielijst_items", ReferentielijstInstantie: "Landenlijst",
				Meervoud: "landenlijst_landen", Momentvoorkomen: "meervoudig", DoelEntiteit: "Land"}}},
		{Typenaam: "Land", Domein: "register", EntiteitSubtype: "referentielijst_item", Meervoud: "landen"},
	}}
	reg, err := generateMetaRegistryAdditive(v3, codegenOptions{domein: "register", prefix: "register", additive: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(reg, `"landenlijstland"`) || !strings.Contains(reg, `"landenlijstland_data"`) {
		t.Errorf("oude richting: tabel moet landenlijstland blijven:\n%s", reg)
	}
}
