package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Bereikbaarheidssoort string

const (
	BereikbaarheidssoortWoonadres            Bereikbaarheidssoort = "Woonadres"
	BereikbaarheidssoortBriefadres           Bereikbaarheidssoort = "Briefadres"
	BereikbaarheidssoortCorrespondentieadres Bereikbaarheidssoort = "Correspondentieadres"
)

type Naamgebruiksoort string

const (
	NaamgebruiksoortEigenNaam            Naamgebruiksoort = "EigenNaam"
	NaamgebruiksoortPartnerNaam          Naamgebruiksoort = "PartnerNaam"
	NaamgebruiksoortEigenNaamPartnerNaam Naamgebruiksoort = "EigenNaam-PartnerNaam"
	NaamgebruiksoortPartnerNaamEigenNaam Naamgebruiksoort = "PartnerNaam-EigenNaam"
)

// NatuurlijkPersoon_Persoonsidentificatie — Enkelvoudig gegevenselement van A met formele tijdlijn.
type NatuurlijkPersoon_Persoonsidentificatie struct {
	bun.BaseModel           `bun:"table:natuurlijkpersoon_persoonsidentificatie,alias:natuurlijkpersoon_persoonsidentificatie"`
	NatuurlijkPersoon_ID    int                                            `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID                  int                                            `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon                             `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	Opvoer                  *time.Time                                     `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                                     `json:"afvoer,omitempty"`
	Data                    []NatuurlijkPersoon_Persoonsidentificatie_Data `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// NatuurlijkPersoon_Persoonsidentificatie_Data — geversioned inhoud van NatuurlijkPersoon_Persoonsidentificatie.
type NatuurlijkPersoon_Persoonsidentificatie_Data struct {
	bun.BaseModel        `bun:"table:natuurlijkpersoon_persoonsidentificatie_data,alias:natuurlijkpersoon_persoonsidentificatie_data"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Bsn                  string     `json:"bsn" schema:"datatype:BSN"`
	Ingezetene           *bool      `json:"ingezetene,omitempty"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Naam — Meervoudig gegevenselement van A met onder andere een datumveld.
type NatuurlijkPersoon_Naam struct {
	bun.BaseModel           `bun:"table:natuurlijkpersoon_naam,alias:natuurlijkpersoon_naam"`
	NatuurlijkPersoon_ID    int                           `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID                  int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon            `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	Opvoer                  *time.Time                    `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                    `json:"afvoer,omitempty"`
	Data                    []NatuurlijkPersoon_Naam_Data `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// NatuurlijkPersoon_Naam_Data — geversioned inhoud van NatuurlijkPersoon_Naam.
type NatuurlijkPersoon_Naam_Data struct {
	bun.BaseModel        `bun:"table:natuurlijkpersoon_naam_data,alias:natuurlijkpersoon_naam_data"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Voorletters          string     `json:"voorletters"`
	Roepnaam             *string    `json:"roepnaam,omitempty"`
	Tussenvoegsel        *string    `json:"tussenvoegsel,omitempty"`
	Achternaam           string     `json:"achternaam"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Burgerschap — Meervoudig gegevenselement van A met numerieke waarden.
type NatuurlijkPersoon_Burgerschap struct {
	bun.BaseModel           `bun:"table:natuurlijkpersoon_burgerschap,alias:natuurlijkpersoon_burgerschap"`
	NatuurlijkPersoon_ID    int                                     `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID                  int                                     `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon                      `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	Opvoer                  *time.Time                              `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                              `json:"afvoer,omitempty"`
	Data                    []NatuurlijkPersoon_Burgerschap_Data    `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang                 []NatuurlijkPersoon_Burgerschap_Aanvang `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde                   []NatuurlijkPersoon_Burgerschap_Einde   `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// NatuurlijkPersoon_Burgerschap_Data — geversioned inhoud van NatuurlijkPersoon_Burgerschap.
type NatuurlijkPersoon_Burgerschap_Data struct {
	bun.BaseModel        `bun:"table:natuurlijkpersoon_burgerschap_data,alias:natuurlijkpersoon_burgerschap_data"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Landcode             string     `json:"landcode"`
	Nationaliteit        string     `json:"nationaliteit"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Burgerschap_Aanvang — aanvangdatum van NatuurlijkPersoon_Burgerschap.
type NatuurlijkPersoon_Burgerschap_Aanvang struct {
	bun.BaseModel        `bun:"table:natuurlijkpersoon_burgerschap_aanvang,alias:natuurlijkpersoon_burgerschap_aanvang"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Burgerschap_Einde — eindedatum van NatuurlijkPersoon_Burgerschap.
type NatuurlijkPersoon_Burgerschap_Einde struct {
	bun.BaseModel        `bun:"table:natuurlijkpersoon_burgerschap_einde,alias:natuurlijkpersoon_burgerschap_einde"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

type NatuurlijkPersoon_Partnernaam struct {
	bun.BaseModel           `bun:"table:natuurlijkpersoon_partnernaam,alias:natuurlijkpersoon_partnernaam"`
	NatuurlijkPersoon_ID    int                                  `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID                  int                                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon                   `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	Opvoer                  *time.Time                           `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                           `json:"afvoer,omitempty"`
	Data                    []NatuurlijkPersoon_Partnernaam_Data `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// NatuurlijkPersoon_Partnernaam_Data — geversioned inhoud van NatuurlijkPersoon_Partnernaam.
type NatuurlijkPersoon_Partnernaam_Data struct {
	bun.BaseModel        `bun:"table:natuurlijkpersoon_partnernaam_data,alias:natuurlijkpersoon_partnernaam_data"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Achternaam           string     `json:"achternaam"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

type NatuurlijkPersoon_Naamgebruik struct {
	bun.BaseModel           `bun:"table:natuurlijkpersoon_naamgebruik,alias:natuurlijkpersoon_naamgebruik"`
	NatuurlijkPersoon_ID    int                                  `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID                  int                                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon                   `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	Opvoer                  *time.Time                           `json:"opvoer,omitempty"`
	Afvoer                  *time.Time                           `json:"afvoer,omitempty"`
	Data                    []NatuurlijkPersoon_Naamgebruik_Data `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// NatuurlijkPersoon_Naamgebruik_Data — geversioned inhoud van NatuurlijkPersoon_Naamgebruik.
type NatuurlijkPersoon_Naamgebruik_Data struct {
	bun.BaseModel        `bun:"table:natuurlijkpersoon_naamgebruik_data,alias:natuurlijkpersoon_naamgebruik_data"`
	NatuurlijkPersoon_ID int              `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int              `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64            `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naamgebruik          Naamgebruiksoort `json:"naamgebruik" schema:"enum=Naamgebruiksoort"`
	Opvoer               *time.Time       `json:"opvoer,omitempty"`
	Afvoer               *time.Time       `json:"afvoer,omitempty"`
}

type Bereikbaarheid struct {
	bun.BaseModel           `bun:"table:bereikbaarheid,alias:bereikbaarheid"`
	NatuurlijkPersoon_ID    int                      `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID                  int                      `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon       `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	Locatie_ID              int                      `json:"locatie_id"`
	Opvoer                  *time.Time               `json:"opvoer,omitempty"`
	Afvoer                  *time.Time               `json:"afvoer,omitempty"`
	Data                    []Bereikbaarheid_Data    `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang                 []Bereikbaarheid_Aanvang `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde                   []Bereikbaarheid_Einde   `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Bereikbaarheid_Data — geversioned inhoud van Bereikbaarheid.
type Bereikbaarheid_Data struct {
	bun.BaseModel        `bun:"table:bereikbaarheid_data,alias:bereikbaarheid_data"`
	NatuurlijkPersoon_ID int                  `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int                  `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64                `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Soort                Bereikbaarheidssoort `json:"soort" schema:"enum=Bereikbaarheidssoort"`
	Opvoer               *time.Time           `json:"opvoer,omitempty"`
	Afvoer               *time.Time           `json:"afvoer,omitempty"`
}

// Bereikbaarheid_Aanvang — aanvangdatum van Bereikbaarheid.
type Bereikbaarheid_Aanvang struct {
	bun.BaseModel        `bun:"table:bereikbaarheid_aanvang,alias:bereikbaarheid_aanvang"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// Bereikbaarheid_Einde — eindedatum van Bereikbaarheid.
type Bereikbaarheid_Einde struct {
	bun.BaseModel        `bun:"table:bereikbaarheid_einde,alias:bereikbaarheid_einde"`
	NatuurlijkPersoon_ID int        `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID               int        `json:"rel_id" bun:"rel_id,pk"`
	Versie               int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum                *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer               *time.Time `json:"opvoer,omitempty"`
	Afvoer               *time.Time `json:"afvoer,omitempty"`
}

// Locatie_Adres — Enkelvoudig gegevenselement van B met twee tekstvelden.
type Locatie_Adres struct {
	bun.BaseModel `bun:"table:locatie_adres,alias:locatie_adres"`
	Locatie_ID    int                  `json:"locatie_id" bun:"locatie_id,pk" schema_desc:"ID van de Locatie-entiteit"`
	Rel_ID        int                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLocatie *Locatie             `json:"-" bun:"rel:belongs-to,join:locatie_id=id,on_delete:cascade"`
	Opvoer        *time.Time           `json:"opvoer,omitempty"`
	Afvoer        *time.Time           `json:"afvoer,omitempty"`
	Data          []Locatie_Adres_Data `bun:"rel:has-many,join:locatie_id=locatie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Locatie_Adres_Data — geversioned inhoud van Locatie_Adres.
type Locatie_Adres_Data struct {
	bun.BaseModel `bun:"table:locatie_adres_data,alias:locatie_adres_data"`
	Locatie_ID    int        `json:"locatie_id" bun:"locatie_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Straatnaam    string     `json:"straatnaam"`
	Huisnummer    string     `json:"huisnummer"`
	Postcode      string     `json:"postcode" schema:"datatype:NLPostcode"`
	Plaats        string     `json:"plaats"`
	Land          int        `json:"land" bun:"land" schema:"ref:LandenlijstLand"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Locatie_BAGlocatie — Enkelvoudig gegevenselement van B met een tekstveld.
type Locatie_BAGlocatie struct {
	bun.BaseModel `bun:"table:locatie_baglocatie,alias:locatie_baglocatie"`
	Locatie_ID    int                       `json:"locatie_id" bun:"locatie_id,pk" schema_desc:"ID van de Locatie-entiteit"`
	Rel_ID        int                       `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLocatie *Locatie                  `json:"-" bun:"rel:belongs-to,join:locatie_id=id,on_delete:cascade"`
	Opvoer        *time.Time                `json:"opvoer,omitempty"`
	Afvoer        *time.Time                `json:"afvoer,omitempty"`
	Data          []Locatie_BAGlocatie_Data `bun:"rel:has-many,join:locatie_id=locatie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Locatie_BAGlocatie_Data — geversioned inhoud van Locatie_BAGlocatie.
type Locatie_BAGlocatie_Data struct {
	bun.BaseModel   `bun:"table:locatie_baglocatie_data,alias:locatie_baglocatie_data"`
	Locatie_ID      int        `json:"locatie_id" bun:"locatie_id,pk"`
	Rel_ID          int        `json:"rel_id" bun:"rel_id,pk"`
	Versie          int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Adresaanduiding string     `json:"adresaanduiding"`
	Opvoer          *time.Time `json:"opvoer,omitempty"`
	Afvoer          *time.Time `json:"afvoer,omitempty"`
}

/* ================================================================
   ADELLIJKETITEL — items-relatie en GE's
   ================================================================ */

// AdellijkeTitelsTitel — koppelrelatie (referentielijst_items) tussen Referentielijst-instantie AdellijkeTitels en AdellijkeTitel.
type AdellijkeTitelsTitel struct {
	bun.BaseModel         `bun:"table:adellijketitelstitel,alias:adellijketitelstitel"`
	Referentielijst_ID    int                         `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                         `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst            `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	AdellijkeTitel_ID     int                         `json:"adellijketitel_id"`
	Opvoer                *time.Time                  `json:"opvoer,omitempty"`
	Afvoer                *time.Time                  `json:"afvoer,omitempty"`
	Data                  []AdellijkeTitelsTitel_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// AdellijkeTitelsTitel_Data — geversioned inhoud van AdellijkeTitelsTitel.
type AdellijkeTitelsTitel_Data struct {
	bun.BaseModel      `bun:"table:adellijketitelstitel_data,alias:adellijketitelstitel_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// AdellijkeTitelTitel — enkelvoudig gegevenselement titel van entiteit AdellijkeTitel.
type AdellijkeTitelTitel struct {
	bun.BaseModel        `bun:"table:adellijketiteltitel,alias:adellijketiteltitel"`
	AdellijkeTitel_ID    int                        `json:"adellijketitel_id" bun:"adellijketitel_id,pk" schema_desc:"ID van de AdellijkeTitel-entiteit"`
	Rel_ID               int                        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentAdellijkeTitel *AdellijkeTitel            `json:"-" bun:"rel:belongs-to,join:adellijketitel_id=id,on_delete:cascade"`
	Opvoer               *time.Time                 `json:"opvoer,omitempty"`
	Afvoer               *time.Time                 `json:"afvoer,omitempty"`
	Data                 []AdellijkeTitelTitel_Data `bun:"rel:has-many,join:adellijketitel_id=adellijketitel_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// AdellijkeTitelTitel_Data — geversioned inhoud van gegevenselement AdellijkeTitelTitel.
type AdellijkeTitelTitel_Data struct {
	bun.BaseModel     `bun:"table:adellijketiteltitel_data,alias:adellijketiteltitel_data"`
	AdellijkeTitel_ID int        `json:"adellijketitel_id" bun:"adellijketitel_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Titel             string     `json:"titel"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}
