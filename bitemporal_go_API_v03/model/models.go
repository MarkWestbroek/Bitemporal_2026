package model

import (
	"time"

	"github.com/uptrace/bun"
)

// GetID en Metatype methoden voor alle representaties
func (a A) GetID() any               { return a.ID }
func (a A) Metatype() Metatype       { return MetatypeEntiteit }
func (b B) GetID() any               { return b.ID }
func (b B) Metatype() Metatype       { return MetatypeEntiteit }
func (r Rel_A_B) GetID() any         { return r.ID }
func (r Rel_A_B) Metatype() Metatype { return MetatypeRelatie }
func (au A_U) GetID() any            { return au.Rel_ID }
func (au A_U) Metatype() Metatype    { return MetatypeGegevenselement }
func (av A_V) GetID() any            { return av.Rel_ID }
func (av A_V) Metatype() Metatype    { return MetatypeGegevenselement }
func (bx B_X) GetID() any            { return bx.Rel_ID }
func (bx B_X) Metatype() Metatype    { return MetatypeGegevenselement }
func (by B_Y) GetID() any            { return by.Rel_ID }
func (by B_Y) Metatype() Metatype    { return MetatypeGegevenselement }

// String methoden voor debuggen
func (a A) String() string       { return RepresentatieToString(a) }
func (b B) String() string       { return RepresentatieToString(b) }
func (r Rel_A_B) String() string { return RepresentatieToString(r) }
func (au A_U) String() string    { return RepresentatieToString(au) }
func (av A_V) String() string    { return RepresentatieToString(av) }
func (bx B_X) String() string    { return RepresentatieToString(bx) }
func (by B_Y) String() string    { return RepresentatieToString(by) }
func (a Full_A) String() string  { return RepresentatieToString(a) }
func (b Full_B) String() string  { return RepresentatieToString(b) }

// Entiteiten
type A struct {
	bun.BaseModel `bun:"table:a"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer
	//Aanvang *time.Time `json:"aanvang,omitempty"` // afgeleid van A_Aanvang
	//Einde   *time.Time `json:"einde,omitempty"`   // afgeleid van A_Einde
}

type B struct {
	bun.BaseModel `bun:"table:b"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	//Aanvang *time.Time `json:"aanvang,omitempty"`
	//Einde   *time.Time `json:"einde,omitempty"`
}

// Relaties
type Rel_A_B struct {
	bun.BaseModel `bun:"table:rel_a_b"`
	ID            int        `json:"id" bun:"id,pk"`
	A_ID          int        `json:"a_id"`
	B_ID          int        `json:"b_id"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	//Aanvang *time.Time `json:"aanvang,omitempty"`
	//Einde   *time.Time `json:"einde,omitempty"`
}

// Gegevenselementen
// A (1) - (1) U
type A_U struct {
	bun.BaseModel `bun:"table:a_u"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	A_ID          int        `json:"a_id"`
	Aaa           string     `json:"aaa"`
	Bbb           string     `json:"bbb"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A (1) - (*) V
type A_V struct {
	bun.BaseModel `bun:"table:a_v"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	A_ID          int        `json:"a_id"`
	Ccc           string     `json:"ccc"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B (1) - (1) X
type B_X struct {
	bun.BaseModel `bun:"table:b_x"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	B_ID          int        `json:"b_id"`
	Fff           string     `json:"fff"`
	Ggg           string     `json:"ggg"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B (1) - (1) Y
type B_Y struct {
	bun.BaseModel `bun:"table:b_y"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	B_ID          int        `json:"b_id"`
	Hhh           string     `json:"hhh"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
