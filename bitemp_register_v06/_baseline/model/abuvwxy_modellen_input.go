package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type A_U_Input struct {
	A_ID   int    `json:"a_id"`
	Rel_ID int    `json:"rel_id"`
	Aaa    string `json:"aaa"`
	Bbb    *bool  `json:"bbb,omitempty"`
}

type A_V_Input struct {
	A_ID   int     `json:"a_id"`
	Rel_ID int     `json:"rel_id"`
	Ccc    string  `json:"ccc"`
	Ddd    *string `json:"ddd,omitempty"`
	Eee    *string `json:"eee,omitempty"`
	Fff    float64 `json:"fff"`
	Ggg    ABCEnum `json:"ggg"`
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
	B_ID   int    `json:"b_id"`
	Rel_ID int    `json:"rel_id"`
	Fff    string `json:"fff"`
	Ggg    string `json:"ggg"`
}

type B_Y_Input struct {
	B_ID   int    `json:"b_id"`
	Rel_ID int    `json:"rel_id"`
	Hhh    string `json:"hhh"`
}

type C_C_GE_Input struct {
	C_ID      int     `json:"c_id"`
	Rel_ID    int     `json:"rel_id"`
	Superveld *string `json:"superveld,omitempty"`
}

type Rel_C_B_Input struct {
	C_ID    int     `json:"c_id"`
	Rel_ID  int     `json:"rel_id"`
	B_ID    int     `json:"b_id"`
	Relveld *string `json:"relveld,omitempty"`
}
