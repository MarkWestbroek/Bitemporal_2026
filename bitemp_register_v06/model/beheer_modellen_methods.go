package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// Gebruiker
func (g Gebruiker) GetID() any              { return g.ID }
func (g Gebruiker) Metatype() Metatype      { return MetatypeEntiteit }
func (g *Gebruiker) ClearID()               { g.ID = 0 }
func (g Gebruiker) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gebruiker) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gebruiker) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gebruiker) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gebruiker) String() string          { return RepresentatieToString(g) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// Gebruiker_GebruikerIdentiteit
func (gg Gebruiker_GebruikerIdentiteit) GetID() any              { return gg.Rel_ID }
func (gg Gebruiker_GebruikerIdentiteit) Metatype() Metatype      { return MetatypeGegevenselement }
func (gg *Gebruiker_GebruikerIdentiteit) ClearID()               { gg.Rel_ID = 0 }
func (gg Gebruiker_GebruikerIdentiteit) GetOpvoer() *time.Time   { return gg.Opvoer }
func (gg *Gebruiker_GebruikerIdentiteit) SetOpvoer(t *time.Time) { gg.Opvoer = t }
func (gg Gebruiker_GebruikerIdentiteit) GetAfvoer() *time.Time   { return gg.Afvoer }
func (gg *Gebruiker_GebruikerIdentiteit) SetAfvoer(t *time.Time) { gg.Afvoer = t }
func (gg Gebruiker_GebruikerIdentiteit) String() string          { return RepresentatieToString(gg) }

// Gebruiker_GebruikerStatus
func (gg Gebruiker_GebruikerStatus) GetID() any              { return gg.Rel_ID }
func (gg Gebruiker_GebruikerStatus) Metatype() Metatype      { return MetatypeGegevenselement }
func (gg *Gebruiker_GebruikerStatus) ClearID()               { gg.Rel_ID = 0 }
func (gg Gebruiker_GebruikerStatus) GetOpvoer() *time.Time   { return gg.Opvoer }
func (gg *Gebruiker_GebruikerStatus) SetOpvoer(t *time.Time) { gg.Opvoer = t }
func (gg Gebruiker_GebruikerStatus) GetAfvoer() *time.Time   { return gg.Afvoer }
func (gg *Gebruiker_GebruikerStatus) SetAfvoer(t *time.Time) { gg.Afvoer = t }
func (gg Gebruiker_GebruikerStatus) String() string          { return RepresentatieToString(gg) }

// Gebruiker_GebruikerRoltoewijzing
func (gg Gebruiker_GebruikerRoltoewijzing) GetID() any              { return gg.Rel_ID }
func (gg Gebruiker_GebruikerRoltoewijzing) Metatype() Metatype      { return MetatypeGegevenselement }
func (gg *Gebruiker_GebruikerRoltoewijzing) ClearID()               { gg.Rel_ID = 0 }
func (gg Gebruiker_GebruikerRoltoewijzing) GetOpvoer() *time.Time   { return gg.Opvoer }
func (gg *Gebruiker_GebruikerRoltoewijzing) SetOpvoer(t *time.Time) { gg.Opvoer = t }
func (gg Gebruiker_GebruikerRoltoewijzing) GetAfvoer() *time.Time   { return gg.Afvoer }
func (gg *Gebruiker_GebruikerRoltoewijzing) SetAfvoer(t *time.Time) { gg.Afvoer = t }
func (gg Gebruiker_GebruikerRoltoewijzing) String() string          { return RepresentatieToString(gg) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// Gebruiker_GebruikerIdentiteit_Data
func (d Gebruiker_GebruikerIdentiteit_Data) GetID() any              { return d.Versie }
func (d Gebruiker_GebruikerIdentiteit_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Gebruiker_GebruikerIdentiteit_Data) ClearID()               { d.Versie = 0 }
func (d Gebruiker_GebruikerIdentiteit_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Gebruiker_GebruikerIdentiteit_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Gebruiker_GebruikerIdentiteit_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Gebruiker_GebruikerIdentiteit_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Gebruiker_GebruikerIdentiteit_Data) String() string          { return RepresentatieToString(d) }

// Gebruiker_GebruikerStatus_Data
func (d Gebruiker_GebruikerStatus_Data) GetID() any              { return d.Versie }
func (d Gebruiker_GebruikerStatus_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Gebruiker_GebruikerStatus_Data) ClearID()               { d.Versie = 0 }
func (d Gebruiker_GebruikerStatus_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Gebruiker_GebruikerStatus_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Gebruiker_GebruikerStatus_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Gebruiker_GebruikerStatus_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Gebruiker_GebruikerStatus_Data) String() string          { return RepresentatieToString(d) }

// Gebruiker_GebruikerRoltoewijzing_Data
func (d Gebruiker_GebruikerRoltoewijzing_Data) GetID() any              { return d.Versie }
func (d Gebruiker_GebruikerRoltoewijzing_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Gebruiker_GebruikerRoltoewijzing_Data) ClearID()               { d.Versie = 0 }
func (d Gebruiker_GebruikerRoltoewijzing_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Gebruiker_GebruikerRoltoewijzing_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Gebruiker_GebruikerRoltoewijzing_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Gebruiker_GebruikerRoltoewijzing_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Gebruiker_GebruikerRoltoewijzing_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

// Gebruiker_Aanvang
func (g Gebruiker_Aanvang) GetID() any              { return g.Versie }
func (g Gebruiker_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gebruiker_Aanvang) ClearID()               { g.Versie = 0 }
func (g Gebruiker_Aanvang) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gebruiker_Aanvang) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gebruiker_Aanvang) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gebruiker_Aanvang) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gebruiker_Aanvang) String() string          { return RepresentatieToString(g) }

// Gebruiker_Einde
func (g Gebruiker_Einde) GetID() any              { return g.Versie }
func (g Gebruiker_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gebruiker_Einde) ClearID()               { g.Versie = 0 }
func (g Gebruiker_Einde) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gebruiker_Einde) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gebruiker_Einde) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gebruiker_Einde) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gebruiker_Einde) String() string          { return RepresentatieToString(g) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

// Gebruiker_GebruikerStatus_Aanvang
func (g Gebruiker_GebruikerStatus_Aanvang) GetID() any              { return g.Versie }
func (g Gebruiker_GebruikerStatus_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gebruiker_GebruikerStatus_Aanvang) ClearID()               { g.Versie = 0 }
func (g Gebruiker_GebruikerStatus_Aanvang) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gebruiker_GebruikerStatus_Aanvang) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gebruiker_GebruikerStatus_Aanvang) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gebruiker_GebruikerStatus_Aanvang) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gebruiker_GebruikerStatus_Aanvang) String() string          { return RepresentatieToString(g) }

// Gebruiker_GebruikerStatus_Einde
func (g Gebruiker_GebruikerStatus_Einde) GetID() any              { return g.Versie }
func (g Gebruiker_GebruikerStatus_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gebruiker_GebruikerStatus_Einde) ClearID()               { g.Versie = 0 }
func (g Gebruiker_GebruikerStatus_Einde) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gebruiker_GebruikerStatus_Einde) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gebruiker_GebruikerStatus_Einde) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gebruiker_GebruikerStatus_Einde) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gebruiker_GebruikerStatus_Einde) String() string          { return RepresentatieToString(g) }

// Gebruiker_GebruikerRoltoewijzing_Aanvang
func (g Gebruiker_GebruikerRoltoewijzing_Aanvang) GetID() any              { return g.Versie }
func (g Gebruiker_GebruikerRoltoewijzing_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gebruiker_GebruikerRoltoewijzing_Aanvang) ClearID()               { g.Versie = 0 }
func (g Gebruiker_GebruikerRoltoewijzing_Aanvang) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gebruiker_GebruikerRoltoewijzing_Aanvang) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gebruiker_GebruikerRoltoewijzing_Aanvang) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gebruiker_GebruikerRoltoewijzing_Aanvang) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gebruiker_GebruikerRoltoewijzing_Aanvang) String() string          { return RepresentatieToString(g) }

// Gebruiker_GebruikerRoltoewijzing_Einde
func (g Gebruiker_GebruikerRoltoewijzing_Einde) GetID() any              { return g.Versie }
func (g Gebruiker_GebruikerRoltoewijzing_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gebruiker_GebruikerRoltoewijzing_Einde) ClearID()               { g.Versie = 0 }
func (g Gebruiker_GebruikerRoltoewijzing_Einde) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gebruiker_GebruikerRoltoewijzing_Einde) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gebruiker_GebruikerRoltoewijzing_Einde) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gebruiker_GebruikerRoltoewijzing_Einde) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gebruiker_GebruikerRoltoewijzing_Einde) String() string          { return RepresentatieToString(g) }

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// Gebruiker_GebruikerIdentiteit_Input
func (i Gebruiker_GebruikerIdentiteit_Input) GetID() any              { return i.Rel_ID }
func (i Gebruiker_GebruikerIdentiteit_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Gebruiker_GebruikerIdentiteit_Input) ClearID()               { i.Rel_ID = 0 }
func (i Gebruiker_GebruikerIdentiteit_Input) GetOpvoer() *time.Time   { return nil }
func (i *Gebruiker_GebruikerIdentiteit_Input) SetOpvoer(t *time.Time) {}
func (i Gebruiker_GebruikerIdentiteit_Input) GetAfvoer() *time.Time   { return nil }
func (i *Gebruiker_GebruikerIdentiteit_Input) SetAfvoer(t *time.Time) {}
func (i Gebruiker_GebruikerIdentiteit_Input) String() string          { return RepresentatieToString(i) }

// Gebruiker_GebruikerStatus_Input
func (i Gebruiker_GebruikerStatus_Input) GetID() any              { return i.Rel_ID }
func (i Gebruiker_GebruikerStatus_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Gebruiker_GebruikerStatus_Input) ClearID()               { i.Rel_ID = 0 }
func (i Gebruiker_GebruikerStatus_Input) GetOpvoer() *time.Time   { return nil }
func (i *Gebruiker_GebruikerStatus_Input) SetOpvoer(t *time.Time) {}
func (i Gebruiker_GebruikerStatus_Input) GetAfvoer() *time.Time   { return nil }
func (i *Gebruiker_GebruikerStatus_Input) SetAfvoer(t *time.Time) {}
func (i Gebruiker_GebruikerStatus_Input) String() string          { return RepresentatieToString(i) }

// Gebruiker_GebruikerRoltoewijzing_Input
func (i Gebruiker_GebruikerRoltoewijzing_Input) GetID() any              { return i.Rel_ID }
func (i Gebruiker_GebruikerRoltoewijzing_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Gebruiker_GebruikerRoltoewijzing_Input) ClearID()               { i.Rel_ID = 0 }
func (i Gebruiker_GebruikerRoltoewijzing_Input) GetOpvoer() *time.Time   { return nil }
func (i *Gebruiker_GebruikerRoltoewijzing_Input) SetOpvoer(t *time.Time) {}
func (i Gebruiker_GebruikerRoltoewijzing_Input) GetAfvoer() *time.Time   { return nil }
func (i *Gebruiker_GebruikerRoltoewijzing_Input) SetAfvoer(t *time.Time) {}
func (i Gebruiker_GebruikerRoltoewijzing_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (g *Gebruiker) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range g.GebruikerIdentiteiten {
		if g.GebruikerIdentiteiten[idx].Gebruiker_ID == 0 {
			g.GebruikerIdentiteiten[idx].Gebruiker_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerIdentiteit", Representatie: &g.GebruikerIdentiteiten[idx]})
	}
	for idx := range g.GebruikerStatussen {
		if g.GebruikerStatussen[idx].Gebruiker_ID == 0 {
			g.GebruikerStatussen[idx].Gebruiker_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerStatus", Representatie: &g.GebruikerStatussen[idx]})
	}
	for idx := range g.GebruikerRoltoewijzingen {
		if g.GebruikerRoltoewijzingen[idx].Gebruiker_ID == 0 {
			g.GebruikerRoltoewijzingen[idx].Gebruiker_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerRoltoewijzing", Representatie: &g.GebruikerRoltoewijzingen[idx]})
	}
	for idx := range g.Aanvang {
		if g.Aanvang[idx].Gebruiker_ID == 0 {
			g.Aanvang[idx].Gebruiker_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_Aanvang", Representatie: &g.Aanvang[idx]})
	}
	for idx := range g.Einde {
		if g.Einde[idx].Gebruiker_ID == 0 {
			g.Einde[idx].Gebruiker_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_Einde", Representatie: &g.Einde[idx]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *Gebruiker_GebruikerIdentiteit) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Gebruiker_ID == 0 {
			h.Data[i].Gebruiker_ID = h.Gebruiker_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerIdentiteit_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Gebruiker_GebruikerStatus) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Gebruiker_ID == 0 {
			h.Data[i].Gebruiker_ID = h.Gebruiker_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerStatus_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Gebruiker_ID == 0 {
			h.Aanvang[i].Gebruiker_ID = h.Gebruiker_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerStatus_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Gebruiker_ID == 0 {
			h.Einde[i].Gebruiker_ID = h.Gebruiker_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerStatus_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *Gebruiker_GebruikerRoltoewijzing) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Gebruiker_ID == 0 {
			h.Data[i].Gebruiker_ID = h.Gebruiker_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerRoltoewijzing_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Gebruiker_ID == 0 {
			h.Aanvang[i].Gebruiker_ID = h.Gebruiker_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerRoltoewijzing_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Gebruiker_ID == 0 {
			h.Einde[i].Gebruiker_ID = h.Gebruiker_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gebruiker_GebruikerRoltoewijzing_Einde", Representatie: &h.Einde[i]})
	}
	return result
}
