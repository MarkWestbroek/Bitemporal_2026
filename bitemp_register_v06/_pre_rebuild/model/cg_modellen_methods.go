package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// Initiatief
func (i Initiatief) GetID() any              { return i.ID }
func (i Initiatief) Metatype() Metatype      { return MetatypeEntiteit }
func (i *Initiatief) ClearID()               { i.ID = 0 }
func (i Initiatief) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *Initiatief) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i Initiatief) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *Initiatief) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i Initiatief) String() string          { return RepresentatieToString(i) }

// Organisatie
func (o Organisatie) GetID() any              { return o.ID }
func (o Organisatie) Metatype() Metatype      { return MetatypeEntiteit }
func (o *Organisatie) ClearID()               { o.ID = 0 }
func (o Organisatie) GetOpvoer() *time.Time   { return o.Opvoer }
func (o *Organisatie) SetOpvoer(t *time.Time) { o.Opvoer = t }
func (o Organisatie) GetAfvoer() *time.Time   { return o.Afvoer }
func (o *Organisatie) SetAfvoer(t *time.Time) { o.Afvoer = t }
func (o Organisatie) String() string          { return RepresentatieToString(o) }

// Persoon
func (p Persoon) GetID() any              { return p.ID }
func (p Persoon) Metatype() Metatype      { return MetatypeEntiteit }
func (p *Persoon) ClearID()               { p.ID = 0 }
func (p Persoon) GetOpvoer() *time.Time   { return p.Opvoer }
func (p *Persoon) SetOpvoer(t *time.Time) { p.Opvoer = t }
func (p Persoon) GetAfvoer() *time.Time   { return p.Afvoer }
func (p *Persoon) SetAfvoer(t *time.Time) { p.Afvoer = t }
func (p Persoon) String() string          { return RepresentatieToString(p) }

// Gemeente
func (g Gemeente) GetID() any              { return g.ID }
func (g Gemeente) Metatype() Metatype      { return MetatypeEntiteit }
func (g *Gemeente) ClearID()               { g.ID = 0 }
func (g Gemeente) GetOpvoer() *time.Time   { return g.Opvoer }
func (g *Gemeente) SetOpvoer(t *time.Time) { g.Opvoer = t }
func (g Gemeente) GetAfvoer() *time.Time   { return g.Afvoer }
func (g *Gemeente) SetAfvoer(t *time.Time) { g.Afvoer = t }
func (g Gemeente) String() string          { return RepresentatieToString(g) }

// Domein
func (d Domein) GetID() any              { return d.ID }
func (d Domein) Metatype() Metatype      { return MetatypeEntiteit }
func (d *Domein) ClearID()               { d.ID = 0 }
func (d Domein) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Domein) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Domein) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Domein) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Domein) String() string          { return RepresentatieToString(d) }

// ApiStandaard
func (a ApiStandaard) GetID() any              { return a.ID }
func (a ApiStandaard) Metatype() Metatype      { return MetatypeEntiteit }
func (a *ApiStandaard) ClearID()               { a.ID = 0 }
func (a ApiStandaard) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *ApiStandaard) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a ApiStandaard) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *ApiStandaard) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a ApiStandaard) String() string          { return RepresentatieToString(a) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// Initiatief_Planning
func (ip Initiatief_Planning) GetID() any              { return ip.Rel_ID }
func (ip Initiatief_Planning) Metatype() Metatype      { return MetatypeGegevenselement }
func (ip *Initiatief_Planning) ClearID()               { ip.Rel_ID = 0 }
func (ip Initiatief_Planning) GetOpvoer() *time.Time   { return ip.Opvoer }
func (ip *Initiatief_Planning) SetOpvoer(t *time.Time) { ip.Opvoer = t }
func (ip Initiatief_Planning) GetAfvoer() *time.Time   { return ip.Afvoer }
func (ip *Initiatief_Planning) SetAfvoer(t *time.Time) { ip.Afvoer = t }
func (ip Initiatief_Planning) String() string          { return RepresentatieToString(ip) }

// Initiatief_Product
func (ip Initiatief_Product) GetID() any              { return ip.Rel_ID }
func (ip Initiatief_Product) Metatype() Metatype      { return MetatypeGegevenselement }
func (ip *Initiatief_Product) ClearID()               { ip.Rel_ID = 0 }
func (ip Initiatief_Product) GetOpvoer() *time.Time   { return ip.Opvoer }
func (ip *Initiatief_Product) SetOpvoer(t *time.Time) { ip.Opvoer = t }
func (ip Initiatief_Product) GetAfvoer() *time.Time   { return ip.Afvoer }
func (ip *Initiatief_Product) SetAfvoer(t *time.Time) { ip.Afvoer = t }
func (ip Initiatief_Product) String() string          { return RepresentatieToString(ip) }

// Initiatief_Bijdrage
func (ib Initiatief_Bijdrage) GetID() any              { return ib.Rel_ID }
func (ib Initiatief_Bijdrage) Metatype() Metatype      { return MetatypeGegevenselement }
func (ib *Initiatief_Bijdrage) ClearID()               { ib.Rel_ID = 0 }
func (ib Initiatief_Bijdrage) GetOpvoer() *time.Time   { return ib.Opvoer }
func (ib *Initiatief_Bijdrage) SetOpvoer(t *time.Time) { ib.Opvoer = t }
func (ib Initiatief_Bijdrage) GetAfvoer() *time.Time   { return ib.Afvoer }
func (ib *Initiatief_Bijdrage) SetAfvoer(t *time.Time) { ib.Afvoer = t }
func (ib Initiatief_Bijdrage) String() string          { return RepresentatieToString(ib) }

// Initiatief_AnderDomein
func (ia Initiatief_AnderDomein) GetID() any              { return ia.Rel_ID }
func (ia Initiatief_AnderDomein) Metatype() Metatype      { return MetatypeGegevenselement }
func (ia *Initiatief_AnderDomein) ClearID()               { ia.Rel_ID = 0 }
func (ia Initiatief_AnderDomein) GetOpvoer() *time.Time   { return ia.Opvoer }
func (ia *Initiatief_AnderDomein) SetOpvoer(t *time.Time) { ia.Opvoer = t }
func (ia Initiatief_AnderDomein) GetAfvoer() *time.Time   { return ia.Afvoer }
func (ia *Initiatief_AnderDomein) SetAfvoer(t *time.Time) { ia.Afvoer = t }
func (ia Initiatief_AnderDomein) String() string          { return RepresentatieToString(ia) }

// Initiatief_AndersDanGemeente
func (ia Initiatief_AndersDanGemeente) GetID() any              { return ia.Rel_ID }
func (ia Initiatief_AndersDanGemeente) Metatype() Metatype      { return MetatypeGegevenselement }
func (ia *Initiatief_AndersDanGemeente) ClearID()               { ia.Rel_ID = 0 }
func (ia Initiatief_AndersDanGemeente) GetOpvoer() *time.Time   { return ia.Opvoer }
func (ia *Initiatief_AndersDanGemeente) SetOpvoer(t *time.Time) { ia.Opvoer = t }
func (ia Initiatief_AndersDanGemeente) GetAfvoer() *time.Time   { return ia.Afvoer }
func (ia *Initiatief_AndersDanGemeente) SetAfvoer(t *time.Time) { ia.Afvoer = t }
func (ia Initiatief_AndersDanGemeente) String() string          { return RepresentatieToString(ia) }

// Initiatief_AndereAPIStandaard
func (ia Initiatief_AndereAPIStandaard) GetID() any              { return ia.Rel_ID }
func (ia Initiatief_AndereAPIStandaard) Metatype() Metatype      { return MetatypeGegevenselement }
func (ia *Initiatief_AndereAPIStandaard) ClearID()               { ia.Rel_ID = 0 }
func (ia Initiatief_AndereAPIStandaard) GetOpvoer() *time.Time   { return ia.Opvoer }
func (ia *Initiatief_AndereAPIStandaard) SetOpvoer(t *time.Time) { ia.Opvoer = t }
func (ia Initiatief_AndereAPIStandaard) GetAfvoer() *time.Time   { return ia.Afvoer }
func (ia *Initiatief_AndereAPIStandaard) SetAfvoer(t *time.Time) { ia.Afvoer = t }
func (ia Initiatief_AndereAPIStandaard) String() string          { return RepresentatieToString(ia) }

// InitiatiefGemeente
func (i InitiatiefGemeente) GetID() any              { return i.Rel_ID }
func (i InitiatiefGemeente) Metatype() Metatype      { return MetatypeRelatie }
func (i *InitiatiefGemeente) ClearID()               { i.Rel_ID = 0 }
func (i InitiatiefGemeente) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *InitiatiefGemeente) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i InitiatiefGemeente) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *InitiatiefGemeente) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i InitiatiefGemeente) String() string          { return RepresentatieToString(i) }

// InitiatiefDomein
func (i InitiatiefDomein) GetID() any              { return i.Rel_ID }
func (i InitiatiefDomein) Metatype() Metatype      { return MetatypeRelatie }
func (i *InitiatiefDomein) ClearID()               { i.Rel_ID = 0 }
func (i InitiatiefDomein) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *InitiatiefDomein) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i InitiatiefDomein) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *InitiatiefDomein) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i InitiatiefDomein) String() string          { return RepresentatieToString(i) }

// InitiatiefAPIStandaard
func (i InitiatiefAPIStandaard) GetID() any              { return i.Rel_ID }
func (i InitiatiefAPIStandaard) Metatype() Metatype      { return MetatypeRelatie }
func (i *InitiatiefAPIStandaard) ClearID()               { i.Rel_ID = 0 }
func (i InitiatiefAPIStandaard) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *InitiatiefAPIStandaard) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i InitiatiefAPIStandaard) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *InitiatiefAPIStandaard) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i InitiatiefAPIStandaard) String() string          { return RepresentatieToString(i) }

// InitiatiefOrganisatie
func (i InitiatiefOrganisatie) GetID() any              { return i.Rel_ID }
func (i InitiatiefOrganisatie) Metatype() Metatype      { return MetatypeRelatie }
func (i *InitiatiefOrganisatie) ClearID()               { i.Rel_ID = 0 }
func (i InitiatiefOrganisatie) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *InitiatiefOrganisatie) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i InitiatiefOrganisatie) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *InitiatiefOrganisatie) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i InitiatiefOrganisatie) String() string          { return RepresentatieToString(i) }

// Organisatie_Contactgegevens
func (oc Organisatie_Contactgegevens) GetID() any              { return oc.Rel_ID }
func (oc Organisatie_Contactgegevens) Metatype() Metatype      { return MetatypeGegevenselement }
func (oc *Organisatie_Contactgegevens) ClearID()               { oc.Rel_ID = 0 }
func (oc Organisatie_Contactgegevens) GetOpvoer() *time.Time   { return oc.Opvoer }
func (oc *Organisatie_Contactgegevens) SetOpvoer(t *time.Time) { oc.Opvoer = t }
func (oc Organisatie_Contactgegevens) GetAfvoer() *time.Time   { return oc.Afvoer }
func (oc *Organisatie_Contactgegevens) SetAfvoer(t *time.Time) { oc.Afvoer = t }
func (oc Organisatie_Contactgegevens) String() string          { return RepresentatieToString(oc) }

// Organisatie_Organisatienaam
func (oo Organisatie_Organisatienaam) GetID() any              { return oo.Rel_ID }
func (oo Organisatie_Organisatienaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (oo *Organisatie_Organisatienaam) ClearID()               { oo.Rel_ID = 0 }
func (oo Organisatie_Organisatienaam) GetOpvoer() *time.Time   { return oo.Opvoer }
func (oo *Organisatie_Organisatienaam) SetOpvoer(t *time.Time) { oo.Opvoer = t }
func (oo Organisatie_Organisatienaam) GetAfvoer() *time.Time   { return oo.Afvoer }
func (oo *Organisatie_Organisatienaam) SetAfvoer(t *time.Time) { oo.Afvoer = t }
func (oo Organisatie_Organisatienaam) String() string          { return RepresentatieToString(oo) }

// Organisatie_BetrokkenOrganisatietype
func (ob Organisatie_BetrokkenOrganisatietype) GetID() any              { return ob.Rel_ID }
func (ob Organisatie_BetrokkenOrganisatietype) Metatype() Metatype      { return MetatypeGegevenselement }
func (ob *Organisatie_BetrokkenOrganisatietype) ClearID()               { ob.Rel_ID = 0 }
func (ob Organisatie_BetrokkenOrganisatietype) GetOpvoer() *time.Time   { return ob.Opvoer }
func (ob *Organisatie_BetrokkenOrganisatietype) SetOpvoer(t *time.Time) { ob.Opvoer = t }
func (ob Organisatie_BetrokkenOrganisatietype) GetAfvoer() *time.Time   { return ob.Afvoer }
func (ob *Organisatie_BetrokkenOrganisatietype) SetAfvoer(t *time.Time) { ob.Afvoer = t }
func (ob Organisatie_BetrokkenOrganisatietype) String() string          { return RepresentatieToString(ob) }

// Contactpersoon
func (c Contactpersoon) GetID() any              { return c.Rel_ID }
func (c Contactpersoon) Metatype() Metatype      { return MetatypeRelatie }
func (c *Contactpersoon) ClearID()               { c.Rel_ID = 0 }
func (c Contactpersoon) GetOpvoer() *time.Time   { return c.Opvoer }
func (c *Contactpersoon) SetOpvoer(t *time.Time) { c.Opvoer = t }
func (c Contactpersoon) GetAfvoer() *time.Time   { return c.Afvoer }
func (c *Contactpersoon) SetAfvoer(t *time.Time) { c.Afvoer = t }
func (c Contactpersoon) String() string          { return RepresentatieToString(c) }

// Persoon_Contactgegevens
func (pc Persoon_Contactgegevens) GetID() any              { return pc.Rel_ID }
func (pc Persoon_Contactgegevens) Metatype() Metatype      { return MetatypeGegevenselement }
func (pc *Persoon_Contactgegevens) ClearID()               { pc.Rel_ID = 0 }
func (pc Persoon_Contactgegevens) GetOpvoer() *time.Time   { return pc.Opvoer }
func (pc *Persoon_Contactgegevens) SetOpvoer(t *time.Time) { pc.Opvoer = t }
func (pc Persoon_Contactgegevens) GetAfvoer() *time.Time   { return pc.Afvoer }
func (pc *Persoon_Contactgegevens) SetAfvoer(t *time.Time) { pc.Afvoer = t }
func (pc Persoon_Contactgegevens) String() string          { return RepresentatieToString(pc) }

// Persoon_Persoonnaam
func (pp Persoon_Persoonnaam) GetID() any              { return pp.Rel_ID }
func (pp Persoon_Persoonnaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (pp *Persoon_Persoonnaam) ClearID()               { pp.Rel_ID = 0 }
func (pp Persoon_Persoonnaam) GetOpvoer() *time.Time   { return pp.Opvoer }
func (pp *Persoon_Persoonnaam) SetOpvoer(t *time.Time) { pp.Opvoer = t }
func (pp Persoon_Persoonnaam) GetAfvoer() *time.Time   { return pp.Afvoer }
func (pp *Persoon_Persoonnaam) SetAfvoer(t *time.Time) { pp.Afvoer = t }
func (pp Persoon_Persoonnaam) String() string          { return RepresentatieToString(pp) }

// GemeenteGegevens
func (gg GemeenteGegevens) GetID() any              { return gg.Rel_ID }
func (gg GemeenteGegevens) Metatype() Metatype      { return MetatypeGegevenselement }
func (gg *GemeenteGegevens) ClearID()               { gg.Rel_ID = 0 }
func (gg GemeenteGegevens) GetOpvoer() *time.Time   { return gg.Opvoer }
func (gg *GemeenteGegevens) SetOpvoer(t *time.Time) { gg.Opvoer = t }
func (gg GemeenteGegevens) GetAfvoer() *time.Time   { return gg.Afvoer }
func (gg *GemeenteGegevens) SetAfvoer(t *time.Time) { gg.Afvoer = t }
func (gg GemeenteGegevens) String() string          { return RepresentatieToString(gg) }

// DomeinGegevens
func (dd DomeinGegevens) GetID() any              { return dd.Rel_ID }
func (dd DomeinGegevens) Metatype() Metatype      { return MetatypeGegevenselement }
func (dd *DomeinGegevens) ClearID()               { dd.Rel_ID = 0 }
func (dd DomeinGegevens) GetOpvoer() *time.Time   { return dd.Opvoer }
func (dd *DomeinGegevens) SetOpvoer(t *time.Time) { dd.Opvoer = t }
func (dd DomeinGegevens) GetAfvoer() *time.Time   { return dd.Afvoer }
func (dd *DomeinGegevens) SetAfvoer(t *time.Time) { dd.Afvoer = t }
func (dd DomeinGegevens) String() string          { return RepresentatieToString(dd) }

// API_standaard_naam
func (aa API_standaard_naam) GetID() any              { return aa.Rel_ID }
func (aa API_standaard_naam) Metatype() Metatype      { return MetatypeGegevenselement }
func (aa *API_standaard_naam) ClearID()               { aa.Rel_ID = 0 }
func (aa API_standaard_naam) GetOpvoer() *time.Time   { return aa.Opvoer }
func (aa *API_standaard_naam) SetOpvoer(t *time.Time) { aa.Opvoer = t }
func (aa API_standaard_naam) GetAfvoer() *time.Time   { return aa.Afvoer }
func (aa *API_standaard_naam) SetAfvoer(t *time.Time) { aa.Afvoer = t }
func (aa API_standaard_naam) String() string          { return RepresentatieToString(aa) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// Initiatief_Planning_Data
func (d Initiatief_Planning_Data) GetID() any              { return d.Versie }
func (d Initiatief_Planning_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Initiatief_Planning_Data) ClearID()               { d.Versie = 0 }
func (d Initiatief_Planning_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Initiatief_Planning_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Initiatief_Planning_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Initiatief_Planning_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Initiatief_Planning_Data) String() string          { return RepresentatieToString(d) }

// Initiatief_Product_Data
func (d Initiatief_Product_Data) GetID() any              { return d.Versie }
func (d Initiatief_Product_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Initiatief_Product_Data) ClearID()               { d.Versie = 0 }
func (d Initiatief_Product_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Initiatief_Product_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Initiatief_Product_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Initiatief_Product_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Initiatief_Product_Data) String() string          { return RepresentatieToString(d) }

// Initiatief_Bijdrage_Data
func (d Initiatief_Bijdrage_Data) GetID() any              { return d.Versie }
func (d Initiatief_Bijdrage_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Initiatief_Bijdrage_Data) ClearID()               { d.Versie = 0 }
func (d Initiatief_Bijdrage_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Initiatief_Bijdrage_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Initiatief_Bijdrage_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Initiatief_Bijdrage_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Initiatief_Bijdrage_Data) String() string          { return RepresentatieToString(d) }

// Initiatief_AnderDomein_Data
func (d Initiatief_AnderDomein_Data) GetID() any              { return d.Versie }
func (d Initiatief_AnderDomein_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Initiatief_AnderDomein_Data) ClearID()               { d.Versie = 0 }
func (d Initiatief_AnderDomein_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Initiatief_AnderDomein_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Initiatief_AnderDomein_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Initiatief_AnderDomein_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Initiatief_AnderDomein_Data) String() string          { return RepresentatieToString(d) }

// Initiatief_AndersDanGemeente_Data
func (d Initiatief_AndersDanGemeente_Data) GetID() any              { return d.Versie }
func (d Initiatief_AndersDanGemeente_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Initiatief_AndersDanGemeente_Data) ClearID()               { d.Versie = 0 }
func (d Initiatief_AndersDanGemeente_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Initiatief_AndersDanGemeente_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Initiatief_AndersDanGemeente_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Initiatief_AndersDanGemeente_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Initiatief_AndersDanGemeente_Data) String() string          { return RepresentatieToString(d) }

// Initiatief_AndereAPIStandaard_Data
func (d Initiatief_AndereAPIStandaard_Data) GetID() any              { return d.Versie }
func (d Initiatief_AndereAPIStandaard_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Initiatief_AndereAPIStandaard_Data) ClearID()               { d.Versie = 0 }
func (d Initiatief_AndereAPIStandaard_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Initiatief_AndereAPIStandaard_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Initiatief_AndereAPIStandaard_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Initiatief_AndereAPIStandaard_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Initiatief_AndereAPIStandaard_Data) String() string          { return RepresentatieToString(d) }

// InitiatiefGemeente_Data
func (d InitiatiefGemeente_Data) GetID() any              { return d.Versie }
func (d InitiatiefGemeente_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *InitiatiefGemeente_Data) ClearID()               { d.Versie = 0 }
func (d InitiatiefGemeente_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *InitiatiefGemeente_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d InitiatiefGemeente_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *InitiatiefGemeente_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d InitiatiefGemeente_Data) String() string          { return RepresentatieToString(d) }

// InitiatiefDomein_Data
func (d InitiatiefDomein_Data) GetID() any              { return d.Versie }
func (d InitiatiefDomein_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *InitiatiefDomein_Data) ClearID()               { d.Versie = 0 }
func (d InitiatiefDomein_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *InitiatiefDomein_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d InitiatiefDomein_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *InitiatiefDomein_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d InitiatiefDomein_Data) String() string          { return RepresentatieToString(d) }

// InitiatiefAPIStandaard_Data
func (d InitiatiefAPIStandaard_Data) GetID() any              { return d.Versie }
func (d InitiatiefAPIStandaard_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *InitiatiefAPIStandaard_Data) ClearID()               { d.Versie = 0 }
func (d InitiatiefAPIStandaard_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *InitiatiefAPIStandaard_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d InitiatiefAPIStandaard_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *InitiatiefAPIStandaard_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d InitiatiefAPIStandaard_Data) String() string          { return RepresentatieToString(d) }

// InitiatiefOrganisatie_Data
func (d InitiatiefOrganisatie_Data) GetID() any              { return d.Versie }
func (d InitiatiefOrganisatie_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *InitiatiefOrganisatie_Data) ClearID()               { d.Versie = 0 }
func (d InitiatiefOrganisatie_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *InitiatiefOrganisatie_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d InitiatiefOrganisatie_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *InitiatiefOrganisatie_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d InitiatiefOrganisatie_Data) String() string          { return RepresentatieToString(d) }

// Organisatie_Contactgegevens_Data
func (d Organisatie_Contactgegevens_Data) GetID() any              { return d.Versie }
func (d Organisatie_Contactgegevens_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Organisatie_Contactgegevens_Data) ClearID()               { d.Versie = 0 }
func (d Organisatie_Contactgegevens_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Organisatie_Contactgegevens_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Organisatie_Contactgegevens_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Organisatie_Contactgegevens_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Organisatie_Contactgegevens_Data) String() string          { return RepresentatieToString(d) }

// Organisatie_Organisatienaam_Data
func (d Organisatie_Organisatienaam_Data) GetID() any              { return d.Versie }
func (d Organisatie_Organisatienaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Organisatie_Organisatienaam_Data) ClearID()               { d.Versie = 0 }
func (d Organisatie_Organisatienaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Organisatie_Organisatienaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Organisatie_Organisatienaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Organisatie_Organisatienaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Organisatie_Organisatienaam_Data) String() string          { return RepresentatieToString(d) }

// Organisatie_BetrokkenOrganisatietype_Data
func (d Organisatie_BetrokkenOrganisatietype_Data) GetID() any { return d.Versie }
func (d Organisatie_BetrokkenOrganisatietype_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *Organisatie_BetrokkenOrganisatietype_Data) ClearID()               { d.Versie = 0 }
func (d Organisatie_BetrokkenOrganisatietype_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Organisatie_BetrokkenOrganisatietype_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Organisatie_BetrokkenOrganisatietype_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Organisatie_BetrokkenOrganisatietype_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Organisatie_BetrokkenOrganisatietype_Data) String() string          { return RepresentatieToString(d) }

// Contactpersoon_Data
func (d Contactpersoon_Data) GetID() any              { return d.Versie }
func (d Contactpersoon_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Contactpersoon_Data) ClearID()               { d.Versie = 0 }
func (d Contactpersoon_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Contactpersoon_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Contactpersoon_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Contactpersoon_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Contactpersoon_Data) String() string          { return RepresentatieToString(d) }

// Persoon_Contactgegevens_Data
func (d Persoon_Contactgegevens_Data) GetID() any              { return d.Versie }
func (d Persoon_Contactgegevens_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Persoon_Contactgegevens_Data) ClearID()               { d.Versie = 0 }
func (d Persoon_Contactgegevens_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Persoon_Contactgegevens_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Persoon_Contactgegevens_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Persoon_Contactgegevens_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Persoon_Contactgegevens_Data) String() string          { return RepresentatieToString(d) }

// Persoon_Persoonnaam_Data
func (d Persoon_Persoonnaam_Data) GetID() any              { return d.Versie }
func (d Persoon_Persoonnaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Persoon_Persoonnaam_Data) ClearID()               { d.Versie = 0 }
func (d Persoon_Persoonnaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Persoon_Persoonnaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Persoon_Persoonnaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Persoon_Persoonnaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Persoon_Persoonnaam_Data) String() string          { return RepresentatieToString(d) }

// GemeenteGegevens_Data
func (d GemeenteGegevens_Data) GetID() any              { return d.Versie }
func (d GemeenteGegevens_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *GemeenteGegevens_Data) ClearID()               { d.Versie = 0 }
func (d GemeenteGegevens_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *GemeenteGegevens_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d GemeenteGegevens_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *GemeenteGegevens_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d GemeenteGegevens_Data) String() string          { return RepresentatieToString(d) }

// DomeinGegevens_Data
func (d DomeinGegevens_Data) GetID() any              { return d.Versie }
func (d DomeinGegevens_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *DomeinGegevens_Data) ClearID()               { d.Versie = 0 }
func (d DomeinGegevens_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *DomeinGegevens_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d DomeinGegevens_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *DomeinGegevens_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d DomeinGegevens_Data) String() string          { return RepresentatieToString(d) }

// API_standaard_naam_Data
func (d API_standaard_naam_Data) GetID() any              { return d.Versie }
func (d API_standaard_naam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *API_standaard_naam_Data) ClearID()               { d.Versie = 0 }
func (d API_standaard_naam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *API_standaard_naam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d API_standaard_naam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *API_standaard_naam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d API_standaard_naam_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

// Initiatief_Aanvang
func (i Initiatief_Aanvang) GetID() any              { return i.Versie }
func (i Initiatief_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Aanvang) ClearID()               { i.Versie = 0 }
func (i Initiatief_Aanvang) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *Initiatief_Aanvang) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i Initiatief_Aanvang) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *Initiatief_Aanvang) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i Initiatief_Aanvang) String() string          { return RepresentatieToString(i) }

// Initiatief_Einde
func (i Initiatief_Einde) GetID() any              { return i.Versie }
func (i Initiatief_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Einde) ClearID()               { i.Versie = 0 }
func (i Initiatief_Einde) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *Initiatief_Einde) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i Initiatief_Einde) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *Initiatief_Einde) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i Initiatief_Einde) String() string          { return RepresentatieToString(i) }

// Organisatie_Aanvang
func (o Organisatie_Aanvang) GetID() any              { return o.Versie }
func (o Organisatie_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (o *Organisatie_Aanvang) ClearID()               { o.Versie = 0 }
func (o Organisatie_Aanvang) GetOpvoer() *time.Time   { return o.Opvoer }
func (o *Organisatie_Aanvang) SetOpvoer(t *time.Time) { o.Opvoer = t }
func (o Organisatie_Aanvang) GetAfvoer() *time.Time   { return o.Afvoer }
func (o *Organisatie_Aanvang) SetAfvoer(t *time.Time) { o.Afvoer = t }
func (o Organisatie_Aanvang) String() string          { return RepresentatieToString(o) }

// Organisatie_Einde
func (o Organisatie_Einde) GetID() any              { return o.Versie }
func (o Organisatie_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (o *Organisatie_Einde) ClearID()               { o.Versie = 0 }
func (o Organisatie_Einde) GetOpvoer() *time.Time   { return o.Opvoer }
func (o *Organisatie_Einde) SetOpvoer(t *time.Time) { o.Opvoer = t }
func (o Organisatie_Einde) GetAfvoer() *time.Time   { return o.Afvoer }
func (o *Organisatie_Einde) SetAfvoer(t *time.Time) { o.Afvoer = t }
func (o Organisatie_Einde) String() string          { return RepresentatieToString(o) }

// Persoon_Aanvang
func (p Persoon_Aanvang) GetID() any              { return p.Versie }
func (p Persoon_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (p *Persoon_Aanvang) ClearID()               { p.Versie = 0 }
func (p Persoon_Aanvang) GetOpvoer() *time.Time   { return p.Opvoer }
func (p *Persoon_Aanvang) SetOpvoer(t *time.Time) { p.Opvoer = t }
func (p Persoon_Aanvang) GetAfvoer() *time.Time   { return p.Afvoer }
func (p *Persoon_Aanvang) SetAfvoer(t *time.Time) { p.Afvoer = t }
func (p Persoon_Aanvang) String() string          { return RepresentatieToString(p) }

// Persoon_Einde
func (p Persoon_Einde) GetID() any              { return p.Versie }
func (p Persoon_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (p *Persoon_Einde) ClearID()               { p.Versie = 0 }
func (p Persoon_Einde) GetOpvoer() *time.Time   { return p.Opvoer }
func (p *Persoon_Einde) SetOpvoer(t *time.Time) { p.Opvoer = t }
func (p Persoon_Einde) GetAfvoer() *time.Time   { return p.Afvoer }
func (p *Persoon_Einde) SetAfvoer(t *time.Time) { p.Afvoer = t }
func (p Persoon_Einde) String() string          { return RepresentatieToString(p) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

// Initiatief_Planning_Aanvang
func (i Initiatief_Planning_Aanvang) GetID() any              { return i.Versie }
func (i Initiatief_Planning_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Planning_Aanvang) ClearID()               { i.Versie = 0 }
func (i Initiatief_Planning_Aanvang) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *Initiatief_Planning_Aanvang) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i Initiatief_Planning_Aanvang) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *Initiatief_Planning_Aanvang) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i Initiatief_Planning_Aanvang) String() string          { return RepresentatieToString(i) }

// Initiatief_Planning_Einde
func (i Initiatief_Planning_Einde) GetID() any              { return i.Versie }
func (i Initiatief_Planning_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Planning_Einde) ClearID()               { i.Versie = 0 }
func (i Initiatief_Planning_Einde) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *Initiatief_Planning_Einde) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i Initiatief_Planning_Einde) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *Initiatief_Planning_Einde) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i Initiatief_Planning_Einde) String() string          { return RepresentatieToString(i) }

// Initiatief_Product_Aanvang
func (i Initiatief_Product_Aanvang) GetID() any              { return i.Versie }
func (i Initiatief_Product_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Product_Aanvang) ClearID()               { i.Versie = 0 }
func (i Initiatief_Product_Aanvang) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *Initiatief_Product_Aanvang) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i Initiatief_Product_Aanvang) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *Initiatief_Product_Aanvang) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i Initiatief_Product_Aanvang) String() string          { return RepresentatieToString(i) }

// Initiatief_Product_Einde
func (i Initiatief_Product_Einde) GetID() any              { return i.Versie }
func (i Initiatief_Product_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Product_Einde) ClearID()               { i.Versie = 0 }
func (i Initiatief_Product_Einde) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *Initiatief_Product_Einde) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i Initiatief_Product_Einde) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *Initiatief_Product_Einde) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i Initiatief_Product_Einde) String() string          { return RepresentatieToString(i) }

// Initiatief_Bijdrage_Aanvang
func (i Initiatief_Bijdrage_Aanvang) GetID() any              { return i.Versie }
func (i Initiatief_Bijdrage_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Bijdrage_Aanvang) ClearID()               { i.Versie = 0 }
func (i Initiatief_Bijdrage_Aanvang) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *Initiatief_Bijdrage_Aanvang) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i Initiatief_Bijdrage_Aanvang) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *Initiatief_Bijdrage_Aanvang) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i Initiatief_Bijdrage_Aanvang) String() string          { return RepresentatieToString(i) }

// Initiatief_Bijdrage_Einde
func (i Initiatief_Bijdrage_Einde) GetID() any              { return i.Versie }
func (i Initiatief_Bijdrage_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Bijdrage_Einde) ClearID()               { i.Versie = 0 }
func (i Initiatief_Bijdrage_Einde) GetOpvoer() *time.Time   { return i.Opvoer }
func (i *Initiatief_Bijdrage_Einde) SetOpvoer(t *time.Time) { i.Opvoer = t }
func (i Initiatief_Bijdrage_Einde) GetAfvoer() *time.Time   { return i.Afvoer }
func (i *Initiatief_Bijdrage_Einde) SetAfvoer(t *time.Time) { i.Afvoer = t }
func (i Initiatief_Bijdrage_Einde) String() string          { return RepresentatieToString(i) }

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// Initiatief_Planning_Input
func (i Initiatief_Planning_Input) GetID() any              { return i.Rel_ID }
func (i Initiatief_Planning_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Planning_Input) ClearID()               { i.Rel_ID = 0 }
func (i Initiatief_Planning_Input) GetOpvoer() *time.Time   { return nil }
func (i *Initiatief_Planning_Input) SetOpvoer(t *time.Time) {}
func (i Initiatief_Planning_Input) GetAfvoer() *time.Time   { return nil }
func (i *Initiatief_Planning_Input) SetAfvoer(t *time.Time) {}
func (i Initiatief_Planning_Input) String() string          { return RepresentatieToString(i) }

// Initiatief_Product_Input
func (i Initiatief_Product_Input) GetID() any              { return i.Rel_ID }
func (i Initiatief_Product_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Product_Input) ClearID()               { i.Rel_ID = 0 }
func (i Initiatief_Product_Input) GetOpvoer() *time.Time   { return nil }
func (i *Initiatief_Product_Input) SetOpvoer(t *time.Time) {}
func (i Initiatief_Product_Input) GetAfvoer() *time.Time   { return nil }
func (i *Initiatief_Product_Input) SetAfvoer(t *time.Time) {}
func (i Initiatief_Product_Input) String() string          { return RepresentatieToString(i) }

// Initiatief_Bijdrage_Input
func (i Initiatief_Bijdrage_Input) GetID() any              { return i.Rel_ID }
func (i Initiatief_Bijdrage_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_Bijdrage_Input) ClearID()               { i.Rel_ID = 0 }
func (i Initiatief_Bijdrage_Input) GetOpvoer() *time.Time   { return nil }
func (i *Initiatief_Bijdrage_Input) SetOpvoer(t *time.Time) {}
func (i Initiatief_Bijdrage_Input) GetAfvoer() *time.Time   { return nil }
func (i *Initiatief_Bijdrage_Input) SetAfvoer(t *time.Time) {}
func (i Initiatief_Bijdrage_Input) String() string          { return RepresentatieToString(i) }

// Initiatief_AnderDomein_Input
func (i Initiatief_AnderDomein_Input) GetID() any              { return i.Rel_ID }
func (i Initiatief_AnderDomein_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_AnderDomein_Input) ClearID()               { i.Rel_ID = 0 }
func (i Initiatief_AnderDomein_Input) GetOpvoer() *time.Time   { return nil }
func (i *Initiatief_AnderDomein_Input) SetOpvoer(t *time.Time) {}
func (i Initiatief_AnderDomein_Input) GetAfvoer() *time.Time   { return nil }
func (i *Initiatief_AnderDomein_Input) SetAfvoer(t *time.Time) {}
func (i Initiatief_AnderDomein_Input) String() string          { return RepresentatieToString(i) }

// Initiatief_AndersDanGemeente_Input
func (i Initiatief_AndersDanGemeente_Input) GetID() any              { return i.Rel_ID }
func (i Initiatief_AndersDanGemeente_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_AndersDanGemeente_Input) ClearID()               { i.Rel_ID = 0 }
func (i Initiatief_AndersDanGemeente_Input) GetOpvoer() *time.Time   { return nil }
func (i *Initiatief_AndersDanGemeente_Input) SetOpvoer(t *time.Time) {}
func (i Initiatief_AndersDanGemeente_Input) GetAfvoer() *time.Time   { return nil }
func (i *Initiatief_AndersDanGemeente_Input) SetAfvoer(t *time.Time) {}
func (i Initiatief_AndersDanGemeente_Input) String() string          { return RepresentatieToString(i) }

// Initiatief_AndereAPIStandaard_Input
func (i Initiatief_AndereAPIStandaard_Input) GetID() any              { return i.Rel_ID }
func (i Initiatief_AndereAPIStandaard_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Initiatief_AndereAPIStandaard_Input) ClearID()               { i.Rel_ID = 0 }
func (i Initiatief_AndereAPIStandaard_Input) GetOpvoer() *time.Time   { return nil }
func (i *Initiatief_AndereAPIStandaard_Input) SetOpvoer(t *time.Time) {}
func (i Initiatief_AndereAPIStandaard_Input) GetAfvoer() *time.Time   { return nil }
func (i *Initiatief_AndereAPIStandaard_Input) SetAfvoer(t *time.Time) {}
func (i Initiatief_AndereAPIStandaard_Input) String() string          { return RepresentatieToString(i) }

// InitiatiefGemeente_Input
func (i InitiatiefGemeente_Input) GetID() any              { return i.Rel_ID }
func (i InitiatiefGemeente_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *InitiatiefGemeente_Input) ClearID()               { i.Rel_ID = 0 }
func (i InitiatiefGemeente_Input) GetOpvoer() *time.Time   { return nil }
func (i *InitiatiefGemeente_Input) SetOpvoer(t *time.Time) {}
func (i InitiatiefGemeente_Input) GetAfvoer() *time.Time   { return nil }
func (i *InitiatiefGemeente_Input) SetAfvoer(t *time.Time) {}
func (i InitiatiefGemeente_Input) String() string          { return RepresentatieToString(i) }

// InitiatiefDomein_Input
func (i InitiatiefDomein_Input) GetID() any              { return i.Rel_ID }
func (i InitiatiefDomein_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *InitiatiefDomein_Input) ClearID()               { i.Rel_ID = 0 }
func (i InitiatiefDomein_Input) GetOpvoer() *time.Time   { return nil }
func (i *InitiatiefDomein_Input) SetOpvoer(t *time.Time) {}
func (i InitiatiefDomein_Input) GetAfvoer() *time.Time   { return nil }
func (i *InitiatiefDomein_Input) SetAfvoer(t *time.Time) {}
func (i InitiatiefDomein_Input) String() string          { return RepresentatieToString(i) }

// InitiatiefAPIStandaard_Input
func (i InitiatiefAPIStandaard_Input) GetID() any              { return i.Rel_ID }
func (i InitiatiefAPIStandaard_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *InitiatiefAPIStandaard_Input) ClearID()               { i.Rel_ID = 0 }
func (i InitiatiefAPIStandaard_Input) GetOpvoer() *time.Time   { return nil }
func (i *InitiatiefAPIStandaard_Input) SetOpvoer(t *time.Time) {}
func (i InitiatiefAPIStandaard_Input) GetAfvoer() *time.Time   { return nil }
func (i *InitiatiefAPIStandaard_Input) SetAfvoer(t *time.Time) {}
func (i InitiatiefAPIStandaard_Input) String() string          { return RepresentatieToString(i) }

// InitiatiefOrganisatie_Input
func (i InitiatiefOrganisatie_Input) GetID() any              { return i.Rel_ID }
func (i InitiatiefOrganisatie_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *InitiatiefOrganisatie_Input) ClearID()               { i.Rel_ID = 0 }
func (i InitiatiefOrganisatie_Input) GetOpvoer() *time.Time   { return nil }
func (i *InitiatiefOrganisatie_Input) SetOpvoer(t *time.Time) {}
func (i InitiatiefOrganisatie_Input) GetAfvoer() *time.Time   { return nil }
func (i *InitiatiefOrganisatie_Input) SetAfvoer(t *time.Time) {}
func (i InitiatiefOrganisatie_Input) String() string          { return RepresentatieToString(i) }

// Organisatie_Contactgegevens_Input
func (i Organisatie_Contactgegevens_Input) GetID() any              { return i.Rel_ID }
func (i Organisatie_Contactgegevens_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Organisatie_Contactgegevens_Input) ClearID()               { i.Rel_ID = 0 }
func (i Organisatie_Contactgegevens_Input) GetOpvoer() *time.Time   { return nil }
func (i *Organisatie_Contactgegevens_Input) SetOpvoer(t *time.Time) {}
func (i Organisatie_Contactgegevens_Input) GetAfvoer() *time.Time   { return nil }
func (i *Organisatie_Contactgegevens_Input) SetAfvoer(t *time.Time) {}
func (i Organisatie_Contactgegevens_Input) String() string          { return RepresentatieToString(i) }

// Organisatie_Organisatienaam_Input
func (i Organisatie_Organisatienaam_Input) GetID() any              { return i.Rel_ID }
func (i Organisatie_Organisatienaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Organisatie_Organisatienaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i Organisatie_Organisatienaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *Organisatie_Organisatienaam_Input) SetOpvoer(t *time.Time) {}
func (i Organisatie_Organisatienaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *Organisatie_Organisatienaam_Input) SetAfvoer(t *time.Time) {}
func (i Organisatie_Organisatienaam_Input) String() string          { return RepresentatieToString(i) }

// Organisatie_BetrokkenOrganisatietype_Input
func (i Organisatie_BetrokkenOrganisatietype_Input) GetID() any { return i.Rel_ID }
func (i Organisatie_BetrokkenOrganisatietype_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *Organisatie_BetrokkenOrganisatietype_Input) ClearID()               { i.Rel_ID = 0 }
func (i Organisatie_BetrokkenOrganisatietype_Input) GetOpvoer() *time.Time   { return nil }
func (i *Organisatie_BetrokkenOrganisatietype_Input) SetOpvoer(t *time.Time) {}
func (i Organisatie_BetrokkenOrganisatietype_Input) GetAfvoer() *time.Time   { return nil }
func (i *Organisatie_BetrokkenOrganisatietype_Input) SetAfvoer(t *time.Time) {}
func (i Organisatie_BetrokkenOrganisatietype_Input) String() string          { return RepresentatieToString(i) }

// Contactpersoon_Input
func (i Contactpersoon_Input) GetID() any              { return i.Rel_ID }
func (i Contactpersoon_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *Contactpersoon_Input) ClearID()               { i.Rel_ID = 0 }
func (i Contactpersoon_Input) GetOpvoer() *time.Time   { return nil }
func (i *Contactpersoon_Input) SetOpvoer(t *time.Time) {}
func (i Contactpersoon_Input) GetAfvoer() *time.Time   { return nil }
func (i *Contactpersoon_Input) SetAfvoer(t *time.Time) {}
func (i Contactpersoon_Input) String() string          { return RepresentatieToString(i) }

// Persoon_Contactgegevens_Input
func (i Persoon_Contactgegevens_Input) GetID() any              { return i.Rel_ID }
func (i Persoon_Contactgegevens_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Persoon_Contactgegevens_Input) ClearID()               { i.Rel_ID = 0 }
func (i Persoon_Contactgegevens_Input) GetOpvoer() *time.Time   { return nil }
func (i *Persoon_Contactgegevens_Input) SetOpvoer(t *time.Time) {}
func (i Persoon_Contactgegevens_Input) GetAfvoer() *time.Time   { return nil }
func (i *Persoon_Contactgegevens_Input) SetAfvoer(t *time.Time) {}
func (i Persoon_Contactgegevens_Input) String() string          { return RepresentatieToString(i) }

// Persoon_Persoonnaam_Input
func (i Persoon_Persoonnaam_Input) GetID() any              { return i.Rel_ID }
func (i Persoon_Persoonnaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Persoon_Persoonnaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i Persoon_Persoonnaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *Persoon_Persoonnaam_Input) SetOpvoer(t *time.Time) {}
func (i Persoon_Persoonnaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *Persoon_Persoonnaam_Input) SetAfvoer(t *time.Time) {}
func (i Persoon_Persoonnaam_Input) String() string          { return RepresentatieToString(i) }

// GemeenteGegevens_Input
func (i GemeenteGegevens_Input) GetID() any              { return i.Rel_ID }
func (i GemeenteGegevens_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *GemeenteGegevens_Input) ClearID()               { i.Rel_ID = 0 }
func (i GemeenteGegevens_Input) GetOpvoer() *time.Time   { return nil }
func (i *GemeenteGegevens_Input) SetOpvoer(t *time.Time) {}
func (i GemeenteGegevens_Input) GetAfvoer() *time.Time   { return nil }
func (i *GemeenteGegevens_Input) SetAfvoer(t *time.Time) {}
func (i GemeenteGegevens_Input) String() string          { return RepresentatieToString(i) }

// DomeinGegevens_Input
func (i DomeinGegevens_Input) GetID() any              { return i.Rel_ID }
func (i DomeinGegevens_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *DomeinGegevens_Input) ClearID()               { i.Rel_ID = 0 }
func (i DomeinGegevens_Input) GetOpvoer() *time.Time   { return nil }
func (i *DomeinGegevens_Input) SetOpvoer(t *time.Time) {}
func (i DomeinGegevens_Input) GetAfvoer() *time.Time   { return nil }
func (i *DomeinGegevens_Input) SetAfvoer(t *time.Time) {}
func (i DomeinGegevens_Input) String() string          { return RepresentatieToString(i) }

// API_standaard_naam_Input
func (i API_standaard_naam_Input) GetID() any              { return i.Rel_ID }
func (i API_standaard_naam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *API_standaard_naam_Input) ClearID()               { i.Rel_ID = 0 }
func (i API_standaard_naam_Input) GetOpvoer() *time.Time   { return nil }
func (i *API_standaard_naam_Input) SetOpvoer(t *time.Time) {}
func (i API_standaard_naam_Input) GetAfvoer() *time.Time   { return nil }
func (i *API_standaard_naam_Input) SetAfvoer(t *time.Time) {}
func (i API_standaard_naam_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (i *Initiatief) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range i.Planningen {
		if i.Planningen[idx].Initiatief_ID == 0 {
			i.Planningen[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Planning", Representatie: &i.Planningen[idx]})
	}
	for idx := range i.Producten {
		if i.Producten[idx].Initiatief_ID == 0 {
			i.Producten[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Product", Representatie: &i.Producten[idx]})
	}
	for idx := range i.Bijdragen {
		if i.Bijdragen[idx].Initiatief_ID == 0 {
			i.Bijdragen[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Bijdrage", Representatie: &i.Bijdragen[idx]})
	}
	for idx := range i.AndereDomeinen {
		if i.AndereDomeinen[idx].Initiatief_ID == 0 {
			i.AndereDomeinen[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_AnderDomein", Representatie: &i.AndereDomeinen[idx]})
	}
	for idx := range i.AndersDanGemeenten {
		if i.AndersDanGemeenten[idx].Initiatief_ID == 0 {
			i.AndersDanGemeenten[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_AndersDanGemeente", Representatie: &i.AndersDanGemeenten[idx]})
	}
	for idx := range i.AndereApiStandaarden {
		if i.AndereApiStandaarden[idx].Initiatief_ID == 0 {
			i.AndereApiStandaarden[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_AndereAPIStandaard", Representatie: &i.AndereApiStandaarden[idx]})
	}
	for idx := range i.InitiatiefGemeenten {
		if i.InitiatiefGemeenten[idx].Initiatief_ID == 0 {
			i.InitiatiefGemeenten[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "InitiatiefGemeente", Representatie: &i.InitiatiefGemeenten[idx]})
	}
	for idx := range i.InitiatiefDomeinen {
		if i.InitiatiefDomeinen[idx].Initiatief_ID == 0 {
			i.InitiatiefDomeinen[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "InitiatiefDomein", Representatie: &i.InitiatiefDomeinen[idx]})
	}
	for idx := range i.InitiatiefApiStandaarden {
		if i.InitiatiefApiStandaarden[idx].Initiatief_ID == 0 {
			i.InitiatiefApiStandaarden[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "InitiatiefAPIStandaard", Representatie: &i.InitiatiefApiStandaarden[idx]})
	}
	for idx := range i.InitiatiefOrganisaties {
		if i.InitiatiefOrganisaties[idx].Initiatief_ID == 0 {
			i.InitiatiefOrganisaties[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "InitiatiefOrganisatie", Representatie: &i.InitiatiefOrganisaties[idx]})
	}
	for idx := range i.Aanvang {
		if i.Aanvang[idx].Initiatief_ID == 0 {
			i.Aanvang[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Aanvang", Representatie: &i.Aanvang[idx]})
	}
	for idx := range i.Einde {
		if i.Einde[idx].Initiatief_ID == 0 {
			i.Einde[idx].Initiatief_ID = i.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Einde", Representatie: &i.Einde[idx]})
	}
	return result
}

func (o *Organisatie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range o.Contactgegevens {
		if o.Contactgegevens[idx].Organisatie_ID == 0 {
			o.Contactgegevens[idx].Organisatie_ID = o.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Organisatie_Contactgegevens", Representatie: &o.Contactgegevens[idx]})
	}
	for idx := range o.Organisatienamen {
		if o.Organisatienamen[idx].Organisatie_ID == 0 {
			o.Organisatienamen[idx].Organisatie_ID = o.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Organisatie_Organisatienaam", Representatie: &o.Organisatienamen[idx]})
	}
	for idx := range o.BetrokkenOrganisatietypen {
		if o.BetrokkenOrganisatietypen[idx].Organisatie_ID == 0 {
			o.BetrokkenOrganisatietypen[idx].Organisatie_ID = o.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Organisatie_BetrokkenOrganisatietype", Representatie: &o.BetrokkenOrganisatietypen[idx]})
	}
	for idx := range o.Contactpersonen {
		if o.Contactpersonen[idx].Organisatie_ID == 0 {
			o.Contactpersonen[idx].Organisatie_ID = o.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Contactpersoon", Representatie: &o.Contactpersonen[idx]})
	}
	for idx := range o.Aanvang {
		if o.Aanvang[idx].Organisatie_ID == 0 {
			o.Aanvang[idx].Organisatie_ID = o.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Organisatie_Aanvang", Representatie: &o.Aanvang[idx]})
	}
	for idx := range o.Einde {
		if o.Einde[idx].Organisatie_ID == 0 {
			o.Einde[idx].Organisatie_ID = o.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Organisatie_Einde", Representatie: &o.Einde[idx]})
	}
	return result
}

func (p *Persoon) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range p.Contactgegevens {
		if p.Contactgegevens[idx].Persoon_ID == 0 {
			p.Contactgegevens[idx].Persoon_ID = p.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Persoon_Contactgegevens", Representatie: &p.Contactgegevens[idx]})
	}
	for idx := range p.Persoonnamen {
		if p.Persoonnamen[idx].Persoon_ID == 0 {
			p.Persoonnamen[idx].Persoon_ID = p.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Persoon_Persoonnaam", Representatie: &p.Persoonnamen[idx]})
	}
	for idx := range p.Aanvang {
		if p.Aanvang[idx].Persoon_ID == 0 {
			p.Aanvang[idx].Persoon_ID = p.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Persoon_Aanvang", Representatie: &p.Aanvang[idx]})
	}
	for idx := range p.Einde {
		if p.Einde[idx].Persoon_ID == 0 {
			p.Einde[idx].Persoon_ID = p.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Persoon_Einde", Representatie: &p.Einde[idx]})
	}
	return result
}

func (g *Gemeente) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range g.Gemeentegegevens {
		if g.Gemeentegegevens[idx].Gemeente_ID == 0 {
			g.Gemeentegegevens[idx].Gemeente_ID = g.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "GemeenteGegevens", Representatie: &g.Gemeentegegevens[idx]})
	}
	return result
}

func (d *Domein) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range d.Domeingegevens {
		if d.Domeingegevens[idx].Domein_ID == 0 {
			d.Domeingegevens[idx].Domein_ID = d.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DomeinGegevens", Representatie: &d.Domeingegevens[idx]})
	}
	return result
}

func (a *ApiStandaard) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range a.ApiStandaardNamen {
		if a.ApiStandaardNamen[idx].ApiStandaard_ID == 0 {
			a.ApiStandaardNamen[idx].ApiStandaard_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "API_standaard_naam", Representatie: &a.ApiStandaardNamen[idx]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *Initiatief_Planning) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Planning_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Initiatief_ID == 0 {
			h.Aanvang[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Planning_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Initiatief_ID == 0 {
			h.Einde[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Planning_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *Initiatief_Product) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Product_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Initiatief_ID == 0 {
			h.Aanvang[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Product_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Initiatief_ID == 0 {
			h.Einde[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Product_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *Initiatief_Bijdrage) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Bijdrage_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Initiatief_ID == 0 {
			h.Aanvang[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Bijdrage_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Initiatief_ID == 0 {
			h.Einde[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_Bijdrage_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *Initiatief_AnderDomein) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_AnderDomein_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Initiatief_AndersDanGemeente) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_AndersDanGemeente_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Initiatief_AndereAPIStandaard) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Initiatief_AndereAPIStandaard_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *InitiatiefGemeente) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "InitiatiefGemeente_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *InitiatiefDomein) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "InitiatiefDomein_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *InitiatiefAPIStandaard) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "InitiatiefAPIStandaard_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *InitiatiefOrganisatie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Initiatief_ID == 0 {
			h.Data[i].Initiatief_ID = h.Initiatief_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "InitiatiefOrganisatie_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Organisatie_Contactgegevens) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Organisatie_ID == 0 {
			h.Data[i].Organisatie_ID = h.Organisatie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Organisatie_Contactgegevens_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Organisatie_Organisatienaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Organisatie_ID == 0 {
			h.Data[i].Organisatie_ID = h.Organisatie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Organisatie_Organisatienaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Organisatie_BetrokkenOrganisatietype) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Organisatie_ID == 0 {
			h.Data[i].Organisatie_ID = h.Organisatie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Organisatie_BetrokkenOrganisatietype_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Contactpersoon) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Organisatie_ID == 0 {
			h.Data[i].Organisatie_ID = h.Organisatie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Contactpersoon_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Persoon_Contactgegevens) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Persoon_ID == 0 {
			h.Data[i].Persoon_ID = h.Persoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Persoon_Contactgegevens_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Persoon_Persoonnaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Persoon_ID == 0 {
			h.Data[i].Persoon_ID = h.Persoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Persoon_Persoonnaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *GemeenteGegevens) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Gemeente_ID == 0 {
			h.Data[i].Gemeente_ID = h.Gemeente_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "GemeenteGegevens_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *DomeinGegevens) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Domein_ID == 0 {
			h.Data[i].Domein_ID = h.Domein_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "DomeinGegevens_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *API_standaard_naam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].ApiStandaard_ID == 0 {
			h.Data[i].ApiStandaard_ID = h.ApiStandaard_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "API_standaard_naam_Data", Representatie: &h.Data[i]})
	}
	return result
}
