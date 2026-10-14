package model

import (
	"time"

	"github.com/uptrace/bun"
)

// MeldingBestand: een bijlage bij een melding (schermafbeelding, document). Plumbing, net als
// gebruiker_inlog: het bestand zelf hoort niet in de geschiedenis. MeldingBijlage.bestand (domein
// meldingen, datatype Bestand) verwijst ernaar met de UUID. Inhoud in MinIO (ObjectKey) als
// die er is, anders hier in de database (Inhoud). Zie package meldingen.
type MeldingBestand struct {
	bun.BaseModel `bun:"table:melding_bestand"`
	ID            string    `json:"id" bun:"id,pk"` // UUID
	Naam          string    `json:"naam" bun:"naam,notnull"`
	Mediatype     string    `json:"mediatype" bun:"mediatype,notnull"`
	Grootte       int64     `json:"grootte" bun:"grootte,notnull"`
	ObjectKey     string    `json:"-" bun:"object_key"`
	Inhoud        []byte    `json:"-" bun:"inhoud,type:bytea"`
	Aangemaakt    time.Time `json:"aangemaakt" bun:"aangemaakt,notnull,default:current_timestamp"`
	Door          string    `json:"door" bun:"door"`
}
