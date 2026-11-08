package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// generateDatatypeRegistry genereert datatype_registry.go met alle custom gegevenstypen
// uit het V3 model, inclusief validatie-, normalisatie- en weergave-metadata.
// Standalone modus: genereert een eigen var DatatypeRegistry.
func generateDatatypeRegistry(v3 model.V3Model, _ codegenOptions) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("DatatypeRegistry — custom gegevenstypen met validatie en weergave.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))

	if len(v3.Datatypes) == 0 {
		b.WriteString("// Geen datatypes gedefinieerd in het model.\nvar DatatypeRegistry = []V3Datatype{}\n")
		return b.String(), nil
	}

	b.WriteString("var DatatypeRegistry = []V3Datatype{\n")
	for _, dt := range v3.Datatypes {
		writeDatatypeEntry(&b, dt, false)
	}
	b.WriteString("}\n")

	return b.String(), nil
}

// generateDatatypeRegistryAdditive genereert een additive datatype_registry die
// entries toevoegt aan de bestaande DatatypeRegistry via een init() functie.
func generateDatatypeRegistryAdditive(v3 model.V3Model, opts codegenOptions) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("Additieve DatatypeRegistry-entries — voegt datatypes toe aan de bestaande DatatypeRegistry.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))

	// Filter datatypes: in additive modus alleen datatypes die bij dit domein horen.
	// Datatypes uit andere domeinen worden door dat domein zelf gegenereerd.
	var eigenDatatypes []model.V3Datatype
	for _, dt := range v3.Datatypes {
		if strings.TrimSpace(dt.Domein) == opts.domein || (dt.Domein == "" && opts.domein == "register") {
			eigenDatatypes = append(eigenDatatypes, dt)
		}
	}

	funcName := opts.initFuncName("DatatypeRegistry")
	if isCanoniekDatatypePakket(opts.domein) {
		return generateCanoniekeDatatypeRegistry(eigenDatatypes, funcName), nil
	}
	if len(eigenDatatypes) == 0 {
		b.WriteString(fmt.Sprintf("func %s() {\n", funcName))
		b.WriteString("\t// Geen domein-eigen datatypes; datatypes uit andere domeinen worden daar gegenereerd.\n")
		b.WriteString("}\n")
		return b.String(), nil
	}

	b.WriteString(fmt.Sprintf("func %s() {\n", funcName))
	b.WriteString("\tDatatypeRegistry = append(DatatypeRegistry,\n")
	for _, dt := range eigenDatatypes {
		writeDatatypeEntry(&b, dt, true)
	}
	b.WriteString("\t)\n")
	b.WriteString("}\n")

	return b.String(), nil
}

// writeDatatypeEntry schrijft één V3Datatype entry.
// In additive modus moet elke append-argument expliciet getypeerd zijn.
func writeDatatypeEntry(b *strings.Builder, dt model.V3Datatype, typed bool) {
	if typed {
		b.WriteString("\tV3Datatype{\n")
	} else {
		b.WriteString("\t{\n")
	}
	b.WriteString(fmt.Sprintf("\t\tNaam:      %q,\n", dt.Naam))
	if dt.UUID != "" {
		b.WriteString(fmt.Sprintf("\t\tUUID:      %q,\n", dt.UUID))
	}
	if dt.Description != "" {
		b.WriteString(fmt.Sprintf("\t\tDescription: %q,\n", dt.Description))
	}
	b.WriteString(fmt.Sprintf("\t\tBasistype: %q,\n", dt.Basistype))
	if dt.Format != "" {
		b.WriteString(fmt.Sprintf("\t\tFormat:    %q,\n", dt.Format))
	}
	if dt.Domein != "" {
		b.WriteString(fmt.Sprintf("\t\tDomein:    %q,\n", dt.Domein))
	}
	if dt.Positie != nil {
		b.WriteString(fmt.Sprintf("\t\tPositie:   &V3Positie{X: %g, Y: %g},\n", dt.Positie.X, dt.Positie.Y))
	}
	if dt.LayoutLocked {
		b.WriteString("\t\tLayoutLocked: true,\n")
	}

	if dt.Validatie != nil {
		writeValidatie(b, dt.Validatie)
	}

	if dt.Normalisatie != "" {
		b.WriteString(fmt.Sprintf("\t\tNormalisatie: %q,\n", dt.Normalisatie))
	}

	if dt.Weergave != nil {
		writeWeergave(b, dt.Weergave)
	}

	if dt.ExterneReferentie != "" {
		b.WriteString(fmt.Sprintf("\t\tExterneReferentie: %q,\n", dt.ExterneReferentie))
	}

	b.WriteString("\t},\n")
}

// isCanoniekDatatypePakket: het domein gegevenstypen is de gedeelde datatypebibliotheek. Zijn
// registry wordt als laatste geïnitialiseerd (metaregistry_plumbing.go) en VERVANGT dan wat
// andere domeinen onder dezelfde naam hebben toegevoegd (bv. URL of Emailadres uit CG), in
// plaats van er een tweede entry naast te zetten. Besluit Mark 07-11-2026: gegevenstypen komt
// uit het model; het gegenereerde bestand houdt dezelfde vorm als het vroegere handgemaakte
// gegevenstypen_datatype_registry.go (functie gegevenstypen(), die ook de snapshot-tests lezen).
func isCanoniekDatatypePakket(domein string) bool {
	return strings.EqualFold(strings.TrimSpace(domein), "gegevenstypen")
}

// generateCanoniekeDatatypeRegistry schrijft de registry van het gegevenstypen-domein: de init
// vervangt-of-voegt-toe via registreerOfVervangDatatype (model/metaregistry_plumbing.go), de
// lijst zelf staat in gegevenstypen().
func generateCanoniekeDatatypeRegistry(dts []model.V3Datatype, funcName string) string {
	var b strings.Builder
	b.WriteString(fileHeader("Canonieke DatatypeRegistry van het domein gegevenstypen — vervangt datatypes met\n" +
		"// dezelfde naam uit andere domeinen (registreerOfVervangDatatype; als laatste aangeroepen in\n" +
		"// metaregistry_plumbing.go). Gegenereerd door cmd/codegen — niet handmatig bewerken;\n" +
		"// wijzig de datatypes in het model (domein gegevenstypen)."))
	b.WriteString(fmt.Sprintf("func %s() {\n", funcName))
	b.WriteString("\tfor _, dt := range gegevenstypen() {\n\t\tregistreerOfVervangDatatype(dt)\n\t}\n}\n\n")
	b.WriteString("// gegevenstypen geeft de canonieke set algemene datatypes terug.\n")
	b.WriteString("func gegevenstypen() []V3Datatype {\n\treturn []V3Datatype{\n")
	for _, dt := range dts {
		writeDatatypeEntry(&b, dt, false)
	}
	b.WriteString("\t}\n}\n")
	return b.String()
}

// writeValidatie schrijft het Validatie blok.
func writeValidatie(b *strings.Builder, v *model.V3Validatie) {
	b.WriteString("\t\tValidatie: &V3Validatie{\n")
	if v.Pattern != "" {
		b.WriteString(fmt.Sprintf("\t\t\tPattern:     `%s`,\n", v.Pattern))
	}
	if v.MinLength != nil {
		b.WriteString(fmt.Sprintf("\t\t\tMinLength:   intPtr(%d),\n", *v.MinLength))
	}
	if v.MaxLength != nil {
		b.WriteString(fmt.Sprintf("\t\t\tMaxLength:   intPtr(%d),\n", *v.MaxLength))
	}
	if len(v.Voorbeelden) > 0 {
		items := make([]string, len(v.Voorbeelden))
		for i, vb := range v.Voorbeelden {
			items[i] = fmt.Sprintf("%q", vb)
		}
		b.WriteString(fmt.Sprintf("\t\t\tVoorbeelden: []string{%s},\n", strings.Join(items, ", ")))
	}
	if v.Foutmelding != "" {
		b.WriteString(fmt.Sprintf("\t\t\tFoutmelding: %q,\n", v.Foutmelding))
	}
	if len(v.Regels) > 0 {
		b.WriteString("\t\t\tRegels: []V3Regel{\n")
		for _, r := range v.Regels {
			b.WriteString(fmt.Sprintf("\t\t\t\t{Naam: %q, Type: %q, Expressie: %q},\n", r.Naam, r.Type, r.Expressie))
		}
		b.WriteString("\t\t\t},\n")
	}
	b.WriteString("\t\t},\n")
}

// writeWeergave schrijft het Weergave blok.
func writeWeergave(b *strings.Builder, w *model.V3Weergave) {
	b.WriteString("\t\tWeergave: &V3Weergave{\n")
	if w.Placeholder != "" {
		b.WriteString(fmt.Sprintf("\t\t\tPlaceholder: %q,\n", w.Placeholder))
	}
	if w.InputMask != "" {
		b.WriteString(fmt.Sprintf("\t\t\tInputMask:   %q,\n", w.InputMask))
	}
	if w.Widget != "" {
		b.WriteString(fmt.Sprintf("\t\t\tWidget:      %q,\n", w.Widget))
	}
	if w.Prefix != "" {
		b.WriteString(fmt.Sprintf("\t\t\tPrefix:      %q,\n", w.Prefix))
	}
	if w.Suffix != "" {
		b.WriteString(fmt.Sprintf("\t\t\tSuffix:      %q,\n", w.Suffix))
	}
	if w.Multiline {
		b.WriteString("\t\t\tMultiline:   true,\n")
	}
	if w.Decimalen != nil {
		b.WriteString(fmt.Sprintf("\t\t\tDecimalen:   intPtr(%d),\n", *w.Decimalen))
	}
	if w.Scheiding != "" {
		b.WriteString(fmt.Sprintf("\t\t\tScheiding:   %q,\n", w.Scheiding))
	}
	b.WriteString("\t\t},\n")
}

// generateDatatypeAliases genereert Go type-aliases voor custom datatypes.
// Dit bestand bevat bijv. `type NLPostcode string` zodat gegenereerde structs
// deze types als veldtype kunnen gebruiken. Het bestand wordt altijd zonder
// prefix gegenereerd (gedeeld over alle domeinen), omdat Go type-declaraties
// package-breed uniek moeten zijn.
func generateDatatypeAliases(v3 model.V3Model, _ codegenOptions) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("Datatype aliases — Go type-definities voor custom datatypes.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))

	if len(v3.Datatypes) == 0 {
		b.WriteString("// Geen custom datatypes in het model.\n")
		return b.String(), nil
	}

	b.WriteString("\n")
	for _, dt := range v3.Datatypes {
		goBase := jsonSchemaTypeToGo(dt.Basistype)
		if dt.Description != "" {
			b.WriteString(fmt.Sprintf("// %s — %s\n", dt.Naam, dt.Description))
		}
		b.WriteString(fmt.Sprintf("type %s %s\n\n", dt.Naam, goBase))
	}

	return b.String(), nil
}

// jsonSchemaTypeToGo mapt JSON Schema basistypes naar Go types.
// Onbekende of lege types worden als "string" behandeld.
func jsonSchemaTypeToGo(basistype string) string {
	switch basistype {
	case "integer":
		return "int64"
	case "number":
		return "float64"
	case "boolean":
		return "bool"
	case "string", "":
		return "string"
	default:
		return basistype
	}
}
