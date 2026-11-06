package handlers

// rebuild_uit_project.go — /admin/rebuild met een Studio-project als bron (besluit Mark 07-11-2026:
// "het model is de bron voor het genereren").
//
// Tot nu toe kwam het V3-model van een rebuild uit de body, een schema-versie of de huidige code.
// Op Fundament liep de rebuild uit een V3-bestand in een repo, terwijl de Studio uit losse
// domeinbestanden was gevuld; die liepen uit elkaar. Nu kan de body `{project_id, domeinen?}`
// zijn. De API knipt het canonieke profiel uit de snapshot van het project (zoals diagram.svg,
// render_project.go) en laat de render-sidecar er V3 van maken: `POST /export/v3`, dezelfde
// terugreis als *Exporteer V3* in de Studio (eerst de modelmigraties, dan serialisatie.exporteerV3).
// Er is dus geen tweede implementatie in Go. Daarna volgt het gewone pad: codegen per domein,
// go build, de gebouwde versie actief maken, met de herkomst (project, versie, volgnummer) op de
// schema-versie.
//
// Bewerkingen ná de snapshot (het operatielog) gaan niet mee: dan weigert de rebuild met 409
// (reden "achterstand"). De Studio zet vóór *Register bouwen* zelf een snapshot. Het naspelen van
// ops in de sidecar (veld `ops` van /export/v3) kan later (keuze Mark 07-11).

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// standaardRebuildProfiel is de sleutel van het canonieke profiel in `inhoud.profielen`.
const standaardRebuildProfiel = "diagram05"

// RebuildBron is de herkomst van een rebuild uit een Studio-project (ook in het antwoord).
type RebuildBron struct {
	ProjectID     string `json:"project_id"`
	ProjectNaam   string `json:"project_naam,omitempty"`
	Profiel       string `json:"profiel"`
	ProjectVersie int64  `json:"project_versie"`
	TotVolgnummer int64  `json:"tot_volgnummer"`
	RenderVersie  string `json:"render_versie,omitempty"`
	// Achterstand: wijzigingen ná de snapshot die niet in het model zitten (alleen bij …/v3;
	// de rebuild weigert dan).
	Achterstand int64 `json:"achterstand,omitempty"`
}

// rebuildProjectFout is een weigering vóór codegen: HTTP-status en het antwoord.
type rebuildProjectFout struct {
	status int
	body   RebuildResponse
}

// exportV3Antwoord is het antwoord van de sidecar op POST /export/v3.
type exportV3Antwoord struct {
	Model        json.RawMessage `json:"model"`
	Meldingen    json.RawMessage `json:"meldingen"`
	Fout         string          `json:"fout"`
	Detail       string          `json:"detail"`
	RenderVersie string          `json:"renderVersie"`
}

// modelUitProject haalt het V3-model van een Studio-project op via de sidecar. Bij een
// weigering (geen project, achterstand, exportfout) is fout gezet en de rest leeg. Met
// weigerAchterstand=false (de leesroute …/v3) gaat een project met ops ná de snapshot wél door;
// bron.Achterstand zegt dan hoeveel wijzigingen er niet in zitten.
func modelUitProject(ctx context.Context, projectID, profiel string, stappen []string, weigerAchterstand bool) ([]byte, json.RawMessage, *RebuildBron, []string, *rebuildProjectFout) {
	weiger := func(status int, reden, msg string, meldingen json.RawMessage) ([]byte, json.RawMessage, *RebuildBron, []string, *rebuildProjectFout) {
		return nil, nil, nil, stappen, &rebuildProjectFout{status: status, body: RebuildResponse{
			Status: "fout", Reden: reden, Stappen: stappen, Error: msg, Meldingen: meldingen,
		}}
	}
	projectID = strings.TrimSpace(projectID)
	if !studioProjectIDPatroon.MatchString(projectID) {
		return weiger(http.StatusBadRequest, "ongeldig", "Ongeldig project_id.", nil)
	}
	if profiel = strings.TrimSpace(profiel); profiel == "" {
		profiel = standaardRebuildProfiel
	}
	stand, deel, err := laadProjectDeel(ctx, projectID, profiel)
	if err != nil {
		return weiger(http.StatusInternalServerError, "", "Project lezen mislukt: "+err.Error(), nil)
	}
	if stand == nil {
		return weiger(http.StatusNotFound, "geen_project", fmt.Sprintf("Studio-project %s niet gevonden.", projectID), nil)
	}
	if len(deel) == 0 {
		return weiger(http.StatusUnprocessableEntity, "geen_profiel",
			fmt.Sprintf("Project %q heeft geen profiel %q (het canonieke model) in zijn snapshot.", stand.Naam, profiel), nil)
	}
	achterstand := projectAchterstand(ctx, projectID, stand.TotVolgnummer)
	if n := achterstand; n > 0 && weigerAchterstand {
		f := &rebuildProjectFout{status: http.StatusConflict, body: RebuildResponse{
			Status: "fout", Reden: "achterstand", Stappen: stappen,
			Error: fmt.Sprintf("Project %q heeft %d wijziging(en) na de laatste snapshot; zet eerst een snapshot "+
				"(in de Studio: Register bouwen doet dat zelf).", stand.Naam, n),
			TotVolgnummer: stand.TotVolgnummer, LaatsteVolgnummer: stand.TotVolgnummer + n,
		}}
		return nil, nil, nil, stappen, f
	}
	stappen = append(stappen, fmt.Sprintf("Studio-project %q (%s): profiel %s uit de snapshot, versie %d, t/m volgnummer %d",
		stand.Naam, projectID, profiel, stand.Versie, stand.TotVolgnummer))

	verzoek, _ := json.Marshal(map[string]any{"profiel": deel, "profielId": profiel})
	if len(verzoek) > renderMaxBytes {
		return weiger(http.StatusRequestEntityTooLarge, "te_groot",
			fmt.Sprintf("Het profiel is groter dan %d bytes; de sidecar neemt het niet aan.", renderMaxBytes), nil)
	}
	status, _, uit, err := stuurNaarRenderSvc("/export/v3", verzoek)
	if err != nil {
		return weiger(http.StatusBadGateway, "sidecar", fmt.Sprintf("render-svc onbereikbaar (%s): %v", renderSvcURL(), err), nil)
	}
	var antw exportV3Antwoord
	_ = json.Unmarshal(uit, &antw)
	switch {
	case status == http.StatusOK && len(antw.Model) > 0 && string(antw.Model) != "null":
	case status == http.StatusNotFound:
		return weiger(http.StatusBadGateway, "sidecar", "De render-sidecar kent /export/v3 niet (te oud; vanaf render 0.3.5).", nil)
	case status == http.StatusUnprocessableEntity:
		msg := antw.Fout
		if msg == "" {
			msg = "De terugreis naar V3 mislukte."
		}
		return weiger(http.StatusUnprocessableEntity, "export", msg, antw.Meldingen)
	default:
		msg := antw.Detail
		if msg == "" {
			msg = strings.TrimSpace(string(uit))
		}
		return weiger(http.StatusBadGateway, "sidecar", fmt.Sprintf("render-svc /export/v3 gaf %d: %s", status, msg), antw.Meldingen)
	}
	stappen = append(stappen, fmt.Sprintf("V3 gemaakt door de render-sidecar (render %s, dezelfde terugreis als de Studio)", antw.RenderVersie))
	bron := &RebuildBron{
		ProjectID: projectID, ProjectNaam: stand.Naam, Profiel: profiel,
		ProjectVersie: stand.Versie, TotVolgnummer: stand.TotVolgnummer, RenderVersie: antw.RenderVersie,
		Achterstand: achterstand,
	}
	meldingen := antw.Meldingen
	if string(meldingen) == "null" || string(meldingen) == "[]" {
		meldingen = nil
	}
	return kaalV3(antw.Model), meldingen, bron, stappen, nil
}

// kaalV3 pakt een V3-envelop uit. De sidecar geeft het bestand van *Exporteer V3* in de Studio:
// `{versie, bron, build_versie, go_module, indiener, model: <V3>}`. Codegen kan beide vormen aan,
// maar domeinRunsUitModel, de metadata van de schema-versie en de opgeslagen schema_json verwachten
// het kale model (zoals elke andere schema-versie). Zonder envelop blijft het zoals het is.
func kaalV3(b json.RawMessage) json.RawMessage {
	var env struct {
		Model      json.RawMessage `json:"model"`
		Entiteiten json.RawMessage `json:"entiteiten"`
	}
	if json.Unmarshal(b, &env) == nil && len(env.Entiteiten) == 0 && len(env.Model) > 0 && env.Model[0] == '{' {
		return env.Model
	}
	return b
}

// MaakStudioProjectV3Handler — GET /api/studio/projecten/:id/v3[?profiel=diagram05]
// (ingelogd + leesrecht, ook met een API-token). Het V3-model van het project zoals de
// rebuild het zou bouwen, maar zonder te bouwen: `{model, meldingen, bron}`. Bedoeld om te
// vergelijken met een V3-bestand (pariteit) of om het model te bekijken. Wijzigingen ná de
// snapshot gaan niet mee: `bron.achterstand` en de header X-Omnium-Achterstand zeggen hoeveel.
func MaakStudioProjectV3Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		model, meldingen, bron, _, fout := modelUitProject(c.Request.Context(), c.Param("id"), c.Query("profiel"), nil, false)
		if fout != nil {
			c.JSON(fout.status, gin.H{"error": fout.body.Error, "reden": fout.body.Reden, "meldingen": fout.body.Meldingen})
			return
		}
		c.Header("X-Omnium-Project-Versie", fmt.Sprint(bron.ProjectVersie))
		c.Header("X-Omnium-Achterstand", fmt.Sprint(bron.Achterstand))
		if bron.RenderVersie != "" {
			c.Header("X-Render-Versie", bron.RenderVersie)
		}
		c.Header("Cache-Control", "no-store")
		if meldingen == nil {
			meldingen = json.RawMessage("[]")
		}
		c.JSON(http.StatusOK, gin.H{"model": json.RawMessage(model), "meldingen": meldingen, "bron": bron})
	}
}
