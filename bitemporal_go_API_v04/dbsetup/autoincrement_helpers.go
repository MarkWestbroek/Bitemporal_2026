package dbsetup

import (
	"context"
	"fmt"
	"reflect"

	"github.com/uptrace/bun"
)

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

	// 3. De SQL (Idempotent: kan veilig vaker gedraaid worden)
	sql := fmt.Sprintf(`
        CREATE OR REPLACE FUNCTION fn_rel_id_%[1]s() RETURNS TRIGGER AS $$
        BEGIN
            IF NEW."%[3]s" IS NULL OR NEW."%[3]s" = 0 THEN
                SELECT COALESCE(MAX("%[3]s"), 0) + 1 INTO NEW."%[3]s"
                FROM "%[1]s" WHERE "%[2]s" = NEW."%[2]s";
            END IF;
            RETURN NEW;
        END; $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_rel_id_%[1]s ON "%[1]s";
        CREATE TRIGGER trg_rel_id_%[1]s 
        BEFORE INSERT ON "%[1]s" 
        FOR EACH ROW EXECUTE FUNCTION fn_rel_id_%[1]s();
    `, tableName, parentCol, relativeCol)

	_, err := db.ExecContext(ctx, sql)
	return err
}
