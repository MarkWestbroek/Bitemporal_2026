//go:build integration

package main

import (
	"context"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dbsetup"
)

// De databaseproef (dbsetup.Proef, `bitemp-go-api dbproef`) voert de tabelaanmaak uit in een
// transactie en draait die terug: op een bestaande database geeft hij geen fout en laat hij niets
// achter. Zie dbsetup/proef.go.
func TestDatabaseproef(t *testing.T) {
	o := nieuweRegressieOmgeving(t)
	ctx := context.Background()
	tel := func() int {
		var n int
		if err := o.db.NewRaw(`SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema()`).Scan(ctx, &n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	voor := tel()
	for i := 0; i < 2; i++ {
		if err := dbsetup.Proef(ctx, o.db); err != nil {
			t.Fatalf("databaseproef %d: %v", i+1, err)
		}
	}
	if na := tel(); na != voor {
		t.Fatalf("databaseproef liet sporen na: %d tabellen vóór, %d na", voor, na)
	}
	// Daarna werkt de database gewoon (de transactie is netjes teruggedraaid).
	if status, _, raw := o.do("GET", "/full/natuurlijk_personen", nil); status != 200 {
		t.Fatalf("na de proef: %d %s", status, kort(raw))
	}
}
