package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

type testUintRepresentatie struct {
	UID uint
}

func (r *testUintRepresentatie) GetID() any               { return r.UID }
func (r *testUintRepresentatie) Metatype() model.Metatype { return model.MetatypeGegevenselement }
func (r *testUintRepresentatie) String() string           { return "testUintRepresentatie" }

func TestSluitActieveEnkelvoudigeVoorgangersAf_ClosesExistingActiveRecord(t *testing.T) {
	// Given: een enkelvoudig gegevenselement met exact één actieve voorganger.
	// When: de helper wordt uitgevoerd voor een nieuwe opvoer.
	// Then: de actieve voorganger wordt afgevoerd en een afvoer-wijziging wordt vastgelegd.
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectBegin()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	meta, ok := model.MetaRegistry.GetTypeMeta("A_U")
	if !ok {
		t.Fatal("expected metadata for A_U")
	}

	representatie := &model.A_U{A_ID: 1, Rel_ID: 999}
	tijdstip := time.Date(2026, 2, 25, 10, 0, 0, 0, time.UTC)

	// SQL-volgorde: select actieve voorganger -> update afvoer -> insert wijziging.
	mock.ExpectQuery(`SELECT .*FROM "a_u".*opvoer IS NOT NULL.*afvoer IS NULL`).
		WillReturnRows(sqlmock.NewRows([]string{"rel_id"}).AddRow(5))

	mock.ExpectExec(`UPDATE "a_u" SET afvoer = .*WHERE \(rel_id = .*\)`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectQuery(`INSERT INTO "wijziging".*RETURNING "id"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(11))

	err = sluitActieveEnkelvoudigeVoorgangersAf(ctx, tx, 42, tijdstip, "A_U", representatie, meta)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	mock.ExpectCommit()
	if err := tx.Commit(); err != nil {
		t.Fatalf("failed to commit tx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestSluitActieveEnkelvoudigeVoorgangersAf_ErrorsOnMultipleActiveRecords(t *testing.T) {
	// Given: een enkelvoudig gegevenselement met meerdere actieve voorgangers.
	// When: de helper wordt uitgevoerd.
	// Then: er volgt een foutmelding over "meerdere actieve".
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectBegin()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	meta, ok := model.MetaRegistry.GetTypeMeta("A_U")
	if !ok {
		t.Fatal("expected metadata for A_U")
	}

	representatie := &model.A_U{A_ID: 1, Rel_ID: 999}
	tijdstip := time.Date(2026, 2, 25, 10, 0, 0, 0, time.UTC)

	// Simuleer twee actieve voorgangers in het queryresultaat.
	mock.ExpectQuery(`SELECT .*FROM "a_u".*opvoer IS NOT NULL.*afvoer IS NULL`).
		WillReturnRows(sqlmock.NewRows([]string{"rel_id"}).AddRow(5).AddRow(6))

	err = sluitActieveEnkelvoudigeVoorgangersAf(ctx, tx, 42, tijdstip, "A_U", representatie, meta)
	if err == nil {
		t.Fatal("expected error for multiple active records, got nil")
	}
	if !strings.Contains(err.Error(), "meerdere actieve") {
		t.Fatalf("expected multiple-active error, got: %v", err)
	}

	mock.ExpectRollback()
	if err := tx.Rollback(); err != nil {
		t.Fatalf("failed to rollback tx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestSluitActieveEnkelvoudigeVoorgangersAf_ErrorsOnMissingParentID(t *testing.T) {
	// Given: de representatie bevat geen parent-ID (A_ID/B_ID = 0).
	// When: de helper probeert de voorganger te bepalen.
	// Then: er volgt een foutmelding dat de bovenliggende id ontbreekt.
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectBegin()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	meta, ok := model.MetaRegistry.GetTypeMeta("A_U")
	if !ok {
		t.Fatal("expected metadata for A_U")
	}

	representatie := &model.A_U{A_ID: 0, Rel_ID: 999}
	tijdstip := time.Date(2026, 2, 25, 10, 0, 0, 0, time.UTC)

	err = sluitActieveEnkelvoudigeVoorgangersAf(ctx, tx, 42, tijdstip, "A_U", representatie, meta)
	if err == nil {
		t.Fatal("expected error for missing parent id, got nil")
	}
	if !strings.Contains(err.Error(), "id ontbreekt") {
		t.Fatalf("expected missing-parent-id error, got: %v", err)
	}

	mock.ExpectRollback()
	if err := tx.Rollback(); err != nil {
		t.Fatalf("failed to rollback tx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestLeidRelIDVoorHubKindAf_ReturnsSingleActiveHubRelID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectBegin()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	meta, ok := model.MetaRegistry.GetTypeMeta("A_W_Aanvang")
	if !ok {
		t.Fatal("expected metadata for A_W_Aanvang")
	}
	representatie := &model.A_W_Aanvang{A_ID: 2}

	mock.ExpectQuery(`SELECT CAST\(rel_id AS BIGINT\) FROM "a_w".*opvoer IS NOT NULL.*afvoer IS NULL.*a_id =`).
		WillReturnRows(sqlmock.NewRows([]string{"rel_id"}).AddRow(3))

	relID, err := leidRelIDVoorHubKindAf(ctx, tx, meta, representatie)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if relID != 3 {
		t.Fatalf("expected rel_id 3, got %d", relID)
	}

	mock.ExpectCommit()
	if err := tx.Commit(); err != nil {
		t.Fatalf("failed to commit tx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestLeidRelIDVoorHubKindAf_ErrorsOnAmbiguousActiveHub(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectBegin()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	meta, ok := model.MetaRegistry.GetTypeMeta("A_W_Aanvang")
	if !ok {
		t.Fatal("expected metadata for A_W_Aanvang")
	}
	representatie := &model.A_W_Aanvang{A_ID: 2}

	mock.ExpectQuery(`SELECT CAST\(rel_id AS BIGINT\) FROM "a_w".*opvoer IS NOT NULL.*afvoer IS NULL.*a_id =`).
		WillReturnRows(sqlmock.NewRows([]string{"rel_id"}).AddRow(3).AddRow(4))

	_, err = leidRelIDVoorHubKindAf(ctx, tx, meta, representatie)
	if err == nil {
		t.Fatal("expected ambiguity error, got nil")
	}
	if !strings.Contains(err.Error(), "niet eenduidig") {
		t.Fatalf("expected ambiguity error, got %v", err)
	}
	if !strings.Contains(err.Error(), "stuur rel_id expliciet mee") {
		t.Fatalf("expected explicit rel_id guidance, got %v", err)
	}

	mock.ExpectRollback()
	if err := tx.Rollback(); err != nil {
		t.Fatalf("failed to rollback tx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestLeidRelIDVoorHubKindAf_ErrorsOnNoActiveHub(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectBegin()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	meta, ok := model.MetaRegistry.GetTypeMeta("A_W_Aanvang")
	if !ok {
		t.Fatal("expected metadata for A_W_Aanvang")
	}
	representatie := &model.A_W_Aanvang{A_ID: 2}

	mock.ExpectQuery(`SELECT CAST\(rel_id AS BIGINT\) FROM "a_w".*opvoer IS NOT NULL.*afvoer IS NULL.*a_id =`).
		WillReturnRows(sqlmock.NewRows([]string{"rel_id"}))

	_, err = leidRelIDVoorHubKindAf(ctx, tx, meta, representatie)
	if err == nil {
		t.Fatal("expected no-active-hub error, got nil")
	}
	if !strings.Contains(err.Error(), "geen actieve A_W hub") {
		t.Fatalf("expected no-active-hub detail, got %v", err)
	}
	if !strings.Contains(err.Error(), "a_id=2") {
		t.Fatalf("expected entity id detail, got %v", err)
	}
	if !strings.Contains(err.Error(), "stuur rel_id expliciet mee") {
		t.Fatalf("expected explicit rel_id guidance, got %v", err)
	}

	mock.ExpectRollback()
	if err := tx.Rollback(); err != nil {
		t.Fatalf("failed to rollback tx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestParseStringNaarKolomType_TableDriven(t *testing.T) {
	metaAU, ok := model.MetaRegistry.GetTypeMeta("A_U")
	if !ok {
		t.Fatal("expected metadata for A_U")
	}

	metaAUData, ok := model.MetaRegistry.GetTypeMeta("A_U_Data")
	if !ok {
		t.Fatal("expected metadata for A_U_Data")
	}

	metaCustomUint := model.TypeMeta{
		Typenaam:  "UintDummy",
		DBFactory: func() model.Representatie { return &testUintRepresentatie{} },
	}

	tests := []struct {
		name        string
		meta        model.TypeMeta
		kolom       string
		raw         string
		expectedAny any
		expectError bool
	}{
		{
			name:        "string field via db model",
			meta:        metaAUData,
			kolom:       "aaa",
			raw:         "nieuw",
			expectedAny: "nieuw",
		},
		{
			name:        "int field via db model",
			meta:        metaAU,
			kolom:       "a_id",
			raw:         "42",
			expectedAny: int(42),
		},
		{
			name:        "uint field via custom db model",
			meta:        metaCustomUint,
			kolom:       "u_id",
			raw:         "9",
			expectedAny: uint(9),
		},
		{
			name:        "error on empty value",
			meta:        metaAU,
			kolom:       "a_id",
			raw:         "",
			expectError: true,
		},
		{
			name:        "error on unknown column",
			meta:        metaAU,
			kolom:       "unknown_column",
			raw:         "1",
			expectError: true,
		},
		{
			name:        "error on invalid int",
			meta:        metaAU,
			kolom:       "a_id",
			raw:         "not-an-int",
			expectError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseStringNaarKolomType(tc.meta, tc.kolom, tc.raw)
			if tc.expectError {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}

			switch expected := tc.expectedAny.(type) {
			case int:
				v, ok := got.(int)
				if !ok || v != expected {
					t.Fatalf("expected int %d, got %#v", expected, got)
				}
			case uint:
				v, ok := got.(uint)
				if !ok || v != expected {
					t.Fatalf("expected uint %d, got %#v", expected, got)
				}
			case string:
				v, ok := got.(string)
				if !ok || v != expected {
					t.Fatalf("expected string %q, got %#v", expected, got)
				}
			default:
				t.Fatalf("unsupported expected type in test: %T", expected)
			}
		})
	}
}

func TestHandleRepresentatieOpvoer_ErrorsOnUnknownType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	err := handleRepresentatieOpvoer(
		ctx,
		bun.Tx{},
		model.Registratie{},
		"",
		"",
		"UNKNOWN_TYPE",
		&model.A_U{},
	)
	if err == nil {
		t.Fatal("expected error for unknown type")
	}
	if !strings.Contains(err.Error(), "onbekend type") {
		t.Fatalf("expected unknown-type error, got: %v", err)
	}
}

func TestHandleRepresentatieAfvoer_ErrorsOnUnknownType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	err := handleRepresentatieAfvoer(
		ctx,
		bun.Tx{},
		1,
		time.Now().UTC(),
		"",
		"",
		"UNKNOWN_TYPE",
		&model.A_U{},
	)
	if err == nil {
		t.Fatal("expected error for unknown type")
	}
	if !strings.Contains(err.Error(), "onbekend type") {
		t.Fatalf("expected unknown-type error, got: %v", err)
	}
}

func TestHandleRepresentatieOntOpvoer_SuccessWithPFK(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectBegin()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	mock.ExpectExec(`UPDATE "a_u" SET opvoer = NULL.*rel_id.*a_id`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	wijziging := model.Wijziging{
		ID:                900,
		Wijzigingstype:    model.WijzigingstypeOpvoer,
		Entiteitnaam:      "A",
		EntiteitID:        "1",
		Representatienaam: "A_U",
		RepresentatieID:   "5",
	}

	err = handleRepresentatieOntOpvoer(ctx, tx, wijziging)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	mock.ExpectCommit()
	if err := tx.Commit(); err != nil {
		t.Fatalf("failed to commit tx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestHandleRepresentatieOntOpvoer_ErrorsWhenNoRowsAffected(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectBegin()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	mock.ExpectExec(`UPDATE "a_u" SET opvoer = NULL.*rel_id.*a_id`).
		WillReturnResult(sqlmock.NewResult(0, 0))

	wijziging := model.Wijziging{
		ID:                901,
		Wijzigingstype:    model.WijzigingstypeOpvoer,
		Entiteitnaam:      "A",
		EntiteitID:        "1",
		Representatienaam: "A_U",
		RepresentatieID:   "999",
	}

	err = handleRepresentatieOntOpvoer(ctx, tx, wijziging)
	if err == nil {
		t.Fatal("expected error when no rows are affected")
	}
	if !strings.Contains(err.Error(), "vond geen record") {
		t.Fatalf("expected no-record error, got: %v", err)
	}

	mock.ExpectRollback()
	if err := tx.Rollback(); err != nil {
		t.Fatalf("failed to rollback tx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestHandleRepresentatieOntAfvoer_SuccessFallbackToEntiteitFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer sqlDB.Close()

	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectBegin()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	mock.ExpectExec(`UPDATE "a" SET afvoer = NULL.*id`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	wijziging := model.Wijziging{
		ID:                902,
		Wijzigingstype:    model.WijzigingstypeAfvoer,
		Entiteitnaam:      "A",
		EntiteitID:        "2",
		Representatienaam: "",
		RepresentatieID:   "",
	}

	err = handleRepresentatieOntAfvoer(ctx, tx, wijziging)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	mock.ExpectCommit()
	if err := tx.Commit(); err != nil {
		t.Fatalf("failed to commit tx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
