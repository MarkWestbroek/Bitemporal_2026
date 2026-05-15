package model

// gegevenstypen_metaregistry.go — MetaRegistry-entries voor het gegevenstypen-domein.
// Bevat één testentiteit (TestEntiteitGegevenstypen) met één Hub+_Data GE
// (TestEntiteitGegevenstypen_TestGEGegevenstypen) die alle string-gebaseerde
// valideerbare gegevenstypen uit de gegevenstypenregistry samenbrengt.
// Handmatig aangemaakt.

func initGegevenstypenMetaRegistry() {

	/* ================================================================
	   TestEntiteitGegevenstypen — Entiteit
	   ================================================================ */
	MetaRegistry["TestEntiteitGegevenstypen"] = TypeMeta{
		Typenaam:       "TestEntiteitGegevenstypen",
		Klassenaam:     "TestEntiteitGegevenstypen",
		Description:    "Testentiteit met één GE die alle valideerbare gegevenstypen bevat. Uitsluitend bedoeld voor validatie-integratietests.",
		Metatype:       MetatypeEntiteit,
		IsMaterieel:    false,
		Domein:         "gegevenstypen",
		Kleur:          "#fef9c3",
		Veldnaam:       "testentiteitgegevenstypen",
		Padnaam:        "testentiteiten_gegevenstypen",
		Meervoud:       "testentiteiten_gegevenstypen",
		Factory:        func() Representatie { return &TestEntiteitGegevenstypen{} },
		SliceFactory:   func() any { return &[]TestEntiteitGegevenstypen{} },
		Tabelnaam:      "testentiteitgegevenstypen",
		IDKolom:        "id",
		DBFactory:      func() Representatie { return &TestEntiteitGegevenstypen{} },
		DBSliceFactory: func() any { return &[]TestEntiteitGegevenstypen{} },
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{
				Rolnaam:         "TestGEs",
				JSONRolnaam:     "testgegegevenstypen",
				Doeltype:        "TestEntiteitGegevenstypen_TestGEGegevenstypen",
				Momentvoorkomen: Enkelvoudig,
			},
		},
	}

	/* ================================================================
	   TestEntiteitGegevenstypen_TestGEGegevenstypen — Hub
	   ================================================================ */
	MetaRegistry["TestEntiteitGegevenstypen_TestGEGegevenstypen"] = TypeMeta{
		Typenaam:               "TestEntiteitGegevenstypen_TestGEGegevenstypen",
		Klassenaam:             "TestGEGegevenstypen",
		Description:            "Hub GE met velden voor alle valideerbare gegevenstypen.",
		Metatype:               MetatypeGegevenselement,
		IsMaterieel:            false,
		Domein:                 "gegevenstypen",
		GESubtype:              GESubtypeHub,
		DataTypenaam:           "TestEntiteitGegevenstypen_TestGEGegevenstypen_Data",
		Kleur:                  "#fef9c3",
		Veldnaam:               "testgegegevenstypen",
		Padnaam:                "testge_gegevenstypen",
		Meervoud:               "testge_gegevenstypen",
		Factory:                func() Representatie { return &TestEntiteitGegevenstypen_TestGEGegevenstypen_Input{} },
		SliceFactory:           func() any { return &[]TestEntiteitGegevenstypen_TestGEGegevenstypen{} },
		Tabelnaam:              "testentiteitgegevenstypen_testgegegevenstypen",
		IDKolom:                "rel_id",
		DBFactory:              func() Representatie { return &TestEntiteitGegevenstypen_TestGEGegevenstypen{} },
		DBSliceFactory:         func() any { return &[]TestEntiteitGegevenstypen_TestGEGegevenstypen{} },
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        "testentiteitgegevenstypen_id",
		Momentvoorkomen:        Enkelvoudig,
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{Rolnaam: "Data", JSONRolnaam: "data", Doeltype: "TestEntiteitGegevenstypen_TestGEGegevenstypen_Data", Momentvoorkomen: Enkelvoudig},
		},
	}

	/* ================================================================
	   TestEntiteitGegevenstypen_TestGEGegevenstypen_Data
	   ================================================================ */
	MetaRegistry["TestEntiteitGegevenstypen_TestGEGegevenstypen_Data"] = TypeMeta{
		Typenaam:               "TestEntiteitGegevenstypen_TestGEGegevenstypen_Data",
		Klassenaam:             "Data",
		Description:            "Geversioned inhoud van TestEntiteitGegevenstypen_TestGEGegevenstypen met alle valideerbare velden.",
		Metatype:               MetatypeGegevenselement,
		GESubtype:              GESubtypeData,
		Kleur:                  "#fef9c3",
		Veldnaam:               "testgegegevenstypen_data",
		Padnaam:                "testgegegevenstypen_data",
		Meervoud:               "testgegegevenstypen_data",
		Factory:                func() Representatie { return &TestEntiteitGegevenstypen_TestGEGegevenstypen_Data{} },
		SliceFactory:           func() any { return &[]TestEntiteitGegevenstypen_TestGEGegevenstypen_Data{} },
		Tabelnaam:              "testentiteitgegevenstypen_testgegegevenstypen_data",
		IDKolom:                "versie",
		DBFactory:              func() Representatie { return &TestEntiteitGegevenstypen_TestGEGegevenstypen_Data{} },
		DBSliceFactory:         func() any { return &[]TestEntiteitGegevenstypen_TestGEGegevenstypen_Data{} },
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        "testentiteitgegevenstypen_id",
		Momentvoorkomen:        Enkelvoudig,
		BovenliggendTypenaam:   "TestEntiteitGegevenstypen_TestGEGegevenstypen",
	}
}
