package facade

// idmap_pg.go — de IDMap in de façade-database (technisch ontwerp fase 1 §6).
//
// Eén tabel facade_id met een gedeelde bigserial: id's zijn uniek over alle soorten heen, en
// niet aaneengesloten per soort (dat hoeft niet). Toekennen gebeurt met INSERT … ON CONFLICT,
// dus twee verzoeken die tegelijk dezelfde uuid zien, krijgen hetzelfde id. Een cache in het
// geheugen bespaart de database bij herhaald lezen; de tabel blijft de waarheid.

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/uptrace/bun"
)

// PGIDMap is de IDMap op PostgreSQL.
type PGIDMap struct {
	db    bun.IDB
	heen  sync.Map // soort|register|uuid → int
	terug sync.Map // soort|id → [2]string{register, uuid}
}

// NieuwePGIDMap maakt de tabel aan als die er nog niet is.
func NieuwePGIDMap(ctx context.Context, db bun.IDB) (*PGIDMap, error) {
	_, err := db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS facade_id (
	id       bigserial PRIMARY KEY,
	soort    text NOT NULL,
	register text NOT NULL,
	uuid     uuid NOT NULL,
	gezien   timestamptz NOT NULL DEFAULT now(),
	UNIQUE (soort, register, uuid)
);
COMMENT ON TABLE facade_id IS 'Façade: Omnium-id per (soort, register, uuid); zie docs/plans/2026-11-18 Façade fase 1 §6';`)
	if err != nil {
		return nil, fmt.Errorf("facade_id aanmaken: %w", err)
	}
	return &PGIDMap{db: db}, nil
}

func (m *PGIDMap) ID(ctx context.Context, register, soort, uuid string) (int, error) {
	if register == "" || soort == "" || uuid == "" {
		return 0, fmt.Errorf("idmap: register, soort en uuid zijn verplicht (%q, %q, %q)", register, soort, uuid)
	}
	uuid = strings.ToLower(uuid)
	sleutel := soort + "|" + register + "|" + uuid
	if v, ok := m.heen.Load(sleutel); ok {
		return v.(int), nil
	}
	var id int64
	// DO UPDATE (zonder echte wijziging) zodat RETURNING ook bij een bestaande rij het id geeft.
	err := m.db.NewRaw(`
INSERT INTO facade_id (soort, register, uuid) VALUES (?, ?, ?)
ON CONFLICT (soort, register, uuid) DO UPDATE SET soort = EXCLUDED.soort
RETURNING id`, soort, register, uuid).Scan(ctx, &id)
	if err != nil {
		return 0, fmt.Errorf("idmap: id toekennen: %w", err)
	}
	m.onthoud(soort, register, uuid, int(id))
	return int(id), nil
}

func (m *PGIDMap) UUID(ctx context.Context, soort string, id int) (string, string, bool, error) {
	if v, ok := m.terug.Load(fmt.Sprintf("%s|%d", soort, id)); ok {
		t := v.([2]string)
		return t[0], t[1], true, nil
	}
	var rij struct {
		Register string `bun:"register"`
		UUID     string `bun:"uuid"`
	}
	err := m.db.NewRaw(`SELECT register, uuid::text AS uuid FROM facade_id WHERE soort = ? AND id = ?`, soort, id).Scan(ctx, &rij)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, fmt.Errorf("idmap: uuid zoeken: %w", err)
	}
	m.onthoud(soort, rij.Register, rij.UUID, id)
	return rij.Register, rij.UUID, true, nil
}

func (m *PGIDMap) onthoud(soort, register, uuid string, id int) {
	m.heen.Store(soort+"|"+register+"|"+uuid, id)
	m.terug.Store(fmt.Sprintf("%s|%d", soort, id), [2]string{register, uuid})
}
