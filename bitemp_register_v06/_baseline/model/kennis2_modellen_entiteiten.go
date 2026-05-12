package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// Kennisartikel — Een kennisartikel (KA) bevat als afgeleid veld de NL titel. De rest van de informatie hangt onder een KA-taalvariant.
type Kennisartikel struct {
	bun.BaseModel              `bun:"table:kennisartikel,alias:kennisartikel"`
	ID                         int                     `json:"id" bun:"id,pk"`
	Opvoer                     *time.Time              `json:"opvoer,omitempty"`
	Afvoer                     *time.Time              `json:"afvoer,omitempty"`
	Kennisartikeltrefwoorden   []KA_Tr                 `bun:"rel:has-many,join:id=kennisartikel_id" json:"kennisartikeltrefwoorden,omitempty"`
	KennisartikelTaalvarianten []KA_TV                 `bun:"rel:has-many,join:id=kennisartikel_id" json:"kennisartikel_taalvarianten,omitempty"`
	Aanvang                    []Kennisartikel_Aanvang `bun:"rel:has-many,join:id=kennisartikel_id" json:"aanvang,omitempty"`
	Einde                      []Kennisartikel_Einde   `bun:"rel:has-many,join:id=kennisartikel_id" json:"einde,omitempty"`
}

// Kennisartikel_Aanvang — aanvangdatum van entiteit Kennisartikel.
type Kennisartikel_Aanvang struct {
	bun.BaseModel    `bun:"table:kennisartikel_aanvang,alias:kennisartikel_aanvang"`
	Kennisartikel_ID int        `json:"kennisartikel_id" bun:"kennisartikel_id,pk"`
	Versie           int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum            *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer           *time.Time `json:"opvoer,omitempty"`
	Afvoer           *time.Time `json:"afvoer,omitempty"`
}

// Kennisartikel_Einde — eindedatum van entiteit Kennisartikel.
type Kennisartikel_Einde struct {
	bun.BaseModel    `bun:"table:kennisartikel_einde,alias:kennisartikel_einde"`
	Kennisartikel_ID int        `json:"kennisartikel_id" bun:"kennisartikel_id,pk"`
	Versie           int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum            *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer           *time.Time `json:"opvoer,omitempty"`
	Afvoer           *time.Time `json:"afvoer,omitempty"`
}

type KennisartikelTaalvariant struct {
	bun.BaseModel `bun:"table:kennisartikeltaalvariant,alias:kennisartikeltaalvariant"`
	ID            int                                                      `json:"id" bun:"id,pk"`
	Opvoer        *time.Time                                               `json:"opvoer,omitempty"`
	Afvoer        *time.Time                                               `json:"afvoer,omitempty"`
	Tvtitels      []KennisartikelTaalvariant_KennisartikeltaalvariantTitel `bun:"rel:has-many,join:id=kennisartikeltaalvariant_id" json:"tvtitels,omitempty"`
	Kennissecties []KennisartikelTaalvariant_Sectie                        `bun:"rel:has-many,join:id=kennisartikeltaalvariant_id" json:"kennissecties,omitempty"`
	Tvtalen       []KennisartikelTaalvariant_KennisartikelTaalvariantTaal  `bun:"rel:has-many,join:id=kennisartikeltaalvariant_id" json:"tvtalen,omitempty"`
}

type Trefwoord struct {
	bun.BaseModel          `bun:"table:trefwoord,alias:trefwoord"`
	ID                     int                              `json:"id" bun:"id,pk"`
	Opvoer                 *time.Time                       `json:"opvoer,omitempty"`
	Afvoer                 *time.Time                       `json:"afvoer,omitempty"`
	Trefwoordtaalvarianten []Trefwoord_TrefwoordTaalvariant `bun:"rel:has-many,join:id=trefwoord_id" json:"trefwoordtaalvarianten,omitempty"`
}
