package dbsetup

// Integratietest (STUDIO_TEST_PG_DSN, wegwerp-PostgreSQL): een kolom die uit het model verdween
// (cg-test 07-11-2026, Artefact_ArtefactInhoud_Data.formaat) mag een nieuwe insert niet breken.

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

type proefVervallenData struct {
	bun.BaseModel `bun:"table:proef_vervallen_data"`
	ID            int    `bun:"id,pk,autoincrement"`
	Inhoud        string `bun:"inhoud"`
}

func TestVervallenKolom_InsertReturningBlijftWerken(t *testing.T) {
	dsn := os.Getenv("STUDIO_TEST_PG_DSN")
	if dsn == "" {
		t.Skip("STUDIO_TEST_PG_DSN niet gezet; integratietest overgeslagen")
	}
	ctx := context.Background()
	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	kaal := bun.NewDB(sqldb, pgdialect.New())
	db := bun.NewDB(sqldb, pgdialect.New(), bun.WithDiscardUnknownColumns())
	t.Cleanup(func() {
		_, _ = kaal.ExecContext(ctx, `DROP TABLE IF EXISTS proef_vervallen_data`)
		_ = sqldb.Close()
	})
	// De oude tabel: met een kolom `formaat` die het model niet meer kent, NOT NULL zonder standaard.
	if _, err := kaal.ExecContext(ctx, `DROP TABLE IF EXISTS proef_vervallen_data;
		CREATE TABLE proef_vervallen_data (id BIGSERIAL PRIMARY KEY, inhoud VARCHAR, formaat VARCHAR NOT NULL);
		INSERT INTO proef_vervallen_data (inhoud, formaat) VALUES ('oud', 'json')`); err != nil {
		t.Fatal(err)
	}

	// Vóór de fix: de insert faalt op NOT NULL.
	if _, err := db.NewInsert().Model(&proefVervallenData{Inhoud: "nieuw"}).Returning("*").Exec(ctx); err == nil ||
		!strings.Contains(err.Error(), "formaat") {
		t.Fatalf("verwacht een NOT NULL-fout op formaat, kreeg %v", err)
	}

	if err := ensureVervallenKolommenNullable(ctx, db, (*proefVervallenData)(nil), "proef_vervallen_data"); err != nil {
		t.Fatal(err)
	}
	// Met de fix: insert + RETURNING * lukt, ook al geeft de tabel formaat terug.
	nieuw := &proefVervallenData{Inhoud: "nieuw"}
	if _, err := db.NewInsert().Model(nieuw).Returning("*").Exec(ctx); err != nil {
		t.Fatalf("insert na de fix: %v", err)
	}
	if nieuw.ID == 0 {
		t.Fatal("RETURNING gaf geen id")
	}
	// Zonder WithDiscardUnknownColumns zou het scannen falen (dat was de 500 op cg-test).
	if _, err := kaal.NewInsert().Model(&proefVervallenData{Inhoud: "kaal"}).Returning("*").Exec(ctx); err == nil ||
		!strings.Contains(err.Error(), "does not have column") {
		t.Fatalf("verwacht 'does not have column' zonder de optie, kreeg %v", err)
	}
	// De historie blijft: de oude waarde staat er nog.
	var formaat string
	if err := kaal.NewRaw(`SELECT formaat FROM proef_vervallen_data WHERE inhoud = 'oud'`).Scan(ctx, &formaat); err != nil || formaat != "json" {
		t.Fatalf("oude waarde: %q %v", formaat, err)
	}
	// Tweede keer: niets meer te doen, geen fout.
	if err := ensureVervallenKolommenNullable(ctx, db, (*proefVervallenData)(nil), "proef_vervallen_data"); err != nil {
		t.Fatal(err)
	}
}
