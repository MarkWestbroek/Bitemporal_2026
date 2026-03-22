package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// generateEntiteiten genereert modellen_entiteiten.go met entiteit structs
// en hun materiële plumbing (Aanvang/Einde).
func generateEntiteiten(v3 model.V3Model) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))

	b.WriteString("import (\n")
	b.WriteString("\t\"time\"\n\n")
	b.WriteString("\t\"github.com/uptrace/bun\"\n")
	b.WriteString(")\n\n")

	for _, ent := range v3.Entiteiten {
		d := deriveEntiteit(ent)

		// Entiteit struct
		if ent.Description != "" {
			b.WriteString(fmt.Sprintf("// %s — %s\n", ent.Typenaam, ent.Description))
		}
		b.WriteString(fmt.Sprintf("type %s struct {\n", ent.Typenaam))
		writeField(&b, bunBaseModelField(d.Tabelnaam))
		for _, f := range entiteitPlumbingFields() {
			writeField(&b, f)
		}

		// Bun relatie-velden naar onderliggende hubs
		entIDKolom := strings.ToLower(ent.Typenaam) + "_id"
		for _, ge := range ent.Gegevenselementen {
			hubType := ent.Typenaam + "_" + ge.Naam
			rolnaam := ge.Naam + "s"
			jsonRolnaam := strings.ToLower(ge.Naam) + "s"
			writeField(&b, entiteitRelatieField(rolnaam, jsonRolnaam, hubType, entIDKolom))
		}
		for _, rel := range ent.Relaties {
			rolnaam := relRolnaam(rel.Naam)
			jsonRolnaam := relJSONRolnaam(rel.Naam)
			writeField(&b, entiteitRelatieField(rolnaam, jsonRolnaam, rel.Naam, entIDKolom))
		}

		// Materiële plumbing (Aanvang/Einde) als de entiteit materieel is
		if ent.IsMaterieel {
			aanvangType := ent.Typenaam + "_Aanvang"
			eindeType := ent.Typenaam + "_Einde"
			writeField(&b, entiteitRelatieField("Aanvang", "aanvang", aanvangType, entIDKolom))
			writeField(&b, entiteitRelatieField("Einde", "einde", eindeType, entIDKolom))
		}

		b.WriteString("}\n\n")

		// Materiële plumbing structs (Aanvang/Einde per entiteit)
		if ent.IsMaterieel {
			for _, suffix := range []string{"Aanvang", "Einde"} {
				typeName := ent.Typenaam + "_" + suffix
				b.WriteString(fmt.Sprintf("// %s — %sdatum van entiteit %s.\n", typeName, strings.ToLower(suffix), ent.Typenaam))
				b.WriteString(fmt.Sprintf("type %s struct {\n", typeName))
				d := deriveAanvangEinde(ent.Typenaam, ent.Typenaam, suffix)
				writeField(&b, bunBaseModelField(d.Tabelnaam))
				for _, f := range aanvangEindePlumbingFields(entIDKolom, false) {
					writeField(&b, f)
				}
				b.WriteString("}\n\n")
			}
		}
	}

	return b.String(), nil
}

// generateGeRel genereert modellen_ge_rel.go met hub, data, aanvang/einde structs.
func generateGeRel(v3 model.V3Model) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))

	b.WriteString("import (\n")
	b.WriteString("\t\"time\"\n\n")
	b.WriteString("\t\"github.com/uptrace/bun\"\n")
	b.WriteString(")\n\n")

	// Eerst enums genereren
	for _, enum := range v3.Enums {
		b.WriteString(fmt.Sprintf("type %s %s\n\n", enum.GoType, enum.BaseType))
		b.WriteString("const (\n")
		for _, w := range enum.Waarden {
			b.WriteString(fmt.Sprintf("\t%s %s = \"%s\"\n", w.ConstNaam, enum.GoType, w.Waarde))
		}
		b.WriteString(")\n\n")
	}

	// Per entiteit: alle GE + relatie structs
	for _, ent := range v3.Entiteiten {
		entIDKolom := strings.ToLower(ent.Typenaam) + "_id"

		// Gegevenselementen
		for _, ge := range ent.Gegevenselementen {
			hubType := ent.Typenaam + "_" + ge.Naam
			generateHubStruct(&b, hubType, ent.Typenaam, entIDKolom, "gegevenselement", ge.IsMaterieel, ge.Description, "")
			generateDataStruct(&b, hubType, entIDKolom, ge.Velden, ge.Description)
			if ge.IsMaterieel {
				generateAanvangEindeStructs(&b, hubType, entIDKolom, true)
			}
		}

		// Relaties
		for _, rel := range ent.Relaties {
			secEntIDKolom := strings.ToLower(rel.DoelEntiteit) + "_id"
			generateHubStruct(&b, rel.Naam, ent.Typenaam, entIDKolom, "relatie", rel.IsMaterieel, rel.Description, secEntIDKolom)
			generateDataStruct(&b, rel.Naam, entIDKolom, rel.Velden, rel.Description)
			if rel.IsMaterieel {
				generateAanvangEindeStructs(&b, rel.Naam, entIDKolom, true)
			}
		}
	}

	return b.String(), nil
}

// generateHubStruct genereert een hub struct (GE of relatie).
func generateHubStruct(b *strings.Builder, typeName string, parentEnt string, entIDKolom string, metatype string, isMaterieel bool, description string, secEntIDKolom string) {
	tabelnaam := strings.ToLower(typeName)
	if description != "" {
		b.WriteString(fmt.Sprintf("// %s — %s\n", typeName, description))
	}
	b.WriteString(fmt.Sprintf("type %s struct {\n", typeName))
	writeField(b, bunBaseModelField(tabelnaam))

	for _, f := range hubPlumbingFields(entIDKolom, parentEnt) {
		writeField(b, f)
	}

	// Secondaire FK voor relaties
	if secEntIDKolom != "" {
		writeField(b, hubRelationSecondaryField(secEntIDKolom))
	}

	for _, f := range hubOpvoerAfvoerFields() {
		writeField(b, f)
	}

	// Data relatie
	dataType := typeName + "_Data"
	writeField(b, hubDataRelatieField(dataType, entIDKolom))

	// Materiële plumbing relaties
	if isMaterieel {
		writeField(b, hubAanvangRelatieField(typeName+"_Aanvang", entIDKolom))
		writeField(b, hubEindeRelatieField(typeName+"_Einde", entIDKolom))
	}

	b.WriteString("}\n\n")
}

// generateDataStruct genereert een _Data struct.
func generateDataStruct(b *strings.Builder, hubType string, entIDKolom string, velden []model.V3Veld, description string) {
	dataType := hubType + "_Data"
	tabelnaam := strings.ToLower(dataType)

	b.WriteString(fmt.Sprintf("// %s — geversioned inhoud van %s.\n", dataType, hubType))
	b.WriteString(fmt.Sprintf("type %s struct {\n", dataType))
	writeField(b, bunBaseModelFieldAlias(tabelnaam))

	for _, f := range dataPlumbingFields(entIDKolom) {
		writeField(b, f)
	}

	// Inhoudsvelden
	for _, v := range velden {
		writeField(b, contentField(v))
	}

	// Opvoer/Afvoer
	for _, f := range hubOpvoerAfvoerFields() {
		writeField(b, f)
	}

	b.WriteString("}\n\n")
}

// generateAanvangEindeStructs genereert _Aanvang en _Einde structs.
func generateAanvangEindeStructs(b *strings.Builder, parentType string, entIDKolom string, hasRelID bool) {
	for _, suffix := range []string{"Aanvang", "Einde"} {
		typeName := parentType + "_" + suffix
		tabelnaam := strings.ToLower(typeName)
		b.WriteString(fmt.Sprintf("// %s — %sdatum van %s.\n", typeName, strings.ToLower(suffix), parentType))
		b.WriteString(fmt.Sprintf("type %s struct {\n", typeName))
		writeField(b, bunBaseModelFieldAlias(tabelnaam))
		for _, f := range aanvangEindePlumbingFields(entIDKolom, hasRelID) {
			writeField(b, f)
		}
		b.WriteString("}\n\n")
	}
}

// ---- Helpers ----

func fileHeader(description string) string {
	return fmt.Sprintf("package model\n\n// %s\n\n", description)
}

func writeField(b *strings.Builder, f StructField) {
	if f.Type == "" {
		// Embedded field (bun.BaseModel)
		b.WriteString(fmt.Sprintf("\t%s %s\n", f.Name, f.Tags))
	} else {
		comment := ""
		if f.Comment != "" {
			comment = " // " + f.Comment
		}
		b.WriteString(fmt.Sprintf("\t%s %s %s%s\n", f.Name, f.Type, f.Tags, comment))
	}
}

// relRolnaam genereert de Go rolnaam voor een relatie. "Rel_A_B" → "RelABs"
func relRolnaam(naam string) string {
	clean := strings.ReplaceAll(naam, "_", "")
	return clean + "s"
}

// relJSONRolnaam genereert de JSON rolnaam voor een relatie. "Rel_A_B" → "rel_abs"
func relJSONRolnaam(naam string) string {
	return strings.ToLower(naam) + "s"
}
