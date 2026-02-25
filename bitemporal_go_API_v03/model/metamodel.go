package model

// Hardcoded meta model for representatie types, avoiding reflection.

// Momentvoorkomen describes whether a relation is single or multiple.
type Momentvoorkomen int

const (
	Enkelvoudig Momentvoorkomen = iota
	Meervoudig
)

// OnderliggendGegevenselement describes a related field on an entity and its multiplicity.
type OnderliggendGegevenselement struct {
	Rolnaam         string
	Doeltype        string
	Momentvoorkomen Momentvoorkomen // enkelvoudig of meervoudig = het voorkomen op enig moment in de tijd
}

// OnderliggendeRepresentatie koppelt een typenaam aan een concrete FormeleRepresentatie.
type OnderliggendeRepresentatie struct {
	Typenaam      string
	Representatie FormeleRepresentatie
}

// HeeftOnderliggendeGegevenselementen wordt geïmplementeerd door entiteitstypen
// die hun onderliggende gegevenselementen/relaties kunnen teruggeven.
type HeeftOnderliggendeGegevenselementen interface {
	GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie
}

// TypeMeta holds metadata for a representatie type.
type TypeMeta struct {
	// ==== UML ====
	Typenaam    string
	Metatype    Metatype
	IsMaterieel bool

	// ==== JSON ====
	// Veldnaam is the JSON field name used in REST requests (bijv. "a", "b", "rel_a_b", "u").
	Veldnaam string
	// Factory creates a new zero-value instance of the concrete Representatie struct.
	Factory func() Representatie

	// ==== Database (alle representaties) ====
	// Tabelnaam is the database table name for the representatie type.
	Tabelnaam string
	// IDKolom is the name of the primary key column in the database table.
	IDKolom string
	// De factory van de representatie struct die gebruikt wordt voor database operaties, zoals het aanmaken van tabellen.
	DBFactory func() Representatie

	// ==== Database (gegevenselementen/relaties) ====
	// Of er een samengestelde sleutel is, bijv. van (EntiteitID, Rel_ID)
	HeeftPFK bool

	// of de ID kolom een relatieve auto-increment is binnen de parent entiteit
	// (dus niet globaal uniek)
	RelatieveAutoincrement bool

	// EntiteitIDKolom is the FK column pointing to the primary entiteit (if any).
	EntiteitIDKolom string

	// SecondaireEntiteitIDKolom is the FK column for a secondary entiteit (relations only).
	SecondaireEntiteitIDKolom string

	// ook bij het gegevenselement/relatie meta, want dat is nodig voor
	// het automatisch afvoeren van onderliggende gegevenselementen/relaties
	// bij opvoer van een opvolgend gegevenselement/relatie
	Momentvoorkomen Momentvoorkomen // enkelvoudig of meervoudig = het voorkomen op enig moment in de tijd

	// ==== Alleen voor entiteiten (of misschien toch ook voor GEn?)====
	// OnderliggendeGegevenselementen applies to entiteiten; empty for gegevenselementen/relaties.
	OnderliggendeGegevenselementen []OnderliggendGegevenselement
}

// MetaRegistryType is a named map type for the meta model registry, enabling methods.
type MetaRegistryType map[string]TypeMeta

// BovenliggendeRelatieMeta describes how a child type hangs under a parent entiteit type.
type BovenliggendeRelatieMeta struct {
	ParentType TypeMeta
	Relatie    OnderliggendGegevenselement
}

// MetaRegistry is the hardcoded meta model registry.
var MetaRegistry = MetaRegistryType{
	"A": {
		// UML
		Typenaam:    "A",
		Metatype:    MetatypeEntiteit,
		IsMaterieel: true,
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
			{Rolnaam: "Us", Doeltype: "A_U", Momentvoorkomen: Enkelvoudig},
			{Rolnaam: "Vs", Doeltype: "A_V", Momentvoorkomen: Meervoudig},
			{Rolnaam: "RelABs", Doeltype: "Rel_A_B", Momentvoorkomen: Meervoudig},
		},
	},
	"B": {
		// UML
		Typenaam:    "B",
		Metatype:    MetatypeEntiteit,
		IsMaterieel: true,
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
			{Rolnaam: "Xs", Doeltype: "B_X", Momentvoorkomen: Enkelvoudig},
			{Rolnaam: "Ys", Doeltype: "B_Y", Momentvoorkomen: Enkelvoudig},
		},
	},
	"Rel_A_B": {
		// UML
		Typenaam:    "Rel_A_B",
		Metatype:    MetatypeRelatie,
		IsMaterieel: true,
		// JSON veldnaam in REST requests
		Veldnaam: "rel_a_b",
		Factory:  func() Representatie { return &Rel_A_B{} },
		// Database
		Tabelnaam: "rel_a_b",
		IDKolom:   "id",
		DBFactory: func() Representatie { return &Rel_A_B{} },
		// Alleen voor gegevenselementen/relaties:
		// die hebben een FK naar een of twee entiteiten
		HeeftPFK:                  false,
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "b_id",
		Momentvoorkomen:           Meervoudig,
	},
	"A_U": {
		// UML
		Typenaam:    "A_U",
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
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
	"B_X": {
		// UML
		Typenaam:    "B_X",
		Metatype:    MetatypeGegevenselement,
		IsMaterieel: false,
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

/*
GetTypeMeta geeft (TypeMeta, bool) terug.
Als het type niet bestaat, krijg je ok=false en
kun je daar netjes op reageren.

MustTypeMeta gaat ervan uit dat het type altijd bestaat.
Als het ontbreekt, panickt hij meteen.
Handig voor plekken waar een ontbrekend type een programmeerfout is
en je liever hard faalt.
*/

// GetTypeMeta returns metadata for a type, if present.
func (r MetaRegistryType) GetTypeMeta(typeName string) (TypeMeta, bool) {
	meta, ok := r[typeName]
	return meta, ok
}

// MustTypeMeta returns metadata for a type or panics if missing.
func (r MetaRegistryType) MustTypeMeta(typeName string) TypeMeta {
	meta, ok := r[typeName]
	if !ok {
		panic("unknown type: " + typeName)
	}
	return meta
}

// GetByVeldnaam zoekt een TypeMeta op basis van de JSON veldnaam (bijv. "a", "u", "rel_a_b").
func (r MetaRegistryType) GetByVeldnaam(veldnaam string) (TypeMeta, bool) {
	for _, meta := range r {
		if meta.Veldnaam == veldnaam {
			return meta, true
		}
	}
	return TypeMeta{}, false
}

// GetBovenliggendeRelatieMeta finds the parent entiteit metadata for a given child type.
func (r MetaRegistryType) GetBovenliggendeRelatieMeta(childTypeName string) (BovenliggendeRelatieMeta, bool) {
	for _, parentMeta := range r {
		if parentMeta.Metatype != MetatypeEntiteit {
			continue
		}

		for _, rel := range parentMeta.OnderliggendeGegevenselementen {
			if rel.Doeltype == childTypeName {
				return BovenliggendeRelatieMeta{
					ParentType: parentMeta,
					Relatie:    rel,
				}, true
			}
		}
	}

	return BovenliggendeRelatieMeta{}, false
}
