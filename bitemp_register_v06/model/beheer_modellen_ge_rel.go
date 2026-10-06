package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Gebruikersstatus string

const (
	Gebruikersstatusactief      Gebruikersstatus = "actief"
	Gebruikersstatusgeblokkeerd Gebruikersstatus = "geblokkeerd"
)

type Gebruikersrol string

const (
	Gebruikersrolviewer Gebruikersrol = "viewer"
	Gebruikersroleditor Gebruikersrol = "editor"
	Gebruikersroladmin  Gebruikersrol = "admin"
)

// Gebruiker_GebruikerIdentiteit — Wie het account is: de inlognaam en hoe iemand getoond wordt. Formeel: een correctie (typfout in de e-mail) heeft geen materiële betekenis. Bewust weinig persoonsgegevens (AVG).
type Gebruiker_GebruikerIdentiteit struct {
	bun.BaseModel   `bun:"table:gebruiker_gebruikeridentiteit,alias:gebruiker_gebruikeridentiteit"`
	Gebruiker_ID    int                                  `json:"gebruiker_id" bun:"gebruiker_id,pk" schema_desc:"ID van de Gebruiker-entiteit"`
	Rel_ID          int                                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentGebruiker *Gebruiker                           `json:"-" bun:"rel:belongs-to,join:gebruiker_id=id,on_delete:cascade"`
	Opvoer          *time.Time                           `json:"opvoer,omitempty"`
	Afvoer          *time.Time                           `json:"afvoer,omitempty"`
	Data            []Gebruiker_GebruikerIdentiteit_Data `bun:"rel:has-many,join:gebruiker_id=gebruiker_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Gebruiker_GebruikerIdentiteit_Data — geversioned inhoud van Gebruiker_GebruikerIdentiteit.
type Gebruiker_GebruikerIdentiteit_Data struct {
	bun.BaseModel  `bun:"table:gebruiker_gebruikeridentiteit_data,alias:gebruiker_gebruikeridentiteit_data"`
	Gebruiker_ID   int        `json:"gebruiker_id" bun:"gebruiker_id,pk"`
	Rel_ID         int        `json:"rel_id" bun:"rel_id,pk"`
	Versie         int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Gebruikersnaam string     `json:"gebruikersnaam" schema:"uniek=entiteit"`
	Weergavenaam   KorteTekst `json:"weergavenaam" schema:"datatype:KorteTekst"`
	Email          Emailadres `json:"email" schema:"datatype:Emailadres"`
	Opvoer         *time.Time `json:"opvoer,omitempty"`
	Afvoer         *time.Time `json:"afvoer,omitempty"`
}

// Gebruiker_GebruikerStatus — Of het account mag inloggen. Materieel: 'geblokkeerd vanaf …' is vooruit in te plannen en weer op te heffen. Ontbreekt dit GE, dan geldt actief.
type Gebruiker_GebruikerStatus struct {
	bun.BaseModel   `bun:"table:gebruiker_gebruikerstatus,alias:gebruiker_gebruikerstatus"`
	Gebruiker_ID    int                                 `json:"gebruiker_id" bun:"gebruiker_id,pk" schema_desc:"ID van de Gebruiker-entiteit"`
	Rel_ID          int                                 `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentGebruiker *Gebruiker                          `json:"-" bun:"rel:belongs-to,join:gebruiker_id=id,on_delete:cascade"`
	Opvoer          *time.Time                          `json:"opvoer,omitempty"`
	Afvoer          *time.Time                          `json:"afvoer,omitempty"`
	Data            []Gebruiker_GebruikerStatus_Data    `bun:"rel:has-many,join:gebruiker_id=gebruiker_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang         []Gebruiker_GebruikerStatus_Aanvang `bun:"rel:has-many,join:gebruiker_id=gebruiker_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde           []Gebruiker_GebruikerStatus_Einde   `bun:"rel:has-many,join:gebruiker_id=gebruiker_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Gebruiker_GebruikerStatus_Data — geversioned inhoud van Gebruiker_GebruikerStatus.
type Gebruiker_GebruikerStatus_Data struct {
	bun.BaseModel `bun:"table:gebruiker_gebruikerstatus_data,alias:gebruiker_gebruikerstatus_data"`
	Gebruiker_ID  int              `json:"gebruiker_id" bun:"gebruiker_id,pk"`
	Rel_ID        int              `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64            `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Status        Gebruikersstatus `json:"status" schema:"enum=Gebruikersstatus"`
	Toelichting   *string          `json:"toelichting,omitempty" schema:"datatype:LangeTekst"`
	Opvoer        *time.Time       `json:"opvoer,omitempty"`
	Afvoer        *time.Time       `json:"afvoer,omitempty"`
}

// Gebruiker_GebruikerStatus_Aanvang — aanvangdatum van Gebruiker_GebruikerStatus.
type Gebruiker_GebruikerStatus_Aanvang struct {
	bun.BaseModel `bun:"table:gebruiker_gebruikerstatus_aanvang,alias:gebruiker_gebruikerstatus_aanvang"`
	Gebruiker_ID  int        `json:"gebruiker_id" bun:"gebruiker_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Gebruiker_GebruikerStatus_Einde — eindedatum van Gebruiker_GebruikerStatus.
type Gebruiker_GebruikerStatus_Einde struct {
	bun.BaseModel `bun:"table:gebruiker_gebruikerstatus_einde,alias:gebruiker_gebruikerstatus_einde"`
	Gebruiker_ID  int        `json:"gebruiker_id" bun:"gebruiker_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Gebruiker_GebruikerRoltoewijzing — Een rol die de gebruiker heeft. Meervoudig en materieel: met een geldigheidsperiode verloopt een proefaccount vanzelf ('editor tot 15-10'), en je kunt terugvragen wie op een datum admin was. Zonder geldige toewijzing heeft de gebruiker geen rechten.
type Gebruiker_GebruikerRoltoewijzing struct {
	bun.BaseModel   `bun:"table:gebruiker_gebruikerroltoewijzing,alias:gebruiker_gebruikerroltoewijzing"`
	Gebruiker_ID    int                                        `json:"gebruiker_id" bun:"gebruiker_id,pk" schema_desc:"ID van de Gebruiker-entiteit"`
	Rel_ID          int                                        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentGebruiker *Gebruiker                                 `json:"-" bun:"rel:belongs-to,join:gebruiker_id=id,on_delete:cascade"`
	Opvoer          *time.Time                                 `json:"opvoer,omitempty"`
	Afvoer          *time.Time                                 `json:"afvoer,omitempty"`
	Data            []Gebruiker_GebruikerRoltoewijzing_Data    `bun:"rel:has-many,join:gebruiker_id=gebruiker_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang         []Gebruiker_GebruikerRoltoewijzing_Aanvang `bun:"rel:has-many,join:gebruiker_id=gebruiker_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde           []Gebruiker_GebruikerRoltoewijzing_Einde   `bun:"rel:has-many,join:gebruiker_id=gebruiker_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Gebruiker_GebruikerRoltoewijzing_Data — geversioned inhoud van Gebruiker_GebruikerRoltoewijzing.
type Gebruiker_GebruikerRoltoewijzing_Data struct {
	bun.BaseModel `bun:"table:gebruiker_gebruikerroltoewijzing_data,alias:gebruiker_gebruikerroltoewijzing_data"`
	Gebruiker_ID  int           `json:"gebruiker_id" bun:"gebruiker_id,pk"`
	Rel_ID        int           `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64         `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Rol           Gebruikersrol `json:"rol" schema:"enum=Gebruikersrol"`
	Domein        *string       `json:"domein,omitempty" schema:"datatype:KorteTekst"`
	Toelichting   *string       `json:"toelichting,omitempty" schema:"datatype:LangeTekst"`
	Opvoer        *time.Time    `json:"opvoer,omitempty"`
	Afvoer        *time.Time    `json:"afvoer,omitempty"`
}

// Gebruiker_GebruikerRoltoewijzing_Aanvang — aanvangdatum van Gebruiker_GebruikerRoltoewijzing.
type Gebruiker_GebruikerRoltoewijzing_Aanvang struct {
	bun.BaseModel `bun:"table:gebruiker_gebruikerroltoewijzing_aanvang,alias:gebruiker_gebruikerroltoewijzing_aanvang"`
	Gebruiker_ID  int        `json:"gebruiker_id" bun:"gebruiker_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Gebruiker_GebruikerRoltoewijzing_Einde — eindedatum van Gebruiker_GebruikerRoltoewijzing.
type Gebruiker_GebruikerRoltoewijzing_Einde struct {
	bun.BaseModel `bun:"table:gebruiker_gebruikerroltoewijzing_einde,alias:gebruiker_gebruikerroltoewijzing_einde"`
	Gebruiker_ID  int        `json:"gebruiker_id" bun:"gebruiker_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
