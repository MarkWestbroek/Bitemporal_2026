package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func main() {
	inputFile := flag.String("input", "", "Pad naar het v3 model JSON bestand")
	fromURL := flag.String("from-url", "", "URL van het draaiende register (GET /api/schema/model)")
	outputDir := flag.String("output", "model/", "Doeldirectory voor gegenereerde bestanden")
	flag.Parse()

	if *inputFile == "" && *fromURL == "" {
		fmt.Fprintln(os.Stderr, "Gebruik: go run ./cmd/codegen --input model.json [--output model/]")
		fmt.Fprintln(os.Stderr, "    of:  go run ./cmd/codegen --from-url http://localhost:8080/api/schema/model [--output model/]")
		os.Exit(1)
	}

	var data []byte
	var err error

	if *inputFile != "" {
		data, err = os.ReadFile(*inputFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Kan bestand niet lezen: %v\n", err)
			os.Exit(1)
		}
	} else {
		data, err = fetchModelFromURL(*fromURL)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Kan model niet ophalen van %s: %v\n", *fromURL, err)
			os.Exit(1)
		}
	}

	var v3 model.V3Model
	if err := json.Unmarshal(data, &v3); err != nil {
		fmt.Fprintf(os.Stderr, "Kan JSON niet parsen: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Model geladen: versie=%s, %d entiteiten, %d enums\n",
		v3.Versie, len(v3.Entiteiten), len(v3.Enums))

	// Maak de output directory aan als die niet bestaat
	if err := os.MkdirAll(*outputDir, 0750); err != nil {
		fmt.Fprintf(os.Stderr, "Kan output directory niet aanmaken: %v\n", err)
		os.Exit(1)
	}

	// Genereer alle bestanden
	files := []struct {
		naam     string
		generate func(model.V3Model) (string, error)
	}{
		{"modellen_entiteiten.go", generateEntiteiten},
		{"modellen_ge_rel.go", generateGeRel},
		{"modellen_methods.go", generateMethods},
		{"modellen_input.go", generateInput},
		{"metaregistry.go", generateMetaRegistry},
	}

	for _, f := range files {
		content, err := f.generate(v3)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Fout bij genereren van %s: %v\n", f.naam, err)
			os.Exit(1)
		}
		path := filepath.Join(*outputDir, f.naam)
		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Kan %s niet schrijven: %v\n", path, err)
			os.Exit(1)
		}
		fmt.Printf("  Gegenereerd: %s\n", path)
	}

	fmt.Println("Code generatie voltooid.")
}

// fetchModelFromURL haalt het model op van een draaiend register.
// Verwacht dat de response een JSON object met een "model" veld bevat.
func fetchModelFromURL(url string) ([]byte, error) {
	resp, err := http.Get(url) //nolint:gosec // Dev-only tool, URL komt van CLI argument
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Probeer eerst of het een wrapper is met "model" veld
	var wrapper struct {
		Model json.RawMessage `json:"model"`
	}
	if err := json.Unmarshal(body, &wrapper); err == nil && len(wrapper.Model) > 0 {
		return wrapper.Model, nil
	}

	// Anders is het direct een V3Model
	return body, nil
}
