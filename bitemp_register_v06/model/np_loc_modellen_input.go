package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type AdellijkeTitel_AdellijkeTitelTitel_Input struct {
	ADELLIJKETITEL_ID int    `json:"adellijketitel_id"`
	Rel_ID            int    `json:"rel_id"`
	Titel             string `json:"titel"`
}

type Locatie_Adres_Input struct {
	LOCATIE_ID int     `json:"locatie_id"`
	Rel_ID     int     `json:"rel_id"`
	Straatnaam string  `json:"straatnaam"`
	Huisnummer string  `json:"huisnummer"`
	Postcode   *string `json:"postcode,omitempty"`
	Gemeente   int     `json:"gemeente"`
	Land       int     `json:"land"`
}

type Locatie_BAGlocatie_Input struct {
	LOCATIE_ID      int    `json:"locatie_id"`
	Rel_ID          int    `json:"rel_id"`
	Adresaanduiding string `json:"adresaanduiding"`
}

type NatuurlijkPersoon_Persoonsidentificatie_Input struct {
	NATUURLIJKPERSOON_ID int    `json:"natuurlijkpersoon_id"`
	Rel_ID               int    `json:"rel_id"`
	Bsn                  string `json:"bsn" schema:"datatype:BSN"`
	Ingezetene           *bool  `json:"ingezetene,omitempty"`
}

type NatuurlijkPersoon_Naam_Input struct {
	NATUURLIJKPERSOON_ID int     `json:"natuurlijkpersoon_id"`
	Rel_ID               int     `json:"rel_id"`
	Voorletters          string  `json:"voorletters"`
	Roepnaam             *string `json:"roepnaam,omitempty"`
	Tussenvoegsel        *string `json:"tussenvoegsel,omitempty"`
	Achternaam           string  `json:"achternaam"`
}

type NatuurlijkPersoon_Partnernaam_Input struct {
	NATUURLIJKPERSOON_ID int    `json:"natuurlijkpersoon_id"`
	Rel_ID               int    `json:"rel_id"`
	Achternaam           string `json:"achternaam"`
}

type NatuurlijkPersoon_Naamgebruik_Input struct {
	NATUURLIJKPERSOON_ID int              `json:"natuurlijkpersoon_id"`
	Rel_ID               int              `json:"rel_id"`
	Naamgebruik          Naamgebruiksoort `json:"naamgebruik"`
}

type NatuurlijkPersoon_Burgerschap_Input struct {
	NATUURLIJKPERSOON_ID int     `json:"natuurlijkpersoon_id"`
	Rel_ID               int     `json:"rel_id"`
	Landcode             *string `json:"landcode,omitempty"`
	Nationaliteit        *string `json:"nationaliteit,omitempty"`
	Landreferentie       *int    `json:"landreferentie,omitempty"`
	// Aanvang en Einde zijn onderliggende GE's (NatuurlijkPersoon_Burgerschap_Aanvang/Einde)
	// die via de normalizer als aparte wijzigingen worden uitgesplitst. Ze staan
	// niet als directe velden in de Input-struct.
}

type Bereikbaarheid_Input struct {
	NATUURLIJKPERSOON_ID int                  `json:"natuurlijkpersoon_id"`
	Rel_ID               int                  `json:"rel_id"`
	LOCATIE_ID           int                  `json:"locatie_id"`
	Soort                Bereikbaarheidssoort `json:"soort"`
	// Aanvang en Einde zijn onderliggende GE's (Bereikbaarheid_Aanvang/Einde)
	// die via de normalizer als aparte wijzigingen worden uitgesplitst.
}
