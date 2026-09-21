package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type Afdeling_Afdelingsnaam_Input struct {
	AFDELING_ID int    `json:"afdeling_id"`
	Rel_ID      int    `json:"rel_id"`
	Naam        string `json:"naam"`
}

type Afdelingsorganisatie_Input struct {
	AFDELING_ID    int `json:"afdeling_id"`
	Rel_ID         int `json:"rel_id"`
	ORGANISATIE_ID int `json:"organisatie_id"`
	// Aanvang en Einde zijn onderliggende GE's (Afdelingsorganisatie_Aanvang/Einde)
	// die via de normalizer als aparte wijzigingen worden uitgesplitst. Ze staan
	// niet als directe velden in de Input-struct.
}

type Medewerker_Medewerkernaam_Input struct {
	MEDEWERKER_ID int    `json:"medewerker_id"`
	Rel_ID        int    `json:"rel_id"`
	Naam          string `json:"naam"`
}

type Medewerker_Aanstelling_Input struct {
	MEDEWERKER_ID int           `json:"medewerker_id"`
	Rel_ID        int           `json:"rel_id"`
	Functie       string        `json:"functie"`
	Rol           Medewerkerrol `json:"rol" schema:"enum=Medewerkerrol"`
}

type Medewerker_Contactkanaal_Input struct {
	MEDEWERKER_ID int         `json:"medewerker_id"`
	Rel_ID        int         `json:"rel_id"`
	Kanaal        Kanaalsoort `json:"kanaal" schema:"enum=Kanaalsoort"`
}

type Medewerkerafdeling_Input struct {
	MEDEWERKER_ID int `json:"medewerker_id"`
	Rel_ID        int `json:"rel_id"`
	AFDELING_ID   int `json:"afdeling_id"`
	// Aanvang en Einde zijn onderliggende GE's (Medewerkerafdeling_Aanvang/Einde)
	// die via de normalizer als aparte wijzigingen worden uitgesplitst. Ze staan
	// niet als directe velden in de Input-struct.
}

type Gemeentedeel_Wijkaanduiding_Input struct {
	GEMEENTEDEEL_ID int               `json:"gemeentedeel_id"`
	Rel_ID          int               `json:"rel_id"`
	Wijk            string            `json:"wijk"`
	Soort           Gemeentedeelsoort `json:"soort" schema:"enum=Gemeentedeelsoort"`
}

type Gemeentedeelgemeente_Input struct {
	GEMEENTEDEEL_ID int `json:"gemeentedeel_id"`
	Rel_ID          int `json:"rel_id"`
	GEMEENTE_ID     int `json:"gemeente_id"`
	// Aanvang en Einde zijn onderliggende GE's (Gemeentedeelgemeente_Aanvang/Einde)
	// die via de normalizer als aparte wijzigingen worden uitgesplitst. Ze staan
	// niet als directe velden in de Input-struct.
}
