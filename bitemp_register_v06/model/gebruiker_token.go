package model

import (
	"time"

	"github.com/uptrace/bun"
)

// GebruikerToken: een persoonlijk API-token (AI-1, 14-10-2026), bv. voor de Omnium-MCP-server of
// een script. Het token werkt als de gebruiker zelf: dezelfde rol en rechten, per verzoek uit het
// register gelezen. Alleen de sha256 staat hier; het token zelf ziet de gebruiker één keer.
// Plumbing, zoals gebruiker_inlog: hoort niet in de geschiedenis.
type GebruikerToken struct {
	bun.BaseModel  `bun:"table:gebruiker_token"`
	ID             int64      `json:"id" bun:"id,pk,autoincrement"`
	Gebruikersnaam string     `json:"gebruikersnaam" bun:"gebruikersnaam,notnull"`
	Naam           string     `json:"naam" bun:"naam,notnull"`   // waarvoor, bv. "MCP op mijn laptop"
	Begin          string     `json:"begin" bun:"begin,notnull"` // eerste tekens, om hem te herkennen
	TokenHash      string     `json:"-" bun:"token_hash,notnull,unique"`
	Aangemaakt     time.Time  `json:"aangemaakt" bun:"aangemaakt,notnull,default:current_timestamp"`
	Verloopt       *time.Time `json:"verloopt,omitempty" bun:"verloopt"`
	LaatstGebruikt *time.Time `json:"laatst_gebruikt,omitempty" bun:"laatst_gebruikt"`
	IngetrokkenOp  *time.Time `json:"ingetrokken_op,omitempty" bun:"ingetrokken_op"`
}
