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
	"regexp"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/schemadiff"
)

func main() {
	inputFile := flag.String("input", "", "Pad naar het v3 model JSON bestand")
	fromURL := flag.String("from-url", "", "URL van het draaiende register (GET /api/schema/model)")
	outputDir := flag.String("output", "model/", "Doeldirectory voor gegenereerde bestanden")
	prefix := flag.String("prefix", "", "Bestandsnaam-prefix voor gegenereerde bestanden (bijv. 'hr' → hr_modellen_entiteiten.go)")
	mode := flag.String("mode", "standalone", "Generatiemodus: 'standalone' (eigen var MetaRegistry) of 'additive' (init() voegt toe aan bestaande MetaRegistry)")
	domein := flag.String("domein", "", "Domeinnaam voor TypeMeta.Domein (bijv. 'np-loc', 'register')")
	diffFile := flag.String("diff", "", "Pad naar oud model voor delta-analyse vóór generatie (optioneel)")
	diffOnly := flag.Bool("diff-only", false, "Alleen delta-analyse, niet genereren")
	flag.Parse()

	if *inputFile == "" && *fromURL == "" {
		fmt.Fprintln(os.Stderr, "Gebruik: go run ./cmd/codegen --input <pad-naar-v3-model.json> [--output model/]")
		fmt.Fprintln(os.Stderr, "    of:  go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/code [--output model/]")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Opties:")
		fmt.Fprintln(os.Stderr, "  --prefix <naam>   Bestandsprefix (bijv. --prefix hr → hr_modellen_entiteiten.go)")
		fmt.Fprintln(os.Stderr, "  --mode <modus>    'standalone' (default) of 'additive' (voegt toe via init())")
		fmt.Fprintln(os.Stderr, "  --domein <naam>   Domeinnaam voor TypeMeta.Domein (bijv. --domein np-loc)")
		fmt.Fprintln(os.Stderr, "  --diff <pad>      Vergelijk met oud model en toon delta vóór generatie")
		fmt.Fprintln(os.Stderr, "  --diff-only       Alleen delta-analyse, niet genereren")
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

	// Filter entiteiten op domein.
	//
	// Belangrijk voor additive generatie:
	// - voor `register` nemen we ook de lege domeinen mee (register-basis)
	// - voor andere domeinen, zoals `np-loc`, genereren we alléén exact dat domein
	//   zodat gedeelde register-types niet opnieuw worden aangemaakt en met
	//   de bestaande `register_*` bestanden botsen.
	if *domein != "" {
		filtered := v3.Entiteiten[:0]
		includeLegeDomeinen := *domein == "register"
		for _, ent := range v3.Entiteiten {
			zelfdeDomein := ent.Domein == *domein
			registerBasis := includeLegeDomeinen && ent.Domein == ""
			if zelfdeDomein || registerBasis {
				filtered = append(filtered, ent)
			} else {
				fmt.Printf("  Overgeslagen (domein=%q): %s\n", ent.Domein, ent.Typenaam)
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

	// ---- Delta-analyse (optioneel) ----
	if *diffFile != "" {
		oudData, err := os.ReadFile(*diffFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Kan oud model niet lezen voor diff: %v\n", err)
			os.Exit(1)
		}
		oudModel, err := parseV3ModelInput(oudData)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Kan oud model niet parsen voor diff: %v\n", err)
			os.Exit(1)
		}

		var diffOpties []schemadiff.VergelijkOptie
		if *domein != "" {
			diffOpties = append(diffOpties, schemadiff.MetDomeinFilter(*domein))
		}
		rapport := schemadiff.Vergelijk(oudModel, v3, diffOpties...)

		fmt.Fprintf(os.Stderr, "\n%s\n", rapport.Samenvatting())
		if rapport.IsBreaking() {
			fmt.Fprintf(os.Stderr, "⚠ Breaking changes: %d destructief, %d modificatie\n",
				len(rapport.Destructief()), len(rapport.Modificaties()))
		}
		if rapport.HeeftDBMigratie() {
			migratie := schemadiff.GenereerMigratie(rapport)
			migDir := filepath.Join(*outputDir, "..", "dbsetup", "migrations")
			if err := os.MkdirAll(migDir, 0750); err == nil {
				migPad := filepath.Join(migDir, migratie.Bestandsnaam())
				if err := os.WriteFile(migPad, []byte(migratie.AlsSQL()), 0644); err != nil {
					fmt.Fprintf(os.Stderr, "Kan migratiebestand niet schrijven: %v\n", err)
				} else {
					fmt.Fprintf(os.Stderr, "Migratiebestand: %s\n", migPad)
				}
			}
		}

		if *diffOnly {
			if rapport.IsBreaking() {
				os.Exit(2)
			}
			os.Exit(0)
		}
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
	type genFile struct {
		naam     string
		generate genFunc
		noPrefix bool // true = wordt altijd zonder prefix gegenereerd (gedeeld bestand)
	}
	files := []genFile{
		{"modellen_entiteiten.go", generateEntiteitenWithOpts, false},
		{"modellen_ge_rel.go", generateGeRelWithOpts, false},
		{"modellen_methods.go", generateMethodsWithOpts, false},
		{"modellen_input.go", generateInputWithOpts, false},
		{"metaregistry.go", genRegistry, false},
		{"datatype_registry.go", genDatatypes, false},
		{"enum_registry.go", genEnums, false},
		{"datatype_aliases.go", generateDatatypeAliases, true},
	}

	// Prefix toepassen op bestandsnamen
	filePrefix := ""
	if *prefix != "" {
		filePrefix = strings.ToLower(*prefix) + "_"
	}

	// In additive mode: verwijder prefix-specifieke datatype_aliases.go bestanden
	// van alle prefixen (inclusief eigen prefix), want dat bestand is nu gedeeld (noPrefix).
	if additive {
		verwijderPrefixSpecifiekeAliases(*outputDir)
	}

	for _, f := range files {
		content, err := f.generate(v3, opts)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Fout bij genereren van %s: %v\n", f.naam, err)
			os.Exit(1)
		}

		// Voor gedeelde bestanden (noPrefix) in additive mode: merge met bestaande types
		effectivePrefix := filePrefix
		if f.noPrefix {
			effectivePrefix = ""
		}
		path := filepath.Join(*outputDir, effectivePrefix+f.naam)

		if f.noPrefix && additive {
			content = mergeGedeeldBestand(path, content)
		}

		// Formatteer de gegenereerde Go-code met gofmt-stijl (tabuitlijning in structs etc.)
		formatted, fmtErr := format.Source([]byte(content))
		if fmtErr != nil {
			fmt.Fprintf(os.Stderr, "Waarschuwing: gofmt van %s mislukt: %v (schrijf ongeformatteerd)\n", f.naam, fmtErr)
			formatted = []byte(content)
		}
		if err := os.WriteFile(path, formatted, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Kan %s niet schrijven: %v\n", path, err)
			os.Exit(1)
		}
		fmt.Printf("  Gegenereerd: %s\n", path)
	}

	fmt.Println("Code generatie voltooid.")

	// Stap: registreer init-calls in metaregistry_plumbing.go (additive mode)
	if additive && *prefix != "" {
		if err := ensureInitRegistration(*outputDir, *prefix); err != nil {
			fmt.Fprintf(os.Stderr, "Waarschuwing: kon init-registratie niet bijwerken: %v\n", err)
		}
	}
}

// mergeGedeeldBestand leest het bestaande bestand op pad en voegt type-declaraties
// uit nieuwContent toe die nog niet bestaan. Dit voorkomt dubbele Go type-declaraties
// wanneer meerdere prefixen hetzelfde gedeelde bestand bijwerken.
func mergeGedeeldBestand(pad, nieuwContent string) string {
	bestaand, err := os.ReadFile(pad)
	if err != nil {
		// Bestand bestaat nog niet, gebruik de nieuwe content ongewijzigd
		return nieuwContent
	}

	// Parse bestaande type-declaraties
	bestaandeTypes := parseTypeDefs(string(bestaand))

	// Voeg regels toe uit nieuwContent die nog geen bestaande declaratie zijn
	var b strings.Builder
	regels := strings.Split(string(bestaand), "\n")
	// Neem het bestaande bestand als basis
	b.WriteString(string(bestaand))
	// Zorg dat er een newline aan het eind staat
	if !strings.HasSuffix(b.String(), "\n") {
		b.WriteString("\n")
	}

	// Voeg ontbrekende types toe uit het nieuwe bestand
	toegevoegd := 0
	for _, regel := range strings.Split(nieuwContent, "\n") {
		trimmed := strings.TrimSpace(regel)
		if !strings.HasPrefix(trimmed, "type ") {
			continue
		}
		parts := strings.Fields(trimmed)
		if len(parts) < 3 {
			continue
		}
		typeNaam := parts[1]
		if bestaandeTypes[typeNaam] {
			continue
		}
		// Zoek eventuele comment-regel erboven
		nieuweRegels := strings.Split(nieuwContent, "\n")
		for i, r := range nieuweRegels {
			if strings.TrimSpace(r) == trimmed {
				if i > 0 && strings.HasPrefix(strings.TrimSpace(nieuweRegels[i-1]), "//") {
					b.WriteString("\n" + nieuweRegels[i-1] + "\n")
				}
				break
			}
		}
		b.WriteString(regel + "\n")
		toegevoegd++
	}
	_ = regels

	if toegevoegd > 0 {
		fmt.Printf("  %d nieuwe type-alias(es) samengevoegd in %s\n", toegevoegd, filepath.Base(pad))
	}
	return b.String()
}

// parseTypeDefs parsed type-declaraties uit Go source en retourneert een map van typenamen.
func parseTypeDefs(content string) map[string]bool {
	types := make(map[string]bool)
	for _, regel := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(regel)
		if strings.HasPrefix(trimmed, "type ") {
			parts := strings.Fields(trimmed)
			if len(parts) >= 3 {
				types[parts[1]] = true
			}
		}
	}
	return types
}

// verwijderPrefixSpecifiekeAliases verwijdert alle <prefix>_datatype_aliases.go bestanden
// uit de output directory, omdat dat bestand nu gedeeld is (zonder prefix).
func verwijderPrefixSpecifiekeAliases(outputDir string) {
	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return
	}
	const aliasSuffix = "datatype_aliases.go"
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		naam := entry.Name()
		if strings.HasSuffix(naam, aliasSuffix) && naam != aliasSuffix {
			// Dit is een prefix-specifiek alias-bestand (bijv. cg_datatype_aliases.go)
			pad := filepath.Join(outputDir, naam)
			if err := os.Remove(pad); err == nil {
				fmt.Printf("  Opgeruimd (gedeeld alias-bestand vervangt): %s\n", naam)
			}
		}
	}
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

// ensureInitRegistration zorgt dat de init()-calls voor het gegeven prefix
// in metaregistry_plumbing.go staan. Wordt aangeroepen na codegen in additive mode.
//
// Het zoekt de regel met `propageerDomeinNaarOnderliggende()` en voegt daarvóór
// de drie init-calls toe als die nog niet bestaan.
// Bij bestaande init-calls met afwijkende casing (bijv. initCGMetaRegistry vs
// initCgMetaRegistry) worden die vervangen door de juiste casing.
func ensureInitRegistration(outputDir, prefix string) error {
	plumbingPath := filepath.Join(outputDir, "metaregistry_plumbing.go")
	data, err := os.ReadFile(plumbingPath)
	if err != nil {
		return fmt.Errorf("kan %s niet lezen: %w", plumbingPath, err)
	}
	content := string(data)

	// Bepaal de PascalCase init-functienaam: bijv. prefix "cg" → "Cg", "np_loc" → "NpLoc"
	pascalPrefix := toPascalCase(normalizeIdentifierParts(prefix))
	initMeta := fmt.Sprintf("init%sMetaRegistry()", pascalPrefix)
	initDatatype := fmt.Sprintf("init%sDatatypeRegistry()", pascalPrefix)
	initEnum := fmt.Sprintf("init%sEnumRegistry()", pascalPrefix)

	// Controleer of de init-calls al aanwezig zijn (exact match)
	if strings.Contains(content, initMeta) {
		fmt.Printf("  Init-registratie voor %q al aanwezig in metaregistry_plumbing.go\n", prefix)
		return nil
	}

	// Controleer of er init-calls bestaan met afwijkende casing (bijv. "CG" → initCG
	// i.p.v. "cg" → initCg). Zo ja: vervang ze door de juiste casing.
	lowerMeta := strings.ToLower(initMeta)
	contentLower := strings.ToLower(content)
	if strings.Contains(contentLower, lowerMeta) {
		// Zoek de afwijkende variant en vervang
		re := regexp.MustCompile(`(?i)init\w*MetaRegistry\(\)`)
		for _, match := range re.FindAllString(content, -1) {
			if strings.ToLower(match) == lowerMeta && match != initMeta {
				content = strings.ReplaceAll(content, match, initMeta)
				fmt.Printf("  Init-call casing gecorrigeerd: %s → %s\n", match, initMeta)
			}
		}
		reDT := regexp.MustCompile(`(?i)init\w*DatatypeRegistry\(\)`)
		for _, match := range reDT.FindAllString(content, -1) {
			if strings.ToLower(match) == strings.ToLower(initDatatype) && match != initDatatype {
				content = strings.ReplaceAll(content, match, initDatatype)
				fmt.Printf("  Init-call casing gecorrigeerd: %s → %s\n", match, initDatatype)
			}
		}
		reEnum := regexp.MustCompile(`(?i)init\w*EnumRegistry\(\)`)
		for _, match := range reEnum.FindAllString(content, -1) {
			if strings.ToLower(match) == strings.ToLower(initEnum) && match != initEnum {
				content = strings.ReplaceAll(content, match, initEnum)
				fmt.Printf("  Init-call casing gecorrigeerd: %s → %s\n", match, initEnum)
			}
		}

		// Schrijf het gecorrigeerde bestand
		formatted, fmtErr := format.Source([]byte(content))
		if fmtErr != nil {
			formatted = []byte(content)
		}
		if err := os.WriteFile(plumbingPath, formatted, 0644); err != nil {
			return fmt.Errorf("kan %s niet schrijven: %w", plumbingPath, err)
		}
		fmt.Printf("  Init-registratie voor %q casing bijgewerkt in metaregistry_plumbing.go\n", prefix)
		return nil
	}

	// Zoek de plek vóór propageerDomeinNaarOnderliggende() — de functie-CALL
	// (tab-geïndenteerd), niet de functie-declaratie of een comment.
	marker := "\tpropageerDomeinNaarOnderliggende()"
	markerIdx := strings.Index(content, marker)
	if markerIdx < 0 {
		return fmt.Errorf("kan marker %q niet vinden in %s", marker, plumbingPath)
	}

	// Zoek de start van de regel met de marker (voor de juiste indentatie)
	lineStart := strings.LastIndex(content[:markerIdx], "\n") + 1

	// Detecteer de comment-prefix die ervoor hoort (bijv. "// Propageer domein...")
	// We zoeken de lege regel daarvóór als insertpunt
	insertComment := fmt.Sprintf("\t// %s — domein-specifieke uitbreiding\n", prefix)
	insertBlock := insertComment +
		fmt.Sprintf("\t%s\n", initEnum) +
		fmt.Sprintf("\t%s\n", initDatatype) +
		fmt.Sprintf("\t%s\n\n", initMeta)

	// Voeg in vóór de comment-regel die bij propageerDomeinNaarOnderliggende hoort
	// Zoek eventuele comment-regels die direct boven de marker-regel staan
	searchArea := content[:lineStart]
	// Zoek de laatste niet-lege, niet-comment regel vóór de marker
	commentStart := lineStart
	re := regexp.MustCompile(`(?m)^\s*//[^\n]*\n$`)
	lines := strings.Split(searchArea, "\n")
	// Scan achteruit om de bovenliggende comment-regels te vinden
	for i := len(lines) - 1; i >= 0; i-- {
		trimmed := strings.TrimSpace(lines[i])
		if strings.HasPrefix(trimmed, "//") {
			// Dit is een comment-regel boven de marker
			commentStart -= len(lines[i]) + 1
		} else if trimmed == "" {
			// Lege regel — insertpunt
			break
		} else {
			break
		}
	}
	_ = re // gebruikt voor patroonherkenning indien nodig

	newContent := content[:lineStart] + insertBlock + content[lineStart:]

	// Formatteer het resultaat
	formatted, fmtErr := format.Source([]byte(newContent))
	if fmtErr != nil {
		// Schrijf ongeformatteerd als fallback
		formatted = []byte(newContent)
	}

	if err := os.WriteFile(plumbingPath, formatted, 0644); err != nil {
		return fmt.Errorf("kan %s niet schrijven: %w", plumbingPath, err)
	}

	fmt.Printf("  Init-registratie voor %q toegevoegd aan metaregistry_plumbing.go\n", prefix)
	return nil
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

	// Valideer enums
	enumNamen := map[string]struct{}{}
	constNamen := map[string]struct{}{}
	for i, enum := range v3.Enums {
		ectx := fmt.Sprintf("enums[%d]", i)
		if !isPascalIdentifier(enum.GoType) {
			errs = append(errs, fmt.Sprintf("%s.goType '%s' is geen geldige Go-identifier; gebruik PascalCase zonder spaties (bijv. CGLaag i.p.v. CG laag)", ectx, enum.GoType))
		}
		if _, dup := enumNamen[enum.GoType]; dup {
			errs = append(errs, fmt.Sprintf("%s.goType '%s' is een duplicaat", ectx, enum.GoType))
		}
		enumNamen[enum.GoType] = struct{}{}

		for j, w := range enum.Waarden {
			wctx := fmt.Sprintf("%s.waarden[%d]", ectx, j)
			if !isPascalIdentifier(w.ConstNaam) {
				errs = append(errs, fmt.Sprintf("%s.constNaam '%s' is geen geldige Go-identifier", wctx, w.ConstNaam))
			}
			if _, dup := constNamen[w.ConstNaam]; dup {
				errs = append(errs, fmt.Sprintf("%s.constNaam '%s' is een duplicaat (tip: maak elke constNaam uniek, bijv. SchaalWaarde1 i.p.v. SchaalWaarde)", wctx, w.ConstNaam))
			}
			constNamen[w.ConstNaam] = struct{}{}
		}
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
