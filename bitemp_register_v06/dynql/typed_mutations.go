package dynql

// typed_mutations — per-ENT typed GraphQL mutations.
//
// FASE 3B-light (2026-04-30):
// Voor elk entiteit-type in de MetaRegistry registreren we drie mutations
// die de bestaande PATCH/DELETE-paden hergebruiken:
//
//   wijzig<Typenaam>(id, patch: JSON!) → JSON     // modus = registratie
//   corrigeer<Typenaam>(id, patch: JSON!) → JSON  // modus = correctie
//   voer<Typenaam>Af(id) → JSON                   // afvoer (DELETE-pad)
//
// `patch` is een JSON-merge-patch op onderliggende GE's/RELs van de ENT
// (zelfde body-format als REST `PATCH /full/{padnaam}/:id`). De body MAG
// met of zonder ENT-wrapper komen — `BouwWijzigingen` accepteert beide.
//
// Modus zit in de naam (wijzig vs corrigeer); er is geen extra `modus`-arg.
//
// De volle typed `<Type>OpvoerInput` (recursief uit OnderliggendeGegevenselementen,
// inclusief GE/REL-mutations met (entId, relId)) volgt in een aparte iteratie.

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

	fields["wijzig"+meta.Typenaam] = &graphql.Field{
		Type:        JSONScalar,
		Description: fmt.Sprintf("Wijzig %s door één of meer onderliggende GE's/RELs op te voeren (registratie-modus). `patch` is een JSON Merge Patch op de full-shape.", meta.Typenaam),
		Args: graphql.FieldConfigArgument{
			"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(idArg), Description: "ID van de " + meta.Typenaam},
			"patch": &graphql.ArgumentConfig{Type: graphql.NewNonNull(JSONScalar), Description: "JSON Merge Patch op onderliggende GE's/RELs"},
		},
		Resolve: makeWijzigResolver(meta, handlers.PatchModusRegistratie),
	}

	fields["corrigeer"+meta.Typenaam] = &graphql.Field{
		Type:        JSONScalar,
		Description: fmt.Sprintf("Corrigeer %s — vervangt bestaande versies van GE's/RELs (correctie-modus). Elk item in `patch` vereist `rel_id`.", meta.Typenaam),
		Args: graphql.FieldConfigArgument{
			"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(idArg), Description: "ID van de " + meta.Typenaam},
			"patch": &graphql.ArgumentConfig{Type: graphql.NewNonNull(JSONScalar), Description: "JSON Merge Patch met `rel_id` per item"},
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
