package handlers

// Verschil van een afgeleid project ("branch") met zijn ouder (werkplaats-plan §4B; besluit
// Mark 10-11: de dunne doorgeefroute komt al vóór de merge van stap 3).
//
//   GET /api/studio/projecten/:id/vergelijk   (lezen op de branch én op de ouder)
//
// De server speelt geen ops af. Hij stelt de drie standen rauw samen, elk als {profiel, ops}
// in de vorm die de render-sidecar ook voor /export/v3 kent:
//   - basis = studio_project_basis (blob van de ouder bij het afsplitsen + staart-ops);
//   - tak   = blob van de branch + zijn ops na tot_volgnummer;
//   - main  = blob van de ouder  + zijn ops na tot_volgnummer;
// en POST die met de mapId uit de herkomst naar de sidecar (POST /vergelijk, render-svc). Het
// antwoord {verschillen, telling, scope, meldingen, renderVersie} gaat ongewijzigd door,
// aangevuld met {main: {laatsteVolgnummer}, tak: {laatsteVolgnummer}}. Zo stuurt de browser
// nooit drie werkbestanden heen en weer.
//
// Fouten: 404 bij een gewoon project (geen basis) of een verdwenen ouder (reden "ouder_weg"),
// 403 zonder leesrecht op de ouder, 413 als het verzoek groter is dan vergelijkMaxBytes, 502
// met reden "sidecar" als de sidecar onbereikbaar of te oud is.

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// vergelijkMaxBytes volgt RENDER_SVC_MAX_BYTES_VERGELIJK van de sidecar (standaard 32 MB).
const vergelijkMaxBytes = 32 << 20

// vergelijkClient: drie werkbestanden naspelen en vergelijken duurt langer dan een SVG.
var vergelijkClient = &http.Client{Timeout: 90 * time.Second}

// vergelijkKant is één kant van de vergelijking.
type vergelijkKant struct {
	Profiel json.RawMessage `json:"profiel"`
	Ops     json.RawMessage `json:"ops"`
}

// standVanProject leest blob + alle ops na tot_volgnummer; ook het laatste volgnummer.
func standVanProject(ctx context.Context, db bun.IDB, p *model.StudioProject) (vergelijkKant, int64, error) {
	var ops []model.StudioProjectOp
	if err := db.NewSelect().Model(&ops).Where("project_id = ? AND volgnummer > ?", p.ID, p.TotVolgnummer).
		OrderExpr("volgnummer ASC").Scan(ctx); err != nil {
		return vergelijkKant{}, 0, err
	}
	uit := make([]StudioOpUit, 0, len(ops))
	laatste := p.TotVolgnummer
	for _, o := range ops {
		uit = append(uit, studioOpUit(o))
		if o.Volgnummer > laatste {
			laatste = o.Volgnummer
		}
	}
	b, err := json.Marshal(uit)
	if err != nil {
		return vergelijkKant{}, 0, err
	}
	return vergelijkKant{Profiel: p.Inhoud, Ops: b}, laatste, nil
}

// MaakStudioProjectVergelijkHandler — GET /api/studio/projecten/:id/vergelijk
func MaakStudioProjectVergelijkHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		ctx := c.Request.Context()
		tak, err := leesStudioProject(ctx, DB, id)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		basis := new(model.StudioProjectBasis)
		err = DB.NewSelect().Model(basis).Where("project_id = ?", id).Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) || tak.OuderProjectID == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Dit project is geen afgeleid project; er is niets om mee te vergelijken.", "reden": "geen_branch"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Basis lezen mislukt: " + err.Error()})
			return
		}
		ouder, err := leesStudioProject(ctx, DB, tak.OuderProjectID)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Het ouderproject bestaat niet meer.", "reden": "ouder_weg"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ouderproject lezen mislukt: " + err.Error()})
			return
		}
		// Leesrecht op de branch regelt de middleware; op de ouder controleren we hier.
		if recht, err := projectRechtVan(c, ouder.ID, ouder.Eigenaar); err != nil || recht < RechtLezen {
			c.JSON(http.StatusForbidden, gin.H{"error": "Je hebt geen leesrecht op het ouderproject."})
			return
		}

		takStand, takLaatste, err := standVanProject(ctx, DB, tak)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Operaties van de branch lezen mislukt: " + err.Error()})
			return
		}
		mainStand, mainLaatste, err := standVanProject(ctx, DB, ouder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Operaties van de ouder lezen mislukt: " + err.Error()})
			return
		}
		verzoek, err := json.Marshal(map[string]any{
			"basis": vergelijkKant{Profiel: basis.Inhoud, Ops: basis.Ops},
			"tak":   takStand,
			"main":  mainStand,
			"mapId": tak.MapID,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Verzoek samenstellen mislukt: " + err.Error()})
			return
		}
		if len(verzoek) > vergelijkMaxBytes {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"reden": "te_groot",
				"error": fmt.Sprintf("Basis, branch en ouder samen zijn %d bytes; de sidecar neemt hooguit %d aan.", len(verzoek), vergelijkMaxBytes)})
			return
		}

		resp, err := vergelijkClient.Post(renderSvcURL()+"/vergelijk", "application/json", strings.NewReader(string(verzoek)))
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
		switch {
		case resp.StatusCode == http.StatusOK:
		case resp.StatusCode == http.StatusNotFound:
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "De render-sidecar kent /vergelijk niet (te oud)."})
			return
		case resp.StatusCode == http.StatusUnprocessableEntity:
			c.Data(http.StatusUnprocessableEntity, "application/json; charset=utf-8", uit)
			return
		default:
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar",
				"error": fmt.Sprintf("render-svc /vergelijk gaf %d: %s", resp.StatusCode, strings.TrimSpace(string(uit)))})
			return
		}
		var antw map[string]json.RawMessage
		if err := json.Unmarshal(uit, &antw); err != nil || antw == nil {
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "Het antwoord van de sidecar is geen JSON-object."})
			return
		}
		antw["main"], _ = json.Marshal(gin.H{"projectId": ouder.ID, "laatsteVolgnummer": mainLaatste})
		antw["tak"], _ = json.Marshal(gin.H{"projectId": tak.ID, "laatsteVolgnummer": takLaatste})
		c.JSON(http.StatusOK, antw)
	}
}
