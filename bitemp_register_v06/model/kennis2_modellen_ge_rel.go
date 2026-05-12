package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Taal string

const (
	TaalNl Taal = "nl"
	TaalEn Taal = "en"
	TaalDe Taal = "de"
)

type Kennissectietype string

const (
	KennissectietypeSamenvatting          Kennissectietype = "samenvatting"
	KennissectietypeInhoud                Kennissectietype = "inhoud"
	KennissectietypeProcedureBeschrijving Kennissectietype = "procedureBeschrijving"
	KennissectietypeBewijs                Kennissectietype = "bewijs"
	KennissectietypeEnz                   Kennissectietype = "enz"
)

type KA_Tr struct {
	bun.BaseModel       `bun:"table:ka_tr,alias:ka_tr"`
	Kennisartikel_ID    int             `json:"kennisartikel_id" bun:"kennisartikel_id,pk" schema_desc:"ID van de Kennisartikel-entiteit"`
	Rel_ID              int             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentKennisartikel *Kennisartikel  `json:"-" bun:"rel:belongs-to,join:kennisartikel_id=id,on_delete:cascade"`
	Trefwoord_ID        int             `json:"trefwoord_id"`
	Opvoer              *time.Time      `json:"opvoer,omitempty"`
	Afvoer              *time.Time      `json:"afvoer,omitempty"`
	Data                []KA_Tr_Data    `bun:"rel:has-many,join:kennisartikel_id=kennisartikel_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang             []KA_Tr_Aanvang `bun:"rel:has-many,join:kennisartikel_id=kennisartikel_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde               []KA_Tr_Einde   `bun:"rel:has-many,join:kennisartikel_id=kennisartikel_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// KA_Tr_Data — geversioned inhoud van KA_Tr.
type KA_Tr_Data struct {
	bun.BaseModel    `bun:"table:ka_tr_data,alias:ka_tr_data"`
	Kennisartikel_ID int        `json:"kennisartikel_id" bun:"kennisartikel_id,pk"`
	Rel_ID           int        `json:"rel_id" bun:"rel_id,pk"`
	Versie           int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer           *time.Time `json:"opvoer,omitempty"`
	Afvoer           *time.Time `json:"afvoer,omitempty"`
}

// KA_Tr_Aanvang — aanvangdatum van KA_Tr.
type KA_Tr_Aanvang struct {
	bun.BaseModel    `bun:"table:ka_tr_aanvang,alias:ka_tr_aanvang"`
	Kennisartikel_ID int        `json:"kennisartikel_id" bun:"kennisartikel_id,pk"`
	Rel_ID           int        `json:"rel_id" bun:"rel_id,pk"`
	Versie           int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum            *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer           *time.Time `json:"opvoer,omitempty"`
	Afvoer           *time.Time `json:"afvoer,omitempty"`
}

// KA_Tr_Einde — eindedatum van KA_Tr.
type KA_Tr_Einde struct {
	bun.BaseModel    `bun:"table:ka_tr_einde,alias:ka_tr_einde"`
	Kennisartikel_ID int        `json:"kennisartikel_id" bun:"kennisartikel_id,pk"`
	Rel_ID           int        `json:"rel_id" bun:"rel_id,pk"`
	Versie           int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum            *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer           *time.Time `json:"opvoer,omitempty"`
	Afvoer           *time.Time `json:"afvoer,omitempty"`
}

type KA_TV struct {
	bun.BaseModel               `bun:"table:ka_tv,alias:ka_tv"`
	Kennisartikel_ID            int            `json:"kennisartikel_id" bun:"kennisartikel_id,pk" schema_desc:"ID van de Kennisartikel-entiteit"`
	Rel_ID                      int            `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentKennisartikel         *Kennisartikel `json:"-" bun:"rel:belongs-to,join:kennisartikel_id=id,on_delete:cascade"`
	Kennisartikeltaalvariant_ID int            `json:"kennisartikeltaalvariant_id"`
	Opvoer                      *time.Time     `json:"opvoer,omitempty"`
	Afvoer                      *time.Time     `json:"afvoer,omitempty"`
	Data                        []KA_TV_Data   `bun:"rel:has-many,join:kennisartikel_id=kennisartikel_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// KA_TV_Data — geversioned inhoud van KA_TV.
type KA_TV_Data struct {
	bun.BaseModel    `bun:"table:ka_tv_data,alias:ka_tv_data"`
	Kennisartikel_ID int        `json:"kennisartikel_id" bun:"kennisartikel_id,pk"`
	Rel_ID           int        `json:"rel_id" bun:"rel_id,pk"`
	Versie           int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer           *time.Time `json:"opvoer,omitempty"`
	Afvoer           *time.Time `json:"afvoer,omitempty"`
}

type KennisartikelTaalvariant_KennisartikeltaalvariantTitel struct {
	bun.BaseModel                  `bun:"table:kennisartikeltaalvariant_kennisartikeltaalvarianttitel,alias:kennisartikeltaalvariant_kennisartikeltaalvarianttitel"`
	KennisartikelTaalvariant_ID    int                                                           `json:"kennisartikeltaalvariant_id" bun:"kennisartikeltaalvariant_id,pk" schema_desc:"ID van de KennisartikelTaalvariant-entiteit"`
	Rel_ID                         int                                                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentKennisartikelTaalvariant *KennisartikelTaalvariant                                     `json:"-" bun:"rel:belongs-to,join:kennisartikeltaalvariant_id=id,on_delete:cascade"`
	Opvoer                         *time.Time                                                    `json:"opvoer,omitempty"`
	Afvoer                         *time.Time                                                    `json:"afvoer,omitempty"`
	Data                           []KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data `bun:"rel:has-many,join:kennisartikeltaalvariant_id=kennisartikeltaalvariant_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data — geversioned inhoud van KennisartikelTaalvariant_KennisartikeltaalvariantTitel.
type KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data struct {
	bun.BaseModel               `bun:"table:kennisartikeltaalvariant_kennisartikeltaalvarianttitel_data,alias:kennisartikeltaalvariant_kennisartikeltaalvarianttitel_data"`
	KennisartikelTaalvariant_ID int        `json:"kennisartikeltaalvariant_id" bun:"kennisartikeltaalvariant_id,pk"`
	Rel_ID                      int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                      int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Titel                       string     `json:"titel"`
	Opvoer                      *time.Time `json:"opvoer,omitempty"`
	Afvoer                      *time.Time `json:"afvoer,omitempty"`
}

type KennisartikelTaalvariant_Sectie struct {
	bun.BaseModel                  `bun:"table:kennisartikeltaalvariant_sectie,alias:kennisartikeltaalvariant_sectie"`
	KennisartikelTaalvariant_ID    int                                    `json:"kennisartikeltaalvariant_id" bun:"kennisartikeltaalvariant_id,pk" schema_desc:"ID van de KennisartikelTaalvariant-entiteit"`
	Rel_ID                         int                                    `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentKennisartikelTaalvariant *KennisartikelTaalvariant              `json:"-" bun:"rel:belongs-to,join:kennisartikeltaalvariant_id=id,on_delete:cascade"`
	Opvoer                         *time.Time                             `json:"opvoer,omitempty"`
	Afvoer                         *time.Time                             `json:"afvoer,omitempty"`
	Data                           []KennisartikelTaalvariant_Sectie_Data `bun:"rel:has-many,join:kennisartikeltaalvariant_id=kennisartikeltaalvariant_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// KennisartikelTaalvariant_Sectie_Data — geversioned inhoud van KennisartikelTaalvariant_Sectie.
type KennisartikelTaalvariant_Sectie_Data struct {
	bun.BaseModel               `bun:"table:kennisartikeltaalvariant_sectie_data,alias:kennisartikeltaalvariant_sectie_data"`
	KennisartikelTaalvariant_ID int              `json:"kennisartikeltaalvariant_id" bun:"kennisartikeltaalvariant_id,pk"`
	Rel_ID                      int              `json:"rel_id" bun:"rel_id,pk"`
	Versie                      int64            `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Type                        Kennissectietype `json:"type" schema:"enum=Kennissectietype"`
	Inhoud                      string           `json:"inhoud"`
	Positie                     *int             `json:"positie,omitempty"`
	Opvoer                      *time.Time       `json:"opvoer,omitempty"`
	Afvoer                      *time.Time       `json:"afvoer,omitempty"`
}

type KennisartikelTaalvariant_KennisartikelTaalvariantTaal struct {
	bun.BaseModel                  `bun:"table:kennisartikeltaalvariant_kennisartikeltaalvarianttaal,alias:kennisartikeltaalvariant_kennisartikeltaalvarianttaal"`
	KennisartikelTaalvariant_ID    int                                                          `json:"kennisartikeltaalvariant_id" bun:"kennisartikeltaalvariant_id,pk" schema_desc:"ID van de KennisartikelTaalvariant-entiteit"`
	Rel_ID                         int                                                          `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentKennisartikelTaalvariant *KennisartikelTaalvariant                                    `json:"-" bun:"rel:belongs-to,join:kennisartikeltaalvariant_id=id,on_delete:cascade"`
	Opvoer                         *time.Time                                                   `json:"opvoer,omitempty"`
	Afvoer                         *time.Time                                                   `json:"afvoer,omitempty"`
	Data                           []KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data `bun:"rel:has-many,join:kennisartikeltaalvariant_id=kennisartikeltaalvariant_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data — geversioned inhoud van KennisartikelTaalvariant_KennisartikelTaalvariantTaal.
type KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data struct {
	bun.BaseModel               `bun:"table:kennisartikeltaalvariant_kennisartikeltaalvarianttaal_data,alias:kennisartikeltaalvariant_kennisartikeltaalvarianttaal_data"`
	KennisartikelTaalvariant_ID int        `json:"kennisartikeltaalvariant_id" bun:"kennisartikeltaalvariant_id,pk"`
	Rel_ID                      int        `json:"rel_id" bun:"rel_id,pk"`
	Versie                      int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Taal                        Taal       `json:"taal" schema:"enum=Taal"`
	Opvoer                      *time.Time `json:"opvoer,omitempty"`
	Afvoer                      *time.Time `json:"afvoer,omitempty"`
}

type Trefwoord_TrefwoordTaalvariant struct {
	bun.BaseModel   `bun:"table:trefwoord_trefwoordtaalvariant,alias:trefwoord_trefwoordtaalvariant"`
	Trefwoord_ID    int                                   `json:"trefwoord_id" bun:"trefwoord_id,pk" schema_desc:"ID van de Trefwoord-entiteit"`
	Rel_ID          int                                   `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentTrefwoord *Trefwoord                            `json:"-" bun:"rel:belongs-to,join:trefwoord_id=id,on_delete:cascade"`
	Opvoer          *time.Time                            `json:"opvoer,omitempty"`
	Afvoer          *time.Time                            `json:"afvoer,omitempty"`
	Data            []Trefwoord_TrefwoordTaalvariant_Data `bun:"rel:has-many,join:trefwoord_id=trefwoord_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Trefwoord_TrefwoordTaalvariant_Data — geversioned inhoud van Trefwoord_TrefwoordTaalvariant.
type Trefwoord_TrefwoordTaalvariant_Data struct {
	bun.BaseModel `bun:"table:trefwoord_trefwoordtaalvariant_data,alias:trefwoord_trefwoordtaalvariant_data"`
	Trefwoord_ID  int        `json:"trefwoord_id" bun:"trefwoord_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Woord         string     `json:"woord"`
	Taal          Taal       `json:"taal" schema:"enum=Taal"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
