package dynql

// Integratietest van uitvoeren op naam tegen een echte PostgreSQL. Draait alleen met
// DYNQL_TEST_PG_DSN (zie filter_pg_test.go voor de docker-regel). Maakt alle
// QueryDefinitie-tabellen zelf aan (en ruimt ze op); gebruik een wegwerp-database.
//
// De tabellen worden hier zonder de exclusieconstraint van dbsetup aangemaakt, zodat ook de
// bedoelde semantiek van enkelvoudig-op-materieel (meerdere formeel actieve hubs met
// aansluitende materiële periodes) te testen is.

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func TestOpgeslagenPG_UitvoerenOpNaam(t *testing.T) {
	dsn := os.Getenv("DYNQL_TEST_PG_DSN")
	if dsn == "" {
		t.Skip("DYNQL_TEST_PG_DSN niet gezet; integratietest overgeslagen")
	}
	gin.SetMode(gin.TestMode)
	ctx := context.Background()
	pg := bun.NewDB(sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn))), pgdialect.New())
	defer pg.Close()

	// Alle QueryDefinitie-tabellen (entiteit, hubs, data, aanvang/einde).
	var tabellen []interface{}
	for typenaam, m := range model.MetaRegistry {
		if strings.HasPrefix(typenaam, opgeslagenEntiteit) && m.DBFactory != nil {
			tabellen = append(tabellen, m.DBFactory())
		}
	}
	for _, tbl := range tabellen {
		if _, err := pg.NewDropTable().Model(tbl).IfExists().Cascade().Exec(ctx); err != nil {
			t.Fatalf("drop: %v", err)
		}
		if _, err := pg.NewCreateTable().Model(tbl).Exec(ctx); err != nil {
			t.Fatalf("create: %v", err)
		}
	}
	defer func() {
		for _, tbl := range tabellen {
			_, _ = pg.NewDropTable().Model(tbl).IfExists().Cascade().Exec(ctx)
		}
	}()

	nu := time.Now()
	dag := func(d int) string { return nu.AddDate(0, 0, d).Format("2006-01-02") }
	const op = "'2026-01-01'" // opvoer van alles: formeel actueel

	// Helpers om de seed leesbaar te houden.
	var stmts []string
	ent := func(id int) {
		stmts = append(stmts, fmt.Sprintf("INSERT INTO querydefinitie (id, opvoer) VALUES (%d, %s)", id, op))
	}
	ge := func(id, rel int, kort, kolommen, waarden string) {
		stmts = append(stmts,
			fmt.Sprintf("INSERT INTO querydefinitie_querydefinitie%s (querydefinitie_id, rel_id, opvoer) VALUES (%d, %d, %s)", kort, id, rel, op),
			fmt.Sprintf("INSERT INTO querydefinitie_querydefinitie%s_data (querydefinitie_id, rel_id, versie, %s, opvoer) VALUES (%d, %d, 1, %s, %s)", kort, kolommen, id, rel, waarden, op))
	}
	geTijd := func(id, rel int, kort, soort, datum string) {
		stmts = append(stmts, fmt.Sprintf("INSERT INTO querydefinitie_querydefinitie%s_%s (querydefinitie_id, rel_id, versie, datum, opvoer) VALUES (%d, %d, 1, '%s', %s)", kort, soort, id, rel, datum, op))
	}
	q := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
	docZelf := `query($extra: QueryDefinitieFilter) { query_definities(filter: { and: [ { id: { gte: 1 } }, $extra ] }) { id } }`
	basis := func(id int, naam, status, toegang, doc string) {
		ent(id)
		ge(id, 1, "naam", "naam", q(naam))
		ge(id, 1, "status", "status", q(status))
		if toegang != "" {
			ge(id, 1, "toegankelijkheid", "toegankelijkheid", q(toegang))
		}
		ge(id, 1, "document", "graphql_document, definitie_versie", q(doc)+", '0.1'")
	}
	basis(1, "publiek-ok", "actief", "publiek", docZelf)
	basis(2, "klad", "concept", "publiek", docZelf)
	basis(3, "ingetrokken", "inactief", "publiek", docZelf)
	stmts = append(stmts, "UPDATE querydefinitie_querydefinitiestatus_data SET reden = 'vervangen door publiek-ok' WHERE querydefinitie_id = 3")
	basis(4, "intern-ok", "actief", "intern", docZelf)
	basis(5, "later", "actief", "publiek", docZelf)
	geTijd(5, 1, "status", "aanvang", dag(1)) // status pas vanaf morgen
	basis(6, "verlopen", "actief", "publiek", docZelf)
	stmts = append(stmts, fmt.Sprintf("INSERT INTO querydefinitie_einde (querydefinitie_id, versie, datum, opvoer) VALUES (6, 1, '%s', %s)", dag(-1), op))
	// 7: gestaged met twee formeel actieve status-hubs: concept t/m gisteren, actief vanaf vandaag.
	ent(7)
	ge(7, 1, "naam", "naam", q("gestaged"))
	ge(7, 1, "status", "status", q("concept"))
	geTijd(7, 1, "status", "einde", dag(0))
	ge(7, 2, "status", "status", q("actief"))
	geTijd(7, 2, "status", "aanvang", dag(0))
	ge(7, 1, "toegankelijkheid", "toegankelijkheid", q("publiek"))
	ge(7, 1, "document", "graphql_document, definitie_versie", q(docZelf)+", '0.2'")
	basis(8, "mutatie", "actief", "publiek", `mutation { maak_ongedaan(input: {}) { registratie_id } }`)
	basis(9, "ongeldig", "actief", "publiek", `{ query_definities { bestaat_niet } }`)
	basis(10, "afgevoerd", "actief", "publiek", docZelf)
	stmts = append(stmts, "UPDATE querydefinitie SET afvoer = '2026-02-01' WHERE id = 10")
	for _, s := range stmts {
		if _, err := pg.ExecContext(ctx, s); err != nil {
			t.Fatalf("seed: %v\n%s", err, s)
		}
	}

	schema, err := BuildSchema(pg)
	if err != nil {
		t.Fatalf("BuildSchema: %v", err)
	}
	defer InitDB(nil)
	if ok, reden := OpgeslagenDocumentenBeschikbaar(); !ok {
		t.Fatalf("contract: %s", reden)
	}

	toegang := false
	guard := func(c *gin.Context) bool {
		if !toegang {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "intern"})
		}
		return toegang
	}
	r := gin.New()
	r.POST("/graphql/query", GraphQLHandler(schema, nil, guard, nil))
	r.GET("/graphql/query", GraphQLHandler(schema, nil, guard, nil))

	post := func(t *testing.T, body string) (int, map[string]interface{}) {
		t.Helper()
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/graphql/query", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)
		var uit map[string]interface{}
		_ = json.Unmarshal(w.Body.Bytes(), &uit)
		return w.Code, uit
	}
	ids := func(uit map[string]interface{}) []int {
		data, _ := uit["data"].(map[string]interface{})
		rijen, _ := data["query_definities"].([]interface{})
		var out []int
		for _, r := range rijen {
			out = append(out, int(r.(map[string]interface{})["id"].(float64)))
		}
		return out
	}

	t.Run("publiek en actief: uitgevoerd", func(t *testing.T) {
		code, uit := post(t, `{"documentId":"publiek-ok"}`)
		if code != 200 || uit["errors"] != nil || len(ids(uit)) < 5 {
			t.Fatalf("kreeg %d %v", code, uit)
		}
	})
	t.Run("variabele versmalt alleen", func(t *testing.T) {
		code, uit := post(t, `{"documentId":"publiek-ok","variables":{"extra":{"id":{"eq":3}}}}`)
		if code != 200 || fmt.Sprint(ids(uit)) != "[3]" {
			t.Fatalf("kreeg %d %v", code, uit)
		}
	})
	t.Run("GET met documentId en variabelen", func(t *testing.T) {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/graphql/query?documentId=publiek-ok&variables="+url.QueryEscape(`{"extra":{"id":{"eq":1}}}`), nil))
		if w.Code != 200 || !strings.Contains(w.Body.String(), `{"id":1}`) {
			t.Fatalf("kreeg %d %s", w.Code, w.Body.String())
		}
	})
	for _, c := range []struct {
		naam, documentId string
		code             int
		bevat            string
	}{
		{"onbekend", "bestaat-niet", 404, "niet beschikbaar"},
		{"concept is niet zichtbaar", "klad", 404, "niet beschikbaar"},
		{"ingetrokken met reden", "ingetrokken", 410, "vervangen door publiek-ok"},
		{"status pas vanaf morgen", "later", 404, "niet beschikbaar"},
		{"levensduur verstreken", "verlopen", 404, "niet beschikbaar"},
		{"formeel afgevoerd", "afgevoerd", 404, "niet beschikbaar"},
		{"document met mutatie", "mutatie", 400, "bevat een mutatie"},
		{"gestaged: vandaag actief (twee formeel actieve hubs)", "gestaged", 200, `"id":`},
	} {
		t.Run(c.naam, func(t *testing.T) {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/graphql/query", strings.NewReader(`{"documentId":"`+c.documentId+`"}`))
			req.Header.Set("Content-Type", "application/json")
			r.ServeHTTP(w, req)
			if w.Code != c.code || !strings.Contains(w.Body.String(), c.bevat) {
				t.Errorf("kreeg %d %s; verwacht %d met %q", w.Code, w.Body.String(), c.code, c.bevat)
			}
		})
	}
	t.Run("intern: geweigerd zonder rol, uitgevoerd met rol", func(t *testing.T) {
		toegang = false
		if code, _ := post(t, `{"documentId":"intern-ok"}`); code != 403 {
			t.Errorf("zonder rol: kreeg %d, verwacht 403", code)
		}
		toegang = true
		if code, uit := post(t, `{"documentId":"intern-ok"}`); code != 200 || len(ids(uit)) == 0 {
			t.Errorf("met rol: kreeg %d %v", code, uit)
		}
		toegang = false
	})
	t.Run("een ongeldig document wordt uitgevoerd als GraphQL-fout, niet als 500", func(t *testing.T) {
		code, uit := post(t, `{"documentId":"ongeldig"}`)
		if code != 200 || uit["errors"] == nil {
			t.Errorf("kreeg %d %v", code, uit)
		}
	})
	t.Run("validatie bij het opstarten meldt het ongeldige document", func(t *testing.T) {
		regels, err := ValideerOpgeslagenDocumenten(ctx, schema, nu)
		if err != nil {
			t.Fatal(err)
		}
		alles := strings.Join(regels, "\n")
		if !strings.Contains(alles, `"ongeldig" v0.1 [actief, publiek]: ONGELDIG`) {
			t.Errorf("ongeldig document niet gemeld:\n%s", alles)
		}
		if !strings.Contains(alles, `"publiek-ok" v0.1 [actief, publiek]: geldig`) {
			t.Errorf("geldig document niet gemeld:\n%s", alles)
		}
		if !strings.Contains(alles, `"later" v0.1 [geen geldige status, publiek]`) {
			t.Errorf("gestagede status niet als 'geen geldige status' gemeld:\n%s", alles)
		}
		if strings.Contains(alles, `"afgevoerd"`) {
			t.Errorf("formeel afgevoerde definitie hoort niet in de lijst:\n%s", alles)
		}
	})
}
