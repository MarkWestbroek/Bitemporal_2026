package model

// _Input structs: platte API-input die hub + data combineert (referentielijst-testmodel).

type Landcode_Input struct {
	LAND_ID int    `json:"land_id"`
	Rel_ID  int    `json:"rel_id"`
	Code    string `json:"code"`
}

type Landnaam_Input struct {
	LAND_ID int    `json:"land_id"`
	Rel_ID  int    `json:"rel_id"`
	Naam    string `json:"naam"`
}

type Landenlijst_Land_Input struct {
	LANDENLIJST_ID int `json:"landenlijst_id"`
	Rel_ID         int `json:"rel_id"`
	LAND_ID        int `json:"land_id"`
}
