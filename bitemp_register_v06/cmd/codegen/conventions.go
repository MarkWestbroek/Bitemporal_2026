package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/naamgeving"
)

// codegenOptions bevat opties die door alle generators worden gedeeld.
type codegenOptions struct {
	domein   string // TypeMeta.Domein waarde (bijv. "np-loc", "register")
	prefix   string // bestandsprefix → bepaalt init-functienaam (bijv. "np_loc" → initNpLocMetaRegistry)
	additive bool   // standalone of additive modus
}

// initFuncName leidt de init-functienaam af uit prefix en suffix.
// Bijv. prefix="np_loc", suffix="MetaRegistry" → "initNpLocMetaRegistry".
func (o codegenOptions) initFuncName(suffix string) string {
	if o.prefix == "" {
		return "init" + suffix
	}
	return "init" + toPascalCase(normalizeIdentifierParts(o.prefix)) + suffix
}

// normalizeIdentifierParts delegeert naar naamgeving.NormalizeIdentifierParts.
func normalizeIdentifierParts(s string) string {
	return naamgeving.NormalizeIdentifierParts(s)
}

// ---- Wrapper functies voor generators met oude signature ----

func generateEntiteitenWithOpts(v3 model.V3Model, _ codegenOptions) (string, error) {
	return generateEntiteiten(v3)
}
func generateGeRelWithOpts(v3 model.V3Model, _ codegenOptions) (string, error) {
	return generateGeRel(v3)
}
func generateMethodsWithOpts(v3 model.V3Model, _ codegenOptions) (string, error) {
	return generateMethods(v3)
}
func generateInputWithOpts(v3 model.V3Model, _ codegenOptions) (string, error) {
	return generateInput(v3)
}

// ---- Naamconventies (delegeren naar naamgeving package) ----

func toSnakeCase(s string) string  { return naamgeving.ToSnakeCase(s) }
func toPascalCase(s string) string { return naamgeving.ToPascalCase(s) }

// ---- Afgeleid metatype (delegeren naar naamgeving package) ----

func geHubTypeName(ent model.V3Entiteit, geNaam string) string {
	return naamgeving.GeHubTypeName(ent, geNaam)
}

// DerivedType is een alias voor naamgeving.DerivedType.
type DerivedType = naamgeving.DerivedType

func deriveEntiteit(ent model.V3Entiteit) DerivedType { return naamgeving.DeriveEntiteit(ent) }
func deriveHub(parentEnt, typeName, metatype string, isMaterieel bool, padnaam, secEntIDKolom string) DerivedType {
	return naamgeving.DeriveHub(parentEnt, typeName, metatype, isMaterieel, padnaam, secEntIDKolom)
}
func deriveData(hubTypeName, parentEnt string) DerivedType {
	return naamgeving.DeriveData(hubTypeName, parentEnt)
}
func deriveAanvangEinde(parentTypeName, parentEnt, suffix string) DerivedType {
	return naamgeving.DeriveAanvangEinde(parentTypeName, parentEnt, suffix)
}

// ---- Struct field generation helpers ----

// StructField beschrijft een Go struct veld voor codegen.
type StructField struct {
	Name    string
	Type    string
	Tags    string // volledig tag string, bijv. `json:"aaa" bun:"a_id,pk"`
	Comment string
}

// bunBaseModelField genereert het bun.BaseModel veld met expliciete alias.
// LET OP: de alias tag is altijd nodig, anders leidt Bun de alias af uit de Go struct naam
// (bijv. NatuurlijkPersoon → natuurlijk_persoon), terwijl onze SQL-subqueries de tabelnaam
// gebruiken. Zonder alias krijg je "invalid reference to FROM-clause entry" fouten.
func bunBaseModelField(tabelnaam string) StructField {
	return StructField{
		Name: "bun.BaseModel",
		Type: "",
		Tags: fmt.Sprintf("`bun:\"table:%s,alias:%s\"`", tabelnaam, tabelnaam),
	}
}

// bunBaseModelFieldAlias genereert het bun.BaseModel veld met alias (legacy — identical to bunBaseModelField).
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
func hubRelationSecondaryField(secEntIDKolom string, secEntType string) StructField {
	return StructField{
		Name: secEntType + "_ID",
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
func dataPlumbingFields(parentEntType string, entIDKolom string) []StructField {
	return []StructField{
		{Name: parentEntType + "_ID", Type: "int",
			Tags: fmt.Sprintf("`json:\"%s\" bun:\"%s,pk\"`", entIDKolom, entIDKolom)},
		{Name: "Rel_ID", Type: "int",
			Tags: "`json:\"rel_id\" bun:\"rel_id,pk\"`"},
		{Name: "Versie", Type: "int64",
			Tags: "`json:\"versie,omitempty\" bun:\"versie,pk,autoincrement\"`"},
	}
}

// aanvangEindePlumbingFields genereert plumbing-velden voor _Aanvang/_Einde.
func aanvangEindePlumbingFields(parentEntType string, entIDKolom string, hasRelID bool) []StructField {
	fields := []StructField{
		{Name: parentEntType + "_ID", Type: "int",
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

	// Schema tags: enum, datatype, ref
	var schemaParts []string
	if v.Enum != "" && v.Enum != v.Datatype {
		schemaParts = append(schemaParts, fmt.Sprintf("enum=%s", v.Enum))
	}
	if v.Datatype != "" {
		schemaParts = append(schemaParts, fmt.Sprintf("datatype:%s", v.Datatype))
	}
	if v.Ref != "" {
		schemaParts = append(schemaParts, fmt.Sprintf("ref:%s", v.Ref))
	}
	if len(schemaParts) > 0 {
		tags += fmt.Sprintf(` schema:"%s"`, strings.Join(schemaParts, ","))
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
