// Package afleiding rekent afgeleide relaties en afgeleide velden uit op geregistreerde
// gegevens: de brug tussen de expressietaal (pakket celexpr) en de MetaRegistry.
// Ontwerp: docs/plans/2026-10-11 Afgeleide relaties backend — ontwerp.md (§3 en §5).
//
// Een entiteit (een JSON-map zoals /full of GraphQL hem levert) wordt een celexpr.Object:
//   - klassenaam van een GE of relatie (bijv. "Woonlocatie", "Naam") → het eerste actieve
//     voorkomen, plat geslagen (hub- en _Data-velden samen);
//   - rolnaam / JSON-rolnaam (bijv. "woonlocatie") → de lijst van actieve voorkomens;
//   - het laatste deel van de typenaam (Initiatief_Planning → "Planning") → als klassenaam;
//   - anders een eigen veld van de entiteit (bijv. "id").
//
// Een relatie-voorkomen toont eerst zijn eigen velden en kijkt anders door naar zijn
// doelentiteit ("doorkijk"). Die moet dan geladen zijn: de Omgeving houdt bij welke doelen
// ontbreken (missers), laadt ze per type in één batch via een Lader en evalueert opnieuw.
// Evalueren is zuiver, dus herhalen is veilig; het aantal queries is het aantal hops.
//
// Het pakket kent geen database: de Lader (handlers) laadt op het peilmoment van het verzoek.
package afleiding

import (
	"context"
	"fmt"
	"log"
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/celexpr"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// MaxRondes begrenst het herhaald laden en evalueren (diepte- en cyclusbewaking).
const MaxRondes = 8

// Lader laadt op één vast formeel peilmoment, lui: eerst alleen de entiteitrijen, en per
// onderliggend element (GE of relatie) pas als een regel het aanspreekt. Zo kost een doel
// niet een hele /full-lading terwijl de regel er één relatie of één GE van gebruikt.
type Lader interface {
	// LaadEntiteiten levert de kale entiteitrijen (zonder GE's/relaties) als JSON-maps per id.
	// Ontbrekende of op het peilmoment niet bestaande id's komen niet in de uitkomst.
	LaadEntiteiten(ctx context.Context, typenaam string, ids []int) (map[int]map[string]any, error)
	// LaadVoorkomens levert per entiteit-id de actieve voorkomens van één onderliggend
	// element (rol = JSONRolnaam), in /full-vorm (hub met "data", "aanvang", "einde").
	LaadVoorkomens(ctx context.Context, typenaam, rol string, ids []int) (map[int][]any, error)
}

// ── Geparste regels (gedeeld, want de MetaRegistry verandert niet tijdens een verzoek) ──

var regelCache sync.Map // string → *celexpr.Expr of error

// ParseRegel parset een afleidingsregel, met cache.
func ParseRegel(regel string) (*celexpr.Expr, error) {
	if v, ok := regelCache.Load(regel); ok {
		if e, ok := v.(*celexpr.Expr); ok {
			return e, nil
		}
		return nil, v.(error)
	}
	e, err := celexpr.Parse(regel)
	if err != nil {
		err = fmt.Errorf("afleidingsregel %q: %w", regel, err)
		regelCache.Store(regel, err)
		return nil, err
	}
	regelCache.Store(regel, e)
	return e, nil
}

// ── Omgeving: geladen entiteiten en missers van één verzoek ─────────────

type sleutel struct {
	typenaam string
	id       int
}

// kindSleutel wijst één onderliggend element (rol = JSONRolnaam) van één entiteit aan.
type kindSleutel struct {
	typenaam string
	rol      string
	id       int
}

// entry is een geladen entiteit. volledig: de map bevat al zijn GE's en relaties (uit een
// response); anders is hij kaal geladen en worden onderliggende elementen lui bijgeladen.
type entry struct {
	m        map[string]any // nil: geladen maar bestaat niet (op het peilmoment)
	volledig bool
}

// Omgeving bevat de entiteiten die tijdens één verzoek geladen zijn (allemaal op hetzelfde
// peilmoment) en wat er bij de laatste evaluatie ontbrak: entiteiten (doorkijk naar een doel)
// en onderliggende elementen van kaal geladen entiteiten. Niet geschikt voor gelijktijdig
// gebruik.
type Omgeving struct {
	lader       Lader
	geladen     map[sleutel]*entry
	missers     map[sleutel]bool
	kindMissers map[kindSleutel]bool
}

// NieuweOmgeving maakt een omgeving; lader mag nil zijn (dan blijft doorkijk naar niet
// geladen doelen null, zoals bij afgeleide velden zonder database).
func NieuweOmgeving(lader Lader) *Omgeving {
	return &Omgeving{lader: lader, geladen: map[sleutel]*entry{}, missers: map[sleutel]bool{}, kindMissers: map[kindSleutel]bool{}}
}

// VoegToe registreert een volledig geladen entiteit (bijv. uit de response), zodat doorkijk
// ernaar geen query kost. Alleen doen als de map op hetzelfde peilmoment geladen is.
func (o *Omgeving) VoegToe(typenaam string, id int, m map[string]any) {
	o.geladen[sleutel{typenaam, id}] = &entry{m: m, volledig: true}
}

// Entiteit geeft het Object voor een volledige entiteit-map (de wortel van een evaluatie).
func (o *Omgeving) Entiteit(meta model.TypeMeta, m map[string]any) *Entiteit {
	return &Entiteit{omg: o, meta: meta, m: m, volledig: true}
}

func (o *Omgeving) entiteitVan(meta model.TypeMeta, e *entry) *Entiteit {
	return &Entiteit{omg: o, meta: meta, m: e.m, volledig: e.volledig}
}

// entiteitOp levert de geladen entiteit (typenaam, id), of registreert een misser.
func (o *Omgeving) entiteitOp(typenaam string, id int) *Entiteit {
	k := sleutel{typenaam, id}
	e, ok := o.geladen[k]
	if !ok {
		o.missers[k] = true
		return nil
	}
	if e.m == nil {
		return nil
	}
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok {
		return nil
	}
	return o.entiteitVan(meta, e)
}

func (o *Omgeving) heeftMissers() bool { return o.aantalMissers() > 0 }
func (o *Omgeving) aantalMissers() int { return len(o.missers) + len(o.kindMissers) }

// laad haalt de gegeven entiteiten op die nog niet geladen zijn (kaal; per type één batch).
func (o *Omgeving) laad(ctx context.Context, sleutels []sleutel) error {
	if o.lader == nil {
		return nil
	}
	perType := map[string][]int{}
	for _, k := range sleutels {
		if _, ok := o.geladen[k]; !ok {
			perType[k.typenaam] = append(perType[k.typenaam], k.id)
		}
	}
	for _, typenaam := range gesorteerd(perType) {
		ids := uniek(perType[typenaam])
		maps, err := o.lader.LaadEntiteiten(ctx, typenaam, ids)
		if err != nil {
			return fmt.Errorf("laden %s: %w", typenaam, err)
		}
		for _, id := range ids {
			o.geladen[sleutel{typenaam, id}] = &entry{m: maps[id]} // m nil als hij niet bestaat
		}
	}
	return nil
}

// laadKinderen haalt onderliggende elementen van kaal geladen entiteiten op (per type en rol
// één batch) en zet ze in de entiteit-map, ook als ze leeg zijn.
func (o *Omgeving) laadKinderen(ctx context.Context, sleutels []kindSleutel) error {
	if o.lader == nil {
		return nil
	}
	type typeRol struct{ typenaam, rol string }
	perTypeRol := map[typeRol][]int{}
	for _, k := range sleutels {
		tr := typeRol{k.typenaam, k.rol}
		perTypeRol[tr] = append(perTypeRol[tr], k.id)
	}
	volgorde := make([]typeRol, 0, len(perTypeRol))
	for tr := range perTypeRol {
		volgorde = append(volgorde, tr)
	}
	sort.Slice(volgorde, func(i, j int) bool {
		if volgorde[i].typenaam != volgorde[j].typenaam {
			return volgorde[i].typenaam < volgorde[j].typenaam
		}
		return volgorde[i].rol < volgorde[j].rol
	})
	for _, tr := range volgorde {
		ids := uniek(perTypeRol[tr])
		perID, err := o.lader.LaadVoorkomens(ctx, tr.typenaam, tr.rol, ids)
		if err != nil {
			return fmt.Errorf("laden %s.%s: %w", tr.typenaam, tr.rol, err)
		}
		for _, id := range ids {
			e := o.geladen[sleutel{tr.typenaam, id}]
			if e == nil || e.m == nil {
				continue
			}
			items := perID[id]
			if items == nil {
				items = []any{}
			}
			e.m[tr.rol] = items
		}
	}
	return nil
}

func (o *Omgeving) laadMissers(ctx context.Context) (bool, error) {
	if !o.heeftMissers() {
		return false, nil
	}
	sleutels := make([]sleutel, 0, len(o.missers))
	for k := range o.missers {
		sleutels = append(sleutels, k)
	}
	kinderen := make([]kindSleutel, 0, len(o.kindMissers))
	for k := range o.kindMissers {
		kinderen = append(kinderen, k)
	}
	o.missers = map[sleutel]bool{}
	o.kindMissers = map[kindSleutel]bool{}
	if err := o.laad(ctx, sleutels); err != nil {
		return true, err
	}
	return true, o.laadKinderen(ctx, kinderen)
}

// totStabiel voert stap uit, laadt wat er ontbrak en herhaalt tot er niets meer ontbreekt
// (maximaal MaxRondes). Evalueren is zuiver, dus herhalen is veilig. stap krijgt laatste=true
// in de ronde waarna niets meer geladen wordt; pas dan mogen fouten gemeld worden.
func (o *Omgeving) totStabiel(ctx context.Context, wat string, stap func(laatste bool)) error {
	for ronde := 1; ; ronde++ {
		stap(false)
		if !o.heeftMissers() {
			// Niets ontbrak: deze uitkomst is definitief. Nog één keer met laatste=true
			// zou dubbel werk zijn; de aanroeper meldt fouten daarom ook als er geen missers zijn.
			return nil
		}
		if _, err := o.laadMissers(ctx); err != nil {
			return err
		}
		if ronde >= MaxRondes {
			log.Printf("AFLEIDING: %s: na %d rondes nog niet alles geladen (diepte of cyclus?); uitkomst kan onvolledig zijn", wat, MaxRondes)
			stap(true)
			o.missers, o.kindMissers = map[sleutel]bool{}, map[kindSleutel]bool{}
			return nil
		}
	}
}

func gesorteerd[V any](m map[string]V) []string {
	uit := make([]string, 0, len(m))
	for k := range m {
		uit = append(uit, k)
	}
	sort.Strings(uit)
	return uit
}

func uniek(ids []int) []int {
	sort.Ints(ids)
	uit := ids[:0]
	for i, id := range ids {
		if i == 0 || id != ids[i-1] {
			uit = append(uit, id)
		}
	}
	return uit
}

// ── Objects ─────────────────────────────────────────────────────────────

// Entiteit is een entiteit als celexpr.Object (zie de pakketdocumentatie voor de namen).
type Entiteit struct {
	omg      *Omgeving
	meta     model.TypeMeta
	m        map[string]any
	volledig bool // false: kaal geladen, onderliggende elementen worden lui bijgeladen
}

// Typenaam en ID identificeren de entiteit (ID 0 als hij onbekend is).
func (e *Entiteit) Typenaam() string { return e.meta.Typenaam }
func (e *Entiteit) ID() int {
	id, _ := alsID(leesKolom(e.m, e.meta.IDKolom))
	return id
}

// Veld implementeert celexpr.Object.
func (e *Entiteit) Veld(naam string) (any, bool) {
	if v, ok := e.kind(naam, true); ok {
		return v, true
	}
	if v, ok := e.kind(naam, false); ok {
		return v, true
	}
	return celexpr.LeesVeld(e.m, naam)
}

// kind zoekt een onderliggend element op naam (exact of hoofdletterongevoelig).
// Klassenaam en typenaam-staart leveren het eerste actieve voorkomen, rolnamen de lijst.
func (e *Entiteit) kind(naam string, exact bool) (any, bool) {
	is := func(a string) bool {
		if a == "" {
			return false
		}
		if exact {
			return a == naam
		}
		return strings.EqualFold(a, naam)
	}
	for _, child := range e.meta.OnderliggendeGegevenselementen {
		childMeta, _ := model.MetaRegistry.GetTypeMeta(child.Doeltype)
		staart := ""
		if i := strings.LastIndex(child.Doeltype, "_"); i >= 0 {
			staart = child.Doeltype[i+1:]
		}
		alsVoorkomen := is(childMeta.Klassenaam) || is(staart)
		alsLijst := is(child.JSONRolnaam) || is(child.Rolnaam)
		if !alsVoorkomen && !alsLijst {
			continue
		}
		voorkomens := e.voorkomens(child, childMeta)
		if alsVoorkomen {
			if len(voorkomens) == 0 {
				return nil, true
			}
			return voorkomens[0], true
		}
		return voorkomens, true
	}
	return nil, false
}

// voorkomens geeft de actieve voorkomens van een onderliggend element (zonder afvoer; als
// er geen zijn: alle), plat geslagen. Werkt op /full-maps (lijst, hub met "data") én op
// GraphQL-maps (enkelvoudig als één object, data al plat).
func (e *Entiteit) voorkomens(child model.OnderliggendGegevenselement, childMeta model.TypeMeta) []any {
	var items []any
	raw, aanwezig := e.m[child.JSONRolnaam]
	if !aanwezig && !e.volledig && e.omg.lader != nil {
		// Kaal geladen: dit element is nog niet opgehaald. Misser; na het laden opnieuw.
		if id := e.ID(); id > 0 {
			e.omg.kindMissers[kindSleutel{e.meta.Typenaam, child.JSONRolnaam, id}] = true
		}
		return nil
	}
	switch raw := raw.(type) {
	case []any:
		items = raw
	case map[string]any:
		items = []any{raw}
	}
	var actief []any
	for _, it := range items {
		if m, ok := it.(map[string]any); ok && m["afvoer"] == nil {
			actief = append(actief, it)
		}
	}
	if len(actief) == 0 {
		actief = items
	}
	uit := make([]any, 0, len(actief))
	for _, it := range actief {
		m, ok := it.(map[string]any)
		if !ok {
			continue
		}
		uit = append(uit, &Voorkomen{omg: e.omg, meta: childMeta, m: slaPlat(m)})
	}
	return uit
}

// slaPlat voegt de velden van het eerste actieve _Data-voorkomen toe aan een hub-voorkomen
// (hub-velden gaan voor). Een map zonder "data" blijft zoals hij is.
func slaPlat(hub map[string]any) map[string]any {
	data, ok := hub["data"].([]any)
	if !ok || len(data) == 0 {
		return hub
	}
	var gekozen map[string]any
	for _, d := range data {
		if dm, ok := d.(map[string]any); ok {
			if gekozen == nil || (dm["afvoer"] == nil && gekozen["afvoer"] != nil) {
				gekozen = dm
			}
		}
	}
	plat := make(map[string]any, len(hub)+len(gekozen))
	for k, v := range hub {
		plat[k] = v
	}
	for k, v := range gekozen {
		if _, bestaat := plat[k]; !bestaat {
			plat[k] = v
		}
	}
	return plat
}

// Voorkomen is een GE- of relatie-voorkomen als celexpr.Object. Een relatie-voorkomen kijkt
// voor onbekende namen door naar zijn doelentiteit.
type Voorkomen struct {
	omg  *Omgeving
	meta model.TypeMeta
	m    map[string]any
}

// Veld implementeert celexpr.Object.
func (v *Voorkomen) Veld(naam string) (any, bool) {
	if w, ok := celexpr.LeesVeld(v.m, naam); ok {
		return w, true
	}
	doel := v.doel()
	if doel == nil {
		return nil, false
	}
	return doel.Veld(naam)
}

// doelSleutel geeft (doeltype, doel-id) van een relatie-voorkomen; ok=false voor een GE.
func (v *Voorkomen) doelSleutel() (sleutel, bool) {
	if v.meta.SecondaireEntiteitIDKolom == "" {
		return sleutel{}, false
	}
	doelType := DoelTypeVanRelatie(v.meta)
	id, ok := alsID(leesKolom(v.m, v.meta.SecondaireEntiteitIDKolom))
	if doelType == "" || !ok {
		return sleutel{}, false
	}
	return sleutel{doelType, id}, true
}

func (v *Voorkomen) doel() *Entiteit {
	k, ok := v.doelSleutel()
	if !ok {
		return nil
	}
	return v.omg.entiteitOp(k.typenaam, k.id)
}

// wortel is de context van een evaluatie: de bron, plus `self`.
type wortel struct{ bron *Entiteit }

func (w wortel) Veld(naam string) (any, bool) {
	if naam == "self" {
		return w.bron, true
	}
	return w.bron.Veld(naam)
}

// ── Helpers ─────────────────────────────────────────────────────────────

var doelTypeCache sync.Map // SecondaireEntiteitIDKolom → typenaam

// DoelTypeVanRelatie bepaalt de doelentiteit van een relatie uit SecondaireEntiteitIDKolom
// ("locatie_id" → de entiteit met tabel "locatie").
func DoelTypeVanRelatie(meta model.TypeMeta) string {
	kolom := meta.SecondaireEntiteitIDKolom
	if kolom == "" {
		return ""
	}
	if v, ok := doelTypeCache.Load(kolom); ok {
		return v.(string)
	}
	doel := ""
	for _, m := range model.MetaRegistry {
		if m.Metatype == model.MetatypeEntiteit && strings.EqualFold(m.Tabelnaam+"_id", kolom) {
			doel = m.Typenaam
			break
		}
	}
	doelTypeCache.Store(kolom, doel)
	return doel
}

// leesKolom leest een kolomwaarde uit een JSON-map (JSON-namen zijn hier de kolomnamen).
func leesKolom(m map[string]any, kolom string) any {
	v, _ := celexpr.LeesVeld(m, kolom)
	return v
}

// alsID maakt een id van een JSON-getal (float64) of int; alleen gehele positieve waarden.
func alsID(v any) (int, bool) {
	switch x := v.(type) {
	case float64:
		if x > 0 && x == math.Trunc(x) {
			return int(x), true
		}
	case int:
		return x, x > 0
	case int64:
		return int(x), x > 0
	}
	return 0, false
}

// IsTypeOf meldt of typenaam gelijk is aan doel of er (via generalisatie) van erft.
func IsTypeOf(typenaam, doel string) bool {
	for i := 0; typenaam != "" && i < 16; i++ {
		if typenaam == doel {
			return true
		}
		meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
		if !ok {
			return false
		}
		typenaam = meta.ParentTypenaam
	}
	return false
}
