package model

import (
	"reflect"
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
	"Systeemnaam":        {},
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
		Datatypes: DatatypeRegistry,
	}

	// Verzamel enum-types en maak een set om dubbelen te voorkomen
	enumsSeen := map[string]bool{}

	// Verzamel entiteiten
	for _, meta := range MetaRegistry {
		if meta.Metatype != MetatypeEntiteit {
			continue
		}
		// Filter op domein als opgegeven
		if filterDomein != "" && meta.Domein != filterDomein {
			continue
		}

		ent := V3Entiteit{
			Typenaam:        meta.Typenaam,
			Description:     meta.Description,
			EntiteitSubtype: meta.EntiteitSubtype,
			IsMaterieel:     meta.IsMaterieel,
			Kleur:           meta.Kleur,
			Meervoud:        meta.Padnaam,
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
	for _, meta := range MetaRegistry {
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

// v3GegevenseElementVanMeta maakt een V3Gegevenselement van een hub-meta.
func v3GegevenseElementVanMeta(meta TypeMeta, child OnderliggendGegevenselement) V3Gegevenselement {
	ge := V3Gegevenselement{
		Naam:            geNaamVanTypenaam(meta),
		Description:     meta.Description,
		Meervoud:        meta.Padnaam,
		Momentvoorkomen: momentvoorkomenString(child.Momentvoorkomen),
		IsMaterieel:     meta.IsMaterieel,
		Velden:          extractContentFields(meta),
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
		RelatieSubtype:           meta.RelatieSubtype,
		ReferentielijstInstantie: meta.ReferentielijstInstantie,
		Meervoud:                 meta.Padnaam,
		Momentvoorkomen:          momentvoorkomenString(child.Momentvoorkomen),
		IsMaterieel:              meta.IsMaterieel,
		DoelEntiteit:             doelEntiteitVanRelatie(meta),
		Velden:                   extractContentFields(meta),
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
	}
	for _, w := range waarden {
		enum.Waarden = append(enum.Waarden, V3EnumWaarde{
			ConstNaam: goTypeName + w,
			Waarde:    w,
		})
	}
	if layout, ok := EnumEditorLayouts[goTypeName]; ok {
		enum.Positie = layout.Positie
	}
	return enum
}
