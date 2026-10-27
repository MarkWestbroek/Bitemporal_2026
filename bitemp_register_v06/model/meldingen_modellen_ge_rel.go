package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type Meldingsoort string

const (
	Meldingsoortbug        Meldingsoort = "bug"
	Meldingsoortwens       Meldingsoort = "wens"
	Meldingsoortvraag      Meldingsoort = "vraag"
	Meldingsoortcompliment Meldingsoort = "compliment"
)

type Meldingstatus string

const (
	Meldingstatusnieuw         Meldingstatus = "nieuw"
	Meldingstatusinbehandeling Meldingstatus = "in_behandeling"
	Meldingstatusopgelost      Meldingstatus = "opgelost"
	Meldingstatusafgewezen     Meldingstatus = "afgewezen"
	Meldingstatusdubbel        Meldingstatus = "dubbel"
)

type Meldingprioriteit string

const (
	Meldingprioriteitlaag    Meldingprioriteit = "laag"
	Meldingprioriteitnormaal Meldingprioriteit = "normaal"
	Meldingprioriteithoog    Meldingprioriteit = "hoog"
)

// Melding_MeldingInhoud — Wat er gemeld is. Een correctie (typfout) is formeel; de melder of een beheerder kan hem aanpassen.
type Melding_MeldingInhoud struct {
	bun.BaseModel `bun:"table:melding_meldinginhoud,alias:melding_meldinginhoud"`
	Melding_ID    int                          `json:"melding_id" bun:"melding_id,pk" schema_desc:"ID van de Melding-entiteit"`
	Rel_ID        int                          `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMelding *Melding                     `json:"-" bun:"rel:belongs-to,join:melding_id=id,on_delete:cascade"`
	Opvoer        *time.Time                   `json:"opvoer,omitempty"`
	Afvoer        *time.Time                   `json:"afvoer,omitempty"`
	Data          []Melding_MeldingInhoud_Data `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Melding_MeldingInhoud_Data — geversioned inhoud van Melding_MeldingInhoud.
type Melding_MeldingInhoud_Data struct {
	bun.BaseModel `bun:"table:melding_meldinginhoud_data,alias:melding_meldinginhoud_data"`
	Melding_ID    int          `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int          `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64        `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Soort         Meldingsoort `json:"soort" schema:"enum=Meldingsoort"`
	Titel         KorteTekst   `json:"titel" schema:"datatype:KorteTekst" schema_desc:"Eén regel: wat ging er mis of wat wil je?"`
	Beschrijving  *string      `json:"beschrijving,omitempty" schema:"datatype:LangeTekst" schema_desc:"Wat deed je, wat verwachtte je, wat gebeurde er?"`
	Opvoer        *time.Time   `json:"opvoer,omitempty"`
	Afvoer        *time.Time   `json:"afvoer,omitempty"`
}

// Melding_MeldingContext — Waar in de tool de melding vandaan kwam; door de Studio ingevuld, niet door de melder. Helpt reproduceren.
type Melding_MeldingContext struct {
	bun.BaseModel `bun:"table:melding_meldingcontext,alias:melding_meldingcontext"`
	Melding_ID    int                           `json:"melding_id" bun:"melding_id,pk" schema_desc:"ID van de Melding-entiteit"`
	Rel_ID        int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMelding *Melding                      `json:"-" bun:"rel:belongs-to,join:melding_id=id,on_delete:cascade"`
	Opvoer        *time.Time                    `json:"opvoer,omitempty"`
	Afvoer        *time.Time                    `json:"afvoer,omitempty"`
	Data          []Melding_MeldingContext_Data `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Melding_MeldingContext_Data — geversioned inhoud van Melding_MeldingContext.
type Melding_MeldingContext_Data struct {
	bun.BaseModel `bun:"table:melding_meldingcontext_data,alias:melding_meldingcontext_data"`
	Melding_ID    int        `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Studioversie  *string    `json:"studioversie,omitempty" schema:"datatype:KorteTekst" schema_desc:"Bv. studio 0.19.0 / api 0.14.0."`
	Activiteit    *string    `json:"activiteit,omitempty" schema:"datatype:KorteTekst" schema_desc:"Actieve activiteit en profiel, bv. modelleren / usecase05."`
	Plek          *string    `json:"plek,omitempty" schema:"datatype:KorteTekst" schema_desc:"Wat er onder de Alt-klik zat: het pad in de interface (paneel, knop, element-id)."`
	Projectid     *string    `json:"projectid,omitempty" schema:"datatype:KorteTekst" schema_desc:"Het open Studio-project (alleen het id, geen inhoud)."`
	Pad           *string    `json:"pad,omitempty" schema:"datatype:KorteTekst" schema_desc:"Waar het over gaat in de projectboom: map/map/element (bij rechtsklik of de selectie). Leesbaar; verandert bij hernoemen of verplaatsen."`
	Onderwerpid   *string    `json:"onderwerpid,omitempty" schema:"datatype:KorteTekst" schema_desc:"Het stabiele id van dat element, diagram of map in het project (bij EA-import afgeleid van de EA-GUID). Verandert niet bij hernoemen of verplaatsen."`
	Browser       *string    `json:"browser,omitempty" schema:"datatype:KorteTekst" schema_desc:"Browser, besturingssysteem en venstermaat."`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Melding_MeldingBijlage — Schermafbeelding (een getrokken kader) of ander bestand. Het bestand staat in de filestore.
type Melding_MeldingBijlage struct {
	bun.BaseModel `bun:"table:melding_meldingbijlage,alias:melding_meldingbijlage"`
	Melding_ID    int                           `json:"melding_id" bun:"melding_id,pk" schema_desc:"ID van de Melding-entiteit"`
	Rel_ID        int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMelding *Melding                      `json:"-" bun:"rel:belongs-to,join:melding_id=id,on_delete:cascade"`
	Opvoer        *time.Time                    `json:"opvoer,omitempty"`
	Afvoer        *time.Time                    `json:"afvoer,omitempty"`
	Data          []Melding_MeldingBijlage_Data `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Melding_MeldingBijlage_Data — geversioned inhoud van Melding_MeldingBijlage.
type Melding_MeldingBijlage_Data struct {
	bun.BaseModel `bun:"table:melding_meldingbijlage_data,alias:melding_meldingbijlage_data"`
	Melding_ID    int        `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Bestand       Bestand    `json:"bestand" schema:"datatype:Bestand"`
	Omschrijving  *string    `json:"omschrijving,omitempty" schema:"datatype:KorteTekst"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Melding_MeldingStatus — Waar de melding staat. Materieel: vanaf wanneer gold deze status (bv. opgelost per release). De vorige status sluit vanzelf.
type Melding_MeldingStatus struct {
	bun.BaseModel `bun:"table:melding_meldingstatus,alias:melding_meldingstatus"`
	Melding_ID    int                             `json:"melding_id" bun:"melding_id,pk" schema_desc:"ID van de Melding-entiteit"`
	Rel_ID        int                             `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMelding *Melding                        `json:"-" bun:"rel:belongs-to,join:melding_id=id,on_delete:cascade"`
	Opvoer        *time.Time                      `json:"opvoer,omitempty"`
	Afvoer        *time.Time                      `json:"afvoer,omitempty"`
	Data          []Melding_MeldingStatus_Data    `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang       []Melding_MeldingStatus_Aanvang `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde         []Melding_MeldingStatus_Einde   `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// Melding_MeldingStatus_Data — geversioned inhoud van Melding_MeldingStatus.
type Melding_MeldingStatus_Data struct {
	bun.BaseModel `bun:"table:melding_meldingstatus_data,alias:melding_meldingstatus_data"`
	Melding_ID    int           `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int           `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64         `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Status        Meldingstatus `json:"status" schema:"enum=Meldingstatus"`
	Toelichting   *string       `json:"toelichting,omitempty" schema:"datatype:LangeTekst" schema_desc:"Antwoord aan de melder: waarom afgewezen, in welke versie opgelost, of bij status dubbel: van welke melding (\"dubbel van #12\")."`
	Opvoer        *time.Time    `json:"opvoer,omitempty"`
	Afvoer        *time.Time    `json:"afvoer,omitempty"`
}

// Melding_MeldingStatus_Aanvang — aanvangtijdstip van Melding_MeldingStatus.
type Melding_MeldingStatus_Aanvang struct {
	bun.BaseModel `bun:"table:melding_meldingstatus_aanvang,alias:melding_meldingstatus_aanvang"`
	Melding_ID    int        `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *time.Time `json:"datum,omitempty" bun:"datum,type:timestamptz"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Melding_MeldingStatus_Einde — eindetijdstip van Melding_MeldingStatus.
type Melding_MeldingStatus_Einde struct {
	bun.BaseModel `bun:"table:melding_meldingstatus_einde,alias:melding_meldingstatus_einde"`
	Melding_ID    int        `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *time.Time `json:"datum,omitempty" bun:"datum,type:timestamptz"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Melding_MeldingPrioriteit — Door de beheerder gezet; de melder ziet hem wel.
type Melding_MeldingPrioriteit struct {
	bun.BaseModel `bun:"table:melding_meldingprioriteit,alias:melding_meldingprioriteit"`
	Melding_ID    int                              `json:"melding_id" bun:"melding_id,pk" schema_desc:"ID van de Melding-entiteit"`
	Rel_ID        int                              `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMelding *Melding                         `json:"-" bun:"rel:belongs-to,join:melding_id=id,on_delete:cascade"`
	Opvoer        *time.Time                       `json:"opvoer,omitempty"`
	Afvoer        *time.Time                       `json:"afvoer,omitempty"`
	Data          []Melding_MeldingPrioriteit_Data `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Melding_MeldingPrioriteit_Data — geversioned inhoud van Melding_MeldingPrioriteit.
type Melding_MeldingPrioriteit_Data struct {
	bun.BaseModel `bun:"table:melding_meldingprioriteit_data,alias:melding_meldingprioriteit_data"`
	Melding_ID    int               `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int               `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64             `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Prioriteit    Meldingprioriteit `json:"prioriteit" schema:"enum=Meldingprioriteit"`
	Opvoer        *time.Time        `json:"opvoer,omitempty"`
	Afvoer        *time.Time        `json:"afvoer,omitempty"`
}

// Melding_MeldingReactie — Een bericht in het gesprek over de melding, van melder of beheerder. Wanneer: de registratie. Wie: het veld auteur (een registratie legt niet vast wie registreerde).
type Melding_MeldingReactie struct {
	bun.BaseModel `bun:"table:melding_meldingreactie,alias:melding_meldingreactie"`
	Melding_ID    int                           `json:"melding_id" bun:"melding_id,pk" schema_desc:"ID van de Melding-entiteit"`
	Rel_ID        int                           `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMelding *Melding                      `json:"-" bun:"rel:belongs-to,join:melding_id=id,on_delete:cascade"`
	Opvoer        *time.Time                    `json:"opvoer,omitempty"`
	Afvoer        *time.Time                    `json:"afvoer,omitempty"`
	Data          []Melding_MeldingReactie_Data `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// Melding_MeldingReactie_Data — geversioned inhoud van Melding_MeldingReactie.
type Melding_MeldingReactie_Data struct {
	bun.BaseModel `bun:"table:melding_meldingreactie_data,alias:melding_meldingreactie_data"`
	Melding_ID    int        `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Tekst         LangeTekst `json:"tekst" schema:"datatype:LangeTekst"`
	Auteur        KorteTekst `json:"auteur" schema:"datatype:KorteTekst" schema_desc:"Gebruikersnaam van wie reageerde."`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// MeldingMelder — Wie de melding deed. Ook in de registratie, maar als relatie kan het toegangsbeleid er op filteren (de melder ziet de eigen meldingen).
type MeldingMelder struct {
	bun.BaseModel `bun:"table:meldingmelder,alias:meldingmelder"`
	Melding_ID    int                  `json:"melding_id" bun:"melding_id,pk" schema_desc:"ID van de Melding-entiteit"`
	Rel_ID        int                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMelding *Melding             `json:"-" bun:"rel:belongs-to,join:melding_id=id,on_delete:cascade"`
	Gebruiker_ID  int                  `json:"gebruiker_id"`
	Opvoer        *time.Time           `json:"opvoer,omitempty"`
	Afvoer        *time.Time           `json:"afvoer,omitempty"`
	Data          []MeldingMelder_Data `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// MeldingMelder_Data — geversioned inhoud van MeldingMelder.
type MeldingMelder_Data struct {
	bun.BaseModel `bun:"table:meldingmelder_data,alias:meldingmelder_data"`
	Melding_ID    int        `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// MeldingBehandelaar — Wie de melding oppakt (een beheerder).
type MeldingBehandelaar struct {
	bun.BaseModel `bun:"table:meldingbehandelaar,alias:meldingbehandelaar"`
	Melding_ID    int                          `json:"melding_id" bun:"melding_id,pk" schema_desc:"ID van de Melding-entiteit"`
	Rel_ID        int                          `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentMelding *Melding                     `json:"-" bun:"rel:belongs-to,join:melding_id=id,on_delete:cascade"`
	Gebruiker_ID  int                          `json:"gebruiker_id"`
	Opvoer        *time.Time                   `json:"opvoer,omitempty"`
	Afvoer        *time.Time                   `json:"afvoer,omitempty"`
	Data          []MeldingBehandelaar_Data    `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"data,omitempty"`
	Aanvang       []MeldingBehandelaar_Aanvang `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"aanvang,omitempty"`
	Einde         []MeldingBehandelaar_Einde   `bun:"rel:has-many,join:melding_id=melding_id,join:rel_id=rel_id" json:"einde,omitempty"`
}

// MeldingBehandelaar_Data — geversioned inhoud van MeldingBehandelaar.
type MeldingBehandelaar_Data struct {
	bun.BaseModel `bun:"table:meldingbehandelaar_data,alias:meldingbehandelaar_data"`
	Melding_ID    int        `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// MeldingBehandelaar_Aanvang — aanvangtijdstip van MeldingBehandelaar.
type MeldingBehandelaar_Aanvang struct {
	bun.BaseModel `bun:"table:meldingbehandelaar_aanvang,alias:meldingbehandelaar_aanvang"`
	Melding_ID    int        `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *time.Time `json:"datum,omitempty" bun:"datum,type:timestamptz"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// MeldingBehandelaar_Einde — eindetijdstip van MeldingBehandelaar.
type MeldingBehandelaar_Einde struct {
	bun.BaseModel `bun:"table:meldingbehandelaar_einde,alias:meldingbehandelaar_einde"`
	Melding_ID    int        `json:"melding_id" bun:"melding_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *time.Time `json:"datum,omitempty" bun:"datum,type:timestamptz"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
