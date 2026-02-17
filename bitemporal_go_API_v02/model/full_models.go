package model

import (
	"time"

	"github.com/uptrace/bun"
)

// GetID methods
func (a Full_A) GetID() any { return a.ID }
func (b Full_B) GetID() any { return b.ID }

// Request structs voor bitemporal registration
// RegisterRequestA is het request format voor POST /registreer/as
type RegisterRequestA struct {
	Registratie Registratie   `json:"registratie"`
	Wijzigingen []A_Wijziging `json:"wijzigingen"`
}

// A_Wijziging represents either an opvoer or afvoer for Full_A or its data elements
// Opvoer/Afvoer kan bevatten:
// 1. Volledige Full_A (met Us, Vs) - voor opvoer/afvoer van hele entiteit
// 2. Alleen Full_A.ID - voor afvoer van hele entiteit inclusief gegevenselementen
// 3. Individuele gegevenselementen (U, V) - voor wijzigingen op gegevenselement niveau
type A_Wijziging struct {
	Opvoer *OpvoerAfvoerA `json:"opvoer,omitempty"`
	Afvoer *OpvoerAfvoerA `json:"afvoer,omitempty"`
}

// OpvoerAfvoerA can contain either a full entity or individual data elements
type OpvoerAfvoerA struct {
	// Voor opvoer/afvoer van hele entiteit A
	A *Full_A `json:"a,omitempty"`

	// Voor opvoer/afvoer van individuele gegevenselementen
	U *A_U `json:"u,omitempty"`
	V *A_V `json:"v,omitempty"`

	// Voor opvoer/afvoer van relaties
	Rel_A_B *Rel_A_B `json:"rel_a_b,omitempty"`

	// Voor batch opvoer/afvoer van meerdere gegevenselementen van hetzelfde type
	Us []A_U `json:"us,omitempty"`
	Vs []A_V `json:"vs,omitempty"`

	// Voor batch opvoer/afvoer van meerdere relaties
	Rel_A_Bs []Rel_A_B `json:"rel_a_bs,omitempty"`
}

// RegisterRequestB is het request format voor POST /registreer/bs
type RegisterRequestB struct {
	Registratie Registratie   `json:"registratie"`
	Wijzigingen []B_Wijziging `json:"wijzigingen"`
}

// B_Wijziging represents either an opvoer or afvoer for Full_B or its data elements
// Opvoer/Afvoer kan bevatten:
// 1. Volledige Full_B (met Xs, Ys) - voor opvoer/afvoer van hele entiteit
// 2. Alleen Full_B.ID - voor afvoer van hele entiteit inclusief gegevenselementen
// 3. Individuele gegevenselementen (X, Y) - voor wijzigingen op gegevenselement niveau
type B_Wijziging struct {
	Opvoer *OpvoerAfvoerB `json:"opvoer,omitempty"`
	Afvoer *OpvoerAfvoerB `json:"afvoer,omitempty"`
}

// OpvoerAfvoerB can contain either a full entity or individual data elements
type OpvoerAfvoerB struct {
	// Voor opvoer/afvoer van hele entiteit B
	B *Full_B `json:"b,omitempty"`

	// Voor opvoer/afvoer van individuele gegevenselementen
	X *B_X `json:"x,omitempty"`
	Y *B_Y `json:"y,omitempty"`

	// Voor batch opvoer/afvoer van meerdere gegevenselementen van hetzelfde type
	Xs []B_X `json:"xs,omitempty"`
	Ys []B_Y `json:"ys,omitempty"`
}

// Full entity structs
// Entiteiten

/* TODO:
- Add U to FullA
- Add Rel_AB to FullA
*/
// Full_A includes all fields of A and its related entities (like Vs)
type Full_A struct {
	bun.BaseModel `bun:"table:a,alias:a"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer
	//Aanvang *time.Time `json:"aanvang,omitempty"` // afgeleid van A_Aanvang
	//Einde   *time.Time `json:"einde,omitempty"`   // afgeleid van A_Einde

	// De U's behorende bij A, 1-1 op enig moment (enkelvoudig: todo tag)
	Us []A_U `bun:"rel:has-many,join:id=a_id"`

	/*
		De relatie: 'has-many' vertelt Bun dat er meerdere V 's bij deze A horen.
		Deze relatie is meervoudig op enig moment.
		Ik mweet nog niet hoe dat in bun of andere tag weer te geven. Dit gaat over validatie en niet over de DB,
		dus misschien een andere tag in de struct die aangeeft dat deze relatie meervoudig is op enig moment.
	*/
	Vs []A_V `bun:"rel:has-many,join:id=a_id"`

	//Relaties Rel_AB's bij A
	RelABs []Rel_A_B `bun:"rel:has-many,join:id=a_id"`
}

/*
	TODO:
- add Y
- add rel_AB?
*/
// Full_B includes all fields of B and its related entities (like Xs)
type Full_B struct {
	bun.BaseModel `bun:"table:b,alias:b"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer
	//Aanvang *time.Time `json:"aanvang,omitempty"` // afgeleid van A_Aanvang
	//Einde   *time.Time `json:"einde,omitempty"`   // afgeleid van A_Einde

	// De X's behorende bij B, 1-1 op enig moment (enkelvoudig: todo tag)
	Xs []B_X `bun:"rel:has-many,join:id=b_id"`
	// De Y's behorende bij B, 1-1 op enig moment (enkelvoudig: todo tag)
	Ys []B_Y `bun:"rel:has-many,join:id=b_id"`
}
