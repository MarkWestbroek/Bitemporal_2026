package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// NatuurlijkPersoon
func (n NatuurlijkPersoon) GetID() any { return n.ID }
func (n NatuurlijkPersoon) Metatype() Metatype { return MetatypeEntiteit }
func (n *NatuurlijkPersoon) ClearID() { n.ID = 0 }
func (n NatuurlijkPersoon) GetOpvoer() *time.Time { return n.Opvoer }
func (n *NatuurlijkPersoon) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon) GetAfvoer() *time.Time { return n.Afvoer }
func (n *NatuurlijkPersoon) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon) String() string { return RepresentatieToString(n) }

// Locatie
func (l Locatie) GetID() any { return l.ID }
func (l Locatie) Metatype() Metatype { return MetatypeEntiteit }
func (l *Locatie) ClearID() { l.ID = 0 }
func (l Locatie) GetOpvoer() *time.Time { return l.Opvoer }
func (l *Locatie) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Locatie) GetAfvoer() *time.Time { return l.Afvoer }
func (l *Locatie) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Locatie) String() string { return RepresentatieToString(l) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// NatuurlijkPersoon_PersoonsIdentificatie
func (np NatuurlijkPersoon_PersoonsIdentificatie) GetID() any { return np.Rel_ID }
func (np NatuurlijkPersoon_PersoonsIdentificatie) Metatype() Metatype { return MetatypeGegevenselement }
func (np *NatuurlijkPersoon_PersoonsIdentificatie) ClearID() { np.Rel_ID = 0 }
func (np NatuurlijkPersoon_PersoonsIdentificatie) GetOpvoer() *time.Time { return np.Opvoer }
func (np *NatuurlijkPersoon_PersoonsIdentificatie) SetOpvoer(t *time.Time) { np.Opvoer = t }
func (np NatuurlijkPersoon_PersoonsIdentificatie) GetAfvoer() *time.Time { return np.Afvoer }
func (np *NatuurlijkPersoon_PersoonsIdentificatie) SetAfvoer(t *time.Time) { np.Afvoer = t }
func (np NatuurlijkPersoon_PersoonsIdentificatie) String() string { return RepresentatieToString(np) }

// NatuurlijkPersoon_Naam
func (nn NatuurlijkPersoon_Naam) GetID() any { return nn.Rel_ID }
func (nn NatuurlijkPersoon_Naam) Metatype() Metatype { return MetatypeGegevenselement }
func (nn *NatuurlijkPersoon_Naam) ClearID() { nn.Rel_ID = 0 }
func (nn NatuurlijkPersoon_Naam) GetOpvoer() *time.Time { return nn.Opvoer }
func (nn *NatuurlijkPersoon_Naam) SetOpvoer(t *time.Time) { nn.Opvoer = t }
func (nn NatuurlijkPersoon_Naam) GetAfvoer() *time.Time { return nn.Afvoer }
func (nn *NatuurlijkPersoon_Naam) SetAfvoer(t *time.Time) { nn.Afvoer = t }
func (nn NatuurlijkPersoon_Naam) String() string { return RepresentatieToString(nn) }

// NatuurlijkPersoon_Burgerschap
func (nb NatuurlijkPersoon_Burgerschap) GetID() any { return nb.Rel_ID }
func (nb NatuurlijkPersoon_Burgerschap) Metatype() Metatype { return MetatypeGegevenselement }
func (nb *NatuurlijkPersoon_Burgerschap) ClearID() { nb.Rel_ID = 0 }
func (nb NatuurlijkPersoon_Burgerschap) GetOpvoer() *time.Time { return nb.Opvoer }
func (nb *NatuurlijkPersoon_Burgerschap) SetOpvoer(t *time.Time) { nb.Opvoer = t }
func (nb NatuurlijkPersoon_Burgerschap) GetAfvoer() *time.Time { return nb.Afvoer }
func (nb *NatuurlijkPersoon_Burgerschap) SetAfvoer(t *time.Time) { nb.Afvoer = t }
func (nb NatuurlijkPersoon_Burgerschap) String() string { return RepresentatieToString(nb) }

// Bereikbaarheid
func (b Bereikbaarheid) GetID() any { return b.Rel_ID }
func (b Bereikbaarheid) Metatype() Metatype { return MetatypeRelatie }
func (b *Bereikbaarheid) ClearID() { b.Rel_ID = 0 }
func (b Bereikbaarheid) GetOpvoer() *time.Time { return b.Opvoer }
func (b *Bereikbaarheid) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b Bereikbaarheid) GetAfvoer() *time.Time { return b.Afvoer }
func (b *Bereikbaarheid) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b Bereikbaarheid) String() string { return RepresentatieToString(b) }

// Locatie_Adres
func (la Locatie_Adres) GetID() any { return la.Rel_ID }
func (la Locatie_Adres) Metatype() Metatype { return MetatypeGegevenselement }
func (la *Locatie_Adres) ClearID() { la.Rel_ID = 0 }
func (la Locatie_Adres) GetOpvoer() *time.Time { return la.Opvoer }
func (la *Locatie_Adres) SetOpvoer(t *time.Time) { la.Opvoer = t }
func (la Locatie_Adres) GetAfvoer() *time.Time { return la.Afvoer }
func (la *Locatie_Adres) SetAfvoer(t *time.Time) { la.Afvoer = t }
func (la Locatie_Adres) String() string { return RepresentatieToString(la) }

// Locatie_BAGlocatie
func (lb Locatie_BAGlocatie) GetID() any { return lb.Rel_ID }
func (lb Locatie_BAGlocatie) Metatype() Metatype { return MetatypeGegevenselement }
func (lb *Locatie_BAGlocatie) ClearID() { lb.Rel_ID = 0 }
func (lb Locatie_BAGlocatie) GetOpvoer() *time.Time { return lb.Opvoer }
func (lb *Locatie_BAGlocatie) SetOpvoer(t *time.Time) { lb.Opvoer = t }
func (lb Locatie_BAGlocatie) GetAfvoer() *time.Time { return lb.Afvoer }
func (lb *Locatie_BAGlocatie) SetAfvoer(t *time.Time) { lb.Afvoer = t }
func (lb Locatie_BAGlocatie) String() string { return RepresentatieToString(lb) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// NatuurlijkPersoon_PersoonsIdentificatie_Data
func (d NatuurlijkPersoon_PersoonsIdentificatie_Data) GetID() any { return d.Versie }
func (d NatuurlijkPersoon_PersoonsIdentificatie_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *NatuurlijkPersoon_PersoonsIdentificatie_Data) ClearID() { d.Versie = 0 }
func (d NatuurlijkPersoon_PersoonsIdentificatie_Data) GetOpvoer() *time.Time { return d.Opvoer }
func (d *NatuurlijkPersoon_PersoonsIdentificatie_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NatuurlijkPersoon_PersoonsIdentificatie_Data) GetAfvoer() *time.Time { return d.Afvoer }
func (d *NatuurlijkPersoon_PersoonsIdentificatie_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NatuurlijkPersoon_PersoonsIdentificatie_Data) String() string { return RepresentatieToString(d) }

// NatuurlijkPersoon_Naam_Data
func (d NatuurlijkPersoon_Naam_Data) GetID() any { return d.Versie }
func (d NatuurlijkPersoon_Naam_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *NatuurlijkPersoon_Naam_Data) ClearID() { d.Versie = 0 }
func (d NatuurlijkPersoon_Naam_Data) GetOpvoer() *time.Time { return d.Opvoer }
func (d *NatuurlijkPersoon_Naam_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NatuurlijkPersoon_Naam_Data) GetAfvoer() *time.Time { return d.Afvoer }
func (d *NatuurlijkPersoon_Naam_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NatuurlijkPersoon_Naam_Data) String() string { return RepresentatieToString(d) }

// NatuurlijkPersoon_Burgerschap_Data
func (d NatuurlijkPersoon_Burgerschap_Data) GetID() any { return d.Versie }
func (d NatuurlijkPersoon_Burgerschap_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *NatuurlijkPersoon_Burgerschap_Data) ClearID() { d.Versie = 0 }
func (d NatuurlijkPersoon_Burgerschap_Data) GetOpvoer() *time.Time { return d.Opvoer }
func (d *NatuurlijkPersoon_Burgerschap_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d NatuurlijkPersoon_Burgerschap_Data) GetAfvoer() *time.Time { return d.Afvoer }
func (d *NatuurlijkPersoon_Burgerschap_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d NatuurlijkPersoon_Burgerschap_Data) String() string { return RepresentatieToString(d) }

// Bereikbaarheid_Data
func (d Bereikbaarheid_Data) GetID() any { return d.Versie }
func (d Bereikbaarheid_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *Bereikbaarheid_Data) ClearID() { d.Versie = 0 }
func (d Bereikbaarheid_Data) GetOpvoer() *time.Time { return d.Opvoer }
func (d *Bereikbaarheid_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Bereikbaarheid_Data) GetAfvoer() *time.Time { return d.Afvoer }
func (d *Bereikbaarheid_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Bereikbaarheid_Data) String() string { return RepresentatieToString(d) }

// Locatie_Adres_Data
func (d Locatie_Adres_Data) GetID() any { return d.Versie }
func (d Locatie_Adres_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *Locatie_Adres_Data) ClearID() { d.Versie = 0 }
func (d Locatie_Adres_Data) GetOpvoer() *time.Time { return d.Opvoer }
func (d *Locatie_Adres_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Locatie_Adres_Data) GetAfvoer() *time.Time { return d.Afvoer }
func (d *Locatie_Adres_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Locatie_Adres_Data) String() string { return RepresentatieToString(d) }

// Locatie_BAGlocatie_Data
func (d Locatie_BAGlocatie_Data) GetID() any { return d.Versie }
func (d Locatie_BAGlocatie_Data) Metatype() Metatype { return MetatypeGegevenselement }
func (d *Locatie_BAGlocatie_Data) ClearID() { d.Versie = 0 }
func (d Locatie_BAGlocatie_Data) GetOpvoer() *time.Time { return d.Opvoer }
func (d *Locatie_BAGlocatie_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Locatie_BAGlocatie_Data) GetAfvoer() *time.Time { return d.Afvoer }
func (d *Locatie_BAGlocatie_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Locatie_BAGlocatie_Data) String() string { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

// NatuurlijkPersoon_Aanvang
func (n NatuurlijkPersoon_Aanvang) GetID() any { return n.Versie }
func (n NatuurlijkPersoon_Aanvang) Metatype() Metatype { return MetatypeGegevenselement }
func (n *NatuurlijkPersoon_Aanvang) ClearID() { n.Versie = 0 }
func (n NatuurlijkPersoon_Aanvang) GetOpvoer() *time.Time { return n.Opvoer }
func (n *NatuurlijkPersoon_Aanvang) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon_Aanvang) GetAfvoer() *time.Time { return n.Afvoer }
func (n *NatuurlijkPersoon_Aanvang) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon_Aanvang) String() string { return RepresentatieToString(n) }

// NatuurlijkPersoon_Einde
func (n NatuurlijkPersoon_Einde) GetID() any { return n.Versie }
func (n NatuurlijkPersoon_Einde) Metatype() Metatype { return MetatypeGegevenselement }
func (n *NatuurlijkPersoon_Einde) ClearID() { n.Versie = 0 }
func (n NatuurlijkPersoon_Einde) GetOpvoer() *time.Time { return n.Opvoer }
func (n *NatuurlijkPersoon_Einde) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon_Einde) GetAfvoer() *time.Time { return n.Afvoer }
func (n *NatuurlijkPersoon_Einde) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon_Einde) String() string { return RepresentatieToString(n) }

// Locatie_Aanvang
func (l Locatie_Aanvang) GetID() any { return l.Versie }
func (l Locatie_Aanvang) Metatype() Metatype { return MetatypeGegevenselement }
func (l *Locatie_Aanvang) ClearID() { l.Versie = 0 }
func (l Locatie_Aanvang) GetOpvoer() *time.Time { return l.Opvoer }
func (l *Locatie_Aanvang) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Locatie_Aanvang) GetAfvoer() *time.Time { return l.Afvoer }
func (l *Locatie_Aanvang) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Locatie_Aanvang) String() string { return RepresentatieToString(l) }

// Locatie_Einde
func (l Locatie_Einde) GetID() any { return l.Versie }
func (l Locatie_Einde) Metatype() Metatype { return MetatypeGegevenselement }
func (l *Locatie_Einde) ClearID() { l.Versie = 0 }
func (l Locatie_Einde) GetOpvoer() *time.Time { return l.Opvoer }
func (l *Locatie_Einde) SetOpvoer(t *time.Time) { l.Opvoer = t }
func (l Locatie_Einde) GetAfvoer() *time.Time { return l.Afvoer }
func (l *Locatie_Einde) SetAfvoer(t *time.Time) { l.Afvoer = t }
func (l Locatie_Einde) String() string { return RepresentatieToString(l) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

// NatuurlijkPersoon_Burgerschap_Aanvang
func (n NatuurlijkPersoon_Burgerschap_Aanvang) GetID() any { return n.Versie }
func (n NatuurlijkPersoon_Burgerschap_Aanvang) Metatype() Metatype { return MetatypeGegevenselement }
func (n *NatuurlijkPersoon_Burgerschap_Aanvang) ClearID() { n.Versie = 0 }
func (n NatuurlijkPersoon_Burgerschap_Aanvang) GetOpvoer() *time.Time { return n.Opvoer }
func (n *NatuurlijkPersoon_Burgerschap_Aanvang) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon_Burgerschap_Aanvang) GetAfvoer() *time.Time { return n.Afvoer }
func (n *NatuurlijkPersoon_Burgerschap_Aanvang) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon_Burgerschap_Aanvang) String() string { return RepresentatieToString(n) }

// NatuurlijkPersoon_Burgerschap_Einde
func (n NatuurlijkPersoon_Burgerschap_Einde) GetID() any { return n.Versie }
func (n NatuurlijkPersoon_Burgerschap_Einde) Metatype() Metatype { return MetatypeGegevenselement }
func (n *NatuurlijkPersoon_Burgerschap_Einde) ClearID() { n.Versie = 0 }
func (n NatuurlijkPersoon_Burgerschap_Einde) GetOpvoer() *time.Time { return n.Opvoer }
func (n *NatuurlijkPersoon_Burgerschap_Einde) SetOpvoer(t *time.Time) { n.Opvoer = t }
func (n NatuurlijkPersoon_Burgerschap_Einde) GetAfvoer() *time.Time { return n.Afvoer }
func (n *NatuurlijkPersoon_Burgerschap_Einde) SetAfvoer(t *time.Time) { n.Afvoer = t }
func (n NatuurlijkPersoon_Burgerschap_Einde) String() string { return RepresentatieToString(n) }

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// NatuurlijkPersoon_PersoonsIdentificatie_Input
func (i NatuurlijkPersoon_PersoonsIdentificatie_Input) GetID() any { return i.Rel_ID }
func (i NatuurlijkPersoon_PersoonsIdentificatie_Input) Metatype() Metatype { return MetatypeGegevenselement }
func (i *NatuurlijkPersoon_PersoonsIdentificatie_Input) ClearID() { i.Rel_ID = 0 }
func (i NatuurlijkPersoon_PersoonsIdentificatie_Input) GetOpvoer() *time.Time { return nil }
func (i *NatuurlijkPersoon_PersoonsIdentificatie_Input) SetOpvoer(t *time.Time) {}
func (i NatuurlijkPersoon_PersoonsIdentificatie_Input) GetAfvoer() *time.Time { return nil }
func (i *NatuurlijkPersoon_PersoonsIdentificatie_Input) SetAfvoer(t *time.Time) {}
func (i NatuurlijkPersoon_PersoonsIdentificatie_Input) String() string { return RepresentatieToString(i) }

// NatuurlijkPersoon_Naam_Input
func (i NatuurlijkPersoon_Naam_Input) GetID() any { return i.Rel_ID }
func (i NatuurlijkPersoon_Naam_Input) Metatype() Metatype { return MetatypeGegevenselement }
func (i *NatuurlijkPersoon_Naam_Input) ClearID() { i.Rel_ID = 0 }
func (i NatuurlijkPersoon_Naam_Input) GetOpvoer() *time.Time { return nil }
func (i *NatuurlijkPersoon_Naam_Input) SetOpvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Naam_Input) GetAfvoer() *time.Time { return nil }
func (i *NatuurlijkPersoon_Naam_Input) SetAfvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Naam_Input) String() string { return RepresentatieToString(i) }

// NatuurlijkPersoon_Burgerschap_Input
func (i NatuurlijkPersoon_Burgerschap_Input) GetID() any { return i.Rel_ID }
func (i NatuurlijkPersoon_Burgerschap_Input) Metatype() Metatype { return MetatypeGegevenselement }
func (i *NatuurlijkPersoon_Burgerschap_Input) ClearID() { i.Rel_ID = 0 }
func (i NatuurlijkPersoon_Burgerschap_Input) GetOpvoer() *time.Time { return nil }
func (i *NatuurlijkPersoon_Burgerschap_Input) SetOpvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Burgerschap_Input) GetAfvoer() *time.Time { return nil }
func (i *NatuurlijkPersoon_Burgerschap_Input) SetAfvoer(t *time.Time) {}
func (i NatuurlijkPersoon_Burgerschap_Input) String() string { return RepresentatieToString(i) }

// Bereikbaarheid_Input
func (i Bereikbaarheid_Input) GetID() any { return i.Rel_ID }
func (i Bereikbaarheid_Input) Metatype() Metatype { return MetatypeRelatie }
func (i *Bereikbaarheid_Input) ClearID() { i.Rel_ID = 0 }
func (i Bereikbaarheid_Input) GetOpvoer() *time.Time { return nil }
func (i *Bereikbaarheid_Input) SetOpvoer(t *time.Time) {}
func (i Bereikbaarheid_Input) GetAfvoer() *time.Time { return nil }
func (i *Bereikbaarheid_Input) SetAfvoer(t *time.Time) {}
func (i Bereikbaarheid_Input) String() string { return RepresentatieToString(i) }

// Locatie_Adres_Input
func (i Locatie_Adres_Input) GetID() any { return i.Rel_ID }
func (i Locatie_Adres_Input) Metatype() Metatype { return MetatypeGegevenselement }
func (i *Locatie_Adres_Input) ClearID() { i.Rel_ID = 0 }
func (i Locatie_Adres_Input) GetOpvoer() *time.Time { return nil }
func (i *Locatie_Adres_Input) SetOpvoer(t *time.Time) {}
func (i Locatie_Adres_Input) GetAfvoer() *time.Time { return nil }
func (i *Locatie_Adres_Input) SetAfvoer(t *time.Time) {}
func (i Locatie_Adres_Input) String() string { return RepresentatieToString(i) }

// Locatie_BAGlocatie_Input
func (i Locatie_BAGlocatie_Input) GetID() any { return i.Rel_ID }
func (i Locatie_BAGlocatie_Input) Metatype() Metatype { return MetatypeGegevenselement }
func (i *Locatie_BAGlocatie_Input) ClearID() { i.Rel_ID = 0 }
func (i Locatie_BAGlocatie_Input) GetOpvoer() *time.Time { return nil }
func (i *Locatie_BAGlocatie_Input) SetOpvoer(t *time.Time) {}
func (i Locatie_BAGlocatie_Input) GetAfvoer() *time.Time { return nil }
func (i *Locatie_BAGlocatie_Input) SetAfvoer(t *time.Time) {}
func (i Locatie_BAGlocatie_Input) String() string { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (n *NatuurlijkPersoon) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range n.PersoonsIdentificaties {
		if n.PersoonsIdentificaties[i].NatuurlijkPersoon_ID == 0 {
			n.PersoonsIdentificaties[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_PersoonsIdentificatie", Representatie: &n.PersoonsIdentificaties[i]})
	}
	for i := range n.Naams {
		if n.Naams[i].NatuurlijkPersoon_ID == 0 {
			n.Naams[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Naam", Representatie: &n.Naams[i]})
	}
	for i := range n.Burgerschaps {
		if n.Burgerschaps[i].NatuurlijkPersoon_ID == 0 {
			n.Burgerschaps[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_Burgerschap", Representatie: &n.Burgerschaps[i]})
	}
	for i := range n.Bereikbaarheids {
		if n.Bereikbaarheids[i].NatuurlijkPersoon_ID == 0 {
			n.Bereikbaarheids[i].NatuurlijkPersoon_ID = n.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Bereikbaarheid", Representatie: &n.Bereikbaarheids[i]})
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

func (l *Locatie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for i := range l.Adress {
		if l.Adress[i].Locatie_ID == 0 {
			l.Adress[i].Locatie_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Locatie_Adres", Representatie: &l.Adress[i]})
	}
	for i := range l.BAGlocaties {
		if l.BAGlocaties[i].Locatie_ID == 0 {
			l.BAGlocaties[i].Locatie_ID = l.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Locatie_BAGlocatie", Representatie: &l.BAGlocaties[i]})
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

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *NatuurlijkPersoon_PersoonsIdentificatie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].NatuurlijkPersoon_ID == 0 {
			h.Data[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "NatuurlijkPersoon_PersoonsIdentificatie_Data", Representatie: &h.Data[i]})
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

func (h *Bereikbaarheid) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].NatuurlijkPersoon_ID == 0 {
			h.Data[i].NatuurlijkPersoon_ID = h.NatuurlijkPersoon_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Bereikbaarheid_Data", Representatie: &h.Data[i]})
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

