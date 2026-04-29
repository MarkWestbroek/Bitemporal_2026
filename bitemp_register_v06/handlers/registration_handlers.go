// Package handlers — registration_handlers.go
//
// FASE 0 (refactor 2026-04-29):
// `RegistreerMetNieuweAanpak` is een dunne Gin-adapter: hij verzorgt enkel
// gin-specifieke I/O (raw body lezen, debug-logging, JSON-response) en
// delegeert de daadwerkelijke registratie-logica naar `RegistreerCore` in
// `registration_core.go`. Hierdoor kunnen REST/CRUD (fase 2) en GraphQL
// (fase 3) dezelfde engine aanroepen.
package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func RegistreerMetNieuweAanpak() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Lees raw body éérst zodat audittrail letterlijk de oorspronkelijke
		// payload (incl. eventuele geneste 'full'-shape) bewaart. ShouldBindJSON
		// consumeert de body, waarna re-marshal lossy zou zijn.
		rawBody, err := c.GetRawData()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to read request body: %v", err)})
			return
		}
		// Herstel body voor downstream lezers (LogRequestBodyAsJSON).
		c.Request.Body = io.NopCloser(bytes.NewBuffer(rawBody))

		var request model.RegistreerRequest
		if err := json.Unmarshal(rawBody, &request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Fase 1: splits geneste full-payloads in platte WijzigingRequests.
		genormaliseerd, err := NormaliseerWijzigingen(request.Wijzigingen)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("normaliseren van wijzigingen mislukt: %v", err)})
			return
		}
		request.Wijzigingen = genormaliseerd

		// Debug-logging blijft hier; vergt gin.Context.
		LogRequestBodyAsJSON(c)

		audit := AuditMeta{
			RawBody:       rawBody,
			RequestPath:   c.Request.URL.Path,
			RequestMethod: c.Request.Method,
			EntiteitID:    c.Param("id"),
		}

		result, rerr := RegistreerCore(c.Request.Context(), DB, request, audit)
		if rerr != nil {
			c.JSON(rerr.Status, gin.H{"error": rerr.Msg})
			return
		}

		// Response identiek aan pre-refactor (incl. registratieId-alias).
		c.JSON(result.Status, gin.H{
			"message":        result.Message,
			"registratie_id": result.RegistratieID,
			"registratieId":  result.RegistratieID,
			"tijdstip":       result.Tijdstip,
			"wijzigingen":    result.Wijzigingen,
		})
	}
}
