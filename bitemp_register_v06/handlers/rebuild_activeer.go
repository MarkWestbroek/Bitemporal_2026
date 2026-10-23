package handlers

// rebuild_activeer.go — na een geslaagde /admin/rebuild de gebouwde versie actief maken.
//
// Besluit Mark 23-10-2026: de actieve schema-versie is de bron van waarheid voor de
// startup-rebuild (rebuild_core.go). Een rebuild uit de editor-inhoud (Studio: Publiceer +
// Rebuild) sloeg het model alleen op als `proposed`; zonder aparte activering zette een herstart
// van de container de code terug naar de laatst geactiveerde versie. Daarom slaat de rebuild het
// gebouwde model nu zelf op als `active` (en archiveert de vorige actieve), of activeert de
// schema-versie waaruit hij gebouwd heeft.

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// activeerGebouwdModel maakt na een geslaagde rebuild de gebouwde versie actief.
//   - bestaandID != nil: die schema_versies-rij activeren (was proposed of archived).
//   - anders: modelBytes opslaan als nieuwe rij met status active (bron "rebuild").
//
// De vorige actieve versie wordt gearchiveerd. Geeft een melding voor de stappenlijst.
func activeerGebouwdModel(ctx context.Context, modelBytes []byte, bestaandID *int64, indiener string) (string, error) {
	if DB == nil {
		return "", fmt.Errorf("database niet geïnitialiseerd")
	}
	tx, err := DB.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("kan transactie niet starten: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	if _, err := tx.NewUpdate().
		Model((*model.SchemaVersie)(nil)).
		Set("status = ?", model.SchemaVersieStatusArchived).
		Where("status = ?", model.SchemaVersieStatusActive).
		Exec(ctx); err != nil {
		return "", fmt.Errorf("kan actieve versie niet archiveren: %w", err)
	}

	var melding string
	if bestaandID != nil {
		res, err := tx.NewUpdate().
			Model((*model.SchemaVersie)(nil)).
			Set("status = ?", model.SchemaVersieStatusActive).
			Where("id = ?", *bestaandID).
			Exec(ctx)
		if err != nil {
			return "", fmt.Errorf("kan schema-versie %d niet activeren: %w", *bestaandID, err)
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return "", fmt.Errorf("schema-versie %d niet gevonden", *bestaandID)
		}
		melding = fmt.Sprintf("Schema-versie %d geactiveerd (gebouwde code = actieve versie)", *bestaandID)
	} else {
		var v3 model.V3Model
		_ = json.Unmarshal(modelBytes, &v3) // alleen voor de metadata; het model is al gevalideerd door codegen
		versie := model.SchemaVersie{
			SchemaJSON:        json.RawMessage(modelBytes),
			Bron:              "rebuild",
			Indiener:          indiener,
			ModelNaam:         v3.Naam,
			ModelBeschrijving: v3.Beschrijving,
			ModelVersie:       v3.Versie,
			Status:            model.SchemaVersieStatusActive,
			Opmerking:         "Opgeslagen en geactiveerd door /admin/rebuild",
		}
		if _, err := tx.NewInsert().Model(&versie).Returning("*").Exec(ctx); err != nil {
			return "", fmt.Errorf("kan gebouwd model niet opslaan als schema-versie: %w", err)
		}
		melding = fmt.Sprintf("Gebouwd model opgeslagen als schema-versie %d en geactiveerd", versie.ID)
	}
	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("kan transactie niet committen: %w", err)
	}
	return melding, nil
}

// laatsteSchemaVersieIDOpStatus geeft het id van de nieuwste schema-versie met deze status.
func laatsteSchemaVersieIDOpStatus(ctx context.Context, status model.SchemaVersieStatus) (*int64, error) {
	var versie model.SchemaVersie
	if err := DB.NewSelect().Model(&versie).Column("id").
		Where("status = ?", status).OrderExpr("id DESC").Limit(1).Scan(ctx); err != nil {
		return nil, err
	}
	return &versie.ID, nil
}
