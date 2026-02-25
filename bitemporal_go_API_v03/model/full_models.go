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
func (a Full_A) GetID() any         { return a.ID }
func (a Full_A) Metatype() Metatype { return MetatypeEntiteit }
func (b Full_B) GetID() any         { return b.ID }
func (b Full_B) Metatype() Metatype { return MetatypeEntiteit }

// GeefOnderliggendeGegevenselementen returns all child representaties of A.
func (a *Full_A) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
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

	for i := range a.RelABs {
		if a.RelABs[i].A_ID == 0 {
			a.RelABs[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B", Representatie: &a.RelABs[i]})
	}

	return result
}

// GeefOnderliggendeGegevenselementen returns all child representaties of B.
func (b *Full_B) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
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

	return result
}

// Full_A includes all fields of A and its related entities (like Vs)
type Full_A struct {
	bun.BaseModel `bun:"table:a,alias:a"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer
	//Aanvang *time.Time `json:"aanvang,omitempty"` // afgeleid van A_Aanvang
	//Einde   *time.Time `json:"einde,omitempty"`   // afgeleid van A_Einde

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

	//Relaties Rel_AB's bij A (meervoudig op enig moment)
	RelABs []Rel_A_B `bun:"rel:has-many,join:id=a_id" json:"rel_abs,omitempty"`
}

// Full_B includes all fields of B and its related entities (like Xs)
type Full_B struct {
	bun.BaseModel `bun:"table:b,alias:b"`
	ID            int        `json:"id" bun:"id,pk"`
	Opvoer        *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer        *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer
	//Aanvang *time.Time `json:"aanvang,omitempty"` // afgeleid van A_Aanvang
	//Einde   *time.Time `json:"einde,omitempty"`   // afgeleid van A_Einde

	// De X's behorende bij B, 1-1 op enig moment (enkelvoudig: todo tag)
	Xs []B_X `bun:"rel:has-many,join:id=b_id" json:"xs,omitempty"`
	// De Y's behorende bij B, 1-1 op enig moment (enkelvoudig: todo tag)
	Ys []B_Y `bun:"rel:has-many,join:id=b_id" json:"ys,omitempty"`
}
