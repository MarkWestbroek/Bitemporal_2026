package dbsetup

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func TestPgTypeFamilie(t *testing.T) {
	gelijk := [][2]string{
		{"VARCHAR", "varchar"}, {"varchar(255)", "text"}, {"BIGINT", "int8"}, {"BOOLEAN", "bool"},
		{"TIMESTAMPTZ", "timestamptz"}, {"DOUBLE PRECISION", "float8"}, {"date", "DATE"},
	}
	for _, g := range gelijk {
		if a, b := pgTypeFamilie(g[0]), pgTypeFamilie(g[1]); a == "" || a != b {
			t.Errorf("%q en %q horen dezelfde soort te zijn, kreeg %q en %q", g[0], g[1], a, b)
		}
	}
	if pgTypeFamilie("timestamptz") == pgTypeFamilie("timestamp") {
		t.Error("timestamptz en timestamp zijn verschillende soorten")
	}
	if pgTypeFamilie("_text") != "" || pgTypeFamilie("eigen_enum") != "" {
		t.Error("een onbekend type hoort leeg te geven (niet vergelijken)")
	}
}

// De vorm van cg-test: een _Data-tabel waarin velden ooit tekst waren en in het model nu een
// tijdstip, ja/nee en getal zijn.
type proefKolomtypeData struct {
	bun.BaseModel `bun:"table:proef_kolomtype_data"`
	ID            int        `bun:"id,pk"`
	GestartOp     time.Time  `json:"gestartOp"`
	EerdereKaart  *bool      `json:"eerdereKaart"`
	Loopafstand   *int       `json:"loopafstand"`
	Naam          string     `json:"naam"`
	AfgerondOp    *time.Time `json:"afgerondOp"`
	NogNietInDB   *string    `json:"nogNietInDb"`
}

func TestKolomtypeAfwijkingen(t *testing.T) {
	dsn := os.Getenv("STUDIO_TEST_PG_DSN")
	if dsn == "" {
		t.Skip("STUDIO_TEST_PG_DSN niet gezet; integratietest overgeslagen")
	}
	ctx := context.Background()
	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())
	t.Cleanup(func() {
		_, _ = db.ExecContext(ctx, `DROP TABLE IF EXISTS proef_kolomtype_data`)
		_ = sqldb.Close()
	})
	if _, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS proef_kolomtype_data;
		CREATE TABLE proef_kolomtype_data (id BIGINT PRIMARY KEY, gestart_op VARCHAR, eerdere_kaart VARCHAR,
			loopafstand VARCHAR, naam VARCHAR, afgerond_op TIMESTAMPTZ, vervallen VARCHAR);
		INSERT INTO proef_kolomtype_data (id, gestart_op) VALUES (1, '2026-11-05T00:14:51Z')`); err != nil {
		t.Fatal(err)
	}

	afw, err := kolomtypeAfwijkingen(ctx, db, (*proefKolomtypeData)(nil), "proef_kolomtype_data")
	if err != nil {
		t.Fatal(err)
	}
	gevonden := map[string]string{}
	for _, a := range afw {
		gevonden[a.Kolom] = a.Database + "→" + a.Model
	}
	verwacht := map[string]string{
		"gestart_op":    "varchar→timestamptz",
		"eerdere_kaart": "varchar→boolean",
		"loopafstand":   "varchar→bigint",
	}
	if len(gevonden) != len(verwacht) {
		t.Fatalf("verwacht %v, kreeg %v", verwacht, gevonden)
	}
	for k, v := range verwacht {
		if gevonden[k] != v {
			t.Errorf("%s: %q, verwacht %q", k, gevonden[k], v)
		}
	}

	// Het statement uit de melding zet de kolom om, zonder de waarde te verliezen.
	for _, a := range afw {
		if a.Kolom != "gestart_op" {
			continue
		}
		if _, err := db.ExecContext(ctx, a.OmzetSQL()); err != nil {
			t.Fatalf("omzetten mislukt: %v\n%s", err, a.OmzetSQL())
		}
	}
	var tijd time.Time
	if err := db.NewRaw(`SELECT gestart_op FROM proef_kolomtype_data WHERE id = 1`).Scan(ctx, &tijd); err != nil {
		t.Fatal(err)
	}
	if !tijd.Equal(time.Date(2026, 11, 5, 0, 14, 51, 0, time.UTC)) {
		t.Errorf("waarde na omzetten: %v", tijd)
	}
	afw, _ = kolomtypeAfwijkingen(ctx, db, (*proefKolomtypeData)(nil), "proef_kolomtype_data")
	if len(afw) != 2 {
		t.Errorf("na omzetten van één kolom verwacht 2 afwijkingen, kreeg %d", len(afw))
	}
}
