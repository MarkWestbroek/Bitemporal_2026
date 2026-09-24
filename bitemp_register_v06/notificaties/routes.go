package notificaties

import (
	"net/http"
	"strconv"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// GebeurtenisSchema — het JSON-schema van `data` (dataschema in het CloudEvents-bericht).
var GebeurtenisSchema = map[string]any{
	"$schema":     "https://json-schema.org/draft/2020-12/schema",
	"$id":         "gebeurtenis-v1.json",
	"title":       "Omnium gebeurtenis (informatiearm)",
	"description": "data-deel van een CloudEvents-bericht van het bitemporele register: verwijzingen naar de registratie en de geraakte entiteit, geen veldwaarden. Het id (reg-<registratie>-w<n>) is persistent en reproduceerbaar; sequence is het registratie-id (monotoon, niet gegarandeerd aaneengesloten).",
	"type":        "object",
	"required":    []string{"registratieId", "registratietype", "entiteit", "id", "wijzigingstypen"},
	"properties": map[string]any{
		"registratieId":   map[string]any{"type": "integer"},
		"registratietype": map[string]any{"type": "string", "enum": []string{"registratie", "correctie", "ongedaanmaking"}},
		"bron":            map[string]any{"type": "string"},
		"entiteit":        map[string]any{"type": "string", "description": "typenaam in het model"},
		"id":              map[string]any{"type": "string"},
		"wijzigingstypen": map[string]any{"type": "array", "items": map[string]any{"type": "string", "enum": []string{"opvoer", "afvoer"}}},
	},
}

// Routes registreert de notificatie-endpoints. `admin` beschermt het bezorglog en de definities.
func (s *Service) Routes(router gin.IRouter, admin gin.HandlerFunc) {
	router.GET("/notificaties/gebeurtenistypes", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"source": nietLeeg(s.Cfg.Source, ""), "gebeurtenistypes": Catalogus(s.Cfg)})
	})
	router.GET("/notificaties/schema/gebeurtenis-v1.json", func(c *gin.Context) {
		c.JSON(http.StatusOK, GebeurtenisSchema)
	})
	router.GET("/notificaties/definities", admin, func(c *gin.Context) {
		defs, err := s.Definities(c.Request.Context(), s.Nu())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, defs)
	})
	router.GET("/notificaties/bezorgingen", admin, func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
		if limit <= 0 || limit > 1000 {
			limit = 100
		}
		var rijen []model.NotificatieBezorging
		q := s.DB.NewSelect().Model(&rijen).OrderExpr("id DESC").Limit(limit)
		if st := c.Query("status"); st != "" {
			q = q.Where("status = ?", st)
		}
		if err := q.Scan(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"bezorgingen": rijen})
	})
}
