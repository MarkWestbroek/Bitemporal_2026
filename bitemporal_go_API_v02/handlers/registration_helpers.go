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
func handleOpvoerA(c *gin.Context, tx bun.Tx, opvoer *model.OpvoerAfvoerA, registratieID int64, tijdstip time.Time) error {
	// Scenario 1: Opvoer van hele entiteit A met gegevenselementen
	if opvoer.A != nil {
		return handleOpvoerFullA(c, tx, opvoer.A, registratieID, tijdstip)
	}

	// Scenario 3: Opvoer van individuele gegevenselementen
	if opvoer.U != nil {
		return handleOpvoerElement(c, tx, opvoer.U, registratieID, tijdstip, "A_U", func(u *model.A_U, t *time.Time) {
			u.Opvoer = t
		})
	}
	if opvoer.V != nil {
		return handleOpvoerElement(c, tx, opvoer.V, registratieID, tijdstip, "A_V", func(v *model.A_V, t *time.Time) {
			v.Opvoer = t
		})
	}
	if opvoer.Rel_A_B != nil {
		return handleOpvoerElement(c, tx, opvoer.Rel_A_B, registratieID, tijdstip, "Rel_A_B", func(rel *model.Rel_A_B, t *time.Time) {
			rel.Opvoer = t
		})
	}

	// Batch opvoer
	if len(opvoer.Us) > 0 {
		for _, u := range opvoer.Us {
			if err := handleOpvoerElement(c, tx, &u, registratieID, tijdstip, "A_U", func(item *model.A_U, t *time.Time) {
				item.Opvoer = t
			}); err != nil {
				return err
			}
		}
	}
	if len(opvoer.Vs) > 0 {
		for _, v := range opvoer.Vs {
			if err := handleOpvoerElement(c, tx, &v, registratieID, tijdstip, "A_V", func(item *model.A_V, t *time.Time) {
				item.Opvoer = t
			}); err != nil {
				return err
			}
		}
	}
	if len(opvoer.Rel_A_Bs) > 0 {
		for _, rel := range opvoer.Rel_A_Bs {
			if err := handleOpvoerElement(c, tx, &rel, registratieID, tijdstip, "Rel_A_B", func(item *model.Rel_A_B, t *time.Time) {
				item.Opvoer = t
			}); err != nil {
				return err
			}
		}
	}

	return nil
}

// handleOpvoerFullA inserts Full_A entity with all its data elements
func handleOpvoerFullA(c *gin.Context, tx bun.Tx, fullA *model.Full_A, registratieID int64, tijdstip time.Time) error {
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
		if err := handleOpvoerElement(c, tx, &fullA.Us[i], registratieID, tijdstip, "A_U", func(item *model.A_U, t *time.Time) {
			item.Opvoer = t
		}); err != nil {
			return err
		}
	}

	// Insert V's (fill in a_id if missing)
	for i := range fullA.Vs {
		if fullA.Vs[i].A_ID == "" {
			fullA.Vs[i].A_ID = fullA.ID
		}
		if err := handleOpvoerElement(c, tx, &fullA.Vs[i], registratieID, tijdstip, "A_V", func(item *model.A_V, t *time.Time) {
			item.Opvoer = t
		}); err != nil {
			return err
		}
	}

	// Insert Rel_A_B's (fill in a_id if missing)
	for i := range fullA.RelABs {
		if fullA.RelABs[i].A_ID == "" {
			fullA.RelABs[i].A_ID = fullA.ID
		}
		if err := handleOpvoerElement(c, tx, &fullA.RelABs[i], registratieID, tijdstip, "Rel_A_B", func(item *model.Rel_A_B, t *time.Time) {
			item.Opvoer = t
		}); err != nil {
			return err
		}
	}

	return nil
}

// handleOpvoerElement inserts an opvoer entity and creates a wijziging record.
func handleOpvoerElement[T model.HasID](c *gin.Context, tx bun.Tx, element *T, registratieID int64, tijdstip time.Time, representatienaam string, setOpvoer func(*T, *time.Time)) error {
	setOpvoer(element, &tijdstip)

	_, err := tx.NewInsert().
		Model(element).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert %s: %v", representatienaam, err)
	}

	return createWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID, representatienaam, (*element).GetID(), tijdstip)
}

// handleAfvoerA processes an afvoer for Full_A or its data elements
func handleAfvoerA(c *gin.Context, tx bun.Tx, afvoer *model.OpvoerAfvoerA, registratieID int64, tijdstip time.Time) error {
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
func handleAfvoerFullA(c *gin.Context, tx bun.Tx, aID string, registratieID int64, tijdstip time.Time) error {
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
func handleAfvoerA_U(c *gin.Context, tx bun.Tx, relID int, registratieID int64, tijdstip time.Time) error {
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
func handleAfvoerA_V(c *gin.Context, tx bun.Tx, relID int, registratieID int64, tijdstip time.Time) error {
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
func handleAfvoerRel_A_B(c *gin.Context, tx bun.Tx, id int, registratieID int64, tijdstip time.Time) error {
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
func handleOpvoerB(c *gin.Context, tx bun.Tx, opvoer *model.OpvoerAfvoerB, registratieID int64, tijdstip time.Time) error {
	if opvoer.B != nil {
		return handleOpvoerFullB(c, tx, opvoer.B, registratieID, tijdstip)
	}

	if opvoer.X != nil {
		return handleOpvoerElement(c, tx, opvoer.X, registratieID, tijdstip, "B_X", func(x *model.B_X, t *time.Time) {
			x.Opvoer = t
		})
	}
	if opvoer.Y != nil {
		return handleOpvoerElement(c, tx, opvoer.Y, registratieID, tijdstip, "B_Y", func(y *model.B_Y, t *time.Time) {
			y.Opvoer = t
		})
	}

	if len(opvoer.Xs) > 0 {
		for _, x := range opvoer.Xs {
			if err := handleOpvoerElement(c, tx, &x, registratieID, tijdstip, "B_X", func(item *model.B_X, t *time.Time) {
				item.Opvoer = t
			}); err != nil {
				return err
			}
		}
	}
	if len(opvoer.Ys) > 0 {
		for _, y := range opvoer.Ys {
			if err := handleOpvoerElement(c, tx, &y, registratieID, tijdstip, "B_Y", func(item *model.B_Y, t *time.Time) {
				item.Opvoer = t
			}); err != nil {
				return err
			}
		}
	}

	return nil
}

// handleOpvoerFullB inserts Full_B entity with all its data elements
func handleOpvoerFullB(c *gin.Context, tx bun.Tx, fullB *model.Full_B, registratieID int64, tijdstip time.Time) error {
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
		if err := handleOpvoerElement(c, tx, &fullB.Xs[i], registratieID, tijdstip, "B_X", func(item *model.B_X, t *time.Time) {
			item.Opvoer = t
		}); err != nil {
			return err
		}
	}

	for i := range fullB.Ys {
		if fullB.Ys[i].B_ID == "" {
			fullB.Ys[i].B_ID = fullB.ID
		}
		if err := handleOpvoerElement(c, tx, &fullB.Ys[i], registratieID, tijdstip, "B_Y", func(item *model.B_Y, t *time.Time) {
			item.Opvoer = t
		}); err != nil {
			return err
		}
	}

	return nil
}

// handleAfvoerB processes an afvoer for Full_B or its data elements
func handleAfvoerB(c *gin.Context, tx bun.Tx, afvoer *model.OpvoerAfvoerB, registratieID int64, tijdstip time.Time) error {
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
func handleAfvoerFullB(c *gin.Context, tx bun.Tx, bID string, registratieID int64, tijdstip time.Time) error {
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
func handleAfvoerB_X(c *gin.Context, tx bun.Tx, relID int, registratieID int64, tijdstip time.Time) error {
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
func handleAfvoerB_Y(c *gin.Context, tx bun.Tx, relID int, registratieID int64, tijdstip time.Time) error {
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
func createWijziging(c *gin.Context, tx bun.Tx, wijzigingstype model.WijzigingstypeEnum, registratieID int64, representatienaam string, representatieID string, tijdstip time.Time) error {
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
