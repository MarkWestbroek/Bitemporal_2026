package model

// Entiteitstructs en materiële plumbing (Aanvang/Einde per entiteit).
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import (
	"time"

	"github.com/uptrace/bun"
)

// Gebruiker — Een persoon die kan inloggen op Omnium (Studio, register, publicatie). Bitemporeel: je ziet wie wanneer welke rol had en sinds wanneer een account geblokkeerd is. De levensduur van de entiteit is die van het account: afvoer = account beëindigd (geen hard delete). Wachtwoord-hash en laatste login staan NIET hier maar in de plumbing-tabel gebruiker_inlog, zodat ze nooit in de geschiedenis of de gegenereerde API belanden.
type Gebruiker struct {
	bun.BaseModel            `bun:"table:gebruiker,alias:gebruiker"`
	ID                       int                                `json:"id" bun:"id,pk"`
	Opvoer                   *time.Time                         `json:"opvoer,omitempty"`
	Afvoer                   *time.Time                         `json:"afvoer,omitempty"`
	GebruikerIdentiteiten    []Gebruiker_GebruikerIdentiteit    `bun:"rel:has-many,join:id=gebruiker_id" json:"gebruiker_identiteiten,omitempty"`
	GebruikerStatussen       []Gebruiker_GebruikerStatus        `bun:"rel:has-many,join:id=gebruiker_id" json:"gebruiker_statussen,omitempty"`
	GebruikerRoltoewijzingen []Gebruiker_GebruikerRoltoewijzing `bun:"rel:has-many,join:id=gebruiker_id" json:"gebruiker_roltoewijzingen,omitempty"`
	Aanvang                  []Gebruiker_Aanvang                `bun:"rel:has-many,join:id=gebruiker_id" json:"aanvang,omitempty"`
	Einde                    []Gebruiker_Einde                  `bun:"rel:has-many,join:id=gebruiker_id" json:"einde,omitempty"`
}

// Gebruiker_Aanvang — aanvangdatum van entiteit Gebruiker.
type Gebruiker_Aanvang struct {
	bun.BaseModel `bun:"table:gebruiker_aanvang,alias:gebruiker_aanvang"`
	Gebruiker_ID  int        `json:"gebruiker_id" bun:"gebruiker_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

// Gebruiker_Einde — eindedatum van entiteit Gebruiker.
type Gebruiker_Einde struct {
	bun.BaseModel `bun:"table:gebruiker_einde,alias:gebruiker_einde"`
	Gebruiker_ID  int        `json:"gebruiker_id" bun:"gebruiker_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}
