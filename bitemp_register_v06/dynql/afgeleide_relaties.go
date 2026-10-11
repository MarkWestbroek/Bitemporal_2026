package dynql

// Afgeleide relaties in GraphQL (ontwerp: docs/plans/2026-10-11 Afgeleide relaties backend —
// ontwerp.md §5). Op het entiteittype staat per afgeleide relatie een veld
// `<rolnaam>: [AfgeleideVerwijzing!]` met { id, weergavenaam }. De full-resolvers rekenen ze
// per lijst in één keer uit (pakket afleiding, één batch per hop), en alleen als het veld in
// de query gevraagd is. Een entiteit die genest geladen wordt (bijv. via een forward-
// relatie) krijgt hier null: de doelobjecten zelf en geneste berekening kunnen later.

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/afleiding"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/ast"
)

var afgeleideVerwijzingType = graphql.NewObject(graphql.ObjectConfig{
	Name:        "AfgeleideVerwijzing",
	Description: "Eén voorkomen van een afgeleide relatie (alleen lezen): het doel en zijn weergavenaam.",
	Fields: graphql.Fields{
		"id":           &graphql.Field{Type: graphql.NewNonNull(graphql.Int), Description: "ID van de doelentiteit"},
		"weergavenaam": &graphql.Field{Type: graphql.String, Description: "Weergavenaam van de doelentiteit (null als die er geen heeft)"},
	},
})

// voegAfgeleideRelatieVeldenToe zet de velden van de afgeleide relaties op een entiteittype.
func voegAfgeleideRelatieVeldenToe(fields graphql.Fields, meta model.TypeMeta) {
	for _, ar := range meta.AfgeleideRelaties {
		fields[gqlSafeNaam(ar.JSONRolnaam)] = &graphql.Field{
			Type: graphql.NewList(graphql.NewNonNull(afgeleideVerwijzingType)),
			Description: fmt.Sprintf("Afgeleide relatie (alleen lezen) naar %s; afleidingsregel: %s. "+
				"Alleen berekend op het hoofdniveau van een full-query (anders null).", ar.DoelEntiteit, ar.Afleidingsregel),
		}
	}
}

// gevraagdeVelden geeft de namen in de selectieset van het huidige veld. alles=true als er
// fragmenten in staan (dan rekenen we voor de zekerheid alles uit).
func gevraagdeVelden(p graphql.ResolveParams) (namen map[string]bool, alles bool) {
	namen = map[string]bool{}
	for _, veld := range p.Info.FieldASTs {
		if veld.SelectionSet == nil {
			continue
		}
		for _, sel := range veld.SelectionSet.Selections {
			switch s := sel.(type) {
			case *ast.Field:
				namen[s.Name.Value] = true
			default:
				return namen, true
			}
		}
	}
	return namen, false
}

// voegAfgeleideRelatiesToe rekent de gevraagde afgeleide relaties uit voor de (platte)
// entiteit-maps van een full-query, op het formele peilmoment van die query. De maps zelf
// zijn op dat moment gelezen en worden als bron hergebruikt.
func voegAfgeleideRelatiesToe(ctx context.Context, p graphql.ResolveParams, maps []map[string]interface{}, meta model.TypeMeta, peil time.Time) {
	if len(meta.AfgeleideRelaties) == 0 || len(maps) == 0 {
		return
	}
	namen, alles := gevraagdeVelden(p)
	gevraagd := false
	for _, ar := range meta.AfgeleideRelaties {
		gevraagd = gevraagd || alles || namen[gqlSafeNaam(ar.JSONRolnaam)]
	}
	if !gevraagd {
		return
	}
	omg := afleiding.NieuweOmgeving(handlers.NieuweAfleidingLader(peil))
	var bronIDs []int
	for _, m := range maps {
		id, ok := m[meta.IDKolom].(float64)
		if !ok {
			continue
		}
		bronIDs = append(bronIDs, int(id))
		omg.VoegToe(meta.Typenaam, int(id), m)
	}
	uitkomst, err := omg.BerekenAfgeleideRelaties(ctx, meta, bronIDs)
	if err != nil {
		log.Printf("AFLEIDING (GraphQL): %s: afgeleide relaties niet berekend: %v", meta.Typenaam, err)
		return
	}
	for _, m := range maps {
		id, ok := m[meta.IDKolom].(float64)
		if !ok {
			continue
		}
		for _, ar := range meta.AfgeleideRelaties {
			items := []interface{}{}
			for _, v := range uitkomst[int(id)][ar.JSONRolnaam] {
				item := map[string]interface{}{"id": v.ID}
				if v.Weergavenaam != "" {
					item["weergavenaam"] = v.Weergavenaam
				}
				items = append(items, item)
			}
			m[gqlSafeNaam(ar.JSONRolnaam)] = items
		}
	}
}
