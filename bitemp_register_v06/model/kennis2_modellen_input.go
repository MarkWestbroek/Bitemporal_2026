package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type KA_Tr_Input struct {
	KENNISARTIKEL_ID int   `json:"kennisartikel_id"`
	Rel_ID           int   `json:"rel_id"`
	TREFWOORD_ID     int   `json:"trefwoord_id"`
	Aanvang          *Date `json:"aanvang,omitempty"`
	Einde            *Date `json:"einde,omitempty"`
}

type KA_TV_Input struct {
	KENNISARTIKEL_ID            int `json:"kennisartikel_id"`
	Rel_ID                      int `json:"rel_id"`
	KENNISARTIKELTAALVARIANT_ID int `json:"kennisartikeltaalvariant_id"`
}

type KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input struct {
	KENNISARTIKELTAALVARIANT_ID int    `json:"kennisartikeltaalvariant_id"`
	Rel_ID                      int    `json:"rel_id"`
	Titel                       string `json:"titel"`
}

type KennisartikelTaalvariant_Sectie_Input struct {
	KENNISARTIKELTAALVARIANT_ID int              `json:"kennisartikeltaalvariant_id"`
	Rel_ID                      int              `json:"rel_id"`
	Type                        Kennissectietype `json:"type"`
	Inhoud                      string           `json:"inhoud"`
	Positie                     *int             `json:"positie,omitempty"`
}

type KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input struct {
	KENNISARTIKELTAALVARIANT_ID int  `json:"kennisartikeltaalvariant_id"`
	Rel_ID                      int  `json:"rel_id"`
	Taal                        Taal `json:"taal"`
}

type Trefwoord_TrefwoordTaalvariant_Input struct {
	TREFWOORD_ID int    `json:"trefwoord_id"`
	Rel_ID       int    `json:"rel_id"`
	Woord        string `json:"woord"`
	Taal         Taal   `json:"taal"`
}
