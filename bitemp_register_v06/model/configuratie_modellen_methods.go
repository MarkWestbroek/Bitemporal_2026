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

// WeergaveDefinitie
func (w WeergaveDefinitie) GetID() any              { return w.ID }
func (w WeergaveDefinitie) Metatype() Metatype      { return MetatypeEntiteit }
func (w *WeergaveDefinitie) ClearID()               { w.ID = 0 }
func (w WeergaveDefinitie) GetOpvoer() *time.Time   { return w.Opvoer }
func (w *WeergaveDefinitie) SetOpvoer(t *time.Time) { w.Opvoer = t }
func (w WeergaveDefinitie) GetAfvoer() *time.Time   { return w.Afvoer }
func (w *WeergaveDefinitie) SetAfvoer(t *time.Time) { w.Afvoer = t }
func (w WeergaveDefinitie) String() string          { return RepresentatieToString(w) }

// QueryDefinitie
func (q QueryDefinitie) GetID() any              { return q.ID }
func (q QueryDefinitie) Metatype() Metatype      { return MetatypeEntiteit }
func (q *QueryDefinitie) ClearID()               { q.ID = 0 }
func (q QueryDefinitie) GetOpvoer() *time.Time   { return q.Opvoer }
func (q *QueryDefinitie) SetOpvoer(t *time.Time) { q.Opvoer = t }
func (q QueryDefinitie) GetAfvoer() *time.Time   { return q.Afvoer }
func (q *QueryDefinitie) SetAfvoer(t *time.Time) { q.Afvoer = t }
func (q QueryDefinitie) String() string          { return RepresentatieToString(q) }

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

// WeergaveDefinitie_Meta
func (wm WeergaveDefinitie_Meta) GetID() any              { return wm.Rel_ID }
func (wm WeergaveDefinitie_Meta) Metatype() Metatype      { return MetatypeGegevenselement }
func (wm *WeergaveDefinitie_Meta) ClearID()               { wm.Rel_ID = 0 }
func (wm WeergaveDefinitie_Meta) GetOpvoer() *time.Time   { return wm.Opvoer }
func (wm *WeergaveDefinitie_Meta) SetOpvoer(t *time.Time) { wm.Opvoer = t }
func (wm WeergaveDefinitie_Meta) GetAfvoer() *time.Time   { return wm.Afvoer }
func (wm *WeergaveDefinitie_Meta) SetAfvoer(t *time.Time) { wm.Afvoer = t }
func (wm WeergaveDefinitie_Meta) String() string          { return RepresentatieToString(wm) }

// WeergaveDefinitie_TabelConfig
func (wt WeergaveDefinitie_TabelConfig) GetID() any              { return wt.Rel_ID }
func (wt WeergaveDefinitie_TabelConfig) Metatype() Metatype      { return MetatypeGegevenselement }
func (wt *WeergaveDefinitie_TabelConfig) ClearID()               { wt.Rel_ID = 0 }
func (wt WeergaveDefinitie_TabelConfig) GetOpvoer() *time.Time   { return wt.Opvoer }
func (wt *WeergaveDefinitie_TabelConfig) SetOpvoer(t *time.Time) { wt.Opvoer = t }
func (wt WeergaveDefinitie_TabelConfig) GetAfvoer() *time.Time   { return wt.Afvoer }
func (wt *WeergaveDefinitie_TabelConfig) SetAfvoer(t *time.Time) { wt.Afvoer = t }
func (wt WeergaveDefinitie_TabelConfig) String() string          { return RepresentatieToString(wt) }

// WeergaveDefinitie_DetailTemplate
func (wd WeergaveDefinitie_DetailTemplate) GetID() any              { return wd.Rel_ID }
func (wd WeergaveDefinitie_DetailTemplate) Metatype() Metatype      { return MetatypeGegevenselement }
func (wd *WeergaveDefinitie_DetailTemplate) ClearID()               { wd.Rel_ID = 0 }
func (wd WeergaveDefinitie_DetailTemplate) GetOpvoer() *time.Time   { return wd.Opvoer }
func (wd *WeergaveDefinitie_DetailTemplate) SetOpvoer(t *time.Time) { wd.Opvoer = t }
func (wd WeergaveDefinitie_DetailTemplate) GetAfvoer() *time.Time   { return wd.Afvoer }
func (wd *WeergaveDefinitie_DetailTemplate) SetAfvoer(t *time.Time) { wd.Afvoer = t }
func (wd WeergaveDefinitie_DetailTemplate) String() string          { return RepresentatieToString(wd) }

// QueryDefinitie_Meta
func (qm QueryDefinitie_Meta) GetID() any              { return qm.Rel_ID }
func (qm QueryDefinitie_Meta) Metatype() Metatype      { return MetatypeGegevenselement }
func (qm *QueryDefinitie_Meta) ClearID()               { qm.Rel_ID = 0 }
func (qm QueryDefinitie_Meta) GetOpvoer() *time.Time   { return qm.Opvoer }
func (qm *QueryDefinitie_Meta) SetOpvoer(t *time.Time) { qm.Opvoer = t }
func (qm QueryDefinitie_Meta) GetAfvoer() *time.Time   { return qm.Afvoer }
func (qm *QueryDefinitie_Meta) SetAfvoer(t *time.Time) { qm.Afvoer = t }
func (qm QueryDefinitie_Meta) String() string          { return RepresentatieToString(qm) }

// QueryDefinitie_Document
func (qd QueryDefinitie_Document) GetID() any              { return qd.Rel_ID }
func (qd QueryDefinitie_Document) Metatype() Metatype      { return MetatypeGegevenselement }
func (qd *QueryDefinitie_Document) ClearID()               { qd.Rel_ID = 0 }
func (qd QueryDefinitie_Document) GetOpvoer() *time.Time   { return qd.Opvoer }
func (qd *QueryDefinitie_Document) SetOpvoer(t *time.Time) { qd.Opvoer = t }
func (qd QueryDefinitie_Document) GetAfvoer() *time.Time   { return qd.Afvoer }
func (qd *QueryDefinitie_Document) SetAfvoer(t *time.Time) { qd.Afvoer = t }
func (qd QueryDefinitie_Document) String() string          { return RepresentatieToString(qd) }

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

// WeergaveDefinitie_Meta_Data
func (d WeergaveDefinitie_Meta_Data) GetID() any              { return d.Versie }
func (d WeergaveDefinitie_Meta_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *WeergaveDefinitie_Meta_Data) ClearID()               { d.Versie = 0 }
func (d WeergaveDefinitie_Meta_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *WeergaveDefinitie_Meta_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d WeergaveDefinitie_Meta_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *WeergaveDefinitie_Meta_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d WeergaveDefinitie_Meta_Data) String() string          { return RepresentatieToString(d) }

// WeergaveDefinitie_TabelConfig_Data
func (d WeergaveDefinitie_TabelConfig_Data) GetID() any              { return d.Versie }
func (d WeergaveDefinitie_TabelConfig_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *WeergaveDefinitie_TabelConfig_Data) ClearID()               { d.Versie = 0 }
func (d WeergaveDefinitie_TabelConfig_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *WeergaveDefinitie_TabelConfig_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d WeergaveDefinitie_TabelConfig_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *WeergaveDefinitie_TabelConfig_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d WeergaveDefinitie_TabelConfig_Data) String() string          { return RepresentatieToString(d) }

// WeergaveDefinitie_DetailTemplate_Data
func (d WeergaveDefinitie_DetailTemplate_Data) GetID() any              { return d.Versie }
func (d WeergaveDefinitie_DetailTemplate_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *WeergaveDefinitie_DetailTemplate_Data) ClearID()               { d.Versie = 0 }
func (d WeergaveDefinitie_DetailTemplate_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *WeergaveDefinitie_DetailTemplate_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d WeergaveDefinitie_DetailTemplate_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *WeergaveDefinitie_DetailTemplate_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d WeergaveDefinitie_DetailTemplate_Data) String() string          { return RepresentatieToString(d) }

// QueryDefinitie_Meta_Data
func (d QueryDefinitie_Meta_Data) GetID() any              { return d.Versie }
func (d QueryDefinitie_Meta_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *QueryDefinitie_Meta_Data) ClearID()               { d.Versie = 0 }
func (d QueryDefinitie_Meta_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *QueryDefinitie_Meta_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d QueryDefinitie_Meta_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *QueryDefinitie_Meta_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d QueryDefinitie_Meta_Data) String() string          { return RepresentatieToString(d) }

// QueryDefinitie_Document_Data
func (d QueryDefinitie_Document_Data) GetID() any              { return d.Versie }
func (d QueryDefinitie_Document_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *QueryDefinitie_Document_Data) ClearID()               { d.Versie = 0 }
func (d QueryDefinitie_Document_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *QueryDefinitie_Document_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d QueryDefinitie_Document_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *QueryDefinitie_Document_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d QueryDefinitie_Document_Data) String() string          { return RepresentatieToString(d) }

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

// WeergaveDefinitie_Aanvang
func (w WeergaveDefinitie_Aanvang) GetID() any              { return w.Versie }
func (w WeergaveDefinitie_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (w *WeergaveDefinitie_Aanvang) ClearID()               { w.Versie = 0 }
func (w WeergaveDefinitie_Aanvang) GetOpvoer() *time.Time   { return w.Opvoer }
func (w *WeergaveDefinitie_Aanvang) SetOpvoer(t *time.Time) { w.Opvoer = t }
func (w WeergaveDefinitie_Aanvang) GetAfvoer() *time.Time   { return w.Afvoer }
func (w *WeergaveDefinitie_Aanvang) SetAfvoer(t *time.Time) { w.Afvoer = t }
func (w WeergaveDefinitie_Aanvang) String() string          { return RepresentatieToString(w) }

// WeergaveDefinitie_Einde
func (w WeergaveDefinitie_Einde) GetID() any              { return w.Versie }
func (w WeergaveDefinitie_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (w *WeergaveDefinitie_Einde) ClearID()               { w.Versie = 0 }
func (w WeergaveDefinitie_Einde) GetOpvoer() *time.Time   { return w.Opvoer }
func (w *WeergaveDefinitie_Einde) SetOpvoer(t *time.Time) { w.Opvoer = t }
func (w WeergaveDefinitie_Einde) GetAfvoer() *time.Time   { return w.Afvoer }
func (w *WeergaveDefinitie_Einde) SetAfvoer(t *time.Time) { w.Afvoer = t }
func (w WeergaveDefinitie_Einde) String() string          { return RepresentatieToString(w) }

// QueryDefinitie_Aanvang
func (q QueryDefinitie_Aanvang) GetID() any              { return q.Versie }
func (q QueryDefinitie_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (q *QueryDefinitie_Aanvang) ClearID()               { q.Versie = 0 }
func (q QueryDefinitie_Aanvang) GetOpvoer() *time.Time   { return q.Opvoer }
func (q *QueryDefinitie_Aanvang) SetOpvoer(t *time.Time) { q.Opvoer = t }
func (q QueryDefinitie_Aanvang) GetAfvoer() *time.Time   { return q.Afvoer }
func (q *QueryDefinitie_Aanvang) SetAfvoer(t *time.Time) { q.Afvoer = t }
func (q QueryDefinitie_Aanvang) String() string          { return RepresentatieToString(q) }

// QueryDefinitie_Einde
func (q QueryDefinitie_Einde) GetID() any              { return q.Versie }
func (q QueryDefinitie_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (q *QueryDefinitie_Einde) ClearID()               { q.Versie = 0 }
func (q QueryDefinitie_Einde) GetOpvoer() *time.Time   { return q.Opvoer }
func (q *QueryDefinitie_Einde) SetOpvoer(t *time.Time) { q.Opvoer = t }
func (q QueryDefinitie_Einde) GetAfvoer() *time.Time   { return q.Afvoer }
func (q *QueryDefinitie_Einde) SetAfvoer(t *time.Time) { q.Afvoer = t }
func (q QueryDefinitie_Einde) String() string          { return RepresentatieToString(q) }

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

// WeergaveDefinitie_Meta_Input
func (i WeergaveDefinitie_Meta_Input) GetID() any              { return i.Rel_ID }
func (i WeergaveDefinitie_Meta_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *WeergaveDefinitie_Meta_Input) ClearID()               { i.Rel_ID = 0 }
func (i WeergaveDefinitie_Meta_Input) GetOpvoer() *time.Time   { return nil }
func (i *WeergaveDefinitie_Meta_Input) SetOpvoer(t *time.Time) {}
func (i WeergaveDefinitie_Meta_Input) GetAfvoer() *time.Time   { return nil }
func (i *WeergaveDefinitie_Meta_Input) SetAfvoer(t *time.Time) {}
func (i WeergaveDefinitie_Meta_Input) String() string          { return RepresentatieToString(i) }

// WeergaveDefinitie_TabelConfig_Input
func (i WeergaveDefinitie_TabelConfig_Input) GetID() any              { return i.Rel_ID }
func (i WeergaveDefinitie_TabelConfig_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *WeergaveDefinitie_TabelConfig_Input) ClearID()               { i.Rel_ID = 0 }
func (i WeergaveDefinitie_TabelConfig_Input) GetOpvoer() *time.Time   { return nil }
func (i *WeergaveDefinitie_TabelConfig_Input) SetOpvoer(t *time.Time) {}
func (i WeergaveDefinitie_TabelConfig_Input) GetAfvoer() *time.Time   { return nil }
func (i *WeergaveDefinitie_TabelConfig_Input) SetAfvoer(t *time.Time) {}
func (i WeergaveDefinitie_TabelConfig_Input) String() string          { return RepresentatieToString(i) }

// WeergaveDefinitie_DetailTemplate_Input
func (i WeergaveDefinitie_DetailTemplate_Input) GetID() any              { return i.Rel_ID }
func (i WeergaveDefinitie_DetailTemplate_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *WeergaveDefinitie_DetailTemplate_Input) ClearID()               { i.Rel_ID = 0 }
func (i WeergaveDefinitie_DetailTemplate_Input) GetOpvoer() *time.Time   { return nil }
func (i *WeergaveDefinitie_DetailTemplate_Input) SetOpvoer(t *time.Time) {}
func (i WeergaveDefinitie_DetailTemplate_Input) GetAfvoer() *time.Time   { return nil }
func (i *WeergaveDefinitie_DetailTemplate_Input) SetAfvoer(t *time.Time) {}
func (i WeergaveDefinitie_DetailTemplate_Input) String() string          { return RepresentatieToString(i) }

// QueryDefinitie_Meta_Input
func (i QueryDefinitie_Meta_Input) GetID() any              { return i.Rel_ID }
func (i QueryDefinitie_Meta_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *QueryDefinitie_Meta_Input) ClearID()               { i.Rel_ID = 0 }
func (i QueryDefinitie_Meta_Input) GetOpvoer() *time.Time   { return nil }
func (i *QueryDefinitie_Meta_Input) SetOpvoer(t *time.Time) {}
func (i QueryDefinitie_Meta_Input) GetAfvoer() *time.Time   { return nil }
func (i *QueryDefinitie_Meta_Input) SetAfvoer(t *time.Time) {}
func (i QueryDefinitie_Meta_Input) String() string          { return RepresentatieToString(i) }

// QueryDefinitie_Document_Input
func (i QueryDefinitie_Document_Input) GetID() any              { return i.Rel_ID }
func (i QueryDefinitie_Document_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *QueryDefinitie_Document_Input) ClearID()               { i.Rel_ID = 0 }
func (i QueryDefinitie_Document_Input) GetOpvoer() *time.Time   { return nil }
func (i *QueryDefinitie_Document_Input) SetOpvoer(t *time.Time) {}
func (i QueryDefinitie_Document_Input) GetAfvoer() *time.Time   { return nil }
func (i *QueryDefinitie_Document_Input) SetAfvoer(t *time.Time) {}
func (i QueryDefinitie_Document_Input) String() string          { return RepresentatieToString(i) }

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

func (w *WeergaveDefinitie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range w.WeergaveDefinitieMetas {
		if w.WeergaveDefinitieMetas[idx].WeergaveDefinitie_ID == 0 {
			w.WeergaveDefinitieMetas[idx].WeergaveDefinitie_ID = w.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "WeergaveDefinitie_Meta", Representatie: &w.WeergaveDefinitieMetas[idx]})
	}
	for idx := range w.WeergaveDefinitieTabelConfigs {
		if w.WeergaveDefinitieTabelConfigs[idx].WeergaveDefinitie_ID == 0 {
			w.WeergaveDefinitieTabelConfigs[idx].WeergaveDefinitie_ID = w.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "WeergaveDefinitie_TabelConfig", Representatie: &w.WeergaveDefinitieTabelConfigs[idx]})
	}
	for idx := range w.WeergaveDefinitieDetailTemplates {
		if w.WeergaveDefinitieDetailTemplates[idx].WeergaveDefinitie_ID == 0 {
			w.WeergaveDefinitieDetailTemplates[idx].WeergaveDefinitie_ID = w.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "WeergaveDefinitie_DetailTemplate", Representatie: &w.WeergaveDefinitieDetailTemplates[idx]})
	}
	for idx := range w.Aanvang {
		if w.Aanvang[idx].WeergaveDefinitie_ID == 0 {
			w.Aanvang[idx].WeergaveDefinitie_ID = w.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "WeergaveDefinitie_Aanvang", Representatie: &w.Aanvang[idx]})
	}
	for idx := range w.Einde {
		if w.Einde[idx].WeergaveDefinitie_ID == 0 {
			w.Einde[idx].WeergaveDefinitie_ID = w.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "WeergaveDefinitie_Einde", Representatie: &w.Einde[idx]})
	}
	return result
}

func (q *QueryDefinitie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range q.QueryDefinitieMetas {
		if q.QueryDefinitieMetas[idx].QueryDefinitie_ID == 0 {
			q.QueryDefinitieMetas[idx].QueryDefinitie_ID = q.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_Meta", Representatie: &q.QueryDefinitieMetas[idx]})
	}
	for idx := range q.QueryDefinitieDocuments {
		if q.QueryDefinitieDocuments[idx].QueryDefinitie_ID == 0 {
			q.QueryDefinitieDocuments[idx].QueryDefinitie_ID = q.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_Document", Representatie: &q.QueryDefinitieDocuments[idx]})
	}
	for idx := range q.Aanvang {
		if q.Aanvang[idx].QueryDefinitie_ID == 0 {
			q.Aanvang[idx].QueryDefinitie_ID = q.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_Aanvang", Representatie: &q.Aanvang[idx]})
	}
	for idx := range q.Einde {
		if q.Einde[idx].QueryDefinitie_ID == 0 {
			q.Einde[idx].QueryDefinitie_ID = q.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_Einde", Representatie: &q.Einde[idx]})
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

func (h *WeergaveDefinitie_Meta) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].WeergaveDefinitie_ID == 0 {
			h.Data[i].WeergaveDefinitie_ID = h.WeergaveDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "WeergaveDefinitie_Meta_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *WeergaveDefinitie_TabelConfig) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].WeergaveDefinitie_ID == 0 {
			h.Data[i].WeergaveDefinitie_ID = h.WeergaveDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "WeergaveDefinitie_TabelConfig_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *WeergaveDefinitie_DetailTemplate) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].WeergaveDefinitie_ID == 0 {
			h.Data[i].WeergaveDefinitie_ID = h.WeergaveDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "WeergaveDefinitie_DetailTemplate_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *QueryDefinitie_Meta) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].QueryDefinitie_ID == 0 {
			h.Data[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_Meta_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *QueryDefinitie_Document) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].QueryDefinitie_ID == 0 {
			h.Data[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_Document_Data", Representatie: &h.Data[i]})
	}
	return result
}
