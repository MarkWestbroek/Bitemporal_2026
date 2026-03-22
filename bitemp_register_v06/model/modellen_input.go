package model

import (
	"time"
)

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
