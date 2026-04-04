package model

import (
	"time"

	"github.com/uptrace/bun"
)

// SchemaDomein slaat een geregistreerd modeldomein op.
// Domeinen groeperen types (entiteiten, enums, datatypes) in een register.
// Default domein is "register", maar extra domeinen kunnen worden aangemaakt
// via de API of automatisch bij het publiceren van een schema.
type SchemaDomein struct {
	bun.BaseModel `bun:"table:schema_domeinen"`
	Naam          string    `json:"naam" bun:"naam,pk"`
	Beschrijving  string    `json:"beschrijving,omitempty" bun:"beschrijving"`
	Aangemaakt    time.Time `json:"aangemaakt" bun:"aangemaakt,default:current_timestamp"`
}
