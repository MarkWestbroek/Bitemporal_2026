package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v05/model"
	"github.com/gin-gonic/gin"
)

type vizEntiteitMaxIDResponse struct {
	Typenaam string `json:"typenaam"`
	IDKolom  string `json:"idKolom"`
	MaxID    int    `json:"maxId"`
	NextID   int    `json:"nextId"`
}

func MaakVizEntiteitMaxIDHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if DB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database not initialized"})
			return
		}

		typeNaam := strings.TrimSpace(c.Param("typenaam"))
		if typeNaam == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "type naam ontbreekt"})
			return
		}

		meta, ok := model.MetaRegistry.GetTypeMeta(typeNaam)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "onbekend type"})
			return
		}
		if meta.Metatype != model.MetatypeEntiteit {
			c.JSON(http.StatusBadRequest, gin.H{"error": "type is geen entiteit"})
			return
		}

		ids := make([]int, 0, 1)
		err := DB.NewSelect().
			Table(meta.Tabelnaam).
			Column(meta.IDKolom).
			OrderExpr(meta.IDKolom+" DESC").
			Limit(1).
			Scan(c.Request.Context(), &ids)
		if err != nil {
			// Geen rows is geen fout: dan is max 0 en next 1.
			if !errors.Is(err, sql.ErrNoRows) {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		maxID := 0
		if len(ids) > 0 {
			maxID = ids[0]
		}
		nextID := maxID + 1

		if raw := strings.TrimSpace(c.Query("atLeast")); raw != "" {
			if minVal, convErr := strconv.Atoi(raw); convErr == nil && minVal > nextID {
				nextID = minVal
			}
		}

		c.JSON(http.StatusOK, vizEntiteitMaxIDResponse{
			Typenaam: meta.Typenaam,
			IDKolom:  meta.IDKolom,
			MaxID:    maxID,
			NextID:   nextID,
		})
	}
}
