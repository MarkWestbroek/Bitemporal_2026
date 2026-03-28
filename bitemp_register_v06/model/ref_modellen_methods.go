package model

// Interface-methoden voor referentielijst-structs (testmodel).

import "time"

/* ================================================================
   ENTITEITEN
   ================================================================ */

// Landenlijst
func (l Landenlijst) GetID() any              { return l.ID }
func (l Landenlijst) Metatype() Metatype      { return MetatypeEntiteit }
func (l *Landenlijst) ClearID()               { l.ID = 0 }
func (l Landenlijst) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *Landenlijst) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Landenlijst) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *Landenlijst) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Landenlijst) String() string          { return RepresentatieToString(l) }

// Land
func (l Land) GetID() any              { return l.ID }
func (l Land) Metatype() Metatype      { return MetatypeEntiteit }
func (l *Land) ClearID()               { l.ID = 0 }
func (l Land) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *Land) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Land) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *Land) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Land) String() string          { return RepresentatieToString(l) }

/* ================================================================
   HUBS (GE + REL)
   ================================================================ */

// Landcode
func (lc Landcode) GetID() any              { return lc.Rel_ID }
func (lc Landcode) Metatype() Metatype      { return MetatypeGegevenselement }
func (lc *Landcode) ClearID()               { lc.Rel_ID = 0 }
func (lc Landcode) GetOpvoer() *time.Time   { return lc.Opvoer }
func (lc *Landcode) SetOpvoer(t *time.Time) { lc.Opvoer = t }
func (lc Landcode) GetAfvoer() *time.Time   { return lc.Afvoer }
func (lc *Landcode) SetAfvoer(t *time.Time) { lc.Afvoer = t }
func (lc Landcode) String() string          { return RepresentatieToString(lc) }

// Landnaam
func (ln Landnaam) GetID() any              { return ln.Rel_ID }
func (ln Landnaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (ln *Landnaam) ClearID()               { ln.Rel_ID = 0 }
func (ln Landnaam) GetOpvoer() *time.Time   { return ln.Opvoer }
func (ln *Landnaam) SetOpvoer(t *time.Time) { ln.Opvoer = t }
func (ln Landnaam) GetAfvoer() *time.Time   { return ln.Afvoer }
func (ln *Landnaam) SetAfvoer(t *time.Time) { ln.Afvoer = t }
func (ln Landnaam) String() string          { return RepresentatieToString(ln) }

// Landenlijst_Land
func (ll Landenlijst_Land) GetID() any              { return ll.Rel_ID }
func (ll Landenlijst_Land) Metatype() Metatype      { return MetatypeRelatie }
func (ll *Landenlijst_Land) ClearID()               { ll.Rel_ID = 0 }
func (ll Landenlijst_Land) GetOpvoer() *time.Time   { return ll.Opvoer }
func (ll *Landenlijst_Land) SetOpvoer(t *time.Time) { ll.Opvoer = t }
func (ll Landenlijst_Land) GetAfvoer() *time.Time   { return ll.Afvoer }
func (ll *Landenlijst_Land) SetAfvoer(t *time.Time) { ll.Afvoer = t }
func (ll Landenlijst_Land) String() string          { return RepresentatieToString(ll) }

/* ================================================================
   DATA-STRUCTS
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

// Landenlijst_Land_Data
func (d Landenlijst_Land_Data) GetID() any              { return d.Versie }
func (d Landenlijst_Land_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Landenlijst_Land_Data) ClearID()               { d.Versie = 0 }
func (d Landenlijst_Land_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Landenlijst_Land_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Landenlijst_Land_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Landenlijst_Land_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Landenlijst_Land_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   AANVANG/EINDE (materiële plumbing)
   ================================================================ */

// Landenlijst_Aanvang
func (a Landenlijst_Aanvang) GetID() any              { return a.Versie }
func (a Landenlijst_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *Landenlijst_Aanvang) ClearID()               { a.Versie = 0 }
func (a Landenlijst_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Landenlijst_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Landenlijst_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Landenlijst_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a Landenlijst_Aanvang) String() string          { return RepresentatieToString(a) }

// Landenlijst_Einde
func (e Landenlijst_Einde) GetID() any              { return e.Versie }
func (e Landenlijst_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (e *Landenlijst_Einde) ClearID()               { e.Versie = 0 }
func (e Landenlijst_Einde) GetOpvoer() *time.Time   { return e.Opvoer }
func (e *Landenlijst_Einde) SetOpvoer(t *time.Time) { e.Opvoer = t }
func (e Landenlijst_Einde) GetAfvoer() *time.Time   { return e.Afvoer }
func (e *Landenlijst_Einde) SetAfvoer(t *time.Time) { e.Afvoer = t }
func (e Landenlijst_Einde) String() string          { return RepresentatieToString(e) }

// Land_Aanvang
func (a Land_Aanvang) GetID() any              { return a.Versie }
func (a Land_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *Land_Aanvang) ClearID()               { a.Versie = 0 }
func (a Land_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Land_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Land_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Land_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a Land_Aanvang) String() string          { return RepresentatieToString(a) }

// Land_Einde
func (e Land_Einde) GetID() any              { return e.Versie }
func (e Land_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (e *Land_Einde) ClearID()               { e.Versie = 0 }
func (e Land_Einde) GetOpvoer() *time.Time   { return e.Opvoer }
func (e *Land_Einde) SetOpvoer(t *time.Time) { e.Opvoer = t }
func (e Land_Einde) GetAfvoer() *time.Time   { return e.Afvoer }
func (e *Land_Einde) SetAfvoer(t *time.Time) { e.Afvoer = t }
func (e Land_Einde) String() string          { return RepresentatieToString(e) }

/* ================================================================
   INPUT-STRUCTS — geen interface, maar volledigheidshalve
   ================================================================ */

func (i Landcode_Input) GetID() any              { return i.Rel_ID }
func (i Landcode_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Landcode_Input) ClearID()               { i.Rel_ID = 0 }
func (i Landcode_Input) GetOpvoer() *time.Time   { return nil }
func (i *Landcode_Input) SetOpvoer(_ *time.Time) {}
func (i Landcode_Input) GetAfvoer() *time.Time   { return nil }
func (i *Landcode_Input) SetAfvoer(_ *time.Time) {}
func (i Landcode_Input) String() string          { return RepresentatieToString(i) }

func (i Landnaam_Input) GetID() any              { return i.Rel_ID }
func (i Landnaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Landnaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i Landnaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *Landnaam_Input) SetOpvoer(_ *time.Time) {}
func (i Landnaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *Landnaam_Input) SetAfvoer(_ *time.Time) {}
func (i Landnaam_Input) String() string          { return RepresentatieToString(i) }

func (i Landenlijst_Land_Input) GetID() any              { return i.Rel_ID }
func (i Landenlijst_Land_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *Landenlijst_Land_Input) ClearID()               { i.Rel_ID = 0 }
func (i Landenlijst_Land_Input) GetOpvoer() *time.Time   { return nil }
func (i *Landenlijst_Land_Input) SetOpvoer(_ *time.Time) {}
func (i Landenlijst_Land_Input) GetAfvoer() *time.Time   { return nil }
func (i *Landenlijst_Land_Input) SetAfvoer(_ *time.Time) {}
func (i Landenlijst_Land_Input) String() string          { return RepresentatieToString(i) }
