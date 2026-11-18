package facade

// apilader.go — dynql.Lader voor typen die in een Common Ground-register staan
// (technisch ontwerp fase 1 §3–§7).
//
// De lader haalt het object uit de register-API, bouwt volgens de binding de JSON-vorm van de
// gegenereerde struct (id via de IDMap, per GE een hub met data, per relatie het id van het doel,
// bij een materieel onderdeel aanvang en einde) en laadt die met json.Unmarshal in
// meta.Factory(). Daarna gaat alles verder zoals in het gewone register: platslaan,
// weergavenamen, afgeleide velden, toegangsbeleid (dynql, stap 2 en 3).
//
// Wat niet kan, weigert de lader met dynql.NietOndersteund: een formeel peiltijdstip op een
// register zonder formele tijd, een filter dat niet in de binding staat.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
)

// ApiLader leest alle typen uit de binding via de register-API's.
type ApiLader struct {
	b       *Binding
	clients map[string]*Client
	ids     IDMap
	iri     *IRITabel
}

// NieuweApiLader valideert de binding en maakt per register een client.
func NieuweApiLader(b *Binding, ids IDMap, clients map[string]*Client) (*ApiLader, error) {
	if err := b.Valideer(); err != nil {
		return nil, err
	}
	tab, err := b.IRITabel()
	if err != nil {
		return nil, err
	}
	if clients == nil {
		clients = map[string]*Client{}
	}
	for naam, cfg := range b.Registers {
		if _, ok := clients[naam]; !ok {
			clients[naam] = NieuweClient(naam, cfg, nil)
		}
	}
	return &ApiLader{b: b, clients: clients, ids: ids, iri: tab}, nil
}

// Laders geeft de lader per CM-typenaam, voor dynql.ZetLaders.
func (l *ApiLader) Laders() map[string]dynql.Lader {
	uit := map[string]dynql.Lader{}
	for typenaam := range l.b.Typen {
		uit[typenaam] = l
	}
	return uit
}

// IRI geeft de IRI-tabel (voor het façade-veld object op ZaakobjectVerwijzing).
func (l *ApiLader) IRI() *IRITabel { return l.iri }

// ExtraVelden geeft, voor dynql.ZetExtraVelden, het façade-veld `object` op elk onderdeel met
// een IRI-veld (ontwerp §10.3). Het veld haalt het record achter de IRI op bij het register
// uit de IRI-tabel, alleen als de afnemer erom vraagt. Een IRI zonder bekend prefix geeft null.
// Bij meer IRI-velden op één onderdeel heet het veld <iriVeld>_object.
//
// Fase 1: altijd de actuele stand van het object. Peilen in de Objecten-API (date,
// registrationDate) volgt als we de echte API hebben getoetst.
func (l *ApiLader) ExtraVelden() map[string]graphql.Fields {
	uit := map[string]graphql.Fields{}
	for _, tb := range l.b.Typen {
		for doeltype, ob := range tb.Onderdelen {
			for _, veld := range ob.IRIVelden {
				naam := "object"
				if len(ob.IRIVelden) > 1 {
					naam = veld + "_object"
				}
				if uit[doeltype] == nil {
					uit[doeltype] = graphql.Fields{}
				}
				uit[doeltype][naam] = &graphql.Field{
					Type:        dynql.JSONScalar,
					Description: "Façade: het object achter " + veld + ", opgehaald uit het register dat bij de IRI hoort (actuele stand). Null als de IRI bij geen bekend register hoort.",
					Resolve:     l.objectResolver(veld),
				}
			}
		}
	}
	return uit
}

func (l *ApiLader) objectResolver(veld string) graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (any, error) {
		bron, ok := p.Source.(map[string]any)
		if !ok {
			return nil, nil
		}
		iri, _ := bron[veld].(string)
		if iri == "" {
			return nil, nil
		}
		v, ok := l.iri.NaarURL(iri)
		if !ok {
			return nil, nil
		}
		cl, ok := l.clients[v.Register]
		if !ok {
			return nil, fmt.Errorf("façade: geen client voor register %s", v.Register)
		}
		obj, err := cl.HaalJSON(p.Context, v.URL)
		if errors.Is(err, ErrNietGevonden) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		return obj, nil
	}
}

// Client geeft de client van een register.
func (l *ApiLader) Client(register string) (*Client, bool) {
	c, ok := l.clients[register]
	return c, ok
}

// weigerPeil: een register zonder formele tijd (ZGW) kent geen peiltijdstip.
func (l *ApiLader) weigerPeil(ctx context.Context, tb TypeBinding) error {
	if dynql.PeilOpgegeven(ctx) && l.b.Registers[tb.Register].Soort == "zgw" {
		return dynql.NietOndersteund{Reden: "het register " + tb.Register + " kent geen formele tijd (peiltijdstip/t)"}
	}
	return nil
}

func (l *ApiLader) typeBinding(meta model.TypeMeta) (TypeBinding, error) {
	tb, ok := l.b.Typen[meta.Typenaam]
	if !ok {
		return TypeBinding{}, fmt.Errorf("façade: type %s heeft geen binding", meta.Typenaam)
	}
	return tb, nil
}

// objectURL is de URL van een object van een type, uit zijn uuid.
func (l *ApiLader) objectURL(tb TypeBinding, uuid string) string {
	return l.b.Registers[tb.Register].Basis + tb.Resource + "/" + uuid
}

func alsInt(id any) (int, bool) {
	switch v := id.(type) {
	case int:
		return v, true
	case int64:
		return int(v), true
	case float64:
		return int(v), true
	}
	return 0, false
}

// LaadEen implementeert dynql.Lader.
func (l *ApiLader) LaadEen(ctx context.Context, meta model.TypeMeta, id any, _ time.Time) (any, error) {
	tb, err := l.typeBinding(meta)
	if err != nil {
		return nil, err
	}
	if err := l.weigerPeil(ctx, tb); err != nil {
		return nil, err
	}
	n, ok := alsInt(id)
	if !ok {
		return nil, fmt.Errorf("façade: id %v van %s is geen geheel getal", id, meta.Typenaam)
	}
	_, uuid, bekend, err := l.ids.UUID(ctx, meta.Typenaam, n)
	if err != nil {
		return nil, err
	}
	if !bekend {
		return nil, nil // nooit gezien: bestaat voor de façade niet
	}
	obj, err := l.clients[tb.Register].HaalJSON(ctx, l.objectURL(tb, uuid))
	if errors.Is(err, ErrNietGevonden) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	vorm, err := l.vorm(ctx, meta, tb, obj, n, true)
	if err != nil {
		return nil, err
	}
	return vulStruct(meta, vorm)
}

// LaadIDs implementeert dynql.Lader.
func (l *ApiLader) LaadIDs(ctx context.Context, meta model.TypeMeta, ids []any, peil time.Time) (any, error) {
	vormen := []map[string]any{}
	for _, id := range ids {
		ent, err := l.LaadEen(ctx, meta, id, peil)
		if err != nil {
			return nil, err
		}
		if ent == nil {
			continue
		}
		ruw, _ := json.Marshal(ent)
		var m map[string]any
		_ = json.Unmarshal(ruw, &m)
		vormen = append(vormen, m)
	}
	return vulSlice(meta, vormen)
}

// LaadLijst implementeert dynql.Lader.
func (l *ApiLader) LaadLijst(ctx context.Context, meta model.TypeMeta, v dynql.LijstVraag) (any, error) {
	tb, err := l.typeBinding(meta)
	if err != nil {
		return nil, err
	}
	if err := l.weigerPeil(ctx, tb); err != nil {
		return nil, err
	}
	if len(v.Sortering) > 0 {
		return nil, dynql.NietOndersteund{Reden: "sorteren op een veld kan de façade nog niet doorgeven"}
	}
	params, err := l.filterParams(ctx, meta, tb, v.Filter)
	if err != nil {
		return nil, err
	}
	items, err := l.clients[tb.Register].Lijst(ctx, tb.Resource, params, v.Offset+v.Limit)
	if err != nil {
		return nil, err
	}
	if v.Offset >= len(items) {
		items = nil
	} else {
		items = items[v.Offset:]
	}
	vormen := make([]map[string]any, 0, len(items))
	for _, obj := range items {
		uuid, ok := uuidUitURL(tekst(obj, "url"))
		if !ok {
			return nil, fmt.Errorf("façade: %s zonder url met uuid in %s", meta.Typenaam, tb.Resource)
		}
		id, err := l.ids.ID(ctx, tb.Register, meta.Typenaam, uuid)
		if err != nil {
			return nil, err
		}
		vorm, err := l.vorm(ctx, meta, tb, obj, id, v.Volledig)
		if err != nil {
			return nil, err
		}
		vormen = append(vormen, vorm)
	}
	return vulSlice(meta, vormen)
}

// BronIDs implementeert dynql.Lader: de bron-entiteiten die via een relatie naar doelID wijzen.
// Kan alleen als de binding van die relatie zegt hoe het register dat opzoekt.
func (l *ApiLader) BronIDs(ctx context.Context, rev dynql.ReverseRelationInfo, doelID any, limit int, _ time.Time) ([]any, error) {
	bronTB, err := l.typeBinding(rev.BronEntiteitMeta)
	if err != nil {
		return nil, err
	}
	ob, ok := bronTB.Onderdelen[rev.RelatieMeta.Typenaam]
	if !ok {
		return nil, dynql.NietOndersteund{Reden: "relatie " + rev.RelatieMeta.Typenaam + " heeft geen binding"}
	}
	doelTypenaam := model.DoelTypenaamVanRelatie(rev.RelatieMeta)
	doelTB, ok := l.b.Typen[doelTypenaam]
	if !ok {
		return nil, dynql.NietOndersteund{Reden: "doelentiteit " + doelTypenaam + " heeft geen binding"}
	}
	n, ok := alsInt(doelID)
	if !ok {
		return nil, nil
	}
	_, uuid, bekend, err := l.ids.UUID(ctx, doelTypenaam, n)
	if err != nil || !bekend {
		return nil, err
	}
	doelURL := l.objectURL(doelTB, uuid)

	var bronURLs []string
	switch {
	case ob.Bron == "" && ob.OmgekeerdFilter != "":
		// De verwijzing staat op de bron zelf (zaak.zaaktype): zoek bronnen op dat veld.
		items, err := l.clients[bronTB.Register].Lijst(ctx, bronTB.Resource,
			url.Values{ob.OmgekeerdFilter: {doelURL}}, limit)
		if err != nil {
			return nil, err
		}
		for _, it := range items {
			bronURLs = append(bronURLs, tekst(it, "url"))
		}
	case ob.Bron != "":
		// Een lijst-resource met het doel als item (rollen van een zaak): haal het item en lees
		// de verwijzing naar de bron (rol.zaak).
		item, err := l.clients[doelTB.Register].HaalJSON(ctx, doelURL)
		if errors.Is(err, ErrNietGevonden) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		if u := tekst(item, ob.FilterOp); u != "" {
			bronURLs = append(bronURLs, u)
		}
	default:
		return nil, dynql.NietOndersteund{Reden: "omgekeerd zoeken via " + rev.RelatieMeta.Typenaam + " staat niet in de binding (omgekeerdFilter)"}
	}
	uit := []any{}
	for _, u := range bronURLs {
		uuid, ok := uuidUitURL(u)
		if !ok {
			continue
		}
		id, err := l.ids.ID(ctx, bronTB.Register, rev.BronEntiteitMeta.Typenaam, uuid)
		if err != nil {
			return nil, err
		}
		uit = append(uit, id)
		if len(uit) >= limit {
			break
		}
	}
	return uit, nil
}

// filterParams vertaalt het GraphQL-filter naar query-parameters (alleen eq, alleen and).
func (l *ApiLader) filterParams(ctx context.Context, meta model.TypeMeta, tb TypeBinding, filter any) (url.Values, error) {
	params := url.Values{}
	f, _ := filter.(map[string]any)
	if len(f) == 0 {
		return params, nil
	}
	var verwerk func(f map[string]any) error
	verwerk = func(f map[string]any) error {
		for sleutel, w := range f {
			switch sleutel {
			case "and":
				lijst, _ := w.([]any)
				for _, el := range lijst {
					sub, _ := el.(map[string]any)
					if err := verwerk(sub); err != nil {
						return err
					}
				}
				continue
			case "or", "not":
				return dynql.NietOndersteund{Reden: "filter met " + sleutel + " kan de façade niet doorgeven"}
			}
			velden, _ := w.(map[string]any)
			if sleutel == "id" {
				velden = map[string]any{"": w}
			}
			for veld, cond := range velden {
				pad := sleutel
				if veld != "" {
					pad += "." + veld
				}
				param, ok := tb.Filters[pad]
				if !ok {
					return dynql.NietOndersteund{Reden: "filter op " + pad + " staat niet in de binding van " + meta.Typenaam}
				}
				c, _ := cond.(map[string]any)
				eq, ok := c["eq"]
				if !ok || len(c) != 1 {
					return dynql.NietOndersteund{Reden: "filter op " + pad + ": alleen eq kan de façade doorgeven"}
				}
				params.Set(param, fmt.Sprint(eq))
			}
		}
		return nil
	}
	if err := verwerk(f); err != nil {
		return nil, err
	}
	return params, nil
}

// vorm bouwt de JSON-vorm van de struct van een entiteit uit een registerobject.
func (l *ApiLader) vorm(ctx context.Context, meta model.TypeMeta, tb TypeBinding, obj map[string]any, id int, volledig bool) (map[string]any, error) {
	m := map[string]any{"id": id}
	if !volledig {
		return m, nil
	}
	for _, kind := range meta.OnderliggendeGegevenselementen {
		ob, ok := tb.Onderdelen[kind.Doeltype]
		if !ok {
			continue // niet gebonden: het onderdeel blijft leeg
		}
		kindMeta, ok := model.MetaRegistry.GetTypeMeta(kind.Doeltype)
		if !ok {
			continue
		}
		items := []map[string]any{obj}
		if ob.Bron != "" {
			ouder := tekst(obj, "url")
			if ouder == "" {
				return nil, fmt.Errorf("façade: %s zonder url; %s niet op te halen", meta.Typenaam, kind.Doeltype)
			}
			var err error
			items, err = l.clients[tb.Register].Lijst(ctx, ob.Bron, url.Values{ob.FilterOp: {ouder}}, 0)
			if err != nil {
				return nil, err
			}
		}
		items = filterItems(items, ob.Als)
		if ob.Aanvang != "" {
			sort.SliceStable(items, func(a, b int) bool { return tekst(items[a], ob.Aanvang) < tekst(items[b], ob.Aanvang) })
		}
		hubs := []any{}
		for i, item := range items {
			relID := 1
			if ob.Bron != "" {
				uuid, ok := uuidUitURL(tekst(item, "url"))
				if !ok {
					return nil, fmt.Errorf("façade: item van %s zonder url met uuid", ob.Bron)
				}
				var err error
				if relID, err = l.ids.ID(ctx, tb.Register, kind.Doeltype, uuid); err != nil {
					return nil, err
				}
			}
			sleutel := map[string]any{kindMeta.EntiteitIDKolom: id, "rel_id": relID}
			hub := kopie(sleutel)
			data := kopie(sleutel)
			data["versie"] = 1
			soorten := veldSoorten(kindMeta.DataTypenaam)
			for veld, pad := range ob.Velden {
				data[veld] = pasAan(waarde(item, pad), soorten[veld])
			}
			for _, veld := range ob.IRIVelden {
				if s, ok := data[veld].(string); ok && s != "" {
					data[veld] = l.iri.NaarIRI(s)
				}
			}
			if kindMeta.Metatype == model.MetatypeRelatie {
				doelURL := tekst(item, ob.Doel)
				if doelURL == "" {
					continue // geen doel: geen voorkomen (bv. zaak zonder resultaat)
				}
				doelTypenaam := model.DoelTypenaamVanRelatie(kindMeta)
				doelTB := l.b.Typen[doelTypenaam]
				if !l.clients[doelTB.Register].Hoort(doelURL) {
					return nil, fmt.Errorf("façade: %s wijst naar %q, buiten register %s", kind.Doeltype, doelURL, doelTB.Register)
				}
				uuid, ok := uuidUitURL(doelURL)
				if !ok {
					return nil, fmt.Errorf("façade: doel-url %q van %s zonder uuid", doelURL, kind.Doeltype)
				}
				doelID, err := l.ids.ID(ctx, doelTB.Register, doelTypenaam, uuid)
				if err != nil {
					return nil, err
				}
				hub[kindMeta.SecondaireEntiteitIDKolom] = doelID
			}
			if len(ob.Velden) > 0 || kindMeta.DataTypenaam != "" {
				hub["data"] = []any{data}
			}
			if ob.Aanvang != "" {
				if a := tekst(item, ob.Aanvang); a != "" {
					av := kopie(sleutel)
					av["versie"], av["datum"] = 1, a
					hub["aanvang"] = []any{av}
				}
				if i+1 < len(items) {
					if e := tekst(items[i+1], ob.Aanvang); e != "" {
						ev := kopie(sleutel)
						ev["versie"], ev["datum"] = 1, e
						hub["einde"] = []any{ev}
					}
				}
			}
			hubs = append(hubs, hub)
		}
		m[kind.JSONRolnaam] = hubs
	}
	return m, nil
}

func filterItems(items []map[string]any, als *Voorwaarde) []map[string]any {
	if als == nil {
		return items
	}
	uit := items[:0:0]
	for _, it := range items {
		w := waarde(it, als.Veld)
		gevuld := w != nil && fmt.Sprint(w) != ""
		if (als.Gevuld && gevuld) || (!als.Gevuld && fmt.Sprint(w) == als.Is) {
			uit = append(uit, it)
		}
	}
	return uit
}

// veldSoorten geeft per JSON-veld van een struct het onderliggende Go-soort (pointers
// uitgepakt). Eenmalig per type berekend.
var veldSoortCache sync.Map // typenaam → map[string]reflect.Kind

func veldSoorten(typenaam string) map[string]reflect.Kind {
	if v, ok := veldSoortCache.Load(typenaam); ok {
		return v.(map[string]reflect.Kind)
	}
	uit := map[string]reflect.Kind{}
	if meta, ok := model.MetaRegistry.GetTypeMeta(typenaam); ok && meta.Factory != nil {
		t := reflect.TypeOf(meta.Factory())
		for t.Kind() == reflect.Ptr {
			t = t.Elem()
		}
		for i := 0; i < t.NumField(); i++ {
			naam, _, _ := strings.Cut(t.Field(i).Tag.Get("json"), ",")
			ft := t.Field(i).Type
			for ft.Kind() == reflect.Ptr {
				ft = ft.Elem()
			}
			if naam != "" && naam != "-" {
				uit[naam] = ft.Kind()
			}
		}
	}
	veldSoortCache.Store(typenaam, uit)
	return uit
}

// pasAan zet eenvoudige verschillen tussen register en CM recht: een getal of waarheidswaarde
// naar tekst, tekst met een getal naar een getal. Een vangrail voor een CM dat een veld anders
// typeert dan het register; het zaakmodel heeft sinds 18-11 de ZGW-typen en heeft hem niet
// meer nodig. Andere verschillen blijven staan en geven bij het vullen een duidelijke fout.
func pasAan(v any, soort reflect.Kind) any {
	switch w := v.(type) {
	case float64:
		if soort == reflect.String {
			return strconv.FormatFloat(w, 'f', -1, 64)
		}
	case bool:
		if soort == reflect.String {
			return strconv.FormatBool(w)
		}
	case string:
		switch soort {
		case reflect.Int, reflect.Int64, reflect.Int32:
			if n, err := strconv.ParseInt(w, 10, 64); err == nil {
				return n
			}
		case reflect.Float64, reflect.Float32:
			if f, err := strconv.ParseFloat(w, 64); err == nil {
				return f
			}
		}
	}
	return v
}

// waarde volgt een pad met punten in een JSON-object.
func waarde(obj map[string]any, pad string) any {
	var cur any = obj
	for _, deel := range strings.Split(pad, ".") {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = m[deel]
	}
	return cur
}

func tekst(obj map[string]any, pad string) string {
	s, _ := waarde(obj, pad).(string)
	return s
}

func kopie(m map[string]any) map[string]any {
	uit := make(map[string]any, len(m)+4)
	for k, v := range m {
		uit[k] = v
	}
	return uit
}

// vulStruct laadt een JSON-vorm in meta.Factory().
func vulStruct(meta model.TypeMeta, vorm map[string]any) (any, error) {
	ruw, err := json.Marshal(vorm)
	if err != nil {
		return nil, err
	}
	ent := meta.Factory()
	if err := json.Unmarshal(ruw, ent); err != nil {
		return nil, fmt.Errorf("façade: %s vullen: %w", meta.Typenaam, err)
	}
	return ent, nil
}

// vulSlice laadt JSON-vormen in meta.SliceFactory().
func vulSlice(meta model.TypeMeta, vormen []map[string]any) (any, error) {
	ruw, err := json.Marshal(vormen)
	if err != nil {
		return nil, err
	}
	s := meta.SliceFactory()
	if err := json.Unmarshal(ruw, s); err != nil {
		return nil, fmt.Errorf("façade: lijst %s vullen: %w", meta.Typenaam, err)
	}
	return s, nil
}
