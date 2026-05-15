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
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// RegistreerJSONCore is de transport-onafhankelijke variant van
// `RegistreerMetNieuweAanpak`. Krijgt rauwe JSON binnen, parsest +
// normaliseert (Fase 1) en delegeert naar `RegistreerCore`.
//
// Wordt gebruikt door:
//   - de Gin-adapter `RegistreerMetNieuweAanpak` (REST POST /registratie/...)
//   - de GraphQL-resolvers `registreer` / `corrigeer` / `maak_ongedaan`
//     (zonder HTTP-roundtrip).
//
// `defaultRegistratietype` wordt gezet als `request.Registratie.Registratietype`
// leeg is (zodat GraphQL-resolvers per mutation een default kunnen forceren).
func RegistreerJSONCore(ctx context.Context, rawBody []byte, defaultRegistratietype model.RegistratietypeEnum, audit AuditMeta) (*RegistreerResult, *RegistreerError) {
	var request model.RegistreerRequest
	if err := json.Unmarshal(rawBody, &request); err != nil {
		return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: err.Error()}
	}

	if request.Registratie.Registratietype == "" && defaultRegistratietype != "" {
		request.Registratie.Registratietype = defaultRegistratietype
	}

	genormaliseerd, err := NormaliseerWijzigingen(request.Wijzigingen)
	if err != nil {
		return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("normaliseren van wijzigingen mislukt: %v", err)}
	}
	request.Wijzigingen = genormaliseerd

	if audit.RawBody == nil {
		audit.RawBody = rawBody
	}
	res, rerr := RegistreerCore(ctx, DB, request, audit)
	if rerr != nil {
		return nil, rerr
	}
	return &res, nil
}

func RegistreerMetNieuweAanpak() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Lees raw body éérst zodat audittrail letterlijk de oorspronkelijke
		// payload (incl. eventuele geneste 'full'-shape) bewaart.
		rawBody, err := c.GetRawData()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to read request body: %v", err)})
			return
		}
		// Herstel body voor downstream lezers (LogRequestBodyAsJSON).
		c.Request.Body = io.NopCloser(bytes.NewBuffer(rawBody))
		LogRequestBodyAsJSON(c)

		audit := AuditMeta{
			RawBody:       rawBody,
			RequestPath:   c.Request.URL.Path,
			RequestMethod: c.Request.Method,
			EntiteitID:    c.Param("id"),
			Strengheid:    model.ParseStrengheid(c.Query("validatiestrengheid")),
		}
		result, rerr := RegistreerJSONCore(c.Request.Context(), rawBody, "", audit)
		if rerr != nil {
			// RFC 9457 (NL API Strategie): bij validatiefouten een gestructureerde
			// `application/problem+json`-response met `invalidParams[]`. Voor
			// andere fouten houden we de bestaande `{"error": ...}`-vorm.
			if rerr.Problem != nil {
				c.Header("Content-Type", "application/problem+json")
				c.JSON(rerr.Status, rerr.Problem)
				return
			}
			c.JSON(rerr.Status, gin.H{"error": rerr.Msg})
			return
		}

		// Response identiek aan pre-refactor (incl. registratieId-alias).
		response := gin.H{
			"message":        result.Message,
			"registratie_id": result.RegistratieID,
			"registratieId":  result.RegistratieID,
			"tijdstip":       result.Tijdstip,
			"wijzigingen":    result.Wijzigingen,
		}
		// B.A.2: bij lenient/warnings-only meegeven; in strict-modus komt
		// validatie-output alleen bij hard-fail terug (via error).
		if result.Validatie != nil {
			response["validatie"] = result.Validatie
		}
		c.JSON(result.Status, response)
	}
}
