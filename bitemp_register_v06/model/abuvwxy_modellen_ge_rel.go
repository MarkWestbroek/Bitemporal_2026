package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type ABCEnum string

const (
	ABCEnumOptieA ABCEnum = "Optie A"
	ABCEnumOptieB ABCEnum = "Optie B"
	ABCEnumOptieC ABCEnum = "Optie C"
)

type RelABSoort string

const (
	RelABSoortLTT RelABSoort = "LTT"
	RelABSoortLAT RelABSoort = "LAT"
	RelABSoortLTA RelABSoort = "LTA"
)

// A_U — Enkelvoudig gegevenselement van A met formele tijdlijn.
type A_U struct {
	bun.BaseModel `bun:"table:a_u,alias:a_u"`
	A_ID          int        `json:"a_id" bun:"a_id,pk" schema_desc:"ID van de A-entiteit"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	Data          []A_U_Data `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// A_U_Data — geversioned inhoud van A_U.
type A_U_Data struct {
	bun.BaseModel `bun:"table:a_u_data,alias:a_u_data"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Aaa           string     `json:"aaa"`
	Bbb           *bool      `json:"bbb,omitempty"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A_V — Meervoudig gegevenselement van A met onder andere een datumveld.
type A_V struct {
	bun.BaseModel `bun:"table:a_v,alias:a_v"`
	A_ID          int        `json:"a_id" bun:"a_id,pk" schema_desc:"ID van de A-entiteit"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	Data          []A_V_Data `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// A_V_Data — geversioned inhoud van A_V.
type A_V_Data struct {
	bun.BaseModel `bun:"table:a_v_data,alias:a_v_data"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Ccc           string     `json:"ccc"`
	Ddd           *string    `json:"ddd,omitempty"`
	Eee           *string    `json:"eee,omitempty"`
	Fff           float64    `json:"fff"`
	Ggg           ABCEnum    `json:"ggg" schema:"enum=ABCEnum"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A_W — Meervoudig gegevenselement van A met numerieke waarden.
type A_W struct {
	bun.BaseModel `bun:"table:a_w,alias:a_w"`
	A_ID          int           `json:"a_id" bun:"a_id,pk" schema_desc:"ID van de A-entiteit"`
	Rel_ID        int           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentA       *A            `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Opvoer        *time.Time    `json:"opvoer,omitempty"`
	Afvoer        *time.Time    `json:"afvoer,omitempty"`
	Data          []A_W_Data    `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang       []A_W_Aanvang `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde         []A_W_Einde   `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// A_W_Data — geversioned inhoud van A_W.
type A_W_Data struct {
	bun.BaseModel `bun:"table:a_w_data,alias:a_w_data"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Float         float64    `json:"float"`
	Heel          int        `json:"heel"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A_W_Aanvang — aanvangdatum van A_W.
type A_W_Aanvang struct {
	bun.BaseModel `bun:"table:a_w_aanvang,alias:a_w_aanvang"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A_W_Einde — eindedatum van A_W.
type A_W_Einde struct {
	bun.BaseModel `bun:"table:a_w_einde,alias:a_w_einde"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Rel_A_B — Relatie tussen A en B, meervoudig voorkomend per A en met relatieve relatie-id.
type Rel_A_B struct {
	bun.BaseModel `bun:"table:rel_a_b,alias:rel_a_b"`
	A_ID          int               `json:"a_id" bun:"a_id,pk" schema_desc:"ID van de A-entiteit"`
	Rel_ID        int               `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentA       *A                `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	B_ID          int               `json:"b_id"`
	Opvoer        *time.Time        `json:"opvoer,omitempty"`
	Afvoer        *time.Time        `json:"afvoer,omitempty"`
	Data          []Rel_A_B_Data    `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang       []Rel_A_B_Aanvang `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde         []Rel_A_B_Einde   `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Rel_A_B_Data — geversioned inhoud van Rel_A_B.
type Rel_A_B_Data struct {
	bun.BaseModel `bun:"table:rel_a_b_data,alias:rel_a_b_data"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Soort         RelABSoort `json:"soort" schema:"enum=RelABSoort"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Rel_A_B_Aanvang — aanvangdatum van Rel_A_B.
type Rel_A_B_Aanvang struct {
	bun.BaseModel `bun:"table:rel_a_b_aanvang,alias:rel_a_b_aanvang"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Rel_A_B_Einde — eindedatum van Rel_A_B.
type Rel_A_B_Einde struct {
	bun.BaseModel `bun:"table:rel_a_b_einde,alias:rel_a_b_einde"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B_X — Enkelvoudig gegevenselement van B met twee tekstvelden.
type B_X struct {
	bun.BaseModel `bun:"table:b_x,alias:b_x"`
	B_ID          int        `json:"b_id" bun:"b_id,pk" schema_desc:"ID van de B-entiteit"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentB       *B         `json:"-" bun:"rel:belongs-to,join:b_id=id,on_delete:cascade"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	Data          []B_X_Data `bun:"rel:has-many,join:b_id=b_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// B_X_Data — geversioned inhoud van B_X.
type B_X_Data struct {
	bun.BaseModel `bun:"table:b_x_data,alias:b_x_data"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Fff           string     `json:"fff"`
	Ggg           string     `json:"ggg"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B_Y — Enkelvoudig gegevenselement van B met een tekstveld.
type B_Y struct {
	bun.BaseModel `bun:"table:b_y,alias:b_y"`
	B_ID          int        `json:"b_id" bun:"b_id,pk" schema_desc:"ID van de B-entiteit"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentB       *B         `json:"-" bun:"rel:belongs-to,join:b_id=id,on_delete:cascade"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	Data          []B_Y_Data `bun:"rel:has-many,join:b_id=b_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// B_Y_Data — geversioned inhoud van B_Y.
type B_Y_Data struct {
	bun.BaseModel `bun:"table:b_y_data,alias:b_y_data"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Hhh           string     `json:"hhh"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
