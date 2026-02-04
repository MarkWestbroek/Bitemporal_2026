package model

import (
	"fmt"
	"time"
)

// Entiteiten
type A struct {
	ID     string     `json:"id"`
	Opvoer *time.Time `json:"opvoer,omitempty"` // afgeleid van registratie tijdstip opvoer
	Afvoer *time.Time `json:"afvoer,omitempty"` // afgeleid van registratie tijdstip afvoer
	//Aanvang *time.Time `json:"aanvang,omitempty"` // afgeleid van A_Aanvang
	//Einde   *time.Time `json:"einde,omitempty"`   // afgeleid van A_Einde
}

type B struct {
	ID     string     `json:"id"`
	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
	//Aanvang *time.Time `json:"aanvang,omitempty"`
	//Einde   *time.Time `json:"einde,omitempty"`
}

// HasID allows generic handlers to access an entity's ID
type HasID interface {
	GetID() string
}

func (a A) GetID() string             { return a.ID }
func (b B) GetID() string             { return b.ID }
func (r Rel_A_B) GetID() string       { return fmt.Sprintf("%d", r.ID) }
func (au A_U) GetID() string          { return fmt.Sprintf("%d", au.ID) }
func (av A_V) GetID() string          { return fmt.Sprintf("%d", av.ID) }
func (bx B_X) GetID() string          { return fmt.Sprintf("%d", bx.ID) }
func (by B_Y) GetID() string          { return fmt.Sprintf("%d", by.ID) }
func (reg Registratie) GetID() string { return fmt.Sprintf("%d", reg.ID) }
func (wij Wijziging) GetID() string   { return fmt.Sprintf("%d", wij.ID) }

// Relaties
type Rel_A_B struct {
	ID   int    `json:"id"`
	A_ID string `json:"a_id"`
	B_ID string `json:"b_id"`
	//Aanvang *time.Time `json:"aanvang,omitempty"`
	//Einde   *time.Time `json:"einde,omitempty"`
}

// Gegevenselementen
// A (1) - (1) U
type A_U struct {
	ID   int    `json:"rel_id"`
	A_ID string `json:"a_id"`
	Aaa  string `json:"aaa"`
	Bbb  string `json:"bbb"`
}

// A (1) - (*) V
type A_V struct {
	ID   int    `json:"rel_id"`
	A_ID string `json:"a_id"`
	Ccc  string `json:"ccc"`
}

// B (1) - (1) X
type B_X struct {
	ID   int    `json:"rel_id"`
	B_ID string `json:"b_id"`
	Fff  string `json:"fff"`
	Ggg  string `json:"ggg"`
}

// B (1) - (1) Y
type B_Y struct {
	ID   int    `json:"rel_id"`
	B_ID string `json:"b_id"`
	Hhh  string `json:"hhh"`
}

// Wijziging zit tussen Registratie en om het even welke representatie in
type Wijziging struct {
	ID                int       `json:"id"`
	Wijzigingstype    string    `json:"wijzigingstype"`
	RegistratieID     int       `json:"registratie_id"`
	Representatienaam string    `json:"representatienaam"`
	RepresentatieID   int       `json:"representatie_id"`
	Tijdstip          time.Time `json:"tijdstip"` //afgeleid van registratie tijdstip
}

// Registratie, Correctie, Ongedaanmaking
type Registratie struct {
	ID                         int       `json:"id"`
	Registratietype            string    `json:"registratietype"`
	Tijdstip                   time.Time `json:"tijdstip"`
	Opmerking                  *string   `json:"opmerking,omitempty"`
	CorrigeertRegistratieID    *int      `json:"corrigeert_registratie_id,omitempty"`
	MaaktOngedaanRegistratieID *int      `json:"maakt_ongedaan_registratie_id,omitempty"`
}
