package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type Kennisartikel_Kennissectie_Input struct {
	KENNISARTIKEL_ID int              `json:"kennisartikel_id"`
	Rel_ID           int              `json:"rel_id"`
	Type             Kennissectietype `json:"type"`
	Taal             Taal             `json:"taal"`
	Inhoud           string           `json:"inhoud"`
	Positie          int              `json:"positie"`
}
