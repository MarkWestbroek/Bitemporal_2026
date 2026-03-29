package dbsetup

/*
TODO: omschrijven naar een meer generieke aanpak,
waarbij de tabellen automatisch worden gemaakt op basis van
- de metadata in model/metamodel.go en
- de structuren in model/modellen_ge_rel.go en model/modellen_entiteiten.go
*/

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
)

func createModelTables(ctx context.Context, db *bun.DB) error {
	// Eenmalige migratie: hernoem tabellen en kolommen van de oude
	// Landenlijst-als-entiteit structuur naar de nieuwe generieke
	// Referentielijst-als-entiteit structuur.
	if err := ensureReferentielijstRefactorMigrated(ctx, db); err != nil {
		return fmt.Errorf("referentielijst-refactor migratie mislukt: %w", err)
	}

	// Eenmalige migratie: voeg kolom 'land' (int, FK naar referentielijst) toe
	// aan locatie_adres_data, als deze nog ontbreekt.
	if err := ensureLocatieAdresDataLandKolom(ctx, db); err != nil {
		return fmt.Errorf("locatie_adres_data land-kolom migratie mislukt: %w", err)
	}

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

			// Compatibiliteit met oudere schema's:
			// sommige oude entiteitstabellen gebruikten "<tabelnaam>_id" als PK-kolom
			// in plaats van de huidige conventie "id". Zonder deze migratie falen
			// FK's vanuit bijbehorende _aanvang/_einde tabellen op REFERENCES ... (id).
			if meta.Metatype == model.MetatypeEntiteit {
				if err := ensureEntiteitIDKolomMigrated(ctx, db, meta); err != nil {
					return fmt.Errorf("entiteit-ID migratie mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
				}
			}

			if meta.IsMaterieel {
				if meta.Metatype == model.MetatypeEntiteit {
					if err := createMaterielePlumbingTablesForEntiteit(ctx, db, meta); err != nil {
						return fmt.Errorf("create materiele plumbing tabellen mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
					}
				}
				if (meta.Metatype == model.MetatypeGegevenselement || meta.Metatype == model.MetatypeRelatie) && meta.HeeftPFK {
					// Hubs: hun _Aanvang/_Einde hebben eigen MetaRegistry entries,
					// dus we slaan de oude DDL-generatie voor materiële plumbing over.
					if meta.GESubtype != model.GESubtypeHub {
						if err := ensureCompositePKForGEofRelatie(ctx, db, meta); err != nil {
							return fmt.Errorf("PK-fix mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
						}
						if err := createMaterielePlumbingTablesForGEofRelatie(ctx, db, meta); err != nil {
							return fmt.Errorf("create materiele plumbing tabellen mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
						}
					}
				}
			}

			// === Trigger-registratie voor relatieve autoincrement ===
			//
			// Hub-onderlagen (_Data, _Aanvang, _Einde) gebruiken een composite trigger:
			//   scope (ent_id, rel_id) → versie autoincrement
			// Plus een FK constraint naar de bovenliggende hub.
			//
			// Gewone GE's/REL's (hubs zelf) gebruiken de enkelvoudige trigger:
			//   scope (ent_id) → rel_id autoincrement
			if (meta.Metatype == model.MetatypeGegevenselement || meta.Metatype == model.MetatypeRelatie) && meta.HeeftPFK && meta.RelatieveAutoincrement {
				if meta.GESubtype == model.GESubtypeData || meta.GESubtype == model.GESubtypeAanvang || meta.GESubtype == model.GESubtypeEinde {
					// _Data en hub _Aanvang/_Einde: versie incrementeert per (entiteit_id, rel_id)
					parentMeta, ok := model.MetaRegistry.GetTypeMeta(meta.BovenliggendTypenaam)
					if !ok {
						return fmt.Errorf("bovenliggend type %s niet gevonden voor %s", meta.BovenliggendTypenaam, typeName)
					}

					// Entiteit-level _Aanvang/_Einde (bijv. A_Aanvang, Locatie_Aanvang)
					// worden al afgehandeld via createMaterielePlumbingTablesForEntiteit,
					// met een enkelvoudige scope op (entiteit_id, versie).
					// Voor deze types is er géén rel_id op het child-record, dus het
					// hub-specifieke composite pad (entiteit_id + rel_id) is onjuist.
					if parentMeta.Metatype == model.MetatypeEntiteit {
						continue
					}

					hubRelIDCol := parentMeta.IDKolom // "rel_id" van de hub
					if err := RegisterRelativeIDTriggerComposite(ctx, db,
						meta.Tabelnaam, meta.EntiteitIDKolom, hubRelIDCol, meta.IDKolom); err != nil {
						return fmt.Errorf("kon composite trigger niet aanmaken voor %s (%s): %w", typeName, meta.Tabelnaam, err)
					}
					// FK constraint naar de hub tabel
					if err := ensureFKToParentHub(ctx, db, meta, parentMeta); err != nil {
						return fmt.Errorf("FK constraint mislukt voor %s → %s: %w", typeName, parentMeta.Typenaam, err)
					}
				} else {
					if err := RegisterRelativeIDTrigger(ctx, db,
						dbModel, meta.Tabelnaam, meta.EntiteitIDKolom, meta.IDKolom); err != nil {
						return fmt.Errorf("kon trigger voor relatieve ID's niet aanmaken voor %s (%s): %w", typeName, meta.Tabelnaam, err)
					}
				}
			}

		}
	}

	return nil
}

// ensureEntiteitIDKolomMigrated hernoemt legacy entiteit-PK-kolom "<tabel>_id" naar "id"
// wanneer "id" nog ontbreekt. Hiermee blijven oudere databases bruikbaar.
func ensureEntiteitIDKolomMigrated(ctx context.Context, db *bun.DB, meta model.TypeMeta) error {
	tableName := strings.TrimSpace(meta.Tabelnaam)
	idCol := strings.TrimSpace(meta.IDKolom)
	if tableName == "" || idCol == "" || idCol != "id" {
		return nil
	}

	legacyIDCol := tableName + "_id"
	sql := fmt.Sprintf(`
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = current_schema()
		  AND table_name = '%[1]s'
		  AND column_name = '%[2]s'
	)
	AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = current_schema()
		  AND table_name = '%[1]s'
		  AND column_name = '%[3]s'
	) THEN
		EXECUTE format('ALTER TABLE "%[1]s" RENAME COLUMN "%[2]s" TO "%[3]s"');
	END IF;
END $$;
`, tableName, legacyIDCol, idCol)

	_, err := db.ExecContext(ctx, sql)
	return err
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

// ensureFKToParentHub voegt een composite FK constraint toe van een _Data of hub _Aanvang/_Einde
// tabel naar de bovenliggende hub tabel, als die constraint nog niet bestaat.
func ensureFKToParentHub(ctx context.Context, db *bun.DB, childMeta, parentMeta model.TypeMeta) error {
	childTable := strings.TrimSpace(childMeta.Tabelnaam)
	parentTable := strings.TrimSpace(parentMeta.Tabelnaam)
	entCol := strings.TrimSpace(childMeta.EntiteitIDKolom)
	relCol := strings.TrimSpace(parentMeta.IDKolom)
	fkName := fmt.Sprintf("fk_%s_%s_%s", childTable, entCol, relCol)

	sql := fmt.Sprintf(`
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '%[1]s'
    ) THEN
        ALTER TABLE "%[2]s" ADD CONSTRAINT "%[1]s"
            FOREIGN KEY ("%[3]s", "%[4]s") REFERENCES "%[5]s" ("%[3]s", "%[4]s") ON DELETE CASCADE;
    END IF;
END $$;
`, fkName, childTable, entCol, relCol, parentTable)

	_, err := db.ExecContext(ctx, sql)
	return err
}

// ensureReferentielijstRefactorMigrated voert de eenmalige migratie uit voor de
// refactoring van Landenlijst-als-entiteit naar Referentielijst-als-generieke-entiteit.
//
// Wijzigingen:
//   - register_referentielijst: kolom typenaam → systeemnaam, voeg opvoer/afvoer toe
//   - landenlijst_aanvang → referentielijst_aanvang (tabel + kolom landenlijst_id → referentielijst_id)
//   - landenlijst_einde → referentielijst_einde (tabel + kolom landenlijst_id → referentielijst_id)
//   - landenlijst_land: kolom landenlijst_id → referentielijst_id
//   - landenlijst_land_data: kolom landenlijst_id → referentielijst_id
//   - drop oude landenlijst tabel
func ensureReferentielijstRefactorMigrated(ctx context.Context, db *bun.DB) error {
	_, err := db.ExecContext(ctx, `
DO $$
BEGIN
	-- 1. register_referentielijst: hernoem typenaam → systeemnaam (als typenaam nog bestaat)
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'register_referentielijst' AND column_name = 'typenaam'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'register_referentielijst' AND column_name = 'systeemnaam'
	) THEN
		ALTER TABLE register_referentielijst RENAME COLUMN typenaam TO systeemnaam;
	END IF;

	-- register_referentielijst: voeg opvoer/afvoer toe als ze ontbreken
	IF EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = current_schema() AND table_name = 'register_referentielijst'
	) THEN
		ALTER TABLE register_referentielijst ADD COLUMN IF NOT EXISTS opvoer TIMESTAMPTZ;
		ALTER TABLE register_referentielijst ADD COLUMN IF NOT EXISTS afvoer TIMESTAMPTZ;
		-- Drop legacy kolommen die nu in aparte GE-tabellen zitten
		ALTER TABLE register_referentielijst DROP COLUMN IF EXISTS naam;
		ALTER TABLE register_referentielijst DROP COLUMN IF EXISTS beschrijving;
		ALTER TABLE register_referentielijst DROP COLUMN IF EXISTS is_materieel;
	END IF;

	-- 2. landenlijst_aanvang → referentielijst_aanvang
	IF EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = current_schema() AND table_name = 'landenlijst_aanvang'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = current_schema() AND table_name = 'referentielijst_aanvang'
	) THEN
		ALTER TABLE landenlijst_aanvang RENAME TO referentielijst_aanvang;
	END IF;
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'referentielijst_aanvang' AND column_name = 'landenlijst_id'
	) THEN
		ALTER TABLE referentielijst_aanvang RENAME COLUMN landenlijst_id TO referentielijst_id;
	END IF;

	-- 3. landenlijst_einde → referentielijst_einde
	IF EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = current_schema() AND table_name = 'landenlijst_einde'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = current_schema() AND table_name = 'referentielijst_einde'
	) THEN
		ALTER TABLE landenlijst_einde RENAME TO referentielijst_einde;
	END IF;
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'referentielijst_einde' AND column_name = 'landenlijst_id'
	) THEN
		ALTER TABLE referentielijst_einde RENAME COLUMN landenlijst_id TO referentielijst_id;
	END IF;

	-- 4. landenlijst_land: hernoem kolom landenlijst_id → referentielijst_id
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'landenlijst_land' AND column_name = 'landenlijst_id'
	) THEN
		ALTER TABLE landenlijst_land RENAME COLUMN landenlijst_id TO referentielijst_id;
	END IF;

	-- 5. landenlijst_land_data: hernoem kolom landenlijst_id → referentielijst_id
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'landenlijst_land_data' AND column_name = 'landenlijst_id'
	) THEN
		ALTER TABLE landenlijst_land_data RENAME COLUMN landenlijst_id TO referentielijst_id;
	END IF;

	-- 6. drop oude landenlijst tabel (vervangen door records in register_referentielijst)
	DROP TABLE IF EXISTS landenlijst CASCADE;

END $$;
`)
	return err
}

// ensureLocatieAdresDataLandKolom voegt de kolom 'land' (integer, default 0) toe
// aan locatie_adres_data wanneer deze ontbreekt. De kolom is een referentie naar
// een LandenlijstLand entry in de referentielijst.
func ensureLocatieAdresDataLandKolom(ctx context.Context, db *bun.DB) error {
	_, err := db.ExecContext(ctx, `
		ALTER TABLE locatie_adres_data
		ADD COLUMN IF NOT EXISTS land INTEGER NOT NULL DEFAULT 0;
	`)
	return err
}
