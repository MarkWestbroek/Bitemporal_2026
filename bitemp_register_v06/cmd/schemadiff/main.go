// cmd/schemadiff is een CLI tool voor het vergelijken van twee V3-metamodellen
// en het genereren van delta-rapporten en optionele DDL-migraties.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/schemadiff"
)

func main() {
	oudFile := flag.String("oud", "", "Pad naar het oude V3-model JSON bestand")
	nieuwFile := flag.String("nieuw", "", "Pad naar het nieuwe V3-model JSON bestand")
	oudURL := flag.String("oud-url", "", "URL voor het oude model (GET /api/schema/model)")
	nieuwURL := flag.String("nieuw-url", "", "URL voor het nieuwe model (GET /api/schema/model)")
	domein := flag.String("domein", "", "Optioneel: beperk vergelijking tot dit domein")
	format := flag.String("format", "text", "Outputformaat: 'text', 'json' of 'sql'")
	outputFile := flag.String("output", "", "Optioneel: schrijf output naar bestand (default: stdout)")
	migratieDir := flag.String("migratie-dir", "", "Optioneel: schrijf SQL-migratiebestand naar deze directory")
	flag.Parse()

	// Valideer input
	if (*oudFile == "" && *oudURL == "") || (*nieuwFile == "" && *nieuwURL == "") {
		fmt.Fprintln(os.Stderr, "Gebruik: go run ./cmd/schemadiff --oud <oud.json> --nieuw <nieuw.json>")
		fmt.Fprintln(os.Stderr, "    of:  go run ./cmd/schemadiff --oud-url <url> --nieuw <nieuw.json>")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Opties:")
		fmt.Fprintln(os.Stderr, "  --oud <pad>         Pad naar het oude V3-model JSON")
		fmt.Fprintln(os.Stderr, "  --nieuw <pad>       Pad naar het nieuwe V3-model JSON")
		fmt.Fprintln(os.Stderr, "  --oud-url <url>     URL voor het oude model (bijv. http://localhost:8082/api/schema/model)")
		fmt.Fprintln(os.Stderr, "  --nieuw-url <url>   URL voor het nieuwe model")
		fmt.Fprintln(os.Stderr, "  --domein <naam>     Beperk vergelijking tot dit domein")
		fmt.Fprintln(os.Stderr, "  --format <fmt>      Outputformaat: text (default), json, sql")
		fmt.Fprintln(os.Stderr, "  --output <pad>      Schrijf output naar bestand")
		fmt.Fprintln(os.Stderr, "  --migratie-dir <d>  Schrijf SQL-migratiebestand naar directory")
		os.Exit(1)
	}

	if *format != "text" && *format != "json" && *format != "sql" {
		fmt.Fprintf(os.Stderr, "Onbekend formaat %q: gebruik 'text', 'json' of 'sql'\n", *format)
		os.Exit(1)
	}

	// Laad modellen
	oudModel, err := laadModel(*oudFile, *oudURL, "oud")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Kan oud model niet laden: %v\n", err)
		os.Exit(1)
	}

	nieuwModel, err := laadModel(*nieuwFile, *nieuwURL, "nieuw")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Kan nieuw model niet laden: %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "Oud model:  %s (versie %s, %d entiteiten)\n",
		oudModel.Naam, oudModel.Versie, len(oudModel.Entiteiten))
	fmt.Fprintf(os.Stderr, "Nieuw model: %s (versie %s, %d entiteiten)\n",
		nieuwModel.Naam, nieuwModel.Versie, len(nieuwModel.Entiteiten))

	// Vergelijking
	var opties []schemadiff.VergelijkOptie
	if *domein != "" {
		opties = append(opties, schemadiff.MetDomeinFilter(*domein))
	}
	rapport := schemadiff.Vergelijk(oudModel, nieuwModel, opties...)

	// Output genereren
	var output string
	switch *format {
	case "json":
		output, err = formatJSON(rapport)
		if err != nil {
			fmt.Fprintf(os.Stderr, "JSON-formattering mislukt: %v\n", err)
			os.Exit(1)
		}
	case "sql":
		migratie := schemadiff.GenereerMigratie(rapport)
		output = migratie.AlsSQL()
	default:
		output = formatText(rapport)
	}

	// Output schrijven
	if *outputFile != "" {
		if err := os.WriteFile(*outputFile, []byte(output), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Kan output niet schrijven naar %s: %v\n", *outputFile, err)
			os.Exit(1)
		}
		fmt.Fprintf(os.Stderr, "Output geschreven naar %s\n", *outputFile)
	} else {
		fmt.Print(output)
	}

	// Optioneel: migratiebestand genereren
	if *migratieDir != "" {
		migratie := schemadiff.GenereerMigratie(rapport)
		if len(migratie.Statements) > 0 {
			bestandsnaam := filepath.Join(*migratieDir, migratie.Bestandsnaam())
			if err := os.WriteFile(bestandsnaam, []byte(migratie.AlsSQL()), 0644); err != nil {
				fmt.Fprintf(os.Stderr, "Kan migratiebestand niet schrijven: %v\n", err)
				os.Exit(1)
			}
			fmt.Fprintf(os.Stderr, "Migratiebestand geschreven naar %s\n", bestandsnaam)
		} else {
			fmt.Fprintln(os.Stderr, "Geen migratie-statements — migratiebestand niet aangemaakt.")
		}
	}

	// Exit code: 0 als geen breaking changes, 1 als wel
	if rapport.IsBreaking() {
		fmt.Fprintf(os.Stderr, "\n⚠ Breaking changes gedetecteerd (%d destructief, %d modificatie)\n",
			len(rapport.Destructief()), len(rapport.Modificaties()))
		os.Exit(2)
	}
}

// ---- Model laden ----

func laadModel(file, url, label string) (model.V3Model, error) {
	var data []byte
	var err error

	if file != "" {
		data, err = os.ReadFile(file)
		if err != nil {
			return model.V3Model{}, fmt.Errorf("kan bestand niet lezen: %w", err)
		}
	} else if url != "" {
		data, err = fetchModelFromURL(url)
		if err != nil {
			return model.V3Model{}, fmt.Errorf("kan model niet ophalen van %s: %w", url, err)
		}
	} else {
		return model.V3Model{}, fmt.Errorf("geen ---%s of ---%s-url opgegeven", label, label)
	}

	return parseV3ModelInput(data)
}

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

	// Probeer of het een wrapper is met "model" veld
	var wrapper struct {
		Model json.RawMessage `json:"model"`
	}
	if err := json.Unmarshal(body, &wrapper); err == nil && len(wrapper.Model) > 0 {
		return wrapper.Model, nil
	}

	return body, nil
}

func parseV3ModelInput(data []byte) (model.V3Model, error) {
	payload := data

	// Ondersteun wrapper payloads
	var wrapper struct {
		Model json.RawMessage `json:"model"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil && len(wrapper.Model) > 0 {
		payload = wrapper.Model
	}

	var v3 model.V3Model
	if err := json.Unmarshal(payload, &v3); err != nil {
		return model.V3Model{}, err
	}

	return v3, nil
}

// ---- Formattering ----

func formatText(rapport schemadiff.DeltaRapport) string {
	var b strings.Builder

	b.WriteString(fmt.Sprintf("Delta-rapport: %s → %s\n", rapport.OudModelVersie, rapport.NieuwModelVersie))
	if rapport.Domein != "" {
		b.WriteString(fmt.Sprintf("Domein: %s\n", rapport.Domein))
	}
	b.WriteString(fmt.Sprintf("Totaal: %d wijzigingen\n", len(rapport.Items)))
	b.WriteString(rapport.Samenvatting())
	b.WriteString("\n")

	if len(rapport.Items) == 0 {
		b.WriteString("\nGeen wijzigingen gedetecteerd.\n")
		return b.String()
	}

	ernstGroepen := []struct {
		label string
		ernst schemadiff.Ernst
		items []schemadiff.DeltaItem
	}{
		{"DESTRUCTIEF", schemadiff.Destructief, rapport.Destructief()},
		{"MODIFICATIE", schemadiff.Modificatie, rapport.Modificaties()},
		{"ADDITIEF", schemadiff.Additief, rapport.Additief()},
		{"INFORMATIEF", schemadiff.Informatief, rapport.Informatief()},
	}

	for _, groep := range ernstGroepen {
		if len(groep.items) == 0 {
			continue
		}
		b.WriteString(fmt.Sprintf("\n── %s (%d) ──\n", groep.label, len(groep.items)))
		for _, item := range groep.items {
			b.WriteString(fmt.Sprintf("  [%s] %s: %s\n", item.Actie, item.Pad, item.Omschrijving))
			if item.Tabelnaam != "" {
				detail := "    tabel=" + item.Tabelnaam
				if item.Kolomnaam != "" {
					detail += " kolom=" + item.Kolomnaam
				}
				if item.DBType != "" {
					detail += " type=" + item.DBType
				}
				b.WriteString(detail + "\n")
			}
		}
	}

	return b.String()
}

type jsonRapport struct {
	OudModelVersie   string          `json:"oudModelVersie"`
	NieuwModelVersie string          `json:"nieuwModelVersie"`
	Domein           string          `json:"domein,omitempty"`
	Tijdstip         string          `json:"tijdstip"`
	IsBreaking       bool            `json:"isBreaking"`
	HeeftDBMigratie  bool            `json:"heeftDBMigratie"`
	Samenvatting     string          `json:"samenvatting"`
	Items            []jsonDeltaItem `json:"items"`
}

type jsonDeltaItem struct {
	Ernst        string `json:"ernst"`
	Categorie    string `json:"categorie"`
	Actie        string `json:"actie"`
	Pad          string `json:"pad"`
	OudeWaarde   string `json:"oudeWaarde,omitempty"`
	NieuweWaarde string `json:"nieuweWaarde,omitempty"`
	Omschrijving string `json:"omschrijving"`
	Tabelnaam    string `json:"tabelnaam,omitempty"`
	Kolomnaam    string `json:"kolomnaam,omitempty"`
	DBType       string `json:"dbType,omitempty"`
}

func formatJSON(rapport schemadiff.DeltaRapport) (string, error) {
	jr := jsonRapport{
		OudModelVersie:   rapport.OudModelVersie,
		NieuwModelVersie: rapport.NieuwModelVersie,
		Domein:           rapport.Domein,
		Tijdstip:         rapport.Tijdstip.Format("2006-01-02T15:04:05Z07:00"),
		IsBreaking:       rapport.IsBreaking(),
		HeeftDBMigratie:  rapport.HeeftDBMigratie(),
		Samenvatting:     rapport.Samenvatting(),
	}

	for _, item := range rapport.Items {
		jr.Items = append(jr.Items, jsonDeltaItem{
			Ernst:        item.Ernst.String(),
			Categorie:    item.Categorie,
			Actie:        item.Actie,
			Pad:          item.Pad,
			OudeWaarde:   item.OudeWaarde,
			NieuweWaarde: item.NieuweWaarde,
			Omschrijving: item.Omschrijving,
			Tabelnaam:    item.Tabelnaam,
			Kolomnaam:    item.Kolomnaam,
			DBType:       item.DBType,
		})
	}

	data, err := json.MarshalIndent(jr, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data) + "\n", nil
}
