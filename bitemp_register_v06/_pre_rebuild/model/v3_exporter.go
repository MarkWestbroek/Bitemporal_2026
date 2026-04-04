package model

import (
	"reflect"
	"sort"
	"strings"
	"time"
)

// plumbing-veldnamen die niet als inhoudsveld in V3 verschijnen
var plumbingVelden = map[string]struct{}{
	"bun.BaseModel":      {},
	"A_ID":               {},
	"B_ID":               {},
	"Rel_ID":             {},
	"Versie":             {},
	"Opvoer":             {},
	"Afvoer":             {},
	"Datum":              {},
	"Referentielijst_ID": {},
	"Land_ID":            {},
}

// isPlumbingField bepaalt of een struct-veld een plumbingveld is (niet inhoudelijk).
func isPlumbingField(f reflect.StructField) bool {
	if f.Anonymous {
		return true // bun.BaseModel
	}
	_, ok := plumbingVelden[f.Name]
	if ok {
		return true
	}
	// Parent-relatie velden (json:"-")
	jsonTag := f.Tag.Get("json")
	if jsonTag == "-" {
		return true
	}
	// Bun relatie-velden (has-many, belongs-to)
	bunTag := f.Tag.Get("bun")
	if strings.Contains(bunTag, "rel:") {
		return true
	}
	// PK-velden in _Data structs (ent_id, rel_id, versie) zijn plumbing
	if strings.Contains(bunTag, ",pk") {
		return true
	}
	return false
}

// goTypeName geeft de Go-type string voor een reflect.Type, zoals "*bool", "string", "float64".
func goTypeName(t reflect.Type) string {
	if t.Kind() == reflect.Ptr {
		return "*" + goTypeName(t.Elem())
	}
	// Custom types in ons model
	if t == reflect.TypeOf(Date{}) {
		return "Date"
	}
	if t == reflect.TypeOf(time.Time{}) {
		return "time.Time"
	}
	// Named types (enums): gebruik de type-naam
	if t.Name() != "" && t.PkgPath() != "" {
		return t.Name()
	}
	return t.Kind().String()
}

// isEnumType bepaalt of een Go-type een enum is (named string type in het model package).
func isEnumType(t reflect.Type) bool {
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t.Kind() == reflect.String && t.Name() != "string" && t.Name() != ""
}

// runtimeVanMeta bouwt een V3Runtime op basis van de TypeMeta.
// Retourneert nil als er geen relevante runtime-info is (bijv. pure modeldefinitie zonder deployment).
func runtimeVanMeta(meta TypeMeta) *V3Runtime {
	rt := &V3Runtime{
		Veldnaam:               meta.Veldnaam,
		Padnaam:                meta.Padnaam,
		Tabelnaam:              meta.Tabelnaam,
		IDKolom:                meta.IDKolom,
		HeeftPFK:               meta.HeeftPFK,
		EntiteitIDKolom:        meta.EntiteitIDKolom,
		Klassenaam:             meta.Klassenaam,
		RelatieveAutoincrement: meta.RelatieveAutoincrement,
	}
	// Retourneer nil als alles leeg is (geen runtime-info beschikbaar)
	if rt.Veldnaam == "" && rt.Padnaam == "" && rt.Tabelnaam == "" && rt.IDKolom == "" &&
		!rt.HeeftPFK && rt.EntiteitIDKolom == "" && rt.Klassenaam == "" && !rt.RelatieveAutoincrement {
		return nil
	}
	return rt
}

// oasTypeVoorGoType converteert een reflect.Type naar OAS 3.1 type en format.
// Analoog aan schemaTypeVoorReflectType in viz_schema_handler.go, maar dan
// in het model package zodat de V3 exporter er toegang toe heeft.
func oasTypeVoorGoType(t reflect.Type) (string, string) {
	if t == nil {
		return "string", ""
	}
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t == reflect.TypeOf(time.Time{}) {
		return "string", "date-time"
	}
	if t == reflect.TypeOf(Date{}) {
		return "string", "date"
	}
	switch t.Kind() {
	case reflect.Bool:
		return "boolean", ""
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "integer", ""
	case reflect.Float32:
		return "number", "float32"
	case reflect.Float64:
		return "number", "float64"
	case reflect.String:
		return "string", ""
	default:
		if t.Name() != "" {
			return t.Name(), ""
		}
		return "string", ""
	}
}

// extractContentFields extraheert de inhoudsvelden uit een _Data struct.
func extractContentFields(meta TypeMeta) []V3Veld {
	dataMeta, hasData := MetaRegistry.GetTypeMeta(meta.DataTypenaam)
	if !hasData {
		return nil
	}
	rep := dataMeta.Factory()
	if rep == nil {
		return nil
	}
	t := reflect.TypeOf(rep)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}

	var velden []V3Veld
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if isPlumbingField(f) {
			continue
		}
		veld := V3Veld{
			Naam:   jsonFieldName(f),
			GoType: goTypeName(f.Type),
		}
		// V3.1: OAS 3.1 type en format
		oasType, oasFormat := oasTypeVoorGoType(f.Type)
		veld.Type = oasType
		veld.Format = oasFormat
		// V3.1: verplicht = geen pointer-type en geen omitempty
		veld.Verplicht = f.Type.Kind() != reflect.Ptr && !strings.Contains(f.Tag.Get("json"), "omitempty")
		if isEnumType(f.Type) {
			ft := f.Type
			for ft.Kind() == reflect.Ptr {
				ft = ft.Elem()
			}
			veld.Enum = ft.Name()
		}
		// Custom schema-referenties uit schema tag:
		// - schema:"datatype:NLPostcode" → V3Veld.Datatype (custom gegevenstype)
		// - schema:"ref:LandenlijstLand"  → V3Veld.Ref (referentielijst-items, analoog aan OAS 3.1 $ref)
		schemaTag := f.Tag.Get("schema")
		if strings.HasPrefix(schemaTag, "datatype:") {
			veld.Datatype = strings.TrimPrefix(schemaTag, "datatype:")
		} else if strings.HasPrefix(schemaTag, "ref:") {
			veld.Ref = strings.TrimPrefix(schemaTag, "ref:")
		}
		desc := strings.TrimSpace(f.Tag.Get("schema_desc"))
		if desc != "" {
			veld.Description = desc
		}
		velden = append(velden, veld)
	}
	return velden
}

// jsonFieldName haalt de JSON-veldnaam uit een struct field.
func jsonFieldName(f reflect.StructField) string {
	tag := f.Tag.Get("json")
	if tag == "" || tag == "-" {
		return strings.ToLower(f.Name)
	}
	parts := strings.Split(tag, ",")
	if parts[0] != "" && parts[0] != "-" {
		return parts[0]
	}
	return strings.ToLower(f.Name)
}

// convertAfgeleideVelden converteert MetaRegistry AfgeleidVeld entries naar V3AfgeleidVeld entries.
func convertAfgeleideVelden(src []AfgeleidVeld) []V3AfgeleidVeld {
	if len(src) == 0 {
		return nil
	}
	result := make([]V3AfgeleidVeld, len(src))
	for i, av := range src {
		result[i] = V3AfgeleidVeld{
			Naam:                av.Naam,
			Description:         av.Description,
			GoType:              av.GoType,
			AfleidingsregelTaal: av.AfleidingsregelTaal,
			Afleidingsregel:     av.Afleidingsregel,
			IsWeergaveVeld:      av.IsWeergaveVeld,
		}
	}
	return result
}

func datatypeDomeinScore(datatypeDomein, filterDomein string) int {
	d := strings.TrimSpace(datatypeDomein)
	f := strings.TrimSpace(filterDomein)

	if f == "" {
		if d == "" {
			return 1
		}
		return 2
	}

	if d == f {
		return 3
	}
	if d == "register" {
		return 2
	}
	if d == "" {
		return 1
	}
	return 0
}

// filterEnDedupDatatypes selecteert datatypes op basis van domein en verwijdert dubbelen op naam.
// Bij dubbele namen krijgt een entry met expliciete domeinlabeling voorrang boven een lege domeinwaarde.
func filterEnDedupDatatypes(input []V3Datatype, domein string) []V3Datatype {
	if len(input) == 0 {
		return nil
	}

	gekozen := make(map[string]V3Datatype)
	gekozenScore := make(map[string]int)
	volgorde := make([]string, 0, len(input))

	for _, dt := range input {
		naam := strings.TrimSpace(dt.Naam)
		if naam == "" {
			continue
		}

		score := datatypeDomeinScore(dt.Domein, domein)
		if score == 0 {
			continue
		}

		if bestaand, ok := gekozen[naam]; ok {
			if score > gekozenScore[naam] {
				gekozen[naam] = dt
				gekozenScore[naam] = score
			} else {
				_ = bestaand
			}
			continue
		}

		gekozen[naam] = dt
		gekozenScore[naam] = score
		volgorde = append(volgorde, naam)
	}

	result := make([]V3Datatype, 0, len(volgorde))
	for _, naam := range volgorde {
		result = append(result, gekozen[naam])
	}
	return result
}

// ExportMetaRegistryToV3 bouwt een V3Model op basis van de huidige MetaRegistry.
// Als domein niet leeg is, worden alleen entiteiten uit dat domein geëxporteerd.
// Wordt gebruikt door de GET /api/schema/model endpoint.
func ExportMetaRegistryToV3(domein ...string) V3Model {
	var filterDomein string
	if len(domein) > 0 {
		filterDomein = domein[0]
	}

	model := V3Model{
		Versie:    "v3",
		Datatypes: filterEnDedupDatatypes(DatatypeRegistry, filterDomein),
	}

	// Verzamel enum-types en maak een set om dubbelen te voorkomen
	enumsSeen := map[string]bool{}

	// Verzamel entiteiten — gesorteerd op typenaam voor deterministische output
	sortedKeys := make([]string, 0, len(MetaRegistry))
	for key := range MetaRegistry {
		sortedKeys = append(sortedKeys, key)
	}
	sort.Strings(sortedKeys)

	for _, key := range sortedKeys {
		meta := MetaRegistry[key]
		if meta.Metatype != MetatypeEntiteit {
			continue
		}
		// Filter op domein als opgegeven; "register"-domein wordt altijd meege-exporteerd
		if filterDomein != "" && meta.Domein != filterDomein && meta.Domein != "register" {
			continue
		}

		ent := V3Entiteit{
			Typenaam:        meta.Typenaam,
			Description:     meta.Description,
			Domein:          meta.Domein,
			EntiteitSubtype: meta.EntiteitSubtype,
			IsMaterieel:     meta.IsMaterieel,
			Kleur:           meta.Kleur,
			Meervoud:        meta.Padnaam,
			Runtime:         runtimeVanMeta(meta),
			AfgeleideVelden: convertAfgeleideVelden(meta.AfgeleideVelden),
		}
		if meta.Layout != nil {
			ent.Positie = meta.Layout.Positie
		}

		// Verwerk onderliggende gegevenselementen en relaties
		for _, child := range meta.OnderliggendeGegevenselementen {
			childMeta, ok := MetaRegistry.GetTypeMeta(child.Doeltype)
			if !ok {
				continue
			}
			// Skip materiële plumbing (Aanvang/Einde op entiteitsniveau)
			if childMeta.GESubtype == GESubtypeAanvang || childMeta.GESubtype == GESubtypeEinde ||
				child.Doeltype == meta.Typenaam+"_Aanvang" || child.Doeltype == meta.Typenaam+"_Einde" {
				continue
			}

			if childMeta.Metatype == MetatypeRelatie {
				rel := v3RelatieVanMeta(childMeta, child)
				collectEnums(rel.Velden, &model.Enums, enumsSeen)
				ent.Relaties = append(ent.Relaties, rel)
			} else {
				ge := v3GegevenseElementVanMeta(childMeta, child)
				collectEnums(ge.Velden, &model.Enums, enumsSeen)
				ent.Gegevenselementen = append(ent.Gegevenselementen, ge)
			}
		}

		model.Entiteiten = append(model.Entiteiten, ent)
	}

	// Verzamel referentielijst-instanties uit MetaRegistry entries met ReferentielijstInstantie.
	instantieSeen := map[string]bool{}
	for _, key := range sortedKeys {
		meta := MetaRegistry[key]
		if meta.ReferentielijstInstantie != "" && !instantieSeen[meta.ReferentielijstInstantie] {
			instantieSeen[meta.ReferentielijstInstantie] = true
			inst := V3ReferentielijstInstantie{
				Systeemnaam: meta.ReferentielijstInstantie,
			}
			if info, ok := ReferentielijstInstantieRegistry[meta.ReferentielijstInstantie]; ok {
				inst.Naam = info.Naam
				inst.Omschrijving = info.Omschrijving
				if info.Layout != nil {
					inst.Positie = info.Layout.Positie
				}
			}
			model.ReferentielijstInstanties = append(model.ReferentielijstInstanties, inst)
		}
	}

	return model
}

// FilterV3ModelStrictByDomein verwijdert alles buiten het opgegeven domein uit een reeds geëxporteerd V3 model.
//
// Doel:
// - entiteiten: alleen meta.Domein == domein
// - enums: alleen enums die nog gebruikt worden door overgebleven entiteiten
// - referentielijstInstanties: alleen instanties die nog gebruikt worden in relaties
//
// Datatypes worden bewust niet extra gefilterd, omdat domeinspecifieke velden
// vaak register-datatypes (zoals BSN/NLPostcode) gebruiken.
func FilterV3ModelStrictByDomein(v3 V3Model, domein string) V3Model {
	filterDomein := strings.TrimSpace(domein)
	if filterDomein == "" {
		return v3
	}

	filteredEntiteiten := make([]V3Entiteit, 0, len(v3.Entiteiten))
	for _, ent := range v3.Entiteiten {
		meta, ok := MetaRegistry.GetTypeMeta(ent.Typenaam)
		if !ok {
			continue
		}
		if strings.TrimSpace(meta.Domein) == filterDomein {
			filteredEntiteiten = append(filteredEntiteiten, ent)
		}
	}
	v3.Entiteiten = filteredEntiteiten

	usedEnums := map[string]bool{}
	usedInstanties := map[string]bool{}
	for _, ent := range v3.Entiteiten {
		for _, ge := range ent.Gegevenselementen {
			for _, veld := range ge.Velden {
				if veld.Enum != "" {
					usedEnums[veld.Enum] = true
				}
			}
		}
		for _, rel := range ent.Relaties {
			if rel.ReferentielijstInstantie != "" {
				usedInstanties[rel.ReferentielijstInstantie] = true
			}
			for _, veld := range rel.Velden {
				if veld.Enum != "" {
					usedEnums[veld.Enum] = true
				}
			}
		}
	}

	filteredEnums := make([]V3Enum, 0, len(v3.Enums))
	for _, e := range v3.Enums {
		if usedEnums[e.GoType] {
			filteredEnums = append(filteredEnums, e)
		}
	}
	v3.Enums = filteredEnums

	filteredInstanties := make([]V3ReferentielijstInstantie, 0, len(v3.ReferentielijstInstanties))
	for _, inst := range v3.ReferentielijstInstanties {
		if usedInstanties[inst.Systeemnaam] {
			filteredInstanties = append(filteredInstanties, inst)
		}
	}
	v3.ReferentielijstInstanties = filteredInstanties

	return v3
}

// v3GegevenseElementVanMeta maakt een V3Gegevenselement van een hub-meta.
func v3GegevenseElementVanMeta(meta TypeMeta, child OnderliggendGegevenselement) V3Gegevenselement {
	ge := V3Gegevenselement{
		Naam:            geNaamVanTypenaam(meta),
		Description:     meta.Description,
		Domein:          meta.Domein,
		Meervoud:        meta.Padnaam,
		Momentvoorkomen: momentvoorkomenString(child.Momentvoorkomen),
		IsMaterieel:     meta.IsMaterieel,
		Velden:          extractContentFields(meta),
		Runtime:         runtimeVanMeta(meta),
		AfgeleideVelden: convertAfgeleideVelden(meta.AfgeleideVelden),
	}
	if meta.Layout != nil {
		ge.Positie = meta.Layout.Positie
		ge.ID = meta.Layout.EdgeID
		ge.SourceHandle = meta.Layout.SourceHandle
		ge.TargetHandle = meta.Layout.TargetHandle
	}
	return ge
}

// v3RelatieVanMeta maakt een V3Relatie van een relatie-hub-meta.
func v3RelatieVanMeta(meta TypeMeta, child OnderliggendGegevenselement) V3Relatie {
	rel := V3Relatie{
		Naam:                     meta.Typenaam,
		Description:              meta.Description,
		Domein:                   meta.Domein,
		RelatieSubtype:           meta.RelatieSubtype,
		ReferentielijstInstantie: meta.ReferentielijstInstantie,
		Meervoud:                 meta.Padnaam,
		Momentvoorkomen:          momentvoorkomenString(child.Momentvoorkomen),
		IsMaterieel:              meta.IsMaterieel,
		DoelEntiteit:             doelEntiteitVanRelatie(meta),
		Velden:                   extractContentFields(meta),
		Runtime:                  runtimeVanMeta(meta),
		AfgeleideVelden:          convertAfgeleideVelden(meta.AfgeleideVelden),
	}
	if meta.Layout != nil {
		rel.Positie = meta.Layout.Positie
		rel.ID = meta.Layout.EdgeID
		rel.SourceHandle = meta.Layout.SourceHandle
		rel.TargetHandle = meta.Layout.TargetHandle
		rel.DoelID = meta.Layout.DoelEdgeID
		rel.DoelSourceHandle = meta.Layout.DoelSourceHandle
		rel.DoelTargetHandle = meta.Layout.DoelTargetHandle
	}
	return rel
}

// geNaamVanTypenaam haalt de korte GE-naam uit de typenaam.
// "A_U" → "U", "B_X" → "X", "A_W" → "W"
func geNaamVanTypenaam(meta TypeMeta) string {
	parts := strings.Split(meta.Typenaam, "_")
	if len(parts) >= 2 {
		return parts[len(parts)-1]
	}
	return meta.Typenaam
}

// doelEntiteitVanRelatie leidt de doelentiteit af uit SecondaireEntiteitIDKolom.
// "b_id" → "B", "a_id" → "A", "land_id" → "Land"
func doelEntiteitVanRelatie(meta TypeMeta) string {
	col := meta.SecondaireEntiteitIDKolom
	if col == "" {
		return ""
	}
	// "land_id" → "land" → zoek entiteit op in MetaRegistry
	name := strings.TrimSuffix(col, "_id")
	for _, m := range MetaRegistry {
		if m.Metatype == MetatypeEntiteit && strings.EqualFold(m.Tabelnaam, name) {
			return m.Typenaam
		}
	}
	// Fallback: eerste letter uppercase (werkt voor "a"→"A", "b"→"B")
	return strings.ToUpper(name[:1]) + name[1:]
}

// momentvoorkomenString converteert Momentvoorkomen naar string.
func momentvoorkomenString(m Momentvoorkomen) string {
	if m == Enkelvoudig {
		return "enkelvoudig"
	}
	return "meervoudig"
}

// collectEnums verzamelt enum-types uit de velden en voegt ze toe aan de enums-lijst.
func collectEnums(velden []V3Veld, enums *[]V3Enum, seen map[string]bool) {
	for _, v := range velden {
		if v.Enum == "" || seen[v.Enum] {
			continue
		}
		seen[v.Enum] = true
		enum := buildV3Enum(v.Enum)
		if enum != nil {
			*enums = append(*enums, *enum)
		}
	}
}

// buildV3Enum bouwt een V3Enum door de enum-waarden te extraheren via EnumWaarden registry.
// Vangt eerst bekende hardcoded enum-types op, dan fallback naar EnumWaarden.
func buildV3Enum(goTypeName string) *V3Enum {
	// Bekende enums — geladen uit Go constants
	switch goTypeName {
	case "RelABSoort":
		return &V3Enum{
			GoType:   "RelABSoort",
			BaseType: "string",
			Domein:   EnumDomeinen["RelABSoort"],
			Waarden: []V3EnumWaarde{
				{ConstNaam: "RelABSoortLTT", Waarde: "LTT"},
				{ConstNaam: "RelABSoortLAT", Waarde: "LAT"},
				{ConstNaam: "RelABSoortLTA", Waarde: "LTA"},
			},
		}
	case "ABCEnum":
		return &V3Enum{
			GoType:   "ABCEnum",
			BaseType: "string",
			Domein:   EnumDomeinen["ABCEnum"],
			Waarden: []V3EnumWaarde{
				{ConstNaam: "OptieA", Waarde: "Optie A"},
				{ConstNaam: "OptieB", Waarde: "Optie B"},
				{ConstNaam: "OptieC", Waarde: "Optie C"},
			},
		}
	}
	// Fallback: gebruik EnumWaarden registry
	waarden, ok := EnumWaarden[goTypeName]
	if !ok || len(waarden) == 0 {
		return nil
	}
	enum := &V3Enum{
		GoType:   goTypeName,
		BaseType: "string",
		Domein:   EnumDomeinen[goTypeName],
	}
	for _, w := range waarden {
		// Strip tekens die ongeldig zijn in Go-identifiers (bijv. koppeltekens)
		cleanW := strings.ReplaceAll(w, "-", "")
		enum.Waarden = append(enum.Waarden, V3EnumWaarde{
			ConstNaam: goTypeName + cleanW,
			Waarde:    w,
		})
	}
	if layout, ok := EnumEditorLayouts[goTypeName]; ok {
		enum.Positie = layout.Positie
	}
	return enum
}
