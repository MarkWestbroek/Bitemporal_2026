package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func sortExprSchemaVersies(sortParam string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(sortParam)) {
	case "", "id_desc":
		return "id DESC", true
	case "id_asc":
		return "id ASC", true
	case "model_naam_asc":
		return "model_naam ASC NULLS LAST, id DESC", true
	case "model_naam_desc":
		return "model_naam DESC NULLS LAST, id DESC", true
	default:
		return "", false
	}
}

func getOptioneleString(rawBody map[string]interface{}, key string) string {
	waarde, ok := rawBody[key]
	if !ok {
		return ""
	}

	tekst, ok := waarde.(string)
	if !ok {
		return ""
	}

	return tekst
}

func schemaVersieResponse(versie model.SchemaVersie) gin.H {
	return gin.H{
		"bron":               "database",
		"id":                 versie.ID,
		"status":             versie.Status,
		"tijdstip":           versie.Tijdstip,
		"model_bron":         versie.Bron,
		"model_naam":         versie.ModelNaam,
		"model_beschrijving": versie.ModelBeschrijving,
		"model_versie":       versie.ModelVersie,
		"indiener":           versie.Indiener,
		"build_versie":       versie.BuildVersie,
		"go_module":          versie.GoModule,
		"opmerking":          versie.Opmerking,
		"model":              json.RawMessage(versie.SchemaJSON),
	}
}

type schemaCodeMetadata struct {
	ModelNaam         string
	ModelBeschrijving string
	ModelVersie       string
	BuildVersie       string
	GoModule          string
	Indiener          string
	Opmerking         string
}

// schemaCodeMetadataFromEnv leest optionele metadata voor de code-export van het model.
func schemaCodeMetadataFromEnv() schemaCodeMetadata {
	return schemaCodeMetadata{
		ModelNaam:         strings.TrimSpace(os.Getenv("SCHEMA_CODE_MODEL_NAAM")),
		ModelBeschrijving: strings.TrimSpace(os.Getenv("SCHEMA_CODE_MODEL_BESCHRIJVING")),
		ModelVersie:       strings.TrimSpace(os.Getenv("SCHEMA_CODE_MODEL_VERSIE")),
		BuildVersie:       strings.TrimSpace(os.Getenv("SCHEMA_CODE_BUILD_VERSIE")),
		GoModule:          strings.TrimSpace(os.Getenv("SCHEMA_CODE_GO_MODULE")),
		Indiener:          strings.TrimSpace(os.Getenv("SCHEMA_CODE_INDIENER")),
		Opmerking:         strings.TrimSpace(os.Getenv("SCHEMA_CODE_OPMERKING")),
	}
}

// schemaCodeResponse bouwt een response uit de actuele code-toestand in plaats van uit schema_versies.
// Als domein niet leeg is wordt gefilterd op dat modeldomein.
func schemaCodeResponse(apiBron string, domein string) gin.H {
	var v3 model.V3Model
	if domein != "" {
		v3 = model.ExportMetaRegistryToV3(domein)
	} else {
		v3 = model.ExportMetaRegistryToV3()
	}
	metadata := schemaCodeMetadataFromEnv()

	if metadata.ModelNaam != "" {
		v3.Naam = metadata.ModelNaam
	}
	if metadata.ModelBeschrijving != "" {
		v3.Beschrijving = metadata.ModelBeschrijving
	}
	if metadata.ModelVersie != "" {
		v3.Versie = metadata.ModelVersie
	}

	return gin.H{
		"bron":               apiBron,
		"model_naam":         v3.Naam,
		"model_beschrijving": v3.Beschrijving,
		"model_versie":       v3.Versie,
		"model_bron":         "code",
		"indiener":           metadata.Indiener,
		"build_versie":       metadata.BuildVersie,
		"go_module":          metadata.GoModule,
		"opmerking":          metadata.Opmerking,
		"id":                 nil,
		"status":             "code",
		"tijdstip":           nil,
		"model":              v3,
	}
}

func schemaVersieLijstResponse(versie model.SchemaVersie) gin.H {
	response := gin.H{
		"id":                 versie.ID,
		"tijdstip":           versie.Tijdstip,
		"bron":               versie.Bron,
		"model_naam":         versie.ModelNaam,
		"model_beschrijving": versie.ModelBeschrijving,
		"model_versie":       versie.ModelVersie,
		"indiener":           versie.Indiener,
		"build_versie":       versie.BuildVersie,
		"go_module":          versie.GoModule,
		"status":             versie.Status,
		"opmerking":          versie.Opmerking,
		"model_url":          "/api/schema/model/" + strconv.FormatInt(versie.ID, 10),
	}

	if versie.Status == model.SchemaVersieStatusProposed {
		response["activeer_url"] = "/api/schema/model/" + strconv.FormatInt(versie.ID, 10) + "/activeer"
	}

	return response
}

// MaakGetSchemaModelHandler retourneert het actieve registermodel in v3-formaat.
// Als er een actieve versie in de database staat, wordt die geretourneerd.
// Anders wordt het model on-the-fly uit de MetaRegistry geëxporteerd.
func MaakGetSchemaModelHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		// Probeer eerst de actieve versie uit de database op te halen
		var versie model.SchemaVersie
		err := DB.NewSelect().
			Model(&versie).
			Where("status = ?", model.SchemaVersieStatusActive).
			OrderExpr("id DESC").
			Limit(1).
			Scan(ctx)

		if err == nil && len(versie.SchemaJSON) > 0 {
			// Retourneer de opgeslagen versie
			c.JSON(http.StatusOK, schemaVersieResponse(versie))
			return
		}

		// Fallback: exporteer on-the-fly uit de code als er nog geen actieve database-versie bestaat.
		domein := c.Query("domein")
		c.JSON(http.StatusOK, schemaCodeResponse("metaregistry", domein))
	}
}

// MaakGetSchemaModelCodeHandler retourneert altijd de huidige code-toestand van het model.
// GET /api/schema/model/code   ?domein=np-loc (optioneel)
func MaakGetSchemaModelCodeHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		domein := c.Query("domein")
		c.JSON(http.StatusOK, schemaCodeResponse("code", domein))
	}
}

// MaakGetSchemaModelVersieHandler retourneert een specifieke schema-versie uit de database.
// GET /api/schema/model/:id
// Deze endpoint gebruikt geen fallback: het gevraagde ID moet expliciet in schema_versies bestaan.
func MaakGetSchemaModelVersieHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		idParam := c.Param("id")

		var versie model.SchemaVersie
		err := DB.NewSelect().
			Model(&versie).
			Where("id = ?", idParam).
			Limit(1).
			Scan(ctx)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error": "Geen schema-versie gevonden met ID " + idParam,
				})
				return
			}

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan schema-versie niet ophalen: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, schemaVersieResponse(versie))
	}
}

// MaakPostSchemaModelHandler accepteert een nieuw v3-model als proposed versie.
// Body: kan V3Model rechtstreeks zijn, of {"bron": "...", "indiener": "...", "model": {...}} wrapper.
// De wrapper-meta gaat over de POST-afzender; model.versie blijft een eigenschap van het model zelf.
// Optionele query parameters: build_versie, go_module, opmerking
func MaakPostSchemaModelHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		// Lees de body als raw JSON
		var rawBody map[string]interface{}
		if err := c.ShouldBindJSON(&rawBody); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Ongeldig JSON in request body",
				"details": err.Error(),
			})
			return
		}

		// Lees POST-metadata uit de wrapper. Deze metadata hoort bij de afzender van de inzending.
		bron := getOptioneleString(rawBody, "bron")
		indiener := getOptioneleString(rawBody, "indiener")

		// Controleer of dit een wrapper is met "model" field
		var v3Data interface{}
		if model, ok := rawBody["model"]; ok {
			v3Data = model
		} else {
			v3Data = rawBody
		}

		// Zet om naar JSON en bind als V3Model
		jsonBytes, err := json.Marshal(v3Data)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Kan model niet verwerken",
				"details": err.Error(),
			})
			return
		}

		var v3 model.V3Model
		if err := json.Unmarshal(jsonBytes, &v3); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Ongeldig v3-model in request body",
				"details": err.Error(),
			})
			return
		}

		// Valideer minimale structuur
		if v3.Versie == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Veld 'versie' is verplicht (bijv. \"v3\")",
			})
			return
		}
		if len(v3.Entiteiten) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Minimaal één entiteit vereist in 'entiteiten'",
			})
			return
		}

		// Backward compatibility: oudere clients stuurden bron/indiener nog in het model mee.
		if bron == "" {
			bron = v3.Bron
		}
		if indiener == "" {
			indiener = v3.Indiener
		}

		// Serialiseer het model naar JSON voor opslag
		schemaBytes, err := json.Marshal(v3)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan model niet serialiseren: " + err.Error(),
			})
			return
		}

		// Maak een nieuwe schema_versie aan met status 'proposed'.
		// De modelversie komt uit het model; bron en indiener komen uit de POST-wrapper.
		versie := model.SchemaVersie{
			SchemaJSON:        schemaBytes,
			Bron:              bron,
			ModelNaam:         v3.Naam,
			ModelBeschrijving: v3.Beschrijving,
			ModelVersie:       v3.Versie,
			Indiener:          indiener,
			BuildVersie:       c.Query("build_versie"),
			GoModule:          c.Query("go_module"),
			Status:            model.SchemaVersieStatusProposed,
			Opmerking:         c.Query("opmerking"),
		}

		_, err = DB.NewInsert().
			Model(&versie).
			Returning("*").
			Exec(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan schemaversie niet opslaan: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"id":       versie.ID,
			"status":   versie.Status,
			"tijdstip": versie.Tijdstip,
		})
	}
}

// MaakActiveerSchemaVersieHandler activeert een proposed schema-versie.
// PUT /api/schema/model/:id/activeer
// Archiveert de huidige actieve versie en activeert de opgegeven versie.
func MaakActiveerSchemaVersieHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		idParam := c.Param("id")

		tx, err := DB.BeginTx(ctx, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan transactie niet starten: " + err.Error(),
			})
			return
		}
		defer tx.Rollback() //nolint:errcheck

		// Archiveer de huidige actieve versie
		_, err = tx.NewUpdate().
			Model((*model.SchemaVersie)(nil)).
			Set("status = ?", model.SchemaVersieStatusArchived).
			Where("status = ?", model.SchemaVersieStatusActive).
			Exec(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan actieve versie niet archiveren: " + err.Error(),
			})
			return
		}

		// Activeer de opgegeven versie
		res, err := tx.NewUpdate().
			Model((*model.SchemaVersie)(nil)).
			Set("status = ?", model.SchemaVersieStatusActive).
			Where("id = ?", idParam).
			Where("status = ?", model.SchemaVersieStatusProposed).
			Exec(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan versie niet activeren: " + err.Error(),
			})
			return
		}

		rowsAffected, _ := res.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Geen proposed versie gevonden met ID " + idParam,
			})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan transactie niet committen: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"id":     idParam,
			"status": model.SchemaVersieStatusActive,
		})
	}
}

// MaakLijstSchemaVersiesHandler retourneert alle schema-versies.
// GET /api/schema/versies
func MaakLijstSchemaVersiesHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		modelNaamFilter := strings.TrimSpace(c.Query("model_naam"))
		sortExpr, ok := sortExprSchemaVersies(c.Query("sort"))
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Ongeldige sort-parameter. Gebruik: id_desc, id_asc, model_naam_asc of model_naam_desc",
			})
			return
		}

		var versies []model.SchemaVersie
		query := DB.NewSelect().
			Model(&versies).
			Column("id", "tijdstip", "bron", "model_naam", "model_beschrijving", "model_versie", "indiener", "build_versie", "go_module", "status", "opmerking").
			OrderExpr(sortExpr)

		if modelNaamFilter != "" {
			query = query.Where("model_naam ILIKE ?", "%"+modelNaamFilter+"%")
		}

		err := query.Scan(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan versies niet ophalen: " + err.Error(),
			})
			return
		}

		response := make([]gin.H, 0, len(versies))
		for _, versie := range versies {
			response = append(response, schemaVersieLijstResponse(versie))
		}

		c.JSON(http.StatusOK, response)
	}
}
