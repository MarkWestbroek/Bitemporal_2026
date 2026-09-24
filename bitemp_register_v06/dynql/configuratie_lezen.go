package dynql

// configuratie_lezen.go — exporteerbare leeshulpen voor pakketten die configuratie-entiteiten
// (definities) willen lezen zoals de opgeslagen documenten dat doen: formeel actueel op `nu`,
// per GE het materieel geldige record. Gebruikt door notificaties/ (NotificatieDefinitie).

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
)

// LaadActueleEntiteiten laadt alle formeel actieve entiteiten van een type (met hub-kinderen)
// als maps, niet platgeslagen (per GE staan alle actieve hubs in een lijst).
func LaadActueleEntiteiten(ctx context.Context, typenaam string, nu time.Time) ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("dynql: database niet geïnitialiseerd")
	}
	ent, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok || ent.SliceFactory == nil {
		return nil, fmt.Errorf("onbekend type %q", typenaam)
	}
	entities := ent.SliceFactory()
	query := applyFormeleTijdFilter(db.NewSelect().Model(entities), ent.Typenaam, nu)
	query = addOnderliggendeRelations(query, ent, &nu)
	if ent.IDKolom != "" {
		query = query.OrderExpr("?TableAlias.? ASC", bun.Ident(ent.IDKolom))
	}
	if err := query.Scan(ctx); err != nil {
		return nil, fmt.Errorf("%s laden: %v", typenaam, err)
	}
	if err := laadHubKinderenNaQuery(ctx, entities, ent, &nu); err != nil {
		return nil, fmt.Errorf("%s hub-kinderen laden: %v", typenaam, err)
	}
	return sliceToMaps(entities, ent)
}

// EntiteitMaterieelGeldig zegt of de entiteit zelf (aanvang/einde op entiteitniveau) op `nu` leeft.
func EntiteitMaterieelGeldig(m map[string]interface{}, typenaam string, nu time.Time) bool {
	ent, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok {
		return false
	}
	return materieelGeldigOp(flattenEntityMap(kopieer(m), ent), ent, nu)
}

// GeldigeHub kiest uit de hubs van één GE (lijst uit LaadActueleEntiteiten) het record dat op
// `nu` materieel geldig is, platgeslagen (hub + data). Nil als er geen is.
func GeldigeHub(items interface{}, hubTypenaam string, nu time.Time) map[string]interface{} {
	hubMeta, ok := model.MetaRegistry.GetTypeMeta(hubTypenaam)
	if !ok {
		return nil
	}
	lijst, _ := items.([]interface{})
	return kiesGeldigeHub(lijst, hubMeta, nu)
}

// GeldigeHubs levert alle op `nu` materieel geldige, formeel actieve hubs van een meervoudig GE.
func GeldigeHubs(items interface{}, hubTypenaam string, nu time.Time) []map[string]interface{} {
	hubMeta, ok := model.MetaRegistry.GetTypeMeta(hubTypenaam)
	if !ok {
		return nil
	}
	lijst, _ := items.([]interface{})
	uit := []map[string]interface{}{}
	for _, it := range lijst {
		if one := kiesGeldigeHub([]interface{}{it}, hubMeta, nu); one != nil {
			uit = append(uit, one)
		}
	}
	return uit
}

// EntiteitVoldoetAanFilter voert het generieke filter (JSON in de vorm van <Typenaam>Filter,
// zie filter.go) uit op één entiteit: bestaat er op dit moment een rij met dat id die aan het
// filter voldoet? Gebruikt door notificaties/ voor het filter in een NotificatieDefinitie —
// dezelfde predicaattaal als de opgeslagen documenten.
func EntiteitVoldoetAanFilter(ctx context.Context, schema *graphql.Schema, typenaam string, id int, filterJSON string) (bool, error) {
	if schema == nil {
		return false, fmt.Errorf("geen GraphQL-schema")
	}
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok || meta.Padnaam == "" {
		return false, fmt.Errorf("onbekend type %q", typenaam)
	}
	var filter map[string]interface{}
	if strings.TrimSpace(filterJSON) != "" {
		if err := json.Unmarshal([]byte(filterJSON), &filter); err != nil {
			return false, fmt.Errorf("filter is geen geldige JSON: %v", err)
		}
	}
	veld := "full_" + meta.Padnaam + "_list"
	doc := fmt.Sprintf("query F($f: %sFilter) { %s(filter: { and: [ $f, { id: { eq: %d } } ] }, limit: 1) { id } }", typenaam, veld, id)
	res := graphql.Do(graphql.Params{Schema: *schema, RequestString: doc, VariableValues: map[string]interface{}{"f": filter}, Context: ctx})
	if len(res.Errors) > 0 {
		return false, fmt.Errorf("filter uitvoeren: %v", res.Errors[0].Message)
	}
	data, _ := res.Data.(map[string]interface{})
	rows, _ := data[veld].([]interface{})
	return len(rows) > 0, nil
}
