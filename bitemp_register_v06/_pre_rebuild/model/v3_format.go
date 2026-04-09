package model

// V3 codegen-inputformaat Go types.
// Dit definieert de structuur van het registermodel in v3-formaat,
// zoals beschreven in ontwerpkeuzen.md §5.
// Wordt gebruikt door:
// - GET/POST /api/schema/model endpoints
// - cmd/codegen/ code generator
// - UML-editor (via JSON import/export)

// V3Model is het top-level formaat voor een registermodeldefinitie.
// Dit type beschrijft alleen het model zelf; POST-metadata zoals bron en indiener
// horen conceptueel in de request-wrapper en niet in de modelversie.
type V3Model struct {
	Versie                    string                       `json:"versie"`                              // semantische modelversie, bijv. "v1.0.0"
	Naam                      string                       `json:"naam,omitempty"`                      // herkenbare modelnaam voor selectie in lijsten
	Beschrijving              string                       `json:"beschrijving,omitempty"`              // korte omschrijving van het modeldoel
	Bron                      string                       `json:"bron,omitempty"`                      // deprecated: gebruik wrapper.bron voor POST-metadata
	Indiener                  string                       `json:"indiener,omitempty"`                  // deprecated: gebruik wrapper.indiener voor POST-metadata
	Datatypes                 []V3Datatype                 `json:"datatypes,omitempty"`                 // custom gegevenstypen
	Enums                     []V3Enum                     `json:"enums,omitempty"`                     // enum definities
	ReferentielijstInstanties []V3ReferentielijstInstantie `json:"referentielijstInstanties,omitempty"` // referentielijst-instanties (Landenlijst, EULidstaten, etc.)
	Entiteiten                []V3Entiteit                 `json:"entiteiten"`                          // top-level entiteiten
}

// V3ReferentielijstInstantie beschrijft een referentielijst-instantie (record) in het V3 model.
// Instanties verwijzen naar specifieke referentielijsten die als records bestaan
// in de Referentielijst-entiteit (bijv. "Landenlijst", "EULidstaten").
type V3ReferentielijstInstantie struct {
	Systeemnaam  string     `json:"systeemnaam"`            // stabiele identifier, bijv. "Landenlijst"
	Naam         string     `json:"naam,omitempty"`         // leesbare naam, bijv. "Landen"
	Omschrijving string     `json:"omschrijving,omitempty"` // korte beschrijving
	Positie      *V3Positie `json:"positie,omitempty"`      // editor-layout positie (genegeerd door codegen)
}

// V3Datatype beschrijft een custom gegevenstype met validatie en weergave.
type V3Datatype struct {
	Naam         string       `json:"naam"`
	Description  string       `json:"description,omitempty"`
	Basistype    string       `json:"basistype"`         // string, integer, number
	Format       string       `json:"format,omitempty"`  // bijv. "nl-postcode", "bsn"
	Domein       string       `json:"domein,omitempty"`  // domeingroep: "register" = registerbasis, "" = ongegroepeerd
	Positie      *V3Positie   `json:"positie,omitempty"` // editor-layout positie (genegeerd door codegen)
	Validatie    *V3Validatie `json:"validatie,omitempty"`
	Normalisatie string       `json:"normalisatie,omitempty"`
	Weergave     *V3Weergave  `json:"weergave,omitempty"`
}

// V3Validatie beschrijft validatieregels voor een datatype.
type V3Validatie struct {
	Pattern     string    `json:"pattern,omitempty"`
	MinLength   *int      `json:"minLength,omitempty"`
	MaxLength   *int      `json:"maxLength,omitempty"`
	Voorbeelden []string  `json:"voorbeelden,omitempty"`
	Foutmelding string    `json:"foutmelding,omitempty"`
	Regels      []V3Regel `json:"regels,omitempty"`
}

// V3Regel beschrijft een aanvullende validatieregel.
type V3Regel struct {
	Naam      string `json:"naam"`
	Type      string `json:"type"` // bijv. "checksum"
	Expressie string `json:"expressie"`
}

// V3Weergave beschrijft weergave-hints voor de frontend.
// Naast placeholder en inputMask bevat dit ook widget-type, prefix/suffix en multiline-hints
// zodat de frontend het juiste invoercomponent kan renderen op basis van het gegevenstype.
type V3Weergave struct {
	Placeholder string `json:"placeholder,omitempty"`
	InputMask   string `json:"inputMask,omitempty"`
	Widget      string `json:"widget,omitempty"`    // bijv. "textarea", "checkbox", "currency", "datepicker"
	Prefix      string `json:"prefix,omitempty"`    // bijv. "€" voor Bedrag
	Suffix      string `json:"suffix,omitempty"`    // bijv. "%" voor Percentage
	Multiline   bool   `json:"multiline,omitempty"` // true voor LangeTekst (rendert als <textarea>)
	Decimalen   *int   `json:"decimalen,omitempty"` // aantal decimalen voor numerieke waarden
}

// V3Enum beschrijft een enum type met zijn waarden.
type V3Enum struct {
	GoType   string         `json:"goType"`
	BaseType string         `json:"baseType"`          // bijv. "string"
	Domein   string         `json:"domein,omitempty"`  // domeingroep: "register" = registerbasis, "" = ongegroepeerd
	Positie  *V3Positie     `json:"positie,omitempty"` // editor-layout positie (genegeerd door codegen)
	Waarden  []V3EnumWaarde `json:"waarden"`
}

// V3EnumWaarde beschrijft een enkele enum-waarde.
type V3EnumWaarde struct {
	ConstNaam string `json:"constNaam"`
	Waarde    string `json:"waarde"`
}

// V3Entiteit beschrijft een top-level entiteit in het registermodel.
type V3Entiteit struct {
	Typenaam          string              `json:"typenaam"`
	Description       string              `json:"description,omitempty"`
	Domein            string              `json:"domein,omitempty"`          // domeinnaam (bijv. "register", "np-loc"); gebruikt door codegen om cross-domein entiteiten te skippen
	EntiteitSubtype   string              `json:"entiteitSubtype,omitempty"` // bijv. "referentielijst", "referentielijst_item"
	IsMaterieel       bool                `json:"isMaterieel,omitempty"`
	Kleur             string              `json:"kleur,omitempty"`
	Meervoud          string              `json:"meervoud"`          // URL-padnaam, bijv. "as", "personen"
	Positie           *V3Positie          `json:"positie,omitempty"` // editor-layout positie (genegeerd door codegen)
	Runtime           *V3Runtime          `json:"runtime,omitempty"` // V3.1: runtime/deployment metadata (genegeerd door codegen/UML-editor)
	AfgeleideVelden   []V3AfgeleidVeld    `json:"afgeleideVelden,omitempty"`
	Gegevenselementen []V3Gegevenselement `json:"gegevenselementen,omitempty"`
	Relaties          []V3Relatie         `json:"relaties,omitempty"`
}

// V3Gegevenselement beschrijft een gegevenselement onder een entiteit.
type V3Gegevenselement struct {
	Naam            string           `json:"naam"` // bijv. "U", "V", "W"
	Description     string           `json:"description,omitempty"`
	Domein          string           `json:"domein,omitempty"` // domein waartoe dit GE behoort (optioneel, erft normaal van parent-entiteit)
	Meervoud        string           `json:"meervoud"`         // URL-padnaam, bijv. "a-us"
	Momentvoorkomen string           `json:"momentvoorkomen"`  // "enkelvoudig" of "meervoudig"
	IsMaterieel     bool             `json:"isMaterieel,omitempty"`
	Positie         *V3Positie       `json:"positie,omitempty"`      // editor-layout positie (genegeerd door codegen)
	ID              string           `json:"id,omitempty"`           // persistente edge-id van entiteit→GE voor stabiele editor round-trips
	SourceHandle    string           `json:"sourceHandle,omitempty"` // verbindingspunt op de entiteit (genegeerd door codegen)
	TargetHandle    string           `json:"targetHandle,omitempty"` // verbindingspunt op het GE-node (genegeerd door codegen)
	Runtime         *V3Runtime       `json:"runtime,omitempty"`      // V3.1: runtime/deployment metadata (genegeerd door codegen/UML-editor)
	AfgeleideVelden []V3AfgeleidVeld `json:"afgeleideVelden,omitempty"`
	Velden          []V3Veld         `json:"velden,omitempty"`
	UseEdges        []V3UseEdge      `json:"useEdges,omitempty"` // optionele layout/visibility metadata voor «use»-dependency-edges
}

// V3Relatie beschrijft een relatie onder een entiteit.
type V3Relatie struct {
	Naam                     string           `json:"naam"` // bijv. "Rel_A_B"
	Description              string           `json:"description,omitempty"`
	Domein                   string           `json:"domein,omitempty"`                   // domein waartoe deze relatie behoort (optioneel, erft normaal van parent-entiteit)
	RelatieSubtype           string           `json:"relatieSubtype,omitempty"`           // bijv. "referentielijst_items"
	ReferentielijstInstantie string           `json:"referentielijstInstantie,omitempty"` // systeemnaam van de gebonden referentielijst-instantie (alleen voor relatieSubtype == "referentielijst_items")
	Meervoud                 string           `json:"meervoud"`                           // URL-padnaam, bijv. "rel-a-bs"
	Momentvoorkomen          string           `json:"momentvoorkomen"`                    // "enkelvoudig" of "meervoudig"
	IsMaterieel              bool             `json:"isMaterieel,omitempty"`
	DoelEntiteit             string           `json:"doelEntiteit"`               // typenaam van de doel-entiteit
	Positie                  *V3Positie       `json:"positie,omitempty"`          // editor-layout positie (genegeerd door codegen)
	ID                       string           `json:"id,omitempty"`               // persistente edge-id van entiteit→relatie voor stabiele editor round-trips
	SourceHandle             string           `json:"sourceHandle,omitempty"`     // verbindingspunt op de entiteit→relatie edge (genegeerd door codegen)
	TargetHandle             string           `json:"targetHandle,omitempty"`     // verbindingspunt op de relatie (inkomend, genegeerd door codegen)
	DoelID                   string           `json:"doelId,omitempty"`           // persistente edge-id van relatie→doel-entiteit voor stabiele editor round-trips
	DoelSourceHandle         string           `json:"doelSourceHandle,omitempty"` // verbindingspunt op de relatie (uitgaand naar doel, genegeerd door codegen)
	DoelTargetHandle         string           `json:"doelTargetHandle,omitempty"` // verbindingspunt op de doel-entiteit (genegeerd door codegen)
	Runtime                  *V3Runtime       `json:"runtime,omitempty"`          // V3.1: runtime/deployment metadata (genegeerd door codegen/UML-editor)
	AfgeleideVelden          []V3AfgeleidVeld `json:"afgeleideVelden,omitempty"`
	Velden                   []V3Veld         `json:"velden,omitempty"`
	UseEdges                 []V3UseEdge      `json:"useEdges,omitempty"` // optionele layout/visibility metadata voor «use»-dependency-edges
}

// V3Positie beschrijft de positie van een element in de UML-editor.
// Dit veld wordt gebruikt voor opslag en laden van editor-layout, en wordt
// genegeerd door de codegenerator.
type V3Positie struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// V3UseEdge bewaart editor-layout en hidden-state van een «use»-dependency-edge
// vanuit een GE of relatie naar een enum, datatype of referentielijst-ref.
type V3UseEdge struct {
	Doel         string `json:"doel,omitempty"`
	ID           string `json:"id,omitempty"`
	SourceHandle string `json:"sourceHandle,omitempty"`
	TargetHandle string `json:"targetHandle,omitempty"`
	Hidden       bool   `json:"hidden,omitempty"`
}

// V3Runtime bevat runtime/deployment-specifieke metadata die afkomstig is uit de
// MetaRegistry en nodig is voor frontends (content editor, formulieren) en API-clients.
// Deze gegevens worden genegeerd door de codegenerator en UML-editor, maar zijn
// essentieel voor dynamische frontend-rendering en API-integratie.
//
// V3.1 extensie: scheidt modeldefinitie (typenaam, velden, relaties) van
// runtime-info (paden, tabellen, kolommen) zodat consumers gericht kunnen kiezen.
type V3Runtime struct {
	// Veldnaam is de JSON-veldnaam in REST requests (bijv. "a", "u", "rel_a_b").
	Veldnaam string `json:"veldnaam,omitempty"`
	// Padnaam is het URL-padsegment voor REST-routes (bijv. "as", "a-us", "rel-a-bs").
	Padnaam string `json:"padnaam,omitempty"`
	// Tabelnaam is de database-tabelnaam (bijv. "a", "a_u", "rel_a_b").
	Tabelnaam string `json:"tabelnaam,omitempty"`
	// IDKolom is de naam van de primaire sleutelkolom (bijv. "id", "rel_id").
	IDKolom string `json:"idKolom,omitempty"`
	// HeeftPFK geeft aan of er een samengestelde sleutel is (bijv. entiteitID + rel_id).
	HeeftPFK bool `json:"heeftPFK,omitempty"`
	// EntiteitIDKolom is de FK-kolom naar de parent-entiteit (bijv. "a_id", "b_id").
	EntiteitIDKolom string `json:"entiteitIDKolom,omitempty"`
	// Klassenaam is de korte weergavenaam zonder entiteitsprefix (bijv. "PersoonsIdentificatie").
	Klassenaam string `json:"klassenaam,omitempty"`
	// RelatieveAutoincrement geeft aan of rel_id/versie auto-increment is binnen de parent.
	RelatieveAutoincrement bool `json:"relatieveAutoincrement,omitempty"`
}

// V3Veld beschrijft een inhoudsveld (geen plumbing) in een GE of relatie.
type V3Veld struct {
	Naam                string `json:"naam"`
	GoType              string `json:"goType"`              // bijv. "string", "*bool", "float64", "RelABSoort"
	Type                string `json:"type,omitempty"`      // V3.1: OAS 3.1 type ("string", "integer", "number", "boolean")
	Format              string `json:"format,omitempty"`    // V3.1: OAS 3.1 format ("date", "date-time", "float32", "float64", ...)
	Verplicht           bool   `json:"verplicht,omitempty"` // V3.1: true als het veld niet optioneel is (geen pointer-type)
	Enum                string `json:"enum,omitempty"`      // ref naar V3Enum.GoType als dit een enum-veld is
	Datatype            string `json:"datatype,omitempty"`  // ref naar V3Datatype.Naam als dit een custom datatype-veld is (bijv. "NLPostcode", "BSN")
	Ref                 string `json:"$ref,omitempty"`      // ref naar een referentielijst-items type (bijv. "LandenlijstLand"), analoog aan OAS 3.1 $ref
	Description         string `json:"description,omitempty"`
	Afgeleid            bool   `json:"afgeleid,omitempty"`
	AfleidingsregelTaal string `json:"afleidingsregelTaal,omitempty"`
	Afleidingsregel     string `json:"afleidingsregel,omitempty"`
}

// V3AfgeleidVeld beschrijft een afgeleid veld op representatie-niveau (entiteit, GE of relatie).
type V3AfgeleidVeld struct {
	Naam                string `json:"naam"`
	Description         string `json:"description,omitempty"`
	GoType              string `json:"goType"`
	AfleidingsregelTaal string `json:"afleidingsregelTaal,omitempty"`
	Afleidingsregel     string `json:"afleidingsregel,omitempty"`
	IsWeergaveVeld      bool   `json:"isWeergaveVeld,omitempty"`
	WeergaveVeld        bool   `json:"weergaveVeld,omitempty"` // legacy alias; keep for backward compatibility on older opgeslagen modellen
}
