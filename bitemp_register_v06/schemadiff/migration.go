package schemadiff

import (
	"fmt"
	"strings"
	"time"
)

// MigratieResultaat bevat de gegenereerde DDL-statements voor een schema-migratie.
type MigratieResultaat struct {
	Datum        string // YYYYMMDD
	Beschrijving string
	Statements   []MigratieStatement
}

// MigratieStatement is één DDL-statement met metadata.
type MigratieStatement struct {
	SQL           string // het DDL-statement
	Omschrijving  string // leesbare beschrijving
	Ernst         Ernst  // ernst van het onderliggende delta-item
	IsDestructief bool   // true als het statement dataverlies kan veroorzaken
}

// GenereerMigratie genereert DDL-statements op basis van een DeltaRapport.
// Destructieve statements worden uitgecommentarieerd met een waarschuwing.
func GenereerMigratie(rapport DeltaRapport) MigratieResultaat {
	resultaat := MigratieResultaat{
		Datum:        time.Now().Format("20060102"),
		Beschrijving: migratieOmschrijving(rapport),
	}

	for _, item := range rapport.Items {
		stmts := genereerStatements(item)
		resultaat.Statements = append(resultaat.Statements, stmts...)
	}

	return resultaat
}

// AlsSQL retourneert de volledige migratie als één SQL-string, geschikt om naar
// een bestand te schrijven of direct uit te voeren.
func (m MigratieResultaat) AlsSQL() string {
	if len(m.Statements) == 0 {
		return "-- Geen migratie-statements gegenereerd.\n"
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("-- Migratie: %s\n", m.Beschrijving))
	b.WriteString(fmt.Sprintf("-- Gegenereerd: %s\n", m.Datum))
	b.WriteString("-- Door: schemadiff\n")
	b.WriteString("\nBEGIN;\n\n")

	for _, stmt := range m.Statements {
		b.WriteString(fmt.Sprintf("-- %s [%s]\n", stmt.Omschrijving, stmt.Ernst))
		if stmt.IsDestructief {
			b.WriteString("-- ⚠ DESTRUCTIEF: Onderstaand statement kan dataverlies veroorzaken.\n")
			b.WriteString("-- Verwijder de commentaarmarkeringen om uit te voeren.\n")
			for _, line := range strings.Split(stmt.SQL, "\n") {
				b.WriteString("-- " + line + "\n")
			}
		} else {
			b.WriteString(stmt.SQL + "\n")
		}
		b.WriteString("\n")
	}

	b.WriteString("COMMIT;\n")
	return b.String()
}

// Bestandsnaam retourneert een standaard migratiebestandsnaam.
func (m MigratieResultaat) Bestandsnaam() string {
	slug := strings.ReplaceAll(m.Beschrijving, " ", "_")
	slug = strings.ToLower(slug)
	// Beperk lengte
	if len(slug) > 80 {
		slug = slug[:80]
	}
	return fmt.Sprintf("%s_%s.sql", m.Datum, slug)
}

// ---- DDL-generatie per delta-item ----

func genereerStatements(item DeltaItem) []MigratieStatement {
	switch {
	case item.Categorie == CategorieEntiteit && item.Actie == ActieToeGevoegd:
		return genereerCreateTable(item)
	case item.Categorie == CategorieEntiteit && item.Actie == ActieVerwijderd:
		return genereerDropTable(item)
	case item.Categorie == CategorieGegevenselement && item.Actie == ActieToeGevoegd:
		return genereerCreateTable(item)
	case item.Categorie == CategorieGegevenselement && item.Actie == ActieVerwijderd:
		return genereerDropTable(item)
	case item.Categorie == CategorieRelatie && item.Actie == ActieToeGevoegd:
		return genereerCreateTable(item)
	case item.Categorie == CategorieRelatie && item.Actie == ActieVerwijderd:
		return genereerDropTable(item)
	case item.Categorie == CategorieVeld && item.Actie == ActieToeGevoegd:
		return genereerAddColumn(item)
	case item.Categorie == CategorieVeld && item.Actie == ActieVerwijderd:
		return genereerDropColumn(item)
	case item.Categorie == CategorieVeld && item.Actie == ActieGewijzigd:
		return genereerAlterColumn(item)
	case item.Categorie == CategorieEntiteit && item.Actie == ActieGewijzigd && strings.HasPrefix(item.OudeWaarde, "erft="):
		return genereerOverervingMigratie(item)
	default:
		// Geen DDL nodig voor informatieve items of items zonder tabel
		return nil
	}
}

func genereerCreateTable(item DeltaItem) []MigratieStatement {
	if item.Tabelnaam == "" {
		return nil
	}
	// De daadwerkelijke CREATE TABLE wordt door Bun/createmodeltables afgehandeld
	// bij het opnieuw starten van de applicatie. Hier genereren we een placeholder.
	sql := fmt.Sprintf("-- CREATE TABLE \"%s\" wordt automatisch aangemaakt door de applicatie bij herstart.\n"+
		"-- Gebruik 'go run .' of de codegen pipeline om tabellen aan te maken.", item.Tabelnaam)
	return []MigratieStatement{{
		SQL:          sql,
		Omschrijving: item.Omschrijving,
		Ernst:        item.Ernst,
	}}
}

func genereerDropTable(item DeltaItem) []MigratieStatement {
	if item.Tabelnaam == "" {
		return nil
	}
	return []MigratieStatement{{
		SQL:           fmt.Sprintf("DROP TABLE IF EXISTS \"%s\" CASCADE;", item.Tabelnaam),
		Omschrijving:  item.Omschrijving,
		Ernst:         item.Ernst,
		IsDestructief: true,
	}}
}

func genereerAddColumn(item DeltaItem) []MigratieStatement {
	if item.Tabelnaam == "" || item.Kolomnaam == "" {
		return nil
	}
	dbType := item.DBType
	if dbType == "" {
		dbType = "TEXT" // fallback
	}
	return []MigratieStatement{{
		SQL:          fmt.Sprintf("ALTER TABLE \"%s\" ADD COLUMN IF NOT EXISTS \"%s\" %s;", item.Tabelnaam, item.Kolomnaam, dbType),
		Omschrijving: item.Omschrijving,
		Ernst:        item.Ernst,
	}}
}

func genereerDropColumn(item DeltaItem) []MigratieStatement {
	if item.Tabelnaam == "" || item.Kolomnaam == "" {
		return nil
	}
	return []MigratieStatement{{
		SQL:           fmt.Sprintf("ALTER TABLE \"%s\" DROP COLUMN IF EXISTS \"%s\";", item.Tabelnaam, item.Kolomnaam),
		Omschrijving:  item.Omschrijving,
		Ernst:         item.Ernst,
		IsDestructief: true,
	}}
}

func genereerAlterColumn(item DeltaItem) []MigratieStatement {
	if item.Tabelnaam == "" || item.Kolomnaam == "" {
		return nil
	}

	var stmts []MigratieStatement

	// Type-wijziging
	if item.DBType != "" && item.OudeWaarde != "" && item.NieuweWaarde != "" &&
		!strings.HasPrefix(item.OudeWaarde, "verplicht=") &&
		!strings.HasPrefix(item.OudeWaarde, "enum=") {
		stmts = append(stmts, MigratieStatement{
			SQL: fmt.Sprintf("ALTER TABLE \"%s\" ALTER COLUMN \"%s\" TYPE %s USING \"%s\"::%s;",
				item.Tabelnaam, item.Kolomnaam, item.DBType, item.Kolomnaam, item.DBType),
			Omschrijving:  fmt.Sprintf("Type van kolom '%s' wijzigen naar %s", item.Kolomnaam, item.DBType),
			Ernst:         item.Ernst,
			IsDestructief: true, // type-wijzigingen zijn potentieel destructief
		})
	}

	// NOT NULL wijzigingen
	if item.NieuweWaarde == "verplicht=true" {
		stmts = append(stmts, MigratieStatement{
			SQL:          fmt.Sprintf("ALTER TABLE \"%s\" ALTER COLUMN \"%s\" SET NOT NULL;", item.Tabelnaam, item.Kolomnaam),
			Omschrijving: fmt.Sprintf("Kolom '%s' verplicht maken (SET NOT NULL)", item.Kolomnaam),
			Ernst:        item.Ernst,
		})
	}
	if item.NieuweWaarde == "verplicht=false" {
		stmts = append(stmts, MigratieStatement{
			SQL:          fmt.Sprintf("ALTER TABLE \"%s\" ALTER COLUMN \"%s\" DROP NOT NULL;", item.Tabelnaam, item.Kolomnaam),
			Omschrijving: fmt.Sprintf("Kolom '%s' optioneel maken (DROP NOT NULL)", item.Kolomnaam),
			Ernst:        item.Ernst,
		})
	}

	return stmts
}

// genereerOverervingMigratie genereert DDL voor overerving-wijzigingen (PFK-constraints).
func genereerOverervingMigratie(item DeltaItem) []MigratieStatement {
	if item.Tabelnaam == "" {
		return nil
	}

	var stmts []MigratieStatement

	// Oude parent FK constraint verwijderen indien aanwezig
	oudeParent := strings.TrimPrefix(item.OudeWaarde, "erft=")
	if oudeParent != "" {
		constraintNaam := fmt.Sprintf("fk_%s_%s", item.Tabelnaam, strings.ToLower(oudeParent))
		stmts = append(stmts, MigratieStatement{
			SQL:           fmt.Sprintf("ALTER TABLE \"%s\" DROP CONSTRAINT IF EXISTS \"%s\";", item.Tabelnaam, constraintNaam),
			Omschrijving:  fmt.Sprintf("PFK-constraint naar '%s' verwijderen van '%s'", oudeParent, item.Tabelnaam),
			Ernst:         item.Ernst,
			IsDestructief: true,
		})
	}

	// Nieuwe parent FK constraint toevoegen indien aanwezig
	nieuweParent := strings.TrimPrefix(item.NieuweWaarde, "erft=")
	if nieuweParent != "" {
		parentTabel := strings.ToLower(nieuweParent)
		parentIDKolom := parentTabel + "_id"
		constraintNaam := fmt.Sprintf("fk_%s_%s", item.Tabelnaam, parentTabel)
		// PK-kolom hernoemen van "id" naar "{parent}_id" als dat nodig is
		stmts = append(stmts, MigratieStatement{
			SQL: fmt.Sprintf("ALTER TABLE \"%s\" ADD CONSTRAINT \"%s\" FOREIGN KEY (\"%s\") REFERENCES \"%s\"(\"id\") ON DELETE CASCADE;",
				item.Tabelnaam, constraintNaam, parentIDKolom, parentTabel),
			Omschrijving: fmt.Sprintf("PFK-constraint naar '%s' toevoegen op '%s'", nieuweParent, item.Tabelnaam),
			Ernst:        item.Ernst,
		})
	}

	return stmts
}

// ---- Helpers ----

func migratieOmschrijving(rapport DeltaRapport) string {
	nAdditief := len(rapport.Additief())
	nModificatie := len(rapport.Modificaties())
	nDestructief := len(rapport.Destructief())
	parts := []string{}
	if nAdditief > 0 {
		parts = append(parts, fmt.Sprintf("%d toevoegingen", nAdditief))
	}
	if nModificatie > 0 {
		parts = append(parts, fmt.Sprintf("%d modificaties", nModificatie))
	}
	if nDestructief > 0 {
		parts = append(parts, fmt.Sprintf("%d verwijderingen", nDestructief))
	}
	if len(parts) == 0 {
		return "geen wijzigingen"
	}
	return fmt.Sprintf("schema migratie %s naar %s (%s)",
		rapport.OudModelVersie, rapport.NieuwModelVersie, strings.Join(parts, ", "))
}
