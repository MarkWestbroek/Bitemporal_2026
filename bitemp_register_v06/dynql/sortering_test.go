package dynql

// Tests van het argument `sorteer` (sortering.go). De sqlmock-test bewijst de SQL-tekst; de
// PG-test (DYNQL_TEST_PG_DSN, zie filter_pg_test.go) bewijst dat Postgres er de goede volgorde
// mee teruggeeft, ook met een peiltijdstip, een filter en paginering.

import (
	"context"
	"database/sql"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func renderSortering(t *testing.T, sortering []Sortering, peil *time.Time, mag func(string) bool) (string, error) {
	t.Helper()
	sqlDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer sqlDB.Close()
	testDB := bun.NewDB(sqlDB, pgdialect.New())
	meta := initiatiefMeta(t)
	q, err := pasSorteringToe(testDB.NewSelect().Model(meta.SliceFactory()), meta, sortering, peil, mag)
	if err != nil {
		return "", err
	}
	return q.String(), nil
}

func TestSortering_ZonderSleutelsOpID(t *testing.T) {
	sql, err := renderSortering(t, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(sql, `ORDER BY "initiatief"."id" ASC`) {
		t.Errorf("verwacht alleen ORDER BY id, kreeg: %s", sql)
	}
}

func TestSortering_GEVeldAlsSubqueryMetIDErachter(t *testing.T) {
	sql, err := renderSortering(t, []Sortering{{Veldpad: "initiatief_gemeenten.rol", Aflopend: true}}, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	verwachtBevat(t, sql,
		`ORDER BY (SELECT MAX("s1d"."rol") FROM "initiatiefgemeente" AS "s1" JOIN "initiatiefgemeente_data" AS "s1d"`,
		`"s1d"."initiatief_id" = "s1"."initiatief_id" AND "s1d"."rel_id" = "s1"."rel_id"`,
		`"s1d"."afvoer" IS NULL`,
		`WHERE "s1"."initiatief_id" = "initiatief"."id" AND "s1"."afvoer" IS NULL) DESC NULLS LAST, "initiatief"."id" DESC`,
	)
}

func TestSortering_HubKolomOplopendMetPeil(t *testing.T) {
	peil := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	sql, err := renderSortering(t, []Sortering{{Veldpad: "initiatief_gemeenten.gemeente_id"}}, &peil, nil)
	if err != nil {
		t.Fatal(err)
	}
	verwachtBevat(t, sql,
		`(SELECT MIN("s1"."gemeente_id") FROM "initiatiefgemeente" AS "s1"`,
		`"s1"."opvoer" <= '2025-06-01`,
		`("s1"."afvoer" IS NULL OR "s1"."afvoer" > '2025-06-01`,
		`ASC NULLS LAST`,
	)
}

func TestSortering_Fouten(t *testing.T) {
	gevallen := map[string][]Sortering{
		"onbekend veld":       {{Veldpad: "bestaatniet"}},
		"onbekend GE":         {{Veldpad: "bestaatniet.rol"}},
		"onbekend veld in GE": {{Veldpad: "initiatief_gemeenten.bestaatniet"}},
		"te diep":             {{Veldpad: "initiatief_gemeenten.gemeente.naam"}},
	}
	for naam, s := range gevallen {
		if _, err := renderSortering(t, s, nil, nil); err == nil || !strings.HasPrefix(err.Error(), "sorteer:") {
			t.Errorf("%s: verwacht een sorteer-fout, kreeg %v", naam, err)
		}
	}
	// Een waarde van de aanvrager komt nooit letterlijk in de SQL: een onbekend pad is een fout.
	if _, err := renderSortering(t, []Sortering{{Veldpad: `id"; DROP TABLE x; --`}}, nil, nil); err == nil {
		t.Error("een pad met SQL erin hoort een fout te geven")
	}
}

func TestSortering_ToegangsbeleidWeigertVerborgenVeld(t *testing.T) {
	mag := func(pad string) bool { return !strings.HasSuffix(pad, ".rol") }
	if _, err := renderSortering(t, []Sortering{{Veldpad: "initiatief_gemeenten.rol"}}, nil, mag); err == nil ||
		!strings.Contains(err.Error(), "geen toegang") {
		t.Errorf("verwacht een toegangsfout, kreeg %v", err)
	}
	// Een technische sleutel blijft sorteerbaar, net als filterbaar.
	if _, err := renderSortering(t, []Sortering{{Veldpad: "initiatief_gemeenten.gemeente_id"}}, nil, mag); err != nil {
		t.Errorf("gemeente_id hoort sorteerbaar te blijven: %v", err)
	}
}

func TestSorteringUitArgs(t *testing.T) {
	s, err := sorteringUitArgs(map[string]interface{}{"sorteer": []interface{}{
		map[string]interface{}{"veld": " id ", "aflopend": true},
		map[string]interface{}{"veld": "a.b"},
	}})
	if err != nil || !reflect.DeepEqual(s, []Sortering{{Veldpad: "id", Aflopend: true}, {Veldpad: "a.b"}}) {
		t.Errorf("kreeg %v, %v", s, err)
	}
	vier := []interface{}{}
	for i := 0; i < maxSorteerSleutels+1; i++ {
		vier = append(vier, map[string]interface{}{"veld": "id"})
	}
	if _, err := sorteringUitArgs(map[string]interface{}{"sorteer": vier}); err == nil {
		t.Error("te veel sleutels hoort een fout te geven")
	}
	if s, err := sorteringUitArgs(map[string]interface{}{}); s != nil || err != nil {
		t.Errorf("zonder argument: %v, %v", s, err)
	}
}

func TestSorteringPG_Volgorde(t *testing.T) {
	dsn := os.Getenv("DYNQL_TEST_PG_DSN")
	if dsn == "" {
		t.Skip("DYNQL_TEST_PG_DSN niet gezet; integratietest overgeslagen")
	}
	meta := initiatiefMeta(t)
	ctx := context.Background()
	pg := bun.NewDB(sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn))), pgdialect.New())
	defer pg.Close()

	var tabellen []interface{}
	for _, typenaam := range []string{"Initiatief", "InitiatiefGemeente", "InitiatiefGemeente_Data"} {
		tabellen = append(tabellen, makeMetaRepresentative(model.MetaRegistry[typenaam]))
	}
	for _, tbl := range tabellen {
		if _, err := pg.NewDropTable().Model(tbl).IfExists().Cascade().Exec(ctx); err != nil {
			t.Fatalf("drop: %v", err)
		}
		if _, err := pg.NewCreateTable().Model(tbl).Exec(ctx); err != nil {
			t.Fatalf("create: %v", err)
		}
	}
	defer func() {
		for _, tbl := range tabellen {
			_, _ = pg.NewDropTable().Model(tbl).IfExists().Cascade().Exec(ctx)
		}
	}()

	// 1: gemeente 500, rol B
	// 2: gemeenten 100 (rol A) en 900 (rol C): meervoudig, oplopend telt 100, aflopend 900
	// 3: gemeente 300 (rol A), afgevoerd per 2025-09-01: nu zonder waarde, op peil 06 wel
	// 4: geen gemeenten: altijd achteraan
	// 5: gemeente 700, rol B (gelijk aan 1: de id beslist)
	stmts := []string{
		`INSERT INTO initiatief (id, opvoer) VALUES (1,'2025-01-01'),(2,'2025-01-01'),(3,'2025-01-01'),(4,'2025-01-01'),(5,'2025-01-01')`,
		`INSERT INTO initiatiefgemeente (initiatief_id, rel_id, gemeente_id, opvoer, afvoer) VALUES
			(1,1,500,'2025-01-01',NULL),
			(2,1,100,'2025-01-01',NULL),(2,2,900,'2025-01-01',NULL),
			(3,1,300,'2025-01-01','2025-09-01'),
			(5,1,700,'2025-01-01',NULL)`,
		`INSERT INTO initiatiefgemeente_data (initiatief_id, rel_id, versie, rol, opvoer, afvoer) VALUES
			(1,1,1,'B','2025-01-01',NULL),
			(2,1,1,'A','2025-01-01',NULL),(2,2,1,'C','2025-01-01',NULL),
			(3,1,1,'A','2025-01-01','2025-09-01'),
			(5,1,1,'B','2025-01-01',NULL)`,
	}
	for _, s := range stmts {
		if _, err := pg.ExecContext(ctx, s); err != nil {
			t.Fatalf("seed: %v\n%s", err, s)
		}
	}

	schema, err := BuildSchema(pg)
	if err != nil {
		t.Fatalf("BuildSchema: %v", err)
	}
	defer InitDB(nil)

	doe := func(veld, args string) ([]int, []string) {
		res := graphql.Do(graphql.Params{Schema: *schema, Context: ctx,
			RequestString: `{ ` + veld + `(` + args + `) { id } }`})
		var fouten []string
		for _, e := range res.Errors {
			fouten = append(fouten, e.Message)
		}
		uit := []int{}
		if data, ok := res.Data.(map[string]interface{}); ok {
			rijen, _ := data[veld].([]interface{})
			for _, r := range rijen {
				uit = append(uit, r.(map[string]interface{})["id"].(int))
			}
		}
		return uit, fouten
	}

	cases := []struct {
		naam, args string
		verwacht   []int
	}{
		{"zonder sorteer: op id", `limit: 10`, []int{1, 2, 3, 4, 5}},
		{"hub-kolom oplopend, zonder waarde achteraan",
			`sorteer: [{ veld: "initiatief_gemeenten.gemeente_id" }]`, []int{2, 1, 5, 3, 4}},
		// 3 en 4 hebben geen waarde: onderling op id, in de richting van de laatste sleutel.
		{"hub-kolom aflopend: meervoudig telt de hoogste, zonder waarde nog steeds achteraan",
			`sorteer: [{ veld: "initiatief_gemeenten.gemeente_id", aflopend: true }]`, []int{2, 5, 1, 4, 3}},
		{"op peil vóór de afvoer telt 3 mee",
			`sorteer: [{ veld: "initiatief_gemeenten.gemeente_id" }], peiltijdstip: "2025-06-01T00:00:00Z"`, []int{2, 3, 1, 5, 4}},
		{"data-kolom oplopend, gelijke waarde op id",
			`sorteer: [{ veld: "initiatief_gemeenten.rol" }]`, []int{2, 1, 5, 3, 4}},
		{"twee sleutels: rol aflopend, dan gemeente aflopend",
			`sorteer: [{ veld: "initiatief_gemeenten.rol", aflopend: true }, { veld: "initiatief_gemeenten.gemeente_id", aflopend: true }]`,
			[]int{2, 5, 1, 4, 3}},
		{"eigen kolom aflopend", `sorteer: [{ veld: "id", aflopend: true }]`, []int{5, 4, 3, 2, 1}},
		{"met filter en paginering",
			`filter: { initiatief_gemeenten: {} }, sorteer: [{ veld: "initiatief_gemeenten.gemeente_id" }], limit: 2, offset: 1`,
			[]int{1, 5}},
	}
	// Alleen de gewone lijst: full_<padnaam>_list vraagt alle onderliggende tabellen van het
	// type, en gebruikt voor filter, sortering en paginering dezelfde code (dbLader.LaadLijst).
	for _, veld := range []string{meta.Padnaam} {
		for _, c := range cases {
			t.Run(veld+": "+c.naam, func(t *testing.T) {
				got, fouten := doe(veld, c.args)
				if len(fouten) > 0 {
					t.Fatalf("GraphQL-fouten: %v", fouten)
				}
				if !reflect.DeepEqual(got, c.verwacht) {
					t.Errorf("kreeg %v, verwacht %v", got, c.verwacht)
				}
			})
		}
	}

	if _, fouten := doe(meta.Padnaam, `sorteer: [{ veld: "bestaatniet" }]`); len(fouten) == 0 || !strings.Contains(fouten[0], "sorteer:") {
		t.Errorf("onbekend veld hoort een sorteer-fout te geven, kreeg %v", fouten)
	}
}

// De join-vorm (sorteren op de waarde zelf) geldt alleen voor één sleutel op een enkelvoudig,
// niet-materieel GE. De volgorde zelf bewijst TestSorterenOpWaarde (tag integration).
func TestWaardeSortering_AlleenHetEenvoudigeGeval(t *testing.T) {
	meta := initiatiefMeta(t)
	gevallen := map[string][]Sortering{
		"geen sleutels":    nil,
		"eigen kolom":      {{Veldpad: "id"}},
		"meervoudig GE":    {{Veldpad: "initiatief_gemeenten.rol"}},
		"twee sleutels":    {{Veldpad: "initiatief_gemeenten.rol"}, {Veldpad: "id"}},
		"onbekend GE":      {{Veldpad: "bestaatniet.veld"}},
		"te veel paddelen": {{Veldpad: "a.b.c"}},
	}
	for naam, s := range gevallen {
		if w := waardeSorteringVoor(meta, s); w != nil {
			t.Errorf("%s: verwacht de subquery-vorm, kreeg de join-vorm", naam)
		}
	}
	// Zoek in het hele model een enkelvoudig, niet-materieel GE: daar hoort de join-vorm.
	gevonden := false
	for _, m := range model.MetaRegistry {
		for _, child := range m.OnderliggendeGegevenselementen {
			hub, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype)
			if !ok || child.JSONRolnaam == "" || child.Momentvoorkomen != model.Enkelvoudig || hub.IsMaterieel {
				continue
			}
			kind := filterKindVoor(child.Doeltype)
			if kind == nil || filterDefVoor(m) == nil {
				continue
			}
			for veld := range kind.velden {
				if waardeSorteringVoor(m, []Sortering{{Veldpad: child.JSONRolnaam + "." + veld}}) == nil {
					t.Fatalf("%s.%s.%s: verwacht de join-vorm", m.Typenaam, child.JSONRolnaam, veld)
				}
				gevonden = true
			}
		}
	}
	if !gevonden {
		t.Skip("geen enkelvoudig, niet-materieel GE in het model")
	}
}
