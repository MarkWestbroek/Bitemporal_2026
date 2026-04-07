package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// Initiatief — Portfolio-initiatief met planning, productinformatie en bijdragen.
type Initiatief struct {
	bun.BaseModel            `bun:"table:initiatief,alias:initiatief"`
	ID                       int                      `json:"id" bun:"id,pk"`
	Opvoer                   *time.Time               `json:"opvoer,omitempty"`
	Afvoer                   *time.Time               `json:"afvoer,omitempty"`
	Planningen               []Initiatief_Planning    `bun:"rel:has-many,join:id=initiatief_id" json:"planningen,omitempty"`
	Producten                []Initiatief_Product     `bun:"rel:has-many,join:id=initiatief_id" json:"producten,omitempty"`
	Bijdragen                []Initiatief_Bijdrage    `bun:"rel:has-many,join:id=initiatief_id" json:"bijdragen,omitempty"`
	InitiatiefGemeenten      []InitiatiefGemeente     `bun:"rel:has-many,join:id=initiatief_id" json:"initiatief_gemeenten,omitempty"`
	InitiatiefDomeinen       []InitiatiefDomein       `bun:"rel:has-many,join:id=initiatief_id" json:"initiatief_domeinen,omitempty"`
	InitiatiefApiStandaarden []InitiatiefAPIStandaard `bun:"rel:has-many,join:id=initiatief_id" json:"initiatief_api_standaarden,omitempty"`
	Aanvang                  []Initiatief_Aanvang     `bun:"rel:has-many,join:id=initiatief_id" json:"aanvang,omitempty"`
	Einde                    []Initiatief_Einde       `bun:"rel:has-many,join:id=initiatief_id" json:"einde,omitempty"`
}

// Initiatief_Aanvang — aanvangdatum van entiteit Initiatief.
type Initiatief_Aanvang struct {
	bun.BaseModel `bun:"table:initiatief_aanvang,alias:initiatief_aanvang"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Initiatief_Einde — eindedatum van entiteit Initiatief.
type Initiatief_Einde struct {
	bun.BaseModel `bun:"table:initiatief_einde,alias:initiatief_einde"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Organisatie — Organisatie die betrokken is bij initiatieven in het portfolio.
type Organisatie struct {
	bun.BaseModel     `bun:"table:organisatie,alias:organisatie"`
	ID                int                           `json:"id" bun:"id,pk"`
	Opvoer            *time.Time                    `json:"opvoer,omitempty"`
	Afvoer            *time.Time                    `json:"afvoer,omitempty"`
	Contactgegevens   []Organisatie_Contactgegevens `bun:"rel:has-many,join:id=organisatie_id" json:"contactgegevens,omitempty"`
	OrganisatieRollen []Organisatie_Organisatierol  `bun:"rel:has-many,join:id=organisatie_id" json:"organisatie_rollen,omitempty"`
	Organisatienamen  []Organisatie_Organisatienaam `bun:"rel:has-many,join:id=organisatie_id" json:"organisatienamen,omitempty"`
	Contactpersonen   []Contactpersoon              `bun:"rel:has-many,join:id=organisatie_id" json:"contactpersonen,omitempty"`
	Aanvang           []Organisatie_Aanvang         `bun:"rel:has-many,join:id=organisatie_id" json:"aanvang,omitempty"`
	Einde             []Organisatie_Einde           `bun:"rel:has-many,join:id=organisatie_id" json:"einde,omitempty"`
}

// Organisatie_Aanvang — aanvangdatum van entiteit Organisatie.
type Organisatie_Aanvang struct {
	bun.BaseModel  `bun:"table:organisatie_aanvang,alias:organisatie_aanvang"`
	Organisatie_ID int        `json:"organisatie_id" bun:"organisatie_id,pk"`
	Versie         int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum          *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer         *time.Time `json:"opvoer,omitempty"`
	Afvoer         *time.Time `json:"afvoer,omitempty"`
}

// Organisatie_Einde — eindedatum van entiteit Organisatie.
type Organisatie_Einde struct {
	bun.BaseModel  `bun:"table:organisatie_einde,alias:organisatie_einde"`
	Organisatie_ID int        `json:"organisatie_id" bun:"organisatie_id,pk"`
	Versie         int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum          *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer         *time.Time `json:"opvoer,omitempty"`
	Afvoer         *time.Time `json:"afvoer,omitempty"`
}

// Persoon — Persoon die betrokken is bij initiatieven in het portfolio.
type Persoon struct {
	bun.BaseModel   `bun:"table:persoon,alias:persoon"`
	ID              int                       `json:"id" bun:"id,pk"`
	Opvoer          *time.Time                `json:"opvoer,omitempty"`
	Afvoer          *time.Time                `json:"afvoer,omitempty"`
	Contactgegevens []Persoon_Contactgegevens `bun:"rel:has-many,join:id=persoon_id" json:"contactgegevens,omitempty"`
	Persoonnamen    []Persoon_Persoonnaam     `bun:"rel:has-many,join:id=persoon_id" json:"persoonnamen,omitempty"`
	Aanvang         []Persoon_Aanvang         `bun:"rel:has-many,join:id=persoon_id" json:"aanvang,omitempty"`
	Einde           []Persoon_Einde           `bun:"rel:has-many,join:id=persoon_id" json:"einde,omitempty"`
}

// Persoon_Aanvang — aanvangdatum van entiteit Persoon.
type Persoon_Aanvang struct {
	bun.BaseModel `bun:"table:persoon_aanvang,alias:persoon_aanvang"`
	Persoon_ID    int        `json:"persoon_id" bun:"persoon_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Persoon_Einde — eindedatum van entiteit Persoon.
type Persoon_Einde struct {
	bun.BaseModel `bun:"table:persoon_einde,alias:persoon_einde"`
	Persoon_ID    int        `json:"persoon_id" bun:"persoon_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Gemeente — Referentielijst-item voor gemeenten.
type Gemeente struct {
	bun.BaseModel    `bun:"table:gemeente,alias:gemeente"`
	ID               int                `json:"id" bun:"id,pk"`
	Opvoer           *time.Time         `json:"opvoer,omitempty"`
	Afvoer           *time.Time         `json:"afvoer,omitempty"`
	Gemeentegegevens []GemeenteGegevens `bun:"rel:has-many,join:id=gemeente_id" json:"gemeentegegevens,omitempty"`
}

// Domein — Referentielijst-item voor domeinen.
type Domein struct {
	bun.BaseModel  `bun:"table:domein,alias:domein"`
	ID             int              `json:"id" bun:"id,pk"`
	Opvoer         *time.Time       `json:"opvoer,omitempty"`
	Afvoer         *time.Time       `json:"afvoer,omitempty"`
	Domeingegevens []DomeinGegevens `bun:"rel:has-many,join:id=domein_id" json:"domeingegevens,omitempty"`
}

type ApiStandaard struct {
	bun.BaseModel     `bun:"table:apistandaard,alias:apistandaard"`
	ID                int                  `json:"id" bun:"id,pk"`
	Opvoer            *time.Time           `json:"opvoer,omitempty"`
	Afvoer            *time.Time           `json:"afvoer,omitempty"`
	ApiStandaardNamen []API_standaard_naam `bun:"rel:has-many,join:id=apistandaard_id" json:"api_standaard_namen,omitempty"`
}
