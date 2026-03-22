package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

type testFormeleRepresentatie struct {
	ID     int
	Opvoer *time.Time
	Afvoer *time.Time
}

func (r *testFormeleRepresentatie) GetID() any               { return r.ID }
func (r *testFormeleRepresentatie) Metatype() model.Metatype { return model.MetatypeEntiteit }
func (r *testFormeleRepresentatie) ClearID()                 { r.ID = 0 }
func (r *testFormeleRepresentatie) String() string           { return "testFormeleRepresentatie" }
func (r *testFormeleRepresentatie) GetOpvoer() *time.Time    { return r.Opvoer }
func (r *testFormeleRepresentatie) SetOpvoer(v *time.Time)   { r.Opvoer = v }
func (r *testFormeleRepresentatie) GetAfvoer() *time.Time    { return r.Afvoer }
func (r *testFormeleRepresentatie) SetAfvoer(v *time.Time)   { r.Afvoer = v }

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

	mock.ExpectQuery(`(?s)SELECT .*FROM f_formele_wijziging_op_peil\(.*\) AS v.*ORDER BY v.registratie_tijdstip DESC, v.wijziging_id DESC.*LIMIT 1`).
		WillReturnRows(sqlmock.NewRows([]string{"wijzigingstype", "registratie_tijdstip"}).
			AddRow(string(model.WijzigingstypeOpvoer), opvoerTijdstip))

	representatie := testFormeleRepresentatie{ID: 1}
	err = zetAfgeleideFormeleTijdVoorRepresentatie(
		ctx,
		&representatie,
		"TestEntiteit",
		"1",
		"",
		"",
		nil,
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
