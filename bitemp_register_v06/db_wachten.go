// db_wachten.go — wachten op een database die (nog) niet klaar is.
//
// Aanleiding (Fundament, 24-11-2026): na een herstart van de node startte de API vóór
// PostgreSQL klaar was ("the database system is shutting down"). De startup-rebuild las dat als
// "geen actieve schema-versie" en de API stopte binnen enkele seconden; de devloop-entrypoint
// zag dat als een crash van gegenereerde code en zette het baseline-model terug, zonder de
// inrichtingsdomeinen. Het register gaf 404 tot iemand de pod herstartte.
//
// Regel sinds api 0.32.1: een database die niet bereikbaar is, is nooit een reden om terug te
// vallen op het baseline-model. We wachten met oplopende pauzes (1, 2, 4, 8, 15, 15, … s) tot
// DB_WACHT_TIJD (Go-duur, standaard 5m) om is en stoppen dan met exitcode 44
// (handlers.ExitCodeDatabaseNietBereikbaar). De entrypoint stopt de container bij 44 zonder
// terugval, zodat Kubernetes hem opnieuw start.
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/uptrace/bun"
)

// dbWachtTijd is hoe lang de API bij het starten op de database wacht (DB_WACHT_TIJD).
func dbWachtTijd() time.Duration {
	return poolDuur("DB_WACHT_TIJD", 5*time.Minute)
}

// dbPauze is de pauze vóór poging n+1: 1, 2, 4, 8 s en daarna steeds 15 s.
func dbPauze(poging int) time.Duration {
	if poging < 1 {
		poging = 1
	}
	if poging > 4 {
		return 15 * time.Second
	}
	return time.Second << (poging - 1)
}

// dbBereikbaar pingt de database met een korte time-out.
func dbBereikbaar(db *bun.DB) error {
	ctx, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	return db.PingContext(ctx)
}

// probeerTotDatabaseKlaar roept poging aan tot die geen databasefout meer geeft (nil) of de
// wachttijd om is; dan komt de laatste databasefout terug. wat staat in de logregels.
func probeerTotDatabaseKlaar(wat string, poging func() error) error {
	wachtTijd := dbWachtTijd()
	deadline := time.Now().Add(wachtTijd)
	for n := 1; ; n++ {
		err := poging()
		if err == nil {
			if n > 1 {
				fmt.Printf("%s: database bereikbaar na %d pogingen\n", wat, n)
			}
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("database na %s nog niet bereikbaar: %w", wachtTijd, err)
		}
		p := dbPauze(n)
		fmt.Printf("%s: database nog niet bereikbaar (poging %d: %v); opnieuw over %s\n", wat, n, err, p)
		time.Sleep(p)
	}
}

// verbindMetDatabase opent de verbinding en wacht tot de database antwoordt.
func verbindMetDatabase(wat string) (*bun.DB, error) {
	var db *bun.DB
	err := probeerTotDatabaseKlaar(wat, func() error {
		d, err := connectToDatabase()
		if err != nil {
			return err
		}
		if err := dbBereikbaar(d); err != nil {
			d.Close()
			return err
		}
		db = d
		return nil
	})
	if err != nil {
		return nil, err
	}
	return db, nil
}
