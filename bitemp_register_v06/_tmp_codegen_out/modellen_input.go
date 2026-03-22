package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.


type Persoon_Naam_Input struct {
	PERSOON_ID int `json:"persoon_id"`
	Rel_ID int `json:"rel_id"`
	VolledigeNaam string `json:"volledige_naam"`
	Aanvang *Date `json:"aanvang,omitempty"`
	Einde *Date `json:"einde,omitempty"`
}

