package model

// gegevenstypen_snapshot_test.go — houdt testdata/gegevenstypen.json gelijk
// aan de gedeelde datatypebibliotheek (gegevenstypen()).
//
// De JavaScript-transformaties (docs/TRANSFORMATIES.md, bv. canoniek model →
// objecttype-JSON-schema) hebben dezelfde datatypen nodig als codegen en het
// register: type, format, pattern, min/maxLength. In plaats van een tweede,
// met de hand bijgehouden lijst lezen ze deze snapshot. Deze test faalt zodra
// de snapshot achterloopt op de Go-bron — dezelfde aanpak als
// testdata/cel-pariteit.json voor CEL.
//
// Bijwerken na een wijziging in gegevenstypen():
//   SCHRIJF_GEGEVENSTYPEN=1 go test ./model -run TestGegevenstypenSnapshot

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

var gegevenstypenSnapshot = filepath.Join("..", "testdata", "gegevenstypen.json")

func gegevenstypenAlsJSON(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	// Geen HTML-escaping: de JS-kant leest de patronen letterlijk.
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	// Posities en layout zijn editorzaken; de snapshot draagt alleen betekenis.
	lijst := gegevenstypen()
	for i := range lijst {
		lijst[i].Positie = nil
		lijst[i].LayoutLocked = false
	}
	if err := enc.Encode(map[string]any{
		"_toelichting": "Gegenereerd uit model/gegevenstypen_datatype_registry.go door gegevenstypen_snapshot_test.go; niet met de hand wijzigen.",
		"datatypes":    lijst,
	}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestGegevenstypenSnapshot(t *testing.T) {
	verwacht := gegevenstypenAlsJSON(t)
	if os.Getenv("SCHRIJF_GEGEVENSTYPEN") == "1" {
		if err := os.WriteFile(gegevenstypenSnapshot, verwacht, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	huidig, err := os.ReadFile(gegevenstypenSnapshot)
	if err != nil {
		t.Fatalf("snapshot ontbreekt (%v); maak hem met SCHRIJF_GEGEVENSTYPEN=1 go test ./model -run TestGegevenstypenSnapshot", err)
	}
	if !bytes.Equal(bytes.ReplaceAll(huidig, []byte("\r\n"), []byte("\n")), verwacht) {
		t.Fatalf("%s loopt achter op gegevenstypen(); werk bij met SCHRIJF_GEGEVENSTYPEN=1 go test ./model -run TestGegevenstypenSnapshot", gegevenstypenSnapshot)
	}
}
