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

// RebuildRequest beschrijft de request body voor de rebuild endpoint.
type RebuildRequest struct {
	// Domein is het domein waarvoor code wordt gegenereerd (bijv. "register", "np-loc").
	// Als leeg, wordt "register" gebruikt.
	Domein string `json:"domein"`

	// Prefix is de bestandsnaamprefix voor de gegenereerde bestanden.
	// Als leeg, wordt het domein (met - → _) als prefix gebruikt.
	Prefix string `json:"prefix"`

	// Mode is de codegen modus: "additive" (default) of "standalone".
	Mode string `json:"mode"`

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

		// Parse request
		var req RebuildRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			// Lege body is toegestaan (gebruik huidige code)
			req = RebuildRequest{}
		}

		if req.Mode == "" {
			req.Mode = "additive"
		}

		stappen := []string{}
		appDir := "/app"

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

		var melding string
		req.Domein, req.Prefix, melding = bepaalDomeinEnPrefixUitModelJSON(modelBytes, req.Domein, req.Prefix)
		stappen = append(stappen, melding)

		if err := os.WriteFile(modelPath, modelBytes, 0644); err != nil {
			c.JSON(http.StatusInternalServerError, RebuildResponse{
				Status:  "fout",
				Stappen: stappen,
				Error:   fmt.Sprintf("kan model niet schrijven: %v", err),
			})
			return
		}
		stappen = append(stappen, fmt.Sprintf("Model opgeslagen als %s", modelPath))

		// Stap 2: Codegen uitvoeren
		codegenArgs := []string{
			"--input", modelPath,
			"--mode", req.Mode,
			"--domein", req.Domein,
			"--prefix", req.Prefix,
			"--output", filepath.Join(appDir, "model"),
		}

		var codegenCmd *exec.Cmd
		if _, err := os.Stat(filepath.Join(appDir, "bin", "codegen")); err == nil {
			stappen = append(stappen, fmt.Sprintf("Codegen via prebuilt /app/bin/codegen %s", strings.Join(codegenArgs, " ")))
			codegenCmd = exec.Command(filepath.Join(appDir, "bin", "codegen"), codegenArgs...)
		} else {
			fallbackArgs := append([]string{"run", "./cmd/codegen"}, codegenArgs...)
			stappen = append(stappen, fmt.Sprintf("Codegen via go %s", strings.Join(fallbackArgs, " ")))
			codegenCmd = exec.Command("go", fallbackArgs...)
		}
		codegenCmd.Dir = appDir
		codegenOutput, err := codegenCmd.CombinedOutput()
		if err != nil {
			c.JSON(http.StatusInternalServerError, RebuildResponse{
				Status:  "fout",
				Stappen: stappen,
				Error:   fmt.Sprintf("codegen mislukt: %v\nOutput: %s", err, string(codegenOutput)),
			})
			return
		}
		stappen = append(stappen, "Codegen succesvol")

		// Stap 3: Go build
		stappen = append(stappen, "Binary hercompileren...")
		buildCmd := exec.Command("go", "build", "-o", filepath.Join(appDir, "bitemp-go-api"), ".")
		buildCmd.Dir = appDir
		buildCmd.Env = append(os.Environ(), "CGO_ENABLED=0")
		buildOutput, err := buildCmd.CombinedOutput()
		if err != nil {
			c.JSON(http.StatusInternalServerError, RebuildResponse{
				Status:      "fout",
				Stappen:     stappen,
				BuildOutput: string(buildOutput),
				Error:       fmt.Sprintf("build mislukt: %v", err),
			})
			return
		}
		stappen = append(stappen, "Build succesvol")

		// Stap 4: Opruimen
		os.Remove(modelPath)
		stappen = append(stappen, "Tijdelijk modelbestand opgeruimd")

		// Stap 5: Stuur response en plan herstart
		stappen = append(stappen, "API herstart gepland over 2 seconden...")
		c.JSON(http.StatusOK, RebuildResponse{
			Status:       "succesvol",
			Stappen:      stappen,
			BuildOutput:  string(buildOutput),
			HerstartOver: "2 seconden",
		})

		// Na het sturen van de response: exit met code 42 zodat het
		// entrypoint script de nieuwe binary herstart.
		go func() {
			time.Sleep(2 * time.Second)
			fmt.Println("\n=== Devloop rebuild voltooid, herstarten met exit code 42 ===")
			os.Exit(42)
		}()
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

		// Controleer of codegen binary beschikbaar is
		codegenBeschikbaar := false
		if _, err := os.Stat("/app/bin/codegen"); err == nil {
			codegenBeschikbaar = true
		}
		// Fallback: controleer of cmd/codegen/ directory bestaat
		if !codegenBeschikbaar {
			if _, err := os.Stat("/app/cmd/codegen/main.go"); err == nil {
				codegenBeschikbaar = true
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"devloop":                     true,
			"go_versie":                   goVersion,
			"codegen_beschikbaar":         codegenBeschikbaar,
			"werkdirectory":               "/app",
			"model_directory":             "/app/model",
			"beschikbare_commando":        "POST /admin/rebuild/:password met body: model of schema_bron/schema_versie_id",
			"ondersteunde_schema_bronnen": []string{"model-in-body", "code", "actief", "latest_proposed", "schema_versie_id"},
		})
	}
}
