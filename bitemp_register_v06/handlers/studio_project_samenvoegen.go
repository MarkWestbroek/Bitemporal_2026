package handlers

// Branch terugmergen (plan "2026-11-14 Branch terugmergen — keuze per wijziging en samenhang").
// Stap 1: alles uit de branch naar de ouder (MAIN); een conflict blokkeert. Stap 2: met `keuze`
// (sleutel → true | false | "terug", zie verschilMetMain.js `verschilSleutel`) gaat alleen het
// gekozene mee; een conflict blokkeert dan niet (gekozen = de branch wint, anders MAIN); "terug"
// zet de eenheid in de branch terug naar de versie van MAIN. Daarna haalt de branch MAIN
// op (optie A, "bijwerken"); wat niet gekozen werd, blijft als wijziging in de branch staan. De
// samengevoegde stand is het nieuwe uitgangspunt (basis) van de branch.
//
//   POST /api/studio/projecten/:id/samenvoegen   {ookBuitenMap?: bool, keuze?: {sleutel: true|false|"terug"}}
//     → 200 {main: {van, tot, aantal, laatsteVolgnummer}, tak: {…}, basisVolgnummer, telling, opgelost}
//     → 409 reden "conflicten"            {conflicten}: aan beide kanten anders gewijzigd (zonder keuze)
//     → 409 reden "samenhang"             {samenhang}: de keuze laat een verwijzing naar iets
//                                         wat er niet is achter (bv. een relatie zonder haar doel)
//     → 409 reden "buiten_map"            {buitenMap}: gekozen wijzigingen buiten de afgesplitste
//                                         map, alleen met ookBuitenMap: true
//     → 409 reden "volgnummer_verschoven": MAIN of de branch kreeg intussen nieuwe operaties;
//                                         opnieuw proberen (de Studio vergelijkt dan opnieuw)
//     → 403 zonder schrijfrecht op de ouder; 404/413/502 zoals …/vergelijk
//
// Werking. De server speelt nog steeds niets af: de render-sidecar (POST /samenvoegen) voegt de
// drie standen samen en geeft twee lijsten operaties terug, opsMain (MAIN → samengevoegd) en
// opsTak (branch → samengevoegd), plus het samengevoegde werkbestand. De sidecar heeft beide
// lijsten al nagespeeld en gecontroleerd. De server schrijft ze daarna in één transactie weg:
//   1. ouder en branch vergrendelen (FOR UPDATE, zoals POST …/ops) en controleren dat hun laatste
//      volgnummer nog dat van de vergelijking is;
//   2. opsMain achter het log van de ouder, opsTak achter dat van de branch (actor = wie merget,
//      clientId "samenvoegen");
//   3. de basis van de branch vervangen door het samengevoegde werkbestand, geldig op het nieuwe
//      laatste volgnummer van de ouder (`basis_volgnummer` op de branch idem).
// Na de commit gaan beide lijsten via SSE naar de open Studio's (NaStudioProjectOps).
//
// Rechten: schrijven op de branch (middleware) én op de ouder (hier). Fijner, op map-niveau,
// komt later (besluit Mark 14-11: voorlopig is de granulariteit het project).

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// samenvoegClientID staat als clientId bij de operaties van een merge in het log.
const samenvoegClientID = "samenvoegen"

type samenvoegenInvoer struct {
	OokBuitenMap bool           `json:"ookBuitenMap"`
	Keuze        map[string]any `json:"keuze"`
}

// samenvoegAntwoord is wat de sidecar op POST /samenvoegen teruggeeft (de delen die de server
// gebruikt).
type samenvoegAntwoord struct {
	Conflicten []json.RawMessage `json:"conflicten"`
	Opgelost   []json.RawMessage `json:"opgelost"`
	Samenhang  []json.RawMessage `json:"samenhang"`
	BuitenMap  []json.RawMessage `json:"buitenMap"`
	OpsMain    []studioOpInvoer  `json:"opsMain"`
	OpsTak     []studioOpInvoer  `json:"opsTak"`
	Basis      json.RawMessage   `json:"basis"`
	Telling    json.RawMessage   `json:"telling"`
}

// leesSamenvoegAntwoord zet het sidecar-antwoord om. Zuiver (testbaar).
func leesSamenvoegAntwoord(antw map[string]json.RawMessage) (*samenvoegAntwoord, error) {
	b, err := json.Marshal(antw)
	if err != nil {
		return nil, err
	}
	uit := new(samenvoegAntwoord)
	if err := json.Unmarshal(b, uit); err != nil {
		return nil, err
	}
	return uit, nil
}

// metKeuze voegt de keuze van de gebruiker toe aan het sidecar-verzoek. Zuiver (testbaar).
func metKeuze(verzoek []byte, keuze map[string]any) ([]byte, error) {
	for k, w := range keuze {
		if _, ok := w.(bool); !ok && w != "terug" {
			return nil, fmt.Errorf("keuze %q moet true, false of \"terug\" zijn", k)
		}
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(verzoek, &m); err != nil {
		return nil, err
	}
	k, err := json.Marshal(keuze)
	if err != nil {
		return nil, err
	}
	m["keuze"] = k
	return json.Marshal(m)
}

// opsRijen maakt logregels van de operaties, doorgenummerd na `laatste`.
func opsRijen(projectID string, ops []studioOpInvoer, laatste int64, actor string, nu time.Time) []model.StudioProjectOp {
	rijen := make([]model.StudioProjectOp, 0, len(ops))
	for i, o := range ops {
		rijen = append(rijen, model.StudioProjectOp{
			ProjectID: projectID, Volgnummer: laatste + int64(i) + 1,
			ClientID: samenvoegClientID, Actor: actor, LokaalNr: int64(i) + 1, Tijd: nu,
			Store: o.Store, Op: o.Op, Args: o.Args,
		})
	}
	return rijen
}

// bereik beschrijft wat er in een log is bijgekomen.
func bereik(rijen []model.StudioProjectOp, laatste int64) gin.H {
	if len(rijen) == 0 {
		return gin.H{"aantal": 0, "laatsteVolgnummer": laatste}
	}
	return gin.H{"aantal": len(rijen), "van": rijen[0].Volgnummer, "tot": rijen[len(rijen)-1].Volgnummer,
		"laatsteVolgnummer": rijen[len(rijen)-1].Volgnummer}
}

// MaakStudioProjectSamenvoegenHandler — POST /api/studio/projecten/:id/samenvoegen
func MaakStudioProjectSamenvoegenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		var in samenvoegenInvoer
		if c.Request.ContentLength != 0 {
			if err := c.ShouldBindJSON(&in); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON: " + err.Error()})
				return
			}
		}
		d, ok := leesDrieStanden(c, id, RechtSchrijven)
		if !ok {
			return
		}
		var err error
		verzoek := d.verzoek
		if in.Keuze != nil {
			if verzoek, err = metKeuze(d.verzoek, in.Keuze); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige keuze: " + err.Error()})
				return
			}
		}
		ruw, ok := vraagSidecar(c, "/samenvoegen", verzoek)
		if !ok {
			return
		}
		sv, err := leesSamenvoegAntwoord(ruw)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "Het antwoord van de sidecar op /samenvoegen is onleesbaar: " + err.Error()})
			return
		}
		if len(sv.Conflicten) > 0 {
			c.JSON(http.StatusConflict, gin.H{"reden": "conflicten", "conflicten": sv.Conflicten,
				"error": "Er zijn conflicten: eenheden die in de branch én op MAIN anders zijn gewijzigd. Los die eerst op."})
			return
		}
		if len(sv.Samenhang) > 0 {
			c.JSON(http.StatusConflict, gin.H{"reden": "samenhang", "samenhang": sv.Samenhang,
				"error": "Deze keuze laat verwijzingen naar iets wat er niet is achter. Kies wat erbij hoort mee, of laat het samen weg."})
			return
		}
		if len(sv.BuitenMap) > 0 && !in.OokBuitenMap {
			c.JSON(http.StatusConflict, gin.H{"reden": "buiten_map", "buitenMap": sv.BuitenMap,
				"error": "De branch wijzigt ook iets buiten zijn map. Bevestig dat dat mee mag (ookBuitenMap)."})
			return
		}
		if len(sv.Basis) == 0 || string(sv.Basis) == "null" {
			c.JSON(http.StatusBadGateway, gin.H{"reden": "sidecar", "error": "De sidecar gaf geen samengevoegde stand terug."})
			return
		}

		ctx := c.Request.Context()
		tx, err := DB.BeginTx(ctx, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transactie starten mislukt: " + err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck

		// Vergrendelen in een vaste volgorde (ouder, dan branch) en controleren dat niemand
		// intussen iets schreef: de samenvoeging is op precies deze standen berekend.
		for _, p := range []struct {
			id       string
			verwacht int64
		}{{d.ouder.ID, d.mainLaatste}, {d.tak.ID, d.takLaatste}} {
			if err := tx.NewSelect().Model((*model.StudioProject)(nil)).Column("id").Where("id = ?", p.id).For("UPDATE").Scan(ctx, new(string)); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Project vergrendelen mislukt: " + err.Error()})
				return
			}
			if nu := laatsteVolgnummerVan(ctx, tx, p.id); nu != p.verwacht {
				c.JSON(http.StatusConflict, gin.H{"reden": "volgnummer_verschoven", "projectId": p.id, "verwacht": p.verwacht, "laatsteVolgnummer": nu,
					"error": "Er is intussen verder gewerkt; vergelijk opnieuw en probeer het nog eens."})
				return
			}
		}

		nu := time.Now()
		actor := studioActor(c)
		rijenMain := opsRijen(d.ouder.ID, sv.OpsMain, d.mainLaatste, actor, nu)
		rijenTak := opsRijen(d.tak.ID, sv.OpsTak, d.takLaatste, actor, nu)
		for _, rijen := range [][]model.StudioProjectOp{rijenMain, rijenTak} {
			if len(rijen) == 0 {
				continue
			}
			if _, err := tx.NewInsert().Model(&rijen).Exec(ctx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Operaties opslaan mislukt: " + err.Error()})
				return
			}
		}
		nieuwMain := d.mainLaatste + int64(len(rijenMain))

		// De samengevoegde stand is het nieuwe uitgangspunt van de branch.
		if _, err := tx.NewUpdate().Model((*model.StudioProjectBasis)(nil)).
			Set("inhoud = ?", string(sv.Basis)).
			Set("ops = ?", "[]").
			Set("basis_volgnummer = ?", nieuwMain).
			Set("tot_volgnummer = ?", nieuwMain).
			Set("aangemaakt = ?", nu).
			Set("aangemaakt_door = ?", actor).
			Where("project_id = ?", d.tak.ID).Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Nieuwe basis opslaan mislukt: " + err.Error()})
			return
		}
		if _, err := tx.NewUpdate().Model((*model.StudioProject)(nil)).
			Set("basis_volgnummer = ?", nieuwMain).
			Where("id = ?", d.tak.ID).Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Herkomst bijwerken mislukt: " + err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit mislukt: " + err.Error()})
			return
		}
		if NaStudioProjectOps != nil {
			if len(rijenMain) > 0 {
				NaStudioProjectOps(d.ouder.ID, rijenMain)
			}
			if len(rijenTak) > 0 {
				NaStudioProjectOps(d.tak.ID, rijenTak)
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"main":            gin.H{"projectId": d.ouder.ID, "ops": bereik(rijenMain, d.mainLaatste)},
			"tak":             gin.H{"projectId": d.tak.ID, "ops": bereik(rijenTak, d.takLaatste)},
			"basisVolgnummer": nieuwMain,
			"telling":         sv.Telling,
			"opgelost":        len(sv.Opgelost),
		})
	}
}
