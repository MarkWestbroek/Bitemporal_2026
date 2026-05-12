package model

// Alle methoden op domein-structs.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

import "time"

/* ================================================================
   1. ENTITEITEN — interface-methoden
   ================================================================ */

// Kennisartikel
func (k Kennisartikel) GetID() any              { return k.ID }
func (k Kennisartikel) Metatype() Metatype      { return MetatypeEntiteit }
func (k *Kennisartikel) ClearID()               { k.ID = 0 }
func (k Kennisartikel) GetOpvoer() *time.Time   { return k.Opvoer }
func (k *Kennisartikel) SetOpvoer(t *time.Time) { k.Opvoer = t }
func (k Kennisartikel) GetAfvoer() *time.Time   { return k.Afvoer }
func (k *Kennisartikel) SetAfvoer(t *time.Time) { k.Afvoer = t }
func (k Kennisartikel) String() string          { return RepresentatieToString(k) }

// KennisartikelTaalvariant
func (k KennisartikelTaalvariant) GetID() any              { return k.ID }
func (k KennisartikelTaalvariant) Metatype() Metatype      { return MetatypeEntiteit }
func (k *KennisartikelTaalvariant) ClearID()               { k.ID = 0 }
func (k KennisartikelTaalvariant) GetOpvoer() *time.Time   { return k.Opvoer }
func (k *KennisartikelTaalvariant) SetOpvoer(t *time.Time) { k.Opvoer = t }
func (k KennisartikelTaalvariant) GetAfvoer() *time.Time   { return k.Afvoer }
func (k *KennisartikelTaalvariant) SetAfvoer(t *time.Time) { k.Afvoer = t }
func (k KennisartikelTaalvariant) String() string          { return RepresentatieToString(k) }

// Trefwoord
func (t Trefwoord) GetID() any               { return t.ID }
func (t Trefwoord) Metatype() Metatype       { return MetatypeEntiteit }
func (t *Trefwoord) ClearID()                { t.ID = 0 }
func (t Trefwoord) GetOpvoer() *time.Time    { return t.Opvoer }
func (t *Trefwoord) SetOpvoer(ts *time.Time) { t.Opvoer = ts }
func (t Trefwoord) GetAfvoer() *time.Time    { return t.Afvoer }
func (t *Trefwoord) SetAfvoer(ts *time.Time) { t.Afvoer = ts }
func (t Trefwoord) String() string           { return RepresentatieToString(t) }

/* ================================================================
   2. HUBS (GE + REL) — interface-methoden
   ================================================================ */

// KA_Tr
func (k KA_Tr) GetID() any              { return k.Rel_ID }
func (k KA_Tr) Metatype() Metatype      { return MetatypeRelatie }
func (k *KA_Tr) ClearID()               { k.Rel_ID = 0 }
func (k KA_Tr) GetOpvoer() *time.Time   { return k.Opvoer }
func (k *KA_Tr) SetOpvoer(t *time.Time) { k.Opvoer = t }
func (k KA_Tr) GetAfvoer() *time.Time   { return k.Afvoer }
func (k *KA_Tr) SetAfvoer(t *time.Time) { k.Afvoer = t }
func (k KA_Tr) String() string          { return RepresentatieToString(k) }

// KA_TV
func (k KA_TV) GetID() any              { return k.Rel_ID }
func (k KA_TV) Metatype() Metatype      { return MetatypeRelatie }
func (k *KA_TV) ClearID()               { k.Rel_ID = 0 }
func (k KA_TV) GetOpvoer() *time.Time   { return k.Opvoer }
func (k *KA_TV) SetOpvoer(t *time.Time) { k.Opvoer = t }
func (k KA_TV) GetAfvoer() *time.Time   { return k.Afvoer }
func (k *KA_TV) SetAfvoer(t *time.Time) { k.Afvoer = t }
func (k KA_TV) String() string          { return RepresentatieToString(k) }

// KennisartikelTaalvariant_KennisartikeltaalvariantTitel
func (kk KennisartikelTaalvariant_KennisartikeltaalvariantTitel) GetID() any { return kk.Rel_ID }
func (kk KennisartikelTaalvariant_KennisartikeltaalvariantTitel) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (kk *KennisartikelTaalvariant_KennisartikeltaalvariantTitel) ClearID() { kk.Rel_ID = 0 }
func (kk KennisartikelTaalvariant_KennisartikeltaalvariantTitel) GetOpvoer() *time.Time {
	return kk.Opvoer
}
func (kk *KennisartikelTaalvariant_KennisartikeltaalvariantTitel) SetOpvoer(t *time.Time) {
	kk.Opvoer = t
}
func (kk KennisartikelTaalvariant_KennisartikeltaalvariantTitel) GetAfvoer() *time.Time {
	return kk.Afvoer
}
func (kk *KennisartikelTaalvariant_KennisartikeltaalvariantTitel) SetAfvoer(t *time.Time) {
	kk.Afvoer = t
}
func (kk KennisartikelTaalvariant_KennisartikeltaalvariantTitel) String() string {
	return RepresentatieToString(kk)
}

// KennisartikelTaalvariant_Sectie
func (ks KennisartikelTaalvariant_Sectie) GetID() any              { return ks.Rel_ID }
func (ks KennisartikelTaalvariant_Sectie) Metatype() Metatype      { return MetatypeGegevenselement }
func (ks *KennisartikelTaalvariant_Sectie) ClearID()               { ks.Rel_ID = 0 }
func (ks KennisartikelTaalvariant_Sectie) GetOpvoer() *time.Time   { return ks.Opvoer }
func (ks *KennisartikelTaalvariant_Sectie) SetOpvoer(t *time.Time) { ks.Opvoer = t }
func (ks KennisartikelTaalvariant_Sectie) GetAfvoer() *time.Time   { return ks.Afvoer }
func (ks *KennisartikelTaalvariant_Sectie) SetAfvoer(t *time.Time) { ks.Afvoer = t }
func (ks KennisartikelTaalvariant_Sectie) String() string          { return RepresentatieToString(ks) }

// KennisartikelTaalvariant_KennisartikelTaalvariantTaal
func (kk KennisartikelTaalvariant_KennisartikelTaalvariantTaal) GetID() any { return kk.Rel_ID }
func (kk KennisartikelTaalvariant_KennisartikelTaalvariantTaal) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (kk *KennisartikelTaalvariant_KennisartikelTaalvariantTaal) ClearID() { kk.Rel_ID = 0 }
func (kk KennisartikelTaalvariant_KennisartikelTaalvariantTaal) GetOpvoer() *time.Time {
	return kk.Opvoer
}
func (kk *KennisartikelTaalvariant_KennisartikelTaalvariantTaal) SetOpvoer(t *time.Time) {
	kk.Opvoer = t
}
func (kk KennisartikelTaalvariant_KennisartikelTaalvariantTaal) GetAfvoer() *time.Time {
	return kk.Afvoer
}
func (kk *KennisartikelTaalvariant_KennisartikelTaalvariantTaal) SetAfvoer(t *time.Time) {
	kk.Afvoer = t
}
func (kk KennisartikelTaalvariant_KennisartikelTaalvariantTaal) String() string {
	return RepresentatieToString(kk)
}

// Trefwoord_TrefwoordTaalvariant
func (tt Trefwoord_TrefwoordTaalvariant) GetID() any              { return tt.Rel_ID }
func (tt Trefwoord_TrefwoordTaalvariant) Metatype() Metatype      { return MetatypeGegevenselement }
func (tt *Trefwoord_TrefwoordTaalvariant) ClearID()               { tt.Rel_ID = 0 }
func (tt Trefwoord_TrefwoordTaalvariant) GetOpvoer() *time.Time   { return tt.Opvoer }
func (tt *Trefwoord_TrefwoordTaalvariant) SetOpvoer(t *time.Time) { tt.Opvoer = t }
func (tt Trefwoord_TrefwoordTaalvariant) GetAfvoer() *time.Time   { return tt.Afvoer }
func (tt *Trefwoord_TrefwoordTaalvariant) SetAfvoer(t *time.Time) { tt.Afvoer = t }
func (tt Trefwoord_TrefwoordTaalvariant) String() string          { return RepresentatieToString(tt) }

/* ================================================================
   3. _DATA — interface-methoden
   ================================================================ */

// KA_Tr_Data
func (d KA_Tr_Data) GetID() any              { return d.Versie }
func (d KA_Tr_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *KA_Tr_Data) ClearID()               { d.Versie = 0 }
func (d KA_Tr_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *KA_Tr_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d KA_Tr_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *KA_Tr_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d KA_Tr_Data) String() string          { return RepresentatieToString(d) }

// KA_TV_Data
func (d KA_TV_Data) GetID() any              { return d.Versie }
func (d KA_TV_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *KA_TV_Data) ClearID()               { d.Versie = 0 }
func (d KA_TV_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *KA_TV_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d KA_TV_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *KA_TV_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d KA_TV_Data) String() string          { return RepresentatieToString(d) }

// KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data
func (d KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data) GetID() any { return d.Versie }
func (d KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data) ClearID() { d.Versie = 0 }
func (d KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data) GetOpvoer() *time.Time {
	return d.Opvoer
}
func (d *KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data) SetOpvoer(t *time.Time) {
	d.Opvoer = t
}
func (d KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data) GetAfvoer() *time.Time {
	return d.Afvoer
}
func (d *KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data) SetAfvoer(t *time.Time) {
	d.Afvoer = t
}
func (d KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data) String() string {
	return RepresentatieToString(d)
}

// KennisartikelTaalvariant_Sectie_Data
func (d KennisartikelTaalvariant_Sectie_Data) GetID() any              { return d.Versie }
func (d KennisartikelTaalvariant_Sectie_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *KennisartikelTaalvariant_Sectie_Data) ClearID()               { d.Versie = 0 }
func (d KennisartikelTaalvariant_Sectie_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *KennisartikelTaalvariant_Sectie_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d KennisartikelTaalvariant_Sectie_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *KennisartikelTaalvariant_Sectie_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d KennisartikelTaalvariant_Sectie_Data) String() string          { return RepresentatieToString(d) }

// KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data
func (d KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data) GetID() any { return d.Versie }
func (d KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (d *KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data) ClearID() { d.Versie = 0 }
func (d KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data) GetOpvoer() *time.Time {
	return d.Opvoer
}
func (d *KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data) SetOpvoer(t *time.Time) {
	d.Opvoer = t
}
func (d KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data) GetAfvoer() *time.Time {
	return d.Afvoer
}
func (d *KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data) SetAfvoer(t *time.Time) {
	d.Afvoer = t
}
func (d KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data) String() string {
	return RepresentatieToString(d)
}

// Trefwoord_TrefwoordTaalvariant_Data
func (d Trefwoord_TrefwoordTaalvariant_Data) GetID() any              { return d.Versie }
func (d Trefwoord_TrefwoordTaalvariant_Data) Metatype() Metatype      { return MetatypeGegevenselement }
func (d *Trefwoord_TrefwoordTaalvariant_Data) ClearID()               { d.Versie = 0 }
func (d Trefwoord_TrefwoordTaalvariant_Data) GetOpvoer() *time.Time   { return d.Opvoer }
func (d *Trefwoord_TrefwoordTaalvariant_Data) SetOpvoer(t *time.Time) { d.Opvoer = t }
func (d Trefwoord_TrefwoordTaalvariant_Data) GetAfvoer() *time.Time   { return d.Afvoer }
func (d *Trefwoord_TrefwoordTaalvariant_Data) SetAfvoer(t *time.Time) { d.Afvoer = t }
func (d Trefwoord_TrefwoordTaalvariant_Data) String() string          { return RepresentatieToString(d) }

/* ================================================================
   4. _AANVANG/_EINDE (entiteits-plumbing) — interface-methoden
   ================================================================ */

// Kennisartikel_Aanvang
func (k Kennisartikel_Aanvang) GetID() any              { return k.Versie }
func (k Kennisartikel_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (k *Kennisartikel_Aanvang) ClearID()               { k.Versie = 0 }
func (k Kennisartikel_Aanvang) GetOpvoer() *time.Time   { return k.Opvoer }
func (k *Kennisartikel_Aanvang) SetOpvoer(t *time.Time) { k.Opvoer = t }
func (k Kennisartikel_Aanvang) GetAfvoer() *time.Time   { return k.Afvoer }
func (k *Kennisartikel_Aanvang) SetAfvoer(t *time.Time) { k.Afvoer = t }
func (k Kennisartikel_Aanvang) String() string          { return RepresentatieToString(k) }

// Kennisartikel_Einde
func (k Kennisartikel_Einde) GetID() any              { return k.Versie }
func (k Kennisartikel_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (k *Kennisartikel_Einde) ClearID()               { k.Versie = 0 }
func (k Kennisartikel_Einde) GetOpvoer() *time.Time   { return k.Opvoer }
func (k *Kennisartikel_Einde) SetOpvoer(t *time.Time) { k.Opvoer = t }
func (k Kennisartikel_Einde) GetAfvoer() *time.Time   { return k.Afvoer }
func (k *Kennisartikel_Einde) SetAfvoer(t *time.Time) { k.Afvoer = t }
func (k Kennisartikel_Einde) String() string          { return RepresentatieToString(k) }

/* ================================================================
   5. _AANVANG/_EINDE (hub-level plumbing) — interface-methoden
   ================================================================ */

// KA_Tr_Aanvang
func (k KA_Tr_Aanvang) GetID() any              { return k.Versie }
func (k KA_Tr_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (k *KA_Tr_Aanvang) ClearID()               { k.Versie = 0 }
func (k KA_Tr_Aanvang) GetOpvoer() *time.Time   { return k.Opvoer }
func (k *KA_Tr_Aanvang) SetOpvoer(t *time.Time) { k.Opvoer = t }
func (k KA_Tr_Aanvang) GetAfvoer() *time.Time   { return k.Afvoer }
func (k *KA_Tr_Aanvang) SetAfvoer(t *time.Time) { k.Afvoer = t }
func (k KA_Tr_Aanvang) String() string          { return RepresentatieToString(k) }

// KA_Tr_Einde
func (k KA_Tr_Einde) GetID() any              { return k.Versie }
func (k KA_Tr_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (k *KA_Tr_Einde) ClearID()               { k.Versie = 0 }
func (k KA_Tr_Einde) GetOpvoer() *time.Time   { return k.Opvoer }
func (k *KA_Tr_Einde) SetOpvoer(t *time.Time) { k.Opvoer = t }
func (k KA_Tr_Einde) GetAfvoer() *time.Time   { return k.Afvoer }
func (k *KA_Tr_Einde) SetAfvoer(t *time.Time) { k.Afvoer = t }
func (k KA_Tr_Einde) String() string          { return RepresentatieToString(k) }

/* ================================================================
   6. _INPUT — interface-methoden (no-op opvoer/afvoer)
   ================================================================ */

// KA_Tr_Input
func (i KA_Tr_Input) GetID() any              { return i.Rel_ID }
func (i KA_Tr_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *KA_Tr_Input) ClearID()               { i.Rel_ID = 0 }
func (i KA_Tr_Input) GetOpvoer() *time.Time   { return nil }
func (i *KA_Tr_Input) SetOpvoer(t *time.Time) {}
func (i KA_Tr_Input) GetAfvoer() *time.Time   { return nil }
func (i *KA_Tr_Input) SetAfvoer(t *time.Time) {}
func (i KA_Tr_Input) String() string          { return RepresentatieToString(i) }

// KA_TV_Input
func (i KA_TV_Input) GetID() any              { return i.Rel_ID }
func (i KA_TV_Input) Metatype() Metatype      { return MetatypeRelatie }
func (i *KA_TV_Input) ClearID()               { i.Rel_ID = 0 }
func (i KA_TV_Input) GetOpvoer() *time.Time   { return nil }
func (i *KA_TV_Input) SetOpvoer(t *time.Time) {}
func (i KA_TV_Input) GetAfvoer() *time.Time   { return nil }
func (i *KA_TV_Input) SetAfvoer(t *time.Time) {}
func (i KA_TV_Input) String() string          { return RepresentatieToString(i) }

// KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input
func (i KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input) GetID() any { return i.Rel_ID }
func (i KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input) ClearID() { i.Rel_ID = 0 }
func (i KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input) GetOpvoer() *time.Time {
	return nil
}
func (i *KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input) SetOpvoer(t *time.Time) {}
func (i KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input) GetAfvoer() *time.Time {
	return nil
}
func (i *KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input) SetAfvoer(t *time.Time) {}
func (i KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Input) String() string {
	return RepresentatieToString(i)
}

// KennisartikelTaalvariant_Sectie_Input
func (i KennisartikelTaalvariant_Sectie_Input) GetID() any              { return i.Rel_ID }
func (i KennisartikelTaalvariant_Sectie_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *KennisartikelTaalvariant_Sectie_Input) ClearID()               { i.Rel_ID = 0 }
func (i KennisartikelTaalvariant_Sectie_Input) GetOpvoer() *time.Time   { return nil }
func (i *KennisartikelTaalvariant_Sectie_Input) SetOpvoer(t *time.Time) {}
func (i KennisartikelTaalvariant_Sectie_Input) GetAfvoer() *time.Time   { return nil }
func (i *KennisartikelTaalvariant_Sectie_Input) SetAfvoer(t *time.Time) {}
func (i KennisartikelTaalvariant_Sectie_Input) String() string          { return RepresentatieToString(i) }

// KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input
func (i KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input) GetID() any { return i.Rel_ID }
func (i KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input) Metatype() Metatype {
	return MetatypeGegevenselement
}
func (i *KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input) ClearID() { i.Rel_ID = 0 }
func (i KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input) GetOpvoer() *time.Time {
	return nil
}
func (i *KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input) SetOpvoer(t *time.Time) {}
func (i KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input) GetAfvoer() *time.Time {
	return nil
}
func (i *KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input) SetAfvoer(t *time.Time) {}
func (i KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Input) String() string {
	return RepresentatieToString(i)
}

// Trefwoord_TrefwoordTaalvariant_Input
func (i Trefwoord_TrefwoordTaalvariant_Input) GetID() any              { return i.Rel_ID }
func (i Trefwoord_TrefwoordTaalvariant_Input) Metatype() Metatype      { return MetatypeGegevenselement }
func (i *Trefwoord_TrefwoordTaalvariant_Input) ClearID()               { i.Rel_ID = 0 }
func (i Trefwoord_TrefwoordTaalvariant_Input) GetOpvoer() *time.Time   { return nil }
func (i *Trefwoord_TrefwoordTaalvariant_Input) SetOpvoer(t *time.Time) {}
func (i Trefwoord_TrefwoordTaalvariant_Input) GetAfvoer() *time.Time   { return nil }
func (i *Trefwoord_TrefwoordTaalvariant_Input) SetAfvoer(t *time.Time) {}
func (i Trefwoord_TrefwoordTaalvariant_Input) String() string          { return RepresentatieToString(i) }

/* ================================================================
   7. GeefOnderliggendeGegevenselementen — ENTITEITEN
   ================================================================ */

func (k *Kennisartikel) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range k.Kennisartikeltrefwoorden {
		if k.Kennisartikeltrefwoorden[idx].Kennisartikel_ID == 0 {
			k.Kennisartikeltrefwoorden[idx].Kennisartikel_ID = k.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KA_Tr", Representatie: &k.Kennisartikeltrefwoorden[idx]})
	}
	for idx := range k.KennisartikelTaalvarianten {
		if k.KennisartikelTaalvarianten[idx].Kennisartikel_ID == 0 {
			k.KennisartikelTaalvarianten[idx].Kennisartikel_ID = k.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KA_TV", Representatie: &k.KennisartikelTaalvarianten[idx]})
	}
	for idx := range k.Aanvang {
		if k.Aanvang[idx].Kennisartikel_ID == 0 {
			k.Aanvang[idx].Kennisartikel_ID = k.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Kennisartikel_Aanvang", Representatie: &k.Aanvang[idx]})
	}
	for idx := range k.Einde {
		if k.Einde[idx].Kennisartikel_ID == 0 {
			k.Einde[idx].Kennisartikel_ID = k.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Kennisartikel_Einde", Representatie: &k.Einde[idx]})
	}
	return result
}

func (k *KennisartikelTaalvariant) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range k.Tvtitels {
		if k.Tvtitels[idx].KennisartikelTaalvariant_ID == 0 {
			k.Tvtitels[idx].KennisartikelTaalvariant_ID = k.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KennisartikelTaalvariant_KennisartikeltaalvariantTitel", Representatie: &k.Tvtitels[idx]})
	}
	for idx := range k.Kennissecties {
		if k.Kennissecties[idx].KennisartikelTaalvariant_ID == 0 {
			k.Kennissecties[idx].KennisartikelTaalvariant_ID = k.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KennisartikelTaalvariant_Sectie", Representatie: &k.Kennissecties[idx]})
	}
	for idx := range k.Tvtalen {
		if k.Tvtalen[idx].KennisartikelTaalvariant_ID == 0 {
			k.Tvtalen[idx].KennisartikelTaalvariant_ID = k.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KennisartikelTaalvariant_KennisartikelTaalvariantTaal", Representatie: &k.Tvtalen[idx]})
	}
	return result
}

func (t *Trefwoord) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)
	for idx := range t.Trefwoordtaalvarianten {
		if t.Trefwoordtaalvarianten[idx].Trefwoord_ID == 0 {
			t.Trefwoordtaalvarianten[idx].Trefwoord_ID = t.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Trefwoord_TrefwoordTaalvariant", Representatie: &t.Trefwoordtaalvarianten[idx]})
	}
	return result
}

/* ================================================================
   8. GeefOnderliggendeGegevenselementen — HUBS
   ================================================================ */

func (h *KA_Tr) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data)+len(h.Aanvang)+len(h.Einde))
	for i := range h.Data {
		if h.Data[i].Kennisartikel_ID == 0 {
			h.Data[i].Kennisartikel_ID = h.Kennisartikel_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KA_Tr_Data", Representatie: &h.Data[i]})
	}
	for i := range h.Aanvang {
		if h.Aanvang[i].Kennisartikel_ID == 0 {
			h.Aanvang[i].Kennisartikel_ID = h.Kennisartikel_ID
		}
		if h.Aanvang[i].Rel_ID == 0 {
			h.Aanvang[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KA_Tr_Aanvang", Representatie: &h.Aanvang[i]})
	}
	for i := range h.Einde {
		if h.Einde[i].Kennisartikel_ID == 0 {
			h.Einde[i].Kennisartikel_ID = h.Kennisartikel_ID
		}
		if h.Einde[i].Rel_ID == 0 {
			h.Einde[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KA_Tr_Einde", Representatie: &h.Einde[i]})
	}
	return result
}

func (h *KA_TV) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Kennisartikel_ID == 0 {
			h.Data[i].Kennisartikel_ID = h.Kennisartikel_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KA_TV_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *KennisartikelTaalvariant_KennisartikeltaalvariantTitel) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].KennisartikelTaalvariant_ID == 0 {
			h.Data[i].KennisartikelTaalvariant_ID = h.KennisartikelTaalvariant_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KennisartikelTaalvariant_KennisartikeltaalvariantTitel_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *KennisartikelTaalvariant_Sectie) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].KennisartikelTaalvariant_ID == 0 {
			h.Data[i].KennisartikelTaalvariant_ID = h.KennisartikelTaalvariant_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KennisartikelTaalvariant_Sectie_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *KennisartikelTaalvariant_KennisartikelTaalvariantTaal) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].KennisartikelTaalvariant_ID == 0 {
			h.Data[i].KennisartikelTaalvariant_ID = h.KennisartikelTaalvariant_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "KennisartikelTaalvariant_KennisartikelTaalvariantTaal_Data", Representatie: &h.Data[i]})
	}
	return result
}

func (h *Trefwoord_TrefwoordTaalvariant) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0, len(h.Data))
	for i := range h.Data {
		if h.Data[i].Trefwoord_ID == 0 {
			h.Data[i].Trefwoord_ID = h.Trefwoord_ID
		}
		if h.Data[i].Rel_ID == 0 {
			h.Data[i].Rel_ID = h.Rel_ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Trefwoord_TrefwoordTaalvariant_Data", Representatie: &h.Data[i]})
	}
	return result
}
