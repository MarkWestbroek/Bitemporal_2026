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
	Plaats     *string `json:"plaats,omitempty"`
	Land       int     `json:"land"`
}

type Locatie_BAGlocatie_Input struct {
	LOCATIE_ID      int    `json:"locatie_id"`
	Rel_ID          int    `json:"rel_id"`
	Adresaanduiding string `json:"adresaanduiding"`
}

type Gebiedsligging_Input struct {
	LOCATIE_ID      int `json:"locatie_id"`
	Rel_ID          int `json:"rel_id"`
	GEMEENTEDEEL_ID int `json:"gemeentedeel_id"`
	// Aanvang en Einde zijn onderliggende GE's (Gebiedsligging_Aanvang/Einde)
	// die via de normalizer als aparte wijzigingen worden uitgesplitst. Ze staan
	// niet als directe velden in de Input-struct.
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

type NatuurlijkPersoon_Geslacht_Input struct {
	NATUURLIJKPERSOON_ID int                 `json:"natuurlijkpersoon_id"`
	Rel_ID               int                 `json:"rel_id"`
	Geslacht             Geslachtsaanduiding `json:"geslacht" schema:"enum=Geslachtsaanduiding"`
}

type NatuurlijkPersoon_Aanspraak_Input struct {
	NATUURLIJKPERSOON_ID int             `json:"natuurlijkpersoon_id"`
	Rel_ID               int             `json:"rel_id"`
	Aanspreektitel       *Aanspreektitel `json:"aanspreektitel,omitempty" schema:"enum=Aanspreektitel"`
	FormeelAanspreken    *bool           `json:"formeelAanspreken,omitempty"`
}

type Bereikbaarheid_Input struct {
	NATUURLIJKPERSOON_ID int                  `json:"natuurlijkpersoon_id"`
	Rel_ID               int                  `json:"rel_id"`
	LOCATIE_ID           int                  `json:"locatie_id"`
	Soort                Bereikbaarheidssoort `json:"soort"`
	// Aanvang en Einde zijn onderliggende GE's (Bereikbaarheid_Aanvang/Einde)
	// die via de normalizer als aparte wijzigingen worden uitgesplitst. Ze staan
	// niet als directe velden in de Input-struct.
}

type Woonlocatie_Input struct {
	NATUURLIJKPERSOON_ID int `json:"natuurlijkpersoon_id"`
	Rel_ID               int `json:"rel_id"`
	LOCATIE_ID           int `json:"locatie_id"`
	// Aanvang en Einde zijn onderliggende GE's (Woonlocatie_Aanvang/Einde)
	// die via de normalizer als aparte wijzigingen worden uitgesplitst. Ze staan
	// niet als directe velden in de Input-struct.
}
