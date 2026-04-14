package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// IdeBestand
func (i IdeBestand) GetID() any              { return i.ID }
func (i IdeBestand) Metatype() Metatype      { return MetatypeEntiteit }
func (i *IdeBestand) ClearID()               { i.ID = 0 }
func (i IdeBestand) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *IdeBestand) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i IdeBestand) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *IdeBestand) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i IdeBestand) String() string          { return RepresentatieToString(i) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// IdeBestand_Meta
func (im IdeBestand_Meta) GetID() any              { return im.Rel_ID }
func (im IdeBestand_Meta) Metatype() Metatype      { return MetatypeGegevenselement }
func (im *IdeBestand_Meta) ClearID()               { im.Rel_ID = 0 }
func (im IdeBestand_Meta) GetOpvoer() *time.Time   { return im.Opvoer }
func (im *IdeBestand_Meta) SetOpvoer(t *time.Time) { im.Opvoer = t }
func (im IdeBestand_Meta) GetAfvoer() *time.Time   { return im.Afvoer }
func (im *IdeBestand_Meta) SetAfvoer(t *time.Time) { im.Afvoer = t }
func (im IdeBestand_Meta) String() string          { return RepresentatieToString(im) }

// IdeBestand_Inhoud
func (ii IdeBestand_Inhoud) GetID() any              { return ii.Rel_ID }
func (ii IdeBestand_Inhoud) Metatype() Metatype      { return MetatypeGegevenselement }
func (ii *IdeBestand_Inhoud) ClearID()               { ii.Rel_ID = 0 }
func (ii IdeBestand_Inhoud) GetOpvoer() *time.Time   { return ii.Opvoer }
func (ii *IdeBestand_Inhoud) SetOpvoer(t *time.Time) { ii.Opvoer = t }
func (ii IdeBestand_Inhoud) GetAfvoer() *time.Time   { return ii.Afvoer }
func (ii *IdeBestand_Inhoud) SetAfvoer(t *time.Time) { ii.Afvoer = t }
func (ii IdeBestand_Inhoud) String() string          { return RepresentatieToString(ii) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// IdeBestand_Meta_Data
func (d IdeBestand_Meta_Data) GetID() any              { return d.Versie }
func (d IdeBestand_Meta_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *IdeBestand_Meta_Data) ClearID()               { d.Versie = 0 }
func (d IdeBestand_Meta_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *IdeBestand_Meta_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d IdeBestand_Meta_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *IdeBestand_Meta_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d IdeBestand_Meta_Data) String() string          { return RepresentatieToString(d) }

// IdeBestand_Inhoud_Data
func (d IdeBestand_Inhoud_Data) GetID() any              { return d.Versie }
func (d IdeBestand_Inhoud_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *IdeBestand_Inhoud_Data) ClearID()               { d.Versie = 0 }
func (d IdeBestand_Inhoud_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *IdeBestand_Inhoud_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d IdeBestand_Inhoud_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *IdeBestand_Inhoud_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d IdeBestand_Inhoud_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

// IdeBestand_Aanvang
func (i IdeBestand_Aanvang) GetID() any              { return i.Versie }
func (i IdeBestand_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *IdeBestand_Aanvang) ClearID()               { i.Versie = 0 }
func (i IdeBestand_Aanvang) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *IdeBestand_Aanvang) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i IdeBestand_Aanvang) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *IdeBestand_Aanvang) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i IdeBestand_Aanvang) String() string          { return RepresentatieToString(i) }

// IdeBestand_Einde
func (i IdeBestand_Einde) GetID() any              { return i.Versie }
func (i IdeBestand_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *IdeBestand_Einde) ClearID()               { i.Versie = 0 }
func (i IdeBestand_Einde) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *IdeBestand_Einde) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i IdeBestand_Einde) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *IdeBestand_Einde) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i IdeBestand_Einde) String() string          { return RepresentatieToString(i) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// IdeBestand_Meta_Input
func (i IdeBestand_Meta_Input) GetID() any              { return i.Rel_ID }
func (i IdeBestand_Meta_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *IdeBestand_Meta_Input) ClearID()               { i.Rel_ID = 0 }
func (i IdeBestand_Meta_Input) GetOpvoer() *time.Time   { return nil }
func (i *IdeBestand_Meta_Input) SetOpvoer(t *time.Time) {}
func (i IdeBestand_Meta_Input) GetAfvoer() *time.Time   { return nil }
func (i *IdeBestand_Meta_Input) SetAfvoer(t *time.Time) {}
func (i IdeBestand_Meta_Input) String() string          { return RepresentatieToString(i) }

// IdeBestand_Inhoud_Input
func (i IdeBestand_Inhoud_Input) GetID() any              { return i.Rel_ID }
func (i IdeBestand_Inhoud_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *IdeBestand_Inhoud_Input) ClearID()               { i.Rel_ID = 0 }
func (i IdeBestand_Inhoud_Input) GetOpvoer() *time.Time   { return nil }
func (i *IdeBestand_Inhoud_Input) SetOpvoer(t *time.Time) {}
func (i IdeBestand_Inhoud_Input) GetAfvoer() *time.Time   { return nil }
func (i *IdeBestand_Inhoud_Input) SetAfvoer(t *time.Time) {}
func (i IdeBestand_Inhoud_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (i *IdeBestand) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range i.IdeBestandMetas {
		if i.IdeBestandMetas[idx].IdeBestand_ID == 0 {
			i.IdeBestandMetas[idx].IdeBestand_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "IdeBestand_Meta", Representatie: &i.IdeBestandMetas[idx]})
	}
	for idx := range i.IdeBestandInhouds {
		if i.IdeBestandInhouds[idx].IdeBestand_ID == 0 {
			i.IdeBestandInhouds[idx].IdeBestand_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "IdeBestand_Inhoud", Representatie: &i.IdeBestandInhouds[idx]})
	}
	for idx := range i.Aanvang {
		if i.Aanvang[idx].IdeBestand_ID == 0 {
			i.Aanvang[idx].IdeBestand_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "IdeBestand_Aanvang", Representatie: &i.Aanvang[idx]})
	}
	for idx := range i.Einde {
		if i.Einde[idx].IdeBestand_ID == 0 {
			i.Einde[idx].IdeBestand_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "IdeBestand_Einde", Representatie: &i.Einde[idx]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *IdeBestand_Meta) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].IdeBestand_ID == 0 {
			h.Data[i].IdeBestand_ID = h.IdeBestand_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "IdeBestand_Meta_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *IdeBestand_Inhoud) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].IdeBestand_ID == 0 {
			h.Data[i].IdeBestand_ID = h.IdeBestand_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "IdeBestand_Inhoud_Data", Representatie: &h.Data[i]})
	}
	return result
}
