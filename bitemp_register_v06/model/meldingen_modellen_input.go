package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type Melding_MeldingInhoud_Input struct {
	MELDING_ID   int          `json:"melding_id"`
	Rel_ID       int          `json:"rel_id"`
	Soort        Meldingsoort `json:"soort" schema:"enum=Meldingsoort"`
	Titel        KorteTekst   `json:"titel" schema:"datatype:KorteTekst"`
	Beschrijving *string      `json:"beschrijving,omitempty" schema:"datatype:LangeTekst"`
}

type Melding_MeldingContext_Input struct {
	MELDING_ID   int     `json:"melding_id"`
	Rel_ID       int     `json:"rel_id"`
	Studioversie *string `json:"studioversie,omitempty" schema:"datatype:KorteTekst"`
	Activiteit   *string `json:"activiteit,omitempty" schema:"datatype:KorteTekst"`
	Plek         *string `json:"plek,omitempty" schema:"datatype:KorteTekst"`
	Projectid    *string `json:"projectid,omitempty" schema:"datatype:KorteTekst"`
	Pad          *string `json:"pad,omitempty" schema:"datatype:KorteTekst"`
	Onderwerpid  *string `json:"onderwerpid,omitempty" schema:"datatype:KorteTekst"`
	Browser      *string `json:"browser,omitempty" schema:"datatype:KorteTekst"`
}

type Melding_MeldingBijlage_Input struct {
	MELDING_ID   int     `json:"melding_id"`
	Rel_ID       int     `json:"rel_id"`
	Bestand      Bestand `json:"bestand" schema:"datatype:Bestand"`
	Omschrijving *string `json:"omschrijving,omitempty" schema:"datatype:KorteTekst"`
}

type Melding_MeldingStatus_Input struct {
	MELDING_ID  int           `json:"melding_id"`
	Rel_ID      int           `json:"rel_id"`
	Status      Meldingstatus `json:"status" schema:"enum=Meldingstatus"`
	Toelichting *string       `json:"toelichting,omitempty" schema:"datatype:LangeTekst"`
	Aanvang     *Date         `json:"aanvang,omitempty"`
	Einde       *Date         `json:"einde,omitempty"`
}

type Melding_MeldingPrioriteit_Input struct {
	MELDING_ID int               `json:"melding_id"`
	Rel_ID     int               `json:"rel_id"`
	Prioriteit Meldingprioriteit `json:"prioriteit" schema:"enum=Meldingprioriteit"`
}

type Melding_MeldingReactie_Input struct {
	MELDING_ID int        `json:"melding_id"`
	Rel_ID     int        `json:"rel_id"`
	Tekst      LangeTekst `json:"tekst" schema:"datatype:LangeTekst"`
	Auteur     KorteTekst `json:"auteur" schema:"datatype:KorteTekst"`
}

type MeldingMelder_Input struct {
	MELDING_ID   int `json:"melding_id"`
	Rel_ID       int `json:"rel_id"`
	GEBRUIKER_ID int `json:"gebruiker_id"`
}

type MeldingBehandelaar_Input struct {
	MELDING_ID   int   `json:"melding_id"`
	Rel_ID       int   `json:"rel_id"`
	GEBRUIKER_ID int   `json:"gebruiker_id"`
	Aanvang      *Date `json:"aanvang,omitempty"`
	Einde        *Date `json:"einde,omitempty"`
}
