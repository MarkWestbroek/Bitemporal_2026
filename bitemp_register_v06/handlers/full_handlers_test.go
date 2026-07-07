package handlers

// Tests voor de set-based formele-tijdafleiding (BE-review 2026-07-07, §4.4).
// Vervangt de test op de vroegere per-representatie query
// (zetAfgeleideFormeleTijdVoorRepresentatie): dezelfde semantiek loopt nu via
// laadFormeleTijdCache (één query per request) + zetAfgeleideFormeleTijdUitCache.

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

func formeleTijdRijKolommen() []string {
	return []string{"wijziging_id", "wijzigingstype", "registratie_tijdstip", "entiteit_id", "representatienaam", "representatie_id", "versie"}
}

func TestLaadFormeleTijdCache_OpvoerBlijftGevuldOpPeil(t *testing.T) {
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

	// Eén set-based query voor alle entiteit-IDs (i.p.v. één per representatie).
	mock.ExpectQuery(`(?s)SELECT .*FROM f_formele_wijziging_op_peil\(.*\) AS v.*entiteitnaam = .*entiteit_id IN`).
		WillReturnRows(sqlmock.NewRows(formeleTijdRijKolommen()).
			AddRow(10, string(model.WijzigingstypeOpvoer), opvoerTijdstip, "1", "", "", nil))

	cache, err := laadFormeleTijdCache(ctx, "TestEntiteit", []string{"1"}, peiltijdstip)
	if err != nil {
		t.Fatalf("laadFormeleTijdCache: %v", err)
	}

	representatie := testFormeleRepresentatie{ID: 1}
	zetAfgeleideFormeleTijdUitCache(&representatie, cache, "1", "", "", nil)

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

// TestFormeleTijdCache_LaatsteWijzigingWint controleert dat de Go-side
// "laatste wint"-logica dezelfde ordering hanteert als de vroegere query
// (registratie_tijdstip DESC, wijziging_id DESC).
func TestFormeleTijdCache_LaatsteWijzigingWint(t *testing.T) {
	basis := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	cache := &formeleTijdCache{
		metVersie:    map[formeleTijdKey]formeleWijzigingRij{},
		zonderVersie: map[formeleTijdKey]formeleWijzigingRij{},
	}

	// Opvoer op t=1, afvoer op t=2 → afvoer wint (later tijdstip).
	cache.bewaar(formeleWijzigingRij{WijzigingID: 1, Wijzigingstype: model.WijzigingstypeOpvoer, RegistratieTijdstip: basis.Add(1 * time.Hour), EntiteitID: "1"})
	cache.bewaar(formeleWijzigingRij{WijzigingID: 2, Wijzigingstype: model.WijzigingstypeAfvoer, RegistratieTijdstip: basis.Add(2 * time.Hour), EntiteitID: "1"})
	// Zelfde tijdstip, hoger wijziging_id wint.
	cache.bewaar(formeleWijzigingRij{WijzigingID: 3, Wijzigingstype: model.WijzigingstypeOpvoer, RegistratieTijdstip: basis.Add(2 * time.Hour), EntiteitID: "1"})

	w := cache.laatste("1", "", "", nil)
	if w == nil {
		t.Fatal("verwacht een wijziging uit de cache, kreeg nil")
	}
	if w.Wijzigingstype != model.WijzigingstypeOpvoer {
		t.Fatalf("bij gelijk tijdstip wint het hoogste wijziging_id (opvoer, id=3); kreeg %s", w.Wijzigingstype)
	}
}

// TestFormeleTijdCache_VersieLookup controleert dat versie-PK types op
// (entiteit, representatie, rel_id, versie) worden opgezocht.
func TestFormeleTijdCache_VersieLookup(t *testing.T) {
	basis := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	cache := &formeleTijdCache{
		metVersie:    map[formeleTijdKey]formeleWijzigingRij{},
		zonderVersie: map[formeleTijdKey]formeleWijzigingRij{},
	}

	v1 := int64(1)
	v2 := int64(2)
	cache.bewaar(formeleWijzigingRij{WijzigingID: 1, Wijzigingstype: model.WijzigingstypeAfvoer, RegistratieTijdstip: basis.Add(1 * time.Hour), EntiteitID: "1", Representatienaam: "A_U_Data", RepresentatieID: "7", Versie: &v1})
	cache.bewaar(formeleWijzigingRij{WijzigingID: 2, Wijzigingstype: model.WijzigingstypeOpvoer, RegistratieTijdstip: basis.Add(2 * time.Hour), EntiteitID: "1", Representatienaam: "A_U_Data", RepresentatieID: "7", Versie: &v2})

	// Versie 1 is afgevoerd, versie 2 actief — per versie apart op te zoeken.
	w1 := cache.laatste("1", "A_U_Data", "7", &v1)
	if w1 == nil || w1.Wijzigingstype != model.WijzigingstypeAfvoer {
		t.Fatalf("versie 1: wil afvoer, kreeg %+v", w1)
	}
	w2 := cache.laatste("1", "A_U_Data", "7", &v2)
	if w2 == nil || w2.Wijzigingstype != model.WijzigingstypeOpvoer {
		t.Fatalf("versie 2: wil opvoer, kreeg %+v", w2)
	}

	// Onbekende sleutel → nil (representatie krijgt geen opvoer/afvoer).
	if w := cache.laatste("1", "A_U_Data", "8", &v1); w != nil {
		t.Fatalf("onbekende rel_id: wil nil, kreeg %+v", w)
	}
}
