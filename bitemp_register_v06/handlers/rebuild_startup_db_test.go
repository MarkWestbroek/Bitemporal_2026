package handlers

// rebuild_startup_db_test.go — een database die niet bereikbaar is, is iets anders dan "geen
// actieve schema-versie" (Fundament 24-11-2026). Na een herstart van de node startte de API vóór
// PostgreSQL klaar was; de startup-rebuild las de fout als "geen versie", de ingebakken code
// startte en de devloop zette het baseline-model terug, zonder de inrichtingsdomeinen.

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func TestGeenActieveVersie(t *testing.T) {
	gevallen := []struct {
		naam string
		err  error
		geen bool
	}{
		{"geen rij", fmt.Errorf("%w met status %q", errGeenSchemaVersie, "active"), true},
		{"geen tabel (verse database)", fmt.Errorf(`ERROR: relation "schema_versies" does not exist (SQLSTATE=42P01)`), true},
		{"database sluit af", fmt.Errorf("FATAL: the database system is shutting down (SQLSTATE=57P03)"), false},
		{"verbinding geweigerd", fmt.Errorf("dial tcp 127.0.0.1:5432: connect: connection refused"), false},
	}
	for _, g := range gevallen {
		if got := geenActieveVersie(g.err); got != g.geen {
			t.Errorf("%s: geenActieveVersie = %v, verwacht %v", g.naam, got, g.geen)
		}
	}
	// De melding is dezelfde als vóór de sentinel (andere aanroepers tonen hem).
	if got := fmt.Errorf("%w met status %q", errGeenSchemaVersie, "active").Error(); got != `geen schema-versie gevonden met status "active"` {
		t.Errorf("melding veranderd: %q", got)
	}
}

// Een database die de verbinding weigert: de startup-rebuild geeft ErrDatabaseNietLeesbaar (de
// aanroeper probeert opnieuw) en markeert niets als mislukt.
func TestStartupRebuild_DatabaseWegIsGeenGeenVersie(t *testing.T) {
	appDir := t.TempDir()
	t.Setenv("APP_DIR", appDir)

	sqldb := sql.OpenDB(pgdriver.NewConnector(
		pgdriver.WithDSN("postgres://x:y@127.0.0.1:1/geen?sslmode=disable"),
	))
	vorige := DB
	DB = bun.NewDB(sqldb, pgdialect.New())
	t.Cleanup(func() { DB.Close(); DB = vorige })

	herbouwd, stappen, err := VoerStartupRebuildUit()
	if herbouwd {
		t.Fatal("herbouwd zonder database")
	}
	if !errors.Is(err, ErrDatabaseNietLeesbaar) {
		t.Fatalf("verwacht ErrDatabaseNietLeesbaar, kreeg %v (stappen %v)", err, stappen)
	}
	if _, statErr := os.Stat(filepath.Join(appDir, "mislukte-schema.sha256")); statErr == nil {
		t.Error("versie als mislukt gemarkeerd terwijl de database weg was")
	}
}
