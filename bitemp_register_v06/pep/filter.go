package pep

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/toegang"
	"github.com/gin-gonic/gin"
)

// IsTechnisch: sleutels die geen beleidspad zijn maar plumbing (identiteit en formele tijd).
// Gelijk aan isTechnischVeldnaam in web/vite/src/modelpicker/modelTree.js, plus de formele
// tijdvelden die de Studio niet als veld toont.
func IsTechnisch(sleutel string) bool {
	s := strings.ToLower(sleutel)
	switch s {
	case "id", "rel_id", "versie", "opvoer", "afvoer":
		return true
	}
	return strings.HasSuffix(s, "_id")
}

// Prefix geeft het registerpad waaronder de velden van een type vallen, of "" als dat niet
// eenduidig af te leiden is (dan weigert de PEP, behalve bij standaard toestaan):
// het pad van de ouder + "." + de JSON-rolnaam waaronder het type daar hangt — precies de
// sleutel in een /full-antwoord. De rol "data" (Hub+_Data) telt niet mee.
//   - NatuurlijkPersoon            → "NatuurlijkPersoon"
//   - NatuurlijkPersoon_Naam       → "NatuurlijkPersoon.namen"
//   - NatuurlijkPersoon_Naam_Data  → "NatuurlijkPersoon.namen"
func Prefix(meta model.TypeMeta) string {
	return prefix(meta.Typenaam, 0)
}

type ouderRol struct{ ouder, rol string }

var (
	oudersOnce sync.Once
	ouders     map[string][]ouderRol // doeltype → waar het onder hangt
)

func ouderIndex() map[string][]ouderRol {
	oudersOnce.Do(func() {
		ouders = map[string][]ouderRol{}
		for naam, meta := range model.MetaRegistry {
			for _, o := range meta.OnderliggendeGegevenselementen {
				rol := o.JSONRolnaam
				if rol == "" {
					rol = o.Rolnaam
				}
				ouders[o.Doeltype] = append(ouders[o.Doeltype], ouderRol{ouder: naam, rol: rol})
			}
		}
	})
	return ouders
}

func prefix(typenaam string, diepte int) string {
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok || diepte > 8 {
		return ""
	}
	if meta.Metatype == model.MetatypeEntiteit {
		return meta.Typenaam
	}
	kandidaten := map[string]bool{}
	for _, or := range ouderIndex()[typenaam] {
		basis := prefix(or.ouder, diepte+1)
		if basis == "" || or.rol == "" {
			continue
		}
		if strings.EqualFold(or.rol, "data") {
			kandidaten[basis] = true
		} else {
			kandidaten[basis+"."+or.rol] = true
		}
	}
	if len(kandidaten) == 0 && meta.BovenliggendTypenaam != "" {
		if basis := prefix(meta.BovenliggendTypenaam, diepte+1); basis != "" {
			kandidaten[basis] = true
		}
	}
	if len(kandidaten) != 1 {
		return "" // onbekend of dubbelzinnig: fail-closed
	}
	for k := range kandidaten {
		return k
	}
	return ""
}

// naarJSON zet structs (zoals de handlers ze teruggeven) om naar generieke JSON-waarden, zodat
// de snoeier op dezelfde sleutels werkt als de afnemer ziet.
func naarJSON(x any) (any, error) {
	data, err := json.Marshal(x)
	if err != nil {
		return nil, err
	}
	var uit any
	if err := json.Unmarshal(data, &uit); err != nil {
		return nil, err
	}
	return uit, nil
}

// recordFilter beslist voor één record; de beslissingen per pad worden gecachet omdat
// meervoudige GE's hetzelfde pad vaak herhalen.
type recordFilter struct {
	bundel *toegang.Bundel
	v      toegang.Verzoek
	cache  map[string]bool
}

func nieuwRecordFilter(b *toegang.Bundel, basis toegang.Verzoek, prefix string, record any) *recordFilter {
	waarden := map[string][]any{}
	verzamel(record, prefix, waarden)
	v := basis
	v.Betrokkene = func(pad string) (any, bool) {
		w, ok := waarden[pad]
		if !ok {
			return nil, false
		}
		return w, true
	}
	return &recordFilter{bundel: b, v: v, cache: map[string]bool{}}
}

func (f *recordFilter) mag(pad string) bool {
	if m, ok := f.cache[pad]; ok {
		return m
	}
	m := f.bundel.Beslis(f.v, pad).Toegestaan
	f.cache[pad] = m
	return m
}

// verzamel: veldpad → waarden in dit record (voor voorwaarden over de betrokkene).
func verzamel(x any, pad string, uit map[string][]any) {
	switch t := x.(type) {
	case map[string]any:
		for k, v := range t {
			if IsTechnisch(k) {
				continue
			}
			sub := pad + "." + k
			if k == "data" {
				sub = pad
			}
			verzamel(v, sub, uit)
		}
	case []any:
		if isScalairLijst(t) {
			uit[pad] = append(uit[pad], t...)
			return
		}
		for _, e := range t {
			verzamel(e, pad, uit)
		}
	default:
		uit[pad] = append(uit[pad], x)
	}
}

func isScalairLijst(l []any) bool {
	for _, e := range l {
		switch e.(type) {
		case map[string]any, []any:
			return false
		}
	}
	return true
}

// snoei geeft het toegestane deel van x terug. zichtbaar: er bleef inhoud over; inhoud: x had
// überhaupt niet-technische velden (een leeg record is niet "verboden", alleen leeg).
func (f *recordFilter) snoei(x any, pad string) (uit any, zichtbaar, inhoud bool) {
	switch t := x.(type) {
	case map[string]any:
		res := map[string]any{}
		technisch := map[string]any{}
		for k, v := range t {
			if IsTechnisch(k) {
				technisch[k] = v
				continue
			}
			sub := pad + "." + k
			if k == "data" {
				sub = pad
			}
			if l, isLijst := v.([]any); isLijst && isScalairLijst(l) {
				inhoud = true
				if f.mag(sub) {
					res[k] = v
					zichtbaar = true
				}
				continue
			}
			switch v.(type) {
			case map[string]any, []any:
				nv, z, i := f.snoei(v, sub)
				inhoud = inhoud || i
				if z {
					res[k] = nv
					zichtbaar = true
				}
				continue
			}
			inhoud = true
			if f.mag(sub) {
				res[k] = v
				zichtbaar = true
			}
		}
		if zichtbaar {
			for k, v := range technisch {
				res[k] = v
			}
		}
		return res, zichtbaar, inhoud
	case []any:
		res := make([]any, 0, len(t))
		for _, e := range t {
			nv, z, i := f.snoei(e, pad)
			inhoud = inhoud || i
			if z {
				res = append(res, nv)
			}
		}
		return res, len(res) > 0, inhoud
	}
	return x, f.mag(pad), true
}

// filterRecord: het gesnoeide record en of het zichtbaar blijft. Een record zonder enige
// inhoud (alleen technische velden) is zichtbaar als het subject van dit type iets mag zien.
func filterRecord(b *toegang.Bundel, basis toegang.Verzoek, prefix string, record any, magType bool) (any, bool) {
	f := nieuwRecordFilter(b, basis, prefix, record)
	uit, zichtbaar, inhoud := f.snoei(record, prefix)
	if !inhoud {
		if !magType {
			return nil, false
		}
		// alleen technische velden: laat ze staan
		return record, true
	}
	return uit, zichtbaar
}

// FilterLijst snoeit een lijst records van één type. ok=false: het subject mag van dit type
// zeker niets zien (de aanroeper antwoordt 403).
func FilterLijst(c *gin.Context, b *toegang.Bundel, meta model.TypeMeta, records any) ([]any, bool, error) {
	basis := verzoekUit(c)
	pre := Prefix(meta)
	magType := pre != "" && b.KanIetsZien(basis.Subject, basis.Handeling, pre, basis.Peilmoment)
	if pre == "" && b.Standaard == "toestaan" {
		magType = true
	}
	if !magType {
		return nil, false, nil
	}
	j, err := naarJSON(records)
	if err != nil {
		return nil, true, fmt.Errorf("pep: antwoord omzetten: %w", err)
	}
	lijst, _ := j.([]any)
	uit := make([]any, 0, len(lijst))
	for _, r := range lijst {
		if nv, z := filterRecord(b, basis, pre, r, magType); z {
			uit = append(uit, nv)
		}
	}
	return uit, true, nil
}

// FilterEen snoeit één record. magType=false → 403; zichtbaar=false → 404.
func FilterEen(c *gin.Context, b *toegang.Bundel, meta model.TypeMeta, record any) (uit any, magType, zichtbaar bool, err error) {
	basis := verzoekUit(c)
	pre := Prefix(meta)
	magType = pre != "" && b.KanIetsZien(basis.Subject, basis.Handeling, pre, basis.Peilmoment)
	if pre == "" && b.Standaard == "toestaan" {
		magType = true
	}
	if !magType {
		return nil, false, false, nil
	}
	j, err := naarJSON(record)
	if err != nil {
		return nil, true, false, fmt.Errorf("pep: antwoord omzetten: %w", err)
	}
	uit, zichtbaar = filterRecord(b, basis, pre, j, magType)
	return uit, true, zichtbaar, nil
}

// MagKolom: mag het subject deze kolom van dit type bekijken — en er dus ook op filteren,
// zoeken of sorteren? Zonder recordgegevens: toestemmingen met een voorwaarde over de
// betrokkene gelden hier niet (fail-closed).
func MagKolom(c *gin.Context, b *toegang.Bundel, meta model.TypeMeta, kolom string) bool {
	pre := Prefix(meta)
	if pre == "" {
		return b.Standaard == "toestaan"
	}
	return b.Beslis(verzoekUit(c), pre+"."+kolom).Toegestaan
}

// ToegestaneKolommen beperkt een lijst kolommen tot wat het subject mag bekijken.
func ToegestaneKolommen(c *gin.Context, b *toegang.Bundel, meta model.TypeMeta, kolommen []string) []string {
	uit := make([]string, 0, len(kolommen))
	for _, k := range kolommen {
		if MagKolom(c, b, meta, k) {
			uit = append(uit, k)
		}
	}
	return uit
}

// ── Context-varianten (GraphQL) ──────────────────────────────────────────────

func magTypeVoor(b *toegang.Bundel, basis toegang.Verzoek, pre string) bool {
	if pre == "" {
		return b.Standaard == "toestaan"
	}
	return b.KanIetsZien(basis.Subject, basis.Handeling, pre, basis.Peilmoment)
}

// FilterMapsCtx snoeit records die al als JSON-map voorliggen (vóór het flatten van hub+data
// in GraphQL). ok=false: het subject mag van dit type zeker niets zien.
func FilterMapsCtx(ctx context.Context, b *toegang.Bundel, meta model.TypeMeta, records []map[string]any) ([]map[string]any, bool) {
	basis := verzoekUitContext(ctx)
	pre := Prefix(meta)
	magType := magTypeVoor(b, basis, pre)
	if !magType {
		return nil, false
	}
	uit := make([]map[string]any, 0, len(records))
	for _, r := range records {
		if nv, z := filterRecord(b, basis, pre, map[string]any(r), magType); z {
			if m, ok := nv.(map[string]any); ok {
				uit = append(uit, m)
			}
		}
	}
	return uit, true
}

// FilterMapCtx snoeit één record. magType=false → geen toegang; zichtbaar=false → niet gevonden.
func FilterMapCtx(ctx context.Context, b *toegang.Bundel, meta model.TypeMeta, record map[string]any) (map[string]any, bool, bool) {
	basis := verzoekUitContext(ctx)
	pre := Prefix(meta)
	if !magTypeVoor(b, basis, pre) {
		return nil, false, false
	}
	nv, z := filterRecord(b, basis, pre, record, true)
	m, _ := nv.(map[string]any)
	return m, true, z && m != nil
}

// MagPadCtx: mag het subject dit registerpad bekijken (voor filterargumenten)?
func MagPadCtx(ctx context.Context, b *toegang.Bundel, pad string) bool {
	return b.Beslis(verzoekUitContext(ctx), pad).Toegestaan
}
