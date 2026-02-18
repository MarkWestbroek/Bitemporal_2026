package handlers

import (
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
	"github.com/gin-gonic/gin"
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

// MakeGetFullEntitiesHandler returns a gin.HandlerFunc that retrieves entities of type T with pagination
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

		// Voeg alle relaties toe
		for _, relation_name := range relation_names {
			query = query.Relation(relation_name)
		}

		err := query.
			Limit(size).
			Offset(offset).
			Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		hasMore := len(entities) == size

		c.JSON(http.StatusOK, gin.H{
			entity_name: entities,
			"page":      page,
			"size":      size,
			"has_more":  hasMore,
		})
	}
}

// MakeGetEntityHandler returns a gin.HandlerFunc that retrieves a single entity by id
func MakeGetFullEntityHandler[T model.HasID](entity_name string, relation_names []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id") // assuming the ID is a string; adjust if it's an int or another type
		if entityID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID must be present"})
			return
		}

		var entity T
		query := DB.NewSelect().Model(&entity)

		// Voeg alle relaties toe
		for _, relation_name := range relation_names {
			query = query.Relation(relation_name)
		}

		err := query.
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

		c.JSON(http.StatusOK, entity)
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
