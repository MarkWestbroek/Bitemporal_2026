package handlers

// openapi_handler.go — HTTP handlers voor het serveren van OpenAPI 3.1.0 specificaties.
//
// Conform NL API Strategie (ADR 2.1.0):
//   - /core/publish-openapi: publiceer op /openapi.json en /openapi.yaml
//   - /core/transport/cors: CORS Access-Control-Allow-Origin: * voor spec-endpoints

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

// MaakOpenAPIHandler retourneert een handler die de geconsolideerde OpenAPI spec serveert.
// Content negotiation: JSON standaard, YAML als Accept: application/x-yaml of text/yaml.
func MaakOpenAPIHandler(formaatHint string) gin.HandlerFunc {
	return func(c *gin.Context) {
		doc := GenereerOpenAPIDocument("")
		serveerOASDocument(c, doc, formaatHint)
	}
}

// MaakOpenAPIDomeinHandler retourneert een handler die een domein-specifieke spec serveert.
// Het domein-param kan een suffix .json of .yaml bevatten (bijv. "np-loc.yaml").
func MaakOpenAPIDomeinHandler(formaatHint string) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := c.Param("domein")
		if raw == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "domein parameter ontbreekt"})
			return
		}

		// Detecteer formaat uit extensie
		domein := raw
		if strings.HasSuffix(raw, ".yaml") || strings.HasSuffix(raw, ".yml") {
			formaatHint = "yaml"
			domein = strings.TrimSuffix(strings.TrimSuffix(raw, ".yaml"), ".yml")
		} else if strings.HasSuffix(raw, ".json") {
			formaatHint = "json"
			domein = strings.TrimSuffix(raw, ".json")
		}

		// Controleer of het domein bestaat
		domeinen := BeschikbareDomeinen()
		gevonden := false
		for _, d := range domeinen {
			if d == domein {
				gevonden = true
				break
			}
		}
		if !gevonden {
			c.JSON(http.StatusNotFound, gin.H{
				"error":                "domein niet gevonden",
				"beschikbare_domeinen": domeinen,
			})
			return
		}

		doc := GenereerOpenAPIDocument(domein)
		serveerOASDocument(c, doc, formaatHint)
	}
}

// MaakOpenAPIDomeinenLijstHandler retourneert een handler die de beschikbare domeinen opsomt.
func MaakOpenAPIDomeinenLijstHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		domeinen := BeschikbareDomeinen()
		links := make([]oasMap, 0, len(domeinen))
		for _, d := range domeinen {
			links = append(links, oasMap{
				"domein": d,
				"json":   "/openapi/" + d + ".json",
				"yaml":   "/openapi/" + d + ".yaml",
			})
		}
		c.JSON(http.StatusOK, gin.H{
			"domeinen":       domeinen,
			"geconsolideerd": oasMap{"json": "/openapi.json", "yaml": "/openapi.yaml"},
			"per_domein":     links,
		})
	}
}

// serveerOASDocument stuurt het OAS document als JSON of YAML, afhankelijk van formaatHint
// of het Accept-header.
func serveerOASDocument(c *gin.Context, doc oasMap, formaatHint string) {
	// ADR /core/transport/cors: spec-endpoints moeten voor iedereen toegankelijk zijn
	c.Header("Access-Control-Allow-Origin", "*")
	// ADR /core/version-header
	c.Header("API-Version", APIVersion)

	if wilYAML(c, formaatHint) {
		yamlBytes, err := yaml.Marshal(doc)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "YAML serialisatie mislukt: " + err.Error()})
			return
		}
		c.Data(http.StatusOK, "application/x-yaml; charset=utf-8", yamlBytes)
		return
	}

	// JSON (standaard, verplicht per ADR)
	jsonBytes, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "JSON serialisatie mislukt: " + err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", jsonBytes)
}

func wilYAML(c *gin.Context, formaatHint string) bool {
	if formaatHint == "yaml" {
		return true
	}
	accept := c.GetHeader("Accept")
	return strings.Contains(accept, "application/x-yaml") ||
		strings.Contains(accept, "text/yaml") ||
		strings.Contains(accept, "application/yaml")
}

// ──────────────────────────────────────────────────────────────────────
// Swagger UI en ReDoc — interactieve API-documentatie
// ──────────────────────────────────────────────────────────────────────

// MaakSwaggerUIHandler serveert een Swagger UI pagina die de OAS spec laadt.
// De specURL parameter bepaalt welke spec geladen wordt (bijv. "/openapi.json").
func MaakSwaggerUIHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Optioneel: ?spec=<url> om een andere spec te laden
		specURL := c.DefaultQuery("spec", "/openapi.json")

		// Bouw dropdown-opties voor domein-specs
		domeinen := BeschikbareDomeinen()
		domeinOpties := ""
		for _, d := range domeinen {
			domeinOpties += `<option value="/openapi/` + d + `.json">` + d + `</option>` + "\n"
		}

		html := `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>API Documentatie — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; }
    .topbar { display: none !important; }
    #spec-selector {
      background: #1b1b1b; color: #fff; padding: 10px 20px;
      display: flex; align-items: center; gap: 12px; font-family: sans-serif; font-size: 14px;
    }
    #spec-selector select {
      padding: 4px 8px; border-radius: 4px; border: 1px solid #555;
      background: #333; color: #fff; font-size: 14px;
    }
    #spec-selector a { color: #89bf04; text-decoration: none; margin-left: 16px; }
    #spec-selector a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div id="spec-selector">
    <label for="spec-select">Spec:</label>
    <select id="spec-select" onchange="loadSpec(this.value)">
      <option value="/openapi.json"` + selectedAttr(specURL, "/openapi.json") + `>Geconsolideerd</option>
      ` + domeinOpties + `
    </select>
    <a href="/openapi.json" target="_blank">JSON</a>
    <a href="/openapi.yaml" target="_blank">YAML</a>
    <a href="/redoc" target="_blank">ReDoc</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    let ui;
    function loadSpec(url) {
      if (ui) ui.specActions.updateUrl(url);
      else initUI(url);
    }
    function initUI(url) {
      ui = SwaggerUIBundle({
        url: url,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout"
      });
    }
    initUI("` + specURL + `");
  </script>
</body>
</html>`
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
	}
}

// MaakReDocHandler serveert een ReDoc pagina die de OAS spec laadt.
func MaakReDocHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		specURL := c.DefaultQuery("spec", "/openapi.json")

		domeinen := BeschikbareDomeinen()
		domeinOpties := ""
		for _, d := range domeinen {
			domeinOpties += `<option value="/openapi/` + d + `.json">` + d + `</option>` + "\n"
		}

		html := `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>API Documentatie — ReDoc</title>
  <style>
    body { margin: 0; }
    #spec-selector {
      background: #263238; color: #fff; padding: 10px 20px;
      display: flex; align-items: center; gap: 12px; font-family: sans-serif; font-size: 14px;
      position: sticky; top: 0; z-index: 100;
    }
    #spec-selector select {
      padding: 4px 8px; border-radius: 4px; border: 1px solid #555;
      background: #37474f; color: #fff; font-size: 14px;
    }
    #spec-selector a { color: #89bf04; text-decoration: none; margin-left: 16px; }
    #spec-selector a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div id="spec-selector">
    <label for="spec-select">Spec:</label>
    <select id="spec-select" onchange="location.href='/redoc?spec='+this.value">
      <option value="/openapi.json"` + selectedAttr(specURL, "/openapi.json") + `>Geconsolideerd</option>
      ` + domeinOpties + `
    </select>
    <a href="/openapi.json" target="_blank">JSON</a>
    <a href="/openapi.yaml" target="_blank">YAML</a>
    <a href="/swagger" target="_blank">Swagger UI</a>
  </div>
  <redoc spec-url='` + specURL + `'></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
	}
}

func selectedAttr(current, value string) string {
	if current == value {
		return ` selected`
	}
	return ""
}
