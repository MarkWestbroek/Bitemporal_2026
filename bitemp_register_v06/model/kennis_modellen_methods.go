package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// Kennisartikel
func (k Kennisartikel) GetID() any              { return k.ID }
func (k Kennisartikel) Metatype() Metatype      { return MetatypeEntiteit }
func (k *Kennisartikel) ClearID()               { k.ID = 0 }
func (k Kennisartikel) GetOpvoer() *time.Time   { return k.Opvoer }
func (k *Kennisartikel) SetOpvoer(t *time.Time) { k.Opvoer = t }
func (k Kennisartikel) GetAfvoer() *time.Time   { return k.Afvoer }
func (k *Kennisartikel) SetAfvoer(t *time.Time) { k.Afvoer = t }
func (k Kennisartikel) String() string          { return RepresentatieToString(k) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// Kennisartikel_Kennissectie
func (kk Kennisartikel_Kennissectie) GetID() any              { return kk.Rel_ID }
func (kk Kennisartikel_Kennissectie) Metatype() Metatype      { return MetatypeGegevenselement }
func (kk *Kennisartikel_Kennissectie) ClearID()               { kk.Rel_ID = 0 }
func (kk Kennisartikel_Kennissectie) GetOpvoer() *time.Time   { return kk.Opvoer }
func (kk *Kennisartikel_Kennissectie) SetOpvoer(t *time.Time) { kk.Opvoer = t }
func (kk Kennisartikel_Kennissectie) GetAfvoer() *time.Time   { return kk.Afvoer }
func (kk *Kennisartikel_Kennissectie) SetAfvoer(t *time.Time) { kk.Afvoer = t }
func (kk Kennisartikel_Kennissectie) String() string          { return RepresentatieToString(kk) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// Kennisartikel_Kennissectie_Data
func (d Kennisartikel_Kennissectie_Data) GetID() any              { return d.Versie }
func (d Kennisartikel_Kennissectie_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Kennisartikel_Kennissectie_Data) ClearID()               { d.Versie = 0 }
func (d Kennisartikel_Kennissectie_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Kennisartikel_Kennissectie_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Kennisartikel_Kennissectie_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Kennisartikel_Kennissectie_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Kennisartikel_Kennissectie_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// Kennisartikel_Kennissectie_Input
func (i Kennisartikel_Kennissectie_Input) GetID() any              { return i.Rel_ID }
func (i Kennisartikel_Kennissectie_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Kennisartikel_Kennissectie_Input) ClearID()               { i.Rel_ID = 0 }
func (i Kennisartikel_Kennissectie_Input) GetOpvoer() *time.Time   { return nil }
func (i *Kennisartikel_Kennissectie_Input) SetOpvoer(t *time.Time) {}
func (i Kennisartikel_Kennissectie_Input) GetAfvoer() *time.Time   { return nil }
func (i *Kennisartikel_Kennissectie_Input) SetAfvoer(t *time.Time) {}
func (i Kennisartikel_Kennissectie_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (k *Kennisartikel) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range k.Kennissecties {
		if k.Kennissecties[idx].Kennisartikel_ID == 0 {
			k.Kennissecties[idx].Kennisartikel_ID = k.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Kennisartikel_Kennissectie", Representatie: &k.Kennissecties[idx]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *Kennisartikel_Kennissectie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Kennisartikel_ID == 0 {
			h.Data[i].Kennisartikel_ID = h.Kennisartikel_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Kennisartikel_Kennissectie_Data", Representatie: &h.Data[i]})
	}
	return result
}
