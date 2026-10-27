// Package model — materieel_tijd.go
//
// Materieel tijdreizen (`geldigOp`, besluit Mark 27-10-2026; plan docs/plans/2026-10-25 Materieel
// enkelvoudig — historie van voorkomens): de toestand zoals die op een materieel moment geldt,
// náást het formele peiltijdstip. Een geladen /full-structuur (entiteit met hubs, hubs met
// _Aanvang/_Einde) wordt hier gesnoeid tot de voorkomens die op dat moment gelden.
//
// Twee precisies, één parameter:
//   - een datum (JJJJ-MM-DD): dagprecisie; een einde is inclusief ("tot en met", BRP-lijn);
//   - een tijdstip (RFC 3339): een einde is exclusief (half-open, zoals het afgeleide `afvoer`).
//
// De precisie van de opgeslagen waarde bepaalt de vergelijking: een _Aanvang/_Einde met een
// Date vergelijkt op dagen (einde inclusief), een time.Time op tijdstippen (einde exclusief).
// Per representatie vastleggen welke precisie geldt is een tweede stap (M3-eigenschap).
package model

import (
	"fmt"
	"reflect"
	"strings"
	"time"
)

// GeldigOp is een materieel peilmoment.
type GeldigOp struct {
	Moment time.Time
	// OpDag: het moment is als datum opgegeven (dagprecisie). Als tijdstip: tijdstipprecisie.
	OpDag bool
}

// ParseGeldigOp leest een datum (JJJJ-MM-DD) of een tijdstip (RFC 3339, ook met nanoseconden).
func ParseGeldigOp(s string) (GeldigOp, error) {
	s = strings.TrimSpace(s)
	if t, err := time.Parse(dateLayout, s); err == nil {
		return GeldigOp{Moment: t, OpDag: true}, nil
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return GeldigOp{Moment: t.UTC()}, nil
	}
	return GeldigOp{}, fmt.Errorf("ongeldige geldigOp %q: verwacht een datum (JJJJ-MM-DD) of een tijdstip (RFC 3339)", s)
}

// Dag geeft het begin van de dag van het moment (UTC).
func (g GeldigOp) Dag() time.Time {
	return time.Date(g.Moment.Year(), g.Moment.Month(), g.Moment.Day(), 0, 0, 0, 0, time.UTC)
}

// String geeft de tekstvorm zoals de client hem gaf (datum of tijdstip).
func (g GeldigOp) String() string {
	if g.OpDag {
		return g.Moment.Format(dateLayout)
	}
	return g.Moment.Format(time.RFC3339Nano)
}

// TijdWaarde is een aanvang of einde zoals opgeslagen: een datum (IsDatum) of een tijdstip.
type TijdWaarde struct {
	T       time.Time
	IsDatum bool
}

// Geldig beoordeelt een periode [aanvang, einde] (nil = open aan die kant) op het moment g.
// Datums: aanvang ≤ dag én einde ≥ dag (inclusief). Tijdstippen: aanvang ≤ moment én
// einde > moment (exclusief).
func (g GeldigOp) Geldig(aanvang, einde *TijdWaarde) bool {
	if aanvang != nil {
		if aanvang.IsDatum {
			if aanvang.T.After(g.Dag()) {
				return false
			}
		} else if aanvang.T.After(g.Moment) {
			return false
		}
	}
	if einde != nil {
		if einde.IsDatum {
			if einde.T.Before(g.Dag()) {
				return false
			}
		} else if !einde.T.After(g.Moment) {
			return false
		}
	}
	return true
}

// Tijdprecisie-waarden (V3 `tijdprecisie`).
const (
	TijdprecisieDatum    = "datum"
	TijdprecisieTijdstip = "tijdstip"
)

// IsTijdstipPrecisie: de materiële tijdlijn van dit type heeft tijdstipprecisie.
func (m TypeMeta) IsTijdstipPrecisie() bool { return m.Tijdprecisie == TijdprecisieTijdstip }

// IsMaterieelEnkelvoudigeHub: een GE- of relatiehub die materieel én enkelvoudig is. Daarvoor
// geldt sinds 27-10-2026 "één geldig voorkomen per materieel moment" in plaats van "één
// formeel actieve hub" (zie handlers/registration_opvolging.go).
func (m TypeMeta) IsMaterieelEnkelvoudigeHub() bool {
	return m.Metatype != MetatypeEntiteit && m.GESubtype == GESubtypeHub &&
		m.IsMaterieel && m.Momentvoorkomen == Enkelvoudig
}

// AanvangEindeKinderen geeft de _Aanvang- en _Einde-kinderen van een hub of entiteit (ok=false
// als er geen zijn). Het veld in de struct heet naar de Rolnaam (Aanvang, Einde).
func (m TypeMeta) AanvangEindeKinderen() (aanvang, einde OnderliggendGegevenselement, aanvangMeta, eindeMeta TypeMeta, ok bool) {
	for _, child := range m.OnderliggendeGegevenselementen {
		cm, found := MetaRegistry.GetTypeMeta(child.Doeltype)
		if !found {
			continue
		}
		switch cm.GESubtype {
		case GESubtypeAanvang:
			aanvang, aanvangMeta, ok = child, cm, true
		case GESubtypeEinde:
			einde, eindeMeta = child, cm
		}
	}
	return
}

// SnoeiMaterieelGeldigOp snoeit één geladen entiteit (pointer naar struct) tot wat op g
// materieel geldt: per materiële hub blijven alleen de voorkomens over die op g gelden (hun
// formeel actieve _Aanvang/_Einde beoordeeld op peil, nil = nu). Geeft false als de entiteit
// zelf (via haar eigen _Aanvang/_Einde) op g niet bestaat. Bij een subtype wordt de geladen
// ouder (veld Parent<Ouder>) ook gesnoeid.
func SnoeiMaterieelGeldigOp(entity any, meta TypeMeta, g GeldigOp, peil *time.Time) bool {
	ev := reflect.ValueOf(entity)
	for ev.Kind() == reflect.Pointer {
		if ev.IsNil() {
			return true
		}
		ev = ev.Elem()
	}
	if ev.Kind() != reflect.Struct {
		return true
	}
	return snoeiStruct(ev, meta, g, peil)
}

// FilterSliceMaterieelGeldigOp snoeit een geladen slice (pointer naar slice van structs) in
// place: entiteiten die op g niet bestaan vallen weg, de rest wordt gesnoeid als bij
// SnoeiMaterieelGeldigOp. Geeft het aantal overgebleven entiteiten.
func FilterSliceMaterieelGeldigOp(entities any, meta TypeMeta, g GeldigOp, peil *time.Time) int {
	sv := reflect.ValueOf(entities)
	for sv.Kind() == reflect.Pointer {
		if sv.IsNil() {
			return 0
		}
		sv = sv.Elem()
	}
	if sv.Kind() != reflect.Slice || !sv.CanSet() {
		return 0
	}
	behouden := 0
	for i := 0; i < sv.Len(); i++ {
		ev := sv.Index(i)
		for ev.Kind() == reflect.Pointer && !ev.IsNil() {
			ev = ev.Elem()
		}
		if ev.Kind() != reflect.Struct || snoeiStruct(ev, meta, g, peil) {
			if behouden != i {
				sv.Index(behouden).Set(sv.Index(i))
			}
			behouden++
		}
	}
	sv.SetLen(behouden)
	return behouden
}

func snoeiStruct(ev reflect.Value, meta TypeMeta, g GeldigOp, peil *time.Time) bool {
	geldig := true
	var eigenAanvang, eigenEinde *TijdWaarde
	heeftEigenTijdlijn := false
	for _, rel := range meta.OnderliggendeGegevenselementen {
		childMeta, ok := MetaRegistry.GetTypeMeta(rel.Doeltype)
		if !ok {
			continue
		}
		fld := ev.FieldByName(rel.Rolnaam)
		if !fld.IsValid() || fld.Kind() != reflect.Slice {
			continue
		}
		switch {
		case childMeta.GESubtype == GESubtypeAanvang:
			heeftEigenTijdlijn = true
			eigenAanvang = actieveTijdWaarde(fld, peil)
		case childMeta.GESubtype == GESubtypeEinde:
			heeftEigenTijdlijn = true
			eigenEinde = actieveTijdWaarde(fld, peil)
		case childMeta.GESubtype == GESubtypeHub && childMeta.IsMaterieel && fld.CanSet():
			// Alleen formeel actieve hubs (op peil, anders nu) doen mee: geldigOp beschrijft de
			// toestand zoals die (op het peilmoment) bekend is; afgevoerde of ont-opvoerde hubs niet.
			behouden := 0
			for i := 0; i < fld.Len(); i++ {
				hub := fld.Index(i)
				if formeelActief(hub, peil) && snoeiStruct(hub, childMeta, g, peil) {
					if behouden != i {
						fld.Index(behouden).Set(fld.Index(i))
					}
					behouden++
				}
			}
			fld.SetLen(behouden)
		}
	}
	if heeftEigenTijdlijn && !g.Geldig(eigenAanvang, eigenEinde) {
		geldig = false
	}
	// Subtype: de geladen ouder ook snoeien; bestaat de ouder niet op g, dan het subtype ook niet.
	if meta.ParentTypenaam != "" {
		if ouderMeta, ok := MetaRegistry.GetTypeMeta(meta.ParentTypenaam); ok {
			pf := ev.FieldByName("Parent" + meta.ParentTypenaam)
			if pf.IsValid() && pf.Kind() == reflect.Pointer && !pf.IsNil() {
				if !snoeiStruct(pf.Elem(), ouderMeta, g, peil) {
					geldig = false
				}
			}
		}
	}
	return geldig
}

// actieveTijdWaarde kiest uit een slice _Aanvang/_Einde-records het formeel actieve record
// (afvoer leeg, of ná peil) en geeft zijn datum/tijdstip; nil als er geen (geldige) is.
// Bij meerdere actieve (hoort niet) wint de laatst opgevoerde.
func actieveTijdWaarde(slice reflect.Value, peil *time.Time) *TijdWaarde {
	var beste *TijdWaarde
	var besteOpvoer *time.Time
	for i := 0; i < slice.Len(); i++ {
		rec := slice.Index(i)
		for rec.Kind() == reflect.Pointer && !rec.IsNil() {
			rec = rec.Elem()
		}
		if rec.Kind() != reflect.Struct {
			continue
		}
		if !formeelActief(rec, peil) {
			continue
		}
		w := tijdWaardeUitVeld(rec.FieldByName("Datum"))
		if w == nil {
			continue
		}
		opvoer := tijdstipUitVeld(rec.FieldByName("Opvoer"))
		if beste == nil || (opvoer != nil && (besteOpvoer == nil || opvoer.After(*besteOpvoer))) {
			beste, besteOpvoer = w, opvoer
		}
	}
	return beste
}

// formeelActief: opgevoerd (een ont-opvoerd record na een ongedaanmaking heeft opvoer NULL en
// telt niet) op of vóór peil, en niet afgevoerd op of vóór peil. Zonder peil: nu.
func formeelActief(rec reflect.Value, peil *time.Time) bool {
	opvoer := tijdstipUitVeld(rec.FieldByName("Opvoer"))
	if opvoer == nil {
		return false
	}
	if peil != nil && opvoer.After(*peil) {
		return false
	}
	afvoer := tijdstipUitVeld(rec.FieldByName("Afvoer"))
	if afvoer == nil {
		return true
	}
	return peil != nil && afvoer.After(*peil)
}

func tijdstipUitVeld(f reflect.Value) *time.Time {
	if !f.IsValid() {
		return nil
	}
	for f.Kind() == reflect.Pointer {
		if f.IsNil() {
			return nil
		}
		f = f.Elem()
	}
	if t, ok := f.Interface().(time.Time); ok && !t.IsZero() {
		return &t
	}
	return nil
}

// tijdWaardeUitVeld leest een Datum-veld: Date (dagprecisie) of time.Time (tijdstip).
func tijdWaardeUitVeld(f reflect.Value) *TijdWaarde {
	if !f.IsValid() {
		return nil
	}
	for f.Kind() == reflect.Pointer {
		if f.IsNil() {
			return nil
		}
		f = f.Elem()
	}
	switch v := f.Interface().(type) {
	case Date:
		if v.Time.IsZero() {
			return nil
		}
		return &TijdWaarde{T: v.Time, IsDatum: true}
	case time.Time:
		if v.IsZero() {
			return nil
		}
		return &TijdWaarde{T: v}
	}
	return nil
}

// VolgendEindeVoor geeft het automatische einde van een voorganger bij een opvolger met
// aanvang a: bij een datum de dag ervóór (inclusief einde), bij een tijdstip hetzelfde moment
// (exclusief einde).
func VolgendEindeVoor(a TijdWaarde) TijdWaarde {
	if a.IsDatum {
		return TijdWaarde{T: a.T.AddDate(0, 0, -1), IsDatum: true}
	}
	return a
}

// String toont een TijdWaarde als datum of tijdstip.
func (w TijdWaarde) String() string {
	if w.IsDatum {
		return w.T.Format(dateLayout)
	}
	return w.T.Format(time.RFC3339Nano)
}
