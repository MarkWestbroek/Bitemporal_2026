package model

// Hub + _Data + _Aanvang/_Einde structs voor gegevenselementen en relaties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

type IdeBestandCategorie string

const (
	IdeBestandCategorieModelSnapshot IdeBestandCategorie = "model_snapshot"
	IdeBestandCategorieIdeSnapshot   IdeBestandCategorie = "ide_snapshot"
	IdeBestandCategorieGenereerdCode IdeBestandCategorie = "gegenereerde_code"
	IdeBestandCategorieImport        IdeBestandCategorie = "import"
	IdeBestandCategorieExport        IdeBestandCategorie = "export"
	IdeBestandCategorieDocumentatie  IdeBestandCategorie = "documentatie"
	IdeBestandCategorieConfiguratie  IdeBestandCategorie = "configuratie"
	IdeBestandCategorieOverig        IdeBestandCategorie = "overig"
)

type IdeBestandFormaat string

const (
	IdeBestandFormaatJSON     IdeBestandFormaat = "json"
	IdeBestandFormaatYAML     IdeBestandFormaat = "yaml"
	IdeBestandFormaatXML      IdeBestandFormaat = "xml"
	IdeBestandFormaatMarkdown IdeBestandFormaat = "markdown"
	IdeBestandFormaatGoCode   IdeBestandFormaat = "go_code"
	IdeBestandFormaatSQL      IdeBestandFormaat = "sql"
	IdeBestandFormaatTekst    IdeBestandFormaat = "tekst"
	IdeBestandFormaatBinair   IdeBestandFormaat = "binair"
	IdeBestandFormaatOverig   IdeBestandFormaat = "overig"
)

type IdeBestandOpslagType string

const (
	IdeBestandOpslagTypeInline IdeBestandOpslagType = "inline"
	IdeBestandOpslagTypeMinio  IdeBestandOpslagType = "minio"
)

// IdeBestand_Meta — Metadata van het bestand: naam, beschrijving, categorie, formaat en domein.
type IdeBestand_Meta struct {
	bun.BaseModel    `bun:"table:idebestand_meta,alias:idebestand_meta"`
	IdeBestand_ID    int                    `json:"idebestand_id" bun:"idebestand_id,pk" schema_desc:"ID van de IdeBestand-entiteit"`
	Rel_ID           int                    `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentIdeBestand *IdeBestand            `json:"-" bun:"rel:belongs-to,join:idebestand_id=id,on_delete:cascade"`
	Opvoer           *time.Time             `json:"opvoer,omitempty"`
	Afvoer           *time.Time             `json:"afvoer,omitempty"`
	Data             []IdeBestand_Meta_Data `bun:"rel:has-many,join:idebestand_id=idebestand_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// IdeBestand_Meta_Data — geversioned inhoud van IdeBestand_Meta.
type IdeBestand_Meta_Data struct {
	bun.BaseModel   `bun:"table:idebestand_meta_data,alias:idebestand_meta_data"`
	IdeBestand_ID   int                 `json:"idebestand_id" bun:"idebestand_id,pk"`
	Rel_ID          int                 `json:"rel_id" bun:"rel_id,pk"`
	Versie          int64               `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Naam            string              `json:"naam"`
	Beschrijving    string              `json:"beschrijving"`
	Categorie       IdeBestandCategorie `json:"categorie" schema:"enum=IdeBestandCategorie"`
	Bestandsformaat IdeBestandFormaat   `json:"bestandsformaat" schema:"enum=IdeBestandFormaat"`
	MimeType        string              `json:"mime_type"`
	Domein          string              `json:"domein"`
	Tags            string              `json:"tags"`
	Opvoer          *time.Time          `json:"opvoer,omitempty"`
	Afvoer          *time.Time          `json:"afvoer,omitempty"`
}

// IdeBestand_Inhoud — Inhoud en opslaginformatie van het bestand. Kleine tekstbestanden staan inline in de database, grotere of binaire bestanden worden opgeslagen in MinIO.
type IdeBestand_Inhoud struct {
	bun.BaseModel    `bun:"table:idebestand_inhoud,alias:idebestand_inhoud"`
	IdeBestand_ID    int                      `json:"idebestand_id" bun:"idebestand_id,pk" schema_desc:"ID van de IdeBestand-entiteit"`
	Rel_ID           int                      `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentIdeBestand *IdeBestand              `json:"-" bun:"rel:belongs-to,join:idebestand_id=id,on_delete:cascade"`
	Opvoer           *time.Time               `json:"opvoer,omitempty"`
	Afvoer           *time.Time               `json:"afvoer,omitempty"`
	Data             []IdeBestand_Inhoud_Data `bun:"rel:has-many,join:idebestand_id=idebestand_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// IdeBestand_Inhoud_Data — geversioned inhoud van IdeBestand_Inhoud.
type IdeBestand_Inhoud_Data struct {
	bun.BaseModel `bun:"table:idebestand_inhoud_data,alias:idebestand_inhoud_data"`
	IdeBestand_ID int                  `json:"idebestand_id" bun:"idebestand_id,pk"`
	Rel_ID        int                  `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64                `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	OpslagType    IdeBestandOpslagType `json:"opslag_type" schema:"enum=IdeBestandOpslagType"`
	InlineInhoud  string               `json:"inline_inhoud"`
	ObjectKey     string               `json:"object_key"`
	Sha256Hash    string               `json:"sha256_hash"`
	GrootteBytes  int64                `json:"grootte_bytes"`
	VersieLabel   string               `json:"versie_label"`
	Opvoer        *time.Time           `json:"opvoer,omitempty"`
	Afvoer        *time.Time           `json:"afvoer,omitempty"`
}
