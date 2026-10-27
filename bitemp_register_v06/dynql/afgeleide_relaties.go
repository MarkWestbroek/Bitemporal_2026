package dynql

// Afgeleide relaties in GraphQL (ontwerp: docs/plans/2026-10-11 Afgeleide relaties backend —
// ontwerp.md §5 en §8). Op het entiteittype staan per afgeleide relatie twee velden:
//   - `<rolnaam>: [AfgeleideVerwijzing!]` met { id, weergavenaam };
//   - `<rolnaam>_doelen: [<Doeltype>]` met de volledige doelobjecten (zelfde platte vorm als
//     full_<padnaam>, op hetzelfde peilmoment).
// De full-resolvers rekenen ze per lijst in één keer uit (pakket afleiding, één batch per hop),
// en alleen als een van de velden in de query gevraagd is. Een entiteit die genest geladen
// wordt (bijv. via een forward-relatie of als doelobject) krijgt hier null.

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
		if doelType := resolveEntityGraphQLType(ar.DoelEntiteit); doelType != nil {
			fields[doelenVeldnaam(ar)] = &graphql.Field{
				Type: graphql.NewList(doelType),
				Description: fmt.Sprintf("De %s-objecten van de afgeleide relatie %s, op hetzelfde peilmoment "+
					"(zoals full_…). Alleen berekend op het hoofdniveau van een full-query (anders null); "+
					"afgeleide relaties van het doelobject zelf zijn null.", ar.DoelEntiteit, ar.Naam),
			}
		}
	}
}

// doelenVeldnaam is het GraphQL-veld met de volledige doelobjecten van een afgeleide relatie.
func doelenVeldnaam(ar model.AfgeleideRelatie) string {
	return gqlSafeNaam(ar.JSONRolnaam) + "_doelen"
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
		gevraagd = gevraagd || alles || namen[gqlSafeNaam(ar.JSONRolnaam)] || namen[doelenVeldnaam(ar)]
	}
	if !gevraagd {
		return
	}
	omg := afleiding.NieuweOmgeving(handlers.NieuweAfleidingLader(peil))
	var bronIDs []int
	for _, m := range maps {
		id, ok := m[meta.JSONID()].(float64)
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
	// Volledige doelobjecten (alleen als <rol>_doelen gevraagd is): per doeltype één volledige
	// lading op hetzelfde peilmoment, één keer plat geslagen per (type, id). De omgeving laadt
	// lui en heeft de doelen dus niet volledig.
	perType := map[string][]int{}
	for _, ar := range meta.AfgeleideRelaties {
		if !alles && !namen[doelenVeldnaam(ar)] {
			continue
		}
		for _, perRol := range uitkomst {
			for _, v := range perRol[ar.JSONRolnaam] {
				perType[ar.DoelEntiteit] = append(perType[ar.DoelEntiteit], v.ID)
			}
		}
	}
	plat := map[string]map[int]map[string]interface{}{}
	for typenaam, ids := range perType {
		doelMeta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
		if !ok {
			continue
		}
		ruw, err := handlers.LaadVolledigeEntiteiten(ctx, peil, typenaam, ids)
		if err != nil {
			log.Printf("AFLEIDING (GraphQL): doelobjecten %s niet geladen: %v", typenaam, err)
			continue
		}
		plat[typenaam] = map[int]map[string]interface{}{}
		for id, m := range ruw {
			obj := flattenEntityMap(m, doelMeta)
			verrijkWeergavenamen(ctx, obj, doelMeta)
			verrijkEigenAfgeleideVelden(obj, doelMeta)
			plat[typenaam][id] = obj
		}
	}
	doelObject := func(typenaam string, id int) map[string]interface{} {
		return plat[typenaam][id]
	}

	for _, m := range maps {
		id, ok := m[meta.JSONID()].(float64)
		if !ok {
			continue
		}
		for _, ar := range meta.AfgeleideRelaties {
			items := []interface{}{}
			doelen := []interface{}{}
			for _, v := range uitkomst[int(id)][ar.JSONRolnaam] {
				item := map[string]interface{}{"id": v.ID}
				if v.Weergavenaam != "" {
					item["weergavenaam"] = v.Weergavenaam
				}
				items = append(items, item)
				if alles || namen[doelenVeldnaam(ar)] {
					if obj := doelObject(ar.DoelEntiteit, v.ID); obj != nil {
						doelen = append(doelen, obj)
					}
				}
			}
			m[gqlSafeNaam(ar.JSONRolnaam)] = items
			if alles || namen[doelenVeldnaam(ar)] {
				m[doelenVeldnaam(ar)] = doelen
			}
		}
	}
}
