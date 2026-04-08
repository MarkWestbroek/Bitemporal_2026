package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// layoutInfo bevat editor-layout metadata die doorgegeven wordt aan write-functies.
type layoutInfo struct {
	Positie          *model.V3Positie
	EdgeID           string
	SourceHandle     string
	TargetHandle     string
	DoelEdgeID       string
	DoelSourceHandle string
	DoelTargetHandle string
	UseEdges         []model.V3UseEdge
}

// generateMetaRegistry genereert metaregistry.go met alle TypeMeta entries (standalone modus).
func generateMetaRegistry(v3 model.V3Model, opts codegenOptions) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("MetaRegistry — de single source of truth voor alle type-metadata.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))
	b.WriteString("\n")

	b.WriteString("// MetaRegistry is the hardcoded meta model registry.\n")
	b.WriteString("var MetaRegistry = MetaRegistryType{\n")

	writeAllEntries(&b, v3, opts)

	b.WriteString("}\n")
	return b.String(), nil
}

// generateMetaRegistryAdditive genereert een additive metaregistry met named init function.
func generateMetaRegistryAdditive(v3 model.V3Model, opts codegenOptions) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("Additieve MetaRegistry-entries — voegt types toe aan de bestaande MetaRegistry.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))
	b.WriteString("\n")

	funcName := opts.initFuncName("MetaRegistry")
	b.WriteString(fmt.Sprintf("func %s() {\n", funcName))

	// Genereer entries in map-literal formaat, converteer daarna naar assignments
	var entries strings.Builder
	writeAllEntries(&entries, v3, opts)
	b.WriteString(mapLiteralToAssignments(entries.String()))

	// ReferentielijstInstanties
	writeReferentielijstInstanties(&b, v3)

	// VoegOnderliggendGEToe calls voor cross-domein referentielijst-items relaties
	writeVoegOnderliggendGEToe(&b, v3)

	b.WriteString("}\n")
	return b.String(), nil
}

// writeAllEntries schrijft alle TypeMeta entries in map-literal formaat.
func writeAllEntries(b *strings.Builder, v3 model.V3Model, opts codegenOptions) {
	// Pre-scan: detecteer padnaam-conflicten bij GE hubs.
	// Als twee hubs dezelfde meervoud/padnaam zouden krijgen (bijv. "contactgegevens"
	// bij Organisatie én Persoon), prefix dan met de entiteitsnaam.
	gePadnaamCount := map[string]int{}
	for _, ent := range v3.Entiteiten {
		for _, ge := range ent.Gegevenselementen {
			p := ge.Meervoud
			if p == "" {
				hubType := geHubTypeName(ent, ge.Naam)
				p = strings.ToLower(hubType) + "s"
			}
			gePadnaamCount[p]++
		}
	}

	for _, ent := range v3.Entiteiten {
		entIDKolom := strings.ToLower(ent.Typenaam) + "_id"

		// ---- Entiteit ----
		d := deriveEntiteit(ent)
		entLayout := &layoutInfo{Positie: ent.Positie}
		writeEntiteitEntry(b, ent, d, entIDKolom, opts.domein, entLayout)

		// ---- GE hubs ----
		for _, ge := range ent.Gegevenselementen {
			hubType := geHubTypeName(ent, ge.Naam)
			padnaam := ge.Meervoud
			if padnaam == "" {
				padnaam = strings.ToLower(hubType) + "s"
			}
			// Bij padnaam-conflicten: gebruik de volledige hub-typenaam in snake_case
			if gePadnaamCount[padnaam] > 1 {
				padnaam = toSnakeCase(hubType)
			}
			dHub := deriveHub(ent.Typenaam, hubType, "gegevenselement", ge.IsMaterieel, padnaam, "")
			li := &layoutInfo{Positie: ge.Positie, EdgeID: ge.ID, SourceHandle: ge.SourceHandle, TargetHandle: ge.TargetHandle, UseEdges: ge.UseEdges}
			writeHubEntry(b, dHub, ge.Description, ent.Kleur, ge.Momentvoorkomen, ge.IsMaterieel, ge.Naam, ge.AfgeleideVelden, opts.domein, li)
		}

		// ---- Relatie hubs ----
		for _, rel := range ent.Relaties {
			secIDKolom := strings.ToLower(rel.DoelEntiteit) + "_id"
			dHub := deriveHub(ent.Typenaam, rel.Naam, "relatie", rel.IsMaterieel, rel.Meervoud, secIDKolom)
			writeRelHubEntry(b, dHub, rel, opts.domein)
		}

		// ---- _Data types ----
		for _, ge := range ent.Gegevenselementen {
			hubType := geHubTypeName(ent, ge.Naam)
			dData := deriveData(hubType, ent.Typenaam)
			writeDataEntry(b, dData, ge.Description, ent.Kleur)
		}
		for _, rel := range ent.Relaties {
			dData := deriveData(rel.Naam, ent.Typenaam)
			writeDataEntry(b, dData, rel.Description, ent.Kleur)
		}

		// ---- Entiteits-level Aanvang/Einde (materiële entiteiten) ----
		if ent.IsMaterieel {
			for _, suffix := range []string{"Aanvang", "Einde"} {
				dAE := deriveAanvangEinde(ent.Typenaam, ent.Typenaam, suffix)
				writeAanvangEindeEntry(b, dAE, ent.Kleur, suffix, ent.Typenaam)
			}
		}

		// ---- Hub-level Aanvang/Einde (materiële hubs) ----
		for _, ge := range ent.Gegevenselementen {
			if !ge.IsMaterieel {
				continue
			}
			hubType := geHubTypeName(ent, ge.Naam)
			for _, suffix := range []string{"Aanvang", "Einde"} {
				dAE := deriveAanvangEinde(hubType, ent.Typenaam, suffix)
				writeAanvangEindeEntry(b, dAE, ent.Kleur, suffix, hubType)
			}
		}
		for _, rel := range ent.Relaties {
			if !rel.IsMaterieel {
				continue
			}
			for _, suffix := range []string{"Aanvang", "Einde"} {
				dAE := deriveAanvangEinde(rel.Naam, ent.Typenaam, suffix)
				writeAanvangEindeEntry(b, dAE, ent.Kleur, suffix, rel.Naam)
			}
		}
	}
}

// writeEntiteitEntry schrijft de MetaRegistry entry voor een entiteit.
func writeEntiteitEntry(b *strings.Builder, ent model.V3Entiteit, d DerivedType, entIDKolom string, domein string, li *layoutInfo) {
	b.WriteString(fmt.Sprintf("\t%q: {\n", ent.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTypenaam:    %q,\n", ent.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tKlassenaam:  %q,\n", d.Klassenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription: %q,\n", ent.Description))
	b.WriteString("\t\tMetatype:    MetatypeEntiteit,\n")
	if ent.EntiteitSubtype != "" {
		b.WriteString(fmt.Sprintf("\t\tEntiteitSubtype: %s,\n", entiteitSubtypeConst(ent.EntiteitSubtype)))
	}
	b.WriteString(fmt.Sprintf("\t\tIsMaterieel: %t,\n", ent.IsMaterieel))
	if domein != "" {
		b.WriteString(fmt.Sprintf("\t\tDomein:      %q,\n", domein))
	}
	b.WriteString(fmt.Sprintf("\t\tKleur:       %q,\n", ent.Kleur))
	writeLayoutLine(b, li)
	b.WriteString(fmt.Sprintf("\t\tVeldnaam:    %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:     %q,\n", d.Padnaam))
	b.WriteString(fmt.Sprintf("\t\tMeervoud:    %q,\n", d.Meervoud))
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
		hubType := geHubTypeName(ent, ge.Naam)
		rolnaam := toPascalCase(ge.Meervoud)
		if rolnaam == "" {
			rolnaam = ge.Naam + "s"
		}
		jsonRolnaam := ge.Meervoud
		if jsonRolnaam == "" {
			jsonRolnaam = strings.ToLower(ge.Naam) + "s"
		}
		mv := momentvoorkomenConst(ge.Momentvoorkomen)
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: %q, JSONRolnaam: %q, Doeltype: %q, Momentvoorkomen: %s},\n",
			rolnaam, jsonRolnaam, hubType, mv))
	}
	for _, rel := range ent.Relaties {
		rolnaam := relRolnaam(rel.Naam, rel.Meervoud)
		jsonRolnaam := relJSONRolnaam(rel.Naam, rel.Meervoud)
		mv := momentvoorkomenConst(rel.Momentvoorkomen)
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: %q, JSONRolnaam: %q, Doeltype: %q, Momentvoorkomen: %s},\n",
			rolnaam, jsonRolnaam, rel.Naam, mv))
	}
	if ent.IsMaterieel {
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Aanvang\", JSONRolnaam: \"aanvang\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", ent.Typenaam+"_Aanvang"))
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Einde\", JSONRolnaam: \"einde\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", ent.Typenaam+"_Einde"))
	}
	b.WriteString("\t\t},\n")
	writeAfgeleideVelden(b, ent.AfgeleideVelden)
	b.WriteString("\t},\n")
}

// writeHubEntry schrijft een MetaRegistry entry voor een GE hub.
func writeHubEntry(b *strings.Builder, d DerivedType, desc string, kleur string, momentvoorkomenStr string, isMaterieel bool, geNaam string, afgeleideVelden []model.V3AfgeleidVeld, domein string, li *layoutInfo) {
	b.WriteString(fmt.Sprintf("\t%q: {\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTypenaam:     %q,\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tKlassenaam:   %q,\n", d.Klassenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription:  %q,\n", desc))
	b.WriteString("\t\tMetatype:     MetatypeGegevenselement,\n")
	b.WriteString(fmt.Sprintf("\t\tIsMaterieel:  %t,\n", isMaterieel))
	if domein != "" {
		b.WriteString(fmt.Sprintf("\t\tDomein: %q,\n", domein))
	}
	b.WriteString("\t\tGESubtype:    GESubtypeHub,\n")
	b.WriteString(fmt.Sprintf("\t\tDataTypenaam: %q,\n", d.DataTypenaam))
	b.WriteString(fmt.Sprintf("\t\tKleur:        %q,\n", kleur))
	b.WriteString(fmt.Sprintf("\t\tVeldnaam: %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:  %q,\n", d.Padnaam))
	b.WriteString(fmt.Sprintf("\t\tMeervoud: %q,\n", d.Meervoud))
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
	writeLayoutLine(b, li)

	// OnderliggendeGegevenselementen
	b.WriteString("\t\tOnderliggendeGegevenselementen: []OnderliggendGegevenselement{\n")
	b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Data\", JSONRolnaam: \"data\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.DataTypenaam))
	if isMaterieel {
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Aanvang\", JSONRolnaam: \"aanvang\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.Typenaam+"_Aanvang"))
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Einde\", JSONRolnaam: \"einde\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.Typenaam+"_Einde"))
	}
	b.WriteString("\t\t},\n")
	writeAfgeleideVelden(b, afgeleideVelden)
	b.WriteString("\t},\n")
}

// writeRelHubEntry schrijft een MetaRegistry entry voor een relatie hub.
func writeRelHubEntry(b *strings.Builder, d DerivedType, rel model.V3Relatie, domein string) {
	b.WriteString(fmt.Sprintf("\t%q: {\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTypenaam:     %q,\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tKlassenaam:   %q,\n", d.Klassenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription:  %q,\n", rel.Description))
	b.WriteString("\t\tMetatype:     MetatypeRelatie,\n")
	if rel.RelatieSubtype != "" {
		b.WriteString(fmt.Sprintf("\t\tRelatieSubtype: %s,\n", relatieSubtypeConst(rel.RelatieSubtype)))
	}
	if rel.ReferentielijstInstantie != "" {
		b.WriteString(fmt.Sprintf("\t\tReferentielijstInstantie: %q,\n", rel.ReferentielijstInstantie))
	}
	b.WriteString(fmt.Sprintf("\t\tIsMaterieel:  %t,\n", rel.IsMaterieel))
	if domein != "" {
		b.WriteString(fmt.Sprintf("\t\tDomein: %q,\n", domein))
	}
	b.WriteString("\t\tGESubtype:    GESubtypeHub,\n")
	b.WriteString(fmt.Sprintf("\t\tDataTypenaam: %q,\n", d.DataTypenaam))
	b.WriteString(fmt.Sprintf("\t\tKleur:        %q,\n", ""))
	b.WriteString(fmt.Sprintf("\t\tVeldnaam: %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:  %q,\n", d.Padnaam))
	b.WriteString(fmt.Sprintf("\t\tMeervoud: %q,\n", d.Meervoud))
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
	// Layout met volledige edge-info (bron→relatie + relatie→doel)
	relLayout := &layoutInfo{
		Positie: rel.Positie, EdgeID: rel.ID, SourceHandle: rel.SourceHandle, TargetHandle: rel.TargetHandle,
		DoelEdgeID: rel.DoelID, DoelSourceHandle: rel.DoelSourceHandle, DoelTargetHandle: rel.DoelTargetHandle,
		UseEdges: rel.UseEdges,
	}
	writeLayoutLine(b, relLayout)

	// OnderliggendeGegevenselementen
	b.WriteString("\t\tOnderliggendeGegevenselementen: []OnderliggendGegevenselement{\n")
	b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Data\", JSONRolnaam: \"data\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.DataTypenaam))
	if rel.IsMaterieel {
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Aanvang\", JSONRolnaam: \"aanvang\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.Typenaam+"_Aanvang"))
		b.WriteString(fmt.Sprintf("\t\t\t{Rolnaam: \"Einde\", JSONRolnaam: \"einde\", Doeltype: %q, Momentvoorkomen: Enkelvoudig},\n", d.Typenaam+"_Einde"))
	}
	b.WriteString("\t\t},\n")
	writeAfgeleideVelden(b, rel.AfgeleideVelden)
	b.WriteString("\t},\n")
}

// writeDataEntry schrijft een MetaRegistry entry voor een _Data type.
func writeDataEntry(b *strings.Builder, d DerivedType, desc string, kleur string) {
	b.WriteString(fmt.Sprintf("\t%q: {\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tTypenaam:               %q,\n", d.Typenaam))
	b.WriteString(fmt.Sprintf("\t\tKlassenaam:             %q,\n", d.Klassenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription:            %q,\n", fmt.Sprintf("Geversioned inhoud van %s.", d.BovenliggendTypenaam)))
	b.WriteString("\t\tMetatype:               MetatypeGegevenselement,\n")
	b.WriteString("\t\tGESubtype:              GESubtypeData,\n")
	b.WriteString(fmt.Sprintf("\t\tKleur:                  %q,\n", kleur))
	b.WriteString(fmt.Sprintf("\t\tVeldnaam:               %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:                %q,\n", d.Padnaam))
	b.WriteString(fmt.Sprintf("\t\tMeervoud:               %q,\n", d.Meervoud))
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
	b.WriteString(fmt.Sprintf("\t\tKlassenaam:             %q,\n", d.Klassenaam))
	b.WriteString(fmt.Sprintf("\t\tDescription:            %q,\n", fmt.Sprintf("%s van %s.", descPrefix, parentType)))
	b.WriteString("\t\tMetatype:               MetatypeGegevenselement,\n")
	b.WriteString(fmt.Sprintf("\t\tGESubtype:              %s,\n", geSubtype))
	b.WriteString(fmt.Sprintf("\t\tKleur:                  %q,\n", kleur))
	b.WriteString(fmt.Sprintf("\t\tVeldnaam:               %q,\n", d.Veldnaam))
	b.WriteString(fmt.Sprintf("\t\tPadnaam:                %q,\n", d.Padnaam))
	b.WriteString(fmt.Sprintf("\t\tMeervoud:               %q,\n", d.Meervoud))
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

// ---- Layout helpers ----

// writeLayoutLine schrijft de Layout: &EditorLayout{...} regel als er layout-info is.
func writeLayoutLine(b *strings.Builder, li *layoutInfo) {
	if li == nil {
		return
	}

	hasPositie := li.Positie != nil
	hasEdge := li.EdgeID != "" || li.SourceHandle != "" || li.TargetHandle != ""
	hasDoel := li.DoelEdgeID != "" || li.DoelSourceHandle != "" || li.DoelTargetHandle != ""
	hasUseEdges := len(li.UseEdges) > 0

	if !hasPositie && !hasEdge && !hasDoel && !hasUseEdges {
		return
	}
	if hasPositie && !hasEdge && !hasDoel && !hasUseEdges {
		b.WriteString(fmt.Sprintf("\t\tLayout: &EditorLayout{Positie: &V3Positie{X: %g, Y: %g}},\n", li.Positie.X, li.Positie.Y))
		return
	}

	b.WriteString("\t\tLayout: &EditorLayout{\n")
	if hasPositie {
		b.WriteString(fmt.Sprintf("\t\t\tPositie: &V3Positie{X: %g, Y: %g},\n", li.Positie.X, li.Positie.Y))
	}
	if li.EdgeID != "" {
		b.WriteString(fmt.Sprintf("\t\t\tEdgeID: %q,\n", li.EdgeID))
	}
	if li.SourceHandle != "" {
		b.WriteString(fmt.Sprintf("\t\t\tSourceHandle: %q,\n", li.SourceHandle))
	}
	if li.TargetHandle != "" {
		b.WriteString(fmt.Sprintf("\t\t\tTargetHandle: %q,\n", li.TargetHandle))
	}
	if li.DoelEdgeID != "" {
		b.WriteString(fmt.Sprintf("\t\t\tDoelEdgeID: %q,\n", li.DoelEdgeID))
	}
	if li.DoelSourceHandle != "" {
		b.WriteString(fmt.Sprintf("\t\t\tDoelSourceHandle: %q,\n", li.DoelSourceHandle))
	}
	if li.DoelTargetHandle != "" {
		b.WriteString(fmt.Sprintf("\t\t\tDoelTargetHandle: %q,\n", li.DoelTargetHandle))
	}
	if hasUseEdges {
		b.WriteString("\t\t\tUseEdges: []V3UseEdge{\n")
		for _, ue := range li.UseEdges {
			b.WriteString(fmt.Sprintf("\t\t\t\t{Doel: %q", ue.Doel))
			if ue.ID != "" {
				b.WriteString(fmt.Sprintf(", ID: %q", ue.ID))
			}
			if ue.SourceHandle != "" {
				b.WriteString(fmt.Sprintf(", SourceHandle: %q", ue.SourceHandle))
			}
			if ue.TargetHandle != "" {
				b.WriteString(fmt.Sprintf(", TargetHandle: %q", ue.TargetHandle))
			}
			if ue.Hidden {
				b.WriteString(", Hidden: true")
			}
			b.WriteString("},\n")
		}
		b.WriteString("\t\t\t},\n")
	}
	b.WriteString("\t\t},\n")
}

// ---- ReferentielijstInstanties ----

// writeReferentielijstInstanties schrijft ReferentielijstInstantieRegistry entries.
func writeReferentielijstInstanties(b *strings.Builder, v3 model.V3Model) {
	if len(v3.ReferentielijstInstanties) == 0 {
		return
	}
	b.WriteString("\n\t// Referentielijst-instantie metadata + editor-posities\n")
	for _, ri := range v3.ReferentielijstInstanties {
		b.WriteString(fmt.Sprintf("\tReferentielijstInstantieRegistry[%q] = ReferentielijstInstantieInfo{\n", ri.Systeemnaam))
		b.WriteString(fmt.Sprintf("\t\tNaam: %q", ri.Naam))
		if ri.Omschrijving != "" {
			b.WriteString(fmt.Sprintf(", Omschrijving: %q", ri.Omschrijving))
		}
		b.WriteString(",\n")
		if ri.Positie != nil {
			b.WriteString(fmt.Sprintf("\t\tLayout: &EditorLayout{Positie: &V3Positie{X: %g, Y: %g}},\n", ri.Positie.X, ri.Positie.Y))
		}
		b.WriteString("\t}\n")
	}
}

// writeVoegOnderliggendGEToe genereert VoegOnderliggendGEToe calls voor
// referentielijst-items relaties die cross-domein aan Referentielijst toegevoegd worden.
//
// Dit is alleen nodig als de parent-entiteit (Referentielijst) NIET in de huidige
// codegen-run zit. Als Referentielijst wél wordt gegenereerd, staan de items-relaties
// al inline in OnderliggendeGegevenselementen.
func writeVoegOnderliggendGEToe(b *strings.Builder, v3 model.V3Model) {
	// Bouw set van entiteiten die in deze codegen-run worden gegenereerd.
	entiteitenInRun := map[string]bool{}
	for _, ent := range v3.Entiteiten {
		entiteitenInRun[ent.Typenaam] = true
	}

	var calls []string
	for _, ent := range v3.Entiteiten {
		for _, rel := range ent.Relaties {
			if rel.RelatieSubtype != "referentielijst_items" {
				continue
			}
			// De parent is altijd "Referentielijst". Als die al in deze run zit,
			// is de relatie al inline opgenomen — geen VoegOnderliggendGEToe nodig.
			if entiteitenInRun["Referentielijst"] {
				continue
			}
			rolnaam := relRolnaam(rel.Naam, rel.Meervoud)
			jsonRolnaam := relJSONRolnaam(rel.Naam, rel.Meervoud)
			mv := momentvoorkomenConst(rel.Momentvoorkomen)
			calls = append(calls, fmt.Sprintf(
				"\tVoegOnderliggendGEToe(\"Referentielijst\", OnderliggendGegevenselement{\n\t\tRolnaam: %q, JSONRolnaam: %q, Doeltype: %q, Momentvoorkomen: %s,\n\t})\n",
				rolnaam, jsonRolnaam, rel.Naam, mv))
		}
	}
	if len(calls) == 0 {
		return
	}
	b.WriteString("\n\t// Domein-specifieke items-relatie toevoegen aan register-scope Referentielijst\n")
	for _, c := range calls {
		b.WriteString(c)
	}
}

// ---- Overige helpers ----

// mapLiteralToAssignments converteert MetaRegistry map-literal entries naar init()-assignments.
// Input:  \t"Key": {\n\t\tField: value,\n\t},\n
// Output: \tMetaRegistry["Key"] = TypeMeta{\n\t\tField: value,\n\t}\n
func mapLiteralToAssignments(literal string) string {
	var result strings.Builder
	lines := strings.Split(literal, "\n")
	inEntry := false
	braceDepth := 0

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)

		// Detecteer opening: "Key": {
		if strings.HasPrefix(trimmed, `"`) && strings.HasSuffix(trimmed, ": {") {
			// Extraheer de key
			colonIdx := strings.Index(trimmed, `": {`)
			key := trimmed[1:colonIdx]
			result.WriteString(fmt.Sprintf("\tMetaRegistry[%q] = TypeMeta{\n", key))
			inEntry = true
			braceDepth = 1
			continue
		}

		if inEntry {
			// Sluit alleen de top-level TypeMeta entry; nested composites behouden hun },
			if trimmed == "}," && braceDepth == 1 {
				result.WriteString("\t}\n")
				inEntry = false
				braceDepth = 0
				continue
			}

			if line != "" {
				result.WriteString(line + "\n")
			}

			braceDepth += strings.Count(line, "{")
			braceDepth -= strings.Count(line, "}")
			continue
		}

		// Alle andere regels ongewijzigd
		if line != "" {
			result.WriteString(line + "\n")
		}
	}
	return result.String()
}

// momentvoorkomenConst converteert een string naar de Go-constante.
func momentvoorkomenConst(s string) string {
	if s == "meervoudig" {
		return "Meervoudig"
	}
	return "Enkelvoudig"
}

// writeAfgeleideVelden schrijft het AfgeleideVelden-blok als er afgeleide velden zijn.
func writeAfgeleideVelden(b *strings.Builder, avs []model.V3AfgeleidVeld) {
	if len(avs) == 0 {
		return
	}
	b.WriteString("\t\tAfgeleideVelden: []AfgeleidVeld{\n")
	for _, av := range avs {
		b.WriteString("\t\t\t{\n")
		b.WriteString(fmt.Sprintf("\t\t\t\tNaam:                %q,\n", av.Naam))
		if av.Description != "" {
			b.WriteString(fmt.Sprintf("\t\t\t\tDescription:         %q,\n", av.Description))
		}
		b.WriteString(fmt.Sprintf("\t\t\t\tGoType:              %q,\n", av.GoType))
		if av.AfleidingsregelTaal != "" {
			b.WriteString(fmt.Sprintf("\t\t\t\tAfleidingsregelTaal: %q,\n", av.AfleidingsregelTaal))
		}
		if av.Afleidingsregel != "" {
			b.WriteString(fmt.Sprintf("\t\t\t\tAfleidingsregel:     %q,\n", av.Afleidingsregel))
		}
		if av.IsWeergaveVeld || av.WeergaveVeld {
			b.WriteString("\t\t\t\tIsWeergaveVeld:      true,\n")
		}
		b.WriteString("\t\t\t},\n")
	}
	b.WriteString("\t\t},\n")
}

// entiteitSubtypeConst converteert een subtype-string naar de Go-constante.
func entiteitSubtypeConst(s string) string {
	switch s {
	case "referentielijst":
		return "EntiteitSubtypeReferentielijst"
	case "referentielijst_item":
		return "EntiteitSubtypeReferentielijstItem"
	default:
		return fmt.Sprintf("%q", s)
	}
}

// relatieSubtypeConst converteert een RelatieSubtype-string naar de Go-constante.
func relatieSubtypeConst(s string) string {
	switch s {
	case "referentielijst_items":
		return "RelatieSubtypeReferentielijstItems"
	default:
		return fmt.Sprintf("%q", s)
	}
}
