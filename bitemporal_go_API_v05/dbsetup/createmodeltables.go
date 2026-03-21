package dbsetup

/*
TODO: omschrijven naar een meer generieke aanpak,
waarbij de tabellen automatisch worden gemaakt op basis van
- de metadata in model/metamodel.go en
- de structuren in model/models.go
*/

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v05/model"
	"github.com/uptrace/bun"
)

func createModelTables(ctx context.Context, db *bun.DB) error {
	createOrder := []model.Metatype{
		model.MetatypeEntiteit,
		model.MetatypeRelatie,
		model.MetatypeGegevenselement,
	}

	for _, metatype := range createOrder {
		typeNames := make([]string, 0)
		for typeName, meta := range model.MetaRegistry {
			if meta.Metatype == metatype {
				typeNames = append(typeNames, typeName)
			}
		}
		sort.Strings(typeNames)

		for _, typeName := range typeNames {
			meta, ok := model.MetaRegistry.GetTypeMeta(typeName)
			if !ok {
				return fmt.Errorf("type ontbreekt in metaregistry: %s", typeName)
			}
			if meta.DBFactory == nil {
				return fmt.Errorf("DBFactory ontbreekt voor type: %s", typeName)
			}

			dbModel := meta.DBFactory()
			_, err := db.NewCreateTable().
				Model(dbModel).
				WithForeignKeys(). //maak de FK constraints aan op basis van de struct tags in de model structs
				IfNotExists().Exec(ctx)
			if err != nil {
				return fmt.Errorf("create table mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
			}

			if meta.IsMaterieel {
				if meta.Metatype == model.MetatypeEntiteit {
					if err := createMaterielePlumbingTablesForEntiteit(ctx, db, meta); err != nil {
						return fmt.Errorf("create materiele plumbing tabellen mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
					}
				}
				if (meta.Metatype == model.MetatypeGegevenselement || meta.Metatype == model.MetatypeRelatie) && meta.HeeftPFK {
					// Zorg dat de tabel een samengestelde PK heeft (entiteit_id + rel_id).
					// Nodig als de tabel al bestaat met een enkelvoudige PK (migratie-scenario).
					if err := ensureCompositePKForGEofRelatie(ctx, db, meta); err != nil {
						return fmt.Errorf("PK-fix mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
					}
					if err := createMaterielePlumbingTablesForGEofRelatie(ctx, db, meta); err != nil {
						return fmt.Errorf("create materiele plumbing tabellen mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
					}
				}
			}

			// maak de triggerfuncties aan voor autoincrement van relatieve ID's,
			// indien nodig
			// dit kan alleen voor gegevenselementen en relaties,
			// en alleen als ze een PFK hebben (dus een FK naar een parent entiteit)
			if (meta.Metatype == model.MetatypeGegevenselement || meta.Metatype == model.MetatypeRelatie) && meta.HeeftPFK && meta.RelatieveAutoincrement {
				if err := RegisterRelativeIDTrigger(ctx, db,
					dbModel, meta.Tabelnaam, meta.EntiteitIDKolom, meta.IDKolom); err != nil {
					return fmt.Errorf("kon trigger voor relatieve ID's niet aanmaken voor %s (%s): %w", typeName, meta.Tabelnaam, err)
				}
			}

		}
	}

	return nil
}

func createMaterielePlumbingTablesForEntiteit(ctx context.Context, db *bun.DB, entiteitMeta model.TypeMeta) error {
	for _, spec := range []struct {
		suffix    string
		waardeCol string
	}{
		{suffix: "aanvang", waardeCol: "datum"},
		{suffix: "einde", waardeCol: "datum"},
	} {
		if err := createMaterielePlumbingTable(ctx, db, entiteitMeta, spec.suffix, spec.waardeCol); err != nil {
			return err
		}
	}

	return nil
}

func createMaterielePlumbingTable(ctx context.Context, db *bun.DB, parentMeta model.TypeMeta, tableSuffix string, waardeKolom string) error {
	parentTable := strings.TrimSpace(parentMeta.Tabelnaam)
	parentIDCol := strings.TrimSpace(parentMeta.IDKolom)
	if parentTable == "" || parentIDCol == "" {
		return fmt.Errorf("onvolledige metadata voor parent type %s: tabelnaam=%q idkolom=%q", parentMeta.Typenaam, parentMeta.Tabelnaam, parentMeta.IDKolom)
	}

	parentIDType, err := resolveKolomType(ctx, db, parentTable, parentIDCol)
	if err != nil {
		return fmt.Errorf("kon kolomtype niet bepalen voor %s.%s: %w", parentTable, parentIDCol, err)
	}

	tableName := fmt.Sprintf("%s_%s", parentTable, tableSuffix)
	// Lokale FK-kolom heet "{entiteit}_id" (bv. a_id, b_id) i.p.v. "id",
	// zodat de naamgeving consistent is met andere GE-types die naar een
	// bovenliggende entiteit verwijzen. De FK verwijst nog steeds naar
	// de kolom "id" in de parent-tabel.
	localFKCol := fmt.Sprintf("%s_%s", parentTable, parentIDCol)
	fkName := fmt.Sprintf("fk_%s_%s", tableName, localFKCol)

	ddl := fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS "%[1]s" (
    "%[2]s" %[3]s NOT NULL,
    "versie" BIGINT NOT NULL,
    "%[4]s" date NULL,
    "opvoer" timestamptz NULL,
    "afvoer" timestamptz NULL,
    PRIMARY KEY ("%[2]s", "versie"),
    CONSTRAINT "%[5]s" FOREIGN KEY ("%[2]s") REFERENCES "%[6]s" ("%[7]s") ON DELETE CASCADE
);`, tableName, localFKCol, parentIDType, waardeKolom, fkName, parentTable, parentIDCol)

	if _, err := db.ExecContext(ctx, ddl); err != nil {
		return fmt.Errorf("create table mislukt voor %s: %w", tableName, err)
	}

	if err := RegisterRelativeIDTrigger(ctx, db, nil, tableName, localFKCol, "versie"); err != nil {
		return fmt.Errorf("kon trigger voor relatieve versie niet aanmaken voor %s: %w", tableName, err)
	}

	return nil
}

// createMaterielePlumbingTablesForGEofRelatie maakt aanvang- en eindetabellen aan
// voor een materieel gegevenselement of een materiële relatie.
// De PFK bestaat uit 3 velden: entiteit_id, rel_id, versie.
// ensureCompositePKForGEofRelatie zorgt idempotent dat de PK van een GE- of relatie-tabel
// uit BEIDE kolommen (entiteit_id, rel_id) bestaat. Als de tabel al bestaat met alleen rel_id
// als PK (bijv. na een schema-wijziging), wordt de PK opnieuw aangemaakt.
func ensureCompositePKForGEofRelatie(ctx context.Context, db *bun.DB, meta model.TypeMeta) error {
	tableName := strings.TrimSpace(meta.Tabelnaam)
	entiteitIDCol := strings.TrimSpace(meta.EntiteitIDKolom)

	sql := fmt.Sprintf(`
DO $$
DECLARE
    pk_has_entiteit_col INT;
    constraint_name TEXT;
BEGIN
    SELECT COUNT(*) INTO pk_has_entiteit_col
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = '%[1]s'::regclass
      AND i.indisprimary
      AND a.attname = '%[2]s';

    IF pk_has_entiteit_col = 0 THEN
        SELECT c.conname INTO constraint_name
        FROM pg_constraint c
        WHERE c.conrelid = '%[1]s'::regclass AND c.contype = 'p';

        EXECUTE format('ALTER TABLE "%[1]s" DROP CONSTRAINT %%I', constraint_name);
        ALTER TABLE "%[1]s" ADD PRIMARY KEY ("%[2]s", "%[3]s");
    END IF;
END $$;
`, tableName, entiteitIDCol, strings.TrimSpace(meta.IDKolom))

	_, err := db.ExecContext(ctx, sql)
	return err
}

func createMaterielePlumbingTablesForGEofRelatie(ctx context.Context, db *bun.DB, geMeta model.TypeMeta) error {
	for _, spec := range []struct {
		suffix    string
		waardeCol string
	}{
		{suffix: "aanvang", waardeCol: "datum"},
		{suffix: "einde", waardeCol: "datum"},
	} {
		if err := createMaterielePlumbingTableForGEofRelatie(ctx, db, geMeta, spec.suffix, spec.waardeCol); err != nil {
			return err
		}
	}
	return nil
}

func createMaterielePlumbingTableForGEofRelatie(ctx context.Context, db *bun.DB, parentMeta model.TypeMeta, tableSuffix string, waardeKolom string) error {
	parentTable := strings.TrimSpace(parentMeta.Tabelnaam)
	entiteitIDCol := strings.TrimSpace(parentMeta.EntiteitIDKolom)
	relIDCol := strings.TrimSpace(parentMeta.IDKolom)
	if parentTable == "" || entiteitIDCol == "" || relIDCol == "" {
		return fmt.Errorf("onvolledige metadata voor parent type %s: tabelnaam=%q entiteitidkolom=%q idkolom=%q",
			parentMeta.Typenaam, parentMeta.Tabelnaam, parentMeta.EntiteitIDKolom, parentMeta.IDKolom)
	}

	entiteitIDType, err := resolveKolomType(ctx, db, parentTable, entiteitIDCol)
	if err != nil {
		return fmt.Errorf("kon kolomtype niet bepalen voor %s.%s: %w", parentTable, entiteitIDCol, err)
	}

	relIDType, err := resolveKolomType(ctx, db, parentTable, relIDCol)
	if err != nil {
		return fmt.Errorf("kon kolomtype niet bepalen voor %s.%s: %w", parentTable, relIDCol, err)
	}

	tableName := fmt.Sprintf("%s_%s", parentTable, tableSuffix)
	fkName := fmt.Sprintf("fk_%s_%s_%s", tableName, entiteitIDCol, relIDCol)

	ddl := fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS "%[1]s" (
    "%[2]s" %[3]s NOT NULL,
    "%[4]s" %[5]s NOT NULL,
    "versie" BIGINT NOT NULL,
    "%[6]s" date NULL,
    "opvoer" timestamptz NULL,
    "afvoer" timestamptz NULL,
    PRIMARY KEY ("%[2]s", "%[4]s", "versie"),
    CONSTRAINT "%[7]s" FOREIGN KEY ("%[2]s", "%[4]s") REFERENCES "%[8]s" ("%[2]s", "%[4]s") ON DELETE CASCADE
);`,
		tableName,      // 1
		entiteitIDCol,  // 2
		entiteitIDType, // 3
		relIDCol,       // 4
		relIDType,      // 5
		waardeKolom,    // 6
		fkName,         // 7
		parentTable,    // 8
	)

	if _, err := db.ExecContext(ctx, ddl); err != nil {
		return fmt.Errorf("create table mislukt voor %s: %w", tableName, err)
	}

	// versie is relatief aan het paar (entiteit_id, rel_id)
	if err := RegisterRelativeIDTriggerComposite(ctx, db, tableName, entiteitIDCol, relIDCol, "versie"); err != nil {
		return fmt.Errorf("kon trigger voor relatieve versie niet aanmaken voor %s: %w", tableName, err)
	}

	return nil
}

func resolveKolomType(ctx context.Context, db *bun.DB, tableName string, columnName string) (string, error) {
	var kolomType string
	err := db.NewSelect().
		ColumnExpr("format_type(a.atttypid, a.atttypmod)").
		TableExpr("pg_catalog.pg_attribute a").
		Join("JOIN pg_catalog.pg_class c ON c.oid = a.attrelid").
		Join("JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace").
		Where("n.nspname = current_schema()").
		Where("c.relname = ?", tableName).
		Where("a.attname = ?", columnName).
		Where("a.attnum > 0").
		Where("NOT a.attisdropped").
		Scan(ctx, &kolomType)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(kolomType) == "" {
		return "", fmt.Errorf("leeg kolomtype teruggekregen")
	}

	return kolomType, nil
}
