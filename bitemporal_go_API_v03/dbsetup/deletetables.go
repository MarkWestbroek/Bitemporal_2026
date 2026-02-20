package dbsetup

import (
	"context"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
	"github.com/uptrace/bun"
)

func DeleteTables(db *bun.DB) error {
	ctx := context.Background()

	_, err := db.NewDropTable().Model((*model.Registratie)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewDropTable().Model((*model.Wijziging)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewDropTable().Model((*model.B_Y)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewDropTable().Model((*model.B_X)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewDropTable().Model((*model.A_V)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewDropTable().Model((*model.A_U)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewDropTable().Model((*model.Rel_A_B)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewDropTable().Model((*model.B_basis)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	_, err = db.NewDropTable().Model((*model.A_basis)(nil)).IfExists().Cascade().Exec(ctx)
	if err != nil {
		return err
	}

	/*
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
