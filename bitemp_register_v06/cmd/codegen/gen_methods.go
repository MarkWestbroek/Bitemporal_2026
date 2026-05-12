package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// generateMethods genereert modellen_methods.go met alle interface-methoden
// en GeefOnderliggendeGegevenselementen voor alle types.
func generateMethods(v3 model.V3Model) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("Alle methoden op domein-structs.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))
	if len(v3.Entiteiten) > 0 {
		b.WriteString("import \"time\"\n\n")
	}

	// 1. Entiteiten — interface-methoden
	b.WriteString("/* ================================================================\n")
	b.WriteString("   1. ENTITEITEN — interface-methoden\n")
	b.WriteString("   ================================================================ */\n\n")

	for _, ent := range v3.Entiteiten {
		rv := receiverVar(ent.Typenaam)
		idField := "ID"
		if ent.Erft != "" {
			idField = ent.Erft + "_ID"
		}
		writeInterfaceMethods(&b, ent.Typenaam, rv, "MetatypeEntiteit", idField, idField, false)
	}

	// 2. Hubs — interface-methoden
	b.WriteString("/* ================================================================\n")
	b.WriteString("   2. HUBS (GE + REL) — interface-methoden\n")
	b.WriteString("   ================================================================ */\n\n")

	for _, ent := range v3.Entiteiten {
		for _, ge := range ent.Gegevenselementen {
			hubType := geHubTypeName(ent, ge.Naam)
			rv := hubReceiverVar(ent.Typenaam, ge.Naam)
			writeInterfaceMethods(&b, hubType, rv, "MetatypeGegevenselement", "Rel_ID", "Rel_ID", false)
		}
		for _, rel := range ent.Relaties {
			rv := receiverVar(rel.Naam)
			writeInterfaceMethods(&b, rel.Naam, rv, "MetatypeRelatie", "Rel_ID", "Rel_ID", false)
		}
	}

	// 3. _Data — interface-methoden
	b.WriteString("/* ================================================================\n")
	b.WriteString("   3. _DATA — interface-methoden\n")
	b.WriteString("   ================================================================ */\n\n")

	for _, ent := range v3.Entiteiten {
		for _, ge := range ent.Gegevenselementen {
			dataType := geHubTypeName(ent, ge.Naam) + "_Data"
			writeInterfaceMethods(&b, dataType, "d", "MetatypeGegevenselement", "Versie", "Versie", false)
		}
		for _, rel := range ent.Relaties {
			dataType := rel.Naam + "_Data"
			writeInterfaceMethods(&b, dataType, "d", "MetatypeGegevenselement", "Versie", "Versie", false)
		}
	}

	// 4. _Aanvang/_Einde (entiteits-plumbing) — interface-methoden
	b.WriteString("/* ================================================================\n")
	b.WriteString("   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden\n")
	b.WriteString("   ================================================================ */\n\n")

	for _, ent := range v3.Entiteiten {
		if !ent.IsMaterieel {
			continue
		}
		for _, suffix := range []string{"Aanvang", "Einde"} {
			typeName := ent.Typenaam + "_" + suffix
			rv := receiverVar(typeName)
			writeInterfaceMethods(&b, typeName, rv, "MetatypeGegevenselement", "Versie", "Versie", false)
		}
	}

	// 5. _Aanvang/_Einde (hub-level plumbing) — interface-methoden
	b.WriteString("/* ================================================================\n")
	b.WriteString("   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden\n")
	b.WriteString("   ================================================================ */\n\n")

	for _, ent := range v3.Entiteiten {
		for _, ge := range ent.Gegevenselementen {
			if !ge.IsMaterieel {
				continue
			}
			hubType := geHubTypeName(ent, ge.Naam)
			for _, suffix := range []string{"Aanvang", "Einde"} {
				typeName := hubType + "_" + suffix
				rv := receiverVar(typeName)
				writeInterfaceMethods(&b, typeName, rv, "MetatypeGegevenselement", "Versie", "Versie", false)
			}
		}
		for _, rel := range ent.Relaties {
			if !rel.IsMaterieel {
				continue
			}
			for _, suffix := range []string{"Aanvang", "Einde"} {
				typeName := rel.Naam + "_" + suffix
				rv := receiverVar(typeName)
				writeInterfaceMethods(&b, typeName, rv, "MetatypeGegevenselement", "Versie", "Versie", false)
			}
		}
	}

	// 6. _Input — interface-methoden (no-op opvoer/afvoer)
	b.WriteString("/* ================================================================\n")
	b.WriteString("   6. _INPUT — interface-methoden (no-op opvoer/afvoer)\n")
	b.WriteString("   ================================================================ */\n\n")

	for _, ent := range v3.Entiteiten {
		for _, ge := range ent.Gegevenselementen {
			inputType := geHubTypeName(ent, ge.Naam) + "_Input"
			writeInterfaceMethods(&b, inputType, "i", "MetatypeGegevenselement", "Rel_ID", "Rel_ID", true)
		}
		for _, rel := range ent.Relaties {
			inputType := rel.Naam + "_Input"
			writeInterfaceMethods(&b, inputType, "i", "MetatypeRelatie", "Rel_ID", "Rel_ID", true)
		}
	}

	// 7. GeefOnderliggendeGegevenselementen — ENTITEITEN
	b.WriteString("/* ================================================================\n")
	b.WriteString("   7. GeefOnderliggendeGegevenselementen — ENTITEITEN\n")
	b.WriteString("   ================================================================ */\n\n")

	for _, ent := range v3.Entiteiten {
		writeEntiteitGeefOnderliggende(&b, ent)
	}

	// 8. GeefOnderliggendeGegevenselementen — HUBS
	b.WriteString("/* ================================================================\n")
	b.WriteString("   8. GeefOnderliggendeGegevenselementen — HUBS\n")
	b.WriteString("   ================================================================ */\n\n")

	for _, ent := range v3.Entiteiten {
		entIDField := ent.Typenaam + "_ID"
		for _, ge := range ent.Gegevenselementen {
			hubType := geHubTypeName(ent, ge.Naam)
			writeHubGeefOnderliggende(&b, hubType, entIDField, ge.IsMaterieel)
		}
		for _, rel := range ent.Relaties {
			writeHubGeefOnderliggende(&b, rel.Naam, entIDField, rel.IsMaterieel)
		}
	}

	return b.String(), nil
}

// writeInterfaceMethods schrijft de 8 interface-methoden voor een type.
func writeInterfaceMethods(b *strings.Builder, typeName string, rv string, metatype string, idField string, clearField string, isInput bool) {
	b.WriteString(fmt.Sprintf("// %s\n", typeName))

	// GetID
	b.WriteString(fmt.Sprintf("func (%s %s) GetID() any { return %s.%s }\n", rv, typeName, rv, idField))

	// Metatype
	b.WriteString(fmt.Sprintf("func (%s %s) Metatype() Metatype { return %s }\n", rv, typeName, metatype))

	// ClearID
	b.WriteString(fmt.Sprintf("func (%s *%s) ClearID() { %s.%s = 0 }\n", rv, typeName, rv, clearField))

	// Vermijd conflict: als de receiver-letter 't' is, gebruik 'ts' als tijdparameternaam.
	tp := "t"
	if rv == "t" {
		tp = "ts"
	}
	if isInput {
		// Input types: no-op opvoer/afvoer
		b.WriteString(fmt.Sprintf("func (%s %s) GetOpvoer() *time.Time { return nil }\n", rv, typeName))
		b.WriteString(fmt.Sprintf("func (%s *%s) SetOpvoer(%s *time.Time) {}\n", rv, typeName, tp))
		b.WriteString(fmt.Sprintf("func (%s %s) GetAfvoer() *time.Time { return nil }\n", rv, typeName))
		b.WriteString(fmt.Sprintf("func (%s *%s) SetAfvoer(%s *time.Time) {}\n", rv, typeName, tp))
	} else {
		b.WriteString(fmt.Sprintf("func (%s %s) GetOpvoer() *time.Time { return %s.Opvoer }\n", rv, typeName, rv))
		b.WriteString(fmt.Sprintf("func (%s *%s) SetOpvoer(%s *time.Time) { %s.Opvoer = %s }\n", rv, typeName, tp, rv, tp))
		b.WriteString(fmt.Sprintf("func (%s %s) GetAfvoer() *time.Time { return %s.Afvoer }\n", rv, typeName, rv))
		b.WriteString(fmt.Sprintf("func (%s *%s) SetAfvoer(%s *time.Time) { %s.Afvoer = %s }\n", rv, typeName, tp, rv, tp))
	}

	// String
	b.WriteString(fmt.Sprintf("func (%s %s) String() string { return RepresentatieToString(%s) }\n\n", rv, typeName, rv))
}

// writeEntiteitGeefOnderliggende genereert GeefOnderliggendeGegevenselementen voor een entiteit.
func writeEntiteitGeefOnderliggende(b *strings.Builder, ent model.V3Entiteit) {
	rv := receiverVar(ent.Typenaam)
	entIDOnChild := ent.Typenaam + "_ID" // bijv. A_ID
	// Eigen ID-veld op de entiteitstruct: "ID" voor gewone entiteiten, "{Parent}_ID" voor subtypes
	ownIDField := "ID"
	if ent.Erft != "" {
		ownIDField = ent.Erft + "_ID"
	}
	b.WriteString(fmt.Sprintf("func (%s *%s) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {\n", rv, ent.Typenaam))
	b.WriteString("\tresult := make([]OnderliggendeRepresentatie, 0)\n")

	// GE's — gebruik 'idx' als loopvariabele om shadowing van de receiver te voorkomen
	// (bijv. receiver 'i' voor Initiatief zou anders overschaduwd worden door for i :=)
	for _, ge := range ent.Gegevenselementen {
		hubType := geHubTypeName(ent, ge.Naam)
		sliceField := toPascalCase(ge.Meervoud)
		if sliceField == "" {
			sliceField = ge.Naam + "s"
		}
		b.WriteString(fmt.Sprintf("\tfor idx := range %s.%s {\n", rv, sliceField))
		b.WriteString(fmt.Sprintf("\t\tif %s.%s[idx].%s == 0 {\n", rv, sliceField, entIDOnChild))
		b.WriteString(fmt.Sprintf("\t\t\t%s.%s[idx].%s = %s.%s\n", rv, sliceField, entIDOnChild, rv, ownIDField))
		b.WriteString("\t\t}\n")
		b.WriteString(fmt.Sprintf("\t\tresult = append(result, OnderliggendeRepresentatie{Typenaam: \"%s\", Representatie: &%s.%s[idx]})\n", hubType, rv, sliceField))
		b.WriteString("\t}\n")
	}

	// Relaties
	for _, rel := range ent.Relaties {
		sliceField := relRolnaam(rel.Naam, rel.Meervoud)
		b.WriteString(fmt.Sprintf("\tfor idx := range %s.%s {\n", rv, sliceField))
		b.WriteString(fmt.Sprintf("\t\tif %s.%s[idx].%s == 0 {\n", rv, sliceField, entIDOnChild))
		b.WriteString(fmt.Sprintf("\t\t\t%s.%s[idx].%s = %s.%s\n", rv, sliceField, entIDOnChild, rv, ownIDField))
		b.WriteString("\t\t}\n")
		b.WriteString(fmt.Sprintf("\t\tresult = append(result, OnderliggendeRepresentatie{Typenaam: \"%s\", Representatie: &%s.%s[idx]})\n", rel.Naam, rv, sliceField))
		b.WriteString("\t}\n")
	}

	// Materiële plumbing
	if ent.IsMaterieel {
		for _, suffix := range []string{"Aanvang", "Einde"} {
			typeName := ent.Typenaam + "_" + suffix
			b.WriteString(fmt.Sprintf("\tfor idx := range %s.%s {\n", rv, suffix))
			b.WriteString(fmt.Sprintf("\t\tif %s.%s[idx].%s == 0 {\n", rv, suffix, entIDOnChild))
			b.WriteString(fmt.Sprintf("\t\t\t%s.%s[idx].%s = %s.%s\n", rv, suffix, entIDOnChild, rv, ownIDField))
			b.WriteString("\t\t}\n")
			b.WriteString(fmt.Sprintf("\t\tresult = append(result, OnderliggendeRepresentatie{Typenaam: \"%s\", Representatie: &%s.%s[idx]})\n", typeName, rv, suffix))
			b.WriteString("\t}\n")
		}
	}

	b.WriteString("\treturn result\n}\n\n")
}

// writeHubGeefOnderliggende genereert GeefOnderliggendeGegevenselementen voor een hub.
func writeHubGeefOnderliggende(b *strings.Builder, hubType string, entIDField string, isMaterieel bool) {
	rv := "h"
	b.WriteString(fmt.Sprintf("func (%s *%s) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {\n", rv, hubType))

	// Bereken capaciteit
	cap := "len(h.Data)"
	if isMaterieel {
		cap = "len(h.Data)+len(h.Aanvang)+len(h.Einde)"
	}
	b.WriteString(fmt.Sprintf("\tresult := make([]OnderliggendeRepresentatie, 0, %s)\n", cap))

	// Data
	dataType := hubType + "_Data"
	b.WriteString("\tfor i := range h.Data {\n")
	b.WriteString(fmt.Sprintf("\t\tif h.Data[i].%s == 0 {\n", entIDField))
	b.WriteString(fmt.Sprintf("\t\t\th.Data[i].%s = h.%s\n", entIDField, entIDField))
	b.WriteString("\t\t}\n")
	b.WriteString("\t\tif h.Data[i].Rel_ID == 0 {\n")
	b.WriteString("\t\t\th.Data[i].Rel_ID = h.Rel_ID\n")
	b.WriteString("\t\t}\n")
	b.WriteString(fmt.Sprintf("\t\tresult = append(result, OnderliggendeRepresentatie{Typenaam: \"%s\", Representatie: &h.Data[i]})\n", dataType))
	b.WriteString("\t}\n")

	// Aanvang/Einde
	if isMaterieel {
		for _, suffix := range []string{"Aanvang", "Einde"} {
			typeName := hubType + "_" + suffix
			b.WriteString(fmt.Sprintf("\tfor i := range h.%s {\n", suffix))
			b.WriteString(fmt.Sprintf("\t\tif h.%s[i].%s == 0 {\n", suffix, entIDField))
			b.WriteString(fmt.Sprintf("\t\t\th.%s[i].%s = h.%s\n", suffix, entIDField, entIDField))
			b.WriteString("\t\t}\n")
			b.WriteString(fmt.Sprintf("\t\tif h.%s[i].Rel_ID == 0 {\n", suffix))
			b.WriteString(fmt.Sprintf("\t\t\th.%s[i].Rel_ID = h.Rel_ID\n", suffix))
			b.WriteString("\t\t}\n")
			b.WriteString(fmt.Sprintf("\t\tresult = append(result, OnderliggendeRepresentatie{Typenaam: \"%s\", Representatie: &h.%s[i]})\n", typeName, suffix))
			b.WriteString("\t}\n")
		}
	}

	b.WriteString("\treturn result\n}\n\n")
}

// receiverVar genereert een korte receiver-variabele voor een type.
// Eerst letter lowercase van typenaam: A → a, B → b, Rel_A_B → r.
func receiverVar(typeName string) string {
	if len(typeName) == 0 {
		return "x"
	}
	return strings.ToLower(typeName[:1])
}

// hubReceiverVar genereert een 2-letter receiver voor GE hubs.
// Ent "A" + GE "U" → "au", Ent "B" + GE "X" → "bx".
func hubReceiverVar(entNaam, geNaam string) string {
	e := strings.ToLower(entNaam[:1])
	g := strings.ToLower(geNaam[:1])
	return e + g
}
