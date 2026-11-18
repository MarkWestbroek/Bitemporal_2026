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
//   - Na de opgegeven sleutels volgt altijd de id, oplopend. Zo is de volgorde bepaald en
//     blijft paginering met limit/offset stabiel.
//   - Zonder `sorteer`: op id, zoals altijd.
//
// Alles komt uit de MetaRegistry, via dezelfde filterDef als het filter; er staat geen
// typenaam in deze code. Een veld waarop het subject volgens het toegangsbeleid niet mag
// kijken, is ook geen sorteersleutel: de volgorde zou de waarde verraden.
//
// Prestatie: de sorteerwaarde is een gecorreleerde subquery per entiteit. PostgreSQL moet die
// voor alle entiteiten die aan het filter voldoen uitrekenen voordat het de eerste pagina kan
// geven; een index op de waardekolom versnelt dat niet. Zie docs/INDEXEN.md, stap 3.

import (
	"fmt"
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
		query = query.OrderExpr("?TableAlias.? ASC", bun.Ident(meta.IDKolom))
	}
	return query, nil
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
