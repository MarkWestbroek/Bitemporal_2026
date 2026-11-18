package facade

// server_pg_test.go — de hele façade (NieuweServer) op een echte PostgreSQL en een nagespeelde
// Open Zaak: REST /full, de weigeringen, een persisted query die in de eigen database staat,
// en id's die een herstart overleven (PGIDMap).
//
// Draait met FACADE_TEST_PG_DSN (een database die de test leegmaakt; nooit de dev-database) en
// met het lokaal gegenereerde zaakmodel.

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dbsetup"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func TestServerPG(t *testing.T) {
	zaakmodelAanwezig(t)
	dsn := os.Getenv("FACADE_TEST_PG_DSN")
	if dsn == "" {
		t.Skip("FACADE_TEST_PG_DSN niet gezet; integratietest overgeslagen")
	}
	if strings.Contains(dsn, "bitemp_go_db_v06") {
		t.Fatal("weiger te draaien tegen de dev-database")
	}
	gin.SetMode(gin.TestMode)
	t.Setenv("AUTH_ENABLED", "false")
	t.Setenv("REGISTRATIE_TIJD", "klok")
	ctx := context.Background()
	db := bun.NewDB(sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn))), pgdialect.New(), bun.WithDiscardUnknownColumns())
	t.Cleanup(func() { _ = db.Close() })
	if err := dbsetup.DeleteTables(db); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, "DROP TABLE IF EXISTS facade_id"); err != nil {
		t.Fatal(err)
	}
	if err := dbsetup.CreateTables(db); err != nil {
		t.Fatal(err)
	}
	ids, err := NieuwePGIDMap(ctx, db)
	if err != nil {
		t.Fatal(err)
	}

	l, s := nieuweTestLader(t)
	// Eén schema per testbinary (dynql-globalen): bouw de server op het gedeelde schema-moment.
	srv, err := NieuweServer(Config{DB: db, Binding: l.b, IDs: ids, Versie: "test"})
	if err != nil {
		t.Fatal(err)
	}
	h := srv.Router

	doe := func(methode, pad string, body any) (int, map[string]any, string) {
		t.Helper()
		var r *bytes.Reader
		if body != nil {
			b, _ := json.Marshal(body)
			r = bytes.NewReader(b)
		} else {
			r = bytes.NewReader(nil)
		}
		req := httptest.NewRequest(methode, pad, r)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		var m map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &m)
		return w.Code, m, w.Body.String()
	}

	// Lijst via REST: twee zaken, met de rollen (drie niveaus: zaak → zaak_rollen → rol).
	code, _, ruw := doe("GET", "/full/zaken?limit=10", nil)
	if code != 200 || !strings.Contains(ruw, `"zaakidentificatie":"ZAAK-1"`) || !strings.Contains(ruw, `"rol_id":`) {
		t.Fatalf("GET /full/zaken: %d %s", code, kort(ruw))
	}
	var lijst []map[string]any
	_ = json.Unmarshal([]byte(ruw), &lijst)
	if len(lijst) != 2 {
		t.Fatalf("verwacht 2 zaken, kreeg %d", len(lijst))
	}
	id := int(lijst[0]["id"].(float64))

	// Detail, en de weigeringen.
	if code, m, ruw := doe("GET", "/full/zaken/"+strconv.Itoa(id), nil); code != 200 || m["id"] == nil {
		t.Errorf("GET /full/zaken/%d: %d %s", id, code, kort(ruw))
	}
	if code, _, ruw := doe("GET", "/full/zaken/"+strconv.Itoa(id)+"?t=3", nil); code != http.StatusNotImplemented {
		t.Errorf("peiltijdstip op Open Zaak: verwacht 501, kreeg %d %s", code, kort(ruw))
	}
	if code, _, _ := doe("GET", "/full/zaken/987654", nil); code != 404 {
		t.Errorf("onbekend id: verwacht 404, kreeg %d", code)
	}
	if code, _, _ := doe("GET", "/full/bestaat_niet/1", nil); code != 404 {
		t.Errorf("onbekend type: verwacht 404, kreeg %d", code)
	}
	zaakReg := map[string]any{"registratie": map[string]any{"registratietype": "registratie"},
		"wijzigingen": []any{map[string]any{"opvoer": map[string]any{"zaak": map[string]any{"id": 1}}}}}
	if code, _, ruw := doe("POST", "/registratie", zaakReg); code != http.StatusNotImplemented {
		t.Errorf("zaak registreren: verwacht 501, kreeg %d %s", code, kort(ruw))
	}
	gql := map[string]any{"query": `mutation { registreer(input: {}) }`}
	if code, _, ruw := doe("POST", "/graphql/query", gql); code != http.StatusNotImplemented || !strings.Contains(ruw, "niet_ondersteund_door_register") {
		t.Errorf("GraphQL-mutatie: verwacht 501 met code, kreeg %d %s", code, kort(ruw))
	}

	// Een persisted query, geregistreerd in de eigen database (configuratie), over de zaken.
	doc := `{ full_zaken_list(limit: 10) { id zaak_identificaties { zaakidentificatie } } }`
	qd := map[string]any{"registratie": map[string]any{"registratietype": "registratie", "opmerking": "façade-test"},
		"wijzigingen": []any{
			map[string]any{"opvoer": map[string]any{"querydefinitie": map[string]any{"id": 1}}},
			map[string]any{"opvoer": map[string]any{"querydefinitienaam": map[string]any{"querydefinitie_id": 1, "naam": "zaken-overzicht"}}},
			map[string]any{"opvoer": map[string]any{"querydefinitiestatus": map[string]any{"querydefinitie_id": 1, "status": "actief"}}},
			map[string]any{"opvoer": map[string]any{"querydefinitietoegankelijkheid": map[string]any{"querydefinitie_id": 1, "toegankelijkheid": "publiek"}}},
			map[string]any{"opvoer": map[string]any{"querydefinitiedocument": map[string]any{"querydefinitie_id": 1, "graphql_document": doc, "definitie_versie": "0.1"}}},
		}}
	if code, _, ruw := doe("POST", "/registratie", qd); code != 201 && code != 200 {
		t.Fatalf("QueryDefinitie registreren: %d %s", code, kort(ruw))
	}
	code, m, ruw := doe("POST", "/graphql/query", map[string]any{"documentId": "zaken-overzicht"})
	if code != 200 || m["errors"] != nil || !strings.Contains(ruw, `"zaakidentificatie":"ZAAK-2"`) {
		t.Fatalf("documentId: %d %s", code, kort(ruw))
	}

	// Id's overleven een herstart: een nieuwe PGIDMap op dezelfde tabel kent ze nog.
	ids2, err := NieuwePGIDMap(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	if _, uuid, ok, err := ids2.UUID(ctx, "Zaak", id); err != nil || !ok || (uuid != uZaak1 && uuid != uZaak2) {
		t.Errorf("id %d na herstart: %q %v %v", id, uuid, ok, err)
	}
	if again, err := ids2.ID(ctx, "openzaak", "Zaak", uZaak1); err != nil || (again != id && lijst[1]["id"].(float64) != float64(again)) {
		t.Errorf("zelfde uuid kreeg een ander id: %d (%v)", again, err)
	}
	_ = s
}

func kort(s string) string {
	if len(s) > 500 {
		return s[:500] + "…"
	}
	return s
}
