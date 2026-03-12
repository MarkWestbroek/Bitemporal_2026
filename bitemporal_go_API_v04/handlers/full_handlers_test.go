package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v04/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func TestZetAfgeleideFormeleTijdVoorRepresentatie_OpvoerBlijftGevuldOpPeilVoorLatereOngedaanmaking(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, "/full/as/?t=1", nil)

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

	peiltijdstip := time.Date(2026, 1, 1, 1, 0, 0, 1000, time.UTC)
	opvoerTijdstip := peiltijdstip

	mock.ExpectQuery(`(?s)SELECT .*FROM wijziging AS w.*JOIN registratie AS reg ON reg.id = w.registratie_id.*ORDER BY reg.tijdstip DESC, w.id DESC.*LIMIT 1`).
		WillReturnRows(sqlmock.NewRows([]string{"wijzigingstype", "registratie_tijdstip"}).
			AddRow(string(model.WijzigingstypeOpvoer), opvoerTijdstip))

	representatie := model.Full_A{ID: 1}
	err = zetAfgeleideFormeleTijdVoorRepresentatie(
		ctx,
		&representatie,
		"A",
		"1",
		"",
		"",
		peiltijdstip,
	)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if representatie.Opvoer == nil {
		t.Fatal("expected opvoer to be set, got nil")
	}
	if !representatie.Opvoer.Equal(opvoerTijdstip) {
		t.Fatalf("expected opvoer %v, got %v", opvoerTijdstip, *representatie.Opvoer)
	}
	if representatie.Afvoer != nil {
		t.Fatalf("expected afvoer to be nil, got %v", *representatie.Afvoer)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
