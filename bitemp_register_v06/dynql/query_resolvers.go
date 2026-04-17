package dynql

// query_resolvers bevat de generieke GraphQL resolve-functies voor queries.
// Hergebruikt Bun-query patronen uit handlers/full_handlers.go en core_handlers.go,
// maar werkt via graphql.ResolveParams i.p.v. gin.Context.

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
)

// db is de gedeelde database-connectie; wordt gezet door InitDB().
var db *bun.DB

// InitDB stelt de database-connectie in voor alle resolvers.
func InitDB(database *bun.DB) {
	db = database
}

// makeFullEntityResolver maakt een resolver voor een volledige entiteit met geneste GE's/relaties.
// Equivalent van handlers.MakeGetFullEntityByMetaHandler.
func makeFullEntityResolver(meta model.TypeMeta) graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		if db == nil {
			return nil, fmt.Errorf("database niet geïnitialiseerd")
		}
		if meta.Factory == nil {
			return nil, fmt.Errorf("Factory ontbreekt voor type %s", meta.Typenaam)
		}

		// ID argument
		id, ok := p.Args["id"]
		if !ok {
			return nil, fmt.Errorf("id argument is verplicht")
		}

		// Peiltijdstip argument (optioneel)
		// peiltijdstip heeft voorrang; als die ontbreekt, kijk naar t (integer shorthand)
		var peiltijdstip *time.Time
		if pt, ok := p.Args["peiltijdstip"]; ok && pt != nil {
			if t, ok := pt.(time.Time); ok {
				peiltijdstip = &t
			}
		}
		if peiltijdstip == nil {
			if tVal, ok := p.Args["t"]; ok && tVal != nil {
				if tInt, ok := tVal.(int); ok {
					pt := tijdstipUitT(tInt)
					peiltijdstip = &pt
				}
			}
		}

		entity := meta.Factory()
		query := db.NewSelect().Model(entity)

		if peiltijdstip != nil {
			query = applyFormeleTijdFilter(query, meta.Typenaam, *peiltijdstip)
		}

		// Onderliggende relaties laden (zelfde patroon als addOnderliggendeRelations)
		query = addOnderliggendeRelations(query, meta, peiltijdstip)

		err := query.
			Where(meta.IDKolom+" = ?", id).
			Scan(p.Context)
		if err != nil {
			return nil, fmt.Errorf("query fout voor %s: %v", meta.Typenaam, err)
		}

		// Hub-kinderen laden (Bun workaround)
		if err := laadHubKinderenNaQuery(p.Context, entity, meta, peiltijdstip); err != nil {
			return nil, fmt.Errorf("hub-kinderen laden mislukt: %v", err)
		}

		// Check of entity gevonden is (ID != zero)
		if hasID, ok := entity.(model.HasID); ok {
			if isZeroID(hasID.GetID()) {
				return nil, nil // niet gevonden
			}
		}

		result, err := entityToMap(entity, meta)
		if err != nil {
			return nil, err
		}
		flat := flattenEntityMap(result, meta)
		verrijkWeergavenamen(p.Context, flat, meta)
		return flat, nil
	}
}

// makeListResolver maakt een resolver voor een lijst van entiteiten/representaties met paginering.
func makeListResolver(meta model.TypeMeta) graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		if db == nil {
			return nil, fmt.Errorf("database niet geïnitialiseerd")
		}
		if meta.SliceFactory == nil {
			return nil, fmt.Errorf("SliceFactory ontbreekt voor type %s", meta.Typenaam)
		}

		limit := 20
		offset := 0
		if l, ok := p.Args["limit"]; ok && l != nil {
			if v, ok := l.(int); ok && v > 0 {
				if v > 100 {
					limit = 100
				} else {
					limit = v
				}
			}
		}
		if o, ok := p.Args["offset"]; ok && o != nil {
			if v, ok := o.(int); ok && v >= 0 {
				offset = v
			}
		}

		entities := meta.SliceFactory()
		err := db.NewSelect().
			Model(entities).
			Limit(limit).
			Offset(offset).
			Scan(p.Context)
		if err != nil {
			return nil, fmt.Errorf("lijst query fout voor %s: %v", meta.Typenaam, err)
		}

		return sliceToMaps(entities, meta)
	}
}

// makeFullListResolver maakt een resolver voor een lijst van entiteiten met alle
// onderliggende GE's/relaties, inclusief hub+data flattening.
// Equivalent van de REST GET /full/{padnaam}?page=1&size=N, maar met GraphQL flattening.
func makeFullListResolver(meta model.TypeMeta) graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		if db == nil {
			return nil, fmt.Errorf("database niet geïnitialiseerd")
		}
		if meta.SliceFactory == nil {
			return nil, fmt.Errorf("SliceFactory ontbreekt voor type %s", meta.Typenaam)
		}

		limit := 20
		offset := 0
		if l, ok := p.Args["limit"]; ok && l != nil {
			if v, ok := l.(int); ok && v > 0 {
				if v > 100 {
					limit = 100
				} else {
					limit = v
				}
			}
		}
		if o, ok := p.Args["offset"]; ok && o != nil {
			if v, ok := o.(int); ok && v >= 0 {
				offset = v
			}
		}

		entities := meta.SliceFactory()
		query := db.NewSelect().
			Model(entities).
			Limit(limit).
			Offset(offset)

		// Onderliggende relaties laden
		query = addOnderliggendeRelations(query, meta, nil)

		if err := query.Scan(p.Context); err != nil {
			return nil, fmt.Errorf("full lijst query fout voor %s: %v", meta.Typenaam, err)
		}

		// Hub-kinderen laden (Bun workaround)
		if err := laadHubKinderenNaQuery(p.Context, entities, meta, nil); err != nil {
			return nil, fmt.Errorf("hub-kinderen laden mislukt: %v", err)
		}

		// Converteer naar maps en flatten
		maps, err := sliceToMaps(entities, meta)
		if err != nil {
			return nil, err
		}
		for i, m := range maps {
			flat := flattenEntityMap(m, meta)
			verrijkWeergavenamen(p.Context, flat, meta)
			maps[i] = flat
		}
		return maps, nil
	}
}

// makeRegistratiesResolver retourneert de lijst-resolver voor registraties.
func makeRegistratiesResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		if db == nil {
			return nil, fmt.Errorf("database niet geïnitialiseerd")
		}

		limit := 20
		offset := 0
		if l, ok := p.Args["limit"]; ok && l != nil {
			if v, ok := l.(int); ok && v > 0 {
				if v > 100 {
					limit = 100
				} else {
					limit = v
				}
			}
		}
		if o, ok := p.Args["offset"]; ok && o != nil {
			if v, ok := o.(int); ok && v >= 0 {
				offset = v
			}
		}

		var registraties []model.Registratie
		err := db.NewSelect().
			Model(&registraties).
			Relation("Wijzigingen").
			OrderExpr("registratie.id DESC").
			Limit(limit).
			Offset(offset).
			Scan(p.Context)
		if err != nil {
			return nil, fmt.Errorf("registraties query fout: %v", err)
		}

		results := make([]map[string]interface{}, 0, len(registraties))
		for _, r := range registraties {
			results = append(results, registratieToMap(r))
		}
		return results, nil
	}
}

// makeRegistratieResolver retourneert een resolver voor één registratie.
func makeRegistratieResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		if db == nil {
			return nil, fmt.Errorf("database niet geïnitialiseerd")
		}

		id, ok := p.Args["id"]
		if !ok {
			return nil, fmt.Errorf("id argument is verplicht")
		}

		var reg model.Registratie
		err := db.NewSelect().
			Model(&reg).
			Relation("Wijzigingen").
			Where("registratie.id = ?", id).
			Scan(p.Context)
		if err != nil {
			return nil, fmt.Errorf("registratie query fout: %v", err)
		}

		if reg.ID == 0 {
			return nil, nil
		}
		return registratieToMap(reg), nil
	}
}

// makeReverseRelationResolver maakt een resolver voor omgekeerde relatie-navigatie.
// Gegeven een doel-entiteit (bijv. B met id=3), zoek alle bron-entiteiten (bijv. A)
// die via een relatie (bijv. Rel_A_B) naar dit doel wijzen.
//
// Stappen:
// 1. Haal het id van de huidige entiteit uit de parent-source
// 2. Query de relatietabel WHERE secondaire_id_kolom = id
// 3. Verzamel de unieke bron-entiteit-id's
// 4. Laad die bron-entiteiten met hun volledige geneste structuur
func makeReverseRelationResolver(rev ReverseRelationInfo) graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		if db == nil {
			return nil, fmt.Errorf("database niet geïnitialiseerd")
		}

		// Haal het id van de huidige entiteit (doel) uit de parent-source
		source, ok := p.Source.(map[string]interface{})
		if !ok {
			return nil, nil
		}
		doelID, ok := source["id"]
		if !ok || doelID == nil {
			return nil, nil
		}

		// Limit argument
		limit := 20
		if l, ok := p.Args["limit"]; ok && l != nil {
			if v, ok := l.(int); ok && v > 0 {
				if v > 100 {
					limit = 100
				} else {
					limit = v
				}
			}
		}

		// Stap 1: Query de relatietabel voor bron-IDs
		// SELECT DISTINCT bron_id_kolom FROM relatie_tabel WHERE sec_id_kolom = doelID AND afvoer IS NULL
		relMeta := rev.RelatieMeta
		if relMeta.DBSliceFactory == nil {
			return nil, nil
		}

		type bronIDRow struct {
			BronID interface{}
		}

		var bronIDs []interface{}
		err := db.NewRaw(
			fmt.Sprintf(
				"SELECT DISTINCT %s FROM %s WHERE %s = ? AND afvoer IS NULL LIMIT ?",
				rev.BronIDKolom, relMeta.Tabelnaam, rev.SecondaireIDKolom,
			),
			doelID, limit,
		).Scan(p.Context, &bronIDs)
		if err != nil {
			return nil, fmt.Errorf("reverse relatie query (%s) fout: %v", relMeta.Typenaam, err)
		}
		if len(bronIDs) == 0 {
			return []map[string]interface{}{}, nil
		}

		// Stap 2: Laad de bron-entiteiten met volledige geneste structuur
		bronMeta := rev.BronEntiteitMeta
		if bronMeta.SliceFactory == nil {
			return nil, nil
		}

		entities := bronMeta.SliceFactory()
		query := db.NewSelect().
			Model(entities).
			Where(bronMeta.IDKolom+" IN (?)", bun.In(bronIDs))

		// Onderliggende relaties laden
		query = addOnderliggendeRelations(query, bronMeta, nil)

		if err := query.Scan(p.Context); err != nil {
			return nil, fmt.Errorf("reverse bron-entiteiten laden (%s) fout: %v", bronMeta.Typenaam, err)
		}

		// Hub-kinderen laden
		if err := laadHubKinderenNaQuery(p.Context, entities, bronMeta, nil); err != nil {
			return nil, fmt.Errorf("reverse hub-kinderen laden fout: %v", err)
		}

		// Converteer naar maps en flatten
		results, err := sliceToMaps(entities, bronMeta)
		if err != nil {
			return nil, err
		}
		for i, m := range results {
			flat := flattenEntityMap(m, bronMeta)
			verrijkWeergavenamen(p.Context, flat, bronMeta)
			results[i] = flat
		}
		return results, nil
	}
}

// makeForwardRelationResolver maakt een resolver voor forward FK-navigatie.
// Gegeven een relatie-hub (bijv. InitiatiefGemeente met gemeente_id=5),
// laadt de doel-entiteit (Gemeente met id=5) met alle geneste GE's/relaties.
// De resolver wordt alleen getriggerd als het veld daadwerkelijk wordt opgevraagd.
func makeForwardRelationResolver(fwd ForwardRelationInfo) graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		if db == nil {
			return nil, fmt.Errorf("database niet geïnitialiseerd")
		}

		// Haal de FK-waarde uit de source (de geflattende map van de relatie-hub)
		source, ok := p.Source.(map[string]interface{})
		if !ok {
			return nil, nil
		}
		fkValue, ok := source[fwd.FKKolom]
		if !ok || fkValue == nil {
			return nil, nil
		}

		// Laad de doel-entiteit met volledige geneste structuur
		doelMeta := fwd.DoelEntiteitMeta
		if doelMeta.Factory == nil {
			return nil, nil
		}

		entity := doelMeta.Factory()
		query := db.NewSelect().Model(entity)

		// Onderliggende relaties laden
		query = addOnderliggendeRelations(query, doelMeta, nil)

		err := query.
			Where(doelMeta.IDKolom+" = ?", fkValue).
			Scan(p.Context)
		if err != nil {
			return nil, fmt.Errorf("forward relatie query (%s) fout: %v", doelMeta.Typenaam, err)
		}

		// Hub-kinderen laden
		if err := laadHubKinderenNaQuery(p.Context, entity, doelMeta, nil); err != nil {
			return nil, fmt.Errorf("forward hub-kinderen laden fout: %v", err)
		}

		// Check of entity gevonden is
		if hasID, ok := entity.(model.HasID); ok {
			if isZeroID(hasID.GetID()) {
				return nil, nil
			}
		}

		result, err := entityToMap(entity, doelMeta)
		if err != nil {
			return nil, err
		}
		flat := flattenEntityMap(result, doelMeta)
		verrijkWeergavenamen(p.Context, flat, doelMeta)
		return flat, nil
	}
}

// --- Hulpfuncties: Bun-query helpers (vereenvoudigd uit full_handlers.go) ---

func addOnderliggendeRelations(query *bun.SelectQuery, meta model.TypeMeta, peiltijdstip *time.Time) *bun.SelectQuery {
	for _, rel := range meta.OnderliggendeGegevenselementen {
		capturedRel := rel
		childMeta, childOK := model.MetaRegistry.GetTypeMeta(capturedRel.Doeltype)

		isHub := childOK && childMeta.GESubtype == model.GESubtypeHub && len(childMeta.OnderliggendeGegevenselementen) > 0

		if isHub {
			query = query.Relation(capturedRel.Rolnaam, func(q *bun.SelectQuery) *bun.SelectQuery {
				if peiltijdstip != nil {
					q = applyFormeleTijdFilter(q, capturedRel.Doeltype, *peiltijdstip)
				}
				return q
			})
		} else {
			if peiltijdstip != nil {
				capturedDoeltype := capturedRel.Doeltype
				query = query.Relation(capturedRel.Rolnaam, func(relQuery *bun.SelectQuery) *bun.SelectQuery {
					return applyFormeleTijdFilter(relQuery, capturedDoeltype, *peiltijdstip)
				})
			} else {
				query = query.Relation(capturedRel.Rolnaam)
			}
		}
	}
	return query
}

// applyFormeleTijdFilter past het standaard formeel tijdfilter toe.
// Vereenvoudigd t.o.v. de handler-versie: gebruikt opvoer/afvoer ipv de wijzigingen-tabel.
func applyFormeleTijdFilter(query *bun.SelectQuery, _ string, peiltijdstip time.Time) *bun.SelectQuery {
	return query.
		Where("opvoer <= ?", peiltijdstip).
		Where("(afvoer IS NULL OR afvoer > ?)", peiltijdstip)
}

// laadHubKinderenNaQuery laadt _Data/_Aanvang/_Einde van hub-types.
// Vereenvoudigd uit handlers/full_handlers.go.
func laadHubKinderenNaQuery(ctx context.Context, entitiesOrEntity any, entityMeta model.TypeMeta, peiltijdstip *time.Time) error {
	val := reflect.ValueOf(entitiesOrEntity)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	var entityValues []reflect.Value
	if val.Kind() == reflect.Slice {
		for i := 0; i < val.Len(); i++ {
			entityValues = append(entityValues, val.Index(i))
		}
	} else if val.Kind() == reflect.Struct {
		entityValues = []reflect.Value{val}
	}

	if len(entityValues) == 0 {
		return nil
	}

	entIDs := make([]int, 0, len(entityValues))
	seen := make(map[int]bool)
	for _, ev := range entityValues {
		id, err := haalIntID(ev, entityMeta.IDKolom)
		if err != nil || id == 0 || seen[id] {
			continue
		}
		seen[id] = true
		entIDs = append(entIDs, id)
	}
	if len(entIDs) == 0 {
		return nil
	}

	for _, rel := range entityMeta.OnderliggendeGegevenselementen {
		hubMeta, ok := model.MetaRegistry.GetTypeMeta(rel.Doeltype)
		if !ok || hubMeta.GESubtype != model.GESubtypeHub || len(hubMeta.OnderliggendeGegevenselementen) == 0 {
			continue
		}

		for _, childRel := range hubMeta.OnderliggendeGegevenselementen {
			childMeta, gcOK := model.MetaRegistry.GetTypeMeta(childRel.Doeltype)
			if !gcOK || childMeta.SliceFactory == nil {
				continue
			}

			childSlice := childMeta.SliceFactory()
			query := db.NewSelect().
				Model(childSlice).
				Where(childMeta.EntiteitIDKolom+" IN (?)", bun.In(entIDs))

			if peiltijdstip != nil {
				query = applyFormeleTijdFilter(query, childRel.Doeltype, *peiltijdstip)
			}

			if err := query.Scan(ctx); err != nil {
				return fmt.Errorf("laadHubKinderen %s: %v", childRel.Doeltype, err)
			}

			childSliceVal := reflect.ValueOf(childSlice).Elem()
			type lk struct{ e, r int }
			childMap := make(map[lk][]int)
			for k := 0; k < childSliceVal.Len(); k++ {
				cPtr := childSliceVal.Index(k).Addr().Interface()
				eID, _ := haalIntIDVanInterface(cPtr, childMeta.EntiteitIDKolom)
				rID, _ := haalIntIDVanInterface(cPtr, "rel_id")
				childMap[lk{eID, rID}] = append(childMap[lk{eID, rID}], k)
			}

			for _, entityVal := range entityValues {
				ev := entityVal
				if ev.Kind() == reflect.Ptr {
					ev = ev.Elem()
				}
				hubsField := ev.FieldByName(rel.Rolnaam)
				if !hubsField.IsValid() || hubsField.Kind() != reflect.Slice {
					continue
				}
				for j := 0; j < hubsField.Len(); j++ {
					hub := hubsField.Index(j)
					hPtr := hub.Addr().Interface()
					eID, _ := haalIntIDVanInterface(hPtr, hubMeta.EntiteitIDKolom)
					rID, _ := haalIntIDVanInterface(hPtr, "rel_id")

					indices := childMap[lk{eID, rID}]
					cField := hub.FieldByName(childRel.Rolnaam)
					if !cField.IsValid() || !cField.CanSet() {
						continue
					}
					newSlice := reflect.MakeSlice(cField.Type(), len(indices), len(indices))
					for idx, srcIdx := range indices {
						newSlice.Index(idx).Set(childSliceVal.Index(srcIdx))
					}
					cField.Set(newSlice)
				}
			}
		}
	}
	return nil
}

// --- Conversie helpers: entity → map[string]interface{} ---

// entityToMap converteert een representatie-struct naar een map via JSON round-trip.
// Dit zorgt ervoor dat alle json-tags correct worden toegepast.
func entityToMap(entity interface{}, _ model.TypeMeta) (map[string]interface{}, error) {
	b, err := json.Marshal(entity)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// sliceToMaps converteert een *[]Struct naar een []map[string]interface{}.
func sliceToMaps(entities interface{}, _ model.TypeMeta) ([]map[string]interface{}, error) {
	b, err := json.Marshal(entities)
	if err != nil {
		return nil, err
	}
	var items []map[string]interface{}
	if err := json.Unmarshal(b, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func registratieToMap(reg model.Registratie) map[string]interface{} {
	result := map[string]interface{}{
		"id":                 reg.ID,
		"registratietype":    string(reg.Registratietype),
		"tijdstip":           reg.Tijdstip,
		"is_ongedaangemaakt": reg.IsOngedaangemaakt,
	}
	if reg.Opmerking != nil {
		result["opmerking"] = *reg.Opmerking
	}
	if reg.CorrigeertRegistratieID != nil {
		result["corrigeert_registratie_id"] = *reg.CorrigeertRegistratieID
	}
	if reg.MaaktOngedaanRegistratieID != nil {
		result["maakt_ongedaan_registratie_id"] = *reg.MaaktOngedaanRegistratieID
	}

	wijzigingen := make([]map[string]interface{}, 0, len(reg.Wijzigingen))
	for _, w := range reg.Wijzigingen {
		wm := map[string]interface{}{
			"id":                 w.ID,
			"wijzigingstype":     string(w.Wijzigingstype),
			"registratie_id":     w.RegistratieID,
			"entiteitnaam":       w.Entiteitnaam,
			"entiteit_id":        w.EntiteitID,
			"representatienaam":  w.Representatienaam,
			"representatie_id":   w.RepresentatieID,
			"tijdstip":           w.Tijdstip,
			"is_ongedaangemaakt": w.IsOngedaangemaakt,
		}
		if w.Versie != nil {
			wm["versie"] = *w.Versie
		}
		wijzigingen = append(wijzigingen, wm)
	}
	result["wijzigingen"] = wijzigingen
	return result
}

// --- Reflectie helpers ---

func haalIntID(v reflect.Value, kolomnaam string) (int, error) {
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	return haalIntIDVanInterface(v.Addr().Interface(), kolomnaam)
}

func haalIntIDVanInterface(obj interface{}, kolomnaam string) (int, error) {
	v := reflect.ValueOf(obj)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	t := v.Type()
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		bunTag := f.Tag.Get("bun")
		if bunTag == "" {
			continue
		}
		parts := splitBunTag(bunTag)
		if len(parts) > 0 && parts[0] == kolomnaam {
			fv := v.Field(i)
			switch fv.Kind() {
			case reflect.Int, reflect.Int64, reflect.Int32, reflect.Int16, reflect.Int8:
				return int(fv.Int()), nil
			}
		}
	}
	return 0, fmt.Errorf("kolom %s niet gevonden", kolomnaam)
}

func splitBunTag(tag string) []string {
	parts := make([]string, 0, 4)
	for _, p := range splitComma(tag) {
		trimmed := trimSpace(p)
		if trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return parts
}

func splitComma(s string) []string {
	result := make([]string, 0, 4)
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			result = append(result, s[start:i])
			start = i + 1
		}
	}
	result = append(result, s[start:])
	return result
}

func trimSpace(s string) string {
	i := 0
	for i < len(s) && s[i] == ' ' {
		i++
	}
	j := len(s)
	for j > i && s[j-1] == ' ' {
		j--
	}
	return s[i:j]
}

// flattenEntityMap verwerkt hub+data flattening en enkelvoudig-naar-single conversie.
// De GraphQL types tonen hub- en data-velden plat op één niveau (zie type_builder.go),
// maar de JSON round-trip van Go structs produceert de hiërarchische structuur
// (data-velden genest onder "data": [...]).
// Deze functie brengt de map in lijn met het GraphQL schema.
func flattenEntityMap(m map[string]interface{}, meta model.TypeMeta) map[string]interface{} {
	for _, child := range meta.OnderliggendeGegevenselementen {
		childMeta, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype)
		if !ok {
			continue
		}

		raw, exists := m[child.JSONRolnaam]
		if !exists || raw == nil {
			continue
		}

		// De Go struct heeft altijd slices; JSON round-trip levert []interface{}
		items, ok := raw.([]interface{})
		if !ok {
			continue
		}

		// Verwerk elk item: hub+data flattening + recursie voor kinderen
		processed := make([]interface{}, 0, len(items))
		for _, item := range items {
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				processed = append(processed, item)
				continue
			}

			// Hub+data flattening: kopieer data[0] velden naar het hub-niveau
			if childMeta.GESubtype == model.GESubtypeHub {
				itemMap = flattenHubData(itemMap)
			}

			// Recursie voor kinderen van dit type (bijv. aanvang/einde binnen burgerschap)
			if len(childMeta.OnderliggendeGegevenselementen) > 0 {
				itemMap = flattenEntityMap(itemMap, childMeta)
			}

			processed = append(processed, itemMap)
		}

		// Enkelvoudig: array → single object (of nil)
		if child.Momentvoorkomen == model.Enkelvoudig {
			if len(processed) > 0 {
				m[child.JSONRolnaam] = processed[0]
			} else {
				m[child.JSONRolnaam] = nil
			}
		} else {
			m[child.JSONRolnaam] = processed
		}
	}
	return m
}

// flattenHubData kopieert velden van data[0] naar het hub-niveau en verwijdert "data".
// Hierdoor ziet de GraphQL-gebruiker een plat type (hub + inhoudelijke velden)
// in plaats van de interne hub→data hiërarchie.
func flattenHubData(hub map[string]interface{}) map[string]interface{} {
	dataRaw, exists := hub["data"]
	if !exists || dataRaw == nil {
		delete(hub, "data")
		return hub
	}

	dataItems, ok := dataRaw.([]interface{})
	if !ok || len(dataItems) == 0 {
		delete(hub, "data")
		return hub
	}

	dataMap, ok := dataItems[0].(map[string]interface{})
	if !ok {
		delete(hub, "data")
		return hub
	}

	// Kopieer data-velden naar hub (hub-velden hebben voorrang bij dubbele keys)
	for k, v := range dataMap {
		if _, exists := hub[k]; !exists {
			hub[k] = v
		}
	}

	delete(hub, "data")
	return hub
}

func isZeroID(id interface{}) bool {
	if id == nil {
		return true
	}
	switch v := id.(type) {
	case int:
		return v == 0
	case int64:
		return v == 0
	case string:
		return v == ""
	default:
		return false
	}
}

// tijdstipUitT vertaalt een integer t naar een deterministisch peiltijdstip.
// Zelfde logica als handlers.tijdstipUitT: 2026-01-01T00:00:00Z + t uur + t µs.
func tijdstipUitT(t int) time.Time {
	return time.
		Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).
		Add(time.Duration(t) * time.Hour).
		Add(time.Microsecond * time.Duration(t))
}

// ─── Weergavenaam-verrijking voor GraphQL ────────────────────────────────────
//
// Parallel aan handlers/full_handlers.go's verrijkResponseMetWeergavenamen,
// maar werkt op reeds geflattende entity-maps (na flattenEntityMap).
// Wordt aangeroepen vanuit full-entity en full-entity-list resolvers.

// verrijkWeergavenamen injecteert weergavenaam in child relatie-items
// die een SecondaireEntiteitIDKolom en IsWeergaveVeld afgeleide velden hebben.
func verrijkWeergavenamen(ctx context.Context, result map[string]interface{}, meta model.TypeMeta) {
	for _, child := range meta.OnderliggendeGegevenselementen {
		childMeta, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype)
		if !ok || childMeta.SecondaireEntiteitIDKolom == "" {
			continue
		}
		heeftWeergaveVeld := false
		for _, av := range childMeta.AfgeleideVelden {
			if av.IsWeergaveVeld {
				heeftWeergaveVeld = true
				break
			}
		}
		if !heeftWeergaveVeld {
			continue
		}

		// Zoek de forward relation info voor het FK-veld
		fwds := forwardRelationMap[child.Doeltype]
		if len(fwds) == 0 {
			continue
		}
		fwd := fwds[0]
		doelMeta := fwd.DoelEntiteitMeta

		// Haal child items op uit de result map
		raw, exists := result[child.JSONRolnaam]
		if !exists || raw == nil {
			continue
		}
		items, ok := raw.([]interface{})
		if !ok {
			// Enkelvoudig: single object
			if single, singleOK := raw.(map[string]interface{}); singleOK {
				items = []interface{}{single}
			} else {
				continue
			}
		}

		// Verzamel FK-IDs
		fkIDs := map[int]bool{}
		for _, item := range items {
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			if fkID := extractIntFromMap(itemMap, fwd.FKKolom); fkID >= 0 {
				fkIDs[fkID] = true
			}
		}
		if len(fkIDs) == 0 {
			continue
		}

		// Batch-load doelentiteiten en bereken weergavenamen
		idList := make([]int, 0, len(fkIDs))
		for id := range fkIDs {
			idList = append(idList, id)
		}
		weergaveMap := laadWeergavenamenBatch(ctx, doelMeta, idList)

		// Injecteer weergavenaam in elke child item
		for _, item := range items {
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			fkID := extractIntFromMap(itemMap, fwd.FKKolom)
			if fkID < 0 {
				continue
			}
			if naam, ok := weergaveMap[fkID]; ok && naam != "" {
				itemMap["weergavenaam"] = naam
			}
		}
	}
}

// extractIntFromMap haalt een int-waarde op uit een map (JSON round-trip geeft float64).
// Retourneert -1 als het veld ontbreekt of geen numerieke waarde is.
func extractIntFromMap(m map[string]interface{}, key string) int {
	val, ok := m[key]
	if !ok || val == nil {
		return -1
	}
	switch v := val.(type) {
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	}
	return -1
}

// laadWeergavenamenBatch laadt doelentiteiten en berekent hun weergavenaam.
// Retourneert een map van ID → weergavenaam-string.
func laadWeergavenamenBatch(ctx context.Context, doelMeta model.TypeMeta, ids []int) map[int]string {
	if db == nil || doelMeta.SliceFactory == nil || len(ids) == 0 {
		return nil
	}

	targetEntities := doelMeta.SliceFactory()
	query := db.NewSelect().Model(targetEntities)
	query = addOnderliggendeRelations(query, doelMeta, nil)
	if err := query.Where(doelMeta.IDKolom+" IN (?)", bun.In(ids)).Scan(ctx); err != nil {
		return nil
	}

	// Hub-kinderen laden (Bun workaround)
	if err := laadHubKinderenNaQuery(ctx, targetEntities, doelMeta, nil); err != nil {
		return nil
	}

	// Converteer naar maps, flatten, en bereken weergavenaam per entiteit
	maps, err := sliceToMaps(targetEntities, doelMeta)
	if err != nil {
		return nil
	}

	idKolom := doelMeta.IDKolom
	result := make(map[int]string, len(maps))
	for _, m := range maps {
		flat := flattenEntityMap(m, doelMeta)
		idVal, ok := flat[idKolom].(float64)
		if !ok {
			continue
		}
		naam := berekenWeergavenaamVlak(flat, doelMeta)
		result[int(idVal)] = naam
	}
	return result
}

// berekenWeergavenaamVlak berekent de weergavenaam uit een geflattende entity-map.
func berekenWeergavenaamVlak(entityMap map[string]interface{}, meta model.TypeMeta) string {
	for _, av := range meta.AfgeleideVelden {
		if !av.IsWeergaveVeld {
			continue
		}
		return evalueerCELConcatenatieVlak(entityMap, av.Afleidingsregel, meta)
	}
	return ""
}

// evalueerCELConcatenatieVlak evalueert een (beperkte) CEL-expressie op een geflattende map.
// Zelfde logica als handlers.evalueerCELConcatenatie maar werkt met geflattende data.
func evalueerCELConcatenatieVlak(entityMap map[string]interface{}, expressie string, meta model.TypeMeta) string {
	if !strings.Contains(expressie, "+") {
		return navigeerAfgeleidPadVlak(entityMap, strings.TrimSpace(expressie), meta)
	}

	segmenten := strings.Split(expressie, "+")
	var resultaat strings.Builder
	for _, segment := range segmenten {
		segment = strings.TrimSpace(segment)
		if segment == "" {
			continue
		}
		if len(segment) >= 2 && segment[0] == '"' && segment[len(segment)-1] == '"' {
			literal := segment[1 : len(segment)-1]
			literal = strings.ReplaceAll(literal, `\"`, `"`)
			literal = strings.ReplaceAll(literal, `\\`, `\`)
			resultaat.WriteString(literal)
		} else {
			resultaat.WriteString(navigeerAfgeleidPadVlak(entityMap, segment, meta))
		}
	}
	return resultaat.String()
}

// navigeerAfgeleidPadVlak navigeert een punt-gescheiden pad door een geflattende entity-map.
// Gebruikt MetaRegistry voor Rolnaam→JSONRolnaam vertaling, maar verwacht
// hub→data al geflattend (door flattenEntityMap).
func navigeerAfgeleidPadVlak(entityMap map[string]interface{}, pad string, meta model.TypeMeta) string {
	delen := strings.Split(pad, ".")
	var huidig interface{} = entityMap
	huidigMeta := meta

	for i, deel := range delen {
		m, ok := huidig.(map[string]interface{})
		if !ok {
			return ""
		}

		// Zoek het onderliggende element op Rolnaam
		gevonden := false
		for _, child := range huidigMeta.OnderliggendeGegevenselementen {
			if !strings.EqualFold(child.Rolnaam, deel) {
				continue
			}
			childVal := m[child.JSONRolnaam]
			if childVal == nil {
				return ""
			}
			childMeta, childOK := model.MetaRegistry.GetTypeMeta(child.Doeltype)

			// In geflattende map: enkelvoudig = single object, meervoudig = array
			if arr, arrOK := childVal.([]interface{}); arrOK {
				if len(arr) == 0 {
					return ""
				}
				if itemMap, imOK := arr[0].(map[string]interface{}); imOK {
					huidig = itemMap
				} else {
					return ""
				}
			} else if subMap, subOK := childVal.(map[string]interface{}); subOK {
				huidig = subMap
			} else {
				return ""
			}

			if childOK {
				huidigMeta = childMeta
			}
			gevonden = true
			break
		}

		if !gevonden {
			// Probeer als direct veld
			lowerDeel := strings.ToLower(deel)
			if val, ok := m[lowerDeel]; ok {
				if i == len(delen)-1 {
					return fmt.Sprint(val)
				}
				huidig = val
			} else if val, ok := m[deel]; ok {
				if i == len(delen)-1 {
					return fmt.Sprint(val)
				}
				huidig = val
			} else {
				return ""
			}
		}
	}

	if huidig == nil {
		return ""
	}
	return fmt.Sprint(huidig)
}
