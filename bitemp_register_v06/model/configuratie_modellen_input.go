package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type FormulierDefinitie_Meta_Input struct {
	FORMULIERDEFINITIE_ID int                      `json:"formulierdefinitie_id"`
	Rel_ID                int                      `json:"rel_id"`
	Naam                  string                   `json:"naam"`
	Beschrijving          string                   `json:"beschrijving"`
	Doeltype              string                   `json:"doeltype"`
	Status                FormulierDefinitieStatus `json:"status"`
	IsStandaard           *bool                    `json:"is_standaard,omitempty"`
}

type FormulierDefinitie_Layout_Input struct {
	FORMULIERDEFINITIE_ID int    `json:"formulierdefinitie_id"`
	Rel_ID                int    `json:"rel_id"`
	LayoutJson            string `json:"layout_json"`
	DefinitieVersie       Versie `json:"definitie_versie"`
}

type WeergaveDefinitie_Meta_Input struct {
	WEERGAVEDEFINITIE_ID int                     `json:"weergavedefinitie_id"`
	Rel_ID               int                     `json:"rel_id"`
	Naam                 string                  `json:"naam"`
	Beschrijving         string                  `json:"beschrijving"`
	Doeltype             string                  `json:"doeltype"`
	Status               WeergaveDefinitieStatus `json:"status"`
	IsStandaard          *bool                   `json:"is_standaard,omitempty"`
}

type WeergaveDefinitie_TabelConfig_Input struct {
	WEERGAVEDEFINITIE_ID int    `json:"weergavedefinitie_id"`
	Rel_ID               int    `json:"rel_id"`
	TabelConfigJson      string `json:"tabel_config_json"`
	DefinitieVersie      Versie `json:"definitie_versie"`
}

type WeergaveDefinitie_DetailTemplate_Input struct {
	WEERGAVEDEFINITIE_ID int    `json:"weergavedefinitie_id"`
	Rel_ID               int    `json:"rel_id"`
	TemplateTekst        string `json:"template_tekst"`
	DefinitieVersie      Versie `json:"definitie_versie"`
}

type QueryDefinitie_Meta_Input struct {
	QUERYDEFINITIE_ID int                  `json:"querydefinitie_id"`
	Rel_ID            int                  `json:"rel_id"`
	Naam              string               `json:"naam"`
	Beschrijving      string               `json:"beschrijving"`
	Doeltype          string               `json:"doeltype"`
	Status            QueryDefinitieStatus `json:"status"`
	IsPubliek         *bool                `json:"is_publiek,omitempty"`
}

type QueryDefinitie_Document_Input struct {
	QUERYDEFINITIE_ID int    `json:"querydefinitie_id"`
	Rel_ID            int    `json:"rel_id"`
	GraphqlDocument   string `json:"graphql_document"`
	DefinitieVersie   Versie `json:"definitie_versie"`
}
