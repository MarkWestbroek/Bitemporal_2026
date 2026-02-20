package dbsetup

import (
	"context"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
	"github.com/uptrace/bun"
)

func CreateTables(db *bun.DB) error {
	ctx := context.Background()
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

	//Entities tables
	// Create the "A" table in the database if it doesn't exist
	_, err = db.NewCreateTable().Model((*model.A_basis)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}
	_, err = db.NewCreateTable().Model((*model.B_basis)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}

	//Relations tables
	_, err = db.NewCreateTable().Model((*model.Rel_A_B)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}

	//Data element tables
	_, err = db.NewCreateTable().Model((*model.A_U)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}
	_, err = db.NewCreateTable().Model((*model.A_V)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewCreateTable().Model((*model.B_X)(nil)).IfNotExists().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewCreateTable().Model((*model.B_Y)(nil)).IfNotExists().Exec(ctx)
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
