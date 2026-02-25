package dbsetup

import (
	"context"
	"fmt"
	"sort"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
	"github.com/uptrace/bun"
)

func DeleteTables(db *bun.DB) error {
	ctx := context.Background()

	// Deze twee tabellen zijn 'plumbing' voor elk register,
	// dus niet model-afhankelijk
	_, err := db.NewDropTable().Model((*model.Registratie)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewDropTable().Model((*model.Wijziging)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	err = dropModelTables(ctx, db)
	if err != nil {
		return err
	}

	/*
		// TEST EN TASK LAAT IK EVEN IN STAND, DIE HEBBEN WE NODIG VOOR DE DEMO,
		// EN ZIJN NIET ESSENTIEEL VOOR HET MODEL,
		// DIE KUNNEN WE LATER WEER VERWIJDEREN
		_, err = db.NewDropTable().Model((*model.Test)(nil)).IfExists().Cascade().Exec(ctx)
		if err != nil {
			return err
		}

		_, err = db.NewDropTable().Model((*model.Task)(nil)).IfExists().Cascade().Exec(ctx)
		if err != nil {
			return err
		}
	*/

	return nil
}

/*
Dropt de door het model gedefineerde tabellen, in de juiste volgorde:
(relaties eerst, dan entiteiten, anders krijgen we problemen met foreign keys)
*/
func dropModelTables(ctx context.Context, db *bun.DB) error {
	dropOrder := []model.Metatype{
		model.MetatypeGegevenselement,
		model.MetatypeRelatie,
		model.MetatypeEntiteit,
	}

	for _, metatype := range dropOrder {
		typeNames := make([]string, 0)
		for typeName, meta := range model.MetaRegistry {
			if meta.Metatype == metatype {
				typeNames = append(typeNames, typeName)
			}
		}
		sort.Sort(sort.Reverse(sort.StringSlice(typeNames)))

		for _, typeName := range typeNames {
			meta, ok := model.MetaRegistry.GetTypeMeta(typeName)
			if !ok {
				return fmt.Errorf("type ontbreekt in metaregistry: %s", typeName)
			}
			if meta.DBFactory == nil {
				return fmt.Errorf("DBFactory ontbreekt voor type: %s", typeName)
			}

			dbModel := meta.DBFactory()
			_, err := db.NewDropTable().Model(dbModel).IfExists().Cascade().Exec(ctx)
			if err != nil {
				return fmt.Errorf("drop table mislukt voor %s (%s): %w", typeName, meta.Tabelnaam, err)
			}
		}
	}

	return nil
}
