package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type Gebruiker_GebruikerIdentiteit_Input struct {
	GEBRUIKER_ID   int        `json:"gebruiker_id"`
	Rel_ID         int        `json:"rel_id"`
	Gebruikersnaam string     `json:"gebruikersnaam" schema:"uniek=entiteit"`
	Weergavenaam   KorteTekst `json:"weergavenaam" schema:"datatype:KorteTekst"`
	Email          Emailadres `json:"email" schema:"datatype:Emailadres"`
}

type Gebruiker_GebruikerStatus_Input struct {
	GEBRUIKER_ID int              `json:"gebruiker_id"`
	Rel_ID       int              `json:"rel_id"`
	Status       Gebruikersstatus `json:"status" schema:"enum=Gebruikersstatus"`
	Toelichting  *string          `json:"toelichting,omitempty" schema:"datatype:LangeTekst"`
	Aanvang      *Date            `json:"aanvang,omitempty"`
	Einde        *Date            `json:"einde,omitempty"`
}

type Gebruiker_GebruikerRoltoewijzing_Input struct {
	GEBRUIKER_ID int           `json:"gebruiker_id"`
	Rel_ID       int           `json:"rel_id"`
	Rol          Gebruikersrol `json:"rol" schema:"enum=Gebruikersrol"`
	Domein       *string       `json:"domein,omitempty" schema:"datatype:KorteTekst"`
	Toelichting  *string       `json:"toelichting,omitempty" schema:"datatype:LangeTekst"`
	Aanvang      *Date         `json:"aanvang,omitempty"`
	Einde        *Date         `json:"einde,omitempty"`
}
