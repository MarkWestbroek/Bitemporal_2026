package dbsetup

// kolomtypen.go — meldt kolommen waarvan het type in de database afwijkt van het model
// (akkoord Mark 18-11-2026; gevonden op cg-test door FUNDAMENT).
//
// dbsetup maakt tabellen aan met CREATE TABLE IF NOT EXISTS en voegt ontbrekende kolommen toe
// (ensureNieuweKolommen), maar past het type van een bestaande kolom nooit aan. Verandert een
// veld in het model van tekst naar tijdstip, ja/nee of getal, dan blijft de tekstkolom staan
// onder code die een ander type verwacht. Lezen en schrijven gaan vaak nog goed doordat
// PostgreSQL en bun omzetten, maar de waarden staan als tekst opgeslagen: vergelijken, sorteren
// en filteren werken dan op tekst, en nieuwe waarden kunnen in een andere tekstvorm landen dan
// de oude.
//
// Deze controle zet niets om. Ze meldt elke afwijking in het logboek, met het statement dat
// de kolom zou omzetten, zodat een beheerder er bewust over beslist. Zie docs/KOLOMTYPEN.md.

import (
	"context"
	"fmt"
	"log"
	"reflect"
	"strings"

	"github.com/uptrace/bun"
)

// KolomtypeAfwijking: één kolom waarvan het type in de database niet past bij het model.
type KolomtypeAfwijking struct {
	Tabel    string
	Kolom    string
	Database string // type in de database (genormaliseerd, bv. "varchar")
	Model    string // type dat het model verwacht (genormaliseerd, bv. "timestamptz")
}

// OmzetSQL geeft het statement dat de kolom naar het type van het model omzet.
func (a KolomtypeAfwijking) OmzetSQL() string {
	return fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s TYPE %s USING %s::%s",
		pgIdent(a.Tabel), pgIdent(a.Kolom), a.Model, pgIdent(a.Kolom), a.Model)
}

// Melding geeft de regel voor het logboek.
func (a KolomtypeAfwijking) Melding() string {
	return fmt.Sprintf("kolom %s.%s is %s in de database, het model verwacht %s; omzetten: %s",
		a.Tabel, a.Kolom, a.Database, a.Model, a.OmzetSQL())
}

// pgTypeFamilie brengt een typenaam van bun (CreateTableSQLType) of van PostgreSQL (udt_name)
// terug tot één naam per soort. Een onbekend type geeft "": dan vergelijken we niet, zodat
// een type dat deze tabel niet kent geen valse melding geeft.
func pgTypeFamilie(naam string) string {
	n := strings.ToLower(strings.TrimSpace(naam))
	if i := strings.Index(n, "("); i >= 0 { // varchar(255), numeric(10,2)
		n = strings.TrimSpace(n[:i])
	}
	switch n {
	case "varchar", "character varying", "text", "bpchar", "char", "character":
		return "varchar"
	case "smallint", "int2", "smallserial":
		return "smallint"
	case "integer", "int", "int4", "serial":
		return "integer"
	case "bigint", "int8", "bigserial":
		return "bigint"
	case "boolean", "bool":
		return "boolean"
	case "date":
		return "date"
	case "timestamptz", "timestamp with time zone":
		return "timestamptz"
	case "timestamp", "timestamp without time zone":
		return "timestamp"
	case "double precision", "float8":
		return "double precision"
	case "real", "float4":
		return "real"
	case "numeric", "decimal":
		return "numeric"
	case "jsonb":
		return "jsonb"
	case "json":
		return "json"
	case "uuid":
		return "uuid"
	case "bytea":
		return "bytea"
	}
	return ""
}

// kolomtypeAfwijkingen vergelijkt de kolommen van een bestaande tabel met het Go-model.
// Kolommen die het model niet kent (vervallen) of die nog ontbreken tellen niet mee.
func kolomtypeAfwijkingen(ctx context.Context, db bun.IDB, dbModel any, tabel string) ([]KolomtypeAfwijking, error) {
	var kolommen []struct {
		Naam string `bun:"column_name"`
		Type string `bun:"udt_name"`
	}
	if err := db.NewRaw(`SELECT column_name, udt_name FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = ?
		ORDER BY ordinal_position`, tabel).Scan(ctx, &kolommen); err != nil {
		return nil, err
	}
	inDB := make(map[string]string, len(kolommen))
	for _, k := range kolommen {
		inDB[k.Naam] = k.Type
	}
	var uit []KolomtypeAfwijking
	t := db.Dialect().Tables().Get(reflect.TypeOf(dbModel))
	for _, f := range t.Fields {
		dbType, bestaat := inDB[f.Name]
		if !bestaat {
			continue
		}
		verwacht, gevonden := pgTypeFamilie(f.CreateTableSQLType), pgTypeFamilie(dbType)
		if verwacht == "" || gevonden == "" || verwacht == gevonden {
			continue
		}
		uit = append(uit, KolomtypeAfwijking{Tabel: tabel, Kolom: f.Name, Database: gevonden, Model: verwacht})
	}
	return uit, nil
}

// meldKolomtypeAfwijkingen logt de afwijkingen van één tabel. Niet fataal: de API moet starten.
func meldKolomtypeAfwijkingen(ctx context.Context, db bun.IDB, dbModel any, tabel string) {
	var afwijkingen []KolomtypeAfwijking
	err := veiligeStap(ctx, db, func() error {
		var e error
		afwijkingen, e = kolomtypeAfwijkingen(ctx, db, dbModel, tabel)
		return e
	})
	if err != nil {
		log.Printf("[dbsetup] WARN: kolomtypen van %s niet nagelopen: %v", tabel, err)
		return
	}
	for _, a := range afwijkingen {
		log.Printf("[dbsetup] LET OP: %s", a.Melding())
	}
}
