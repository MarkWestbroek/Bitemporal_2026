package model

// Interface-methoden en GeefOnderliggendeGegevenselementen voor register-domein types.

import "time"

/* ================================================================
   1. Referentielijst (entiteit) — interface-methoden
   ================================================================ */

func (r Referentielijst) GetID() any              { return r.ID }
func (r Referentielijst) Metatype() Metatype      { return MetatypeEntiteit }
func (r *Referentielijst) ClearID()               { r.ID = 0 }
func (r Referentielijst) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Referentielijst) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Referentielijst) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Referentielijst) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Referentielijst) String() string          { return RepresentatieToString(r) }

/* ================================================================
   2. Hubs — interface-methoden
   ================================================================ */

// Referentielijstnaam
func (r Referentielijstnaam) GetID() any              { return r.Rel_ID }
func (r Referentielijstnaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *Referentielijstnaam) ClearID()               { r.Rel_ID = 0 }
func (r Referentielijstnaam) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Referentielijstnaam) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Referentielijstnaam) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Referentielijstnaam) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Referentielijstnaam) String() string          { return RepresentatieToString(r) }

// Referentielijstomschrijving
func (r Referentielijstomschrijving) GetID() any              { return r.Rel_ID }
func (r Referentielijstomschrijving) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *Referentielijstomschrijving) ClearID()               { r.Rel_ID = 0 }
func (r Referentielijstomschrijving) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Referentielijstomschrijving) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Referentielijstomschrijving) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Referentielijstomschrijving) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Referentielijstomschrijving) String() string          { return RepresentatieToString(r) }

// ReferentielijstVisibility
func (r ReferentielijstVisibility) GetID() any              { return r.Rel_ID }
func (r ReferentielijstVisibility) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *ReferentielijstVisibility) ClearID()               { r.Rel_ID = 0 }
func (r ReferentielijstVisibility) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *ReferentielijstVisibility) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r ReferentielijstVisibility) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *ReferentielijstVisibility) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r ReferentielijstVisibility) String() string          { return RepresentatieToString(r) }

// ReferentielijstInternetadres
func (r ReferentielijstInternetadres) GetID() any              { return r.Rel_ID }
func (r ReferentielijstInternetadres) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *ReferentielijstInternetadres) ClearID()               { r.Rel_ID = 0 }
func (r ReferentielijstInternetadres) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *ReferentielijstInternetadres) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r ReferentielijstInternetadres) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *ReferentielijstInternetadres) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r ReferentielijstInternetadres) String() string          { return RepresentatieToString(r) }

/* ================================================================
   3. Data — interface-methoden
   ================================================================ */

// Referentielijstnaam_Data
func (d Referentielijstnaam_Data) GetID() any              { return d.Versie }
func (d Referentielijstnaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Referentielijstnaam_Data) ClearID()               { d.Versie = 0 }
func (d Referentielijstnaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Referentielijstnaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Referentielijstnaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Referentielijstnaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Referentielijstnaam_Data) String() string          { return RepresentatieToString(d) }

// Referentielijstomschrijving_Data
func (d Referentielijstomschrijving_Data) GetID() any              { return d.Versie }
func (d Referentielijstomschrijving_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Referentielijstomschrijving_Data) ClearID()               { d.Versie = 0 }
func (d Referentielijstomschrijving_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Referentielijstomschrijving_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Referentielijstomschrijving_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Referentielijstomschrijving_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Referentielijstomschrijving_Data) String() string          { return RepresentatieToString(d) }

// ReferentielijstVisibility_Data
func (d ReferentielijstVisibility_Data) GetID() any              { return d.Versie }
func (d ReferentielijstVisibility_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *ReferentielijstVisibility_Data) ClearID()               { d.Versie = 0 }
func (d ReferentielijstVisibility_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *ReferentielijstVisibility_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d ReferentielijstVisibility_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *ReferentielijstVisibility_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d ReferentielijstVisibility_Data) String() string          { return RepresentatieToString(d) }

// ReferentielijstInternetadres_Data
func (d ReferentielijstInternetadres_Data) GetID() any              { return d.Versie }
func (d ReferentielijstInternetadres_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *ReferentielijstInternetadres_Data) ClearID()               { d.Versie = 0 }
func (d ReferentielijstInternetadres_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *ReferentielijstInternetadres_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d ReferentielijstInternetadres_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *ReferentielijstInternetadres_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d ReferentielijstInternetadres_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. Aanvang/Einde — interface-methoden
   ================================================================ */

// Referentielijst_Aanvang
func (a Referentielijst_Aanvang) GetID() any              { return a.Versie }
func (a Referentielijst_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *Referentielijst_Aanvang) ClearID()               { a.Versie = 0 }
func (a Referentielijst_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Referentielijst_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Referentielijst_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Referentielijst_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a Referentielijst_Aanvang) String() string          { return RepresentatieToString(a) }

// Referentielijst_Einde
func (e Referentielijst_Einde) GetID() any              { return e.Versie }
func (e Referentielijst_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (e *Referentielijst_Einde) ClearID()               { e.Versie = 0 }
func (e Referentielijst_Einde) GetOpvoer() *time.Time   { return e.Opvoer }
func (e *Referentielijst_Einde) SetOpvoer(t *time.Time) { e.Opvoer = t }
func (e Referentielijst_Einde) GetAfvoer() *time.Time   { return e.Afvoer }
func (e *Referentielijst_Einde) SetAfvoer(t *time.Time) { e.Afvoer = t }
func (e Referentielijst_Einde) String() string          { return RepresentatieToString(e) }

/* ================================================================
   5. GeefOnderliggendeGegevenselementen — Referentielijst entiteit
   ================================================================ */

// GeefOnderliggendeGegevenselementen retourneert alle register-scope onderliggende
// representaties. Domein-specifieke items (bijv. LandenlijstLanden) worden hier
// ook meegenomen omdat het struct-veld op de Referentielijst entiteit staat.
func (r *Referentielijst) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range r.Referentielijstnamen {
		if r.Referentielijstnamen[i].Referentielijst_ID == 0 {
			r.Referentielijstnamen[i].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijstnaam", Representatie: &r.Referentielijstnamen[i]})
	}
	for i := range r.Referentielijstomschrijvingen {
		if r.Referentielijstomschrijvingen[i].Referentielijst_ID == 0 {
			r.Referentielijstomschrijvingen[i].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijstomschrijving", Representatie: &r.Referentielijstomschrijvingen[i]})
	}
	for i := range r.Visibilities {
		if r.Visibilities[i].Referentielijst_ID == 0 {
			r.Visibilities[i].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "ReferentielijstVisibility", Representatie: &r.Visibilities[i]})
	}
	for i := range r.Internetadressen {
		if r.Internetadressen[i].Referentielijst_ID == 0 {
			r.Internetadressen[i].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "ReferentielijstInternetadres", Representatie: &r.Internetadressen[i]})
	}
	for i := range r.LandenlijstLanden {
		if r.LandenlijstLanden[i].Referentielijst_ID == 0 {
			r.LandenlijstLanden[i].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "LandenlijstLand", Representatie: &r.LandenlijstLanden[i]})
	}
	for i := range r.Aanvang {
		if r.Aanvang[i].Referentielijst_ID == 0 {
			r.Aanvang[i].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_Aanvang", Representatie: &r.Aanvang[i]})
	}
	for i := range r.Einde {
		if r.Einde[i].Referentielijst_ID == 0 {
			r.Einde[i].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_Einde", Representatie: &r.Einde[i]})
	}
	return result
}

/* ================================================================
   6. GeefOnderliggendeGegevenselementen — register-scope hubs
   ================================================================ */

func (h *Referentielijstnaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijstnaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Referentielijstomschrijving) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijstomschrijving_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *ReferentielijstVisibility) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "ReferentielijstVisibility_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *ReferentielijstInternetadres) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "ReferentielijstInternetadres_Data", Representatie: &h.Data[i]})
	}
	return result
}
