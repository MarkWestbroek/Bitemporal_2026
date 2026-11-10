package handlers

// De actuele stand van één profiel van een Studio-project (besluit Mark 10-11, voor de
// werkplaats van Imprint, laag 2).
//
//   GET /api/studio/projecten/:id/model/:profiel   (lezen op het project; ook op een branch)
//
// De server speelt geen ops af. Hij leest in één transactie (REPEATABLE READ) het profiel uit de
// blob (inhoud.profielen[profiel]), de ops op store "model:<profiel>" na tot_volgnummer en het
// laatste volgnummer, en laat de render-sidecar naspelen (POST /materialiseer, render 0.4.2).
// Ops op andere stores (structuur, kruis) raken het profiel niet. Zo hoeft een afnemer de
// semantiek van de Studio-stores niet na te bouwen, en past laatsteVolgnummer precies bij de
// stand: schrijf daarna met verwachtLaatsteVolgnummer.
//
// Antwoord: de velden van het nagespeelde profiel (elements, diagrams, …) plus {projectId,
// profielId, totVolgnummer, laatsteVolgnummer, nagespeeld, meldingen, renderVersie}.
// Fouten: 404 (project, of reden "geen_profiel"), 413 boven vergelijkMaxBytes, 422 van de
// sidecar ongewijzigd, 502 met reden "sidecar" (onbereikbaar of te oud).

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// profielIDPatroon: profiel-id's zoals de Studio ze kent (formulierdiagram, diagram05, …).
var profielIDPatroon = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,120}$`)

// MaakStudioProjectModelHandler — GET /api/studio/projecten/:id/model/:profiel
func MaakStudioProjectModelHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, profielID := c.Param("id"), c.Param("profiel")
		if !studioProjectIDPatroon.MatchString(id) || !profielIDPatroon.MatchString(profielID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project- of profiel-id."})
			return
		}
		ctx := c.Request.Context()
		tx, err := DB.BeginTx(ctx, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transactie starten mislukt: " + err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck
		// pgdriver kent geen TxOptions.Isolation; daarom als eerste statement. Eén momentopname
		// voor blob, ops en laatste volgnummer, ook als er intussen gecompacteerd wordt.
		if _, err := tx.ExecContext(ctx, "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transactie instellen mislukt: " + err.Error()})
			return
		}

		var rij struct {
			TotVolgnummer int64   `bun:"tot_volgnummer"`
			Deel          *string `bun:"deel"`
		}
		err = tx.NewSelect().Table("studio_projecten").Column("tot_volgnummer").
			ColumnExpr("(inhoud->'profielen'->?)::text AS deel", profielID).
			Where("id = ?", id).Scan(ctx, &rij)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		var ops []model.StudioProjectOp
		if err := tx.NewSelect().Model(&ops).
			Where("project_id = ? AND volgnummer > ? AND store = ?", id, rij.TotVolgnummer, "model:"+profielID).
			OrderExpr("volgnummer ASC").Scan(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Operatielog lezen mislukt: " + err.Error()})
			return
		}
		laatste := laatsteVolgnummerVan(ctx, tx, id)
		_ = tx.Rollback()

		if rij.Deel == nil && len(ops) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"reden": "geen_profiel",
				"error": fmt.Sprintf("Het project heeft geen profiel %q.", profielID)})
			return
		}
		deel := json.RawMessage("null")
		if rij.Deel != nil {
			deel = json.RawMessage(*rij.Deel)
		}
		opsUit := make([]StudioOpUit, 0, len(ops))
		for _, o := range ops {
			opsUit = append(opsUit, studioOpUit(o))
		}
		verzoek, err := json.Marshal(gin.H{"profielId": profielID, "profiel": deel, "ops": opsUit})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Verzoek samenstellen mislukt: " + err.Error()})
			return
		}
		if len(verzoek) > vergelijkMaxBytes {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"reden": "te_groot",
				"error": fmt.Sprintf("Profiel en ops zijn samen %d bytes; de sidecar neemt hooguit %d aan.", len(verzoek), vergelijkMaxBytes)})
			return
		}
		resp, err := vergelijkClient.Post(renderSvcURL()+"/materialiseer", "application/json", bytes.NewReader(verzoek))
		if err != nil {
			fmt.Printf("ERROR: render-svc onbereikbaar (%s): %v\n", renderSvcURL(), err)
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "De render-sidecar is onbereikbaar."})
			return
		}
		defer resp.Body.Close()
		uit, err := io.ReadAll(io.LimitReader(resp.Body, 50<<20))
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "Antwoord van de sidecar lezen mislukt: " + err.Error()})
			return
		}
		switch resp.StatusCode {
		case http.StatusOK:
		case http.StatusNotFound:
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "De render-sidecar kent /materialiseer niet (te oud; vanaf render 0.4.2)."})
			return
		case http.StatusUnprocessableEntity:
			c.Data(http.StatusUnprocessableEntity, "application/json; charset=utf-8", uit)
			return
		default:
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar",
				"error": fmt.Sprintf("render-svc /materialiseer gaf %d: %s", resp.StatusCode, strings.TrimSpace(string(uit)))})
			return
		}
		var antw struct {
			Profiel      map[string]json.RawMessage `json:"profiel"`
			Nagespeeld   int                        `json:"nagespeeld"`
			Meldingen    json.RawMessage            `json:"meldingen"`
			RenderVersie string                     `json:"renderVersie"`
		}
		if err := json.Unmarshal(uit, &antw); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "Het antwoord van de sidecar is geen geldig profiel."})
			return
		}
		out := map[string]any{}
		for k, v := range antw.Profiel {
			out[k] = v
		}
		meldingen := antw.Meldingen
		if len(meldingen) == 0 || string(meldingen) == "null" {
			meldingen = json.RawMessage("[]")
		}
		out["projectId"], out["profielId"] = id, profielID
		out["totVolgnummer"], out["laatsteVolgnummer"] = rij.TotVolgnummer, laatste
		out["nagespeeld"], out["meldingen"], out["renderVersie"] = antw.Nagespeeld, meldingen, antw.RenderVersie
		c.JSON(http.StatusOK, out)
	}
}
