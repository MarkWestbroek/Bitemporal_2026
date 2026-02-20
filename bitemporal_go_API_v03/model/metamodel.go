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
	Typenaam    string
	Metatype    Metatype
	IsMaterieel bool
	Tabelnaam   string
	IDKolom     string

	// Veldnaam is the JSON field name used in REST requests (bijv. "a", "b", "rel_a_b", "u").
	Veldnaam string

	// Factory creates a new zero-value instance of the concrete Representatie struct.
	Factory func() Representatie

	// EntiteitIDKolom is the FK column pointing to the primary entiteit (if any).
	EntiteitIDKolom string

	// SecondaireEntiteitIDKolom is the FK column for a secondary entiteit (relations only).
	SecondaireEntiteitIDKolom string

	// OnderliggendeGegevenselementen applies to entiteiten; empty for gegevenselementen/relaties.
	OnderliggendeGegevenselementen []OnderliggendGegevenselement
}

// MetaRegistryType is a named map type for the meta model registry, enabling methods.
type MetaRegistryType map[string]TypeMeta

// MetaRegistry is the hardcoded meta model registry.
var MetaRegistry = MetaRegistryType{
	"A": {
		Typenaam:                  "A",
		Metatype:                  MetatypeEntiteit,
		IsMaterieel:               true,
		Tabelnaam:                 "a",
		IDKolom:                   "id",
		Veldnaam:                  "a",
		Factory:                   func() Representatie { return &Full_A{} },
		EntiteitIDKolom:           "",
		SecondaireEntiteitIDKolom: "",
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{Rolnaam: "Us", Doeltype: "A_U", Momentvoorkomen: Enkelvoudig},
			{Rolnaam: "Vs", Doeltype: "A_V", Momentvoorkomen: Meervoudig},
			{Rolnaam: "RelABs", Doeltype: "Rel_A_B", Momentvoorkomen: Meervoudig},
		},
	},
	"B": {
		Typenaam:                  "B",
		Metatype:                  MetatypeEntiteit,
		IsMaterieel:               true,
		Tabelnaam:                 "b",
		IDKolom:                   "id",
		Veldnaam:                  "b",
		Factory:                   func() Representatie { return &Full_B{} },
		EntiteitIDKolom:           "",
		SecondaireEntiteitIDKolom: "",
		OnderliggendeGegevenselementen: []OnderliggendGegevenselement{
			{Rolnaam: "Xs", Doeltype: "B_X", Momentvoorkomen: Enkelvoudig},
			{Rolnaam: "Ys", Doeltype: "B_Y", Momentvoorkomen: Enkelvoudig},
		},
	},
	"Rel_A_B": {
		Typenaam:                  "Rel_A_B",
		Metatype:                  MetatypeRelatie,
		IsMaterieel:               true,
		Tabelnaam:                 "rel_a_b",
		IDKolom:                   "id",
		Veldnaam:                  "rel_a_b",
		Factory:                   func() Representatie { return &Rel_A_B{} },
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "b_id",
	},
	"A_U": {
		Typenaam:                  "A_U",
		Metatype:                  MetatypeGegevenselement,
		IsMaterieel:               false,
		Tabelnaam:                 "a_u",
		IDKolom:                   "rel_id",
		Veldnaam:                  "u",
		Factory:                   func() Representatie { return &A_U{} },
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "",
	},
	"A_V": {
		Typenaam:                  "A_V",
		Metatype:                  MetatypeGegevenselement,
		IsMaterieel:               false,
		Tabelnaam:                 "a_v",
		IDKolom:                   "rel_id",
		Veldnaam:                  "v",
		Factory:                   func() Representatie { return &A_V{} },
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "",
	},
	"B_X": {
		Typenaam:                  "B_X",
		Metatype:                  MetatypeGegevenselement,
		IsMaterieel:               false,
		Tabelnaam:                 "b_x",
		IDKolom:                   "rel_id",
		Veldnaam:                  "x",
		Factory:                   func() Representatie { return &B_X{} },
		EntiteitIDKolom:           "b_id",
		SecondaireEntiteitIDKolom: "",
	},
	"B_Y": {
		Typenaam:                  "B_Y",
		Metatype:                  MetatypeGegevenselement,
		IsMaterieel:               false,
		Tabelnaam:                 "b_y",
		IDKolom:                   "rel_id",
		Veldnaam:                  "y",
		Factory:                   func() Representatie { return &B_Y{} },
		EntiteitIDKolom:           "b_id",
		SecondaireEntiteitIDKolom: "",
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
