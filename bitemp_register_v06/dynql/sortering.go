package dynql

// sortering.go — sorteren van lijst-queries op een veld (indexwerk stap 3, akkoord Mark 18-11-2026).
//
// Uitleg voor gebruikers: docs/dynamische-graphql-laag.md, paragraaf "Sorteren".
//
// Het argument `sorteer` op een lijst-query is een lijst van sleutels { veld, aflopend }.
// `veld` is een pad in dezelfde namen als het filter en het outputtype:
//
//	id                         een kolom van de entiteit zelf
//	zaakgegevens.startdatum    <rolnaam van het GE of de relatie>.<veld>
//
// Semantiek:
//   - De waarde van een GE-veld is die van het actieve record (hub én data niet afgevoerd;
//     met een peiltijdstip: actief op dat moment), dezelfde regel als het filter.
//   - Bij een meervoudig GE zijn er meerdere actieve records: oplopend telt de laagste
//     waarde, aflopend de hoogste.
//   - Een entiteit zonder waarde komt achteraan, in beide richtingen (NULLS LAST).
//   - Na de opgegeven sleutels volgt altijd de id, in de richting van de laatste sleutel. Zo
//     is de volgorde bepaald en blijft paginering met limit/offset stabiel. (Tot api 0.30.0
//     was dat altijd oplopend; een index op (waarde, id) kan alleen één richting voor beide
//     aflopen, zie docs/INDEXEN.md.)
//   - Zonder `sorteer`: op id, zoals altijd.
//
// Alles komt uit de MetaRegistry, via dezelfde filterDef als het filter; er staat geen
// typenaam in deze code. Een veld waarop het subject volgens het toegangsbeleid niet mag
// kijken, is ook geen sorteersleutel: de volgorde zou de waarde verraden.
//
// Prestatie: in de algemene vorm is de sorteerwaarde een gecorreleerde subquery per entiteit.
// PostgreSQL moet die voor alle entiteiten die aan het filter voldoen uitrekenen voordat het
// de eerste pagina kan geven; een index op de waardekolom versnelt dat niet. Het eenvoudige
// geval (één sleutel op een enkelvoudig, niet-materieel GE) gaat daarom via een join op de
// waarde zelf: zie onderaan dit bestand en docs/INDEXEN.md.

import (
	"context"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
)

// maxSorteerSleutels begrenst het aantal sleutels: elke sleutel is een subquery per rij.
const maxSorteerSleutels = 3

// sorteerInput is het GraphQL-inputtype van één sorteersleutel; gedeeld door alle lijsten.
var sorteerInput = graphql.NewInputObject(graphql.InputObjectConfig{
	Name:        "Sortering",
	Description: "Eén sorteersleutel: een veldpad en een richting.",
	Fields: graphql.InputObjectConfigFieldMap{
		"veld": &graphql.InputObjectFieldConfig{
			Type:        graphql.NewNonNull(graphql.String),
			Description: "Veldpad: een kolom van de entiteit (bv. id) of <GE of relatie>.<veld>, in de namen van het filter.",
		},
		"aflopend": &graphql.InputObjectFieldConfig{
			Type:        graphql.Boolean,
			Description: "true = van hoog naar laag. Standaard oplopend.",
		},
	},
})

// sorteringUitArgs leest het argument `sorteer`. Een onbekende vorm geeft een fout in plaats
// van stil de standaardvolgorde.
func sorteringUitArgs(args map[string]interface{}) ([]Sortering, error) {
	ruw, ok := args["sorteer"]
	if !ok || ruw == nil {
		return nil, nil
	}
	lijst, ok := ruw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("sorteer: verwacht een lijst")
	}
	if len(lijst) > maxSorteerSleutels {
		return nil, fmt.Errorf("sorteer: hooguit %d sleutels", maxSorteerSleutels)
	}
	uit := make([]Sortering, 0, len(lijst))
	for _, item := range lijst {
		m, ok := item.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("sorteer: verwacht objecten met veld en aflopend")
		}
		veld, _ := m["veld"].(string)
		if strings.TrimSpace(veld) == "" {
			return nil, fmt.Errorf("sorteer: veld ontbreekt")
		}
		aflopend, _ := m["aflopend"].(bool)
		uit = append(uit, Sortering{Veldpad: strings.TrimSpace(veld), Aflopend: aflopend})
	}
	return uit, nil
}

// pasSorteringToe zet de ORDER BY van een lijst-query: de opgegeven sleutels en daarna de id.
// mag == nil: geen toegangsbeleid actief.
func pasSorteringToe(query *bun.SelectQuery, meta model.TypeMeta, sortering []Sortering, peil *time.Time, mag func(pad string) bool) (*bun.SelectQuery, error) {
	if len(sortering) > 0 {
		def := filterDefVoor(meta)
		if def == nil {
			return nil, fmt.Errorf("sorteer: %s heeft geen sorteerbare velden", meta.Typenaam)
		}
		for i, s := range sortering {
			b := &filterBouwer{peil: peil, mag: mag}
			expr, err := b.sorteerExpressie(def, s, i+1)
			if err != nil {
				return nil, err
			}
			richting := "ASC"
			if s.Aflopend {
				richting = "DESC"
			}
			query = query.OrderExpr(expr+" "+richting+" NULLS LAST", b.args...)
		}
	}
	if meta.IDKolom != "" {
		query = query.OrderExpr("?TableAlias.? "+idRichting(sortering), bun.Ident(meta.IDKolom))
	}
	return query, nil
}

// idRichting: de id sluit de sortering af in de richting van de laatste sleutel.
func idRichting(sortering []Sortering) string {
	if n := len(sortering); n > 0 && sortering[n-1].Aflopend {
		return "DESC"
	}
	return "ASC"
}

// sorteerExpressie bouwt de SQL-expressie van één sleutel:
//
//	eigen kolom:   <entiteit>.<kolom>
//	GE-veld:       (SELECT MIN|MAX(<x>.<kolom>) FROM <hub> AS sN
//	                [JOIN <data> AS sNd ON <sleutels gelijk> AND <data actief>]
//	                WHERE sN.<entiteit_id> = <entiteit>.<id> AND <hub actief>)
func (b *filterBouwer) sorteerExpressie(def *filterDef, s Sortering, nr int) (string, error) {
	delen := strings.Split(s.Veldpad, ".")
	switch len(delen) {
	case 1:
		veld, ok := def.eigen[delen[0]]
		if !ok {
			return "", fmt.Errorf("sorteer: onbekend veld %q op %s", s.Veldpad, def.meta.Typenaam)
		}
		if err := b.sorteerToegang(def.meta.Typenaam + "." + delen[0]); err != nil {
			return "", err
		}
		return b.kol(def.alias, veld.kolom), nil
	case 2:
		kind := def.kinderen[delen[0]]
		if kind == nil {
			return "", fmt.Errorf("sorteer: onbekend gegevenselement of relatie %q op %s", delen[0], def.meta.Typenaam)
		}
		veld, ok := kind.velden[delen[1]]
		if !ok {
			return "", fmt.Errorf("sorteer: onbekend veld %q in %s", delen[1], delen[0])
		}
		if err := b.sorteerToegang(def.meta.Typenaam + "." + s.Veldpad); err != nil {
			return "", err
		}
		h := fmt.Sprintf("s%d", nr)
		d := h + "d"
		alias := h
		if veld.opData {
			alias = d
		}
		functie := "MIN"
		if s.Aflopend {
			functie = "MAX"
		}
		var sql strings.Builder
		fmt.Fprintf(&sql, "(SELECT %s(%s) FROM %s AS %s", functie, b.kol(alias, veld.kolom),
			b.arg(bun.Ident(kind.hubMeta.Tabelnaam)), b.arg(bun.Ident(h)))
		if kind.dataMeta != nil {
			ent := kind.hubMeta.EntiteitIDKolom
			sleutel := kind.hubMeta.IDKolom
			fmt.Fprintf(&sql, " JOIN %s AS %s ON %s = %s AND %s = %s AND %s",
				b.arg(bun.Ident(kind.dataMeta.Tabelnaam)), b.arg(bun.Ident(d)),
				b.kol(d, ent), b.kol(h, ent),
				b.kol(d, sleutel), b.kol(h, sleutel),
				b.actief(d))
		}
		fmt.Fprintf(&sql, " WHERE %s = %s AND %s)",
			b.kol(h, kind.hubMeta.EntiteitIDKolom), b.kol(def.alias, def.meta.IDKolom),
			b.actief(h))
		return sql.String(), nil
	}
	return "", fmt.Errorf("sorteer: veldpad %q heeft te veel delen (verwacht veld of ge.veld)", s.Veldpad)
}

// sorteerToegang: als toegang(), met een melding die bij sorteren past.
func (b *filterBouwer) sorteerToegang(pad string) error {
	if err := b.toegang(pad); err != nil {
		return fmt.Errorf("sorteer: geen toegang tot %s volgens het toegangsbeleid", pad)
	}
	return nil
}

// --- Sorteren op de waarde zelf (18-11-2026) --------------------------------
//
// Ontwerp: docs/plans/2026-11-18 Sorteren via de index — ontwerp.md.
//
// In het eenvoudige geval is de sorteerwaarde geen subquery per entiteit maar een kolom van
// een gejoinde tabel. PostgreSQL kan dan de index op die kolom in volgorde aflopen en stoppen
// na de pagina, of (zonder index) één keer sorteren in plaats van per entiteit een subquery
// uit te rekenen.
//
// Het eenvoudige geval: precies één sleutel van de vorm <GE of relatie>.<veld>, en dat GE is
// enkelvoudig en niet materieel. Dan is er per entiteit hooguit één actief record en is de
// join gelijk aan MIN/MAX. Een meervoudig GE geeft meerdere rijen per entiteit; een
// enkelvoudig materieel GE kan meerdere formeel actieve voorkomens hebben (opvolging).
//
// Entiteiten zonder waarde komen niet uit de join. Zij vormen een tweede deel, op id, dat de
// pagina aanvult als het eerste deel op is. Zo blijft de regel "zonder waarde achteraan, in
// beide richtingen" gelijk aan de subquery-vorm.
//
// Deel 1 heeft twee vormen (18-11-2026, na de meting van FUNDAMENT op 373.000 zaken waarvan
// 270.000 op één startdatum):
//
//   - Zonder filter: ORDER BY <waarde>, <entiteit-id in dezelfde tabel>, beide in dezelfde
//     richting. De index (waarde, entiteit-id) uit dbsetup/indexen.go levert die volgorde
//     volledig; PostgreSQL stopt na de pagina, ook als heel veel entiteiten dezelfde waarde
//     hebben. Met de id van de entiteit zelf als tweede sleutel, of in een andere richting,
//     moest PostgreSQL de hele groep met gelijke waarde lezen.
//   - Met een filter: eerst de entiteiten die aan het filter voldoen, met hun waarde, in een
//     gematerialiseerde CTE; daarna sorteren. Zonder die grens kiest de planner door de LIMIT
//     de index op de waarde en toetst hij het filter per rij; bij een filter dat weinig
//     doorlaat leest hij dan bijna de hele index. Filter eerst is nooit duurder dan de
//     subquery-vorm.

// waardeSortering beschrijft de join waarmee op de waarde zelf gesorteerd kan worden.
type waardeSortering struct {
	def      *filterDef
	kind     *filterKind
	veld     filterVeld
	aflopend bool
	pad      string // registerpad voor het toegangsbeleid
}

const (
	sorteerHubAlias  = "sw"
	sorteerDataAlias = "swd"
)

// waardeSorteringVoor geeft de join-vorm als de sortering het eenvoudige geval is, anders nil.
func waardeSorteringVoor(meta model.TypeMeta, sortering []Sortering) *waardeSortering {
	if len(sortering) != 1 || meta.IDKolom == "" {
		return nil
	}
	delen := strings.Split(sortering[0].Veldpad, ".")
	if len(delen) != 2 {
		return nil
	}
	def := filterDefVoor(meta)
	if def == nil {
		return nil
	}
	kind := def.kinderen[delen[0]]
	if kind == nil || kind.hubMeta.IsMaterieel || kind.hubMeta.EntiteitIDKolom == "" {
		return nil
	}
	enkelvoudig := false
	for _, child := range meta.OnderliggendeGegevenselementen {
		if child.JSONRolnaam == delen[0] {
			enkelvoudig = child.Momentvoorkomen == model.Enkelvoudig
			break
		}
	}
	if !enkelvoudig {
		return nil
	}
	veld, ok := kind.velden[delen[1]]
	if !ok || (veld.opData && kind.dataMeta == nil) {
		return nil
	}
	return &waardeSortering{def: def, kind: kind, veld: veld, aflopend: sortering[0].Aflopend,
		pad: meta.Typenaam + "." + sortering[0].Veldpad}
}

// waardeAlias: de tabel waarin de sorteerkolom staat.
func (w *waardeSortering) waardeAlias() string {
	if w.veld.opData {
		return sorteerDataAlias
	}
	return sorteerHubAlias
}

// bron bouwt "<hub> AS sw [JOIN <data> AS swd ON <sleutels gelijk> AND <data actief>]", met
// dezelfde tabellen en voorwaarden als sorteerExpressie.
func (w *waardeSortering) bron(b *filterBouwer) string {
	var sql strings.Builder
	sql.WriteString(b.arg(bun.Ident(w.kind.hubMeta.Tabelnaam)) + " AS " + b.arg(bun.Ident(sorteerHubAlias)))
	if w.kind.dataMeta != nil {
		ent := w.kind.hubMeta.EntiteitIDKolom
		sleutel := w.kind.hubMeta.IDKolom
		fmt.Fprintf(&sql, " JOIN %s AS %s ON %s = %s AND %s = %s AND %s",
			b.arg(bun.Ident(w.kind.dataMeta.Tabelnaam)), b.arg(bun.Ident(sorteerDataAlias)),
			b.kol(sorteerDataAlias, ent), b.kol(sorteerHubAlias, ent),
			b.kol(sorteerDataAlias, sleutel), b.kol(sorteerHubAlias, sleutel),
			b.actief(sorteerDataAlias))
	}
	return sql.String()
}

// bijEntiteit: het actieve record hoort bij de entiteit van de buitenste query en heeft een waarde.
func (w *waardeSortering) bijEntiteit(b *filterBouwer) string {
	return fmt.Sprintf("%s = %s AND %s AND %s IS NOT NULL",
		b.kol(sorteerHubAlias, w.kind.hubMeta.EntiteitIDKolom), b.kol(w.def.alias, w.def.meta.IDKolom),
		b.actief(sorteerHubAlias), b.kol(w.waardeAlias(), w.veld.kolom))
}

// laadIDsOpWaarde geeft de id's van één pagina in de gevraagde volgorde: eerst de entiteiten
// met een waarde (deel 1), dan die zonder (deel 2, op id).
//
// Met zg (een passende zoektabel, zoektabel.go) komt deel 1 uit de zoektabel in plaats van uit
// de brontabellen; deel 2 blijft de gewone weg.
func laadIDsOpWaarde(ctx context.Context, meta model.TypeMeta, v LijstVraag, w *waardeSortering, mag func(string) bool, zg *zoekGebruik) ([]int64, error) {
	moment := v.Peil
	toegang := &filterBouwer{peil: &moment, mag: mag}
	if err := toegang.sorteerToegang(w.pad); err != nil {
		return nil, err
	}
	// basis: de entiteiten die actief zijn en aan het filter voldoen; alleen de id.
	basis := func() (*bun.SelectQuery, error) {
		q := db.NewSelect().Model(meta.SliceFactory()).
			ColumnExpr("?TableAlias.?", bun.Ident(meta.IDKolom)).
			Where("?TableAlias.opvoer <= ?", moment).
			Where("(?TableAlias.afvoer IS NULL OR ?TableAlias.afvoer > ?)", moment)
		return pasFilterToeMetToegang(q, meta, v.Filter, &moment, mag)
	}
	// Een hub met data staat als geneste join: "JOIN (hub JOIN data ON …) ON …".
	metWaarde := func() (*bun.SelectQuery, error) {
		q, err := basis()
		if err != nil {
			return nil, err
		}
		b := &filterBouwer{peil: &moment}
		bron := w.bron(b)
		if w.kind.dataMeta != nil {
			bron = "(" + bron + ")" // alleen een join mag tussen haakjes
		}
		join := "JOIN " + bron + " ON " + w.bijEntiteit(b)
		return q.Join(join, b.args...), nil
	}

	q1, err := metWaarde()
	if err != nil {
		return nil, err
	}
	richting := "ASC"
	if w.aflopend {
		richting = "DESC"
	}
	var ids []int64
	if zg != nil {
		ids, err = zg.ids(ctx, moment, w.aflopend, v.Limit, v.Offset)
	} else if heeftFilter(v.Filter) {
		// Filter eerst: de CTE is een grens voor de planner.
		q1 = q1.ColumnExpr("?.? AS sorteerwaarde", bun.Ident(w.waardeAlias()), bun.Ident(w.veld.kolom))
		err = db.NewRaw("WITH w AS MATERIALIZED (?) SELECT ? FROM w ORDER BY sorteerwaarde "+richting+", ? "+richting+" LIMIT ? OFFSET ?",
			q1, bun.Ident(meta.IDKolom), bun.Ident(meta.IDKolom), v.Limit, v.Offset).Scan(ctx, &ids)
	} else {
		// De tweede sleutel is de entiteit-id in de tabel van de waarde: dezelfde waarde als
		// de id van de entiteit, maar zo dat de index (waarde, entiteit-id) de volgorde geeft.
		err = q1.OrderExpr("?.? "+richting, bun.Ident(w.waardeAlias()), bun.Ident(w.veld.kolom)).
			OrderExpr("?.? "+richting, bun.Ident(w.waardeAlias()), bun.Ident(w.kind.hubMeta.EntiteitIDKolom)).
			Limit(v.Limit).Offset(v.Offset).Scan(ctx, &ids)
	}
	if err != nil {
		return nil, err
	}
	if len(ids) >= v.Limit {
		return ids, nil
	}

	// Deel 1 is op. Hoeveel entiteiten had het? Met treffers volgt dat uit de offset; zonder
	// treffers en met een offset is één telling nodig.
	aantalMetWaarde := v.Offset + len(ids)
	if len(ids) == 0 && v.Offset > 0 {
		qn, err := metWaarde()
		if err != nil {
			return nil, err
		}
		if zg != nil {
			aantalMetWaarde, err = zg.aantal(ctx, moment)
		} else {
			aantalMetWaarde, err = qn.Count(ctx)
		}
		if err != nil {
			return nil, err
		}
	}
	offset2 := v.Offset - aantalMetWaarde
	if offset2 < 0 {
		offset2 = 0
	}
	q2, err := basis()
	if err != nil {
		return nil, err
	}
	b := &filterBouwer{peil: &moment}
	geenWaarde := "NOT EXISTS (SELECT 1 FROM " + w.bron(b) + " WHERE " + w.bijEntiteit(b) + ")"
	var rest []int64
	err = q2.Where(geenWaarde, b.args...).
		OrderExpr("?TableAlias.? "+richting, bun.Ident(meta.IDKolom)).
		Limit(v.Limit-len(ids)).Offset(offset2).Scan(ctx, &rest)
	if err != nil {
		return nil, err
	}
	return append(ids, rest...), nil
}

// heeftFilter: is er een filter dat rijen kan weglaten?
func heeftFilter(filter any) bool {
	if filter == nil {
		return false
	}
	if f, ok := filter.(map[string]interface{}); ok {
		return len(f) > 0
	}
	return true
}

// zetOpVolgorde zet een geladen slice (pointer naar []T) in de volgorde van ids.
func zetOpVolgorde(entities any, idKolom string, ids []int64) {
	sv := reflect.ValueOf(entities)
	if sv.Kind() == reflect.Ptr {
		sv = sv.Elem()
	}
	if sv.Kind() != reflect.Slice {
		return
	}
	plek := make(map[int64]int, len(ids))
	for i, id := range ids {
		plek[id] = i
	}
	kopie := reflect.MakeSlice(sv.Type(), sv.Len(), sv.Len())
	reflect.Copy(kopie, sv)
	volgorde := make([]int, sv.Len())
	for i := range volgorde {
		volgorde[i] = i
	}
	sleutel := func(i int) int {
		id, err := haalIntID(kopie.Index(i), idKolom)
		if err != nil {
			return len(ids)
		}
		if p, ok := plek[int64(id)]; ok {
			return p
		}
		return len(ids)
	}
	sort.SliceStable(volgorde, func(a, b int) bool { return sleutel(volgorde[a]) < sleutel(volgorde[b]) })
	for i, bron := range volgorde {
		sv.Index(i).Set(kopie.Index(bron))
	}
}
