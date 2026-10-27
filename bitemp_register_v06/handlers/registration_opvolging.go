// Package handlers — registration_opvolging.go
//
// Opvolging van een materieel én enkelvoudig element (GE- of relatiehub), besluit Mark
// 25-10-2026 en 27-10-2026 (plan docs/plans/2026-10-25 Materieel enkelvoudig — historie van
// voorkomens): enkelvoudig betekent "één geldig voorkomen op elk materieel moment", niet "één
// formeel actieve hub". Een nieuw voorkomen mét aanvang sluit de voorganger daarom materieel af
// (automatisch einde) en laat hem formeel actief: de statushistorie blijft terug te kijken, ook
// zonder formeel tijdreizen.
//
// Regels (alleen bij registratietype registratie, nooit bij correctie):
//   - zonder aanvang op het nieuwe voorkomen is er geen materiële opvolging mogelijk: dan
//     vervangt het nieuwe voorkomen het oude formeel, zoals vóór 27-10-2026 (en zoals een
//     niet-materieel enkelvoudig element altijd doet);
//   - met aanvang: elke formeel actieve voorganger zonder einde krijgt automatisch
//     einde = aanvang − 1 dag (datums, inclusief) of einde = aanvang (tijdstippen, exclusief),
//     als eigen _Einde-record met een eigen wijziging in dezelfde registratie — een
//     ongedaanmaking van de registratie verwijdert dus het nieuwe voorkomen én dat einde;
//   - een aanvang op of vóór de aanvang van een voorganger is terugwerkende kracht over een
//     bestaand voorkomen heen: 422, met het advies een correctie of ongedaanmaking te gebruiken;
//   - een aanvang binnen de periode van een al afgesloten voorganger is invoegen: 422
//     (eerst alleen achteraan toevoegen; invoegen volgt als het nodig blijkt);
//   - een expliciet einde op de voorganger in dezelfde registratie mag; het wint van het
//     automatische einde.
//
// Uitvoering: uitgesteld tot ná alle wijzigingen van de registratie. De normalizer splitst de
// _Aanvang/_Einde-kinderen van een hub af als eigen wijzigingen (ná de hub), dus bij de opvoer
// van de hub is zijn aanvang nog niet bekend. handleRepresentatieOpvoer verzamelt daarom de
// nieuwe materieel enkelvoudige hubs (opvolgingVerzamelaar in de context); RegistreerCore
// handelt ze na de wijzigingen-lus af, met de aanvang uit de database. Meerdere nieuwe
// voorkomens van hetzelfde element in één registratie (historie in bulk) volgen elkaar in
// volgorde van opvoer op.
//
// Niet-materiële enkelvoudige elementen en de _Data/_Aanvang/_Einde onder één hub houden het
// bestaande gedrag (formeel afsluiten van de voorganger, sluitActieveEnkelvoudigeVoorgangersAf).
package handlers

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"sort"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
)

// opvolgingsFout is een inhoudelijke weigering van een opvolging: 422 problem+json met veldpad.
type opvolgingsFout struct {
	Code  string // opvolging_terugwerkend | opvolging_invoegen
	Reden string
}

func (f *opvolgingsFout) Error() string { return f.Reden }

// alsRegistreerError vertaalt de weigering naar een 422 in dezelfde vorm als de validatie- en
// decodefouten (registration_decodefout.go).
func (f *opvolgingsFout) alsRegistreerError(wijzigingIdx int, veldnaam string, instance string) *RegistreerError {
	naam := fmt.Sprintf("wijzigingen[%d].%s.aanvang", wijzigingIdx, veldnaam)
	return &RegistreerError{
		Status: http.StatusUnprocessableEntity,
		Msg:    f.Reden,
		Problem: &model.ProblemDetails{
			Type:          "https://api.bitemporeel/problemen/opvolging",
			Title:         "Opvolging geweigerd",
			Status:        http.StatusUnprocessableEntity,
			Detail:        f.Reden,
			Instance:      instance,
			Code:          f.Code,
			InvalidParams: []model.InvalidParam{{Name: naam, Code: f.Code, Reason: f.Reden}},
		},
	}
}

// opvolgingItem is een in deze registratie opgevoerde materieel enkelvoudige hub.
type opvolgingItem struct {
	meta         model.TypeMeta
	entiteitID   int
	relID        int
	wijzigingIdx int // index van de wijziging in de request (voor het veldpad in de 422)
}

// opvolgingVerzamelaar verzamelt de nieuwe hubs tijdens de wijzigingen-lus van RegistreerCore.
type opvolgingVerzamelaar struct {
	items      []opvolgingItem
	huidigeIdx int
}

type opvolgingSleutel struct{}

// metOpvolgingVerzamelaar hangt een verzamelaar aan de context van één registratie.
func metOpvolgingVerzamelaar(ctx context.Context) (context.Context, *opvolgingVerzamelaar) {
	v := &opvolgingVerzamelaar{}
	return context.WithValue(ctx, opvolgingSleutel{}, v), v
}

func opvolgingVerzamelaarUit(ctx context.Context) *opvolgingVerzamelaar {
	v, _ := ctx.Value(opvolgingSleutel{}).(*opvolgingVerzamelaar)
	return v
}

// uitgesteldeOpvolging zegt of de opvolging van deze hub wordt uitgesteld (en dus niet nu
// formeel moet worden afgesloten).
func uitgesteldeOpvolging(ctx context.Context, registratie model.Registratie, meta model.TypeMeta) bool {
	return meta.IsMaterieelEnkelvoudigeHub() && registratie.IsRegistratie() && opvolgingVerzamelaarUit(ctx) != nil
}

// noteerNieuweHub registreert een zojuist ingevoegde hub voor de uitgestelde opvolging.
func noteerNieuweHub(ctx context.Context, meta model.TypeMeta, entiteitID int, relID int) {
	if v := opvolgingVerzamelaarUit(ctx); v != nil {
		v.items = append(v.items, opvolgingItem{meta: meta, entiteitID: entiteitID, relID: relID, wijzigingIdx: v.huidigeIdx})
	}
}

// verwerkVerzameldeOpvolgingen handelt na de wijzigingen-lus alle nieuwe materieel enkelvoudige
// hubs af, in volgorde van opvoer. Latere nieuwe hubs van hetzelfde element tellen niet als
// voorganger van een eerdere.
func verwerkVerzameldeOpvolgingen(ctx context.Context, tx bun.Tx, registratie model.Registratie, v *opvolgingVerzamelaar, instance string) *RegistreerError {
	if v == nil {
		return nil
	}
	for i, item := range v.items {
		latere := map[int]bool{}
		for _, ander := range v.items[i+1:] {
			if ander.meta.Typenaam == item.meta.Typenaam && ander.entiteitID == item.entiteitID {
				latere[ander.relID] = true
			}
		}
		if err := verwerkMaterieleOpvolging(ctx, tx, registratie, item, latere); err != nil {
			if of, ok := err.(*opvolgingsFout); ok {
				return of.alsRegistreerError(item.wijzigingIdx, item.meta.Veldnaam, instance)
			}
			return newRegistreerErr(http.StatusInternalServerError, "wijziging[%d]: opvolging van %s (veldnaam=%s) mislukt: %v",
				item.wijzigingIdx, item.meta.Typenaam, item.meta.Veldnaam, err)
		}
	}
	return nil
}

// voorgangerPeriode is de materiële periode van een formeel actieve voorganger-hub.
type voorgangerPeriode struct {
	relID   int
	aanvang *model.TijdWaarde
	einde   *model.TijdWaarde
}

// verwerkMaterieleOpvolging handelt de voorgangers van één nieuw voorkomen af.
func verwerkMaterieleOpvolging(ctx context.Context, tx bun.Tx, registratie model.Registratie, item opvolgingItem, latereNieuwe map[int]bool) error {
	meta := item.meta
	fkColumn := meta.EntiteitIDKolom
	if fkColumn == "" {
		return fmt.Errorf("HANDLER: geen entiteit FK-kolom geconfigureerd voor type %s", meta.Typenaam)
	}

	// Formeel actieve voorgangers (FOR UPDATE: serialiseert opvolgingen op dezelfde entiteit),
	// zonder het nieuwe voorkomen zelf en zonder latere nieuwe voorkomens uit deze registratie.
	actieve, err := haalActieveIDsMetScope(ctx, tx, meta, map[string]any{fkColumn: item.entiteitID})
	if err != nil {
		return err
	}
	voorgangers := make([]int, 0, len(actieve))
	for _, id := range actieve {
		if int(id) != item.relID && !latereNieuwe[int(id)] {
			voorgangers = append(voorgangers, int(id))
		}
	}
	if len(voorgangers) == 0 {
		return nil
	}
	sort.Ints(voorgangers)

	parentTypenaam := meta.BovenliggendTypenaam
	if bovenliggend, found := model.MetaRegistry.GetBovenliggendeEntiteitMeta(meta.Typenaam); found {
		parentTypenaam = bovenliggend.Typenaam
	}

	_, eindeRel, aanvangMeta, eindeMeta, ok := meta.AanvangEindeKinderen()
	if !ok || eindeRel.Doeltype == "" {
		// Geen _Aanvang/_Einde-kinderen: geen materiële tijdlijn; formeel vervangen.
		for _, relID := range voorgangers {
			if err := voerVoorgangerHubAf(ctx, tx, registratie, meta, parentTypenaam, item.entiteitID, relID); err != nil {
				return err
			}
		}
		return nil
	}

	// Perioden van de voorgangers ophalen.
	perioden := make([]voorgangerPeriode, 0, len(voorgangers))
	for _, relID := range voorgangers {
		scope := map[string]any{fkColumn: item.entiteitID, "rel_id": relID}
		p := voorgangerPeriode{relID: relID}
		if p.aanvang, err = actieveTijdWaardeUitDB(ctx, tx, aanvangMeta, scope); err != nil {
			return err
		}
		if p.einde, err = actieveTijdWaardeUitDB(ctx, tx, eindeMeta, scope); err != nil {
			return err
		}
		perioden = append(perioden, p)
	}

	nieuweAanvang, err := actieveTijdWaardeUitDB(ctx, tx, aanvangMeta, map[string]any{fkColumn: item.entiteitID, "rel_id": item.relID})
	if err != nil {
		return err
	}
	if nieuweAanvang == nil {
		// Geen aanvang: geen materiële opvolging mogelijk. Het nieuwe voorkomen vervangt dan
		// formeel het voorkomen dat nu geldt (zonder einde), zoals vóór 27-10-2026; al
		// afgesloten voorkomens zijn historie en blijven formeel actief.
		for _, p := range perioden {
			if p.einde != nil {
				continue
			}
			if err := voerVoorgangerHubAf(ctx, tx, registratie, meta, parentTypenaam, item.entiteitID, p.relID); err != nil {
				return err
			}
		}
		return nil
	}

	// Controleren: alleen achteraan toevoegen.
	for _, p := range perioden {
		if p.aanvang != nil && !na(*nieuweAanvang, *p.aanvang) {
			return &opvolgingsFout{
				Code: "opvolging_terugwerkend",
				Reden: fmt.Sprintf("aanvang %s ligt op of vóór de aanvang %s van het bestaande voorkomen (rel_id %d) van %s; "+
					"een voorkomen met terugwerkende kracht over een bestaand voorkomen heen registreer je als correctie of na een ongedaanmaking",
					nieuweAanvang, p.aanvang, p.relID, meta.Klassenaam),
			}
		}
		if p.einde != nil && !voorbij(*nieuweAanvang, *p.einde) {
			return &opvolgingsFout{
				Code: "opvolging_invoegen",
				Reden: fmt.Sprintf("aanvang %s valt binnen de periode van het bestaande voorkomen (rel_id %d, einde %s) van %s; "+
					"een voorkomen tussen bestaande voorkomens invoegen wordt niet ondersteund — een nieuw voorkomen komt achteraan",
					nieuweAanvang, p.relID, p.einde, meta.Klassenaam),
			}
		}
	}

	// Open voorgangers automatisch afsluiten.
	for _, p := range perioden {
		if p.einde != nil {
			continue
		}
		einde := model.VolgendEindeVoor(*nieuweAanvang)
		if err := voegAutomatischEindeToe(ctx, tx, registratie, eindeMeta, fkColumn, item.entiteitID, p.relID, einde, parentTypenaam); err != nil {
			return err
		}
	}
	return nil
}

// voerVoorgangerHubAf sluit een voorganger-hub formeel af (hub + actieve kinderen), met
// wijzigingen — hetzelfde als sluitActieveEnkelvoudigeVoorgangersAf voor één hub.
func voerVoorgangerHubAf(ctx context.Context, tx bun.Tx, registratie model.Registratie, meta model.TypeMeta,
	parentTypenaam string, entiteitID int, relID int) error {
	if err := updateAfvoerByID(ctx, tx, meta, relID, entiteitID, registratie.Tijdstip); err != nil {
		return fmt.Errorf("HANDLER: afvoer van voorganger %s rel_id=%d mislukt: %v", meta.Typenaam, relID, err)
	}
	if err := persisteerWijziging(ctx, tx, model.WijzigingstypeAfvoer, registratie.ID,
		parentTypenaam, fmt.Sprint(entiteitID), meta.Typenaam, fmt.Sprint(relID), nil, registratie.Tijdstip); err != nil {
		return err
	}
	if err := voerActieveHubKinderenAf(ctx, tx, registratie.ID, registratie.Tijdstip,
		parentTypenaam, fmt.Sprint(entiteitID), meta, entiteitID, relID); err != nil {
		return fmt.Errorf("HANDLER: afvoer van onderliggende van voorganger %s rel_id=%d mislukt: %v", meta.Typenaam, relID, err)
	}
	return nil
}

// na: a ligt na b (datums op dagen, tijdstippen op het moment).
func na(a, b model.TijdWaarde) bool { return a.T.After(b.T) }

// voorbij: aanvang a ligt voorbij einde e — bij datums ná de (inclusieve) einddag, bij
// tijdstippen op of na het (exclusieve) einde.
func voorbij(a, e model.TijdWaarde) bool {
	if e.IsDatum {
		return a.T.After(e.T)
	}
	return !a.T.Before(e.T)
}

func tijdWaardeUitDatumVeld(f reflect.Value) *model.TijdWaarde {
	if !f.IsValid() {
		return nil
	}
	for f.Kind() == reflect.Pointer {
		if f.IsNil() {
			return nil
		}
		f = f.Elem()
	}
	switch d := f.Interface().(type) {
	case model.Date:
		if d.Time.IsZero() {
			return nil
		}
		return &model.TijdWaarde{T: d.Time, IsDatum: true}
	case time.Time:
		if d.IsZero() {
			return nil
		}
		return &model.TijdWaarde{T: d}
	}
	return nil
}

// actieveTijdWaardeUitDB haalt het formeel actieve _Aanvang-/_Einde-record binnen de scope en
// geeft zijn datum/tijdstip (nil als er geen is).
func actieveTijdWaardeUitDB(ctx context.Context, tx bun.Tx, meta model.TypeMeta, scope map[string]any) (*model.TijdWaarde, error) {
	if meta.DBSliceFactory == nil {
		return nil, fmt.Errorf("HANDLER: DBSliceFactory ontbreekt voor %s", meta.Typenaam)
	}
	slice := meta.DBSliceFactory()
	q := tx.NewSelect().Model(slice).Where("opvoer IS NOT NULL").Where("afvoer IS NULL")
	for col, val := range scope {
		q = q.Where(fmt.Sprintf("%s = ?", col), val)
	}
	if err := q.Scan(ctx); err != nil {
		return nil, fmt.Errorf("HANDLER: actieve %s ophalen mislukt: %v", meta.Typenaam, err)
	}
	sv := reflect.ValueOf(slice).Elem()
	var beste *model.TijdWaarde
	for i := 0; i < sv.Len(); i++ {
		if w := tijdWaardeUitDatumVeld(sv.Index(i).FieldByName("Datum")); w != nil {
			beste = w // hooguit één actief per scope (enkelvoudig-constraint op de kindtabel)
		}
	}
	return beste, nil
}

// voegAutomatischEindeToe voegt een _Einde-record toe aan een voorganger-hub, met eigen wijziging.
func voegAutomatischEindeToe(ctx context.Context, tx bun.Tx, registratie model.Registratie, eindeMeta model.TypeMeta,
	fkColumn string, entiteitID int, relID int, einde model.TijdWaarde, parentTypenaam string) error {
	if eindeMeta.DBFactory == nil {
		return fmt.Errorf("HANDLER: DBFactory ontbreekt voor %s", eindeMeta.Typenaam)
	}
	recAny := eindeMeta.DBFactory()
	rec, ok := recAny.(model.FormeleRepresentatie)
	if !ok {
		return fmt.Errorf("HANDLER: %s is geen FormeleRepresentatie", eindeMeta.Typenaam)
	}
	if err := zetIntWaardeVoorKolomOpRepresentatie(rec, fkColumn, entiteitID); err != nil {
		return fmt.Errorf("HANDLER: automatisch einde %s: %v", eindeMeta.Typenaam, err)
	}
	if err := zetIntWaardeVoorKolomOpRepresentatie(rec, "rel_id", relID); err != nil {
		return fmt.Errorf("HANDLER: automatisch einde %s: %v", eindeMeta.Typenaam, err)
	}
	if err := zetDatumVeld(rec, einde); err != nil {
		return fmt.Errorf("HANDLER: automatisch einde %s: %v", eindeMeta.Typenaam, err)
	}
	rec.ClearID()
	tijdstip := registratie.Tijdstip
	rec.SetOpvoer(&tijdstip)
	if _, err := tx.NewInsert().Model(rec).Returning("*").Exec(ctx); err != nil {
		return fmt.Errorf("HANDLER: automatisch einde %s invoegen mislukt: %v", eindeMeta.Typenaam, err)
	}
	repID, versie := bepaalRepIDenVersie(rec, eindeMeta, rec.GetID)
	if repID == "" {
		repID = fmt.Sprint(relID)
	}
	return persisteerWijziging(ctx, tx, model.WijzigingstypeOpvoer, registratie.ID,
		parentTypenaam, fmt.Sprint(entiteitID), eindeMeta.Typenaam, repID, versie, tijdstip)
}

// zetDatumVeld zet het Datum-veld van een _Aanvang/_Einde-record (Date of time.Time, al dan niet pointer).
func zetDatumVeld(rec any, w model.TijdWaarde) error {
	v := reflect.ValueOf(rec)
	for v.Kind() == reflect.Pointer {
		if v.IsNil() {
			return fmt.Errorf("lege representatie")
		}
		v = v.Elem()
	}
	f := v.FieldByName("Datum")
	if !f.IsValid() || !f.CanSet() {
		return fmt.Errorf("veld Datum ontbreekt")
	}
	dateType := reflect.TypeOf(model.Date{})
	timeType := reflect.TypeOf(time.Time{})
	t := f.Type()
	isPtr := t.Kind() == reflect.Pointer
	if isPtr {
		t = t.Elem()
	}
	var waarde reflect.Value
	switch t {
	case dateType:
		dag := time.Date(w.T.Year(), w.T.Month(), w.T.Day(), 0, 0, 0, 0, time.UTC)
		waarde = reflect.ValueOf(model.Date{Time: dag})
	case timeType:
		waarde = reflect.ValueOf(w.T)
	default:
		return fmt.Errorf("veld Datum heeft onbekend type %s", f.Type())
	}
	if isPtr {
		p := reflect.New(t)
		p.Elem().Set(waarde)
		f.Set(p)
	} else {
		f.Set(waarde)
	}
	return nil
}
