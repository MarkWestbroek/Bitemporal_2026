// Command facade start de façade-API op Common Ground-registers: een voorkant gelijk aan een
// Omnium-register uit het CM (GraphQL, persisted queries, REST /full), die leest uit bestaande
// registers zoals Open Zaak en Open Object.
//
// Zie docs/plans/2026-11-18 Façade fase 1 — technisch ontwerp.md.
//
// Omgeving:
//
//	DATABASE_URL     de eigen database van de façade (configuratie, plumbing, facade_id)
//	FACADE_BINDING   pad naar het bindingbestand, bv. facade/binding/zgw-zaakmodel.json
//	PORT             luisterpoort (standaard 8090)
//	plus de variabelen die de binding noemt (OPENZAAK_URL, OPENZAAK_CLIENT_ID, …)
//
// De binary bevat de domeinen van het model waarmee hij gebouwd is. Voor een image met vaste
// domeinen: scripts/bouw-domeinen.ps1 (CODEGEN §12) met register, ide-bestanden, configuratie
// en de domeinen van het CM. Die CM-domeinen krijgen in de façade-database lege tabellen; de
// gegevens komen via de binding uit het register, en de façade schrijft er nooit in.
package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dbsetup"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/facade"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

var versie = "fase1-dev"

func main() {
	if err := start(); err != nil {
		fmt.Fprintln(os.Stderr, "FATAL:", err)
		os.Exit(1)
	}
}

func start() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL ontbreekt (de eigen database van de façade)")
	}
	bindingPad := os.Getenv("FACADE_BINDING")
	if bindingPad == "" {
		return fmt.Errorf("FACADE_BINDING ontbreekt (pad naar het bindingbestand)")
	}
	poort := os.Getenv("PORT")
	if poort == "" {
		poort = "8090"
	}

	db := bun.NewDB(sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn))), pgdialect.New(), bun.WithDiscardUnknownColumns())
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("database onbereikbaar: %w", err)
	}
	if err := dbsetup.CreateTables(db); err != nil {
		return fmt.Errorf("tabellen aanmaken: %w", err)
	}
	ids, err := facade.NieuwePGIDMap(context.Background(), db)
	if err != nil {
		return err
	}
	binding, err := facade.LaadBinding(bindingPad)
	if err != nil {
		return err
	}
	srv, err := facade.NieuweServer(facade.Config{DB: db, Binding: binding, IDs: ids, Versie: versie})
	if err != nil {
		return err
	}
	typen := 0
	for range binding.Typen {
		typen++
	}
	fmt.Printf("façade %s: %d typen uit %d register(s); luistert op :%s\n", versie, typen, len(binding.Registers), poort)
	return srv.Router.Run(":" + poort)
}
