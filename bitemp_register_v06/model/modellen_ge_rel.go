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

// === Hub GetID, Metatype, ClearID methoden ===
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

/* === _Data: GetID, Metatype, ClearID methoden ===
GetID retourneert Versie (het drieledige PK-deel dat per (ent_id, rel_id) uniek is).
Metatype is altijd MetatypeGegevenselement.
ClearID zet Versie op 0 zodat de DB-trigger een nieuwe versie toewijst bij insert.
*/

func (d A_U_Data) GetID() any         { return d.Versie }
func (d A_U_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *A_U_Data) ClearID()          { d.Versie = 0 }

func (d A_V_Data) GetID() any         { return d.Versie }
func (d A_V_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *A_V_Data) ClearID()          { d.Versie = 0 }

func (d A_W_Data) GetID() any         { return d.Versie }
func (d A_W_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *A_W_Data) ClearID()          { d.Versie = 0 }

func (d Rel_A_B_Data) GetID() any         { return d.Versie }
func (d Rel_A_B_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *Rel_A_B_Data) ClearID()          { d.Versie = 0 }

func (d B_X_Data) GetID() any         { return d.Versie }
func (d B_X_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *B_X_Data) ClearID()          { d.Versie = 0 }

func (d B_Y_Data) GetID() any         { return d.Versie }
func (d B_Y_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *B_Y_Data) ClearID()          { d.Versie = 0 }

/* === _Data: Opvoer/Afvoer methoden === */

func (d A_U_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *A_U_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d A_U_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *A_U_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }

func (d A_V_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *A_V_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d A_V_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *A_V_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }

func (d A_W_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *A_W_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d A_W_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *A_W_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }

func (d Rel_A_B_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Rel_A_B_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Rel_A_B_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Rel_A_B_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }

func (d B_X_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *B_X_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d B_X_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *B_X_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }

func (d B_Y_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *B_Y_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d B_Y_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *B_Y_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }

/* === _Data: String methoden === */

func (d A_U_Data) String() string     { return RepresentatieToString(d) }
func (d A_V_Data) String() string     { return RepresentatieToString(d) }
func (d A_W_Data) String() string     { return RepresentatieToString(d) }
func (d Rel_A_B_Data) String() string { return RepresentatieToString(d) }
func (d B_X_Data) String() string     { return RepresentatieToString(d) }
func (d B_Y_Data) String() string     { return RepresentatieToString(d) }

/* === GeefOnderliggendeGegevenselementen op hub-types ===

Implementeert HeeftOnderliggendeGegevenselementen voor hubs. Analoog aan de
implementatie op entiteiten, maar dan één niveau lager: hub → _Data (en optioneel
_Aanvang/_Einde). Propageert ent_id en rel_id naar onderliggende records.

Gebruikt door de generieke registratie-handler om recursief af te dalen:
Entiteit → Hub → _Data/_Aanvang/_Einde.
*/

func (h *A_U) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].A_ID == 0 {
			h.Data[i].A_ID = h.A_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_U_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *A_V) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].A_ID == 0 {
			h.Data[i].A_ID = h.A_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_V_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *A_W) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].A_ID == 0 {
			h.Data[i].A_ID = h.A_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].A_ID == 0 {
			h.Aanvang[i].A_ID = h.A_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].A_ID == 0 {
			h.Einde[i].A_ID = h.A_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *Rel_A_B) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].A_ID == 0 {
			h.Data[i].A_ID = h.A_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].A_ID == 0 {
			h.Aanvang[i].A_ID = h.A_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].A_ID == 0 {
			h.Einde[i].A_ID = h.A_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *B_X) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].B_ID == 0 {
			h.Data[i].B_ID = h.B_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_X_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *B_Y) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].B_ID == 0 {
			h.Data[i].B_ID = h.B_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Y_Data", Representatie: &h.Data[i]})
	}
	return result
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

/* === _Input structs: platte API-input die hub + data combineert ===

De registratie-API accepteert platte objecten (alle velden bij elkaar).
Per GE/REL-type is er een _Input struct die de velden van hub + data combineert.

De handler splitst deze intern:
- Hub-velden (ent_id, rel_id, evt. b_id) → hub-record
- Inhoudsvelden → data-record met versie = autoincrement
- Aanvang/Einde (optioneel) → materiële plumbing records

De Factory in de MetaRegistry levert de _Input struct op.
De DBFactory levert de hub-struct op.

_Input structs implementeren FormeleRepresentatie met no-op opvoer/afvoer,
zodat ze door de generieke handler-chain geparsed kunnen worden.
*/

type A_U_Input struct {
	A_ID   int    `json:"a_id"`
	Rel_ID int    `json:"rel_id"`
	Aaa    string `json:"aaa"`
	Bbb    *bool  `json:"bbb,omitempty"`
	// Materiële velden (optioneel, bij eerste opvoer)
	Aanvang *Date `json:"aanvang,omitempty"`
	Einde   *Date `json:"einde,omitempty"`
}

func (i A_U_Input) GetID() any              { return i.Rel_ID }
func (i A_U_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *A_U_Input) ClearID()               { i.Rel_ID = 0 }
func (i A_U_Input) GetOpvoer() *time.Time   { return nil }
func (i *A_U_Input) SetOpvoer(t *time.Time) {}
func (i A_U_Input) GetAfvoer() *time.Time   { return nil }
func (i *A_U_Input) SetAfvoer(t *time.Time) {}
func (i A_U_Input) String() string          { return RepresentatieToString(i) }

type A_V_Input struct {
	A_ID    int     `json:"a_id"`
	Rel_ID  int     `json:"rel_id"`
	Ccc     string  `json:"ccc"`
	Ddd     *string `json:"ddd,omitempty"`
	Eee     *string `json:"eee,omitempty"`
	Fff     float64 `json:"fff"`
	Ggg     ABCEnum `json:"ggg"`
	Datum   *Date   `json:"datum,omitempty"`
	Aanvang *Date   `json:"aanvang,omitempty"`
	Einde   *Date   `json:"einde,omitempty"`
}

func (i A_V_Input) GetID() any              { return i.Rel_ID }
func (i A_V_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *A_V_Input) ClearID()               { i.Rel_ID = 0 }
func (i A_V_Input) GetOpvoer() *time.Time   { return nil }
func (i *A_V_Input) SetOpvoer(t *time.Time) {}
func (i A_V_Input) GetAfvoer() *time.Time   { return nil }
func (i *A_V_Input) SetAfvoer(t *time.Time) {}
func (i A_V_Input) String() string          { return RepresentatieToString(i) }

type A_W_Input struct {
	A_ID    int     `json:"a_id"`
	Rel_ID  int     `json:"rel_id"`
	Float   float64 `json:"float"`
	Heel    int     `json:"heel"`
	Aanvang *Date   `json:"aanvang,omitempty"`
	Einde   *Date   `json:"einde,omitempty"`
}

func (i A_W_Input) GetID() any              { return i.Rel_ID }
func (i A_W_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *A_W_Input) ClearID()               { i.Rel_ID = 0 }
func (i A_W_Input) GetOpvoer() *time.Time   { return nil }
func (i *A_W_Input) SetOpvoer(t *time.Time) {}
func (i A_W_Input) GetAfvoer() *time.Time   { return nil }
func (i *A_W_Input) SetAfvoer(t *time.Time) {}
func (i A_W_Input) String() string          { return RepresentatieToString(i) }

type Rel_A_B_Input struct {
	A_ID    int        `json:"a_id"`
	Rel_ID  int        `json:"rel_id"`
	B_ID    int        `json:"b_id"`
	Soort   RelABSoort `json:"soort"`
	Aanvang *Date      `json:"aanvang,omitempty"`
	Einde   *Date      `json:"einde,omitempty"`
}

func (i Rel_A_B_Input) GetID() any              { return i.Rel_ID }
func (i Rel_A_B_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *Rel_A_B_Input) ClearID()               { i.Rel_ID = 0 }
func (i Rel_A_B_Input) GetOpvoer() *time.Time   { return nil }
func (i *Rel_A_B_Input) SetOpvoer(t *time.Time) {}
func (i Rel_A_B_Input) GetAfvoer() *time.Time   { return nil }
func (i *Rel_A_B_Input) SetAfvoer(t *time.Time) {}
func (i Rel_A_B_Input) String() string          { return RepresentatieToString(i) }

type B_X_Input struct {
	B_ID    int    `json:"b_id"`
	Rel_ID  int    `json:"rel_id"`
	Fff     string `json:"fff"`
	Ggg     string `json:"ggg"`
	Aanvang *Date  `json:"aanvang,omitempty"`
	Einde   *Date  `json:"einde,omitempty"`
}

func (i B_X_Input) GetID() any              { return i.Rel_ID }
func (i B_X_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *B_X_Input) ClearID()               { i.Rel_ID = 0 }
func (i B_X_Input) GetOpvoer() *time.Time   { return nil }
func (i *B_X_Input) SetOpvoer(t *time.Time) {}
func (i B_X_Input) GetAfvoer() *time.Time   { return nil }
func (i *B_X_Input) SetAfvoer(t *time.Time) {}
func (i B_X_Input) String() string          { return RepresentatieToString(i) }

type B_Y_Input struct {
	B_ID    int    `json:"b_id"`
	Rel_ID  int    `json:"rel_id"`
	Hhh     string `json:"hhh"`
	Aanvang *Date  `json:"aanvang,omitempty"`
	Einde   *Date  `json:"einde,omitempty"`
}

func (i B_Y_Input) GetID() any              { return i.Rel_ID }
func (i B_Y_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *B_Y_Input) ClearID()               { i.Rel_ID = 0 }
func (i B_Y_Input) GetOpvoer() *time.Time   { return nil }
func (i *B_Y_Input) SetOpvoer(t *time.Time) {}
func (i B_Y_Input) GetAfvoer() *time.Time   { return nil }
func (i *B_Y_Input) SetAfvoer(t *time.Time) {}
func (i B_Y_Input) String() string          { return RepresentatieToString(i) }
