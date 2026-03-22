package model

// MetaRegistry — de single source of truth voor alle type-metadata.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.


// MetaRegistry is the hardcoded meta model registry.
var MetaRegistry = MetaRegistryType{
	"Persoon": {
		Typenaam:    "Persoon",
		Description: "",
		Metatype:    MetatypeEntiteit,
		IsMaterieel: false,
		Kleur:       "",
		Veldnaam:    "persoon",
		Padnaam:     "personen",
		Factory:     func() Representatie { return &Persoon{} },
		SliceFactory: func() any { return &[]Persoon{} },
		Tabelnaam:      "persoon",
		IDKolom:        "id",
		DBFactory:      func() Representatie { return &Persoon{} },
		DBSliceFactory: func() any { return &[]Persoon{} },
		HeeftPFK:               false,
		RelatieveAutoincrement: false,
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{Rolnaam: "Naams", JSONRolnaam: "naams", Doeltype: "Persoon_Naam", Momentvoorkomen: Enkelvoudig},
		},
	},
	"Persoon_Naam": {
		Typenaam:     "Persoon_Naam",
		Description:  "",
		Metatype:     MetatypeGegevenselement,
		IsMaterieel:  false,
		GESubtype:    GESubtypeHub,
		DataTypenaam: "Persoon_Naam_Data",
		Kleur:        "",
		Veldnaam: "naam",
		Padnaam:  "persoon_naams",
		Factory:  func() Representatie { return &Persoon_Naam_Input{} },
		Tabelnaam:              "persoon_naam",
		IDKolom:               "rel_id",
		DBFactory:             func() Representatie { return &Persoon_Naam{} },
		DBSliceFactory:        func() any { return &[]Persoon_Naam{} },
		HeeftPFK:              true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:       "persoon_id",
		Momentvoorkomen:       Enkelvoudig,
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{Rolnaam: "Data", JSONRolnaam: "data", Doeltype: "Persoon_Naam_Data", Momentvoorkomen: Enkelvoudig},
		},
	},
	"Persoon_Naam_Data": {
		Typenaam:               "Persoon_Naam_Data",
		Description:            "Geversioned inhoud van Persoon_Naam.",
		Metatype:               MetatypeGegevenselement,
		GESubtype:              GESubtypeData,
		Kleur:                  "",
		Veldnaam:               "persoon_naam_data",
		Padnaam:                "persoon_naam_data",
		Factory:                func() Representatie { return &Persoon_Naam_Data{} },
		SliceFactory:           func() any { return &[]Persoon_Naam_Data{} },
		Tabelnaam:              "persoon_naam_data",
		IDKolom:                "versie",
		DBFactory:              func() Representatie { return &Persoon_Naam_Data{} },
		DBSliceFactory:         func() any { return &[]Persoon_Naam_Data{} },
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        "persoon_id",
		Momentvoorkomen:        Enkelvoudig,
		BovenliggendTypenaam:   "Persoon_Naam",
	},
}
