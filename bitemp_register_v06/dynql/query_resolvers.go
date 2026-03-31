package dynql

// query_resolvers bevat de generieke GraphQL resolve-functies voor queries.
// Hergebruikt Bun-query patronen uit handlers/full_handlers.go en core_handlers.go,
// maar werkt via graphql.ResolveParams i.p.v. gin.Context.

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
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
		var peiltijdstip *time.Time
		if pt, ok := p.Args["peiltijdstip"]; ok && pt != nil {
			if t, ok := pt.(time.Time); ok {
				peiltijdstip = &t
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

		return entityToMap(entity, meta)
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
func sliceToMaps(entities interface{}, meta model.TypeMeta) ([]map[string]interface{}, error) {
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
