package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// Melding — Een bug, wens of vraag over Omnium, gemeld vanuit de tool (Help → Melden, of Alt-klik + kader). De melder ziet de eigen meldingen en hun status; een beheerder ziet en behandelt alle. Formeel: wie meldde en wanneer staat in de registratie.
type Melding struct {
	bun.BaseModel       `bun:"table:melding,alias:melding"`
	ID                  int                         `json:"id" bun:"id,pk"`
	Opvoer              *time.Time                  `json:"opvoer,omitempty"`
	Afvoer              *time.Time                  `json:"afvoer,omitempty"`
	MeldingInhouden     []Melding_MeldingInhoud     `bun:"rel:has-many,join:id=melding_id" json:"melding_inhouden,omitempty"`
	MeldingContexten    []Melding_MeldingContext    `bun:"rel:has-many,join:id=melding_id" json:"melding_contexten,omitempty"`
	MeldingBijlagen     []Melding_MeldingBijlage    `bun:"rel:has-many,join:id=melding_id" json:"melding_bijlagen,omitempty"`
	MeldingStatussen    []Melding_MeldingStatus     `bun:"rel:has-many,join:id=melding_id" json:"melding_statussen,omitempty"`
	MeldingPrioriteiten []Melding_MeldingPrioriteit `bun:"rel:has-many,join:id=melding_id" json:"melding_prioriteiten,omitempty"`
	MeldingReacties     []Melding_MeldingReactie    `bun:"rel:has-many,join:id=melding_id" json:"melding_reacties,omitempty"`
	MeldingMelders      []MeldingMelder             `bun:"rel:has-many,join:id=melding_id" json:"melding_melders,omitempty"`
	MeldingBehandelaars []MeldingBehandelaar        `bun:"rel:has-many,join:id=melding_id" json:"melding_behandelaars,omitempty"`
}
