package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type ApiStandaard_Naam_Input struct {
	APISTANDAARD_ID int    `json:"apistandaard_id"`
	Rel_ID          int    `json:"rel_id"`
	Naam            string `json:"naam"`
}

type Domein_DomeinGegevens_Input struct {
	DOMEIN_ID    int    `json:"domein_id"`
	Rel_ID       int    `json:"rel_id"`
	Naam         string `json:"naam"`
	Omschrijving string `json:"omschrijving"`
}

type Gemeente_GemeenteGegevens_Input struct {
	GEMEENTE_ID int    `json:"gemeente_id"`
	Rel_ID      int    `json:"rel_id"`
	Naam        string `json:"naam"`
	Code        string `json:"code"`
}

type Initiatief_Planning_Input struct {
	INITIATIEF_ID       int    `json:"initiatief_id"`
	Rel_ID              int    `json:"rel_id"`
	Planningsinfo       string `json:"planningsinfo"`
	Startdatum          Datum  `json:"startdatum"`
	ReadyForUse         Datum  `json:"ready_for_use"`
	WaarTegenaanGelopen string `json:"waar_tegenaan_gelopen"`
	Fase                Fase   `json:"fase"`
	Aanvang             *Date  `json:"aanvang,omitempty"`
	Einde               *Date  `json:"einde,omitempty"`
}

type Initiatief_Product_Input struct {
	INITIATIEF_ID int         `json:"initiatief_id"`
	Rel_ID        int         `json:"rel_id"`
	Naam          string      `json:"naam"`
	Omschrijving  *string     `json:"omschrijving,omitempty"`
	CGLaag        CGLaag      `json:"CG_laag"`
	Pitch         *string     `json:"pitch,omitempty"`
	Website       URL         `json:"website"`
	GitRepo       GitAdres    `json:"git_repo"`
	Type          Producttype `json:"type"`
	Aanvang       *Date       `json:"aanvang,omitempty"`
	Einde         *Date       `json:"einde,omitempty"`
}

type Initiatief_Bijdrage_Input struct {
	INITIATIEF_ID int          `json:"initiatief_id"`
	Rel_ID        int          `json:"rel_id"`
	TypeBijdrage  Bijdragetype `json:"type_bijdrage"`
	Schaal        Schaal       `json:"schaal"`
	Toelichting   string       `json:"toelichting"`
	Aanvang       *Date        `json:"aanvang,omitempty"`
	Einde         *Date        `json:"einde,omitempty"`
}

type Initiatief_AnderDomein_Input struct {
	INITIATIEF_ID int     `json:"initiatief_id"`
	Rel_ID        int     `json:"rel_id"`
	Domein        *string `json:"domein,omitempty"`
}

type Initiatief_AndersDanGemeente_Input struct {
	INITIATIEF_ID     int     `json:"initiatief_id"`
	Rel_ID            int     `json:"rel_id"`
	AndersDanGemeente *string `json:"andersDanGemeente,omitempty"`
}

type Initiatief_AndereAPIStandaard_Input struct {
	INITIATIEF_ID int     `json:"initiatief_id"`
	Rel_ID        int     `json:"rel_id"`
	ApiStandaard  *string `json:"api_standaard,omitempty"`
}

type Initiatief_OrganisatieInfo_Input struct {
	INITIATIEF_ID int    `json:"initiatief_id"`
	Rel_ID        int    `json:"rel_id"`
	Informatie    string `json:"informatie"`
}

type InitiatiefGemeente_Input struct {
	INITIATIEF_ID int         `json:"initiatief_id"`
	Rel_ID        int         `json:"rel_id"`
	GEMEENTE_ID   int         `json:"gemeente_id"`
	Rol           Gemeenterol `json:"rol"`
}

type InitiatiefDomein_Input struct {
	INITIATIEF_ID int `json:"initiatief_id"`
	Rel_ID        int `json:"rel_id"`
	DOMEIN_ID     int `json:"domein_id"`
}

type InitiatiefAPIStandaard_Input struct {
	INITIATIEF_ID   int `json:"initiatief_id"`
	Rel_ID          int `json:"rel_id"`
	APISTANDAARD_ID int `json:"apistandaard_id"`
}

type InitiatiefOrganisatie_Input struct {
	INITIATIEF_ID  int             `json:"initiatief_id"`
	Rel_ID         int             `json:"rel_id"`
	ORGANISATIE_ID int             `json:"organisatie_id"`
	Rol            *Organisatierol `json:"rol,omitempty"`
}

type Organisatie_Contactgegevens_Input struct {
	ORGANISATIE_ID int            `json:"organisatie_id"`
	Rel_ID         int            `json:"rel_id"`
	Url            URL            `json:"url"`
	Email          Emailadres     `json:"email"`
	Telefoonnummer Telefoonnummer `json:"telefoonnummer"`
}

type Organisatie_Organisatienaam_Input struct {
	ORGANISATIE_ID int    `json:"organisatie_id"`
	Rel_ID         int    `json:"rel_id"`
	Naam           string `json:"naam"`
}

type Organisatie_BetrokkenOrganisatietype_Input struct {
	ORGANISATIE_ID int `json:"organisatie_id"`
	Rel_ID         int `json:"rel_id"`
}

type Contactpersoon_Input struct {
	ORGANISATIE_ID int    `json:"organisatie_id"`
	Rel_ID         int    `json:"rel_id"`
	PERSOON_ID     int    `json:"persoon_id"`
	Rol            string `json:"rol"`
}

type Persoon_Contactgegevens_Input struct {
	PERSOON_ID     int            `json:"persoon_id"`
	Rel_ID         int            `json:"rel_id"`
	Email          Emailadres     `json:"email"`
	Telefoonnummer Telefoonnummer `json:"telefoonnummer"`
}

type Persoon_Persoonnaam_Input struct {
	PERSOON_ID int    `json:"persoon_id"`
	Rel_ID     int    `json:"rel_id"`
	Naam       string `json:"naam"`
}
