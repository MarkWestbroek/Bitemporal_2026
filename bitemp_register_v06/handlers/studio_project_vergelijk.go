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
//
// De drie standen en de aanroep van de sidecar (`leesDrieStanden`, `vraagSidecar`) deelt deze
// route met POST …/samenvoegen (studio_project_samenvoegen.go).

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

// drieStanden: een branch, zijn ouder, en het verzoek voor de sidecar met de drie standen.
type drieStanden struct {
	tak, ouder              *model.StudioProject
	takLaatste, mainLaatste int64
	verzoek                 []byte
}

// leesDrieStanden leest branch, basis en ouder en stelt het sidecar-verzoek samen. Bij een fout
// staat het antwoord al in c en is ok false. `ouderRecht` is het recht dat nodig is op de ouder
// (lezen voor vergelijken, schrijven voor samenvoegen).
func leesDrieStanden(c *gin.Context, id string, ouderRecht ProjectRecht) (*drieStanden, bool) {
	ctx := c.Request.Context()
	tak, err := leesStudioProject(ctx, DB, id)
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
		return nil, false
	}
	basis := new(model.StudioProjectBasis)
	err = DB.NewSelect().Model(basis).Where("project_id = ?", id).Scan(ctx)
	if errors.Is(err, sql.ErrNoRows) || tak.OuderProjectID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dit project is geen afgeleid project; er is niets om mee te vergelijken.", "reden": "geen_branch"})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Basis lezen mislukt: " + err.Error()})
		return nil, false
	}
	ouder, err := leesStudioProject(ctx, DB, tak.OuderProjectID)
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Het ouderproject bestaat niet meer.", "reden": "ouder_weg"})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ouderproject lezen mislukt: " + err.Error()})
		return nil, false
	}
	// Het recht op de branch regelt de middleware; op de ouder controleren we hier.
	if recht, err := projectRechtVan(c, ouder.ID, ouder.Eigenaar); err != nil || recht < ouderRecht {
		woord := "leesrecht"
		if ouderRecht >= RechtSchrijven {
			woord = "schrijfrecht"
		}
		c.JSON(http.StatusForbidden, gin.H{"error": "Je hebt geen " + woord + " op het ouderproject."})
		return nil, false
	}

	takStand, takLaatste, err := standVanProject(ctx, DB, tak)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Operaties van de branch lezen mislukt: " + err.Error()})
		return nil, false
	}
	mainStand, mainLaatste, err := standVanProject(ctx, DB, ouder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Operaties van de ouder lezen mislukt: " + err.Error()})
		return nil, false
	}
	verzoek, err := json.Marshal(map[string]any{
		"basis": vergelijkKant{Profiel: basis.Inhoud, Ops: basis.Ops},
		"tak":   takStand,
		"main":  mainStand,
		"mapId": tak.MapID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Verzoek samenstellen mislukt: " + err.Error()})
		return nil, false
	}
	if len(verzoek) > vergelijkMaxBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"reden": "te_groot",
			"error": fmt.Sprintf("Basis, branch en ouder samen zijn %d bytes; de sidecar neemt hooguit %d aan.", len(verzoek), vergelijkMaxBytes)})
		return nil, false
	}
	return &drieStanden{tak: tak, ouder: ouder, takLaatste: takLaatste, mainLaatste: mainLaatste, verzoek: verzoek}, true
}

// vraagSidecar POST het verzoek naar de sidecar (pad "/vergelijk" of "/samenvoegen") en geeft
// het JSON-object terug. Bij een fout staat het antwoord al in c en is ok false.
func vraagSidecar(c *gin.Context, pad string, verzoek []byte) (map[string]json.RawMessage, bool) {
	resp, err := vergelijkClient.Post(renderSvcURL()+pad, "application/json", strings.NewReader(string(verzoek)))
	if err != nil {
		fmt.Printf("ERROR: render-svc onbereikbaar (%s): %v\n", renderSvcURL(), err)
		c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "De render-sidecar is onbereikbaar."})
		return nil, false
	}
	defer resp.Body.Close()
	// Ruim: /samenvoegen geeft naast de ops ook het samengevoegde werkbestand terug.
	uit, err := io.ReadAll(io.LimitReader(resp.Body, 100<<20))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "Antwoord van de sidecar lezen mislukt: " + err.Error()})
		return nil, false
	}
	switch {
	case resp.StatusCode == http.StatusOK:
	case resp.StatusCode == http.StatusNotFound:
		c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "De render-sidecar kent " + pad + " niet (te oud)."})
		return nil, false
	case resp.StatusCode == http.StatusUnprocessableEntity:
		c.Data(http.StatusUnprocessableEntity, "application/json; charset=utf-8", uit)
		return nil, false
	default:
		c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar",
			"error": fmt.Sprintf("render-svc %s gaf %d: %s", pad, resp.StatusCode, strings.TrimSpace(string(uit)))})
		return nil, false
	}
	var antw map[string]json.RawMessage
	if err := json.Unmarshal(uit, &antw); err != nil || antw == nil {
		c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "Het antwoord van de sidecar is geen JSON-object."})
		return nil, false
	}
	return antw, true
}

// MaakStudioProjectVergelijkHandler — GET /api/studio/projecten/:id/vergelijk
func MaakStudioProjectVergelijkHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		d, ok := leesDrieStanden(c, id, RechtLezen)
		if !ok {
			return
		}
		antw, ok := vraagSidecar(c, "/vergelijk", d.verzoek)
		if !ok {
			return
		}
		antw["main"], _ = json.Marshal(gin.H{"projectId": d.ouder.ID, "laatsteVolgnummer": d.mainLaatste})
		antw["tak"], _ = json.Marshal(gin.H{"projectId": d.tak.ID, "laatsteVolgnummer": d.takLaatste})
		c.JSON(http.StatusOK, antw)
	}
}
