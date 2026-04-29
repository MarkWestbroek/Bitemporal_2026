// Tests voor de pure RegistreerCore-engine (fase 0).
// Deze tests bewijzen dat RegistreerCore zonder gin.Context aan te roepen is
// en dat de hetzelfde gedrag levert als de oude monolithische handler:
//   - happy path (lege wijzigingen) → Status 201, RegistratieID gezet
//   - BeginTx-fout → RegistreerError(500)
//   - Insert-fout  → RegistreerError(500), rollback
package handlers

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func newMockDB(t *testing.T) (*bun.DB, sqlmock.Sqlmock, func()) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	return db, mock, func() {
		_ = db.Close()
		_ = sqlDB.Close()
	}
}

func baseRequest() model.RegistreerRequest {
	return model.RegistreerRequest{
		Registratie: model.Registratie{Registratietype: model.RegistratietypeRegistratie},
		Wijzigingen: []model.WijzigingRequest{},
	}
}

func TestRegistreerCore_HappyPathLegeWijzigingen(t *testing.T) {
	db, mock, cleanup := newMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "registratie"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(7))
	mock.ExpectExec(`UPDATE "registratie"`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE "registratie"`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	audit := AuditMeta{
		RawBody:       []byte(`{"registratie":{"registratietype":"registratie"},"wijzigingen":[]}`),
		RequestPath:   "/registratie/",
		RequestMethod: http.MethodPost,
	}

	res, rerr := RegistreerCore(context.Background(), db, baseRequest(), audit)
	if rerr != nil {
		t.Fatalf("onverwachte fout: %v (status=%d)", rerr, rerr.Status)
	}
	if res.Status != http.StatusCreated {
		t.Fatalf("status: wil %d, kreeg %d", http.StatusCreated, res.Status)
	}
	if res.RegistratieID != 7 {
		t.Fatalf("registratieID: wil 7, kreeg %d", res.RegistratieID)
	}
	if len(res.Wijzigingen) != 0 {
		t.Fatalf("wijzigingen: wil 0, kreeg %d", len(res.Wijzigingen))
	}
	if len(res.ResponseBody) == 0 {
		t.Fatal("ResponseBody mag niet leeg zijn")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ongeldigde sql-verwachtingen: %v", err)
	}
}

func TestRegistreerCore_BeginTxFoutMapsTo500(t *testing.T) {
	db, mock, cleanup := newMockDB(t)
	defer cleanup()

	mock.ExpectBegin().WillReturnError(errors.New("begin failed"))

	_, rerr := RegistreerCore(context.Background(), db, baseRequest(), AuditMeta{})
	if rerr == nil {
		t.Fatal("verwacht een RegistreerError, kreeg nil")
	}
	if rerr.Status != http.StatusInternalServerError {
		t.Fatalf("status: wil 500, kreeg %d", rerr.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ongeldigde sql-verwachtingen: %v", err)
	}
}

func TestRegistreerCore_InsertFoutRollbackEnError(t *testing.T) {
	db, mock, cleanup := newMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "registratie"`).WillReturnError(errors.New("insert failed"))
	mock.ExpectRollback()

	_, rerr := RegistreerCore(context.Background(), db, baseRequest(), AuditMeta{})
	if rerr == nil || rerr.Status != http.StatusInternalServerError {
		t.Fatalf("verwacht RegistreerError(500), kreeg %v", rerr)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ongeldigde sql-verwachtingen: %v", err)
	}
}

func TestRegistreerCore_AuditVeldenWordenGezet(t *testing.T) {
	db, mock, cleanup := newMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "registratie"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(11))
	mock.ExpectExec(`UPDATE "registratie"`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE "registratie"`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	req := baseRequest()
	audit := AuditMeta{
		RawBody:       []byte(`{"hello":"world"}`),
		RequestPath:   "/registratie/abc",
		RequestMethod: "POST",
		EntiteitID:    "abc",
	}

	res, rerr := RegistreerCore(context.Background(), db, req, audit)
	if rerr != nil {
		t.Fatalf("onverwachte fout: %v", rerr)
	}
	if res.RegistratieID != 11 {
		t.Fatalf("registratieID: wil 11, kreeg %d", res.RegistratieID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ongeldigde sql-verwachtingen: %v", err)
	}
}
