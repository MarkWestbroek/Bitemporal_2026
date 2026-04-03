package handlers

import (
	"net/http"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// MaakGetSchemaDomeinenHandler retourneert alle geregistreerde domeinen.
// GET /api/schema/domeinen
func MaakGetSchemaDomeinenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		var domeinen []model.SchemaDomein
		err := DB.NewSelect().
			Model(&domeinen).
			OrderExpr("naam ASC").
			Scan(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan domeinen niet ophalen: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"domeinen": domeinen,
		})
	}
}

// MaakPostSchemaDomeinHandler voegt een nieuw domein toe.
// POST /api/schema/domeinen  — body: {"naam": "...", "beschrijving": "..."}
// Retourneert 409 als het domein al bestaat.
func MaakPostSchemaDomeinHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		var req struct {
			Naam         string `json:"naam"`
			Beschrijving string `json:"beschrijving"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Ongeldig JSON: " + err.Error(),
			})
			return
		}

		naam := strings.TrimSpace(req.Naam)
		if naam == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Veld 'naam' is verplicht",
			})
			return
		}

		domein := model.SchemaDomein{
			Naam:         naam,
			Beschrijving: strings.TrimSpace(req.Beschrijving),
		}

		_, err := DB.NewInsert().
			Model(&domein).
			On("CONFLICT (naam) DO NOTHING").
			Returning("*").
			Exec(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan domein niet opslaan: " + err.Error(),
			})
			return
		}

		// Controleer of het domein al bestond (ON CONFLICT → geen returning)
		var bestaand model.SchemaDomein
		err = DB.NewSelect().
			Model(&bestaand).
			Where("naam = ?", naam).
			Scan(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Kan domein niet ophalen na insert: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, bestaand)
	}
}

// EnsureDomeinBestaat controleert of een domein bestaat in schema_domeinen.
// Als het domein nog niet bestaat, wordt het automatisch aangemaakt.
// Leeg domein of "register" wordt altijd geaccepteerd.
func EnsureDomeinBestaat(c *gin.Context, domeinnaam string) {
	naam := strings.TrimSpace(domeinnaam)
	if naam == "" {
		return
	}
	ctx := c.Request.Context()

	domein := model.SchemaDomein{
		Naam: naam,
	}
	_, _ = DB.NewInsert().
		Model(&domein).
		On("CONFLICT (naam) DO NOTHING").
		Exec(ctx)
}
