package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// Persoon
func (p Persoon) GetID() any { return p.ID }
func (p Persoon) Metatype() Metatype { return MetatypeEntiteit }
func (p *Persoon) ClearID() { p.ID = 0 }
func (p Persoon) GetOpvoer() *time.Time { return p.Opvoer }
func (p *Persoon) SetOpvoer(t *time.Time) { p.Opvoer = t }
func (p Persoon) GetAfvoer() *time.Time { return p.Afvoer }
func (p *Persoon) SetAfvoer(t *time.Time) { p.Afvoer = t }
func (p Persoon) String() string { return RepresentatieToString(p) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// Persoon_Naam
func (pn Persoon_Naam) GetID() any { return pn.Rel_ID }
func (pn Persoon_Naam) Metatype() Metatype { return MetatypeGegevenselement }
func (pn *Persoon_Naam) ClearID() { pn.Rel_ID = 0 }
func (pn Persoon_Naam) GetOpvoer() *time.Time { return pn.Opvoer }
func (pn *Persoon_Naam) SetOpvoer(t *time.Time) { pn.Opvoer = t }
func (pn Persoon_Naam) GetAfvoer() *time.Time { return pn.Afvoer }
func (pn *Persoon_Naam) SetAfvoer(t *time.Time) { pn.Afvoer = t }
func (pn Persoon_Naam) String() string { return RepresentatieToString(pn) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// Persoon_Naam_Data
func (d Persoon_Naam_Data) GetID() any { return d.Versie }
func (d Persoon_Naam_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *Persoon_Naam_Data) ClearID() { d.Versie = 0 }
func (d Persoon_Naam_Data) GetOpvoer() *time.Time { return d.Opvoer }
func (d *Persoon_Naam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Persoon_Naam_Data) GetAfvoer() *time.Time { return d.Afvoer }
func (d *Persoon_Naam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Persoon_Naam_Data) String() string { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// Persoon_Naam_Input
func (i Persoon_Naam_Input) GetID() any { return i.Rel_ID }
func (i Persoon_Naam_Input) Metatype() Metatype { return MetatypeGegevenselement }
func (i *Persoon_Naam_Input) ClearID() { i.Rel_ID = 0 }
func (i Persoon_Naam_Input) GetOpvoer() *time.Time { return nil }
func (i *Persoon_Naam_Input) SetOpvoer(t *time.Time) {}
func (i Persoon_Naam_Input) GetAfvoer() *time.Time { return nil }
func (i *Persoon_Naam_Input) SetAfvoer(t *time.Time) {}
func (i Persoon_Naam_Input) String() string { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (p *Persoon) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range p.Naams {
		if p.Naams[i].Persoon_ID == 0 {
			p.Naams[i].Persoon_ID = p.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Persoon_Naam", Representatie: &p.Naams[i]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *Persoon_Naam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Persoon_ID == 0 {
			h.Data[i].Persoon_ID = h.Persoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Persoon_Naam_Data", Representatie: &h.Data[i]})
	}
	return result
}

