package handlers

// Afgeleide projecten ("branches"), werkplaats-plan §4B, stap 1 (besluit Mark 09-11).
//
// Een branch is een eigen Studio-project dat van een ouder is afgesplitst. Al het bestaande
// werkt daardoor ongewijzigd: operatielog, SSE, compactie, toegang, export/v3, render en
// rebuild-uit-project kennen alleen een project-id. Gekozen boven een tak-kolom op
// studio_project_ops, die al die onderdelen een tak zou moeten leren.
//
//   POST /api/studio/projecten/:id/afsplitsen  {naam, mapId?, id?}  → 201 meta van de branch
//   GET  /api/studio/projecten/:id/basis                            → de basis (alleen voor een branch)
//
// Afsplitsen gebeurt in één transactie met FOR UPDATE op de ouder; POST /ops en PUT nemen
// hetzelfde slot, dus de branch ziet een consistente stand:
//   - inhoud en tot_volgnummer = die van de ouder;
//   - de staart-operaties (na tot_volgnummer) worden gekopieerd met dezelfde volgnummers,
//     zodat basisVolgnummer in ouder en branch hetzelfde betekent;
//   - herkomst {ouder_project_id, basis_volgnummer, map_id} op de branch;
//   - de basis rauw in studio_project_basis (blob + staart), want de compactie gooit
//     operaties weg en een 3-weg-merge heeft de basis nodig;
//   - toegang: de rijen van de ouder; de eigenaar van de ouder krijgt schrijven; wie
//     afsplitst wordt eigenaar.
//
// De server kent geen mappen (hij kijkt niet in de blob). mapId is alleen herkomst: de
// Studio beperkt er de weergave en de merge mee. De branch bevat dus het hele project, zodat
// relaties en diagrammen over mappen heen intact blijven.
//
// Rechten (main.go): lezen op de ouder plus de rol modelleur. Mergen (stap 3: /vergelijk,
// /samenvoegen) vraagt later schrijven op de ouder; tot dan zet de Studio het resultaat als
// gewone ops op de ouder met verwachtLaatsteVolgnummer (studio_project_ops_handler.go).

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// mapIDPatroon: element- en map-id's uit de Studio (uuid of vergelijkbaar).
var mapIDPatroon = regexp.MustCompile(`^[A-Za-z0-9:._-]{1,200}$`)

type afsplitsenInvoer struct {
	ID    string `json:"id"`    // optioneel; anders kiest de server
	Naam  string `json:"naam"`  // verplicht
	MapID string `json:"mapId"` // optioneel: de projectmap waarop de branch werkt
}

// valideerAfsplitsen controleert het verzoek; "" = goed. Zuiver (testbaar).
func valideerAfsplitsen(in *afsplitsenInvoer, ouderID string) string {
	naam := strings.TrimSpace(in.Naam)
	if naam == "" {
		return "Veld 'naam' is verplicht."
	}
	if len(naam) > studioProjectNaamMax {
		return "Veld 'naam' is te lang (max 200 tekens)."
	}
	if id := strings.TrimSpace(in.ID); id != "" {
		if !studioProjectIDPatroon.MatchString(id) {
			return "Ongeldig project-id (8–64 tekens, letters/cijfers/-/_)."
		}
		if id == ouderID {
			return "Het nieuwe project kan niet hetzelfde id hebben als de ouder."
		}
	}
	if m := strings.TrimSpace(in.MapID); m != "" && !mapIDPatroon.MatchString(m) {
		return "Ongeldig 'mapId'."
	}
	return ""
}

// MaakStudioProjectAfsplitsenHandler — POST /api/studio/projecten/:id/afsplitsen
func MaakStudioProjectAfsplitsenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ouderID := c.Param("id")
		if !studioProjectIDPatroon.MatchString(ouderID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		var in afsplitsenInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON: " + err.Error()})
			return
		}
		if msg := valideerAfsplitsen(&in, ouderID); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		nieuwID := strings.TrimSpace(in.ID)
		if nieuwID == "" {
			nieuwID = nieuwStudioProjectID()
		}
		ctx := c.Request.Context()
		tx, err := DB.BeginTx(ctx, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transactie starten mislukt: " + err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck

		// Ouder vergrendelen: geen ops, PUT of compactie tussendoor.
		ouder := new(model.StudioProject)
		err = tx.NewSelect().Model(ouder).Where("id = ?", ouderID).For("UPDATE").Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		var staart []model.StudioProjectOp
		if err := tx.NewSelect().Model(&staart).
			Where("project_id = ? AND volgnummer > ?", ouderID, ouder.TotVolgnummer).
			OrderExpr("volgnummer ASC").Scan(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Operatielog lezen mislukt: " + err.Error()})
			return
		}
		basisVolgnummer := ouder.TotVolgnummer
		if n := len(staart); n > 0 && staart[n-1].Volgnummer > basisVolgnummer {
			basisVolgnummer = staart[n-1].Volgnummer
		}

		nu := time.Now()
		actor := studioActor(c)
		branch := &model.StudioProject{
			ID: nieuwID, Naam: strings.TrimSpace(in.Naam), Eigenaar: actor, Versie: 1,
			Inhoud: ouder.Inhoud, Aangemaakt: nu, Bijgewerkt: nu, BijgewerktDoor: actor,
			TotVolgnummer:  ouder.TotVolgnummer,
			OuderProjectID: ouderID, BasisVolgnummer: basisVolgnummer, MapID: strings.TrimSpace(in.MapID),
		}
		if _, err := tx.NewInsert().Model(branch).Exec(ctx); err != nil {
			if strings.Contains(err.Error(), "duplicate key") {
				c.JSON(http.StatusConflict, gin.H{"error": "Er bestaat al een project met dit id op de server."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project aanmaken mislukt: " + err.Error()})
			return
		}

		// Staart kopiëren met dezelfde volgnummers; actor, client en tijd blijven die van het origineel.
		staartUit := make([]StudioOpUit, 0, len(staart))
		if len(staart) > 0 {
			kopie := make([]model.StudioProjectOp, len(staart))
			for i, o := range staart {
				staartUit = append(staartUit, studioOpUit(o))
				o.ProjectID = nieuwID
				kopie[i] = o
			}
			if _, err := tx.NewInsert().Model(&kopie).Exec(ctx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Operaties kopiëren mislukt: " + err.Error()})
				return
			}
		}

		opsJSON, err := json.Marshal(staartUit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Basis samenstellen mislukt: " + err.Error()})
			return
		}
		basis := &model.StudioProjectBasis{
			ProjectID: nieuwID, OuderProjectID: ouderID, BasisVolgnummer: basisVolgnummer,
			TotVolgnummer: ouder.TotVolgnummer, Inhoud: ouder.Inhoud, Ops: opsJSON,
			Aangemaakt: nu, AangemaaktDoor: actor,
		}
		if _, err := tx.NewInsert().Model(basis).Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Basis opslaan mislukt: " + err.Error()})
			return
		}

		// Toegang: de rijen van de ouder, plus schrijven voor de eigenaar van de ouder.
		var rijen []model.StudioProjectToegang
		if err := tx.NewSelect().Model(&rijen).Where("project_id = ?", ouderID).Scan(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Toegang lezen mislukt: " + err.Error()})
			return
		}
		door := "afsplitsen van " + ouderID
		for _, r := range rijen {
			recht, ok := ParseProjectRecht(r.Recht)
			if !ok || (actor != "" && r.Subject == actor) {
				continue
			}
			if err := ZetProjectToegang(ctx, tx, nieuwID, r.Subject, recht, door); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Toegang kopiëren mislukt: " + err.Error()})
				return
			}
		}
		if ouder.Eigenaar != "" && ouder.Eigenaar != actor {
			if err := ZetProjectToegang(ctx, tx, nieuwID, ouder.Eigenaar, RechtSchrijven, door); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Toegang eigenaar ouder mislukt: " + err.Error()})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit mislukt: " + err.Error()})
			return
		}
		meta := studioProjectMeta(branch)
		meta.LaatsteVolgnummer = basisVolgnummer
		meta.Recht = RechtBeheren.String() // wie afsplitst is eigenaar
		c.JSON(http.StatusCreated, meta)
	}
}

// MaakStudioProjectBasisHandler — GET /api/studio/projecten/:id/basis (lezen op de branch)
// Geeft {projectId, ouderProject, basisVolgnummer, totVolgnummer, profiel, ops}: de blob van
// de ouder (geldig t/m totVolgnummer, als `profiel` zoals de sidecar het voor /export/v3 kent)
// en de operaties daarna t/m basisVolgnummer, in de vorm van GET …/ops. 404 voor een project
// zonder basis (geen branch).
func MaakStudioProjectBasisHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		b := new(model.StudioProjectBasis)
		err := DB.NewSelect().Model(b).Where("project_id = ?", id).Scan(c.Request.Context())
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Dit project is geen afgeleid project en heeft geen basis."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Basis lezen mislukt: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"projectId": b.ProjectID, "ouderProject": b.OuderProjectID,
			"basisVolgnummer": b.BasisVolgnummer, "totVolgnummer": b.TotVolgnummer,
			"profiel": b.Inhoud, "ops": b.Ops,
			"aangemaakt": b.Aangemaakt, "aangemaaktDoor": b.AangemaaktDoor,
		})
	}
}
