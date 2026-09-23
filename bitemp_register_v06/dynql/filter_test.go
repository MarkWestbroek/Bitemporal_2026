package dynql

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

// Deze tests gebruiken het CG-model (Initiatief), omdat dat alle vormen bevat:
// enkelvoudige en meervoudige GE's, relaties met een secundaire id op de hub en
// een enum op de data. De filtercode zelf kent geen typenamen.

func initiatiefMeta(t *testing.T) model.TypeMeta {
	t.Helper()
	meta, ok := model.MetaRegistry.GetTypeMeta("Initiatief")
	if !ok {
		t.Skip("CG-model (Initiatief) niet geregistreerd")
	}
	return meta
}

// renderFilter bouwt SELECT … FROM initiatief met het filter en geeft de SQL terug.
func renderFilter(t *testing.T, filter map[string]interface{}, peil *time.Time) (string, error) {
	t.Helper()
	sqlDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer sqlDB.Close()
	testDB := bun.NewDB(sqlDB, pgdialect.New())

	meta := initiatiefMeta(t)
	q := testDB.NewSelect().Model(meta.SliceFactory())
	q, err = pasFilterToe(q, meta, filter, peil)
	if err != nil {
		return "", err
	}
	return q.String(), nil
}

func mustRender(t *testing.T, filter map[string]interface{}, peil *time.Time) string {
	t.Helper()
	sql, err := renderFilter(t, filter, peil)
	if err != nil {
		t.Fatalf("onverwachte fout: %v", err)
	}
	return sql
}

func verwachtBevat(t *testing.T, sql string, delen ...string) {
	t.Helper()
	for _, d := range delen {
		if !strings.Contains(sql, d) {
			t.Errorf("SQL mist %q\nSQL: %s", d, sql)
		}
	}
}

// De kern: condities op hub-kolom (gemeente_id) en data-kolom (rol) van hetzelfde GE
// moeten in één EXISTS staan, anders matcht "gemeente 363 realiseert" ook een
// initiatief waar 363 alleen gebruikt en een andere gemeente realiseert.
func TestFilter_ZelfdeRecordInEenExists(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{
		"initiatief_gemeenten": map[string]interface{}{
			"gemeente_id": map[string]interface{}{"eq": 363},
			"rol":         map[string]interface{}{"eq": "Realiseert"},
		},
	}, nil)

	if n := strings.Count(sql, "EXISTS"); n != 1 {
		t.Fatalf("verwacht precies één EXISTS, kreeg %d\nSQL: %s", n, sql)
	}
	verwachtBevat(t, sql,
		`FROM "initiatiefgemeente" AS "f1" JOIN "initiatiefgemeente_data" AS "f1d"`,
		`"f1d"."initiatief_id" = "f1"."initiatief_id" AND "f1d"."rel_id" = "f1"."rel_id"`,
		`"f1"."initiatief_id" = "initiatief"."id"`, // correlatie met de buitenste rij
		`"f1"."afvoer" IS NULL`,      // hub actief
		`"f1d"."afvoer" IS NULL`,     // data actief
		`"f1"."gemeente_id" = 363`,   // hub-kolom
		`"f1d"."rol" = 'Realiseert'`, // data-kolom, zelfde subquery
	)
}

func TestFilter_TweeGEsGevenTweeExists(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{
		"planningen":           map[string]interface{}{"fase": map[string]interface{}{"eq": "Idee (nog geen concrete opbrengsten)"}},
		"initiatief_gemeenten": map[string]interface{}{"gemeente_id": map[string]interface{}{"eq": 363}},
	}, nil)
	if n := strings.Count(sql, "EXISTS"); n != 2 {
		t.Fatalf("verwacht twee EXISTS, kreeg %d\nSQL: %s", n, sql)
	}
	// Unieke aliassen per subquery.
	verwachtBevat(t, sql, `AS "f1"`, `AS "f2"`)
}

func TestFilter_LeegGEObjectIsBestaan(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{"planningen": map[string]interface{}{}}, nil)
	verwachtBevat(t, sql, `EXISTS (SELECT 1 FROM "initiatief_planning" AS "f1"`)
}

func TestFilter_NotWordtNotExists(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{
		"not": map[string]interface{}{"beoordelingen": map[string]interface{}{}},
	}, nil)
	verwachtBevat(t, sql, `NOT (EXISTS (SELECT 1 FROM "initiatief_beoordeling"`)
}

func TestFilter_OrEnAnd(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{
		"or": []interface{}{
			map[string]interface{}{"id": map[string]interface{}{"eq": 1}},
			map[string]interface{}{"id": map[string]interface{}{"eq": 2}},
		},
	}, nil)
	verwachtBevat(t, sql, `(("initiatief"."id" = 1) OR ("initiatief"."id" = 2))`)
}

// Een or zonder alternatieven (leeg, of alleen null-items) is nooit waar. Vóór
// 23-09-2026 leverde or: [] "geen conditie" op, dus alles — een verruiming.
func TestFilter_OrZonderAlternatievenIsOnwaar(t *testing.T) {
	for _, lijst := range [][]interface{}{{}, {nil}, {nil, nil}} {
		sql := mustRender(t, map[string]interface{}{"or": lijst}, nil)
		verwachtBevat(t, sql, "WHERE (FALSE)")
	}
}

// Een null-item in een and telt niet mee (neutraal); in een or voegt het niets toe.
func TestFilter_NullItemTeltNietMee(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{
		"and": []interface{}{map[string]interface{}{"id": map[string]interface{}{"eq": 7}}, nil},
	}, nil)
	verwachtBevat(t, sql, `WHERE ((("initiatief"."id" = 7)))`)

	sql = mustRender(t, map[string]interface{}{
		"or": []interface{}{map[string]interface{}{"id": map[string]interface{}{"eq": 7}}, nil},
	}, nil)
	verwachtBevat(t, sql, `WHERE ((("initiatief"."id" = 7)))`)
}

func TestFilter_LeegFilterGeenWhere(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{}, nil)
	if strings.Contains(sql, "WHERE") {
		t.Errorf("leeg filter mag geen WHERE opleveren\nSQL: %s", sql)
	}
}

func TestFilter_NotLeegIsNooitWaar(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{"not": map[string]interface{}{}}, nil)
	verwachtBevat(t, sql, `NOT (TRUE)`)
}

// Met een peiltijdstip toetst de EXISTS of hub én data op dat moment actief waren.
func TestFilter_PeiltijdstipOpHubEnData(t *testing.T) {
	peil := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	sql := mustRender(t, map[string]interface{}{
		"initiatief_gemeenten": map[string]interface{}{"rol": map[string]interface{}{"eq": "Realiseert"}},
	}, &peil)
	verwachtBevat(t, sql,
		`"f1"."opvoer" <= '2025-06-01 00:00:00+00:00'`,
		`("f1"."afvoer" IS NULL OR "f1"."afvoer" > '2025-06-01 00:00:00+00:00')`,
		`"f1d"."opvoer" <= '2025-06-01 00:00:00+00:00'`,
		`("f1d"."afvoer" IS NULL OR "f1d"."afvoer" > '2025-06-01 00:00:00+00:00')`,
	)
	if strings.Contains(sql, `"f1"."afvoer" IS NULL AND`) {
		t.Errorf("met peiltijdstip hoort er geen kale 'afvoer IS NULL' te staan\nSQL: %s", sql)
	}
}

func TestFilter_Operatoren(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{
		"planningen": map[string]interface{}{
			"startdatum":            map[string]interface{}{"gte": model.Date{Time: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}},
			"planningsinfo":         map[string]interface{}{"contains": "50%_zeker"},
			"obstakels":             map[string]interface{}{"isNull": true},
			"waar_tegenaan_gelopen": map[string]interface{}{"ne": "n.v.t."},
		},
	}, nil)
	verwachtBevat(t, sql,
		`"f1d"."startdatum" >= '2026-01-01'`,
		`"f1d"."planningsinfo" ILIKE '%50\%\_zeker%'`, // % en _ letterlijk
		`"f1d"."obstakels" IS NULL`,
		`"f1d"."waar_tegenaan_gelopen" IS DISTINCT FROM 'n.v.t.'`, // NULL-veilig
	)
}

func TestFilter_InLeegIsOnwaar(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{"id": map[string]interface{}{"in": []interface{}{}}}, nil)
	verwachtBevat(t, sql, "WHERE (FALSE)")

	sql = mustRender(t, map[string]interface{}{"id": map[string]interface{}{"in": []interface{}{1, 2}}}, nil)
	verwachtBevat(t, sql, `"initiatief"."id" IN (1, 2)`)
}

func TestFilter_OnbekendeEnumwaardeGeeftFout(t *testing.T) {
	_, err := renderFilter(t, map[string]interface{}{
		"initiatief_gemeenten": map[string]interface{}{"rol": map[string]interface{}{"eq": "Realiseerd"}},
	}, nil)
	if err == nil || !strings.Contains(err.Error(), "toegestaan: Realiseert, Maakt gebruik van") {
		t.Fatalf("verwacht een fout met de toegestane waarden, kreeg: %v", err)
	}
}

// Een waarde met een aanhalingsteken mag de SQL niet breken: waarden gaan als argument mee.
func TestFilter_WaardenWordenGeescaped(t *testing.T) {
	sql := mustRender(t, map[string]interface{}{
		"producten": map[string]interface{}{"naam": map[string]interface{}{"eq": "x' OR 1=1 --"}},
	}, nil)
	verwachtBevat(t, sql, `"f1d"."naam" = 'x'' OR 1=1 --'`)
}

// --- Schema en end-to-end --------------------------------------------------

func TestFilter_SchemaHeeftFilterTypen(t *testing.T) {
	meta := initiatiefMeta(t)
	input := filterInputVoorEntiteit(meta)
	if input == nil {
		t.Fatal("geen filter-inputtype voor Initiatief")
	}
	if input.Name() != "InitiatiefFilter" {
		t.Errorf("naam: %s", input.Name())
	}
	velden := input.Fields()
	for _, naam := range []string{"id", "planningen", "initiatief_gemeenten", "and", "or", "not"} {
		if velden[naam] == nil {
			t.Errorf("InitiatiefFilter mist %q", naam)
		}
	}
	// Afgeleide velden en technische kolommen horen er niet in.
	for _, naam := range []string{"weergavenaam", "opvoer", "afvoer"} {
		if velden[naam] != nil {
			t.Errorf("InitiatiefFilter hoort %q niet te bevatten", naam)
		}
	}

	gem, ok := velden["initiatief_gemeenten"].Type.(*graphql.InputObject)
	if !ok {
		t.Fatalf("initiatief_gemeenten is geen input-object: %T", velden["initiatief_gemeenten"].Type)
	}
	gemVelden := gem.Fields()
	for _, naam := range []string{"gemeente_id", "rol"} {
		if gemVelden[naam] == nil {
			t.Errorf("InitiatiefGemeenteFilter mist %q", naam)
		}
	}
	for _, naam := range []string{"initiatief_id", "rel_id", "versie", "opvoer", "afvoer"} {
		if gemVelden[naam] != nil {
			t.Errorf("InitiatiefGemeenteFilter hoort %q niet te bevatten", naam)
		}
	}
}

// Via het echte schema: het argument wordt geparsed, de resolver bouwt de SQL met
// filter, volgorde en paginering, en een fout in het filter komt terug als GraphQL-fout.
func TestFilter_EndToEndViaGraphQL(t *testing.T) {
	meta := initiatiefMeta(t)

	// sqlmock kan de matcher meerdere keren per query aanroepen; we verzamelen unieke SQL.
	var mu sync.Mutex
	var queries []string
	gezien := map[string]bool{}
	matcher := sqlmock.QueryMatcherFunc(func(_, actual string) error {
		mu.Lock()
		if !gezien[actual] {
			gezien[actual] = true
			queries = append(queries, actual)
		}
		mu.Unlock()
		return nil
	})
	sqlDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(matcher))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer sqlDB.Close()
	mock.MatchExpectationsInOrder(false)
	mock.ExpectQuery("").WillReturnRows(sqlmock.NewRows([]string{"id"}))

	schema, err := BuildSchema(bun.NewDB(sqlDB, pgdialect.New()))
	if err != nil {
		t.Fatalf("BuildSchema: %v", err)
	}
	defer InitDB(nil)

	padnaam := meta.Padnaam
	res := graphql.Do(graphql.Params{
		Schema:  *schema,
		Context: context.Background(),
		RequestString: `{ ` + padnaam + `(
			filter: { initiatief_gemeenten: { gemeente_id: { eq: 363 }, rol: { eq: "Realiseert" } } },
			peiltijdstip: "2025-06-01T00:00:00Z", limit: 10, offset: 20
		) { id } }`,
	})
	if len(res.Errors) > 0 {
		t.Fatalf("GraphQL-fouten: %v", res.Errors)
	}
	if len(queries) != 1 {
		t.Fatalf("verwacht één query, kreeg %d: %v", len(queries), queries)
	}
	verwachtBevat(t, queries[0],
		`"f1d"."rol" = 'Realiseert'`,
		`"f1"."gemeente_id" = 363`,
		`"f1"."opvoer" <= '2025-06-01 00:00:00+00:00'`,
		`ORDER BY "initiatief"."id" ASC LIMIT 10 OFFSET 20`,
	)

	// Een onbekende enumwaarde komt terug als fout, niet als lege lijst.
	res = graphql.Do(graphql.Params{
		Schema:        *schema,
		Context:       context.Background(),
		RequestString: `{ ` + padnaam + `(filter: { initiatief_gemeenten: { rol: { eq: "Onzin" } } }) { id } }`,
	})
	if len(res.Errors) == 0 || !strings.Contains(res.Errors[0].Message, "toegestaan") {
		t.Fatalf("verwacht een fout over toegestane waarden, kreeg: %v", res.Errors)
	}

	// Een onbekend veld wordt al door GraphQL-validatie tegengehouden.
	res = graphql.Do(graphql.Params{
		Schema:        *schema,
		Context:       context.Background(),
		RequestString: `{ ` + padnaam + `(filter: { bestaat_niet: { eq: 1 } }) { id } }`,
	})
	if len(res.Errors) == 0 {
		t.Fatal("verwacht een validatiefout voor een onbekend filterveld")
	}
}

// Het patroon voor opgeslagen (publieke) documenten, plan §7.4.1: het vaste deel staat
// in het document, de aanroeper kan via een optionele variabele alleen versmallen.
func TestFilter_OpgeslagenDocumentAanroeperVersmaltAlleen(t *testing.T) {
	meta := initiatiefMeta(t)

	var mu sync.Mutex
	var laatste string
	matcher := sqlmock.QueryMatcherFunc(func(_, actual string) error {
		mu.Lock()
		laatste = actual
		mu.Unlock()
		return nil
	})
	sqlDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(matcher))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer sqlDB.Close()
	mock.MatchExpectationsInOrder(false)
	for i := 0; i < 3; i++ {
		mock.ExpectQuery("").WillReturnRows(sqlmock.NewRows([]string{"id"}))
	}
	schema, err := BuildSchema(bun.NewDB(sqlDB, pgdialect.New()))
	if err != nil {
		t.Fatalf("BuildSchema: %v", err)
	}
	defer InitDB(nil)

	document := `query($extra: InitiatiefFilter) {
		` + meta.Padnaam + `(filter: { and: [ { id: { eq: 7 } }, $extra ] }) { id } }`

	voer := func(t *testing.T, vars map[string]interface{}) string {
		t.Helper()
		laatste = ""
		res := graphql.Do(graphql.Params{Schema: *schema, Context: context.Background(),
			RequestString: document, VariableValues: vars})
		if len(res.Errors) > 0 {
			t.Fatalf("GraphQL-fouten: %v", res.Errors)
		}
		return laatste
	}

	t.Run("variabele weggelaten: alleen het vaste deel", func(t *testing.T) {
		sql := voer(t, nil)
		verwachtBevat(t, sql, `WHERE ((("initiatief"."id" = 7)))`)
	})
	t.Run("aanroeper versmalt", func(t *testing.T) {
		sql := voer(t, map[string]interface{}{"extra": map[string]interface{}{"planningen": map[string]interface{}{}}})
		verwachtBevat(t, sql, `("initiatief"."id" = 7) AND (EXISTS (SELECT 1 FROM "initiatief_planning"`)
	})
	t.Run("poging tot verruimen met or blijft binnen het vaste deel", func(t *testing.T) {
		sql := voer(t, map[string]interface{}{"extra": map[string]interface{}{
			"or": []interface{}{map[string]interface{}{"id": map[string]interface{}{"eq": 8}}},
		}})
		// De or zit binnen de and: id = 7 EN (id = 8) — nooit meer dan het vaste deel.
		verwachtBevat(t, sql, `("initiatief"."id" = 7) AND ((("initiatief"."id" = 8)))`)
	})
}
