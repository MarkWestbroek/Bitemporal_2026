package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type ApiStandaard struct {
	bun.BaseModel     `bun:"table:apistandaard,alias:apistandaard"`
	ID                int                 `json:"id" bun:"id,pk"`
	Opvoer            *time.Time          `json:"opvoer,omitempty"`
	Afvoer            *time.Time          `json:"afvoer,omitempty"`
	ApiStandaardNamen []ApiStandaard_Naam `bun:"rel:has-many,join:id=apistandaard_id" json:"api_standaard_namen,omitempty"`
}

// Domein — Referentielijst-item voor domeinen.
type Domein struct {
	bun.BaseModel  `bun:"table:domein,alias:domein"`
	ID             int                     `json:"id" bun:"id,pk"`
	Opvoer         *time.Time              `json:"opvoer,omitempty"`
	Afvoer         *time.Time              `json:"afvoer,omitempty"`
	Domeingegevens []Domein_DomeinGegevens `bun:"rel:has-many,join:id=domein_id" json:"domeingegevens,omitempty"`
}

// Gemeente — Referentielijst-item voor gemeenten.
type Gemeente struct {
	bun.BaseModel    `bun:"table:gemeente,alias:gemeente"`
	ID               int                         `json:"id" bun:"id,pk"`
	Opvoer           *time.Time                  `json:"opvoer,omitempty"`
	Afvoer           *time.Time                  `json:"afvoer,omitempty"`
	Gemeentegegevens []Gemeente_GemeenteGegevens `bun:"rel:has-many,join:id=gemeente_id" json:"gemeentegegevens,omitempty"`
}

// Initiatief — Portfolio-initiatief met planning, productinformatie en bijdragen.
type Initiatief struct {
	bun.BaseModel            `bun:"table:initiatief,alias:initiatief"`
	ID                       int                             `json:"id" bun:"id,pk"`
	Opvoer                   *time.Time                      `json:"opvoer,omitempty"`
	Afvoer                   *time.Time                      `json:"afvoer,omitempty"`
	Planningen               []Initiatief_Planning           `bun:"rel:has-many,join:id=initiatief_id" json:"planningen,omitempty"`
	Producten                []Initiatief_Product            `bun:"rel:has-many,join:id=initiatief_id" json:"producten,omitempty"`
	Bijdragen                []Initiatief_Bijdrage           `bun:"rel:has-many,join:id=initiatief_id" json:"bijdragen,omitempty"`
	AndereDomeinen           []Initiatief_AnderDomein        `bun:"rel:has-many,join:id=initiatief_id" json:"andere_domeinen,omitempty"`
	AndersDanGemeenten       []Initiatief_AndersDanGemeente  `bun:"rel:has-many,join:id=initiatief_id" json:"anders_dan_gemeenten,omitempty"`
	AndereApiStandaarden     []Initiatief_AndereAPIStandaard `bun:"rel:has-many,join:id=initiatief_id" json:"andere_api_standaarden,omitempty"`
	Initiatiefinfos          []Initiatief_Initiatiefinfo     `bun:"rel:has-many,join:id=initiatief_id" json:"initiatiefinfos,omitempty"`
	InitiatiefGemeenten      []InitiatiefGemeente            `bun:"rel:has-many,join:id=initiatief_id" json:"initiatief_gemeenten,omitempty"`
	InitiatiefDomeinen       []InitiatiefDomein              `bun:"rel:has-many,join:id=initiatief_id" json:"initiatief_domeinen,omitempty"`
	InitiatiefApiStandaarden []InitiatiefAPIStandaard        `bun:"rel:has-many,join:id=initiatief_id" json:"initiatief_api_standaarden,omitempty"`
	InitiatiefOrganisaties   []InitiatiefOrganisatie         `bun:"rel:has-many,join:id=initiatief_id" json:"initiatief_organisaties,omitempty"`
	Aanvang                  []Initiatief_Aanvang            `bun:"rel:has-many,join:id=initiatief_id" json:"aanvang,omitempty"`
	Einde                    []Initiatief_Einde              `bun:"rel:has-many,join:id=initiatief_id" json:"einde,omitempty"`
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
	bun.BaseModel              `bun:"table:organisatie,alias:organisatie"`
	ID                         int                                    `json:"id" bun:"id,pk"`
	Opvoer                     *time.Time                             `json:"opvoer,omitempty"`
	Afvoer                     *time.Time                             `json:"afvoer,omitempty"`
	OrganisatieContactgegevens []Organisatie_Contactgegevens          `bun:"rel:has-many,join:id=organisatie_id" json:"organisatie_contactgegevens,omitempty"`
	Organisatienamen           []Organisatie_Organisatienaam          `bun:"rel:has-many,join:id=organisatie_id" json:"organisatienamen,omitempty"`
	BetrokkenOrganisatietypen  []Organisatie_BetrokkenOrganisatietype `bun:"rel:has-many,join:id=organisatie_id" json:"betrokken_organisatietypen,omitempty"`
	Contactpersonen            []Contactpersoon                       `bun:"rel:has-many,join:id=organisatie_id" json:"contactpersonen,omitempty"`
	Aanvang                    []Organisatie_Aanvang                  `bun:"rel:has-many,join:id=organisatie_id" json:"aanvang,omitempty"`
	Einde                      []Organisatie_Einde                    `bun:"rel:has-many,join:id=organisatie_id" json:"einde,omitempty"`
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
	bun.BaseModel          `bun:"table:persoon,alias:persoon"`
	ID                     int                       `json:"id" bun:"id,pk"`
	Opvoer                 *time.Time                `json:"opvoer,omitempty"`
	Afvoer                 *time.Time                `json:"afvoer,omitempty"`
	PersoonContactgegevens []Persoon_Contactgegevens `bun:"rel:has-many,join:id=persoon_id" json:"persoon_contactgegevens,omitempty"`
	Persoonnamen           []Persoon_Persoonnaam     `bun:"rel:has-many,join:id=persoon_id" json:"persoonnamen,omitempty"`
	Aanvang                []Persoon_Aanvang         `bun:"rel:has-many,join:id=persoon_id" json:"aanvang,omitempty"`
	Einde                  []Persoon_Einde           `bun:"rel:has-many,join:id=persoon_id" json:"einde,omitempty"`
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
