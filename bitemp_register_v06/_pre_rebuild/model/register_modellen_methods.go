package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// Land
func (l Land) GetID() any              { return l.ID }
func (l Land) Metatype() Metatype      { return MetatypeEntiteit }
func (l *Land) ClearID()               { l.ID = 0 }
func (l Land) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *Land) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Land) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *Land) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Land) String() string          { return RepresentatieToString(l) }

// Referentielijst
func (r Referentielijst) GetID() any              { return r.ID }
func (r Referentielijst) Metatype() Metatype      { return MetatypeEntiteit }
func (r *Referentielijst) ClearID()               { r.ID = 0 }
func (r Referentielijst) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Referentielijst) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Referentielijst) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Referentielijst) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Referentielijst) String() string          { return RepresentatieToString(r) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// Landcode
func (ll Landcode) GetID() any              { return ll.Rel_ID }
func (ll Landcode) Metatype() Metatype      { return MetatypeGegevenselement }
func (ll *Landcode) ClearID()               { ll.Rel_ID = 0 }
func (ll Landcode) GetOpvoer() *time.Time   { return ll.Opvoer }
func (ll *Landcode) SetOpvoer(t *time.Time) { ll.Opvoer = t }
func (ll Landcode) GetAfvoer() *time.Time   { return ll.Afvoer }
func (ll *Landcode) SetAfvoer(t *time.Time) { ll.Afvoer = t }
func (ll Landcode) String() string          { return RepresentatieToString(ll) }

// Landnaam
func (ll Landnaam) GetID() any              { return ll.Rel_ID }
func (ll Landnaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (ll *Landnaam) ClearID()               { ll.Rel_ID = 0 }
func (ll Landnaam) GetOpvoer() *time.Time   { return ll.Opvoer }
func (ll *Landnaam) SetOpvoer(t *time.Time) { ll.Opvoer = t }
func (ll Landnaam) GetAfvoer() *time.Time   { return ll.Afvoer }
func (ll *Landnaam) SetAfvoer(t *time.Time) { ll.Afvoer = t }
func (ll Landnaam) String() string          { return RepresentatieToString(ll) }

// Referentielijstnaam
func (rr Referentielijstnaam) GetID() any              { return rr.Rel_ID }
func (rr Referentielijstnaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (rr *Referentielijstnaam) ClearID()               { rr.Rel_ID = 0 }
func (rr Referentielijstnaam) GetOpvoer() *time.Time   { return rr.Opvoer }
func (rr *Referentielijstnaam) SetOpvoer(t *time.Time) { rr.Opvoer = t }
func (rr Referentielijstnaam) GetAfvoer() *time.Time   { return rr.Afvoer }
func (rr *Referentielijstnaam) SetAfvoer(t *time.Time) { rr.Afvoer = t }
func (rr Referentielijstnaam) String() string          { return RepresentatieToString(rr) }

// Referentielijstomschrijving
func (rr Referentielijstomschrijving) GetID() any              { return rr.Rel_ID }
func (rr Referentielijstomschrijving) Metatype() Metatype      { return MetatypeGegevenselement }
func (rr *Referentielijstomschrijving) ClearID()               { rr.Rel_ID = 0 }
func (rr Referentielijstomschrijving) GetOpvoer() *time.Time   { return rr.Opvoer }
func (rr *Referentielijstomschrijving) SetOpvoer(t *time.Time) { rr.Opvoer = t }
func (rr Referentielijstomschrijving) GetAfvoer() *time.Time   { return rr.Afvoer }
func (rr *Referentielijstomschrijving) SetAfvoer(t *time.Time) { rr.Afvoer = t }
func (rr Referentielijstomschrijving) String() string          { return RepresentatieToString(rr) }

// ReferentielijstVisibility
func (rr ReferentielijstVisibility) GetID() any              { return rr.Rel_ID }
func (rr ReferentielijstVisibility) Metatype() Metatype      { return MetatypeGegevenselement }
func (rr *ReferentielijstVisibility) ClearID()               { rr.Rel_ID = 0 }
func (rr ReferentielijstVisibility) GetOpvoer() *time.Time   { return rr.Opvoer }
func (rr *ReferentielijstVisibility) SetOpvoer(t *time.Time) { rr.Opvoer = t }
func (rr ReferentielijstVisibility) GetAfvoer() *time.Time   { return rr.Afvoer }
func (rr *ReferentielijstVisibility) SetAfvoer(t *time.Time) { rr.Afvoer = t }
func (rr ReferentielijstVisibility) String() string          { return RepresentatieToString(rr) }

// ReferentielijstInternetadres
func (rr ReferentielijstInternetadres) GetID() any              { return rr.Rel_ID }
func (rr ReferentielijstInternetadres) Metatype() Metatype      { return MetatypeGegevenselement }
func (rr *ReferentielijstInternetadres) ClearID()               { rr.Rel_ID = 0 }
func (rr ReferentielijstInternetadres) GetOpvoer() *time.Time   { return rr.Opvoer }
func (rr *ReferentielijstInternetadres) SetOpvoer(t *time.Time) { rr.Opvoer = t }
func (rr ReferentielijstInternetadres) GetAfvoer() *time.Time   { return rr.Afvoer }
func (rr *ReferentielijstInternetadres) SetAfvoer(t *time.Time) { rr.Afvoer = t }
func (rr ReferentielijstInternetadres) String() string          { return RepresentatieToString(rr) }

// LandenlijstLand
func (l LandenlijstLand) GetID() any              { return l.Rel_ID }
func (l LandenlijstLand) Metatype() Metatype      { return MetatypeRelatie }
func (l *LandenlijstLand) ClearID()               { l.Rel_ID = 0 }
func (l LandenlijstLand) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *LandenlijstLand) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l LandenlijstLand) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *LandenlijstLand) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l LandenlijstLand) String() string          { return RepresentatieToString(l) }

// AdellijkeTitelsTitel
func (a AdellijkeTitelsTitel) GetID() any              { return a.Rel_ID }
func (a AdellijkeTitelsTitel) Metatype() Metatype      { return MetatypeRelatie }
func (a *AdellijkeTitelsTitel) ClearID()               { a.Rel_ID = 0 }
func (a AdellijkeTitelsTitel) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *AdellijkeTitelsTitel) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a AdellijkeTitelsTitel) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *AdellijkeTitelsTitel) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a AdellijkeTitelsTitel) String() string          { return RepresentatieToString(a) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// Landcode_Data
func (d Landcode_Data) GetID() any              { return d.Versie }
func (d Landcode_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Landcode_Data) ClearID()               { d.Versie = 0 }
func (d Landcode_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Landcode_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Landcode_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Landcode_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Landcode_Data) String() string          { return RepresentatieToString(d) }

// Landnaam_Data
func (d Landnaam_Data) GetID() any              { return d.Versie }
func (d Landnaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Landnaam_Data) ClearID()               { d.Versie = 0 }
func (d Landnaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Landnaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Landnaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Landnaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Landnaam_Data) String() string          { return RepresentatieToString(d) }

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

// LandenlijstLand_Data
func (d LandenlijstLand_Data) GetID() any              { return d.Versie }
func (d LandenlijstLand_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *LandenlijstLand_Data) ClearID()               { d.Versie = 0 }
func (d LandenlijstLand_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *LandenlijstLand_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d LandenlijstLand_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *LandenlijstLand_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d LandenlijstLand_Data) String() string          { return RepresentatieToString(d) }

// AdellijkeTitelsTitel_Data
func (d AdellijkeTitelsTitel_Data) GetID() any              { return d.Versie }
func (d AdellijkeTitelsTitel_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *AdellijkeTitelsTitel_Data) ClearID()               { d.Versie = 0 }
func (d AdellijkeTitelsTitel_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *AdellijkeTitelsTitel_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d AdellijkeTitelsTitel_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *AdellijkeTitelsTitel_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d AdellijkeTitelsTitel_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

// Land_Aanvang
func (l Land_Aanvang) GetID() any              { return l.Versie }
func (l Land_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (l *Land_Aanvang) ClearID()               { l.Versie = 0 }
func (l Land_Aanvang) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *Land_Aanvang) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Land_Aanvang) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *Land_Aanvang) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Land_Aanvang) String() string          { return RepresentatieToString(l) }

// Land_Einde
func (l Land_Einde) GetID() any              { return l.Versie }
func (l Land_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (l *Land_Einde) ClearID()               { l.Versie = 0 }
func (l Land_Einde) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *Land_Einde) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Land_Einde) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *Land_Einde) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Land_Einde) String() string          { return RepresentatieToString(l) }

// Referentielijst_Aanvang
func (r Referentielijst_Aanvang) GetID() any              { return r.Versie }
func (r Referentielijst_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *Referentielijst_Aanvang) ClearID()               { r.Versie = 0 }
func (r Referentielijst_Aanvang) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Referentielijst_Aanvang) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Referentielijst_Aanvang) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Referentielijst_Aanvang) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Referentielijst_Aanvang) String() string          { return RepresentatieToString(r) }

// Referentielijst_Einde
func (r Referentielijst_Einde) GetID() any              { return r.Versie }
func (r Referentielijst_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (r *Referentielijst_Einde) ClearID()               { r.Versie = 0 }
func (r Referentielijst_Einde) GetOpvoer() *time.Time   { return r.Opvoer }
func (r *Referentielijst_Einde) SetOpvoer(t *time.Time) { r.Opvoer = t }
func (r Referentielijst_Einde) GetAfvoer() *time.Time   { return r.Afvoer }
func (r *Referentielijst_Einde) SetAfvoer(t *time.Time) { r.Afvoer = t }
func (r Referentielijst_Einde) String() string          { return RepresentatieToString(r) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// Landcode_Input
func (i Landcode_Input) GetID() any              { return i.Rel_ID }
func (i Landcode_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Landcode_Input) ClearID()               { i.Rel_ID = 0 }
func (i Landcode_Input) GetOpvoer() *time.Time   { return nil }
func (i *Landcode_Input) SetOpvoer(t *time.Time) {}
func (i Landcode_Input) GetAfvoer() *time.Time   { return nil }
func (i *Landcode_Input) SetAfvoer(t *time.Time) {}
func (i Landcode_Input) String() string          { return RepresentatieToString(i) }

// Landnaam_Input
func (i Landnaam_Input) GetID() any              { return i.Rel_ID }
func (i Landnaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Landnaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i Landnaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *Landnaam_Input) SetOpvoer(t *time.Time) {}
func (i Landnaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *Landnaam_Input) SetAfvoer(t *time.Time) {}
func (i Landnaam_Input) String() string          { return RepresentatieToString(i) }

// Referentielijstnaam_Input
func (i Referentielijstnaam_Input) GetID() any              { return i.Rel_ID }
func (i Referentielijstnaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Referentielijstnaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i Referentielijstnaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *Referentielijstnaam_Input) SetOpvoer(t *time.Time) {}
func (i Referentielijstnaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *Referentielijstnaam_Input) SetAfvoer(t *time.Time) {}
func (i Referentielijstnaam_Input) String() string          { return RepresentatieToString(i) }

// Referentielijstomschrijving_Input
func (i Referentielijstomschrijving_Input) GetID() any              { return i.Rel_ID }
func (i Referentielijstomschrijving_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Referentielijstomschrijving_Input) ClearID()               { i.Rel_ID = 0 }
func (i Referentielijstomschrijving_Input) GetOpvoer() *time.Time   { return nil }
func (i *Referentielijstomschrijving_Input) SetOpvoer(t *time.Time) {}
func (i Referentielijstomschrijving_Input) GetAfvoer() *time.Time   { return nil }
func (i *Referentielijstomschrijving_Input) SetAfvoer(t *time.Time) {}
func (i Referentielijstomschrijving_Input) String() string          { return RepresentatieToString(i) }

// ReferentielijstVisibility_Input
func (i ReferentielijstVisibility_Input) GetID() any              { return i.Rel_ID }
func (i ReferentielijstVisibility_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *ReferentielijstVisibility_Input) ClearID()               { i.Rel_ID = 0 }
func (i ReferentielijstVisibility_Input) GetOpvoer() *time.Time   { return nil }
func (i *ReferentielijstVisibility_Input) SetOpvoer(t *time.Time) {}
func (i ReferentielijstVisibility_Input) GetAfvoer() *time.Time   { return nil }
func (i *ReferentielijstVisibility_Input) SetAfvoer(t *time.Time) {}
func (i ReferentielijstVisibility_Input) String() string          { return RepresentatieToString(i) }

// ReferentielijstInternetadres_Input
func (i ReferentielijstInternetadres_Input) GetID() any              { return i.Rel_ID }
func (i ReferentielijstInternetadres_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *ReferentielijstInternetadres_Input) ClearID()               { i.Rel_ID = 0 }
func (i ReferentielijstInternetadres_Input) GetOpvoer() *time.Time   { return nil }
func (i *ReferentielijstInternetadres_Input) SetOpvoer(t *time.Time) {}
func (i ReferentielijstInternetadres_Input) GetAfvoer() *time.Time   { return nil }
func (i *ReferentielijstInternetadres_Input) SetAfvoer(t *time.Time) {}
func (i ReferentielijstInternetadres_Input) String() string          { return RepresentatieToString(i) }

// LandenlijstLand_Input
func (i LandenlijstLand_Input) GetID() any              { return i.Rel_ID }
func (i LandenlijstLand_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *LandenlijstLand_Input) ClearID()               { i.Rel_ID = 0 }
func (i LandenlijstLand_Input) GetOpvoer() *time.Time   { return nil }
func (i *LandenlijstLand_Input) SetOpvoer(t *time.Time) {}
func (i LandenlijstLand_Input) GetAfvoer() *time.Time   { return nil }
func (i *LandenlijstLand_Input) SetAfvoer(t *time.Time) {}
func (i LandenlijstLand_Input) String() string          { return RepresentatieToString(i) }

// AdellijkeTitelsTitel_Input
func (i AdellijkeTitelsTitel_Input) GetID() any              { return i.Rel_ID }
func (i AdellijkeTitelsTitel_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *AdellijkeTitelsTitel_Input) ClearID()               { i.Rel_ID = 0 }
func (i AdellijkeTitelsTitel_Input) GetOpvoer() *time.Time   { return nil }
func (i *AdellijkeTitelsTitel_Input) SetOpvoer(t *time.Time) {}
func (i AdellijkeTitelsTitel_Input) GetAfvoer() *time.Time   { return nil }
func (i *AdellijkeTitelsTitel_Input) SetAfvoer(t *time.Time) {}
func (i AdellijkeTitelsTitel_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (l *Land) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range l.Landcodes {
		if l.Landcodes[i].Land_ID == 0 {
			l.Landcodes[i].Land_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Landcode", Representatie: &l.Landcodes[i]})
	}
	for i := range l.Landnamen {
		if l.Landnamen[i].Land_ID == 0 {
			l.Landnamen[i].Land_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Landnaam", Representatie: &l.Landnamen[i]})
	}
	for i := range l.Aanvang {
		if l.Aanvang[i].Land_ID == 0 {
			l.Aanvang[i].Land_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Land_Aanvang", Representatie: &l.Aanvang[i]})
	}
	for i := range l.Einde {
		if l.Einde[i].Land_ID == 0 {
			l.Einde[i].Land_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Land_Einde", Representatie: &l.Einde[i]})
	}
	return result
}

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
	for i := range r.AdellijkeTitelsTitels {
		if r.AdellijkeTitelsTitels[i].Referentielijst_ID == 0 {
			r.AdellijkeTitelsTitels[i].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "AdellijkeTitelsTitel", Representatie: &r.AdellijkeTitelsTitels[i]})
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
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *Landcode) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Land_ID == 0 {
			h.Data[i].Land_ID = h.Land_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Landcode_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Landnaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Land_ID == 0 {
			h.Data[i].Land_ID = h.Land_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Landnaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

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

func (h *LandenlijstLand) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "LandenlijstLand_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *AdellijkeTitelsTitel) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "AdellijkeTitelsTitel_Data", Representatie: &h.Data[i]})
	}
	return result
}
