package dbsetup

// indexen_pg_test.go — createModelIndexes tegen een echte PostgreSQL. Draait alleen met
// REGRESSIE_DATABASE_URL; alles gebeurt in één transactie die wordt teruggedraaid.

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

// Een index met de naam van nu maar de kolommen van api 0.30.0 (alleen de waarde) wordt bij de
// start vervangen door (waarde, entiteit-id). CREATE INDEX IF NOT EXISTS alleen zou hem laten staan.
func TestCreateModelIndexes_VervangtIndexMetOudeKolommen(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("REGRESSIE_DATABASE_URL"))
	if dsn == "" {
		t.Skip("REGRESSIE_DATABASE_URL niet gezet; test overgeslagen")
	}
	var def *IndexDefinitie
	for _, d := range ModelIndexDefinities() {
		if (d.Soort == "uniek" || d.Soort == "zoek") && len(d.Kolommen) == 2 {
			d := d
			def = &d
			break
		}
	}
	if def == nil {
		t.Skip("geen index op een waarde in dit model")
	}
	ctx := context.Background()
	pg := bun.NewDB(sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn))), pgdialect.New())
	defer pg.Close()
	tx, err := pg.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	// Een tijdelijke tabel met de naam van de echte: die gaat voor in het zoekpad.
	stappen := []string{
		"CREATE TEMP TABLE " + pgIdent(def.Tabel) + " (" + pgIdent(def.Kolommen[0]) + " text, " + pgIdent(def.Kolommen[1]) + " bigint) ON COMMIT DROP",
		"CREATE INDEX " + pgIdent(def.Naam) + " ON " + pgIdent(def.Tabel) + " (" + pgIdent(def.Kolommen[0]) + ")",
	}
	for _, s := range stappen {
		if _, err := tx.ExecContext(ctx, s); err != nil {
			t.Fatalf("%s: %v", s, err)
		}
	}
	createModelIndexes(ctx, tx)

	var indexdef string
	if err := tx.NewRaw("SELECT pg_get_indexdef(to_regclass(?))", pgIdent(def.Naam)).Scan(ctx, &indexdef); err != nil {
		t.Fatal(err)
	}
	want := "(" + def.Kolommen[0] + ", " + def.Kolommen[1] + ")"
	if !strings.Contains(indexdef, want) {
		t.Errorf("index niet vervangen: %s (verwacht kolommen %s)", indexdef, want)
	}
}
