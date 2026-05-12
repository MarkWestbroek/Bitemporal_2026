package dbsetup

import (
	"context"
	"fmt"
	"hash/crc32"
	"reflect"

	"github.com/uptrace/bun"
)

// getCRC32Hash genereert een korte, unieke hash van een tabelnaam.
// Dit wordt gebruikt voor trigger-functienamen om PostgreSQL's 63-karakterslimiet te omzeilen.
// Zonder dit kunnen lange tabelnamen afgekapt worden, waardoor _Data triggers HUB triggers overwritten.
func getCRC32Hash(tableName string) string {
	hash := crc32.ChecksumIEEE([]byte(tableName))
	return fmt.Sprintf("t%x", hash) // "t" prefix + 8 hexadecimale karakters = "t12ab34cd"
}

// om de reflectie code te bewaren. maar wordt niet gebruikt
func RegisterRelativeIDTriggerUsingReflection(ctx context.Context, db *bun.DB, model interface{}) error {
	// 1. Haal metadata op via Bun
	typ := reflect.TypeOf(model)
	if typ.Kind() == reflect.Ptr {
		typ = typ.Elem()
	}
	table := db.Table(typ)

	// 2. Validatie: We verwachten minimaal 2 PK's
	if len(table.PKs) < 2 {
		return fmt.Errorf("tabel %s heeft %d PK's, maar er zijn er minstens 2 nodig", table.Name, len(table.PKs))
	}

	// We nemen aan: de eerste PK is de parent (A_ID), de tweede de relatieve (ID)
	parentCol := table.PKs[0].Name
	relativeCol := table.PKs[1].Name
	tableName := table.Name

	// Call RegisterRelativeIDTrigger with the extracted metadata
	return RegisterRelativeIDTrigger(ctx, db, model, tableName, parentCol, relativeCol)
}

func RegisterRelativeIDTrigger(ctx context.Context, db *bun.DB, model interface{},
	tableName string, parentCol string, relativeCol string) error {

	// Genereer korte, unieke functie-naam met CRC32 om PostgreSQL 63-karakters-limiet te omzeilen
	// Lanke tabelnamen (bijv. kennisartikeltaalvariant_kennisartikeltaalvarianttitel)
	// kunnen afgekapt worden, waardoor _Data functies HUB functies overwritten.
	funcHash := getCRC32Hash(tableName)
	funcName := fmt.Sprintf("fn_rel_id_%s", funcHash)

	// 3. De SQL (Idempotent: kan veilig vaker gedraaid worden)
	sql := fmt.Sprintf(`
        CREATE OR REPLACE FUNCTION %[1]s() RETURNS TRIGGER AS $$
        BEGIN
            IF NEW."%[4]s" IS NULL OR NEW."%[4]s" = 0 THEN
                SELECT COALESCE(MAX("%[4]s"), 0) + 1 INTO NEW."%[4]s"
                FROM "%[2]s" WHERE "%[3]s" = NEW."%[3]s";
            END IF;
            RETURN NEW;
        END; $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_rel_id_%[2]s ON "%[2]s";
        CREATE TRIGGER trg_rel_id_%[2]s 
        BEFORE INSERT ON "%[2]s" 
        FOR EACH ROW EXECUTE FUNCTION %[1]s();
    `, funcName, tableName, parentCol, relativeCol)

	if _, err := db.ExecContext(ctx, sql); err != nil {
		return err
	}

	// Verwijder eventuele SEQUENCE-default op de relatieve kolom.
	// Bun's autoincrement-tag genereert BIGSERIAL → nextval(..._seq),
	// die vóór de BEFORE INSERT trigger evalueert en daardoor de
	// trigger-check (IS NULL OR = 0) omzeilt. Door de default weg
	// te halen, ontvangt de trigger NULL en kan hij correct relatief
	// ophogen. DROP DEFAULT is idempotent.
	dropDefault := fmt.Sprintf(
		`ALTER TABLE "%s" ALTER COLUMN "%s" DROP DEFAULT;`,
		tableName, relativeCol)
	_, err := db.ExecContext(ctx, dropDefault)
	return err
}

// RegisterRelativeIDTriggerComposite maakt een trigger aan voor relatieve autoincrement
// met een samengestelde parent key (2 parent-kolommen).
// Dit is nodig voor aanvang/einde plumbing-tabellen van gegevenselementen en relaties,
// waar de versie relatief is aan het paar (entiteit_id, rel_id).
func RegisterRelativeIDTriggerComposite(ctx context.Context, db *bun.DB,
	tableName string, parentCol1 string, parentCol2 string, relativeCol string) error {

	// Genereer korte, unieke functie-naam met CRC32 om PostgreSQL 63-karakters-limiet te omzeilen
	funcHash := getCRC32Hash(tableName)
	funcName := fmt.Sprintf("fn_rel_id_%s", funcHash)

	sql := fmt.Sprintf(`
        CREATE OR REPLACE FUNCTION %[1]s() RETURNS TRIGGER AS $$
        BEGIN
            IF NEW."%[5]s" IS NULL OR NEW."%[5]s" = 0 THEN
                SELECT COALESCE(MAX("%[5]s"), 0) + 1 INTO NEW."%[5]s"
                FROM "%[2]s" WHERE "%[3]s" = NEW."%[3]s" AND "%[4]s" = NEW."%[4]s";
            END IF;
            RETURN NEW;
        END; $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_rel_id_%[2]s ON "%[2]s";
        CREATE TRIGGER trg_rel_id_%[2]s
        BEFORE INSERT ON "%[2]s"
        FOR EACH ROW EXECUTE FUNCTION %[1]s();
    `, funcName, tableName, parentCol1, parentCol2, relativeCol)

	if _, err := db.ExecContext(ctx, sql); err != nil {
		return err
	}

	// Verwijder eventuele SEQUENCE-default — zie toelichting in
	// RegisterRelativeIDTrigger hierboven.
	dropDefault := fmt.Sprintf(
		`ALTER TABLE "%s" ALTER COLUMN "%s" DROP DEFAULT;`,
		tableName, relativeCol)
	_, err := db.ExecContext(ctx, dropDefault)
	return err
}
