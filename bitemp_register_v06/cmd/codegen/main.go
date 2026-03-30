package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"go/format"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func main() {
	inputFile := flag.String("input", "", "Pad naar het v3 model JSON bestand")
	fromURL := flag.String("from-url", "", "URL van het draaiende register (GET /api/schema/model)")
	outputDir := flag.String("output", "model/", "Doeldirectory voor gegenereerde bestanden")
	prefix := flag.String("prefix", "", "Bestandsnaam-prefix voor gegenereerde bestanden (bijv. 'hr' → hr_modellen_entiteiten.go)")
	mode := flag.String("mode", "standalone", "Generatiemodus: 'standalone' (eigen var MetaRegistry) of 'additive' (init() voegt toe aan bestaande MetaRegistry)")
	domein := flag.String("domein", "", "Domeinnaam voor TypeMeta.Domein (bijv. 'np-loc', 'register')")
	flag.Parse()

	if *inputFile == "" && *fromURL == "" {
		fmt.Fprintln(os.Stderr, "Gebruik: go run ./cmd/codegen --input <pad-naar-v3-model.json> [--output model/]")
		fmt.Fprintln(os.Stderr, "    of:  go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/code [--output model/]")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Opties:")
		fmt.Fprintln(os.Stderr, "  --prefix <naam>   Bestandsprefix (bijv. --prefix hr → hr_modellen_entiteiten.go)")
		fmt.Fprintln(os.Stderr, "  --mode <modus>    'standalone' (default) of 'additive' (voegt toe via init())")
		fmt.Fprintln(os.Stderr, "  --domein <naam>   Domeinnaam voor TypeMeta.Domein (bijv. --domein np-loc)")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Tips:")
		fmt.Fprintln(os.Stderr, "  - De inputfile is niet hardcoded; elk pad mag, model.json is alleen een voorbeeldnaam.")
		fmt.Fprintln(os.Stderr, "  - Wrapper payloads met top-level 'model' worden ondersteund.")
		fmt.Fprintln(os.Stderr, "  - Editor-export met 'flowState' wordt genegeerd, zolang payload.model een geldig V3-model is.")
		os.Exit(1)
	}

	if *mode != "standalone" && *mode != "additive" {
		fmt.Fprintf(os.Stderr, "Onbekende mode %q: gebruik 'standalone' of 'additive'\n", *mode)
		os.Exit(1)
	}
	additive := *mode == "additive"

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

	v3, err := parseV3ModelInput(data)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Kan V3 model niet laden: %v\n", err)
		os.Exit(1)
	}

	if validationErrors := validateV3Model(v3); len(validationErrors) > 0 {
		fmt.Fprintln(os.Stderr, "V3 model validatie mislukt:")
		for _, e := range validationErrors {
			fmt.Fprintf(os.Stderr, "  - %s\n", e)
		}
		os.Exit(1)
	}

	fmt.Printf("Model geladen: versie=%s, %d entiteiten, %d enums, %d datatypes (mode=%s, domein=%s)\n",
		v3.Versie, len(v3.Entiteiten), len(v3.Enums), len(v3.Datatypes), *mode, *domein)

	// Filter entiteiten op domein: als --domein is opgegeven, genereer alleen entiteiten
	// waarvan het Domein-veld overeenkomt met --domein of leeg is.
	// Entiteiten van andere domeinen (bijv. register-entiteiten in een np-loc export) worden overgeslagen.
	if *domein != "" {
		filtered := v3.Entiteiten[:0]
		for _, ent := range v3.Entiteiten {
			if ent.Domein == "" || ent.Domein == *domein {
				filtered = append(filtered, ent)
			} else {
				fmt.Fprintf(os.Stderr, "  Overgeslagen (domein=%q): %s\n", ent.Domein, ent.Typenaam)
			}
		}
		v3.Entiteiten = filtered

		// Verwijder enums die niet meer gerefereerd worden door de resterende entiteiten.
		usedEnums := map[string]bool{}
		for _, ent := range v3.Entiteiten {
			for _, ge := range ent.Gegevenselementen {
				for _, v := range ge.Velden {
					if v.Enum != "" {
						usedEnums[v.Enum] = true
					}
				}
			}
			for _, rel := range ent.Relaties {
				for _, v := range rel.Velden {
					if v.Enum != "" {
						usedEnums[v.Enum] = true
					}
				}
			}
		}
		filteredEnums := v3.Enums[:0]
		for _, e := range v3.Enums {
			if usedEnums[e.GoType] {
				filteredEnums = append(filteredEnums, e)
			}
		}
		v3.Enums = filteredEnums
	}

	// Maak de output directory aan als die niet bestaat
	if err := os.MkdirAll(*outputDir, 0750); err != nil {
		fmt.Fprintf(os.Stderr, "Kan output directory niet aanmaken: %v\n", err)
		os.Exit(1)
	}

	// Bouw codegen-opties op
	opts := codegenOptions{
		domein:   *domein,
		prefix:   *prefix,
		additive: additive,
	}

	if *prefix != "" {
		normalizedPrefix := normalizeIdentifierParts(*prefix)
		if normalizedPrefix != *prefix {
			fmt.Fprintf(os.Stderr,
				"Let op: --prefix %q wordt voor Go-functienamen genormaliseerd naar %q (init-prefix: %q).\n",
				*prefix,
				normalizedPrefix,
				toPascalCase(normalizedPrefix),
			)
		}
	}

	// Bepaal generatiefuncties op basis van additive mode
	type genFunc = func(model.V3Model, codegenOptions) (string, error)
	var genRegistry genFunc
	var genDatatypes genFunc
	var genEnums genFunc
	if additive {
		genRegistry = generateMetaRegistryAdditive
		genDatatypes = generateDatatypeRegistryAdditive
		genEnums = generateEnumRegistryAdditive
	} else {
		genRegistry = generateMetaRegistry
		genDatatypes = generateDatatypeRegistry
		genEnums = generateEnumRegistryStandalone
	}

	// Genereer alle bestanden
	files := []struct {
		naam     string
		generate genFunc
	}{
		{"modellen_entiteiten.go", generateEntiteitenWithOpts},
		{"modellen_ge_rel.go", generateGeRelWithOpts},
		{"modellen_methods.go", generateMethodsWithOpts},
		{"modellen_input.go", generateInputWithOpts},
		{"metaregistry.go", genRegistry},
		{"datatype_registry.go", genDatatypes},
		{"enum_registry.go", genEnums},
	}

	// Prefix toepassen op bestandsnamen
	filePrefix := ""
	if *prefix != "" {
		filePrefix = strings.ToLower(*prefix) + "_"
	}

	for _, f := range files {
		content, err := f.generate(v3, opts)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Fout bij genereren van %s: %v\n", f.naam, err)
			os.Exit(1)
		}
		// Formatteer de gegenereerde Go-code met gofmt-stijl (tabuitlijning in structs etc.)
		formatted, fmtErr := format.Source([]byte(content))
		if fmtErr != nil {
			fmt.Fprintf(os.Stderr, "Waarschuwing: gofmt van %s mislukt: %v (schrijf ongeformatteerd)\n", f.naam, fmtErr)
			formatted = []byte(content)
		}
		path := filepath.Join(*outputDir, filePrefix+f.naam)
		if err := os.WriteFile(path, formatted, 0644); err != nil {
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

func parseV3ModelInput(data []byte) (model.V3Model, error) {
	payload := data

	// Ondersteun wrapper payloads, zoals API-response of editor-export met flowState.
	var wrapper struct {
		Model json.RawMessage `json:"model"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil && len(wrapper.Model) > 0 {
		payload = wrapper.Model
	}

	// Detecteer expliciet het oude/platte editor-formaat.
	var asMap map[string]json.RawMessage
	if err := json.Unmarshal(payload, &asMap); err == nil {
		if _, hasTypes := asMap["types"]; hasTypes {
			return model.V3Model{}, fmt.Errorf("input lijkt op het platte editor-formaat met 'types/relaties'; codegen verwacht V3-formaat met 'entiteiten' (tip: gebruik --from-url /api/schema/model/code)")
		}
	}

	var v3 model.V3Model
	if err := json.Unmarshal(payload, &v3); err != nil {
		return model.V3Model{}, err
	}

	return v3, nil
}

func validateV3Model(v3 model.V3Model) []string {
	var errs []string

	if strings.TrimSpace(v3.Versie) == "" {
		errs = append(errs, "model.versie is verplicht")
	}
	if len(v3.Entiteiten) == 0 {
		errs = append(errs, "minimaal één entiteit vereist in model.entiteiten")
		return errs
	}

	entiteiten := map[string]struct{}{}
	for i, ent := range v3.Entiteiten {
		ctx := fmt.Sprintf("entiteiten[%d]", i)
		if !isPascalIdentifier(ent.Typenaam) {
			errs = append(errs, fmt.Sprintf("%s.typenaam '%s' is ongeldig; gebruik PascalCase zonder spaties/koppeltekens (bijv. Persoon)", ctx, ent.Typenaam))
		}
		if !isSnakeLike(ent.Meervoud) {
			errs = append(errs, fmt.Sprintf("%s.meervoud '%s' is ongeldig; gebruik lowercase/snake_case (bijv. personen of persoon_records)", ctx, ent.Meervoud))
		}
		entiteiten[ent.Typenaam] = struct{}{}

		for j, ge := range ent.Gegevenselementen {
			gctx := fmt.Sprintf("%s.gegevenselementen[%d]", ctx, j)
			if !isPascalIdentifier(ge.Naam) {
				errs = append(errs, fmt.Sprintf("%s.naam '%s' is ongeldig; gebruik PascalCase (bijv. Persoonsidentificatie of Naam)", gctx, ge.Naam))
			}
			if !isSnakeLike(ge.Meervoud) {
				errs = append(errs, fmt.Sprintf("%s.meervoud '%s' is ongeldig; gebruik lowercase/snake_case", gctx, ge.Meervoud))
			}
			if ge.Momentvoorkomen != "enkelvoudig" && ge.Momentvoorkomen != "meervoudig" {
				errs = append(errs, fmt.Sprintf("%s.momentvoorkomen '%s' is ongeldig; gebruik 'enkelvoudig' of 'meervoudig'", gctx, ge.Momentvoorkomen))
			}
			for k, veld := range ge.Velden {
				vctx := fmt.Sprintf("%s.velden[%d]", gctx, k)
				if !isIdentifierLike(veld.Naam) {
					errs = append(errs, fmt.Sprintf("%s.naam '%s' is ongeldig; gebruik letters/cijfers/underscore (bijv. voorletters)", vctx, veld.Naam))
				}
			}
		}

		for j, rel := range ent.Relaties {
			rctx := fmt.Sprintf("%s.relaties[%d]", ctx, j)
			if !isPascalIdentifier(rel.Naam) {
				errs = append(errs, fmt.Sprintf("%s.naam '%s' is ongeldig; gebruik PascalCase (underscore mag, bijv. Rel_Persoon_Adres)", rctx, rel.Naam))
			}
			if !isSnakeLike(rel.Meervoud) {
				errs = append(errs, fmt.Sprintf("%s.meervoud '%s' is ongeldig; gebruik lowercase/snake_case", rctx, rel.Meervoud))
			}
			if rel.Momentvoorkomen != "enkelvoudig" && rel.Momentvoorkomen != "meervoudig" {
				errs = append(errs, fmt.Sprintf("%s.momentvoorkomen '%s' is ongeldig; gebruik 'enkelvoudig' of 'meervoudig'", rctx, rel.Momentvoorkomen))
			}
			if rel.DoelEntiteit == "" {
				errs = append(errs, fmt.Sprintf("%s.doelEntiteit is verplicht", rctx))
			}
			for k, veld := range rel.Velden {
				vctx := fmt.Sprintf("%s.velden[%d]", rctx, k)
				if !isIdentifierLike(veld.Naam) {
					errs = append(errs, fmt.Sprintf("%s.naam '%s' is ongeldig; gebruik letters/cijfers/underscore", vctx, veld.Naam))
				}
			}
		}
	}

	for i, ent := range v3.Entiteiten {
		for j, rel := range ent.Relaties {
			if rel.DoelEntiteit == "" {
				continue
			}
			if _, ok := entiteiten[rel.DoelEntiteit]; !ok {
				// Cross-domein relaties (bijv. referentielijst-items naar ander domein) zijn geen fout
				if rel.RelatieSubtype == "referentielijst_items" {
					fmt.Fprintf(os.Stderr, "  Let op: entiteiten[%d].relaties[%d].doelEntiteit '%s' is cross-domein (wordt niet gegenereerd)\n", i, j, rel.DoelEntiteit)
				} else {
					errs = append(errs, fmt.Sprintf("entiteiten[%d].relaties[%d].doelEntiteit '%s' bestaat niet in model.entiteiten", i, j, rel.DoelEntiteit))
				}
			}
		}
	}

	return errs
}

func isIdentifierLike(s string) bool {
	if s == "" {
		return false
	}
	for i, r := range s {
		if !(r == '_' || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')) {
			return false
		}
		if i == 0 && (r >= '0' && r <= '9') {
			return false
		}
	}
	return true
}

func isPascalIdentifier(s string) bool {
	if !isIdentifierLike(s) {
		return false
	}
	r := rune(s[0])
	return r >= 'A' && r <= 'Z'
}

func isSnakeLike(s string) bool {
	if s == "" {
		return false
	}
	for i, r := range s {
		if !(r == '_' || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')) {
			return false
		}
		if i == 0 && (r < 'a' || r > 'z') {
			return false
		}
	}
	return true
}
