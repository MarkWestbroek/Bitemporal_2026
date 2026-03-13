package model

// MetaRegistry is the hardcoded meta model registry.
var MetaRegistry = MetaRegistryType{
	"A": {
		// UML
		Typenaam:    "A",
		Metatype:    MetatypeEntiteit,
		IsMaterieel: true,
		Kleur:       "#bfdbfe",
		// JSON veldnaam in REST requests
		Veldnaam: "a",
		Factory:  func() Representatie { return &Full_A{} },
		// Database
		Tabelnaam: "a",
		IDKolom:   "id",
		DBFactory: func() Representatie { return &A_basis{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  false,
		RelatieveAutoincrement:    true,
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
		Metatype:    MetatypeEntiteit,
		IsMaterieel: true,
		Kleur:       "#fecaca",
		// JSON veldnaam in REST requests
		Veldnaam: "b",
		Factory:  func() Representatie { return &Full_B{} },
		// Database
		Tabelnaam: "b",
		IDKolom:   "id",
		DBFactory: func() Representatie { return &B_basis{} },
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
		Metatype:    MetatypeRelatie,
		IsMaterieel: true,
		Kleur:       "#ede9fe",
		// JSON veldnaam in REST requests
		Veldnaam: "rel_a_b",
		Factory:  func() Representatie { return &Rel_A_B{} },
		// Database
		Tabelnaam: "rel_a_b",
		IDKolom:   "rel_id",
		DBFactory: func() Representatie { return &Rel_A_B{} },
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
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
		Kleur:       "#dbeafe",
		// JSON veldnaam in REST requests
		Veldnaam: "u",
		Factory:  func() Representatie { return &A_U{} },
		// Database
		Tabelnaam: "a_u",
		IDKolom:   "rel_id",
		DBFactory: func() Representatie { return &A_U{} },
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
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
		Kleur:       "#c7f9cc",
		// JSON veldnaam in REST requests
		Veldnaam: "v",
		Factory:  func() Representatie { return &A_V{} },
		// Database
		Tabelnaam: "a_v",
		IDKolom:   "rel_id",
		DBFactory: func() Representatie { return &A_V{} },
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
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
		Kleur:       "#bbf7d0",
		// JSON veldnaam in REST requests
		Veldnaam: "w",
		Factory:  func() Representatie { return &A_W{} },
		// Database
		Tabelnaam: "a_w",
		IDKolom:   "rel_id",
		DBFactory: func() Representatie { return &A_W{} },
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
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
		Kleur:       "#fdba74",
		// JSON veldnaam in REST requests
		Veldnaam: "x",
		Factory:  func() Representatie { return &B_X{} },
		// Database
		Tabelnaam: "b_x",
		IDKolom:   "rel_id",
		DBFactory: func() Representatie { return &B_X{} },
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
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
		Kleur:       "#fde68a",
		// JSON veldnaam in REST requests
		Veldnaam: "y",
		Factory:  func() Representatie { return &B_Y{} },
		// Database
		Tabelnaam: "b_y",
		IDKolom:   "rel_id",
		DBFactory: func() Representatie { return &B_Y{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  true,
		RelatieveAutoincrement:    true,
		EntiteitIDKolom:           "b_id",
		SecondaireEntiteitIDKolom: "",
		Momentvoorkomen:           Enkelvoudig,
	},
}
