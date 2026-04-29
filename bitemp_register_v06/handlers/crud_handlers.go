// Package handlers — crud_handlers.go
//
// FASE 2 (REST/CRUD-laag, 2026-04-29):
// Generieke DELETE-handler per padnaam, gebouwd op de pure RegistreerCore-engine
// uit fase 0. PATCH (JSON Merge Patch RFC 7396) en de bijbehorende diff-engine
// volgen in een vervolg-iteratie (zie docs/BACKLOG.md en /memories/session/plan.md).
//
// Ondersteunde scope (deze iteratie):
//   - DELETE /{padnaam}/:id voor:
//     * entiteit-types (cascade-afvoer via bestaande engine-logica)
//     * niet-PFK GE/relatie-types (single-column PK)
//   - PFK-types (composite key zoals _Data records met (ent_id, rel_id, versie))
//     worden bewust afgewezen met 400 + uitleg, omdat de URL-shape `:id`
//     onvoldoende informatie biedt. Gebruik daar `POST /registratie/` voor.
package handlers

import (
	"fmt"
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// MakeDeleteEntityByMetaHandler bouwt een handler voor DELETE /{padnaam}/:id.
// Vertaalt de DELETE naar een Registratie met één Afvoer-wijziging en delegeert
// naar RegistreerCore zodat audit + transactiegedrag identiek zijn aan POST /registratie/.
func MakeDeleteEntityByMetaHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		if meta.DBFactory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "DBFactory ontbreekt voor type " + meta.Typenaam})
			return
		}
		if meta.IDKolom == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "IDKolom ontbreekt voor type " + meta.Typenaam})
			return
		}
		// PFK-types vergen composite key — niet expressie-eerbaar via één URL-id.
		if meta.HeeftPFK {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf(
					"DELETE /%s/:id is niet ondersteund voor types met samengestelde sleutel (%s heeft PFK). Gebruik POST /registratie/ met een expliciete Afvoer-wijziging.",
					meta.Padnaam, meta.Typenaam,
				),
			})
			return
		}

		entityID := c.Param("id")
		if entityID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID must be present"})
			return
		}

		// Laad bestaand record uit DB; daarmee zit de ID (en eventuele PFK-velden) op
		// het juiste type voor de afvoer-helper. Levert ook 404 als het niet bestaat.
		entity := meta.DBFactory()
		err := DB.NewSelect().
			Model(entity).
			Where(meta.IDKolom+" = ?", entityID).
			Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if isZeroID(entity.GetID()) {
			c.JSON(http.StatusNotFound, gin.H{"message": meta.Typenaam + " not found"})
			return
		}

		// Cast naar FormeleRepresentatie (vereist voor afvoer-engine).
		formeel, ok := entity.(model.FormeleRepresentatie)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("type %s ondersteunt geen formele afvoer (geen FormeleRepresentatie)", meta.Typenaam),
			})
			return
		}
		if formeel.GetAfvoer() != nil {
			c.JSON(http.StatusConflict, gin.H{
				"error": fmt.Sprintf("%s met ID %v is al afgevoerd", meta.Typenaam, entity.GetID()),
			})
			return
		}

		// Bouw RegistreerRequest: één wijziging met Afvoer.
		req := model.RegistreerRequest{
			Registratie: model.Registratie{
				Registratietype: model.RegistratietypeRegistratie,
			},
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

		audit := AuditMeta{
			RequestPath:   c.Request.URL.Path,
			RequestMethod: c.Request.Method,
			EntiteitID:    entityID,
			// Geen RawBody — DELETE heeft geen body; de gegenereerde
			// RegistreerRequest dient als reconstrueerbaar audit-anker.
		}

		result, rerr := RegistreerCore(c.Request.Context(), DB, req, audit)
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
