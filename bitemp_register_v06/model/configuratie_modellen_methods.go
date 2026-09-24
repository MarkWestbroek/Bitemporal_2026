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

// NotificatieDefinitie
func (n NotificatieDefinitie) GetID() any              { return n.ID }
func (n NotificatieDefinitie) Metatype() Metatype      { return MetatypeEntiteit }
func (n *NotificatieDefinitie) ClearID()               { n.ID = 0 }
func (n NotificatieDefinitie) GetOpvoer() *time.Time   { return n.Opvoer }
func (n *NotificatieDefinitie) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NotificatieDefinitie) GetAfvoer() *time.Time   { return n.Afvoer }
func (n *NotificatieDefinitie) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NotificatieDefinitie) String() string          { return RepresentatieToString(n) }

// DashboardDefinitie
func (d DashboardDefinitie) GetID() any              { return d.ID }
func (d DashboardDefinitie) Metatype() Metatype      { return MetatypeEntiteit }
func (d *DashboardDefinitie) ClearID()               { d.ID = 0 }
func (d DashboardDefinitie) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie) String() string          { return RepresentatieToString(d) }

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

// QueryDefinitie_QuerydefinitieNaam
func (qq QueryDefinitie_QuerydefinitieNaam) GetID() any              { return qq.Rel_ID }
func (qq QueryDefinitie_QuerydefinitieNaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (qq *QueryDefinitie_QuerydefinitieNaam) ClearID()               { qq.Rel_ID = 0 }
func (qq QueryDefinitie_QuerydefinitieNaam) GetOpvoer() *time.Time   { return qq.Opvoer }
func (qq *QueryDefinitie_QuerydefinitieNaam) SetOpvoer(t *time.Time) { qq.Opvoer = t }
func (qq QueryDefinitie_QuerydefinitieNaam) GetAfvoer() *time.Time   { return qq.Afvoer }
func (qq *QueryDefinitie_QuerydefinitieNaam) SetAfvoer(t *time.Time) { qq.Afvoer = t }
func (qq QueryDefinitie_QuerydefinitieNaam) String() string          { return RepresentatieToString(qq) }

// QueryDefinitie_QuerydefinitieBeschrijving
func (qq QueryDefinitie_QuerydefinitieBeschrijving) GetID() any { return qq.Rel_ID }
func (qq QueryDefinitie_QuerydefinitieBeschrijving) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (qq *QueryDefinitie_QuerydefinitieBeschrijving) ClearID()               { qq.Rel_ID = 0 }
func (qq QueryDefinitie_QuerydefinitieBeschrijving) GetOpvoer() *time.Time   { return qq.Opvoer }
func (qq *QueryDefinitie_QuerydefinitieBeschrijving) SetOpvoer(t *time.Time) { qq.Opvoer = t }
func (qq QueryDefinitie_QuerydefinitieBeschrijving) GetAfvoer() *time.Time   { return qq.Afvoer }
func (qq *QueryDefinitie_QuerydefinitieBeschrijving) SetAfvoer(t *time.Time) { qq.Afvoer = t }
func (qq QueryDefinitie_QuerydefinitieBeschrijving) String() string          { return RepresentatieToString(qq) }

// QueryDefinitie_QuerydefinitieStatus
func (qq QueryDefinitie_QuerydefinitieStatus) GetID() any              { return qq.Rel_ID }
func (qq QueryDefinitie_QuerydefinitieStatus) Metatype() Metatype      { return MetatypeGegevenselement }
func (qq *QueryDefinitie_QuerydefinitieStatus) ClearID()               { qq.Rel_ID = 0 }
func (qq QueryDefinitie_QuerydefinitieStatus) GetOpvoer() *time.Time   { return qq.Opvoer }
func (qq *QueryDefinitie_QuerydefinitieStatus) SetOpvoer(t *time.Time) { qq.Opvoer = t }
func (qq QueryDefinitie_QuerydefinitieStatus) GetAfvoer() *time.Time   { return qq.Afvoer }
func (qq *QueryDefinitie_QuerydefinitieStatus) SetAfvoer(t *time.Time) { qq.Afvoer = t }
func (qq QueryDefinitie_QuerydefinitieStatus) String() string          { return RepresentatieToString(qq) }

// QueryDefinitie_QuerydefinitieToegankelijkheid
func (qq QueryDefinitie_QuerydefinitieToegankelijkheid) GetID() any { return qq.Rel_ID }
func (qq QueryDefinitie_QuerydefinitieToegankelijkheid) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (qq *QueryDefinitie_QuerydefinitieToegankelijkheid) ClearID()               { qq.Rel_ID = 0 }
func (qq QueryDefinitie_QuerydefinitieToegankelijkheid) GetOpvoer() *time.Time   { return qq.Opvoer }
func (qq *QueryDefinitie_QuerydefinitieToegankelijkheid) SetOpvoer(t *time.Time) { qq.Opvoer = t }
func (qq QueryDefinitie_QuerydefinitieToegankelijkheid) GetAfvoer() *time.Time   { return qq.Afvoer }
func (qq *QueryDefinitie_QuerydefinitieToegankelijkheid) SetAfvoer(t *time.Time) { qq.Afvoer = t }
func (qq QueryDefinitie_QuerydefinitieToegankelijkheid) String() string {
	return RepresentatieToString(qq)
}

// QueryDefinitie_QuerydefinitieDocument
func (qq QueryDefinitie_QuerydefinitieDocument) GetID() any              { return qq.Rel_ID }
func (qq QueryDefinitie_QuerydefinitieDocument) Metatype() Metatype      { return MetatypeGegevenselement }
func (qq *QueryDefinitie_QuerydefinitieDocument) ClearID()               { qq.Rel_ID = 0 }
func (qq QueryDefinitie_QuerydefinitieDocument) GetOpvoer() *time.Time   { return qq.Opvoer }
func (qq *QueryDefinitie_QuerydefinitieDocument) SetOpvoer(t *time.Time) { qq.Opvoer = t }
func (qq QueryDefinitie_QuerydefinitieDocument) GetAfvoer() *time.Time   { return qq.Afvoer }
func (qq *QueryDefinitie_QuerydefinitieDocument) SetAfvoer(t *time.Time) { qq.Afvoer = t }
func (qq QueryDefinitie_QuerydefinitieDocument) String() string          { return RepresentatieToString(qq) }

// NotificatieDefinitie_NotificatiedefinitieNaam
func (nn NotificatieDefinitie_NotificatiedefinitieNaam) GetID() any { return nn.Rel_ID }
func (nn NotificatieDefinitie_NotificatiedefinitieNaam) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (nn *NotificatieDefinitie_NotificatiedefinitieNaam) ClearID()               { nn.Rel_ID = 0 }
func (nn NotificatieDefinitie_NotificatiedefinitieNaam) GetOpvoer() *time.Time   { return nn.Opvoer }
func (nn *NotificatieDefinitie_NotificatiedefinitieNaam) SetOpvoer(t *time.Time) { nn.Opvoer = t }
func (nn NotificatieDefinitie_NotificatiedefinitieNaam) GetAfvoer() *time.Time   { return nn.Afvoer }
func (nn *NotificatieDefinitie_NotificatiedefinitieNaam) SetAfvoer(t *time.Time) { nn.Afvoer = t }
func (nn NotificatieDefinitie_NotificatiedefinitieNaam) String() string {
	return RepresentatieToString(nn)
}

// NotificatieDefinitie_NotificatiedefinitieGebeurtenis
func (nn NotificatieDefinitie_NotificatiedefinitieGebeurtenis) GetID() any { return nn.Rel_ID }
func (nn NotificatieDefinitie_NotificatiedefinitieGebeurtenis) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (nn *NotificatieDefinitie_NotificatiedefinitieGebeurtenis) ClearID() { nn.Rel_ID = 0 }
func (nn NotificatieDefinitie_NotificatiedefinitieGebeurtenis) GetOpvoer() *time.Time {
	return nn.Opvoer
}
func (nn *NotificatieDefinitie_NotificatiedefinitieGebeurtenis) SetOpvoer(t *time.Time) {
	nn.Opvoer = t
}
func (nn NotificatieDefinitie_NotificatiedefinitieGebeurtenis) GetAfvoer() *time.Time {
	return nn.Afvoer
}
func (nn *NotificatieDefinitie_NotificatiedefinitieGebeurtenis) SetAfvoer(t *time.Time) {
	nn.Afvoer = t
}
func (nn NotificatieDefinitie_NotificatiedefinitieGebeurtenis) String() string {
	return RepresentatieToString(nn)
}

// NotificatieDefinitie_NotificatiedefinitieAbonnee
func (nn NotificatieDefinitie_NotificatiedefinitieAbonnee) GetID() any { return nn.Rel_ID }
func (nn NotificatieDefinitie_NotificatiedefinitieAbonnee) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (nn *NotificatieDefinitie_NotificatiedefinitieAbonnee) ClearID()               { nn.Rel_ID = 0 }
func (nn NotificatieDefinitie_NotificatiedefinitieAbonnee) GetOpvoer() *time.Time   { return nn.Opvoer }
func (nn *NotificatieDefinitie_NotificatiedefinitieAbonnee) SetOpvoer(t *time.Time) { nn.Opvoer = t }
func (nn NotificatieDefinitie_NotificatiedefinitieAbonnee) GetAfvoer() *time.Time   { return nn.Afvoer }
func (nn *NotificatieDefinitie_NotificatiedefinitieAbonnee) SetAfvoer(t *time.Time) { nn.Afvoer = t }
func (nn NotificatieDefinitie_NotificatiedefinitieAbonnee) String() string {
	return RepresentatieToString(nn)
}

// NotificatieDefinitie_NotificatiedefinitieInhoud
func (nn NotificatieDefinitie_NotificatiedefinitieInhoud) GetID() any { return nn.Rel_ID }
func (nn NotificatieDefinitie_NotificatiedefinitieInhoud) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (nn *NotificatieDefinitie_NotificatiedefinitieInhoud) ClearID()               { nn.Rel_ID = 0 }
func (nn NotificatieDefinitie_NotificatiedefinitieInhoud) GetOpvoer() *time.Time   { return nn.Opvoer }
func (nn *NotificatieDefinitie_NotificatiedefinitieInhoud) SetOpvoer(t *time.Time) { nn.Opvoer = t }
func (nn NotificatieDefinitie_NotificatiedefinitieInhoud) GetAfvoer() *time.Time   { return nn.Afvoer }
func (nn *NotificatieDefinitie_NotificatiedefinitieInhoud) SetAfvoer(t *time.Time) { nn.Afvoer = t }
func (nn NotificatieDefinitie_NotificatiedefinitieInhoud) String() string {
	return RepresentatieToString(nn)
}

// NotificatieDefinitie_NotificatiedefinitieStatus
func (nn NotificatieDefinitie_NotificatiedefinitieStatus) GetID() any { return nn.Rel_ID }
func (nn NotificatieDefinitie_NotificatiedefinitieStatus) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (nn *NotificatieDefinitie_NotificatiedefinitieStatus) ClearID()               { nn.Rel_ID = 0 }
func (nn NotificatieDefinitie_NotificatiedefinitieStatus) GetOpvoer() *time.Time   { return nn.Opvoer }
func (nn *NotificatieDefinitie_NotificatiedefinitieStatus) SetOpvoer(t *time.Time) { nn.Opvoer = t }
func (nn NotificatieDefinitie_NotificatiedefinitieStatus) GetAfvoer() *time.Time   { return nn.Afvoer }
func (nn *NotificatieDefinitie_NotificatiedefinitieStatus) SetAfvoer(t *time.Time) { nn.Afvoer = t }
func (nn NotificatieDefinitie_NotificatiedefinitieStatus) String() string {
	return RepresentatieToString(nn)
}

// DashboardDefinitie_DashboarddefinitieNaam
func (dd DashboardDefinitie_DashboarddefinitieNaam) GetID() any { return dd.Rel_ID }
func (dd DashboardDefinitie_DashboarddefinitieNaam) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (dd *DashboardDefinitie_DashboarddefinitieNaam) ClearID()               { dd.Rel_ID = 0 }
func (dd DashboardDefinitie_DashboarddefinitieNaam) GetOpvoer() *time.Time   { return dd.Opvoer }
func (dd *DashboardDefinitie_DashboarddefinitieNaam) SetOpvoer(t *time.Time) { dd.Opvoer = t }
func (dd DashboardDefinitie_DashboarddefinitieNaam) GetAfvoer() *time.Time   { return dd.Afvoer }
func (dd *DashboardDefinitie_DashboarddefinitieNaam) SetAfvoer(t *time.Time) { dd.Afvoer = t }
func (dd DashboardDefinitie_DashboarddefinitieNaam) String() string          { return RepresentatieToString(dd) }

// DashboardDefinitie_DashboarddefinitieTegel
func (dd DashboardDefinitie_DashboarddefinitieTegel) GetID() any { return dd.Rel_ID }
func (dd DashboardDefinitie_DashboarddefinitieTegel) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (dd *DashboardDefinitie_DashboarddefinitieTegel) ClearID()               { dd.Rel_ID = 0 }
func (dd DashboardDefinitie_DashboarddefinitieTegel) GetOpvoer() *time.Time   { return dd.Opvoer }
func (dd *DashboardDefinitie_DashboarddefinitieTegel) SetOpvoer(t *time.Time) { dd.Opvoer = t }
func (dd DashboardDefinitie_DashboarddefinitieTegel) GetAfvoer() *time.Time   { return dd.Afvoer }
func (dd *DashboardDefinitie_DashboarddefinitieTegel) SetAfvoer(t *time.Time) { dd.Afvoer = t }
func (dd DashboardDefinitie_DashboarddefinitieTegel) String() string {
	return RepresentatieToString(dd)
}

// DashboardDefinitie_DashboarddefinitieStatus
func (dd DashboardDefinitie_DashboarddefinitieStatus) GetID() any { return dd.Rel_ID }
func (dd DashboardDefinitie_DashboarddefinitieStatus) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (dd *DashboardDefinitie_DashboarddefinitieStatus) ClearID()               { dd.Rel_ID = 0 }
func (dd DashboardDefinitie_DashboarddefinitieStatus) GetOpvoer() *time.Time   { return dd.Opvoer }
func (dd *DashboardDefinitie_DashboarddefinitieStatus) SetOpvoer(t *time.Time) { dd.Opvoer = t }
func (dd DashboardDefinitie_DashboarddefinitieStatus) GetAfvoer() *time.Time   { return dd.Afvoer }
func (dd *DashboardDefinitie_DashboarddefinitieStatus) SetAfvoer(t *time.Time) { dd.Afvoer = t }
func (dd DashboardDefinitie_DashboarddefinitieStatus) String() string {
	return RepresentatieToString(dd)
}

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

// QueryDefinitie_QuerydefinitieNaam_Data
func (d QueryDefinitie_QuerydefinitieNaam_Data) GetID() any              { return d.Versie }
func (d QueryDefinitie_QuerydefinitieNaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *QueryDefinitie_QuerydefinitieNaam_Data) ClearID()               { d.Versie = 0 }
func (d QueryDefinitie_QuerydefinitieNaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *QueryDefinitie_QuerydefinitieNaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d QueryDefinitie_QuerydefinitieNaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *QueryDefinitie_QuerydefinitieNaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d QueryDefinitie_QuerydefinitieNaam_Data) String() string          { return RepresentatieToString(d) }

// QueryDefinitie_QuerydefinitieBeschrijving_Data
func (d QueryDefinitie_QuerydefinitieBeschrijving_Data) GetID() any { return d.Versie }
func (d QueryDefinitie_QuerydefinitieBeschrijving_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *QueryDefinitie_QuerydefinitieBeschrijving_Data) ClearID()               { d.Versie = 0 }
func (d QueryDefinitie_QuerydefinitieBeschrijving_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *QueryDefinitie_QuerydefinitieBeschrijving_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d QueryDefinitie_QuerydefinitieBeschrijving_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *QueryDefinitie_QuerydefinitieBeschrijving_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d QueryDefinitie_QuerydefinitieBeschrijving_Data) String() string {
	return RepresentatieToString(d)
}

// QueryDefinitie_QuerydefinitieStatus_Data
func (d QueryDefinitie_QuerydefinitieStatus_Data) GetID() any              { return d.Versie }
func (d QueryDefinitie_QuerydefinitieStatus_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *QueryDefinitie_QuerydefinitieStatus_Data) ClearID()               { d.Versie = 0 }
func (d QueryDefinitie_QuerydefinitieStatus_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *QueryDefinitie_QuerydefinitieStatus_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d QueryDefinitie_QuerydefinitieStatus_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *QueryDefinitie_QuerydefinitieStatus_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d QueryDefinitie_QuerydefinitieStatus_Data) String() string          { return RepresentatieToString(d) }

// QueryDefinitie_QuerydefinitieToegankelijkheid_Data
func (d QueryDefinitie_QuerydefinitieToegankelijkheid_Data) GetID() any { return d.Versie }
func (d QueryDefinitie_QuerydefinitieToegankelijkheid_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *QueryDefinitie_QuerydefinitieToegankelijkheid_Data) ClearID()               { d.Versie = 0 }
func (d QueryDefinitie_QuerydefinitieToegankelijkheid_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *QueryDefinitie_QuerydefinitieToegankelijkheid_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d QueryDefinitie_QuerydefinitieToegankelijkheid_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *QueryDefinitie_QuerydefinitieToegankelijkheid_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d QueryDefinitie_QuerydefinitieToegankelijkheid_Data) String() string {
	return RepresentatieToString(d)
}

// QueryDefinitie_QuerydefinitieDocument_Data
func (d QueryDefinitie_QuerydefinitieDocument_Data) GetID() any { return d.Versie }
func (d QueryDefinitie_QuerydefinitieDocument_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *QueryDefinitie_QuerydefinitieDocument_Data) ClearID()               { d.Versie = 0 }
func (d QueryDefinitie_QuerydefinitieDocument_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *QueryDefinitie_QuerydefinitieDocument_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d QueryDefinitie_QuerydefinitieDocument_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *QueryDefinitie_QuerydefinitieDocument_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d QueryDefinitie_QuerydefinitieDocument_Data) String() string          { return RepresentatieToString(d) }

// NotificatieDefinitie_NotificatiedefinitieNaam_Data
func (d NotificatieDefinitie_NotificatiedefinitieNaam_Data) GetID() any { return d.Versie }
func (d NotificatieDefinitie_NotificatiedefinitieNaam_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *NotificatieDefinitie_NotificatiedefinitieNaam_Data) ClearID()               { d.Versie = 0 }
func (d NotificatieDefinitie_NotificatiedefinitieNaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *NotificatieDefinitie_NotificatiedefinitieNaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NotificatieDefinitie_NotificatiedefinitieNaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *NotificatieDefinitie_NotificatiedefinitieNaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NotificatieDefinitie_NotificatiedefinitieNaam_Data) String() string {
	return RepresentatieToString(d)
}

// NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data
func (d NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data) GetID() any { return d.Versie }
func (d NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data) ClearID() { d.Versie = 0 }
func (d NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data) GetOpvoer() *time.Time {
	return d.Opvoer
}
func (d *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data) SetOpvoer(t *time.Time) {
	d.Opvoer = t
}
func (d NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data) GetAfvoer() *time.Time {
	return d.Afvoer
}
func (d *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data) SetAfvoer(t *time.Time) {
	d.Afvoer = t
}
func (d NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data) String() string {
	return RepresentatieToString(d)
}

// NotificatieDefinitie_NotificatiedefinitieAbonnee_Data
func (d NotificatieDefinitie_NotificatiedefinitieAbonnee_Data) GetID() any { return d.Versie }
func (d NotificatieDefinitie_NotificatiedefinitieAbonnee_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *NotificatieDefinitie_NotificatiedefinitieAbonnee_Data) ClearID() { d.Versie = 0 }
func (d NotificatieDefinitie_NotificatiedefinitieAbonnee_Data) GetOpvoer() *time.Time {
	return d.Opvoer
}
func (d *NotificatieDefinitie_NotificatiedefinitieAbonnee_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NotificatieDefinitie_NotificatiedefinitieAbonnee_Data) GetAfvoer() *time.Time {
	return d.Afvoer
}
func (d *NotificatieDefinitie_NotificatiedefinitieAbonnee_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NotificatieDefinitie_NotificatiedefinitieAbonnee_Data) String() string {
	return RepresentatieToString(d)
}

// NotificatieDefinitie_NotificatiedefinitieInhoud_Data
func (d NotificatieDefinitie_NotificatiedefinitieInhoud_Data) GetID() any { return d.Versie }
func (d NotificatieDefinitie_NotificatiedefinitieInhoud_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *NotificatieDefinitie_NotificatiedefinitieInhoud_Data) ClearID()               { d.Versie = 0 }
func (d NotificatieDefinitie_NotificatiedefinitieInhoud_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *NotificatieDefinitie_NotificatiedefinitieInhoud_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NotificatieDefinitie_NotificatiedefinitieInhoud_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *NotificatieDefinitie_NotificatiedefinitieInhoud_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NotificatieDefinitie_NotificatiedefinitieInhoud_Data) String() string {
	return RepresentatieToString(d)
}

// NotificatieDefinitie_NotificatiedefinitieStatus_Data
func (d NotificatieDefinitie_NotificatiedefinitieStatus_Data) GetID() any { return d.Versie }
func (d NotificatieDefinitie_NotificatiedefinitieStatus_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *NotificatieDefinitie_NotificatiedefinitieStatus_Data) ClearID()               { d.Versie = 0 }
func (d NotificatieDefinitie_NotificatiedefinitieStatus_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *NotificatieDefinitie_NotificatiedefinitieStatus_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NotificatieDefinitie_NotificatiedefinitieStatus_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *NotificatieDefinitie_NotificatiedefinitieStatus_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NotificatieDefinitie_NotificatiedefinitieStatus_Data) String() string {
	return RepresentatieToString(d)
}

// DashboardDefinitie_DashboarddefinitieNaam_Data
func (d DashboardDefinitie_DashboarddefinitieNaam_Data) GetID() any { return d.Versie }
func (d DashboardDefinitie_DashboarddefinitieNaam_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *DashboardDefinitie_DashboarddefinitieNaam_Data) ClearID()               { d.Versie = 0 }
func (d DashboardDefinitie_DashboarddefinitieNaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie_DashboarddefinitieNaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie_DashboarddefinitieNaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie_DashboarddefinitieNaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie_DashboarddefinitieNaam_Data) String() string {
	return RepresentatieToString(d)
}

// DashboardDefinitie_DashboarddefinitieTegel_Data
func (d DashboardDefinitie_DashboarddefinitieTegel_Data) GetID() any { return d.Versie }
func (d DashboardDefinitie_DashboarddefinitieTegel_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *DashboardDefinitie_DashboarddefinitieTegel_Data) ClearID()               { d.Versie = 0 }
func (d DashboardDefinitie_DashboarddefinitieTegel_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie_DashboarddefinitieTegel_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie_DashboarddefinitieTegel_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie_DashboarddefinitieTegel_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie_DashboarddefinitieTegel_Data) String() string {
	return RepresentatieToString(d)
}

// DashboardDefinitie_DashboarddefinitieStatus_Data
func (d DashboardDefinitie_DashboarddefinitieStatus_Data) GetID() any { return d.Versie }
func (d DashboardDefinitie_DashboarddefinitieStatus_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *DashboardDefinitie_DashboarddefinitieStatus_Data) ClearID()               { d.Versie = 0 }
func (d DashboardDefinitie_DashboarddefinitieStatus_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie_DashboarddefinitieStatus_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie_DashboarddefinitieStatus_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie_DashboarddefinitieStatus_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie_DashboarddefinitieStatus_Data) String() string {
	return RepresentatieToString(d)
}

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

// NotificatieDefinitie_Aanvang
func (n NotificatieDefinitie_Aanvang) GetID() any              { return n.Versie }
func (n NotificatieDefinitie_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (n *NotificatieDefinitie_Aanvang) ClearID()               { n.Versie = 0 }
func (n NotificatieDefinitie_Aanvang) GetOpvoer() *time.Time   { return n.Opvoer }
func (n *NotificatieDefinitie_Aanvang) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NotificatieDefinitie_Aanvang) GetAfvoer() *time.Time   { return n.Afvoer }
func (n *NotificatieDefinitie_Aanvang) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NotificatieDefinitie_Aanvang) String() string          { return RepresentatieToString(n) }

// NotificatieDefinitie_Einde
func (n NotificatieDefinitie_Einde) GetID() any              { return n.Versie }
func (n NotificatieDefinitie_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (n *NotificatieDefinitie_Einde) ClearID()               { n.Versie = 0 }
func (n NotificatieDefinitie_Einde) GetOpvoer() *time.Time   { return n.Opvoer }
func (n *NotificatieDefinitie_Einde) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NotificatieDefinitie_Einde) GetAfvoer() *time.Time   { return n.Afvoer }
func (n *NotificatieDefinitie_Einde) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NotificatieDefinitie_Einde) String() string          { return RepresentatieToString(n) }

// DashboardDefinitie_Aanvang
func (d DashboardDefinitie_Aanvang) GetID() any              { return d.Versie }
func (d DashboardDefinitie_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *DashboardDefinitie_Aanvang) ClearID()               { d.Versie = 0 }
func (d DashboardDefinitie_Aanvang) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie_Aanvang) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie_Aanvang) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie_Aanvang) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie_Aanvang) String() string          { return RepresentatieToString(d) }

// DashboardDefinitie_Einde
func (d DashboardDefinitie_Einde) GetID() any              { return d.Versie }
func (d DashboardDefinitie_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *DashboardDefinitie_Einde) ClearID()               { d.Versie = 0 }
func (d DashboardDefinitie_Einde) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie_Einde) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie_Einde) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie_Einde) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie_Einde) String() string          { return RepresentatieToString(d) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

// QueryDefinitie_QuerydefinitieStatus_Aanvang
func (q QueryDefinitie_QuerydefinitieStatus_Aanvang) GetID() any { return q.Versie }
func (q QueryDefinitie_QuerydefinitieStatus_Aanvang) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (q *QueryDefinitie_QuerydefinitieStatus_Aanvang) ClearID()               { q.Versie = 0 }
func (q QueryDefinitie_QuerydefinitieStatus_Aanvang) GetOpvoer() *time.Time   { return q.Opvoer }
func (q *QueryDefinitie_QuerydefinitieStatus_Aanvang) SetOpvoer(t *time.Time) { q.Opvoer = t }
func (q QueryDefinitie_QuerydefinitieStatus_Aanvang) GetAfvoer() *time.Time   { return q.Afvoer }
func (q *QueryDefinitie_QuerydefinitieStatus_Aanvang) SetAfvoer(t *time.Time) { q.Afvoer = t }
func (q QueryDefinitie_QuerydefinitieStatus_Aanvang) String() string          { return RepresentatieToString(q) }

// QueryDefinitie_QuerydefinitieStatus_Einde
func (q QueryDefinitie_QuerydefinitieStatus_Einde) GetID() any { return q.Versie }
func (q QueryDefinitie_QuerydefinitieStatus_Einde) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (q *QueryDefinitie_QuerydefinitieStatus_Einde) ClearID()               { q.Versie = 0 }
func (q QueryDefinitie_QuerydefinitieStatus_Einde) GetOpvoer() *time.Time   { return q.Opvoer }
func (q *QueryDefinitie_QuerydefinitieStatus_Einde) SetOpvoer(t *time.Time) { q.Opvoer = t }
func (q QueryDefinitie_QuerydefinitieStatus_Einde) GetAfvoer() *time.Time   { return q.Afvoer }
func (q *QueryDefinitie_QuerydefinitieStatus_Einde) SetAfvoer(t *time.Time) { q.Afvoer = t }
func (q QueryDefinitie_QuerydefinitieStatus_Einde) String() string          { return RepresentatieToString(q) }

// QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang) GetID() any { return q.Versie }
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (q *QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang) ClearID() { q.Versie = 0 }
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang) GetOpvoer() *time.Time {
	return q.Opvoer
}
func (q *QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang) SetOpvoer(t *time.Time) { q.Opvoer = t }
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang) GetAfvoer() *time.Time {
	return q.Afvoer
}
func (q *QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang) SetAfvoer(t *time.Time) { q.Afvoer = t }
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang) String() string {
	return RepresentatieToString(q)
}

// QueryDefinitie_QuerydefinitieToegankelijkheid_Einde
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Einde) GetID() any { return q.Versie }
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Einde) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (q *QueryDefinitie_QuerydefinitieToegankelijkheid_Einde) ClearID()               { q.Versie = 0 }
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Einde) GetOpvoer() *time.Time   { return q.Opvoer }
func (q *QueryDefinitie_QuerydefinitieToegankelijkheid_Einde) SetOpvoer(t *time.Time) { q.Opvoer = t }
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Einde) GetAfvoer() *time.Time   { return q.Afvoer }
func (q *QueryDefinitie_QuerydefinitieToegankelijkheid_Einde) SetAfvoer(t *time.Time) { q.Afvoer = t }
func (q QueryDefinitie_QuerydefinitieToegankelijkheid_Einde) String() string {
	return RepresentatieToString(q)
}

// QueryDefinitie_QuerydefinitieDocument_Aanvang
func (q QueryDefinitie_QuerydefinitieDocument_Aanvang) GetID() any { return q.Versie }
func (q QueryDefinitie_QuerydefinitieDocument_Aanvang) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (q *QueryDefinitie_QuerydefinitieDocument_Aanvang) ClearID()               { q.Versie = 0 }
func (q QueryDefinitie_QuerydefinitieDocument_Aanvang) GetOpvoer() *time.Time   { return q.Opvoer }
func (q *QueryDefinitie_QuerydefinitieDocument_Aanvang) SetOpvoer(t *time.Time) { q.Opvoer = t }
func (q QueryDefinitie_QuerydefinitieDocument_Aanvang) GetAfvoer() *time.Time   { return q.Afvoer }
func (q *QueryDefinitie_QuerydefinitieDocument_Aanvang) SetAfvoer(t *time.Time) { q.Afvoer = t }
func (q QueryDefinitie_QuerydefinitieDocument_Aanvang) String() string {
	return RepresentatieToString(q)
}

// QueryDefinitie_QuerydefinitieDocument_Einde
func (q QueryDefinitie_QuerydefinitieDocument_Einde) GetID() any { return q.Versie }
func (q QueryDefinitie_QuerydefinitieDocument_Einde) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (q *QueryDefinitie_QuerydefinitieDocument_Einde) ClearID()               { q.Versie = 0 }
func (q QueryDefinitie_QuerydefinitieDocument_Einde) GetOpvoer() *time.Time   { return q.Opvoer }
func (q *QueryDefinitie_QuerydefinitieDocument_Einde) SetOpvoer(t *time.Time) { q.Opvoer = t }
func (q QueryDefinitie_QuerydefinitieDocument_Einde) GetAfvoer() *time.Time   { return q.Afvoer }
func (q *QueryDefinitie_QuerydefinitieDocument_Einde) SetAfvoer(t *time.Time) { q.Afvoer = t }
func (q QueryDefinitie_QuerydefinitieDocument_Einde) String() string          { return RepresentatieToString(q) }

// NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang) GetID() any { return n.Versie }
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (n *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang) ClearID() { n.Versie = 0 }
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang) GetOpvoer() *time.Time {
	return n.Opvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang) SetOpvoer(t *time.Time) {
	n.Opvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang) GetAfvoer() *time.Time {
	return n.Afvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang) SetAfvoer(t *time.Time) {
	n.Afvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang) String() string {
	return RepresentatieToString(n)
}

// NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde) GetID() any { return n.Versie }
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (n *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde) ClearID() { n.Versie = 0 }
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde) GetOpvoer() *time.Time {
	return n.Opvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde) SetOpvoer(t *time.Time) {
	n.Opvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde) GetAfvoer() *time.Time {
	return n.Afvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde) SetAfvoer(t *time.Time) {
	n.Afvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde) String() string {
	return RepresentatieToString(n)
}

// NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang) GetID() any { return n.Versie }
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (n *NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang) ClearID() { n.Versie = 0 }
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang) GetOpvoer() *time.Time {
	return n.Opvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang) SetOpvoer(t *time.Time) {
	n.Opvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang) GetAfvoer() *time.Time {
	return n.Afvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang) SetAfvoer(t *time.Time) {
	n.Afvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang) String() string {
	return RepresentatieToString(n)
}

// NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde) GetID() any { return n.Versie }
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (n *NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde) ClearID() { n.Versie = 0 }
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde) GetOpvoer() *time.Time {
	return n.Opvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde) SetOpvoer(t *time.Time) {
	n.Opvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde) GetAfvoer() *time.Time {
	return n.Afvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde) SetAfvoer(t *time.Time) {
	n.Afvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde) String() string {
	return RepresentatieToString(n)
}

// NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang) GetID() any { return n.Versie }
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (n *NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang) ClearID() { n.Versie = 0 }
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang) GetOpvoer() *time.Time {
	return n.Opvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang) SetOpvoer(t *time.Time) {
	n.Opvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang) GetAfvoer() *time.Time {
	return n.Afvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang) SetAfvoer(t *time.Time) {
	n.Afvoer = t
}
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang) String() string {
	return RepresentatieToString(n)
}

// NotificatieDefinitie_NotificatiedefinitieStatus_Einde
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Einde) GetID() any { return n.Versie }
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Einde) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (n *NotificatieDefinitie_NotificatiedefinitieStatus_Einde) ClearID() { n.Versie = 0 }
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Einde) GetOpvoer() *time.Time {
	return n.Opvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieStatus_Einde) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Einde) GetAfvoer() *time.Time {
	return n.Afvoer
}
func (n *NotificatieDefinitie_NotificatiedefinitieStatus_Einde) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NotificatieDefinitie_NotificatiedefinitieStatus_Einde) String() string {
	return RepresentatieToString(n)
}

// DashboardDefinitie_DashboarddefinitieTegel_Aanvang
func (d DashboardDefinitie_DashboarddefinitieTegel_Aanvang) GetID() any { return d.Versie }
func (d DashboardDefinitie_DashboarddefinitieTegel_Aanvang) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *DashboardDefinitie_DashboarddefinitieTegel_Aanvang) ClearID()               { d.Versie = 0 }
func (d DashboardDefinitie_DashboarddefinitieTegel_Aanvang) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie_DashboarddefinitieTegel_Aanvang) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie_DashboarddefinitieTegel_Aanvang) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie_DashboarddefinitieTegel_Aanvang) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie_DashboarddefinitieTegel_Aanvang) String() string {
	return RepresentatieToString(d)
}

// DashboardDefinitie_DashboarddefinitieTegel_Einde
func (d DashboardDefinitie_DashboarddefinitieTegel_Einde) GetID() any { return d.Versie }
func (d DashboardDefinitie_DashboarddefinitieTegel_Einde) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *DashboardDefinitie_DashboarddefinitieTegel_Einde) ClearID()               { d.Versie = 0 }
func (d DashboardDefinitie_DashboarddefinitieTegel_Einde) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie_DashboarddefinitieTegel_Einde) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie_DashboarddefinitieTegel_Einde) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie_DashboarddefinitieTegel_Einde) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie_DashboarddefinitieTegel_Einde) String() string {
	return RepresentatieToString(d)
}

// DashboardDefinitie_DashboarddefinitieStatus_Aanvang
func (d DashboardDefinitie_DashboarddefinitieStatus_Aanvang) GetID() any { return d.Versie }
func (d DashboardDefinitie_DashboarddefinitieStatus_Aanvang) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *DashboardDefinitie_DashboarddefinitieStatus_Aanvang) ClearID()               { d.Versie = 0 }
func (d DashboardDefinitie_DashboarddefinitieStatus_Aanvang) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie_DashboarddefinitieStatus_Aanvang) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie_DashboarddefinitieStatus_Aanvang) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie_DashboarddefinitieStatus_Aanvang) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie_DashboarddefinitieStatus_Aanvang) String() string {
	return RepresentatieToString(d)
}

// DashboardDefinitie_DashboarddefinitieStatus_Einde
func (d DashboardDefinitie_DashboarddefinitieStatus_Einde) GetID() any { return d.Versie }
func (d DashboardDefinitie_DashboarddefinitieStatus_Einde) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *DashboardDefinitie_DashboarddefinitieStatus_Einde) ClearID()               { d.Versie = 0 }
func (d DashboardDefinitie_DashboarddefinitieStatus_Einde) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DashboardDefinitie_DashboarddefinitieStatus_Einde) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DashboardDefinitie_DashboarddefinitieStatus_Einde) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DashboardDefinitie_DashboarddefinitieStatus_Einde) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DashboardDefinitie_DashboarddefinitieStatus_Einde) String() string {
	return RepresentatieToString(d)
}

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

// QueryDefinitie_QuerydefinitieNaam_Input
func (i QueryDefinitie_QuerydefinitieNaam_Input) GetID() any              { return i.Rel_ID }
func (i QueryDefinitie_QuerydefinitieNaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *QueryDefinitie_QuerydefinitieNaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i QueryDefinitie_QuerydefinitieNaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieNaam_Input) SetOpvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieNaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieNaam_Input) SetAfvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieNaam_Input) String() string          { return RepresentatieToString(i) }

// QueryDefinitie_QuerydefinitieBeschrijving_Input
func (i QueryDefinitie_QuerydefinitieBeschrijving_Input) GetID() any { return i.Rel_ID }
func (i QueryDefinitie_QuerydefinitieBeschrijving_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *QueryDefinitie_QuerydefinitieBeschrijving_Input) ClearID()               { i.Rel_ID = 0 }
func (i QueryDefinitie_QuerydefinitieBeschrijving_Input) GetOpvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieBeschrijving_Input) SetOpvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieBeschrijving_Input) GetAfvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieBeschrijving_Input) SetAfvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieBeschrijving_Input) String() string {
	return RepresentatieToString(i)
}

// QueryDefinitie_QuerydefinitieStatus_Input
func (i QueryDefinitie_QuerydefinitieStatus_Input) GetID() any { return i.Rel_ID }
func (i QueryDefinitie_QuerydefinitieStatus_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *QueryDefinitie_QuerydefinitieStatus_Input) ClearID()               { i.Rel_ID = 0 }
func (i QueryDefinitie_QuerydefinitieStatus_Input) GetOpvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieStatus_Input) SetOpvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieStatus_Input) GetAfvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieStatus_Input) SetAfvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieStatus_Input) String() string          { return RepresentatieToString(i) }

// QueryDefinitie_QuerydefinitieToegankelijkheid_Input
func (i QueryDefinitie_QuerydefinitieToegankelijkheid_Input) GetID() any { return i.Rel_ID }
func (i QueryDefinitie_QuerydefinitieToegankelijkheid_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *QueryDefinitie_QuerydefinitieToegankelijkheid_Input) ClearID()               { i.Rel_ID = 0 }
func (i QueryDefinitie_QuerydefinitieToegankelijkheid_Input) GetOpvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieToegankelijkheid_Input) SetOpvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieToegankelijkheid_Input) GetAfvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieToegankelijkheid_Input) SetAfvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieToegankelijkheid_Input) String() string {
	return RepresentatieToString(i)
}

// QueryDefinitie_QuerydefinitieDocument_Input
func (i QueryDefinitie_QuerydefinitieDocument_Input) GetID() any { return i.Rel_ID }
func (i QueryDefinitie_QuerydefinitieDocument_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *QueryDefinitie_QuerydefinitieDocument_Input) ClearID()               { i.Rel_ID = 0 }
func (i QueryDefinitie_QuerydefinitieDocument_Input) GetOpvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieDocument_Input) SetOpvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieDocument_Input) GetAfvoer() *time.Time   { return nil }
func (i *QueryDefinitie_QuerydefinitieDocument_Input) SetAfvoer(t *time.Time) {}
func (i QueryDefinitie_QuerydefinitieDocument_Input) String() string          { return RepresentatieToString(i) }

// NotificatieDefinitie_NotificatiedefinitieNaam_Input
func (i NotificatieDefinitie_NotificatiedefinitieNaam_Input) GetID() any { return i.Rel_ID }
func (i NotificatieDefinitie_NotificatiedefinitieNaam_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *NotificatieDefinitie_NotificatiedefinitieNaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i NotificatieDefinitie_NotificatiedefinitieNaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *NotificatieDefinitie_NotificatiedefinitieNaam_Input) SetOpvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieNaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *NotificatieDefinitie_NotificatiedefinitieNaam_Input) SetAfvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieNaam_Input) String() string {
	return RepresentatieToString(i)
}

// NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input
func (i NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input) GetID() any { return i.Rel_ID }
func (i NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input) ClearID() { i.Rel_ID = 0 }
func (i NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input) GetOpvoer() *time.Time {
	return nil
}
func (i *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input) SetOpvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input) GetAfvoer() *time.Time {
	return nil
}
func (i *NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input) SetAfvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Input) String() string {
	return RepresentatieToString(i)
}

// NotificatieDefinitie_NotificatiedefinitieAbonnee_Input
func (i NotificatieDefinitie_NotificatiedefinitieAbonnee_Input) GetID() any { return i.Rel_ID }
func (i NotificatieDefinitie_NotificatiedefinitieAbonnee_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *NotificatieDefinitie_NotificatiedefinitieAbonnee_Input) ClearID()               { i.Rel_ID = 0 }
func (i NotificatieDefinitie_NotificatiedefinitieAbonnee_Input) GetOpvoer() *time.Time   { return nil }
func (i *NotificatieDefinitie_NotificatiedefinitieAbonnee_Input) SetOpvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieAbonnee_Input) GetAfvoer() *time.Time   { return nil }
func (i *NotificatieDefinitie_NotificatiedefinitieAbonnee_Input) SetAfvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieAbonnee_Input) String() string {
	return RepresentatieToString(i)
}

// NotificatieDefinitie_NotificatiedefinitieInhoud_Input
func (i NotificatieDefinitie_NotificatiedefinitieInhoud_Input) GetID() any { return i.Rel_ID }
func (i NotificatieDefinitie_NotificatiedefinitieInhoud_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *NotificatieDefinitie_NotificatiedefinitieInhoud_Input) ClearID()               { i.Rel_ID = 0 }
func (i NotificatieDefinitie_NotificatiedefinitieInhoud_Input) GetOpvoer() *time.Time   { return nil }
func (i *NotificatieDefinitie_NotificatiedefinitieInhoud_Input) SetOpvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieInhoud_Input) GetAfvoer() *time.Time   { return nil }
func (i *NotificatieDefinitie_NotificatiedefinitieInhoud_Input) SetAfvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieInhoud_Input) String() string {
	return RepresentatieToString(i)
}

// NotificatieDefinitie_NotificatiedefinitieStatus_Input
func (i NotificatieDefinitie_NotificatiedefinitieStatus_Input) GetID() any { return i.Rel_ID }
func (i NotificatieDefinitie_NotificatiedefinitieStatus_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *NotificatieDefinitie_NotificatiedefinitieStatus_Input) ClearID()               { i.Rel_ID = 0 }
func (i NotificatieDefinitie_NotificatiedefinitieStatus_Input) GetOpvoer() *time.Time   { return nil }
func (i *NotificatieDefinitie_NotificatiedefinitieStatus_Input) SetOpvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieStatus_Input) GetAfvoer() *time.Time   { return nil }
func (i *NotificatieDefinitie_NotificatiedefinitieStatus_Input) SetAfvoer(t *time.Time) {}
func (i NotificatieDefinitie_NotificatiedefinitieStatus_Input) String() string {
	return RepresentatieToString(i)
}

// DashboardDefinitie_DashboarddefinitieNaam_Input
func (i DashboardDefinitie_DashboarddefinitieNaam_Input) GetID() any { return i.Rel_ID }
func (i DashboardDefinitie_DashboarddefinitieNaam_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *DashboardDefinitie_DashboarddefinitieNaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i DashboardDefinitie_DashboarddefinitieNaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *DashboardDefinitie_DashboarddefinitieNaam_Input) SetOpvoer(t *time.Time) {}
func (i DashboardDefinitie_DashboarddefinitieNaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *DashboardDefinitie_DashboarddefinitieNaam_Input) SetAfvoer(t *time.Time) {}
func (i DashboardDefinitie_DashboarddefinitieNaam_Input) String() string {
	return RepresentatieToString(i)
}

// DashboardDefinitie_DashboarddefinitieTegel_Input
func (i DashboardDefinitie_DashboarddefinitieTegel_Input) GetID() any { return i.Rel_ID }
func (i DashboardDefinitie_DashboarddefinitieTegel_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *DashboardDefinitie_DashboarddefinitieTegel_Input) ClearID()               { i.Rel_ID = 0 }
func (i DashboardDefinitie_DashboarddefinitieTegel_Input) GetOpvoer() *time.Time   { return nil }
func (i *DashboardDefinitie_DashboarddefinitieTegel_Input) SetOpvoer(t *time.Time) {}
func (i DashboardDefinitie_DashboarddefinitieTegel_Input) GetAfvoer() *time.Time   { return nil }
func (i *DashboardDefinitie_DashboarddefinitieTegel_Input) SetAfvoer(t *time.Time) {}
func (i DashboardDefinitie_DashboarddefinitieTegel_Input) String() string {
	return RepresentatieToString(i)
}

// DashboardDefinitie_DashboarddefinitieStatus_Input
func (i DashboardDefinitie_DashboarddefinitieStatus_Input) GetID() any { return i.Rel_ID }
func (i DashboardDefinitie_DashboarddefinitieStatus_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *DashboardDefinitie_DashboarddefinitieStatus_Input) ClearID()               { i.Rel_ID = 0 }
func (i DashboardDefinitie_DashboarddefinitieStatus_Input) GetOpvoer() *time.Time   { return nil }
func (i *DashboardDefinitie_DashboarddefinitieStatus_Input) SetOpvoer(t *time.Time) {}
func (i DashboardDefinitie_DashboarddefinitieStatus_Input) GetAfvoer() *time.Time   { return nil }
func (i *DashboardDefinitie_DashboarddefinitieStatus_Input) SetAfvoer(t *time.Time) {}
func (i DashboardDefinitie_DashboarddefinitieStatus_Input) String() string {
	return RepresentatieToString(i)
}

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
	for idx := range q.QueryDefinitieNamen {
		if q.QueryDefinitieNamen[idx].QueryDefinitie_ID == 0 {
			q.QueryDefinitieNamen[idx].QueryDefinitie_ID = q.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieNaam", Representatie: &q.QueryDefinitieNamen[idx]})
	}
	for idx := range q.QueryDefinitieBeschrijvingen {
		if q.QueryDefinitieBeschrijvingen[idx].QueryDefinitie_ID == 0 {
			q.QueryDefinitieBeschrijvingen[idx].QueryDefinitie_ID = q.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieBeschrijving", Representatie: &q.QueryDefinitieBeschrijvingen[idx]})
	}
	for idx := range q.QueryDefinitieStatussen {
		if q.QueryDefinitieStatussen[idx].QueryDefinitie_ID == 0 {
			q.QueryDefinitieStatussen[idx].QueryDefinitie_ID = q.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieStatus", Representatie: &q.QueryDefinitieStatussen[idx]})
	}
	for idx := range q.QueryDefinitieToegankelijkheden {
		if q.QueryDefinitieToegankelijkheden[idx].QueryDefinitie_ID == 0 {
			q.QueryDefinitieToegankelijkheden[idx].QueryDefinitie_ID = q.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieToegankelijkheid", Representatie: &q.QueryDefinitieToegankelijkheden[idx]})
	}
	for idx := range q.QueryDefinitieDocumenten {
		if q.QueryDefinitieDocumenten[idx].QueryDefinitie_ID == 0 {
			q.QueryDefinitieDocumenten[idx].QueryDefinitie_ID = q.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieDocument", Representatie: &q.QueryDefinitieDocumenten[idx]})
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

func (n *NotificatieDefinitie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range n.NotificatieDefinitieNamen {
		if n.NotificatieDefinitieNamen[idx].NotificatieDefinitie_ID == 0 {
			n.NotificatieDefinitieNamen[idx].NotificatieDefinitie_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieNaam", Representatie: &n.NotificatieDefinitieNamen[idx]})
	}
	for idx := range n.NotificatieDefinitieGebeurtenissen {
		if n.NotificatieDefinitieGebeurtenissen[idx].NotificatieDefinitie_ID == 0 {
			n.NotificatieDefinitieGebeurtenissen[idx].NotificatieDefinitie_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieGebeurtenis", Representatie: &n.NotificatieDefinitieGebeurtenissen[idx]})
	}
	for idx := range n.NotificatieDefinitieAbonnees {
		if n.NotificatieDefinitieAbonnees[idx].NotificatieDefinitie_ID == 0 {
			n.NotificatieDefinitieAbonnees[idx].NotificatieDefinitie_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieAbonnee", Representatie: &n.NotificatieDefinitieAbonnees[idx]})
	}
	for idx := range n.NotificatieDefinitieInhouden {
		if n.NotificatieDefinitieInhouden[idx].NotificatieDefinitie_ID == 0 {
			n.NotificatieDefinitieInhouden[idx].NotificatieDefinitie_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieInhoud", Representatie: &n.NotificatieDefinitieInhouden[idx]})
	}
	for idx := range n.NotificatieDefinitieStatussen {
		if n.NotificatieDefinitieStatussen[idx].NotificatieDefinitie_ID == 0 {
			n.NotificatieDefinitieStatussen[idx].NotificatieDefinitie_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieStatus", Representatie: &n.NotificatieDefinitieStatussen[idx]})
	}
	for idx := range n.Aanvang {
		if n.Aanvang[idx].NotificatieDefinitie_ID == 0 {
			n.Aanvang[idx].NotificatieDefinitie_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_Aanvang", Representatie: &n.Aanvang[idx]})
	}
	for idx := range n.Einde {
		if n.Einde[idx].NotificatieDefinitie_ID == 0 {
			n.Einde[idx].NotificatieDefinitie_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_Einde", Representatie: &n.Einde[idx]})
	}
	return result
}

func (d *DashboardDefinitie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range d.DashboardDefinitieNamen {
		if d.DashboardDefinitieNamen[idx].DashboardDefinitie_ID == 0 {
			d.DashboardDefinitieNamen[idx].DashboardDefinitie_ID = d.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieNaam", Representatie: &d.DashboardDefinitieNamen[idx]})
	}
	for idx := range d.DashboardDefinitieTegels {
		if d.DashboardDefinitieTegels[idx].DashboardDefinitie_ID == 0 {
			d.DashboardDefinitieTegels[idx].DashboardDefinitie_ID = d.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieTegel", Representatie: &d.DashboardDefinitieTegels[idx]})
	}
	for idx := range d.DashboardDefinitieStatussen {
		if d.DashboardDefinitieStatussen[idx].DashboardDefinitie_ID == 0 {
			d.DashboardDefinitieStatussen[idx].DashboardDefinitie_ID = d.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieStatus", Representatie: &d.DashboardDefinitieStatussen[idx]})
	}
	for idx := range d.Aanvang {
		if d.Aanvang[idx].DashboardDefinitie_ID == 0 {
			d.Aanvang[idx].DashboardDefinitie_ID = d.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_Aanvang", Representatie: &d.Aanvang[idx]})
	}
	for idx := range d.Einde {
		if d.Einde[idx].DashboardDefinitie_ID == 0 {
			d.Einde[idx].DashboardDefinitie_ID = d.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_Einde", Representatie: &d.Einde[idx]})
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

func (h *DashboardDefinitie_DashboarddefinitieNaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].DashboardDefinitie_ID == 0 {
			h.Data[i].DashboardDefinitie_ID = h.DashboardDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieNaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *DashboardDefinitie_DashboarddefinitieTegel) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].DashboardDefinitie_ID == 0 {
			h.Data[i].DashboardDefinitie_ID = h.DashboardDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieTegel_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].DashboardDefinitie_ID == 0 {
			h.Aanvang[i].DashboardDefinitie_ID = h.DashboardDefinitie_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieTegel_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].DashboardDefinitie_ID == 0 {
			h.Einde[i].DashboardDefinitie_ID = h.DashboardDefinitie_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieTegel_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *DashboardDefinitie_DashboarddefinitieStatus) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].DashboardDefinitie_ID == 0 {
			h.Data[i].DashboardDefinitie_ID = h.DashboardDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieStatus_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].DashboardDefinitie_ID == 0 {
			h.Aanvang[i].DashboardDefinitie_ID = h.DashboardDefinitie_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieStatus_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].DashboardDefinitie_ID == 0 {
			h.Einde[i].DashboardDefinitie_ID = h.DashboardDefinitie_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DashboardDefinitie_DashboarddefinitieStatus_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *NotificatieDefinitie_NotificatiedefinitieNaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].NotificatieDefinitie_ID == 0 {
			h.Data[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieNaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *NotificatieDefinitie_NotificatiedefinitieGebeurtenis) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].NotificatieDefinitie_ID == 0 {
			h.Data[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].NotificatieDefinitie_ID == 0 {
			h.Aanvang[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].NotificatieDefinitie_ID == 0 {
			h.Einde[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieGebeurtenis_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *NotificatieDefinitie_NotificatiedefinitieAbonnee) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].NotificatieDefinitie_ID == 0 {
			h.Data[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieAbonnee_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].NotificatieDefinitie_ID == 0 {
			h.Aanvang[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieAbonnee_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].NotificatieDefinitie_ID == 0 {
			h.Einde[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieAbonnee_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *NotificatieDefinitie_NotificatiedefinitieInhoud) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].NotificatieDefinitie_ID == 0 {
			h.Data[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieInhoud_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *NotificatieDefinitie_NotificatiedefinitieStatus) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].NotificatieDefinitie_ID == 0 {
			h.Data[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieStatus_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].NotificatieDefinitie_ID == 0 {
			h.Aanvang[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieStatus_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].NotificatieDefinitie_ID == 0 {
			h.Einde[i].NotificatieDefinitie_ID = h.NotificatieDefinitie_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NotificatieDefinitie_NotificatiedefinitieStatus_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *QueryDefinitie_QuerydefinitieNaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].QueryDefinitie_ID == 0 {
			h.Data[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieNaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *QueryDefinitie_QuerydefinitieBeschrijving) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].QueryDefinitie_ID == 0 {
			h.Data[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieBeschrijving_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *QueryDefinitie_QuerydefinitieStatus) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].QueryDefinitie_ID == 0 {
			h.Data[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieStatus_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].QueryDefinitie_ID == 0 {
			h.Aanvang[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieStatus_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].QueryDefinitie_ID == 0 {
			h.Einde[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieStatus_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *QueryDefinitie_QuerydefinitieToegankelijkheid) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].QueryDefinitie_ID == 0 {
			h.Data[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieToegankelijkheid_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].QueryDefinitie_ID == 0 {
			h.Aanvang[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieToegankelijkheid_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].QueryDefinitie_ID == 0 {
			h.Einde[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieToegankelijkheid_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *QueryDefinitie_QuerydefinitieDocument) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].QueryDefinitie_ID == 0 {
			h.Data[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieDocument_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].QueryDefinitie_ID == 0 {
			h.Aanvang[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieDocument_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].QueryDefinitie_ID == 0 {
			h.Einde[i].QueryDefinitie_ID = h.QueryDefinitie_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "QueryDefinitie_QuerydefinitieDocument_Einde", Representatie: &h.Einde[i]})
	}
	return result
}
