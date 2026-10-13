package handlers

// Toegang per Studio-project (plan docs/plans/2026-10-12 Gebruikers uitnodigen, §5; besluit
// Mark 13-10): "alles dicht tenzij", rechten op niveau model. Genodigden werken in een
// probeerproject en zien het productieproject niet.
//
// Wie wat mag (besluitProjectRecht, zuiver en getest):
//
//	auth uit (dev)                → beheren
//	beheerder (admin)             → beheren
//	eigenaar van het project      → beheren
//	rij in studio_project_toegang → lezen of schrijven, voor de gebruiker of "*" (iedereen
//	                                die is ingelogd); de hoogste telt
//	anders                        → geen: het project bestaat voor jou niet (404)
//
// Schrijven vraagt bovendien minstens de rol modelleur: een lezer met een schrijfrij kan
// alleen lezen. Rollen en hun rangorde: middleware/rollen.go.
//
// Routes (main.go):
//   GET /api/studio/projecten/:id/toegang   eigenaar + rijen (beheren)
//   PUT /api/studio/projecten/:id/toegang   {toegang: [{subject, recht}]} vervangt alle rijen (beheren)

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// ProjectRecht: oplopend; elk recht omvat de lagere.
type ProjectRecht int

const (
	RechtGeen ProjectRecht = iota
	RechtLezen
	RechtSchrijven
	RechtBeheren
)

var projectRechtNamen = []string{"geen", "lezen", "schrijven", "beheren"}

func (r ProjectRecht) String() string { return projectRechtNamen[r] }

// ParseProjectRecht: alleen lezen en schrijven zijn toe te kennen (beheren volgt uit
// eigenaarschap of de rol beheerder).
func ParseProjectRecht(s string) (ProjectRecht, bool) {
	switch s {
	case "lezen":
		return RechtLezen, true
	case "schrijven":
		return RechtSchrijven, true
	}
	return RechtGeen, false
}

// IedereenSubject: een toegangsrij voor iedereen die is ingelogd.
const IedereenSubject = "*"

// subjectPatroon: gebruikersnamen zoals de uitnodiging ze toestaat, of "*".
var subjectPatroon = regexp.MustCompile(`^(\*|[A-Za-z0-9._-]{2,64})$`)

// besluitProjectRecht is de beslisregel; acl bevat de rechten van de rijen voor deze gebruiker
// en voor "*" (subject → recht).
func besluitProjectRecht(authAan bool, rol, gebruiker, eigenaar string, acl map[string]ProjectRecht) ProjectRecht {
	if !authAan {
		return RechtBeheren
	}
	niveau := middleware.RolNiveau(rol)
	if gebruiker == "" || niveau == 0 {
		return RechtGeen
	}
	r := RechtGeen
	switch {
	case middleware.IsBeheerder(rol):
		return RechtBeheren
	case eigenaar != "" && eigenaar == gebruiker:
		r = RechtBeheren
	default:
		if a := acl[gebruiker]; a > r {
			r = a
		}
		if a := acl[IedereenSubject]; a > r {
			r = a
		}
	}
	if niveau < middleware.RolNiveau("modelleur") && r > RechtLezen {
		r = RechtLezen
	}
	return r
}

// aclVoor leest de rijen van één gebruiker (en "*") voor een of alle projecten:
// project → subject → recht. projectID leeg = alle projecten.
func aclVoor(ctx context.Context, db bun.IDB, gebruiker, projectID string) (map[string]map[string]ProjectRecht, error) {
	var rijen []model.StudioProjectToegang
	q := db.NewSelect().Model(&rijen).Where("subject IN (?)", bun.In([]string{gebruiker, IedereenSubject}))
	if projectID != "" {
		q = q.Where("project_id = ?", projectID)
	}
	if err := q.Scan(ctx); err != nil {
		return nil, err
	}
	uit := map[string]map[string]ProjectRecht{}
	for _, r := range rijen {
		recht, ok := ParseProjectRecht(r.Recht)
		if !ok {
			continue
		}
		if uit[r.ProjectID] == nil {
			uit[r.ProjectID] = map[string]ProjectRecht{}
		}
		uit[r.ProjectID][r.Subject] = recht
	}
	return uit, nil
}

// projectRechtVan bepaalt het recht van de aanroeper op een project met deze eigenaar.
func projectRechtVan(c *gin.Context, projectID, eigenaar string) (ProjectRecht, error) {
	if !middleware.IsAuthEnabled() {
		return RechtBeheren, nil
	}
	claims := middleware.GetClaims(c)
	if claims == nil {
		return RechtGeen, nil
	}
	acl, err := aclVoor(c.Request.Context(), DB, claims.Gebruikersnaam, projectID)
	if err != nil {
		return RechtGeen, err
	}
	return besluitProjectRecht(true, claims.Rol, claims.Gebruikersnaam, eigenaar, acl[projectID]), nil
}

const projectRechtSleutel = "studioProjectRecht"

// VereisProjectRecht is de middleware op de :id-routes. Geen leesrecht → 404 (het project
// bestaat voor jou niet); wel lezen maar te weinig → 403. Een ongeldig of onbekend id laat
// hij door naar de handler, die 400/404 geeft.
func VereisProjectRecht(minimaal ProjectRecht) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.Next()
			return
		}
		var eigenaar string
		err := DB.NewSelect().Model((*model.StudioProject)(nil)).Column("eigenaar").
			Where("id = ?", id).Scan(c.Request.Context(), &eigenaar)
		if errors.Is(err, sql.ErrNoRows) {
			if middleware.IsAuthEnabled() && minimaal > RechtLezen {
				// Schrijven naar een project dat (nog) niet bestaat: alleen via POST.
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
				return
			}
			c.Next()
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		recht, err := projectRechtVan(c, id, eigenaar)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Toegang lezen mislukt: " + err.Error()})
			return
		}
		if recht < RechtLezen {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
			return
		}
		if recht < minimaal {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": fmt.Sprintf("Je hebt op dit project het recht %q; hiervoor is %q nodig.", recht, minimaal),
				"recht": recht.String(),
			})
			return
		}
		c.Set(projectRechtSleutel, recht)
		c.Next()
	}
}

// ZetProjectToegang geeft een subject een recht op een project (bestaande rij wordt vervangen).
// Gebruikt door de toegang-endpoint en bij het accepteren van een uitnodiging.
func ZetProjectToegang(ctx context.Context, db bun.IDB, projectID, subject string, recht ProjectRecht, door string) error {
	if recht != RechtLezen && recht != RechtSchrijven {
		return fmt.Errorf("recht %q is niet toe te kennen", recht)
	}
	rij := &model.StudioProjectToegang{ProjectID: projectID, Subject: subject, Recht: recht.String(),
		Aangemaakt: time.Now(), AangemaaktDoor: door}
	_, err := db.NewInsert().Model(rij).
		On("CONFLICT (project_id, subject) DO UPDATE").
		Set("recht = EXCLUDED.recht").Set("aangemaakt = EXCLUDED.aangemaakt").Set("aangemaakt_door = EXCLUDED.aangemaakt_door").
		Exec(ctx)
	return err
}

type toegangRij struct {
	Subject string `json:"subject"`
	Recht   string `json:"recht"`
}

// valideerToegang controleert de rijen van een PUT; lege string = goed. Zuiver (testbaar).
func valideerToegang(rijen []toegangRij) string {
	gezien := map[string]bool{}
	for _, r := range rijen {
		if !subjectPatroon.MatchString(r.Subject) {
			return fmt.Sprintf("Ongeldig subject %q (een gebruikersnaam of \"*\").", r.Subject)
		}
		if _, ok := ParseProjectRecht(r.Recht); !ok {
			return fmt.Sprintf("Ongeldig recht %q (lezen of schrijven).", r.Recht)
		}
		if gezien[r.Subject] {
			return fmt.Sprintf("Subject %q staat er twee keer in.", r.Subject)
		}
		gezien[r.Subject] = true
	}
	return ""
}

// MaakStudioProjectToegangOphalenHandler — GET /api/studio/projecten/:id/toegang (beheren)
func MaakStudioProjectToegangOphalenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		p, err := leesStudioProject(c.Request.Context(), DB, id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
			return
		}
		var rijen []model.StudioProjectToegang
		if err := DB.NewSelect().Model(&rijen).Where("project_id = ?", id).OrderExpr("subject").Scan(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Toegang lezen mislukt: " + err.Error()})
			return
		}
		if rijen == nil {
			rijen = []model.StudioProjectToegang{}
		}
		c.JSON(http.StatusOK, gin.H{"project_id": id, "eigenaar": p.Eigenaar, "toegang": rijen})
	}
}

// MaakStudioProjectToegangOpslaanHandler — PUT /api/studio/projecten/:id/toegang (beheren):
// vervangt alle rijen in één transactie.
func MaakStudioProjectToegangOpslaanHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var in struct {
			Toegang []toegangRij `json:"toegang"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON: " + err.Error()})
			return
		}
		for i := range in.Toegang {
			in.Toegang[i].Subject = strings.TrimSpace(in.Toegang[i].Subject)
		}
		if msg := valideerToegang(in.Toegang); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		ctx := c.Request.Context()
		if _, err := leesStudioProject(ctx, DB, id); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
			return
		}
		door := studioActor(c)
		err := DB.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
			if _, err := tx.NewDelete().Model((*model.StudioProjectToegang)(nil)).Where("project_id = ?", id).Exec(ctx); err != nil {
				return err
			}
			for _, r := range in.Toegang {
				recht, _ := ParseProjectRecht(r.Recht)
				if err := ZetProjectToegang(ctx, tx, id, r.Subject, recht, door); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Toegang opslaan mislukt: " + err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// GebruikerMetRol: invoer voor de migratie (uit gebruikers.LaadAlle; handlers kent dat
// package niet, want gebruikers importeert handlers).
type GebruikerMetRol struct {
	Gebruikersnaam string
	Rol            string
}

const migratieProjectToegangV1 = "project_toegang_v1"

// MigreerProjectToegangV1 zet eenmalig de stand van vóór "alles dicht tenzij" vast: elke
// bestaande gebruiker houdt toegang tot elk bestaand project (bouwer en hoger schrijven,
// de rest lezen). Wie later wordt uitgenodigd, krijgt alleen wat de uitnodiging zegt.
// Idempotent via studio_migraties; geeft het aantal toegevoegde rijen.
func MigreerProjectToegangV1(ctx context.Context, db *bun.DB, gebruikers []GebruikerMetRol) (int, error) {
	n := 0
	err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		// Slot op de markering, zodat twee instanties tegelijk niet dubbel migreren.
		res, err := tx.NewInsert().Model(&model.StudioMigratie{Naam: migratieProjectToegangV1, Uitgevoerd: time.Now()}).
			On("CONFLICT (naam) DO NOTHING").Exec(ctx)
		if err != nil {
			return err
		}
		if k, _ := res.RowsAffected(); k == 0 {
			return nil // al gedaan
		}
		var projecten []model.StudioProject
		if err := tx.NewSelect().Model(&projecten).Column("id", "eigenaar").Scan(ctx); err != nil {
			return err
		}
		for _, p := range projecten {
			for _, g := range gebruikers {
				niveau := middleware.RolNiveau(g.Rol)
				if niveau == 0 || middleware.IsBeheerder(g.Rol) || g.Gebruikersnaam == p.Eigenaar {
					continue // geen rol, of heeft al beheren
				}
				recht := RechtLezen
				if niveau >= middleware.RolNiveau("bouwer") {
					recht = RechtSchrijven
				}
				res, err := tx.NewInsert().Model(&model.StudioProjectToegang{ProjectID: p.ID, Subject: g.Gebruikersnaam,
					Recht: recht.String(), Aangemaakt: time.Now(), AangemaaktDoor: "migratie " + migratieProjectToegangV1}).
					On("CONFLICT (project_id, subject) DO NOTHING").Exec(ctx)
				if err != nil {
					return err
				}
				if k, _ := res.RowsAffected(); k > 0 {
					n++
				}
			}
		}
		return nil
	})
	return n, err
}

// huidigProjectRecht: het recht dat VereisProjectRecht op dit verzoek heeft vastgesteld
// (beheren zonder auth of zonder middleware).
func huidigProjectRecht(c *gin.Context) ProjectRecht {
	if v, ok := c.Get(projectRechtSleutel); ok {
		if r, ok := v.(ProjectRecht); ok {
			return r
		}
	}
	if !middleware.IsAuthEnabled() {
		return RechtBeheren
	}
	return RechtGeen
}
