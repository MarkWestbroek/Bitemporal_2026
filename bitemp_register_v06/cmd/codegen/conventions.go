package main

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// ---- Naamconventies ----

// toSnakeCase converteert PascalCase/camelCase naar snake_case.
// "RelAB" → "rel_a_b", "A_U" → "a_u" (al snake), "ID" → "id"
func toSnakeCase(s string) string {
	var result strings.Builder
	for i, r := range s {
		if unicode.IsUpper(r) {
			if i > 0 {
				prev := rune(s[i-1])
				if unicode.IsLower(prev) || (unicode.IsUpper(prev) && i+1 < len(s) && unicode.IsLower(rune(s[i+1]))) {
					result.WriteRune('_')
				}
			}
			result.WriteRune(unicode.ToLower(r))
		} else {
			result.WriteRune(r)
		}
	}
	return result.String()
}

// toPascalCase converteert snake_case naar PascalCase.
// "a_u" → "AU", "rel_a_b" → "RelAB". Houdt underscores in output als ze in het origineel zitten.
func toPascalCase(s string) string {
	parts := strings.Split(s, "_")
	var result strings.Builder
	for _, part := range parts {
		if part == "" {
			continue
		}
		result.WriteString(strings.ToUpper(part[:1]) + part[1:])
	}
	return result.String()
}

// ---- Afgeleid metatype ----

// DerivedType bevat alle afgeleide informatie voor een type (hub, data, aanvang, einde, entiteit).
type DerivedType struct {
	Typenaam               string
	Metatype               string // "entiteit", "gegevenselement", "relatie"
	GESubtype              string // "", "hub", "data", "aanvang", "einde"
	Tabelnaam              string
	IDKolom                string
	HeeftPFK               bool
	RelatieveAutoincrement bool
	EntiteitIDKolom        string
	SecEntiteitIDKolom     string // alleen voor relaties
	Padnaam                string
	Veldnaam               string
	IsMaterieel            bool
	DataTypenaam           string // alleen voor hubs
	BovenliggendTypenaam   string
}

// deriveEntiteit leidt alle metadata af voor een entiteit.
func deriveEntiteit(ent model.V3Entiteit) DerivedType {
	return DerivedType{
		Typenaam:    ent.Typenaam,
		Metatype:    "entiteit",
		GESubtype:   "",
		Tabelnaam:   strings.ToLower(ent.Typenaam),
		IDKolom:     "id",
		HeeftPFK:    false,
		Padnaam:     ent.Meervoud,
		Veldnaam:    strings.ToLower(ent.Typenaam),
		IsMaterieel: ent.IsMaterieel,
	}
}

// deriveHub leidt alle metadata af voor een hub (GE of relatie).
func deriveHub(parentEnt string, typeName string, metatype string, isMaterieel bool, padnaam string, secEntIDKolom string) DerivedType {
	entIDKolom := strings.ToLower(parentEnt) + "_id"
	tabelnaam := strings.ToLower(typeName)
	veldnaam := strings.ToLower(typeName)
	// Veldnaam: voor GE's is het de korte naam (u, v, w); voor relaties de volle naam
	if metatype == "gegevenselement" {
		parts := strings.Split(typeName, "_")
		if len(parts) >= 2 {
			veldnaam = strings.ToLower(parts[len(parts)-1])
		}
	}

	return DerivedType{
		Typenaam:               typeName,
		Metatype:               metatype,
		GESubtype:              "hub",
		Tabelnaam:              tabelnaam,
		IDKolom:                "rel_id",
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        entIDKolom,
		SecEntiteitIDKolom:     secEntIDKolom,
		Padnaam:                padnaam,
		Veldnaam:               veldnaam,
		IsMaterieel:            isMaterieel,
		DataTypenaam:           typeName + "_Data",
	}
}

// deriveData leidt metadata af voor een _Data type.
func deriveData(hubTypeName string, parentEnt string) DerivedType {
	typeName := hubTypeName + "_Data"
	entIDKolom := strings.ToLower(parentEnt) + "_id"
	return DerivedType{
		Typenaam:               typeName,
		Metatype:               "gegevenselement",
		GESubtype:              "data",
		Tabelnaam:              strings.ToLower(typeName),
		IDKolom:                "versie",
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        entIDKolom,
		Padnaam:                strings.ToLower(typeName),
		Veldnaam:               strings.ToLower(typeName),
		BovenliggendTypenaam:   hubTypeName,
	}
}

// deriveAanvangEinde leidt metadata af voor een _Aanvang of _Einde type.
func deriveAanvangEinde(parentTypeName string, parentEnt string, suffix string) DerivedType {
	typeName := parentTypeName + "_" + suffix
	entIDKolom := strings.ToLower(parentEnt) + "_id"
	subtype := "aanvang"
	if suffix == "Einde" {
		subtype = "einde"
	}
	return DerivedType{
		Typenaam:               typeName,
		Metatype:               "gegevenselement",
		GESubtype:              subtype,
		Tabelnaam:              strings.ToLower(typeName),
		IDKolom:                "versie",
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        entIDKolom,
		Padnaam:                strings.ToLower(typeName),
		Veldnaam:               strings.ToLower(typeName),
		BovenliggendTypenaam:   parentTypeName,
	}
}

// ---- Struct field generation helpers ----

// StructField beschrijft een Go struct veld voor codegen.
type StructField struct {
	Name    string
	Type    string
	Tags    string // volledig tag string, bijv. `json:"aaa" bun:"a_id,pk"`
	Comment string
}

// bunBaseModelField genereert het bun.BaseModel veld.
func bunBaseModelField(tabelnaam string) StructField {
	return StructField{
		Name: "bun.BaseModel",
		Type: "",
		Tags: fmt.Sprintf("`bun:\"table:%s\"`", tabelnaam),
	}
}

// bunBaseModelFieldAlias genereert het bun.BaseModel veld met alias.
func bunBaseModelFieldAlias(tabelnaam string) StructField {
	return StructField{
		Name: "bun.BaseModel",
		Type: "",
		Tags: fmt.Sprintf("`bun:\"table:%s,alias:%s\"`", tabelnaam, tabelnaam),
	}
}

// ---- Tag generation ----

// jsonTag genereert de json tag voor een veld.
func jsonTag(naam string, isPointer bool) string {
	if isPointer {
		return fmt.Sprintf(`json:"%s,omitempty"`, naam)
	}
	return fmt.Sprintf(`json:"%s"`, naam)
}

// isPointerType bepaalt of een Go type een pointer is.
func isPointerType(goType string) bool {
	return strings.HasPrefix(goType, "*")
}

// ---- Plumbing velden per metatype ----

// entiteitPlumbingFields genereert de plumbing-velden voor een entiteit.
func entiteitPlumbingFields() []StructField {
	return []StructField{
		{Name: "ID", Type: "int", Tags: "`json:\"id\" bun:\"id,pk\"`"},
		{Name: "Opvoer", Type: "*time.Time", Tags: "`json:\"opvoer,omitempty\"`"},
		{Name: "Afvoer", Type: "*time.Time", Tags: "`json:\"afvoer,omitempty\"`"},
	}
}

// hubPlumbingFields genereert de plumbing-velden voor een hub.
func hubPlumbingFields(entIDKolom string, parentEntType string) []StructField {
	parentFieldName := "Parent" + parentEntType
	return []StructField{
		{Name: parentEntType + "_ID", Type: "int",
			Tags: fmt.Sprintf("`json:\"%s\" bun:\"%s,pk\" schema_desc:\"ID van de %s-entiteit\"`", entIDKolom, entIDKolom, parentEntType)},
		{Name: "Rel_ID", Type: "int",
			Tags: "`json:\"rel_id\" bun:\"rel_id,pk,autoincrement\"`"},
		{Name: parentFieldName, Type: "*" + parentEntType,
			Tags: fmt.Sprintf("`json:\"-\" bun:\"rel:belongs-to,join:%s=id,on_delete:cascade\"`", entIDKolom)},
	}
}

// hubRelationPlumbingFields genereert de extra FK voor relaties (secondaire entiteit).
func hubRelationSecondaryField(secEntIDKolom string) StructField {
	return StructField{
		Name: strings.ToUpper(strings.TrimSuffix(secEntIDKolom, "_id")) + "_ID",
		Type: "int",
		Tags: fmt.Sprintf("`json:\"%s\"`", secEntIDKolom),
	}
}

// hubOpvoerAfvoerFields genereert opvoer/afvoer voor hubs.
func hubOpvoerAfvoerFields() []StructField {
	return []StructField{
		{Name: "Opvoer", Type: "*time.Time", Tags: "`json:\"opvoer,omitempty\"`"},
		{Name: "Afvoer", Type: "*time.Time", Tags: "`json:\"afvoer,omitempty\"`"},
	}
}

// dataPlumbingFields genereert de plumbing-velden voor een _Data struct.
func dataPlumbingFields(entIDKolom string) []StructField {
	return []StructField{
		{Name: strings.ToUpper(strings.TrimSuffix(entIDKolom, "_id")) + "_ID", Type: "int",
			Tags: fmt.Sprintf("`json:\"%s\" bun:\"%s,pk\"`", entIDKolom, entIDKolom)},
		{Name: "Rel_ID", Type: "int",
			Tags: "`json:\"rel_id\" bun:\"rel_id,pk\"`"},
		{Name: "Versie", Type: "int64",
			Tags: "`json:\"versie,omitempty\" bun:\"versie,pk,autoincrement\"`"},
	}
}

// aanvangEindePlumbingFields genereert plumbing-velden voor _Aanvang/_Einde.
func aanvangEindePlumbingFields(entIDKolom string, hasRelID bool) []StructField {
	fields := []StructField{
		{Name: strings.ToUpper(strings.TrimSuffix(entIDKolom, "_id")) + "_ID", Type: "int",
			Tags: fmt.Sprintf("`json:\"%s\" bun:\"%s,pk\"`", entIDKolom, entIDKolom)},
	}
	if hasRelID {
		fields = append(fields, StructField{
			Name: "Rel_ID", Type: "int",
			Tags: "`json:\"rel_id\" bun:\"rel_id,pk\"`",
		})
	}
	fields = append(fields,
		StructField{Name: "Versie", Type: "int64",
			Tags: "`json:\"versie,omitempty\" bun:\"versie,pk,autoincrement\"`"},
		StructField{Name: "Datum", Type: "*Date",
			Tags: "`json:\"datum,omitempty\" bun:\"datum,type:date\"`"},
		StructField{Name: "Opvoer", Type: "*time.Time",
			Tags: "`json:\"opvoer,omitempty\"`"},
		StructField{Name: "Afvoer", Type: "*time.Time",
			Tags: "`json:\"afvoer,omitempty\"`"},
	)
	return fields
}

// contentField genereert een StructField voor een inhoudsveld.
func contentField(v model.V3Veld) StructField {
	goNaam := toPascalCase(v.Naam)
	goType := v.GoType
	naam := v.Naam

	tags := "`" + jsonTag(naam, isPointerType(goType))

	// *Date velden krijgen extra bun tag
	if goType == "*Date" || goType == "Date" {
		tags += fmt.Sprintf(` bun:"%s,type:date"`, naam)
	}

	// Enum schema tags
	if v.Enum != "" {
		tags += fmt.Sprintf(` schema:"enum=%s"`, v.Enum)
	}

	tags += "`"

	return StructField{
		Name: goNaam,
		Type: goType,
		Tags: tags,
	}
}

// ---- Bun relatie velden op entiteiten ----

// entiteitRelatieField genereert een bun relatie-veld voor een entiteit naar een onderliggend type.
func entiteitRelatieField(rolnaam string, jsonRolnaam string, sliceType string, entIDKolom string) StructField {
	return StructField{
		Name: rolnaam,
		Type: "[]" + sliceType,
		Tags: fmt.Sprintf("`bun:\"rel:has-many,join:id=%s\" json:\"%s,omitempty\"`", entIDKolom, jsonRolnaam),
	}
}

// hubDataRelatieField genereert het Data relatie-veld op een hub.
func hubDataRelatieField(dataType string, entIDKolom string) StructField {
	return StructField{
		Name: "Data",
		Type: "[]" + dataType,
		Tags: fmt.Sprintf("`bun:\"rel:has-many,join:%s=%s,join:rel_id=rel_id\" json:\"data,omitempty\"`", entIDKolom, entIDKolom),
	}
}

// hubAanvangRelatieField genereert het Aanvang relatie-veld op een hub.
func hubAanvangRelatieField(aanvangType string, entIDKolom string) StructField {
	return StructField{
		Name: "Aanvang",
		Type: "[]" + aanvangType,
		Tags: fmt.Sprintf("`bun:\"rel:has-many,join:%s=%s,join:rel_id=rel_id\" json:\"aanvang,omitempty\"`", entIDKolom, entIDKolom),
	}
}

// hubEindeRelatieField genereert het Einde relatie-veld op een hub.
func hubEindeRelatieField(eindeType string, entIDKolom string) StructField {
	return StructField{
		Name: "Einde",
		Type: "[]" + eindeType,
		Tags: fmt.Sprintf("`bun:\"rel:has-many,join:%s=%s,join:rel_id=rel_id\" json:\"einde,omitempty\"`", entIDKolom, entIDKolom),
	}
}

// ---- Input struct helpers ----

// inputPlumbingFields genereert de plumbing-velden voor een _Input struct.
func inputPlumbingFields(entIDKolom string) []StructField {
	return []StructField{
		{Name: strings.ToUpper(strings.TrimSuffix(entIDKolom, "_id")) + "_ID", Type: "int",
			Tags: fmt.Sprintf("`json:\"%s\"`", entIDKolom)},
		{Name: "Rel_ID", Type: "int",
			Tags: "`json:\"rel_id\"`"},
	}
}

// inputContentField genereert een inhoudsveld voor een _Input struct (zonder bun tags).
func inputContentField(v model.V3Veld) StructField {
	goNaam := toPascalCase(v.Naam)
	goType := v.GoType
	naam := v.Naam
	tags := "`" + jsonTag(naam, isPointerType(goType)) + "`"
	return StructField{
		Name: goNaam,
		Type: goType,
		Tags: tags,
	}
}

// inputAanvangEindeFields genereert Aanvang/Einde velden voor materiële Input structs.
func inputAanvangEindeFields() []StructField {
	return []StructField{
		{Name: "Aanvang", Type: "*Date", Tags: "`json:\"aanvang,omitempty\"`"},
		{Name: "Einde", Type: "*Date", Tags: "`json:\"einde,omitempty\"`"},
	}
}
