package handlers

// Werkruimte per gebruiker per project (plan 2026-10-07 Projectsync, werkruimte-laag).
//
//   GET /api/studio/projecten/:id/werkruimte   → {inhoud, bijgewerkt} of 404 (nog geen)
//   PUT /api/studio/projecten/:id/werkruimte   {inhoud, bijgewerkt?} → upsert, laatste schrijver wint
//
// De werkruimte is van de ingelogde gebruiker (zonder auth: leeg = gedeeld per
// project). Hij hoort niet bij het project (geen operaties, geen versiecontrole):
// tabs, actieve tab en open/dicht mappen, zodat je op een andere computer
// verdergaat waar je was.

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

const studioWerkruimteMax = 1 << 20 // 1 MB; tabs en mapstanden zijn klein

type studioWerkruimteInvoer struct {
	Inhoud     json.RawMessage `json:"inhoud"`
	Bijgewerkt *time.Time      `json:"bijgewerkt"` // tijdstip van de client (LWW); ontbreekt → nu
}

// MaakStudioWerkruimteOphalenHandler — GET /api/studio/projecten/:id/werkruimte
func MaakStudioWerkruimteOphalenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		w := new(model.StudioWerkruimte)
		err := DB.NewSelect().Model(w).Where("project_id = ? AND gebruiker = ?", id, studioActor(c)).Scan(c.Request.Context())
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Nog geen werkruimte voor dit project."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Werkruimte lezen mislukt: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"inhoud": w.Inhoud, "bijgewerkt": w.Bijgewerkt})
	}
}

// MaakStudioWerkruimteOpslaanHandler — PUT /api/studio/projecten/:id/werkruimte
// Laatste schrijver wint; een oudere `bijgewerkt` dan wat er staat wordt genegeerd (200, stand van de server).
func MaakStudioWerkruimteOpslaanHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, studioWerkruimteMax)
		var in studioWerkruimteInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON of te groot (max 1 MB): " + err.Error()})
			return
		}
		var kop map[string]json.RawMessage
		if len(in.Inhoud) == 0 || json.Unmarshal(in.Inhoud, &kop) != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Veld 'inhoud' moet een JSON-object zijn."})
			return
		}
		ctx := c.Request.Context()
		bestaat, err := DB.NewSelect().Model((*model.StudioProject)(nil)).Where("id = ?", id).Exists(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		if !bestaat {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden op de server."})
			return
		}
		// Het tijdstip van de client telt (laatste schrijver wint tussen zijn eigen
		// apparaten); alleen zonder tijdstip neemt de server het moment van ontvangst.
		tijd := time.Now()
		if in.Bijgewerkt != nil && !in.Bijgewerkt.IsZero() {
			tijd = *in.Bijgewerkt
		}
		w := &model.StudioWerkruimte{ProjectID: id, Gebruiker: studioActor(c), Inhoud: in.Inhoud, Bijgewerkt: tijd}
		_, err = DB.NewInsert().Model(w).
			On("CONFLICT (project_id, gebruiker) DO UPDATE").
			Set("inhoud = EXCLUDED.inhoud, bijgewerkt = EXCLUDED.bijgewerkt").
			Where("studio_werkruimte.bijgewerkt <= EXCLUDED.bijgewerkt").
			Exec(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Werkruimte opslaan mislukt: " + err.Error()})
			return
		}
		huidig := new(model.StudioWerkruimte)
		_ = DB.NewSelect().Model(huidig).Where("project_id = ? AND gebruiker = ?", id, w.Gebruiker).Scan(ctx)
		c.JSON(http.StatusOK, gin.H{"bijgewerkt": huidig.Bijgewerkt, "overgenomen": huidig.Bijgewerkt.Equal(tijd)})
	}
}
