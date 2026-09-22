package dynql_test

// Tests voor de autorisatie op /graphql/query (22-09-2026): queries openbaar, een document
// met een mutatie vereist rol "editor". Zie docs/AUTH_DEVELOPER_GUIDE.md §3.4.

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/graphql-go/graphql"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
)

func TestBevatMutatie(t *testing.T) {
	tests := []struct {
		naam     string
		query    string
		verwacht bool
	}{
		{"korte query", `{ ping }`, false},
		{"benoemde query", `query Q { ping }`, false},
		{"mutatie", `mutation { zet }`, true},
		{"benoemde mutatie", `mutation M { zet }`, true},
		{"query én mutatie", `query Q { ping } mutation M { zet }`, true},
		{"fragment + query", `fragment F on Query { ping } query { ...F }`, false},
		{"parse-fout", `mutation {`, false},
	}
	for _, tt := range tests {
		if got := dynql.BevatMutatie(tt.query); got != tt.verwacht {
			t.Errorf("%s: BevatMutatie(%q) = %v, verwacht %v", tt.naam, tt.query, got, tt.verwacht)
		}
	}
}

// testSchema: één query-veld en één mutatie-veld; de mutatie telt hoe vaak ze draaide.
func testSchema(t *testing.T, mutaties *int) *graphql.Schema {
	t.Helper()
	schema, err := graphql.NewSchema(graphql.SchemaConfig{
		Query: graphql.NewObject(graphql.ObjectConfig{Name: "Query", Fields: graphql.Fields{
			"ping": &graphql.Field{Type: graphql.String, Resolve: func(graphql.ResolveParams) (any, error) { return "pong", nil }},
		}}),
		Mutation: graphql.NewObject(graphql.ObjectConfig{Name: "Mutation", Fields: graphql.Fields{
			"zet": &graphql.Field{Type: graphql.String, Resolve: func(graphql.ResolveParams) (any, error) { *mutaties++; return "gezet", nil }},
		}}),
	})
	if err != nil {
		t.Fatal(err)
	}
	return &schema
}

func TestGraphQLHandler_QueriesOpenbaarMutatiesEditor(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("AUTH_ENABLED", "true")

	magMuteren := func(c *gin.Context) bool { return middleware.ControleerRol(c, "editor") }

	tests := []struct {
		naam          string
		rol           string // "" = anoniem
		body          string
		verwachtCode  int
		verwachtMutat int
	}{
		{"anoniem query", "", `{"query":"{ ping }"}`, http.StatusOK, 0},
		{"anoniem mutatie", "", `{"query":"mutation { zet }"}`, http.StatusUnauthorized, 0},
		{"viewer mutatie", "viewer", `{"query":"mutation { zet }"}`, http.StatusForbidden, 0},
		{"editor mutatie", "editor", `{"query":"mutation { zet }"}`, http.StatusOK, 1},
		{"admin mutatie", "admin", `{"query":"mutation { zet }"}`, http.StatusOK, 1},
		{"anoniem query+mutatie via operationName", "",
			`{"query":"query Q { ping } mutation M { zet }","operationName":"M"}`, http.StatusUnauthorized, 0},
	}

	for _, tt := range tests {
		t.Run(tt.naam, func(t *testing.T) {
			mutaties := 0
			r := gin.New()
			r.POST("/graphql/query", func(c *gin.Context) {
				if tt.rol != "" {
					c.Set(middleware.ContextKeyGebruiker, &middleware.JWTClaims{Gebruikersnaam: "t", Rol: tt.rol})
				}
				c.Next()
			}, dynql.GraphQLHandler(testSchema(t, &mutaties), magMuteren))

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/graphql/query", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			r.ServeHTTP(w, req)

			if w.Code != tt.verwachtCode {
				t.Errorf("status %d, verwacht %d (body: %s)", w.Code, tt.verwachtCode, w.Body.String())
			}
			if mutaties != tt.verwachtMutat {
				t.Errorf("mutatie %d keer uitgevoerd, verwacht %d", mutaties, tt.verwachtMutat)
			}
		})
	}
}

// GET met een mutatie in de querystring gaat door dezelfde controle.
func TestGraphQLHandler_GetMutatieAnoniemGeweigerd(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("AUTH_ENABLED", "true")
	mutaties := 0
	r := gin.New()
	r.GET("/graphql/query", dynql.GraphQLHandler(testSchema(t, &mutaties),
		func(c *gin.Context) bool { return middleware.ControleerRol(c, "editor") }))

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/graphql/query?query=mutation%7Bzet%7D", nil))
	if w.Code != http.StatusUnauthorized || mutaties != 0 {
		t.Errorf("status %d, mutaties %d; verwacht 401 en 0", w.Code, mutaties)
	}
}
