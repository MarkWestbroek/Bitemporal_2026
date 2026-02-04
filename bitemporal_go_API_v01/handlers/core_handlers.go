package handlers

import (
	"net/http"
	"strconv"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v01/model"
	"github.com/gin-gonic/gin"
)

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

func GetEntities[T any](entity_name string, entities []T, ctx *gin.Context) {
	// Create a slice to store the retrieved entities
	//var entities []T

	// Execute the database query to retrieve entities using Go bun
	err := DB.NewSelect().Model(&entities).Scan(ctx.Request.Context())
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return the retrieved entities in the response
	ctx.JSON(http.StatusOK, gin.H{entity_name: entities})
}

func GetEntity[T model.HasID](entity_name string, entity T, c *gin.Context) {
	entityID := c.Param("id")

	// Check if the entity ID is empty
	if entityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID must be present"})
		return
	}

	//var entity T

	// Fetch specific record from the database using Go bun
	err := DB.NewSelect().Model(&entity).Where("id = ?", entityID).Scan(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if entity.GetID() == "" {
		c.JSON(http.StatusNotFound, gin.H{"message": entity_name + " not found"})
		return
	}

	c.JSON(http.StatusOK, entity)
}

/*
func UpdateTest(ctx *gin.Context) {
	testID := ctx.Param("id")

	if testID == "" {
		ctx.JSON(http.StatusNoContent, gin.H{"error": "ID must be present"})
		return
	}

	updatedTest := &model.Test{}

	// Bind JSON body to the updatedTest struct
	if err := ctx.ShouldBindJSON(updatedTest); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update the test record in the database using Go bun
	_, err := DB.NewUpdate().Model(updatedTest).
		Set("name = ?", updatedTest.Name).
		Where("id = ?", testID).
		Exec(ctx.Request.Context())

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Task updated"})
}

func RemoveTest(ctx *gin.Context) {
	testID := ctx.Param("id")

	test := &model.Test{}

	// Delete specific test record from the database
	res, err := DB.NewDelete().Model(test).Where("id = ?", testID).Exec(ctx.Request.Context())
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Check if any rows were affected by the delete operation
	if rowsAffected > 0 {
		ctx.JSON(http.StatusOK, gin.H{"message": "Test removed"})
	} else {
		ctx.JSON(http.StatusNotFound, gin.H{"message": "Test not found"})
	}
}
*/

func AddEntity[T model.HasID](entity_name string, newEntity T, ctx *gin.Context) {
	//newEntity := &model.Test{}

	if err := ctx.ShouldBindJSON(&newEntity); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Insert the new test record into the database
	_, err := DB.NewInsert().Model(newEntity).Exec(ctx.Request.Context())
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"message": entity_name + " created"})
}

// MakeAddEntityHandler returns a gin.HandlerFunc that creates a fresh zero-value entity
// for each request and inserts it into the DB after binding JSON.
func MakeAddEntityHandler[T model.HasID](entity_name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var newEntity T
		if err := c.ShouldBindJSON(&newEntity); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

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
		err := DB.NewSelect().Model(&entities).Limit(size).Offset(offset).Scan(c.Request.Context())
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

		if entity.GetID() == "" {
			c.JSON(http.StatusNotFound, gin.H{"message": entity_name + " not found"})
			return
		}

		c.JSON(http.StatusOK, entity)
	}
}
