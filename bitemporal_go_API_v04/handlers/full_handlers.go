package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v04/model"
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
	switch strings.ToUpper(strings.TrimSpace(entiteitnaam)) {
	case "A":
		return "as", true
	case "B":
		return "bs", true
	default:
		return "", false
	}
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

// MakeGetFullEntitiesHandler returns a gin.HandlerFunc that retrieves entities of type T with pagination.
// Als `peiltijdstip` is meegegeven, worden alleen records geretourneerd die op dat
// formele tijdstip actief zijn: opvoer <= peiltijdstip en (afvoer IS NULL of afvoer > peiltijdstip).
func MakeGetFullEntitiesHandler[T any](entity_name string, relation_names []string) gin.HandlerFunc {
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

		var entities []T
		query := DB.NewSelect().Model(&entities)

		peiltijdstip, err := parsePeiltijdstipUitQuerystring(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if peiltijdstip != nil {
			query = query.Where("opvoer <= ?", *peiltijdstip).
				Where("(afvoer IS NULL OR afvoer > ?)", *peiltijdstip)
		}

		// Voeg alle relaties toe
		for _, relation_name := range relation_names {
			if peiltijdstip != nil {
				query = query.Relation(relation_name, func(relQuery *bun.SelectQuery) *bun.SelectQuery {
					return relQuery.Where("opvoer <= ?", *peiltijdstip).
						Where("(afvoer IS NULL OR afvoer > ?)", *peiltijdstip)
				})
			} else {
				query = query.Relation(relation_name)
			}
		}

		err = query.
			Limit(size).
			Offset(offset).
			Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		hasMore := len(entities) == size
		responseEntities := any(entities)
		if !toonAfvoerInResponse(c) {
			responseEntities, err = sanitizeResponseWithoutAfvoer(entities)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to sanitize response: %v", err)})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{
			entity_name: responseEntities,
			"page":      page,
			"size":      size,
			"has_more":  hasMore,
		})
	}
}

// MakeGetFullEntityHandler returns a gin.HandlerFunc that retrieves a single entity by id.
// Als `peiltijdstip` is meegegeven, wordt dezelfde formele-tijd filter toegepast als
// in MakeGetFullEntitiesHandler.
func MakeGetFullEntityHandler[T model.HasID](entity_name string, relation_names []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id") // assuming the ID is a string; adjust if it's an int or another type
		if entityID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID must be present"})
			return
		}

		var entity T
		query := DB.NewSelect().Model(&entity)

		peiltijdstip, err := parsePeiltijdstipUitQuerystring(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if peiltijdstip != nil {
			query = query.Where("opvoer <= ?", *peiltijdstip).
				Where("(afvoer IS NULL OR afvoer > ?)", *peiltijdstip)
		}

		// Voeg alle relaties toe
		for _, relation_name := range relation_names {
			if peiltijdstip != nil {
				query = query.Relation(relation_name, func(relQuery *bun.SelectQuery) *bun.SelectQuery {
					return relQuery.Where("opvoer <= ?", *peiltijdstip).
						Where("(afvoer IS NULL OR afvoer > ?)", *peiltijdstip)
				})
			} else {
				query = query.Relation(relation_name)
			}
		}

		err = query.
			Where("id = ?", entityID).
			Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if isZeroID(entity.GetID()) {
			c.JSON(http.StatusNotFound, gin.H{"message": entity_name + " not found"})
			return
		}

		responseEntity := any(entity)
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

// MakeAddFullEntityHandler returns a gin.HandlerFunc that creates a fresh zero-value entity
// for each request and inserts it into the DB after binding JSON.
// This is to add the Full Entity, that is: including related data elements (that link to the entity by a FK)
func MakeAddFullEntityHandler[T model.HasID](entity_name string, relation_names []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var newEntity T
		if err := c.ShouldBindJSON(&newEntity); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// output request body for debugging as pretty JSON
		LogRequestBodyAsJSON(c)

		/*
			NewInsert is a convenience method on baseQuery that creates and returns a
			new *InsertQuery already bound to the baseQuery's database handle and connection.
			Internally it calls NewInsertQuery(q.db) to create the query and then .Conn(q.conn)
			to attach the same connection/transaction context.
			The returned InsertQuery is intended for fluent chaining (e.g.,
			NewInsert().Model(m).Exec(ctx)).
			Model(...) sets the payload on the InsertQuery and Exec(...) uses scanOrExec to
			either scan results into provided destinations or execute the insert, depending on whether dest args are present.

			Gotchas: NewInsert does not set a model — you must call Model
			before Exec if you expect data to be inserted/scanned. If q.conn is nil,
			Conn(nil) behavior depends on its implementation (it may fall back to using the DB directly).
			Exec delegates to scanOrExec, so check that function for how destination presence,
			errors, and result/scan semantics are handled.
		*/

		// Insert the main entity first
		_, err := DB.NewInsert().
			Model(&newEntity).
			Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Now handle related entities if relation_names are provided
		if len(relation_names) > 0 {
			entityValue := reflect.ValueOf(&newEntity).Elem()
			entityType := entityValue.Type()
			parentID := newEntity.GetID()

			// Itereer door alle relaties
			for _, relation_name := range relation_names {
				// Find the field by name
				relField, found := entityType.FieldByName(relation_name)
				if !found {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("relation field '%s' not found", relation_name)})
					return
				}

				// Parse the bun tag to get FK info
				bunTag := relField.Tag.Get("bun")
				if bunTag == "" {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("bun tag not found on relation field '%s'", relation_name)})
					return
				}

				fkField, _, err := parseBunRelationTag(bunTag)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to parse bun tag: %v", err)})
					return
				}

				// Get the relation field value (should be a slice)
				relatedValue := entityValue.FieldByName(relation_name)
				if !relatedValue.IsValid() || relatedValue.IsZero() {
					// No related entities to insert for this relation, continue to next
					continue
				}

				if relatedValue.Kind() != reflect.Slice {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("relation field '%s' is not a slice", relation_name)})
					return
				}

				// Insert each related entity
				for i := 0; i < relatedValue.Len(); i++ {
					relatedEntity := relatedValue.Index(i)

					// Set the FK on the related entity
					if err := setForeignKeyOnRelatedEntity(relatedEntity, fkField, parentID); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to set FK: %v", err)})
						return
					}

					// Insert the related entity
					_, err := DB.NewInsert().
						Model(relatedEntity.Addr().Interface()).
						Exec(c.Request.Context())
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to insert related entity: %v", err)})
						return
					}
				}
			}
		}

		c.JSON(http.StatusCreated, gin.H{"message": entity_name + " created"})
	}
}
