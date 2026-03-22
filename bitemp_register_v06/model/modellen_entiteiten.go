package model

import (
	"time"

	"github.com/uptrace/bun"
)

/*
Full entity structs = Entiteiten inclusief alle gegevenselementen en relaties,
maar zonder de bitemporal plumbing (registratie, wijziging, opvoer/afvoer tijdstippen).
Opvoer en afvoer zijn afgeleid daarvan, en in die zin ook een soort plumbing.
Deze structuren worden gebruikt voor de API requests en responses,
en bevatten alle relevante data voor een entiteit, inclusief de gerelateerde gegevenselementen en relaties.
*/

// GetID methods
func (a A) GetID() any         { return a.ID }
func (a A) Metatype() Metatype { return MetatypeEntiteit }
func (a *A) ClearID()          { a.ID = 0 }
func (b B) GetID() any         { return b.ID }
func (b B) Metatype() Metatype { return MetatypeEntiteit }
func (b *B) ClearID()          { b.ID = 0 }

// voor debuggen en testen, geeft een stringrepresentatie van de entiteit inclusief alle gegevenselementen en relaties.
func (a A) String() string { return RepresentatieToString(a) }
func (b B) String() string { return RepresentatieToString(b) }

// A includes all fields of A and its related entities (like Vs)
type A struct {
	bun.BaseModel `bun:"table:a,alias:a"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer

	// De U's behorende bij A, 1-1 op enig moment (enkelvoudig: todo tag)
	Us []A_U `bun:"rel:has-many,join:id=a_id" json:"us,omitempty"`

	/*
		De relatie: 'has-many' vertelt Bun dat er meerdere V 's bij deze A horen.
		Deze relatie is meervoudig op enig moment.
		Ik mweet nog niet hoe dat in bun of andere tag weer te geven. Dit gaat over validatie en niet over de DB,
		dus misschien een andere tag in de struct die aangeeft dat deze relatie meervoudig is op enig moment.
		OPM: nu in de MetaRegistry opgenomen als Momentvoorkomen: Meervoudig.
	*/
	Vs []A_V `bun:"rel:has-many,join:id=a_id" json:"vs,omitempty"`

	// De W's behorende bij A, meervoudig op enig moment
	Ws []A_W `bun:"rel:has-many,join:id=a_id" json:"ws,omitempty"`

	//Relaties Rel_AB's bij A (meervoudig op enig moment)
	RelABs []Rel_A_B `bun:"rel:has-many,join:id=a_id" json:"rel_abs,omitempty"`

	// Materiële tijdlijn: aanvang en einde als plumbing-relaties.
	// Gedragen zich als enkelvoudige gegevenselementen (maximaal één actief per entiteit).
	// join:id=a_id: de FK-kolom in a_aanvang/a_einde heet "a_id" (hernoemd van "id").
	// Zie materiele_tijd.md voor een volledige uitleg.
	Aanvang []A_Aanvang `bun:"rel:has-many,join:id=a_id" json:"aanvang,omitempty"`
	Einde   []A_Einde   `bun:"rel:has-many,join:id=a_id" json:"einde,omitempty"`
}

// B includes all fields of B and its related entities (like Xs)
type B struct {
	bun.BaseModel `bun:"table:b,alias:b"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer

	// De X's behorende bij B, 1-1 op enig moment (enkelvoudig: todo tag)
	Xs []B_X `bun:"rel:has-many,join:id=b_id" json:"xs,omitempty"`
	// De Y's behorende bij B, 1-1 op enig moment (enkelvoudig: todo tag)
	Ys []B_Y `bun:"rel:has-many,join:id=b_id" json:"ys,omitempty"`

	// Materiële tijdlijn: aanvang en einde als plumbing-relaties.
	// join:id=b_id: de FK-kolom in b_aanvang/b_einde heet "b_id" (hernoemd van "id").
	// Zie uitleg bij A hierboven en materiele_tijd.md.
	Aanvang []B_Aanvang `bun:"rel:has-many,join:id=b_id" json:"aanvang,omitempty"`
	Einde   []B_Einde   `bun:"rel:has-many,join:id=b_id" json:"einde,omitempty"`
}

// === Aanvang/Einde als FormeleRepresentatie per entiteitstype ===
// Elk type mapt direct op zijn plumbing-tabel: {entiteit}_aanvang / {entiteit}_einde.
// De "id" kolom in de tabel is de FK naar de entiteit; "versie" is het relatieve autoincrement.
// Ze gedragen zich als enkelvoudige gegevenselementen: handleRepresentatieOpvoer handelt ze af.
//
// LET OP: de expliciete `alias:` tag is noodzakelijk. Zonder alias leidt bun de alias af
// uit de Go struct naam: A_Aanvang → a__aanvang (dubbele underscore). De formeleTijdTargetVoorModel
// subquery referenceert de tabel met enkelvoudige underscore (a_aanvang.id::text), dus de alias
// moet overeenkomen om "invalid reference to FROM-clause entry" fouten te voorkomen.

type A_Aanvang struct {
	bun.BaseModel `bun:"table:a_aanvang,alias:a_aanvang"` // alias: voorkomt bun's automatische a__aanvang alias
	A_ID          int                                     `json:"a_id" bun:"a_id,pk"` // DB-kolom hernoemd van id→a_id (consistent met andere GE-types)
	Versie        int64                                   `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date                                   `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time                              `json:"opvoer,omitempty"`
	Afvoer        *time.Time                              `json:"afvoer,omitempty"`
}

func (a A_Aanvang) GetID() any              { return a.Versie }
func (a A_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_Aanvang) ClearID()               { a.Versie = 0 }
func (a A_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_Aanvang) String() string          { return RepresentatieToString(a) }

type A_Einde struct {
	bun.BaseModel `bun:"table:a_einde,alias:a_einde"` // alias: voorkomt bun's automatische a__einde alias
	A_ID          int                                 `json:"a_id" bun:"a_id,pk"` // DB-kolom hernoemd van id→a_id
	Versie        int64                               `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date                               `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time                          `json:"opvoer,omitempty"`
	Afvoer        *time.Time                          `json:"afvoer,omitempty"`
}

func (a A_Einde) GetID() any              { return a.Versie }
func (a A_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_Einde) ClearID()               { a.Versie = 0 }
func (a A_Einde) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_Einde) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_Einde) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_Einde) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_Einde) String() string          { return RepresentatieToString(a) }

type B_Aanvang struct {
	bun.BaseModel `bun:"table:b_aanvang,alias:b_aanvang"` // alias: voorkomt bun's automatische b__aanvang alias
	B_ID          int                                     `json:"b_id" bun:"b_id,pk"` // DB-kolom hernoemd van id→b_id
	Versie        int64                                   `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date                                   `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time                              `json:"opvoer,omitempty"`
	Afvoer        *time.Time                              `json:"afvoer,omitempty"`
}

func (b B_Aanvang) GetID() any              { return b.Versie }
func (b B_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (b *B_Aanvang) ClearID()               { b.Versie = 0 }
func (b B_Aanvang) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B_Aanvang) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B_Aanvang) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B_Aanvang) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b B_Aanvang) String() string          { return RepresentatieToString(b) }

type B_Einde struct {
	bun.BaseModel `bun:"table:b_einde,alias:b_einde"` // alias: voorkomt bun's automatische b__einde alias
	B_ID          int                                 `json:"b_id" bun:"b_id,pk"` // DB-kolom hernoemd van id→b_id
	Versie        int64                               `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date                               `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time                          `json:"opvoer,omitempty"`
	Afvoer        *time.Time                          `json:"afvoer,omitempty"`
}

func (b B_Einde) GetID() any              { return b.Versie }
func (b B_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (b *B_Einde) ClearID()               { b.Versie = 0 }
func (b B_Einde) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B_Einde) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B_Einde) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B_Einde) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b B_Einde) String() string          { return RepresentatieToString(b) }
