package handlers

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHerstelModelDirectoryVanuitBaseline_BehoudtJsonModelBestandenNaSync(t *testing.T) {
	appDir := t.TempDir()
	modelDir := filepath.Join(appDir, "model")

	verplichteBestanden := []string{
		"model_plumbing.go",
		"metaregistry_plumbing.go",
		"v3_format.go",
		"v3_exporter.go",
	}
	for _, naam := range verplichteBestanden {
		pad := filepath.Join(modelDir, naam)
		if err := os.MkdirAll(filepath.Dir(pad), 0o750); err != nil {
			t.Fatalf("mkdir voor %s mislukt: %v", naam, err)
		}
		if err := os.WriteFile(pad, []byte("package model\n"), 0o644); err != nil {
			t.Fatalf("schrijven %s mislukt: %v", naam, err)
		}
	}

	jsonPad := filepath.Join(modelDir, "json", "model v3", "voorbeeld.json")
	jsonInhoud := []byte(`{"naam":"moet-blijven"}`)
	if err := os.MkdirAll(filepath.Dir(jsonPad), 0o750); err != nil {
		t.Fatalf("mkdir voor json model mislukt: %v", err)
	}
	if err := os.WriteFile(jsonPad, jsonInhoud, 0o644); err != nil {
		t.Fatalf("schrijven json model mislukt: %v", err)
	}

	if _, err := syncBaselineKernModelBestanden(appDir); err != nil {
		t.Fatalf("syncBaselineKernModelBestanden gaf fout: %v", err)
	}

	if _, err := herstelModelDirectoryVanuitBaseline(appDir); err != nil {
		t.Fatalf("herstelModelDirectoryVanuitBaseline gaf fout: %v", err)
	}

	inhoudNaHerstel, err := os.ReadFile(jsonPad)
	if err != nil {
		t.Fatalf("verwacht dat %s na herstel nog bestaat, maar lezen faalde: %v", jsonPad, err)
	}
	if string(inhoudNaHerstel) != string(jsonInhoud) {
		t.Fatalf("verwacht behouden json inhoud %q, kreeg %q", string(jsonInhoud), string(inhoudNaHerstel))
	}
}
