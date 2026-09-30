// Package handlers — render_svg.go
//
// Render-API voor modeldiagrammen (opdracht van Imprint, docs/RENDER_API.md).
// De Go-API is de publieke voorkant; het tekenen gebeurt in de Node-sidecar
// render-svc (bitemp_register_v06/render-svc), die dezelfde pure tekenaar
// draait als Studio (web/vite/src/diagramsvg). Zo bestaat er één tekenaar.
//
//	POST /api/render/svg   body { taal, model | code, diagram, domein, … }
//	                       → image/svg+xml, of application/problem+json
//
// Renders zijn puur: dezelfde invoer geeft byte-gelijke SVG. De ETag is
// daarom een hash van de SVG zelf; If-None-Match geeft 304.
package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const renderMaxBytes = 5 << 20

var renderClient = &http.Client{Timeout: 20 * time.Second}

// renderSvcURL is het interne adres van de sidecar (RENDER_SVC_URL).
func renderSvcURL() string {
	if u := strings.TrimSpace(os.Getenv("RENDER_SVC_URL")); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://127.0.0.1:8095"
}

// schrijfProbleem stuurt een RFC 9457 problem+json, in dezelfde vorm als de sidecar.
func schrijfProbleem(c *gin.Context, status int, code, title, detail string) {
	body, _ := json.Marshal(gin.H{
		"type":   "urn:omnium:render:" + code,
		"title":  title,
		"status": status,
		"detail": detail,
	})
	c.Data(status, "application/problem+json; charset=utf-8", body)
}

// svgETag is een sterke ETag over de SVG-bytes.
func svgETag(svg []byte) string {
	h := sha256.Sum256(svg)
	return `"` + hex.EncodeToString(h[:12]) + `"`
}

// etagKomtOvereen ondersteunt een lijst in If-None-Match en "*".
func etagKomtOvereen(ifNoneMatch, etag string) bool {
	for _, deel := range strings.Split(ifNoneMatch, ",") {
		d := strings.TrimSpace(deel)
		d = strings.TrimPrefix(d, "W/")
		if d == "*" || d == etag {
			return true
		}
	}
	return false
}

// stuurNaarRenderSvc post body naar de sidecar en geeft status, content-type en body terug.
func stuurNaarRenderSvc(pad string, body []byte) (int, string, []byte, error) {
	resp, err := renderClient.Post(renderSvcURL()+pad, "application/json", bytes.NewReader(body))
	if err != nil {
		return 0, "", nil, err
	}
	defer resp.Body.Close()
	uit, err := io.ReadAll(io.LimitReader(resp.Body, 50<<20))
	if err != nil {
		return 0, "", nil, err
	}
	return resp.StatusCode, resp.Header.Get("Content-Type"), uit, nil
}

// antwoordMetSvg schrijft het antwoord van de sidecar door; bij 200 met ETag/304.
func antwoordMetSvg(c *gin.Context, status int, contentType string, body []byte) {
	if status != http.StatusOK {
		if contentType == "" {
			contentType = "application/problem+json; charset=utf-8"
		}
		c.Data(status, contentType, body)
		return
	}
	etag := svgETag(body)
	c.Header("ETag", etag)
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Content-Type-Options", "nosniff")
	if inm := c.GetHeader("If-None-Match"); inm != "" && etagKomtOvereen(inm, etag) {
		c.Status(http.StatusNotModified)
		return
	}
	c.Data(http.StatusOK, "image/svg+xml; charset=utf-8", body)
}

// MaakRenderSvgHandler — POST /api/render/svg (model-code). Publiek: rendert
// alleen wat de aanroeper zelf meestuurt, leest geen registerdata.
func MaakRenderSvgHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, err := io.ReadAll(io.LimitReader(c.Request.Body, renderMaxBytes+1))
		if err != nil {
			schrijfProbleem(c, http.StatusBadRequest, "ongeldige-body", "Ongeldige body", "De body kon niet worden gelezen.")
			return
		}
		if len(body) > renderMaxBytes {
			schrijfProbleem(c, http.StatusRequestEntityTooLarge, "te-groot", "Verzoek te groot",
				fmt.Sprintf("Het verzoek is groter dan %d bytes.", renderMaxBytes))
			return
		}
		status, ct, uit, err := stuurNaarRenderSvc("/render/svg", body)
		if err != nil {
			fmt.Printf("ERROR: render-svc onbereikbaar (%s): %v\n", renderSvcURL(), err)
			schrijfProbleem(c, http.StatusBadGateway, "render-svc-onbereikbaar", "Renderservice onbereikbaar",
				"De renderservice is tijdelijk niet beschikbaar.")
			return
		}
		antwoordMetSvg(c, status, ct, uit)
	}
}

// ───────────── model-link: GET /api/models/:naam/… ─────────────
//
// Adres (besluit Mark 30-09): naam + versie + tijdstip. Het model komt uit
// schema_versies (model_naam, model_versie, tijdstip): de nieuwste rij met die
// naam, optioneel die versie, optioneel met tijdstip <= asOf. `domein` of
// `diagram` kiest daarna de weergave.
//
//	GET /api/models/:naam/diagram.svg?versie=&asOf=&domein=|diagram=&…
//	GET /api/models/:naam/views.json?versie=&asOf=

// renderQueryParams zijn de weergave-opties die 1-op-1 naar de sidecar gaan.
var renderQueryParams = []string{"diagram", "domein", "entiteiten", "richting", "theme", "velden", "afhankelijkheden", "idPrefix", "linkPattern"}

// modelSelectieParams kiezen welke opgeslagen modelversie wordt gebruikt.
var modelSelectieParams = []string{"versie", "asOf"}

// gevondenModel is de opgeslagen modelversie waaruit gerenderd wordt.
type gevondenModel struct {
	Naam     string
	Versie   string
	Tijdstip time.Time
	JSON     json.RawMessage
}

// laadModelVersie zoekt de modelversie; een variabele zodat tests zonder DB kunnen.
var laadModelVersie = func(c *gin.Context, naam, versie string, asOf *time.Time) (*gevondenModel, error) {
	var rij struct {
		ModelNaam   string          `bun:"model_naam"`
		ModelVersie string          `bun:"model_versie"`
		Tijdstip    time.Time       `bun:"tijdstip"`
		SchemaJSON  json.RawMessage `bun:"schema_json"`
	}
	q := DB.NewSelect().
		Table("schema_versies").
		Column("model_naam", "model_versie", "tijdstip", "schema_json").
		Where("model_naam = ?", naam)
	if versie != "" {
		q = q.Where("model_versie = ?", versie)
	}
	if asOf != nil {
		q = q.Where("tijdstip <= ?", *asOf)
	}
	err := q.OrderExpr("tijdstip DESC, id DESC").Limit(1).Scan(c.Request.Context(), &rij)
	if isNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &gevondenModel{Naam: rij.ModelNaam, Versie: rij.ModelVersie, Tijdstip: rij.Tijdstip, JSON: rij.SchemaJSON}, nil
}

// controleerQuery geeft een 400 bij onbekende parameters (afspraak met Imprint).
func controleerQuery(c *gin.Context, toegestaan ...[]string) bool {
	mag := map[string]bool{}
	for _, lijst := range toegestaan {
		for _, k := range lijst {
			mag[k] = true
		}
	}
	var onbekend []string
	for k := range c.Request.URL.Query() {
		if !mag[k] {
			onbekend = append(onbekend, k)
		}
	}
	if len(onbekend) > 0 {
		sort.Strings(onbekend)
		schrijfProbleem(c, http.StatusBadRequest, "ongeldige-parameter", "Ongeldige parameter",
			"Onbekende parameter(s): "+strings.Join(onbekend, ", ")+".")
		return false
	}
	return true
}

// zoekModel leest versie/asOf, haalt het model op en schrijft zelf een fout als dat nodig is.
func zoekModel(c *gin.Context) *gevondenModel {
	naam := c.Param("naam")
	versie := strings.TrimSpace(c.Query("versie"))
	var asOf *time.Time
	if raw := strings.TrimSpace(c.Query("asOf")); raw != "" {
		t, err := time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			schrijfProbleem(c, http.StatusBadRequest, "ongeldige-parameter", "Ongeldige parameter",
				"'asOf' moet een tijdstip in RFC 3339 zijn, bijvoorbeeld 2026-09-30T12:00:00Z.")
			return nil
		}
		asOf = &t
	}
	m, err := laadModelVersie(c, naam, versie, asOf)
	if err != nil {
		fmt.Printf("ERROR: %s %s: model ophalen: %v\n", c.Request.Method, c.Request.URL.Path, err)
		schrijfProbleem(c, http.StatusInternalServerError, "interne-fout", "Interne fout", "Het model kon niet worden opgehaald.")
		return nil
	}
	if m == nil {
		detail := fmt.Sprintf("Geen model '%s'", naam)
		if versie != "" {
			detail += fmt.Sprintf(" met versie '%s'", versie)
		}
		if asOf != nil {
			detail += " op " + asOf.Format(time.RFC3339)
		}
		schrijfProbleem(c, http.StatusNotFound, "niet-gevonden", "Niet gevonden", detail+".")
		return nil
	}
	return m
}

// MaakModelDiagramSvgHandler — GET /api/models/:naam/diagram.svg (model-link).
func MaakModelDiagramSvgHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !controleerQuery(c, renderQueryParams, modelSelectieParams) {
			return
		}
		m := zoekModel(c)
		if m == nil {
			return
		}
		invoer := map[string]any{"taal": "v3", "model": m.JSON}
		for _, k := range renderQueryParams {
			if v, ok := c.GetQuery(k); ok {
				invoer[k] = v
			}
		}
		body, _ := json.Marshal(invoer)
		status, ct, uit, err := stuurNaarRenderSvc("/render/svg", body)
		if err != nil {
			fmt.Printf("ERROR: render-svc onbereikbaar (%s): %v\n", renderSvcURL(), err)
			schrijfProbleem(c, http.StatusBadGateway, "render-svc-onbereikbaar", "Renderservice onbereikbaar",
				"De renderservice is tijdelijk niet beschikbaar.")
			return
		}
		if status == http.StatusOK {
			c.Header("Last-Modified", m.Tijdstip.UTC().Format(http.TimeFormat))
		}
		antwoordMetSvg(c, status, ct, uit)
	}
}

// MaakModelViewsHandler — GET /api/models/:naam/views.json: de keuzes voor de
// editor van Imprint, plus welke opgeslagen versie is gebruikt.
func MaakModelViewsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !controleerQuery(c, modelSelectieParams) {
			return
		}
		m := zoekModel(c)
		if m == nil {
			return
		}
		body, _ := json.Marshal(map[string]any{"taal": "v3", "model": m.JSON})
		status, ct, uit, err := stuurNaarRenderSvc("/views", body)
		if err != nil {
			schrijfProbleem(c, http.StatusBadGateway, "render-svc-onbereikbaar", "Renderservice onbereikbaar",
				"De renderservice is tijdelijk niet beschikbaar.")
			return
		}
		if status != http.StatusOK {
			c.Data(status, ct, uit)
			return
		}
		var views map[string]any
		if err := json.Unmarshal(uit, &views); err != nil {
			schrijfProbleem(c, http.StatusBadGateway, "render-svc-fout", "Renderservice gaf een ongeldig antwoord", "Ongeldig antwoord van de renderservice.")
			return
		}
		views["naam"] = m.Naam
		views["versie"] = m.Versie
		views["tijdstip"] = m.Tijdstip.UTC().Format(time.RFC3339Nano)
		c.JSON(http.StatusOK, views)
	}
}
