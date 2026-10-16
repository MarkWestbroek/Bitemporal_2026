package model

import (
	"time"

	"github.com/uptrace/bun"
)

// StudioGedeeldBeeld: een diagram als PNG op een openbaar, onraadbaar adres, om in Confluence,
// Teams of een wiki op te nemen als gewone <img>-link (Mark, 16-10-2026: Confluence laat
// ingebedde data-URI-plaatjes weg, maar toont een extern plaatje wél, en houdt het als link).
//
//   - soort "momentopname": vast plaatje; een nieuwe kopie met een ander beeld krijgt een nieuw adres.
//   - soort "actueel": één adres per diagram; Studio zet er een nieuw plaatje op als het diagram
//     verandert, en wie de pagina bekijkt ziet het nieuwe plaatje.
//
// Het token is de toegang (capability-URL): wie het adres kent, ziet dat ene plaatje en niets
// anders van het project. Intrekken = het adres geeft voortaan 404. De PNG maakt Studio zelf
// (dezelfde tekenaar als de documenten); de server bewaart en serveert alleen.
//
// Opslag zoals de bijlagen van meldingen: in MinIO (`object_key` = beelden/<token>.png) als de
// filestore beschikbaar is, anders in de kolom `inhoud`. Geen versies: een actueel plaatje
// overschrijft het vorige onder dezelfde sleutel.
//
// Plumbing, net als studio_projecten (geen bitemporele registratie).
type StudioGedeeldBeeld struct {
	bun.BaseModel `bun:"table:studio_gedeeld_beeld"`
	Token         string     `json:"token" bun:"token,pk"`
	ProjectID     string     `json:"project_id" bun:"project_id,notnull"`
	ProfielID     string     `json:"profiel_id" bun:"profiel_id,notnull"`
	DiagramID     string     `json:"diagram_id" bun:"diagram_id,notnull"`
	DiagramNaam   string     `json:"diagram_naam" bun:"diagram_naam"`
	Soort         string     `json:"soort" bun:"soort,notnull"` // momentopname | actueel
	Mediatype     string     `json:"mediatype" bun:"mediatype,notnull"`
	Hash          string     `json:"hash" bun:"hash,notnull"` // sha256 van de inhoud (ETag, en hergebruik van een momentopname)
	Grootte       int64      `json:"grootte" bun:"grootte,notnull"`
	Breedte       int        `json:"breedte" bun:"breedte"`
	Hoogte        int        `json:"hoogte" bun:"hoogte"`
	ObjectKey     string     `json:"-" bun:"object_key"`        // MinIO; leeg = inhoud staat in de kolom
	Inhoud        []byte     `json:"-" bun:"inhoud,type:bytea"` // alleen zonder MinIO
	Aangemaakt    time.Time  `json:"aangemaakt" bun:"aangemaakt,notnull,default:current_timestamp"`
	Bijgewerkt    time.Time  `json:"bijgewerkt" bun:"bijgewerkt,notnull,default:current_timestamp"`
	Door          string     `json:"door" bun:"door"`
	IngetrokkenOp *time.Time `json:"ingetrokken_op,omitempty" bun:"ingetrokken_op"`
}
