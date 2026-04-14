package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// A — Entiteit A met materiele tijdlijn en onderliggende representaties U, V, W en Rel_A_B.
type A struct {
	bun.BaseModel `bun:"table:a,alias:a"`
	ID            int         `json:"id" bun:"id,pk"`
	Opvoer        *time.Time  `json:"opvoer,omitempty"`
	Afvoer        *time.Time  `json:"afvoer,omitempty"`
	Us            []A_U       `bun:"rel:has-many,join:id=a_id" json:"us,omitempty"`
	Vs            []A_V       `bun:"rel:has-many,join:id=a_id" json:"vs,omitempty"`
	Ws            []A_W       `bun:"rel:has-many,join:id=a_id" json:"ws,omitempty"`
	RelABs        []Rel_A_B   `bun:"rel:has-many,join:id=a_id" json:"rel_a_bs,omitempty"`
	Aanvang       []A_Aanvang `bun:"rel:has-many,join:id=a_id" json:"aanvang,omitempty"`
	Einde         []A_Einde   `bun:"rel:has-many,join:id=a_id" json:"einde,omitempty"`
}

// A_Aanvang — aanvangdatum van entiteit A.
type A_Aanvang struct {
	bun.BaseModel `bun:"table:a_aanvang,alias:a_aanvang"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A_Einde — eindedatum van entiteit A.
type A_Einde struct {
	bun.BaseModel `bun:"table:a_einde,alias:a_einde"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B — Entiteit B met materiele tijdlijn en onderliggende representaties X en Y.
type B struct {
	bun.BaseModel `bun:"table:b,alias:b"`
	ID            int         `json:"id" bun:"id,pk"`
	Opvoer        *time.Time  `json:"opvoer,omitempty"`
	Afvoer        *time.Time  `json:"afvoer,omitempty"`
	Xs            []B_X       `bun:"rel:has-many,join:id=b_id" json:"xs,omitempty"`
	Ys            []B_Y       `bun:"rel:has-many,join:id=b_id" json:"ys,omitempty"`
	Aanvang       []B_Aanvang `bun:"rel:has-many,join:id=b_id" json:"aanvang,omitempty"`
	Einde         []B_Einde   `bun:"rel:has-many,join:id=b_id" json:"einde,omitempty"`
}

// B_Aanvang — aanvangdatum van entiteit B.
type B_Aanvang struct {
	bun.BaseModel `bun:"table:b_aanvang,alias:b_aanvang"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B_Einde — eindedatum van entiteit B.
type B_Einde struct {
	bun.BaseModel `bun:"table:b_einde,alias:b_einde"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

type C struct {
	bun.BaseModel `bun:"table:c,alias:c"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	CGes          []C_C_GE   `bun:"rel:has-many,join:id=c_id" json:"c_ges,omitempty"`
	RelCBs        []Rel_C_B  `bun:"rel:has-many,join:id=c_id" json:"rel_c_bs,omitempty"`
}

type C_sub struct {
	bun.BaseModel `bun:"table:c_sub,alias:c_sub"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
