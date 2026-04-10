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
