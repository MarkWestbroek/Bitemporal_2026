package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Medewerkerrol string

const (
	MedewerkerrolMedewerker     Medewerkerrol = "medewerker"
	MedewerkerrolBehandelaar    Medewerkerrol = "behandelaar"
	MedewerkerrolLeidinggevende Medewerkerrol = "leidinggevende"
)

type Kanaalsoort string

const (
	KanaalsoortBalie    Kanaalsoort = "balie"
	KanaalsoortTelefoon Kanaalsoort = "telefoon"
	KanaalsoortEmail    Kanaalsoort = "email"
	KanaalsoortPost     Kanaalsoort = "post"
)

type Gemeentedeelsoort string

const (
	GemeentedeelsoortStadsdeel Gemeentedeelsoort = "Stadsdeel"
	GemeentedeelsoortWijk      Gemeentedeelsoort = "Wijk"
	GemeentedeelsoortBuurt     Gemeentedeelsoort = "Buurt"
)

// Afdeling_Afdelingsnaam — Naam van de afdeling.
type Afdeling_Afdelingsnaam struct {
	bun.BaseModel  `bun:"table:afdeling_afdelingsnaam,alias:afdeling_afdelingsnaam"`
	Afdeling_ID    int                           `json:"afdeling_id" bun:"afdeling_id,pk" schema_desc:"ID van de Afdeling-entiteit"`
	Rel_ID         int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentAfdeling *Afdeling                     `json:"-" bun:"rel:belongs-to,join:afdeling_id=id,on_delete:cascade"`
	Opvoer         *time.Time                    `json:"opvoer,omitempty"`
	Afvoer         *time.Time                    `json:"afvoer,omitempty"`
	Data           []Afdeling_Afdelingsnaam_Data `bun:"rel:has-many,join:afdeling_id=afdeling_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Afdeling_Afdelingsnaam_Data — geversioned inhoud van Afdeling_Afdelingsnaam.
type Afdeling_Afdelingsnaam_Data struct {
	bun.BaseModel `bun:"table:afdeling_afdelingsnaam_data,alias:afdeling_afdelingsnaam_data"`
	Afdeling_ID   int        `json:"afdeling_id" bun:"afdeling_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string     `json:"naam"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Afdelingsorganisatie — De organisatie waartoe de afdeling behoort.
type Afdelingsorganisatie struct {
	bun.BaseModel  `bun:"table:afdelingsorganisatie,alias:afdelingsorganisatie"`
	Afdeling_ID    int                            `json:"afdeling_id" bun:"afdeling_id,pk" schema_desc:"ID van de Afdeling-entiteit"`
	Rel_ID         int                            `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentAfdeling *Afdeling                      `json:"-" bun:"rel:belongs-to,join:afdeling_id=id,on_delete:cascade"`
	Organisatie_ID int                            `json:"organisatie_id"`
	Opvoer         *time.Time                     `json:"opvoer,omitempty"`
	Afvoer         *time.Time                     `json:"afvoer,omitempty"`
	Data           []Afdelingsorganisatie_Data    `bun:"rel:has-many,join:afdeling_id=afdeling_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang        []Afdelingsorganisatie_Aanvang `bun:"rel:has-many,join:afdeling_id=afdeling_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde          []Afdelingsorganisatie_Einde   `bun:"rel:has-many,join:afdeling_id=afdeling_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Afdelingsorganisatie_Data — geversioned inhoud van Afdelingsorganisatie.
type Afdelingsorganisatie_Data struct {
	bun.BaseModel `bun:"table:afdelingsorganisatie_data,alias:afdelingsorganisatie_data"`
	Afdeling_ID   int        `json:"afdeling_id" bun:"afdeling_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Afdelingsorganisatie_Aanvang — aanvangdatum van Afdelingsorganisatie.
type Afdelingsorganisatie_Aanvang struct {
	bun.BaseModel `bun:"table:afdelingsorganisatie_aanvang,alias:afdelingsorganisatie_aanvang"`
	Afdeling_ID   int        `json:"afdeling_id" bun:"afdeling_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Afdelingsorganisatie_Einde — eindedatum van Afdelingsorganisatie.
type Afdelingsorganisatie_Einde struct {
	bun.BaseModel `bun:"table:afdelingsorganisatie_einde,alias:afdelingsorganisatie_einde"`
	Afdeling_ID   int        `json:"afdeling_id" bun:"afdeling_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Medewerker_Medewerkernaam — Naam van de medewerker.
type Medewerker_Medewerkernaam struct {
	bun.BaseModel    `bun:"table:medewerker_medewerkernaam,alias:medewerker_medewerkernaam"`
	Medewerker_ID    int                              `json:"medewerker_id" bun:"medewerker_id,pk" schema_desc:"ID van de Medewerker-entiteit"`
	Rel_ID           int                              `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMedewerker *Medewerker                      `json:"-" bun:"rel:belongs-to,join:medewerker_id=id,on_delete:cascade"`
	Opvoer           *time.Time                       `json:"opvoer,omitempty"`
	Afvoer           *time.Time                       `json:"afvoer,omitempty"`
	Data             []Medewerker_Medewerkernaam_Data `bun:"rel:has-many,join:medewerker_id=medewerker_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Medewerker_Medewerkernaam_Data — geversioned inhoud van Medewerker_Medewerkernaam.
type Medewerker_Medewerkernaam_Data struct {
	bun.BaseModel `bun:"table:medewerker_medewerkernaam_data,alias:medewerker_medewerkernaam_data"`
	Medewerker_ID int        `json:"medewerker_id" bun:"medewerker_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string     `json:"naam"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Medewerker_Aanstelling — Functie en rol van de medewerker.
type Medewerker_Aanstelling struct {
	bun.BaseModel    `bun:"table:medewerker_aanstelling,alias:medewerker_aanstelling"`
	Medewerker_ID    int                           `json:"medewerker_id" bun:"medewerker_id,pk" schema_desc:"ID van de Medewerker-entiteit"`
	Rel_ID           int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMedewerker *Medewerker                   `json:"-" bun:"rel:belongs-to,join:medewerker_id=id,on_delete:cascade"`
	Opvoer           *time.Time                    `json:"opvoer,omitempty"`
	Afvoer           *time.Time                    `json:"afvoer,omitempty"`
	Data             []Medewerker_Aanstelling_Data `bun:"rel:has-many,join:medewerker_id=medewerker_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Medewerker_Aanstelling_Data — geversioned inhoud van Medewerker_Aanstelling.
type Medewerker_Aanstelling_Data struct {
	bun.BaseModel `bun:"table:medewerker_aanstelling_data,alias:medewerker_aanstelling_data"`
	Medewerker_ID int           `json:"medewerker_id" bun:"medewerker_id,pk"`
	Rel_ID        int           `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64         `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Functie       string        `json:"functie"`
	Rol           Medewerkerrol `json:"rol" schema:"enum=Medewerkerrol"`
	Opvoer        *time.Time    `json:"opvoer,omitempty"`
	Afvoer        *time.Time    `json:"afvoer,omitempty"`
}

// Medewerker_Contactkanaal — Kanaal waarlangs de medewerker klanten te woord staat; meervoudig, want een medewerker kan meerdere kanalen bedienen.
type Medewerker_Contactkanaal struct {
	bun.BaseModel    `bun:"table:medewerker_contactkanaal,alias:medewerker_contactkanaal"`
	Medewerker_ID    int                             `json:"medewerker_id" bun:"medewerker_id,pk" schema_desc:"ID van de Medewerker-entiteit"`
	Rel_ID           int                             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMedewerker *Medewerker                     `json:"-" bun:"rel:belongs-to,join:medewerker_id=id,on_delete:cascade"`
	Opvoer           *time.Time                      `json:"opvoer,omitempty"`
	Afvoer           *time.Time                      `json:"afvoer,omitempty"`
	Data             []Medewerker_Contactkanaal_Data `bun:"rel:has-many,join:medewerker_id=medewerker_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Medewerker_Contactkanaal_Data — geversioned inhoud van Medewerker_Contactkanaal.
type Medewerker_Contactkanaal_Data struct {
	bun.BaseModel `bun:"table:medewerker_contactkanaal_data,alias:medewerker_contactkanaal_data"`
	Medewerker_ID int         `json:"medewerker_id" bun:"medewerker_id,pk"`
	Rel_ID        int         `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64       `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Kanaal        Kanaalsoort `json:"kanaal" schema:"enum=Kanaalsoort"`
	Opvoer        *time.Time  `json:"opvoer,omitempty"`
	Afvoer        *time.Time  `json:"afvoer,omitempty"`
}

// Medewerkerafdeling — De afdeling waar de medewerker werkt.
type Medewerkerafdeling struct {
	bun.BaseModel    `bun:"table:medewerkerafdeling,alias:medewerkerafdeling"`
	Medewerker_ID    int                          `json:"medewerker_id" bun:"medewerker_id,pk" schema_desc:"ID van de Medewerker-entiteit"`
	Rel_ID           int                          `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMedewerker *Medewerker                  `json:"-" bun:"rel:belongs-to,join:medewerker_id=id,on_delete:cascade"`
	Afdeling_ID      int                          `json:"afdeling_id"`
	Opvoer           *time.Time                   `json:"opvoer,omitempty"`
	Afvoer           *time.Time                   `json:"afvoer,omitempty"`
	Data             []Medewerkerafdeling_Data    `bun:"rel:has-many,join:medewerker_id=medewerker_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang          []Medewerkerafdeling_Aanvang `bun:"rel:has-many,join:medewerker_id=medewerker_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde            []Medewerkerafdeling_Einde   `bun:"rel:has-many,join:medewerker_id=medewerker_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Medewerkerafdeling_Data — geversioned inhoud van Medewerkerafdeling.
type Medewerkerafdeling_Data struct {
	bun.BaseModel `bun:"table:medewerkerafdeling_data,alias:medewerkerafdeling_data"`
	Medewerker_ID int        `json:"medewerker_id" bun:"medewerker_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Medewerkerafdeling_Aanvang — aanvangdatum van Medewerkerafdeling.
type Medewerkerafdeling_Aanvang struct {
	bun.BaseModel `bun:"table:medewerkerafdeling_aanvang,alias:medewerkerafdeling_aanvang"`
	Medewerker_ID int        `json:"medewerker_id" bun:"medewerker_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Medewerkerafdeling_Einde — eindedatum van Medewerkerafdeling.
type Medewerkerafdeling_Einde struct {
	bun.BaseModel `bun:"table:medewerkerafdeling_einde,alias:medewerkerafdeling_einde"`
	Medewerker_ID int        `json:"medewerker_id" bun:"medewerker_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Gemeentedeel_Wijkaanduiding — Naam en soort van het gemeentedeel.
type Gemeentedeel_Wijkaanduiding struct {
	bun.BaseModel      `bun:"table:gemeentedeel_wijkaanduiding,alias:gemeentedeel_wijkaanduiding"`
	Gemeentedeel_ID    int                                `json:"gemeentedeel_id" bun:"gemeentedeel_id,pk" schema_desc:"ID van de Gemeentedeel-entiteit"`
	Rel_ID             int                                `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentGemeentedeel *Gemeentedeel                      `json:"-" bun:"rel:belongs-to,join:gemeentedeel_id=id,on_delete:cascade"`
	Opvoer             *time.Time                         `json:"opvoer,omitempty"`
	Afvoer             *time.Time                         `json:"afvoer,omitempty"`
	Data               []Gemeentedeel_Wijkaanduiding_Data `bun:"rel:has-many,join:gemeentedeel_id=gemeentedeel_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Gemeentedeel_Wijkaanduiding_Data — geversioned inhoud van Gemeentedeel_Wijkaanduiding.
type Gemeentedeel_Wijkaanduiding_Data struct {
	bun.BaseModel   `bun:"table:gemeentedeel_wijkaanduiding_data,alias:gemeentedeel_wijkaanduiding_data"`
	Gemeentedeel_ID int               `json:"gemeentedeel_id" bun:"gemeentedeel_id,pk"`
	Rel_ID          int               `json:"rel_id" bun:"rel_id,pk"`
	Versie          int64             `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Wijk            string            `json:"wijk"`
	Soort           Gemeentedeelsoort `json:"soort" schema:"enum=Gemeentedeelsoort"`
	Opvoer          *time.Time        `json:"opvoer,omitempty"`
	Afvoer          *time.Time        `json:"afvoer,omitempty"`
}

// Gemeentedeelgemeente — De gemeente waarvan dit een deel is.
type Gemeentedeelgemeente struct {
	bun.BaseModel      `bun:"table:gemeentedeelgemeente,alias:gemeentedeelgemeente"`
	Gemeentedeel_ID    int                            `json:"gemeentedeel_id" bun:"gemeentedeel_id,pk" schema_desc:"ID van de Gemeentedeel-entiteit"`
	Rel_ID             int                            `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentGemeentedeel *Gemeentedeel                  `json:"-" bun:"rel:belongs-to,join:gemeentedeel_id=id,on_delete:cascade"`
	Gemeente_ID        int                            `json:"gemeente_id"`
	Opvoer             *time.Time                     `json:"opvoer,omitempty"`
	Afvoer             *time.Time                     `json:"afvoer,omitempty"`
	Data               []Gemeentedeelgemeente_Data    `bun:"rel:has-many,join:gemeentedeel_id=gemeentedeel_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang            []Gemeentedeelgemeente_Aanvang `bun:"rel:has-many,join:gemeentedeel_id=gemeentedeel_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde              []Gemeentedeelgemeente_Einde   `bun:"rel:has-many,join:gemeentedeel_id=gemeentedeel_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Gemeentedeelgemeente_Data — geversioned inhoud van Gemeentedeelgemeente.
type Gemeentedeelgemeente_Data struct {
	bun.BaseModel   `bun:"table:gemeentedeelgemeente_data,alias:gemeentedeelgemeente_data"`
	Gemeentedeel_ID int        `json:"gemeentedeel_id" bun:"gemeentedeel_id,pk"`
	Rel_ID          int        `json:"rel_id" bun:"rel_id,pk"`
	Versie          int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer          *time.Time `json:"opvoer,omitempty"`
	Afvoer          *time.Time `json:"afvoer,omitempty"`
}

// Gemeentedeelgemeente_Aanvang — aanvangdatum van Gemeentedeelgemeente.
type Gemeentedeelgemeente_Aanvang struct {
	bun.BaseModel   `bun:"table:gemeentedeelgemeente_aanvang,alias:gemeentedeelgemeente_aanvang"`
	Gemeentedeel_ID int        `json:"gemeentedeel_id" bun:"gemeentedeel_id,pk"`
	Rel_ID          int        `json:"rel_id" bun:"rel_id,pk"`
	Versie          int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum           *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer          *time.Time `json:"opvoer,omitempty"`
	Afvoer          *time.Time `json:"afvoer,omitempty"`
}

// Gemeentedeelgemeente_Einde — eindedatum van Gemeentedeelgemeente.
type Gemeentedeelgemeente_Einde struct {
	bun.BaseModel   `bun:"table:gemeentedeelgemeente_einde,alias:gemeentedeelgemeente_einde"`
	Gemeentedeel_ID int        `json:"gemeentedeel_id" bun:"gemeentedeel_id,pk"`
	Rel_ID          int        `json:"rel_id" bun:"rel_id,pk"`
	Versie          int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum           *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer          *time.Time `json:"opvoer,omitempty"`
	Afvoer          *time.Time `json:"afvoer,omitempty"`
}
