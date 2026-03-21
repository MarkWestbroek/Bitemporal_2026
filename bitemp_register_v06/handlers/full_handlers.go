package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

/* GENERAL TODO:
Full entity get and post to include all fields, not just ID.
This will require changes to the model structs and the handlers
	to bind JSON to the full struct instead of just an ID field.
The current implementation is a simplified version for demonstration purposes.
*/

// (CoPilot made) parseBunRelationTag extracts the foreign key field name from a bun relation tag
// Expected format: bun:"rel:has-many,join:parent_field=child_field"
// Returns the child_field (FK field name) and parent_field (PK field name)
func parseBunRelationTag(tag string) (fkField string, pkField string, err error) {
	// tag format example: "rel:has-many,join:id=a_id"
	parts := strings.Split(tag, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "join:") {
			joinSpec := strings.TrimPrefix(part, "join:")
			// joinSpec is now "id=a_id"
			joinParts := strings.Split(joinSpec, "=")
			if len(joinParts) == 2 {
				pkField = strings.TrimSpace(joinParts[0]) // "id"
				fkField = strings.TrimSpace(joinParts[1]) // "a_id"
				return fkField, pkField, nil
			}
		}
	}
	return "", "", fmt.Errorf("join specification not found in bun tag")
}

// setForeignKeyOnRelatedEntity sets the FK field on a related entity to the parent ID
func setForeignKeyOnRelatedEntity(relatedEntity reflect.Value, fkFieldName string, parentID any) error {
	// The fkFieldName is the column name (like "a_id"), we need to find the Go field
	// Try direct field lookup first (if FK field is named exactly like fkFieldName)
	elem := relatedEntity
	if elem.Kind() == reflect.Ptr {
		elem = elem.Elem()
	}

	structType := elem.Type()

	// Search for a field with matching bun tag or json tag that corresponds to fkFieldName
	for i := 0; i < elem.NumField(); i++ {
		field := structType.Field(i)

		// Check bun tag
		if bunTag := field.Tag.Get("bun"); bunTag != "" {
			// Extract the column name from bun tag (first part before comma)
			bunParts := strings.Split(bunTag, ",")
			columnName := bunParts[0]
			if columnName == fkFieldName {
				fieldValue := elem.Field(i)
				if fieldValue.CanSet() {
					switch fieldValue.Kind() {
					case reflect.String:
						if typedID, ok := parentID.(string); ok {
							fieldValue.SetString(typedID)
							return nil
						}
						return fmt.Errorf("cannot assign parentID type %T to string FK '%s'", parentID, fkFieldName)
					case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
						parentValue := reflect.ValueOf(parentID)
						if !parentValue.IsValid() || !parentValue.Type().ConvertibleTo(fieldValue.Type()) {
							return fmt.Errorf("cannot assign parentID type %T to int FK '%s'", parentID, fkFieldName)
						}
						fieldValue.Set(parentValue.Convert(fieldValue.Type()))
						return nil
					default:
						return fmt.Errorf("unsupported FK field kind '%s' for field '%s'", fieldValue.Kind(), fkFieldName)
					}
				}
			}
		}

		// Check json tag
		if jsonTag := field.Tag.Get("json"); jsonTag != "" {
			jsonParts := strings.Split(jsonTag, ",")
			jsonName := jsonParts[0]
			if jsonName == fkFieldName {
				fieldValue := elem.Field(i)
				if fieldValue.CanSet() {
					switch fieldValue.Kind() {
					case reflect.String:
						if typedID, ok := parentID.(string); ok {
							fieldValue.SetString(typedID)
							return nil
						}
						return fmt.Errorf("cannot assign parentID type %T to string FK '%s'", parentID, fkFieldName)
					case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
						parentValue := reflect.ValueOf(parentID)
						if !parentValue.IsValid() || !parentValue.Type().ConvertibleTo(fieldValue.Type()) {
							return fmt.Errorf("cannot assign parentID type %T to int FK '%s'", parentID, fkFieldName)
						}
						fieldValue.Set(parentValue.Convert(fieldValue.Type()))
						return nil
					default:
						return fmt.Errorf("unsupported FK field kind '%s' for field '%s'", fieldValue.Kind(), fkFieldName)
					}
				}
			}
		}
	}

	return fmt.Errorf("FK field '%s' not found or cannot be set", fkFieldName)
}

// parsePeiltijdstipUitQuerystring leest optionele querystring parameters voor formele tijd.
// Ondersteunt:
//   - `peiltijdstip` in RFC3339/RFC3339Nano formaat
//   - `t` als integer; die wordt vertaald naar hetzelfde patroon als in registratie:
//     2026-01-01T00:00:00Z + t uren + t microseconden.
//
// Als beide ontbreken, retourneert de functie (nil, nil) en wordt geen tijdsfilter toegepast.
// Als beide aanwezig zijn, krijgt `peiltijdstip` voorrang.
// Bij ongeldig formaat retourneert de functie een error die direct als 400-antwoord
// aan de client kan worden doorgegeven.
func parsePeiltijdstipUitQuerystring(c *gin.Context) (*time.Time, error) {
	peiltijdstipRaw := c.Query("peiltijdstip")
	if peiltijdstipRaw != "" {
		peiltijdstip, err := time.Parse(time.RFC3339Nano, peiltijdstipRaw)
		if err != nil {
			return nil, fmt.Errorf("invalid 'peiltijdstip' parameter, expected RFC3339/RFC3339Nano")
		}
		if debugLogsEnabled() {
			fmt.Printf("HANDLER (full): peiltijdstip (querystring) = %s\n", peiltijdstip.Format(time.RFC3339Nano))
		}

		return &peiltijdstip, nil
	}

	tRaw := c.Query("t")
	if tRaw == "" {
		return nil, nil
	}
	t, err := strconv.Atoi(tRaw)
	if err != nil {
		return nil, fmt.Errorf("invalid 't' parameter, expected integer")
	}

	peiltijdstip := tijdstipUitT(t)
	if debugLogsEnabled() {
		fmt.Printf("HANDLER (full): peiltijdstip (afgeleid uit t=%d) = %s\n", t, peiltijdstip.Format(time.RFC3339Nano))
	}

	return &peiltijdstip, nil
}

func tijdstipUitT(t int) time.Time {
	return time.
		Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).
		Add(time.Duration(t) * time.Hour).
		Add(time.Microsecond * time.Duration(t))
}

// parseRegistratieIntervalUitQuerystring leest optionele interval-params ta/tb.
// - ta/tb zijn integers en worden met dezelfde t->tijdstip truc afgeleid.
// - interval is inclusief: tijdstip >= ta en tijdstip <= tb.
// - als slechts een van beide is gezet, wordt de andere grens open gelaten.
// - als geen van beide gezet is, returnt de functie (nil, nil, nil).
func parseRegistratieIntervalUitQuerystring(c *gin.Context) (*time.Time, *time.Time, error) {
	taRaw := c.Query("ta")
	tbRaw := c.Query("tb")
	if taRaw == "" && tbRaw == "" {
		return nil, nil, nil
	}

	var ta *time.Time
	if taRaw != "" {
		v, err := strconv.Atoi(taRaw)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid 'ta' parameter, expected integer")
		}
		t := tijdstipUitT(v)
		ta = &t
		if debugLogsEnabled() {
			fmt.Printf("HANDLER (full): interval ta (afgeleid uit ta=%d) = %s\n", v, t.Format(time.RFC3339Nano))
		}
	}

	var tb *time.Time
	if tbRaw != "" {
		v, err := strconv.Atoi(tbRaw)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid 'tb' parameter, expected integer")
		}
		t := tijdstipUitT(v)
		tb = &t
		if debugLogsEnabled() {
			fmt.Printf("HANDLER (full): interval tb (afgeleid uit tb=%d) = %s\n", v, t.Format(time.RFC3339Nano))
		}
	}

	if ta != nil && tb != nil && ta.After(*tb) {
		return nil, nil, fmt.Errorf("invalid interval: ta must be <= tb")
	}

	return ta, tb, nil
}

func parseRegistratietypesUitQuerystring(c *gin.Context) ([]model.RegistratietypeEnum, error) {
	rawValues := c.QueryArray("type")
	if len(rawValues) == 0 {
		return nil, nil
	}

	types := make([]model.RegistratietypeEnum, 0)
	seen := make(map[model.RegistratietypeEnum]bool)

	for _, raw := range rawValues {
		for _, part := range strings.Split(raw, ",") {
			value := strings.ToLower(strings.TrimSpace(part))
			if value == "" {
				continue
			}

			var t model.RegistratietypeEnum
			switch value {
			case string(model.RegistratietypeRegistratie):
				t = model.RegistratietypeRegistratie
			case string(model.RegistratietypeCorrectie):
				t = model.RegistratietypeCorrectie
			case string(model.RegistratietypeOngedaanmaking):
				t = model.RegistratietypeOngedaanmaking
			default:
				return nil, fmt.Errorf("invalid 'type' parameter value: %s", value)
			}

			if !seen[t] {
				types = append(types, t)
				seen[t] = true
			}
		}
	}

	if len(types) == 0 {
		return nil, nil
	}

	return types, nil
}

func toonAfvoerInResponse(c *gin.Context) bool {
	return c.Query("toonafvoer") == "1"
}

func removeAfvoerKeys(v any) any {
	switch t := v.(type) {
	case map[string]any:
		delete(t, "afvoer")
		for k, child := range t {
			t[k] = removeAfvoerKeys(child)
		}
		return t
	case []any:
		for i, child := range t {
			t[i] = removeAfvoerKeys(child)
		}
		return t
	default:
		return v
	}
}

func sanitizeResponseWithoutAfvoer(payload any) (any, error) {
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	var generic any
	if err := json.Unmarshal(b, &generic); err != nil {
		return nil, err
	}

	return removeAfvoerKeys(generic), nil
}

func structNaarMap(v any) (map[string]any, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	result := make(map[string]any)
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func entiteitNaamNaarFullPathSegment(entiteitnaam string) (string, bool) {
	meta, ok := model.MetaRegistry.GetTypeMeta(strings.TrimSpace(entiteitnaam))
	if !ok || meta.Metatype != model.MetatypeEntiteit || meta.Padnaam == "" {
		return "", false
	}

	return meta.Padnaam, true
}

func typeMetaVoorModelNaam(modelNaam string) (model.TypeMeta, bool) {
	for _, meta := range model.MetaRegistry {
		if meta.Typenaam == modelNaam {
			return meta, true
		}

		if meta.Factory != nil {
			factoryType := reflect.TypeOf(meta.Factory())
			if factoryType != nil {
				if factoryType.Kind() == reflect.Ptr {
					factoryType = factoryType.Elem()
				}
				if factoryType.Name() == modelNaam {
					return meta, true
				}
			}
		}

		if meta.DBFactory != nil {
			dbType := reflect.TypeOf(meta.DBFactory())
			if dbType != nil {
				if dbType.Kind() == reflect.Ptr {
					dbType = dbType.Elem()
				}
				if dbType.Name() == modelNaam {
					return meta, true
				}
			}
		}
	}

	return model.TypeMeta{}, false
}

type formeleTijdTarget struct {
	Entiteitnaam        string
	EntiteitIDExpr      string
	Representatienaam   string
	RepresentatieIDExpr string
}

func formeleTijdTargetVoorModel(modelNaam string) (formeleTijdTarget, error) {
	meta, ok := typeMetaVoorModelNaam(modelNaam)
	if !ok {
		return formeleTijdTarget{}, fmt.Errorf("geen metamap-entry gevonden voor model %s", modelNaam)
	}

	if meta.Tabelnaam == "" || meta.IDKolom == "" {
		return formeleTijdTarget{}, fmt.Errorf("onvolledige metamap voor %s: tabel of idkolom ontbreekt", meta.Typenaam)
	}

	if meta.Metatype == model.MetatypeEntiteit {
		return formeleTijdTarget{
			Entiteitnaam:        meta.Typenaam,
			EntiteitIDExpr:      fmt.Sprintf("%s.%s::text", meta.Tabelnaam, meta.IDKolom),
			Representatienaam:   "",
			RepresentatieIDExpr: "''",
		}, nil
	}

	bovenliggend, ok := model.MetaRegistry.GetBovenliggendeRelatieMeta(meta.Typenaam)
	if !ok {
		return formeleTijdTarget{}, fmt.Errorf("geen bovenliggende entiteit gevonden voor type %s", meta.Typenaam)
	}
	if meta.EntiteitIDKolom == "" {
		return formeleTijdTarget{}, fmt.Errorf("entiteit FK ontbreekt in metamap voor type %s", meta.Typenaam)
	}

	return formeleTijdTarget{
		Entiteitnaam:        bovenliggend.ParentType.Typenaam,
		EntiteitIDExpr:      fmt.Sprintf("%s.%s::text", meta.Tabelnaam, meta.EntiteitIDKolom),
		Representatienaam:   meta.Typenaam,
		RepresentatieIDExpr: fmt.Sprintf("%s.%s::text", meta.Tabelnaam, meta.IDKolom),
	}, nil
}

func applyFormeleTijdFilterVoorModel(query *bun.SelectQuery, modelNaam string, peiltijdstip time.Time) *bun.SelectQuery {
	const activeWijziging = string(model.WijzigingstypeOpvoer)
	target, err := formeleTijdTargetVoorModel(modelNaam)
	if err != nil {
		if debugLogsEnabled() {
			fmt.Printf("HANDLER (full): formele tijdfilter fallback voor model %s: %v\n", modelNaam, err)
		}
		return query.Where("opvoer <= ?", peiltijdstip).
			Where("(afvoer IS NULL OR afvoer > ?)", peiltijdstip)
	}

	return query.Where(fmt.Sprintf(`
		(
			SELECT v.wijzigingstype
			FROM f_formele_wijziging_op_peil(?) AS v
			WHERE v.entiteitnaam = ?
			  AND v.entiteit_id = %s
			  AND v.representatienaam = ?
			  AND v.representatie_id = %s
			ORDER BY v.registratie_tijdstip DESC, v.wijziging_id DESC
			LIMIT 1
		) = ?
	`, target.EntiteitIDExpr, target.RepresentatieIDExpr), peiltijdstip, target.Entiteitnaam, target.Representatienaam, activeWijziging)
}

type laatsteWijzigingOpPeil struct {
	Wijzigingstype      model.WijzigingstypeEnum `bun:"wijzigingstype"`
	RegistratieTijdstip time.Time                `bun:"registratie_tijdstip"`
}

func haalLaatsteNietOngedaanGemaakteWijzigingOpPeil(
	c *gin.Context,
	entiteitnaam string,
	entiteitID string,
	representatienaam string,
	representatieID string,
	peiltijdstip time.Time,
) (*laatsteWijzigingOpPeil, error) {
	row := new(laatsteWijzigingOpPeil)
	err := DB.NewSelect().
		TableExpr("f_formele_wijziging_op_peil(?) AS v", peiltijdstip).
		ColumnExpr("v.wijzigingstype").
		ColumnExpr("v.registratie_tijdstip").
		Where("v.entiteitnaam = ?", entiteitnaam).
		Where("v.entiteit_id = ?", entiteitID).
		Where("v.representatienaam = ?", representatienaam).
		Where("v.representatie_id = ?", representatieID).
		OrderExpr("v.registratie_tijdstip DESC, v.wijziging_id DESC").
		Limit(1).
		Scan(c.Request.Context(), row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return row, nil
}

func zetAfgeleideFormeleTijdVoorRepresentatie(
	c *gin.Context,
	representatie model.HeeftOpvoerAfvoer,
	entiteitnaam string,
	entiteitID string,
	representatienaam string,
	representatieID string,
	peiltijdstip time.Time,
) error {
	wijziging, err := haalLaatsteNietOngedaanGemaakteWijzigingOpPeil(
		c,
		entiteitnaam,
		entiteitID,
		representatienaam,
		representatieID,
		peiltijdstip,
	)
	if err != nil {
		return err
	}

	representatie.SetOpvoer(nil)
	representatie.SetAfvoer(nil)

	if wijziging == nil {
		return nil
	}

	t := wijziging.RegistratieTijdstip
	switch wijziging.Wijzigingstype {
	case model.WijzigingstypeOpvoer:
		representatie.SetOpvoer(&t)
	case model.WijzigingstypeAfvoer:
		representatie.SetAfvoer(&t)
	}

	return nil
}

// entiteitMetaVoorFullEntity bepaalt op basis van het concrete full-model de bijbehorende
// entiteit-meta uit de MetaRegistry. De functie verwacht een niet-nil pointer naar een full entiteit.
func entiteitMetaVoorFullEntity(entity any) (model.TypeMeta, error) {
	v := reflect.ValueOf(entity)
	if !v.IsValid() || v.Kind() != reflect.Ptr || v.IsNil() {
		return model.TypeMeta{}, fmt.Errorf("full entity moet een niet-nil pointer zijn")
	}

	modelNaam := v.Elem().Type().Name()
	meta, ok := typeMetaVoorModelNaam(modelNaam)
	if !ok {
		return model.TypeMeta{}, fmt.Errorf("geen metamap-entry gevonden voor full entity model %s", modelNaam)
	}
	if meta.Metatype != model.MetatypeEntiteit {
		return model.TypeMeta{}, fmt.Errorf("type %s is geen entiteit", meta.Typenaam)
	}

	return meta, nil
}

// vulAfgeleideFormeleTijdVoorFullSlice verwerkt een volledige lijst van full entiteiten generiek.
// Dit vervangt hardcoded type-switches op A/B: elk slice-element wordt als pointer
// doorgegeven aan de generieke entity-routine hieronder.
func vulAfgeleideFormeleTijdVoorFullSlice(c *gin.Context, entities any, peiltijdstip time.Time) error {
	v := reflect.ValueOf(entities)
	if !v.IsValid() || v.Kind() != reflect.Ptr || v.IsNil() {
		return fmt.Errorf("entities moet een niet-nil pointer naar slice zijn")
	}

	sliceValue := v.Elem()
	if sliceValue.Kind() != reflect.Slice {
		return fmt.Errorf("entities moet een pointer naar slice zijn")
	}

	for i := 0; i < sliceValue.Len(); i++ {
		entityPtr := sliceValue.Index(i).Addr().Interface()
		if err := vulAfgeleideFormeleTijdVoorFullEntity(c, entityPtr, peiltijdstip); err != nil {
			return err
		}
	}

	return nil
}

// vulAfgeleideFormeleTijdVoorFullEntity leidt opvoer/afvoer af voor een full entiteit en
// haar onderliggende representaties via interfaces i.p.v. concrete type-switches.
// Vereiste interfaces op de entiteit:
// - HasID: voor entiteit-ID
// - HeeftOpvoerAfvoer: voor opvoer/afvoer op entiteitsniveau
// - HeeftOnderliggendeGegevenselementen: voor iteratie over kind-representaties
func vulAfgeleideFormeleTijdVoorFullEntity(c *gin.Context, entity any, peiltijdstip time.Time) error {
	meta, err := entiteitMetaVoorFullEntity(entity)
	if err != nil {
		return err
	}

	hasID, ok := entity.(model.HasID)
	if !ok {
		return fmt.Errorf("full entity %s implementeert HasID niet", meta.Typenaam)
	}

	formeleEntiteit, ok := entity.(model.HeeftOpvoerAfvoer)
	if !ok {
		return fmt.Errorf("full entity %s implementeert HeeftOpvoerAfvoer niet", meta.Typenaam)
	}

	entiteitID := fmt.Sprint(hasID.GetID())
	if err := zetAfgeleideFormeleTijdVoorRepresentatie(c, formeleEntiteit, meta.Typenaam, entiteitID, "", "", peiltijdstip); err != nil {
		return err
	}

	metKinderen, ok := entity.(model.HeeftOnderliggendeGegevenselementen)
	if !ok {
		return nil
	}

	for _, kind := range metKinderen.GeefOnderliggendeGegevenselementen() {
		if kind.Representatie == nil {
			continue
		}

		repID := fmt.Sprint(kind.Representatie.GetID())
		if err := zetAfgeleideFormeleTijdVoorRepresentatie(c, kind.Representatie, meta.Typenaam, entiteitID, kind.Typenaam, repID, peiltijdstip); err != nil {
			return err
		}
	}

	return nil
}

func maakFullEntiteitLinksVoorRegistratie(reg model.Registratie) []map[string]string {
	seen := make(map[string]bool)
	links := make([]map[string]string, 0)

	for _, wijziging := range reg.Wijzigingen {
		if wijziging.Entiteitnaam == "" || wijziging.EntiteitID == "" {
			continue
		}
		segment, ok := entiteitNaamNaarFullPathSegment(wijziging.Entiteitnaam)
		if !ok {
			continue
		}
		link := fmt.Sprintf("%s/%s", segment, wijziging.EntiteitID)
		if !seen[link] {
			seen[link] = true
			links = append(links, map[string]string{"href": link})
		}
	}

	return links
}

// MakeGetRegistratiesMetWijzigingenHandler returns registraties with child wijzigingen.
// Bij peiltijdstip-filter geldt voor beide: tijdstip <= peiltijdstip.
func MakeGetRegistratiesMetWijzigingenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		const (
			defaultPage = 1
			defaultSize = 20
			maxSize     = 100
		)

		page := defaultPage
		size := defaultSize

		if p := c.Query("page"); p != "" {
			v, err := strconv.Atoi(p)
			if err != nil || v <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'page' parameter"})
				return
			}
			page = v
		}

		if s := c.Query("size"); s != "" {
			v, err := strconv.Atoi(s)
			if err != nil || v <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'size' parameter"})
				return
			}
			if v > maxSize {
				size = maxSize
			} else {
				size = v
			}
		}

		offset := (page - 1) * size

		ta, tb, err := parseRegistratieIntervalUitQuerystring(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		typeFilter, err := parseRegistratietypesUitQuerystring(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		peiltijdstip, err := parsePeiltijdstipUitQuerystring(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		registraties := make([]model.Registratie, 0)
		query := DB.NewSelect().Model(&registraties)
		if len(typeFilter) > 0 {
			query = query.Where("registratietype IN (?)", bun.In(typeFilter))
		}
		if ta != nil || tb != nil {
			if ta != nil {
				query = query.Where("tijdstip >= ?", *ta)
			}
			if tb != nil {
				query = query.Where("tijdstip <= ?", *tb)
			}
			query = query.Relation("Wijzigingen", func(relQuery *bun.SelectQuery) *bun.SelectQuery {
				if ta != nil {
					relQuery = relQuery.Where("tijdstip >= ?", *ta)
				}
				if tb != nil {
					relQuery = relQuery.Where("tijdstip <= ?", *tb)
				}
				return relQuery
			})
		} else if peiltijdstip != nil {
			query = query.Where("tijdstip <= ?", *peiltijdstip)
			query = query.Relation("Wijzigingen", func(relQuery *bun.SelectQuery) *bun.SelectQuery {
				return relQuery.Where("tijdstip <= ?", *peiltijdstip)
			})
		} else {
			query = query.Relation("Wijzigingen")
		}

		err = query.
			Limit(size).
			Offset(offset).
			Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		hasMore := len(registraties) == size
		registratieResponses := make([]any, 0, len(registraties))
		for _, reg := range registraties {
			regMap, err := structNaarMap(reg)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to map registratie response: %v", err)})
				return
			}
			regMap["full_entiteit_links"] = maakFullEntiteitLinksVoorRegistratie(reg)
			registratieResponses = append(registratieResponses, regMap)
		}

		c.JSON(http.StatusOK, gin.H{
			"Registraties": registratieResponses,
			"page":         page,
			"size":         size,
			"has_more":     hasMore,
		})
	}
}

// MakeGetRegistratieMetWijzigingenByIDHandler returns one registratie by id with child wijzigingen.
func MakeGetRegistratieMetWijzigingenByIDHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		idParam := c.Param("id")
		if idParam == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID must be present"})
			return
		}

		if _, err := strconv.Atoi(idParam); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'id' parameter"})
			return
		}

		var reg model.Registratie
		err := DB.NewSelect().
			Model(&reg).
			Where("id = ?", idParam).
			Relation("Wijzigingen").
			Scan(c.Request.Context())
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"message": "Registratie not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		regMap, err := structNaarMap(reg)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to map registratie response: %v", err)})
			return
		}
		regMap["full_entiteit_links"] = maakFullEntiteitLinksVoorRegistratie(reg)

		c.JSON(http.StatusOK, regMap)
	}
}

// addOnderliggendeRelations voegt Relation()-calls toe aan een Bun query voor alle
// directe kinderen van een type, inclusief geneste relaties voor hubs.
//
// v06: Hub-types (GESubtypeHub) hebben eigen onderliggende (Data, Aanvang, Einde).
// Deze worden als geneste Relation() calls toegevoegd zodat Bun ze in één query
// meeneemt. Bij peiltijdstip-filtering wordt ook op het geneste niveau gefilterd.
func addOnderliggendeRelations(query *bun.SelectQuery, meta model.TypeMeta, peiltijdstip *time.Time) *bun.SelectQuery {
	for _, rel := range meta.OnderliggendeGegevenselementen {
		capturedRel := rel
		childMeta, childOK := model.MetaRegistry.GetTypeMeta(capturedRel.Doeltype)

		// Controleer of het kind een hub is met eigen onderliggende (Data/Aanvang/Einde)
		isHub := childOK && childMeta.GESubtype == model.GESubtypeHub && len(childMeta.OnderliggendeGegevenselementen) > 0

		if isHub {
			capturedChildMeta := childMeta
			query = query.Relation(capturedRel.Rolnaam, func(q *bun.SelectQuery) *bun.SelectQuery {
				if peiltijdstip != nil {
					q = applyFormeleTijdFilterVoorModel(q, capturedRel.Doeltype, *peiltijdstip)
				}
				// Geneste relaties: Data, Aanvang, Einde
				for _, grandchild := range capturedChildMeta.OnderliggendeGegevenselementen {
					capturedGC := grandchild
					if peiltijdstip != nil {
						q = q.Relation(capturedGC.Rolnaam, func(rq *bun.SelectQuery) *bun.SelectQuery {
							return applyFormeleTijdFilterVoorModel(rq, capturedGC.Doeltype, *peiltijdstip)
						})
					} else {
						q = q.Relation(capturedGC.Rolnaam)
					}
				}
				return q
			})
		} else {
			if peiltijdstip != nil {
				capturedDoeltype := capturedRel.Doeltype
				query = query.Relation(capturedRel.Rolnaam, func(relQuery *bun.SelectQuery) *bun.SelectQuery {
					return applyFormeleTijdFilterVoorModel(relQuery, capturedDoeltype, *peiltijdstip)
				})
			} else {
				query = query.Relation(capturedRel.Rolnaam)
			}
		}
	}
	return query
}

// MakeGetFullEntitiesByMetaHandler returns a gin.HandlerFunc that retrieves full entities defined by TypeMeta.Factory.
func MakeGetFullEntitiesByMetaHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		const (
			defaultPage = 1
			defaultSize = 20
			maxSize     = 100
		)

		if meta.Factory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Factory ontbreekt voor type " + meta.Typenaam})
			return
		}
		if meta.SliceFactory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "SliceFactory ontbreekt voor type " + meta.Typenaam})
			return
		}

		page := defaultPage
		size := defaultSize

		if p := c.Query("page"); p != "" {
			v, err := strconv.Atoi(p)
			if err != nil || v <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'page' parameter"})
				return
			}
			page = v
		}

		if s := c.Query("size"); s != "" {
			v, err := strconv.Atoi(s)
			if err != nil || v <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'size' parameter"})
				return
			}
			if v > maxSize {
				size = maxSize
			} else {
				size = v
			}
		}

		offset := (page - 1) * size
		entities := meta.SliceFactory()
		query := DB.NewSelect().Model(entities)

		peiltijdstip, err := parsePeiltijdstipUitQuerystring(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if peiltijdstip != nil {
			query = applyFormeleTijdFilterVoorModel(query, meta.Typenaam, *peiltijdstip)
		}

		query = addOnderliggendeRelations(query, meta, peiltijdstip)

		err = query.
			Limit(size).
			Offset(offset).
			Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if peiltijdstip != nil {
			if err := vulAfgeleideFormeleTijdVoorFullSlice(c, entities, *peiltijdstip); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to derive formele tijdstippen: %v", err)})
				return
			}
		}

		total, err := DB.NewSelect().Model(meta.Factory()).Count(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		hasMore := offset+size < total

		responseEntities := entities
		if !toonAfvoerInResponse(c) {
			responseEntities, err = sanitizeResponseWithoutAfvoer(entities)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to sanitize response: %v", err)})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{
			meta.Typenaam + "s": responseEntities,
			"page":              page,
			"size":              size,
			"has_more":          hasMore,
		})
	}
}

// MakeGetFullEntityByMetaHandler returns a gin.HandlerFunc that retrieves one full entity by meta.IDKolom.
func MakeGetFullEntityByMetaHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		if meta.Factory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Factory ontbreekt voor type " + meta.Typenaam})
			return
		}
		if meta.IDKolom == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "IDKolom ontbreekt voor type " + meta.Typenaam})
			return
		}

		entityID := c.Param("id")
		if entityID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID must be present"})
			return
		}

		entity := meta.Factory()
		hasID, ok := entity.(model.HasID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Factory levert geen HasID voor type " + meta.Typenaam})
			return
		}

		query := DB.NewSelect().Model(entity)

		peiltijdstip, err := parsePeiltijdstipUitQuerystring(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if peiltijdstip != nil {
			query = applyFormeleTijdFilterVoorModel(query, meta.Typenaam, *peiltijdstip)
		}

		query = addOnderliggendeRelations(query, meta, peiltijdstip)

		err = query.
			Where(meta.IDKolom+" = ?", entityID).
			Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if peiltijdstip != nil {
			if err := vulAfgeleideFormeleTijdVoorFullEntity(c, entity, *peiltijdstip); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to derive formele tijdstippen: %v", err)})
				return
			}
		}

		if isZeroID(hasID.GetID()) {
			c.JSON(http.StatusNotFound, gin.H{"message": meta.Typenaam + " not found"})
			return
		}

		var responseEntity any = entity
		if !toonAfvoerInResponse(c) {
			responseEntity, err = sanitizeResponseWithoutAfvoer(entity)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to sanitize response: %v", err)})
				return
			}
		}

		c.JSON(http.StatusOK, responseEntity)
	}
}

// MakeAddFullEntityByMetaHandler returns a gin.HandlerFunc that inserts one full entity and its child relations defined in the metaregistry.
func MakeAddFullEntityByMetaHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		if meta.Factory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Factory ontbreekt voor type " + meta.Typenaam})
			return
		}

		entity := meta.Factory()
		hasID, ok := entity.(model.HasID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Factory levert geen HasID voor type " + meta.Typenaam})
			return
		}

		if err := c.ShouldBindJSON(entity); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		LogRequestBodyAsJSON(c)

		_, err := DB.NewInsert().Model(entity).Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if len(meta.OnderliggendeGegevenselementen) > 0 {
			entityValue := reflect.ValueOf(entity)
			if entityValue.Kind() != reflect.Ptr || entityValue.IsNil() {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Factory levert geen pointer voor type %s", meta.Typenaam)})
				return
			}
			entityElem := entityValue.Elem()
			entityType := entityElem.Type()
			parentID := hasID.GetID()

			for _, rel := range meta.OnderliggendeGegevenselementen {
				relationName := rel.Rolnaam
				relField, found := entityType.FieldByName(relationName)
				if !found {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("relation field '%s' not found", relationName)})
					return
				}

				bunTag := relField.Tag.Get("bun")
				if bunTag == "" {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("bun tag not found on relation field '%s'", relationName)})
					return
				}

				fkField, _, err := parseBunRelationTag(bunTag)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to parse bun tag: %v", err)})
					return
				}

				relatedValue := entityElem.FieldByName(relationName)
				if !relatedValue.IsValid() || relatedValue.IsZero() {
					continue
				}

				if relatedValue.Kind() != reflect.Slice {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("relation field '%s' is not a slice", relationName)})
					return
				}

				for i := 0; i < relatedValue.Len(); i++ {
					relatedEntity := relatedValue.Index(i)

					if err := setForeignKeyOnRelatedEntity(relatedEntity, fkField, parentID); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to set FK: %v", err)})
						return
					}

					_, err := DB.NewInsert().Model(relatedEntity.Addr().Interface()).Exec(c.Request.Context())
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
						return
					}
				}
			}
		}

		c.JSON(http.StatusCreated, gin.H{"message": meta.Typenaam + " created"})
	}
}
