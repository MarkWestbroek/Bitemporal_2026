package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// StudioProjectUitgave is een **uitgebrachte versie** van een centraal project: de profielen
// (soort "profielen", het profielen- en transformatieproject) of de weergaven (soort
// "weergaven"). Plan "Sidecar-project" §8, stap 5; besluiten Mark 22-11: de centrale is app,
// andere instanties lezen met een leestoken, een release pint de versies exact vast.
//
// Onveranderlijk: eenmaal uitgebracht wordt een rij nooit gewijzigd of verwijderd (ook niet als
// het project verdwijnt), zodat een release die hem vastpint hem altijd terugkrijgt.
//
// Ouders (stap 10, besluit Mark 22-11: een graaf van versies, liefst lineair, met forks en
// terugmergen) worden vanaf de eerste versie bewaard: één bij een gewone opvolger, twee bij een
// merge, geen bij de eerste.
//
// Bron: leeg = hier uitgebracht; anders het adres van de centrale waarvan deze instantie (een
// spiegel) de versie heeft opgehaald (handlers/studio_centraal.go).
type StudioProjectUitgave struct {
	bun.BaseModel   `bun:"table:studio_project_uitgaven"`
	Soort           string          `json:"soort" bun:"soort,pk"`   // profielen | weergaven
	Versie          string          `json:"versie" bun:"versie,pk"` // semver X.Y.Z, uniek per soort
	ProjectID       string          `json:"projectId" bun:"project_id,notnull"`
	ProjectNaam     string          `json:"projectNaam" bun:"project_naam"`
	Ouders          json.RawMessage `json:"ouders" bun:"ouders,type:jsonb,notnull"` // [{"versie":"0.1.0"}], oudste eerst
	TotVolgnummer   int64           `json:"totVolgnummer" bun:"tot_volgnummer,notnull,default:0"`
	Notitie         string          `json:"notitie,omitempty" bun:"notitie"`
	Inhoud          json.RawMessage `json:"inhoud,omitempty" bun:"inhoud,type:jsonb,notnull"` // het werkbestand (studio-project)
	Grootte         int64           `json:"grootte" bun:"grootte,notnull,default:0"`
	Uitgebracht     time.Time       `json:"uitgebracht" bun:"uitgebracht,notnull,default:current_timestamp"`
	UitgebrachtDoor string          `json:"uitgebrachtDoor" bun:"uitgebracht_door"`
	Bron            string          `json:"bron,omitempty" bun:"bron"`
}
