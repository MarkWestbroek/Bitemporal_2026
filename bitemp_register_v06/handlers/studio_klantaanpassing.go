package handlers

// Klantaanpassingen (plan "Sidecar-project" §10, stap 8; besluit Mark 22-11): een klantaanpassing
// is de delta van een klant op een uitgebrachte versie van een centraal project. Alleen de delta
// wordt bewaard, met zijn basisversie; de Studio rekent basis + delta en zet een delta op een
// nieuwe basis (web/vite/src/studio/takken/klantDelta.js). De server bewaakt de vorm en de
// versies, en speelt niets af.
//
//   POST /api/studio/klantaanpassingen   {klant, soort, versie, basisVersie, delta, notitie?}
//        (beheerder; ook op een spiegel: daar woont de klant) → 201 de rij zonder delta
//        400 vorm; 404 basisversie niet hier; 409 reden "versie_niet_hoger"
//   GET  /api/studio/klantaanpassingen                         → alle versies, zonder delta
//   GET  /api/studio/klantaanpassingen/:klant/:soort/:versie   → één versie, met delta
//
// Onveranderlijk: elke stand is een nieuwe versie, met de vorige van dezelfde klant en soort als
// ouder (lineair; een graaf volgt met stap 10).

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

var klantPatroon = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,39}$`)

type klantAanpassingInvoer struct {
	Klant       string          `json:"klant"`
	Soort       string          `json:"soort"`
	Versie      string          `json:"versie"`
	BasisVersie string          `json:"basisVersie"`
	Delta       json.RawMessage `json:"delta"`
	Notitie     string          `json:"notitie"`
}

type deltaKop struct {
	Formaat     string            `json:"formaat"`
	Soort       string            `json:"soort"`
	BasisVersie string            `json:"basisVersie"`
	Eenheden    []json.RawMessage `json:"eenheden"`
}

// valideerKlantAanpassing controleert de vorm, zuiver; geeft het aantal eenheden of een melding.
func valideerKlantAanpassing(in *klantAanpassingInvoer) (int, string) {
	in.Klant = strings.TrimSpace(in.Klant)
	if !klantPatroon.MatchString(in.Klant) {
		return 0, "Klant: 2–40 tekens, kleine letters, cijfers en '-'."
	}
	if !centraleSoorten[in.Soort] {
		return 0, "Onbekende soort (profielen of weergaven)."
	}
	if _, ok := parseSemver(in.Versie); !ok {
		return 0, "Ongeldige versie (X.Y.Z)."
	}
	if _, ok := parseSemver(in.BasisVersie); !ok {
		return 0, "Ongeldige basisversie (X.Y.Z)."
	}
	var d deltaKop
	if err := json.Unmarshal(in.Delta, &d); err != nil || d.Formaat != "studio-klantdelta" {
		return 0, "De delta heeft niet het formaat studio-klantdelta."
	}
	if d.Soort != in.Soort || d.BasisVersie != in.BasisVersie {
		return 0, "Soort en basisversie van de delta horen gelijk te zijn aan die van de aanpassing."
	}
	if d.Eenheden == nil {
		return 0, "De delta heeft geen lijst eenheden."
	}
	return len(d.Eenheden), ""
}

// MaakStudioKlantAanpassingVastleggenHandler — POST /api/studio/klantaanpassingen
func MaakStudioKlantAanpassingVastleggenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var in klantAanpassingInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON: " + err.Error()})
			return
		}
		aantal, msg := valideerKlantAanpassing(&in)
		if msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		ctx := c.Request.Context()
		// De basisversie moet hier staan (op een spiegel: eerst opgehaald, wat de Studio doet).
		if ok, err := DB.NewSelect().Model((*model.StudioProjectUitgave)(nil)).Where("soort = ? AND versie = ?", in.Soort, in.BasisVersie).Exists(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Versies lezen mislukt: " + err.Error()})
			return
		} else if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Versie %s van de %s staat niet op deze instantie.", in.BasisVersie, in.Soort)})
			return
		}
		tx, err := DB.BeginTx(ctx, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transactie starten mislukt: " + err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck
		var eerder []string
		if err := tx.NewSelect().Model((*model.StudioKlantAanpassing)(nil)).Column("versie").
			Where("klant = ? AND soort = ?", in.Klant, in.Soort).For("UPDATE").Scan(ctx, &eerder); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Eerdere versies lezen mislukt: " + err.Error()})
			return
		}
		hoogste := hoogsteVersie(eerder)
		if hoogste != "" && vergelijkSemver(in.Versie, hoogste) <= 0 {
			c.JSON(http.StatusConflict, gin.H{"reden": "versie_niet_hoger", "hoogste": hoogste,
				"error": fmt.Sprintf("Versie %s is niet hoger dan de laatste (%s).", in.Versie, hoogste)})
			return
		}
		ouders := json.RawMessage("[]")
		if hoogste != "" {
			ouders, _ = json.Marshal([]uitgaveOuder{{Versie: hoogste}})
		}
		rij := &model.StudioKlantAanpassing{
			Klant: in.Klant, Soort: in.Soort, Versie: in.Versie, BasisVersie: in.BasisVersie,
			Delta: in.Delta, Eenheden: aantal, Ouders: ouders, Notitie: strings.TrimSpace(in.Notitie),
			Vastgelegd: time.Now(), VastgelegdDoor: studioActor(c),
		}
		if _, err := tx.NewInsert().Model(rij).Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Vastleggen mislukt: " + err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Vastleggen mislukt: " + err.Error()})
			return
		}
		rij.Delta = nil
		c.JSON(http.StatusCreated, rij)
	}
}

// MaakStudioKlantAanpassingenLijstHandler — GET /api/studio/klantaanpassingen
func MaakStudioKlantAanpassingenLijstHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var lijst []model.StudioKlantAanpassing
		if err := DB.NewSelect().Model(&lijst).ExcludeColumn("delta").Order("klant", "soort").Scan(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Klantaanpassingen lezen mislukt: " + err.Error()})
			return
		}
		if lijst == nil {
			lijst = []model.StudioKlantAanpassing{}
		}
		c.JSON(http.StatusOK, gin.H{"aanpassingen": lijst})
	}
}

// MaakStudioKlantAanpassingOphalenHandler — GET /api/studio/klantaanpassingen/:klant/:soort/:versie
func MaakStudioKlantAanpassingOphalenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		rij := new(model.StudioKlantAanpassing)
		err := DB.NewSelect().Model(rij).Where("klant = ? AND soort = ? AND versie = ?", c.Param("klant"), c.Param("soort"), c.Param("versie")).Scan(c.Request.Context())
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Deze klantaanpassing bestaat niet."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Klantaanpassing lezen mislukt: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, rij)
	}
}
