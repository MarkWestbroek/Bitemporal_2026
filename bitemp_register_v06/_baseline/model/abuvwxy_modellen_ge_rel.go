package model

/*
modellen_ge_rel.go — Hub + _Data + _Input structs voor gegevenselementen en relaties.

Dit bestand implementeert het hub+data pattern (zie ONTWERP_DATA_PATTERN.md):

  Entiteit → Hub → _Data (+ optioneel _Aanvang/_Einde bij materiële hubs)

- **Hub structs** (A_U, A_V, A_W, Rel_A_B, B_X, B_Y):
  Identiteitsanker met PK (ent_id, rel_id). Bevat alleen structurele velden
  (FK's), afgeleide opvoer/afvoer, en Bun-relaties naar _Data en optioneel
  _Aanvang/_Einde. Geen inhoudsvelden — die staan in _Data.

- **_Data structs** (A_U_Data, A_V_Data, ...):
  Geversioned inhoud. PK (ent_id, rel_id, versie). Elke correctie op
  inhoudsvelden maakt een nieuwe versie aan; de hub blijft ongewijzigd.

- **_Input structs** (A_U_Input, A_V_Input, ...):
  Platte API-input die hub- en datavelden combineert. De registratie-handler
  splitst deze intern naar een hub-record + data-record. Zie §7.4 in ontwerp.

De hub-types implementeren tevens HeeftOnderliggendeGegevenselementen, zodat
de generieke handlers recursief kunnen afdalen naar _Data/_Aanvang/_Einde.
*/

import (
	"time"

	"github.com/uptrace/bun"
)

/* === Hub structs ===

Elke hub bevat:
- PK-velden: entiteit_id + rel_id (samengesteld)
- ParentX: Bun belongs-to relatie naar de bovenliggende entiteit
- Opvoer/Afvoer: afgeleide formele-tijdvelden
- Data: Bun has-many naar de _Data tabel (geversioned inhoud)
- Aanvang/Einde (alleen materiële hubs): Bun has-many naar _Aanvang/_Einde

De hub is het identiteitsanker: bij een correctie op inhoudsvelden wordt
alleen een nieuwe _Data versie aangemaakt; de hub zelf wijzigt niet.
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

// dan de struct zelf — hub: alleen structurele velden, inhoud in Rel_A_B_Data
type Rel_A_B struct {
	bun.BaseModel `bun:"table:rel_a_b"`
	A_ID          int        `json:"a_id" bun:"a_id,pk" schema_desc:"ID van de A-entiteit waar deze relatie bij hoort"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement" schema_desc:"Relatieve ID van de relatie binnen A"`
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	B_ID          int        `json:"b_id"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	// Onderliggende data-versies
	Data []Rel_A_B_Data `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
	// Materiële plumbing
	Aanvang []Rel_A_B_Aanvang `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde   []Rel_A_B_Einde   `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Gegevenselementen
// A (1) - (1) U — hub: alleen structurele velden, inhoud in A_U_Data
type A_U struct {
	bun.BaseModel `bun:"table:a_u"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"` // autoincrement zal zijn via een triggerfunctie voor de relatieve ID
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	// Onderliggende data-versies
	Data []A_U_Data `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// A (1) - (*) V — hub: alleen structurele velden, inhoud in A_V_Data
type A_V struct {
	bun.BaseModel `bun:"table:a_v"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	// Onderliggende data-versies
	Data []A_V_Data `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// A (1) - (*) W — hub: alleen structurele velden, inhoud in A_W_Data (materieel)
type A_W struct {
	bun.BaseModel `bun:"table:a_w"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentA       *A         `json:"-" bun:"rel:belongs-to,join:a_id=id,on_delete:cascade"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	// Onderliggende data-versies
	Data []A_W_Data `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"data,omitempty"`
	// Materiële plumbing
	Aanvang []A_W_Aanvang `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde   []A_W_Einde   `bun:"rel:has-many,join:a_id=a_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// B (1) - (1) X — hub: alleen structurele velden, inhoud in B_X_Data
type B_X struct {
	bun.BaseModel `bun:"table:b_x"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentB       *B         `json:"-" bun:"rel:belongs-to,join:b_id=id,on_delete:cascade"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	// Onderliggende data-versies
	Data []B_X_Data `bun:"rel:has-many,join:b_id=b_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// B (1) - (1) Y — hub: alleen structurele velden, inhoud in B_Y_Data
type B_Y struct {
	bun.BaseModel `bun:"table:b_y"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentB       *B         `json:"-" bun:"rel:belongs-to,join:b_id=id,on_delete:cascade"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
	// Onderliggende data-versies
	Data []B_Y_Data `bun:"rel:has-many,join:b_id=b_id,join:rel_id=rel_id" json:"data,omitempty"`
}

/* === _Data structs: geversioned inhoud ===

Elke _Data struct bevat:
- PK-velden: entiteit_id + rel_id + versie (drieledige samengestelde sleutel)
- Inhoudsvelden: de daadwerkelijke domeindata (was voorheen op de hub)
- Opvoer/Afvoer: formele-tijdvelden per versie

Versie is een relatief autoincrement binnen (ent_id, rel_id),
beheerd door een PostgreSQL trigger.
*/

// A_U_Data — inhoud van A_U, geversioned
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

// A_V_Data — inhoud van A_V, geversioned
type A_V_Data struct {
	bun.BaseModel `bun:"table:a_v_data,alias:a_v_data"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Ccc           string     `json:"ccc"`
	Ddd           *string    `json:"ddd,omitempty"`
	Eee           *string    `json:"eee,omitempty"`
	Fff           float64    `json:"fff"`
	Ggg           ABCEnum    `json:"ggg" schema:"enum=Optie A|Optie B|Optie C" schema_desc:"Test enumeratie"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// A_W_Data — inhoud van A_W, geversioned
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

// Rel_A_B_Data — inhoud van Rel_A_B, geversioned
type Rel_A_B_Data struct {
	bun.BaseModel `bun:"table:rel_a_b_data,alias:rel_a_b_data"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Soort         RelABSoort `json:"soort" schema:"enum=LTT|LAT|LTA" schema_desc:"Soort relatie tussen A en B"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// B_X_Data — inhoud van B_X, geversioned
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

// B_Y_Data — inhoud van B_Y, geversioned
type B_Y_Data struct {
	bun.BaseModel `bun:"table:b_y_data,alias:b_y_data"`
	B_ID          int        `json:"b_id" bun:"b_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Hhh           string     `json:"hhh"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

/* === Hub-level _Aanvang/_Einde: materiële plumbing voor GE/REL hubs ===

Materiële hubs (waar IsMaterieel=true in de MetaRegistry) hebben hun eigen
aanvang/einde-tabellen, analoog aan de entiteits-level plumbing (A_Aanvang, etc.).

Verschil met entiteits-plumbing:
- PK: (ent_id, rel_id, versie) — drieledige samengestelde sleutel (i.p.v. tweedelig)
- FK: naar de hub (ent_id, rel_id) i.p.v. direct naar de entiteit

Versie is relatief autoincrement per (ent_id, rel_id), beheerd door
RegisterRelativeIDTriggerComposite in createmodeltables.go.

Alleen gedefinieerd voor materiële hubs: A_W en Rel_A_B.
Niet-materiële hubs (A_U, A_V, B_X, B_Y) hebben geen aanvang/einde.
*/

type A_W_Aanvang struct {
	bun.BaseModel `bun:"table:a_w_aanvang,alias:a_w_aanvang"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

type A_W_Einde struct {
	bun.BaseModel `bun:"table:a_w_einde,alias:a_w_einde"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

type Rel_A_B_Aanvang struct {
	bun.BaseModel `bun:"table:rel_a_b_aanvang,alias:rel_a_b_aanvang"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

type Rel_A_B_Einde struct {
	bun.BaseModel `bun:"table:rel_a_b_einde,alias:rel_a_b_einde"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
