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

// TypeMeta holds metadata for a representatie type.
type TypeMeta struct {
	Typenaam    string
	Metatype    Metatype
	IsMaterieel bool
	Tabelnaam   string
	IDKolom     string

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
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "b_id",
	},
	"A_U": {
		Typenaam:                  "A_U",
		Metatype:                  MetatypeGegevenselement,
		IsMaterieel:               false,
		Tabelnaam:                 "a_u",
		IDKolom:                   "rel_id",
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "",
	},
	"A_V": {
		Typenaam:                  "A_V",
		Metatype:                  MetatypeGegevenselement,
		IsMaterieel:               false,
		Tabelnaam:                 "a_v",
		IDKolom:                   "rel_id",
		EntiteitIDKolom:           "a_id",
		SecondaireEntiteitIDKolom: "",
	},
	"B_X": {
		Typenaam:                  "B_X",
		Metatype:                  MetatypeGegevenselement,
		IsMaterieel:               false,
		Tabelnaam:                 "b_x",
		IDKolom:                   "rel_id",
		EntiteitIDKolom:           "b_id",
		SecondaireEntiteitIDKolom: "",
	},
	"B_Y": {
		Typenaam:                  "B_Y",
		Metatype:                  MetatypeGegevenselement,
		IsMaterieel:               false,
		Tabelnaam:                 "b_y",
		IDKolom:                   "rel_id",
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
