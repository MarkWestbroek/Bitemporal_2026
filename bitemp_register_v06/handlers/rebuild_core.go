package handlers

// rebuild_core.go — de rebuild-pijplijn los van HTTP, en de startup-rebuild.
//
// Twee aanroepers delen voerCodegenEnBuildUit: POST /admin/rebuild (rebuild_handler.go) en
// `bitemp-go-api startup-rebuild` (main.go), dat de devloop-entrypoint bij het starten van de
// container aanroept. Op Kubernetes/Fundament is het container-bestandssysteem weg bij elke
// herstart; de startup-rebuild maakt de actieve schema-versie uit de database de bron van
// waarheid: verschilt die van wat er gebouwd is, dan codegen + go build vóór de API start.
// Zie docs/DEVLOOP.md §"Startup-rebuild" en docs/plans/2026-10-22 Omnium op Fundament ….

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// ExitCodeStartupHerbouwd is de exitcode van `startup-rebuild` als er een nieuwe binary staat
// (de entrypoint start die dan). 0 = niets te doen of mislukt (de ingebakken binary start).
const ExitCodeStartupHerbouwd = 43

// actieveSchemaMarker (in _baseline/) bevat de hash van het model waaruit de huidige code
// gebouwd is, zodat de startup-rebuild niet twee keer hetzelfde bouwt.
const actieveSchemaMarker = "actieve-schema.sha256"

// binPad geeft het pad van een voorgebouwd hulpprogramma in <appDir>/bin (met .exe op Windows,
// zodat een lokale devloop-test op Windows dezelfde route neemt als de Linux-container).
func binPad(appDir, naam string) string {
	if runtime.GOOS == "windows" {
		naam += ".exe"
	}
	return filepath.Join(appDir, "bin", naam)
}

// prefixVoorRun geeft de bestandsprefix van een codegen-run (zoals /admin/rebuild hem bepaalt).
func prefixVoorRun(d RebuildDomeinSpec) string {
	if p := strings.TrimSpace(d.Prefix); p != "" {
		return p
	}
	return strings.ReplaceAll(strings.TrimSpace(d.Domein), "-", "_")
}

// voerCodegenEnBuildUit draait de pijplijn: baseline-sync, opschonen van de doeldomeinen,
// backup van model/, codegen per domein, go build -tags devtools, baseline bijwerken, en de
// marker met de modelhash. Bij een fout is model/ teruggedraaid naar de backup; stappen bevat
// dan wat er tot dan toe gebeurd is en buildOutput de uitvoer van codegen of go build.
func voerCodegenEnBuildUit(appDir string, modelBytes []byte, domeinRuns []RebuildDomeinSpec) (stappen []string, buildOutput []byte, err error) {
	// Stap 0a: handmatige plumbing-bestanden eerst naar de baseline, zodat een rebuild geen
	// recente codewijzigingen terugdraait.
	meldingen, err := syncBaselineKernModelBestanden(appDir)
	if err != nil {
		return stappen, nil, err
	}
	stappen = append(stappen, meldingen...)

	// Stap 0b: backup van de complete model/ vóór het opschonen, zodat een rollback de laatst
	// compilerende toestand terugzet. Tot 22-10-2026 kwam de backup ná het opschonen, waardoor
	// na een mislukte codegen de bestanden van de doeldomeinen ontbraken tot de volgende rebuild.
	if melding, err := backupModelDirectory(appDir); err != nil {
		return stappen, nil, err
	} else if melding != "" {
		stappen = append(stappen, melding)
	}

	// Stap 0c: alleen de gegenereerde bestanden van de doeldomeinen opschonen. Zonder prefixen
	// zou herstelModelDirectoryVanuitBaseline álles opschonen; dat willen we hier nooit.
	var prefixen []string
	for _, d := range domeinRuns {
		if p := prefixVoorRun(d); p != "" {
			prefixen = append(prefixen, p)
		}
	}
	if len(prefixen) == 0 {
		return stappen, nil, fmt.Errorf("geen domeinen om te genereren")
	}
	if melding, err := herstelModelDirectoryVanuitBaseline(appDir, prefixen); err != nil {
		if rbMsg, rbErr := rollbackModelDirectory(appDir); rbErr == nil {
			stappen = append(stappen, rbMsg)
		}
		return stappen, nil, err
	} else if melding != "" {
		stappen = append(stappen, melding)
	}

	// Stap 1: het model tijdelijk wegschrijven voor codegen.
	modelPath := filepath.Join(appDir, "_devloop_model.json")
	if err := os.WriteFile(modelPath, modelBytes, 0644); err != nil {
		return stappen, nil, fmt.Errorf("kan model niet schrijven: %v", err)
	}
	defer os.Remove(modelPath)
	stappen = append(stappen, fmt.Sprintf("Model opgeslagen als %s", modelPath))

	// Stap 2: codegen per domein (altijd additive).
	stappen = append(stappen, fmt.Sprintf("Codegen voor %d domein(en)", len(domeinRuns)))
	for i, run := range domeinRuns {
		runPrefix := prefixVoorRun(run)
		codegenArgs := []string{"--input", modelPath, "--mode", "additive", "--domein", run.Domein}
		if runPrefix != "" {
			codegenArgs = append(codegenArgs, "--prefix", runPrefix)
		}
		codegenArgs = append(codegenArgs, "--output", filepath.Join(appDir, "model"))

		var codegenCmd *exec.Cmd
		if _, err := os.Stat(binPad(appDir, "codegen")); err == nil {
			stappen = append(stappen, fmt.Sprintf("[%d/%d] Codegen %s (domein=%s, prefix=%s, mode=additive)", i+1, len(domeinRuns), binPad(appDir, "codegen"), run.Domein, runPrefix))
			codegenCmd = exec.Command(binPad(appDir, "codegen"), codegenArgs...)
		} else {
			stappen = append(stappen, fmt.Sprintf("[%d/%d] Codegen go run ./cmd/codegen (domein=%s, prefix=%s, mode=additive)", i+1, len(domeinRuns), run.Domein, runPrefix))
			codegenCmd = exec.Command("go", append([]string{"run", "./cmd/codegen"}, codegenArgs...)...)
		}
		codegenCmd.Dir = appDir
		codegenOutput, err := codegenCmd.CombinedOutput()
		if err != nil {
			if rbMsg, rbErr := rollbackModelDirectory(appDir); rbErr != nil {
				stappen = append(stappen, fmt.Sprintf("ROLLBACK MISLUKT: %v", rbErr))
			} else {
				stappen = append(stappen, rbMsg)
			}
			return stappen, codegenOutput, fmt.Errorf("codegen [%d/%d] mislukt (domein=%s): %v\nOutput: %s", i+1, len(domeinRuns), run.Domein, err, string(codegenOutput))
		}
		stappen = append(stappen, fmt.Sprintf("[%d/%d] Codegen domein=%s succesvol", i+1, len(domeinRuns), run.Domein))
	}

	// Stap 3: go build naar een tijdelijk pad. -tags devtools: de devloop-binary moet zijn eigen
	// rebuild-endpoint houden. De draaiende binary blijft staan tot de zelftest geslaagd is.
	rollback := func() {
		if rbMsg, rbErr := rollbackModelDirectory(appDir); rbErr != nil {
			stappen = append(stappen, fmt.Sprintf("ROLLBACK MISLUKT: %v", rbErr))
		} else {
			stappen = append(stappen, rbMsg)
		}
	}
	doel := filepath.Join(appDir, "bitemp-go-api")
	nieuw := doel + ".nieuw"
	stappen = append(stappen, "Binary hercompileren...")
	buildCmd := exec.Command("go", "build", "-tags", "devtools", "-o", nieuw, ".")
	buildCmd.Dir = appDir
	buildCmd.Env = append(os.Environ(), "CGO_ENABLED=0")
	buildOutput, err = buildCmd.CombinedOutput()
	if err != nil {
		stappen = append(stappen, fmt.Sprintf("Build mislukt: %v", err))
		os.Remove(nieuw)
		rollback()
		return stappen, buildOutput, fmt.Errorf("build mislukt: %v — model is teruggedraaid naar pre-rebuild toestand", err)
	}
	stappen = append(stappen, "Build succesvol")

	// Stap 3a: zelftest — start de nieuwe binary zo ver dat alle routes geregistreerd zijn (zonder
	// database, zonder te luisteren). Een panic bij het opstarten (dubbele padnaam, kapotte
	// toegangsbundel) wordt zo gevangen vóór er iets geactiveerd of in de baseline gezet wordt.
	ctx, stop := context.WithTimeout(context.Background(), 2*time.Minute)
	defer stop()
	testCmd := exec.CommandContext(ctx, nieuw, "zelftest")
	testCmd.Dir = appDir
	testCmd.Env = append(os.Environ(), "STARTUP_REBUILD=false")
	if uit, err := testCmd.CombinedOutput(); err != nil {
		stappen = append(stappen, fmt.Sprintf("Zelftest van de nieuwe binary mislukt: %v", err))
		os.Remove(nieuw)
		rollback()
		return stappen, uit, fmt.Errorf("de nieuwe binary start niet (zelftest: %v) — niets geactiveerd, model teruggedraaid; zie build_output", err)
	}
	stappen = append(stappen, "Zelftest geslaagd (router gebouwd, alle routes geregistreerd)")

	// Stap 3b: databaseproef — de tabelaanmaak van het nieuwe model op de echte database, in een
	// transactie die wordt teruggedraaid (dbsetup.Proef). Vangt wat de zelftest niet ziet: een
	// constraint of trigger die op de bestaande tabellen faalt en de API bij de start zou stoppen.
	proefCtx, stopProef := context.WithTimeout(context.Background(), 5*time.Minute)
	defer stopProef()
	proefCmd := exec.CommandContext(proefCtx, nieuw, "dbproef")
	proefCmd.Dir = appDir
	proefCmd.Env = append(os.Environ(), "STARTUP_REBUILD=false")
	if uit, err := proefCmd.CombinedOutput(); err != nil {
		stappen = append(stappen, fmt.Sprintf("Databaseproef van het nieuwe model mislukt: %v", err))
		os.Remove(nieuw)
		rollback()
		return stappen, uit, fmt.Errorf("het nieuwe model past niet op de database (dbproef: %v) — niets geactiveerd, model teruggedraaid; zie build_output", err)
	}
	stappen = append(stappen, "Databaseproef geslaagd (tabelaanmaak in een teruggedraaide transactie)")
	if err := os.Rename(nieuw, doel); err != nil {
		os.Remove(nieuw)
		rollback()
		return stappen, nil, fmt.Errorf("kan nieuwe binary niet op zijn plaats zetten: %v", err)
	}

	// Stap 3b: baseline bijwerken met de succesvol gebouwde model/.
	if melding, err := updateBaseline(appDir); err != nil {
		stappen = append(stappen, fmt.Sprintf("Waarschuwing: baseline bijwerken mislukt: %v", err))
	} else {
		stappen = append(stappen, melding)
	}
	if err := schrijfActieveSchemaMarker(appDir, schemaHash(modelBytes)); err != nil {
		stappen = append(stappen, fmt.Sprintf("Waarschuwing: modelhash niet bewaard: %v", err))
	}
	stappen = append(stappen, "Tijdelijk modelbestand opgeruimd")
	return stappen, buildOutput, nil
}

// schemaHash is de sha256 (hex) van het model in canonieke vorm (sleutels gesorteerd, geen
// witruimte), dus ongevoelig voor opmaak én voor de sleutelvolgorde die Postgres' jsonb
// aanbrengt. Anders zou de startup-rebuild na elke herstart onnodig bouwen.
func schemaHash(modelBytes []byte) string {
	var canoniek []byte
	var v any
	if err := json.Unmarshal(modelBytes, &v); err == nil {
		canoniek, _ = json.Marshal(v) // encoding/json sorteert map-sleutels
	}
	if canoniek == nil {
		var compact bytes.Buffer
		if err := json.Compact(&compact, modelBytes); err != nil {
			compact.Reset()
			compact.Write(modelBytes)
		}
		canoniek = compact.Bytes()
	}
	sum := sha256.Sum256(canoniek)
	return hex.EncodeToString(sum[:])
}

func markerPad(appDir string) string { return filepath.Join(appDir, "_baseline", actieveSchemaMarker) }

func schrijfActieveSchemaMarker(appDir, hash string) error {
	if err := os.MkdirAll(filepath.Dir(markerPad(appDir)), 0755); err != nil {
		return err
	}
	return os.WriteFile(markerPad(appDir), []byte(hash+"\n"), 0644)
}

// mislukteSchemaMarkerPad: de hash van een actieve versie waarvan de startup-rebuild mislukte.
// Buiten _baseline/ (die wordt bij een geslaagde rebuild vervangen), naast de binary.
func mislukteSchemaMarkerPad(appDir string) string {
	return filepath.Join(appDir, "mislukte-schema.sha256")
}

func leesMarker(pad string) string {
	b, err := os.ReadFile(pad)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func leesActieveSchemaMarker(appDir string) string {
	b, err := os.ReadFile(markerPad(appDir))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// domeinRunsUitModel bepaalt de codegen-runs voor een volledig model: één per domein dat in het
// model voorkomt (entiteiten, datatypes, enums), gesorteerd. De prefix is die van het bestaande
// model/<prefix>_metaregistry.go als dat er (hoofdletterongevoelig) al is — zo blijft "CG" bij
// cg_ — en anders de domeinnaam met '-' → '_', zoals /admin/rebuild hem maakt.
func domeinRunsUitModel(modelBytes []byte, appDir string) ([]RebuildDomeinSpec, string) {
	var v3 model.V3Model
	if err := json.Unmarshal(modelBytes, &v3); err != nil {
		return nil, fmt.Sprintf("model niet leesbaar als V3: %v", err)
	}
	gezien := map[string]bool{}
	var domeinen []string
	voeg := func(d string) {
		d = strings.TrimSpace(d)
		if d != "" && !gezien[d] {
			gezien[d] = true
			domeinen = append(domeinen, d)
		}
	}
	for _, e := range v3.Entiteiten {
		voeg(e.Domein)
	}
	for _, dt := range v3.Datatypes {
		voeg(dt.Domein)
	}
	for _, en := range v3.Enums {
		voeg(en.Domein)
	}
	sort.Strings(domeinen)

	bestaand := map[string]string{} // lowercase prefix → echte prefix van een bestaand bestand
	if entries, err := os.ReadDir(filepath.Join(appDir, "model")); err == nil {
		for _, e := range entries {
			if n := e.Name(); strings.HasSuffix(n, "_metaregistry.go") {
				p := strings.TrimSuffix(n, "_metaregistry.go")
				bestaand[strings.ToLower(p)] = p
			}
		}
	}
	runs := make([]RebuildDomeinSpec, 0, len(domeinen))
	namen := make([]string, 0, len(domeinen))
	for _, d := range domeinen {
		prefix := strings.ReplaceAll(d, "-", "_")
		if p, ok := bestaand[strings.ToLower(prefix)]; ok {
			prefix = p
		}
		runs = append(runs, RebuildDomeinSpec{Domein: d, Prefix: prefix, Mode: "additive"})
		namen = append(namen, d+"→"+prefix)
	}
	return runs, fmt.Sprintf("Domeinen in het model: %s", strings.Join(namen, ", "))
}

// VoerStartupRebuildUit vergelijkt de actieve schema-versie uit de database met de laatst
// gebouwde (marker) en bouwt bij een verschil de code opnieuw. herbouwd=true: er staat een nieuwe
// binary. Geen actieve versie of gelijke hash: niets doen. Een fout laat de ingebakken code staan.
func VoerStartupRebuildUit() (herbouwd bool, stappen []string, err error) {
	appDir := resolveAppDir()
	stappen = append(stappen, fmt.Sprintf("Werkdirectory %s", appDir))

	modelBytes, melding, err := laadLaatsteSchemaVersieJSONOpStatus(model.SchemaVersieStatusActive)
	if err != nil {
		stappen = append(stappen, "Geen actieve schema-versie in de database; ingebakken code wordt gebruikt ("+err.Error()+")")
		return false, stappen, nil
	}
	stappen = append(stappen, melding)

	hash := schemaHash(modelBytes)
	if mislukt := leesMarker(mislukteSchemaMarkerPad(appDir)); mislukt == hash {
		stappen = append(stappen, "Deze versie ("+hash[:12]+") is eerder mislukt; overgeslagen (ingebakken code). Activeer een gecorrigeerde versie of verwijder "+mislukteSchemaMarkerPad(appDir))
		return false, stappen, nil
	}
	if huidig := leesActieveSchemaMarker(appDir); huidig == hash {
		stappen = append(stappen, "Code is al gebouwd uit deze versie ("+hash[:12]+"); niets te doen")
		return false, stappen, nil
	} else if huidig != "" {
		stappen = append(stappen, fmt.Sprintf("Gebouwd uit %s, actief is %s: opnieuw genereren", huidig[:12], hash[:12]))
	} else {
		stappen = append(stappen, "Geen hash van een eerdere build (verse container): genereren uit de actieve versie "+hash[:12])
	}

	runs, melding := domeinRunsUitModel(modelBytes, appDir)
	stappen = append(stappen, melding)
	if len(runs) == 0 {
		stappen = append(stappen, "Geen domeinen in het model; niets te doen")
		return false, stappen, nil
	}

	s2, uit, err := voerCodegenEnBuildUit(appDir, modelBytes, runs)
	stappen = append(stappen, s2...)
	if err != nil {
		_ = os.WriteFile(mislukteSchemaMarkerPad(appDir), []byte(hash+"\n"), 0644)
		return false, stappen, fmt.Errorf("%v\n%s", err, strings.TrimSpace(string(uit)))
	}
	os.Remove(mislukteSchemaMarkerPad(appDir))
	return true, stappen, nil
}
