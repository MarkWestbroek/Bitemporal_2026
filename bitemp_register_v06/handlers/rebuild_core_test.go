package handlers

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// De runs volgen de domeinen in het model; een bestaand bestand bepaalt de prefix (CG → cg).
func TestDomeinRunsUitModel(t *testing.T) {
	appDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(appDir, "model"), 0755); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{"cg_metaregistry.go", "register_metaregistry.go"} {
		if err := os.WriteFile(filepath.Join(appDir, "model", f), []byte("package model\n"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	modelJSON := []byte(`{"versie":"v3","entiteiten":[
		{"typenaam":"Initiatief","domein":"CG"},{"typenaam":"NatuurlijkPersoon","domein":"np-loc"},
		{"typenaam":"Land","domein":"register"},{"typenaam":"Zonder"}],
		"enums":[{"goType":"Soort","domein":"np-loc"}],"datatypes":[{"naam":"BSN","domein":"register"}]}`)

	runs, melding := domeinRunsUitModel(modelJSON, appDir)
	want := []RebuildDomeinSpec{
		{Domein: "CG", Prefix: "cg", Mode: "additive"},
		{Domein: "np-loc", Prefix: "np_loc", Mode: "additive"},
		{Domein: "register", Prefix: "register", Mode: "additive"},
	}
	if !reflect.DeepEqual(runs, want) {
		t.Fatalf("runs = %+v (%s), verwacht %+v", runs, melding, want)
	}
}

// De hash is ongevoelig voor JSON-opmaak, en de marker gaat de rondreis mee.
func TestSchemaHashEnMarker(t *testing.T) {
	a := schemaHash([]byte(`{"a": 1, "b": [1, 2]}`))
	b := schemaHash([]byte(`{"b":[1,2],"a":1}`)) // andere sleutelvolgorde (jsonb) en opmaak
	c := schemaHash([]byte(`{"a":2}`))
	if a != b || a == c || len(a) != 64 {
		t.Fatalf("hash: a=%s b=%s c=%s", a, b, c)
	}
	appDir := t.TempDir()
	if leesActieveSchemaMarker(appDir) != "" {
		t.Fatal("verwacht lege marker in een verse map")
	}
	if err := schrijfActieveSchemaMarker(appDir, a); err != nil {
		t.Fatal(err)
	}
	if got := leesActieveSchemaMarker(appDir); got != a {
		t.Fatalf("marker = %q, verwacht %q", got, a)
	}
}

// Zonder domeinen wordt er nooit "alles" opgeschoond: de pijplijn weigert.
func TestVoerCodegenEnBuildUit_WeigertZonderDomeinen(t *testing.T) {
	appDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(appDir, "model"), 0755); err != nil {
		t.Fatal(err)
	}
	_, _, err := voerCodegenEnBuildUit(appDir, []byte(`{}`), nil)
	if err == nil {
		t.Fatal("verwacht een fout zonder domeinen")
	}
}
