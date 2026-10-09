package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// StudioProjectOp is één operatie op een Studio-project in het logboek
// `studio_project_ops` (plan 2026-10-07 Projectsync, stap 2, onderdeel 3).
//
// De Studio legt elke modelwijziging vast als `{store, op, args}` (zie
// web/vite/src/studio/sync/operaties.js) en stuurt die in batches op. De server
// kent per project een oplopend `volgnummer` toe, bewaart de operatie als JSON en
// (onderdeel 5) zendt hem door naar de andere clients. De server kijkt niet in de
// operatie: hij is een logboek, de clients passen toe. Compactie (onderdeel 6):
// de snapshot in `studio_projecten.tot_volgnummer` zegt tot waar de blob geldt;
// oudere operaties kunnen weg.
type StudioProjectOp struct {
	bun.BaseModel `bun:"table:studio_project_ops"`
	ProjectID     string          `json:"project_id" bun:"project_id,pk"`
	Volgnummer    int64           `json:"volgnummer" bun:"volgnummer,pk"`
	ClientID      string          `json:"client_id" bun:"client_id"` // browsertab die hem maakte (echo-filter)
	Actor         string          `json:"actor" bun:"actor"`         // gebruikersnaam (leeg zonder auth)
	LokaalNr      int64           `json:"lokaal_nr" bun:"lokaal_nr"` // nummer in de outbox van de client (bevestiging)
	Tijd          time.Time       `json:"tijd" bun:"tijd,default:current_timestamp"`
	Store         string          `json:"store" bun:"store,notnull"`          // "model:<profielId>" | "structuur" | "kruis"
	Op            string          `json:"op" bun:"op,notnull"`                // actienaam, bv. updateNodePosition
	Args          json.RawMessage `json:"args" bun:"args,type:jsonb,notnull"` // argumenten (JSON-array)
}
