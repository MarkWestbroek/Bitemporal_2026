package handlers

// Studio-projecten op de server (plan docs/plans/2026-10-07 Projectsync, stap 1).
//
// Eén JSONB-blob per project in `studio_projecten`: de Studio stuurt zijn
// project-werkbestand (formaat "studio-project") als geheel, en haalt het als
// geheel terug. Samenwerken is hier "om de beurt": de versieteller voorkomt dat
// je ongemerkt andermans opslag overschrijft (409 bij een verouderde versie).
// Wie is ingelogd ziet alle projecten (geen lidmaatschap; dat komt met het
// modelregister, plan 2026-10-06). Zonder AUTH_ENABLED is de eigenaar leeg.
//
// Routes (main.go):
//   GET    /api/studio/projecten        lijst zonder inhoud
//   GET    /api/studio/projecten/:id    volledig record
//   POST   /api/studio/projecten        {id?, naam, inhoud}         → 201
//   PUT    /api/studio/projecten/:id    {naam?, inhoud, versie}     → 200, 409 bij conflict
//   DELETE /api/studio/projecten/:id    eigenaar of admin

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// studioProjectIDPatroon: UUID's en vergelijkbare door de client gekozen id's.
var studioProjectIDPatroon = regexp.MustCompile(`^[A-Za-z0-9_-]{8,64}$`)

const (
	studioProjectNaamMax   = 200
	studioProjectInhoudMax = 20 << 20 // 20 MB; de blob van een flink project blijft daar ver onder
)

// StudioProjectMeta is de lijstweergave: alles behalve de inhoud.
type StudioProjectMeta struct {
	ID             string    `json:"id" bun:"id"`
	Naam           string    `json:"naam" bun:"naam"`
	Eigenaar       string    `json:"eigenaar" bun:"eigenaar"`
	Versie         int64     `json:"versie" bun:"versie"`
	Aangemaakt     time.Time `json:"aangemaakt" bun:"aangemaakt"`
	Bijgewerkt     time.Time `json:"bijgewerkt" bun:"bijgewerkt"`
	BijgewerktDoor string    `json:"bijgewerkt_door" bun:"bijgewerkt_door"`
	Grootte        int64     `json:"grootte" bun:"grootte"` // bytes van de JSON-inhoud
}

// studioProjectInvoer is het verzoek voor POST en PUT.
type studioProjectInvoer struct {
	ID     string          `json:"id"`
	Naam   string          `json:"naam"`
	Inhoud json.RawMessage `json:"inhoud"`
	Versie *int64          `json:"versie"`
}

// valideerStudioProjectInvoer controleert naam en inhoud; geeft een lege string als
// alles goed is, anders de foutmelding voor de client. Zuivere functie (testbaar).
func valideerStudioProjectInvoer(naam string, inhoud json.RawMessage, naamVerplicht bool) string {
	naam = strings.TrimSpace(naam)
	if naamVerplicht && naam == "" {
		return "Veld 'naam' is verplicht."
	}
	if len(naam) > studioProjectNaamMax {
		return "Veld 'naam' is te lang (max 200 tekens)."
	}
	if len(inhoud) == 0 {
		return "Veld 'inhoud' is verplicht (het studio-project-JSON)."
	}
	if len(inhoud) > studioProjectInhoudMax {
		return "Veld 'inhoud' is te groot (max 20 MB)."
	}
	var kop struct {
		Formaat string `json:"formaat"`
	}
	if err := json.Unmarshal(inhoud, &kop); err != nil || kop.Formaat != "studio-project" {
		return "Veld 'inhoud' moet een object zijn met formaat 'studio-project'."
	}
	return ""
}

// studioActor geeft de gebruikersnaam uit de claims, of "" zonder auth.
func studioActor(c *gin.Context) string {
	if claims := middleware.GetClaims(c); claims != nil {
		return claims.Gebruikersnaam
	}
	return ""
}

func nieuwStudioProjectID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "p-" + hex.EncodeToString([]byte(time.Now().Format(time.RFC3339Nano)))
	}
	return hex.EncodeToString(b)
}

func studioProjectMeta(p *model.StudioProject) StudioProjectMeta {
	return StudioProjectMeta{
		ID: p.ID, Naam: p.Naam, Eigenaar: p.Eigenaar, Versie: p.Versie,
		Aangemaakt: p.Aangemaakt, Bijgewerkt: p.Bijgewerkt, BijgewerktDoor: p.BijgewerktDoor,
		Grootte: int64(len(p.Inhoud)),
	}
}

// MaakStudioProjectenLijstHandler — GET /api/studio/projecten
func MaakStudioProjectenLijstHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var lijst []StudioProjectMeta
		err := DB.NewSelect().
			TableExpr("studio_projecten").
			ColumnExpr("id, naam, eigenaar, versie, aangemaakt, bijgewerkt, bijgewerkt_door, length(inhoud::text) AS grootte").
			OrderExpr("bijgewerkt DESC").
			Scan(c.Request.Context(), &lijst)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Projecten lezen mislukt: " + err.Error()})
			return
		}
		if lijst == nil {
			lijst = []StudioProjectMeta{}
		}
		c.JSON(http.StatusOK, lijst)
	}
}

func leesStudioProject(ctx context.Context, db bun.IDB, id string) (*model.StudioProject, error) {
	p := new(model.StudioProject)
	err := db.NewSelect().Model(p).Where("id = ?", id).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// MaakStudioProjectOphalenHandler — GET /api/studio/projecten/:id
func MaakStudioProjectOphalenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		p, err := leesStudioProject(c.Request.Context(), DB, id)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, p)
	}
}

// MaakStudioProjectAanmakenHandler — POST /api/studio/projecten
func MaakStudioProjectAanmakenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var in studioProjectInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON: " + err.Error()})
			return
		}
		if msg := valideerStudioProjectInvoer(in.Naam, in.Inhoud, true); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		id := strings.TrimSpace(in.ID)
		if id == "" {
			id = nieuwStudioProjectID()
		} else if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id (8–64 tekens, letters/cijfers/-/_)."})
			return
		}
		nu := time.Now()
		actor := studioActor(c)
		p := &model.StudioProject{
			ID: id, Naam: strings.TrimSpace(in.Naam), Eigenaar: actor, Versie: 1,
			Inhoud: in.Inhoud, Aangemaakt: nu, Bijgewerkt: nu, BijgewerktDoor: actor,
		}
		_, err := DB.NewInsert().Model(p).Exec(c.Request.Context())
		if err != nil {
			if strings.Contains(err.Error(), "duplicate key") {
				c.JSON(http.StatusConflict, gin.H{"error": "Er bestaat al een project met dit id op de server. Haal het op of sla op met PUT."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project aanmaken mislukt: " + err.Error()})
			return
		}
		c.JSON(http.StatusCreated, studioProjectMeta(p))
	}
}

// MaakStudioProjectOpslaanHandler — PUT /api/studio/projecten/:id
//
// Optimistische vergrendeling: `versie` in het verzoek moet gelijk zijn aan de
// versie op de server. Anders 409 met de huidige meta, zodat de Studio kan
// kiezen tussen overschrijven (opnieuw PUT met die versie) of afbreken.
func MaakStudioProjectOpslaanHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		var in studioProjectInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON: " + err.Error()})
			return
		}
		if msg := valideerStudioProjectInvoer(in.Naam, in.Inhoud, false); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		if in.Versie == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Veld 'versie' is verplicht (de versie die je hebt opgehaald)."})
			return
		}
		ctx := c.Request.Context()
		tx, err := DB.BeginTx(ctx, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transactie starten mislukt: " + err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck

		huidig := new(model.StudioProject)
		err = tx.NewSelect().Model(huidig).Where("id = ?", id).For("UPDATE").Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden op de server; maak het eerst aan (POST)."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		if huidig.Versie != *in.Versie {
			c.JSON(http.StatusConflict, gin.H{
				"error":  "Het project is intussen op de server gewijzigd.",
				"server": studioProjectMeta(huidig),
			})
			return
		}
		actor := studioActor(c)
		huidig.Versie++
		huidig.Inhoud = in.Inhoud
		huidig.Bijgewerkt = time.Now()
		huidig.BijgewerktDoor = actor
		if naam := strings.TrimSpace(in.Naam); naam != "" {
			huidig.Naam = naam
		}
		_, err = tx.NewUpdate().Model(huidig).
			Column("naam", "versie", "inhoud", "bijgewerkt", "bijgewerkt_door").
			WherePK().Exec(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project opslaan mislukt: " + err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit mislukt: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, studioProjectMeta(huidig))
	}
}

// MaakStudioProjectVerwijderenHandler — DELETE /api/studio/projecten/:id
// Alleen de eigenaar of een admin; zonder auth mag iedereen.
func MaakStudioProjectVerwijderenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		ctx := c.Request.Context()
		p, err := leesStudioProject(ctx, DB, id)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		if claims := middleware.GetClaims(c); claims != nil && claims.Rol != "admin" && claims.Gebruikersnaam != p.Eigenaar {
			c.JSON(http.StatusForbidden, gin.H{"error": "Alleen de eigenaar of een admin kan dit project verwijderen."})
			return
		}
		if _, err := DB.NewDelete().Model(p).WherePK().Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project verwijderen mislukt: " + err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	}
}
