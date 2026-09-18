// db_pool.go — instelling van de database-connectiepool.
//
// Zonder expliciete instelling gebruikt database/sql MaxIdleConns=2 en een onbeperkt
// aantal open verbindingen. Onder parallelle belasting betekent dat: voortdurend nieuwe
// TCP-verbindingen naar Postgres openen en sluiten (traag, en op Windows raken de
// tijdelijke poorten op), en geen bovengrens richting Postgres' max_connections.
// Gevonden met de loadtests (2026-09-18); de testomgeving gebruikt dezelfde functie,
// zodat een loadtest meet wat de app ook echt doet.
//
// Omgevingsvariabelen (alle optioneel):
//
//	DB_MAX_OPEN_CONNS       maximaal aantal open verbindingen      (default 25)
//	DB_MAX_IDLE_CONNS       maximaal aantal idle verbindingen      (default = open)
//	DB_CONN_MAX_LIFETIME    maximale leeftijd, Go-duur (bv. 30m)   (default 30m)
//	DB_CONN_MAX_IDLE_TIME   maximale idle-tijd, Go-duur (bv. 5m)   (default 5m)
package main

import (
	"database/sql"
	"os"
	"strconv"
	"strings"
	"time"
)

func poolInt(naam string, standaard int) int {
	if v, err := strconv.Atoi(strings.TrimSpace(os.Getenv(naam))); err == nil && v > 0 {
		return v
	}
	return standaard
}

func poolDuur(naam string, standaard time.Duration) time.Duration {
	if d, err := time.ParseDuration(strings.TrimSpace(os.Getenv(naam))); err == nil && d > 0 {
		return d
	}
	return standaard
}

// configureerPool zet de poolgrenzen op een *sql.DB.
func configureerPool(sqldb *sql.DB) {
	open := poolInt("DB_MAX_OPEN_CONNS", 25)
	idle := poolInt("DB_MAX_IDLE_CONNS", open)
	if idle > open {
		idle = open
	}
	sqldb.SetMaxOpenConns(open)
	sqldb.SetMaxIdleConns(idle)
	sqldb.SetConnMaxLifetime(poolDuur("DB_CONN_MAX_LIFETIME", 30*time.Minute))
	sqldb.SetConnMaxIdleTime(poolDuur("DB_CONN_MAX_IDLE_TIME", 5*time.Minute))
}
