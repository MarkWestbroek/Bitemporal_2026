// cmd/openapi-export schrijft OpenAPI 3.1.0 specs naar bestanden.
//
// Gebruik:
//
//	go run ./cmd/openapi-export                          # alle specs naar openapi/
//	go run ./cmd/openapi-export --output docs/openapi    # andere uitvoermap
//	go run ./cmd/openapi-export --domein abuvwxy          # alleen één domein
//	go run ./cmd/openapi-export --format json              # alleen JSON (standaard: beide)
//	go run ./cmd/openapi-export --format yaml              # alleen YAML
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"gopkg.in/yaml.v3"
)

func main() {
	outputDir := flag.String("output", "openapi", "Uitvoermap voor de spec-bestanden")
	domein := flag.String("domein", "", "Genereer alleen voor dit domein (anders alle + geconsolideerd)")
	format := flag.String("format", "", "Formaat: json, yaml, of leeg voor beide")
	flag.Parse()

	schrijfJSON := *format == "" || *format == "json"
	schrijfYAML := *format == "" || *format == "yaml"

	if !schrijfJSON && !schrijfYAML {
		fmt.Fprintf(os.Stderr, "Ongeldig formaat: %q (kies json, yaml of laat leeg voor beide)\n", *format)
		os.Exit(1)
	}

	// Maak uitvoermap aan
	if err := os.MkdirAll(*outputDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Kan map %q niet aanmaken: %v\n", *outputDir, err)
		os.Exit(1)
	}

	type specTaak struct {
		naam   string // bestandsnaam zonder extensie
		domein string // domeinfilter (leeg = geconsolideerd)
	}

	taken := []specTaak{}
	if *domein != "" {
		taken = append(taken, specTaak{naam: *domein, domein: *domein})
	} else {
		// Geconsolideerd
		taken = append(taken, specTaak{naam: "openapi", domein: ""})
		// Per domein
		for _, d := range handlers.BeschikbareDomeinen() {
			taken = append(taken, specTaak{naam: d, domein: d})
		}
	}

	for _, taak := range taken {
		doc := handlers.GenereerOpenAPIDocument(taak.domein)

		if schrijfJSON {
			pad := filepath.Join(*outputDir, taak.naam+".json")
			if err := schrijfJSONBestand(pad, doc); err != nil {
				fmt.Fprintf(os.Stderr, "Fout bij schrijven %s: %v\n", pad, err)
				os.Exit(1)
			}
			fmt.Printf("  ✓ %s\n", pad)
		}

		if schrijfYAML {
			pad := filepath.Join(*outputDir, taak.naam+".yaml")
			if err := schrijfYAMLBestand(pad, doc); err != nil {
				fmt.Fprintf(os.Stderr, "Fout bij schrijven %s: %v\n", pad, err)
				os.Exit(1)
			}
			fmt.Printf("  ✓ %s\n", pad)
		}
	}

	fmt.Println("Klaar.")
}

func schrijfJSONBestand(pad string, doc map[string]any) error {
	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(pad, data, 0644)
}

func schrijfYAMLBestand(pad string, doc map[string]any) error {
	data, err := yaml.Marshal(doc)
	if err != nil {
		return err
	}
	return os.WriteFile(pad, data, 0644)
}
