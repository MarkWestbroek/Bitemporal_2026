package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// generateDatatypeRegistry genereert datatype_registry.go met alle custom gegevenstypen
// uit het V3 model, inclusief validatie-, normalisatie- en weergave-metadata.
// Standalone modus: genereert een eigen var DatatypeRegistry.
func generateDatatypeRegistry(v3 model.V3Model) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("DatatypeRegistry — custom gegevenstypen met validatie en weergave.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))

	if len(v3.Datatypes) == 0 {
		b.WriteString("// Geen datatypes gedefinieerd in het model.\nvar DatatypeRegistry = []V3Datatype{}\n")
		return b.String(), nil
	}

	b.WriteString("var DatatypeRegistry = []V3Datatype{\n")
	for _, dt := range v3.Datatypes {
		writeDatatypeEntry(&b, dt)
	}
	b.WriteString("}\n")

	return b.String(), nil
}

// generateDatatypeRegistryAdditive genereert een additive datatype_registry die
// entries toevoegt aan de bestaande DatatypeRegistry via een init() functie.
func generateDatatypeRegistryAdditive(v3 model.V3Model) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("Additieve DatatypeRegistry-entries — voegt datatypes toe aan de bestaande DatatypeRegistry.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))

	if len(v3.Datatypes) == 0 {
		b.WriteString("// Geen datatypes gedefinieerd in het model.\n")
		return b.String(), nil
	}

	b.WriteString("func init() {\n")
	b.WriteString("\tDatatypeRegistry = append(DatatypeRegistry,\n")
	for _, dt := range v3.Datatypes {
		writeDatatypeEntry(&b, dt)
	}
	b.WriteString("\t)\n")
	b.WriteString("}\n")

	return b.String(), nil
}

// writeDatatypeEntry schrijft één V3Datatype entry.
func writeDatatypeEntry(b *strings.Builder, dt model.V3Datatype) {
	b.WriteString("\t{\n")
	b.WriteString(fmt.Sprintf("\t\tNaam:      %q,\n", dt.Naam))
	if dt.Description != "" {
		b.WriteString(fmt.Sprintf("\t\tDescription: %q,\n", dt.Description))
	}
	b.WriteString(fmt.Sprintf("\t\tBasistype: %q,\n", dt.Basistype))
	if dt.Format != "" {
		b.WriteString(fmt.Sprintf("\t\tFormat:    %q,\n", dt.Format))
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

	b.WriteString("\t},\n")
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
	b.WriteString("\t\t},\n")
}
