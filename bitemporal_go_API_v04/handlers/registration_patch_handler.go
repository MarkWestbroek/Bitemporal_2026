package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v04/model"
	"github.com/gin-gonic/gin"
)

// PatchRegistratie updates mutable metadata fields on an existing registratie.
// For now we only support updating the optional 'opmerking'.
func PatchRegistratie() gin.HandlerFunc {
	return func(c *gin.Context) {
		idParam := strings.TrimSpace(c.Param("id"))
		if idParam == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID must be present"})
			return
		}

		registratieID, err := strconv.ParseInt(idParam, 10, 64)
		if err != nil || registratieID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid registratie id"})
			return
		}

		var payload map[string]any
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		opmerkingRaw, ok := payload["opmerking"]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "payload must include 'opmerking'"})
			return
		}

		var opmerking *string
		switch v := opmerkingRaw.(type) {
		case nil:
			opmerking = nil
		case string:
			trimmed := strings.TrimSpace(v)
			if trimmed != "" {
				opmerking = &trimmed
			}
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "'opmerking' must be a string or null"})
			return
		}

		result, err := DB.NewUpdate().
			Model(&model.Registratie{}).
			Set("opmerking = ?", opmerking).
			Where("id = ?", registratieID).
			Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "registratie not found"})
			return
		}

		var updated model.Registratie
		if err := DB.NewSelect().Model(&updated).Where("id = ?", registratieID).Scan(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":     "Registratie opmerking bijgewerkt",
			"registratie": updated,
		})
	}
}
