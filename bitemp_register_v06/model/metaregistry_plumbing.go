package model

import (
	"fmt"
	"os"
)

// Hardcoded meta model for representatie types, avoiding reflection.

// Referentielijst-subtypes: classificatie van entiteiten en relaties als onderdeel
// van een referentielijst-constructie. Zie Referentielijsten.md voor achtergrond.
const (
	EntiteitSubtypeReferentielijst     = "referentielijst"
	EntiteitSubtypeReferentielijstItem = "referentielijst_item"
	RelatieSubtypeReferentielijstItems = "referentielijst_items"
)

// GESubtype onderscheidt de vier soorten GE/REL-lagen in het hub+data pattern.
type GESubtype string

const (
	GESubtypeNone    GESubtype = ""        // entiteiten, entiteits-plumbing
	GESubtypeHub     GESubtype = "hub"     // identiteitsanker (a_u, rel_a_b, ...)
	GESubtypeData    GESubtype = "data"    // geversioned inhoud (a_u_data, ...)
	GESubtypeAanvang GESubtype = "aanvang" // materiële aanvang (a_w_aanvang, ...)
	GESubtypeEinde   GESubtype = "einde"   // materiële einde (a_w_einde, ...)
)

// Momentvoorkomen describes whether a relation is single or multiple.
type Momentvoorkomen int

const (
	Enkelvoudig Momentvoorkomen = iota
	Meervoudig
)

// OnderliggendGegevenselement describes a related field on an entity and its multiplicity.
type OnderliggendGegevenselement struct {
	Rolnaam         string
	JSONRolnaam     string
	Doeltype        string
	Momentvoorkomen Momentvoorkomen // enkelvoudig of meervoudig = het voorkomen op enig moment in de tijd
	NaamLabelHeen   string          // UML-label op de heen-richting (bijv. "woont op", "heeft")
	NaamLabelTerug  string          // UML-label op de terug-richting (bijv. "is woonadres van", "behoort bij")
}

// AfgeleidVeld beschrijft een afgeleid veld op representatie-niveau (entiteit, GE-hub of relatie-hub).
// Het veld wordt niet opgeslagen maar berekend uit onderliggende velden via een CEL-expressie.
type AfgeleidVeld struct {
	Naam                string // JSON-veldnaam van het afgeleide veld (bijv. "weergavenaam")
	Description         string
	GoType              string // bijv. "string"
	AfleidingsregelTaal string // bijv. "cel"
	Afleidingsregel     string // CEL-expressie (bijv. "Naam.roepnaam != null ? ...")
	IsWeergaveVeld      bool   // true = dit veld wordt als samenvattende weergave op kaarten getoond
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

// EditorLayout bevat UML-editor layout metadata voor round-trip engineering.
// Deze gegevens worden genegeerd door codegen maar bewaard voor stabiele editor-layouts.
type EditorLayout struct {
	Positie               *V3Positie  // node-positie in de editor
	LayoutLocked          bool        // node-positie is door gebruiker vergrendeld (auto-layout slaat 'm over)
	EdgeID                string      // persistente edge-id (entiteit→anker)
	SourceHandle          string      // handle op de bron-zijde van de owner-edge
	TargetHandle          string      // handle op de doel-zijde van de owner-edge
	DoelEdgeID            string      // alleen relaties: edge-id anker→doel-entiteit
	DoelSourceHandle      string      // alleen relaties: handle op anker (uitgaand naar doel)
	DoelTargetHandle      string      // alleen relaties: handle op doel-entiteit (inkomend)
	AnkerPositie          *V3Positie  // alleen relaties: positie van het associatie-ankerpunt
	AnkerLayoutLocked     bool        // alleen relaties: anker-positie is door gebruiker vergrendeld
	ClassLinkEdgeID       string      // alleen relaties: edge-id anker╌╌relatie (association class link)
	ClassLinkSourceHandle string      // alleen relaties: handle op anker (uitgaand naar relatie)
	ClassLinkTargetHandle string      // alleen relaties: handle op relatie (inkomend van anker)
	UseEdges              []V3UseEdge // optionele metadata voor dependency-edges naar enum/datatype/ref
}

// ReferentielijstInstantieInfo bevat metadata en layout voor een referentielijst-instantie
// die niet in de TypeMeta van de relatie past.
type ReferentielijstInstantieInfo struct {
	Naam         string
	Omschrijving string
	Layout       *EditorLayout
}

// ReferentielijstInstantieRegistry bevat metadata per referentielijst-instantie (systeemnaam).
var ReferentielijstInstantieRegistry = map[string]ReferentielijstInstantieInfo{}

// EnumEditorLayouts bevat editor-posities per enum-type (goType).
var EnumEditorLayouts = map[string]*EditorLayout{}

// TypeMeta holds metadata for a representatie type.
type TypeMeta struct {
	// ==== UML ====
	Typenaam       string
	Klassenaam     string // korte weergavenaam zonder entiteitsprefix (bijv. "PersoonsIdentificatie" i.p.v. "NatuurlijkPersoon_PersoonsIdentificatie")
	Description    string
	Metatype       Metatype
	IsMaterieel    bool
	IsAbstract     bool   // UML: abstracte klasse (cursief weergegeven, niet-instantieerbaar)
	ParentTypenaam string // typenaam van de parent-entiteit bij generalisatie (leeg indien geen overerving)

	// Domein groepeert types per modeldomein (bijv. "np-loc", "ab").
	// Wordt gebruikt om bij export alleen types uit één domein te selecteren.
	Domein string

	// GE-subtype: classificatie van het type binnen de hub-hiërarchie
	GESubtype GESubtype
	// Typenaam van de onderliggende _Data (alleen bij hubs)
	DataTypenaam string

	// ==== JSON ====
	// Veldnaam is the JSON field name used in REST requests (bijv. "a", "b", "rel_a_b", "u").
	Veldnaam string
	// Padnaam is the URL path segment used in REST routes (bijv. "as", "bs", "rel_a_bs", "a_us").
	Padnaam string
	// Meervoud is de expliciete meervoudsvorm uit het model (kan afwijken van route-padconventies).
	Meervoud string
	// Kleur is een optionele visualisatiekleur (bijv. "#eef6ff").
	Kleur string
	// Factory creates a new zero-value instance of the concrete Representatie struct.
	Factory func() Representatie
	// SliceFactory creates a pointer to a concrete slice for full/list queries, e.g. &[]A{}.
	SliceFactory func() any

	// ==== Database (alle representaties) ====
	// Tabelnaam is the database table name for the representatie type.
	Tabelnaam string
	// IDKolom is the name of the primary key column in the database table.
	IDKolom string
	// De factory van de representatie struct die gebruikt wordt voor database operaties, zoals het aanmaken van tabellen.
	DBFactory func() Representatie
	// DBSliceFactory creates a pointer to a concrete slice for list queries, e.g. &[]A{}.
	DBSliceFactory func() any

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

	// BovenliggendTypenaam is voor plumbing GE-types die niet via OnderliggendeGegevenselementen
	// te vinden zijn (bijv. A_Aanvang, A_Einde). Geeft de naam van de bovenliggende entiteit (bijv. "A").
	BovenliggendTypenaam string

	// Directioneel geeft aan of de relatie een directionele associatie is.
	// Bij directionele relaties wordt een open pijl weergegeven aan de doelzijde (B)
	// en wordt de kardinaliteit aan de bronzijde (A) niet getoond.
	Directioneel bool

	// Referentielijst-subtypes (optioneel). Leeg voor gewone entiteiten/relaties.
	EntiteitSubtype          string // "", "referentielijst", "referentielijst_item"
	RelatieSubtype           string // "", "referentielijst_items"
	ReferentielijstInstantie string // systeemnaam van de gebonden referentielijst-instantie; alleen voor RelatieSubtype == "referentielijst_items"

	// ==== Alleen voor entiteiten en hubs ====
	// OnderliggendeGegevenselementen beschrijft de onderliggende representaties.
	// Bij entiteiten: GE-hubs en relatie-hubs.
	// Bij hubs: _Data, en optioneel _Aanvang/_Einde (bij materiële hubs).
	OnderliggendeGegevenselementen []OnderliggendGegevenselement

	// AfgeleideVelden beschrijft afgeleide velden (bijv. weergavenaam).
	// Ondersteund op entiteiten, GE-hubs en relatie-hubs. De waarden worden berekend uit onderliggende velden.
	AfgeleideVelden []AfgeleidVeld

	// ==== Editor layout (round-trip) ====
	// Layout bevat UML-editor positie en edge-metadata voor stabiele round-trips.
	// Wordt genegeerd door codegen.
	Layout *EditorLayout
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
// LET OP: bij dubbele veldnamen (bijv. "naam", "contactgegevens") is het resultaat
// non-deterministisch. Gebruik GetByVeldnaamMetPayload voor disambiguatie.
func (r MetaRegistryType) GetByVeldnaam(veldnaam string) (TypeMeta, bool) {
	for _, meta := range r {
		if meta.Veldnaam == veldnaam {
			return meta, true
		}
	}
	return TypeMeta{}, false
}

// GetByVeldnaamMetPayload zoekt een TypeMeta op veldnaam en lost ambiguïteit op
// wanneer meerdere types dezelfde Veldnaam delen (bijv. "naam" → ApiStandaard_Naam_Data
// / NatuurlijkPersoon_Naam_Data). De juiste TypeMeta wordt gekozen door te kijken welk
// EntiteitIDKolom als JSON-sleutel in de payload voorkomt.
//
// Fallback op Padnaam: als de veldnaam niet als Veldnaam (enkelvoud) gevonden wordt,
// wordt ook gezocht op Padnaam (meervoud). Zo werken zowel "naam" als "namen" in
// flat-format payloads — consistent met het meervoud dat ook in nested-format gebruikt wordt.
func (r MetaRegistryType) GetByVeldnaamMetPayload(veldnaam string, payloadKeys map[string]struct{}) (TypeMeta, bool) {
	candidates := r.GetAllByVeldnaam(veldnaam)
	if len(candidates) == 0 {
		// Fallback: probeer Padnaam (meervoud), zodat bijv. "namen" werkt naast "naam".
		candidates = r.GetAllByPadnaam(veldnaam)
	}
	if len(candidates) == 0 {
		return TypeMeta{}, false
	}
	if len(candidates) == 1 {
		return candidates[0], true
	}
	// Meerdere matches: inspecteer de payload-sleutels om te disambigueren.
	for _, meta := range candidates {
		if meta.EntiteitIDKolom != "" {
			if _, found := payloadKeys[meta.EntiteitIDKolom]; found {
				return meta, true
			}
		}
	}
	// Geen match op EntiteitIDKolom: neem de eerste als fallback.
	fmt.Fprintf(os.Stderr, "WARN GetByVeldnaamMetPayload: geen disambiguatie mogelijk voor veldnaam %q (%d candidates)\n", veldnaam, len(candidates))
	return candidates[0], true
}

// GetAllByVeldnaam retourneert alle TypeMeta's die dezelfde Veldnaam hebben.
// Dit is nodig voor disambiguatie als meerdere types dezelfde JSON-veldnaam delen
// (bijv. "naam" bij NatuurlijkPersoon_Naam en ApiStandaard_Naam).
func (r MetaRegistryType) GetAllByVeldnaam(veldnaam string) []TypeMeta {
	var matches []TypeMeta
	for _, meta := range r {
		if meta.Veldnaam == veldnaam {
			matches = append(matches, meta)
		}
	}
	return matches
}

// GetAllByPadnaam retourneert alle TypeMeta's die dezelfde Padnaam hebben.
// Gebruikt als fallback in GetByVeldnaamMetPayload zodat meervoudsvormen
// (bijv. "namen", "persoonsidentificaties") ook werken in flat-format payloads.
func (r MetaRegistryType) GetAllByPadnaam(padnaam string) []TypeMeta {
	var matches []TypeMeta
	for _, meta := range r {
		if meta.Padnaam == padnaam {
			matches = append(matches, meta)
		}
	}
	return matches
}

// GetBovenliggendeRelatieMeta finds the parent entiteit metadata for a given child type.
func (r MetaRegistryType) GetBovenliggendeRelatieMeta(childTypeName string) (BovenliggendeRelatieMeta, bool) {
	for _, parentMeta := range r {
		if len(parentMeta.OnderliggendeGegevenselementen) == 0 {
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

// GetBovenliggendeEntiteitMeta resolves the root parent entiteit for a child type.
// For direct entity children this returns that entity; for hub children like _Data/
// _Aanvang/_Einde it walks via BovenliggendTypenaam until the owning entiteit is found.
func (r MetaRegistryType) GetBovenliggendeEntiteitMeta(childTypeName string) (TypeMeta, bool) {
	bezocht := map[string]bool{}
	current := childTypeName

	for current != "" {
		if bezocht[current] {
			return TypeMeta{}, false
		}
		bezocht[current] = true

		if bovenliggend, ok := r.GetBovenliggendeRelatieMeta(current); ok {
			if bovenliggend.ParentType.Metatype == MetatypeEntiteit {
				return bovenliggend.ParentType, true
			}
			current = bovenliggend.ParentType.Typenaam
			continue
		}

		meta, ok := r.GetTypeMeta(current)
		if !ok || meta.BovenliggendTypenaam == "" {
			break
		}

		bovenMeta, ok := r.GetTypeMeta(meta.BovenliggendTypenaam)
		if !ok {
			break
		}
		if bovenMeta.Metatype == MetatypeEntiteit {
			return bovenMeta, true
		}
		current = bovenMeta.Typenaam
	}

	return TypeMeta{}, false
}

// RelationNames returns the Bun relation field names for child representaties of an entity.
func (m TypeMeta) RelationNames() []string {
	if len(m.OnderliggendeGegevenselementen) == 0 {
		return nil
	}

	namen := make([]string, 0, len(m.OnderliggendeGegevenselementen))
	for _, rel := range m.OnderliggendeGegevenselementen {
		namen = append(namen, rel.Rolnaam)
	}

	return namen
}

// MetaRegistry is de centrale registry voor alle representatietypes.
// Wordt gevuld door domein-specifieke initXxxMetaRegistry() functies die
// vanuit init() worden aangeroepen.
var MetaRegistry = MetaRegistryType{}

// DatatypeRegistry bevat de custom gegevenstypen die beschikbaar zijn in het register.
// Wordt gevuld door domein-specifieke initXxxDatatypeRegistry() functies.
var DatatypeRegistry = []V3Datatype{}

// EnumWaarden is een registry van enum-type namen naar hun beschikbare waarden.
// Wordt gebruikt door de schema-API om dropdowns te genereren.
// De registry wordt aangevuld in init() functies van de model-bestanden
// (bijv. door codegen gegenereerd).
var EnumWaarden = map[string][]string{}

// EnumDomeinen bewaart per enum-type in welk domein het concept thuishoort.
// `register` is het basisdomein; modelspecifieke enums kunnen bijv. `np-loc` krijgen.
var EnumDomeinen = map[string]string{}

// VoegOnderliggendGEToe voegt een OnderliggendGegevenselement toe aan een reeds
// geregistreerde TypeMeta. Hiermee kan domein-specifieke code (bijv. np-loc)
// een kind-relatie toevoegen aan een register-scope entiteit (bijv. Referentielijst).
func VoegOnderliggendGEToe(typenaam string, ge OnderliggendGegevenselement) {
	meta, ok := MetaRegistry[typenaam]
	if !ok {
		panic("VoegOnderliggendGEToe: onbekend type " + typenaam)
	}
	meta.OnderliggendeGegevenselementen = append(meta.OnderliggendeGegevenselementen, ge)
	MetaRegistry[typenaam] = meta
}

// Centrale init-volgorde: abuvwxy-basisdomein, register, overige domeinen.
// Zo kan np-loc via VoegOnderliggendGEToe() referenties toevoegen aan register-scope entiteiten.
// Additionele domeinen worden door ensureInitRegistration automatisch toegevoegd.
func init() {
	// abuvwxy — het oorspronkelijke basis-/referentiemodel
	initAbuvwxyMetaRegistry()
	initAbuvwxyDatatypeRegistry()
	initAbuvwxyEnumRegistry()

	// register — het functionele basisdomein
	initRegisterMetaRegistry()
	initRegisterDatatypeRegistry()
	initRegisterEnumRegistry()

	// np-loc — domein-specifieke uitbreiding
	initNpLocEnumRegistry()
	initNpLocDatatypeRegistry()
	initNpLocMetaRegistry()

	// cg — CG Portfolio domein
	initCgEnumRegistry()
	initCgDatatypeRegistry()
	initCgMetaRegistry()

	// Propageer domein van entiteiten naar hun onderliggende GE's, relaties en plumbing-types.
	// Zo hoeft het domein niet op elke entry handmatig te staan.
	// configuratie — domein-specifieke uitbreiding
	initConfiguratieEnumRegistry()
	initConfiguratieDatatypeRegistry()
	initConfiguratieMetaRegistry()

	// financieel — domein-specifieke uitbreiding
	initFinancieelEnumRegistry()
	initFinancieelDatatypeRegistry()
	initFinancieelMetaRegistry()

	// ide_bestanden — domein-specifieke uitbreiding
	initIdeBestandenEnumRegistry()
	initIdeBestandenDatatypeRegistry()
	initIdeBestandenMetaRegistry()

	// kennis2 — domein-specifieke uitbreiding
	initKennis2EnumRegistry()
	initKennis2DatatypeRegistry()
	initKennis2MetaRegistry()

	// extra — handmatig onderhouden datatypes (Kleur, Duur, UrlHttps, GeoPunt e.d.)
	// die niet door cmd/codegen worden overschreven. Zie extra_datatype_registry.go.
	initExtraDatatypeRegistry()

	// gegevenstypen — canonieke, handmatig onderhouden registry van algemene
	// (cross-domein) datatypes met validatie-regels. Wordt als LAATSTE
	// uitgevoerd zodat duplicates uit register/cg/financieel/extra
	// vervangen worden door de canonieke versie. Zie
	// gegevenstypen_datatype_registry.go en docs/validatie.md.
	initGegevenstypenDatatypeRegistry()

	// gegevenstypen — testmodel voor validatie-integratietests (handmatig).
	initGegevenstypenEnumRegistry()
	initGegevenstypenMetaRegistry()

	propageerDomeinNaarOnderliggende()
}

// propageerDomeinNaarOnderliggende loopt alle entiteiten in de MetaRegistry af en
// zet het domein van de entiteit op alle onderliggende types die nog geen domein hebben.
// Dit werkt recursief: hubs propageren naar hun _Data/_Aanvang/_Einde subtypes.
func propageerDomeinNaarOnderliggende() {
	for _, meta := range MetaRegistry {
		if meta.Metatype != MetatypeEntiteit || meta.Domein == "" {
			continue
		}
		propageerDomeinRecursief(meta.Domein, meta.OnderliggendeGegevenselementen)
	}
	// Propageer ook via BovenliggendTypenaam voor plumbing-types die niet in
	// OnderliggendeGegevenselementen staan (vangnet).
	for key, meta := range MetaRegistry {
		if meta.Domein != "" || meta.BovenliggendTypenaam == "" {
			continue
		}
		if parent, ok := MetaRegistry[meta.BovenliggendTypenaam]; ok && parent.Domein != "" {
			meta.Domein = parent.Domein
			MetaRegistry[key] = meta
		}
	}
}

func propageerDomeinRecursief(domein string, children []OnderliggendGegevenselement) {
	for _, child := range children {
		childMeta, ok := MetaRegistry[child.Doeltype]
		if !ok {
			continue
		}
		if childMeta.Domein == "" {
			childMeta.Domein = domein
			MetaRegistry[child.Doeltype] = childMeta
		}
		// Recursie: propageer naar sub-children (bijv. hub → _Data, _Aanvang, _Einde)
		if len(childMeta.OnderliggendeGegevenselementen) > 0 {
			propageerDomeinRecursief(domein, childMeta.OnderliggendeGegevenselementen)
		}
	}
}
