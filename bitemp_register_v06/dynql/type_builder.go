package dynql

// type_builder bouwt graphql.Object types vanuit de MetaRegistry.
// Elk TypeMeta record (entiteit, GE-hub, GE-data, relatie) krijgt een eigen GraphQL type.
// Voor entiteiten worden onderliggende GE's/relaties als geneste velden toegevoegd.
// Hub+data flattening: hub-types tonen ook de velden van hun _Data child.
// Reverse relaties: als een relatie A→B bestaat, krijgt B automatisch een
// "gerelateerde_<bron-padnaam>" veld dat de bron-entiteiten ophaalt.

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
)

// typeCache voorkomt dubbelaanmaak en cycli.
var typeCache = map[string]*graphql.Object{}

// ReverseRelationInfo beschrijft een omgekeerde relatie: vanuit doelentiteit B
// terugkijkend naar bronentiteit A via een tussenliggende relatie.
type ReverseRelationInfo struct {
	// BronEntiteitTypenaam is de typenaam van de bron-entiteit (bijv. "A")
	BronEntiteitTypenaam string
	// BronEntiteitMeta is de TypeMeta van de bron-entiteit
	BronEntiteitMeta model.TypeMeta
	// RelatieMeta is de TypeMeta van de tussenliggende relatie (bijv. "Rel_A_B")
	RelatieMeta model.TypeMeta
	// SecondaireIDKolom is de FK-kolom in de relatie die naar de doel-entiteit wijst (bijv. "b_id")
	SecondaireIDKolom string
	// BronIDKolom is de FK-kolom in de relatie die naar de bron-entiteit wijst (bijv. "a_id")
	BronIDKolom string
	// Veldnaam voor het GraphQL veld (bijv. "gerelateerde_as")
	GQLVeldnaam string
}

// reverseRelationMap wordt eenmalig opgebouwd bij startup.
// Key = doelentiteit typenaam (bijv. "B"), Value = alle reverse relaties die naar die entiteit wijzen.
var reverseRelationMap map[string][]ReverseRelationInfo

// ForwardRelationInfo beschrijft een forward FK-relatie: vanuit een relatie-hub
// naar de doel-entiteit via SecondaireEntiteitIDKolom.
// Voorbeeld: InitiatiefGemeente → Gemeente via gemeente_id.
type ForwardRelationInfo struct {
	// DoelEntiteitTypenaam is de typenaam van de doel-entiteit (bijv. "Gemeente")
	DoelEntiteitTypenaam string
	// DoelEntiteitMeta is de TypeMeta van de doel-entiteit
	DoelEntiteitMeta model.TypeMeta
	// FKKolom is de FK-kolom in de bron-struct (bijv. "gemeente_id")
	FKKolom string
	// GQLVeldnaam is de veldnaam in het GraphQL type (bijv. "gemeente")
	GQLVeldnaam string
}

// forwardRelationMap wordt eenmalig opgebouwd bij startup.
// Key = bron-typenaam (bijv. "InitiatiefGemeente"), Value = forward relaties.
var forwardRelationMap map[string][]ForwardRelationInfo

// buildReverseRelationMap scant de MetaRegistry en bouwt de reverse-relatie-index op.
// Wordt aangeroepen vanuit BuildOutputTypes.
func buildReverseRelationMap() {
	reverseRelationMap = map[string][]ReverseRelationInfo{}

	// Stap 1: vind alle relatie-hubs met een SecondaireEntiteitIDKolom
	// en bepaal welke bron-entiteit ze bezitten (via OnderliggendeGegevenselementen)
	for bronTypenaam, bronMeta := range model.MetaRegistry {
		if bronMeta.Metatype != model.MetatypeEntiteit {
			continue
		}
		for _, child := range bronMeta.OnderliggendeGegevenselementen {
			relMeta, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype)
			if !ok || relMeta.Metatype != model.MetatypeRelatie {
				continue
			}
			if relMeta.SecondaireEntiteitIDKolom == "" {
				continue
			}

			// Zoek de doel-entiteit: welke entiteit heeft IDKolom == SecondaireEntiteitIDKolom?
			doelTypenaam := vindDoelEntiteit(relMeta.SecondaireEntiteitIDKolom)
			if doelTypenaam == "" {
				continue
			}

			// Bepaal veldnaam: "gerelateerde_" + padnaam van de bron-entiteit
			bronPadnaam := bronMeta.Padnaam
			if bronPadnaam == "" {
				bronPadnaam = bronMeta.Veldnaam
			}
			gqlVeldnaam := "gerelateerde_" + bronPadnaam

			reverseRelationMap[doelTypenaam] = append(reverseRelationMap[doelTypenaam], ReverseRelationInfo{
				BronEntiteitTypenaam: bronTypenaam,
				BronEntiteitMeta:     bronMeta,
				RelatieMeta:          relMeta,
				SecondaireIDKolom:    relMeta.SecondaireEntiteitIDKolom,
				BronIDKolom:          relMeta.EntiteitIDKolom,
				GQLVeldnaam:          gqlVeldnaam,
			})
		}
	}
}

// vindDoelEntiteit zoekt welke entiteit een IDKolom heeft die overeenkomt met
// de SecondaireEntiteitIDKolom van een relatie (bijv. "b_id" → entiteit B met IDKolom "id"
// en EntiteitIDKolom-patroon "b_id").
func vindDoelEntiteit(secIDKolom string) string {
	// Conventie: secIDKolom is bijv. "b_id", "gemeente_id", "locatie_id"
	// De doelentiteit is degene waar secIDKolom == <veldnaam>_id of
	// secIDKolom in de structuur voorkomt.
	for typenaam, meta := range model.MetaRegistry {
		if meta.Metatype != model.MetatypeEntiteit {
			continue
		}
		// Match: secIDKolom moet gelijk zijn aan <veldnaam>_id
		expected := meta.Veldnaam + "_id"
		if secIDKolom == expected {
			return typenaam
		}
	}
	return ""
}

// buildForwardRelationMap scant de MetaRegistry en bouwt de forward-relatie-index op.
// Voor elk type met SecondaireEntiteitIDKolom wordt de doel-entiteit bepaald.
// Wordt aangeroepen vanuit BuildOutputTypes.
func buildForwardRelationMap() {
	forwardRelationMap = map[string][]ForwardRelationInfo{}

	for typenaam, meta := range model.MetaRegistry {
		if meta.SecondaireEntiteitIDKolom == "" {
			continue
		}

		doelTypenaam := vindDoelEntiteit(meta.SecondaireEntiteitIDKolom)
		if doelTypenaam == "" {
			continue
		}
		doelMeta, ok := model.MetaRegistry.GetTypeMeta(doelTypenaam)
		if !ok {
			continue
		}

		// Veldnaam = veldnaam van de doel-entiteit (bijv. "gemeente")
		gqlVeldnaam := doelMeta.Veldnaam
		if gqlVeldnaam == "" {
			continue
		}

		forwardRelationMap[typenaam] = append(forwardRelationMap[typenaam], ForwardRelationInfo{
			DoelEntiteitTypenaam: doelTypenaam,
			DoelEntiteitMeta:     doelMeta,
			FKKolom:              meta.SecondaireEntiteitIDKolom,
			GQLVeldnaam:          gqlVeldnaam,
		})
	}
}

// BuildOutputTypes bouwt alle GraphQL output types uit de MetaRegistry.
// Moet bij startup worden aangeroepen vóór BuildSchema.
func BuildOutputTypes() map[string]*graphql.Object {
	// Bouw de reverse-relatie-index (eenmalig)
	buildReverseRelationMap()

	// Bouw de forward-relatie-index (eenmalig)
	buildForwardRelationMap()

	types := map[string]*graphql.Object{}

	// Eerste pass: maak alle basistypes aan (zonder relaties/kinderen).
	// We gebruiken Thunk-velden om forward references op te lossen.
	for typenaam, meta := range model.MetaRegistry {
		if meta.Factory == nil {
			continue
		}
		obj := buildObjectType(typenaam, meta)
		types[typenaam] = obj
		typeCache[typenaam] = obj
	}

	return types
}

func buildObjectType(typenaam string, meta model.TypeMeta) *graphql.Object {
	return graphql.NewObject(graphql.ObjectConfig{
		Name:        sanitizeTypeName(typenaam),
		Description: meta.Description,
		Fields: graphql.FieldsThunk(func() graphql.Fields {
			fields := fieldsVoorMeta(meta)

			// Voeg opvoer/afvoer toe voor formele representaties
			fieldsVoorFormeleRepresentatie(fields)

			// Hub-type: flatten _Data velden in het hubtype
			if meta.GESubtype == model.GESubtypeHub && meta.DataTypenaam != "" {
				dataMeta, ok := model.MetaRegistry.GetTypeMeta(meta.DataTypenaam)
				if ok {
					dataFields := fieldsVoorMeta(dataMeta)
					for k, v := range dataFields {
						if _, exists := fields[k]; !exists {
							fields[k] = v
						}
					}
				}
			}

			// Onderliggende GE's/relaties als geneste velden
			for _, child := range meta.OnderliggendeGegevenselementen {
				childType := resolveChildGraphQLType(child)
				if childType == nil {
					continue
				}

				var gqlType graphql.Output = childType
				if child.Momentvoorkomen == model.Meervoudig {
					gqlType = graphql.NewList(childType)
				}

				fields[child.JSONRolnaam] = &graphql.Field{
					Type:        gqlType,
					Description: fmt.Sprintf("Onderliggend: %s (%s)", child.Doeltype, momentvoorkomenLabel(child.Momentvoorkomen)),
				}
			}

			// Afgeleide velden
			for _, av := range meta.AfgeleideVelden {
				avType := afgeleideVeldType(av.GoType)
				fields[av.Naam] = &graphql.Field{
					Type:        avType,
					Description: av.Description,
				}
			}

			// Reverse relaties: als andere entiteiten via een relatie naar dit type wijzen,
			// voeg dan een "gerelateerde_<padnaam>" veld toe dat die bron-entiteiten ophaalt.
			if meta.Metatype == model.MetatypeEntiteit {
				for _, rev := range reverseRelationMap[typenaam] {
					bronType := resolveEntityGraphQLType(rev.BronEntiteitTypenaam)
					if bronType == nil {
						continue
					}
					capturedRev := rev
					fields[capturedRev.GQLVeldnaam] = &graphql.Field{
						Type:        graphql.NewList(bronType),
						Description: fmt.Sprintf("Omgekeerde relatie: %s-entiteiten die via %s naar dit record wijzen", capturedRev.BronEntiteitTypenaam, capturedRev.RelatieMeta.Typenaam),
						Args: graphql.FieldConfigArgument{
							"limit": &graphql.ArgumentConfig{
								Type:         graphql.Int,
								DefaultValue: 20,
								Description:  "Maximum aantal resultaten (max 100)",
							},
						},
						Resolve: makeReverseRelationResolver(capturedRev),
					}
				}
			}

			// Forward relaties: als dit type een SecondaireEntiteitIDKolom heeft,
			// voeg dan een veld toe dat de doel-entiteit ophaalt (bijv. "gemeente" op InitiatiefGemeente).
			// De resolver wordt alleen getriggerd als het veld daadwerkelijk wordt opgevraagd in de query.
			for _, fwd := range forwardRelationMap[typenaam] {
				doelType := resolveEntityGraphQLType(fwd.DoelEntiteitTypenaam)
				if doelType == nil {
					continue
				}
				capturedFwd := fwd
				fields[capturedFwd.GQLVeldnaam] = &graphql.Field{
					Type:        doelType,
					Description: fmt.Sprintf("Forward relatie: %s via %s", capturedFwd.DoelEntiteitTypenaam, capturedFwd.FKKolom),
					Resolve:     makeForwardRelationResolver(capturedFwd),
				}
			}

			return fields
		}),
	})
}

// resolveChildGraphQLType zoekt of maakt het GraphQL type voor een child-relatie.
func resolveChildGraphQLType(child model.OnderliggendGegevenselement) *graphql.Object {
	if cached, ok := typeCache[child.Doeltype]; ok {
		return cached
	}
	// Type niet gevonden — kan voorkomen als het child-type geen Factory heeft
	return nil
}

// resolveEntityGraphQLType zoekt het GraphQL type voor een entiteit op typenaam.
func resolveEntityGraphQLType(typenaam string) *graphql.Object {
	if cached, ok := typeCache[typenaam]; ok {
		return cached
	}
	return nil
}

func afgeleideVeldType(goType string) graphql.Output {
	switch goType {
	case "string":
		return graphql.String
	case "int", "int64":
		return graphql.Int
	case "float64":
		return graphql.Float
	case "bool":
		return graphql.Boolean
	default:
		return graphql.String
	}
}

func momentvoorkomenLabel(m model.Momentvoorkomen) string {
	if m == model.Enkelvoudig {
		return "enkelvoudig"
	}
	return "meervoudig"
}

// sanitizeTypeName maakt een typenaam geschikt als GraphQL type name.
// Vervangt tekens die niet in [_A-Za-z0-9] zitten.
func sanitizeTypeName(name string) string {
	result := strings.Map(func(r rune) rune {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			return r
		}
		return '_'
	}, name)
	if result == "" {
		return "_"
	}
	if result[0] >= '0' && result[0] <= '9' {
		result = "_" + result
	}
	return result
}

// --- Plumbing types: Registratie, Wijziging ---

// WijzigingType is het GraphQL output type voor een wijziging.
var WijzigingType = graphql.NewObject(graphql.ObjectConfig{
	Name:        "Wijziging",
	Description: "Een individuele wijziging (opvoer of afvoer) binnen een registratie",
	Fields: graphql.Fields{
		"id":                 &graphql.Field{Type: graphql.Int},
		"wijzigingstype":     &graphql.Field{Type: graphql.String, Description: "opvoer of afvoer"},
		"registratie_id":     &graphql.Field{Type: graphql.Int},
		"entiteitnaam":       &graphql.Field{Type: graphql.String},
		"entiteit_id":        &graphql.Field{Type: graphql.String},
		"representatienaam":  &graphql.Field{Type: graphql.String},
		"representatie_id":   &graphql.Field{Type: graphql.String},
		"versie":             &graphql.Field{Type: graphql.Int},
		"tijdstip":           &graphql.Field{Type: DateTimeScalar},
		"is_ongedaangemaakt": &graphql.Field{Type: graphql.Boolean},
	},
})

// RegistratieType is het GraphQL output type voor een registratie.
var RegistratieType = graphql.NewObject(graphql.ObjectConfig{
	Name:        "Registratie",
	Description: "Een registratie, correctie of ongedaanmaking",
	Fields: graphql.Fields{
		"id":                            &graphql.Field{Type: graphql.Int},
		"registratietype":               &graphql.Field{Type: graphql.String, Description: "registratie, correctie of ongedaanmaking"},
		"tijdstip":                      &graphql.Field{Type: DateTimeScalar},
		"opmerking":                     &graphql.Field{Type: graphql.String},
		"corrigeert_registratie_id":     &graphql.Field{Type: graphql.Int},
		"maakt_ongedaan_registratie_id": &graphql.Field{Type: graphql.Int},
		"is_ongedaangemaakt":            &graphql.Field{Type: graphql.Boolean},
		"domeinen":                      &graphql.Field{Type: graphql.NewList(graphql.String), Description: "Afgeleide domeinen: unieke set van TypeMeta.Domein per wijziging"},
		"wijzigingen":                   &graphql.Field{Type: graphql.NewList(WijzigingType)},
	},
})

// RegistreerResultaatType is het GraphQL output type voor een registratie-resultaat.
var RegistreerResultaatType = graphql.NewObject(graphql.ObjectConfig{
	Name:        "RegistreerResultaat",
	Description: "Resultaat van een registratie/correctie/ongedaanmaking",
	Fields: graphql.Fields{
		"registratie_id": &graphql.Field{Type: graphql.Int},
		"tijdstip":       &graphql.Field{Type: DateTimeScalar},
		"wijzigingen":    &graphql.Field{Type: graphql.NewList(WijzigingType)},
	},
})
