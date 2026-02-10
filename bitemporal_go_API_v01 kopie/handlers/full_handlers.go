package handlers

import (
	"net/http"
	"strconv"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v01/model"
	"github.com/gin-gonic/gin"
)

// TODO: full entity get and post to include all fields, not just ID.
// This will require changes to the model structs and the handlers
// to bind JSON to the full struct instead of just an ID field.
// The current implementation is a simplified version for demonstration purposes.

// MakeGetFullEntitiesHandler returns a gin.HandlerFunc that retrieves entities of type T with pagination
func MakeGetFullEntitiesHandler[T any](entity_name string, relation_name string) gin.HandlerFunc {
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
			Model(&entities).
			Relation(relation_name). // laadt ook de gerelateerde gegevenselementen
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
func MakeGetFullEntityHandler[T model.HasID](entity_name string, relation_name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id") // assuming the ID is a string; adjust if it's an int or another type
		if entityID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID must be present"})
			return
		}

		var entity T
		err := DB.NewSelect().
			Model(&entity).
			Relation(relation_name). // laadt ook de gerelateerde gegevenselementen
			Where("id = ?", entityID).
			Scan(c.Request.
				Context())
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
