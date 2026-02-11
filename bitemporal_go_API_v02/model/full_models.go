package model

import (
	"time"

	"github.com/uptrace/bun"
)

// GetID methods
func (a Full_A) GetID() string { return a.ID }
func (b Full_B) GetID() string { return b.ID }

// Full entity structs
// Entiteiten

/* TODO:
- Add U to FullA
- Add Rel_AB to FullA
*/
// Full_A includes all fields of A and its related entities (like Vs)
type Full_A struct {
	bun.BaseModel `bun:"table:as,alias:a"`
	ID            string     `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer
	//Aanvang *time.Time `json:"aanvang,omitempty"` // afgeleid van A_Aanvang
	//Einde   *time.Time `json:"einde,omitempty"`   // afgeleid van A_Einde

	//U []A_U `bun:"rel:one-to-one,join:id=a_id"` // eigenlijk 1-1, maar alleen op 1 moment
	// De relatie: 'has-many' vertelt Bun dat er meerdere V 's bij deze A horen.
	Vs []A_V `bun:"rel:has-many,join:id=a_id"`
}

/*
	TODO:
- add Y
- add rel_AB?
*/
// Full_B includes all fields of B and its related entities (like Xs)
type Full_B struct {
	bun.BaseModel `bun:"table:bs,alias:b"`
	ID            string     `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer
	//Aanvang *time.Time `json:"aanvang,omitempty"` // afgeleid van A_Aanvang
	//Einde   *time.Time `json:"einde,omitempty"`   // afgeleid van A_Einde

	//U []A_U `bun:"rel:one-to-one,join:id=a_id"` // eigenlijk 1-1, maar alleen op 1 moment
	// De relatie: 'has-many' vertelt Bun dat er meerdere V 's bij deze A horen.
	Xs []B_X `bun:"rel:has-many,join:id=b_id"`
}
