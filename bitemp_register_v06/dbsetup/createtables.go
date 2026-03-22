package dbsetup

import (
	"context"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
)

func ensureSchemaVersiesMigrated(ctx context.Context, db *bun.DB) error {
	// Houd bestaande databases bruikbaar door de oude kolomnaam `versie` naar `id` te migreren
	// en de nieuwe metadata-kolommen alleen toe te voegen als ze nog ontbreken.
	_, err := db.ExecContext(ctx, `
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'schema_versies'
			AND column_name = 'versie'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'schema_versies'
			AND column_name = 'id'
	) THEN
		ALTER TABLE schema_versies RENAME COLUMN versie TO id;
	END IF;

	ALTER TABLE schema_versies ADD COLUMN IF NOT EXISTS bron TEXT;
	ALTER TABLE schema_versies ADD COLUMN IF NOT EXISTS indiener TEXT;
	ALTER TABLE schema_versies ADD COLUMN IF NOT EXISTS model_versie TEXT;
	ALTER TABLE schema_versies ADD COLUMN IF NOT EXISTS model_naam TEXT;
	ALTER TABLE schema_versies ADD COLUMN IF NOT EXISTS model_beschrijving TEXT;
END $$;
`)
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, `
		UPDATE schema_versies
		SET model_versie = schema_json->>'versie'
		WHERE COALESCE(model_versie, '') = ''
			AND schema_json ? 'versie'
	`)
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, `
		UPDATE schema_versies
		SET model_naam = schema_json->>'naam'
		WHERE COALESCE(model_naam, '') = ''
			AND schema_json ? 'naam'
	`)
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, `
		UPDATE schema_versies
		SET model_beschrijving = schema_json->>'beschrijving'
		WHERE COALESCE(model_beschrijving, '') = ''
			AND schema_json ? 'beschrijving'
	`)
	return err
}

func CreateTables(db *bun.DB) error {
	ctx := context.Background()

	// tasks en tests tabellen zijn er puur voor de demo,
	//  die kunnen we later weer verwijderen,
	// maar ze zijn handig om snel wat data in de DB te kunnen zetten en te testen
	// Create the "tasks" table in the database if it doesn't exist
	_, err := db.NewCreateTable().Model((*model.Task)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}
	// Create the "tests" table in the database if it doesn't exist
	_, err = db.NewCreateTable().Model((*model.Test)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}

	/*
		Maak de tabellen voor de model representaties aan,
		 dus de entiteiten, relaties en gegevenselementen, typisch voor dit register.
		Deze worden gespecificeerd in:
		- model/metamodel.go (map)
		- model/modellen_ge_rel.go en model/modellen_entiteiten.go (structs)
	*/
	err = createModelTables(ctx, db)
	if err != nil {
		return err
	}

	//Bitemporal core tables
	// Wijziging table
	_, err = db.NewCreateTable().Model((*model.Wijziging)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}

	// Registratie table
	_, err = db.NewCreateTable().Model((*model.Registratie)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}

	// Schema versioning tabel (zie ontwerpkeuzen.md §7)
	_, err = db.NewCreateTable().Model((*model.SchemaVersie)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}

	err = ensureSchemaVersiesMigrated(ctx, db)
	if err != nil {
		return err
	}

	// Indexen voor formele tijdreisquery's
	err = createFormeleTijdIndexes(ctx, db)
	if err != nil {
		return err
	}

	// Views voor formele tijdreisquery's
	err = createFormeleTijdViews(ctx, db)
	if err != nil {
		return err
	}
	return nil
}
