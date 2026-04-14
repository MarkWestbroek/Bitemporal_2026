package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// IdeBestand — Bestand beheerd vanuit de IDE: model-snapshots, imports, exports, gegenereerde code of documentatie. Bitemporeel: wijzigingen zijn traceerbaar en corrigeerbaar via registraties.
type IdeBestand struct {
	bun.BaseModel     `bun:"table:idebestand,alias:idebestand"`
	ID                int                  `json:"id" bun:"id,pk"`
	Opvoer            *time.Time           `json:"opvoer,omitempty"`
	Afvoer            *time.Time           `json:"afvoer,omitempty"`
	IdeBestandMetas   []IdeBestand_Meta    `bun:"rel:has-many,join:id=idebestand_id" json:"ide_bestand_metas,omitempty"`
	IdeBestandInhouds []IdeBestand_Inhoud  `bun:"rel:has-many,join:id=idebestand_id" json:"ide_bestand_inhouds,omitempty"`
	Aanvang           []IdeBestand_Aanvang `bun:"rel:has-many,join:id=idebestand_id" json:"aanvang,omitempty"`
	Einde             []IdeBestand_Einde   `bun:"rel:has-many,join:id=idebestand_id" json:"einde,omitempty"`
}

// IdeBestand_Aanvang — aanvangdatum van entiteit IdeBestand.
type IdeBestand_Aanvang struct {
	bun.BaseModel `bun:"table:idebestand_aanvang,alias:idebestand_aanvang"`
	IdeBestand_ID int        `json:"idebestand_id" bun:"idebestand_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// IdeBestand_Einde — eindedatum van entiteit IdeBestand.
type IdeBestand_Einde struct {
	bun.BaseModel `bun:"table:idebestand_einde,alias:idebestand_einde"`
	IdeBestand_ID int        `json:"idebestand_id" bun:"idebestand_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
