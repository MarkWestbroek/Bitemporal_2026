// Package handlers — db_conflict.go
//
// Vertaalt database-conflicten naar een nette 409 (BE-review, bevindingen 6 en 8 uit
// docs/REGRESSIETEST.md, gevonden met de loadtests van 2026-09-18).
//
// Vóór deze vertaling gaf de engine bij een botsing `500` met de ruwe Postgres-fout in de
// body (SQLSTATE, constraint- en tabelnamen). Dat is dubbel fout: het is geen serverfout
// maar een conflict dat de client kan oplossen, en interne details horen niet naar buiten
// (zelfde lijn als §4.2/§4.3 in http_fouten.go).
//
//	23505  unique_violation       dubbel id / dubbele sleutel bij opvoer
//	23P01  exclusion_violation    de enkelvoudig-constraint (§4.1): twee gelijktijdige
//	                              correcties op hetzelfde gegeven; één wint, de data blijft correct
//	40P01  deadlock_detected      twee registraties op dezelfde records; Postgres breekt er één af
//	40001  serialization_failure  idem bij een strenger isolatieniveau
//
// De laatste twee zijn herkansbaar: de hele transactie is teruggedraaid, dus opnieuw
// proberen is veilig. RegistreerJSONCore doet dat één keer (daar begint de verwerking bij
// de ruwe request-body, dus zonder gemuteerde tussenstand).
package handlers

import (
	"errors"
	"fmt"
	"regexp"

	"github.com/uptrace/bun/driver/pgdriver"
)

// dbConflict beschrijft een naar de client vertaalbaar databaseconflict.
type dbConflict struct {
	Code        string // SQLSTATE
	Publiek     string // boodschap zonder interne details
	Herkansbaar bool   // transactie kan ongewijzigd opnieuw geprobeerd worden
}

var sqlstateRE = regexp.MustCompile(`SQLSTATE[= ]+([0-9A-Z]{5})`)

// sqlstateVan haalt de SQLSTATE uit een (mogelijk gewrapte) fout. Handlers wrappen
// databasefouten niet overal met %w; daarom is er een terugval op de fouttekst.
func sqlstateVan(err error) string {
	if err == nil {
		return ""
	}
	var pgErr pgdriver.Error
	if errors.As(err, &pgErr) {
		if code := pgErr.Field('C'); code != "" {
			return code
		}
	}
	if m := sqlstateRE.FindStringSubmatch(err.Error()); m != nil {
		return m[1]
	}
	return ""
}

// conflictVoorSQLState geeft het conflict bij een SQLSTATE, of nil als het geen conflict is.
func conflictVoorSQLState(code string) *dbConflict {
	switch code {
	case "23505":
		return &dbConflict{Code: code, Publiek: "Conflict: er bestaat al een record met deze sleutel (bijvoorbeeld hetzelfde id)."}
	case "23P01":
		return &dbConflict{Code: code, Publiek: "Conflict: een gelijktijdige wijziging op hetzelfde gegeven is eerder vastgelegd. Haal de actuele stand op en probeer het opnieuw."}
	case "40P01", "40001":
		return &dbConflict{Code: code, Herkansbaar: true, Publiek: "Conflict: de registratie botste met een gelijktijdige registratie op dezelfde gegevens. Probeer het opnieuw."}
	}
	return nil
}

// dbConflictUit zoekt in de argumenten van een foutmelding (en als terugval in de
// opgemaakte tekst) naar een databaseconflict.
func dbConflictUit(opgemaakt string, args ...any) *dbConflict {
	for _, a := range args {
		if err, ok := a.(error); ok {
			if c := conflictVoorSQLState(sqlstateVan(err)); c != nil {
				return c
			}
		}
	}
	if m := sqlstateRE.FindStringSubmatch(opgemaakt); m != nil {
		return conflictVoorSQLState(m[1])
	}
	return nil
}

// logConflict schrijft de volledige fout naar de server-log; de client krijgt alleen Publiek.
func logConflict(c *dbConflict, volledig string) {
	fmt.Printf("CONFLICT (SQLSTATE %s → 409): %s\n", c.Code, volledig)
}
