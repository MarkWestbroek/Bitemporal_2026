package handlers

// De centrale plek voor profielen en weergaven (plan "Sidecar-project — weergaven en starten uit
// het project", §8, stap 5). Besluiten Mark 22-11:
//
//   - de centrale is app: daar staan het profielen- en transformatieproject en het
//     weergaveproject als gewone serverprojecten (soort in de kop), en daar worden versies
//     uitgebracht;
//   - andere instanties lezen met een leestoken per instantie (niet publiek): een persoonlijk
//     API-token (middleware/token.go) van een account met de rol lezer, één per instantie;
//   - een release pint de versies exact vast (`centraal.json` bij de Studio-build);
//   - een klant-centrale is een spiegel: zij haalt de uitgebrachte versies van app en bedient de
//     eigen instanties met dezelfde endpoints; niemand brengt daar uit.
//
// Routes (main.go):
//
//	POST /api/studio/projecten/:id/uitbrengen  {versie, inhoud, totVolgnummer, notitie?, ouders?}
//	     beheerder; → 201 de uitgave zonder inhoud. 409 met `reden`:
//	       achterstand        het werkbestand mist operaties (totVolgnummer < laatste volgnummer)
//	       versie_niet_hoger  de versie is niet hoger dan de hoogste van deze soort
//	       ander_project      deze soort is al uitgebracht vanuit een ander project
//	       spiegel            deze instantie is een spiegel (CENTRAAL_URL gezet)
//	GET  /api/studio/centraal                    ingelogd; de versies (zonder inhoud), hier en, bij
//	     een spiegel, op de centrale: {centrale, fout?, versies: [...]}
//	GET  /api/studio/centraal/:soort/:versie     ingelogd; de versie met inhoud. Een spiegel die hem
//	     nog niet heeft, haalt hem bij de centrale en bewaart hem (onveranderlijk, dus veilig).
//
// Een uitgave is onveranderlijk en blijft bestaan als het project wordt verwijderd. Ze noemt
// vanaf de eerste versie haar ouders (stap 10: een graaf van versies): zonder opgave de hoogste
// vorige versie van de soort.
//
// Configuratie van een spiegel (of een instantie die van app leest):
//
//	CENTRAAL_URL    het adres van de centrale, bv. https://app.voorbeeld.nl (zonder /api)
//	CENTRAAL_TOKEN  het leestoken van deze instantie op de centrale

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// Soorten centrale projecten (studio/projectGebruik.js: SOORT_PROFIELEN, SOORT_WEERGAVEN).
var centraleSoorten = map[string]bool{"profielen": true, "weergaven": true}

var semverPatroon = regexp.MustCompile(`^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$`)

// parseSemver: "X.Y.Z" → [X, Y, Z]. Zuiver.
func parseSemver(s string) ([3]int, bool) {
	m := semverPatroon.FindStringSubmatch(strings.TrimSpace(s))
	if m == nil {
		return [3]int{}, false
	}
	var v [3]int
	for i := 0; i < 3; i++ {
		v[i], _ = strconv.Atoi(m[i+1])
	}
	return v, true
}

// vergelijkSemver: <0 als a < b, 0 gelijk, >0 als a > b (ongeldige versies tellen als 0.0.0). Zuiver.
func vergelijkSemver(a, b string) int {
	va, _ := parseSemver(a)
	vb, _ := parseSemver(b)
	for i := 0; i < 3; i++ {
		if va[i] != vb[i] {
			return va[i] - vb[i]
		}
	}
	return 0
}

// hoogsteVersie van een lijst ("" bij een lege lijst). Zuiver.
func hoogsteVersie(versies []string) string {
	h := ""
	for _, v := range versies {
		if h == "" || vergelijkSemver(v, h) > 0 {
			h = v
		}
	}
	return h
}

type uitbrengenInvoer struct {
	Versie        string          `json:"versie"`
	Inhoud        json.RawMessage `json:"inhoud"`
	TotVolgnummer int64           `json:"totVolgnummer"`
	Notitie       string          `json:"notitie"`
	Ouders        []string        `json:"ouders"` // optioneel: versies van dezelfde soort; anders de hoogste vorige
}

type uitgaveOuder struct {
	Versie string `json:"versie"`
}

// inhoudVoorUitgave controleert het werkbestand en zet de versie in de projectkop (`project.versie`,
// zonder `concept`; studio/projectGebruik.js, keuze A: de versie gaat alleen omhoog bij
// uitbrengen). Geeft de nieuwe inhoud en de soort, of een foutmelding. Zuiver.
func inhoudVoorUitgave(inhoud json.RawMessage, versie string) (json.RawMessage, string, string) {
	if msg := valideerStudioProjectInvoer("x", inhoud, false); msg != "" {
		return nil, "", msg
	}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(inhoud, &doc); err != nil {
		return nil, "", "Veld 'inhoud' is geen JSON-object."
	}
	var kop map[string]any
	if raw, ok := doc["project"]; !ok || json.Unmarshal(raw, &kop) != nil || kop == nil {
		return nil, "", "Het werkbestand heeft geen projectkop."
	}
	soort, _ := kop["soort"].(string)
	if !centraleSoorten[soort] {
		return nil, "", "Alleen een profielen- of weergaveproject (soort in de projectkop) kan een versie uitbrengen."
	}
	kop["versie"] = versie
	delete(kop, "concept")
	nieuweKop, err := json.Marshal(kop)
	if err != nil {
		return nil, "", "Projectkop schrijven mislukt."
	}
	doc["project"] = nieuweKop
	uit, err := json.Marshal(doc)
	if err != nil {
		return nil, "", "Werkbestand schrijven mislukt."
	}
	return uit, soort, ""
}

// centraleURL en centraalToken: de configuratie van een spiegel ("" = deze instantie is zelf de centrale).
func centraleURL() string {
	return strings.TrimRight(strings.TrimSpace(os.Getenv("CENTRAAL_URL")), "/")
}
func centraalToken() string { return strings.TrimSpace(os.Getenv("CENTRAAL_TOKEN")) }

// MaakStudioProjectUitbrengenHandler — POST /api/studio/projecten/:id/uitbrengen
func MaakStudioProjectUitbrengenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		if url := centraleURL(); url != "" {
			c.JSON(http.StatusConflict, gin.H{"reden": "spiegel", "centrale": url,
				"error": "Deze instantie is een spiegel van de centrale; daar worden versies uitgebracht."})
			return
		}
		var in uitbrengenInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON: " + err.Error()})
			return
		}
		if _, ok := parseSemver(in.Versie); !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Veld 'versie' moet de vorm X.Y.Z hebben (bv. 0.3.0)."})
			return
		}
		in.Versie = strings.TrimSpace(in.Versie)
		if len(in.Notitie) > 4000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Veld 'notitie' is te lang (max 4000 tekens)."})
			return
		}
		inhoud, soort, msg := inhoudVoorUitgave(in.Inhoud, in.Versie)
		if msg != "" {
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

		// Het project vergrendelen (zelfde slot als POST /ops en PUT): geen operaties tussendoor.
		p := new(model.StudioProject)
		err = tx.NewSelect().Model(p).Column("id", "naam", "tot_volgnummer", "ouder_project_id").Where("id = ?", id).For("UPDATE").Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		// Stap 7: een branch is een concept; uitbrengen gaat vanaf MAIN, na het samenvoegen.
		if p.OuderProjectID != "" {
			c.JSON(http.StatusConflict, gin.H{"reden": "branch",
				"error": "Dit is een branch (een concept). Voeg hem eerst samen met het centrale project en breng daar de versie uit."})
			return
		}
		if laatste := laatsteVolgnummerVan(ctx, tx, id); in.TotVolgnummer < laatste {
			c.JSON(http.StatusConflict, gin.H{"reden": "achterstand", "laatsteVolgnummer": laatste,
				"error": "Het werkbestand mist wijzigingen die op de server staan; haal eerst de laatste stand op."})
			return
		}

		var eerder []model.StudioProjectUitgave
		if err := tx.NewSelect().Model(&eerder).Column("versie", "project_id").Where("soort = ?", soort).Scan(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Uitgebrachte versies lezen mislukt: " + err.Error()})
			return
		}
		versies := make([]string, 0, len(eerder))
		bestaat := map[string]bool{}
		projectVan := map[string]string{}
		for _, u := range eerder {
			versies = append(versies, u.Versie)
			bestaat[u.Versie] = true
			projectVan[u.Versie] = u.ProjectID
		}
		// Stap 10 (studio_versiegraaf.go): hoofdlijn of onderhoudslijn.
		lijn, standaardOuder, reden, melding := beoordeelNieuweVersie(in.Versie, versies)
		if reden != "" {
			c.JSON(http.StatusConflict, gin.H{"reden": reden, "hoogste": hoogsteVersie(versies), "error": melding})
			return
		}
		// De hoofdlijn komt uit één project per soort (dat van de hoogste versie); een onderhoudslijn
		// mag uit een eigen project.
		if hoogste := hoogsteVersie(versies); lijn == LijnHoofd && hoogste != "" && projectVan[hoogste] != id {
			c.JSON(http.StatusConflict, gin.H{"reden": "ander_project", "projectId": projectVan[hoogste],
				"error": fmt.Sprintf("De hoofdlijn van de %s wordt uitgebracht vanuit een ander project; de centrale heeft één hoofdproject per soort. Vanuit dit project kan alleen een patch op een oudere lijn (onderhoud).", soort)})
			return
		}
		ouders := []uitgaveOuder{}
		if len(in.Ouders) > 0 {
			lijst := make([]string, 0, len(in.Ouders))
			for _, o := range in.Ouders {
				lijst = append(lijst, strings.TrimSpace(o))
			}
			if msg := controleerOuders(in.Versie, lijst, bestaat); msg != "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": msg})
				return
			}
			for _, o := range lijst {
				ouders = append(ouders, uitgaveOuder{Versie: o})
			}
		} else if standaardOuder != "" {
			ouders = append(ouders, uitgaveOuder{Versie: standaardOuder})
		}
		oudersJSON, _ := json.Marshal(ouders)

		u := &model.StudioProjectUitgave{
			Soort: soort, Versie: in.Versie, ProjectID: id, ProjectNaam: p.Naam, Ouders: oudersJSON,
			TotVolgnummer: in.TotVolgnummer, Notitie: strings.TrimSpace(in.Notitie), Inhoud: inhoud,
			Grootte: int64(len(inhoud)), Uitgebracht: time.Now(), UitgebrachtDoor: studioActor(c),
		}
		if _, err := tx.NewInsert().Model(u).Exec(ctx); err != nil {
			if strings.Contains(err.Error(), "duplicate key") {
				c.JSON(http.StatusConflict, gin.H{"reden": "versie_niet_hoger", "error": "Deze versie is al uitgebracht."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Uitbrengen mislukt: " + err.Error()})
			return
		}
		// Ook de kop van het project zelf krijgt het nummer (zonder concept). De kop gaat niet als
		// operatie mee, dus zonder dit zag wie het project later opent nog de oude versie (rooktest
		// 23-11). De blob-versie (optimistische vergrendeling) blijft: de inhoud verandert verder niet.
		if _, err := tx.NewRaw(`UPDATE studio_projecten
			SET inhoud = jsonb_set(inhoud #- '{project,concept}', '{project,versie}', to_jsonb(?::text), true)
			WHERE id = ? AND jsonb_typeof(inhoud->'project') = 'object'`, in.Versie, id).Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Projectkop bijwerken mislukt: " + err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit mislukt: " + err.Error()})
			return
		}
		u.Inhoud = nil
		c.JSON(http.StatusCreated, gin.H{"soort": u.Soort, "versie": u.Versie, "projectId": u.ProjectID, "projectNaam": u.ProjectNaam,
			"ouders": u.Ouders, "notitie": u.Notitie, "uitgebracht": u.Uitgebracht, "uitgebrachtDoor": u.UitgebrachtDoor, "lijn": lijn})
	}
}

// Per versie: is hij hier al (opgehaald), of alleen op de centrale bekend?
type centraleVersie struct {
	model.StudioProjectUitgave
	Hier bool `json:"hier"`
}

func centraleClient() *http.Client { return &http.Client{Timeout: 30 * time.Second} }

// haalBijCentrale doet een GET op de centrale met het leestoken en decodeert JSON in `doel`.
func haalBijCentrale(ctx context.Context, pad string, doel any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, centraleURL()+pad, nil)
	if err != nil {
		return err
	}
	if t := centraalToken(); t != "" {
		req.Header.Set("Authorization", "Bearer "+t)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := centraleClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 500))
		return fmt.Errorf("centrale antwoordt %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return json.NewDecoder(io.LimitReader(resp.Body, studioProjectInhoudMax+1<<20)).Decode(doel)
}

// sorteerUitgaven: per soort, dan op versie (oudste eerst).
func sorteerUitgaven(v []centraleVersie) {
	sort.SliceStable(v, func(i, j int) bool {
		if v[i].Soort != v[j].Soort {
			return v[i].Soort < v[j].Soort
		}
		return vergelijkSemver(v[i].Versie, v[j].Versie) < 0
	})
}

// MaakStudioCentraalLijstHandler — GET /api/studio/centraal
func MaakStudioCentraalLijstHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		var hier []model.StudioProjectUitgave
		if err := DB.NewSelect().Model(&hier).ExcludeColumn("inhoud").Scan(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Uitgebrachte versies lezen mislukt: " + err.Error()})
			return
		}
		uit := gin.H{"centrale": centraleURL()}
		versies := make([]centraleVersie, 0, len(hier))
		gezien := map[string]bool{}
		for _, u := range hier {
			versies = append(versies, centraleVersie{u, true})
			gezien[u.Soort+"@"+u.Versie] = true
		}
		if centraleURL() != "" {
			var daar struct {
				Versies []model.StudioProjectUitgave `json:"versies"`
			}
			if err := haalBijCentrale(ctx, "/api/studio/centraal", &daar); err != nil {
				uit["fout"] = "De centrale is niet bereikbaar: " + err.Error()
			} else {
				for _, u := range daar.Versies {
					if !gezien[u.Soort+"@"+u.Versie] {
						u.Inhoud = nil
						u.Bron = centraleURL()
						versies = append(versies, centraleVersie{u, false})
					}
				}
			}
		}
		sorteerUitgaven(versies)
		uit["versies"] = versies
		c.JSON(http.StatusOK, uit)
	}
}

// MaakStudioCentraalOphalenHandler — GET /api/studio/centraal/:soort/:versie
func MaakStudioCentraalOphalenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		soort, versie := c.Param("soort"), c.Param("versie")
		if !centraleSoorten[soort] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Onbekende soort (profielen of weergaven)."})
			return
		}
		if _, ok := parseSemver(versie); !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige versie (X.Y.Z)."})
			return
		}
		ctx := c.Request.Context()
		u := new(model.StudioProjectUitgave)
		err := DB.NewSelect().Model(u).Where("soort = ? AND versie = ?", soort, versie).Scan(ctx)
		if err == nil {
			c.JSON(http.StatusOK, u)
			return
		}
		if !errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Versie lezen mislukt: " + err.Error()})
			return
		}
		if centraleURL() == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Versie %s van de %s is niet uitgebracht.", versie, soort)})
			return
		}
		// Spiegel: bij de centrale halen, controleren en bewaren.
		daar := new(model.StudioProjectUitgave)
		if err := haalBijCentrale(ctx, "/api/studio/centraal/"+soort+"/"+versie, daar); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Ophalen bij de centrale mislukt: " + err.Error()})
			return
		}
		if daar.Soort != soort || daar.Versie != versie {
			c.JSON(http.StatusBadGateway, gin.H{"error": "De centrale gaf een andere versie terug dan gevraagd."})
			return
		}
		if msg := valideerStudioProjectInvoer("x", daar.Inhoud, false); msg != "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "De centrale gaf geen geldig werkbestand: " + msg})
			return
		}
		if len(daar.Ouders) == 0 {
			daar.Ouders = json.RawMessage("[]")
		}
		daar.Bron = centraleURL()
		daar.Grootte = int64(len(daar.Inhoud))
		if _, err := DB.NewInsert().Model(daar).On("CONFLICT (soort, versie) DO NOTHING").Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Bewaren van de opgehaalde versie mislukt: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, daar)
	}
}
