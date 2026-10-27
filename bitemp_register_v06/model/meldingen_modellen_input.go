package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

type Melding_MeldingInhoud_Input struct {
	MELDING_ID   int          `json:"melding_id"`
	Rel_ID       int          `json:"rel_id"`
	Soort        Meldingsoort `json:"soort" schema:"enum=Meldingsoort"`
	Titel        KorteTekst   `json:"titel" schema:"datatype:KorteTekst" schema_desc:"Eén regel: wat ging er mis of wat wil je?"`
	Beschrijving *string      `json:"beschrijving,omitempty" schema:"datatype:LangeTekst" schema_desc:"Wat deed je, wat verwachtte je, wat gebeurde er?"`
}

type Melding_MeldingContext_Input struct {
	MELDING_ID   int     `json:"melding_id"`
	Rel_ID       int     `json:"rel_id"`
	Studioversie *string `json:"studioversie,omitempty" schema:"datatype:KorteTekst" schema_desc:"Bv. studio 0.19.0 / api 0.14.0."`
	Activiteit   *string `json:"activiteit,omitempty" schema:"datatype:KorteTekst" schema_desc:"Actieve activiteit en profiel, bv. modelleren / usecase05."`
	Plek         *string `json:"plek,omitempty" schema:"datatype:KorteTekst" schema_desc:"Wat er onder de Alt-klik zat: het pad in de interface (paneel, knop, element-id)."`
	Projectid    *string `json:"projectid,omitempty" schema:"datatype:KorteTekst" schema_desc:"Het open Studio-project (alleen het id, geen inhoud)."`
	Pad          *string `json:"pad,omitempty" schema:"datatype:KorteTekst" schema_desc:"Waar het over gaat in de projectboom: map/map/element (bij rechtsklik of de selectie). Leesbaar; verandert bij hernoemen of verplaatsen."`
	Onderwerpid  *string `json:"onderwerpid,omitempty" schema:"datatype:KorteTekst" schema_desc:"Het stabiele id van dat element, diagram of map in het project (bij EA-import afgeleid van de EA-GUID). Verandert niet bij hernoemen of verplaatsen."`
	Browser      *string `json:"browser,omitempty" schema:"datatype:KorteTekst" schema_desc:"Browser, besturingssysteem en venstermaat."`
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
	Toelichting *string       `json:"toelichting,omitempty" schema:"datatype:LangeTekst" schema_desc:"Antwoord aan de melder: waarom afgewezen, in welke versie opgelost, of bij status dubbel: van welke melding (\"dubbel van #12\")."`
	Aanvang     *time.Time    `json:"aanvang,omitempty"`
	Einde       *time.Time    `json:"einde,omitempty"`
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
	Auteur     KorteTekst `json:"auteur" schema:"datatype:KorteTekst" schema_desc:"Gebruikersnaam van wie reageerde."`
}

type MeldingMelder_Input struct {
	MELDING_ID   int `json:"melding_id"`
	Rel_ID       int `json:"rel_id"`
	GEBRUIKER_ID int `json:"gebruiker_id"`
}

type MeldingBehandelaar_Input struct {
	MELDING_ID   int        `json:"melding_id"`
	Rel_ID       int        `json:"rel_id"`
	GEBRUIKER_ID int        `json:"gebruiker_id"`
	Aanvang      *time.Time `json:"aanvang,omitempty"`
	Einde        *time.Time `json:"einde,omitempty"`
}
