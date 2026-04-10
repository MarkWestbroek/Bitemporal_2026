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

// Land_Landcode
func (ll Land_Landcode) GetID() any              { return ll.Rel_ID }
func (ll Land_Landcode) Metatype() Metatype      { return MetatypeGegevenselement }
func (ll *Land_Landcode) ClearID()               { ll.Rel_ID = 0 }
func (ll Land_Landcode) GetOpvoer() *time.Time   { return ll.Opvoer }
func (ll *Land_Landcode) SetOpvoer(t *time.Time) { ll.Opvoer = t }
func (ll Land_Landcode) GetAfvoer() *time.Time   { return ll.Afvoer }
func (ll *Land_Landcode) SetAfvoer(t *time.Time) { ll.Afvoer = t }
func (ll Land_Landcode) String() string          { return RepresentatieToString(ll) }

// Land_Landnaam
func (ll Land_Landnaam) GetID() any              { return ll.Rel_ID }
func (ll Land_Landnaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (ll *Land_Landnaam) ClearID()               { ll.Rel_ID = 0 }
func (ll Land_Landnaam) GetOpvoer() *time.Time   { return ll.Opvoer }
func (ll *Land_Landnaam) SetOpvoer(t *time.Time) { ll.Opvoer = t }
func (ll Land_Landnaam) GetAfvoer() *time.Time   { return ll.Afvoer }
func (ll *Land_Landnaam) SetAfvoer(t *time.Time) { ll.Afvoer = t }
func (ll Land_Landnaam) String() string          { return RepresentatieToString(ll) }

// Referentielijst_Referentielijstnaam
func (rr Referentielijst_Referentielijstnaam) GetID() any              { return rr.Rel_ID }
func (rr Referentielijst_Referentielijstnaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (rr *Referentielijst_Referentielijstnaam) ClearID()               { rr.Rel_ID = 0 }
func (rr Referentielijst_Referentielijstnaam) GetOpvoer() *time.Time   { return rr.Opvoer }
func (rr *Referentielijst_Referentielijstnaam) SetOpvoer(t *time.Time) { rr.Opvoer = t }
func (rr Referentielijst_Referentielijstnaam) GetAfvoer() *time.Time   { return rr.Afvoer }
func (rr *Referentielijst_Referentielijstnaam) SetAfvoer(t *time.Time) { rr.Afvoer = t }
func (rr Referentielijst_Referentielijstnaam) String() string          { return RepresentatieToString(rr) }

// Referentielijst_Referentielijstomschrijving
func (rr Referentielijst_Referentielijstomschrijving) GetID() any { return rr.Rel_ID }
func (rr Referentielijst_Referentielijstomschrijving) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (rr *Referentielijst_Referentielijstomschrijving) ClearID()               { rr.Rel_ID = 0 }
func (rr Referentielijst_Referentielijstomschrijving) GetOpvoer() *time.Time   { return rr.Opvoer }
func (rr *Referentielijst_Referentielijstomschrijving) SetOpvoer(t *time.Time) { rr.Opvoer = t }
func (rr Referentielijst_Referentielijstomschrijving) GetAfvoer() *time.Time   { return rr.Afvoer }
func (rr *Referentielijst_Referentielijstomschrijving) SetAfvoer(t *time.Time) { rr.Afvoer = t }
func (rr Referentielijst_Referentielijstomschrijving) String() string {
	return RepresentatieToString(rr)
}

// Referentielijst_ReferentielijstVisibility
func (rr Referentielijst_ReferentielijstVisibility) GetID() any { return rr.Rel_ID }
func (rr Referentielijst_ReferentielijstVisibility) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (rr *Referentielijst_ReferentielijstVisibility) ClearID()               { rr.Rel_ID = 0 }
func (rr Referentielijst_ReferentielijstVisibility) GetOpvoer() *time.Time   { return rr.Opvoer }
func (rr *Referentielijst_ReferentielijstVisibility) SetOpvoer(t *time.Time) { rr.Opvoer = t }
func (rr Referentielijst_ReferentielijstVisibility) GetAfvoer() *time.Time   { return rr.Afvoer }
func (rr *Referentielijst_ReferentielijstVisibility) SetAfvoer(t *time.Time) { rr.Afvoer = t }
func (rr Referentielijst_ReferentielijstVisibility) String() string          { return RepresentatieToString(rr) }

// Referentielijst_ReferentielijstInternetadres
func (rr Referentielijst_ReferentielijstInternetadres) GetID() any { return rr.Rel_ID }
func (rr Referentielijst_ReferentielijstInternetadres) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (rr *Referentielijst_ReferentielijstInternetadres) ClearID()               { rr.Rel_ID = 0 }
func (rr Referentielijst_ReferentielijstInternetadres) GetOpvoer() *time.Time   { return rr.Opvoer }
func (rr *Referentielijst_ReferentielijstInternetadres) SetOpvoer(t *time.Time) { rr.Opvoer = t }
func (rr Referentielijst_ReferentielijstInternetadres) GetAfvoer() *time.Time   { return rr.Afvoer }
func (rr *Referentielijst_ReferentielijstInternetadres) SetAfvoer(t *time.Time) { rr.Afvoer = t }
func (rr Referentielijst_ReferentielijstInternetadres) String() string {
	return RepresentatieToString(rr)
}

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

// Land_Landcode_Data
func (d Land_Landcode_Data) GetID() any              { return d.Versie }
func (d Land_Landcode_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Land_Landcode_Data) ClearID()               { d.Versie = 0 }
func (d Land_Landcode_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Land_Landcode_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Land_Landcode_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Land_Landcode_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Land_Landcode_Data) String() string          { return RepresentatieToString(d) }

// Land_Landnaam_Data
func (d Land_Landnaam_Data) GetID() any              { return d.Versie }
func (d Land_Landnaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Land_Landnaam_Data) ClearID()               { d.Versie = 0 }
func (d Land_Landnaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Land_Landnaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Land_Landnaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Land_Landnaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Land_Landnaam_Data) String() string          { return RepresentatieToString(d) }

// Referentielijst_Referentielijstnaam_Data
func (d Referentielijst_Referentielijstnaam_Data) GetID() any              { return d.Versie }
func (d Referentielijst_Referentielijstnaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Referentielijst_Referentielijstnaam_Data) ClearID()               { d.Versie = 0 }
func (d Referentielijst_Referentielijstnaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Referentielijst_Referentielijstnaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Referentielijst_Referentielijstnaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Referentielijst_Referentielijstnaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Referentielijst_Referentielijstnaam_Data) String() string          { return RepresentatieToString(d) }

// Referentielijst_Referentielijstomschrijving_Data
func (d Referentielijst_Referentielijstomschrijving_Data) GetID() any { return d.Versie }
func (d Referentielijst_Referentielijstomschrijving_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *Referentielijst_Referentielijstomschrijving_Data) ClearID()               { d.Versie = 0 }
func (d Referentielijst_Referentielijstomschrijving_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Referentielijst_Referentielijstomschrijving_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Referentielijst_Referentielijstomschrijving_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Referentielijst_Referentielijstomschrijving_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Referentielijst_Referentielijstomschrijving_Data) String() string {
	return RepresentatieToString(d)
}

// Referentielijst_ReferentielijstVisibility_Data
func (d Referentielijst_ReferentielijstVisibility_Data) GetID() any { return d.Versie }
func (d Referentielijst_ReferentielijstVisibility_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *Referentielijst_ReferentielijstVisibility_Data) ClearID()               { d.Versie = 0 }
func (d Referentielijst_ReferentielijstVisibility_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Referentielijst_ReferentielijstVisibility_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Referentielijst_ReferentielijstVisibility_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Referentielijst_ReferentielijstVisibility_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Referentielijst_ReferentielijstVisibility_Data) String() string {
	return RepresentatieToString(d)
}

// Referentielijst_ReferentielijstInternetadres_Data
func (d Referentielijst_ReferentielijstInternetadres_Data) GetID() any { return d.Versie }
func (d Referentielijst_ReferentielijstInternetadres_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *Referentielijst_ReferentielijstInternetadres_Data) ClearID()               { d.Versie = 0 }
func (d Referentielijst_ReferentielijstInternetadres_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Referentielijst_ReferentielijstInternetadres_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Referentielijst_ReferentielijstInternetadres_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Referentielijst_ReferentielijstInternetadres_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Referentielijst_ReferentielijstInternetadres_Data) String() string {
	return RepresentatieToString(d)
}

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

// Land_Landcode_Input
func (i Land_Landcode_Input) GetID() any              { return i.Rel_ID }
func (i Land_Landcode_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Land_Landcode_Input) ClearID()               { i.Rel_ID = 0 }
func (i Land_Landcode_Input) GetOpvoer() *time.Time   { return nil }
func (i *Land_Landcode_Input) SetOpvoer(t *time.Time) {}
func (i Land_Landcode_Input) GetAfvoer() *time.Time   { return nil }
func (i *Land_Landcode_Input) SetAfvoer(t *time.Time) {}
func (i Land_Landcode_Input) String() string          { return RepresentatieToString(i) }

// Land_Landnaam_Input
func (i Land_Landnaam_Input) GetID() any              { return i.Rel_ID }
func (i Land_Landnaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Land_Landnaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i Land_Landnaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *Land_Landnaam_Input) SetOpvoer(t *time.Time) {}
func (i Land_Landnaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *Land_Landnaam_Input) SetAfvoer(t *time.Time) {}
func (i Land_Landnaam_Input) String() string          { return RepresentatieToString(i) }

// Referentielijst_Referentielijstnaam_Input
func (i Referentielijst_Referentielijstnaam_Input) GetID() any { return i.Rel_ID }
func (i Referentielijst_Referentielijstnaam_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *Referentielijst_Referentielijstnaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i Referentielijst_Referentielijstnaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *Referentielijst_Referentielijstnaam_Input) SetOpvoer(t *time.Time) {}
func (i Referentielijst_Referentielijstnaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *Referentielijst_Referentielijstnaam_Input) SetAfvoer(t *time.Time) {}
func (i Referentielijst_Referentielijstnaam_Input) String() string          { return RepresentatieToString(i) }

// Referentielijst_Referentielijstomschrijving_Input
func (i Referentielijst_Referentielijstomschrijving_Input) GetID() any { return i.Rel_ID }
func (i Referentielijst_Referentielijstomschrijving_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *Referentielijst_Referentielijstomschrijving_Input) ClearID()               { i.Rel_ID = 0 }
func (i Referentielijst_Referentielijstomschrijving_Input) GetOpvoer() *time.Time   { return nil }
func (i *Referentielijst_Referentielijstomschrijving_Input) SetOpvoer(t *time.Time) {}
func (i Referentielijst_Referentielijstomschrijving_Input) GetAfvoer() *time.Time   { return nil }
func (i *Referentielijst_Referentielijstomschrijving_Input) SetAfvoer(t *time.Time) {}
func (i Referentielijst_Referentielijstomschrijving_Input) String() string {
	return RepresentatieToString(i)
}

// Referentielijst_ReferentielijstVisibility_Input
func (i Referentielijst_ReferentielijstVisibility_Input) GetID() any { return i.Rel_ID }
func (i Referentielijst_ReferentielijstVisibility_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *Referentielijst_ReferentielijstVisibility_Input) ClearID()               { i.Rel_ID = 0 }
func (i Referentielijst_ReferentielijstVisibility_Input) GetOpvoer() *time.Time   { return nil }
func (i *Referentielijst_ReferentielijstVisibility_Input) SetOpvoer(t *time.Time) {}
func (i Referentielijst_ReferentielijstVisibility_Input) GetAfvoer() *time.Time   { return nil }
func (i *Referentielijst_ReferentielijstVisibility_Input) SetAfvoer(t *time.Time) {}
func (i Referentielijst_ReferentielijstVisibility_Input) String() string {
	return RepresentatieToString(i)
}

// Referentielijst_ReferentielijstInternetadres_Input
func (i Referentielijst_ReferentielijstInternetadres_Input) GetID() any { return i.Rel_ID }
func (i Referentielijst_ReferentielijstInternetadres_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *Referentielijst_ReferentielijstInternetadres_Input) ClearID()               { i.Rel_ID = 0 }
func (i Referentielijst_ReferentielijstInternetadres_Input) GetOpvoer() *time.Time   { return nil }
func (i *Referentielijst_ReferentielijstInternetadres_Input) SetOpvoer(t *time.Time) {}
func (i Referentielijst_ReferentielijstInternetadres_Input) GetAfvoer() *time.Time   { return nil }
func (i *Referentielijst_ReferentielijstInternetadres_Input) SetAfvoer(t *time.Time) {}
func (i Referentielijst_ReferentielijstInternetadres_Input) String() string {
	return RepresentatieToString(i)
}

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
	for idx := range l.Landcodes {
		if l.Landcodes[idx].Land_ID == 0 {
			l.Landcodes[idx].Land_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Land_Landcode", Representatie: &l.Landcodes[idx]})
	}
	for idx := range l.Landnamen {
		if l.Landnamen[idx].Land_ID == 0 {
			l.Landnamen[idx].Land_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Land_Landnaam", Representatie: &l.Landnamen[idx]})
	}
	for idx := range l.Aanvang {
		if l.Aanvang[idx].Land_ID == 0 {
			l.Aanvang[idx].Land_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Land_Aanvang", Representatie: &l.Aanvang[idx]})
	}
	for idx := range l.Einde {
		if l.Einde[idx].Land_ID == 0 {
			l.Einde[idx].Land_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Land_Einde", Representatie: &l.Einde[idx]})
	}
	return result
}

func (r *Referentielijst) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range r.Referentielijstnamen {
		if r.Referentielijstnamen[idx].Referentielijst_ID == 0 {
			r.Referentielijstnamen[idx].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_Referentielijstnaam", Representatie: &r.Referentielijstnamen[idx]})
	}
	for idx := range r.Referentielijstomschrijvingen {
		if r.Referentielijstomschrijvingen[idx].Referentielijst_ID == 0 {
			r.Referentielijstomschrijvingen[idx].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_Referentielijstomschrijving", Representatie: &r.Referentielijstomschrijvingen[idx]})
	}
	for idx := range r.Visibilities {
		if r.Visibilities[idx].Referentielijst_ID == 0 {
			r.Visibilities[idx].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_ReferentielijstVisibility", Representatie: &r.Visibilities[idx]})
	}
	for idx := range r.Internetadressen {
		if r.Internetadressen[idx].Referentielijst_ID == 0 {
			r.Internetadressen[idx].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_ReferentielijstInternetadres", Representatie: &r.Internetadressen[idx]})
	}
	for idx := range r.LandenlijstLanden {
		if r.LandenlijstLanden[idx].Referentielijst_ID == 0 {
			r.LandenlijstLanden[idx].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "LandenlijstLand", Representatie: &r.LandenlijstLanden[idx]})
	}
	for idx := range r.AdellijkeTitelsTitels {
		if r.AdellijkeTitelsTitels[idx].Referentielijst_ID == 0 {
			r.AdellijkeTitelsTitels[idx].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "AdellijkeTitelsTitel", Representatie: &r.AdellijkeTitelsTitels[idx]})
	}
	for idx := range r.Aanvang {
		if r.Aanvang[idx].Referentielijst_ID == 0 {
			r.Aanvang[idx].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_Aanvang", Representatie: &r.Aanvang[idx]})
	}
	for idx := range r.Einde {
		if r.Einde[idx].Referentielijst_ID == 0 {
			r.Einde[idx].Referentielijst_ID = r.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_Einde", Representatie: &r.Einde[idx]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *Land_Landcode) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Land_ID == 0 {
			h.Data[i].Land_ID = h.Land_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Land_Landcode_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Land_Landnaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Land_ID == 0 {
			h.Data[i].Land_ID = h.Land_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Land_Landnaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Referentielijst_Referentielijstnaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_Referentielijstnaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Referentielijst_Referentielijstomschrijving) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_Referentielijstomschrijving_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Referentielijst_ReferentielijstVisibility) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_ReferentielijstVisibility_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Referentielijst_ReferentielijstInternetadres) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Referentielijst_ID == 0 {
			h.Data[i].Referentielijst_ID = h.Referentielijst_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Referentielijst_ReferentielijstInternetadres_Data", Representatie: &h.Data[i]})
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
