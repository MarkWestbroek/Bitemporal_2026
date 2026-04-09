package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type FormulierDefinitieStatus string

const (
	FormulierDefinitieStatusConcept  FormulierDefinitieStatus = "concept"
	FormulierDefinitieStatusActief   FormulierDefinitieStatus = "actief"
	FormulierDefinitieStatusInactief FormulierDefinitieStatus = "inactief"
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
	Opvoer                *time.Time `json:"opvoer,omitempty"`
	Afvoer                *time.Time `json:"afvoer,omitempty"`
}
