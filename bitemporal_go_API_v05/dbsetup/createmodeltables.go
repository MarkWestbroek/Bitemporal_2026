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

			if meta.Metatype == model.MetatypeEntiteit && meta.IsMaterieel {
				if err := createMaterielePlumbingTablesForEntiteit(ctx, db, meta); err != nil {
					return fmt.Errorf("create materiele plumbing tabellen mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
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
		{suffix: "aanvang", waardeCol: "aanvang"},
		{suffix: "einde", waardeCol: "einde"},
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
	fkName := fmt.Sprintf("fk_%s_%s", tableName, parentIDCol)

	ddl := fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS "%[1]s" (
    "%[2]s" %[3]s NOT NULL,
    "versie" BIGINT NOT NULL,
    "%[4]s" timestamptz NULL,
    "opvoer" timestamptz NULL,
    "afvoer" timestamptz NULL,
    PRIMARY KEY ("%[2]s", "versie"),
    CONSTRAINT "%[5]s" FOREIGN KEY ("%[2]s") REFERENCES "%[6]s" ("%[2]s") ON DELETE CASCADE
);`, tableName, parentIDCol, parentIDType, waardeKolom, fkName, parentTable)

	if _, err := db.ExecContext(ctx, ddl); err != nil {
		return fmt.Errorf("create table mislukt voor %s: %w", tableName, err)
	}

	if err := RegisterRelativeIDTrigger(ctx, db, nil, tableName, parentIDCol, "versie"); err != nil {
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
