package handlers

import (
	"net/http"
	"strconv"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v04/model"
	"github.com/gin-gonic/gin"
)

// TODO: full entity get and post to include all fields, not just ID.
// This will require changes to the model structs and the handlers
// to bind JSON to the full struct instead of just an ID field.
// The current implementation is a simplified version for demonstration purposes.

/*
Updated MakeGetEntitiesHandler in core_handlers.go to:
	-Parse query params page (default 1) and size (default 20, capped at 100).
	-Validate parameters (respond 400 on invalid values).
	-Apply Limit(size) and Offset((page-1)*size) to the Bun query.
	-Return JSON with the entities and pagination metadata:
		- page, size, has_more (true if returned count == page size).

Why this approach
-Uses simple offset pagination which is easy to consume and implement with Bun.
-Returning has_more avoids an extra COUNT query and is efficient for common use cases.
*/

// MakeAddEntityHandler returns a gin.HandlerFunc that creates a fresh zero-value entity
// for each request and inserts it into the DB after binding JSON.
func MakeAddEntityHandler[T model.HasID](entity_name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var newEntity T
		if err := c.ShouldBindJSON(&newEntity); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

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
		_, err := DB.NewInsert().Model(&newEntity).Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": entity_name + " created"})
	}
}

// MakeGetEntitiesHandler returns a gin.HandlerFunc that retrieves entities of type T with pagination
func MakeGetEntitiesHandler[T any](entity_name string) gin.HandlerFunc {
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
		err := DB.NewSelect().
			Model(&entities). // laadt alleen de entiteiten, zonder gerelateerde gegevenselementen
			Limit(size).
			Offset(offset).
			Scan(c.Request.
				Context())
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
func MakeGetEntityHandler[T model.HasID](entity_name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		if entityID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID must be present"})
			return
		}

		var entity T
		err := DB.NewSelect().Model(&entity).Where("id = ?", entityID).Scan(c.Request.Context())
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
