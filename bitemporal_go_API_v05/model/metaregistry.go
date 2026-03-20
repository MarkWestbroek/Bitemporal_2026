package model

// MetaRegistry is the hardcoded meta model registry.
var MetaRegistry = MetaRegistryType{
	"A": {
		// UML
		Typenaam:    "A",
		Description: "Entiteit A met materiele tijdlijn en onderliggende representaties U, V, W en Rel_A_B.",
		Metatype:    MetatypeEntiteit,
		IsMaterieel: true,
		Kleur:       "#bfdbfe",
		// JSON veldnaam in REST requests
		Veldnaam:     "a",
		Padnaam:      "as",
		Factory:      func() Representatie { return &Full_A{} },
		SliceFactory: func() any { return &[]Full_A{} },
		// Database
		Tabelnaam:      "a",
		IDKolom:        "id",
		DBFactory:      func() Representatie { return &A_basis{} },
		DBSliceFactory: func() any { return &[]A_basis{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  false,
		RelatieveAutoincrement:    false,
		EntiteitIDKolom:           "",
		SecondaireEntiteitIDKolom: "",
		// Alleen voor entiteiten: de onderliggende gegevenselementen/relaties
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{Rolnaam: "Us", JSONRolnaam: "us", Doeltype: "A_U", Momentvoorkomen: Enkelvoudig},
			{Rolnaam: "Vs", JSONRolnaam: "vs", Doeltype: "A_V", Momentvoorkomen: Meervoudig},
			{Rolnaam: "Ws", JSONRolnaam: "ws", Doeltype: "A_W", Momentvoorkomen: Meervoudig},
			{Rolnaam: "RelABs", JSONRolnaam: "rel_abs", Doeltype: "Rel_A_B", Momentvoorkomen: Meervoudig},
		},
	},
	"B": {
		// UML
		Typenaam:    "B",
		Description: "Entiteit B met materiele tijdlijn en onderliggende representaties X en Y.",
		Metatype:    MetatypeEntiteit,
		IsMaterieel: true,
		Kleur:       "#fecaca",
		// JSON veldnaam in REST requests
		Veldnaam:     "b",
		Padnaam:      "bs",
		Factory:      func() Representatie { return &Full_B{} },
		SliceFactory: func() any { return &[]Full_B{} },
		// Database
		Tabelnaam:      "b",
		IDKolom:        "id",
		DBFactory:      func() Representatie { return &B_basis{} },
		DBSliceFactory: func() any { return &[]B_basis{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  false,
		RelatieveAutoincrement:    false,
		EntiteitIDKolom:           "",
		SecondaireEntiteitIDKolom: "",
		// Alleen voor entiteiten: de onderliggende gegevenselementen/relaties
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{Rolnaam: "Xs", JSONRolnaam: "xs", Doeltype: "B_X", Momentvoorkomen: Enkelvoudig},
			{Rolnaam: "Ys", JSONRolnaam: "ys", Doeltype: "B_Y", Momentvoorkomen: Enkelvoudig},
		},
	},
	"Rel_A_B": {
		// UML
		Typenaam:    "Rel_A_B",
		Description: "Relatie tussen A en B, meervoudig voorkomend per A en met relatieve relatie-id.",
		Metatype:    MetatypeRelatie,
		IsMaterieel: true,
		Kleur:       "#ede9fe",
		// JSON veldnaam in REST requests
		Veldnaam: "rel_a_b",
		Padnaam:  "rel_a_bs",
		Factory:  func() Representatie { return &Rel_A_B{} },
		// Database
		Tabelnaam:      "rel_a_b",
		IDKolom:        "rel_id",
		DBFactory:      func() Representatie { return &Rel_A_B{} },
		DBSliceFactory: func() any { return &[]Rel_A_B{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een (of twee bij relaties) entiteiten
		HeeftPFK:                  true,
		EntiteitIDKolom:           "a_id",
		RelatieveAutoincrement:    true,
		SecondaireEntiteitIDKolom: "b_id",
		Momentvoorkomen:           Meervoudig,
	},
	"A_U": {
		// UML
		Typenaam:    "A_U",
		Description: "Enkelvoudig gegevenselement van A met formele tijdlijn.",
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
		Kleur:       "#dbeafe",
		// JSON veldnaam in REST requests
		Veldnaam: "u",
		Padnaam:  "a_us",
		Factory:  func() Representatie { return &A_U{} },
		// Database
		Tabelnaam:      "a_u",
		IDKolom:        "rel_id",
		DBFactory:      func() Representatie { return &A_U{} },
		DBSliceFactory: func() any { return &[]A_U{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  true,
		RelatieveAutoincrement:    true,
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "",
		Momentvoorkomen:           Enkelvoudig,
	},
	"A_V": {
		// UML
		Typenaam:    "A_V",
		Description: "Meervoudig gegevenselement van A met onder andere een datumveld.",
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
		Kleur:       "#c7f9cc",
		// JSON veldnaam in REST requests
		Veldnaam: "v",
		Padnaam:  "a_vs",
		Factory:  func() Representatie { return &A_V{} },
		// Database
		Tabelnaam:      "a_v",
		IDKolom:        "rel_id",
		DBFactory:      func() Representatie { return &A_V{} },
		DBSliceFactory: func() any { return &[]A_V{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  true,
		RelatieveAutoincrement:    true,
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "",
		Momentvoorkomen:           Meervoudig,
	},
	"A_W": {
		// UML
		Typenaam:    "A_W",
		Description: "Meervoudig gegevenselement van A met numerieke waarden.",
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: true,
		Kleur:       "#bbf7d0",
		// JSON veldnaam in REST requests
		Veldnaam: "w",
		Padnaam:  "a_ws",
		Factory:  func() Representatie { return &A_W{} },
		// Database
		Tabelnaam:      "a_w",
		IDKolom:        "rel_id",
		DBFactory:      func() Representatie { return &A_W{} },
		DBSliceFactory: func() any { return &[]A_W{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  true,
		RelatieveAutoincrement:    true,
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "",
		Momentvoorkomen:           Meervoudig,
	},
	"B_X": {
		// UML
		Typenaam:    "B_X",
		Description: "Enkelvoudig gegevenselement van B met twee tekstvelden.",
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
		Kleur:       "#fdba74",
		// JSON veldnaam in REST requests
		Veldnaam: "x",
		Padnaam:  "b_xs",
		Factory:  func() Representatie { return &B_X{} },
		// Database
		Tabelnaam:      "b_x",
		IDKolom:        "rel_id",
		DBFactory:      func() Representatie { return &B_X{} },
		DBSliceFactory: func() any { return &[]B_X{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  true,
		RelatieveAutoincrement:    true,
		EntiteitIDKolom:           "b_id",
		SecondaireEntiteitIDKolom: "",
		Momentvoorkomen:           Enkelvoudig,
	},
	"B_Y": {
		// UML
		Typenaam:    "B_Y",
		Description: "Enkelvoudig gegevenselement van B met een tekstveld.",
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
		Kleur:       "#fde68a",
		// JSON veldnaam in REST requests
		Veldnaam: "y",
		Padnaam:  "b_ys",
		Factory:  func() Representatie { return &B_Y{} },
		// Database
		Tabelnaam:      "b_y",
		IDKolom:        "rel_id",
		DBFactory:      func() Representatie { return &B_Y{} },
		DBSliceFactory: func() any { return &[]B_Y{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  true,
		RelatieveAutoincrement:    true,
		EntiteitIDKolom:           "b_id",
		SecondaireEntiteitIDKolom: "",
		Momentvoorkomen:           Enkelvoudig,
	},
}
