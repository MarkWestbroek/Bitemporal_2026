package handlers

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHerstelModelDirectoryVanuitBaseline_BehoudtJsonModelBestandenNaSync(t *testing.T) {
	appDir := t.TempDir()
	modelDir := filepath.Join(appDir, "model")

	// Handmatige bestanden die behouden moeten blijven
	handmatigeBestanden := []string{
		"model_plumbing.go",
		"metaregistry_plumbing.go",
		"v3_format.go",
		"v3_exporter.go",
		"gebruiker.go",
		"nested.go",
		"date.go",
		"schema_versie.go",
	}
	for _, naam := range handmatigeBestanden {
		pad := filepath.Join(modelDir, naam)
		if err := os.MkdirAll(filepath.Dir(pad), 0o750); err != nil {
			t.Fatalf("mkdir voor %s mislukt: %v", naam, err)
		}
		if err := os.WriteFile(pad, []byte("package model\n// handmatig\n"), 0o644); err != nil {
			t.Fatalf("schrijven %s mislukt: %v", naam, err)
		}
	}

	// Codegen-gegenereerde bestanden voor MEERDERE domeinen
	codegenBestanden := map[string][]string{
		"np_loc": {
			"np_loc_modellen_entiteiten.go",
			"np_loc_modellen_ge_rel.go",
			"np_loc_metaregistry.go",
		},
		"register": {
			"register_modellen_entiteiten.go",
			"register_metaregistry.go",
		},
	}
	allCodegenBestanden := []string{}
	for _, bestanden := range codegenBestanden {
		allCodegenBestanden = append(allCodegenBestanden, bestanden...)
	}
	for _, naam := range allCodegenBestanden {
		pad := filepath.Join(modelDir, naam)
		if err := os.WriteFile(pad, []byte("package model\n// codegen\n"), 0o644); err != nil {
			t.Fatalf("schrijven %s mislukt: %v", naam, err)
		}
	}

	// datatype_aliases.go (gedeeld, merge-logica)
	if err := os.WriteFile(filepath.Join(modelDir, "datatype_aliases.go"), []byte("package model\n// gedeeld\n"), 0o644); err != nil {
		t.Fatalf("schrijven datatype_aliases.go mislukt: %v", err)
	}

	// JSON-bestanden in submap (moeten behouden blijven)
	jsonPad := filepath.Join(modelDir, "json", "model v3", "voorbeeld.json")
	jsonInhoud := []byte(`{"naam":"moet-blijven"}`)
	if err := os.MkdirAll(filepath.Dir(jsonPad), 0o750); err != nil {
		t.Fatalf("mkdir voor json model mislukt: %v", err)
	}
	if err := os.WriteFile(jsonPad, jsonInhoud, 0o644); err != nil {
		t.Fatalf("schrijven json model mislukt: %v", err)
	}

	// === Test 1: Single-domein rebuild (alleen np_loc) ===
	melding, err := herstelModelDirectoryVanuitBaseline(appDir, []string{"np_loc"})
	if err != nil {
		t.Fatalf("herstel single-domein gaf fout: %v", err)
	}
	t.Logf("Single-domein: %s", melding)

	// np_loc bestanden moeten weg zijn
	for _, naam := range codegenBestanden["np_loc"] {
		if _, err := os.Stat(filepath.Join(modelDir, naam)); !os.IsNotExist(err) {
			t.Fatalf("verwacht dat np_loc bestand %s verwijderd is", naam)
		}
	}

	// register bestanden moeten INTACT zijn
	for _, naam := range codegenBestanden["register"] {
		if _, err := os.Stat(filepath.Join(modelDir, naam)); err != nil {
			t.Fatalf("verwacht dat register bestand %s behouden is, maar: %v", naam, err)
		}
	}

	// datatype_aliases.go moet INTACT zijn bij single-domein
	if _, err := os.Stat(filepath.Join(modelDir, "datatype_aliases.go")); err != nil {
		t.Fatalf("datatype_aliases.go moet behouden zijn bij single-domein rebuild")
	}

	// Handmatige bestanden moeten intact zijn
	for _, naam := range handmatigeBestanden {
		if _, err := os.Stat(filepath.Join(modelDir, naam)); err != nil {
			t.Fatalf("handmatig bestand %s moet behouden zijn: %v", naam, err)
		}
	}

	// JSON submap moet intact zijn
	if inhoud, err := os.ReadFile(jsonPad); err != nil || string(inhoud) != string(jsonInhoud) {
		t.Fatalf("JSON model moet behouden zijn na single-domein rebuild")
	}

	// === Test 2: Volledige rebuild (lege prefixlijst) ===
	// Eerst np_loc bestanden weer aanmaken voor deze test
	for _, naam := range codegenBestanden["np_loc"] {
		if err := os.WriteFile(filepath.Join(modelDir, naam), []byte("package model\n// codegen\n"), 0o644); err != nil {
			t.Fatalf("herschrijven %s mislukt: %v", naam, err)
		}
	}

	melding, err = herstelModelDirectoryVanuitBaseline(appDir, nil)
	if err != nil {
		t.Fatalf("herstel volledige rebuild gaf fout: %v", err)
	}
	t.Logf("Volledige rebuild: %s", melding)

	// ALLE codegen bestanden moeten weg zijn
	for _, naam := range allCodegenBestanden {
		if _, err := os.Stat(filepath.Join(modelDir, naam)); !os.IsNotExist(err) {
			t.Fatalf("verwacht dat codegen-bestand %s verwijderd is bij volledige rebuild", naam)
		}
	}

	// datatype_aliases.go moet OOK weg zijn bij volledige rebuild
	if _, err := os.Stat(filepath.Join(modelDir, "datatype_aliases.go")); !os.IsNotExist(err) {
		t.Fatalf("datatype_aliases.go moet verwijderd zijn bij volledige rebuild")
	}

	// Handmatige bestanden moeten nog steeds intact zijn
	for _, naam := range handmatigeBestanden {
		if _, err := os.Stat(filepath.Join(modelDir, naam)); err != nil {
			t.Fatalf("handmatig bestand %s moet behouden zijn: %v", naam, err)
		}
	}
}
