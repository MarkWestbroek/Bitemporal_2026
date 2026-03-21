package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func TestRegistreerMetNieuweAanpak_ReturnsInternalServerErrorWhenBeginTxFails(t *testing.T) {
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

	mock.ExpectBegin().WillReturnError(errors.New("begin failed"))

	payload := `{"registratie":{"registratietype":"registratie"},"wijzigingen":[]}`
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/registratie/", strings.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	handler := RegistreerMetNieuweAanpak()
	handler(ctx)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d: %s", rec.Code, rec.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestRegistreerMetNieuweAanpak_ReturnsInternalServerErrorWhenRegistratieInsertFails(t *testing.T) {
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

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "registratie"`).WillReturnError(errors.New("insert failed"))
	mock.ExpectRollback()

	payload := `{"registratie":{"registratietype":"registratie"},"wijzigingen":[]}`
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/registratie/", strings.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	handler := RegistreerMetNieuweAanpak()
	handler(ctx)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d: %s", rec.Code, rec.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestRegistreerMetNieuweAanpak_HappyPathReturnsCreated(t *testing.T) {
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

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "registratie"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(3))
	mock.ExpectExec(`UPDATE "registratie"`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE "registratie"`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	payload := `{"registratie":{"registratietype":"registratie"},"wijzigingen":[]}`
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/registratie/", strings.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	handler := RegistreerMetNieuweAanpak()
	handler(ctx)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if id, ok := body["registratie_id"].(float64); !ok || int(id) != 3 {
		t.Fatalf("expected registratie_id 3, got %#v", body["registratie_id"])
	}
	if wijzigingen, ok := body["wijzigingen"].([]any); !ok || len(wijzigingen) != 0 {
		t.Fatalf("expected empty wijzigingen, got %#v", body["wijzigingen"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
