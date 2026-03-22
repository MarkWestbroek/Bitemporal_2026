package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// generateMetaRegistry genereert metaregistry.go met alle TypeMeta entries.
func generateMetaRegistry(v3 model.V3Model) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("MetaRegistry — de single source of truth voor alle type-metadata.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))
	b.WriteString("\n")

	b.WriteString("// MetaRegistry is the hardcoded meta model registry.\n")
	b.WriteString("var MetaRegistry = MetaRegistryType{\n")

	for _, ent := range v3.Entiteiten {
		entIDKolom := strings.ToLower(ent.Typenaam) + "_id"

		// ---- Entiteit ----
		d := deriveEntiteit(ent)
		writeEntiteitEntry(&b, ent, d, entIDKolom)

		// ---- GE hubs ----
		for _, ge := range ent.Gegevenselementen {
			hubType := ent.Typenaam + "_" + ge.Naam
			padnaam := strings.ToLower(ent.Typenaam) + "_" + strings.ToLower(ge.Naam) + "s"
			dHub := deriveHub(ent.Typenaam, hubType, "gegevenselement", ge.IsMaterieel, padnaam, "")
			writeHubEntry(&b, dHub, ge.Description, ent.Kleur, ge.Momentvoorkomen, ge.IsMaterieel, ge.Naam)
		}

		// ---- Relatie hubs ----
		for _, rel := range ent.Relaties {
			secIDKolom := strings.ToLower(rel.DoelEntiteit) + "_id"
			dHub := deriveHub(ent.Typenaam, rel.Naam, "relatie", rel.IsMaterieel, rel.Meervoud, secIDKolom)
			writeRelHubEntry(&b, dHub, rel)
		}

		// ---- _Data types ----
		for _, ge := range ent.Gegevenselementen {
			hubType := ent.Typenaam + "_" + ge.Naam
			dData := deriveData(hubType, ent.Typenaam)
			writeDataEntry(&b, dData, ge.Description, ent.Kleur)
		}
		for _, rel := range ent.Relaties {
			dData := deriveData(rel.Naam, ent.Typenaam)
			writeDataEntry(&b, dData, rel.Description, ent.Kleur)
		}

		// ---- Entiteits-level Aanvang/Einde (materiële entiteiten) ----
		if ent.IsMaterieel {
			for _, suffix := range []string{"Aanvang", "Einde"} {
				dAE := deriveAanvangEinde(ent.Typenaam, ent.Typenaam, suffix)
				writeAanvangEindeEntry(&b, dAE, ent.Kleur, suffix, ent.Typenaam)
			}
		}

		// ---- Hub-level Aanvang/Einde (materiële hubs) ----
		for _, ge := range ent.Gegevenselementen {
			if !ge.IsMaterieel {
				continue
			}
			hubType := ent.Typenaam + "_" + ge.Naam
			for _, suffix := range []string{"Aanvang", "Einde"} {
				dAE := deriveAanvangEinde(hubType, ent.Typenaam, suffix)
				writeAanvangEindeEntry(&b, dAE, ent.Kleur, suffix, hubType)
			}
		}
		for _, rel := range ent.Relaties {
			if !rel.IsMaterieel {
				continue
			}
			for _, suffix := range []string{"Aanvang", "Einde"} {
				dAE := deriveAanvangEinde(rel.Naam, ent.Typenaam, suffix)
				writeAanvangEindeEntry(&b, dAE, ent.Kleur, suffix, rel.Naam)
			}
		}
	}

	b.WriteString("}\n")
	return b.String(), nil
}

// generateMetaRegistryAdditive genereert een additive metaregistry die entries
// toevoegt aan de bestaande MetaRegistry via een init() functie.
func generateMetaRegistryAdditive(v3 model.V3Model) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("Additieve MetaRegistry-entries — voegt types toe aan de bestaande MetaRegistry.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))
	b.WriteString("\n")

	b.WriteString("func init() {\n")

	// We hergebruiken de bestaande write-helpers, maar moeten de entries
	// wrappen als MetaRegistry["key"] = TypeMeta{...} i.p.v. "key": {...}
	// Daarvoor genereren we de entries in een tijdelijke buffer en formatteren ze.
	var entries strings.Builder

	for _, ent := range v3.Entiteiten {
		entIDKolom := strings.ToLower(ent.Typenaam) + "_id"

		// ---- Entiteit ----
		d := deriveEntiteit(ent)
		writeEntiteitEntry(&entries, ent, d, entIDKolom)

		// ---- GE hubs ----
		for _, ge := range ent.Gegevenselementen {
			hubType := ent.Typenaam + "_" + ge.Naam
			padnaam := strings.ToLower(ent.Typenaam) + "_" + strings.ToLower(ge.Naam) + "s"
			dHub := deriveHub(ent.Typenaam, hubType, "gegevenselement", ge.IsMaterieel, padnaam, "")
			writeHubEntry(&entries, dHub, ge.Description, ent.Kleur, ge.Momentvoorkomen, ge.IsMaterieel, ge.Naam)
		}

		// ---- Relatie hubs ----
		for _, rel := range ent.Relaties {
			secIDKolom := strings.ToLower(rel.DoelEntiteit) + "_id"
			dHub := deriveHub(ent.Typenaam, rel.Naam, "relatie", rel.IsMaterieel, rel.Meervoud, secIDKolom)
			writeRelHubEntry(&entries, dHub, rel)
		}

		// ---- _Data types ----
		for _, ge := range ent.Gegevenselementen {
			hubType := ent.Typenaam + "_" + ge.Naam
			dData := deriveData(hubType, ent.Typenaam)
			writeDataEntry(&entries, dData, ge.Description, ent.Kleur)
		}
		for _, rel := range ent.Relaties {
			dData := deriveData(rel.Naam, ent.Typenaam)
			writeDataEntry(&entries, dData, rel.Description, ent.Kleur)
		}

		// ---- Entiteits-level Aanvang/Einde ----
		if ent.IsMaterieel {
			for _, suffix := range []string{"Aanvang", "Einde"} {
				dAE := deriveAanvangEinde(ent.Typenaam, ent.Typenaam, suffix)
				writeAanvangEindeEntry(&entries, dAE, ent.Kleur, suffix, ent.Typenaam)
			}
		}

		// ---- Hub-level Aanvang/Einde ----
		for _, ge := range ent.Gegevenselementen {
			if !ge.IsMaterieel {
				continue
			}
			hubType := ent.Typenaam + "_" + ge.Naam
			for _, suffix := range []string{"Aanvang", "Einde"} {
				dAE := deriveAanvangEinde(hubType, ent.Typenaam, suffix)
				writeAanvangEindeEntry(&entries, dAE, ent.Kleur, suffix, hubType)
			}
		}
		for _, rel := range ent.Relaties {
			if !rel.IsMaterieel {
				continue
			}
			for _, suffix := range []string{"Aanvang", "Einde"} {
				dAE := deriveAanvangEinde(rel.Naam, ent.Typenaam, suffix)
				writeAanvangEindeEntry(&entries, dAE, ent.Kleur, suffix, rel.Naam)
			}
		}
	}

	// Converteer map-literal entries naar assignment-statements:
	// Van:  "Key": { ... },
	// Naar: MetaRegistry["Key"] = TypeMeta{ ... }
	b.WriteString(mapLiteralToAssignments(entries.String()))

	b.WriteString("}\n")
	return b.String(), nil
}

// mapLiteralToAssignments converteert MetaRegistry map-literal entries naar init()-assignments.
// Input:  \t"Key": {\n\t\tField: value,\n\t},\n
// Output: \tMetaRegistry["Key"] = TypeMeta{\n\t\tField: value,\n\t}\n
func mapLiteralToAssignments(literal string) string {
	var result strings.Builder
	lines := strings.Split(literal, "\n")
	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)

		// Detecteer opening: "Key": {
		if strings.HasPrefix(trimmed, `"`) && strings.HasSuffix(trimmed, ": {") {
			// Extraheer de key
			colonIdx := strings.Index(trimmed, `": {`)
			key := trimmed[1:colonIdx]
			result.WriteString(fmt.Sprintf("\tMetaRegistry[%q] = TypeMeta{\n", key))
			continue
		}

		// Detecteer sluiting: },
		if trimmed == "}," {
			result.WriteString("\t}\n")
			continue
		}

		// Alle andere regels ongewijzigd
		if line != "" {
			result.WriteString(line + "\n")
		}
	}
	return result.String()
}

// writeEntiteitEntry schrijft de MetaRegistry entry voor een entiteit.
func writeEntiteitEntry(b *strings.Builder, ent model.V3Entiteit, d DerivedType, entIDKolom string) {
	b.WriteString(fmt.Sprintf("\t%q: {\n", ent.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTypenaam:    %q,\n", ent.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription: %q,\n", ent.Description))
	b.WriteString("\t\tMetatype:    MetatypeEntiteit,\n")
	b.WriteString(fmt.Sprintf("\t\tIsMaterieel: %t,\n", ent.IsMaterieel))
	b.WriteString(fmt.Sprintf("\t\tKleur:       %q,\n", ent.Kleur))
	b.WriteString(fmt.Sprintf("\t\tVeldnaam:    %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:     %q,\n", d.Padnaam))
	b.WriteString(fmt.Sprintf("\t\tFactory:     func() Representatie { return &%s{} },\n", ent.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tSliceFactory: func() any { return &[]%s{} },\n", ent.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTabelnaam:      %q,\n", d.Tabelnaam))
	b.WriteString(fmt.Sprintf("\t\tIDKolom:        %q,\n", d.IDKolom))
	b.WriteString(fmt.Sprintf("\t\tDBFactory:      func() Representatie { return &%s{} },\n", ent.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDBSliceFactory: func() any { return &[]%s{} },\n", ent.Typenaam))
	b.WriteString("\t\tHeeftPFK:               false,\n")
	b.WriteString("\t\tRelatieveAutoincrement: false,\n")

	// OnderliggendeGegevenselementen
	b.WriteString("\t\tOnderliggendeGegevenselementen: []OnderliggendGegevenselement{\n")
	for _, ge := range ent.Gegevenselementen {
		hubType := ent.Typenaam + "_" + ge.Naam
		rolnaam := ge.Naam + "s"
		jsonRolnaam := strings.ToLower(ge.Naam) + "s"
		mv := momentvoorkomenConst(ge.Momentvoorkomen)
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: %q, JSONRolnaam: %q, Doeltype: %q, Momentvoorkomen: %s},\n",
			rolnaam, jsonRolnaam, hubType, mv))
	}
	for _, rel := range ent.Relaties {
		rolnaam := relRolnaam(rel.Naam)
		jsonRolnaam := relJSONRolnaam(rel.Naam)
		mv := momentvoorkomenConst(rel.Momentvoorkomen)
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: %q, JSONRolnaam: %q, Doeltype: %q, Momentvoorkomen: %s},\n",
			rolnaam, jsonRolnaam, rel.Naam, mv))
	}
	if ent.IsMaterieel {
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Aanvang\", JSONRolnaam: \"aanvang\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", ent.Typenaam+"_Aanvang"))
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Einde\", JSONRolnaam: \"einde\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", ent.Typenaam+"_Einde"))
	}
	b.WriteString("\t\t},\n")
	b.WriteString("\t},\n")
}

// writeHubEntry schrijft een MetaRegistry entry voor een GE hub.
func writeHubEntry(b *strings.Builder, d DerivedType, desc string, kleur string, momentvoorkomenStr string, isMaterieel bool, geNaam string) {
	b.WriteString(fmt.Sprintf("\t%q: {\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTypenaam:     %q,\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription:  %q,\n", desc))
	b.WriteString("\t\tMetatype:     MetatypeGegevenselement,\n")
	b.WriteString(fmt.Sprintf("\t\tIsMaterieel:  %t,\n", isMaterieel))
	b.WriteString("\t\tGESubtype:    GESubtypeHub,\n")
	b.WriteString(fmt.Sprintf("\t\tDataTypenaam: %q,\n", d.DataTypenaam))
	b.WriteString(fmt.Sprintf("\t\tKleur:        %q,\n", kleur))
	b.WriteString(fmt.Sprintf("\t\tVeldnaam: %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:  %q,\n", d.Padnaam))
	inputType := d.Typenaam + "_Input"
	b.WriteString(fmt.Sprintf("\t\tFactory:  func() Representatie { return &%s{} },\n", inputType))
	b.WriteString(fmt.Sprintf("\t\tTabelnaam:              %q,\n", d.Tabelnaam))
	b.WriteString(fmt.Sprintf("\t\tIDKolom:               %q,\n", d.IDKolom))
	b.WriteString(fmt.Sprintf("\t\tDBFactory:             func() Representatie { return &%s{} },\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDBSliceFactory:        func() any { return &[]%s{} },\n", d.Typenaam))
	b.WriteString("\t\tHeeftPFK:              true,\n")
	b.WriteString("\t\tRelatieveAutoincrement: true,\n")
	b.WriteString(fmt.Sprintf("\t\tEntiteitIDKolom:       %q,\n", d.EntiteitIDKolom))
	b.WriteString(fmt.Sprintf("\t\tMomentvoorkomen:       %s,\n", momentvoorkomenConst(momentvoorkomenStr)))

	// OnderliggendeGegevenselementen
	b.WriteString("\t\tOnderliggendeGegevenselementen: []OnderliggendGegevenselement{\n")
	b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Data\", JSONRolnaam: \"data\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.DataTypenaam))
	if isMaterieel {
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Aanvang\", JSONRolnaam: \"aanvang\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.Typenaam+"_Aanvang"))
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Einde\", JSONRolnaam: \"einde\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.Typenaam+"_Einde"))
	}
	b.WriteString("\t\t},\n")
	b.WriteString("\t},\n")
}

// writeRelHubEntry schrijft een MetaRegistry entry voor een relatie hub.
func writeRelHubEntry(b *strings.Builder, d DerivedType, rel model.V3Relatie) {
	b.WriteString(fmt.Sprintf("\t%q: {\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTypenaam:     %q,\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription:  %q,\n", rel.Description))
	b.WriteString("\t\tMetatype:     MetatypeRelatie,\n")
	b.WriteString(fmt.Sprintf("\t\tIsMaterieel:  %t,\n", rel.IsMaterieel))
	b.WriteString("\t\tGESubtype:    GESubtypeHub,\n")
	b.WriteString(fmt.Sprintf("\t\tDataTypenaam: %q,\n", d.DataTypenaam))
	b.WriteString(fmt.Sprintf("\t\tKleur:        %q,\n", ""))
	b.WriteString(fmt.Sprintf("\t\tVeldnaam: %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:  %q,\n", d.Padnaam))
	inputType := d.Typenaam + "_Input"
	b.WriteString(fmt.Sprintf("\t\tFactory:  func() Representatie { return &%s{} },\n", inputType))
	b.WriteString(fmt.Sprintf("\t\tTabelnaam:              %q,\n", d.Tabelnaam))
	b.WriteString(fmt.Sprintf("\t\tIDKolom:               %q,\n", d.IDKolom))
	b.WriteString(fmt.Sprintf("\t\tDBFactory:             func() Representatie { return &%s{} },\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDBSliceFactory:        func() any { return &[]%s{} },\n", d.Typenaam))
	b.WriteString("\t\tHeeftPFK:              true,\n")
	b.WriteString("\t\tRelatieveAutoincrement: true,\n")
	b.WriteString(fmt.Sprintf("\t\tEntiteitIDKolom:           %q,\n", d.EntiteitIDKolom))
	b.WriteString(fmt.Sprintf("\t\tSecondaireEntiteitIDKolom: %q,\n", d.SecEntiteitIDKolom))
	b.WriteString(fmt.Sprintf("\t\tMomentvoorkomen:           %s,\n", momentvoorkomenConst(rel.Momentvoorkomen)))

	// OnderliggendeGegevenselementen
	b.WriteString("\t\tOnderliggendeGegevenselementen: []OnderliggendGegevenselement{\n")
	b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Data\", JSONRolnaam: \"data\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.DataTypenaam))
	if rel.IsMaterieel {
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Aanvang\", JSONRolnaam: \"aanvang\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.Typenaam+"_Aanvang"))
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Einde\", JSONRolnaam: \"einde\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.Typenaam+"_Einde"))
	}
	b.WriteString("\t\t},\n")
	b.WriteString("\t},\n")
}

// writeDataEntry schrijft een MetaRegistry entry voor een _Data type.
func writeDataEntry(b *strings.Builder, d DerivedType, desc string, kleur string) {
	b.WriteString(fmt.Sprintf("\t%q: {\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTypenaam:               %q,\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription:            %q,\n", fmt.Sprintf("Geversioned inhoud van %s.", d.BovenliggendTypenaam)))
	b.WriteString("\t\tMetatype:               MetatypeGegevenselement,\n")
	b.WriteString("\t\tGESubtype:              GESubtypeData,\n")
	b.WriteString(fmt.Sprintf("\t\tKleur:                  %q,\n", kleur))
	b.WriteString(fmt.Sprintf("\t\tVeldnaam:               %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:                %q,\n", d.Padnaam))
	b.WriteString(fmt.Sprintf("\t\tFactory:                func() Representatie { return &%s{} },\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tSliceFactory:           func() any { return &[]%s{} },\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTabelnaam:              %q,\n", d.Tabelnaam))
	b.WriteString(fmt.Sprintf("\t\tIDKolom:                %q,\n", d.IDKolom))
	b.WriteString(fmt.Sprintf("\t\tDBFactory:              func() Representatie { return &%s{} },\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDBSliceFactory:         func() any { return &[]%s{} },\n", d.Typenaam))
	b.WriteString("\t\tHeeftPFK:               true,\n")
	b.WriteString("\t\tRelatieveAutoincrement: true,\n")
	b.WriteString(fmt.Sprintf("\t\tEntiteitIDKolom:        %q,\n", d.EntiteitIDKolom))
	b.WriteString("\t\tMomentvoorkomen:        Enkelvoudig,\n")
	b.WriteString(fmt.Sprintf("\t\tBovenliggendTypenaam:   %q,\n", d.BovenliggendTypenaam))
	b.WriteString("\t},\n")
}

// writeAanvangEindeEntry schrijft een MetaRegistry entry voor een _Aanvang/_Einde type.
func writeAanvangEindeEntry(b *strings.Builder, d DerivedType, kleur string, suffix string, parentType string) {
	geSubtype := "GESubtypeAanvang"
	descPrefix := "Aanvangsdatum"
	if suffix == "Einde" {
		geSubtype = "GESubtypeEinde"
		descPrefix = "Einddatum"
	}

	b.WriteString(fmt.Sprintf("\t%q: {\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTypenaam:               %q,\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription:            %q,\n", fmt.Sprintf("%s van %s.", descPrefix, parentType)))
	b.WriteString("\t\tMetatype:               MetatypeGegevenselement,\n")
	b.WriteString(fmt.Sprintf("\t\tGESubtype:              %s,\n", geSubtype))
	b.WriteString(fmt.Sprintf("\t\tKleur:                  %q,\n", kleur))
	b.WriteString(fmt.Sprintf("\t\tVeldnaam:               %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:                %q,\n", d.Padnaam))
	b.WriteString(fmt.Sprintf("\t\tFactory:                func() Representatie { return &%s{} },\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tSliceFactory:           func() any { return &[]%s{} },\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTabelnaam:              %q,\n", d.Tabelnaam))
	b.WriteString(fmt.Sprintf("\t\tIDKolom:                %q,\n", d.IDKolom))
	b.WriteString(fmt.Sprintf("\t\tDBFactory:              func() Representatie { return &%s{} },\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tDBSliceFactory:         func() any { return &[]%s{} },\n", d.Typenaam))
	b.WriteString("\t\tHeeftPFK:               true,\n")
	b.WriteString("\t\tRelatieveAutoincrement: true,\n")
	b.WriteString(fmt.Sprintf("\t\tEntiteitIDKolom:        %q,\n", d.EntiteitIDKolom))
	b.WriteString("\t\tMomentvoorkomen:        Enkelvoudig,\n")
	b.WriteString(fmt.Sprintf("\t\tBovenliggendTypenaam:   %q,\n", d.BovenliggendTypenaam))
	b.WriteString("\t},\n")
}

// momentvoorkomenConst converteert een string naar de Go-constante.
func momentvoorkomenConst(s string) string {
	if s == "meervoudig" {
		return "Meervoudig"
	}
	return "Enkelvoudig"
}
