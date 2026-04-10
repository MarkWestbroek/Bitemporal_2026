package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// A
func (a A) GetID() any              { return a.ID }
func (a A) Metatype() Metatype      { return MetatypeEntiteit }
func (a *A) ClearID()               { a.ID = 0 }
func (a A) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A) String() string          { return RepresentatieToString(a) }

// B
func (b B) GetID() any              { return b.ID }
func (b B) Metatype() Metatype      { return MetatypeEntiteit }
func (b *B) ClearID()               { b.ID = 0 }
func (b B) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b B) String() string          { return RepresentatieToString(b) }

// C
func (c C) GetID() any              { return c.ID }
func (c C) Metatype() Metatype      { return MetatypeEntiteit }
func (c *C) ClearID()               { c.ID = 0 }
func (c C) GetOpvoer() *time.Time   { return c.Opvoer }
func (c *C) SetOpvoer(t *time.Time) { c.Opvoer = t }
func (c C) GetAfvoer() *time.Time   { return c.Afvoer }
func (c *C) SetAfvoer(t *time.Time) { c.Afvoer = t }
func (c C) String() string          { return RepresentatieToString(c) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// A_U
func (au A_U) GetID() any              { return au.Rel_ID }
func (au A_U) Metatype() Metatype      { return MetatypeGegevenselement }
func (au *A_U) ClearID()               { au.Rel_ID = 0 }
func (au A_U) GetOpvoer() *time.Time   { return au.Opvoer }
func (au *A_U) SetOpvoer(t *time.Time) { au.Opvoer = t }
func (au A_U) GetAfvoer() *time.Time   { return au.Afvoer }
func (au *A_U) SetAfvoer(t *time.Time) { au.Afvoer = t }
func (au A_U) String() string          { return RepresentatieToString(au) }

// A_V
func (av A_V) GetID() any              { return av.Rel_ID }
func (av A_V) Metatype() Metatype      { return MetatypeGegevenselement }
func (av *A_V) ClearID()               { av.Rel_ID = 0 }
func (av A_V) GetOpvoer() *time.Time   { return av.Opvoer }
func (av *A_V) SetOpvoer(t *time.Time) { av.Opvoer = t }
func (av A_V) GetAfvoer() *time.Time   { return av.Afvoer }
func (av *A_V) SetAfvoer(t *time.Time) { av.Afvoer = t }
func (av A_V) String() string          { return RepresentatieToString(av) }

// A_W
func (aw A_W) GetID() any              { return aw.Rel_ID }
func (aw A_W) Metatype() Metatype      { return MetatypeGegevenselement }
func (aw *A_W) ClearID()               { aw.Rel_ID = 0 }
func (aw A_W) GetOpvoer() *time.Time   { return aw.Opvoer }
func (aw *A_W) SetOpvoer(t *time.Time) { aw.Opvoer = t }
func (aw A_W) GetAfvoer() *time.Time   { return aw.Afvoer }
func (aw *A_W) SetAfvoer(t *time.Time) { aw.Afvoer = t }
func (aw A_W) String() string          { return RepresentatieToString(aw) }

// Rel_A_B
func (r Rel_A_B) GetID() any              { return r.Rel_ID }
func (r Rel_A_B) Metatype() Metatype      { return MetatypeRelatie }
func (r *Rel_A_B) ClearID()               { r.Rel_ID = 0 }
func (r Rel_A_B) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Rel_A_B) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Rel_A_B) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Rel_A_B) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Rel_A_B) String() string          { return RepresentatieToString(r) }

// B_X
func (bx B_X) GetID() any              { return bx.Rel_ID }
func (bx B_X) Metatype() Metatype      { return MetatypeGegevenselement }
func (bx *B_X) ClearID()               { bx.Rel_ID = 0 }
func (bx B_X) GetOpvoer() *time.Time   { return bx.Opvoer }
func (bx *B_X) SetOpvoer(t *time.Time) { bx.Opvoer = t }
func (bx B_X) GetAfvoer() *time.Time   { return bx.Afvoer }
func (bx *B_X) SetAfvoer(t *time.Time) { bx.Afvoer = t }
func (bx B_X) String() string          { return RepresentatieToString(bx) }

// B_Y
func (by B_Y) GetID() any              { return by.Rel_ID }
func (by B_Y) Metatype() Metatype      { return MetatypeGegevenselement }
func (by *B_Y) ClearID()               { by.Rel_ID = 0 }
func (by B_Y) GetOpvoer() *time.Time   { return by.Opvoer }
func (by *B_Y) SetOpvoer(t *time.Time) { by.Opvoer = t }
func (by B_Y) GetAfvoer() *time.Time   { return by.Afvoer }
func (by *B_Y) SetAfvoer(t *time.Time) { by.Afvoer = t }
func (by B_Y) String() string          { return RepresentatieToString(by) }

// B_BC
func (b B_BC) GetID() any              { return b.Rel_ID }
func (b B_BC) Metatype() Metatype      { return MetatypeRelatie }
func (b *B_BC) ClearID()               { b.Rel_ID = 0 }
func (b B_BC) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B_BC) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B_BC) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B_BC) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b B_BC) String() string          { return RepresentatieToString(b) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// A_U_Data
func (d A_U_Data) GetID() any              { return d.Versie }
func (d A_U_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *A_U_Data) ClearID()               { d.Versie = 0 }
func (d A_U_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *A_U_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d A_U_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *A_U_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d A_U_Data) String() string          { return RepresentatieToString(d) }

// A_V_Data
func (d A_V_Data) GetID() any              { return d.Versie }
func (d A_V_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *A_V_Data) ClearID()               { d.Versie = 0 }
func (d A_V_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *A_V_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d A_V_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *A_V_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d A_V_Data) String() string          { return RepresentatieToString(d) }

// A_W_Data
func (d A_W_Data) GetID() any              { return d.Versie }
func (d A_W_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *A_W_Data) ClearID()               { d.Versie = 0 }
func (d A_W_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *A_W_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d A_W_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *A_W_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d A_W_Data) String() string          { return RepresentatieToString(d) }

// Rel_A_B_Data
func (d Rel_A_B_Data) GetID() any              { return d.Versie }
func (d Rel_A_B_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Rel_A_B_Data) ClearID()               { d.Versie = 0 }
func (d Rel_A_B_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Rel_A_B_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Rel_A_B_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Rel_A_B_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Rel_A_B_Data) String() string          { return RepresentatieToString(d) }

// B_X_Data
func (d B_X_Data) GetID() any              { return d.Versie }
func (d B_X_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *B_X_Data) ClearID()               { d.Versie = 0 }
func (d B_X_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *B_X_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d B_X_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *B_X_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d B_X_Data) String() string          { return RepresentatieToString(d) }

// B_Y_Data
func (d B_Y_Data) GetID() any              { return d.Versie }
func (d B_Y_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *B_Y_Data) ClearID()               { d.Versie = 0 }
func (d B_Y_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *B_Y_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d B_Y_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *B_Y_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d B_Y_Data) String() string          { return RepresentatieToString(d) }

// B_BC_Data
func (d B_BC_Data) GetID() any              { return d.Versie }
func (d B_BC_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *B_BC_Data) ClearID()               { d.Versie = 0 }
func (d B_BC_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *B_BC_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d B_BC_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *B_BC_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d B_BC_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

// A_Aanvang
func (a A_Aanvang) GetID() any              { return a.Versie }
func (a A_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_Aanvang) ClearID()               { a.Versie = 0 }
func (a A_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_Aanvang) String() string          { return RepresentatieToString(a) }

// A_Einde
func (a A_Einde) GetID() any              { return a.Versie }
func (a A_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_Einde) ClearID()               { a.Versie = 0 }
func (a A_Einde) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_Einde) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_Einde) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_Einde) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_Einde) String() string          { return RepresentatieToString(a) }

// B_Aanvang
func (b B_Aanvang) GetID() any              { return b.Versie }
func (b B_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (b *B_Aanvang) ClearID()               { b.Versie = 0 }
func (b B_Aanvang) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B_Aanvang) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B_Aanvang) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B_Aanvang) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b B_Aanvang) String() string          { return RepresentatieToString(b) }

// B_Einde
func (b B_Einde) GetID() any              { return b.Versie }
func (b B_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (b *B_Einde) ClearID()               { b.Versie = 0 }
func (b B_Einde) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B_Einde) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B_Einde) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B_Einde) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b B_Einde) String() string          { return RepresentatieToString(b) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

// A_W_Aanvang
func (a A_W_Aanvang) GetID() any              { return a.Versie }
func (a A_W_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_W_Aanvang) ClearID()               { a.Versie = 0 }
func (a A_W_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_W_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_W_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_W_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_W_Aanvang) String() string          { return RepresentatieToString(a) }

// A_W_Einde
func (a A_W_Einde) GetID() any              { return a.Versie }
func (a A_W_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_W_Einde) ClearID()               { a.Versie = 0 }
func (a A_W_Einde) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_W_Einde) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_W_Einde) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_W_Einde) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_W_Einde) String() string          { return RepresentatieToString(a) }

// Rel_A_B_Aanvang
func (r Rel_A_B_Aanvang) GetID() any              { return r.Versie }
func (r Rel_A_B_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *Rel_A_B_Aanvang) ClearID()               { r.Versie = 0 }
func (r Rel_A_B_Aanvang) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Rel_A_B_Aanvang) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Rel_A_B_Aanvang) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Rel_A_B_Aanvang) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Rel_A_B_Aanvang) String() string          { return RepresentatieToString(r) }

// Rel_A_B_Einde
func (r Rel_A_B_Einde) GetID() any              { return r.Versie }
func (r Rel_A_B_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *Rel_A_B_Einde) ClearID()               { r.Versie = 0 }
func (r Rel_A_B_Einde) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Rel_A_B_Einde) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Rel_A_B_Einde) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Rel_A_B_Einde) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Rel_A_B_Einde) String() string          { return RepresentatieToString(r) }

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// A_U_Input
func (i A_U_Input) GetID() any              { return i.Rel_ID }
func (i A_U_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *A_U_Input) ClearID()               { i.Rel_ID = 0 }
func (i A_U_Input) GetOpvoer() *time.Time   { return nil }
func (i *A_U_Input) SetOpvoer(t *time.Time) {}
func (i A_U_Input) GetAfvoer() *time.Time   { return nil }
func (i *A_U_Input) SetAfvoer(t *time.Time) {}
func (i A_U_Input) String() string          { return RepresentatieToString(i) }

// A_V_Input
func (i A_V_Input) GetID() any              { return i.Rel_ID }
func (i A_V_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *A_V_Input) ClearID()               { i.Rel_ID = 0 }
func (i A_V_Input) GetOpvoer() *time.Time   { return nil }
func (i *A_V_Input) SetOpvoer(t *time.Time) {}
func (i A_V_Input) GetAfvoer() *time.Time   { return nil }
func (i *A_V_Input) SetAfvoer(t *time.Time) {}
func (i A_V_Input) String() string          { return RepresentatieToString(i) }

// A_W_Input
func (i A_W_Input) GetID() any              { return i.Rel_ID }
func (i A_W_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *A_W_Input) ClearID()               { i.Rel_ID = 0 }
func (i A_W_Input) GetOpvoer() *time.Time   { return nil }
func (i *A_W_Input) SetOpvoer(t *time.Time) {}
func (i A_W_Input) GetAfvoer() *time.Time   { return nil }
func (i *A_W_Input) SetAfvoer(t *time.Time) {}
func (i A_W_Input) String() string          { return RepresentatieToString(i) }

// Rel_A_B_Input
func (i Rel_A_B_Input) GetID() any              { return i.Rel_ID }
func (i Rel_A_B_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *Rel_A_B_Input) ClearID()               { i.Rel_ID = 0 }
func (i Rel_A_B_Input) GetOpvoer() *time.Time   { return nil }
func (i *Rel_A_B_Input) SetOpvoer(t *time.Time) {}
func (i Rel_A_B_Input) GetAfvoer() *time.Time   { return nil }
func (i *Rel_A_B_Input) SetAfvoer(t *time.Time) {}
func (i Rel_A_B_Input) String() string          { return RepresentatieToString(i) }

// B_X_Input
func (i B_X_Input) GetID() any              { return i.Rel_ID }
func (i B_X_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *B_X_Input) ClearID()               { i.Rel_ID = 0 }
func (i B_X_Input) GetOpvoer() *time.Time   { return nil }
func (i *B_X_Input) SetOpvoer(t *time.Time) {}
func (i B_X_Input) GetAfvoer() *time.Time   { return nil }
func (i *B_X_Input) SetAfvoer(t *time.Time) {}
func (i B_X_Input) String() string          { return RepresentatieToString(i) }

// B_Y_Input
func (i B_Y_Input) GetID() any              { return i.Rel_ID }
func (i B_Y_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *B_Y_Input) ClearID()               { i.Rel_ID = 0 }
func (i B_Y_Input) GetOpvoer() *time.Time   { return nil }
func (i *B_Y_Input) SetOpvoer(t *time.Time) {}
func (i B_Y_Input) GetAfvoer() *time.Time   { return nil }
func (i *B_Y_Input) SetAfvoer(t *time.Time) {}
func (i B_Y_Input) String() string          { return RepresentatieToString(i) }

// B_BC_Input
func (i B_BC_Input) GetID() any              { return i.Rel_ID }
func (i B_BC_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *B_BC_Input) ClearID()               { i.Rel_ID = 0 }
func (i B_BC_Input) GetOpvoer() *time.Time   { return nil }
func (i *B_BC_Input) SetOpvoer(t *time.Time) {}
func (i B_BC_Input) GetAfvoer() *time.Time   { return nil }
func (i *B_BC_Input) SetAfvoer(t *time.Time) {}
func (i B_BC_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (a *A) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range a.Us {
		if a.Us[idx].A_ID == 0 {
			a.Us[idx].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_U", Representatie: &a.Us[idx]})
	}
	for idx := range a.Vs {
		if a.Vs[idx].A_ID == 0 {
			a.Vs[idx].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_V", Representatie: &a.Vs[idx]})
	}
	for idx := range a.Ws {
		if a.Ws[idx].A_ID == 0 {
			a.Ws[idx].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W", Representatie: &a.Ws[idx]})
	}
	for idx := range a.RelABs {
		if a.RelABs[idx].A_ID == 0 {
			a.RelABs[idx].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B", Representatie: &a.RelABs[idx]})
	}
	for idx := range a.Aanvang {
		if a.Aanvang[idx].A_ID == 0 {
			a.Aanvang[idx].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_Aanvang", Representatie: &a.Aanvang[idx]})
	}
	for idx := range a.Einde {
		if a.Einde[idx].A_ID == 0 {
			a.Einde[idx].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_Einde", Representatie: &a.Einde[idx]})
	}
	return result
}

func (b *B) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range b.Xs {
		if b.Xs[idx].B_ID == 0 {
			b.Xs[idx].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_X", Representatie: &b.Xs[idx]})
	}
	for idx := range b.Ys {
		if b.Ys[idx].B_ID == 0 {
			b.Ys[idx].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Y", Representatie: &b.Ys[idx]})
	}
	for idx := range b.Bc {
		if b.Bc[idx].B_ID == 0 {
			b.Bc[idx].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_BC", Representatie: &b.Bc[idx]})
	}
	for idx := range b.Aanvang {
		if b.Aanvang[idx].B_ID == 0 {
			b.Aanvang[idx].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Aanvang", Representatie: &b.Aanvang[idx]})
	}
	for idx := range b.Einde {
		if b.Einde[idx].B_ID == 0 {
			b.Einde[idx].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Einde", Representatie: &b.Einde[idx]})
	}
	return result
}

func (c *C) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *A_U) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].A_ID == 0 {
			h.Data[i].A_ID = h.A_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_U_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *A_V) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].A_ID == 0 {
			h.Data[i].A_ID = h.A_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_V_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *A_W) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].A_ID == 0 {
			h.Data[i].A_ID = h.A_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].A_ID == 0 {
			h.Aanvang[i].A_ID = h.A_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].A_ID == 0 {
			h.Einde[i].A_ID = h.A_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *Rel_A_B) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].A_ID == 0 {
			h.Data[i].A_ID = h.A_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].A_ID == 0 {
			h.Aanvang[i].A_ID = h.A_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].A_ID == 0 {
			h.Einde[i].A_ID = h.A_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *B_X) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].B_ID == 0 {
			h.Data[i].B_ID = h.B_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_X_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *B_Y) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].B_ID == 0 {
			h.Data[i].B_ID = h.B_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Y_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *B_BC) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].B_ID == 0 {
			h.Data[i].B_ID = h.B_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_BC_Data", Representatie: &h.Data[i]})
	}
	return result
}
