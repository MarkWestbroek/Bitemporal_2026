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
	Versie       string       `json:"versie"`                 // semantische modelversie, bijv. "v1.0.0"
	Naam         string       `json:"naam,omitempty"`         // herkenbare modelnaam voor selectie in lijsten
	Beschrijving string       `json:"beschrijving,omitempty"` // korte omschrijving van het modeldoel
	Bron         string       `json:"bron,omitempty"`         // deprecated: gebruik wrapper.bron voor POST-metadata
	Indiener     string       `json:"indiener,omitempty"`     // deprecated: gebruik wrapper.indiener voor POST-metadata
	Datatypes    []V3Datatype `json:"datatypes,omitempty"`    // custom gegevenstypen
	Enums        []V3Enum     `json:"enums,omitempty"`        // enum definities
	Entiteiten   []V3Entiteit `json:"entiteiten"`             // top-level entiteiten
}

// V3Datatype beschrijft een custom gegevenstype met validatie en weergave.
type V3Datatype struct {
	Naam         string       `json:"naam"`
	Description  string       `json:"description,omitempty"`
	Basistype    string       `json:"basistype"`         // string, integer, number
	Format       string       `json:"format,omitempty"`  // bijv. "nl-postcode", "bsn"
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
type V3Weergave struct {
	Placeholder string `json:"placeholder,omitempty"`
	InputMask   string `json:"inputMask,omitempty"`
}

// V3Enum beschrijft een enum type met zijn waarden.
type V3Enum struct {
	GoType   string         `json:"goType"`
	BaseType string         `json:"baseType"`          // bijv. "string"
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
	IsMaterieel       bool                `json:"isMaterieel,omitempty"`
	Kleur             string              `json:"kleur,omitempty"`
	Meervoud          string              `json:"meervoud"`          // URL-padnaam, bijv. "as", "personen"
	Positie           *V3Positie          `json:"positie,omitempty"` // editor-layout positie (genegeerd door codegen)
	AfgeleideVelden   []V3AfgeleidVeld    `json:"afgeleideVelden,omitempty"`
	Gegevenselementen []V3Gegevenselement `json:"gegevenselementen,omitempty"`
	Relaties          []V3Relatie         `json:"relaties,omitempty"`
}

// V3Gegevenselement beschrijft een gegevenselement onder een entiteit.
type V3Gegevenselement struct {
	Naam            string     `json:"naam"` // bijv. "U", "V", "W"
	Description     string     `json:"description,omitempty"`
	Meervoud        string     `json:"meervoud"`        // URL-padnaam, bijv. "a-us"
	Momentvoorkomen string     `json:"momentvoorkomen"` // "enkelvoudig" of "meervoudig"
	IsMaterieel     bool       `json:"isMaterieel,omitempty"`
	Positie         *V3Positie `json:"positie,omitempty"`      // editor-layout positie (genegeerd door codegen)
	ID              string     `json:"id,omitempty"`           // persistente edge-id van entiteit→GE voor stabiele editor round-trips
	SourceHandle    string     `json:"sourceHandle,omitempty"` // verbindingspunt op de entiteit (genegeerd door codegen)
	TargetHandle    string     `json:"targetHandle,omitempty"` // verbindingspunt op het GE-node (genegeerd door codegen)
	Velden          []V3Veld   `json:"velden,omitempty"`
}

// V3Relatie beschrijft een relatie onder een entiteit.
type V3Relatie struct {
	Naam             string     `json:"naam"` // bijv. "Rel_A_B"
	Description      string     `json:"description,omitempty"`
	Meervoud         string     `json:"meervoud"`        // URL-padnaam, bijv. "rel-a-bs"
	Momentvoorkomen  string     `json:"momentvoorkomen"` // "enkelvoudig" of "meervoudig"
	IsMaterieel      bool       `json:"isMaterieel,omitempty"`
	DoelEntiteit     string     `json:"doelEntiteit"`               // typenaam van de doel-entiteit
	Positie          *V3Positie `json:"positie,omitempty"`          // editor-layout positie (genegeerd door codegen)
	ID               string     `json:"id,omitempty"`               // persistente edge-id van entiteit→relatie voor stabiele editor round-trips
	SourceHandle     string     `json:"sourceHandle,omitempty"`     // verbindingspunt op de entiteit→relatie edge (genegeerd door codegen)
	TargetHandle     string     `json:"targetHandle,omitempty"`     // verbindingspunt op de relatie (inkomend, genegeerd door codegen)
	DoelID           string     `json:"doelId,omitempty"`           // persistente edge-id van relatie→doel-entiteit voor stabiele editor round-trips
	DoelSourceHandle string     `json:"doelSourceHandle,omitempty"` // verbindingspunt op de relatie (uitgaand naar doel, genegeerd door codegen)
	DoelTargetHandle string     `json:"doelTargetHandle,omitempty"` // verbindingspunt op de doel-entiteit (genegeerd door codegen)
	Velden           []V3Veld   `json:"velden,omitempty"`
}

// V3Positie beschrijft de positie van een element in de UML-editor.
// Dit veld wordt gebruikt voor opslag en laden van editor-layout, en wordt
// genegeerd door de codegenerator.
type V3Positie struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// V3Veld beschrijft een inhoudsveld (geen plumbing) in een GE of relatie.
type V3Veld struct {
	Naam                string `json:"naam"`
	GoType              string `json:"goType"`         // bijv. "string", "*bool", "float64", "RelABSoort"
	Enum                string `json:"enum,omitempty"` // ref naar V3Enum.GoType als dit een enum-veld is
	Description         string `json:"description,omitempty"`
	Afgeleid            bool   `json:"afgeleid,omitempty"`
	AfleidingsregelTaal string `json:"afleidingsregelTaal,omitempty"`
	Afleidingsregel     string `json:"afleidingsregel,omitempty"`
}

// V3AfgeleidVeld beschrijft een entiteit-niveau afgeleid veld.
type V3AfgeleidVeld struct {
	Naam                string `json:"naam"`
	Description         string `json:"description,omitempty"`
	GoType              string `json:"goType"`
	AfleidingsregelTaal string `json:"afleidingsregelTaal,omitempty"`
	Afleidingsregel     string `json:"afleidingsregel,omitempty"`
}
