package dynql

// Integratietest van het filter tegen een echte PostgreSQL. De sqlmock-tests in
// filter_test.go bewijzen de SQL-tekst; deze bewijst dat Postgres er de goede
// rijen mee teruggeeft. Draait alleen als DYNQL_TEST_PG_DSN is gezet, bv.:
//
//	docker run --rm -d --name dynql-filtertest-pg -p 127.0.0.1:55439:5432 \
//	  -e POSTGRES_PASSWORD=filtertest postgres:17.5
//	DYNQL_TEST_PG_DSN='postgres://postgres:filtertest@127.0.0.1:55439/postgres?sslmode=disable' \
//	  go test ./dynql -run TestFilterPG -v
//
// De test maakt zijn eigen tabellen aan (en ruimt ze op); gebruik een wegwerp-database.

import (
	"context"
	"database/sql"
	"os"
	"reflect"
	"sort"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func TestFilterPG_Semantiek(t *testing.T) {
	dsn := os.Getenv("DYNQL_TEST_PG_DSN")
	if dsn == "" {
		t.Skip("DYNQL_TEST_PG_DSN niet gezet; integratietest overgeslagen")
	}
	meta := initiatiefMeta(t)
	ctx := context.Background()

	pg := bun.NewDB(sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn))), pgdialect.New())
	defer pg.Close()

	// Alleen de tabellen die het filter raakt: entiteit, relatie-hub en diens data.
	var tabellen []interface{}
	for _, typenaam := range []string{"Initiatief", "InitiatiefGemeente", "InitiatiefGemeente_Data"} {
		m := model.MetaRegistry[typenaam]
		tabellen = append(tabellen, makeMetaRepresentative(m))
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

	// Scenario's (alle entiteiten opgevoerd 2025-01-01):
	//  1: gemeente 363 realiseert                              → match
	//  2: 363 maakt gebruik van, 599 realiseert (de valkuil)   → geen match
	//  3: 363 realiseert, hub+data afgevoerd per 2025-09-01    → alleen op peil 2025-06-01
	//  4: 363, data v1 realiseert tot 2025-09-01, daarna v2 "maakt gebruik van"
	//                                                          → alleen op peil 2025-06-01
	//  5: geen gemeenten                                       → alleen bij "not"
	stmts := []string{
		`INSERT INTO initiatief (id, opvoer) VALUES (1,'2025-01-01'),(2,'2025-01-01'),(3,'2025-01-01'),(4,'2025-01-01'),(5,'2025-01-01')`,
		`INSERT INTO initiatiefgemeente (initiatief_id, rel_id, gemeente_id, opvoer, afvoer) VALUES
			(1,1,363,'2025-01-01',NULL),
			(2,1,363,'2025-01-01',NULL),(2,2,599,'2025-01-01',NULL),
			(3,1,363,'2025-01-01','2025-09-01'),
			(4,1,363,'2025-01-01',NULL)`,
		`INSERT INTO initiatiefgemeente_data (initiatief_id, rel_id, versie, rol, opvoer, afvoer) VALUES
			(1,1,1,'Realiseert','2025-01-01',NULL),
			(2,1,1,'Maakt gebruik van','2025-01-01',NULL),(2,2,1,'Realiseert','2025-01-01',NULL),
			(3,1,1,'Realiseert','2025-01-01','2025-09-01'),
			(4,1,1,'Realiseert','2025-01-01','2025-09-01'),(4,1,2,'Maakt gebruik van','2025-09-01',NULL)`,
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

	ids := func(t *testing.T, args string) []int {
		t.Helper()
		res := graphql.Do(graphql.Params{
			Schema:        *schema,
			Context:       ctx,
			RequestString: `{ ` + meta.Padnaam + `(` + args + `) { id } }`,
		})
		if len(res.Errors) > 0 {
			t.Fatalf("GraphQL-fouten: %v", res.Errors)
		}
		rijen, _ := res.Data.(map[string]interface{})[meta.Padnaam].([]interface{})
		uit := []int{}
		for _, r := range rijen {
			uit = append(uit, r.(map[string]interface{})["id"].(int))
		}
		sort.Ints(uit)
		return uit
	}

	cases := []struct {
		naam, args string
		verwacht   []int
	}{
		{"zelfde record, nu",
			`filter: { initiatief_gemeenten: { gemeente_id: { eq: 363 }, rol: { eq: "Realiseert" } } }`,
			[]int{1}},
		{"zelfde record, op peil vóór de afvoer",
			`filter: { initiatief_gemeenten: { gemeente_id: { eq: 363 }, rol: { eq: "Realiseert" } } }, peiltijdstip: "2025-06-01T00:00:00Z"`,
			[]int{1, 3, 4}},
		{"alleen hub-kolom: afgevoerde hub telt niet",
			`filter: { initiatief_gemeenten: { gemeente_id: { eq: 363 } } }`,
			[]int{1, 2, 4}},
		{"or over eigen veld en GE",
			`filter: { or: [ { id: { eq: 5 } }, { initiatief_gemeenten: { gemeente_id: { eq: 599 } } } ] }`,
			[]int{2, 5}},
		{"not exists: zonder actieve gemeente",
			`filter: { not: { initiatief_gemeenten: {} } }`,
			[]int{3, 5}},
		{"ne is NULL-veilig en per record",
			`filter: { initiatief_gemeenten: { rol: { ne: "Realiseert" } } }`,
			[]int{2, 4}},
		{"in",
			`filter: { initiatief_gemeenten: { rol: { in: ["Maakt gebruik van"] } } }`,
			[]int{2, 4}},
	}
	for _, c := range cases {
		t.Run(c.naam, func(t *testing.T) {
			if got := ids(t, c.args); !reflect.DeepEqual(got, c.verwacht) {
				t.Errorf("kreeg %v, verwacht %v", got, c.verwacht)
			}
		})
	}
}
