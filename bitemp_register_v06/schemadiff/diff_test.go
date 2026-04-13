package schemadiff

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// ---- Testhelpers ----

// maakBasisModel maakt een minimaal V3Model met 1 entiteit, 1 GE en 1 relatie.
func maakBasisModel() model.V3Model {
	return model.V3Model{
		Versie: "v1.0.0",
		Naam:   "TestModel",
		Entiteiten: []model.V3Entiteit{
			{
				Typenaam:    "Persoon",
				Description: "Een persoon",
				Domein:      "kern",
				IsMaterieel: true,
				Meervoud:    "personen",
				Kleur:       "#00FF00",
				Gegevenselementen: []model.V3Gegevenselement{
					{
						Naam:            "Naam",
						Meervoud:        "persoon-namen",
						Momentvoorkomen: "enkelvoudig",
						IsMaterieel:     false,
						Velden: []model.V3Veld{
							{Naam: "achternaam", GoType: "string", Verplicht: true},
							{Naam: "voornaam", GoType: "string"},
						},
					},
				},
				Relaties: []model.V3Relatie{
					{
						Naam:            "Rel_Persoon_Adres",
						Meervoud:        "rel-persoon-adressen",
						Momentvoorkomen: "meervoudig",
						DoelEntiteit:    "Adres",
						IsMaterieel:     false,
					},
				},
			},
			{
				Typenaam:    "Adres",
				Description: "Een adres",
				Domein:      "kern",
				IsMaterieel: false,
				Meervoud:    "adressen",
				Gegevenselementen: []model.V3Gegevenselement{
					{
						Naam:            "Locatie",
						Meervoud:        "adres-locaties",
						Momentvoorkomen: "enkelvoudig",
						Velden: []model.V3Veld{
							{Naam: "straat", GoType: "string"},
							{Naam: "huisnummer", GoType: "int"},
						},
					},
				},
			},
		},
		Enums: []model.V3Enum{
			{
				GoType:   "Geslacht",
				BaseType: "string",
				Domein:   "kern",
				Waarden: []model.V3EnumWaarde{
					{ConstNaam: "GeslachtMan", Waarde: "Man"},
					{ConstNaam: "GeslachtVrouw", Waarde: "Vrouw"},
				},
			},
		},
		Datatypes: []model.V3Datatype{
			{
				Naam:      "BSN",
				Basistype: "string",
				Domein:    "kern",
			},
		},
	}
}

// ---- Tests ----

func TestIdentiekModel(t *testing.T) {
	m := maakBasisModel()
	rapport := Vergelijk(m, m)

	if len(rapport.Items) != 0 {
		t.Errorf("Verwachtte 0 delta-items bij identiek model, kreeg %d:", len(rapport.Items))
		for _, item := range rapport.Items {
			t.Logf("  [%s] %s: %s", item.Ernst, item.Pad, item.Omschrijving)
		}
	}
	if rapport.IsBreaking() {
		t.Error("Identiek model mag niet breaking zijn")
	}
	if rapport.HeeftDBMigratie() {
		t.Error("Identiek model mag geen DB-migratie vereisen")
	}
}

func TestEntiteitToegevoegd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten = append(nieuw.Entiteiten, model.V3Entiteit{
		Typenaam:    "Bedrijf",
		Description: "Een bedrijf",
		Domein:      "kern",
		IsMaterieel: false,
		Meervoud:    "bedrijven",
	})

	rapport := Vergelijk(oud, nieuw)

	additieven := rapport.Additief()
	if len(additieven) == 0 {
		t.Fatal("Verwachtte minstens 1 additief item voor nieuwe entiteit")
	}

	gevonden := false
	for _, item := range additieven {
		if item.Categorie == CategorieEntiteit && item.Pad == "Bedrijf" {
			gevonden = true
			if item.Actie != ActieToeGevoegd {
				t.Errorf("Verwachtte actie '%s', kreeg '%s'", ActieToeGevoegd, item.Actie)
			}
		}
	}
	if !gevonden {
		t.Error("Verwachtte additief item voor entiteit 'Bedrijf'")
	}
}

func TestEntiteitVerwijderd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten = nieuw.Entiteiten[:1] // verwijder Adres

	rapport := Vergelijk(oud, nieuw)

	destructieven := rapport.Destructief()
	if len(destructieven) == 0 {
		t.Fatal("Verwachtte minstens 1 destructief item voor verwijderde entiteit")
	}

	if !rapport.IsBreaking() {
		t.Error("Verwijderen van entiteit moet breaking zijn")
	}

	// Controleer dat ook de onderliggende GE's als verwijderd zijn gemarkeerd
	geVoorLocatie := false
	for _, item := range destructieven {
		if item.Categorie == CategorieGegevenselement && item.Pad == "Adres > Locatie" {
			geVoorLocatie = true
		}
	}
	if !geVoorLocatie {
		t.Error("Verwachtte destructief item voor GE 'Adres > Locatie' (onderdeel van verwijderde entiteit)")
	}
}

func TestGegevenselement_Toegevoegd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten[0].Gegevenselementen = append(
		nieuw.Entiteiten[0].Gegevenselementen,
		model.V3Gegevenselement{
			Naam:            "Contactgegevens",
			Meervoud:        "persoon-contactgegevens",
			Momentvoorkomen: "meervoudig",
			Velden: []model.V3Veld{
				{Naam: "email", GoType: "string"},
			},
		},
	)

	rapport := Vergelijk(oud, nieuw)

	additieven := rapport.Additief()
	gevonden := false
	for _, item := range additieven {
		if item.Categorie == CategorieGegevenselement && item.Pad == "Persoon > Contactgegevens" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte additief item voor GE 'Persoon > Contactgegevens'")
	}
}

func TestVeldToegevoegd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten[0].Gegevenselementen[0].Velden = append(
		nieuw.Entiteiten[0].Gegevenselementen[0].Velden,
		model.V3Veld{Naam: "tussenvoegsel", GoType: "string"},
	)

	rapport := Vergelijk(oud, nieuw)

	additieven := rapport.Additief()
	gevonden := false
	for _, item := range additieven {
		if item.Categorie == CategorieVeld && item.Kolomnaam == "tussenvoegsel" {
			gevonden = true
			if item.DBType != "TEXT" {
				t.Errorf("Verwachtte DBType 'TEXT' voor string-veld, kreeg '%s'", item.DBType)
			}
		}
	}
	if !gevonden {
		t.Error("Verwachtte additief item voor veld 'tussenvoegsel'")
	}
}

func TestVeldVerwijderd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	// Verwijder 'voornaam' (tweede veld)
	nieuw.Entiteiten[0].Gegevenselementen[0].Velden = nieuw.Entiteiten[0].Gegevenselementen[0].Velden[:1]

	rapport := Vergelijk(oud, nieuw)

	destructieven := rapport.Destructief()
	gevonden := false
	for _, item := range destructieven {
		if item.Categorie == CategorieVeld && item.Kolomnaam == "voornaam" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte destructief item voor verwijderd veld 'voornaam'")
	}
}

func TestVeldTypeGewijzigd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	// Wijzig huisnummer van int naar string
	nieuw.Entiteiten[1].Gegevenselementen[0].Velden[1].GoType = "string"

	rapport := Vergelijk(oud, nieuw)

	modificaties := rapport.Modificaties()
	gevonden := false
	for _, item := range modificaties {
		if item.Categorie == CategorieVeld && item.Kolomnaam == "huisnummer" {
			gevonden = true
			if item.OudeWaarde != "int" || item.NieuweWaarde != "string" {
				t.Errorf("Verwachtte oud='int', nieuw='string', kreeg oud='%s', nieuw='%s'",
					item.OudeWaarde, item.NieuweWaarde)
			}
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor type-wijziging van 'huisnummer'")
	}
}

func TestVeldVerplichtGemaakt(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	// Maak 'voornaam' verplicht (was optioneel)
	nieuw.Entiteiten[0].Gegevenselementen[0].Velden[1].Verplicht = true

	rapport := Vergelijk(oud, nieuw)

	modificaties := rapport.Modificaties()
	gevonden := false
	for _, item := range modificaties {
		if item.Categorie == CategorieVeld && item.Kolomnaam == "voornaam" &&
			item.NieuweWaarde == "verplicht=true" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor verplicht-wijziging van 'voornaam'")
	}
}

func TestEntiteitIsMaterieel_Gewijzigd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	// Adres wordt materieel
	nieuw.Entiteiten[1].IsMaterieel = true

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Items {
		if item.Categorie == CategorieEntiteit && item.Pad == "Adres" &&
			item.NieuweWaarde == "isMaterieel=true" {
			gevonden = true
			if item.Ernst != Modificatie {
				t.Errorf("Verwachtte ernst Modificatie, kreeg %s", item.Ernst)
			}
		}
	}
	if !gevonden {
		t.Error("Verwachtte wijziging voor isMaterieel van Adres")
	}
}

func TestDescriptionWijzigingIsInformatief(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten[0].Description = "Een gewijzigde beschrijving"

	rapport := Vergelijk(oud, nieuw)

	informatief := rapport.Informatief()
	gevonden := false
	for _, item := range informatief {
		if item.Categorie == CategorieEntiteit && item.Pad == "Persoon" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte informatief item voor description-wijziging")
	}
	if rapport.IsBreaking() {
		t.Error("Description-wijziging mag niet breaking zijn")
	}
}

func TestKleurWijzigingIsInformatief(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten[0].Kleur = "#FF0000"

	rapport := Vergelijk(oud, nieuw)

	informatief := rapport.Informatief()
	if len(informatief) != 1 {
		t.Errorf("Verwachtte 1 informatief item voor kleurwijziging, kreeg %d", len(informatief))
	}
}

func TestRelatieDoelEntiteitGewijzigd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten[0].Relaties[0].DoelEntiteit = "Bedrijf"

	rapport := Vergelijk(oud, nieuw)

	destructieven := rapport.Destructief()
	gevonden := false
	for _, item := range destructieven {
		if item.Categorie == CategorieRelatie &&
			item.OudeWaarde == "Adres" && item.NieuweWaarde == "Bedrijf" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte destructief item voor doelEntiteit-wijziging van relatie")
	}
}

func TestEnumToegevoegd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Enums = append(nieuw.Enums, model.V3Enum{
		GoType:   "Status",
		BaseType: "string",
		Waarden: []model.V3EnumWaarde{
			{ConstNaam: "StatusActief", Waarde: "Actief"},
		},
	})

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Informatief() {
		if item.Categorie == CategorieEnum && item.Pad == "Status" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte informatief item voor nieuwe enum 'Status'")
	}
}

func TestEnumVerwijderd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Enums = nil

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Modificaties() {
		if item.Categorie == CategorieEnum && item.Pad == "Geslacht" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor verwijderde enum 'Geslacht'")
	}
}

func TestEnumWaardeToegevoegd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Enums[0].Waarden = append(nieuw.Enums[0].Waarden,
		model.V3EnumWaarde{ConstNaam: "GeslachtOnbekend", Waarde: "Onbekend"},
	)

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Informatief() {
		if item.Pad == "Geslacht > GeslachtOnbekend" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte informatief item voor toegevoegde enum-waarde")
	}
}

func TestEnumWaardeVerwijderd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Enums[0].Waarden = nieuw.Enums[0].Waarden[:1] // verwijder "Vrouw"

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Modificaties() {
		if item.Pad == "Geslacht > GeslachtVrouw" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor verwijderde enum-waarde")
	}
}

func TestDatatypeToegevoegd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Datatypes = append(nieuw.Datatypes, model.V3Datatype{
		Naam:      "NLPostcode",
		Basistype: "string",
	})

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Informatief() {
		if item.Categorie == CategorieDatatype && item.Pad == "NLPostcode" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte informatief item voor nieuw datatype 'NLPostcode'")
	}
}

func TestDatatypeBasisTypeGewijzigd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Datatypes[0].Basistype = "integer"

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Modificaties() {
		if item.Categorie == CategorieDatatype && item.Pad == "BSN" {
			gevonden = true
			if item.OudeWaarde != "string" || item.NieuweWaarde != "integer" {
				t.Errorf("Verwachtte oud='string', nieuw='integer', kreeg oud='%s', nieuw='%s'",
					item.OudeWaarde, item.NieuweWaarde)
			}
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor basistypewijziging van 'BSN'")
	}
}

func TestDomeinFilter(t *testing.T) {
	basis := maakBasisModel()
	// Voeg entiteit in ander domein toe
	ander := maakBasisModel()
	ander.Entiteiten = append(ander.Entiteiten, model.V3Entiteit{
		Typenaam: "ExternDing",
		Domein:   "extern",
		Meervoud: "externe-dingen",
	})

	// Zonder filter: ExternDing is zichtbaar
	rapport := Vergelijk(basis, ander)
	gevonden := false
	for _, item := range rapport.Items {
		if item.Pad == "ExternDing" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Zonder domeinfilter verwachtte ik een item voor 'ExternDing'")
	}

	// Met domeinfilter "kern": ExternDing is niet zichtbaar
	rapport = Vergelijk(basis, ander, MetDomeinFilter("kern"))
	for _, item := range rapport.Items {
		if item.Pad == "ExternDing" {
			t.Error("Met domeinfilter 'kern' mag 'ExternDing' niet voorkomen")
		}
	}
}

// TestDomeinFilterLeegDomeinEntiteit test dat entiteiten zonder domein (Domein=="")
// meegenomen worden bij een domeinfilter, zodat oude schema-versies (van vóór
// domein-ondersteuning) niet onterecht als volledig nieuw verschijnen.
func TestDomeinFilterLeegDomeinEntiteit(t *testing.T) {
	// "Oud" model: entiteit zonder domein (legacy schema-versie)
	oud := model.V3Model{
		Versie: "v0.9",
		Naam:   "LegacyModel",
		Entiteiten: []model.V3Entiteit{
			{Typenaam: "Persoon", Domein: "", Meervoud: "personen"},
		},
	}
	// "Nieuw" model: dezelfde entiteit nu met domein "kern"
	nieuw := model.V3Model{
		Versie: "v1.0",
		Naam:   "NieuwModel",
		Entiteiten: []model.V3Entiteit{
			{Typenaam: "Persoon", Domein: "kern", Meervoud: "personen"},
		},
	}

	rapport := Vergelijk(oud, nieuw, MetDomeinFilter("kern"))

	// Persoon moet als gemodificeerd verschijnen (domein gewijzigd), niet als "toegevoegd"
	for _, item := range rapport.Items {
		if item.Pad == "Persoon" && item.Actie == "toegevoegd" {
			t.Error("Persoon met leeg domein in oud model mag niet als 'toegevoegd' verschijnen bij domeinfilter 'kern'")
		}
	}
}

func TestRapportSamenvatting(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	// Voeg een veld toe (additief) en wijzig een description (informatief)
	nieuw.Entiteiten[0].Description = "Gewijzigd"
	nieuw.Entiteiten[0].Gegevenselementen[0].Velden = append(
		nieuw.Entiteiten[0].Gegevenselementen[0].Velden,
		model.V3Veld{Naam: "initialen", GoType: "string"},
	)

	rapport := Vergelijk(oud, nieuw)
	samenvatting := rapport.Samenvatting()
	if samenvatting == "" {
		t.Error("Samenvatting mag niet leeg zijn")
	}
}

func TestRapportMetadata(t *testing.T) {
	oud := model.V3Model{Versie: "v1.0.0", Naam: "OudModel"}
	nieuw := model.V3Model{Versie: "v2.0.0", Naam: "NieuwModel"}

	rapport := Vergelijk(oud, nieuw, MetDomeinFilter("test"))

	if rapport.OudModelVersie != "v1.0.0" {
		t.Errorf("Verwachtte OudModelVersie 'v1.0.0', kreeg '%s'", rapport.OudModelVersie)
	}
	if rapport.NieuwModelVersie != "v2.0.0" {
		t.Errorf("Verwachtte NieuwModelVersie 'v2.0.0', kreeg '%s'", rapport.NieuwModelVersie)
	}
	if rapport.Domein != "test" {
		t.Errorf("Verwachtte Domein 'test', kreeg '%s'", rapport.Domein)
	}
	if rapport.Tijdstip.IsZero() {
		t.Error("Tijdstip mag niet nul zijn")
	}
}

func TestReferentielijstToegevoegd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.ReferentielijstInstanties = []model.V3ReferentielijstInstantie{
		{Systeemnaam: "Landenlijst", Naam: "Landen"},
	}

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Informatief() {
		if item.Categorie == CategorieReferentielijst && item.Pad == "Landenlijst" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte informatief item voor nieuwe referentielijst 'Landenlijst'")
	}
}

func TestRelatieVeldenVergeleken(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	// Voeg velden toe aan relatie
	oud.Entiteiten[0].Relaties[0].Velden = []model.V3Veld{
		{Naam: "soort", GoType: "string"},
	}
	nieuw.Entiteiten[0].Relaties[0].Velden = []model.V3Veld{
		{Naam: "soort", GoType: "int"}, // type gewijzigd
	}

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Modificaties() {
		if item.Categorie == CategorieVeld && item.Kolomnaam == "soort" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor type-wijziging van relatieveld 'soort'")
	}
}

func TestGeMomentvoorkomenGewijzigd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten[0].Gegevenselementen[0].Momentvoorkomen = "meervoudig"

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Modificaties() {
		if item.Categorie == CategorieGegevenselement &&
			item.OudeWaarde == "enkelvoudig" && item.NieuweWaarde == "meervoudig" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor momentvoorkomen-wijziging")
	}
}

// ---- Overerving (isAbstract + erft) ----

func TestIsAbstractGewijzigd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten[0].IsAbstract = true

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Modificaties() {
		if item.Categorie == CategorieEntiteit &&
			item.OudeWaarde == "isAbstract=false" && item.NieuweWaarde == "isAbstract=true" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor isAbstract false→true")
	}
}

func TestIsAbstractVerwijderd(t *testing.T) {
	oud := maakBasisModel()
	oud.Entiteiten[0].IsAbstract = true
	nieuw := maakBasisModel()

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Modificaties() {
		if item.Categorie == CategorieEntiteit &&
			item.OudeWaarde == "isAbstract=true" && item.NieuweWaarde == "isAbstract=false" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor isAbstract true→false")
	}
}

func TestErftToeGevoegd(t *testing.T) {
	oud := maakBasisModel()
	nieuw := maakBasisModel()
	nieuw.Entiteiten[1].Erft = "Persoon" // Adres erft nu van Persoon

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Modificaties() {
		if item.Categorie == CategorieEntiteit &&
			item.OudeWaarde == "erft=" && item.NieuweWaarde == "erft=Persoon" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte modificatie-item voor erft toegevoegd")
	}
}

func TestErftVerwijderd(t *testing.T) {
	oud := maakBasisModel()
	oud.Entiteiten[1].Erft = "Persoon"
	nieuw := maakBasisModel()

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Destructief() {
		if item.Categorie == CategorieEntiteit &&
			item.OudeWaarde == "erft=Persoon" && item.NieuweWaarde == "erft=" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte destructief-item voor erft verwijderd")
	}
}

func TestErftGewijzigd(t *testing.T) {
	oud := maakBasisModel()
	oud.Entiteiten[1].Erft = "Persoon"
	nieuw := maakBasisModel()
	nieuw.Entiteiten[1].Erft = "AndereEntiteit"

	rapport := Vergelijk(oud, nieuw)

	gevonden := false
	for _, item := range rapport.Destructief() {
		if item.Categorie == CategorieEntiteit &&
			item.OudeWaarde == "erft=Persoon" && item.NieuweWaarde == "erft=AndereEntiteit" {
			gevonden = true
		}
	}
	if !gevonden {
		t.Error("Verwachtte destructief-item voor erft gewijzigd van Persoon naar AndereEntiteit")
	}
}

func TestIsAbstractOngewijzigdGeenDelta(t *testing.T) {
	oud := maakBasisModel()
	oud.Entiteiten[0].IsAbstract = true
	nieuw := maakBasisModel()
	nieuw.Entiteiten[0].IsAbstract = true

	rapport := Vergelijk(oud, nieuw)

	for _, item := range rapport.Items {
		if item.Categorie == CategorieEntiteit && item.OudeWaarde == "isAbstract=true" {
			t.Error("Onverwacht delta-item voor ongewijzigde isAbstract")
		}
	}
}

func TestErftOngewijzigdGeenDelta(t *testing.T) {
	oud := maakBasisModel()
	oud.Entiteiten[1].Erft = "Persoon"
	nieuw := maakBasisModel()
	nieuw.Entiteiten[1].Erft = "Persoon"

	rapport := Vergelijk(oud, nieuw)

	for _, item := range rapport.Items {
		if item.Categorie == CategorieEntiteit && item.Pad == "Adres" &&
			(item.OudeWaarde == "erft=Persoon" || item.NieuweWaarde == "erft=Persoon") {
			t.Error("Onverwacht delta-item voor ongewijzigde erft")
		}
	}
}
