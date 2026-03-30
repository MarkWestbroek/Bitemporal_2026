package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type Landcode_Input struct {
	LAND_ID int    `json:"land_id"`
	Rel_ID  int    `json:"rel_id"`
	Code    string `json:"code"`
	Aanvang *Date  `json:"aanvang,omitempty"`
	Einde   *Date  `json:"einde,omitempty"`
}

type Landnaam_Input struct {
	LAND_ID int    `json:"land_id"`
	Rel_ID  int    `json:"rel_id"`
	Naam    string `json:"naam"`
	Aanvang *Date  `json:"aanvang,omitempty"`
	Einde   *Date  `json:"einde,omitempty"`
}

type Locatie_Adres_Input struct {
	LOCATIE_ID int    `json:"locatie_id"`
	Rel_ID     int    `json:"rel_id"`
	LocatieId  int    `json:"locatie_id"`
	Straatnaam string `json:"straatnaam"`
	Huisnummer string `json:"huisnummer"`
	Postcode   string `json:"postcode"`
	Plaats     string `json:"plaats"`
	Land       int    `json:"land"`
	Aanvang    *Date  `json:"aanvang,omitempty"`
	Einde      *Date  `json:"einde,omitempty"`
}

type Locatie_BAGlocatie_Input struct {
	LOCATIE_ID      int    `json:"locatie_id"`
	Rel_ID          int    `json:"rel_id"`
	LocatieId       int    `json:"locatie_id"`
	Adresaanduiding string `json:"adresaanduiding"`
	Aanvang         *Date  `json:"aanvang,omitempty"`
	Einde           *Date  `json:"einde,omitempty"`
}

type NatuurlijkPersoon_Persoonsidentificatie_Input struct {
	NATUURLIJKPERSOON_ID int    `json:"natuurlijkpersoon_id"`
	Rel_ID               int    `json:"rel_id"`
	NatuurlijkpersoonId  int    `json:"natuurlijkpersoon_id"`
	Bsn                  string `json:"bsn"`
	Ingezetene           *bool  `json:"ingezetene,omitempty"`
	Aanvang              *Date  `json:"aanvang,omitempty"`
	Einde                *Date  `json:"einde,omitempty"`
}

type NatuurlijkPersoon_Naam_Input struct {
	NATUURLIJKPERSOON_ID int     `json:"natuurlijkpersoon_id"`
	Rel_ID               int     `json:"rel_id"`
	NatuurlijkpersoonId  int     `json:"natuurlijkpersoon_id"`
	Voorletters          string  `json:"voorletters"`
	Roepnaam             *string `json:"roepnaam,omitempty"`
	Tussenvoegsel        *string `json:"tussenvoegsel,omitempty"`
	Achternaam           string  `json:"achternaam"`
	Aanvang              *Date   `json:"aanvang,omitempty"`
	Einde                *Date   `json:"einde,omitempty"`
}

type NatuurlijkPersoon_Burgerschap_Input struct {
	NATUURLIJKPERSOON_ID int    `json:"natuurlijkpersoon_id"`
	Rel_ID               int    `json:"rel_id"`
	NatuurlijkpersoonId  int    `json:"natuurlijkpersoon_id"`
	Landcode             string `json:"landcode"`
	Nationaliteit        string `json:"nationaliteit"`
	Aanvang              *Date  `json:"aanvang,omitempty"`
	Einde                *Date  `json:"einde,omitempty"`
}

type NatuurlijkPersoon_Partnernaam_Input struct {
	NATUURLIJKPERSOON_ID int    `json:"natuurlijkpersoon_id"`
	Rel_ID               int    `json:"rel_id"`
	NatuurlijkpersoonId  int    `json:"natuurlijkpersoon_id"`
	Achternaam           string `json:"achternaam"`
	Aanvang              *Date  `json:"aanvang,omitempty"`
	Einde                *Date  `json:"einde,omitempty"`
}

type NatuurlijkPersoon_Naamgebruik_Input struct {
	NATUURLIJKPERSOON_ID int              `json:"natuurlijkpersoon_id"`
	Rel_ID               int              `json:"rel_id"`
	NatuurlijkpersoonId  int              `json:"natuurlijkpersoon_id"`
	Naamgebruik          Naamgebruiksoort `json:"naamgebruik"`
	Aanvang              *Date            `json:"aanvang,omitempty"`
	Einde                *Date            `json:"einde,omitempty"`
}

type Bereikbaarheid_Input struct {
	NATUURLIJKPERSOON_ID int                  `json:"natuurlijkpersoon_id"`
	Rel_ID               int                  `json:"rel_id"`
	LOCATIE_ID           int                  `json:"locatie_id"`
	NatuurlijkpersoonId  int                  `json:"natuurlijkpersoon_id"`
	Soort                Bereikbaarheidssoort `json:"soort"`
	Aanvang              *Date                `json:"aanvang,omitempty"`
	Einde                *Date                `json:"einde,omitempty"`
}
