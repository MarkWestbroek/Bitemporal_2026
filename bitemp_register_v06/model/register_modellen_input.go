package model

// _Input structs voor het register-domein: platte API-input die hub + data combineert.

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

type LandenlijstLand_Input struct {
	REFERENTIELIJST_ID int `json:"referentielijst_id"`
	Rel_ID             int `json:"rel_id"`
	LAND_ID            int `json:"land_id"`
}
