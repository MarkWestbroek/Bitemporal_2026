package handlers

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v02/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// handleOpvoerA processes an opvoer for Full_A or its data elements
func handleOpvoerA(c *gin.Context, tx bun.Tx, opvoer *model.OpvoerAfvoerA, registratieID int, tijdstip time.Time) error {
	// Scenario 1: Opvoer van hele entiteit A met gegevenselementen
	if opvoer.A != nil {
		return handleOpvoerFullA(c, tx, opvoer.A, registratieID, tijdstip)
	}

	// Scenario 3: Opvoer van individuele gegevenselementen
	if opvoer.U != nil {
		return handleOpvoerA_U(c, tx, opvoer.U, registratieID, tijdstip)
	}
	if opvoer.V != nil {
		return handleOpvoerA_V(c, tx, opvoer.V, registratieID, tijdstip)
	}
	if opvoer.Rel_A_B != nil {
		return handleOpvoerRel_A_B(c, tx, opvoer.Rel_A_B, registratieID, tijdstip)
	}

	// Batch opvoer
	if len(opvoer.Us) > 0 {
		for _, u := range opvoer.Us {
			if err := handleOpvoerA_U(c, tx, &u, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}
	if len(opvoer.Vs) > 0 {
		for _, v := range opvoer.Vs {
			if err := handleOpvoerA_V(c, tx, &v, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}
	if len(opvoer.Rel_A_Bs) > 0 {
		for _, rel := range opvoer.Rel_A_Bs {
			if err := handleOpvoerRel_A_B(c, tx, &rel, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}

	return nil
}

// handleOpvoerFullA inserts Full_A entity with all its data elements
func handleOpvoerFullA(c *gin.Context, tx bun.Tx, fullA *model.Full_A, registratieID int, tijdstip time.Time) error {
	// Set opvoer tijdstip
	fullA.Opvoer = &tijdstip

	// Insert A entity
	_, err := tx.NewInsert().
		Model(fullA).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert A: %v", err)
	}

	// Create wijziging record for A
	if err := createWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID, "A", fullA.ID, tijdstip); err != nil {
		return err
	}

	// Insert U's (fill in a_id if missing)
	for i := range fullA.Us {
		if fullA.Us[i].A_ID == "" {
			fullA.Us[i].A_ID = fullA.ID
		}
		if err := handleOpvoerA_U(c, tx, &fullA.Us[i], registratieID, tijdstip); err != nil {
			return err
		}
	}

	// Insert V's (fill in a_id if missing)
	for i := range fullA.Vs {
		if fullA.Vs[i].A_ID == "" {
			fullA.Vs[i].A_ID = fullA.ID
		}
		if err := handleOpvoerA_V(c, tx, &fullA.Vs[i], registratieID, tijdstip); err != nil {
			return err
		}
	}

	// Insert Rel_A_B's (fill in a_id if missing)
	for i := range fullA.RelABs {
		if fullA.RelABs[i].A_ID == "" {
			fullA.RelABs[i].A_ID = fullA.ID
		}
		if err := handleOpvoerRel_A_B(c, tx, &fullA.RelABs[i], registratieID, tijdstip); err != nil {
			return err
		}
	}

	return nil
}

// handleOpvoerA_U inserts A_U data element
func handleOpvoerA_U(c *gin.Context, tx bun.Tx, u *model.A_U, registratieID int, tijdstip time.Time) error {
	// Set opvoer tijdstip
	u.Opvoer = &tijdstip

	_, err := tx.NewInsert().
		Model(u).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert A_U: %v", err)
	}

	// Create wijziging record
	return createWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID, "A_U", fmt.Sprintf("%d", u.Rel_ID), tijdstip)
}

// handleOpvoerA_V inserts A_V data element
func handleOpvoerA_V(c *gin.Context, tx bun.Tx, v *model.A_V, registratieID int, tijdstip time.Time) error {
	// Set opvoer tijdstip
	v.Opvoer = &tijdstip

	_, err := tx.NewInsert().
		Model(v).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert A_V: %v", err)
	}

	// Create wijziging record
	return createWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID, "A_V", fmt.Sprintf("%d", v.Rel_ID), tijdstip)
}

// handleOpvoerRel_A_B inserts Rel_A_B relation
func handleOpvoerRel_A_B(c *gin.Context, tx bun.Tx, rel *model.Rel_A_B, registratieID int, tijdstip time.Time) error {
	// Set opvoer tijdstip
	rel.Opvoer = &tijdstip

	_, err := tx.NewInsert().
		Model(rel).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert Rel_A_B: %v", err)
	}

	// Create wijziging record
	return createWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID, "Rel_A_B", fmt.Sprintf("%d", rel.ID), tijdstip)
}

// handleAfvoerA processes an afvoer for Full_A or its data elements
func handleAfvoerA(c *gin.Context, tx bun.Tx, afvoer *model.OpvoerAfvoerA, registratieID int, tijdstip time.Time) error {
	// Scenario 2: Afvoer van hele entiteit A (inclusief alle gegevenselementen)
	if afvoer.A != nil {
		return handleAfvoerFullA(c, tx, afvoer.A.ID, registratieID, tijdstip)
	}

	// Scenario 3: Afvoer van individuele gegevenselementen
	if afvoer.U != nil {
		return handleAfvoerA_U(c, tx, afvoer.U.Rel_ID, registratieID, tijdstip)
	}
	if afvoer.V != nil {
		return handleAfvoerA_V(c, tx, afvoer.V.Rel_ID, registratieID, tijdstip)
	}
	if afvoer.Rel_A_B != nil {
		return handleAfvoerRel_A_B(c, tx, afvoer.Rel_A_B.ID, registratieID, tijdstip)
	}

	// Batch afvoer
	if len(afvoer.Us) > 0 {
		for _, u := range afvoer.Us {
			if err := handleAfvoerA_U(c, tx, u.Rel_ID, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}
	if len(afvoer.Vs) > 0 {
		for _, v := range afvoer.Vs {
			if err := handleAfvoerA_V(c, tx, v.Rel_ID, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}
	if len(afvoer.Rel_A_Bs) > 0 {
		for _, rel := range afvoer.Rel_A_Bs {
			if err := handleAfvoerRel_A_B(c, tx, rel.ID, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}

	return nil
}

// handleAfvoerFullA marks A entity and all its active data elements as afgevoerd
func handleAfvoerFullA(c *gin.Context, tx bun.Tx, aID string, registratieID int, tijdstip time.Time) error {
	// Update afvoer on A
	_, err := tx.NewUpdate().
		Model((*model.A)(nil)).
		Set("afvoer = ?", tijdstip).
		Where("id = ?", aID).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to update A afvoer: %v", err)
	}

	// Create wijziging record for A
	if err := createWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID, "A", aID, tijdstip); err != nil {
		return err
	}

	// Find and afvoer all active A_U's (where afvoer IS NULL)
	var activeUs []model.A_U
	err = tx.NewSelect().
		Model(&activeUs).
		Where("a_id = ?", aID).
		Where("afvoer IS NULL").
		Scan(c.Request.Context())
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to query active A_U's: %v", err)
	}

	for _, u := range activeUs {
		if err := handleAfvoerA_U(c, tx, u.Rel_ID, registratieID, tijdstip); err != nil {
			return err
		}
	}

	// Find and afvoer all active A_V's
	var activeVs []model.A_V
	err = tx.NewSelect().
		Model(&activeVs).
		Where("a_id = ?", aID).
		Where("afvoer IS NULL").
		Scan(c.Request.Context())
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to query active A_V's: %v", err)
	}

	for _, v := range activeVs {
		if err := handleAfvoerA_V(c, tx, v.Rel_ID, registratieID, tijdstip); err != nil {
			return err
		}
	}

	// Find and afvoer all active Rel_A_B's
	var activeRels []model.Rel_A_B
	err = tx.NewSelect().
		Model(&activeRels).
		Where("a_id = ?", aID).
		Where("afvoer IS NULL").
		Scan(c.Request.Context())
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to query active Rel_A_B's: %v", err)
	}

	for _, rel := range activeRels {
		if err := handleAfvoerRel_A_B(c, tx, rel.ID, registratieID, tijdstip); err != nil {
			return err
		}
	}

	return nil
}

// handleAfvoerA_U marks A_U as afgevoerd
func handleAfvoerA_U(c *gin.Context, tx bun.Tx, relID int, registratieID int, tijdstip time.Time) error {
	// Update afvoer timestamp
	_, err := tx.NewUpdate().
		Model((*model.A_U)(nil)).
		Set("afvoer = ?", tijdstip).
		Where("rel_id = ?", relID).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to update A_U afvoer: %v", err)
	}

	// Create wijziging record
	return createWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID, "A_U", fmt.Sprintf("%d", relID), tijdstip)
}

// handleAfvoerA_V marks A_V as afgevoerd
func handleAfvoerA_V(c *gin.Context, tx bun.Tx, relID int, registratieID int, tijdstip time.Time) error {
	// Update afvoer timestamp
	_, err := tx.NewUpdate().
		Model((*model.A_V)(nil)).
		Set("afvoer = ?", tijdstip).
		Where("rel_id = ?", relID).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to update A_V afvoer: %v", err)
	}

	// Create wijziging record
	return createWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID, "A_V", fmt.Sprintf("%d", relID), tijdstip)
}

// handleAfvoerRel_A_B marks Rel_A_B as afgevoerd
func handleAfvoerRel_A_B(c *gin.Context, tx bun.Tx, id int, registratieID int, tijdstip time.Time) error {
	// Update afvoer timestamp
	_, err := tx.NewUpdate().
		Model((*model.Rel_A_B)(nil)).
		Set("afvoer = ?", tijdstip).
		Where("id = ?", id).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to update Rel_A_B afvoer: %v", err)
	}

	// Create wijziging record
	return createWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID, "Rel_A_B", fmt.Sprintf("%d", id), tijdstip)
}

// handleOpvoerB processes an opvoer for Full_B or its data elements
func handleOpvoerB(c *gin.Context, tx bun.Tx, opvoer *model.OpvoerAfvoerB, registratieID int, tijdstip time.Time) error {
	if opvoer.B != nil {
		return handleOpvoerFullB(c, tx, opvoer.B, registratieID, tijdstip)
	}

	if opvoer.X != nil {
		return handleOpvoerB_X(c, tx, opvoer.X, registratieID, tijdstip)
	}
	if opvoer.Y != nil {
		return handleOpvoerB_Y(c, tx, opvoer.Y, registratieID, tijdstip)
	}

	if len(opvoer.Xs) > 0 {
		for _, x := range opvoer.Xs {
			if err := handleOpvoerB_X(c, tx, &x, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}
	if len(opvoer.Ys) > 0 {
		for _, y := range opvoer.Ys {
			if err := handleOpvoerB_Y(c, tx, &y, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}

	return nil
}

// handleOpvoerFullB inserts Full_B entity with all its data elements
func handleOpvoerFullB(c *gin.Context, tx bun.Tx, fullB *model.Full_B, registratieID int, tijdstip time.Time) error {
	fullB.Opvoer = &tijdstip

	_, err := tx.NewInsert().
		Model(fullB).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert B: %v", err)
	}

	if err := createWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID, "B", fullB.ID, tijdstip); err != nil {
		return err
	}

	for i := range fullB.Xs {
		if fullB.Xs[i].B_ID == "" {
			fullB.Xs[i].B_ID = fullB.ID
		}
		if err := handleOpvoerB_X(c, tx, &fullB.Xs[i], registratieID, tijdstip); err != nil {
			return err
		}
	}

	for i := range fullB.Ys {
		if fullB.Ys[i].B_ID == "" {
			fullB.Ys[i].B_ID = fullB.ID
		}
		if err := handleOpvoerB_Y(c, tx, &fullB.Ys[i], registratieID, tijdstip); err != nil {
			return err
		}
	}

	return nil
}

// handleOpvoerB_X inserts B_X data element
func handleOpvoerB_X(c *gin.Context, tx bun.Tx, x *model.B_X, registratieID int, tijdstip time.Time) error {
	// Set opvoer tijdstip
	x.Opvoer = &tijdstip

	_, err := tx.NewInsert().
		Model(x).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert B_X: %v", err)
	}

	return createWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID, "B_X", fmt.Sprintf("%d", x.Rel_ID), tijdstip)
}

// handleOpvoerB_Y inserts B_Y data element
func handleOpvoerB_Y(c *gin.Context, tx bun.Tx, y *model.B_Y, registratieID int, tijdstip time.Time) error {
	// Set opvoer tijdstip
	y.Opvoer = &tijdstip

	_, err := tx.NewInsert().
		Model(y).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert B_Y: %v", err)
	}

	return createWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID, "B_Y", fmt.Sprintf("%d", y.Rel_ID), tijdstip)
}

// handleAfvoerB processes an afvoer for Full_B or its data elements
func handleAfvoerB(c *gin.Context, tx bun.Tx, afvoer *model.OpvoerAfvoerB, registratieID int, tijdstip time.Time) error {
	if afvoer.B != nil {
		return handleAfvoerFullB(c, tx, afvoer.B.ID, registratieID, tijdstip)
	}

	if afvoer.X != nil {
		return handleAfvoerB_X(c, tx, afvoer.X.Rel_ID, registratieID, tijdstip)
	}
	if afvoer.Y != nil {
		return handleAfvoerB_Y(c, tx, afvoer.Y.Rel_ID, registratieID, tijdstip)
	}

	if len(afvoer.Xs) > 0 {
		for _, x := range afvoer.Xs {
			if err := handleAfvoerB_X(c, tx, x.Rel_ID, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}
	if len(afvoer.Ys) > 0 {
		for _, y := range afvoer.Ys {
			if err := handleAfvoerB_Y(c, tx, y.Rel_ID, registratieID, tijdstip); err != nil {
				return err
			}
		}
	}

	return nil
}

// handleAfvoerFullB marks B entity and all its active data elements as afgevoerd
func handleAfvoerFullB(c *gin.Context, tx bun.Tx, bID string, registratieID int, tijdstip time.Time) error {
	_, err := tx.NewUpdate().
		Model((*model.B)(nil)).
		Set("afvoer = ?", tijdstip).
		Where("id = ?", bID).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to update B afvoer: %v", err)
	}

	if err := createWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID, "B", bID, tijdstip); err != nil {
		return err
	}

	var activeXs []model.B_X
	err = tx.NewSelect().
		Model(&activeXs).
		Where("b_id = ?", bID).
		Where("afvoer IS NULL").
		Scan(c.Request.Context())
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to query active B_X's: %v", err)
	}

	for _, x := range activeXs {
		if err := handleAfvoerB_X(c, tx, x.Rel_ID, registratieID, tijdstip); err != nil {
			return err
		}
	}

	var activeYs []model.B_Y
	err = tx.NewSelect().
		Model(&activeYs).
		Where("b_id = ?", bID).
		Where("afvoer IS NULL").
		Scan(c.Request.Context())
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to query active B_Y's: %v", err)
	}

	for _, y := range activeYs {
		if err := handleAfvoerB_Y(c, tx, y.Rel_ID, registratieID, tijdstip); err != nil {
			return err
		}
	}

	return nil
}

// handleAfvoerB_X marks B_X as afgevoerd
func handleAfvoerB_X(c *gin.Context, tx bun.Tx, relID int, registratieID int, tijdstip time.Time) error {
	// Update afvoer timestamp
	_, err := tx.NewUpdate().
		Model((*model.B_X)(nil)).
		Set("afvoer = ?", tijdstip).
		Where("rel_id = ?", relID).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to update B_X afvoer: %v", err)
	}

	return createWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID, "B_X", fmt.Sprintf("%d", relID), tijdstip)
}

// handleAfvoerB_Y marks B_Y as afgevoerd
func handleAfvoerB_Y(c *gin.Context, tx bun.Tx, relID int, registratieID int, tijdstip time.Time) error {
	// Update afvoer timestamp
	_, err := tx.NewUpdate().
		Model((*model.B_Y)(nil)).
		Set("afvoer = ?", tijdstip).
		Where("rel_id = ?", relID).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to update B_Y afvoer: %v", err)
	}

	return createWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID, "B_Y", fmt.Sprintf("%d", relID), tijdstip)
}

// createWijziging creates a Wijziging record
func createWijziging(c *gin.Context, tx bun.Tx, wijzigingstype model.WijzigingstypeEnum, registratieID int, representatienaam string, representatieID string, tijdstip time.Time) error {
	wijziging := model.Wijziging{
		Wijzigingstype:    wijzigingstype,
		RegistratieID:     registratieID,
		Representatienaam: representatienaam,
		RepresentatieID:   representatieID, // Now directly using string
		Tijdstip:          tijdstip,
	}

	_, err := tx.NewInsert().
		Model(&wijziging).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert wijziging: %v", err)
	}

	return nil
}
