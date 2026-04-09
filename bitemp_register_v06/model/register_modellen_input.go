package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type Land_Landcode_Input struct {
	LAND_ID int    `json:"land_id"`
	Rel_ID  int    `json:"rel_id"`
	Code    string `json:"code"`
}

type Land_Landnaam_Input struct {
	LAND_ID int    `json:"land_id"`
	Rel_ID  int    `json:"rel_id"`
	Naam    string `json:"naam"`
}

type Referentielijst_Referentielijstnaam_Input struct {
	REFERENTIELIJST_ID int    `json:"referentielijst_id"`
	Rel_ID             int    `json:"rel_id"`
	Naam               string `json:"naam"`
}

type Referentielijst_Referentielijstomschrijving_Input struct {
	REFERENTIELIJST_ID int    `json:"referentielijst_id"`
	Rel_ID             int    `json:"rel_id"`
	Omschrijving       string `json:"omschrijving"`
}

type Referentielijst_ReferentielijstVisibility_Input struct {
	REFERENTIELIJST_ID int    `json:"referentielijst_id"`
	Rel_ID             int    `json:"rel_id"`
	Domein             string `json:"domein"`
}

type Referentielijst_ReferentielijstInternetadres_Input struct {
	REFERENTIELIJST_ID int                      `json:"referentielijst_id"`
	Rel_ID             int                      `json:"rel_id"`
	Adrestype          ReferentielijstAdrestype `json:"adrestype"`
	Adres              string                   `json:"adres"`
	Organisatie        string                   `json:"organisatie"`
}

type LandenlijstLand_Input struct {
	REFERENTIELIJST_ID int `json:"referentielijst_id"`
	Rel_ID             int `json:"rel_id"`
	LAND_ID            int `json:"land_id"`
}

type AdellijkeTitelsTitel_Input struct {
	REFERENTIELIJST_ID int `json:"referentielijst_id"`
	Rel_ID             int `json:"rel_id"`
	ADELLIJKETITEL_ID  int `json:"adellijketitel_id"`
}
