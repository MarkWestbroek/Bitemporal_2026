package dynql

// handler.go bevat de Gin HTTP handlers voor het dynamische GraphQL endpoint.
// - GraphQLHandler: verwerkt POST/GET requests met graphql.Do()
// - PlaygroundHandler: serveert een GraphQL Playground UI

import (
	"encoding/json"
	"html/template"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/graphql-go/graphql"
)

// GraphQLHandler retourneert een Gin handler die GraphQL queries verwerkt.
func GraphQLHandler(schema *graphql.Schema) gin.HandlerFunc {
	return func(c *gin.Context) {
		var params struct {
			Query         string                 `json:"query"`
			OperationName string                 `json:"operationName"`
			Variables     map[string]interface{} `json:"variables"`
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
			if vars := c.Query("variables"); vars != "" {
				_ = json.Unmarshal([]byte(vars), &params.Variables)
			}
		default:
			c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "Alleen GET en POST worden ondersteund"})
			return
		}

		if params.Query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter is verplicht"})
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
