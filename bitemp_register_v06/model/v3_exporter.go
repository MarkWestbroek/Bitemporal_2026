package model

import (
	"reflect"
	"strings"
	"time"
)

// plumbing-veldnamen die niet als inhoudsveld in V3 verschijnen
var plumbingVelden = map[string]struct{}{
	"bun.BaseModel": {},
	"A_ID":          {},
	"B_ID":          {},
	"Rel_ID":        {},
	"Versie":        {},
	"Opvoer":        {},
	"Afvoer":        {},
	"Datum":         {},
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
// Wordt gebruikt door de GET /api/schema/model endpoint.
func ExportMetaRegistryToV3() V3Model {
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

		ent := V3Entiteit{
			Typenaam:    meta.Typenaam,
			Description: meta.Description,
			IsMaterieel: meta.IsMaterieel,
			Kleur:       meta.Kleur,
			Meervoud:    meta.Padnaam,
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
	return ge
}

// v3RelatieVanMeta maakt een V3Relatie van een relatie-hub-meta.
func v3RelatieVanMeta(meta TypeMeta, child OnderliggendGegevenselement) V3Relatie {
	rel := V3Relatie{
		Naam:            meta.Typenaam,
		Description:     meta.Description,
		Meervoud:        meta.Padnaam,
		Momentvoorkomen: momentvoorkomenString(child.Momentvoorkomen),
		IsMaterieel:     meta.IsMaterieel,
		DoelEntiteit:    doelEntiteitVanRelatie(meta),
		Velden:          extractContentFields(meta),
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
// "b_id" → "B", "a_id" → "A"
func doelEntiteitVanRelatie(meta TypeMeta) string {
	col := meta.SecondaireEntiteitIDKolom
	if col == "" {
		return ""
	}
	// "b_id" → "b" → "B"
	name := strings.TrimSuffix(col, "_id")
	return strings.ToUpper(name)
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

// buildV3Enum bouwt een V3Enum door de enum-waarden te extraheren via de schema tag
// uit de data-structs in de MetaRegistry. Vangt bekende enum-types op.
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
	return nil
}
