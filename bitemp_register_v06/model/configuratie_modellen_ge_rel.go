package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type FormulierDefinitieStatus string

const (
	FormulierDefinitieStatusconcept  FormulierDefinitieStatus = "concept"
	FormulierDefinitieStatusactief   FormulierDefinitieStatus = "actief"
	FormulierDefinitieStatusinactief FormulierDefinitieStatus = "inactief"
)

type WeergaveDefinitieStatus string

const (
	WeergaveDefinitieStatusconcept  WeergaveDefinitieStatus = "concept"
	WeergaveDefinitieStatusactief   WeergaveDefinitieStatus = "actief"
	WeergaveDefinitieStatusinactief WeergaveDefinitieStatus = "inactief"
)

type QueryDefinitieStatus string

const (
	QueryDefinitieStatusconcept  QueryDefinitieStatus = "concept"
	QueryDefinitieStatusactief   QueryDefinitieStatus = "actief"
	QueryDefinitieStatusinactief QueryDefinitieStatus = "inactief"
)

type QueryDefinitieToegankelijkheid string

const (
	QueryDefinitieToegankelijkheidpubliek QueryDefinitieToegankelijkheid = "publiek"
	QueryDefinitieToegankelijkheidintern  QueryDefinitieToegankelijkheid = "intern"
)

type NotificatieDefinitieStatus string

const (
	NotificatieDefinitieStatusconcept  NotificatieDefinitieStatus = "concept"
	NotificatieDefinitieStatusactief   NotificatieDefinitieStatus = "actief"
	NotificatieDefinitieStatusinactief NotificatieDefinitieStatus = "inactief"
)

type NotificatieKanaal string

const (
	NotificatieKanaalemail   NotificatieKanaal = "email"
	NotificatieKanaalwebhook NotificatieKanaal = "webhook"
)

type NotificatieRegistratietype string

const (
	NotificatieRegistratietyperegistratie    NotificatieRegistratietype = "registratie"
	NotificatieRegistratietypecorrectie      NotificatieRegistratietype = "correctie"
	NotificatieRegistratietypeongedaanmaking NotificatieRegistratietype = "ongedaanmaking"
	NotificatieRegistratietypealle           NotificatieRegistratietype = "alle"
)

// FormulierDefinitie_Meta — Metadata van de formulierdefinitie: naam, beschrijving, doeltype en status.
type FormulierDefinitie_Meta struct {
	bun.BaseModel            `bun:"table:formulierdefinitie_meta,alias:formulierdefinitie_meta"`
	FormulierDefinitie_ID    int                            `json:"formulierdefinitie_id" bun:"formulierdefinitie_id,pk" schema_desc:"ID van de FormulierDefinitie-entiteit"`
	Rel_ID                   int                            `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentFormulierDefinitie *FormulierDefinitie            `json:"-" bun:"rel:belongs-to,join:formulierdefinitie_id=id,on_delete:cascade"`
	Opvoer                   *time.Time                     `json:"opvoer,omitempty"`
	Afvoer                   *time.Time                     `json:"afvoer,omitempty"`
	Data                     []FormulierDefinitie_Meta_Data `bun:"rel:has-many,join:formulierdefinitie_id=formulierdefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// FormulierDefinitie_Meta_Data — geversioned inhoud van FormulierDefinitie_Meta.
type FormulierDefinitie_Meta_Data struct {
	bun.BaseModel         `bun:"table:formulierdefinitie_meta_data,alias:formulierdefinitie_meta_data"`
	FormulierDefinitie_ID int                      `json:"formulierdefinitie_id" bun:"formulierdefinitie_id,pk"`
	Rel_ID                int                      `json:"rel_id" bun:"rel_id,pk"`
	Versie                int64                    `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam                  string                   `json:"naam"`
	Beschrijving          string                   `json:"beschrijving"`
	Doeltype              string                   `json:"doeltype"`
	Status                FormulierDefinitieStatus `json:"status" schema:"enum=FormulierDefinitieStatus"`
	IsStandaard           *bool                    `json:"is_standaard,omitempty"`
	Opvoer                *time.Time               `json:"opvoer,omitempty"`
	Afvoer                *time.Time               `json:"afvoer,omitempty"`
}

// FormulierDefinitie_Layout — De layout-boom van het formulier als JSON-structuur. Bevat groepen, rijen, velden en conditionele elementen.
type FormulierDefinitie_Layout struct {
	bun.BaseModel            `bun:"table:formulierdefinitie_layout,alias:formulierdefinitie_layout"`
	FormulierDefinitie_ID    int                              `json:"formulierdefinitie_id" bun:"formulierdefinitie_id,pk" schema_desc:"ID van de FormulierDefinitie-entiteit"`
	Rel_ID                   int                              `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentFormulierDefinitie *FormulierDefinitie              `json:"-" bun:"rel:belongs-to,join:formulierdefinitie_id=id,on_delete:cascade"`
	Opvoer                   *time.Time                       `json:"opvoer,omitempty"`
	Afvoer                   *time.Time                       `json:"afvoer,omitempty"`
	Data                     []FormulierDefinitie_Layout_Data `bun:"rel:has-many,join:formulierdefinitie_id=formulierdefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// FormulierDefinitie_Layout_Data — geversioned inhoud van FormulierDefinitie_Layout.
type FormulierDefinitie_Layout_Data struct {
	bun.BaseModel         `bun:"table:formulierdefinitie_layout_data,alias:formulierdefinitie_layout_data"`
	FormulierDefinitie_ID int        `json:"formulierdefinitie_id" bun:"formulierdefinitie_id,pk"`
	Rel_ID                int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	LayoutJson            string     `json:"layout_json"`
	DefinitieVersie       Versie     `json:"definitie_versie" schema:"datatype:Versie"`
	Opvoer                *time.Time `json:"opvoer,omitempty"`
	Afvoer                *time.Time `json:"afvoer,omitempty"`
}

// WeergaveDefinitie_Meta — Metadata van de weergavedefinitie: naam, beschrijving, doeltype en status.
type WeergaveDefinitie_Meta struct {
	bun.BaseModel           `bun:"table:weergavedefinitie_meta,alias:weergavedefinitie_meta"`
	WeergaveDefinitie_ID    int                           `json:"weergavedefinitie_id" bun:"weergavedefinitie_id,pk" schema_desc:"ID van de WeergaveDefinitie-entiteit"`
	Rel_ID                  int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentWeergaveDefinitie *WeergaveDefinitie            `json:"-" bun:"rel:belongs-to,join:weergavedefinitie_id=id,on_delete:cascade"`
	Opvoer                  *time.Time                    `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                    `json:"afvoer,omitempty"`
	Data                    []WeergaveDefinitie_Meta_Data `bun:"rel:has-many,join:weergavedefinitie_id=weergavedefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// WeergaveDefinitie_Meta_Data — geversioned inhoud van WeergaveDefinitie_Meta.
type WeergaveDefinitie_Meta_Data struct {
	bun.BaseModel        `bun:"table:weergavedefinitie_meta_data,alias:weergavedefinitie_meta_data"`
	WeergaveDefinitie_ID int                     `json:"weergavedefinitie_id" bun:"weergavedefinitie_id,pk"`
	Rel_ID               int                     `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64                   `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam                 string                  `json:"naam"`
	Beschrijving         string                  `json:"beschrijving"`
	Doeltype             string                  `json:"doeltype"`
	Status               WeergaveDefinitieStatus `json:"status" schema:"enum=WeergaveDefinitieStatus"`
	IsStandaard          *bool                   `json:"is_standaard,omitempty"`
	Opvoer               *time.Time              `json:"opvoer,omitempty"`
	Afvoer               *time.Time              `json:"afvoer,omitempty"`
}

// WeergaveDefinitie_TabelConfig — Configuratie van de tabelweergave: kolomdefinities (veldpad, label, breedte, sorteerbaar, filterbaar), standaardsortering en aantal rijen per pagina.
type WeergaveDefinitie_TabelConfig struct {
	bun.BaseModel           `bun:"table:weergavedefinitie_tabelconfig,alias:weergavedefinitie_tabelconfig"`
	WeergaveDefinitie_ID    int                                  `json:"weergavedefinitie_id" bun:"weergavedefinitie_id,pk" schema_desc:"ID van de WeergaveDefinitie-entiteit"`
	Rel_ID                  int                                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentWeergaveDefinitie *WeergaveDefinitie                   `json:"-" bun:"rel:belongs-to,join:weergavedefinitie_id=id,on_delete:cascade"`
	Opvoer                  *time.Time                           `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                           `json:"afvoer,omitempty"`
	Data                    []WeergaveDefinitie_TabelConfig_Data `bun:"rel:has-many,join:weergavedefinitie_id=weergavedefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// WeergaveDefinitie_TabelConfig_Data — geversioned inhoud van WeergaveDefinitie_TabelConfig.
type WeergaveDefinitie_TabelConfig_Data struct {
	bun.BaseModel        `bun:"table:weergavedefinitie_tabelconfig_data,alias:weergavedefinitie_tabelconfig_data"`
	WeergaveDefinitie_ID int        `json:"weergavedefinitie_id" bun:"weergavedefinitie_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	TabelConfigJson      string     `json:"tabel_config_json"`
	DefinitieVersie      Versie     `json:"definitie_versie" schema:"datatype:Versie"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// WeergaveDefinitie_DetailTemplate — Template voor de detail-pagina met {{veldpad}} inserts. Wordt gerenderd als read-only publicatieweergave.
type WeergaveDefinitie_DetailTemplate struct {
	bun.BaseModel           `bun:"table:weergavedefinitie_detailtemplate,alias:weergavedefinitie_detailtemplate"`
	WeergaveDefinitie_ID    int                                     `json:"weergavedefinitie_id" bun:"weergavedefinitie_id,pk" schema_desc:"ID van de WeergaveDefinitie-entiteit"`
	Rel_ID                  int                                     `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentWeergaveDefinitie *WeergaveDefinitie                      `json:"-" bun:"rel:belongs-to,join:weergavedefinitie_id=id,on_delete:cascade"`
	Opvoer                  *time.Time                              `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                              `json:"afvoer,omitempty"`
	Data                    []WeergaveDefinitie_DetailTemplate_Data `bun:"rel:has-many,join:weergavedefinitie_id=weergavedefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// WeergaveDefinitie_DetailTemplate_Data — geversioned inhoud van WeergaveDefinitie_DetailTemplate.
type WeergaveDefinitie_DetailTemplate_Data struct {
	bun.BaseModel        `bun:"table:weergavedefinitie_detailtemplate_data,alias:weergavedefinitie_detailtemplate_data"`
	WeergaveDefinitie_ID int        `json:"weergavedefinitie_id" bun:"weergavedefinitie_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	TemplateTekst        string     `json:"template_tekst"`
	DefinitieVersie      Versie     `json:"definitie_versie" schema:"datatype:Versie"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieNaam — Naam en beschrijving van de notificatiedefinitie (het abonnement in NORA-termen).
type NotificatieDefinitie_NotificatiedefinitieNaam struct {
	bun.BaseModel              `bun:"table:notificatiedefinitie_notificatiedefinitienaam,alias:notificatiedefinitie_notificatiedefinitienaam"`
	NotificatieDefinitie_ID    int                                                  `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk" schema_desc:"ID van de NotificatieDefinitie-entiteit"`
	Rel_ID                     int                                                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNotificatieDefinitie *NotificatieDefinitie                                `json:"-" bun:"rel:belongs-to,join:notificatiedefinitie_id=id,on_delete:cascade"`
	Opvoer                     *time.Time                                           `json:"opvoer,omitempty"`
	Afvoer                     *time.Time                                           `json:"afvoer,omitempty"`
	Data                       []NotificatieDefinitie_NotificatiedefinitieNaam_Data `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieNaam_Data — geversioned inhoud van NotificatieDefinitie_NotificatiedefinitieNaam.
type NotificatieDefinitie_NotificatiedefinitieNaam_Data struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitienaam_data,alias:notificatiedefinitie_notificatiedefinitienaam_data"`
	NotificatieDefinitie_ID int        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam                    string     `json:"naam"`
	Beschrijving            *string    `json:"beschrijving,omitempty"`
	Opvoer                  *time.Time `json:"opvoer,omitempty"`
	Afvoer                  *time.Time `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieGebeurtenis — Op welke gebeurtenis het abonnement reageert: doeltype (entiteit), registratietype (registratie/correctie/ongedaanmaking/alle), optioneel de bron van de registratie (bv. aanmeldformulier) en optioneel een filter in de GraphQL-filtertaal (JSON) dat de geraakte entiteit moet doorstaan. Het CloudEvents-type wordt hieruit afgeleid (nl.<databron>.<entiteit>.<gebeurtenis>). Materieel: te stagen.
type NotificatieDefinitie_NotificatiedefinitieGebeurtenis struct {
	bun.BaseModel              `bun:"table:notificatiedefinitie_notificatiedefinitiegebeurtenis,alias:notificatiedefinitie_notificatiedefinitiegebeurtenis"`
	NotificatieDefinitie_ID    int                                                            `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk" schema_desc:"ID van de NotificatieDefinitie-entiteit"`
	Rel_ID                     int                                                            `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNotificatieDefinitie *NotificatieDefinitie                                          `json:"-" bun:"rel:belongs-to,join:notificatiedefinitie_id=id,on_delete:cascade"`
	Opvoer                     *time.Time                                                     `json:"opvoer,omitempty"`
	Afvoer                     *time.Time                                                     `json:"afvoer,omitempty"`
	Data                       []NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data    `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang                    []NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde                      []NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde   `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data — geversioned inhoud van NotificatieDefinitie_NotificatiedefinitieGebeurtenis.
type NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitiegebeurtenis_data,alias:notificatiedefinitie_notificatiedefinitiegebeurtenis_data"`
	NotificatieDefinitie_ID int                        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int                        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64                      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Doeltype                string                     `json:"doeltype"`
	Registratietype         NotificatieRegistratietype `json:"registratietype" schema:"enum=NotificatieRegistratietype"`
	Bron                    *string                    `json:"bron,omitempty"`
	Filter                  *string                    `json:"filter,omitempty"`
	Opvoer                  *time.Time                 `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                 `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang — aanvangdatum van NotificatieDefinitie_NotificatiedefinitieGebeurtenis.
type NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitiegebeurtenis_aanvang,alias:notificatiedefinitie_notificatiedefinitiegebeurtenis_aanvang"`
	NotificatieDefinitie_ID int        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                   *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer                  *time.Time `json:"opvoer,omitempty"`
	Afvoer                  *time.Time `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde — eindedatum van NotificatieDefinitie_NotificatiedefinitieGebeurtenis.
type NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitiegebeurtenis_einde,alias:notificatiedefinitie_notificatiedefinitiegebeurtenis_einde"`
	NotificatieDefinitie_ID int        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                   *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer                  *time.Time `json:"opvoer,omitempty"`
	Afvoer                  *time.Time `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieAbonnee — Een ontvanger: kanaal e-mail of webhook, het adres (e-mailadres of URL) en voor webhooks het geheim voor de HMAC-handtekening. Meervoudig: één definitie kan meerdere ontvangers hebben. Materieel.
type NotificatieDefinitie_NotificatiedefinitieAbonnee struct {
	bun.BaseModel              `bun:"table:notificatiedefinitie_notificatiedefinitieabonnee,alias:notificatiedefinitie_notificatiedefinitieabonnee"`
	NotificatieDefinitie_ID    int                                                        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk" schema_desc:"ID van de NotificatieDefinitie-entiteit"`
	Rel_ID                     int                                                        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNotificatieDefinitie *NotificatieDefinitie                                      `json:"-" bun:"rel:belongs-to,join:notificatiedefinitie_id=id,on_delete:cascade"`
	Opvoer                     *time.Time                                                 `json:"opvoer,omitempty"`
	Afvoer                     *time.Time                                                 `json:"afvoer,omitempty"`
	Data                       []NotificatieDefinitie_NotificatiedefinitieAbonnee_Data    `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang                    []NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde                      []NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde   `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieAbonnee_Data — geversioned inhoud van NotificatieDefinitie_NotificatiedefinitieAbonnee.
type NotificatieDefinitie_NotificatiedefinitieAbonnee_Data struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitieabonnee_data,alias:notificatiedefinitie_notificatiedefinitieabonnee_data"`
	NotificatieDefinitie_ID int               `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int               `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64             `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Kanaal                  NotificatieKanaal `json:"kanaal" schema:"enum=NotificatieKanaal"`
	Adres                   string            `json:"adres"`
	Geheim                  *string           `json:"geheim,omitempty"`
	Opvoer                  *time.Time        `json:"opvoer,omitempty"`
	Afvoer                  *time.Time        `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang — aanvangdatum van NotificatieDefinitie_NotificatiedefinitieAbonnee.
type NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitieabonnee_aanvang,alias:notificatiedefinitie_notificatiedefinitieabonnee_aanvang"`
	NotificatieDefinitie_ID int        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                   *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer                  *time.Time `json:"opvoer,omitempty"`
	Afvoer                  *time.Time `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde — eindedatum van NotificatieDefinitie_NotificatiedefinitieAbonnee.
type NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitieabonnee_einde,alias:notificatiedefinitie_notificatiedefinitieabonnee_einde"`
	NotificatieDefinitie_ID int        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                   *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer                  *time.Time `json:"opvoer,omitempty"`
	Afvoer                  *time.Time `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieInhoud — Inhoud van een e-mailnotificatie: onderwerp en tekst met plaatshouders ({{type}}, {{subject}}, {{id}}, {{registratieId}}, {{link}}), en/of de naam van een QueryDefinitie waarvan het resultaat (id + weergavenaam) in het bericht komt. Webhooks krijgen altijd het CloudEvents-bericht.
type NotificatieDefinitie_NotificatiedefinitieInhoud struct {
	bun.BaseModel              `bun:"table:notificatiedefinitie_notificatiedefinitieinhoud,alias:notificatiedefinitie_notificatiedefinitieinhoud"`
	NotificatieDefinitie_ID    int                                                    `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk" schema_desc:"ID van de NotificatieDefinitie-entiteit"`
	Rel_ID                     int                                                    `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNotificatieDefinitie *NotificatieDefinitie                                  `json:"-" bun:"rel:belongs-to,join:notificatiedefinitie_id=id,on_delete:cascade"`
	Opvoer                     *time.Time                                             `json:"opvoer,omitempty"`
	Afvoer                     *time.Time                                             `json:"afvoer,omitempty"`
	Data                       []NotificatieDefinitie_NotificatiedefinitieInhoud_Data `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieInhoud_Data — geversioned inhoud van NotificatieDefinitie_NotificatiedefinitieInhoud.
type NotificatieDefinitie_NotificatiedefinitieInhoud_Data struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitieinhoud_data,alias:notificatiedefinitie_notificatiedefinitieinhoud_data"`
	NotificatieDefinitie_ID int        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Onderwerp               *string    `json:"onderwerp,omitempty"`
	Tekst                   *string    `json:"tekst,omitempty"`
	Querydefinitie          *string    `json:"querydefinitie,omitempty"`
	Opvoer                  *time.Time `json:"opvoer,omitempty"`
	Afvoer                  *time.Time `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieStatus — Levenscyclus: concept = klad, niet actief; actief = er wordt genotificeerd; inactief = ingetrokken. Materieel: 'actief vanaf …' is te stagen. `reden` legt uit waarom.
type NotificatieDefinitie_NotificatiedefinitieStatus struct {
	bun.BaseModel              `bun:"table:notificatiedefinitie_notificatiedefinitiestatus,alias:notificatiedefinitie_notificatiedefinitiestatus"`
	NotificatieDefinitie_ID    int                                                       `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk" schema_desc:"ID van de NotificatieDefinitie-entiteit"`
	Rel_ID                     int                                                       `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNotificatieDefinitie *NotificatieDefinitie                                     `json:"-" bun:"rel:belongs-to,join:notificatiedefinitie_id=id,on_delete:cascade"`
	Opvoer                     *time.Time                                                `json:"opvoer,omitempty"`
	Afvoer                     *time.Time                                                `json:"afvoer,omitempty"`
	Data                       []NotificatieDefinitie_NotificatiedefinitieStatus_Data    `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang                    []NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde                      []NotificatieDefinitie_NotificatiedefinitieStatus_Einde   `bun:"rel:has-many,join:notificatiedefinitie_id=notificatiedefinitie_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieStatus_Data — geversioned inhoud van NotificatieDefinitie_NotificatiedefinitieStatus.
type NotificatieDefinitie_NotificatiedefinitieStatus_Data struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitiestatus_data,alias:notificatiedefinitie_notificatiedefinitiestatus_data"`
	NotificatieDefinitie_ID int                        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int                        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64                      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Status                  NotificatieDefinitieStatus `json:"status" schema:"enum=NotificatieDefinitieStatus"`
	Reden                   *string                    `json:"reden,omitempty"`
	Opvoer                  *time.Time                 `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                 `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang — aanvangdatum van NotificatieDefinitie_NotificatiedefinitieStatus.
type NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitiestatus_aanvang,alias:notificatiedefinitie_notificatiedefinitiestatus_aanvang"`
	NotificatieDefinitie_ID int        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                   *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer                  *time.Time `json:"opvoer,omitempty"`
	Afvoer                  *time.Time `json:"afvoer,omitempty"`
}

// NotificatieDefinitie_NotificatiedefinitieStatus_Einde — eindedatum van NotificatieDefinitie_NotificatiedefinitieStatus.
type NotificatieDefinitie_NotificatiedefinitieStatus_Einde struct {
	bun.BaseModel           `bun:"table:notificatiedefinitie_notificatiedefinitiestatus_einde,alias:notificatiedefinitie_notificatiedefinitiestatus_einde"`
	NotificatieDefinitie_ID int        `json:"notificatiedefinitie_id" bun:"notificatiedefinitie_id,pk"`
	Rel_ID                  int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                  int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                   *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer                  *time.Time `json:"opvoer,omitempty"`
	Afvoer                  *time.Time `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieNaam — De naam waarmee de frontend het document aanroept (documentId). Stabiel: dit is het gepubliceerde contract; hernoemen is een nieuwe hub.
type QueryDefinitie_QuerydefinitieNaam struct {
	bun.BaseModel        `bun:"table:querydefinitie_querydefinitienaam,alias:querydefinitie_querydefinitienaam"`
	QueryDefinitie_ID    int                                      `json:"querydefinitie_id" bun:"querydefinitie_id,pk" schema_desc:"ID van de QueryDefinitie-entiteit"`
	Rel_ID               int                                      `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentQueryDefinitie *QueryDefinitie                          `json:"-" bun:"rel:belongs-to,join:querydefinitie_id=id,on_delete:cascade"`
	Opvoer               *time.Time                               `json:"opvoer,omitempty"`
	Afvoer               *time.Time                               `json:"afvoer,omitempty"`
	Data                 []QueryDefinitie_QuerydefinitieNaam_Data `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// QueryDefinitie_QuerydefinitieNaam_Data — geversioned inhoud van QueryDefinitie_QuerydefinitieNaam.
type QueryDefinitie_QuerydefinitieNaam_Data struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitienaam_data,alias:querydefinitie_querydefinitienaam_data"`
	QueryDefinitie_ID int        `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam              string     `json:"naam"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieBeschrijving — Hoog-over beschrijving van de definitie (wat levert deze query, voor wie).
type QueryDefinitie_QuerydefinitieBeschrijving struct {
	bun.BaseModel        `bun:"table:querydefinitie_querydefinitiebeschrijving,alias:querydefinitie_querydefinitiebeschrijving"`
	QueryDefinitie_ID    int                                              `json:"querydefinitie_id" bun:"querydefinitie_id,pk" schema_desc:"ID van de QueryDefinitie-entiteit"`
	Rel_ID               int                                              `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentQueryDefinitie *QueryDefinitie                                  `json:"-" bun:"rel:belongs-to,join:querydefinitie_id=id,on_delete:cascade"`
	Opvoer               *time.Time                                       `json:"opvoer,omitempty"`
	Afvoer               *time.Time                                       `json:"afvoer,omitempty"`
	Data                 []QueryDefinitie_QuerydefinitieBeschrijving_Data `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// QueryDefinitie_QuerydefinitieBeschrijving_Data — geversioned inhoud van QueryDefinitie_QuerydefinitieBeschrijving.
type QueryDefinitie_QuerydefinitieBeschrijving_Data struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitiebeschrijving_data,alias:querydefinitie_querydefinitiebeschrijving_data"`
	QueryDefinitie_ID int        `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Beschrijving      string     `json:"beschrijving"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieStatus — Levenscyclus: concept = klad, niet opvraagbaar; actief = opvraagbaar; inactief = ingetrokken, niet meer opvraagbaar (een aanroep krijgt 'ingetrokken' i.p.v. 'onbekend'). Materieel: 'actief vanaf …' is te stagen. `reden` legt uit waarom, vanuit het oogpunt van de afnemer.
type QueryDefinitie_QuerydefinitieStatus struct {
	bun.BaseModel        `bun:"table:querydefinitie_querydefinitiestatus,alias:querydefinitie_querydefinitiestatus"`
	QueryDefinitie_ID    int                                           `json:"querydefinitie_id" bun:"querydefinitie_id,pk" schema_desc:"ID van de QueryDefinitie-entiteit"`
	Rel_ID               int                                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentQueryDefinitie *QueryDefinitie                               `json:"-" bun:"rel:belongs-to,join:querydefinitie_id=id,on_delete:cascade"`
	Opvoer               *time.Time                                    `json:"opvoer,omitempty"`
	Afvoer               *time.Time                                    `json:"afvoer,omitempty"`
	Data                 []QueryDefinitie_QuerydefinitieStatus_Data    `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang              []QueryDefinitie_QuerydefinitieStatus_Aanvang `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde                []QueryDefinitie_QuerydefinitieStatus_Einde   `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// QueryDefinitie_QuerydefinitieStatus_Data — geversioned inhoud van QueryDefinitie_QuerydefinitieStatus.
type QueryDefinitie_QuerydefinitieStatus_Data struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitiestatus_data,alias:querydefinitie_querydefinitiestatus_data"`
	QueryDefinitie_ID int                  `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int                  `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64                `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Status            QueryDefinitieStatus `json:"status" schema:"enum=QueryDefinitieStatus"`
	Reden             *string              `json:"reden,omitempty"`
	Opvoer            *time.Time           `json:"opvoer,omitempty"`
	Afvoer            *time.Time           `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieStatus_Aanvang — aanvangdatum van QueryDefinitie_QuerydefinitieStatus.
type QueryDefinitie_QuerydefinitieStatus_Aanvang struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitiestatus_aanvang,alias:querydefinitie_querydefinitiestatus_aanvang"`
	QueryDefinitie_ID int        `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum             *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieStatus_Einde — eindedatum van QueryDefinitie_QuerydefinitieStatus.
type QueryDefinitie_QuerydefinitieStatus_Einde struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitiestatus_einde,alias:querydefinitie_querydefinitiestatus_einde"`
	QueryDefinitie_ID int        `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum             *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieToegankelijkheid — Wie het document mag uitvoeren: publiek (ook anoniem) of intern (alleen met een rol). Later vervangbaar door een verwijzing naar een FTV-policy. Ontbreekt dit GE, dan geldt intern.
type QueryDefinitie_QuerydefinitieToegankelijkheid struct {
	bun.BaseModel        `bun:"table:querydefinitie_querydefinitietoegankelijkheid,alias:querydefinitie_querydefinitietoegankelijkheid"`
	QueryDefinitie_ID    int                                                     `json:"querydefinitie_id" bun:"querydefinitie_id,pk" schema_desc:"ID van de QueryDefinitie-entiteit"`
	Rel_ID               int                                                     `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentQueryDefinitie *QueryDefinitie                                         `json:"-" bun:"rel:belongs-to,join:querydefinitie_id=id,on_delete:cascade"`
	Opvoer               *time.Time                                              `json:"opvoer,omitempty"`
	Afvoer               *time.Time                                              `json:"afvoer,omitempty"`
	Data                 []QueryDefinitie_QuerydefinitieToegankelijkheid_Data    `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang              []QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde                []QueryDefinitie_QuerydefinitieToegankelijkheid_Einde   `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// QueryDefinitie_QuerydefinitieToegankelijkheid_Data — geversioned inhoud van QueryDefinitie_QuerydefinitieToegankelijkheid.
type QueryDefinitie_QuerydefinitieToegankelijkheid_Data struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitietoegankelijkheid_data,alias:querydefinitie_querydefinitietoegankelijkheid_data"`
	QueryDefinitie_ID int                            `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int                            `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64                          `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Toegankelijkheid  QueryDefinitieToegankelijkheid `json:"toegankelijkheid" schema:"enum=QueryDefinitieToegankelijkheid"`
	Opvoer            *time.Time                     `json:"opvoer,omitempty"`
	Afvoer            *time.Time                     `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang — aanvangdatum van QueryDefinitie_QuerydefinitieToegankelijkheid.
type QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitietoegankelijkheid_aanvang,alias:querydefinitie_querydefinitietoegankelijkheid_aanvang"`
	QueryDefinitie_ID int        `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum             *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieToegankelijkheid_Einde — eindedatum van QueryDefinitie_QuerydefinitieToegankelijkheid.
type QueryDefinitie_QuerydefinitieToegankelijkheid_Einde struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitietoegankelijkheid_einde,alias:querydefinitie_querydefinitietoegankelijkheid_einde"`
	QueryDefinitie_ID int        `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum             *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieDocument — Het opgeslagen GraphQL-document. Enkelvoudig: altijd precies één geldig document per naam; een oude versie is via het peiltijdstip te zien, niet via het versienummer. Materieel: een nieuwe versie is te stagen. `toelichting` beschrijft deze versie.
type QueryDefinitie_QuerydefinitieDocument struct {
	bun.BaseModel        `bun:"table:querydefinitie_querydefinitiedocument,alias:querydefinitie_querydefinitiedocument"`
	QueryDefinitie_ID    int                                             `json:"querydefinitie_id" bun:"querydefinitie_id,pk" schema_desc:"ID van de QueryDefinitie-entiteit"`
	Rel_ID               int                                             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentQueryDefinitie *QueryDefinitie                                 `json:"-" bun:"rel:belongs-to,join:querydefinitie_id=id,on_delete:cascade"`
	Opvoer               *time.Time                                      `json:"opvoer,omitempty"`
	Afvoer               *time.Time                                      `json:"afvoer,omitempty"`
	Data                 []QueryDefinitie_QuerydefinitieDocument_Data    `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang              []QueryDefinitie_QuerydefinitieDocument_Aanvang `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde                []QueryDefinitie_QuerydefinitieDocument_Einde   `bun:"rel:has-many,join:querydefinitie_id=querydefinitie_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// QueryDefinitie_QuerydefinitieDocument_Data — geversioned inhoud van QueryDefinitie_QuerydefinitieDocument.
type QueryDefinitie_QuerydefinitieDocument_Data struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitiedocument_data,alias:querydefinitie_querydefinitiedocument_data"`
	QueryDefinitie_ID int        `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	GraphqlDocument   string     `json:"graphql_document"`
	DefinitieVersie   Versie     `json:"definitie_versie" schema:"datatype:Versie"`
	Toelichting       *string    `json:"toelichting,omitempty"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieDocument_Aanvang — aanvangdatum van QueryDefinitie_QuerydefinitieDocument.
type QueryDefinitie_QuerydefinitieDocument_Aanvang struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitiedocument_aanvang,alias:querydefinitie_querydefinitiedocument_aanvang"`
	QueryDefinitie_ID int        `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum             *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

// QueryDefinitie_QuerydefinitieDocument_Einde — eindedatum van QueryDefinitie_QuerydefinitieDocument.
type QueryDefinitie_QuerydefinitieDocument_Einde struct {
	bun.BaseModel     `bun:"table:querydefinitie_querydefinitiedocument_einde,alias:querydefinitie_querydefinitiedocument_einde"`
	QueryDefinitie_ID int        `json:"querydefinitie_id" bun:"querydefinitie_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum             *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}
