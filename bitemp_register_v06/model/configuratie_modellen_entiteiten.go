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
