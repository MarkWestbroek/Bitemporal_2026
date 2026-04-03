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

// AdellijkeTitel
func (a AdellijkeTitel) GetID() any              { return a.ID }
func (a AdellijkeTitel) Metatype() Metatype      { return MetatypeEntiteit }
func (a *AdellijkeTitel) ClearID()               { a.ID = 0 }
func (a AdellijkeTitel) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *AdellijkeTitel) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a AdellijkeTitel) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *AdellijkeTitel) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a AdellijkeTitel) String() string          { return RepresentatieToString(a) }

// B
func (b B) GetID() any              { return b.ID }
func (b B) Metatype() Metatype      { return MetatypeEntiteit }
func (b *B) ClearID()               { b.ID = 0 }
func (b B) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b B) String() string          { return RepresentatieToString(b) }

// Land
func (l Land) GetID() any              { return l.ID }
func (l Land) Metatype() Metatype      { return MetatypeEntiteit }
func (l *Land) ClearID()               { l.ID = 0 }
func (l Land) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *Land) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Land) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *Land) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Land) String() string          { return RepresentatieToString(l) }

// Locatie
func (l Locatie) GetID() any              { return l.ID }
func (l Locatie) Metatype() Metatype      { return MetatypeEntiteit }
func (l *Locatie) ClearID()               { l.ID = 0 }
func (l Locatie) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *Locatie) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Locatie) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *Locatie) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Locatie) String() string          { return RepresentatieToString(l) }

// NatuurlijkPersoon
func (n NatuurlijkPersoon) GetID() any              { return n.ID }
func (n NatuurlijkPersoon) Metatype() Metatype      { return MetatypeEntiteit }
func (n *NatuurlijkPersoon) ClearID()               { n.ID = 0 }
func (n NatuurlijkPersoon) GetOpvoer() *time.Time   { return n.Opvoer }
func (n *NatuurlijkPersoon) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon) GetAfvoer() *time.Time   { return n.Afvoer }
func (n *NatuurlijkPersoon) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon) String() string          { return RepresentatieToString(n) }

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

// AdellijkeTitelTitel
func (aa AdellijkeTitelTitel) GetID() any              { return aa.Rel_ID }
func (aa AdellijkeTitelTitel) Metatype() Metatype      { return MetatypeGegevenselement }
func (aa *AdellijkeTitelTitel) ClearID()               { aa.Rel_ID = 0 }
func (aa AdellijkeTitelTitel) GetOpvoer() *time.Time   { return aa.Opvoer }
func (aa *AdellijkeTitelTitel) SetOpvoer(t *time.Time) { aa.Opvoer = t }
func (aa AdellijkeTitelTitel) GetAfvoer() *time.Time   { return aa.Afvoer }
func (aa *AdellijkeTitelTitel) SetAfvoer(t *time.Time) { aa.Afvoer = t }
func (aa AdellijkeTitelTitel) String() string          { return RepresentatieToString(aa) }

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

// Locatie_Adres
func (la Locatie_Adres) GetID() any              { return la.Rel_ID }
func (la Locatie_Adres) Metatype() Metatype      { return MetatypeGegevenselement }
func (la *Locatie_Adres) ClearID()               { la.Rel_ID = 0 }
func (la Locatie_Adres) GetOpvoer() *time.Time   { return la.Opvoer }
func (la *Locatie_Adres) SetOpvoer(t *time.Time) { la.Opvoer = t }
func (la Locatie_Adres) GetAfvoer() *time.Time   { return la.Afvoer }
func (la *Locatie_Adres) SetAfvoer(t *time.Time) { la.Afvoer = t }
func (la Locatie_Adres) String() string          { return RepresentatieToString(la) }

// Locatie_BAGlocatie
func (lb Locatie_BAGlocatie) GetID() any              { return lb.Rel_ID }
func (lb Locatie_BAGlocatie) Metatype() Metatype      { return MetatypeGegevenselement }
func (lb *Locatie_BAGlocatie) ClearID()               { lb.Rel_ID = 0 }
func (lb Locatie_BAGlocatie) GetOpvoer() *time.Time   { return lb.Opvoer }
func (lb *Locatie_BAGlocatie) SetOpvoer(t *time.Time) { lb.Opvoer = t }
func (lb Locatie_BAGlocatie) GetAfvoer() *time.Time   { return lb.Afvoer }
func (lb *Locatie_BAGlocatie) SetAfvoer(t *time.Time) { lb.Afvoer = t }
func (lb Locatie_BAGlocatie) String() string          { return RepresentatieToString(lb) }

// NatuurlijkPersoon_Persoonsidentificatie
func (np NatuurlijkPersoon_Persoonsidentificatie) GetID() any              { return np.Rel_ID }
func (np NatuurlijkPersoon_Persoonsidentificatie) Metatype() Metatype      { return MetatypeGegevenselement }
func (np *NatuurlijkPersoon_Persoonsidentificatie) ClearID()               { np.Rel_ID = 0 }
func (np NatuurlijkPersoon_Persoonsidentificatie) GetOpvoer() *time.Time   { return np.Opvoer }
func (np *NatuurlijkPersoon_Persoonsidentificatie) SetOpvoer(t *time.Time) { np.Opvoer = t }
func (np NatuurlijkPersoon_Persoonsidentificatie) GetAfvoer() *time.Time   { return np.Afvoer }
func (np *NatuurlijkPersoon_Persoonsidentificatie) SetAfvoer(t *time.Time) { np.Afvoer = t }
func (np NatuurlijkPersoon_Persoonsidentificatie) String() string          { return RepresentatieToString(np) }

// NatuurlijkPersoon_Naam
func (nn NatuurlijkPersoon_Naam) GetID() any              { return nn.Rel_ID }
func (nn NatuurlijkPersoon_Naam) Metatype() Metatype      { return MetatypeGegevenselement }
func (nn *NatuurlijkPersoon_Naam) ClearID()               { nn.Rel_ID = 0 }
func (nn NatuurlijkPersoon_Naam) GetOpvoer() *time.Time   { return nn.Opvoer }
func (nn *NatuurlijkPersoon_Naam) SetOpvoer(t *time.Time) { nn.Opvoer = t }
func (nn NatuurlijkPersoon_Naam) GetAfvoer() *time.Time   { return nn.Afvoer }
func (nn *NatuurlijkPersoon_Naam) SetAfvoer(t *time.Time) { nn.Afvoer = t }
func (nn NatuurlijkPersoon_Naam) String() string          { return RepresentatieToString(nn) }

// NatuurlijkPersoon_Burgerschap
func (nb NatuurlijkPersoon_Burgerschap) GetID() any              { return nb.Rel_ID }
func (nb NatuurlijkPersoon_Burgerschap) Metatype() Metatype      { return MetatypeGegevenselement }
func (nb *NatuurlijkPersoon_Burgerschap) ClearID()               { nb.Rel_ID = 0 }
func (nb NatuurlijkPersoon_Burgerschap) GetOpvoer() *time.Time   { return nb.Opvoer }
func (nb *NatuurlijkPersoon_Burgerschap) SetOpvoer(t *time.Time) { nb.Opvoer = t }
func (nb NatuurlijkPersoon_Burgerschap) GetAfvoer() *time.Time   { return nb.Afvoer }
func (nb *NatuurlijkPersoon_Burgerschap) SetAfvoer(t *time.Time) { nb.Afvoer = t }
func (nb NatuurlijkPersoon_Burgerschap) String() string          { return RepresentatieToString(nb) }

// NatuurlijkPersoon_Partnernaam
func (np NatuurlijkPersoon_Partnernaam) GetID() any              { return np.Rel_ID }
func (np NatuurlijkPersoon_Partnernaam) Metatype() Metatype      { return MetatypeGegevenselement }
func (np *NatuurlijkPersoon_Partnernaam) ClearID()               { np.Rel_ID = 0 }
func (np NatuurlijkPersoon_Partnernaam) GetOpvoer() *time.Time   { return np.Opvoer }
func (np *NatuurlijkPersoon_Partnernaam) SetOpvoer(t *time.Time) { np.Opvoer = t }
func (np NatuurlijkPersoon_Partnernaam) GetAfvoer() *time.Time   { return np.Afvoer }
func (np *NatuurlijkPersoon_Partnernaam) SetAfvoer(t *time.Time) { np.Afvoer = t }
func (np NatuurlijkPersoon_Partnernaam) String() string          { return RepresentatieToString(np) }

// NatuurlijkPersoon_Naamgebruik
func (nn NatuurlijkPersoon_Naamgebruik) GetID() any              { return nn.Rel_ID }
func (nn NatuurlijkPersoon_Naamgebruik) Metatype() Metatype      { return MetatypeGegevenselement }
func (nn *NatuurlijkPersoon_Naamgebruik) ClearID()               { nn.Rel_ID = 0 }
func (nn NatuurlijkPersoon_Naamgebruik) GetOpvoer() *time.Time   { return nn.Opvoer }
func (nn *NatuurlijkPersoon_Naamgebruik) SetOpvoer(t *time.Time) { nn.Opvoer = t }
func (nn NatuurlijkPersoon_Naamgebruik) GetAfvoer() *time.Time   { return nn.Afvoer }
func (nn *NatuurlijkPersoon_Naamgebruik) SetAfvoer(t *time.Time) { nn.Afvoer = t }
func (nn NatuurlijkPersoon_Naamgebruik) String() string          { return RepresentatieToString(nn) }

// Bereikbaarheid
func (b Bereikbaarheid) GetID() any              { return b.Rel_ID }
func (b Bereikbaarheid) Metatype() Metatype      { return MetatypeRelatie }
func (b *Bereikbaarheid) ClearID()               { b.Rel_ID = 0 }
func (b Bereikbaarheid) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *Bereikbaarheid) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b Bereikbaarheid) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *Bereikbaarheid) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b Bereikbaarheid) String() string          { return RepresentatieToString(b) }

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

// AdellijkeTitelTitel_Data
func (d AdellijkeTitelTitel_Data) GetID() any              { return d.Versie }
func (d AdellijkeTitelTitel_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *AdellijkeTitelTitel_Data) ClearID()               { d.Versie = 0 }
func (d AdellijkeTitelTitel_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *AdellijkeTitelTitel_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d AdellijkeTitelTitel_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *AdellijkeTitelTitel_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d AdellijkeTitelTitel_Data) String() string          { return RepresentatieToString(d) }

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

// Locatie_Adres_Data
func (d Locatie_Adres_Data) GetID() any              { return d.Versie }
func (d Locatie_Adres_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Locatie_Adres_Data) ClearID()               { d.Versie = 0 }
func (d Locatie_Adres_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Locatie_Adres_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Locatie_Adres_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Locatie_Adres_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Locatie_Adres_Data) String() string          { return RepresentatieToString(d) }

// Locatie_BAGlocatie_Data
func (d Locatie_BAGlocatie_Data) GetID() any              { return d.Versie }
func (d Locatie_BAGlocatie_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Locatie_BAGlocatie_Data) ClearID()               { d.Versie = 0 }
func (d Locatie_BAGlocatie_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Locatie_BAGlocatie_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Locatie_BAGlocatie_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Locatie_BAGlocatie_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Locatie_BAGlocatie_Data) String() string          { return RepresentatieToString(d) }

// NatuurlijkPersoon_Persoonsidentificatie_Data
func (d NatuurlijkPersoon_Persoonsidentificatie_Data) GetID() any { return d.Versie }
func (d NatuurlijkPersoon_Persoonsidentificatie_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *NatuurlijkPersoon_Persoonsidentificatie_Data) ClearID()               { d.Versie = 0 }
func (d NatuurlijkPersoon_Persoonsidentificatie_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *NatuurlijkPersoon_Persoonsidentificatie_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NatuurlijkPersoon_Persoonsidentificatie_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *NatuurlijkPersoon_Persoonsidentificatie_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NatuurlijkPersoon_Persoonsidentificatie_Data) String() string {
	return RepresentatieToString(d)
}

// NatuurlijkPersoon_Naam_Data
func (d NatuurlijkPersoon_Naam_Data) GetID() any              { return d.Versie }
func (d NatuurlijkPersoon_Naam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *NatuurlijkPersoon_Naam_Data) ClearID()               { d.Versie = 0 }
func (d NatuurlijkPersoon_Naam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *NatuurlijkPersoon_Naam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NatuurlijkPersoon_Naam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *NatuurlijkPersoon_Naam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NatuurlijkPersoon_Naam_Data) String() string          { return RepresentatieToString(d) }

// NatuurlijkPersoon_Burgerschap_Data
func (d NatuurlijkPersoon_Burgerschap_Data) GetID() any              { return d.Versie }
func (d NatuurlijkPersoon_Burgerschap_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *NatuurlijkPersoon_Burgerschap_Data) ClearID()               { d.Versie = 0 }
func (d NatuurlijkPersoon_Burgerschap_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *NatuurlijkPersoon_Burgerschap_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NatuurlijkPersoon_Burgerschap_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *NatuurlijkPersoon_Burgerschap_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NatuurlijkPersoon_Burgerschap_Data) String() string          { return RepresentatieToString(d) }

// NatuurlijkPersoon_Partnernaam_Data
func (d NatuurlijkPersoon_Partnernaam_Data) GetID() any              { return d.Versie }
func (d NatuurlijkPersoon_Partnernaam_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *NatuurlijkPersoon_Partnernaam_Data) ClearID()               { d.Versie = 0 }
func (d NatuurlijkPersoon_Partnernaam_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *NatuurlijkPersoon_Partnernaam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NatuurlijkPersoon_Partnernaam_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *NatuurlijkPersoon_Partnernaam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NatuurlijkPersoon_Partnernaam_Data) String() string          { return RepresentatieToString(d) }

// NatuurlijkPersoon_Naamgebruik_Data
func (d NatuurlijkPersoon_Naamgebruik_Data) GetID() any              { return d.Versie }
func (d NatuurlijkPersoon_Naamgebruik_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *NatuurlijkPersoon_Naamgebruik_Data) ClearID()               { d.Versie = 0 }
func (d NatuurlijkPersoon_Naamgebruik_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *NatuurlijkPersoon_Naamgebruik_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NatuurlijkPersoon_Naamgebruik_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *NatuurlijkPersoon_Naamgebruik_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NatuurlijkPersoon_Naamgebruik_Data) String() string          { return RepresentatieToString(d) }

// Bereikbaarheid_Data
func (d Bereikbaarheid_Data) GetID() any              { return d.Versie }
func (d Bereikbaarheid_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Bereikbaarheid_Data) ClearID()               { d.Versie = 0 }
func (d Bereikbaarheid_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Bereikbaarheid_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Bereikbaarheid_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Bereikbaarheid_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Bereikbaarheid_Data) String() string          { return RepresentatieToString(d) }

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

// Locatie_Aanvang
func (l Locatie_Aanvang) GetID() any              { return l.Versie }
func (l Locatie_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (l *Locatie_Aanvang) ClearID()               { l.Versie = 0 }
func (l Locatie_Aanvang) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *Locatie_Aanvang) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Locatie_Aanvang) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *Locatie_Aanvang) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Locatie_Aanvang) String() string          { return RepresentatieToString(l) }

// Locatie_Einde
func (l Locatie_Einde) GetID() any              { return l.Versie }
func (l Locatie_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (l *Locatie_Einde) ClearID()               { l.Versie = 0 }
func (l Locatie_Einde) GetOpvoer() *time.Time   { return l.Opvoer }
func (l *Locatie_Einde) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Locatie_Einde) GetAfvoer() *time.Time   { return l.Afvoer }
func (l *Locatie_Einde) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Locatie_Einde) String() string          { return RepresentatieToString(l) }

// NatuurlijkPersoon_Aanvang
func (n NatuurlijkPersoon_Aanvang) GetID() any              { return n.Versie }
func (n NatuurlijkPersoon_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (n *NatuurlijkPersoon_Aanvang) ClearID()               { n.Versie = 0 }
func (n NatuurlijkPersoon_Aanvang) GetOpvoer() *time.Time   { return n.Opvoer }
func (n *NatuurlijkPersoon_Aanvang) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon_Aanvang) GetAfvoer() *time.Time   { return n.Afvoer }
func (n *NatuurlijkPersoon_Aanvang) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon_Aanvang) String() string          { return RepresentatieToString(n) }

// NatuurlijkPersoon_Einde
func (n NatuurlijkPersoon_Einde) GetID() any              { return n.Versie }
func (n NatuurlijkPersoon_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (n *NatuurlijkPersoon_Einde) ClearID()               { n.Versie = 0 }
func (n NatuurlijkPersoon_Einde) GetOpvoer() *time.Time   { return n.Opvoer }
func (n *NatuurlijkPersoon_Einde) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon_Einde) GetAfvoer() *time.Time   { return n.Afvoer }
func (n *NatuurlijkPersoon_Einde) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon_Einde) String() string          { return RepresentatieToString(n) }

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

// NatuurlijkPersoon_Burgerschap_Aanvang
func (n NatuurlijkPersoon_Burgerschap_Aanvang) GetID() any              { return n.Versie }
func (n NatuurlijkPersoon_Burgerschap_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (n *NatuurlijkPersoon_Burgerschap_Aanvang) ClearID()               { n.Versie = 0 }
func (n NatuurlijkPersoon_Burgerschap_Aanvang) GetOpvoer() *time.Time   { return n.Opvoer }
func (n *NatuurlijkPersoon_Burgerschap_Aanvang) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon_Burgerschap_Aanvang) GetAfvoer() *time.Time   { return n.Afvoer }
func (n *NatuurlijkPersoon_Burgerschap_Aanvang) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon_Burgerschap_Aanvang) String() string          { return RepresentatieToString(n) }

// NatuurlijkPersoon_Burgerschap_Einde
func (n NatuurlijkPersoon_Burgerschap_Einde) GetID() any              { return n.Versie }
func (n NatuurlijkPersoon_Burgerschap_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (n *NatuurlijkPersoon_Burgerschap_Einde) ClearID()               { n.Versie = 0 }
func (n NatuurlijkPersoon_Burgerschap_Einde) GetOpvoer() *time.Time   { return n.Opvoer }
func (n *NatuurlijkPersoon_Burgerschap_Einde) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon_Burgerschap_Einde) GetAfvoer() *time.Time   { return n.Afvoer }
func (n *NatuurlijkPersoon_Burgerschap_Einde) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon_Burgerschap_Einde) String() string          { return RepresentatieToString(n) }

// Bereikbaarheid_Aanvang
func (b Bereikbaarheid_Aanvang) GetID() any              { return b.Versie }
func (b Bereikbaarheid_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (b *Bereikbaarheid_Aanvang) ClearID()               { b.Versie = 0 }
func (b Bereikbaarheid_Aanvang) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *Bereikbaarheid_Aanvang) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b Bereikbaarheid_Aanvang) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *Bereikbaarheid_Aanvang) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b Bereikbaarheid_Aanvang) String() string          { return RepresentatieToString(b) }

// Bereikbaarheid_Einde
func (b Bereikbaarheid_Einde) GetID() any              { return b.Versie }
func (b Bereikbaarheid_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (b *Bereikbaarheid_Einde) ClearID()               { b.Versie = 0 }
func (b Bereikbaarheid_Einde) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *Bereikbaarheid_Einde) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b Bereikbaarheid_Einde) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *Bereikbaarheid_Einde) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b Bereikbaarheid_Einde) String() string          { return RepresentatieToString(b) }

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

// AdellijkeTitelTitel_Input
func (i AdellijkeTitelTitel_Input) GetID() any              { return i.Rel_ID }
func (i AdellijkeTitelTitel_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *AdellijkeTitelTitel_Input) ClearID()               { i.Rel_ID = 0 }
func (i AdellijkeTitelTitel_Input) GetOpvoer() *time.Time   { return nil }
func (i *AdellijkeTitelTitel_Input) SetOpvoer(t *time.Time) {}
func (i AdellijkeTitelTitel_Input) GetAfvoer() *time.Time   { return nil }
func (i *AdellijkeTitelTitel_Input) SetAfvoer(t *time.Time) {}
func (i AdellijkeTitelTitel_Input) String() string          { return RepresentatieToString(i) }

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

// Locatie_Adres_Input
func (i Locatie_Adres_Input) GetID() any              { return i.Rel_ID }
func (i Locatie_Adres_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Locatie_Adres_Input) ClearID()               { i.Rel_ID = 0 }
func (i Locatie_Adres_Input) GetOpvoer() *time.Time   { return nil }
func (i *Locatie_Adres_Input) SetOpvoer(t *time.Time) {}
func (i Locatie_Adres_Input) GetAfvoer() *time.Time   { return nil }
func (i *Locatie_Adres_Input) SetAfvoer(t *time.Time) {}
func (i Locatie_Adres_Input) String() string          { return RepresentatieToString(i) }

// Locatie_BAGlocatie_Input
func (i Locatie_BAGlocatie_Input) GetID() any              { return i.Rel_ID }
func (i Locatie_BAGlocatie_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Locatie_BAGlocatie_Input) ClearID()               { i.Rel_ID = 0 }
func (i Locatie_BAGlocatie_Input) GetOpvoer() *time.Time   { return nil }
func (i *Locatie_BAGlocatie_Input) SetOpvoer(t *time.Time) {}
func (i Locatie_BAGlocatie_Input) GetAfvoer() *time.Time   { return nil }
func (i *Locatie_BAGlocatie_Input) SetAfvoer(t *time.Time) {}
func (i Locatie_BAGlocatie_Input) String() string          { return RepresentatieToString(i) }

// NatuurlijkPersoon_Persoonsidentificatie_Input
func (i NatuurlijkPersoon_Persoonsidentificatie_Input) GetID() any { return i.Rel_ID }
func (i NatuurlijkPersoon_Persoonsidentificatie_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *NatuurlijkPersoon_Persoonsidentificatie_Input) ClearID()               { i.Rel_ID = 0 }
func (i NatuurlijkPersoon_Persoonsidentificatie_Input) GetOpvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Persoonsidentificatie_Input) SetOpvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Persoonsidentificatie_Input) GetAfvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Persoonsidentificatie_Input) SetAfvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Persoonsidentificatie_Input) String() string {
	return RepresentatieToString(i)
}

// NatuurlijkPersoon_Naam_Input
func (i NatuurlijkPersoon_Naam_Input) GetID() any              { return i.Rel_ID }
func (i NatuurlijkPersoon_Naam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *NatuurlijkPersoon_Naam_Input) ClearID()               { i.Rel_ID = 0 }
func (i NatuurlijkPersoon_Naam_Input) GetOpvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Naam_Input) SetOpvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Naam_Input) GetAfvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Naam_Input) SetAfvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Naam_Input) String() string          { return RepresentatieToString(i) }

// NatuurlijkPersoon_Burgerschap_Input
func (i NatuurlijkPersoon_Burgerschap_Input) GetID() any              { return i.Rel_ID }
func (i NatuurlijkPersoon_Burgerschap_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *NatuurlijkPersoon_Burgerschap_Input) ClearID()               { i.Rel_ID = 0 }
func (i NatuurlijkPersoon_Burgerschap_Input) GetOpvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Burgerschap_Input) SetOpvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Burgerschap_Input) GetAfvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Burgerschap_Input) SetAfvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Burgerschap_Input) String() string          { return RepresentatieToString(i) }

// NatuurlijkPersoon_Partnernaam_Input
func (i NatuurlijkPersoon_Partnernaam_Input) GetID() any              { return i.Rel_ID }
func (i NatuurlijkPersoon_Partnernaam_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *NatuurlijkPersoon_Partnernaam_Input) ClearID()               { i.Rel_ID = 0 }
func (i NatuurlijkPersoon_Partnernaam_Input) GetOpvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Partnernaam_Input) SetOpvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Partnernaam_Input) GetAfvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Partnernaam_Input) SetAfvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Partnernaam_Input) String() string          { return RepresentatieToString(i) }

// NatuurlijkPersoon_Naamgebruik_Input
func (i NatuurlijkPersoon_Naamgebruik_Input) GetID() any              { return i.Rel_ID }
func (i NatuurlijkPersoon_Naamgebruik_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *NatuurlijkPersoon_Naamgebruik_Input) ClearID()               { i.Rel_ID = 0 }
func (i NatuurlijkPersoon_Naamgebruik_Input) GetOpvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Naamgebruik_Input) SetOpvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Naamgebruik_Input) GetAfvoer() *time.Time   { return nil }
func (i *NatuurlijkPersoon_Naamgebruik_Input) SetAfvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Naamgebruik_Input) String() string          { return RepresentatieToString(i) }

// Bereikbaarheid_Input
func (i Bereikbaarheid_Input) GetID() any              { return i.Rel_ID }
func (i Bereikbaarheid_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *Bereikbaarheid_Input) ClearID()               { i.Rel_ID = 0 }
func (i Bereikbaarheid_Input) GetOpvoer() *time.Time   { return nil }
func (i *Bereikbaarheid_Input) SetOpvoer(t *time.Time) {}
func (i Bereikbaarheid_Input) GetAfvoer() *time.Time   { return nil }
func (i *Bereikbaarheid_Input) SetAfvoer(t *time.Time) {}
func (i Bereikbaarheid_Input) String() string          { return RepresentatieToString(i) }

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

func (a *A) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range a.AUs {
		if a.AUs[i].A_ID == 0 {
			a.AUs[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_U", Representatie: &a.AUs[i]})
	}
	for i := range a.AVs {
		if a.AVs[i].A_ID == 0 {
			a.AVs[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_V", Representatie: &a.AVs[i]})
	}
	for i := range a.AWs {
		if a.AWs[i].A_ID == 0 {
			a.AWs[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W", Representatie: &a.AWs[i]})
	}
	for i := range a.RelABs {
		if a.RelABs[i].A_ID == 0 {
			a.RelABs[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B", Representatie: &a.RelABs[i]})
	}
	for i := range a.Aanvang {
		if a.Aanvang[i].A_ID == 0 {
			a.Aanvang[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_Aanvang", Representatie: &a.Aanvang[i]})
	}
	for i := range a.Einde {
		if a.Einde[i].A_ID == 0 {
			a.Einde[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_Einde", Representatie: &a.Einde[i]})
	}
	return result
}

func (a *AdellijkeTitel) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range a.AdellijkeTitelTitels {
		if a.AdellijkeTitelTitels[i].AdellijkeTitel_ID == 0 {
			a.AdellijkeTitelTitels[i].AdellijkeTitel_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "AdellijkeTitelTitel", Representatie: &a.AdellijkeTitelTitels[i]})
	}
	return result
}

func (b *B) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range b.BXs {
		if b.BXs[i].B_ID == 0 {
			b.BXs[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_X", Representatie: &b.BXs[i]})
	}
	for i := range b.BYs {
		if b.BYs[i].B_ID == 0 {
			b.BYs[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Y", Representatie: &b.BYs[i]})
	}
	for i := range b.Aanvang {
		if b.Aanvang[i].B_ID == 0 {
			b.Aanvang[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Aanvang", Representatie: &b.Aanvang[i]})
	}
	for i := range b.Einde {
		if b.Einde[i].B_ID == 0 {
			b.Einde[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Einde", Representatie: &b.Einde[i]})
	}
	return result
}

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

func (l *Locatie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range l.Adressen {
		if l.Adressen[i].Locatie_ID == 0 {
			l.Adressen[i].Locatie_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Locatie_Adres", Representatie: &l.Adressen[i]})
	}
	for i := range l.Baglocaties {
		if l.Baglocaties[i].Locatie_ID == 0 {
			l.Baglocaties[i].Locatie_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Locatie_BAGlocatie", Representatie: &l.Baglocaties[i]})
	}
	for i := range l.Aanvang {
		if l.Aanvang[i].Locatie_ID == 0 {
			l.Aanvang[i].Locatie_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Locatie_Aanvang", Representatie: &l.Aanvang[i]})
	}
	for i := range l.Einde {
		if l.Einde[i].Locatie_ID == 0 {
			l.Einde[i].Locatie_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Locatie_Einde", Representatie: &l.Einde[i]})
	}
	return result
}

func (n *NatuurlijkPersoon) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range n.Persoonsidentificaties {
		if n.Persoonsidentificaties[i].NatuurlijkPersoon_ID == 0 {
			n.Persoonsidentificaties[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Persoonsidentificatie", Representatie: &n.Persoonsidentificaties[i]})
	}
	for i := range n.Namen {
		if n.Namen[i].NatuurlijkPersoon_ID == 0 {
			n.Namen[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Naam", Representatie: &n.Namen[i]})
	}
	for i := range n.Burgerschappen {
		if n.Burgerschappen[i].NatuurlijkPersoon_ID == 0 {
			n.Burgerschappen[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Burgerschap", Representatie: &n.Burgerschappen[i]})
	}
	for i := range n.Partnernamen {
		if n.Partnernamen[i].NatuurlijkPersoon_ID == 0 {
			n.Partnernamen[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Partnernaam", Representatie: &n.Partnernamen[i]})
	}
	for i := range n.Naamgebruiken {
		if n.Naamgebruiken[i].NatuurlijkPersoon_ID == 0 {
			n.Naamgebruiken[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Naamgebruik", Representatie: &n.Naamgebruiken[i]})
	}
	for i := range n.Bereikbaarheden {
		if n.Bereikbaarheden[i].NatuurlijkPersoon_ID == 0 {
			n.Bereikbaarheden[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Bereikbaarheid", Representatie: &n.Bereikbaarheden[i]})
	}
	for i := range n.Aanvang {
		if n.Aanvang[i].NatuurlijkPersoon_ID == 0 {
			n.Aanvang[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Aanvang", Representatie: &n.Aanvang[i]})
	}
	for i := range n.Einde {
		if n.Einde[i].NatuurlijkPersoon_ID == 0 {
			n.Einde[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Einde", Representatie: &n.Einde[i]})
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

func (h *AdellijkeTitelTitel) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].AdellijkeTitel_ID == 0 {
			h.Data[i].AdellijkeTitel_ID = h.AdellijkeTitel_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "AdellijkeTitelTitel_Data", Representatie: &h.Data[i]})
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

func (h *Locatie_Adres) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Locatie_ID == 0 {
			h.Data[i].Locatie_ID = h.Locatie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Locatie_Adres_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Locatie_BAGlocatie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Locatie_ID == 0 {
			h.Data[i].Locatie_ID = h.Locatie_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Locatie_BAGlocatie_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *NatuurlijkPersoon_Persoonsidentificatie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].NatuurlijkPersoon_ID == 0 {
			h.Data[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Persoonsidentificatie_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *NatuurlijkPersoon_Naam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].NatuurlijkPersoon_ID == 0 {
			h.Data[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Naam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *NatuurlijkPersoon_Burgerschap) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].NatuurlijkPersoon_ID == 0 {
			h.Data[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Burgerschap_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].NatuurlijkPersoon_ID == 0 {
			h.Aanvang[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Burgerschap_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].NatuurlijkPersoon_ID == 0 {
			h.Einde[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Burgerschap_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *NatuurlijkPersoon_Partnernaam) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].NatuurlijkPersoon_ID == 0 {
			h.Data[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Partnernaam_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *NatuurlijkPersoon_Naamgebruik) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].NatuurlijkPersoon_ID == 0 {
			h.Data[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Naamgebruik_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Bereikbaarheid) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].NatuurlijkPersoon_ID == 0 {
			h.Data[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Bereikbaarheid_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].NatuurlijkPersoon_ID == 0 {
			h.Aanvang[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Bereikbaarheid_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].NatuurlijkPersoon_ID == 0 {
			h.Einde[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Bereikbaarheid_Einde", Representatie: &h.Einde[i]})
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
