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
