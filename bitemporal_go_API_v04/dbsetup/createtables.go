package dbsetup

import (
	"context"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v04/model"
	"github.com/uptrace/bun"
)

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
		- model/models.go (structs)
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
	return nil
}
