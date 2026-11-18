package dynql

// selectie.go — alleen laden wat de query vraagt, en omgekeerde relaties per lijst in één keer
// (zoekprestaties, akkoord Mark 18-11-2026; meting en uitleg in docs/INDEXEN.md §Lezen).
//
// Aanleiding: de meting met het zaakmodel. Een full-query laadde altijd alle onderliggende
// gegevenselementen en relaties van een entiteit (voor Zaak: 14 groepen, ongeveer 25 tot 30
// SQL-vragen), ook als de query er vijf selecteerde. En `gerelateerde_<bron>` werd per ouder
// opgelost: bij vijftig ouders vijftig keer de hele keten.
//
// 1. Groepen op selectie. De resolver leest de selectieset van zijn veld en geeft de dbLader
//    via de context mee welke groepen (JSON-rolnamen) nodig zijn. De Lader-interface blijft
//    zoals hij is: een lader die de aanwijzing niet kent (de façade) laadt gewoon alles.
//    Er wordt alles geladen zodra iets gevraagd is dat uit andere groepen berekend wordt
//    (een afgeleid veld, een afgeleide relatie, een extra veld), zodra er een toegangsbeleid
//    actief is (een regel kan van elk veld afhangen) en bij materieel tijdreizen.
//
// 2. Omgekeerde relaties gebundeld. Een lijst-resolver hangt aan elke rij dezelfde
//    *lijstBundel met de id's van alle rijen. De eerste rij die `gerelateerde_<bron>` oplost,
//    doet dat voor alle rijen: één vraag voor de (doel, bron)-paren, één lading van de bronnen.
//    De volgende rijen lezen de uitkomst uit de bundel.

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/pep"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/ast"
	"github.com/uptrace/bun/dialect/pgdialect"
)

// klassiekLaden zet beide uit: elke full-query laadt weer alle groepen en elke ouder lost zijn
// eigen omgekeerde relatie op (het gedrag tot en met api 0.29.0). Bedoeld als noodrem
// (omgevingsvariabele GRAPHQL_KLASSIEK_LADEN=1) en voor de test die beide wegen vergelijkt.
var klassiekLaden = os.Getenv("GRAPHQL_KLASSIEK_LADEN") == "1"

// ZetKlassiekLaden schakelt het laden op selectie en het bundelen uit (true) of aan (false).
func ZetKlassiekLaden(aan bool) { klassiekLaden = aan }

// ─── 1. Groepen op selectie ──────────────────────────────────────────────────

type groepenSleutel struct{}

type groepKeuze struct {
	typenaam string
	groepen  map[string]bool
}

// metGroepen legt in de context vast welke groepen van dit type geladen moeten worden.
// groepen == nil: alles (de context blijft ongewijzigd).
func metGroepen(ctx context.Context, typenaam string, groepen map[string]bool) context.Context {
	if groepen == nil {
		return ctx
	}
	return context.WithValue(ctx, groepenSleutel{}, groepKeuze{typenaam: typenaam, groepen: groepen})
}

// groepKiezer geeft voor de dbLader de keuze per onderliggend element; nil = alles laden.
// De keuze geldt alleen voor het type waarvoor hij gezet is.
func groepKiezer(ctx context.Context, meta model.TypeMeta) func(model.OnderliggendGegevenselement) bool {
	keuze, ok := ctx.Value(groepenSleutel{}).(groepKeuze)
	if !ok || keuze.typenaam != meta.Typenaam || keuze.groepen == nil {
		return nil
	}
	return func(rel model.OnderliggendGegevenselement) bool { return keuze.groepen[rel.JSONRolnaam] }
}

// geselecteerdeNamen geeft de veldnamen in de selectieset van het huidige veld, met de
// fragmenten uitgeschreven. ok=false: de selectie is niet te bepalen (dan alles laden).
func geselecteerdeNamen(p graphql.ResolveParams) (map[string]bool, bool) {
	namen := map[string]bool{}
	var loop func(set *ast.SelectionSet, diepte int) bool
	loop = func(set *ast.SelectionSet, diepte int) bool {
		if set == nil {
			return true
		}
		if diepte > 20 {
			return false
		}
		for _, sel := range set.Selections {
			switch s := sel.(type) {
			case *ast.Field:
				if s.Name == nil {
					return false
				}
				namen[s.Name.Value] = true
			case *ast.InlineFragment:
				if !loop(s.SelectionSet, diepte+1) {
					return false
				}
			case *ast.FragmentSpread:
				if s.Name == nil {
					return false
				}
				def, ok := p.Info.Fragments[s.Name.Value].(*ast.FragmentDefinition)
				if !ok || !loop(def.SelectionSet, diepte+1) {
					return false
				}
			default:
				return false
			}
		}
		return true
	}
	if len(p.Info.FieldASTs) == 0 {
		return nil, false
	}
	for _, veld := range p.Info.FieldASTs {
		if veld == nil || !loop(veld.SelectionSet, 0) {
			return nil, false
		}
	}
	return namen, true
}

// groepenUitSelectie bepaalt welke groepen van meta de query nodig heeft. nil = alles laden.
func groepenUitSelectie(p graphql.ResolveParams, meta model.TypeMeta) map[string]bool {
	if klassiekLaden || pep.Actief() != nil {
		return nil // een beleidsregel kan van elk veld afhangen
	}
	namen, ok := geselecteerdeNamen(p)
	if !ok || len(namen) == 0 {
		return nil
	}
	// Velden die uit andere groepen berekend worden: dan alles.
	for _, av := range meta.AfgeleideVelden {
		if namen[gqlSafeNaam(av.Naam)] {
			return nil
		}
	}
	for _, ar := range meta.AfgeleideRelaties {
		if namen[gqlSafeNaam(ar.JSONRolnaam)] || namen[doelenVeldnaam(ar)] {
			return nil
		}
	}
	for naam := range extraVelden[meta.Typenaam] {
		if namen[naam] {
			return nil
		}
	}
	groepen := map[string]bool{}
	for _, child := range meta.OnderliggendeGegevenselementen {
		if namen[child.JSONRolnaam] {
			groepen[child.JSONRolnaam] = true
		}
	}
	return groepen
}

// ─── 2. Omgekeerde relaties gebundeld ────────────────────────────────────────

// bundelSleutel is de verborgen sleutel waaronder de bundel aan een rij hangt. Het is geen
// veld van het schema en komt dus nooit in een antwoord.
const bundelSleutel = "__bundel"

// lijstBundel hoort bij één lijst rijen in één verzoek.
type lijstBundel struct {
	ids []any // de id's van alle rijen van de lijst

	mu        sync.Mutex
	omgekeerd map[string]omgekeerdeUitkomst
}

type omgekeerdeUitkomst struct {
	perDoel map[string][]map[string]interface{}
	err     error
}

// zetBundel hangt één bundel aan alle rijen van een lijst (alleen bij meer dan één rij).
func zetBundel(maps []map[string]interface{}) {
	if len(maps) < 2 || klassiekLaden {
		return
	}
	b := &lijstBundel{omgekeerd: map[string]omgekeerdeUitkomst{}}
	for _, m := range maps {
		if id, ok := m["id"]; ok && id != nil {
			b.ids = append(b.ids, id)
		}
	}
	for _, m := range maps {
		m[bundelSleutel] = b
	}
}

// idSleutel maakt van een id (int, of float64 na de JSON-omzetting) één vergelijkbare sleutel.
func idSleutel(v any) string {
	switch x := v.(type) {
	case float64:
		return strconv.FormatInt(int64(x), 10)
	case int:
		return strconv.Itoa(x)
	case int64:
		return strconv.FormatInt(x, 10)
	case int32:
		return strconv.FormatInt(int64(x), 10)
	}
	return fmt.Sprint(v)
}

// alsInt64 zet een id om naar int64; ok=false als het geen geheel getal is.
func alsInt64(v any) (int64, bool) {
	switch x := v.(type) {
	case float64:
		if x != float64(int64(x)) {
			return 0, false
		}
		return int64(x), true
	case int:
		return int64(x), true
	case int64:
		return x, true
	case int32:
		return int64(x), true
	}
	return 0, false
}

// bronPaar: bron-entiteit `Bron` wijst via de relatie naar doel `Doel`.
type bronPaar struct {
	Doel int64 `bun:"doel"`
	Bron int64 `bun:"bron"`
}

// bronIDsBundelaar is een lader die de bron-id's voor meerdere doelen in één vraag kan geven.
// Optioneel naast Lader: een lader zonder deze methode wordt per doel gevraagd.
type bronIDsBundelaar interface {
	BronIDsBundel(ctx context.Context, rev ReverseRelationInfo, doelIDs []int64, limit int, peil time.Time) ([]bronPaar, error)
}

// BronIDsBundel: per doel hooguit `limit` bron-id's, oplopend, in één vraag. De LATERAL-vorm
// houdt de grens per doel en gebruikt de doel-index (doel_id, bron_id) per doel. Het peil
// wordt, net als in BronIDs, nog niet gebruikt (actuele stand).
func (dbLader) BronIDsBundel(ctx context.Context, rev ReverseRelationInfo, doelIDs []int64, limit int, _ time.Time) ([]bronPaar, error) {
	if db == nil {
		return nil, fmt.Errorf("database niet geïnitialiseerd")
	}
	relMeta := rev.RelatieMeta
	var paren []bronPaar
	err := db.NewRaw(
		fmt.Sprintf(
			"SELECT d.doel AS doel, b.bron AS bron FROM unnest(?::bigint[]) AS d(doel) "+
				"CROSS JOIN LATERAL (SELECT DISTINCT r.%s AS bron FROM %s AS r "+
				"WHERE r.%s = d.doel AND r.afvoer IS NULL ORDER BY 1 LIMIT ?) AS b "+
				"ORDER BY d.doel, b.bron",
			rev.BronIDKolom, relMeta.Tabelnaam, rev.SecondaireIDKolom,
		),
		pgdialect.Array(doelIDs), limit,
	).Scan(ctx, &paren)
	if err != nil {
		return nil, fmt.Errorf("reverse relatie query (%s) fout: %v", relMeta.Typenaam, err)
	}
	return paren, nil
}

// laadOmgekeerd lost `gerelateerde_<bron>` op voor een of meer doelen: de paren, de bronnen
// (alleen de gevraagde groepen), platslaan, weergavenamen en het toegangsbeleid. De uitkomst
// is per doel (idSleutel) de lijst bron-rijen, oplopend op bron-id.
func laadOmgekeerd(ctx context.Context, rev ReverseRelationInfo, doelIDs []any, limit int, groepen map[string]bool) (map[string][]map[string]interface{}, error) {
	bronMeta := rev.BronEntiteitMeta
	lader := laderVoor(bronMeta.Typenaam)
	nu := actueelOfPeil(nil)
	uit := map[string][]map[string]interface{}{}

	// Stap 1: de (doel, bron)-paren. Zoals altijd de actuele stand.
	type paar struct {
		doel string
		bron any
	}
	var paren []paar
	gebundeld := false
	if bundelaar, ok := lader.(bronIDsBundelaar); ok && len(doelIDs) > 1 {
		ints := make([]int64, 0, len(doelIDs))
		alleGeheel := true
		for _, id := range doelIDs {
			n, ok := alsInt64(id)
			if !ok {
				alleGeheel = false
				break
			}
			ints = append(ints, n)
		}
		if alleGeheel {
			rijen, err := bundelaar.BronIDsBundel(ctx, rev, ints, limit, nu)
			if err != nil {
				return nil, err
			}
			for _, r := range rijen {
				paren = append(paren, paar{doel: idSleutel(r.Doel), bron: r.Bron})
			}
			gebundeld = true
		}
	}
	if !gebundeld {
		for _, doelID := range doelIDs {
			bronIDs, err := lader.BronIDs(ctx, rev, doelID, limit, nu)
			if err != nil {
				return nil, err
			}
			for _, b := range bronIDs {
				paren = append(paren, paar{doel: idSleutel(doelID), bron: b})
			}
		}
	}
	if len(paren) == 0 {
		return uit, nil
	}

	// Stap 2: de bron-entiteiten, elk één keer.
	if bronMeta.SliceFactory == nil {
		return nil, nil
	}
	gezien := map[string]bool{}
	var uniek []any
	for _, p := range paren {
		if k := idSleutel(p.bron); !gezien[k] {
			gezien[k] = true
			uniek = append(uniek, p.bron)
		}
	}
	entities, err := lader.LaadIDs(metGroepen(ctx, bronMeta.Typenaam, groepen), bronMeta, uniek, nu)
	if err != nil {
		return nil, fmt.Errorf("reverse bron-entiteiten laden (%s) fout: %v", bronMeta.Typenaam, err)
	}
	results, err := sliceToMaps(entities, bronMeta)
	if err != nil {
		return nil, err
	}
	for i, m := range results {
		flat := flattenEntityMap(m, bronMeta)
		verrijkWeergavenamen(ctx, flat, bronMeta)
		results[i] = flat
	}
	// Toegangsbeleid (fase 1b): als laatste, met het type van de bron-entiteiten.
	if bundel := pep.Actief(); bundel != nil {
		gefilterd, magType := pep.FilterMapsCtx(ctx, bundel, bronMeta, results)
		if !magType {
			return uit, nil // het subject mag van dat type niets zien
		}
		results = gefilterd
	}
	perBron := map[string]map[string]interface{}{}
	for _, m := range results {
		perBron[idSleutel(m[bronMeta.JSONID()])] = m
	}
	// De bronnen zijn zelf weer een lijst: een geneste gerelateerde_… bundelt over alle ouders.
	zetBundel(results)

	// Stap 3: verdelen over de doelen, in de volgorde van de paren.
	for _, p := range paren {
		if m, ok := perBron[idSleutel(p.bron)]; ok {
			uit[p.doel] = append(uit[p.doel], m)
		}
	}
	return uit, nil
}

// omgekeerdVoor geeft de bronnen van één doel. Hangt het doel in een lijst (bundel), dan wordt
// de vraag bij de eerste rij voor alle rijen gesteld en daarna uit de bundel gelezen.
func omgekeerdVoor(p graphql.ResolveParams, rev ReverseRelationInfo, source map[string]interface{}, doelID any, limit int) ([]map[string]interface{}, error) {
	groepen := groepenUitSelectie(p, rev.BronEntiteitMeta)
	leeg := []map[string]interface{}{}

	b, _ := source[bundelSleutel].(*lijstBundel)
	if b == nil || len(b.ids) < 2 || len(p.Info.FieldASTs) == 0 {
		perDoel, err := laadOmgekeerd(p.Context, rev, []any{doelID}, limit, groepen)
		if err != nil {
			return nil, err
		}
		if perDoel == nil {
			return nil, nil
		}
		if rijen := perDoel[idSleutel(doelID)]; rijen != nil {
			return rijen, nil
		}
		return leeg, nil
	}

	// Eén uitkomst per veld in de query (het AST-knooppunt is voor alle rijen hetzelfde; twee
	// aliassen van hetzelfde veld met een andere selectie of limit krijgen elk hun eigen lading).
	sleutel := fmt.Sprintf("%s|%s|%d|%p", rev.GQLVeldnaam, rev.RelatieMeta.Typenaam, limit, p.Info.FieldASTs[0])
	b.mu.Lock()
	defer b.mu.Unlock()
	u, ok := b.omgekeerd[sleutel]
	if !ok {
		perDoel, err := laadOmgekeerd(p.Context, rev, b.ids, limit, groepen)
		u = omgekeerdeUitkomst{perDoel: perDoel, err: err}
		b.omgekeerd[sleutel] = u
	}
	if u.err != nil {
		return nil, u.err
	}
	if u.perDoel == nil {
		return nil, nil
	}
	if rijen := u.perDoel[idSleutel(doelID)]; rijen != nil {
		return rijen, nil
	}
	return leeg, nil
}
