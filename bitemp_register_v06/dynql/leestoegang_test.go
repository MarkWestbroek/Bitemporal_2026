package dynql_test

// De leespoort in de GraphQL-handler: een ad-hoc query valt onder magLezen, introspectie en
// documentId niet.

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
	"github.com/gin-gonic/gin"
)

func TestIsIntrospectieDocument(t *testing.T) {
	cases := map[string]bool{
		`{ __schema { queryType { name } } }`:                          true,
		`query Q { __type(name: "X") { name } }`:                       true,
		`{ __typename }`:                                               true,
		`query { __schema { types { name } } fragment F on X { a } }`:  false, // parse-fout: telt niet
		`{ __schema { types { name } } ping }`:                         false, // gemengd
		`{ ping }`:                                                     false,
		`{ ...F } fragment F on Query { __schema { types { name } } }`: false, // spread op root
		`mutation { __typename }`:                                      false,
		``:                                                             false,
	}
	for q, verwacht := range cases {
		if got := dynql.IsIntrospectieDocument(q); got != verwacht {
			t.Errorf("IsIntrospectieDocument(%q) = %v, verwacht %v", q, got, verwacht)
		}
	}
}

func TestGraphQLHandler_Leespoort(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mutaties := 0
	weiger := func(c *gin.Context) bool {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "lezen vereist een rol"})
		return false
	}
	r := gin.New()
	r.POST("/graphql/query", dynql.GraphQLHandler(testSchema(t, &mutaties), nil, nil, weiger))

	post := func(body string) int {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/graphql/query", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)
		return w.Code
	}
	if code := post(`{"query":"{ ping }"}`); code != http.StatusUnauthorized {
		t.Errorf("ad-hoc query met dichte poort: verwacht 401, kreeg %d", code)
	}
	if code := post(`{"query":"{ __schema { queryType { name } } }"}`); code != http.StatusOK {
		t.Errorf("introspectie hoort door de poort te mogen, kreeg %d", code)
	}
	if code := post(`{"query":"{ __schema { queryType { name } } ping }"}`); code != http.StatusUnauthorized {
		t.Errorf("introspectie gemengd met data hoort geweigerd te worden, kreeg %d", code)
	}
	// Zonder guard (nil) blijft alles zoals het was.
	r2 := gin.New()
	r2.POST("/graphql/query", dynql.GraphQLHandler(testSchema(t, &mutaties), nil, nil, nil))
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/graphql/query", strings.NewReader(`{"query":"{ ping }"}`))
	req.Header.Set("Content-Type", "application/json")
	r2.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("zonder guard: verwacht 200, kreeg %d", w.Code)
	}
}
