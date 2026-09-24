package dynql

// handler.go bevat de Gin HTTP handlers voor het dynamische GraphQL endpoint.
// - GraphQLHandler: verwerkt POST/GET requests met graphql.Do()
// - PlaygroundHandler: serveert een GraphQL Playground UI

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/ast"
	"github.com/graphql-go/graphql/language/parser"
)

// MutatieGuard beslist of een verzoek met een mutatie door mag. Bij false heeft de guard
// het verzoek zelf al afgebroken (401/403). Zie middleware.ControleerRol.
type MutatieGuard func(c *gin.Context) bool

// GraphQLHandler retourneert een Gin handler die GraphQL queries verwerkt.
//
// Lezen en schrijven zijn op routeniveau niet te scheiden (één endpoint), daarom kijkt de
// handler naar het document zelf: bevat het een mutatie, dan beslist magMuteren; queries
// gaan zonder controle door, net als de GET-routes van REST (openbaar lezen). Zo kan de
// publicatiepagina zonder inloggen een detail-template via GraphQL ophalen.
// magMuteren == nil betekent: geen controle.
//
// Naast een ad-hoc `query` accepteert de handler een `documentId`: de naam van een opgeslagen
// QueryDefinitie (persisted query, zie opgeslagen_documenten.go). Een document dat niet
// publiek is vereist magIntern (nil = geen controle).
//
// magLezen is de leespoort voor ad-hoc queries (middleware.MagLezen): een query die geen
// documentId en geen introspectie is, leest registerdata en moet erdoor. Introspectie
// (alleen __schema/__type op rootniveau) blijft vrij: de publicatiepagina heeft het nodig
// om template-paden op het schema af te stemmen, en het onthult niets dat /api/viz/schema
// niet ook toont. nil = geen controle.
func GraphQLHandler(schema *graphql.Schema, magMuteren, magIntern, magLezen MutatieGuard) gin.HandlerFunc {
	return func(c *gin.Context) {
		var params struct {
			Query         string                 `json:"query"`
			OperationName string                 `json:"operationName"`
			Variables     map[string]interface{} `json:"variables"`
			DocumentID    string                 `json:"documentId"`
		}

		switch c.Request.Method {
		case http.MethodPost:
			if err := c.ShouldBindJSON(&params); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON in request body: " + err.Error()})
				return
			}
		case http.MethodGet:
			params.Query = c.Query("query")
			params.OperationName = c.Query("operationName")
			params.DocumentID = c.Query("documentId")
			if vars := c.Query("variables"); vars != "" {
				_ = json.Unmarshal([]byte(vars), &params.Variables)
			}
		default:
			c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "Alleen GET en POST worden ondersteund"})
			return
		}

		if params.DocumentID != "" {
			if params.Query != "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "query en documentId sluiten elkaar uit"})
				return
			}
			voerOpgeslagenDocumentUit(c, schema, params.DocumentID, params.OperationName, params.Variables, magIntern)
			return
		}

		if params.Query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "query of documentId is verplicht"})
			return
		}

		if magMuteren != nil && BevatMutatie(params.Query) && !magMuteren(c) {
			return
		}
		if magLezen != nil && !IsIntrospectieDocument(params.Query) && !magLezen(c) {
			return
		}

		result := graphql.Do(graphql.Params{
			Schema:         *schema,
			RequestString:  params.Query,
			OperationName:  params.OperationName,
			VariableValues: params.Variables,
			Context:        c.Request.Context(),
		})

		c.JSON(http.StatusOK, result)
	}
}

// voerOpgeslagenDocumentUit zoekt het document op naam en voert het uit met de variabelen
// van de aanroeper. Statuscodes:
//   - 404 onbekend, concept, buiten de levensduur, of zonder geldig document (bewust niet
//     onderscheiden: een klad is niet zichtbaar);
//   - 410 ingetrokken (status inactief), met de reden voor de afnemer;
//   - 401/403 intern document zonder toereikende rol (via magIntern);
//   - 400 het opgeslagen document bevat een mutatie;
//   - 501 uitvoeren op naam staat uit (contract klopt niet met het model).
func voerOpgeslagenDocumentUit(c *gin.Context, schema *graphql.Schema, naam, operationName string, variabelen map[string]interface{}, magIntern MutatieGuard) {
	if ok, reden := OpgeslagenDocumentenBeschikbaar(); !ok {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "uitvoeren op naam staat uit: " + reden})
		return
	}
	d, err := ZoekOpgeslagenDocument(c.Request.Context(), naam, time.Now())
	if err != nil {
		fmt.Printf("ERROR: opgeslagen document %q opzoeken: %v\n", naam, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "opgeslagen document opzoeken mislukt"})
		return
	}
	nietBeschikbaar := func() {
		c.JSON(http.StatusNotFound, gin.H{"error": "onbekend of niet beschikbaar document", "documentId": naam})
	}
	if d == nil {
		nietBeschikbaar()
		return
	}
	switch d.Status {
	case opgeslagenStatusActief:
	case opgeslagenStatusInactief:
		c.JSON(http.StatusGone, gin.H{"error": "document ingetrokken", "documentId": naam, "reden": d.Reden})
		return
	default: // concept, of geen geldige status
		nietBeschikbaar()
		return
	}
	if d.Document == "" {
		fmt.Printf("WARN: QueryDefinitie %d %q is actief maar heeft geen geldig document\n", d.ID, naam)
		nietBeschikbaar()
		return
	}
	if !d.IsPubliek() && magIntern != nil && !magIntern(c) {
		return // de guard heeft het verzoek al afgebroken (401/403)
	}
	if BevatMutatie(d.Document) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "opgeslagen document bevat een mutatie", "documentId": naam})
		return
	}
	result := graphql.Do(graphql.Params{
		Schema:         *schema,
		RequestString:  d.Document,
		OperationName:  operationName,
		VariableValues: variabelen,
		Context:        c.Request.Context(),
	})
	c.JSON(http.StatusOK, result)
}

// ValideerDocumentHandler retourneert een handler die een GraphQL-document tegen het schema
// valideert zonder het uit te voeren: POST {"document": "…"} → {"geldig": bool, "fouten": […]}.
// Bedoeld voor de frontend om een QueryDefinitie te toetsen vóór het opslaan; een mutatie
// telt als fout (opgeslagen documenten zijn alleen-lezen). Generiek: kent geen typenamen.
func ValideerDocumentHandler(schema *graphql.Schema) gin.HandlerFunc {
	return func(c *gin.Context) {
		var params struct {
			Document string `json:"document"`
		}
		if err := c.ShouldBindJSON(&params); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON in request body: " + err.Error()})
			return
		}
		if params.Document == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "document is verplicht"})
			return
		}
		fouten := valideerDocument(schema, params.Document)
		if fouten == nil {
			fouten = []string{}
		}
		c.JSON(http.StatusOK, gin.H{"geldig": len(fouten) == 0, "fouten": fouten})
	}
}

// IsIntrospectieDocument meldt of een document uitsluitend introspectie is: alleen
// query-operaties waarvan elke rootselectie een veld is dat met "__" begint (__schema,
// __type, __typename). Een fragment-spread op rootniveau of een gewoon veld maakt het een
// data-query. Een document dat niet te parsen is telt niet als introspectie (en faalt
// verderop op de parse-fout).
func IsIntrospectieDocument(query string) bool {
	doc, err := parser.Parse(parser.ParseParams{Source: query})
	if err != nil {
		return false
	}
	gezien := false
	for _, def := range doc.Definitions {
		op, ok := def.(*ast.OperationDefinition)
		if !ok {
			continue // fragmentdefinities: onschuldig zolang ze op rootniveau niet gespread worden
		}
		if op.Operation != ast.OperationTypeQuery || op.SelectionSet == nil {
			return false
		}
		for _, sel := range op.SelectionSet.Selections {
			veld, ok := sel.(*ast.Field)
			if !ok || veld.Name == nil || !strings.HasPrefix(veld.Name.Value, "__") {
				return false
			}
			gezien = true
		}
	}
	return gezien
}

// BevatMutatie meldt of een GraphQL-document een mutatie-operatie bevat. Bewust ruim: één
// mutatie in het document is genoeg, ongeacht operationName, zodat een document met een query
// én een mutatie niet via de operationName langs de controle kan. Een document dat niet te
// parsen is, wordt door graphql.Do toch niet uitgevoerd (parse-fout) en telt als geen mutatie.
func BevatMutatie(query string) bool {
	doc, err := parser.Parse(parser.ParseParams{Source: query})
	if err != nil {
		return false
	}
	for _, def := range doc.Definitions {
		if op, ok := def.(*ast.OperationDefinition); ok && op.Operation == ast.OperationTypeMutation {
			return true
		}
	}
	return false
}

// PlaygroundHandler serveert een simpele GraphQL Playground UI.
func PlaygroundHandler(endpoint string) gin.HandlerFunc {
	tmpl := template.Must(template.New("playground").Parse(playgroundHTML))

	return func(c *gin.Context) {
		c.Header("Content-Type", "text/html; charset=utf-8")
		_ = tmpl.Execute(c.Writer, map[string]string{
			"Endpoint": endpoint,
		})
	}
}

const playgroundHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GraphiQL — Bitemp Register v06</title>
  <link rel="stylesheet" href="https://unpkg.com/graphiql@3/graphiql.min.css" />
  <style>
    body { margin: 0; height: 100vh; overflow: hidden; }
    #graphiql { height: 100vh; }
  </style>
</head>
<body>
  <div id="graphiql"></div>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/graphiql@3/graphiql.min.js"></script>
  <script>
    const fetcher = GraphiQL.createFetcher({ url: '{{.Endpoint}}' });
    ReactDOM.createRoot(document.getElementById('graphiql')).render(
      React.createElement(GraphiQL, {
        fetcher: fetcher,
        defaultEditorToolsVisibility: true
      })
    );
  </script>
</body>
</html>`
