package model

import (
	"time"

	"github.com/uptrace/bun"
)

// GetID en Metatype methoden voor alle representaties
// Relaties
func (r Rel_A_B) GetID() any         { return r.Rel_ID }
func (r Rel_A_B) Metatype() Metatype { return MetatypeRelatie }
func (r *Rel_A_B) ClearID()          { r.Rel_ID = 0 }

// Gegevenselementen
func (au A_U) GetID() any         { return au.Rel_ID }
func (au A_U) Metatype() Metatype { return MetatypeGegevenselement }
func (au *A_U) ClearID()          { au.Rel_ID = 0 }

func (av A_V) GetID() any         { return av.Rel_ID }
func (av A_V) Metatype() Metatype { return MetatypeGegevenselement }
func (av *A_V) ClearID()          { av.Rel_ID = 0 }

func (aw A_W) GetID() any         { return aw.Rel_ID }
func (aw A_W) Metatype() Metatype { return MetatypeGegevenselement }
func (aw *A_W) ClearID()          { aw.Rel_ID = 0 }

func (bx B_X) GetID() any         { return bx.Rel_ID }
func (bx B_X) Metatype() Metatype { return MetatypeGegevenselement }
func (bx *B_X) ClearID()          { bx.Rel_ID = 0 }

func (by B_Y) GetID() any         { return by.Rel_ID }
func (by B_Y) Metatype() Metatype { return MetatypeGegevenselement }
func (by *B_Y) ClearID()          { by.Rel_ID = 0 }

/* Basis structs voor de representaties die geen aparte Full struct hebben.
Gegevenselementen en relaties hebben geen aparte Full struct, omdat hun relatie
terug naar de entiteit (ParentA/ParentB) al in de basis struct zit.
Deze structuren worden gebruikt voor zowel de database als de REST interacties.
*/

/* === Relaties === */

// Rel_A_B, deze hoort primair bij A
// eerst bijbehorende enums
type RelABSoort string

const (
	RelABSoortLTT RelABSoort = "LTT"
	RelABSoortLAT RelABSoort = "LAT"
	RelABSoortLTA RelABSoort = "LTA"
)

type ABCEnum string

const (
	OptieA ABCEnum = "Optie A"
	OptieB ABCEnum = "Optie B"
	OptieC ABCEnum = "Optie C"
)

// dan de struct zelf
type Rel_A_B struct {
	bun.BaseModel `bun:"table:rel_a_b"`
	A_ID          int        `json:"a_id" bun:"a_id,pk" schema_desc:"ID van de A-entiteit waar deze relatie bij hoort"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement" schema_desc:"Relatieve ID van de relatie binnen A"`
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	B_ID          int        `json:"b_id"`
	Soort         RelABSoort `json:"soort" schema:"enum=LTT|LAT|LTA" schema_desc:"Soort relatie tussen A en B"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Gegevenselementen
// A (1) - (1) U
type A_U struct {
	bun.BaseModel `bun:"table:a_u"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"` // autoincrement zal zijn via een triggerfunctie voor de relatieve ID
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Aaa           string     `json:"aaa"`
	Bbb           *bool      `json:"bbb,omitempty"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A (1) - (*) V
type A_V struct {
	bun.BaseModel `bun:"table:a_v"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Ccc           string     `json:"ccc"`
	Ddd           *string    `json:"ddd,omitempty"`
	Eee           *string    `json:"eee,omitempty"`
	Fff           float64    `json:"fff"`
	Ggg           ABCEnum    `json:"ggg" schema:"enum=Optie A|Optie B|Optie C" schema_desc:"Test enumeratie"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A (1) - (*) W
type A_W struct {
	bun.BaseModel `bun:"table:a_w"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Float         float64    `json:"float"`
	Heel          int        `json:"heel"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B (1) - (1) X
type B_X struct {
	bun.BaseModel `bun:"table:b_x"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentB       *B         `json:"-" bun:"rel:belongs-to,join:b_id=id,on_delete:cascade"`
	Fff           string     `json:"fff"`
	Ggg           string     `json:"ggg"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B (1) - (1) Y
type B_Y struct {
	bun.BaseModel `bun:"table:b_y"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentB       *B         `json:"-" bun:"rel:belongs-to,join:b_id=id,on_delete:cascade"`
	Hhh           string     `json:"hhh"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Opvoer / Afvoer (formele tijd) methoden voor formele tijd intereface implementatie
func (r Rel_A_B) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Rel_A_B) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Rel_A_B) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Rel_A_B) SetAfvoer(t *time.Time) { r.Afvoer = t }

func (au A_U) GetOpvoer() *time.Time   { return au.Opvoer }
func (au *A_U) SetOpvoer(t *time.Time) { au.Opvoer = t }
func (au A_U) GetAfvoer() *time.Time   { return au.Afvoer }
func (au *A_U) SetAfvoer(t *time.Time) { au.Afvoer = t }

func (av A_V) GetOpvoer() *time.Time   { return av.Opvoer }
func (av *A_V) SetOpvoer(t *time.Time) { av.Opvoer = t }
func (av A_V) GetAfvoer() *time.Time   { return av.Afvoer }
func (av *A_V) SetAfvoer(t *time.Time) { av.Afvoer = t }

func (aw A_W) GetOpvoer() *time.Time   { return aw.Opvoer }
func (aw *A_W) SetOpvoer(t *time.Time) { aw.Opvoer = t }
func (aw A_W) GetAfvoer() *time.Time   { return aw.Afvoer }
func (aw *A_W) SetAfvoer(t *time.Time) { aw.Afvoer = t }

func (bx B_X) GetOpvoer() *time.Time   { return bx.Opvoer }
func (bx *B_X) SetOpvoer(t *time.Time) { bx.Opvoer = t }
func (bx B_X) GetAfvoer() *time.Time   { return bx.Afvoer }
func (bx *B_X) SetAfvoer(t *time.Time) { bx.Afvoer = t }

func (by B_Y) GetOpvoer() *time.Time   { return by.Opvoer }
func (by *B_Y) SetOpvoer(t *time.Time) { by.Opvoer = t }
func (by B_Y) GetAfvoer() *time.Time   { return by.Afvoer }
func (by *B_Y) SetAfvoer(t *time.Time) { by.Afvoer = t }

func (a A) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A) SetAfvoer(t *time.Time) { a.Afvoer = t }

func (b B) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B) SetAfvoer(t *time.Time) { b.Afvoer = t }

// String methoden voor debuggen
func (r Rel_A_B) String() string { return RepresentatieToString(r) }
func (au A_U) String() string    { return RepresentatieToString(au) }
func (av A_V) String() string    { return RepresentatieToString(av) }
func (aw A_W) String() string    { return RepresentatieToString(aw) }
func (bx B_X) String() string    { return RepresentatieToString(bx) }
func (by B_Y) String() string    { return RepresentatieToString(by) }
