package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Fase string

const (
	FaseIdeenoggeenconcreteopbrengsten                           Fase = "Idee (nog geen concrete opbrengsten)"
	FaseInitiatiealeensnellePOC                                  Fase = "Initiatie (al een snelle POC)"
	FaseRealisatiegaatbinnenkortdraaienbijeerstegemeenten        Fase = "Realisatie (gaat binnenkort draaien bij eerste gemeenten)"
	FaseOpschalingdraaitbijenkelegemeentennuopzoeknaarverbreding Fase = "Opschaling (draait bij enkele gemeenten, nu op zoek naar verbreding)"
	FaseDoorontwikkelingenbeheer                                 Fase = "Doorontwikkeling en beheer"
	FaseDoorontwikkelingenbeheerstabielonderdeelgevestigdeorde   Fase = "Doorontwikkeling en beheer (stabiel, onderdeel gevestigde orde)"
)

type Producttype string

const (
	ProducttypeComponent  Producttype = "Component"
	ProducttypeToepassing Producttype = "Toepassing"
)

type CGLaag string

const (
	CGLaagLaag5                   CGLaag = "Laag 5"
	CGLaagLaag4                   CGLaag = "Laag 4"
	CGLaagLaag3                   CGLaag = "Laag 3"
	CGLaagLaag2                   CGLaag = "Laag 2"
	CGLaagLaag1                   CGLaag = "Laag 1"
	CGLaagHostingeninfrastructuur CGLaag = "Hosting en infrastructuur"
)

type Bijdragetype string

const (
	BijdragetypeWendbaarheid    Bijdragetype = "Wendbaarheid"
	BijdragetypeDienstverlening Bijdragetype = "Dienstverlening"
	BijdragetypeRegie           Bijdragetype = "Regie"
)

type Schaal string

const (
	SchaalSchaal1 Schaal = "Schaal 1"
	SchaalSchaal2 Schaal = "Schaal 2"
	SchaalSchaal3 Schaal = "Schaal 3"
	SchaalSchaal4 Schaal = "Schaal 4"
)

type Gemeenterol string

const (
	GemeenterolRealiseert      Gemeenterol = "Realiseert"
	GemeenterolMaaktgebruikvan Gemeenterol = "Maakt gebruik van"
)

type Organisatierol string

const (
	OrganisatierolContactorganisatie   Organisatierol = "Contactorganisatie"
	OrganisatierolBetrokkenOrganisatie Organisatierol = "BetrokkenOrganisatie"
)

type Organisatietype string

const (
	OrganisatietypeGemeenten     Organisatietype = "Gemeenten"
	OrganisatietypeLeveranciers  Organisatietype = "Leveranciers"
	OrganisatietypeVNG           Organisatietype = "VNG"
	OrganisatietypeKetenpartners Organisatietype = "Ketenpartners"
	OrganisatietypeRijk          Organisatietype = "Rijk"
)

type ApiStandaard_Naam struct {
	bun.BaseModel      `bun:"table:apistandaard_naam,alias:apistandaard_naam"`
	ApiStandaard_ID    int                      `json:"apistandaard_id" bun:"apistandaard_id,pk" schema_desc:"ID van de ApiStandaard-entiteit"`
	Rel_ID             int                      `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentApiStandaard *ApiStandaard            `json:"-" bun:"rel:belongs-to,join:apistandaard_id=id,on_delete:cascade"`
	Opvoer             *time.Time               `json:"opvoer,omitempty"`
	Afvoer             *time.Time               `json:"afvoer,omitempty"`
	Data               []ApiStandaard_Naam_Data `bun:"rel:has-many,join:apistandaard_id=apistandaard_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// ApiStandaard_Naam_Data — geversioned inhoud van ApiStandaard_Naam.
type ApiStandaard_Naam_Data struct {
	bun.BaseModel   `bun:"table:apistandaard_naam_data,alias:apistandaard_naam_data"`
	ApiStandaard_ID int        `json:"apistandaard_id" bun:"apistandaard_id,pk"`
	Rel_ID          int        `json:"rel_id" bun:"rel_id,pk"`
	Versie          int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam            string     `json:"naam"`
	Opvoer          *time.Time `json:"opvoer,omitempty"`
	Afvoer          *time.Time `json:"afvoer,omitempty"`
}

// Domein_DomeinGegevens — Basisgegevens van een domein.
type Domein_DomeinGegevens struct {
	bun.BaseModel `bun:"table:domein_domeingegevens,alias:domein_domeingegevens"`
	Domein_ID     int                          `json:"domein_id" bun:"domein_id,pk" schema_desc:"ID van de Domein-entiteit"`
	Rel_ID        int                          `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentDomein  *Domein                      `json:"-" bun:"rel:belongs-to,join:domein_id=id,on_delete:cascade"`
	Opvoer        *time.Time                   `json:"opvoer,omitempty"`
	Afvoer        *time.Time                   `json:"afvoer,omitempty"`
	Data          []Domein_DomeinGegevens_Data `bun:"rel:has-many,join:domein_id=domein_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Domein_DomeinGegevens_Data — geversioned inhoud van Domein_DomeinGegevens.
type Domein_DomeinGegevens_Data struct {
	bun.BaseModel `bun:"table:domein_domeingegevens_data,alias:domein_domeingegevens_data"`
	Domein_ID     int        `json:"domein_id" bun:"domein_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string     `json:"naam"`
	Omschrijving  string     `json:"omschrijving"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Gemeente_GemeenteGegevens — Basisgegevens van een gemeente.
type Gemeente_GemeenteGegevens struct {
	bun.BaseModel  `bun:"table:gemeente_gemeentegegevens,alias:gemeente_gemeentegegevens"`
	Gemeente_ID    int                              `json:"gemeente_id" bun:"gemeente_id,pk" schema_desc:"ID van de Gemeente-entiteit"`
	Rel_ID         int                              `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentGemeente *Gemeente                        `json:"-" bun:"rel:belongs-to,join:gemeente_id=id,on_delete:cascade"`
	Opvoer         *time.Time                       `json:"opvoer,omitempty"`
	Afvoer         *time.Time                       `json:"afvoer,omitempty"`
	Data           []Gemeente_GemeenteGegevens_Data `bun:"rel:has-many,join:gemeente_id=gemeente_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Gemeente_GemeenteGegevens_Data — geversioned inhoud van Gemeente_GemeenteGegevens.
type Gemeente_GemeenteGegevens_Data struct {
	bun.BaseModel `bun:"table:gemeente_gemeentegegevens_data,alias:gemeente_gemeentegegevens_data"`
	Gemeente_ID   int        `json:"gemeente_id" bun:"gemeente_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string     `json:"naam"`
	Code          string     `json:"code"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Initiatief_Planning — Planning en voortgang van het initiatief.
type Initiatief_Planning struct {
	bun.BaseModel    `bun:"table:initiatief_planning,alias:initiatief_planning"`
	Initiatief_ID    int                           `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                   `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Opvoer           *time.Time                    `json:"opvoer,omitempty"`
	Afvoer           *time.Time                    `json:"afvoer,omitempty"`
	Data             []Initiatief_Planning_Data    `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang          []Initiatief_Planning_Aanvang `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde            []Initiatief_Planning_Einde   `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Initiatief_Planning_Data — geversioned inhoud van Initiatief_Planning.
type Initiatief_Planning_Data struct {
	bun.BaseModel       `bun:"table:initiatief_planning_data,alias:initiatief_planning_data"`
	Initiatief_ID       int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID              int        `json:"rel_id" bun:"rel_id,pk"`
	Versie              int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Planningsinfo       string     `json:"planningsinfo"`
	Startdatum          Date       `json:"startdatum" bun:"startdatum,type:date"`
	ReadyForUse         Date       `json:"ready_for_use" bun:"ready_for_use,type:date"`
	WaarTegenaanGelopen string     `json:"waar_tegenaan_gelopen"`
	Fase                Fase       `json:"fase" schema:"enum=Fase"`
	Opvoer              *time.Time `json:"opvoer,omitempty"`
	Afvoer              *time.Time `json:"afvoer,omitempty"`
}

// Initiatief_Planning_Aanvang — aanvangdatum van Initiatief_Planning.
type Initiatief_Planning_Aanvang struct {
	bun.BaseModel `bun:"table:initiatief_planning_aanvang,alias:initiatief_planning_aanvang"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Initiatief_Planning_Einde — eindedatum van Initiatief_Planning.
type Initiatief_Planning_Einde struct {
	bun.BaseModel `bun:"table:initiatief_planning_einde,alias:initiatief_planning_einde"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Initiatief_Product — Beschrijving van het product dat bij het initiatief hoort.
type Initiatief_Product struct {
	bun.BaseModel    `bun:"table:initiatief_product,alias:initiatief_product"`
	Initiatief_ID    int                          `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                          `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                  `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Opvoer           *time.Time                   `json:"opvoer,omitempty"`
	Afvoer           *time.Time                   `json:"afvoer,omitempty"`
	Data             []Initiatief_Product_Data    `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang          []Initiatief_Product_Aanvang `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde            []Initiatief_Product_Einde   `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Initiatief_Product_Data — geversioned inhoud van Initiatief_Product.
type Initiatief_Product_Data struct {
	bun.BaseModel `bun:"table:initiatief_product_data,alias:initiatief_product_data"`
	Initiatief_ID int         `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int         `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64       `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string      `json:"naam"`
	Omschrijving  *string     `json:"omschrijving,omitempty"`
	Type          Producttype `json:"type" schema:"enum=Producttype"`
	CGLaag        CGLaag      `json:"CG_laag" schema:"enum=CGLaag"`
	Pitch         *string     `json:"pitch,omitempty"`
	Website       *URL        `json:"website,omitempty" schema:"datatype:URL"`
	GitRepo       *GitAdres   `json:"git_repo,omitempty" schema:"datatype:GitAdres"`
	Opvoer        *time.Time  `json:"opvoer,omitempty"`
	Afvoer        *time.Time  `json:"afvoer,omitempty"`
}

// Initiatief_Product_Aanvang — aanvangdatum van Initiatief_Product.
type Initiatief_Product_Aanvang struct {
	bun.BaseModel `bun:"table:initiatief_product_aanvang,alias:initiatief_product_aanvang"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Initiatief_Product_Einde — eindedatum van Initiatief_Product.
type Initiatief_Product_Einde struct {
	bun.BaseModel `bun:"table:initiatief_product_einde,alias:initiatief_product_einde"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Initiatief_Bijdrage — Bijdrage van het initiatief aan bredere doelen.
type Initiatief_Bijdrage struct {
	bun.BaseModel    `bun:"table:initiatief_bijdrage,alias:initiatief_bijdrage"`
	Initiatief_ID    int                           `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                   `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Opvoer           *time.Time                    `json:"opvoer,omitempty"`
	Afvoer           *time.Time                    `json:"afvoer,omitempty"`
	Data             []Initiatief_Bijdrage_Data    `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang          []Initiatief_Bijdrage_Aanvang `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde            []Initiatief_Bijdrage_Einde   `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Initiatief_Bijdrage_Data — geversioned inhoud van Initiatief_Bijdrage.
type Initiatief_Bijdrage_Data struct {
	bun.BaseModel `bun:"table:initiatief_bijdrage_data,alias:initiatief_bijdrage_data"`
	Initiatief_ID int          `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int          `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64        `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	TypeBijdrage  Bijdragetype `json:"type_bijdrage" schema:"enum=Bijdragetype"`
	Schaal        Schaal       `json:"schaal" schema:"enum=Schaal"`
	Toelichting   string       `json:"toelichting"`
	Opvoer        *time.Time   `json:"opvoer,omitempty"`
	Afvoer        *time.Time   `json:"afvoer,omitempty"`
}

// Initiatief_Bijdrage_Aanvang — aanvangdatum van Initiatief_Bijdrage.
type Initiatief_Bijdrage_Aanvang struct {
	bun.BaseModel `bun:"table:initiatief_bijdrage_aanvang,alias:initiatief_bijdrage_aanvang"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Initiatief_Bijdrage_Einde — eindedatum van Initiatief_Bijdrage.
type Initiatief_Bijdrage_Einde struct {
	bun.BaseModel `bun:"table:initiatief_bijdrage_einde,alias:initiatief_bijdrage_einde"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

type Initiatief_AnderDomein struct {
	bun.BaseModel    `bun:"table:initiatief_anderdomein,alias:initiatief_anderdomein"`
	Initiatief_ID    int                           `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                   `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Opvoer           *time.Time                    `json:"opvoer,omitempty"`
	Afvoer           *time.Time                    `json:"afvoer,omitempty"`
	Data             []Initiatief_AnderDomein_Data `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Initiatief_AnderDomein_Data — geversioned inhoud van Initiatief_AnderDomein.
type Initiatief_AnderDomein_Data struct {
	bun.BaseModel `bun:"table:initiatief_anderdomein_data,alias:initiatief_anderdomein_data"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Domein        *string    `json:"domein,omitempty"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

type Initiatief_AndersDanGemeente struct {
	bun.BaseModel    `bun:"table:initiatief_andersdangemeente,alias:initiatief_andersdangemeente"`
	Initiatief_ID    int                                 `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                                 `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                         `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Opvoer           *time.Time                          `json:"opvoer,omitempty"`
	Afvoer           *time.Time                          `json:"afvoer,omitempty"`
	Data             []Initiatief_AndersDanGemeente_Data `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Initiatief_AndersDanGemeente_Data — geversioned inhoud van Initiatief_AndersDanGemeente.
type Initiatief_AndersDanGemeente_Data struct {
	bun.BaseModel     `bun:"table:initiatief_andersdangemeente_data,alias:initiatief_andersdangemeente_data"`
	Initiatief_ID     int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID            int        `json:"rel_id" bun:"rel_id,pk"`
	Versie            int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	AndersDanGemeente *string    `json:"andersDanGemeente,omitempty"`
	Opvoer            *time.Time `json:"opvoer,omitempty"`
	Afvoer            *time.Time `json:"afvoer,omitempty"`
}

type Initiatief_AndereAPIStandaard struct {
	bun.BaseModel    `bun:"table:initiatief_andereapistandaard,alias:initiatief_andereapistandaard"`
	Initiatief_ID    int                                  `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                          `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Opvoer           *time.Time                           `json:"opvoer,omitempty"`
	Afvoer           *time.Time                           `json:"afvoer,omitempty"`
	Data             []Initiatief_AndereAPIStandaard_Data `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Initiatief_AndereAPIStandaard_Data — geversioned inhoud van Initiatief_AndereAPIStandaard.
type Initiatief_AndereAPIStandaard_Data struct {
	bun.BaseModel `bun:"table:initiatief_andereapistandaard_data,alias:initiatief_andereapistandaard_data"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	ApiStandaard  *string    `json:"api_standaard,omitempty"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

type Initiatief_Initiatiefinfo struct {
	bun.BaseModel    `bun:"table:initiatief_initiatiefinfo,alias:initiatief_initiatiefinfo"`
	Initiatief_ID    int                              `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                              `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                      `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Opvoer           *time.Time                       `json:"opvoer,omitempty"`
	Afvoer           *time.Time                       `json:"afvoer,omitempty"`
	Data             []Initiatief_Initiatiefinfo_Data `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Initiatief_Initiatiefinfo_Data — geversioned inhoud van Initiatief_Initiatiefinfo.
type Initiatief_Initiatiefinfo_Data struct {
	bun.BaseModel `bun:"table:initiatief_initiatiefinfo_data,alias:initiatief_initiatiefinfo_data"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Informatie    string     `json:"informatie"`
	PbiID         int        `json:"PbiID"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

type Initiatief_BetrokkenOrganisatie struct {
	bun.BaseModel    `bun:"table:initiatief_betrokkenorganisatie,alias:initiatief_betrokkenorganisatie"`
	Initiatief_ID    int                                    `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                                    `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                            `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Opvoer           *time.Time                             `json:"opvoer,omitempty"`
	Afvoer           *time.Time                             `json:"afvoer,omitempty"`
	Data             []Initiatief_BetrokkenOrganisatie_Data `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Initiatief_BetrokkenOrganisatie_Data — geversioned inhoud van Initiatief_BetrokkenOrganisatie.
type Initiatief_BetrokkenOrganisatie_Data struct {
	bun.BaseModel `bun:"table:initiatief_betrokkenorganisatie_data,alias:initiatief_betrokkenorganisatie_data"`
	Initiatief_ID int             `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int             `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64           `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Type          Organisatietype `json:"type" schema:"enum=Organisatietype"`
	Opvoer        *time.Time      `json:"opvoer,omitempty"`
	Afvoer        *time.Time      `json:"afvoer,omitempty"`
}

type InitiatiefGemeente struct {
	bun.BaseModel    `bun:"table:initiatiefgemeente,alias:initiatiefgemeente"`
	Initiatief_ID    int                       `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                       `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief               `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Gemeente_ID      int                       `json:"gemeente_id"`
	Opvoer           *time.Time                `json:"opvoer,omitempty"`
	Afvoer           *time.Time                `json:"afvoer,omitempty"`
	Data             []InitiatiefGemeente_Data `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// InitiatiefGemeente_Data — geversioned inhoud van InitiatiefGemeente.
type InitiatiefGemeente_Data struct {
	bun.BaseModel `bun:"table:initiatiefgemeente_data,alias:initiatiefgemeente_data"`
	Initiatief_ID int         `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int         `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64       `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Rol           Gemeenterol `json:"rol" schema:"enum=Gemeenterol"`
	Opvoer        *time.Time  `json:"opvoer,omitempty"`
	Afvoer        *time.Time  `json:"afvoer,omitempty"`
}

type InitiatiefDomein struct {
	bun.BaseModel    `bun:"table:initiatiefdomein,alias:initiatiefdomein"`
	Initiatief_ID    int                     `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                     `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief             `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Domein_ID        int                     `json:"domein_id"`
	Opvoer           *time.Time              `json:"opvoer,omitempty"`
	Afvoer           *time.Time              `json:"afvoer,omitempty"`
	Data             []InitiatiefDomein_Data `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// InitiatiefDomein_Data — geversioned inhoud van InitiatiefDomein.
type InitiatiefDomein_Data struct {
	bun.BaseModel `bun:"table:initiatiefdomein_data,alias:initiatiefdomein_data"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

type InitiatiefAPIStandaard struct {
	bun.BaseModel    `bun:"table:initiatiefapistandaard,alias:initiatiefapistandaard"`
	Initiatief_ID    int                           `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                   `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Apistandaard_ID  int                           `json:"apistandaard_id"`
	Opvoer           *time.Time                    `json:"opvoer,omitempty"`
	Afvoer           *time.Time                    `json:"afvoer,omitempty"`
	Data             []InitiatiefAPIStandaard_Data `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// InitiatiefAPIStandaard_Data — geversioned inhoud van InitiatiefAPIStandaard.
type InitiatiefAPIStandaard_Data struct {
	bun.BaseModel `bun:"table:initiatiefapistandaard_data,alias:initiatiefapistandaard_data"`
	Initiatief_ID int        `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// InitiatiefOrganisatie — de organisaties bij een initiatief
type InitiatiefOrganisatie struct {
	bun.BaseModel    `bun:"table:initiatieforganisatie,alias:initiatieforganisatie"`
	Initiatief_ID    int                          `json:"initiatief_id" bun:"initiatief_id,pk" schema_desc:"ID van de Initiatief-entiteit"`
	Rel_ID           int                          `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentInitiatief *Initiatief                  `json:"-" bun:"rel:belongs-to,join:initiatief_id=id,on_delete:cascade"`
	Organisatie_ID   int                          `json:"organisatie_id"`
	Opvoer           *time.Time                   `json:"opvoer,omitempty"`
	Afvoer           *time.Time                   `json:"afvoer,omitempty"`
	Data             []InitiatiefOrganisatie_Data `bun:"rel:has-many,join:initiatief_id=initiatief_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// InitiatiefOrganisatie_Data — geversioned inhoud van InitiatiefOrganisatie.
type InitiatiefOrganisatie_Data struct {
	bun.BaseModel `bun:"table:initiatieforganisatie_data,alias:initiatieforganisatie_data"`
	Initiatief_ID int             `json:"initiatief_id" bun:"initiatief_id,pk"`
	Rel_ID        int             `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64           `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Rol           *Organisatierol `json:"rol,omitempty" schema:"enum=Organisatierol"`
	Opvoer        *time.Time      `json:"opvoer,omitempty"`
	Afvoer        *time.Time      `json:"afvoer,omitempty"`
}

// Organisatie_Contactgegevens — Contactgegevens van de organisatie.
type Organisatie_Contactgegevens struct {
	bun.BaseModel     `bun:"table:organisatie_contactgegevens,alias:organisatie_contactgegevens"`
	Organisatie_ID    int                                `json:"organisatie_id" bun:"organisatie_id,pk" schema_desc:"ID van de Organisatie-entiteit"`
	Rel_ID            int                                `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentOrganisatie *Organisatie                       `json:"-" bun:"rel:belongs-to,join:organisatie_id=id,on_delete:cascade"`
	Opvoer            *time.Time                         `json:"opvoer,omitempty"`
	Afvoer            *time.Time                         `json:"afvoer,omitempty"`
	Data              []Organisatie_Contactgegevens_Data `bun:"rel:has-many,join:organisatie_id=organisatie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Organisatie_Contactgegevens_Data — geversioned inhoud van Organisatie_Contactgegevens.
type Organisatie_Contactgegevens_Data struct {
	bun.BaseModel  `bun:"table:organisatie_contactgegevens_data,alias:organisatie_contactgegevens_data"`
	Organisatie_ID int            `json:"organisatie_id" bun:"organisatie_id,pk"`
	Rel_ID         int            `json:"rel_id" bun:"rel_id,pk"`
	Versie         int64          `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Url            URL            `json:"url" schema:"datatype:URL"`
	Email          Emailadres     `json:"email" schema:"datatype:Emailadres"`
	Telefoonnummer Telefoonnummer `json:"telefoonnummer" schema:"datatype:Telefoonnummer"`
	Opvoer         *time.Time     `json:"opvoer,omitempty"`
	Afvoer         *time.Time     `json:"afvoer,omitempty"`
}

// Organisatie_Organisatienaam — Naam van de organisatie.
type Organisatie_Organisatienaam struct {
	bun.BaseModel     `bun:"table:organisatie_organisatienaam,alias:organisatie_organisatienaam"`
	Organisatie_ID    int                                `json:"organisatie_id" bun:"organisatie_id,pk" schema_desc:"ID van de Organisatie-entiteit"`
	Rel_ID            int                                `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentOrganisatie *Organisatie                       `json:"-" bun:"rel:belongs-to,join:organisatie_id=id,on_delete:cascade"`
	Opvoer            *time.Time                         `json:"opvoer,omitempty"`
	Afvoer            *time.Time                         `json:"afvoer,omitempty"`
	Data              []Organisatie_Organisatienaam_Data `bun:"rel:has-many,join:organisatie_id=organisatie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Organisatie_Organisatienaam_Data — geversioned inhoud van Organisatie_Organisatienaam.
type Organisatie_Organisatienaam_Data struct {
	bun.BaseModel  `bun:"table:organisatie_organisatienaam_data,alias:organisatie_organisatienaam_data"`
	Organisatie_ID int        `json:"organisatie_id" bun:"organisatie_id,pk"`
	Rel_ID         int        `json:"rel_id" bun:"rel_id,pk"`
	Versie         int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam           string     `json:"naam"`
	Opvoer         *time.Time `json:"opvoer,omitempty"`
	Afvoer         *time.Time `json:"afvoer,omitempty"`
}

type Contactpersoon struct {
	bun.BaseModel     `bun:"table:contactpersoon,alias:contactpersoon"`
	Organisatie_ID    int                   `json:"organisatie_id" bun:"organisatie_id,pk" schema_desc:"ID van de Organisatie-entiteit"`
	Rel_ID            int                   `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentOrganisatie *Organisatie          `json:"-" bun:"rel:belongs-to,join:organisatie_id=id,on_delete:cascade"`
	Persoon_ID        int                   `json:"persoon_id"`
	Opvoer            *time.Time            `json:"opvoer,omitempty"`
	Afvoer            *time.Time            `json:"afvoer,omitempty"`
	Data              []Contactpersoon_Data `bun:"rel:has-many,join:organisatie_id=organisatie_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Contactpersoon_Data — geversioned inhoud van Contactpersoon.
type Contactpersoon_Data struct {
	bun.BaseModel  `bun:"table:contactpersoon_data,alias:contactpersoon_data"`
	Organisatie_ID int        `json:"organisatie_id" bun:"organisatie_id,pk"`
	Rel_ID         int        `json:"rel_id" bun:"rel_id,pk"`
	Versie         int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Rol            string     `json:"rol"`
	Opvoer         *time.Time `json:"opvoer,omitempty"`
	Afvoer         *time.Time `json:"afvoer,omitempty"`
}

// Persoon_Contactgegevens — Contactgegevens van de persoon.
type Persoon_Contactgegevens struct {
	bun.BaseModel `bun:"table:persoon_contactgegevens,alias:persoon_contactgegevens"`
	Persoon_ID    int                            `json:"persoon_id" bun:"persoon_id,pk" schema_desc:"ID van de Persoon-entiteit"`
	Rel_ID        int                            `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentPersoon *Persoon                       `json:"-" bun:"rel:belongs-to,join:persoon_id=id,on_delete:cascade"`
	Opvoer        *time.Time                     `json:"opvoer,omitempty"`
	Afvoer        *time.Time                     `json:"afvoer,omitempty"`
	Data          []Persoon_Contactgegevens_Data `bun:"rel:has-many,join:persoon_id=persoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Persoon_Contactgegevens_Data — geversioned inhoud van Persoon_Contactgegevens.
type Persoon_Contactgegevens_Data struct {
	bun.BaseModel  `bun:"table:persoon_contactgegevens_data,alias:persoon_contactgegevens_data"`
	Persoon_ID     int            `json:"persoon_id" bun:"persoon_id,pk"`
	Rel_ID         int            `json:"rel_id" bun:"rel_id,pk"`
	Versie         int64          `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Email          Emailadres     `json:"email" schema:"datatype:Emailadres"`
	Telefoonnummer Telefoonnummer `json:"telefoonnummer" schema:"datatype:Telefoonnummer"`
	Opvoer         *time.Time     `json:"opvoer,omitempty"`
	Afvoer         *time.Time     `json:"afvoer,omitempty"`
}

// Persoon_Persoonnaam — Naam van de persoon.
type Persoon_Persoonnaam struct {
	bun.BaseModel `bun:"table:persoon_persoonnaam,alias:persoon_persoonnaam"`
	Persoon_ID    int                        `json:"persoon_id" bun:"persoon_id,pk" schema_desc:"ID van de Persoon-entiteit"`
	Rel_ID        int                        `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentPersoon *Persoon                   `json:"-" bun:"rel:belongs-to,join:persoon_id=id,on_delete:cascade"`
	Opvoer        *time.Time                 `json:"opvoer,omitempty"`
	Afvoer        *time.Time                 `json:"afvoer,omitempty"`
	Data          []Persoon_Persoonnaam_Data `bun:"rel:has-many,join:persoon_id=persoon_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Persoon_Persoonnaam_Data — geversioned inhoud van Persoon_Persoonnaam.
type Persoon_Persoonnaam_Data struct {
	bun.BaseModel `bun:"table:persoon_persoonnaam_data,alias:persoon_persoonnaam_data"`
	Persoon_ID    int        `json:"persoon_id" bun:"persoon_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam          string     `json:"naam"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
