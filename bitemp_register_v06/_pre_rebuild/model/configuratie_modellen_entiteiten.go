package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// FormulierDefinitie — Formulierdefinitie voor custom layouts van entiteitsformulieren. Bevat metadata (naam, status, doeltype) en een JSON layout-boom. Bitemporeel: wijzigingen zijn traceerbaar en corrigeerbaar via registraties.
type FormulierDefinitie struct {
	bun.BaseModel             `bun:"table:formulierdefinitie,alias:formulierdefinitie"`
	ID                        int                          `json:"id" bun:"id,pk"`
	Opvoer                    *time.Time                   `json:"opvoer,omitempty"`
	Afvoer                    *time.Time                   `json:"afvoer,omitempty"`
	FormulierDefinitieMetas   []FormulierDefinitie_Meta    `bun:"rel:has-many,join:id=formulierdefinitie_id" json:"formulier_definitie_metas,omitempty"`
	FormulierDefinitieLayouts []FormulierDefinitie_Layout  `bun:"rel:has-many,join:id=formulierdefinitie_id" json:"formulier_definitie_layouts,omitempty"`
	Aanvang                   []FormulierDefinitie_Aanvang `bun:"rel:has-many,join:id=formulierdefinitie_id" json:"aanvang,omitempty"`
	Einde                     []FormulierDefinitie_Einde   `bun:"rel:has-many,join:id=formulierdefinitie_id" json:"einde,omitempty"`
}

// FormulierDefinitie_Aanvang — aanvangdatum van entiteit FormulierDefinitie.
type FormulierDefinitie_Aanvang struct {
	bun.BaseModel         `bun:"table:formulierdefinitie_aanvang,alias:formulierdefinitie_aanvang"`
	FormulierDefinitie_ID int        `json:"formulierdefinitie_id" bun:"formulierdefinitie_id,pk"`
	Versie                int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                 *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer                *time.Time `json:"opvoer,omitempty"`
	Afvoer                *time.Time `json:"afvoer,omitempty"`
}

// FormulierDefinitie_Einde — eindedatum van entiteit FormulierDefinitie.
type FormulierDefinitie_Einde struct {
	bun.BaseModel         `bun:"table:formulierdefinitie_einde,alias:formulierdefinitie_einde"`
	FormulierDefinitie_ID int        `json:"formulierdefinitie_id" bun:"formulierdefinitie_id,pk"`
	Versie                int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                 *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer                *time.Time `json:"opvoer,omitempty"`
	Afvoer                *time.Time `json:"afvoer,omitempty"`
}

// WeergaveDefinitie — Weergavedefinitie voor publicatie-views op entiteitsdata. Bevat metadata (naam, doeltype, status), een tabelconfiguratie (kolommen, sortering) en een detail-template met veldpad-inserts. Bitemporeel: wijzigingen zijn traceerbaar en corrigeerbaar via registraties.
type WeergaveDefinitie struct {
	bun.BaseModel                    `bun:"table:weergavedefinitie,alias:weergavedefinitie"`
	ID                               int                                `json:"id" bun:"id,pk"`
	Opvoer                           *time.Time                         `json:"opvoer,omitempty"`
	Afvoer                           *time.Time                         `json:"afvoer,omitempty"`
	WeergaveDefinitieMetas           []WeergaveDefinitie_Meta           `bun:"rel:has-many,join:id=weergavedefinitie_id" json:"weergave_definitie_metas,omitempty"`
	WeergaveDefinitieTabelConfigs    []WeergaveDefinitie_TabelConfig    `bun:"rel:has-many,join:id=weergavedefinitie_id" json:"weergave_definitie_tabel_configs,omitempty"`
	WeergaveDefinitieDetailTemplates []WeergaveDefinitie_DetailTemplate `bun:"rel:has-many,join:id=weergavedefinitie_id" json:"weergave_definitie_detail_templates,omitempty"`
	Aanvang                          []WeergaveDefinitie_Aanvang        `bun:"rel:has-many,join:id=weergavedefinitie_id" json:"aanvang,omitempty"`
	Einde                            []WeergaveDefinitie_Einde          `bun:"rel:has-many,join:id=weergavedefinitie_id" json:"einde,omitempty"`
}

// WeergaveDefinitie_Aanvang — aanvangdatum van entiteit WeergaveDefinitie.
type WeergaveDefinitie_Aanvang struct {
	bun.BaseModel        `bun:"table:weergavedefinitie_aanvang,alias:weergavedefinitie_aanvang"`
	WeergaveDefinitie_ID int        `json:"weergavedefinitie_id" bun:"weergavedefinitie_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// WeergaveDefinitie_Einde — eindedatum van entiteit WeergaveDefinitie.
type WeergaveDefinitie_Einde struct {
	bun.BaseModel        `bun:"table:weergavedefinitie_einde,alias:weergavedefinitie_einde"`
	WeergaveDefinitie_ID int        `json:"weergavedefinitie_id" bun:"weergavedefinitie_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}
