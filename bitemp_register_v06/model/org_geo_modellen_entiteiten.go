package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// Afdeling — Organisatorische eenheid binnen een organisatie. Demo-model: dient als tweede register naast NatuurlijkPersoon.
type Afdeling struct {
	bun.BaseModel `bun:"table:afdeling,alias:afdeling"`
	ID            int                      `json:"id" bun:"id,pk"`
	Opvoer        *time.Time               `json:"opvoer,omitempty"`
	Afvoer        *time.Time               `json:"afvoer,omitempty"`
	Afdelingsnaam []Afdeling_Afdelingsnaam `bun:"rel:has-many,join:id=afdeling_id" json:"afdelingsnaam,omitempty"`
	Organisatie   []Afdelingsorganisatie   `bun:"rel:has-many,join:id=afdeling_id" json:"organisatie,omitempty"`
	Aanvang       []Afdeling_Aanvang       `bun:"rel:has-many,join:id=afdeling_id" json:"aanvang,omitempty"`
	Einde         []Afdeling_Einde         `bun:"rel:has-many,join:id=afdeling_id" json:"einde,omitempty"`
}

// Afdeling_Aanvang — aanvangdatum van entiteit Afdeling.
type Afdeling_Aanvang struct {
	bun.BaseModel `bun:"table:afdeling_aanvang,alias:afdeling_aanvang"`
	Afdeling_ID   int        `json:"afdeling_id" bun:"afdeling_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Afdeling_Einde — eindedatum van entiteit Afdeling.
type Afdeling_Einde struct {
	bun.BaseModel `bun:"table:afdeling_einde,alias:afdeling_einde"`
	Afdeling_ID   int        `json:"afdeling_id" bun:"afdeling_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Medewerker — Persoon die namens een afdeling werk verricht. In het demo-beleid is de medewerker de aanvrager; rol, afdeling en kanaal komen als subject-kenmerken uit de PIP.
type Medewerker struct {
	bun.BaseModel  `bun:"table:medewerker,alias:medewerker"`
	ID             int                         `json:"id" bun:"id,pk"`
	Opvoer         *time.Time                  `json:"opvoer,omitempty"`
	Afvoer         *time.Time                  `json:"afvoer,omitempty"`
	Medewerkernaam []Medewerker_Medewerkernaam `bun:"rel:has-many,join:id=medewerker_id" json:"medewerkernaam,omitempty"`
	Aanstelling    []Medewerker_Aanstelling    `bun:"rel:has-many,join:id=medewerker_id" json:"aanstelling,omitempty"`
	Kanalen        []Medewerker_Contactkanaal  `bun:"rel:has-many,join:id=medewerker_id" json:"kanalen,omitempty"`
	Afdeling       []Medewerkerafdeling        `bun:"rel:has-many,join:id=medewerker_id" json:"afdeling,omitempty"`
	Aanvang        []Medewerker_Aanvang        `bun:"rel:has-many,join:id=medewerker_id" json:"aanvang,omitempty"`
	Einde          []Medewerker_Einde          `bun:"rel:has-many,join:id=medewerker_id" json:"einde,omitempty"`
}

// Medewerker_Aanvang — aanvangdatum van entiteit Medewerker.
type Medewerker_Aanvang struct {
	bun.BaseModel `bun:"table:medewerker_aanvang,alias:medewerker_aanvang"`
	Medewerker_ID int        `json:"medewerker_id" bun:"medewerker_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Medewerker_Einde — eindedatum van entiteit Medewerker.
type Medewerker_Einde struct {
	bun.BaseModel `bun:"table:medewerker_einde,alias:medewerker_einde"`
	Medewerker_ID int        `json:"medewerker_id" bun:"medewerker_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Gemeentedeel — Deel van een gemeente (stadsdeel, wijk of buurt). Locaties liggen in een gemeentedeel; het demo-beleid toetst hierop.
type Gemeentedeel struct {
	bun.BaseModel  `bun:"table:gemeentedeel,alias:gemeentedeel"`
	ID             int                           `json:"id" bun:"id,pk"`
	Opvoer         *time.Time                    `json:"opvoer,omitempty"`
	Afvoer         *time.Time                    `json:"afvoer,omitempty"`
	Wijkaanduiding []Gemeentedeel_Wijkaanduiding `bun:"rel:has-many,join:id=gemeentedeel_id" json:"wijkaanduiding,omitempty"`
	Gemeente       []Gemeentedeelgemeente        `bun:"rel:has-many,join:id=gemeentedeel_id" json:"gemeente,omitempty"`
	Aanvang        []Gemeentedeel_Aanvang        `bun:"rel:has-many,join:id=gemeentedeel_id" json:"aanvang,omitempty"`
	Einde          []Gemeentedeel_Einde          `bun:"rel:has-many,join:id=gemeentedeel_id" json:"einde,omitempty"`
}

// Gemeentedeel_Aanvang — aanvangdatum van entiteit Gemeentedeel.
type Gemeentedeel_Aanvang struct {
	bun.BaseModel   `bun:"table:gemeentedeel_aanvang,alias:gemeentedeel_aanvang"`
	Gemeentedeel_ID int        `json:"gemeentedeel_id" bun:"gemeentedeel_id,pk"`
	Versie          int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum           *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer          *time.Time `json:"opvoer,omitempty"`
	Afvoer          *time.Time `json:"afvoer,omitempty"`
}

// Gemeentedeel_Einde — eindedatum van entiteit Gemeentedeel.
type Gemeentedeel_Einde struct {
	bun.BaseModel   `bun:"table:gemeentedeel_einde,alias:gemeentedeel_einde"`
	Gemeentedeel_ID int        `json:"gemeentedeel_id" bun:"gemeentedeel_id,pk"`
	Versie          int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum           *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer          *time.Time `json:"opvoer,omitempty"`
	Afvoer          *time.Time `json:"afvoer,omitempty"`
}
