// Package handlers — opvoer_handlers.go
//
// POST /{padnaam} en POST /full/{padnaam} via de registratie-engine
// (BE-review 2026-07-07, §3.5: audit-trail-bypass dichten).
//
// Voorheen deden MakeAddEntityByMetaHandler en MakeAddFullEntityByMetaHandler
// een directe INSERT zonder Registratie, Wijziging of opvoer-tijdstip. Zulke
// records ontstonden buiten de bitemporele boekhouding en waren onzichtbaar
// voor tijdreizen en ongedaanmaking. Deze handler verpakt de POST-body als
// reguliere opvoer en delegeert naar RegistreerJSONCore, zodat normalisatie,
// validatie, audit-trail en transactiegedrag identiek zijn aan
// POST /registratie/.
//
// Invariant die dit bewaakt: élke mutatie op modeltabellen loopt door
// RegistreerCore.
//
// De payload-shape voor de client verandert niet: een kaal entity-object
// (POST /{padnaam}) of een geneste full-shape (POST /full/{padnaam}) — de
// normalizer (registration_normalizer.go) splitst geneste GE's/relaties
// automatisch in aparte wijzigingen.
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

// maakRegistreerBodyVoorOpvoer verpakt een kale entity/GE-payload als
// RegistreerRequest-JSON:
//
//	{"registratie":{"registratietype":"registratie"},
//	 "wijzigingen":[{"opvoer":{"<veldnaam>": <body>}}]}
//
// De veldnaam-sleutel stuurt de type-resolutie in
// RepresentatiePlusNaam.UnmarshalJSON (model/REST request models.go).
func maakRegistreerBodyVoorOpvoer(meta model.TypeMeta, rawBody []byte) ([]byte, error) {
	if meta.Veldnaam == "" {
		return nil, fmt.Errorf("Veldnaam ontbreekt in metaregistry voor type %s", meta.Typenaam)
	}
	trimmed := bytes.TrimSpace(rawBody)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		return nil, fmt.Errorf("request body moet een JSON-object zijn")
	}

	wrapper := map[string]any{
		"registratie": map[string]any{
			"registratietype": string(model.RegistratietypeRegistratie),
		},
		"wijzigingen": []any{
			map[string]any{
				"opvoer": map[string]json.RawMessage{meta.Veldnaam: trimmed},
			},
		},
	}
	return json.Marshal(wrapper)
}

// MakeAddEntityViaEngineHandler bouwt de POST-handler voor /{padnaam} en
// /full/{padnaam}. Vervangt de directe-insert handlers; response bevat naast
// de vertrouwde "message" ook de registratie-verwijzing voor de audit-trail.
func MakeAddEntityViaEngineHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		rawBody, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("kon body niet lezen: %v", err)})
			return
		}
		// Body terugzetten voor downstream lezers (RequestBodyLogger).
		c.Request.Body = io.NopCloser(bytes.NewReader(rawBody))
		LogRequestBodyAsJSON(c)

		registreerBody, err := maakRegistreerBodyVoorOpvoer(meta, rawBody)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		audit := AuditMeta{
			// Audit bewaart de oorspronkelijke client-payload, niet de wrapper.
			RawBody:       rawBody,
			RequestPath:   c.Request.URL.Path,
			RequestMethod: c.Request.Method,
			Strengheid:    model.ParseStrengheid(c.Query("validatiestrengheid")),
		}
		result, rerr := RegistreerJSONCore(c.Request.Context(), registreerBody, "", audit)
		if rerr != nil {
			// RFC 9457: validatiefouten als application/problem+json (zoals POST /registratie/).
			if rerr.Problem != nil {
				c.Header("Content-Type", "application/problem+json")
				c.JSON(rerr.Status, rerr.Problem)
				return
			}
			c.JSON(rerr.Status, gin.H{"error": rerr.Msg})
			return
		}

		response := gin.H{
			"message":        meta.Typenaam + " created",
			"registratie_id": result.RegistratieID,
			"tijdstip":       result.Tijdstip,
		}
		if result.Validatie != nil {
			response["validatie"] = result.Validatie
		}
		c.JSON(http.StatusCreated, response)
	}
}
