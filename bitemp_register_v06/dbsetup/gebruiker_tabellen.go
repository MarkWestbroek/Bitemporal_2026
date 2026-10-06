package dbsetup

// gebruiker_tabellen.go — tabellen rond het gebruikersbeheer (docs/plans/gebruikersbeheer/).
//
// Tot oktober 2026 was `gebruiker` een platte plumbing-tabel (hash, rol, actief). Nu is
// Gebruiker een gegenereerde bitemporele entiteit (domein beheer) en heet de hub-tabel ook
// `gebruiker`. Daarom wordt de oude tabel vóór createModelTables hernoemd naar
// `gebruiker_oud`; handlers.MigreerOudeGebruikers zet de rijen daarna eenmalig over.

import (
	"context"
	"fmt"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
)

// hernoemOudeGebruikerTabel hernoemt de platte tabel `gebruiker` naar `gebruiker_oud` als
// die nog de oude vorm heeft (kolom wachtwoord_hash). Idempotent: na de eerste keer is
// `gebruiker` de hub en gebeurt er niets meer.
func hernoemOudeGebruikerTabel(ctx context.Context, db *bun.DB) error {
	var oudeVorm bool
	err := db.NewRaw(`SELECT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'gebruiker' AND column_name = 'wachtwoord_hash')`).
		Scan(ctx, &oudeVorm)
	if err != nil {
		return fmt.Errorf("controle oude gebruiker-tabel: %w", err)
	}
	if !oudeVorm {
		return nil
	}
	var oudBestaat bool
	if err := db.NewRaw(`SELECT to_regclass('gebruiker_oud') IS NOT NULL`).Scan(ctx, &oudBestaat); err != nil {
		return err
	}
	if oudBestaat {
		return fmt.Errorf("tabel gebruiker heeft nog de oude vorm, maar gebruiker_oud bestaat al; los dit met de hand op")
	}
	if _, err := db.ExecContext(ctx, `ALTER TABLE gebruiker RENAME TO gebruiker_oud`); err != nil {
		return fmt.Errorf("hernoemen gebruiker → gebruiker_oud: %w", err)
	}
	// De unieke index/constraint heet nog naar de oude tabel; dat botst niet met de hub,
	// maar hernoem hem voor de duidelijkheid als hij bestaat.
	_, _ = db.ExecContext(ctx, `ALTER TABLE gebruiker_oud RENAME CONSTRAINT gebruiker_pkey TO gebruiker_oud_pkey`)
	_, _ = db.ExecContext(ctx, `ALTER TABLE gebruiker_oud RENAME CONSTRAINT gebruiker_gebruikersnaam_key TO gebruiker_oud_gebruikersnaam_key`)
	fmt.Println("gebruikersbeheer: oude tabel gebruiker hernoemd naar gebruiker_oud (wordt bij de opstart overgezet)")
	return nil
}

// maakGebruikerInlogTabel maakt gebruiker_inlog aan, met een verwijzing naar de hub.
func maakGebruikerInlogTabel(ctx context.Context, db *bun.DB) error {
	if _, err := db.NewCreateTable().Model((*model.GebruikerInlog)(nil)).IfNotExists().Exec(ctx); err != nil {
		return err
	}
	_, err := db.ExecContext(ctx, `DO $$ BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gebruiker_inlog_gebruiker_fk') THEN
			ALTER TABLE gebruiker_inlog ADD CONSTRAINT gebruiker_inlog_gebruiker_fk
				FOREIGN KEY (gebruiker_id) REFERENCES gebruiker(id);
		END IF;
	END $$;`)
	return err
}
