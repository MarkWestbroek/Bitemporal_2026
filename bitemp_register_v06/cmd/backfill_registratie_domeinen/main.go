// cmd/backfill_registratie_domeinen/main.go
//
// Backfill-script: vult de kolom `domeinen` (TEXT[]) op bestaande registraties.
//
// Voor elke registratie zonder domeinen:
//  1. Haal de bijbehorende wijzigingen op
//  2. Zoek per wijziging de representatienaam op in de MetaRegistry
//  3. Verzamel de unieke domeinen
//  4. Update de registratie
//
// Gebruik:
//
//	go run ./cmd/backfill_registratie_domeinen
//	DATABASE_URL=postgres://... go run ./cmd/backfill_registratie_domeinen
package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sort"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func main() {
	ctx := context.Background()

	// Database-verbinding
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:1234@localhost:5432/bitemp_go_db_v06?sslmode=disable"
	}

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())
	defer db.Close()

	// Haal alle registraties op waar domeinen NULL of leeg is
	var registraties []model.Registratie
	err := db.NewSelect().
		Model(&registraties).
		Where("domeinen IS NULL").
		OrderExpr("id ASC").
		Scan(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Fout bij ophalen registraties: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Gevonden: %d registraties zonder domeinen\n", len(registraties))

	bijgewerkt := 0
	for _, reg := range registraties {
		// Haal wijzigingen op voor deze registratie
		var wijzigingen []model.Wijziging
		err := db.NewSelect().
			Model(&wijzigingen).
			Where("registratie_id = ?", reg.ID).
			Scan(ctx)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  Fout bij ophalen wijzigingen voor registratie %d: %v\n", reg.ID, err)
			continue
		}

		// Verzamel unieke domeinen
		domeinSet := make(map[string]struct{})
		for _, w := range wijzigingen {
			repNaam := w.Representatienaam
			if repNaam == "" {
				continue
			}
			if meta, ok := model.MetaRegistry.GetTypeMeta(repNaam); ok && meta.Domein != "" {
				domeinSet[meta.Domein] = struct{}{}
			}
		}

		domeinen := make([]string, 0, len(domeinSet))
		for d := range domeinSet {
			domeinen = append(domeinen, d)
		}
		sort.Strings(domeinen)

		// Update de registratie
		_, err = db.NewUpdate().
			Model(&model.Registratie{}).
			TableExpr("registratie").
			Set("domeinen = ?", pgdialect.Array(domeinen)).
			Where("id = ?", reg.ID).
			Exec(ctx)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  Fout bij update registratie %d: %v\n", reg.ID, err)
			continue
		}

		bijgewerkt++
		if bijgewerkt%100 == 0 {
			fmt.Printf("  Voortgang: %d/%d bijgewerkt\n", bijgewerkt, len(registraties))
		}
	}

	fmt.Printf("Klaar: %d/%d registraties bijgewerkt met domeinen\n", bijgewerkt, len(registraties))
}
