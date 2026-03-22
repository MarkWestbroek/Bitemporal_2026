package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Bereikbaarheidssoort string

const (
	BereikbaarheidssoortWoonadres Bereikbaarheidssoort = "Woonadres"
	BereikbaarheidssoortBriefadres Bereikbaarheidssoort = "Briefadres"
	BereikbaarheidssoortCorrespondentieadres Bereikbaarheidssoort = "Correspondentieadres"
)

type Naamgebruiksoort string

const (
	NaamgebruiksoortEigenNaam Naamgebruiksoort = "EigenNaam"
	NaamgebruiksoortPartnerNaam Naamgebruiksoort = "PartnerNaam"
	NaamgebruiksoortEigenNaamPartnerNaam Naamgebruiksoort = "EigenNaam-PartnerNaam"
	NaamgebruiksoortPartnerNaamEigenNaam Naamgebruiksoort = "PartnerNaam-EigenNaam"
)

// NatuurlijkPersoon_PersoonsIdentificatie — Enkelvoudig gegevenselement van A met formele tijdlijn.
type NatuurlijkPersoon_PersoonsIdentificatie struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_persoonsidentificatie"`
	NatuurlijkPersoon_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	Data []NatuurlijkPersoon_PersoonsIdentificatie_Data `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// NatuurlijkPersoon_PersoonsIdentificatie_Data — geversioned inhoud van NatuurlijkPersoon_PersoonsIdentificatie.
type NatuurlijkPersoon_PersoonsIdentificatie_Data struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_persoonsidentificatie_data,alias:natuurlijkpersoon_persoonsidentificatie_data"`
	NATUURLIJKPERSOON_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Bsn string `json:"bsn"`
	Ingezetene *bool `json:"ingezetene,omitempty"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Naam — Meervoudig gegevenselement van A met onder andere een datumveld.
type NatuurlijkPersoon_Naam struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_naam"`
	NatuurlijkPersoon_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	Data []NatuurlijkPersoon_Naam_Data `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// NatuurlijkPersoon_Naam_Data — geversioned inhoud van NatuurlijkPersoon_Naam.
type NatuurlijkPersoon_Naam_Data struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_naam_data,alias:natuurlijkpersoon_naam_data"`
	NATUURLIJKPERSOON_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Voorletters string `json:"voorletters"`
	Roepnaam *string `json:"roepnaam,omitempty"`
	Tussenvoegsel *string `json:"tussenvoegsel,omitempty"`
	Achternaam string `json:"achternaam"`
	Naamgebruik Naamgebruiksoort `json:"naamgebruik" schema:"enum=Naamgebruiksoort"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Burgerschap — Meervoudig gegevenselement van A met numerieke waarden.
type NatuurlijkPersoon_Burgerschap struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_burgerschap"`
	NatuurlijkPersoon_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	Data []NatuurlijkPersoon_Burgerschap_Data `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang []NatuurlijkPersoon_Burgerschap_Aanvang `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde []NatuurlijkPersoon_Burgerschap_Einde `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// NatuurlijkPersoon_Burgerschap_Data — geversioned inhoud van NatuurlijkPersoon_Burgerschap.
type NatuurlijkPersoon_Burgerschap_Data struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_burgerschap_data,alias:natuurlijkpersoon_burgerschap_data"`
	NATUURLIJKPERSOON_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Landcode string `json:"landcode"`
	Nationaliteit string `json:"nationaliteit"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Burgerschap_Aanvang — aanvangdatum van NatuurlijkPersoon_Burgerschap.
type NatuurlijkPersoon_Burgerschap_Aanvang struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_burgerschap_aanvang,alias:natuurlijkpersoon_burgerschap_aanvang"`
	NATUURLIJKPERSOON_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum *Date `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

// NatuurlijkPersoon_Burgerschap_Einde — eindedatum van NatuurlijkPersoon_Burgerschap.
type NatuurlijkPersoon_Burgerschap_Einde struct {
	bun.BaseModel `bun:"table:natuurlijkpersoon_burgerschap_einde,alias:natuurlijkpersoon_burgerschap_einde"`
	NATUURLIJKPERSOON_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum *Date `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

type Bereikbaarheid struct {
	bun.BaseModel `bun:"table:bereikbaarheid"`
	NatuurlijkPersoon_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk" schema_desc:"ID van de NatuurlijkPersoon-entiteit"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentNatuurlijkPersoon *NatuurlijkPersoon `json:"-" bun:"rel:belongs-to,join:natuurlijkpersoon_id=id,on_delete:cascade"`
	LOCATIE_ID int `json:"locatie_id"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	Data []Bereikbaarheid_Data `bun:"rel:has-many,join:natuurlijkpersoon_id=natuurlijkpersoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Bereikbaarheid_Data — geversioned inhoud van Bereikbaarheid.
type Bereikbaarheid_Data struct {
	bun.BaseModel `bun:"table:bereikbaarheid_data,alias:bereikbaarheid_data"`
	NATUURLIJKPERSOON_ID int `json:"natuurlijkpersoon_id" bun:"natuurlijkpersoon_id,pk"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Soort Bereikbaarheidssoort `json:"soort" schema:"enum=Bereikbaarheidssoort"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

// Locatie_Adres — Enkelvoudig gegevenselement van B met twee tekstvelden.
type Locatie_Adres struct {
	bun.BaseModel `bun:"table:locatie_adres"`
	Locatie_ID int `json:"locatie_id" bun:"locatie_id,pk" schema_desc:"ID van de Locatie-entiteit"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLocatie *Locatie `json:"-" bun:"rel:belongs-to,join:locatie_id=id,on_delete:cascade"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	Data []Locatie_Adres_Data `bun:"rel:has-many,join:locatie_id=locatie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Locatie_Adres_Data — geversioned inhoud van Locatie_Adres.
type Locatie_Adres_Data struct {
	bun.BaseModel `bun:"table:locatie_adres_data,alias:locatie_adres_data"`
	LOCATIE_ID int `json:"locatie_id" bun:"locatie_id,pk"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Straatnaam string `json:"straatnaam"`
	Huisnummer string `json:"huisnummer"`
	Postcode string `json:"postcode"`
	Plaats string `json:"plaats"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

// Locatie_BAGlocatie — Enkelvoudig gegevenselement van B met een tekstveld.
type Locatie_BAGlocatie struct {
	bun.BaseModel `bun:"table:locatie_baglocatie"`
	Locatie_ID int `json:"locatie_id" bun:"locatie_id,pk" schema_desc:"ID van de Locatie-entiteit"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentLocatie *Locatie `json:"-" bun:"rel:belongs-to,join:locatie_id=id,on_delete:cascade"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	Data []Locatie_BAGlocatie_Data `bun:"rel:has-many,join:locatie_id=locatie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Locatie_BAGlocatie_Data — geversioned inhoud van Locatie_BAGlocatie.
type Locatie_BAGlocatie_Data struct {
	bun.BaseModel `bun:"table:locatie_baglocatie_data,alias:locatie_baglocatie_data"`
	LOCATIE_ID int `json:"locatie_id" bun:"locatie_id,pk"`
	Rel_ID int `json:"rel_id" bun:"rel_id,pk"`
	Versie int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Adresaanduiding string `json:"adresaanduiding"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}

