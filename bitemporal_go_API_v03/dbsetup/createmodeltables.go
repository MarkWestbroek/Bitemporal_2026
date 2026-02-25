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

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
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
