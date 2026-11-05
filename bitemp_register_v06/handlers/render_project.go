// Package handlers — render_project.go
//
// Een diagram uit een Studio-project als SVG (stap 6 van het plan docs/plans/2026-11-04 Eén
// tekenaar; docs/RENDER_API.md §"Projectdiagram"). `studio_projecten` is privé ("alles dicht
// tenzij", studio_project_toegang.go). Privacy-besluit Mark 05-11-2026: een projectdiagram is
// op te halen
//
//  1. door wie is ingelogd met leesrecht op het project, ook met een persoonlijk API-token
//     (`Authorization: Bearer omt_…`, middleware/token.go), en
//
//  2. via een link met een onraadbaar token, zoals de gedeelde plaatjes.
//
//     GET  /api/studio/projecten/:id/diagram.svg?profiel=&diagram=&theme=&idPrefix=   ingelogd + lezen
//     GET  /api/studio/projecten/:id/views.json                                        ingelogd + lezen
//     POST /api/studio/projecten/:id/beelden  {profiel_id, diagram_id, diagram_naam, soort:"svg"}
//     → de link (studio_beeld_handler.go)
//     GET  /api/beeld/<token>.svg?theme=&idPrefix=                                     openbaar
//
// Wat er getekend wordt: de **snapshot** van het project op de server (`studio_projecten.inhoud`,
// geldig tot en met `tot_volgnummer`). Operaties die daarna in het log staan past alleen de Studio
// toe (web/vite/src/studio/sync/operaties.js); een online client zet een nieuwe snapshot na
// SNAPSHOT_NA (200) operaties. De tekening kan dus achterlopen op wat iemand in de Studio ziet;
// de ingelogde route meldt dat in `X-Omnium-Achterstand` en views.json in `laatste_volgnummer`.
//
// Het tekenen doet de sidecar (taal=studio, render_svg.go). Go stuurt alleen het profiel van het
// gevraagde diagram mee, niet het hele project: een project mag 100 MB zijn, de sidecar neemt
// 5 MB aan, en de tekenaar kijkt toch alleen naar dat ene profiel.
package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// projectStand is wat we van een project weten zonder de inhoud te laden.
type projectStand struct {
	Naam          string
	Versie        int64 // telt op bij elke opslag van de snapshot: de sleutel van de cache
	TotVolgnummer int64
	Bijgewerkt    time.Time
}

// laadProjectStand: de lichte vraag (geen inhoud). Nil = het project bestaat niet.
// Een variabele, zodat de tests zonder database kunnen.
var laadProjectStand = func(ctx context.Context, id string) (*projectStand, error) {
	var rij struct {
		Naam          string    `bun:"naam"`
		Versie        int64     `bun:"versie"`
		TotVolgnummer int64     `bun:"tot_volgnummer"`
		Bijgewerkt    time.Time `bun:"bijgewerkt"`
	}
	err := DB.NewSelect().Table("studio_projecten").
		Column("naam", "versie", "tot_volgnummer", "bijgewerkt").
		Where("id = ?", id).Scan(ctx, &rij)
	if isNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &projectStand{Naam: rij.Naam, Versie: rij.Versie, TotVolgnummer: rij.TotVolgnummer, Bijgewerkt: rij.Bijgewerkt}, nil
}

// laadProjectDeel haalt de profielen uit de snapshot: met `profiel` alleen dat ene profiel
// (`inhoud->'profielen'-><profiel>`), zonder alle profielen (`inhoud->'profielen'`). De database
// knipt, zodat de rest van de blob (structuur, kruisverbanden, andere profielen) niet over de
// lijn gaat. Een leeg deel betekent: dat profiel (of `profielen`) zit niet in het project.
// Nil-stand = het project bestaat niet.
var laadProjectDeel = func(ctx context.Context, id, profiel string) (*projectStand, json.RawMessage, error) {
	var rij struct {
		Naam          string    `bun:"naam"`
		Versie        int64     `bun:"versie"`
		TotVolgnummer int64     `bun:"tot_volgnummer"`
		Bijgewerkt    time.Time `bun:"bijgewerkt"`
		Deel          *string   `bun:"deel"`
	}
	q := DB.NewSelect().Table("studio_projecten").Column("naam", "versie", "tot_volgnummer", "bijgewerkt")
	if profiel != "" {
		q = q.ColumnExpr("(inhoud->'profielen'->?)::text AS deel", profiel)
	} else {
		q = q.ColumnExpr("(inhoud->'profielen')::text AS deel")
	}
	err := q.Where("id = ?", id).Scan(ctx, &rij)
	if isNoRows(err) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}
	stand := &projectStand{Naam: rij.Naam, Versie: rij.Versie, TotVolgnummer: rij.TotVolgnummer, Bijgewerkt: rij.Bijgewerkt}
	if rij.Deel == nil || *rij.Deel == "null" {
		return stand, nil, nil
	}
	return stand, json.RawMessage(*rij.Deel), nil
}

// projectAchterstand: hoeveel operaties er in het log staan die nog niet in de snapshot zitten.
var projectAchterstand = func(ctx context.Context, id string, totVolgnummer int64) int64 {
	if n := laatsteVolgnummerVan(ctx, DB, id) - totVolgnummer; n > 0 {
		return n
	}
	return 0
}

// ───────────── cache ─────────────
//
// De openbare link staat in een Confluence- of wikipagina en wordt bij elke paginaweergave
// opnieuw gevraagd (`no-cache`: de lezer wil het actuele diagram). Zonder cache kost elke
// navraag het laden van een profiel en een render, alleen om de ETag te kunnen vergelijken. De
// sleutel bevat de projectversie: een nieuwe snapshot geeft vanzelf een nieuwe tekening. De
// houdbaarheid vangt een nieuwe render-versie op (sidecar en API herstarten normaal samen).

const (
	projectSvgCacheMax  = 256
	projectSvgCacheDuur = 10 * time.Minute
)

type projectSvgItem struct {
	svg     []byte
	vervalt time.Time
}

var projectSvgCache = struct {
	sync.Mutex
	items    map[string]projectSvgItem
	volgorde []string // oudste eerst
}{items: map[string]projectSvgItem{}}

func projectSvgSleutel(v projectRenderVraag, versie int64) string {
	return strings.Join([]string{v.ProjectID, strconv.FormatInt(versie, 10), v.Profiel, v.Diagram, v.Theme, v.IDPrefix}, "\x00")
}

func projectSvgUitCache(sleutel string) []byte {
	projectSvgCache.Lock()
	defer projectSvgCache.Unlock()
	item, ok := projectSvgCache.items[sleutel]
	if !ok || time.Now().After(item.vervalt) {
		return nil
	}
	return item.svg
}

func projectSvgInCache(sleutel string, svg []byte) {
	projectSvgCache.Lock()
	defer projectSvgCache.Unlock()
	if _, bestaat := projectSvgCache.items[sleutel]; !bestaat {
		projectSvgCache.volgorde = append(projectSvgCache.volgorde, sleutel)
		for len(projectSvgCache.volgorde) > projectSvgCacheMax {
			delete(projectSvgCache.items, projectSvgCache.volgorde[0])
			projectSvgCache.volgorde = projectSvgCache.volgorde[1:]
		}
	}
	projectSvgCache.items[sleutel] = projectSvgItem{svg: svg, vervalt: time.Now().Add(projectSvgCacheDuur)}
}

// leegProjectSvgCache: voor de tests.
func leegProjectSvgCache() {
	projectSvgCache.Lock()
	defer projectSvgCache.Unlock()
	projectSvgCache.items = map[string]projectSvgItem{}
	projectSvgCache.volgorde = nil
}

// ───────────── tekenen ─────────────

// projectRenderVraag: welk diagram, en de weergave-opties van taal=studio.
type projectRenderVraag struct {
	ProjectID string
	Profiel   string // leeg = zoek in alle profielen (alleen de ingelogde route)
	Diagram   string // id of naam; leeg mag als het model maar één diagram heeft
	Theme     string
	IDPrefix  string
}

// projectRenderUit is het antwoord van de sidecar (status 200 = SVG, anders problem+json),
// of een eigen probleem (profiel ontbreekt, te groot).
type projectRenderUit struct {
	Status      int
	ContentType string
	Body        []byte
	Stand       *projectStand
}

var errRenderSvcOnbereikbaar = errors.New("render-svc onbereikbaar")

func probleemBody(status int, code, title, detail string) []byte {
	body, _ := json.Marshal(gin.H{"type": "urn:omnium:render:" + code, "title": title, "status": status, "detail": detail})
	return body
}

const probleemType = "application/problem+json; charset=utf-8"

// renderProjectDiagram tekent een diagram uit de snapshot van een project. (nil, nil) = het
// project bestaat niet.
func renderProjectDiagram(ctx context.Context, v projectRenderVraag) (*projectRenderUit, error) {
	stand, err := laadProjectStand(ctx, v.ProjectID)
	if err != nil || stand == nil {
		return nil, err
	}
	if svg := projectSvgUitCache(projectSvgSleutel(v, stand.Versie)); svg != nil {
		return &projectRenderUit{Status: http.StatusOK, ContentType: "image/svg+xml; charset=utf-8", Body: svg, Stand: stand}, nil
	}

	stand, deel, err := laadProjectDeel(ctx, v.ProjectID, v.Profiel)
	if err != nil || stand == nil {
		return nil, err
	}
	if len(deel) == 0 {
		detail := "Dit project heeft geen profielen."
		if v.Profiel != "" {
			detail = fmt.Sprintf("Profiel '%s' zit niet in dit project.", v.Profiel)
		}
		return &projectRenderUit{Status: http.StatusNotFound, ContentType: probleemType, Stand: stand,
			Body: probleemBody(http.StatusNotFound, "niet-gevonden", "Niet gevonden", detail)}, nil
	}

	// Alleen `profielen` en de projectnaam (voor de titel van de SVG) gaan naar de sidecar.
	profielen := deel
	if v.Profiel != "" {
		sleutel, _ := json.Marshal(v.Profiel)
		profielen = json.RawMessage("{" + string(sleutel) + ":" + string(deel) + "}")
	}
	invoer := map[string]any{
		"taal":  "studio",
		"model": map[string]any{"project": map[string]string{"naam": stand.Naam}, "profielen": profielen},
	}
	for sleutel, waarde := range map[string]string{"profiel": v.Profiel, "diagram": v.Diagram, "theme": v.Theme, "idPrefix": v.IDPrefix} {
		if waarde != "" {
			invoer[sleutel] = waarde
		}
	}
	body, err := json.Marshal(invoer)
	if err != nil {
		return nil, err
	}
	if len(body) > renderMaxBytes {
		detail := fmt.Sprintf("Het profiel is groter dan %d bytes; de renderservice neemt het niet aan.", renderMaxBytes)
		if v.Profiel == "" {
			detail = fmt.Sprintf("De profielen van dit project zijn samen groter dan %d bytes. Kies het profiel van het diagram met 'profiel'.", renderMaxBytes)
		}
		return &projectRenderUit{Status: http.StatusRequestEntityTooLarge, ContentType: probleemType, Stand: stand,
			Body: probleemBody(http.StatusRequestEntityTooLarge, "te-groot", "Verzoek te groot", detail)}, nil
	}

	status, ct, uit, err := stuurNaarRenderSvc("/render/svg", body)
	if err != nil {
		fmt.Printf("ERROR: render-svc onbereikbaar (%s): %v\n", renderSvcURL(), err)
		return nil, errRenderSvcOnbereikbaar
	}
	if status == http.StatusOK {
		projectSvgInCache(projectSvgSleutel(v, stand.Versie), uit)
	}
	return &projectRenderUit{Status: status, ContentType: ct, Body: uit, Stand: stand}, nil
}

// ───────────── ingelogd: GET /api/studio/projecten/:id/… ─────────────

// projectDiagramParams: de opties van taal=studio (STUDIO_VELDEN in diagramsvg/studio.js) zonder
// taal en model.
var projectDiagramParams = []string{"profiel", "diagram", "theme", "idPrefix"}

// MaakStudioProjectDiagramSvgHandler — GET /api/studio/projecten/:id/diagram.svg
// Achter `ingelogd` + leesrecht op het project (main.go). Fouten van de sidecar gaan
// ongewijzigd door: wie hier komt, mag het project lezen.
func MaakStudioProjectDiagramSvgHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			schrijfProbleem(c, http.StatusBadRequest, "ongeldige-parameter", "Ongeldige parameter", "Ongeldig project-id.")
			return
		}
		if !controleerQuery(c, projectDiagramParams) {
			return
		}
		v := projectRenderVraag{ProjectID: id, Profiel: strings.TrimSpace(c.Query("profiel")), Diagram: c.Query("diagram"),
			Theme: c.Query("theme"), IDPrefix: c.Query("idPrefix")}
		if v.Profiel != "" && !beeldIDPatroon.MatchString(v.Profiel) {
			schrijfProbleem(c, http.StatusBadRequest, "ongeldige-parameter", "Ongeldige parameter", "'profiel' is geen geldig profiel-id.")
			return
		}
		uit, err := renderProjectDiagram(c.Request.Context(), v)
		if errors.Is(err, errRenderSvcOnbereikbaar) {
			schrijfProbleem(c, http.StatusBadGateway, "render-svc-onbereikbaar", "Renderservice onbereikbaar",
				"De renderservice is tijdelijk niet beschikbaar.")
			return
		}
		if err != nil {
			fmt.Printf("ERROR: %s %s: project lezen: %v\n", c.Request.Method, c.Request.URL.Path, err)
			schrijfProbleem(c, http.StatusInternalServerError, "interne-fout", "Interne fout", "Het project kon niet worden gelezen.")
			return
		}
		if uit == nil {
			schrijfProbleem(c, http.StatusNotFound, "niet-gevonden", "Niet gevonden", "Project niet gevonden.")
			return
		}
		if uit.Status != http.StatusOK {
			antwoordMetSvg(c, uit.Status, uit.ContentType, uit.Body)
			return
		}
		h := c.Writer.Header()
		h.Set("X-Omnium-Project-Versie", strconv.FormatInt(uit.Stand.Versie, 10))
		if n := projectAchterstand(c.Request.Context(), id, uit.Stand.TotVolgnummer); n > 0 {
			h.Set("X-Omnium-Achterstand", strconv.FormatInt(n, 10))
		}
		// Achter inloggen: een gedeelde cache mag dit niet bewaren.
		schrijfProjectSvg(c, uit, "private, no-cache")
	}
}

// schrijfProjectSvg schrijft een getekend projectdiagram met ETag (304 op If-None-Match),
// Last-Modified (de snapshot) en de gegeven Cache-Control.
func schrijfProjectSvg(c *gin.Context, uit *projectRenderUit, cacheControl string) {
	etag := svgETag(uit.Body)
	h := c.Writer.Header()
	h.Set("ETag", etag)
	h.Set("Last-Modified", uit.Stand.Bijgewerkt.UTC().Format(http.TimeFormat))
	h.Set("Cache-Control", cacheControl)
	h.Set("X-Content-Type-Options", "nosniff")
	if inm := c.GetHeader("If-None-Match"); inm != "" && etagKomtOvereen(inm, etag) {
		c.Status(http.StatusNotModified)
		return
	}
	c.Data(http.StatusOK, "image/svg+xml; charset=utf-8", uit.Body)
}

// ProjectWeergave is één diagram in een project, zoals de sidecar het in `weergaven` geeft.
type ProjectWeergave struct {
	ID      string `json:"id"`
	Naam    string `json:"naam"`
	Profiel string `json:"profiel"`
}

// weergavenUitProfielen leest uit `profielen` de diagrammen: id (of de sleutel), naam (of het
// id) en het profiel. Gesorteerd op profiel, naam, id: een JSON-object heeft in Go geen volgorde.
func weergavenUitProfielen(profielen json.RawMessage) ([]ProjectWeergave, error) {
	var ruw map[string]struct {
		Diagrams map[string]struct {
			ID   string `json:"id"`
			Naam string `json:"naam"`
		} `json:"diagrams"`
	}
	if len(profielen) > 0 {
		if err := json.Unmarshal(profielen, &ruw); err != nil {
			return nil, err
		}
	}
	uit := []ProjectWeergave{}
	for profiel, p := range ruw {
		for sleutel, d := range p.Diagrams {
			w := ProjectWeergave{ID: d.ID, Naam: d.Naam, Profiel: profiel}
			if w.ID == "" {
				w.ID = sleutel
			}
			if w.Naam == "" {
				w.Naam = w.ID
			}
			uit = append(uit, w)
		}
	}
	sort.Slice(uit, func(i, j int) bool {
		a, b := uit[i], uit[j]
		if a.Profiel != b.Profiel {
			return a.Profiel < b.Profiel
		}
		if a.Naam != b.Naam {
			return a.Naam < b.Naam
		}
		return a.ID < b.ID
	})
	return uit, nil
}

// MaakStudioProjectViewsHandler — GET /api/studio/projecten/:id/views.json: de diagrammen van
// het project (voor een keuzelijst), en hoe actueel de snapshot is. Go leest dit zelf uit de
// snapshot; de sidecar is hier niet nodig, dus ook geen grens van 5 MB.
func MaakStudioProjectViewsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			schrijfProbleem(c, http.StatusBadRequest, "ongeldige-parameter", "Ongeldige parameter", "Ongeldig project-id.")
			return
		}
		if !controleerQuery(c) {
			return
		}
		stand, deel, err := laadProjectDeel(c.Request.Context(), id, "")
		if err != nil {
			fmt.Printf("ERROR: %s %s: project lezen: %v\n", c.Request.Method, c.Request.URL.Path, err)
			schrijfProbleem(c, http.StatusInternalServerError, "interne-fout", "Interne fout", "Het project kon niet worden gelezen.")
			return
		}
		if stand == nil {
			schrijfProbleem(c, http.StatusNotFound, "niet-gevonden", "Niet gevonden", "Project niet gevonden.")
			return
		}
		weergaven, err := weergavenUitProfielen(deel)
		if err != nil {
			schrijfProbleem(c, http.StatusUnprocessableEntity, "ongeldig-model", "Ongeldig model", "De profielen van dit project zijn niet te lezen.")
			return
		}
		namen := make([]string, 0, len(weergaven))
		for _, w := range weergaven {
			namen = append(namen, w.Naam)
		}
		c.Header("Cache-Control", "private, no-cache")
		c.JSON(http.StatusOK, gin.H{
			"naam": stand.Naam, "versie": stand.Versie, "bijgewerkt": stand.Bijgewerkt.UTC().Format(time.RFC3339Nano),
			"tot_volgnummer":     stand.TotVolgnummer,
			"laatste_volgnummer": stand.TotVolgnummer + projectAchterstand(c.Request.Context(), id, stand.TotVolgnummer),
			"weergaven":          weergaven, "diagrammen": namen, "domeinen": []string{},
		})
	}
}

// ───────────── openbaar: GET /api/beeld/<token>.svg ─────────────

// laadSvgLink zoekt een niet-ingetrokken link van soort "svg". Nil = geen (of ingetrokken).
var laadSvgLink = func(ctx context.Context, token string) (*model.StudioGedeeldBeeld, error) {
	b := new(model.StudioGedeeldBeeld)
	err := DB.NewSelect().Model(b).ExcludeColumn("inhoud").
		Where("token = ? AND soort = ? AND ingetrokken_op IS NULL", token, beeldSoortSvg).Scan(ctx)
	if isNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return b, nil
}

// svgLinkParams: de link legt project, profiel en diagram vast; alleen de opmaak is te kiezen.
var svgLinkParams = []string{"theme", "idPrefix"}

// beeldSvgOpenbaar — GET /api/beeld/<token>.svg, aangeroepen door MaakBeeldOpenbaarHandler (die
// de kopregels nosniff, noindex en Cross-Origin-Resource-Policy al heeft gezet).
//
// Het token geeft toegang tot dat ene diagram en niets anders. Daarom gaat een fout van de
// sidecar hier niet door: zijn 404 noemt de andere diagrammen van het profiel ("keuzes"), en een
// 422 noemt een element. De lezer krijgt een kale melding; het detail staat in de log.
func beeldSvgOpenbaar(c *gin.Context, token string) {
	if !beeldTokenPatroon.MatchString(token) {
		c.Status(http.StatusNotFound)
		return
	}
	if !controleerQuery(c, svgLinkParams) {
		return
	}
	ctx := c.Request.Context()
	b, err := laadSvgLink(ctx, token)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	if b == nil {
		c.Status(http.StatusNotFound)
		return
	}
	uit, err := renderProjectDiagram(ctx, projectRenderVraag{ProjectID: b.ProjectID, Profiel: b.ProfielID, Diagram: b.DiagramID,
		Theme: c.Query("theme"), IDPrefix: c.Query("idPrefix")})
	if errors.Is(err, errRenderSvcOnbereikbaar) {
		schrijfProbleem(c, http.StatusBadGateway, "render-svc-onbereikbaar", "Renderservice onbereikbaar",
			"De renderservice is tijdelijk niet beschikbaar.")
		return
	}
	if err != nil {
		fmt.Printf("ERROR: GET /api/beeld/….svg: project lezen: %v\n", err)
		c.Status(http.StatusInternalServerError)
		return
	}
	if uit == nil {
		c.Status(http.StatusNotFound)
		return
	}
	if uit.Status != http.StatusOK {
		fmt.Printf("WARN: gedeelde SVG-link (project %s, profiel %s, diagram %s): %d %s\n", b.ProjectID, b.ProfielID, b.DiagramID, uit.Status, string(uit.Body))
		switch {
		case uit.Status == http.StatusNotFound:
			schrijfProbleem(c, http.StatusNotFound, "niet-gevonden", "Niet gevonden", "Dit diagram is er niet (meer).")
		case uit.Status == http.StatusBadRequest:
			// Een ongeldige waarde voor theme of idPrefix: dat mag de lezer weten, zonder het detail.
			schrijfProbleem(c, http.StatusBadRequest, "ongeldige-parameter", "Ongeldige parameter", "Ongeldige waarde voor 'theme' of 'idPrefix'.")
		case uit.Status >= 500:
			schrijfProbleem(c, http.StatusBadGateway, "render-svc-fout", "Renderservice gaf een fout", "Het diagram kon niet worden getekend.")
		default:
			schrijfProbleem(c, http.StatusUnprocessableEntity, "niet-te-tekenen", "Niet te tekenen", "Het diagram kon niet worden getekend.")
		}
		return
	}
	// Elke keer even navragen, zoals bij een actueel plaatje: een 304 kost bijna niets (cache
	// hierboven), en een nieuwe snapshot is meteen zichtbaar bij wie de pagina opnieuw laadt.
	schrijfProjectSvg(c, uit, "public, no-cache")
}
