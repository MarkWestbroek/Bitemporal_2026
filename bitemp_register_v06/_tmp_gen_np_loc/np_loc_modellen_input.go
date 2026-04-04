package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type AdellijkeTitelTitel_Input struct {
	ADELLIJKETITEL_ID int    `json:"adellijketitel_id"`
	Rel_ID            int    `json:"rel_id"`
	Titel             string `json:"titel"`
}

type Locatie_Adres_Input struct {
	LOCATIE_ID int        `json:"locatie_id"`
	Rel_ID     int        `json:"rel_id"`
	Straatnaam string     `json:"straatnaam"`
	Huisnummer string     `json:"huisnummer"`
	Postcode   NLPostcode `json:"postcode"`
	Plaats     string     `json:"plaats"`
	Land       int        `json:"land"`
}

type Locatie_BAGlocatie_Input struct {
	LOCATIE_ID      int    `json:"locatie_id"`
	Rel_ID          int    `json:"rel_id"`
	Adresaanduiding string `json:"adresaanduiding"`
}

type NatuurlijkPersoon_Persoonsidentificatie_Input struct {
	NATUURLIJKPERSOON_ID int   `json:"natuurlijkpersoon_id"`
	Rel_ID               int   `json:"rel_id"`
	Bsn                  BSN   `json:"bsn"`
	Ingezetene           *bool `json:"ingezetene,omitempty"`
}

type NatuurlijkPersoon_Naam_Input struct {
	NATUURLIJKPERSOON_ID int     `json:"natuurlijkpersoon_id"`
	Rel_ID               int     `json:"rel_id"`
	Voorletters          string  `json:"voorletters"`
	Roepnaam             *string `json:"roepnaam,omitempty"`
	Tussenvoegsel        *string `json:"tussenvoegsel,omitempty"`
	Achternaam           string  `json:"achternaam"`
}

type NatuurlijkPersoon_Burgerschap_Input struct {
	NATUURLIJKPERSOON_ID int    `json:"natuurlijkpersoon_id"`
	Rel_ID               int    `json:"rel_id"`
	Landcode             string `json:"landcode"`
	Nationaliteit        string `json:"nationaliteit"`
	Aanvang              *Date  `json:"aanvang,omitempty"`
	Einde                *Date  `json:"einde,omitempty"`
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

type Bereikbaarheid_Input struct {
	NATUURLIJKPERSOON_ID int                  `json:"natuurlijkpersoon_id"`
	Rel_ID               int                  `json:"rel_id"`
	LOCATIE_ID           int                  `json:"locatie_id"`
	Soort                Bereikbaarheidssoort `json:"soort"`
	Aanvang              *Date                `json:"aanvang,omitempty"`
	Einde                *Date                `json:"einde,omitempty"`
}
