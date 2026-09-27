package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type FormulierDefinitie_Meta_Input struct {
	FORMULIERDEFINITIE_ID int                      `json:"formulierdefinitie_id"`
	Rel_ID                int                      `json:"rel_id"`
	Naam                  string                   `json:"naam"`
	Code                  *string                  `json:"code,omitempty" schema:"uniek=entiteit"`
	Beschrijving          string                   `json:"beschrijving"`
	Doeltype              string                   `json:"doeltype"`
	Status                FormulierDefinitieStatus `json:"status" schema:"enum=FormulierDefinitieStatus"`
	IsStandaard           *bool                    `json:"is_standaard,omitempty"`
}

type FormulierDefinitie_Layout_Input struct {
	FORMULIERDEFINITIE_ID int    `json:"formulierdefinitie_id"`
	Rel_ID                int    `json:"rel_id"`
	LayoutJson            string `json:"layout_json"`
	DefinitieVersie       Versie `json:"definitie_versie" schema:"datatype:Versie"`
}

type WeergaveDefinitie_Meta_Input struct {
	WEERGAVEDEFINITIE_ID int                     `json:"weergavedefinitie_id"`
	Rel_ID               int                     `json:"rel_id"`
	Naam                 string                  `json:"naam"`
	Code                 *string                 `json:"code,omitempty" schema:"uniek=entiteit"`
	Beschrijving         string                  `json:"beschrijving"`
	Doeltype             string                  `json:"doeltype"`
	Status               WeergaveDefinitieStatus `json:"status" schema:"enum=WeergaveDefinitieStatus"`
	IsStandaard          *bool                   `json:"is_standaard,omitempty"`
}

type WeergaveDefinitie_TabelConfig_Input struct {
	WEERGAVEDEFINITIE_ID int    `json:"weergavedefinitie_id"`
	Rel_ID               int    `json:"rel_id"`
	TabelConfigJson      string `json:"tabel_config_json"`
	DefinitieVersie      Versie `json:"definitie_versie" schema:"datatype:Versie"`
}

type WeergaveDefinitie_DetailTemplate_Input struct {
	WEERGAVEDEFINITIE_ID int    `json:"weergavedefinitie_id"`
	Rel_ID               int    `json:"rel_id"`
	TemplateTekst        string `json:"template_tekst"`
	DefinitieVersie      Versie `json:"definitie_versie" schema:"datatype:Versie"`
}

type QueryDefinitie_QuerydefinitieNaam_Input struct {
	QUERYDEFINITIE_ID int    `json:"querydefinitie_id"`
	Rel_ID            int    `json:"rel_id"`
	Naam              string `json:"naam"`
}

type QueryDefinitie_QuerydefinitieBeschrijving_Input struct {
	QUERYDEFINITIE_ID int    `json:"querydefinitie_id"`
	Rel_ID            int    `json:"rel_id"`
	Beschrijving      string `json:"beschrijving"`
}

type QueryDefinitie_QuerydefinitieStatus_Input struct {
	QUERYDEFINITIE_ID int                  `json:"querydefinitie_id"`
	Rel_ID            int                  `json:"rel_id"`
	Status            QueryDefinitieStatus `json:"status" schema:"enum=QueryDefinitieStatus"`
	Reden             *string              `json:"reden,omitempty"`
	Aanvang           *Date                `json:"aanvang,omitempty"`
	Einde             *Date                `json:"einde,omitempty"`
}

type QueryDefinitie_QuerydefinitieToegankelijkheid_Input struct {
	QUERYDEFINITIE_ID int                            `json:"querydefinitie_id"`
	Rel_ID            int                            `json:"rel_id"`
	Toegankelijkheid  QueryDefinitieToegankelijkheid `json:"toegankelijkheid" schema:"enum=QueryDefinitieToegankelijkheid"`
	Aanvang           *Date                          `json:"aanvang,omitempty"`
	Einde             *Date                          `json:"einde,omitempty"`
}

type QueryDefinitie_QuerydefinitieDocument_Input struct {
	QUERYDEFINITIE_ID int     `json:"querydefinitie_id"`
	Rel_ID            int     `json:"rel_id"`
	GraphqlDocument   string  `json:"graphql_document"`
	DefinitieVersie   Versie  `json:"definitie_versie" schema:"datatype:Versie"`
	Toelichting       *string `json:"toelichting,omitempty"`
	Aanvang           *Date   `json:"aanvang,omitempty"`
	Einde             *Date   `json:"einde,omitempty"`
}

type NotificatieDefinitie_NotificatiedefinitieNaam_Input struct {
	NOTIFICATIEDEFINITIE_ID int     `json:"notificatiedefinitie_id"`
	Rel_ID                  int     `json:"rel_id"`
	Naam                    string  `json:"naam"`
	Beschrijving            *string `json:"beschrijving,omitempty"`
}

type NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input struct {
	NOTIFICATIEDEFINITIE_ID int                        `json:"notificatiedefinitie_id"`
	Rel_ID                  int                        `json:"rel_id"`
	Doeltype                string                     `json:"doeltype"`
	Registratietype         NotificatieRegistratietype `json:"registratietype" schema:"enum=NotificatieRegistratietype"`
	Bron                    *string                    `json:"bron,omitempty"`
	Filter                  *string                    `json:"filter,omitempty"`
	Aanvang                 *Date                      `json:"aanvang,omitempty"`
	Einde                   *Date                      `json:"einde,omitempty"`
}

type NotificatieDefinitie_NotificatiedefinitieAbonnee_Input struct {
	NOTIFICATIEDEFINITIE_ID int               `json:"notificatiedefinitie_id"`
	Rel_ID                  int               `json:"rel_id"`
	Kanaal                  NotificatieKanaal `json:"kanaal" schema:"enum=NotificatieKanaal"`
	Adres                   string            `json:"adres"`
	Geheim                  *string           `json:"geheim,omitempty"`
	Aanvang                 *Date             `json:"aanvang,omitempty"`
	Einde                   *Date             `json:"einde,omitempty"`
}

type NotificatieDefinitie_NotificatiedefinitieInhoud_Input struct {
	NOTIFICATIEDEFINITIE_ID int     `json:"notificatiedefinitie_id"`
	Rel_ID                  int     `json:"rel_id"`
	Onderwerp               *string `json:"onderwerp,omitempty"`
	Tekst                   *string `json:"tekst,omitempty"`
	Querydefinitie          *string `json:"querydefinitie,omitempty"`
}

type NotificatieDefinitie_NotificatiedefinitieStatus_Input struct {
	NOTIFICATIEDEFINITIE_ID int                        `json:"notificatiedefinitie_id"`
	Rel_ID                  int                        `json:"rel_id"`
	Status                  NotificatieDefinitieStatus `json:"status" schema:"enum=NotificatieDefinitieStatus"`
	Reden                   *string                    `json:"reden,omitempty"`
	Aanvang                 *Date                      `json:"aanvang,omitempty"`
	Einde                   *Date                      `json:"einde,omitempty"`
}

type DashboardDefinitie_DashboarddefinitieNaam_Input struct {
	DASHBOARDDEFINITIE_ID int     `json:"dashboarddefinitie_id"`
	Rel_ID                int     `json:"rel_id"`
	Naam                  string  `json:"naam"`
	Beschrijving          *string `json:"beschrijving,omitempty"`
}

type DashboardDefinitie_DashboarddefinitieTegel_Input struct {
	DASHBOARDDEFINITIE_ID int               `json:"dashboarddefinitie_id"`
	Rel_ID                int               `json:"rel_id"`
	Titel                 string            `json:"titel"`
	Querydefinitie        string            `json:"querydefinitie"`
	Weergave              DashboardWeergave `json:"weergave" schema:"enum=DashboardWeergave"`
	Kolommen              *string           `json:"kolommen,omitempty"`
	Variabelen            *string           `json:"variabelen,omitempty"`
	Volgorde              *int              `json:"volgorde,omitempty"`
	Aanvang               *Date             `json:"aanvang,omitempty"`
	Einde                 *Date             `json:"einde,omitempty"`
}

type DashboardDefinitie_DashboarddefinitieStatus_Input struct {
	DASHBOARDDEFINITIE_ID int                      `json:"dashboarddefinitie_id"`
	Rel_ID                int                      `json:"rel_id"`
	Status                DashboardDefinitieStatus `json:"status" schema:"enum=DashboardDefinitieStatus"`
	Reden                 *string                  `json:"reden,omitempty"`
	Aanvang               *Date                    `json:"aanvang,omitempty"`
	Einde                 *Date                    `json:"einde,omitempty"`
}

type LijstDefinitie_Meta_Input struct {
	LIJSTDEFINITIE_ID int                  `json:"lijstdefinitie_id"`
	Rel_ID            int                  `json:"rel_id"`
	Naam              string               `json:"naam"`
	Code              *string              `json:"code,omitempty" schema:"uniek=entiteit"`
	Beschrijving      string               `json:"beschrijving"`
	Doeltype          string               `json:"doeltype"`
	Status            LijstDefinitieStatus `json:"status" schema:"enum=LijstDefinitieStatus"`
	IsStandaard       *bool                `json:"is_standaard,omitempty"`
}

type LijstDefinitie_Lijstconfig_Input struct {
	LIJSTDEFINITIE_ID int     `json:"lijstdefinitie_id"`
	Rel_ID            int     `json:"rel_id"`
	LijstConfigJson   string  `json:"lijst_config_json"`
	Formulier         *string `json:"formulier,omitempty"`
	FormulierKiesbaar *bool   `json:"formulier_kiesbaar,omitempty"`
	DefinitieVersie   Versie  `json:"definitie_versie" schema:"datatype:Versie"`
}
