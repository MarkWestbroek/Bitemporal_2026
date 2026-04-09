package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// FormulierDefinitie
func (f FormulierDefinitie) GetID() any              { return f.ID }
func (f FormulierDefinitie) Metatype() Metatype      { return MetatypeEntiteit }
func (f *FormulierDefinitie) ClearID()               { f.ID = 0 }
func (f FormulierDefinitie) GetOpvoer() *time.Time   { return f.Opvoer }
func (f *FormulierDefinitie) SetOpvoer(t *time.Time) { f.Opvoer = t }
func (f FormulierDefinitie) GetAfvoer() *time.Time   { return f.Afvoer }
func (f *FormulierDefinitie) SetAfvoer(t *time.Time) { f.Afvoer = t }
func (f FormulierDefinitie) String() string          { return RepresentatieToString(f) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// FormulierDefinitie_Meta
func (fm FormulierDefinitie_Meta) GetID() any              { return fm.Rel_ID }
func (fm FormulierDefinitie_Meta) Metatype() Metatype      { return MetatypeGegevenselement }
func (fm *FormulierDefinitie_Meta) ClearID()               { fm.Rel_ID = 0 }
func (fm FormulierDefinitie_Meta) GetOpvoer() *time.Time   { return fm.Opvoer }
func (fm *FormulierDefinitie_Meta) SetOpvoer(t *time.Time) { fm.Opvoer = t }
func (fm FormulierDefinitie_Meta) GetAfvoer() *time.Time   { return fm.Afvoer }
func (fm *FormulierDefinitie_Meta) SetAfvoer(t *time.Time) { fm.Afvoer = t }
func (fm FormulierDefinitie_Meta) String() string          { return RepresentatieToString(fm) }

// FormulierDefinitie_Layout
func (fl FormulierDefinitie_Layout) GetID() any              { return fl.Rel_ID }
func (fl FormulierDefinitie_Layout) Metatype() Metatype      { return MetatypeGegevenselement }
func (fl *FormulierDefinitie_Layout) ClearID()               { fl.Rel_ID = 0 }
func (fl FormulierDefinitie_Layout) GetOpvoer() *time.Time   { return fl.Opvoer }
func (fl *FormulierDefinitie_Layout) SetOpvoer(t *time.Time) { fl.Opvoer = t }
func (fl FormulierDefinitie_Layout) GetAfvoer() *time.Time   { return fl.Afvoer }
func (fl *FormulierDefinitie_Layout) SetAfvoer(t *time.Time) { fl.Afvoer = t }
func (fl FormulierDefinitie_Layout) String() string          { return RepresentatieToString(fl) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// FormulierDefinitie_Meta_Data
func (d FormulierDefinitie_Meta_Data) GetID() any              { return d.Versie }
func (d FormulierDefinitie_Meta_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *FormulierDefinitie_Meta_Data) ClearID()               { d.Versie = 0 }
func (d FormulierDefinitie_Meta_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *FormulierDefinitie_Meta_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d FormulierDefinitie_Meta_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *FormulierDefinitie_Meta_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d FormulierDefinitie_Meta_Data) String() string          { return RepresentatieToString(d) }

// FormulierDefinitie_Layout_Data
func (d FormulierDefinitie_Layout_Data) GetID() any              { return d.Versie }
func (d FormulierDefinitie_Layout_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *FormulierDefinitie_Layout_Data) ClearID()               { d.Versie = 0 }
func (d FormulierDefinitie_Layout_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *FormulierDefinitie_Layout_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d FormulierDefinitie_Layout_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *FormulierDefinitie_Layout_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d FormulierDefinitie_Layout_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

// FormulierDefinitie_Aanvang
func (f FormulierDefinitie_Aanvang) GetID() any              { return f.Versie }
func (f FormulierDefinitie_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (f *FormulierDefinitie_Aanvang) ClearID()               { f.Versie = 0 }
func (f FormulierDefinitie_Aanvang) GetOpvoer() *time.Time   { return f.Opvoer }
func (f *FormulierDefinitie_Aanvang) SetOpvoer(t *time.Time) { f.Opvoer = t }
func (f FormulierDefinitie_Aanvang) GetAfvoer() *time.Time   { return f.Afvoer }
func (f *FormulierDefinitie_Aanvang) SetAfvoer(t *time.Time) { f.Afvoer = t }
func (f FormulierDefinitie_Aanvang) String() string          { return RepresentatieToString(f) }

// FormulierDefinitie_Einde
func (f FormulierDefinitie_Einde) GetID() any              { return f.Versie }
func (f FormulierDefinitie_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (f *FormulierDefinitie_Einde) ClearID()               { f.Versie = 0 }
func (f FormulierDefinitie_Einde) GetOpvoer() *time.Time   { return f.Opvoer }
func (f *FormulierDefinitie_Einde) SetOpvoer(t *time.Time) { f.Opvoer = t }
func (f FormulierDefinitie_Einde) GetAfvoer() *time.Time   { return f.Afvoer }
func (f *FormulierDefinitie_Einde) SetAfvoer(t *time.Time) { f.Afvoer = t }
func (f FormulierDefinitie_Einde) String() string          { return RepresentatieToString(f) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// FormulierDefinitie_Meta_Input
func (i FormulierDefinitie_Meta_Input) GetID() any              { return i.Rel_ID }
func (i FormulierDefinitie_Meta_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *FormulierDefinitie_Meta_Input) ClearID()               { i.Rel_ID = 0 }
func (i FormulierDefinitie_Meta_Input) GetOpvoer() *time.Time   { return nil }
func (i *FormulierDefinitie_Meta_Input) SetOpvoer(t *time.Time) {}
func (i FormulierDefinitie_Meta_Input) GetAfvoer() *time.Time   { return nil }
func (i *FormulierDefinitie_Meta_Input) SetAfvoer(t *time.Time) {}
func (i FormulierDefinitie_Meta_Input) String() string          { return RepresentatieToString(i) }

// FormulierDefinitie_Layout_Input
func (i FormulierDefinitie_Layout_Input) GetID() any              { return i.Rel_ID }
func (i FormulierDefinitie_Layout_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *FormulierDefinitie_Layout_Input) ClearID()               { i.Rel_ID = 0 }
func (i FormulierDefinitie_Layout_Input) GetOpvoer() *time.Time   { return nil }
func (i *FormulierDefinitie_Layout_Input) SetOpvoer(t *time.Time) {}
func (i FormulierDefinitie_Layout_Input) GetAfvoer() *time.Time   { return nil }
func (i *FormulierDefinitie_Layout_Input) SetAfvoer(t *time.Time) {}
func (i FormulierDefinitie_Layout_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (f *FormulierDefinitie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range f.FormulierDefinitieMetas {
		if f.FormulierDefinitieMetas[idx].FormulierDefinitie_ID == 0 {
			f.FormulierDefinitieMetas[idx].FormulierDefinitie_ID = f.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "FormulierDefinitie_Meta", Representatie: &f.FormulierDefinitieMetas[idx]})
	}
	for idx := range f.FormulierDefinitieLayouts {
		if f.FormulierDefinitieLayouts[idx].FormulierDefinitie_ID == 0 {
			f.FormulierDefinitieLayouts[idx].FormulierDefinitie_ID = f.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "FormulierDefinitie_Layout", Representatie: &f.FormulierDefinitieLayouts[idx]})
	}
	for idx := range f.Aanvang {
		if f.Aanvang[idx].FormulierDefinitie_ID == 0 {
			f.Aanvang[idx].FormulierDefinitie_ID = f.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "FormulierDefinitie_Aanvang", Representatie: &f.Aanvang[idx]})
	}
	for idx := range f.Einde {
		if f.Einde[idx].FormulierDefinitie_ID == 0 {
			f.Einde[idx].FormulierDefinitie_ID = f.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "FormulierDefinitie_Einde", Representatie: &f.Einde[idx]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *FormulierDefinitie_Meta) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].FormulierDefinitie_ID == 0 {
			h.Data[i].FormulierDefinitie_ID = h.FormulierDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "FormulierDefinitie_Meta_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *FormulierDefinitie_Layout) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].FormulierDefinitie_ID == 0 {
			h.Data[i].FormulierDefinitie_ID = h.FormulierDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "FormulierDefinitie_Layout_Data", Representatie: &h.Data[i]})
	}
	return result
}
