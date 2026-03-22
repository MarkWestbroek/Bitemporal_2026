package model

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

type A_W_Input struct {
	A_ID    int     `json:"a_id"`
	Rel_ID  int     `json:"rel_id"`
	Float   float64 `json:"float"`
	Heel    int     `json:"heel"`
	Aanvang *Date   `json:"aanvang,omitempty"`
	Einde   *Date   `json:"einde,omitempty"`
}

type Rel_A_B_Input struct {
	A_ID    int        `json:"a_id"`
	Rel_ID  int        `json:"rel_id"`
	B_ID    int        `json:"b_id"`
	Soort   RelABSoort `json:"soort"`
	Aanvang *Date      `json:"aanvang,omitempty"`
	Einde   *Date      `json:"einde,omitempty"`
}

type B_X_Input struct {
	B_ID    int    `json:"b_id"`
	Rel_ID  int    `json:"rel_id"`
	Fff     string `json:"fff"`
	Ggg     string `json:"ggg"`
	Aanvang *Date  `json:"aanvang,omitempty"`
	Einde   *Date  `json:"einde,omitempty"`
}

type B_Y_Input struct {
	B_ID    int    `json:"b_id"`
	Rel_ID  int    `json:"rel_id"`
	Hhh     string `json:"hhh"`
	Aanvang *Date  `json:"aanvang,omitempty"`
	Einde   *Date  `json:"einde,omitempty"`
}
