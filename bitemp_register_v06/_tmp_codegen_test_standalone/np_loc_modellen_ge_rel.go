package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Naamgebruiksoort string

const (
	NaamgebruiksoortEigenNaam            Naamgebruiksoort = "EigenNaam"
	NaamgebruiksoortPartnerNaam          Naamgebruiksoort = "PartnerNaam"
	NaamgebruiksoortEigenNaamPartnerNaam Naamgebruiksoort = "EigenNaam-PartnerNaam"
	NaamgebruiksoortPartnerNaamEigenNaam Naamgebruiksoort = "PartnerNaam-EigenNaam"
)

type Bereikbaarheidssoort string

const (
	BereikbaarheidssoortWoonadres            Bereikbaarheidssoort = "Woonadres"
	BereikbaarheidssoortBriefadres           Bereikbaarheidssoort = "Briefadres"
	BereikbaarheidssoortCorrespondentieadres Bereikbaarheidssoort = "Correspondentieadres"
)

type ReferentielijstAdrestype string

const (
	ReferentielijstAdrestypeURL ReferentielijstAdrestype = "URL"
	ReferentielijstAdrestypeURN ReferentielijstAdrestype = "URN"
)

// AdellijkeTitelTitel — Enkelvoudig gegevenselement titel van AdellijkeTitel.
type AdellijkeTitelTitel struct {
	bun.BaseModel        `bun:"table:adellijketiteltitel,alias:adellijketiteltitel"`
	AdellijkeTitel_ID    int                        `json:"adellijketitel_id" bun:"adellijketitel_id,pk" schema_desc:"ID van de AdellijkeTitel-entiteit"`
	Rel_ID               int                        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentAdellijkeTitel *AdellijkeTitel            `json:"-" bun:"rel:belongs-to,join:adellijketitel_id=id,on_delete:cascade"`
	Opvoer               *time.Time                 `json:"opvoer,omitempty"`
	Afvoer               *time.Time                 `json:"afvoer,omitempty"`
	Data                 []AdellijkeTitelTitel_Data `bun:"rel:has-many,join:adellijketitel_id=adellijketitel_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// AdellijkeTitelTitel_Data — geversioned inhoud van AdellijkeTitelTitel.
type AdellijkeTitelTitel_Data struct {
	bun.BaseModel     `bun:"table:adellijketiteltitel_data,alias:adellijketiteltitel_data"`
	AdellijkeTitel_ID int        `json:"adellijketitel_id" bun:"adellijketitel_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Titel             string     `json:"titel"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

// Landcode — Enkelvoudig gegevenselement landcode van Land.
type Landcode struct {
	bun.BaseModel `bun:"table:landcode,alias:landcode"`
	Land_ID       int             `json:"land_id" bun:"land_id,pk" schema_desc:"ID van de Land-entiteit"`
	Rel_ID        int             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLand    *Land           `json:"-" bun:"rel:belongs-to,join:land_id=id,on_delete:cascade"`
	Opvoer        *time.Time      `json:"opvoer,omitempty"`
	Afvoer        *time.Time      `json:"afvoer,omitempty"`
	Data          []Landcode_Data `bun:"rel:has-many,join:land_id=land_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Landcode_Data — geversioned inhoud van Landcode.
type Landcode_Data struct {
	bun.BaseModel `bun:"table:landcode_data,alias:landcode_data"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Code          string     `json:"code"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Landnaam — Enkelvoudig gegevenselement landnaam van Land.
type Landnaam struct {
	bun.BaseModel `bun:"table:landnaam,alias:landnaam"`
	Land_ID       int             `json:"land_id" bun:"land_id,pk" schema_desc:"ID van de Land-entiteit"`
	Rel_ID        int             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLand    *Land           `json:"-" bun:"rel:belongs-to,join:land_id=id,on_delete:cascade"`
	Opvoer        *time.Time      `json:"opvoer,omitempty"`
	Afvoer        *time.Time      `json:"afvoer,omitempty"`
	Data          []Landnaam_Data `bun:"rel:has-many,join:land_id=land_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Landnaam_Data — geversioned inhoud van Landnaam.
type Landnaam_Data struct {
	bun.BaseModel `bun:"table:landnaam_data,alias:landnaam_data"`
	Land_ID       int        `json:"land_id" bun:"land_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string     `json:"naam"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Locatie_Adres — Binnenlands adres: een aanduiding van een binnenlandse locatie, uitgegeven door de gemeente en geregistreerd in de BAG.
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
	Land          int        `json:"land" schema:"ref:LandenlijstLand"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Locatie_BAGlocatie — Unieke identificatie van het adresseerbaar object (verblijfsobject, stand- of ligplaats) uitgegeven door het bevoegd gemeentelijke orgaan.
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

// NatuurlijkPersoon_Persoonsidentificatie — Identificerende gegevens van de natuurlijk persoon (BSN, ingezetene).
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

// NatuurlijkPersoon_Naam — Naamgegevens van de natuurlijk persoon (voorletters, roepnaam, tussenvoegsel, achternaam).
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

// NatuurlijkPersoon_Burgerschap — Nationaliteitsgegevens (burgerschap) van de natuurlijk persoon.
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

// NatuurlijkPersoon_Partnernaam — Achternaam van de partner van de natuurlijk persoon.
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

// NatuurlijkPersoon_Naamgebruik — Wijze waarop de geslachtsnaam wordt gebruikt.
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

// Bereikbaarheid — Koppeling van een natuurlijk persoon aan een locatie als bereikbaarheidsadres.
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

// Referentielijstnaam — Leesbare naam van een referentielijst.
type Referentielijstnaam struct {
	bun.BaseModel         `bun:"table:referentielijstnaam,alias:referentielijstnaam"`
	Referentielijst_ID    int                        `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst           `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                 `json:"opvoer,omitempty"`
	Afvoer                *time.Time                 `json:"afvoer,omitempty"`
	Data                  []Referentielijstnaam_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Referentielijstnaam_Data — geversioned inhoud van Referentielijstnaam.
type Referentielijstnaam_Data struct {
	bun.BaseModel      `bun:"table:referentielijstnaam_data,alias:referentielijstnaam_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam               string     `json:"naam"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// Referentielijstomschrijving — Omschrijving van een referentielijst.
type Referentielijstomschrijving struct {
	bun.BaseModel         `bun:"table:referentielijstomschrijving,alias:referentielijstomschrijving"`
	Referentielijst_ID    int                                `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                                `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                   `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                         `json:"opvoer,omitempty"`
	Afvoer                *time.Time                         `json:"afvoer,omitempty"`
	Data                  []Referentielijstomschrijving_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Referentielijstomschrijving_Data — geversioned inhoud van Referentielijstomschrijving.
type Referentielijstomschrijving_Data struct {
	bun.BaseModel      `bun:"table:referentielijstomschrijving_data,alias:referentielijstomschrijving_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Omschrijving       string     `json:"omschrijving"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// ReferentielijstVisibility — Domeinzichtbaarheid van een referentielijst (register, modelspecifiek, extern).
type ReferentielijstVisibility struct {
	bun.BaseModel         `bun:"table:referentielijstvisibility,alias:referentielijstvisibility"`
	Referentielijst_ID    int                              `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                              `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                 `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                       `json:"opvoer,omitempty"`
	Afvoer                *time.Time                       `json:"afvoer,omitempty"`
	Data                  []ReferentielijstVisibility_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// ReferentielijstVisibility_Data — geversioned inhoud van ReferentielijstVisibility.
type ReferentielijstVisibility_Data struct {
	bun.BaseModel      `bun:"table:referentielijstvisibility_data,alias:referentielijstvisibility_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Domein             string     `json:"domein"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// ReferentielijstInternetadres — Internetadres (URL/URN) van een referentielijst.
type ReferentielijstInternetadres struct {
	bun.BaseModel         `bun:"table:referentielijstinternetadres,alias:referentielijstinternetadres"`
	Referentielijst_ID    int                                 `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                                 `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst                    `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Opvoer                *time.Time                          `json:"opvoer,omitempty"`
	Afvoer                *time.Time                          `json:"afvoer,omitempty"`
	Data                  []ReferentielijstInternetadres_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// ReferentielijstInternetadres_Data — geversioned inhoud van ReferentielijstInternetadres.
type ReferentielijstInternetadres_Data struct {
	bun.BaseModel      `bun:"table:referentielijstinternetadres_data,alias:referentielijstinternetadres_data"`
	Referentielijst_ID int                      `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int                      `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64                    `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Adrestype          ReferentielijstAdrestype `json:"adrestype" schema:"enum=ReferentielijstAdrestype"`
	Adres              string                   `json:"adres"`
	Organisatie        string                   `json:"organisatie"`
	Opvoer             *time.Time               `json:"opvoer,omitempty"`
	Afvoer             *time.Time               `json:"afvoer,omitempty"`
}

// LandenlijstLand — Koppeling van een land aan referentielijst-instantie Landenlijst (referentielijst-items relatie).
type LandenlijstLand struct {
	bun.BaseModel         `bun:"table:landenlijstland,alias:landenlijstland"`
	Referentielijst_ID    int                    `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                    `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst       `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Land_ID               int                    `json:"land_id"`
	Opvoer                *time.Time             `json:"opvoer,omitempty"`
	Afvoer                *time.Time             `json:"afvoer,omitempty"`
	Data                  []LandenlijstLand_Data `bun:"rel:has-many,join:referentielijst_id=referentielijst_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// LandenlijstLand_Data — geversioned inhoud van LandenlijstLand.
type LandenlijstLand_Data struct {
	bun.BaseModel      `bun:"table:landenlijstland_data,alias:landenlijstland_data"`
	Referentielijst_ID int        `json:"referentielijst_id" bun:"referentielijst_id,pk"`
	Rel_ID             int        `json:"rel_id" bun:"rel_id,pk"`
	Versie             int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// AdellijkeTitelsTitel — Koppeling van een adellijke titel aan referentielijst-instantie AdellijkeTitels (referentielijst-items relatie).
type AdellijkeTitelsTitel struct {
	bun.BaseModel         `bun:"table:adellijketitelstitel,alias:adellijketitelstitel"`
	Referentielijst_ID    int                         `json:"referentielijst_id" bun:"referentielijst_id,pk" schema_desc:"ID van de Referentielijst-entiteit"`
	Rel_ID                int                         `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentReferentielijst *Referentielijst            `json:"-" bun:"rel:belongs-to,join:referentielijst_id=id,on_delete:cascade"`
	Adellijketitel_ID     int                         `json:"adellijketitel_id"`
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
