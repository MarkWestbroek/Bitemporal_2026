package handlers

import (
	"net/http"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

var (
	timeType = reflect.TypeOf(time.Time{})
	dateType = reflect.TypeOf(model.Date{})
)

type vizSchemaChildDTO struct {
	Rolnaam         string `json:"rolnaam"`
	JSONRolnaam     string `json:"jsonRolnaam,omitempty"`
	Doeltype        string `json:"doeltype"`
	Momentvoorkomen string `json:"momentvoorkomen"`
}

type vizSchemaTypeDTO struct {
	Typenaam                  string                     `json:"typenaam"`
	Klassenaam                string                     `json:"klassenaam"`
	Description               string                     `json:"description,omitempty"`
	Metatype                  model.Metatype             `json:"metatype"`
	GESubtype                 string                     `json:"ge_subtype,omitempty"`               // hub, data, aanvang, einde (leeg voor entiteiten en legacy)
	IsMaterieel               bool                       `json:"isMaterieel,omitempty"`              // of dit type een materiële tijdlijn heeft
	EntiteitSubtype           string                     `json:"entiteitSubtype,omitempty"`          // bijv. "referentielijst", "referentielijst_item"
	RelatieSubtype            string                     `json:"relatieSubtype,omitempty"`           // bijv. "referentielijst_items"
	ReferentielijstInstantie  string                     `json:"referentielijstInstantie,omitempty"` // systeemnaam van de gebonden referentielijst-instantie
	DoelEntiteit              string                     `json:"doelEntiteit,omitempty"`             // voor relaties: de doel-entiteit typenaam
	Domein                    string                     `json:"domein,omitempty"`                   // domeingroep (bijv. "np-loc")
	Kleur                     string                     `json:"kleur,omitempty"`
	Veldnaam                  string                     `json:"veldnaam"`
	Padnaam                   string                     `json:"padnaam,omitempty"`
	Meervoud                  string                     `json:"meervoud,omitempty"`
	Velden                    []vizSchemaFieldDTO        `json:"velden,omitempty"`
	Tabelnaam                 string                     `json:"tabelnaam"`
	IDKolom                   string                     `json:"idKolom"`
	IDAutoIncrement           bool                       `json:"idAutoIncrement,omitempty"`
	HeeftPFK                  bool                       `json:"heeftPFK"`
	EntiteitIDKolom           string                     `json:"entiteitIDKolom,omitempty"`
	SecondaireEntiteitIDKolom string                     `json:"secondaireEntiteitIDKolom,omitempty"`
	BovenliggendTypenaam      string                     `json:"bovenliggendTypenaam,omitempty"` // voor plumbing-types: de entiteit waar dit type bij hoort
	Momentvoorkomen           string                     `json:"momentvoorkomen,omitempty"`
	Onderliggende             []vizSchemaChildDTO        `json:"onderliggende,omitempty"`
	AfgeleideVelden           []vizSchemaAfgeleidVeldDTO `json:"afgeleideVelden,omitempty"`
}

type vizSchemaResponse struct {
	Versie string             `json:"versie"`
	Types  []vizSchemaTypeDTO `json:"types"`
}

type vizSchemaAfgeleidVeldDTO struct {
	Naam                string `json:"naam"`
	Description         string `json:"description,omitempty"`
	GoType              string `json:"goType,omitempty"`
	AfleidingsregelTaal string `json:"afleidingsregelTaal,omitempty"`
	Afleidingsregel     string `json:"afleidingsregel,omitempty"`
	IsWeergaveVeld      bool   `json:"isWeergaveVeld,omitempty"`
}

type vizSchemaFieldDTO struct {
	Naam          string   `json:"naam"`
	Description   string   `json:"description,omitempty"`
	Type          string   `json:"type"`
	Format        string   `json:"format,omitempty"`
	Enum          []string `json:"enum,omitempty"`
	Verplicht     bool     `json:"verplicht"`
	AutoIncrement bool     `json:"autoIncrement,omitempty"`
	Ref           string   `json:"ref,omitempty"`      // referentielijst-items verwijzing (bijv. "LandenlijstLand")
	Datatype      string   `json:"datatype,omitempty"` // custom gegevenstype (bijv. "NLPostcode", "BSN")
}

// hasBunOption controleert of een bun-struct-tag een bepaalde optie bevat (bijv. "autoincrement").
func hasBunOption(tag, option string) bool {
	for _, part := range strings.Split(tag, ",") {
		if strings.EqualFold(strings.TrimSpace(part), option) {
			return true
		}
	}
	return false
}

// parseJSONTag haalt veldnaam en omitempty-informatie uit een json-tag.
// skip=true betekent dat het veld niet naar de API moet (bijv. json:"-").
func parseJSONTag(tag string) (name string, hasOmitEmpty bool, skip bool) {
	if tag == "-" {
		return "", false, true
	}
	if tag == "" {
		return "", false, false
	}
	parts := strings.Split(tag, ",")
	name = strings.TrimSpace(parts[0])
	for i := 1; i < len(parts); i++ {
		if strings.TrimSpace(parts[i]) == "omitempty" {
			hasOmitEmpty = true
			break
		}
	}
	if name == "-" {
		return "", hasOmitEmpty, true
	}
	return name, hasOmitEmpty, false
}

func enumValuesFromSchemaTag(tag string) []string {
	if tag == "" {
		return nil
	}
	for _, part := range strings.Split(tag, ",") {
		trimmed := strings.TrimSpace(part)
		if !strings.HasPrefix(trimmed, "enum=") {
			continue
		}
		rawValues := strings.Split(strings.TrimPrefix(trimmed, "enum="), "|")
		values := make([]string, 0, len(rawValues))
		for _, rawValue := range rawValues {
			value := strings.TrimSpace(rawValue)
			if value != "" {
				values = append(values, value)
			}
		}
		if len(values) > 0 {
			return values
		}
	}
	return nil
}

// resolveEnumWaarden bepaalt de enum-waarden voor een struct field.
// Probeert achtereenvolgens:
// 1. Expliciete pipe-separated waarden uit de schema tag (bijv. "enum=A|B|C")
// 2. Type-naam uit de schema tag opzoeken in EnumWaarden registry (bijv. "enum=Bereikbaarheidssoort")
// 3. Het Go-type van het veld opzoeken in EnumWaarden registry (voor _Input structs zonder schema tag)
func resolveEnumWaarden(f reflect.StructField) []string {
	tagValues := enumValuesFromSchemaTag(f.Tag.Get("schema"))
	if len(tagValues) > 1 {
		// Meerdere waarden: dit zijn de echte enum-waarden (bijv. "Optie A|Optie B")
		return tagValues
	}
	if len(tagValues) == 1 {
		// Enkele waarde: mogelijk een type-naam (bijv. "Bereikbaarheidssoort")
		if waarden, ok := model.EnumWaarden[tagValues[0]]; ok {
			return waarden
		}
		return tagValues
	}
	// Geen schema tag: probeer het Go-type op te zoeken als het een named string type is
	ft := f.Type
	for ft.Kind() == reflect.Ptr {
		ft = ft.Elem()
	}
	if ft.Kind() == reflect.String && ft.Name() != "string" && ft.Name() != "" {
		if waarden, ok := model.EnumWaarden[ft.Name()]; ok {
			return waarden
		}
	}
	return nil
}

// schemaTypeVoorReflectType mapt Go-types op API-typen en optionele formats.
func schemaTypeVoorReflectType(t reflect.Type) (string, string) {
	if t == nil {
		return "string", ""
	}
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}

	isArray := false
	for t.Kind() == reflect.Slice || t.Kind() == reflect.Array {
		isArray = true
		t = t.Elem()
		for t.Kind() == reflect.Ptr {
			t = t.Elem()
		}
	}

	if t == timeType {
		if isArray {
			return "string", "array:date-time"
		}
		return "string", "date-time"
	}

	if t == dateType {
		if isArray {
			return "string", "array:date"
		}
		return "string", "date"
	}

	if meta, ok := model.MetaRegistry.GetTypeMeta(t.Name()); ok {
		if isArray {
			return meta.Typenaam, "array"
		}
		return meta.Typenaam, ""
	}

	switch t.Kind() {
	case reflect.Bool:
		if isArray {
			return "boolean", "array"
		}
		return "boolean", ""
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		if isArray {
			return "integer", "array"
		}
		return "integer", ""
	case reflect.Float32:
		if isArray {
			return "number", "array:float32"
		}
		return "number", "float32"
	case reflect.Float64:
		if isArray {
			return "number", "array:float64"
		}
		return "number", "float64"
	case reflect.String:
		if isArray {
			return "string", "array"
		}
		return "string", ""
	default:
		if isArray {
			return t.Name(), "array"
		}
		if t.Name() != "" {
			return t.Name(), ""
		}
		return "string", ""
	}
}

// jsonNaamVoorBunKolom vertaalt een DB-kolomnaam (bun-tag) naar de bijbehorende
// JSON-veldnaam in de representatie-struct. De frontend kent alleen JSON-namen,
// dus IDKolom en EntiteitIDKolom moeten hiermee vertaald worden.
// Retourneert de originele kolomnaam als er geen match gevonden wordt.
func jsonNaamVoorBunKolom(meta model.TypeMeta, kolomnaam string) string {
	if kolomnaam == "" {
		return ""
	}
	rep := meta.Factory()
	if rep == nil {
		return kolomnaam
	}
	t := reflect.TypeOf(rep)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		bunTag := f.Tag.Get("bun")
		if bunTag == "" || bunTag == "-" {
			continue
		}
		bunNaam := strings.Split(bunTag, ",")[0]
		if strings.EqualFold(bunNaam, kolomnaam) {
			jsonNaam, _, skip := parseJSONTag(f.Tag.Get("json"))
			if !skip && jsonNaam != "" {
				return jsonNaam
			}
		}
	}
	return kolomnaam
}

// reflectedVeldenVoorMeta leest de representatie-struct via reflectie uit
// en zet die om naar formuliervelden voor de frontend.
// Technische tijdvelden worden expliciet weggefilterd.
func reflectedVeldenVoorMeta(meta model.TypeMeta) []vizSchemaFieldDTO {
	ignore := map[string]struct{}{
		"opvoer":  {},
		"afvoer":  {},
		"aanvang": {},
		"einde":   {},
	}

	rep := meta.Factory()
	if rep == nil {
		return nil
	}
	t := reflect.TypeOf(rep)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return nil
	}

	velden := make([]vizSchemaFieldDTO, 0, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.PkgPath != "" {
			// Alleen exported velden meenemen.
			continue
		}

		name, hasOmitEmpty, skip := parseJSONTag(f.Tag.Get("json"))
		if skip {
			continue
		}
		if name == "" {
			if f.Anonymous {
				continue
			}
			name = strings.ToLower(f.Name)
		}
		if _, shouldSkip := ignore[strings.ToLower(name)]; shouldSkip {
			continue
		}

		// Bepaal het veldtype en format voor de schema-API.
		// We gebruiken de veldtype uit de JSON-tag als die er is, anders mappen we het Go-type.
		veldType, format := schemaTypeVoorReflectType(f.Type)
		enum := resolveEnumWaarden(f)
		description := strings.TrimSpace(f.Tag.Get("schema_desc"))

		// autoIncrement: via bun-tag óf als het veld de IDKolom is bij een type met
		// relatieve autoincrement. Dit laatste is nodig omdat _Input structs (Factory)
		// geen bun-tags hebben, maar de frontend wel moet weten dat het veld
		// automatisch wordt opgehoogd en dus niet in formulieren getoond hoeft te worden.
		isAutoInc := hasBunOption(f.Tag.Get("bun"), "autoincrement") ||
			(name == meta.IDKolom && meta.RelatieveAutoincrement)

		// Referentielijst-verwijzing of custom datatype uit schema tag.
		var ref, datatype string
		schemaTag := f.Tag.Get("schema")
		if strings.HasPrefix(schemaTag, "ref:") {
			ref = strings.TrimPrefix(schemaTag, "ref:")
		} else if strings.HasPrefix(schemaTag, "datatype:") {
			datatype = strings.TrimPrefix(schemaTag, "datatype:")
		}

		velden = append(velden, vizSchemaFieldDTO{
			Naam:          name,
			Description:   description,
			Type:          veldType,
			Format:        format,
			Enum:          enum,
			Verplicht:     !hasOmitEmpty,
			AutoIncrement: isAutoInc,
			Ref:           ref,
			Datatype:      datatype,
		})
	}

	return velden
}

func momentvoorkomenNaarString(m model.Momentvoorkomen) string {
	if m == model.Enkelvoudig {
		return "enkelvoudig"
	}
	return "meervoudig"
}

// vizSchemaTypeDTOVanMeta bouwt een vizSchemaTypeDTO uit een TypeMeta entry.
// Herbruikbaar door zowel het viz/schema endpoint als schema/model/code.
func vizSchemaTypeDTOVanMeta(meta model.TypeMeta) vizSchemaTypeDTO {
	item := vizSchemaTypeDTO{
		Typenaam:    meta.Typenaam,
		Klassenaam:  meta.Klassenaam,
		Description: meta.Description,
		Metatype:    meta.Metatype,
		GESubtype:   string(meta.GESubtype),
		IsMaterieel: meta.IsMaterieel,
		Kleur:       meta.Kleur,
		Veldnaam:    meta.Veldnaam,
		Padnaam:     meta.Padnaam,
		Meervoud:    meta.Meervoud,
		Velden:      reflectedVeldenVoorMeta(meta),
		Tabelnaam:   meta.Tabelnaam,
		// Kolom-namen vertalen naar JSON-veldnamen zodat de frontend ze direct als property kan gebruiken.
		IDKolom:                   jsonNaamVoorBunKolom(meta, meta.IDKolom),
		IDAutoIncrement:           meta.RelatieveAutoincrement,
		HeeftPFK:                  meta.HeeftPFK,
		EntiteitIDKolom:           jsonNaamVoorBunKolom(meta, meta.EntiteitIDKolom),
		SecondaireEntiteitIDKolom: jsonNaamVoorBunKolom(meta, meta.SecondaireEntiteitIDKolom),
		BovenliggendTypenaam:      meta.BovenliggendTypenaam,
		// V3-velden: subtypes, referentielijst-info, domein
		EntiteitSubtype:          string(meta.EntiteitSubtype),
		RelatieSubtype:           string(meta.RelatieSubtype),
		ReferentielijstInstantie: meta.ReferentielijstInstantie,
		Domein:                   meta.Domein,
	}

	// DoelEntiteit: afleiden uit secondaire ID-kolom (bijv. "locatie_id" → "Locatie")
	if meta.Metatype == model.MetatypeRelatie && meta.SecondaireEntiteitIDKolom != "" {
		item.DoelEntiteit = doelEntiteitVanSecondaireKolom(meta.SecondaireEntiteitIDKolom)
	}

	// Achterwaartse compatibiliteit: oudere hardcoded entries hebben nog geen expliciete Meervoud.
	if item.Meervoud == "" {
		item.Meervoud = meta.Padnaam
	}

	if meta.Metatype != model.MetatypeEntiteit {
		item.Momentvoorkomen = momentvoorkomenNaarString(meta.Momentvoorkomen)
	}

	if len(meta.OnderliggendeGegevenselementen) > 0 {
		children := make([]vizSchemaChildDTO, 0, len(meta.OnderliggendeGegevenselementen))
		for _, child := range meta.OnderliggendeGegevenselementen {
			children = append(children, vizSchemaChildDTO{
				Rolnaam:         child.Rolnaam,
				JSONRolnaam:     child.JSONRolnaam,
				Doeltype:        child.Doeltype,
				Momentvoorkomen: momentvoorkomenNaarString(child.Momentvoorkomen),
			})
		}
		item.Onderliggende = children
	}

	if len(meta.AfgeleideVelden) > 0 {
		avs := make([]vizSchemaAfgeleidVeldDTO, 0, len(meta.AfgeleideVelden))
		for _, av := range meta.AfgeleideVelden {
			avs = append(avs, vizSchemaAfgeleidVeldDTO{
				Naam:                av.Naam,
				Description:         av.Description,
				GoType:              av.GoType,
				AfleidingsregelTaal: av.AfleidingsregelTaal,
				Afleidingsregel:     av.Afleidingsregel,
				IsWeergaveVeld:      av.IsWeergaveVeld,
			})
		}
		item.AfgeleideVelden = avs
	}

	return item
}

// doelEntiteitVanSecondaireKolom leidt de doel-entiteit typenaam af uit de secondaire ID-kolom.
// Bijv. "locatie_id" → itereer MetaRegistry op zoek naar entiteit met IDKolom "id" en Tabelnaam "locatie".
func doelEntiteitVanSecondaireKolom(kolom string) string {
	// Heuristiek: zoek entiteiten waarvan de EntiteitIDKolom of tabelnaam + "_id" matcht.
	for _, meta := range model.MetaRegistry {
		if meta.Metatype != model.MetatypeEntiteit {
			continue
		}
		verwacht := meta.Tabelnaam + "_id"
		if verwacht == kolom {
			return meta.Typenaam
		}
	}
	return ""
}

// BouwFlatTypeRegistry bouwt een platte lijst van vizSchemaTypeDTO's voor alle types in de MetaRegistry.
// Als domein niet leeg is wordt gefilterd op types die bij dat domein horen of geen domein hebben.
func BouwFlatTypeRegistry(domein string) []vizSchemaTypeDTO {
	typeNamen := make([]string, 0, len(model.MetaRegistry))
	for typeNaam := range model.MetaRegistry {
		typeNamen = append(typeNamen, typeNaam)
	}
	sort.Strings(typeNamen)

	items := make([]vizSchemaTypeDTO, 0, len(typeNamen))
	for _, typeNaam := range typeNamen {
		meta, ok := model.MetaRegistry.GetTypeMeta(typeNaam)
		if !ok {
			continue
		}
		// Domeinfilter: als domein is opgegeven, alleen types die bij dat domein of het register-domein horen tonen.
		if domein != "" && meta.Domein != "" && meta.Domein != domein && meta.Domein != "register" {
			continue
		}
		items = append(items, vizSchemaTypeDTOVanMeta(meta))
	}
	return items
}

func MaakVizSchemaHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Alle types, ongeacht domein (vizSchema is domein-agnostisch).
		items := BouwFlatTypeRegistry("")

		c.JSON(http.StatusOK, vizSchemaResponse{
			Versie: "v1",
			Types:  items,
		})
	}
}
