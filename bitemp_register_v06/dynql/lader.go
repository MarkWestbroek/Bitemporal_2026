package dynql

// lader.go — de naad tussen de GraphQL-resolvers en de opslag (façade fase 1, 18-11-2026;
// docs/plans/2026-11-18 Façade fase 1 — technisch ontwerp.md §3).
//
// Een leesresolver doet drie dingen: (1) laden: een gegenereerde struct vullen (meta.Factory /
// SliceFactory) met alle onderliggende GE's en relaties; (2) omzetten en platslaan
// (entityToMap, flattenEntityMap); (3) verrijken en snoeien (weergavenamen, afgeleide velden en
// relaties, het toegangsbeleid). Alleen stap 1 zit achter de Lader. Het gewone register gebruikt
// de dbLader (de bun-queries op hub + _Data, zoals altijd). De façade geeft per type een eigen
// lader die uit een Common Ground-register leest en dezelfde struct vult; stap 2 en 3 blijven
// zo voor beide gelijk.

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/pep"
	"github.com/uptrace/bun"
)

// Lader vult gegenereerde structs voor een type. Elke methode krijgt het formele peilmoment
// (actueel = nu). Een lader die iets niet kan (een filter, een tijdas), weigert met een fout en
// negeert het nooit stil.
type Lader interface {
	// LaadEen laadt één entiteit met alle onderliggende GE's en relaties (meta.Factory()).
	// Niet gevonden: een struct met nul-id, of een fout. De dbLader geeft hier, zoals altijd,
	// de fout van de database door (sql: no rows in result set).
	LaadEen(ctx context.Context, meta model.TypeMeta, id any, peil time.Time) (any, error)
	// LaadIDs laadt de entiteiten met deze id's, volledig (meta.SliceFactory()).
	LaadIDs(ctx context.Context, meta model.TypeMeta, ids []any, peil time.Time) (any, error)
	// LaadLijst laadt een pagina entiteiten (meta.SliceFactory()).
	LaadLijst(ctx context.Context, meta model.TypeMeta, v LijstVraag) (any, error)
	// BronIDs geeft de id's van de bron-entiteiten die via relatie rev naar doelID wijzen.
	BronIDs(ctx context.Context, rev ReverseRelationInfo, doelID any, limit int, peil time.Time) ([]any, error)
}

// LijstVraag is de vraag achter de lijstvelden (<padnaam> en full_<padnaam>_list).
type LijstVraag struct {
	// Filter is het ruwe filter-argument (<Typenaam>Filter), nil = geen filter.
	Filter any
	// Peil is het formele peilmoment (al bepaald: opgegeven of nu).
	Peil time.Time
	// Limit (1..100) en Offset; de resolver heeft ze al begrensd.
	Limit, Offset int
	// Volledig: met alle onderliggende GE's en relaties (full_<padnaam>_list).
	Volledig bool
	// Sortering: leeg = op id, oplopend. Wordt ingevuld door het sorteren op een GE-veld
	// (BACKEND, indexwerk stap 3); de dbLader sorteert tot dan altijd op id.
	Sortering []Sortering
}

// Sortering is één sorteersleutel in een lijstvraag.
type Sortering struct {
	// Veldpad is het pad van het veld (kolom van de entiteit, of GE.veld).
	Veldpad string
	// Aflopend: true = van hoog naar laag.
	Aflopend bool
}

// laders bevat per typenaam een eigen lader (gezet met ZetLaders). Een type dat er niet in
// staat, gebruikt de dbLader.
var laders = map[string]Lader{}

// ZetLaders geeft typen een eigen lader (de façade). Aanroepen vóór BuildSchema; een volgende
// aanroep vervangt de hele set. Typen zonder eigen lader houden de dbLader.
func ZetLaders(perType map[string]Lader) {
	laders = map[string]Lader{}
	for typenaam, l := range perType {
		if l != nil {
			laders[typenaam] = l
		}
	}
}

// peilOpgegevenSleutel markeert in de context dat de afnemer een formeel peiltijdstip opgaf
// (peiltijdstip of t). Zonder die markering is het peil "nu" (actueel). Een lader voor een
// register zonder formele tijd weigert alleen een opgegeven peil.
type peilOpgegevenSleutel struct{}

func metPeilOpgegeven(ctx context.Context, opgegeven bool) context.Context {
	if !opgegeven {
		return ctx
	}
	return context.WithValue(ctx, peilOpgegevenSleutel{}, true)
}

// laadFout pakt een laadfout in met de context van de resolver, behalve een NietOndersteund:
// die gaat onverpakt door, omdat graphql-go de extensions met een type-assertie leest.
func laadFout(err error, format string, a ...any) error {
	var nie NietOndersteund
	if errors.As(err, &nie) {
		return nie
	}
	return fmt.Errorf(format, a...)
}

// PeilOpgegeven zegt of de afnemer een formeel peiltijdstip opgaf.
func PeilOpgegeven(ctx context.Context) bool {
	v, _ := ctx.Value(peilOpgegevenSleutel{}).(bool)
	return v
}

// NietOndersteund is de fout van een lader die iets niet kan (een filter, een tijdas, een
// mutatie). In GraphQL staat de code in extensions (GraphQL kent geen 501); REST geeft 501.
type NietOndersteund struct {
	Reden string
}

func (f NietOndersteund) Error() string { return "niet ondersteund door het register: " + f.Reden }

// Extensions maakt de code zichtbaar in het GraphQL-antwoord (gqlerrors.ExtendedError).
func (f NietOndersteund) Extensions() map[string]interface{} {
	return map[string]interface{}{"code": "niet_ondersteund_door_register", "reden": f.Reden}
}

// laderVoor kiest de lader van een type.
func laderVoor(typenaam string) Lader {
	if l, ok := laders[typenaam]; ok && l != nil {
		return l
	}
	return dbLader{}
}

// heeftEigenLader zegt of een type niet uit de eigen database komt.
func heeftEigenLader(typenaam string) bool {
	_, ok := laders[typenaam]
	return ok
}

// dbLader is de lader van het gewone register: bun-queries op hub + _Data. De code is verhuisd
// uit de resolvers (query_resolvers.go) en verder ongewijzigd.
type dbLader struct{}

func (dbLader) LaadEen(ctx context.Context, meta model.TypeMeta, id any, peil time.Time) (any, error) {
	if db == nil {
		return nil, fmt.Errorf("database niet geïnitialiseerd")
	}
	if meta.Factory == nil {
		return nil, fmt.Errorf("Factory ontbreekt voor type %s", meta.Typenaam)
	}
	entity := meta.Factory()
	query := applyFormeleTijdFilter(db.NewSelect().Model(entity), meta.Typenaam, peil)
	query = addOnderliggendeRelations(query, meta, &peil)
	if err := query.Where(meta.IDKolom+" = ?", id).Scan(ctx); err != nil {
		return nil, err
	}
	if err := laadHubKinderenNaQuery(ctx, entity, meta, &peil); err != nil {
		return nil, fmt.Errorf("hub-kinderen laden mislukt: %v", err)
	}
	return entity, nil
}

func (dbLader) LaadIDs(ctx context.Context, meta model.TypeMeta, ids []any, peil time.Time) (any, error) {
	if db == nil {
		return nil, fmt.Errorf("database niet geïnitialiseerd")
	}
	if meta.SliceFactory == nil {
		return nil, fmt.Errorf("SliceFactory ontbreekt voor type %s", meta.Typenaam)
	}
	entities := meta.SliceFactory()
	query := applyFormeleTijdFilter(db.NewSelect().
		Model(entities).
		Where(meta.IDKolom+" IN (?)", bun.In(ids)), meta.Typenaam, peil)
	query = addOnderliggendeRelations(query, meta, &peil)
	if err := query.Scan(ctx); err != nil {
		return nil, err
	}
	if err := laadHubKinderenNaQuery(ctx, entities, meta, &peil); err != nil {
		return nil, fmt.Errorf("hub-kinderen laden mislukt: %v", err)
	}
	return entities, nil
}

func (dbLader) LaadLijst(ctx context.Context, meta model.TypeMeta, v LijstVraag) (any, error) {
	if db == nil {
		return nil, fmt.Errorf("database niet geïnitialiseerd")
	}
	if meta.SliceFactory == nil {
		return nil, fmt.Errorf("SliceFactory ontbreekt voor type %s", meta.Typenaam)
	}
	entities := meta.SliceFactory()
	moment := v.Peil
	query := applyFormeleTijdFilter(db.NewSelect().Model(entities), meta.Typenaam, moment)
	var mag func(string) bool
	if bundel := pep.Actief(); bundel != nil {
		mag = func(pad string) bool { return pep.MagPadCtx(ctx, bundel, pad) }
	}
	query, err := pasFilterToeMetToegang(query, meta, v.Filter, &moment, mag)
	if err != nil {
		return nil, err
	}
	if meta.IDKolom != "" {
		query = query.OrderExpr("?TableAlias.? ASC", bun.Ident(meta.IDKolom))
	}
	query = query.Limit(v.Limit).Offset(v.Offset)
	if v.Volledig {
		query = addOnderliggendeRelations(query, meta, &moment)
	}
	if err := query.Scan(ctx); err != nil {
		if v.Volledig {
			return nil, fmt.Errorf("full lijst query fout voor %s: %v", meta.Typenaam, err)
		}
		return nil, fmt.Errorf("lijst query fout voor %s: %v", meta.Typenaam, err)
	}
	if v.Volledig {
		if err := laadHubKinderenNaQuery(ctx, entities, meta, &moment); err != nil {
			return nil, fmt.Errorf("hub-kinderen laden mislukt: %v", err)
		}
	}
	return entities, nil
}

// BronIDs negeert het peil nog: de omgekeerde relatie leest, zoals altijd, de actuele stand
// (afvoer IS NULL). Dat is een bestaand gebrek (BACKEND, 18-11); de interface legt het niet vast.
func (dbLader) BronIDs(ctx context.Context, rev ReverseRelationInfo, doelID any, limit int, _ time.Time) ([]any, error) {
	if db == nil {
		return nil, fmt.Errorf("database niet geïnitialiseerd")
	}
	relMeta := rev.RelatieMeta
	var bronIDs []any
	err := db.NewRaw(
		fmt.Sprintf(
			"SELECT DISTINCT %s FROM %s WHERE %s = ? AND afvoer IS NULL LIMIT ?",
			rev.BronIDKolom, relMeta.Tabelnaam, rev.SecondaireIDKolom,
		),
		doelID, limit,
	).Scan(ctx, &bronIDs)
	if err != nil {
		return nil, fmt.Errorf("reverse relatie query (%s) fout: %v", relMeta.Typenaam, err)
	}
	return bronIDs, nil
}
