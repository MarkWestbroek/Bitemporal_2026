package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/pep"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/toegang"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

// Toegangsbeleid (fase 1b) door de echte /full-handlers heen, met sqlmock: de PEP snoeit,
// weigert (403) of verbergt (404) volgens de actieve bundel.

func metBundel(t *testing.T, bundelJSON string) {
	t.Helper()
	b, err := toegang.LaadBundel([]byte(bundelJSON))
	if err != nil {
		t.Fatalf("bundel: %v", err)
	}
	meta := dummyFullTypeMeta()
	_, bestond := model.MetaRegistry["Dummy"]
	model.MetaRegistry["Dummy"] = meta
	pep.ZetBundel(b)
	t.Cleanup(func() {
		pep.ZetBundel(nil)
		if !bestond {
			delete(model.MetaRegistry, "Dummy")
		}
	})
}

func metMockDB(t *testing.T) sqlmock.Sqlmock {
	t.Helper()
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	oud := DB
	DB = db
	t.Cleanup(func() { DB = oud; db.Close(); sqlDB.Close() })
	return mock
}

const bundelNaamOpenbaar = `{"formaat":"omnium-toegangsbundel/1","beleid":{"naam":"t"},"regels":[
  {"id":"naam-open","effect":"toestaan","handeling":"bekijken","subject":null,"gegevens":[{"pad":"Dummy.naam"}]}]}`

const bundelAlleenBeheer = `{"formaat":"omnium-toegangsbundel/1","beleid":{"naam":"t"},"regels":[
  {"id":"beheer","effect":"toestaan","handeling":"bekijken","subject":{"kenmerken":[{"kenmerk":"rol","waarde":"admin"}]},"gegevens":[{"pad":"Dummy"}]}]}`

const bundelAnderVeld = `{"formaat":"omnium-toegangsbundel/1","beleid":{"naam":"t"},"regels":[
  {"id":"ander","effect":"toestaan","handeling":"bekijken","subject":null,"gegevens":[{"pad":"Dummy.omschrijving"}]}]}`

func TestPEPFullLijstSnoeitEnLaatToe(t *testing.T) {
	mock := metMockDB(t)
	metBundel(t, bundelNaamOpenbaar)
	mock.ExpectQuery(`SELECT .*FROM "dummy_full"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "naam"}).AddRow(1, "een").AddRow(2, "twee"))
	mock.ExpectQuery(`SELECT count\(\*\).*FROM "dummy_full"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/dummies", nil)
	MakeGetFullEntitiesByMetaHandler(dummyFullTypeMeta())(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("verwacht 200, kreeg %d: %s", rec.Code, rec.Body.String())
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	items, _ := body["dummies"].([]any)
	if len(items) != 2 {
		t.Fatalf("verwacht 2 records, kreeg %#v", body["dummies"])
	}
	eerste := items[0].(map[string]any)
	if eerste["naam"] != "een" || eerste["id"] == nil {
		t.Fatalf("naam (toegestaan) en id (technisch) horen te blijven: %#v", eerste)
	}
}

func TestPEPFullLijstWeigertAnoniem(t *testing.T) {
	mock := metMockDB(t)
	metBundel(t, bundelAlleenBeheer)
	mock.ExpectQuery(`SELECT .*FROM "dummy_full"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "naam"}).AddRow(1, "een"))
	mock.ExpectQuery(`SELECT count\(\*\).*FROM "dummy_full"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/dummies", nil)
	MakeGetFullEntitiesByMetaHandler(dummyFullTypeMeta())(ctx)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("anoniem zonder enig recht: verwacht 403, kreeg %d: %s", rec.Code, rec.Body.String())
	}
}

func TestPEPFullDetailVerbergtRecordZonderZichtbareVelden(t *testing.T) {
	mock := metMockDB(t)
	metBundel(t, bundelAnderVeld)
	mock.ExpectQuery(`SELECT .*FROM "dummy_full".*WHERE .*id.*=`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "naam"}).AddRow(7, "zeven"))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/dummies/7", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}
	MakeGetFullEntityByMetaHandler(dummyFullTypeMeta())(ctx)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("naam is niet toegestaan, dus niets zichtbaar: verwacht 404, kreeg %d: %s", rec.Code, rec.Body.String())
	}
}

func TestZonderBundelOngewijzigd(t *testing.T) {
	mock := metMockDB(t)
	pep.ZetBundel(nil)
	mock.ExpectQuery(`SELECT .*FROM "dummy_full".*WHERE .*id.*=`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "naam"}).AddRow(7, "zeven"))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/dummies/7", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}
	MakeGetFullEntityByMetaHandler(dummyFullTypeMeta())(ctx)

	if rec.Code != http.StatusOK || !json.Valid(rec.Body.Bytes()) {
		t.Fatalf("zonder bundel hoort alles als voorheen te werken: %d %s", rec.Code, rec.Body.String())
	}
}
