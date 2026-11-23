package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// StudioKlantAanpassing is een vastgelegde versie van een **klantaanpassing**: de delta van een
// klant op een uitgebrachte versie van een centraal project (plan "Sidecar-project" §10, stap 8;
// besluit Mark 22-11). We bewaren alleen de delta, met de basisversie waarop hij gemaakt is; de
// klantversie is basis + delta (web/vite/src/studio/takken/klantDelta.js).
//
// Onveranderlijk, zoals een uitgave: een nieuwe stand (ook dezelfde delta op een nieuwe
// basisversie) is een nieuwe versie, met de vorige als ouder. Zo heeft de delta een eigen
// versie en historie.
type StudioKlantAanpassing struct {
	bun.BaseModel  `bun:"table:studio_klant_aanpassingen"`
	Klant          string          `json:"klant" bun:"klant,pk"`   // korte naam, bv. "gemeente-x"
	Soort          string          `json:"soort" bun:"soort,pk"`   // profielen | weergaven
	Versie         string          `json:"versie" bun:"versie,pk"` // semver van de aanpassing zelf
	BasisVersie    string          `json:"basisVersie" bun:"basis_versie,notnull"`
	Delta          json.RawMessage `json:"delta,omitempty" bun:"delta,type:jsonb,notnull"`
	Eenheden       int             `json:"eenheden" bun:"eenheden,notnull"` // aantal eenheden in de delta
	Ouders         json.RawMessage `json:"ouders" bun:"ouders,type:jsonb,notnull"`
	Notitie        string          `json:"notitie,omitempty" bun:"notitie"`
	Vastgelegd     time.Time       `json:"vastgelegd" bun:"vastgelegd,notnull,default:current_timestamp"`
	VastgelegdDoor string          `json:"vastgelegdDoor" bun:"vastgelegd_door"`
}
