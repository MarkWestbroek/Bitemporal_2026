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

// GeefOnderliggendeGegevenselementen returns all child representaties of A.
func (a *A) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)

	for i := range a.Us {
		if a.Us[i].A_ID == 0 {
			a.Us[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_U", Representatie: &a.Us[i]})
	}

	for i := range a.Vs {
		if a.Vs[i].A_ID == 0 {
			a.Vs[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_V", Representatie: &a.Vs[i]})
	}

	for i := range a.Ws {
		if a.Ws[i].A_ID == 0 {
			a.Ws[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W", Representatie: &a.Ws[i]})
	}

	for i := range a.RelABs {
		if a.RelABs[i].A_ID == 0 {
			a.RelABs[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B", Representatie: &a.RelABs[i]})
	}

	// Materiële tijdlijn: aanvang/einde als onderliggende representaties meegeven,
	// zodat ze beschikbaar zijn voor de generieke opvoer/afvoer-handlers.
	for i := range a.Aanvang {
		if a.Aanvang[i].A_ID == 0 {
			a.Aanvang[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_Aanvang", Representatie: &a.Aanvang[i]})
	}

	for i := range a.Einde {
		if a.Einde[i].A_ID == 0 {
			a.Einde[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_Einde", Representatie: &a.Einde[i]})
	}

	return result
}

// GeefOnderliggendeGegevenselementen returns all child representaties of B.
func (b *B) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)

	for i := range b.Xs {
		if b.Xs[i].B_ID == 0 {
			b.Xs[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_X", Representatie: &b.Xs[i]})
	}

	for i := range b.Ys {
		if b.Ys[i].B_ID == 0 {
			b.Ys[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Y", Representatie: &b.Ys[i]})
	}

	// Materiële tijdlijn (zie toelichting bij A)
	for i := range b.Aanvang {
		if b.Aanvang[i].B_ID == 0 {
			b.Aanvang[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Aanvang", Representatie: &b.Aanvang[i]})
	}

	for i := range b.Einde {
		if b.Einde[i].B_ID == 0 {
			b.Einde[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Einde", Representatie: &b.Einde[i]})
	}

	return result
}

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

/* === Hub-level _Aanvang/_Einde: materiële plumbing voor GE/REL hubs ===

Materiële hubs (waar IsMaterieel=true in de MetaRegistry) hebben hun eigen
aanvang/einde-tabellen, analoog aan de entiteits-level plumbing (A_Aanvang, etc.).

Verschil met entiteits-plumbing:
- PK: (ent_id, rel_id, versie) — drieledige samengestelde sleutel (i.p.v. tweedelig)
- FK: naar de hub (ent_id, rel_id) i.p.v. direct naar de entiteit

Versie is relatief autoincrement per (ent_id, rel_id), beheerd door
RegisterRelativeIDTriggerComposite in createmodeltables.go.

Alleen gedefinieerd voor materiële hubs: A_W en Rel_A_B.
Niet-materiële hubs (A_U, A_V, B_X, B_Y) hebben geen aanvang/einde.
*/

type A_W_Aanvang struct {
	bun.BaseModel `bun:"table:a_w_aanvang,alias:a_w_aanvang"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

func (a A_W_Aanvang) GetID() any              { return a.Versie }
func (a A_W_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_W_Aanvang) ClearID()               { a.Versie = 0 }
func (a A_W_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_W_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_W_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_W_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_W_Aanvang) String() string          { return RepresentatieToString(a) }

type A_W_Einde struct {
	bun.BaseModel `bun:"table:a_w_einde,alias:a_w_einde"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

func (a A_W_Einde) GetID() any              { return a.Versie }
func (a A_W_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_W_Einde) ClearID()               { a.Versie = 0 }
func (a A_W_Einde) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_W_Einde) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_W_Einde) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_W_Einde) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_W_Einde) String() string          { return RepresentatieToString(a) }

type Rel_A_B_Aanvang struct {
	bun.BaseModel `bun:"table:rel_a_b_aanvang,alias:rel_a_b_aanvang"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

func (r Rel_A_B_Aanvang) GetID() any              { return r.Versie }
func (r Rel_A_B_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *Rel_A_B_Aanvang) ClearID()               { r.Versie = 0 }
func (r Rel_A_B_Aanvang) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Rel_A_B_Aanvang) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Rel_A_B_Aanvang) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Rel_A_B_Aanvang) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Rel_A_B_Aanvang) String() string          { return RepresentatieToString(r) }

type Rel_A_B_Einde struct {
	bun.BaseModel `bun:"table:rel_a_b_einde,alias:rel_a_b_einde"`
	A_ID          int        `json:"a_id" bun:"a_id,pk"`
	Rel_ID        int        `json:"rel_id" bun:"rel_id,pk"`
	Versie        int64      `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date      `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time `json:"opvoer,omitempty"`
	Afvoer        *time.Time `json:"afvoer,omitempty"`
}

func (r Rel_A_B_Einde) GetID() any              { return r.Versie }
func (r Rel_A_B_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *Rel_A_B_Einde) ClearID()               { r.Versie = 0 }
func (r Rel_A_B_Einde) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Rel_A_B_Einde) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Rel_A_B_Einde) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Rel_A_B_Einde) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Rel_A_B_Einde) String() string          { return RepresentatieToString(r) }
