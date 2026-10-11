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
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/celexpr"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// MaxRondes begrenst het herhaald laden en evalueren (diepte- en cyclusbewaking).
const MaxRondes = 8

// Lader laadt entiteiten als JSON-maps, met hun GE's en relaties (zoals /full), op één vast
// peilmoment. Ontbrekende id's komen niet in de uitkomst.
type Lader interface {
	LaadEntiteiten(ctx context.Context, typenaam string, ids []int) (map[int]map[string]any, error)
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

// Omgeving bevat de entiteiten die tijdens één verzoek geladen zijn (allemaal op hetzelfde
// peilmoment) en de doelen die bij de laatste evaluatie ontbraken. Niet geschikt voor
// gelijktijdig gebruik.
type Omgeving struct {
	lader   Lader
	geladen map[sleutel]map[string]any // nil-waarde: geladen maar bestaat niet
	missers map[sleutel]bool
}

// NieuweOmgeving maakt een omgeving; lader mag nil zijn (dan blijft doorkijk naar niet
// geladen doelen null, zoals bij afgeleide velden zonder database).
func NieuweOmgeving(lader Lader) *Omgeving {
	return &Omgeving{lader: lader, geladen: map[sleutel]map[string]any{}, missers: map[sleutel]bool{}}
}

// VoegToe registreert een al geladen entiteit (bijv. uit de response), zodat doorkijk ernaar
// geen query kost. Alleen doen als de map op hetzelfde peilmoment geladen is.
func (o *Omgeving) VoegToe(typenaam string, id int, m map[string]any) {
	o.geladen[sleutel{typenaam, id}] = m
}

// Entiteit geeft het Object voor een entiteit-map (de wortel van een evaluatie).
func (o *Omgeving) Entiteit(meta model.TypeMeta, m map[string]any) *Entiteit {
	return &Entiteit{omg: o, meta: meta, m: m}
}

// entiteitOp levert de geladen entiteit (typenaam, id), of registreert een misser.
func (o *Omgeving) entiteitOp(typenaam string, id int) *Entiteit {
	k := sleutel{typenaam, id}
	m, ok := o.geladen[k]
	if !ok {
		o.missers[k] = true
		return nil
	}
	if m == nil {
		return nil
	}
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok {
		return nil
	}
	return o.Entiteit(meta, m)
}

// laad haalt de gegeven sleutels op die nog niet geladen zijn (per type één batch).
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
	typen := make([]string, 0, len(perType))
	for t := range perType {
		typen = append(typen, t)
	}
	sort.Strings(typen)
	for _, typenaam := range typen {
		ids := perType[typenaam]
		sort.Ints(ids)
		maps, err := o.lader.LaadEntiteiten(ctx, typenaam, ids)
		if err != nil {
			return fmt.Errorf("laden %s: %w", typenaam, err)
		}
		for _, id := range ids {
			o.geladen[sleutel{typenaam, id}] = maps[id] // nil als hij niet bestaat
		}
	}
	return nil
}

func (o *Omgeving) laadMissers(ctx context.Context) (bool, error) {
	if len(o.missers) == 0 {
		return false, nil
	}
	sleutels := make([]sleutel, 0, len(o.missers))
	for k := range o.missers {
		sleutels = append(sleutels, k)
	}
	o.missers = map[sleutel]bool{}
	return true, o.laad(ctx, sleutels)
}

// ── Objects ─────────────────────────────────────────────────────────────

// Entiteit is een entiteit als celexpr.Object (zie de pakketdocumentatie voor de namen).
type Entiteit struct {
	omg  *Omgeving
	meta model.TypeMeta
	m    map[string]any
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
	switch raw := e.m[child.JSONRolnaam].(type) {
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
