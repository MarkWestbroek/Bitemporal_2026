package dynql

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

// Het contract moet kloppen met het gegenereerde configuratie-model; dit is de test die
// breekt als iemand QueryDefinitie in het model verandert zonder deze code aan te passen.
func TestOpgeslagen_ContractKloptMetModel(t *testing.T) {
	initOpgeslagenContract()
	if ok, reden := OpgeslagenDocumentenBeschikbaar(); !ok {
		t.Fatalf("contract klopt niet: %s", reden)
	}
	for _, ge := range opgeslagenGEs {
		if opgeslagen.rol[ge.typenaam] == "" {
			t.Errorf("geen rolnaam voor %s", ge.typenaam)
		}
	}
}

// rolnamen van aanvang/einde onder een materieel type (voor het bouwen van testrecords).
func aanvangEindeRol(t *testing.T, meta model.TypeMeta) (string, string) {
	t.Helper()
	var a, e string
	for _, child := range meta.OnderliggendeGegevenselementen {
		cm, _ := model.MetaRegistry.GetTypeMeta(child.Doeltype)
		switch cm.GESubtype {
		case model.GESubtypeAanvang:
			a = child.JSONRolnaam
		case model.GESubtypeEinde:
			e = child.JSONRolnaam
		}
	}
	if a == "" || e == "" {
		t.Fatalf("%s heeft geen aanvang/einde-kinderen", meta.Typenaam)
	}
	return a, e
}

func TestOpgeslagen_MaterieelGeldigOp(t *testing.T) {
	initOpgeslagenContract()
	status := opgeslagen.hub[opgeslagenGEStatus]
	aRol, eRol := aanvangEindeRol(t, status)
	nu := time.Date(2026, 9, 24, 15, 30, 0, 0, time.UTC)
	datum := func(d int) map[string]interface{} {
		return map[string]interface{}{"datum": nu.AddDate(0, 0, d).Format("2006-01-02")}
	}
	cases := []struct {
		naam    string
		rec     map[string]interface{}
		verwact bool
	}{
		{"geen aanvang, geen einde", map[string]interface{}{}, true},
		{"aanvang vandaag", map[string]interface{}{aRol: datum(0)}, true},
		{"aanvang gisteren", map[string]interface{}{aRol: datum(-1)}, true},
		{"aanvang morgen (gestaged)", map[string]interface{}{aRol: datum(1)}, false},
		{"einde morgen", map[string]interface{}{eRol: datum(1)}, true},
		{"einde vandaag (exclusief)", map[string]interface{}{eRol: datum(0)}, false},
		{"einde gisteren", map[string]interface{}{eRol: datum(-1)}, false},
		{"aanvang gisteren, einde morgen", map[string]interface{}{aRol: datum(-1), eRol: datum(1)}, true},
		{"aanvang zonder datum", map[string]interface{}{aRol: map[string]interface{}{}}, true},
	}
	for _, c := range cases {
		t.Run(c.naam, func(t *testing.T) {
			if got := materieelGeldigOp(c.rec, status, nu); got != c.verwact {
				t.Errorf("kreeg %v, verwacht %v", got, c.verwact)
			}
		})
	}
	// Een niet-materieel type is altijd geldig, ook met een "einde" in de map.
	naam := opgeslagen.hub[opgeslagenGENaam]
	if !materieelGeldigOp(map[string]interface{}{"einde": datum(-5)}, naam, nu) {
		t.Error("niet-materieel type hoort altijd geldig te zijn")
	}
}

// Twee formeel actieve status-hubs met aansluitende materiële periodes (de bedoelde
// semantiek van enkelvoudig op een materieel GE): op `nu` wint de hub die dan geldig is.
func TestOpgeslagen_KiesGeldigeHub(t *testing.T) {
	initOpgeslagenContract()
	status := opgeslagen.hub[opgeslagenGEStatus]
	aRol, eRol := aanvangEindeRol(t, status)
	nu := time.Date(2026, 10, 1, 9, 0, 0, 0, time.UTC)
	hub := func(rel int, st string, aanvang, einde string) map[string]interface{} {
		m := map[string]interface{}{
			"rel_id": float64(rel),
			"data":   []interface{}{map[string]interface{}{"status": st, "reden": "r" + st}},
		}
		if aanvang != "" {
			m[aRol] = []interface{}{map[string]interface{}{"datum": aanvang}}
		}
		if einde != "" {
			m[eRol] = []interface{}{map[string]interface{}{"datum": einde}}
		}
		return m
	}
	items := []interface{}{
		hub(1, "concept", "", "2026-10-01"),  // t/m 30 september
		hub(2, "actief", "2026-10-01", ""),   // vanaf 1 oktober
		hub(3, "inactief", "2026-12-01", ""), // pas in december
		"rommel",                             // wordt genegeerd
	}
	rec := kiesGeldigeHub(items, status, nu)
	if rec == nil || rec["status"] != "actief" {
		t.Fatalf("op 1 oktober hoort de actieve hub te winnen, kreeg %v", rec)
	}
	if rec := kiesGeldigeHub(items, status, nu.AddDate(0, 0, -1)); rec == nil || rec["status"] != "concept" {
		t.Errorf("op 30 september hoort concept te gelden, kreeg %v", rec)
	}
	if rec := kiesGeldigeHub(items, status, nu.AddDate(0, 3, 0)); rec == nil || rec["status"] != "inactief" {
		t.Errorf("in januari hoort inactief te gelden (laatste aanvang wint), kreeg %v", rec)
	}
	if kiesGeldigeHub(nil, status, nu) != nil {
		t.Error("zonder hubs hoort nil")
	}
	// De invoer mag niet in place veranderd zijn (flatten werkt op een kopie).
	if _, ok := items[1].(map[string]interface{})["data"]; !ok {
		t.Error("kiesGeldigeHub heeft de geladen map aangepast")
	}
}

func schemaMetSqlmock(t *testing.T) (*graphql.Schema, func()) {
	t.Helper()
	sqlDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	schema, err := BuildSchema(bun.NewDB(sqlDB, pgdialect.New()))
	if err != nil {
		t.Fatalf("BuildSchema: %v", err)
	}
	return schema, func() { InitDB(nil); sqlDB.Close() }
}

func TestOpgeslagen_ValideerDocument(t *testing.T) {
	initiatiefMeta(t)
	schema, sluit := schemaMetSqlmock(t)
	defer sluit()

	if f := valideerDocument(schema, "{ initiatieven { id } }"); f != nil {
		t.Errorf("geldig document gaf fouten: %v", f)
	}
	if f := valideerDocument(schema, "query($extra: InitiatiefFilter) { initiatieven(filter: { and: [ { id: { eq: 1 } }, $extra ] }) { id } }"); f != nil {
		t.Errorf("document met variabele gaf fouten: %v", f)
	}
	if f := valideerDocument(schema, "{ initiatieven { bestaat_niet } }"); len(f) == 0 || !strings.Contains(f[0], "bestaat_niet") {
		t.Errorf("verwacht een fout over bestaat_niet, kreeg %v", f)
	}
	if f := valideerDocument(schema, "{ initiatieven { id "); len(f) == 0 || !strings.HasPrefix(f[0], "parse:") {
		t.Errorf("verwacht een parse-fout, kreeg %v", f)
	}
	if f := valideerDocument(schema, `mutation { registreer(input: {}) { registratie_id } }`); len(f) == 0 || !strings.Contains(f[0], "mutatie") {
		t.Errorf("verwacht 'bevat een mutatie', kreeg %v", f)
	}
}

func TestOpgeslagen_ValideerDocumentHandler(t *testing.T) {
	initiatiefMeta(t)
	gin.SetMode(gin.TestMode)
	schema, sluit := schemaMetSqlmock(t)
	defer sluit()
	r := gin.New()
	r.POST("/graphql/valideer", ValideerDocumentHandler(schema))

	post := func(body string) (int, string) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/graphql/valideer", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)
		return w.Code, w.Body.String()
	}
	if code, body := post(`{"document":"{ initiatieven { id } }"}`); code != 200 || !strings.Contains(body, `"geldig":true`) || !strings.Contains(body, `"fouten":[]`) {
		t.Errorf("geldig: %d %s", code, body)
	}
	if code, body := post(`{"document":"{ initiatieven { nee } }"}`); code != 200 || !strings.Contains(body, `"geldig":false`) || !strings.Contains(body, "nee") {
		t.Errorf("ongeldig: %d %s", code, body)
	}
	if code, _ := post(`{}`); code != 400 {
		t.Errorf("leeg document hoort 400, kreeg %d", code)
	}
}

// Zonder documentId gedraagt de handler zich als voorheen; met beide is het een fout.
func TestOpgeslagen_QueryEnDocumentIdSluitenElkaarUit(t *testing.T) {
	initiatiefMeta(t)
	gin.SetMode(gin.TestMode)
	schema, sluit := schemaMetSqlmock(t)
	defer sluit()
	r := gin.New()
	r.POST("/graphql/query", GraphQLHandler(schema, nil, nil))
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/graphql/query", strings.NewReader(`{"query":"{ initiatieven { id } }","documentId":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 400 || !strings.Contains(w.Body.String(), "sluiten elkaar uit") {
		t.Errorf("kreeg %d %s", w.Code, w.Body.String())
	}
}
