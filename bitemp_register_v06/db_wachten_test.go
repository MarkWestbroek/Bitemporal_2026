package main

import (
	"errors"
	"testing"
	"time"
)

func TestDbPauze(t *testing.T) {
	verwacht := []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 15 * time.Second, 15 * time.Second}
	for i, v := range verwacht {
		if got := dbPauze(i + 1); got != v {
			t.Errorf("dbPauze(%d) = %s, verwacht %s", i+1, got, v)
		}
	}
}

func TestProbeerTotDatabaseKlaar(t *testing.T) {
	t.Setenv("DB_WACHT_TIJD", "10s")
	n := 0
	err := probeerTotDatabaseKlaar("test", func() error {
		n++
		if n < 3 {
			return errors.New("the database system is starting up")
		}
		return nil
	})
	if err != nil || n != 3 {
		t.Fatalf("verwacht succes na 3 pogingen, kreeg err=%v na %d", err, n)
	}

	// Wachttijd op: de laatste databasefout komt terug, gewikkeld.
	t.Setenv("DB_WACHT_TIJD", "1ms")
	weg := errors.New("connection refused")
	err = probeerTotDatabaseKlaar("test", func() error { return weg })
	if !errors.Is(err, weg) {
		t.Fatalf("verwacht de databasefout, kreeg %v", err)
	}
}
