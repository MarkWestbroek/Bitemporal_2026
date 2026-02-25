package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

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

	representatie := &model.A_U{A_ID: 1, Rel_ID: 999, Aaa: "nieuw", Bbb: "nieuw"}
	tijdstip := time.Date(2026, 2, 25, 10, 0, 0, 0, time.UTC)

	// SQL-volgorde: select actieve voorganger -> update afvoer -> insert wijziging.
	mock.ExpectQuery(`SELECT .*FROM "a_u".*afvoer IS NULL`).
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

	representatie := &model.A_U{A_ID: 1, Rel_ID: 999, Aaa: "nieuw", Bbb: "nieuw"}
	tijdstip := time.Date(2026, 2, 25, 10, 0, 0, 0, time.UTC)

	// Simuleer twee actieve voorgangers in het queryresultaat.
	mock.ExpectQuery(`SELECT .*FROM "a_u".*afvoer IS NULL`).
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

	representatie := &model.A_U{A_ID: 0, Rel_ID: 999, Aaa: "nieuw", Bbb: "nieuw"}
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
