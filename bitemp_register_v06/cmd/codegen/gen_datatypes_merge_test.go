package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Een alias die elders in de map al gedeclareerd is (handgeschreven, zoals Kleur in
// datatype_aliases_extra.go) komt niet nog eens in datatype_aliases.go — ook niet als dat
// bestand nog niet bestaat. Zie de bouwfout "Kleur redeclared in this block" (22-10-2026).
func TestMergeGedeeldBestand_SlaatTypesEldersOver(t *testing.T) {
	dir := t.TempDir()
	extra := "package model\n\n// Kleur — handgeschreven.\ntype Kleur string\n"
	if err := os.WriteFile(filepath.Join(dir, "datatype_aliases_extra.go"), []byte(extra), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "iets_test.go"), []byte("package model\n\ntype AlleenInTest string\n"), 0644); err != nil {
		t.Fatal(err)
	}
	pad := filepath.Join(dir, "datatype_aliases.go")
	nieuw := "package model\n\n// Kleur — gegenereerd.\ntype Kleur string\n\n// BSN — gegenereerd.\ntype BSN string\n\n// AlleenInTest — gegenereerd.\ntype AlleenInTest string\n"

	// Vers bestand: Kleur eruit, BSN en AlleenInTest (alleen in een _test.go) erin.
	uit := mergeGedeeldBestand(pad, nieuw)
	if strings.Contains(uit, "type Kleur") || strings.Contains(uit, "Kleur — gegenereerd") {
		t.Fatalf("Kleur hoort niet in het verse bestand:\n%s", uit)
	}
	if !strings.Contains(uit, "type BSN string") || !strings.Contains(uit, "type AlleenInTest string") {
		t.Fatalf("BSN/AlleenInTest ontbreken:\n%s", uit)
	}

	// Bestaand bestand met BSN: samenvoegen voegt Kleur nog steeds niet toe, en BSN niet dubbel.
	if err := os.WriteFile(pad, []byte("package model\n\ntype BSN string\n"), 0644); err != nil {
		t.Fatal(err)
	}
	uit = mergeGedeeldBestand(pad, nieuw)
	if strings.Contains(uit, "type Kleur") {
		t.Fatalf("Kleur hoort niet samengevoegd te worden:\n%s", uit)
	}
	if strings.Count(uit, "type BSN string") != 1 || strings.Count(uit, "type AlleenInTest string") != 1 {
		t.Fatalf("verwacht BSN en AlleenInTest precies één keer:\n%s", uit)
	}
}
