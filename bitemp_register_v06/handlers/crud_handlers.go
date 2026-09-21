// Package handlers — crud_handlers.go
//
// FASE 2 (REST/CRUD-laag, 2026-04-29):
// Generieke DELETE- en PATCH-handlers per padnaam, gebouwd op de pure
// RegistreerCore-engine uit fase 0.
//
// Ondersteunde scope:
//   - DELETE /{padnaam}/:id voor entiteit-types + niet-PFK GE/relatie-types.
//     PFK-types (composite key) worden afgewezen met 400 — gebruik daar
//     POST /registratie/ voor.
//   - PATCH /full/{padnaam}/:id voor entiteit-types (JSON Merge Patch
//     RFC 7396 op onderliggende GE's/RELs). Body mag mét of zonder
//     ENT-wrapper. Modus via ?modus=registratie|correctie (default registratie).
//     Zie wijziging_builder.go voor de pure builder-logica.
package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// MakeDeleteEntityByMetaHandler bouwt een handler voor DELETE /{padnaam}/:id.
// Vertaalt de DELETE naar een Registratie met één Afvoer-wijziging en delegeert
// naar RegistreerCore zodat audit + transactiegedrag identiek zijn aan POST /registratie/.
func MakeDeleteEntityByMetaHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		audit := AuditMeta{
			RequestPath:   c.Request.URL.Path,
			RequestMethod: c.Request.Method,
			EntiteitID:    entityID,
		}
		result, rerr := VoerEntiteitAfCore(c.Request.Context(), meta, entityID, audit)
		if rerr != nil {
			c.JSON(rerr.Status, gin.H{"error": rerr.Msg})
			return
		}
		// Conform NL API Strategie: 200 OK met body bij succesvolle delete (mutatie),
		// zodat client de registratie-verwijzing terugkrijgt voor audit-trail.
		c.JSON(http.StatusOK, gin.H{
			"message":        result.Message,
			"registratie_id": result.RegistratieID,
			"tijdstip":       result.Tijdstip,
		})
	}
}

// VoerEntiteitAfCore is de transport-onafhankelijke variant van de DELETE-handler.
// Wordt gebruikt door zowel de Gin-route als de GraphQL-mutation `voer<Type>Af`.
//
// Vereist: meta.Metatype = entiteit (of een niet-PFK GE/REL). Voor PFK-types
// (composite key) faalt de aanroep met 400.
func VoerEntiteitAfCore(ctx context.Context, meta model.TypeMeta, entityID string, audit AuditMeta) (*RegistreerResult, *RegistreerError) {
	if meta.DBFactory == nil {
		return nil, &RegistreerError{Status: http.StatusInternalServerError, Msg: "DBFactory ontbreekt voor type " + meta.Typenaam}
	}
	if meta.IDKolom == "" {
		return nil, &RegistreerError{Status: http.StatusInternalServerError, Msg: "IDKolom ontbreekt voor type " + meta.Typenaam}
	}
	if meta.HeeftPFK {
		return nil, &RegistreerError{
			Status: http.StatusBadRequest,
			Msg: fmt.Sprintf(
				"Afvoer per id is niet ondersteund voor types met samengestelde sleutel (%s heeft PFK). Gebruik POST /registratie/ met een expliciete Afvoer-wijziging.",
				meta.Typenaam,
			),
		}
	}
	if entityID == "" {
		return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: "ID must be present"}
	}

	entity := meta.DBFactory()
	if err := DB.NewSelect().Model(entity).Where(meta.IDKolom+" = ?", entityID).Scan(ctx); err != nil {
		// §4.2: onbekend ID (sql.ErrNoRows) is een 404; andere DB-fouten worden
		// server-side gelogd en niet naar de client gelekt (§4.3).
		if isNoRows(err) {
			return nil, &RegistreerError{Status: http.StatusNotFound, Msg: meta.Typenaam + " not found"}
		}
		fmt.Printf("ERROR: afvoer-precheck %s id=%s: %v\n", meta.Typenaam, entityID, err)
		return nil, &RegistreerError{Status: http.StatusInternalServerError, Msg: "databasefout bij ophalen " + meta.Typenaam}
	}
	if isZeroID(entity.GetID()) {
		return nil, &RegistreerError{Status: http.StatusNotFound, Msg: meta.Typenaam + " not found"}
	}

	formeel, ok := entity.(model.FormeleRepresentatie)
	if !ok {
		return nil, &RegistreerError{
			Status: http.StatusBadRequest,
			Msg:    fmt.Sprintf("type %s ondersteunt geen formele afvoer (geen FormeleRepresentatie)", meta.Typenaam),
		}
	}
	if formeel.GetAfvoer() != nil {
		return nil, &RegistreerError{
			Status: http.StatusConflict,
			Msg:    fmt.Sprintf("%s met ID %v is al afgevoerd", meta.Typenaam, entity.GetID()),
		}
	}

	req := model.RegistreerRequest{
		Registratie: model.Registratie{Registratietype: model.RegistratietypeRegistratie},
		Wijzigingen: []model.WijzigingRequest{
			{
				Afvoer: &model.RepresentatiePlusNaam{
					Representatie:     formeel,
					Representatienaam: meta.Typenaam,
					Veldnaam:          meta.Veldnaam,
				},
			},
		},
	}

	if audit.EntiteitID == "" {
		audit.EntiteitID = entityID
	}
	res, rerr := RegistreerCore(ctx, DB, req, audit)
	if rerr != nil {
		return nil, rerr
	}
	return &res, nil
}

// MakePatchFullEntityByMetaHandler bouwt een handler voor PATCH /full/{padnaam}/:id.
//
// Werking:
//  1. Lees rawBody.
//  2. Bouw wijzigingen via BouwWijzigingen (pure functie).
//  3. Verpak in RegistreerRequest, delegeer naar RegistreerCore.
//  4. Response: 200 OK met registratie-info + meldingen[] (niet-fatale waarschuwingen).
//
// Foutcodes: 400 (body, lege patch, verboden ENT-veld), 404 (URL-id bestaat niet),
// 409 (id-mismatch), 500 (DB/engine).
func MakePatchFullEntityByMetaHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		modus := PatchModusRegistratie
		if raw := c.Query("modus"); raw != "" {
			modus = PatchModus(raw)
		}

		rawBody, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("kon body niet lezen: %v", err)})
			return
		}
		// Body terugzetten zodat eventuele middleware-loggers er nog bij kunnen.
		c.Request.Body = io.NopCloser(bytes.NewReader(rawBody))

		audit := AuditMeta{
			RawBody:       rawBody,
			RequestPath:   c.Request.URL.Path,
			RequestMethod: c.Request.Method,
			EntiteitID:    entityID,
		}
		coreRes, meldingen, rerr := WijzigEntiteitCore(c.Request.Context(), meta, entityID, rawBody, modus, audit)
		if rerr != nil {
			c.JSON(rerr.Status, gin.H{"error": rerr.Msg, "meldingen": meldingen})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":        coreRes.Message,
			"registratie_id": coreRes.RegistratieID,
			"tijdstip":       coreRes.Tijdstip,
			"modus":          string(modus),
			"meldingen":      meldingen,
		})
	}
}

// WijzigEntiteitCore is de transport-onafhankelijke variant van de PATCH-handler.
// Wordt gebruikt door zowel de Gin-route als de GraphQL-mutations
// `wijzig<Type>` (modus=registratie) en `corrigeer<Type>` (modus=correctie).
//
// Retourneert ook `meldingen` (niet-fatale waarschuwingen uit BouwWijzigingen)
// zodat de caller die kan teruggeven aan de eindgebruiker.
func WijzigEntiteitCore(ctx context.Context, meta model.TypeMeta, entityID string, rawBody []byte, modus PatchModus, audit AuditMeta) (*RegistreerResult, []string, *RegistreerError) {
	if meta.Metatype != model.MetatypeEntiteit {
		return nil, nil, &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("PATCH /full is alleen ondersteund voor entiteit-types, niet voor %s", meta.Typenaam)}
	}
	if meta.IDKolom == "" || meta.Veldnaam == "" {
		return nil, nil, &RegistreerError{Status: http.StatusInternalServerError, Msg: "IDKolom of Veldnaam ontbreekt voor type " + meta.Typenaam}
	}
	if entityID == "" {
		return nil, nil, &RegistreerError{Status: http.StatusBadRequest, Msg: "ID must be present"}
	}

	// 404-pad: bestaat het record? (Apart, omdat RegistreerCore geen pre-check doet.)
	if meta.DBFactory != nil {
		exists := meta.DBFactory()
		if err := DB.NewSelect().Model(exists).Where(meta.IDKolom+" = ?", entityID).Scan(ctx); err != nil {
			// §4.2/§4.3: zie VoerEntiteitAfCore.
			if isNoRows(err) {
				return nil, nil, &RegistreerError{Status: http.StatusNotFound, Msg: meta.Typenaam + " not found"}
			}
			fmt.Printf("ERROR: patch-precheck %s id=%s: %v\n", meta.Typenaam, entityID, err)
			return nil, nil, &RegistreerError{Status: http.StatusInternalServerError, Msg: "databasefout bij ophalen " + meta.Typenaam}
		}
		if isZeroID(exists.GetID()) {
			return nil, nil, &RegistreerError{Status: http.StatusNotFound, Msg: meta.Typenaam + " not found"}
		}
	}

	res, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  meta,
		URLID: entityID,
		Body:  rawBody,
		Modus: modus,
	})
	if rerr != nil {
		return nil, nil, rerr
	}

	regType := model.RegistratietypeRegistratie
	if modus == PatchModusCorrectie {
		regType = model.RegistratietypeCorrectie
	}
	req := model.RegistreerRequest{
		Registratie: model.Registratie{Registratietype: regType},
		Wijzigingen: res.Wijzigingen,
	}
	if audit.EntiteitID == "" {
		audit.EntiteitID = entityID
	}
	coreRes, coreErr := RegistreerCore(ctx, DB, req, audit)
	if coreErr != nil {
		return nil, res.Meldingen, coreErr
	}
	return &coreRes, res.Meldingen, nil
}
