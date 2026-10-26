package dbsetup

// proef.go — databaseproef: de tabelaanmaak van het (nieuw gebouwde) model uitvoeren in één
// transactie en die terugdraaien.
//
// Aanleiding (26-10-2026, Omnium op Fundament, plan §5 punt 20): `CreateTables` is bij het opstarten
// fataal (main.go). Een modelwijziging die een constraint of trigger laat falen op de bestaande
// database (bv. een hernoemde entiteit met oude tabellen) komt wél door de zelftest (die kent geen
// database) maar laat de API bij de start stoppen: een crashlus via de database. De rebuild draait
// daarom `bitemp-go-api dbproef` op de nieuwe binary vóór hij activeert.
//
// Postgres-DDL is transactioneel, dus CREATE TABLE/TRIGGER/FUNCTION binnen een transactie laat na
// ROLLBACK niets achter. Eén valkuil: een fout in een statement zet de hele transactie in de
// afgebroken toestand. Stappen die een fout bewust slikken (waarschuwing, doorgaan) lopen daarom via
// veiligeStap, die binnen een transactie een SAVEPOINT gebruikt.

import (
	"context"
	"fmt"
	"sync/atomic"

	"github.com/uptrace/bun"
)

// Proef voert CreateTables uit in een transactie en draait die terug. Nil = het model past op
// deze database; anders de fout die het opstarten ook zou geven.
func Proef(ctx context.Context, db *bun.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("transactie starten: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck
	if err := CreateTables(tx); err != nil {
		return err
	}
	if err := tx.Rollback(); err != nil {
		return fmt.Errorf("terugdraaien: %w", err)
	}
	return nil
}

var savepointTeller atomic.Int64

// veiligeStap voert fn uit zodat een fout erin de omringende transactie niet afbreekt: binnen een
// transactie (Proef) via een SAVEPOINT, daarbuiten gewoon. Geeft de fout van fn terug; de aanroeper
// beslist (meestal: waarschuwen en doorgaan).
func veiligeStap(ctx context.Context, db bun.IDB, fn func() error) error {
	if _, inTx := db.(bun.Tx); !inTx {
		return fn()
	}
	naam := fmt.Sprintf("dbsetup_sp_%d", savepointTeller.Add(1))
	if _, err := db.ExecContext(ctx, "SAVEPOINT "+naam); err != nil {
		return err
	}
	if err := fn(); err != nil {
		_, _ = db.ExecContext(ctx, "ROLLBACK TO SAVEPOINT "+naam)
		return err
	}
	_, err := db.ExecContext(ctx, "RELEASE SAVEPOINT "+naam)
	return err
}
