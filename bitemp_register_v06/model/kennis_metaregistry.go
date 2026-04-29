package model

// Additieve MetaRegistry-entries — voegt types toe aan de bestaande MetaRegistry.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initKennisMetaRegistry() {
	MetaRegistry["Kennisartikel"] = TypeMeta{
		Typenaam:               "Kennisartikel",
		Klassenaam:             "Kennisartikel",
		Description:            "",
		Metatype:               MetatypeEntiteit,
		IsMaterieel:            false,
		Domein:                 "kennis",
		Kleur:                  "#bfdbfe",
		Layout:                 &EditorLayout{Positie: &V3Positie{X: 270, Y: 105}},
		Veldnaam:               "kennisartikel",
		Padnaam:                "kennisartikels",
		Meervoud:               "kennisartikels",
		Factory:                func() Representatie { return &Kennisartikel{} },
		SliceFactory:           func() any { return &[]Kennisartikel{} },
		Tabelnaam:              "kennisartikel",
		IDKolom:                "id",
		DBFactory:              func() Representatie { return &Kennisartikel{} },
		DBSliceFactory:         func() any { return &[]Kennisartikel{} },
		HeeftPFK:               false,
		RelatieveAutoincrement: false,
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{Rolnaam: "Kennissecties", JSONRolnaam: "kennissecties", Doeltype: "Kennisartikel_Kennissectie", Momentvoorkomen: Meervoudig},
		},
		AfgeleideVelden: []AfgeleidVeld{
			{
				Naam:                "titel",
				GoType:              "string",
				AfleidingsregelTaal: "cel",
			},
		},
	}
	MetaRegistry["Kennisartikel_Kennissectie"] = TypeMeta{
		Typenaam:               "Kennisartikel_Kennissectie",
		Klassenaam:             "Kennissectie",
		Description:            "",
		Metatype:               MetatypeGegevenselement,
		IsMaterieel:            false,
		Domein:                 "kennis",
		GESubtype:              GESubtypeHub,
		DataTypenaam:           "Kennisartikel_Kennissectie_Data",
		Kleur:                  "#bfdbfe",
		Veldnaam:               "kennissectie",
		Padnaam:                "kennissecties",
		Meervoud:               "kennissecties",
		Factory:                func() Representatie { return &Kennisartikel_Kennissectie_Input{} },
		Tabelnaam:              "kennisartikel_kennissectie",
		IDKolom:                "rel_id",
		DBFactory:              func() Representatie { return &Kennisartikel_Kennissectie{} },
		DBSliceFactory:         func() any { return &[]Kennisartikel_Kennissectie{} },
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        "kennisartikel_id",
		Momentvoorkomen:        Meervoudig,
		Layout: &EditorLayout{
			Positie:      &V3Positie{X: 285, Y: 330},
			EdgeID:       "edge_1777443681987_2",
			SourceHandle: "source-bottom",
			TargetHandle: "target-top",
		},
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{Rolnaam: "Data", JSONRolnaam: "data", Doeltype: "Kennisartikel_Kennissectie_Data", Momentvoorkomen: Enkelvoudig},
		},
	}
	MetaRegistry["Kennisartikel_Kennissectie_Data"] = TypeMeta{
		Typenaam:               "Kennisartikel_Kennissectie_Data",
		Klassenaam:             "Data",
		Description:            "Geversioned inhoud van Kennisartikel_Kennissectie.",
		Metatype:               MetatypeGegevenselement,
		GESubtype:              GESubtypeData,
		Kleur:                  "#bfdbfe",
		Veldnaam:               "kennisartikel_kennissectie_data",
		Padnaam:                "kennisartikel_kennissectie_data",
		Meervoud:               "kennisartikel_kennissectie_data",
		Factory:                func() Representatie { return &Kennisartikel_Kennissectie_Data{} },
		SliceFactory:           func() any { return &[]Kennisartikel_Kennissectie_Data{} },
		Tabelnaam:              "kennisartikel_kennissectie_data",
		IDKolom:                "versie",
		DBFactory:              func() Representatie { return &Kennisartikel_Kennissectie_Data{} },
		DBSliceFactory:         func() any { return &[]Kennisartikel_Kennissectie_Data{} },
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        "kennisartikel_id",
		Momentvoorkomen:        Enkelvoudig,
		BovenliggendTypenaam:   "Kennisartikel_Kennissectie",
	}
}
