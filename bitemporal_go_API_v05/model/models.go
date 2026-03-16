package model

import (
	"time"

	"github.com/uptrace/bun"
)

// GetID en Metatype methoden voor alle representaties
// Entiteiten
func (a A_basis) GetID() any         { return a.ID }
func (a A_basis) Metatype() Metatype { return MetatypeEntiteit }
func (a *A_basis) ClearID()          { a.ID = 0 }

func (b B_basis) GetID() any         { return b.ID }
func (b B_basis) Metatype() Metatype { return MetatypeEntiteit }
func (b *B_basis) ClearID()          { b.ID = 0 }

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

/* Basis structs voor alle representaties
Dat is zonder de relatie van entiteit naar gegevenselementen en relaties.
Wel met relatie terug van gegevenselementen/relaties naar entiteit.
Daar ben ik eigenlijk nog niet blij mee, want dat is eigenlijk ook al een vorm van plumbing, maar het maakt de handlers wel simpeler.
Deze structuren worden gebruikt voor zowel de database als de basis REST interacties.
*/

// Entiteiten
type A_basis struct {
	bun.BaseModel `bun:"table:a"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`  // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"`  // afgeleid van registratie tijdstip afvoer
	Aanvang       *Aanvang   `json:"aanvang,omitempty"` // A_Aanvang in de DB, maar in de code via generieke routines
	Einde         *Einde     `json:"einde,omitempty"`   // A_Einde in de DB, maar in de code via generieke routines
}

type B_basis struct {
	bun.BaseModel `bun:"table:b"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	Aanvang       *Aanvang   `json:"aanvang,omitempty"`
	Einde         *Einde     `json:"einde,omitempty"`
}

type RelABSoort string

const (
	RelABSoortLTT RelABSoort = "LTT"
	RelABSoortLAT RelABSoort = "LAT"
	RelABSoortLTA RelABSoort = "LTA"
)

// Relaties
// Rel_A_B hoort primair bij A
type Rel_A_B struct {
	bun.BaseModel `bun:"table:rel_a_b"`
	A_ID          int        `json:"a_id" schema_desc:"ID van de A-entiteit waar deze relatie bij hoort"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement" schema_desc:"Relatieve ID van de relatie binnen A"`
	ParentA       *A_basis   `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	B_ID          int        `json:"b_id"`
	Soort         RelABSoort `json:"soort" schema:"enum=LTT|LAT|LTA" schema_desc:"Soort relatie tussen A en B"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	Aanvang       *Aanvang   `json:"aanvang,omitempty"`
	Einde         *Einde     `json:"einde,omitempty"`
}

// Gegevenselementen
// A (1) - (1) U
type A_U struct {
	bun.BaseModel `bun:"table:a_u"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"` // autoincrement zal zijn via een triggerfunctie voor de relatieve ID
	ParentA       *A_basis   `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
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
	ParentA       *A_basis   `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Ccc           string     `json:"ccc"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A (1) - (*) W
type A_W struct {
	bun.BaseModel `bun:"table:a_w"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentA       *A_basis   `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
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
	ParentB       *B_basis   `json:"-" bun:"rel:belongs-to,join:b_id=id,on_delete:cascade"`
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
	ParentB       *B_basis   `json:"-" bun:"rel:belongs-to,join:b_id=id,on_delete:cascade"`
	Hhh           string     `json:"hhh"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Opvoer / Afvoer (formele tijd) methoden voor formele tijd intereface implementatie
func (a A_basis) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_basis) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_basis) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_basis) SetAfvoer(t *time.Time) { a.Afvoer = t }

func (b B_basis) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B_basis) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B_basis) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B_basis) SetAfvoer(t *time.Time) { b.Afvoer = t }

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

func (a Full_A) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Full_A) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Full_A) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Full_A) SetAfvoer(t *time.Time) { a.Afvoer = t }

func (b Full_B) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *Full_B) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b Full_B) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *Full_B) SetAfvoer(t *time.Time) { b.Afvoer = t }

// Aanvang / Einde (materiële tijd) methoden voor materiële tijd intereface implementatie
func (a A_basis) GetAanvang() *time.Time   { return a.Aanvang.Aanvang }
func (a *A_basis) SetAanvang(t *time.Time) { a.Aanvang.Aanvang = t }
func (a A_basis) GetEinde() *time.Time     { return a.Einde.Einde }
func (a *A_basis) SetEinde(t *time.Time)   { a.Einde.Einde = t }

func (b B_basis) GetAanvang() *time.Time   { return b.Aanvang.Aanvang }
func (b *B_basis) SetAanvang(t *time.Time) { b.Aanvang.Aanvang = t }
func (b B_basis) GetEinde() *time.Time     { return b.Einde.Einde }
func (b *B_basis) SetEinde(t *time.Time)   { b.Einde.Einde = t }

func (r Rel_A_B) GetAanvang() *time.Time   { return r.Aanvang.Aanvang }
func (r *Rel_A_B) SetAanvang(t *time.Time) { r.Aanvang.Aanvang = t }
func (r Rel_A_B) GetEinde() *time.Time     { return r.Einde.Einde }
func (r *Rel_A_B) SetEinde(t *time.Time)   { r.Einde.Einde = t }

//TODO: als A_U, A_V, A_W, B_X, B_Y ook aanvang/einde krijgen, dan hier ook getters/setters toevoegen

// String methoden voor debuggen
func (a A_basis) String() string { return RepresentatieToString(a) }
func (b B_basis) String() string { return RepresentatieToString(b) }
func (r Rel_A_B) String() string { return RepresentatieToString(r) }
func (au A_U) String() string    { return RepresentatieToString(au) }
func (av A_V) String() string    { return RepresentatieToString(av) }
func (aw A_W) String() string    { return RepresentatieToString(aw) }
func (bx B_X) String() string    { return RepresentatieToString(bx) }
func (by B_Y) String() string    { return RepresentatieToString(by) }
func (a Full_A) String() string  { return RepresentatieToString(a) }
func (b Full_B) String() string  { return RepresentatieToString(b) }
