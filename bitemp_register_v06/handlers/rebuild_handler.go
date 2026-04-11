package handlers

// rebuild_handler.go — Devloop rebuild endpoint.
//
// POST /admin/rebuild/:password
//
// Accepteert een V3 JSON model in de request body en voert de volledige
// codegen → build pipeline uit binnen de container. Na een succesvolle
// build sluit de API af met exit code 42, waarna het entrypoint script
// de nieuwe binary automatisch herstart.
//
// Dit endpoint is alleen beschikbaar als DEVLOOP=true is ingesteld.

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// isDevloopEnabled controleert of de DEVLOOP omgevingsvariabele is ingesteld.
func isDevloopEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("DEVLOOP")))
	return v == "true" || v == "1" || v == "yes"
}

// getDevloopPassword retourneert het wachtwoord voor de devloop rebuild endpoint.
func getDevloopPassword() string {
	pw := os.Getenv("DEVLOOP_PASSWORD")
	if pw == "" {
		return "1234"
	}
	return pw
}

// resolveAppDir bepaalt de projectroot voor devloop rebuilds.
// In Docker is dat normaal `/app`; lokaal zoeken we dynamisch de map met `go.mod`.
func resolveAppDir() string {
	if appDir := strings.TrimSpace(os.Getenv("APP_DIR")); appDir != "" {
		return appDir
	}

	wd, err := os.Getwd()
	if err != nil || wd == "" {
		return "/app"
	}

	dir := wd
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return wd
}

// RebuildDomeinSpec beschrijft één domein + prefix combinatie voor multi-domein codegen.
// Mode wordt altijd als "additive" uitgevoerd (standalone wordt niet meer ondersteund).
type RebuildDomeinSpec struct {
	Domein string `json:"domein"`
	Prefix string `json:"prefix"`
	Mode   string `json:"mode,omitempty"` // genegeerd; altijd additive
}

// RebuildRequest beschrijft de request body voor de rebuild endpoint.
type RebuildRequest struct {
	// Domein is het domein waarvoor code wordt gegenereerd (bijv. "register", "np-loc").
	// Als leeg, wordt "register" gebruikt. Genegeerd als Domeinen is gevuld.
	Domein string `json:"domein"`

	// Prefix is de bestandsnaamprefix voor de gegenereerde bestanden.
	// Als leeg, wordt het domein (met - → _) als prefix gebruikt. Genegeerd als Domeinen is gevuld.
	Prefix string `json:"prefix"`

	// Mode is de codegen modus (genegeerd; altijd additive).
	// Genegeerd als Domeinen is gevuld.
	Mode string `json:"mode,omitempty"`

	// Domeinen bevat meerdere domein/prefix/mode combinaties voor multi-domein codegen.
	// Als gevuld, worden Domein/Prefix/Mode genegeerd en wordt er per entry een codegen-run gedaan.
	Domeinen []RebuildDomeinSpec `json:"domeinen,omitempty"`

	// SchemaBron bepaalt waar het model vandaan moet komen als `model` niet is meegegeven.
	// Ondersteunde waarden: "code" (default), "actief", "latest_proposed".
	SchemaBron string `json:"schema_bron"`

	// SchemaVersieID kiest expliciet een schema_versies record uit de database.
	// Als dit veld is gezet, heeft het voorrang boven SchemaBron.
	SchemaVersieID *int64 `json:"schema_versie_id,omitempty"`

	// Model is het V3 model in JSON formaat.
	// Als leeg, wordt de gekozen bron gebruikt (`code`, `actief`, `latest_proposed` of `schema_versie_id`).
	Model json.RawMessage `json:"model"`
}

// RebuildResponse beschrijft de response van de rebuild endpoint.
type RebuildResponse struct {
	Status       string   `json:"status"`
	Stappen      []string `json:"stappen"`
	CodegenFiles []string `json:"codegen_files,omitempty"`
	BuildOutput  string   `json:"build_output,omitempty"`
	Error        string   `json:"error,omitempty"`
	HerstartOver string   `json:"herstart_over,omitempty"`
}

func laadSchemaVersieJSONOpID(schemaVersieID int64) ([]byte, string, error) {
	if DB == nil {
		return nil, "", fmt.Errorf("database niet geïnitialiseerd")
	}

	ctx := context.Background()
	var versie model.SchemaVersie
	err := DB.NewSelect().
		Model(&versie).
		Where("id = ?", schemaVersieID).
		Limit(1).
		Scan(ctx)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, "", fmt.Errorf("geen schema-versie gevonden met ID %d", schemaVersieID)
		}
		return nil, "", fmt.Errorf("kan schema-versie %d niet ophalen: %w", schemaVersieID, err)
	}

	return versie.SchemaJSON, fmt.Sprintf("Schema-versie %d uit database geladen (status=%s)", versie.ID, versie.Status), nil
}

func laadLaatsteSchemaVersieJSONOpStatus(status model.SchemaVersieStatus) ([]byte, string, error) {
	if DB == nil {
		return nil, "", fmt.Errorf("database niet geïnitialiseerd")
	}

	ctx := context.Background()
	var versie model.SchemaVersie
	err := DB.NewSelect().
		Model(&versie).
		Where("status = ?", status).
		OrderExpr("id DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, "", fmt.Errorf("geen schema-versie gevonden met status %q", status)
		}
		return nil, "", fmt.Errorf("kan laatste schema-versie met status %q niet ophalen: %w", status, err)
	}

	return versie.SchemaJSON, fmt.Sprintf("Laatste schema-versie uit database geladen: ID %d (status=%s)", versie.ID, versie.Status), nil
}

func copyFile(src string, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0750); err != nil {
		return err
	}

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func copyDir(src string, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)

		if info.IsDir() {
			return os.MkdirAll(target, info.Mode())
		}

		return copyFile(path, target, info.Mode())
	})
}

var baselineKernModelBestanden = []string{
	"model_plumbing.go",
	"metaregistry_plumbing.go",
	"v3_format.go",
	"v3_exporter.go",
	"json",
}

// syncBaselineKernModelBestanden zorgt dat handmatige model-plumbingbestanden
// én bewust bewaarde V3 JSON modelbestanden ook in `_baseline/model/`
// up-to-date blijven. Zonder deze synchronisatie kan een rebuild eerst een
// oude baseline terugzetten, waardoor nieuwe types, layoutmetadata
// (zoals UseEdges/V3UseEdge) of bewaarde `model/json/model v3/*` exports
// ineens verdwijnen.
func syncBaselineKernModelBestanden(appDir string) ([]string, error) {
	srcDir := filepath.Join(appDir, "model")
	baselineDir := filepath.Join(appDir, "_baseline", "model")
	if err := os.MkdirAll(baselineDir, 0750); err != nil {
		return nil, fmt.Errorf("kan baseline directory niet aanmaken voor kernbestanden: %w", err)
	}

	meldingen := []string{}
	for _, bestandsnaam := range baselineKernModelBestanden {
		src := filepath.Join(srcDir, bestandsnaam)
		info, err := os.Stat(src)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, fmt.Errorf("kan kernbestand %s niet lezen: %w", src, err)
		}

		dst := filepath.Join(baselineDir, bestandsnaam)
		if info.IsDir() {
			if err := os.RemoveAll(dst); err != nil {
				return nil, fmt.Errorf("kan oude kernmap %s in baseline niet verwijderen: %w", bestandsnaam, err)
			}
			if err := copyDir(src, dst); err != nil {
				return nil, fmt.Errorf("kan kernmap %s niet synchroniseren naar baseline: %w", bestandsnaam, err)
			}
			meldingen = append(meldingen, fmt.Sprintf("Baseline kernmap gesynchroniseerd: model/%s", bestandsnaam))
			continue
		}

		if err := copyFile(src, dst, info.Mode()); err != nil {
			return nil, fmt.Errorf("kan kernbestand %s niet synchroniseren naar baseline: %w", bestandsnaam, err)
		}
		meldingen = append(meldingen, fmt.Sprintf("Baseline kernbestand gesynchroniseerd: model/%s", bestandsnaam))
	}

	return meldingen, nil
}

func herstelModelDirectoryVanuitBaseline(appDir string) (string, error) {
	baselineDir := filepath.Join(appDir, "_baseline", "model")
	modelDir := filepath.Join(appDir, "model")

	info, err := os.Stat(baselineDir)
	if err != nil || !info.IsDir() {
		return "Geen model-baseline gevonden; huidige modeldirectory blijft behouden", nil
	}

	if err := os.RemoveAll(modelDir); err != nil {
		return "", fmt.Errorf("kan modeldirectory niet leegmaken: %w", err)
	}
	if err := copyDir(baselineDir, modelDir); err != nil {
		return "", fmt.Errorf("kan modeldirectory niet herstellen vanuit baseline: %w", err)
	}

	return fmt.Sprintf("Modeldirectory hersteld vanuit baseline %s", baselineDir), nil
}

// backupModelDirectory maakt een tijdelijke kopie van model/ naar _pre_rebuild/model/.
// Deze wordt bij een fout in codegen of build teruggeplaatst.
func backupModelDirectory(appDir string) (string, error) {
	modelDir := filepath.Join(appDir, "model")
	backupDir := filepath.Join(appDir, "_pre_rebuild", "model")

	// Oude pre-rebuild opruimen
	if err := os.RemoveAll(filepath.Join(appDir, "_pre_rebuild")); err != nil {
		return "", fmt.Errorf("kan oude pre-rebuild backup niet opruimen: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(backupDir), 0750); err != nil {
		return "", fmt.Errorf("kan pre-rebuild directory niet aanmaken: %w", err)
	}

	if err := copyDir(modelDir, backupDir); err != nil {
		return "", fmt.Errorf("kan model niet kopiëren naar pre-rebuild backup: %w", err)
	}

	return fmt.Sprintf("Pre-rebuild backup aangemaakt in %s", backupDir), nil
}

// rollbackModelDirectory herstelt model/ vanuit _pre_rebuild/model/ na een mislukte codegen of build.
func rollbackModelDirectory(appDir string) (string, error) {
	backupDir := filepath.Join(appDir, "_pre_rebuild", "model")
	modelDir := filepath.Join(appDir, "model")

	info, err := os.Stat(backupDir)
	if err != nil || !info.IsDir() {
		return "Geen pre-rebuild backup gevonden; model niet hersteld", nil
	}

	if err := os.RemoveAll(modelDir); err != nil {
		return "", fmt.Errorf("kan modeldirectory niet leegmaken bij rollback: %w", err)
	}
	if err := copyDir(backupDir, modelDir); err != nil {
		return "", fmt.Errorf("kan model niet herstellen vanuit pre-rebuild backup: %w", err)
	}

	return "Model hersteld vanuit pre-rebuild backup (rollback)", nil
}

// updateBaseline overschrijft _baseline/model/ met de huidige (succesvol gebouwde) model/.
func updateBaseline(appDir string) (string, error) {
	modelDir := filepath.Join(appDir, "model")
	baselineDir := filepath.Join(appDir, "_baseline", "model")

	if err := os.RemoveAll(baselineDir); err != nil {
		return "", fmt.Errorf("kan oude baseline niet verwijderen: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(baselineDir), 0750); err != nil {
		return "", fmt.Errorf("kan baseline directory niet aanmaken: %w", err)
	}
	if err := copyDir(modelDir, baselineDir); err != nil {
		return "", fmt.Errorf("kan baseline niet bijwerken: %w", err)
	}

	return "Baseline bijgewerkt met succesvol gebouwde model", nil
}

func bepaalDomeinEnPrefixUitModelJSON(modelBytes []byte, fallbackDomein string, fallbackPrefix string) (string, string, string) {
	fallbackDomein = strings.TrimSpace(fallbackDomein)
	fallbackPrefix = strings.TrimSpace(fallbackPrefix)

	var v3 model.V3Model
	if err := json.Unmarshal(modelBytes, &v3); err != nil {
		domein := fallbackDomein
		if domein == "" {
			domein = "register"
		}
		prefix := fallbackPrefix
		if prefix == "" {
			prefix = strings.ReplaceAll(domein, "-", "_")
		}
		return domein, prefix, "Modeldomein kon niet uit JSON worden afgeleid; fallback gebruikt"
	}

	kandidaten := []string{}
	for _, ent := range v3.Entiteiten {
		if strings.TrimSpace(ent.Domein) != "" {
			kandidaten = append(kandidaten, strings.TrimSpace(ent.Domein))
		}
	}
	for _, dt := range v3.Datatypes {
		if strings.TrimSpace(dt.Domein) != "" {
			kandidaten = append(kandidaten, strings.TrimSpace(dt.Domein))
		}
	}
	for _, enum := range v3.Enums {
		if strings.TrimSpace(enum.Domein) != "" {
			kandidaten = append(kandidaten, strings.TrimSpace(enum.Domein))
		}
	}

	inferred := ""
	for _, kandidaat := range kandidaten {
		if kandidaat != "register" {
			inferred = kandidaat
			break
		}
	}
	if inferred == "" && len(kandidaten) > 0 {
		inferred = kandidaten[0]
	}

	domein := fallbackDomein
	if domein == "" || strings.EqualFold(domein, "auto") || (strings.EqualFold(domein, "register") && inferred != "" && inferred != "register") {
		if inferred != "" {
			domein = inferred
		}
	}
	if domein == "" {
		domein = "register"
	}

	prefix := fallbackPrefix
	if prefix == "" || strings.EqualFold(prefix, "auto") || (strings.EqualFold(prefix, "register") && domein != "register") {
		prefix = strings.ReplaceAll(domein, "-", "_")
	}

	melding := fmt.Sprintf("Codegen-doel bepaald als domein=%q, prefix=%q", domein, prefix)
	return domein, prefix, melding
}

// MaakRebuildHandler maakt de POST /admin/rebuild/:password handler.
func MaakRebuildHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Beveiligingscontroles
		if !isDevloopEnabled() {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "rebuild is alleen beschikbaar in devloop modus (DEVLOOP=true)",
			})
			return
		}

		password := c.Param("password")
		if password != getDevloopPassword() {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "ongeldig wachtwoord"})
			return
		}

		// Parse request. Een lege body is toegestaan, maar ongeldige JSON niet.
		// We lezen de raw body expliciet zodat fouten zichtbaar worden en zodat
		// we niet stilzwijgend terugvallen naar een lege request bij parseproblemen.
		var req RebuildRequest
		rawBody, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, RebuildResponse{
				Status: "fout",
				Error:  fmt.Sprintf("kan request body niet lezen: %v", err),
			})
			return
		}
		if len(bytes.TrimSpace(rawBody)) > 0 {
			if err := json.Unmarshal(rawBody, &req); err != nil {
				c.JSON(http.StatusBadRequest, RebuildResponse{
					Status: "fout",
					Error:  fmt.Sprintf("ongeldige rebuild JSON: %v", err),
				})
				return
			}
		}

		if req.Mode == "" {
			req.Mode = "additive"
		}

		stappen := []string{}
		appDir := resolveAppDir()
		stappen = append(stappen, fmt.Sprintf("Werkdirectory bepaald als %s", appDir))

		// Stap 0a: synchroniseer handmatige model-plumbingbestanden eerst naar de baseline,
		// zodat een rebuild geen recente codewijzigingen terugdraait.
		if meldingen, err := syncBaselineKernModelBestanden(appDir); err != nil {
			c.JSON(http.StatusInternalServerError, RebuildResponse{
				Status:  "fout",
				Stappen: stappen,
				Error:   err.Error(),
			})
			return
		} else if len(meldingen) > 0 {
			stappen = append(stappen, meldingen...)
		}

		// Stap 0b: Herstel model/ vanuit baseline (schone basis voor codegen).
		if melding, err := herstelModelDirectoryVanuitBaseline(appDir); err != nil {
			c.JSON(http.StatusInternalServerError, RebuildResponse{
				Status:  "fout",
				Stappen: stappen,
				Error:   err.Error(),
			})
			return
		} else if melding != "" {
			stappen = append(stappen, melding)
		}

		// Stap 0b: Maak backup van model/ vóór codegen (voor rollback bij fout).
		if melding, err := backupModelDirectory(appDir); err != nil {
			c.JSON(http.StatusInternalServerError, RebuildResponse{
				Status:  "fout",
				Stappen: stappen,
				Error:   err.Error(),
			})
			return
		} else if melding != "" {
			stappen = append(stappen, melding)
		}

		// Stap 1: Bepaal welke modelbron gebruikt moet worden en schrijf het V3 model tijdelijk weg.
		modelPath := filepath.Join(appDir, "_devloop_model.json")
		var modelBytes []byte

		switch {
		case len(req.Model) > 0:
			stappen = append(stappen, "V3 model ontvangen via request body (actuele editorinhoud)")
			modelBytes = req.Model
		case req.SchemaVersieID != nil:
			bytes, melding, err := laadSchemaVersieJSONOpID(*req.SchemaVersieID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, RebuildResponse{
					Status:  "fout",
					Stappen: stappen,
					Error:   err.Error(),
				})
				return
			}
			stappen = append(stappen, melding)
			modelBytes = bytes
		case strings.EqualFold(req.SchemaBron, "actief") || strings.EqualFold(req.SchemaBron, "active"):
			bytes, melding, err := laadLaatsteSchemaVersieJSONOpStatus(model.SchemaVersieStatusActive)
			if err != nil {
				c.JSON(http.StatusInternalServerError, RebuildResponse{
					Status:  "fout",
					Stappen: stappen,
					Error:   err.Error(),
				})
				return
			}
			stappen = append(stappen, melding)
			modelBytes = bytes
		case strings.EqualFold(req.SchemaBron, "latest_proposed") || strings.EqualFold(req.SchemaBron, "proposed") || strings.EqualFold(req.SchemaBron, "laatste"):
			bytes, melding, err := laadLaatsteSchemaVersieJSONOpStatus(model.SchemaVersieStatusProposed)
			if err != nil {
				c.JSON(http.StatusInternalServerError, RebuildResponse{
					Status:  "fout",
					Stappen: stappen,
					Error:   err.Error(),
				})
				return
			}
			stappen = append(stappen, melding)
			modelBytes = bytes
		default:
			stappen = append(stappen, "V3 model exporteren vanuit huidige MetaRegistry (code)")
			var exportCmd *exec.Cmd
			if _, err := os.Stat(filepath.Join(appDir, "bin", "export_v3")); err == nil {
				exportCmd = exec.Command(filepath.Join(appDir, "bin", "export_v3"), "--domein", req.Domein)
				stappen = append(stappen, "Export via prebuilt /app/bin/export_v3")
			} else {
				exportCmd = exec.Command("go", "run", "./cmd/export_v3", "--domein", req.Domein)
				stappen = append(stappen, "Export via go run ./cmd/export_v3")
			}
			exportCmd.Dir = appDir
			output, err := exportCmd.Output()
			if err != nil {
				c.JSON(http.StatusInternalServerError, RebuildResponse{
					Status:  "fout",
					Stappen: stappen,
					Error:   fmt.Sprintf("export mislukt: %v", err),
				})
				return
			}
			modelBytes = output
		}

		// Bepaal domein/prefix uit model JSON als we in single-domein modus zitten.
		if len(req.Domeinen) == 0 {
			var melding string
			req.Domein, req.Prefix, melding = bepaalDomeinEnPrefixUitModelJSON(modelBytes, req.Domein, req.Prefix)
			stappen = append(stappen, melding)
		}

		if err := os.WriteFile(modelPath, modelBytes, 0644); err != nil {
			c.JSON(http.StatusInternalServerError, RebuildResponse{
				Status:  "fout",
				Stappen: stappen,
				Error:   fmt.Sprintf("kan model niet schrijven: %v", err),
			})
			return
		}
		stappen = append(stappen, fmt.Sprintf("Model opgeslagen als %s", modelPath))

		// Stap 2: Codegen uitvoeren — multi-domein of single-domein.
		//
		// Als req.Domeinen is gevuld, voeren we per entry een codegen-run uit.
		// Anders gebruiken we de legacy-single-domein-velden (Domein/Prefix/Mode).
		domeinRuns := req.Domeinen
		if len(domeinRuns) == 0 {
			domeinRuns = []RebuildDomeinSpec{{
				Domein: req.Domein,
				Prefix: req.Prefix,
				Mode:   req.Mode,
			}}
		}

		stappen = append(stappen, fmt.Sprintf("Codegen voor %d domein(en)", len(domeinRuns)))

		for i, run := range domeinRuns {
			runPrefix := strings.TrimSpace(run.Prefix)
			if runPrefix == "" {
				runPrefix = strings.ReplaceAll(run.Domein, "-", "_")
			}

			codegenArgs := []string{
				"--input", modelPath,
				"--mode", "additive",
				"--domein", run.Domein,
			}
			if runPrefix != "" {
				codegenArgs = append(codegenArgs, "--prefix", runPrefix)
			}
			codegenArgs = append(codegenArgs, "--output", filepath.Join(appDir, "model"))

			var codegenCmd *exec.Cmd
			if _, err := os.Stat(filepath.Join(appDir, "bin", "codegen")); err == nil {
				stappen = append(stappen, fmt.Sprintf("[%d/%d] Codegen %s (domein=%s, prefix=%s, mode=additive)", i+1, len(domeinRuns), "/app/bin/codegen", run.Domein, runPrefix))
				codegenCmd = exec.Command(filepath.Join(appDir, "bin", "codegen"), codegenArgs...)
			} else {
				fallbackArgs := append([]string{"run", "./cmd/codegen"}, codegenArgs...)
				stappen = append(stappen, fmt.Sprintf("[%d/%d] Codegen go run ./cmd/codegen (domein=%s, prefix=%s, mode=additive)", i+1, len(domeinRuns), run.Domein, runPrefix))
				codegenCmd = exec.Command("go", fallbackArgs...)
			}
			codegenCmd.Dir = appDir
			codegenOutput, err := codegenCmd.CombinedOutput()
			if err != nil {
				// Codegen mislukt: rollback model/ naar pre-rebuild backup.
				if rbMsg, rbErr := rollbackModelDirectory(appDir); rbErr != nil {
					stappen = append(stappen, fmt.Sprintf("ROLLBACK MISLUKT: %v", rbErr))
				} else {
					stappen = append(stappen, rbMsg)
				}
				c.JSON(http.StatusInternalServerError, RebuildResponse{
					Status:  "fout",
					Stappen: stappen,
					Error:   fmt.Sprintf("codegen [%d/%d] mislukt (domein=%s): %v\nOutput: %s", i+1, len(domeinRuns), run.Domein, err, string(codegenOutput)),
				})
				return
			}
			stappen = append(stappen, fmt.Sprintf("[%d/%d] Codegen domein=%s succesvol", i+1, len(domeinRuns), run.Domein))
		}

		// Stap 3: Go build
		stappen = append(stappen, "Binary hercompileren...")
		buildCmd := exec.Command("go", "build", "-o", filepath.Join(appDir, "bitemp-go-api"), ".")
		buildCmd.Dir = appDir
		buildCmd.Env = append(os.Environ(), "CGO_ENABLED=0")
		buildOutput, err := buildCmd.CombinedOutput()
		if err != nil {
			// Build mislukt: rollback model/ naar pre-rebuild backup.
			stappen = append(stappen, fmt.Sprintf("Build mislukt: %v", err))
			if rbMsg, rbErr := rollbackModelDirectory(appDir); rbErr != nil {
				stappen = append(stappen, fmt.Sprintf("ROLLBACK MISLUKT: %v", rbErr))
			} else {
				stappen = append(stappen, rbMsg)
			}
			c.JSON(http.StatusInternalServerError, RebuildResponse{
				Status:      "fout",
				Stappen:     stappen,
				BuildOutput: string(buildOutput),
				Error:       fmt.Sprintf("build mislukt: %v — model is teruggedraaid naar pre-rebuild toestand", err),
			})
			return
		}
		stappen = append(stappen, "Build succesvol")

		// Stap 3b: Baseline bijwerken met succesvol gebouwde model/
		if melding, err := updateBaseline(appDir); err != nil {
			stappen = append(stappen, fmt.Sprintf("Waarschuwing: baseline bijwerken mislukt: %v", err))
		} else {
			stappen = append(stappen, melding)
		}

		// Stap 4: Opruimen
		os.Remove(modelPath)
		stappen = append(stappen, "Tijdelijk modelbestand opgeruimd")

		// Stap 5: Stuur response en plan herstart
		stappen = append(stappen, "API herstart gepland over 2 seconden...")
		herstartMelding := ""
		if os.Getenv("DEVLOOP_CONTAINER") == "true" {
			herstartMelding = "2 seconden"
		}

		// Auto-snapshot: sla rebuild model op als IdeBestand
		go func() {
			snapshotErr := RegistreerBestandSnapshot(context.Background(), DB, BestandSnapshotParams{
				Naam:         fmt.Sprintf("rebuild_%s.json", req.Domein),
				Beschrijving: fmt.Sprintf("Rebuild snapshot (domein: %s)", req.Domein),
				Categorie:    model.IdeBestandCategorieModelSnapshot,
				Formaat:      model.IdeBestandFormaatJSON,
				MimeType:     "application/json",
				Domein:       req.Domein,
				VersieLabel:  "rebuild",
				Inhoud:       string(modelBytes),
				Opmerking:    "Auto-snapshot bij succesvolle rebuild",
			})
			if snapshotErr != nil {
				fmt.Printf("WARN: IdeBestand snapshot bij rebuild mislukt: %v\n", snapshotErr)
			}
		}()

		c.JSON(http.StatusOK, RebuildResponse{
			Status:       "succesvol",
			Stappen:      stappen,
			BuildOutput:  string(buildOutput),
			HerstartOver: herstartMelding,
		})

		// Na het sturen van de response: exit met code 42 zodat het
		// entrypoint script de nieuwe binary herstart.
		// Alleen in container-modus (DEVLOOP_CONTAINER=true), anders blijft de server draaien.
		if os.Getenv("DEVLOOP_CONTAINER") == "true" {
			go func() {
				time.Sleep(2 * time.Second)
				fmt.Println("\n=== Devloop rebuild voltooid, herstarten met exit code 42 ===")
				os.Exit(42)
			}()
		} else {
			fmt.Println("\n=== Devloop rebuild voltooid (geen herstart: niet in container) ===")
		}
	}
}

// MaakRebuildStatusHandler maakt de GET /admin/rebuild/status handler
// die informatie retourneert over de devloop omgeving.
func MaakRebuildStatusHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !isDevloopEnabled() {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "devloop modus niet actief",
			})
			return
		}

		// Controleer beschikbaarheid Go toolchain
		goVersion := "onbekend"
		if out, err := exec.Command("go", "version").Output(); err == nil {
			goVersion = strings.TrimSpace(string(out))
		}

		appDir := resolveAppDir()

		// Controleer of codegen binary of broncode beschikbaar is in de actuele app-dir.
		codegenBeschikbaar := false
		if _, err := os.Stat(filepath.Join(appDir, "bin", "codegen")); err == nil {
			codegenBeschikbaar = true
		}
		if !codegenBeschikbaar {
			if _, err := os.Stat(filepath.Join(appDir, "cmd", "codegen", "main.go")); err == nil {
				codegenBeschikbaar = true
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"devloop":                     true,
			"go_versie":                   goVersion,
			"codegen_beschikbaar":         codegenBeschikbaar,
			"werkdirectory":               appDir,
			"model_directory":             filepath.Join(appDir, "model"),
			"beschikbare_commando":        "POST /admin/rebuild/:password met body: model of schema_bron/schema_versie_id",
			"ondersteunde_schema_bronnen": []string{"model-in-body", "code", "actief", "latest_proposed", "schema_versie_id"},
		})
	}
}
