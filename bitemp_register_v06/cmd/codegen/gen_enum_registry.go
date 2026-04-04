package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// generateEnumRegistryStandalone genereert enum_registry.go met EnumWaarden + EnumEditorLayouts (standalone).
func generateEnumRegistryStandalone(v3 model.V3Model, _ codegenOptions) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("EnumRegistry — enum-waarden en editor-posities.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))
	b.WriteString("\n")

	if len(v3.Enums) == 0 {
		b.WriteString("// Geen enums gedefinieerd in het model.\n")
		return b.String(), nil
	}

	b.WriteString("func init() {\n")
	writeEnumRegistryEntries(&b, v3.Enums)
	b.WriteString("}\n")

	return b.String(), nil
}

// generateEnumRegistryAdditive genereert enum_registry.go met named init function (additive).
func generateEnumRegistryAdditive(v3 model.V3Model, opts codegenOptions) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("Enum-registraties.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))
	b.WriteString("\n")

	funcName := opts.initFuncName("EnumRegistry")
	if len(v3.Enums) == 0 {
		b.WriteString(fmt.Sprintf("func %s() {\n", funcName))
		b.WriteString("\t// Geen enums gedefinieerd in het model.\n")
		b.WriteString("}\n")
		return b.String(), nil
	}

	b.WriteString(fmt.Sprintf("func %s() {\n", funcName))
	writeEnumRegistryEntries(&b, v3.Enums)
	b.WriteString("}\n")

	return b.String(), nil
}

// writeEnumRegistryEntries schrijft EnumWaarden + EnumEditorLayouts entries.
func writeEnumRegistryEntries(b *strings.Builder, enums []model.V3Enum) {
	for _, enum := range enums {
		waarden := make([]string, len(enum.Waarden))
		for i, w := range enum.Waarden {
			waarden[i] = fmt.Sprintf("%q", w.Waarde)
		}
		b.WriteString(fmt.Sprintf("\tEnumWaarden[%q] = []string{%s}\n", enum.GoType, strings.Join(waarden, ", ")))
		if strings.TrimSpace(enum.Domein) != "" {
			b.WriteString(fmt.Sprintf("\tEnumDomeinen[%q] = %q\n", enum.GoType, enum.Domein))
		}
	}

	// Editor-posities (alleen als er posities zijn)
	hasPosities := false
	for _, enum := range enums {
		if enum.Positie != nil {
			hasPosities = true
			break
		}
	}
	if hasPosities {
		b.WriteString("\n\t// Enum editor-posities\n")
		for _, enum := range enums {
			if enum.Positie != nil {
				b.WriteString(fmt.Sprintf("\tEnumEditorLayouts[%q] = &EditorLayout{Positie: &V3Positie{X: %g, Y: %g}}\n", enum.GoType, enum.Positie.X, enum.Positie.Y))
			}
		}
	}
}
