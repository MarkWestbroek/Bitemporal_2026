package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type AdellijkeTitelTitel_Input struct {
	ADELLIJKETITEL_ID int    `json:"adellijketitel_id"`
	Rel_ID            int    `json:"rel_id"`
	Titel             string `json:"titel"`
}

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

type Referentielijstnaam_Input struct {
	REFERENTIELIJST_ID int    `json:"referentielijst_id"`
	Rel_ID             int    `json:"rel_id"`
	Naam               string `json:"naam"`
}

type Referentielijstomschrijving_Input struct {
	REFERENTIELIJST_ID int    `json:"referentielijst_id"`
	Rel_ID             int    `json:"rel_id"`
	Omschrijving       string `json:"omschrijving"`
}

type ReferentielijstVisibility_Input struct {
	REFERENTIELIJST_ID int    `json:"referentielijst_id"`
	Rel_ID             int    `json:"rel_id"`
	Domein             string `json:"domein"`
}

type ReferentielijstInternetadres_Input struct {
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
