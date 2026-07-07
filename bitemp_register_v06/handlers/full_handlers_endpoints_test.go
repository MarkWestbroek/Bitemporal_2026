package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

type testFullDummy struct {
	bun.BaseModel `bun:"table:dummy_full"`
	ID            int    `json:"id" bun:"id,pk"`
	Naam          string `json:"naam" bun:"naam"`
}

func (d *testFullDummy) GetID() any               { return d.ID }
func (d *testFullDummy) Metatype() model.Metatype { return model.MetatypeEntiteit }
func (d *testFullDummy) String() string           { return "testFullDummy" }

func dummyFullTypeMeta() model.TypeMeta {
	return model.TypeMeta{
		Typenaam:     "Dummy",
		Metatype:     model.MetatypeEntiteit,
		Tabelnaam:    "dummy_full",
		IDKolom:      "id",
		Padnaam:      "dummies",
		Factory:      func() model.Representatie { return &testFullDummy{} },
		SliceFactory: func() any { return &[]testFullDummy{} },
	}
}

func TestMakeGetFullEntitiesByMetaHandler_ReturnsList(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	meta := dummyFullTypeMeta()

	mock.ExpectQuery(`SELECT .*FROM "dummy_full".*LIMIT 2`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "naam"}).
			AddRow(1, "een").
			AddRow(2, "twee"))

	mock.ExpectQuery(`SELECT count\(\*\).*FROM "dummy_full"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/dummies?page=1&size=2", nil)

	handler := MakeGetFullEntitiesByMetaHandler(meta)
	handler(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body["has_more"] != true {
		t.Fatalf("expected has_more true, got %#v", body["has_more"])
	}

	if _, ok := body["dummies"]; !ok {
		t.Fatalf("expected key dummies in response, got keys %#v", body)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMakeGetFullEntityByMetaHandler_ReturnsEntity(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	meta := dummyFullTypeMeta()

	mock.ExpectQuery(`SELECT .*FROM "dummy_full".*WHERE .*id.*=`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "naam"}).AddRow(7, "zeven"))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/dummies/7", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}

	handler := MakeGetFullEntityByMetaHandler(meta)
	handler(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if id, ok := body["id"].(float64); !ok || int(id) != 7 {
		t.Fatalf("expected id 7, got %#v", body["id"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMakeGetRegistratiesMetWijzigingenHandler_ReturnsRegistratiesWithLinks(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	tijdstip1 := tijdstipUitT(1)
	tijdstip2 := tijdstipUitT(2)

	mock.ExpectQuery(`SELECT .*FROM "registratie".*LIMIT 2`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "registratietype", "tijdstip"}).
			AddRow(10, string(model.RegistratietypeRegistratie), tijdstip1).
			AddRow(11, string(model.RegistratietypeCorrectie), tijdstip2))

	mock.ExpectQuery(`SELECT .*FROM "wijziging".*registratie_id.*IN`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "wijzigingstype", "registratie_id", "entiteitnaam", "entiteit_id", "representatienaam", "representatie_id", "tijdstip", "is_ongedaan_gemaakt"}).
			AddRow(100, string(model.WijzigingstypeOpvoer), 10, "A", "1", "", "", tijdstip1, false).
			AddRow(101, string(model.WijzigingstypeAfvoer), 11, "B", "2", "", "", tijdstip2, false))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties?page=1&size=2", nil)

	handler := MakeGetRegistratiesMetWijzigingenHandler()
	handler(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	items, ok := body["Registraties"].([]any)
	if !ok || len(items) != 2 {
		t.Fatalf("expected 2 registraties, got %#v", body["Registraties"])
	}

	first, ok := items[0].(map[string]any)
	if !ok {
		t.Fatalf("expected first item map, got %T", items[0])
	}

	links, ok := first["full_entiteit_links"].([]any)
	if !ok || len(links) != 1 {
		t.Fatalf("expected one full_entiteit_link, got %#v", first["full_entiteit_links"])
	}

	link0, ok := links[0].(map[string]any)
	if !ok || link0["href"] != "as/1" {
		t.Fatalf("expected href as/1, got %#v", links[0])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMakeGetRegistratieMetWijzigingenByIDHandler_ReturnsRegistratieWithLinks(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	tijdstip := tijdstipUitT(3)

	mock.ExpectQuery(`SELECT .*FROM "registratie".*WHERE .*id.*=`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "registratietype", "tijdstip"}).
			AddRow(7, string(model.RegistratietypeRegistratie), tijdstip))

	mock.ExpectQuery(`SELECT .*FROM "wijziging".*registratie_id.*IN`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "wijzigingstype", "registratie_id", "entiteitnaam", "entiteit_id", "representatienaam", "representatie_id", "tijdstip", "is_ongedaan_gemaakt"}).
			AddRow(200, string(model.WijzigingstypeOpvoer), 7, "A", "9", "", "", tijdstip, false))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties/7", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}

	handler := MakeGetRegistratieMetWijzigingenByIDHandler()
	handler(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	links, ok := body["full_entiteit_links"].([]any)
	if !ok || len(links) != 1 {
		t.Fatalf("expected one full_entiteit_link, got %#v", body["full_entiteit_links"])
	}
	link0, ok := links[0].(map[string]any)
	if !ok || link0["href"] != "as/9" {
		t.Fatalf("expected href as/9, got %#v", links[0])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMakeGetRegistratiesMetWijzigingenHandler_InvalidQueryParams(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name string
		url  string
	}{
		{name: "invalid page", url: "/full/registraties?page=x"},
		{name: "invalid size", url: "/full/registraties?size=0"},
		{name: "invalid type", url: "/full/registraties?type=onzin"},
		{name: "invalid ta", url: "/full/registraties?ta=abc"},
		{name: "invalid peiltijdstip", url: "/full/registraties?peiltijdstip=geen-datum"},
	}

	handler := MakeGetRegistratiesMetWijzigingenHandler()
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(rec)
			ctx.Request = httptest.NewRequest(http.MethodGet, tc.url, nil)

			handler(ctx)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestMakeGetRegistratieMetWijzigingenByIDHandler_InvalidIDAndMissingID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := MakeGetRegistratieMetWijzigingenByIDHandler()

	t.Run("missing id", func(t *testing.T) {
		rec := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(rec)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties/", nil)

		handler(ctx)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("invalid id", func(t *testing.T) {
		rec := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(rec)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties/abc", nil)
		ctx.Params = gin.Params{{Key: "id", Value: "abc"}}

		handler(ctx)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
		}
	})
}

func TestMakeGetRegistratieMetWijzigingenByIDHandler_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	mock.ExpectQuery(`SELECT .*FROM "registratie".*WHERE .*id.*=`).
		WillReturnError(sql.ErrNoRows)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties/404", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "404"}}

	handler := MakeGetRegistratieMetWijzigingenByIDHandler()
	handler(ctx)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["message"] != "Registratie not found" {
		t.Fatalf("expected not-found message, got %#v", body["message"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMakeGetRegistratiesMetWijzigingenHandler_ReturnsInternalServerErrorOnScanFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	mock.ExpectQuery(`SELECT .*FROM "registratie"`).
		WillReturnError(sql.ErrConnDone)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties", nil)

	handler := MakeGetRegistratiesMetWijzigingenHandler()
	handler(ctx)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d: %s", rec.Code, rec.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMakeGetRegistratieMetWijzigingenByIDHandler_ReturnsInternalServerErrorOnScanFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	mock.ExpectQuery(`SELECT .*FROM "registratie".*WHERE .*id.*=`).
		WillReturnError(sql.ErrConnDone)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties/7", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}

	handler := MakeGetRegistratieMetWijzigingenByIDHandler()
	handler(ctx)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d: %s", rec.Code, rec.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMakeGetRegistratiesMetWijzigingenHandler_InvalidIntervalTaAfterTb(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties?ta=9&tb=2", nil)

	handler := MakeGetRegistratiesMetWijzigingenHandler()
	handler(ctx)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestMakeGetRegistratiesMetWijzigingenHandler_CapsSizeAndHasMoreFalse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// maxSize is 2000 (verhoogd van 100, zie commit "more records (>100)"):
	// een grotere size-parameter wordt op 2000 afgekapt.
	mock.ExpectQuery(`SELECT .*FROM "registratie".*LIMIT 2000`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "registratietype", "tijdstip"}))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties?size=5000", nil)

	handler := MakeGetRegistratiesMetWijzigingenHandler()
	handler(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if size, ok := body["size"].(float64); !ok || int(size) != 2000 {
		t.Fatalf("expected capped size 2000, got %#v", body["size"])
	}
	if hasMore, ok := body["has_more"].(bool); !ok || hasMore {
		t.Fatalf("expected has_more false, got %#v", body["has_more"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestMakeGetRegistratiesMetWijzigingenHandler_FilteredByTypeAndPeiltijdstip(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	tijdstip := tijdstipUitT(5)

	mock.ExpectQuery(`SELECT .*FROM "registratie".*registratietype IN .*tijdstip <= .*LIMIT 20`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "registratietype", "tijdstip"}).
			AddRow(15, string(model.RegistratietypeRegistratie), tijdstip))

	mock.ExpectQuery(`SELECT .*FROM "wijziging".*registratie_id.*IN.*tijdstip <=`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "wijzigingstype", "registratie_id", "entiteitnaam", "entiteit_id", "representatienaam", "representatie_id", "tijdstip", "is_ongedaan_gemaakt"}).
			AddRow(301, string(model.WijzigingstypeOpvoer), 15, "A", "4", "", "", tijdstip, false))

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/registraties?type=registratie&t=5", nil)

	handler := MakeGetRegistratiesMetWijzigingenHandler()
	handler(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	items, ok := body["Registraties"].([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("expected 1 registratie, got %#v", body["Registraties"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
