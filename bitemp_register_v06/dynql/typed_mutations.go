package dynql

// typed_mutations — per-ENT typed GraphQL mutations.
//
// FASE 3B-full (2026-05-xx):
// Voor elk entiteit-type in de MetaRegistry registreren we drie mutations
// die de bestaande PATCH/DELETE-paden hergebruiken:
//
//   wijzig<Typenaam>(id, patch: <Typenaam>PatchInput!) → JSON     // modus = registratie
//   corrigeer<Typenaam>(id, patch: <Typenaam>PatchInput!) → JSON  // modus = correctie
//   voer<Typenaam>Af(id) → JSON                                   // afvoer (DELETE-pad)
//
// `patch` is een volledig getypeerde InputObject (gebouwd door input_type_builder.go).
// De structuur volgt de OnderliggendeGegevenselementen van de ENT:
//
//   <Typenaam>PatchInput {
//     <rolnaam>: [<GETypenaam>Input]   // één veld per GE/REL hub
//   }
//
// graphql-go deserialiseert InputObject-waarden naar map[string]interface{}.
// json.Marshal(patch) in de resolver produceert daarna dezelfde JSON als
// bij het vrije JSON scalar — geen resolver-wijzigingen nodig.
//
// Fallback: als het PatchInput type niet (nog) beschikbaar is (bijv. ENT
// zonder OnderliggendeGegevenselementen), wordt JSONScalar gebruikt.
//
// Modus zit in de naam (wijzig vs corrigeer); er is geen extra `modus`-arg.

import (
	"encoding/json"
	"fmt"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
)

// AddTypedMutationsForEntiteit voegt wijzig/corrigeer/voer<X>Af-mutations toe aan `fields`.
// Geen-op voor niet-ENT, ontbrekende factory of ontbrekende padnaam.
func AddTypedMutationsForEntiteit(fields graphql.Fields, meta model.TypeMeta) {
	if meta.Metatype != model.MetatypeEntiteit {
		return
	}
	if meta.Factory == nil || meta.IDKolom == "" {
		return
	}

	idArg := inferIDArgType(meta)
	patchType := getPatchInputType(meta.Typenaam)

	fields["wijzig"+meta.Typenaam] = &graphql.Field{
		Type:        JSONScalar,
		Description: fmt.Sprintf("Wijzig %s door één of meer onderliggende GE's/RELs op te voeren (registratie-modus). `patch` is een getypeerde %sPatchInput.", meta.Typenaam, meta.Typenaam),
		Args: graphql.FieldConfigArgument{
			"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(idArg), Description: "ID van de " + meta.Typenaam},
			"patch": &graphql.ArgumentConfig{Type: graphql.NewNonNull(patchType), Description: "Getypeerde patch op onderliggende GE's/RELs"},
		},
		Resolve: makeWijzigResolver(meta, handlers.PatchModusRegistratie),
	}

	fields["corrigeer"+meta.Typenaam] = &graphql.Field{
		Type:        JSONScalar,
		Description: fmt.Sprintf("Corrigeer %s — vervangt bestaande versies van GE's/RELs (correctie-modus). Elk item in `patch` vereist `rel_id`.", meta.Typenaam),
		Args: graphql.FieldConfigArgument{
			"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(idArg), Description: "ID van de " + meta.Typenaam},
			"patch": &graphql.ArgumentConfig{Type: graphql.NewNonNull(patchType), Description: "Getypeerde patch met `rel_id` per item"},
		},
		Resolve: makeWijzigResolver(meta, handlers.PatchModusCorrectie),
	}

	fields["voer"+meta.Typenaam+"Af"] = &graphql.Field{
		Type:        JSONScalar,
		Description: fmt.Sprintf("Voer een %s af (formele afvoer, audit-trail intact).", meta.Typenaam),
		Args: graphql.FieldConfigArgument{
			"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(idArg), Description: "ID van de " + meta.Typenaam},
		},
		Resolve: makeVoerAfResolver(meta),
	}
}

func makeWijzigResolver(meta model.TypeMeta, modus handlers.PatchModus) graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		id := fmt.Sprintf("%v", p.Args["id"])
		patch, ok := p.Args["patch"]
		if !ok || patch == nil {
			return nil, fmt.Errorf("patch argument is verplicht")
		}
		body, err := json.Marshal(patch)
		if err != nil {
			return nil, fmt.Errorf("patch serialisatie mislukt: %v", err)
		}
		ctx := contextFromResolve(p)
		audit := handlers.AuditMeta{
			RawBody:       body,
			RequestPath:   "/graphql",
			RequestMethod: "POST",
			EntiteitID:    id,
		}
		res, meldingen, rerr := handlers.WijzigEntiteitCore(ctx, meta, id, body, modus, audit)
		if rerr != nil {
			return nil, fmt.Errorf("%s mislukt (status %d): %s", modus, rerr.Status, rerr.Msg)
		}
		return map[string]interface{}{
			"message":        res.Message,
			"registratie_id": res.RegistratieID,
			"tijdstip":       res.Tijdstip,
			"modus":          string(modus),
			"meldingen":      meldingen,
		}, nil
	}
}

func makeVoerAfResolver(meta model.TypeMeta) graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		id := fmt.Sprintf("%v", p.Args["id"])
		ctx := contextFromResolve(p)
		audit := handlers.AuditMeta{
			RequestPath:   "/graphql",
			RequestMethod: "POST",
			EntiteitID:    id,
		}
		res, rerr := handlers.VoerEntiteitAfCore(ctx, meta, id, audit)
		if rerr != nil {
			return nil, fmt.Errorf("afvoer mislukt (status %d): %s", rerr.Status, rerr.Msg)
		}
		return map[string]interface{}{
			"message":        res.Message,
			"registratie_id": res.RegistratieID,
			"tijdstip":       res.Tijdstip,
		}, nil
	}
}
