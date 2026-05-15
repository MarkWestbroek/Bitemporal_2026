package model

// gegevenstypen_modellen_methods.go — interface-implementaties en
// GeefOnderliggendeGegevenselementen voor het gegevenstypen-domein.
// Handmatig aangemaakt.

import "time"

/* ================================================================
   1. TestEntiteitGegevenstypen (Entiteit)
   ================================================================ */

func (e TestEntiteitGegevenstypen) GetID() any              { return e.ID }
func (e TestEntiteitGegevenstypen) Metatype() Metatype      { return MetatypeEntiteit }
func (e *TestEntiteitGegevenstypen) ClearID()               { e.ID = 0 }
func (e TestEntiteitGegevenstypen) GetOpvoer() *time.Time   { return e.Opvoer }
func (e *TestEntiteitGegevenstypen) SetOpvoer(t *time.Time) { e.Opvoer = t }
func (e TestEntiteitGegevenstypen) GetAfvoer() *time.Time   { return e.Afvoer }
func (e *TestEntiteitGegevenstypen) SetAfvoer(t *time.Time) { e.Afvoer = t }
func (e TestEntiteitGegevenstypen) String() string          { return RepresentatieToString(e) }

/* ================================================================
   2. TestEntiteitGegevenstypen_TestGEGegevenstypen (Hub)
   ================================================================ */

func (h TestEntiteitGegevenstypen_TestGEGegevenstypen) GetID() any { return h.Rel_ID }
func (h TestEntiteitGegevenstypen_TestGEGegevenstypen) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (h *TestEntiteitGegevenstypen_TestGEGegevenstypen) ClearID() { h.Rel_ID = 0 }
func (h TestEntiteitGegevenstypen_TestGEGegevenstypen) GetOpvoer() *time.Time {
	return h.Opvoer
}
func (h *TestEntiteitGegevenstypen_TestGEGegevenstypen) SetOpvoer(t *time.Time) { h.Opvoer = t }
func (h TestEntiteitGegevenstypen_TestGEGegevenstypen) GetAfvoer() *time.Time {
	return h.Afvoer
}
func (h *TestEntiteitGegevenstypen_TestGEGegevenstypen) SetAfvoer(t *time.Time) { h.Afvoer = t }
func (h TestEntiteitGegevenstypen_TestGEGegevenstypen) String() string {
	return RepresentatieToString(h)
}

/* ================================================================
   3. TestEntiteitGegevenstypen_TestGEGegevenstypen_Data
   ================================================================ */

func (d TestEntiteitGegevenstypen_TestGEGegevenstypen_Data) GetID() any { return d.Versie }
func (d TestEntiteitGegevenstypen_TestGEGegevenstypen_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *TestEntiteitGegevenstypen_TestGEGegevenstypen_Data) ClearID() { d.Versie = 0 }
func (d TestEntiteitGegevenstypen_TestGEGegevenstypen_Data) GetOpvoer() *time.Time {
	return d.Opvoer
}
func (d *TestEntiteitGegevenstypen_TestGEGegevenstypen_Data) SetOpvoer(t *time.Time) {
	d.Opvoer = t
}
func (d TestEntiteitGegevenstypen_TestGEGegevenstypen_Data) GetAfvoer() *time.Time {
	return d.Afvoer
}
func (d *TestEntiteitGegevenstypen_TestGEGegevenstypen_Data) SetAfvoer(t *time.Time) {
	d.Afvoer = t
}
func (d TestEntiteitGegevenstypen_TestGEGegevenstypen_Data) String() string {
	return RepresentatieToString(d)
}

/* ================================================================
   4. TestEntiteitGegevenstypen_TestGEGegevenstypen_Input
   ================================================================ */

func (i TestEntiteitGegevenstypen_TestGEGegevenstypen_Input) GetID() any { return i.Rel_ID }
func (i TestEntiteitGegevenstypen_TestGEGegevenstypen_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *TestEntiteitGegevenstypen_TestGEGegevenstypen_Input) ClearID()               { i.Rel_ID = 0 }
func (i TestEntiteitGegevenstypen_TestGEGegevenstypen_Input) GetOpvoer() *time.Time   { return nil }
func (i *TestEntiteitGegevenstypen_TestGEGegevenstypen_Input) SetOpvoer(_ *time.Time) {}
func (i TestEntiteitGegevenstypen_TestGEGegevenstypen_Input) GetAfvoer() *time.Time   { return nil }
func (i *TestEntiteitGegevenstypen_TestGEGegevenstypen_Input) SetAfvoer(_ *time.Time) {}
func (i TestEntiteitGegevenstypen_TestGEGegevenstypen_Input) String() string {
	return RepresentatieToString(i)
}

/* ================================================================
   5. GeefOnderliggendeGegevenselementen — TestEntiteitGegevenstypen
   ================================================================ */

func (e *TestEntiteitGegevenstypen) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range e.TestGEs {
		if e.TestGEs[idx].TestEntiteitGegevenstypen_ID == 0 {
			e.TestGEs[idx].TestEntiteitGegevenstypen_ID = e.ID
		}
		result = append(result, OnderliggendeRepresentatie{
			Typenaam:      "TestEntiteitGegevenstypen_TestGEGegevenstypen",
			Representatie: &e.TestGEs[idx],
		})
	}
	return result
}
