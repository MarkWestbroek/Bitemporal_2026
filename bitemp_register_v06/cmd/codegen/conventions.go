package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/naamgeving"
)

// codegenOptions bevat opties die door alle generators worden gedeeld.
type codegenOptions struct {
	domein   string // TypeMeta.Domein waarde (bijv. "np-loc", "register")
	prefix   string // bestandsprefix → bepaalt init-functienaam (bijv. "np_loc" → initNpLocMetaRegistry)
	additive bool   // standalone of additive modus

	// afgeleideRelaties: de afgeleide relaties per typenaam van de bronentiteit, vóór de
	// generatie uit V3Entiteit.Relaties gehaald (splitsAfgeleideRelaties). Alleen de
	// entiteit-entry in de MetaRegistry gebruikt ze.
	afgeleideRelaties map[string][]model.V3Relatie
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

// hubPlumbingFields genereert de plumbing-velden voor een hub. entPKKolom is de sleutelkolom van
// de entiteit: "id", of bij een subtype (erft) de PFK "<ouder>_id". Tot 26-10-2026 stond hier
// altijd "id"; een subtype met eigen GE's kwam daardoor niet door de zelftest ("must have column id").
func hubPlumbingFields(entIDKolom string, parentEntType string, entPKKolom string) []StructField {
	parentFieldName := "Parent" + parentEntType
	if entPKKolom == "" {
		entPKKolom = "id"
	}
	return []StructField{
		{Name: parentEntType + "_ID", Type: "int",
			Tags: fmt.Sprintf("`json:\"%s\" bun:\"%s,pk\" schema_desc:\"ID van de %s-entiteit\"`", entIDKolom, entIDKolom, parentEntType)},
		{Name: "Rel_ID", Type: "int",
			Tags: "`json:\"rel_id\" bun:\"rel_id,pk,autoincrement\"`"},
		{Name: parentFieldName, Type: "*" + parentEntType,
			Tags: fmt.Sprintf("`json:\"-\" bun:\"rel:belongs-to,join:%s=%s,on_delete:cascade\"`", entIDKolom, entPKKolom)},
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

// aanvangEindePlumbingFields genereert plumbing-velden voor _Aanvang/_Einde. Met tijdstip=true
// (V3 tijdprecisie "tijdstip", 27-10-2026) is Datum een time.Time (kolom timestamptz) in plaats
// van een Date; de veld- en kolomnaam blijven "datum", zodat engine, lezers en de JSON-shorthand
// ("aanvang": "<waarde>") voor beide precisies gelijk werken.
func aanvangEindePlumbingFields(parentEntType string, entIDKolom string, hasRelID bool, tijdstip bool) []StructField {
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
		datumField(tijdstip),
		StructField{Name: "Opvoer", Type: "*time.Time",
			Tags: "`json:\"opvoer,omitempty\"`"},
		StructField{Name: "Afvoer", Type: "*time.Time",
			Tags: "`json:\"afvoer,omitempty\"`"},
	)
	return fields
}

// datumField: het Datum-veld van een _Aanvang/_Einde-record, als Date (dag) of time.Time (tijdstip).
func datumField(tijdstip bool) StructField {
	if tijdstip {
		return StructField{Name: "Datum", Type: "*time.Time",
			Tags: "`json:\"datum,omitempty\" bun:\"datum,type:timestamptz\"`"}
	}
	return StructField{Name: "Datum", Type: "*Date",
		Tags: "`json:\"datum,omitempty\" bun:\"datum,type:date\"`"}
}

// isTijdstip: V3 tijdprecisie "tijdstip".
func isTijdstip(tijdprecisie string) bool { return tijdprecisie == model.TijdprecisieTijdstip }

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
	if v.Uniek != "" {
		schemaParts = append(schemaParts, fmt.Sprintf("uniek=%s", v.Uniek))
	}
	if v.Ref != "" {
		schemaParts = append(schemaParts, fmt.Sprintf("ref:%s", v.Ref))
	}
	if len(schemaParts) > 0 {
		tags += fmt.Sprintf(` schema:"%s"`, strings.Join(schemaParts, ","))
	}
	// Afgeleid veld (V3Veld.Afgeleid): de regel gaat als eigen tag mee, zodat de exporter
	// (model/v3_exporter.go) hem bij de rondreis kan teruggeven. Het veld blijft voorlopig
	// een gewone kolom; alleen-lezen maken is een aparte stap (ontwerp afgeleide relaties §4).
	// Een backquote kan niet in een struct tag; zo'n regel valt af (CEL gebruikt ' en ").
	if v.Afgeleid && !strings.Contains(v.Afleidingsregel, "`") {
		tags += " afleiding:" + strconv.Quote(v.Afleidingsregel)
	}
	tags += schemaDescTag(v.Description)
	tags += uuidTag(v.UUID)

	tags += "`"

	return StructField{
		Name: goNaam,
		Type: goType,
		Tags: tags,
	}
}

// uuidTag: de identiteit van het veld in de Studio (V3Veld.UUID) als tag uuid:"…" op het
// _Data-veld, zodat de V3-export hem teruggeeft (31-10-2026, BACKLOG §40). Alleen een geldige
// UUID-vorm (hex en koppeltekens) komt in de tag; de _Input krijgt hem niet.
func uuidTag(uuid string) string {
	uuid = strings.ToLower(strings.TrimSpace(uuid))
	if uuid == "" {
		return ""
	}
	for _, r := range uuid {
		if !(r == '-' || (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
			return ""
		}
	}
	return ` uuid:"` + uuid + `"`
}

// schemaDescTag: de veldbeschrijving (V3Veld.Description) als tag schema_desc:"…". Die tag lezen
// de V3-export, OpenAPI, GraphQL en de schema-viz al (model/v3_exporter.go, dynql/); codegen
// schreef hem voor inhoudsvelden niet, zodat beschrijvingen bij de rondreis verdwenen
// (aanvraag-V3, 25-10-2026). Een backquote kan niet in een struct tag en wordt een '.
func schemaDescTag(desc string) string {
	desc = strings.TrimSpace(strings.ReplaceAll(desc, "`", "'"))
	if desc == "" {
		return ""
	}
	return " schema_desc:" + strconv.Quote(desc)
}

// ---- Bun relatie velden op entiteiten ----

// entiteitRelatieFieldPK genereert een bun relatie-veld met een expliciete PK kolom.
// Voor subtypes is de PK niet "id" maar bijv. "taak_id" (PFK naar parent).
func entiteitRelatieFieldPK(rolnaam string, jsonRolnaam string, sliceType string, pkKolom string, entIDKolom string) StructField {
	return StructField{
		Name: rolnaam,
		Type: "[]" + sliceType,
		Tags: fmt.Sprintf("`bun:\"rel:has-many,join:%s=%s\" json:\"%s,omitempty\"`", pkKolom, entIDKolom, jsonRolnaam),
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

// inputContentField genereert een inhoudsveld voor een _Input struct.
// Bun-tags worden weggelaten (geen DB-mapping op _Input); schema-tags
// (datatype, enum) worden wél doorgegeven zodat de request-validator
// dezelfde regels hanteert als op de _Data structs.
func inputContentField(v model.V3Veld) StructField {
	goNaam := toPascalCase(v.Naam)
	goType := v.GoType
	naam := v.Naam

	tags := "`" + jsonTag(naam, isPointerType(goType))

	var schemaParts []string
	if v.Enum != "" && v.Enum != v.Datatype {
		schemaParts = append(schemaParts, fmt.Sprintf("enum=%s", v.Enum))
	}
	if v.Datatype != "" {
		schemaParts = append(schemaParts, fmt.Sprintf("datatype:%s", v.Datatype))
	}
	if v.Uniek != "" {
		schemaParts = append(schemaParts, fmt.Sprintf("uniek=%s", v.Uniek))
	}
	if v.Ref != "" { // sinds 26-10-2026 ook op _Input, net als op _Data (ref-controle, BACKLOG §33.4)
		schemaParts = append(schemaParts, fmt.Sprintf("ref:%s", v.Ref))
	}
	if len(schemaParts) > 0 {
		tags += fmt.Sprintf(` schema:"%s"`, strings.Join(schemaParts, ","))
	}
	tags += schemaDescTag(v.Description)

	tags += "`"

	return StructField{
		Name: goNaam,
		Type: goType,
		Tags: tags,
	}
}

// inputAanvangEindeFields genereert Aanvang/Einde velden voor materiële Input structs.
func inputAanvangEindeFields(tijdstip bool) []StructField {
	t := "*Date"
	if tijdstip {
		t = "*time.Time" // inputNaarHub kopieert dit veld één-op-één naar _Aanvang.Datum
	}
	return []StructField{
		{Name: "Aanvang", Type: t, Tags: "`json:\"aanvang,omitempty\"`"},
		{Name: "Einde", Type: t, Tags: "`json:\"einde,omitempty\"`"},
	}
}
