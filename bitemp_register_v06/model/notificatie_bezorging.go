package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// NotificatieBezorging is het bezorglog van notificaties (plumbing, geen registerdata):
// per gebeurtenis × abonnee × poging één regel — auditlog en bewijs van ontvangst
// (NORA/FDS functie 9 "traceerbaarheid"), en de basis voor heruitzending (functie 8).
// Zie docs/plans/2026-09-25 Notificeren en dashboards.
type NotificatieBezorging struct {
	bun.BaseModel `bun:"table:notificatie_bezorging"`
	ID            int64           `json:"id" bun:"id,pk,autoincrement"`
	GebeurtenisID string          `json:"gebeurtenis_id" bun:"gebeurtenis_id"`     // CloudEvents id (reg-<registratie>-w<n>)
	RegistratieID int64           `json:"registratie_id" bun:"registratie_id"`
	Type          string          `json:"type" bun:"type"`                         // CloudEvents type
	DefinitieID   int             `json:"definitie_id" bun:"definitie_id"`         // NotificatieDefinitie.id
	Kanaal        string          `json:"kanaal" bun:"kanaal"`                     // email | webhook
	Adres         string          `json:"adres" bun:"adres"`
	Poging        int             `json:"poging" bun:"poging"`
	Tijdstip      time.Time       `json:"tijdstip" bun:"tijdstip"`
	Status        string          `json:"status" bun:"status"`                     // bezorgd | mislukt | opgegeven
	HTTPStatus    *int            `json:"http_status,omitempty" bun:"http_status,nullzero"`
	Fout          *string         `json:"fout,omitempty" bun:"fout,nullzero"`
	Bericht       json.RawMessage `json:"bericht,omitempty" bun:"bericht,type:jsonb,nullzero"` // het CloudEvents-bericht (informatiearm)
}
