package dbsetup

import (
	"context"

	"github.com/uptrace/bun"
)

// createFormeleTijdIndexes maakt indexen aan die de formele tijdreis-functie ondersteunen.
// Alle statements zijn idempotent via IF NOT EXISTS.
func createFormeleTijdIndexes(ctx context.Context, db *bun.DB) error {
	statements := []string{
		`CREATE INDEX IF NOT EXISTS idx_wijziging_formele_lookup
		 ON wijziging (entiteitnaam, entiteit_id, (COALESCE(representatienaam, '')), (COALESCE(representatie_id, '')), versie, registratie_id, id DESC);`,
		`CREATE INDEX IF NOT EXISTS idx_wijziging_registratie_id
		 ON wijziging (registratie_id, id DESC);`,
		`CREATE INDEX IF NOT EXISTS idx_registratie_ongedaan_peil
		 ON registratie (maakt_ongedaan_registratie_id, tijdstip);`,
		`CREATE INDEX IF NOT EXISTS idx_registratie_tijdstip
		 ON registratie (tijdstip, id DESC);`,
	}

	for _, stmt := range statements {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}

	return nil
}

// createFormeleTijdViews maakt de basisviews aan voor formele tijdreisquery's.
// Deze view is bewust "basis": peiltijdstip blijft een runtime-parameter in de SELECTs.
func createFormeleTijdViews(ctx context.Context, db *bun.DB) error {
	// PostgreSQL laat geen wijziging van RETURN TABLE-signature toe via
	// CREATE OR REPLACE FUNCTION. Daarom droppen we de bestaande functie
	// expliciet voordat we de nieuwe definitie aanmaken.
	const dropPeilFunction = `
DROP FUNCTION IF EXISTS f_formele_wijziging_op_peil(timestamptz);
`

	const createBasisView = `
CREATE OR REPLACE VIEW vw_formele_wijziging_basis AS
SELECT
	w.id AS wijziging_id,
	w.wijzigingstype,
	w.registratie_id,
	reg.tijdstip AS registratie_tijdstip,
	w.entiteitnaam,
	w.entiteit_id,
	COALESCE(w.representatienaam, '') AS representatienaam,
	COALESCE(w.representatie_id, '') AS representatie_id,
	w.versie
FROM wijziging AS w
JOIN registratie AS reg ON reg.id = w.registratie_id;
`

	const createPeilFunction = `
CREATE OR REPLACE FUNCTION f_formele_wijziging_op_peil(p_peiltijdstip timestamptz)
RETURNS TABLE (
	wijziging_id bigint,
	wijzigingstype text,
	registratie_id bigint,
	registratie_tijdstip timestamptz,
	entiteitnaam text,
	entiteit_id text,
	representatienaam text,
	representatie_id text,
	versie bigint
)
LANGUAGE SQL
STABLE
AS $$
	SELECT
		v.wijziging_id,
		v.wijzigingstype::text,
		v.registratie_id,
		v.registratie_tijdstip,
		v.entiteitnaam,
		v.entiteit_id,
		v.representatienaam,
		v.representatie_id,
		v.versie
	FROM vw_formele_wijziging_basis AS v
	WHERE v.registratie_tijdstip <= p_peiltijdstip
	  AND NOT EXISTS (
		SELECT 1
		FROM registratie AS om
		WHERE om.maakt_ongedaan_registratie_id = v.registratie_id
		  AND om.tijdstip <= p_peiltijdstip
	  );
$$;
`

	if _, err := db.ExecContext(ctx, createBasisView); err != nil {
		return err
	}

	if _, err := db.ExecContext(ctx, dropPeilFunction); err != nil {
		return err
	}

	if _, err := db.ExecContext(ctx, createPeilFunction); err != nil {
		return err
	}

	return nil
}
