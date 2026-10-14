package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// Melding
func (m Melding) GetID() any              { return m.ID }
func (m Melding) Metatype() Metatype      { return MetatypeEntiteit }
func (m *Melding) ClearID()               { m.ID = 0 }
func (m Melding) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *Melding) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m Melding) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *Melding) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m Melding) String() string          { return RepresentatieToString(m) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// Melding_MeldingInhoud
func (mm Melding_MeldingInhoud) GetID() any              { return mm.Rel_ID }
func (mm Melding_MeldingInhoud) Metatype() Metatype      { return MetatypeGegevenselement }
func (mm *Melding_MeldingInhoud) ClearID()               { mm.Rel_ID = 0 }
func (mm Melding_MeldingInhoud) GetOpvoer() *time.Time   { return mm.Opvoer }
func (mm *Melding_MeldingInhoud) SetOpvoer(t *time.Time) { mm.Opvoer = t }
func (mm Melding_MeldingInhoud) GetAfvoer() *time.Time   { return mm.Afvoer }
func (mm *Melding_MeldingInhoud) SetAfvoer(t *time.Time) { mm.Afvoer = t }
func (mm Melding_MeldingInhoud) String() string          { return RepresentatieToString(mm) }

// Melding_MeldingContext
func (mm Melding_MeldingContext) GetID() any              { return mm.Rel_ID }
func (mm Melding_MeldingContext) Metatype() Metatype      { return MetatypeGegevenselement }
func (mm *Melding_MeldingContext) ClearID()               { mm.Rel_ID = 0 }
func (mm Melding_MeldingContext) GetOpvoer() *time.Time   { return mm.Opvoer }
func (mm *Melding_MeldingContext) SetOpvoer(t *time.Time) { mm.Opvoer = t }
func (mm Melding_MeldingContext) GetAfvoer() *time.Time   { return mm.Afvoer }
func (mm *Melding_MeldingContext) SetAfvoer(t *time.Time) { mm.Afvoer = t }
func (mm Melding_MeldingContext) String() string          { return RepresentatieToString(mm) }

// Melding_MeldingBijlage
func (mm Melding_MeldingBijlage) GetID() any              { return mm.Rel_ID }
func (mm Melding_MeldingBijlage) Metatype() Metatype      { return MetatypeGegevenselement }
func (mm *Melding_MeldingBijlage) ClearID()               { mm.Rel_ID = 0 }
func (mm Melding_MeldingBijlage) GetOpvoer() *time.Time   { return mm.Opvoer }
func (mm *Melding_MeldingBijlage) SetOpvoer(t *time.Time) { mm.Opvoer = t }
func (mm Melding_MeldingBijlage) GetAfvoer() *time.Time   { return mm.Afvoer }
func (mm *Melding_MeldingBijlage) SetAfvoer(t *time.Time) { mm.Afvoer = t }
func (mm Melding_MeldingBijlage) String() string          { return RepresentatieToString(mm) }

// Melding_MeldingStatus
func (mm Melding_MeldingStatus) GetID() any              { return mm.Rel_ID }
func (mm Melding_MeldingStatus) Metatype() Metatype      { return MetatypeGegevenselement }
func (mm *Melding_MeldingStatus) ClearID()               { mm.Rel_ID = 0 }
func (mm Melding_MeldingStatus) GetOpvoer() *time.Time   { return mm.Opvoer }
func (mm *Melding_MeldingStatus) SetOpvoer(t *time.Time) { mm.Opvoer = t }
func (mm Melding_MeldingStatus) GetAfvoer() *time.Time   { return mm.Afvoer }
func (mm *Melding_MeldingStatus) SetAfvoer(t *time.Time) { mm.Afvoer = t }
func (mm Melding_MeldingStatus) String() string          { return RepresentatieToString(mm) }

// Melding_MeldingPrioriteit
func (mm Melding_MeldingPrioriteit) GetID() any              { return mm.Rel_ID }
func (mm Melding_MeldingPrioriteit) Metatype() Metatype      { return MetatypeGegevenselement }
func (mm *Melding_MeldingPrioriteit) ClearID()               { mm.Rel_ID = 0 }
func (mm Melding_MeldingPrioriteit) GetOpvoer() *time.Time   { return mm.Opvoer }
func (mm *Melding_MeldingPrioriteit) SetOpvoer(t *time.Time) { mm.Opvoer = t }
func (mm Melding_MeldingPrioriteit) GetAfvoer() *time.Time   { return mm.Afvoer }
func (mm *Melding_MeldingPrioriteit) SetAfvoer(t *time.Time) { mm.Afvoer = t }
func (mm Melding_MeldingPrioriteit) String() string          { return RepresentatieToString(mm) }

// Melding_MeldingReactie
func (mm Melding_MeldingReactie) GetID() any              { return mm.Rel_ID }
func (mm Melding_MeldingReactie) Metatype() Metatype      { return MetatypeGegevenselement }
func (mm *Melding_MeldingReactie) ClearID()               { mm.Rel_ID = 0 }
func (mm Melding_MeldingReactie) GetOpvoer() *time.Time   { return mm.Opvoer }
func (mm *Melding_MeldingReactie) SetOpvoer(t *time.Time) { mm.Opvoer = t }
func (mm Melding_MeldingReactie) GetAfvoer() *time.Time   { return mm.Afvoer }
func (mm *Melding_MeldingReactie) SetAfvoer(t *time.Time) { mm.Afvoer = t }
func (mm Melding_MeldingReactie) String() string          { return RepresentatieToString(mm) }

// MeldingMelder
func (m MeldingMelder) GetID() any              { return m.Rel_ID }
func (m MeldingMelder) Metatype() Metatype      { return MetatypeRelatie }
func (m *MeldingMelder) ClearID()               { m.Rel_ID = 0 }
func (m MeldingMelder) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *MeldingMelder) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m MeldingMelder) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *MeldingMelder) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m MeldingMelder) String() string          { return RepresentatieToString(m) }

// MeldingBehandelaar
func (m MeldingBehandelaar) GetID() any              { return m.Rel_ID }
func (m MeldingBehandelaar) Metatype() Metatype      { return MetatypeRelatie }
func (m *MeldingBehandelaar) ClearID()               { m.Rel_ID = 0 }
func (m MeldingBehandelaar) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *MeldingBehandelaar) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m MeldingBehandelaar) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *MeldingBehandelaar) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m MeldingBehandelaar) String() string          { return RepresentatieToString(m) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// Melding_MeldingInhoud_Data
func (d Melding_MeldingInhoud_Data) GetID() any              { return d.Versie }
func (d Melding_MeldingInhoud_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Melding_MeldingInhoud_Data) ClearID()               { d.Versie = 0 }
func (d Melding_MeldingInhoud_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Melding_MeldingInhoud_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Melding_MeldingInhoud_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Melding_MeldingInhoud_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Melding_MeldingInhoud_Data) String() string          { return RepresentatieToString(d) }

// Melding_MeldingContext_Data
func (d Melding_MeldingContext_Data) GetID() any              { return d.Versie }
func (d Melding_MeldingContext_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Melding_MeldingContext_Data) ClearID()               { d.Versie = 0 }
func (d Melding_MeldingContext_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Melding_MeldingContext_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Melding_MeldingContext_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Melding_MeldingContext_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Melding_MeldingContext_Data) String() string          { return RepresentatieToString(d) }

// Melding_MeldingBijlage_Data
func (d Melding_MeldingBijlage_Data) GetID() any              { return d.Versie }
func (d Melding_MeldingBijlage_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Melding_MeldingBijlage_Data) ClearID()               { d.Versie = 0 }
func (d Melding_MeldingBijlage_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Melding_MeldingBijlage_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Melding_MeldingBijlage_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Melding_MeldingBijlage_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Melding_MeldingBijlage_Data) String() string          { return RepresentatieToString(d) }

// Melding_MeldingStatus_Data
func (d Melding_MeldingStatus_Data) GetID() any              { return d.Versie }
func (d Melding_MeldingStatus_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Melding_MeldingStatus_Data) ClearID()               { d.Versie = 0 }
func (d Melding_MeldingStatus_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Melding_MeldingStatus_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Melding_MeldingStatus_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Melding_MeldingStatus_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Melding_MeldingStatus_Data) String() string          { return RepresentatieToString(d) }

// Melding_MeldingPrioriteit_Data
func (d Melding_MeldingPrioriteit_Data) GetID() any              { return d.Versie }
func (d Melding_MeldingPrioriteit_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Melding_MeldingPrioriteit_Data) ClearID()               { d.Versie = 0 }
func (d Melding_MeldingPrioriteit_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Melding_MeldingPrioriteit_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Melding_MeldingPrioriteit_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Melding_MeldingPrioriteit_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Melding_MeldingPrioriteit_Data) String() string          { return RepresentatieToString(d) }

// Melding_MeldingReactie_Data
func (d Melding_MeldingReactie_Data) GetID() any              { return d.Versie }
func (d Melding_MeldingReactie_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Melding_MeldingReactie_Data) ClearID()               { d.Versie = 0 }
func (d Melding_MeldingReactie_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Melding_MeldingReactie_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Melding_MeldingReactie_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Melding_MeldingReactie_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Melding_MeldingReactie_Data) String() string          { return RepresentatieToString(d) }

// MeldingMelder_Data
func (d MeldingMelder_Data) GetID() any              { return d.Versie }
func (d MeldingMelder_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *MeldingMelder_Data) ClearID()               { d.Versie = 0 }
func (d MeldingMelder_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *MeldingMelder_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d MeldingMelder_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *MeldingMelder_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d MeldingMelder_Data) String() string          { return RepresentatieToString(d) }

// MeldingBehandelaar_Data
func (d MeldingBehandelaar_Data) GetID() any              { return d.Versie }
func (d MeldingBehandelaar_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *MeldingBehandelaar_Data) ClearID()               { d.Versie = 0 }
func (d MeldingBehandelaar_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *MeldingBehandelaar_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d MeldingBehandelaar_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *MeldingBehandelaar_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d MeldingBehandelaar_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

// Melding_MeldingStatus_Aanvang
func (m Melding_MeldingStatus_Aanvang) GetID() any              { return m.Versie }
func (m Melding_MeldingStatus_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (m *Melding_MeldingStatus_Aanvang) ClearID()               { m.Versie = 0 }
func (m Melding_MeldingStatus_Aanvang) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *Melding_MeldingStatus_Aanvang) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m Melding_MeldingStatus_Aanvang) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *Melding_MeldingStatus_Aanvang) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m Melding_MeldingStatus_Aanvang) String() string          { return RepresentatieToString(m) }

// Melding_MeldingStatus_Einde
func (m Melding_MeldingStatus_Einde) GetID() any              { return m.Versie }
func (m Melding_MeldingStatus_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (m *Melding_MeldingStatus_Einde) ClearID()               { m.Versie = 0 }
func (m Melding_MeldingStatus_Einde) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *Melding_MeldingStatus_Einde) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m Melding_MeldingStatus_Einde) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *Melding_MeldingStatus_Einde) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m Melding_MeldingStatus_Einde) String() string          { return RepresentatieToString(m) }

// MeldingBehandelaar_Aanvang
func (m MeldingBehandelaar_Aanvang) GetID() any              { return m.Versie }
func (m MeldingBehandelaar_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (m *MeldingBehandelaar_Aanvang) ClearID()               { m.Versie = 0 }
func (m MeldingBehandelaar_Aanvang) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *MeldingBehandelaar_Aanvang) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m MeldingBehandelaar_Aanvang) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *MeldingBehandelaar_Aanvang) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m MeldingBehandelaar_Aanvang) String() string          { return RepresentatieToString(m) }

// MeldingBehandelaar_Einde
func (m MeldingBehandelaar_Einde) GetID() any              { return m.Versie }
func (m MeldingBehandelaar_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (m *MeldingBehandelaar_Einde) ClearID()               { m.Versie = 0 }
func (m MeldingBehandelaar_Einde) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *MeldingBehandelaar_Einde) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m MeldingBehandelaar_Einde) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *MeldingBehandelaar_Einde) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m MeldingBehandelaar_Einde) String() string          { return RepresentatieToString(m) }

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// Melding_MeldingInhoud_Input
func (i Melding_MeldingInhoud_Input) GetID() any              { return i.Rel_ID }
func (i Melding_MeldingInhoud_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Melding_MeldingInhoud_Input) ClearID()               { i.Rel_ID = 0 }
func (i Melding_MeldingInhoud_Input) GetOpvoer() *time.Time   { return nil }
func (i *Melding_MeldingInhoud_Input) SetOpvoer(t *time.Time) {}
func (i Melding_MeldingInhoud_Input) GetAfvoer() *time.Time   { return nil }
func (i *Melding_MeldingInhoud_Input) SetAfvoer(t *time.Time) {}
func (i Melding_MeldingInhoud_Input) String() string          { return RepresentatieToString(i) }

// Melding_MeldingContext_Input
func (i Melding_MeldingContext_Input) GetID() any              { return i.Rel_ID }
func (i Melding_MeldingContext_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Melding_MeldingContext_Input) ClearID()               { i.Rel_ID = 0 }
func (i Melding_MeldingContext_Input) GetOpvoer() *time.Time   { return nil }
func (i *Melding_MeldingContext_Input) SetOpvoer(t *time.Time) {}
func (i Melding_MeldingContext_Input) GetAfvoer() *time.Time   { return nil }
func (i *Melding_MeldingContext_Input) SetAfvoer(t *time.Time) {}
func (i Melding_MeldingContext_Input) String() string          { return RepresentatieToString(i) }

// Melding_MeldingBijlage_Input
func (i Melding_MeldingBijlage_Input) GetID() any              { return i.Rel_ID }
func (i Melding_MeldingBijlage_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Melding_MeldingBijlage_Input) ClearID()               { i.Rel_ID = 0 }
func (i Melding_MeldingBijlage_Input) GetOpvoer() *time.Time   { return nil }
func (i *Melding_MeldingBijlage_Input) SetOpvoer(t *time.Time) {}
func (i Melding_MeldingBijlage_Input) GetAfvoer() *time.Time   { return nil }
func (i *Melding_MeldingBijlage_Input) SetAfvoer(t *time.Time) {}
func (i Melding_MeldingBijlage_Input) String() string          { return RepresentatieToString(i) }

// Melding_MeldingStatus_Input
func (i Melding_MeldingStatus_Input) GetID() any              { return i.Rel_ID }
func (i Melding_MeldingStatus_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Melding_MeldingStatus_Input) ClearID()               { i.Rel_ID = 0 }
func (i Melding_MeldingStatus_Input) GetOpvoer() *time.Time   { return nil }
func (i *Melding_MeldingStatus_Input) SetOpvoer(t *time.Time) {}
func (i Melding_MeldingStatus_Input) GetAfvoer() *time.Time   { return nil }
func (i *Melding_MeldingStatus_Input) SetAfvoer(t *time.Time) {}
func (i Melding_MeldingStatus_Input) String() string          { return RepresentatieToString(i) }

// Melding_MeldingPrioriteit_Input
func (i Melding_MeldingPrioriteit_Input) GetID() any              { return i.Rel_ID }
func (i Melding_MeldingPrioriteit_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Melding_MeldingPrioriteit_Input) ClearID()               { i.Rel_ID = 0 }
func (i Melding_MeldingPrioriteit_Input) GetOpvoer() *time.Time   { return nil }
func (i *Melding_MeldingPrioriteit_Input) SetOpvoer(t *time.Time) {}
func (i Melding_MeldingPrioriteit_Input) GetAfvoer() *time.Time   { return nil }
func (i *Melding_MeldingPrioriteit_Input) SetAfvoer(t *time.Time) {}
func (i Melding_MeldingPrioriteit_Input) String() string          { return RepresentatieToString(i) }

// Melding_MeldingReactie_Input
func (i Melding_MeldingReactie_Input) GetID() any              { return i.Rel_ID }
func (i Melding_MeldingReactie_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Melding_MeldingReactie_Input) ClearID()               { i.Rel_ID = 0 }
func (i Melding_MeldingReactie_Input) GetOpvoer() *time.Time   { return nil }
func (i *Melding_MeldingReactie_Input) SetOpvoer(t *time.Time) {}
func (i Melding_MeldingReactie_Input) GetAfvoer() *time.Time   { return nil }
func (i *Melding_MeldingReactie_Input) SetAfvoer(t *time.Time) {}
func (i Melding_MeldingReactie_Input) String() string          { return RepresentatieToString(i) }

// MeldingMelder_Input
func (i MeldingMelder_Input) GetID() any              { return i.Rel_ID }
func (i MeldingMelder_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *MeldingMelder_Input) ClearID()               { i.Rel_ID = 0 }
func (i MeldingMelder_Input) GetOpvoer() *time.Time   { return nil }
func (i *MeldingMelder_Input) SetOpvoer(t *time.Time) {}
func (i MeldingMelder_Input) GetAfvoer() *time.Time   { return nil }
func (i *MeldingMelder_Input) SetAfvoer(t *time.Time) {}
func (i MeldingMelder_Input) String() string          { return RepresentatieToString(i) }

// MeldingBehandelaar_Input
func (i MeldingBehandelaar_Input) GetID() any              { return i.Rel_ID }
func (i MeldingBehandelaar_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *MeldingBehandelaar_Input) ClearID()               { i.Rel_ID = 0 }
func (i MeldingBehandelaar_Input) GetOpvoer() *time.Time   { return nil }
func (i *MeldingBehandelaar_Input) SetOpvoer(t *time.Time) {}
func (i MeldingBehandelaar_Input) GetAfvoer() *time.Time   { return nil }
func (i *MeldingBehandelaar_Input) SetAfvoer(t *time.Time) {}
func (i MeldingBehandelaar_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (m *Melding) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range m.MeldingInhouden {
		if m.MeldingInhouden[idx].Melding_ID == 0 {
			m.MeldingInhouden[idx].Melding_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingInhoud", Representatie: &m.MeldingInhouden[idx]})
	}
	for idx := range m.MeldingContexten {
		if m.MeldingContexten[idx].Melding_ID == 0 {
			m.MeldingContexten[idx].Melding_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingContext", Representatie: &m.MeldingContexten[idx]})
	}
	for idx := range m.MeldingBijlagen {
		if m.MeldingBijlagen[idx].Melding_ID == 0 {
			m.MeldingBijlagen[idx].Melding_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingBijlage", Representatie: &m.MeldingBijlagen[idx]})
	}
	for idx := range m.MeldingStatussen {
		if m.MeldingStatussen[idx].Melding_ID == 0 {
			m.MeldingStatussen[idx].Melding_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingStatus", Representatie: &m.MeldingStatussen[idx]})
	}
	for idx := range m.MeldingPrioriteiten {
		if m.MeldingPrioriteiten[idx].Melding_ID == 0 {
			m.MeldingPrioriteiten[idx].Melding_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingPrioriteit", Representatie: &m.MeldingPrioriteiten[idx]})
	}
	for idx := range m.MeldingReacties {
		if m.MeldingReacties[idx].Melding_ID == 0 {
			m.MeldingReacties[idx].Melding_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingReactie", Representatie: &m.MeldingReacties[idx]})
	}
	for idx := range m.MeldingMelders {
		if m.MeldingMelders[idx].Melding_ID == 0 {
			m.MeldingMelders[idx].Melding_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "MeldingMelder", Representatie: &m.MeldingMelders[idx]})
	}
	for idx := range m.MeldingBehandelaars {
		if m.MeldingBehandelaars[idx].Melding_ID == 0 {
			m.MeldingBehandelaars[idx].Melding_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "MeldingBehandelaar", Representatie: &m.MeldingBehandelaars[idx]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *Melding_MeldingInhoud) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Melding_ID == 0 {
			h.Data[i].Melding_ID = h.Melding_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingInhoud_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Melding_MeldingContext) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Melding_ID == 0 {
			h.Data[i].Melding_ID = h.Melding_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingContext_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Melding_MeldingBijlage) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Melding_ID == 0 {
			h.Data[i].Melding_ID = h.Melding_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingBijlage_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Melding_MeldingStatus) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Melding_ID == 0 {
			h.Data[i].Melding_ID = h.Melding_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingStatus_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Melding_ID == 0 {
			h.Aanvang[i].Melding_ID = h.Melding_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingStatus_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Melding_ID == 0 {
			h.Einde[i].Melding_ID = h.Melding_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingStatus_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *Melding_MeldingPrioriteit) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Melding_ID == 0 {
			h.Data[i].Melding_ID = h.Melding_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingPrioriteit_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Melding_MeldingReactie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Melding_ID == 0 {
			h.Data[i].Melding_ID = h.Melding_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Melding_MeldingReactie_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *MeldingMelder) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Melding_ID == 0 {
			h.Data[i].Melding_ID = h.Melding_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "MeldingMelder_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *MeldingBehandelaar) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Melding_ID == 0 {
			h.Data[i].Melding_ID = h.Melding_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "MeldingBehandelaar_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Melding_ID == 0 {
			h.Aanvang[i].Melding_ID = h.Melding_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "MeldingBehandelaar_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Melding_ID == 0 {
			h.Einde[i].Melding_ID = h.Melding_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "MeldingBehandelaar_Einde", Representatie: &h.Einde[i]})
	}
	return result
}
