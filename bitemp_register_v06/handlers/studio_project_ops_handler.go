package handlers

// Operatielog van Studio-projecten (plan 2026-10-07 Projectsync, stap 2, onderdeel 3).
//
//   POST /api/studio/projecten/:id/ops          batch aannemen, volgnummers toekennen
//   GET  /api/studio/projecten/:id/ops?vanaf=N  operaties ná N, in volgorde
//
// De server is een logboek: hij valideert de vorm ({store, op, args}), kent per
// project een oplopend volgnummer toe in één transactie (met FOR UPDATE op de
// projectrij, zodat twee clients nooit hetzelfde nummer krijgen) en geeft de
// toegekende nummers terug. Toepassen gebeurt in de Studio
// (web/vite/src/studio/sync/operaties.js). Onderdeel 5 (SSE) haakt in op
// `NaStudioProjectOps`.

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

const (
	studioOpsBatchMax    = 500     // operaties per POST
	studioOpsBodyMax     = 8 << 20 // 8 MB per batch (een modelimport kan groot zijn)
	studioOpsLimietStd   = 1000    // GET zonder limiet
	studioOpsLimietMax   = 5000    // GET bovengrens
	studioOpStoreMax     = 120     // "model:<profielId>"
	studioOpNaamMax      = 80      // actienaam
	studioOpsClientIDMax = 64
)

// NaStudioProjectOps wordt na een geslaagde batch aangeroepen (buiten de
// transactie) — de SSE-hub van onderdeel 5 hangt hier aan. Nil = niets.
var NaStudioProjectOps func(projectID string, ops []model.StudioProjectOp)

// studioOpInvoer is één operatie in een batch, zoals de outbox hem stuurt.
type studioOpInvoer struct {
	LokaalNr int64           `json:"lokaalNr"`
	Store    string          `json:"store"`
	Op       string          `json:"op"`
	Args     json.RawMessage `json:"args"`
}

type studioOpsBatchInvoer struct {
	ClientID string           `json:"clientId"`
	Ops      []studioOpInvoer `json:"ops"`
}

// StudioOpUit is de uitgaande vorm (GET en SSE): camelCase zoals de Studio hem kent.
type StudioOpUit struct {
	Volgnummer int64           `json:"volgnummer"`
	ClientID   string          `json:"clientId"`
	Actor      string          `json:"actor"`
	LokaalNr   int64           `json:"lokaalNr,omitempty"`
	Tijd       time.Time       `json:"tijd"`
	Store      string          `json:"store"`
	Op         string          `json:"op"`
	Args       json.RawMessage `json:"args"`
}

func studioOpUit(o model.StudioProjectOp) StudioOpUit {
	return StudioOpUit{
		Volgnummer: o.Volgnummer, ClientID: o.ClientID, Actor: o.Actor, LokaalNr: o.LokaalNr,
		Tijd: o.Tijd, Store: o.Store, Op: o.Op, Args: o.Args,
	}
}

// valideerStudioOpsBatch controleert de vorm van een batch; "" = goed. Zuiver (testbaar).
func valideerStudioOpsBatch(in *studioOpsBatchInvoer) string {
	if in == nil {
		return "Lege batch."
	}
	if len(in.ClientID) > studioOpsClientIDMax {
		return "Veld 'clientId' is te lang."
	}
	if len(in.Ops) == 0 {
		return "Veld 'ops' is leeg."
	}
	if len(in.Ops) > studioOpsBatchMax {
		return "Te veel operaties in één batch (max 500)."
	}
	for i, o := range in.Ops {
		if strings.TrimSpace(o.Store) == "" || len(o.Store) > studioOpStoreMax {
			return "Operatie " + strconv.Itoa(i) + ": 'store' ontbreekt of is te lang."
		}
		if strings.TrimSpace(o.Op) == "" || len(o.Op) > studioOpNaamMax {
			return "Operatie " + strconv.Itoa(i) + ": 'op' ontbreekt of is te lang."
		}
		if len(o.Args) == 0 {
			return "Operatie " + strconv.Itoa(i) + ": 'args' ontbreekt (verwacht een JSON-array)."
		}
		var args []json.RawMessage
		if err := json.Unmarshal(o.Args, &args); err != nil {
			return "Operatie " + strconv.Itoa(i) + ": 'args' is geen JSON-array."
		}
	}
	return ""
}

// MaakStudioProjectOpsToevoegenHandler — POST /api/studio/projecten/:id/ops
func MaakStudioProjectOpsToevoegenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, studioOpsBodyMax)
		var in studioOpsBatchInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON of batch te groot (max 8 MB): " + err.Error()})
			return
		}
		if msg := valideerStudioOpsBatch(&in); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		ctx := c.Request.Context()
		tx, err := DB.BeginTx(ctx, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transactie starten mislukt: " + err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck

		// Projectrij vergrendelen: één toekenner van volgnummers tegelijk per project.
		project := new(model.StudioProject)
		err = tx.NewSelect().Model(project).Column("id").Where("id = ?", id).For("UPDATE").Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden op de server."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		// Doortellen vanaf het hoogste bekende nummer — ook na compactie (dan is de
		// snapshot-grens het hoogste), zodat een nummer nooit tweemaal voorkomt.
		laatste := laatsteVolgnummerVan(ctx, tx, id)
		actor := studioActor(c)
		nu := time.Now()
		rijen := make([]model.StudioProjectOp, 0, len(in.Ops))
		for i, o := range in.Ops {
			rijen = append(rijen, model.StudioProjectOp{
				ProjectID: id, Volgnummer: laatste + int64(i) + 1,
				ClientID: in.ClientID, Actor: actor, LokaalNr: o.LokaalNr, Tijd: nu,
				Store: o.Store, Op: o.Op, Args: o.Args,
			})
		}
		if _, err := tx.NewInsert().Model(&rijen).Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Operaties opslaan mislukt: " + err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit mislukt: " + err.Error()})
			return
		}
		if NaStudioProjectOps != nil {
			NaStudioProjectOps(id, rijen)
		}
		c.JSON(http.StatusCreated, gin.H{
			"van":             rijen[0].Volgnummer,
			"tot":             rijen[len(rijen)-1].Volgnummer,
			"laatsteLokaalNr": in.Ops[len(in.Ops)-1].LokaalNr,
		})
	}
}

// MaakStudioProjectOpsLijstHandler — GET /api/studio/projecten/:id/ops?vanaf=N&limiet=M
// Geeft de operaties met volgnummer > N, oudste eerst; `meer` = er zijn er nog.
func MaakStudioProjectOpsLijstHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		vanaf, _ := strconv.ParseInt(strings.TrimSpace(c.Query("vanaf")), 10, 64)
		limiet, _ := strconv.Atoi(strings.TrimSpace(c.Query("limiet")))
		if limiet <= 0 {
			limiet = studioOpsLimietStd
		}
		if limiet > studioOpsLimietMax {
			limiet = studioOpsLimietMax
		}
		ctx := c.Request.Context()
		project := new(model.StudioProject)
		err := DB.NewSelect().Model(project).Column("id", "tot_volgnummer").Where("id = ?", id).Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden op de server."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		// Compactie (onderdeel 6): operaties t/m tot_volgnummer zijn weg; wie daarvóór
		// staat kan niet bijgepraat worden en moet de snapshot opnieuw laden.
		if vanaf < project.TotVolgnummer {
			c.JSON(http.StatusOK, gin.H{"ops": []StudioOpUit{}, "laatste": vanaf, "meer": false,
				"snapshotNodig": true, "totVolgnummer": project.TotVolgnummer})
			return
		}
		var rijen []model.StudioProjectOp
		err = DB.NewSelect().Model(&rijen).
			Where("project_id = ? AND volgnummer > ?", id, vanaf).
			OrderExpr("volgnummer ASC").Limit(limiet + 1).Scan(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Operaties lezen mislukt: " + err.Error()})
			return
		}
		meer := len(rijen) > limiet
		if meer {
			rijen = rijen[:limiet]
		}
		uit := make([]StudioOpUit, 0, len(rijen))
		var laatste int64 = vanaf
		for _, r := range rijen {
			uit = append(uit, studioOpUit(r))
			laatste = r.Volgnummer
		}
		c.JSON(http.StatusOK, gin.H{"ops": uit, "laatste": laatste, "meer": meer})
	}
}
