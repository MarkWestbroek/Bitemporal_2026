package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// Afdeling
func (a Afdeling) GetID() any              { return a.ID }
func (a Afdeling) Metatype() Metatype      { return MetatypeEntiteit }
func (a *Afdeling) ClearID()               { a.ID = 0 }
func (a Afdeling) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Afdeling) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Afdeling) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Afdeling) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a Afdeling) String() string          { return RepresentatieToString(a) }

// Medewerker
func (m Medewerker) GetID() any              { return m.ID }
func (m Medewerker) Metatype() Metatype      { return MetatypeEntiteit }
func (m *Medewerker) ClearID()               { m.ID = 0 }
func (m Medewerker) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *Medewerker) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m Medewerker) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *Medewerker) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m Medewerker) String() string          { return RepresentatieToString(m) }

// Gemeentedeel
func (g Gemeentedeel) GetID() any              { return g.ID }
func (g Gemeentedeel) Metatype() Metatype      { return MetatypeEntiteit }
func (g *Gemeentedeel) ClearID()               { g.ID = 0 }
func (g Gemeentedeel) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gemeentedeel) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gemeentedeel) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gemeentedeel) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gemeentedeel) String() string          { return RepresentatieToString(g) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// Afdeling_Afdelingsnaam
func (aa Afdeling_Afdelingsnaam) GetID() any              { return aa.Rel_ID }
func (aa Afdeling_Afdelingsnaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (aa *Afdeling_Afdelingsnaam) ClearID()               { aa.Rel_ID = 0 }
func (aa Afdeling_Afdelingsnaam) GetOpvoer() *time.Time   { return aa.Opvoer }
func (aa *Afdeling_Afdelingsnaam) SetOpvoer(t *time.Time) { aa.Opvoer = t }
func (aa Afdeling_Afdelingsnaam) GetAfvoer() *time.Time   { return aa.Afvoer }
func (aa *Afdeling_Afdelingsnaam) SetAfvoer(t *time.Time) { aa.Afvoer = t }
func (aa Afdeling_Afdelingsnaam) String() string          { return RepresentatieToString(aa) }

// Afdelingsorganisatie
func (a Afdelingsorganisatie) GetID() any              { return a.Rel_ID }
func (a Afdelingsorganisatie) Metatype() Metatype      { return MetatypeRelatie }
func (a *Afdelingsorganisatie) ClearID()               { a.Rel_ID = 0 }
func (a Afdelingsorganisatie) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Afdelingsorganisatie) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Afdelingsorganisatie) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Afdelingsorganisatie) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a Afdelingsorganisatie) String() string          { return RepresentatieToString(a) }

// Medewerker_Medewerkernaam
func (mm Medewerker_Medewerkernaam) GetID() any              { return mm.Rel_ID }
func (mm Medewerker_Medewerkernaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (mm *Medewerker_Medewerkernaam) ClearID()               { mm.Rel_ID = 0 }
func (mm Medewerker_Medewerkernaam) GetOpvoer() *time.Time   { return mm.Opvoer }
func (mm *Medewerker_Medewerkernaam) SetOpvoer(t *time.Time) { mm.Opvoer = t }
func (mm Medewerker_Medewerkernaam) GetAfvoer() *time.Time   { return mm.Afvoer }
func (mm *Medewerker_Medewerkernaam) SetAfvoer(t *time.Time) { mm.Afvoer = t }
func (mm Medewerker_Medewerkernaam) String() string          { return RepresentatieToString(mm) }

// Medewerker_Aanstelling
func (ma Medewerker_Aanstelling) GetID() any              { return ma.Rel_ID }
func (ma Medewerker_Aanstelling) Metatype() Metatype      { return MetatypeGegevenselement }
func (ma *Medewerker_Aanstelling) ClearID()               { ma.Rel_ID = 0 }
func (ma Medewerker_Aanstelling) GetOpvoer() *time.Time   { return ma.Opvoer }
func (ma *Medewerker_Aanstelling) SetOpvoer(t *time.Time) { ma.Opvoer = t }
func (ma Medewerker_Aanstelling) GetAfvoer() *time.Time   { return ma.Afvoer }
func (ma *Medewerker_Aanstelling) SetAfvoer(t *time.Time) { ma.Afvoer = t }
func (ma Medewerker_Aanstelling) String() string          { return RepresentatieToString(ma) }

// Medewerker_Contactkanaal
func (mc Medewerker_Contactkanaal) GetID() any              { return mc.Rel_ID }
func (mc Medewerker_Contactkanaal) Metatype() Metatype      { return MetatypeGegevenselement }
func (mc *Medewerker_Contactkanaal) ClearID()               { mc.Rel_ID = 0 }
func (mc Medewerker_Contactkanaal) GetOpvoer() *time.Time   { return mc.Opvoer }
func (mc *Medewerker_Contactkanaal) SetOpvoer(t *time.Time) { mc.Opvoer = t }
func (mc Medewerker_Contactkanaal) GetAfvoer() *time.Time   { return mc.Afvoer }
func (mc *Medewerker_Contactkanaal) SetAfvoer(t *time.Time) { mc.Afvoer = t }
func (mc Medewerker_Contactkanaal) String() string          { return RepresentatieToString(mc) }

// Medewerkerafdeling
func (m Medewerkerafdeling) GetID() any              { return m.Rel_ID }
func (m Medewerkerafdeling) Metatype() Metatype      { return MetatypeRelatie }
func (m *Medewerkerafdeling) ClearID()               { m.Rel_ID = 0 }
func (m Medewerkerafdeling) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *Medewerkerafdeling) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m Medewerkerafdeling) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *Medewerkerafdeling) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m Medewerkerafdeling) String() string          { return RepresentatieToString(m) }

// Gemeentedeel_Wijkaanduiding
func (gw Gemeentedeel_Wijkaanduiding) GetID() any              { return gw.Rel_ID }
func (gw Gemeentedeel_Wijkaanduiding) Metatype() Metatype      { return MetatypeGegevenselement }
func (gw *Gemeentedeel_Wijkaanduiding) ClearID()               { gw.Rel_ID = 0 }
func (gw Gemeentedeel_Wijkaanduiding) GetOpvoer() *time.Time   { return gw.Opvoer }
func (gw *Gemeentedeel_Wijkaanduiding) SetOpvoer(t *time.Time) { gw.Opvoer = t }
func (gw Gemeentedeel_Wijkaanduiding) GetAfvoer() *time.Time   { return gw.Afvoer }
func (gw *Gemeentedeel_Wijkaanduiding) SetAfvoer(t *time.Time) { gw.Afvoer = t }
func (gw Gemeentedeel_Wijkaanduiding) String() string          { return RepresentatieToString(gw) }

// Gemeentedeelgemeente
func (g Gemeentedeelgemeente) GetID() any              { return g.Rel_ID }
func (g Gemeentedeelgemeente) Metatype() Metatype      { return MetatypeRelatie }
func (g *Gemeentedeelgemeente) ClearID()               { g.Rel_ID = 0 }
func (g Gemeentedeelgemeente) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gemeentedeelgemeente) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gemeentedeelgemeente) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gemeentedeelgemeente) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gemeentedeelgemeente) String() string          { return RepresentatieToString(g) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// Afdeling_Afdelingsnaam_Data
func (d Afdeling_Afdelingsnaam_Data) GetID() any              { return d.Versie }
func (d Afdeling_Afdelingsnaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Afdeling_Afdelingsnaam_Data) ClearID()               { d.Versie = 0 }
func (d Afdeling_Afdelingsnaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Afdeling_Afdelingsnaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Afdeling_Afdelingsnaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Afdeling_Afdelingsnaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Afdeling_Afdelingsnaam_Data) String() string          { return RepresentatieToString(d) }

// Afdelingsorganisatie_Data
func (d Afdelingsorganisatie_Data) GetID() any              { return d.Versie }
func (d Afdelingsorganisatie_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Afdelingsorganisatie_Data) ClearID()               { d.Versie = 0 }
func (d Afdelingsorganisatie_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Afdelingsorganisatie_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Afdelingsorganisatie_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Afdelingsorganisatie_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Afdelingsorganisatie_Data) String() string          { return RepresentatieToString(d) }

// Medewerker_Medewerkernaam_Data
func (d Medewerker_Medewerkernaam_Data) GetID() any              { return d.Versie }
func (d Medewerker_Medewerkernaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Medewerker_Medewerkernaam_Data) ClearID()               { d.Versie = 0 }
func (d Medewerker_Medewerkernaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Medewerker_Medewerkernaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Medewerker_Medewerkernaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Medewerker_Medewerkernaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Medewerker_Medewerkernaam_Data) String() string          { return RepresentatieToString(d) }

// Medewerker_Aanstelling_Data
func (d Medewerker_Aanstelling_Data) GetID() any              { return d.Versie }
func (d Medewerker_Aanstelling_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Medewerker_Aanstelling_Data) ClearID()               { d.Versie = 0 }
func (d Medewerker_Aanstelling_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Medewerker_Aanstelling_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Medewerker_Aanstelling_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Medewerker_Aanstelling_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Medewerker_Aanstelling_Data) String() string          { return RepresentatieToString(d) }

// Medewerker_Contactkanaal_Data
func (d Medewerker_Contactkanaal_Data) GetID() any              { return d.Versie }
func (d Medewerker_Contactkanaal_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Medewerker_Contactkanaal_Data) ClearID()               { d.Versie = 0 }
func (d Medewerker_Contactkanaal_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Medewerker_Contactkanaal_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Medewerker_Contactkanaal_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Medewerker_Contactkanaal_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Medewerker_Contactkanaal_Data) String() string          { return RepresentatieToString(d) }

// Medewerkerafdeling_Data
func (d Medewerkerafdeling_Data) GetID() any              { return d.Versie }
func (d Medewerkerafdeling_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Medewerkerafdeling_Data) ClearID()               { d.Versie = 0 }
func (d Medewerkerafdeling_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Medewerkerafdeling_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Medewerkerafdeling_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Medewerkerafdeling_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Medewerkerafdeling_Data) String() string          { return RepresentatieToString(d) }

// Gemeentedeel_Wijkaanduiding_Data
func (d Gemeentedeel_Wijkaanduiding_Data) GetID() any              { return d.Versie }
func (d Gemeentedeel_Wijkaanduiding_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Gemeentedeel_Wijkaanduiding_Data) ClearID()               { d.Versie = 0 }
func (d Gemeentedeel_Wijkaanduiding_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Gemeentedeel_Wijkaanduiding_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Gemeentedeel_Wijkaanduiding_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Gemeentedeel_Wijkaanduiding_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Gemeentedeel_Wijkaanduiding_Data) String() string          { return RepresentatieToString(d) }

// Gemeentedeelgemeente_Data
func (d Gemeentedeelgemeente_Data) GetID() any              { return d.Versie }
func (d Gemeentedeelgemeente_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Gemeentedeelgemeente_Data) ClearID()               { d.Versie = 0 }
func (d Gemeentedeelgemeente_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Gemeentedeelgemeente_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Gemeentedeelgemeente_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Gemeentedeelgemeente_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Gemeentedeelgemeente_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

// Afdeling_Aanvang
func (a Afdeling_Aanvang) GetID() any              { return a.Versie }
func (a Afdeling_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *Afdeling_Aanvang) ClearID()               { a.Versie = 0 }
func (a Afdeling_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Afdeling_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Afdeling_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Afdeling_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a Afdeling_Aanvang) String() string          { return RepresentatieToString(a) }

// Afdeling_Einde
func (a Afdeling_Einde) GetID() any              { return a.Versie }
func (a Afdeling_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *Afdeling_Einde) ClearID()               { a.Versie = 0 }
func (a Afdeling_Einde) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Afdeling_Einde) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Afdeling_Einde) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Afdeling_Einde) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a Afdeling_Einde) String() string          { return RepresentatieToString(a) }

// Medewerker_Aanvang
func (m Medewerker_Aanvang) GetID() any              { return m.Versie }
func (m Medewerker_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (m *Medewerker_Aanvang) ClearID()               { m.Versie = 0 }
func (m Medewerker_Aanvang) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *Medewerker_Aanvang) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m Medewerker_Aanvang) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *Medewerker_Aanvang) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m Medewerker_Aanvang) String() string          { return RepresentatieToString(m) }

// Medewerker_Einde
func (m Medewerker_Einde) GetID() any              { return m.Versie }
func (m Medewerker_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (m *Medewerker_Einde) ClearID()               { m.Versie = 0 }
func (m Medewerker_Einde) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *Medewerker_Einde) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m Medewerker_Einde) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *Medewerker_Einde) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m Medewerker_Einde) String() string          { return RepresentatieToString(m) }

// Gemeentedeel_Aanvang
func (g Gemeentedeel_Aanvang) GetID() any              { return g.Versie }
func (g Gemeentedeel_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gemeentedeel_Aanvang) ClearID()               { g.Versie = 0 }
func (g Gemeentedeel_Aanvang) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gemeentedeel_Aanvang) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gemeentedeel_Aanvang) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gemeentedeel_Aanvang) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gemeentedeel_Aanvang) String() string          { return RepresentatieToString(g) }

// Gemeentedeel_Einde
func (g Gemeentedeel_Einde) GetID() any              { return g.Versie }
func (g Gemeentedeel_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gemeentedeel_Einde) ClearID()               { g.Versie = 0 }
func (g Gemeentedeel_Einde) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gemeentedeel_Einde) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gemeentedeel_Einde) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gemeentedeel_Einde) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gemeentedeel_Einde) String() string          { return RepresentatieToString(g) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

// Afdelingsorganisatie_Aanvang
func (a Afdelingsorganisatie_Aanvang) GetID() any              { return a.Versie }
func (a Afdelingsorganisatie_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *Afdelingsorganisatie_Aanvang) ClearID()               { a.Versie = 0 }
func (a Afdelingsorganisatie_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Afdelingsorganisatie_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Afdelingsorganisatie_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Afdelingsorganisatie_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a Afdelingsorganisatie_Aanvang) String() string          { return RepresentatieToString(a) }

// Afdelingsorganisatie_Einde
func (a Afdelingsorganisatie_Einde) GetID() any              { return a.Versie }
func (a Afdelingsorganisatie_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *Afdelingsorganisatie_Einde) ClearID()               { a.Versie = 0 }
func (a Afdelingsorganisatie_Einde) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *Afdelingsorganisatie_Einde) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a Afdelingsorganisatie_Einde) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *Afdelingsorganisatie_Einde) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a Afdelingsorganisatie_Einde) String() string          { return RepresentatieToString(a) }

// Medewerkerafdeling_Aanvang
func (m Medewerkerafdeling_Aanvang) GetID() any              { return m.Versie }
func (m Medewerkerafdeling_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (m *Medewerkerafdeling_Aanvang) ClearID()               { m.Versie = 0 }
func (m Medewerkerafdeling_Aanvang) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *Medewerkerafdeling_Aanvang) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m Medewerkerafdeling_Aanvang) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *Medewerkerafdeling_Aanvang) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m Medewerkerafdeling_Aanvang) String() string          { return RepresentatieToString(m) }

// Medewerkerafdeling_Einde
func (m Medewerkerafdeling_Einde) GetID() any              { return m.Versie }
func (m Medewerkerafdeling_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (m *Medewerkerafdeling_Einde) ClearID()               { m.Versie = 0 }
func (m Medewerkerafdeling_Einde) GetOpvoer() *time.Time   { return m.Opvoer }
func (m *Medewerkerafdeling_Einde) SetOpvoer(t *time.Time) { m.Opvoer = t }
func (m Medewerkerafdeling_Einde) GetAfvoer() *time.Time   { return m.Afvoer }
func (m *Medewerkerafdeling_Einde) SetAfvoer(t *time.Time) { m.Afvoer = t }
func (m Medewerkerafdeling_Einde) String() string          { return RepresentatieToString(m) }

// Gemeentedeelgemeente_Aanvang
func (g Gemeentedeelgemeente_Aanvang) GetID() any              { return g.Versie }
func (g Gemeentedeelgemeente_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gemeentedeelgemeente_Aanvang) ClearID()               { g.Versie = 0 }
func (g Gemeentedeelgemeente_Aanvang) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gemeentedeelgemeente_Aanvang) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gemeentedeelgemeente_Aanvang) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gemeentedeelgemeente_Aanvang) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gemeentedeelgemeente_Aanvang) String() string          { return RepresentatieToString(g) }

// Gemeentedeelgemeente_Einde
func (g Gemeentedeelgemeente_Einde) GetID() any              { return g.Versie }
func (g Gemeentedeelgemeente_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (g *Gemeentedeelgemeente_Einde) ClearID()               { g.Versie = 0 }
func (g Gemeentedeelgemeente_Einde) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gemeentedeelgemeente_Einde) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gemeentedeelgemeente_Einde) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gemeentedeelgemeente_Einde) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gemeentedeelgemeente_Einde) String() string          { return RepresentatieToString(g) }

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// Afdeling_Afdelingsnaam_Input
func (i Afdeling_Afdelingsnaam_Input) GetID() any              { return i.Rel_ID }
func (i Afdeling_Afdelingsnaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Afdeling_Afdelingsnaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i Afdeling_Afdelingsnaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *Afdeling_Afdelingsnaam_Input) SetOpvoer(t *time.Time) {}
func (i Afdeling_Afdelingsnaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *Afdeling_Afdelingsnaam_Input) SetAfvoer(t *time.Time) {}
func (i Afdeling_Afdelingsnaam_Input) String() string          { return RepresentatieToString(i) }

// Afdelingsorganisatie_Input
func (i Afdelingsorganisatie_Input) GetID() any              { return i.Rel_ID }
func (i Afdelingsorganisatie_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *Afdelingsorganisatie_Input) ClearID()               { i.Rel_ID = 0 }
func (i Afdelingsorganisatie_Input) GetOpvoer() *time.Time   { return nil }
func (i *Afdelingsorganisatie_Input) SetOpvoer(t *time.Time) {}
func (i Afdelingsorganisatie_Input) GetAfvoer() *time.Time   { return nil }
func (i *Afdelingsorganisatie_Input) SetAfvoer(t *time.Time) {}
func (i Afdelingsorganisatie_Input) String() string          { return RepresentatieToString(i) }

// Medewerker_Medewerkernaam_Input
func (i Medewerker_Medewerkernaam_Input) GetID() any              { return i.Rel_ID }
func (i Medewerker_Medewerkernaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Medewerker_Medewerkernaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i Medewerker_Medewerkernaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *Medewerker_Medewerkernaam_Input) SetOpvoer(t *time.Time) {}
func (i Medewerker_Medewerkernaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *Medewerker_Medewerkernaam_Input) SetAfvoer(t *time.Time) {}
func (i Medewerker_Medewerkernaam_Input) String() string          { return RepresentatieToString(i) }

// Medewerker_Aanstelling_Input
func (i Medewerker_Aanstelling_Input) GetID() any              { return i.Rel_ID }
func (i Medewerker_Aanstelling_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Medewerker_Aanstelling_Input) ClearID()               { i.Rel_ID = 0 }
func (i Medewerker_Aanstelling_Input) GetOpvoer() *time.Time   { return nil }
func (i *Medewerker_Aanstelling_Input) SetOpvoer(t *time.Time) {}
func (i Medewerker_Aanstelling_Input) GetAfvoer() *time.Time   { return nil }
func (i *Medewerker_Aanstelling_Input) SetAfvoer(t *time.Time) {}
func (i Medewerker_Aanstelling_Input) String() string          { return RepresentatieToString(i) }

// Medewerker_Contactkanaal_Input
func (i Medewerker_Contactkanaal_Input) GetID() any              { return i.Rel_ID }
func (i Medewerker_Contactkanaal_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Medewerker_Contactkanaal_Input) ClearID()               { i.Rel_ID = 0 }
func (i Medewerker_Contactkanaal_Input) GetOpvoer() *time.Time   { return nil }
func (i *Medewerker_Contactkanaal_Input) SetOpvoer(t *time.Time) {}
func (i Medewerker_Contactkanaal_Input) GetAfvoer() *time.Time   { return nil }
func (i *Medewerker_Contactkanaal_Input) SetAfvoer(t *time.Time) {}
func (i Medewerker_Contactkanaal_Input) String() string          { return RepresentatieToString(i) }

// Medewerkerafdeling_Input
func (i Medewerkerafdeling_Input) GetID() any              { return i.Rel_ID }
func (i Medewerkerafdeling_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *Medewerkerafdeling_Input) ClearID()               { i.Rel_ID = 0 }
func (i Medewerkerafdeling_Input) GetOpvoer() *time.Time   { return nil }
func (i *Medewerkerafdeling_Input) SetOpvoer(t *time.Time) {}
func (i Medewerkerafdeling_Input) GetAfvoer() *time.Time   { return nil }
func (i *Medewerkerafdeling_Input) SetAfvoer(t *time.Time) {}
func (i Medewerkerafdeling_Input) String() string          { return RepresentatieToString(i) }

// Gemeentedeel_Wijkaanduiding_Input
func (i Gemeentedeel_Wijkaanduiding_Input) GetID() any              { return i.Rel_ID }
func (i Gemeentedeel_Wijkaanduiding_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Gemeentedeel_Wijkaanduiding_Input) ClearID()               { i.Rel_ID = 0 }
func (i Gemeentedeel_Wijkaanduiding_Input) GetOpvoer() *time.Time   { return nil }
func (i *Gemeentedeel_Wijkaanduiding_Input) SetOpvoer(t *time.Time) {}
func (i Gemeentedeel_Wijkaanduiding_Input) GetAfvoer() *time.Time   { return nil }
func (i *Gemeentedeel_Wijkaanduiding_Input) SetAfvoer(t *time.Time) {}
func (i Gemeentedeel_Wijkaanduiding_Input) String() string          { return RepresentatieToString(i) }

// Gemeentedeelgemeente_Input
func (i Gemeentedeelgemeente_Input) GetID() any              { return i.Rel_ID }
func (i Gemeentedeelgemeente_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *Gemeentedeelgemeente_Input) ClearID()               { i.Rel_ID = 0 }
func (i Gemeentedeelgemeente_Input) GetOpvoer() *time.Time   { return nil }
func (i *Gemeentedeelgemeente_Input) SetOpvoer(t *time.Time) {}
func (i Gemeentedeelgemeente_Input) GetAfvoer() *time.Time   { return nil }
func (i *Gemeentedeelgemeente_Input) SetAfvoer(t *time.Time) {}
func (i Gemeentedeelgemeente_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (a *Afdeling) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range a.Afdelingsnaam {
		if a.Afdelingsnaam[idx].Afdeling_ID == 0 {
			a.Afdelingsnaam[idx].Afdeling_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Afdeling_Afdelingsnaam", Representatie: &a.Afdelingsnaam[idx]})
	}
	for idx := range a.Organisatie {
		if a.Organisatie[idx].Afdeling_ID == 0 {
			a.Organisatie[idx].Afdeling_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Afdelingsorganisatie", Representatie: &a.Organisatie[idx]})
	}
	for idx := range a.Aanvang {
		if a.Aanvang[idx].Afdeling_ID == 0 {
			a.Aanvang[idx].Afdeling_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Afdeling_Aanvang", Representatie: &a.Aanvang[idx]})
	}
	for idx := range a.Einde {
		if a.Einde[idx].Afdeling_ID == 0 {
			a.Einde[idx].Afdeling_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Afdeling_Einde", Representatie: &a.Einde[idx]})
	}
	return result
}

func (m *Medewerker) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range m.Medewerkernaam {
		if m.Medewerkernaam[idx].Medewerker_ID == 0 {
			m.Medewerkernaam[idx].Medewerker_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerker_Medewerkernaam", Representatie: &m.Medewerkernaam[idx]})
	}
	for idx := range m.Aanstelling {
		if m.Aanstelling[idx].Medewerker_ID == 0 {
			m.Aanstelling[idx].Medewerker_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerker_Aanstelling", Representatie: &m.Aanstelling[idx]})
	}
	for idx := range m.Kanalen {
		if m.Kanalen[idx].Medewerker_ID == 0 {
			m.Kanalen[idx].Medewerker_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerker_Contactkanaal", Representatie: &m.Kanalen[idx]})
	}
	for idx := range m.Afdeling {
		if m.Afdeling[idx].Medewerker_ID == 0 {
			m.Afdeling[idx].Medewerker_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerkerafdeling", Representatie: &m.Afdeling[idx]})
	}
	for idx := range m.Aanvang {
		if m.Aanvang[idx].Medewerker_ID == 0 {
			m.Aanvang[idx].Medewerker_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerker_Aanvang", Representatie: &m.Aanvang[idx]})
	}
	for idx := range m.Einde {
		if m.Einde[idx].Medewerker_ID == 0 {
			m.Einde[idx].Medewerker_ID = m.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerker_Einde", Representatie: &m.Einde[idx]})
	}
	return result
}

func (g *Gemeentedeel) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range g.Wijkaanduiding {
		if g.Wijkaanduiding[idx].Gemeentedeel_ID == 0 {
			g.Wijkaanduiding[idx].Gemeentedeel_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gemeentedeel_Wijkaanduiding", Representatie: &g.Wijkaanduiding[idx]})
	}
	for idx := range g.Gemeente {
		if g.Gemeente[idx].Gemeentedeel_ID == 0 {
			g.Gemeente[idx].Gemeentedeel_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gemeentedeelgemeente", Representatie: &g.Gemeente[idx]})
	}
	for idx := range g.Aanvang {
		if g.Aanvang[idx].Gemeentedeel_ID == 0 {
			g.Aanvang[idx].Gemeentedeel_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gemeentedeel_Aanvang", Representatie: &g.Aanvang[idx]})
	}
	for idx := range g.Einde {
		if g.Einde[idx].Gemeentedeel_ID == 0 {
			g.Einde[idx].Gemeentedeel_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gemeentedeel_Einde", Representatie: &g.Einde[idx]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *Afdeling_Afdelingsnaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Afdeling_ID == 0 {
			h.Data[i].Afdeling_ID = h.Afdeling_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Afdeling_Afdelingsnaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Afdelingsorganisatie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Afdeling_ID == 0 {
			h.Data[i].Afdeling_ID = h.Afdeling_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Afdelingsorganisatie_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Afdeling_ID == 0 {
			h.Aanvang[i].Afdeling_ID = h.Afdeling_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Afdelingsorganisatie_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Afdeling_ID == 0 {
			h.Einde[i].Afdeling_ID = h.Afdeling_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Afdelingsorganisatie_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *Medewerker_Medewerkernaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Medewerker_ID == 0 {
			h.Data[i].Medewerker_ID = h.Medewerker_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerker_Medewerkernaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Medewerker_Aanstelling) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Medewerker_ID == 0 {
			h.Data[i].Medewerker_ID = h.Medewerker_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerker_Aanstelling_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Medewerker_Contactkanaal) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Medewerker_ID == 0 {
			h.Data[i].Medewerker_ID = h.Medewerker_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerker_Contactkanaal_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Medewerkerafdeling) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Medewerker_ID == 0 {
			h.Data[i].Medewerker_ID = h.Medewerker_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerkerafdeling_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Medewerker_ID == 0 {
			h.Aanvang[i].Medewerker_ID = h.Medewerker_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerkerafdeling_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Medewerker_ID == 0 {
			h.Einde[i].Medewerker_ID = h.Medewerker_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Medewerkerafdeling_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *Gemeentedeel_Wijkaanduiding) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Gemeentedeel_ID == 0 {
			h.Data[i].Gemeentedeel_ID = h.Gemeentedeel_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gemeentedeel_Wijkaanduiding_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Gemeentedeelgemeente) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Gemeentedeel_ID == 0 {
			h.Data[i].Gemeentedeel_ID = h.Gemeentedeel_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gemeentedeelgemeente_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Gemeentedeel_ID == 0 {
			h.Aanvang[i].Gemeentedeel_ID = h.Gemeentedeel_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gemeentedeelgemeente_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Gemeentedeel_ID == 0 {
			h.Einde[i].Gemeentedeel_ID = h.Gemeentedeel_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Gemeentedeelgemeente_Einde", Representatie: &h.Einde[i]})
	}
	return result
}
