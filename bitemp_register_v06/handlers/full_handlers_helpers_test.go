package handlers

import (
	"context"
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

func newQueryContext(rawURL string) *gin.Context {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, rawURL, nil)
	return ctx
}

func TestParsePeiltijdstipUitQuerystring(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("returns nil when query is empty", func(t *testing.T) {
		ctx := newQueryContext("/")
		v, err := parsePeiltijdstipUitQuerystring(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if v != nil {
			t.Fatalf("expected nil peiltijdstip, got %v", *v)
		}
	})

	t.Run("parses peiltijdstip parameter", func(t *testing.T) {
		expected := time.Date(2026, 1, 2, 3, 4, 5, 6000, time.UTC)
		ctx := newQueryContext("/?peiltijdstip=" + expected.Format(time.RFC3339Nano))
		v, err := parsePeiltijdstipUitQuerystring(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if v == nil || !v.Equal(expected) {
			t.Fatalf("expected %v, got %v", expected, v)
		}
	})

	t.Run("parses t parameter", func(t *testing.T) {
		ctx := newQueryContext("/?t=4")
		v, err := parsePeiltijdstipUitQuerystring(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		expected := tijdstipUitT(4)
		if v == nil || !v.Equal(expected) {
			t.Fatalf("expected %v, got %v", expected, v)
		}
	})

	t.Run("returns error on invalid peiltijdstip", func(t *testing.T) {
		ctx := newQueryContext("/?peiltijdstip=not-a-date")
		if _, err := parsePeiltijdstipUitQuerystring(ctx); err == nil {
			t.Fatal("expected error for invalid peiltijdstip")
		}
	})
}

func TestParseRegistratietypesUitQuerystring(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("parses comma-separated and repeated values", func(t *testing.T) {
		ctx := newQueryContext("/?type=registratie,correctie&type=registratie&type=ongedaanmaking")
		types, err := parseRegistratietypesUitQuerystring(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if len(types) != 3 {
			t.Fatalf("expected 3 distinct types, got %d", len(types))
		}
	})

	t.Run("returns nil when missing", func(t *testing.T) {
		ctx := newQueryContext("/")
		types, err := parseRegistratietypesUitQuerystring(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if types != nil {
			t.Fatalf("expected nil, got %#v", types)
		}
	})

	t.Run("returns error on invalid value", func(t *testing.T) {
		ctx := newQueryContext("/?type=invalid")
		if _, err := parseRegistratietypesUitQuerystring(ctx); err == nil {
			t.Fatal("expected error for invalid type")
		}
	})
}

func TestSanitizeResponseWithoutAfvoer_RemovesNestedAfvoer(t *testing.T) {
	payload := map[string]any{
		"id":     1,
		"afvoer": "x",
		"child": map[string]any{
			"afvoer": "y",
			"name":   "ok",
		},
		"list": []any{
			map[string]any{"afvoer": "z", "n": 1},
		},
	}

	sanitized, err := sanitizeResponseWithoutAfvoer(payload)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	m, ok := sanitized.(map[string]any)
	if !ok {
		t.Fatalf("expected map result, got %T", sanitized)
	}
	if _, exists := m["afvoer"]; exists {
		t.Fatal("expected top-level afvoer to be removed")
	}

	child, ok := m["child"].(map[string]any)
	if !ok {
		t.Fatalf("expected child map, got %T", m["child"])
	}
	if _, exists := child["afvoer"]; exists {
		t.Fatal("expected nested child afvoer to be removed")
	}

	list, ok := m["list"].([]any)
	if !ok || len(list) != 1 {
		t.Fatalf("expected list with one item, got %#v", m["list"])
	}
	listItem, ok := list[0].(map[string]any)
	if !ok {
		t.Fatalf("expected list item map, got %T", list[0])
	}
	if _, exists := listItem["afvoer"]; exists {
		t.Fatal("expected list item afvoer to be removed")
	}
}

func TestEntiteitNaamNaarFullPathSegment_UsesRegistry(t *testing.T) {
	var entiteitMeta model.TypeMeta
	found := false
	for _, meta := range model.MetaRegistry {
		if meta.Metatype == model.MetatypeEntiteit && meta.Padnaam != "" {
			entiteitMeta = meta
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected at least one entiteit with padnaam in metaregistry")
	}

	segment, ok := entiteitNaamNaarFullPathSegment(entiteitMeta.Typenaam)
	if !ok {
		t.Fatalf("expected segment for %s", entiteitMeta.Typenaam)
	}
	if segment != entiteitMeta.Padnaam {
		t.Fatalf("expected segment %q, got %q", entiteitMeta.Padnaam, segment)
	}
}

func TestParseRegistratieIntervalUitQuerystring(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("returns nil bounds when no params", func(t *testing.T) {
		ctx := newQueryContext("/")
		ta, tb, err := parseRegistratieIntervalUitQuerystring(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if ta != nil || tb != nil {
			t.Fatalf("expected nil bounds, got ta=%v tb=%v", ta, tb)
		}
	})

	t.Run("parses both bounds", func(t *testing.T) {
		ctx := newQueryContext("/?ta=2&tb=5")
		ta, tb, err := parseRegistratieIntervalUitQuerystring(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if ta == nil || tb == nil {
			t.Fatalf("expected both bounds, got ta=%v tb=%v", ta, tb)
		}
		if !ta.Equal(tijdstipUitT(2)) || !tb.Equal(tijdstipUitT(5)) {
			t.Fatalf("unexpected bounds ta=%v tb=%v", ta, tb)
		}
	})

	t.Run("returns error on inverted interval", func(t *testing.T) {
		ctx := newQueryContext("/?ta=7&tb=3")
		if _, _, err := parseRegistratieIntervalUitQuerystring(ctx); err == nil {
			t.Fatal("expected error for ta > tb")
		}
	})

	t.Run("returns error on invalid integer", func(t *testing.T) {
		ctx := newQueryContext("/?ta=x")
		if _, _, err := parseRegistratieIntervalUitQuerystring(ctx); err == nil {
			t.Fatal("expected error for invalid ta")
		}
	})
}

func TestStructNaarMap_ConvertsStruct(t *testing.T) {
	input := struct {
		ID   int    `json:"id"`
		Naam string `json:"naam"`
	}{
		ID:   12,
		Naam: "test",
	}

	m, err := structNaarMap(input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if id, ok := m["id"].(float64); !ok || int(id) != 12 {
		t.Fatalf("expected id 12, got %#v", m["id"])
	}
	if naam, ok := m["naam"].(string); !ok || naam != "test" {
		t.Fatalf("expected naam test, got %#v", m["naam"])
	}
}

func TestTypeMetaVoorModelNaam_ResolvesByTypenaamAndFactoryType(t *testing.T) {
	meta, ok := typeMetaVoorModelNaam("A")
	if !ok {
		t.Fatal("expected to resolve model name A")
	}
	if meta.Typenaam != "A" {
		t.Fatalf("expected typenaam A, got %q", meta.Typenaam)
	}

	factoryMeta, ok := typeMetaVoorModelNaam("A")
	if !ok {
		t.Fatal("expected to resolve model name A via Factory")
	}
	if factoryMeta.Typenaam != "A" {
		t.Fatalf("expected typenaam A for A, got %q", factoryMeta.Typenaam)
	}

	if _, ok := typeMetaVoorModelNaam("DOES_NOT_EXIST"); ok {
		t.Fatal("expected unknown model to return ok=false")
	}
}

func TestFormeleTijdTargetVoorModel_EntiteitAndRepresentatie(t *testing.T) {
	entiteitTarget, err := formeleTijdTargetVoorModel("A")
	if err != nil {
		t.Fatalf("expected no error for A, got %v", err)
	}
	if entiteitTarget.Entiteitnaam != "A" {
		t.Fatalf("expected entiteitnaam A, got %q", entiteitTarget.Entiteitnaam)
	}
	if entiteitTarget.EntiteitIDExpr != "a.id::text" {
		t.Fatalf("expected entiteit id expr a.id::text, got %q", entiteitTarget.EntiteitIDExpr)
	}
	if entiteitTarget.Representatienaam != "" {
		t.Fatalf("expected empty representatienaam, got %q", entiteitTarget.Representatienaam)
	}

	repTarget, err := formeleTijdTargetVoorModel("A_U")
	if err != nil {
		t.Fatalf("expected no error for A_U, got %v", err)
	}
	if repTarget.Entiteitnaam != "A" {
		t.Fatalf("expected parent entiteitnaam A, got %q", repTarget.Entiteitnaam)
	}
	if repTarget.EntiteitIDExpr != "a_u.a_id::text" {
		t.Fatalf("expected entiteit id expr a_u.a_id::text, got %q", repTarget.EntiteitIDExpr)
	}
	if repTarget.Representatienaam != "A_U" {
		t.Fatalf("expected representatienaam A_U, got %q", repTarget.Representatienaam)
	}
	if repTarget.RepresentatieIDExpr != "a_u.rel_id::text" {
		t.Fatalf("expected representatie id expr a_u.rel_id::text, got %q", repTarget.RepresentatieIDExpr)
	}

	if _, err := formeleTijdTargetVoorModel("UNKNOWN"); err == nil {
		t.Fatal("expected error for unknown model")
	}
}

func TestApplyFormeleTijdFilterVoorModel_Branches(t *testing.T) {
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

	peil := tijdstipUitT(4)

	// Branch 1: known model uses f_formele_wijziging_op_peil.
	mock.ExpectQuery(`SELECT .*FROM "a".*f_formele_wijziging_op_peil`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "opvoer", "afvoer", "aanvang", "einde"}))

	var entiteiten []model.A
	query := DB.NewSelect().Model(&entiteiten)
	query = applyFormeleTijdFilterVoorModel(query, "A", peil)
	if err := query.Scan(context.Background()); err != nil {
		t.Fatalf("expected no error for model branch, got %v", err)
	}

	// Branch 2: unknown model falls back to opvoer/afvoer predicates.
	mock.ExpectQuery(`SELECT .*FROM "a".*opvoer <= .*afvoer IS NULL OR afvoer >`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "opvoer", "afvoer", "aanvang", "einde"}))

	query2 := DB.NewSelect().Model(&entiteiten)
	query2 = applyFormeleTijdFilterVoorModel(query2, "UNKNOWN", peil)
	if err := query2.Scan(context.Background()); err != nil {
		t.Fatalf("expected no error for fallback branch, got %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
