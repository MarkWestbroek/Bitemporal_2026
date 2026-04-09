package handlers

import (
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func responseCollectionKey(meta model.TypeMeta) string {
	if strings.TrimSpace(meta.Meervoud) != "" {
		return meta.Meervoud
	}
	if strings.TrimSpace(meta.Padnaam) != "" {
		return meta.Padnaam
	}
	return meta.Typenaam + "s"
}

// zoekbareKolommen extraheert de bun-kolomnamen van alle string-velden uit het
// model dat door meta.DBFactory wordt gecreëerd. Het resultaat wordt gebruikt
// voor de ?q= ILIKE-zoekopdracht in de lijsthandler.
func zoekbareKolommen(meta model.TypeMeta) []string {
	if meta.DBFactory == nil {
		return nil
	}
	instance := meta.DBFactory()
	t := reflect.TypeOf(instance)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	var cols []string
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.Type.Kind() != reflect.String {
			continue
		}
		bunTag := f.Tag.Get("bun")
		if bunTag == "" || bunTag == "-" {
			continue
		}
		col := strings.SplitN(bunTag, ",", 2)[0]
		if col == "" {
			continue
		}
		cols = append(cols, col)
	}
	return cols
}

// alleKolommen extraheert alle bun-kolomnamen uit het model dat door meta.DBFactory
// wordt gecreëerd. Het resultaat is een set (map) voor validatie van sort/filter kolommen.
func alleKolommen(meta model.TypeMeta) map[string]bool {
	if meta.DBFactory == nil {
		return nil
	}
	instance := meta.DBFactory()
	t := reflect.TypeOf(instance)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	cols := make(map[string]bool)
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		bunTag := f.Tag.Get("bun")
		if bunTag == "" || bunTag == "-" {
			continue
		}
		col := strings.SplitN(bunTag, ",", 2)[0]
		if col != "" {
			cols[col] = true
		}
	}
	return cols
}

// isVeiligeKolomnaam controleert of een kolomnaam alleen veilige tekens bevat
// (letters, cijfers, underscore). Defense-in-depth tegen SQL injection.
func isVeiligeKolomnaam(col string) bool {
	if len(col) == 0 {
		return false
	}
	for _, ch := range col {
		if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_') {
			return false
		}
	}
	return true
}

// filterClause beschrijft één WHERE-conditie met bijbehorende argumenten.
// Wordt gebruikt om dezelfde filters op zowel de data- als count-query toe te passen.
type filterClause struct {
	condition string
	args      []interface{}
}

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

// MakeGetEntitiesByMetaHandler returns a gin.HandlerFunc that retrieves entities defined by TypeMeta.DBFactory with pagination.
func MakeGetEntitiesByMetaHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		const (
			defaultPage = 1
			defaultSize = 20
			maxSize     = 100
		)

		if meta.DBFactory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "DBFactory ontbreekt voor type " + meta.Typenaam})
			return
		}
		if meta.DBSliceFactory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "DBSliceFactory ontbreekt voor type " + meta.Typenaam})
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
		entities := meta.DBSliceFactory()

		query := DB.NewSelect().
			Model(entities).
			Limit(size).
			Offset(offset)

		// Bouw een lijst van filtervoorwaarden op die zowel op de data-query als
		// de count-query worden toegepast, voor consistentie.
		var filters []filterClause

		// Optionele zoekterm: als ?q= is opgegeven, doorzoek alle string-kolommen
		// met ILIKE (case-insensitive). Handig voor combobox/autocomplete in de frontend.
		if q := strings.TrimSpace(c.Query("q")); q != "" {
			cols := zoekbareKolommen(meta)
			if len(cols) > 0 {
				var orParts []string
				var orArgs []interface{}
				pattern := "%" + q + "%"
				for _, col := range cols {
					orParts = append(orParts, fmt.Sprintf("%s ILIKE ?", col))
					orArgs = append(orArgs, pattern)
				}
				filters = append(filters, filterClause{
					condition: "(" + strings.Join(orParts, " OR ") + ")",
					args:      orArgs,
				})
			}
		}

		// Veldspecifiek filteren: ?filter.naam=jan&filter.status=actief
		// Elke filter wordt als AND-conditie toegevoegd (ILIKE, case-insensitive).
		allCols := alleKolommen(meta)
		for key, values := range c.Request.URL.Query() {
			if !strings.HasPrefix(key, "filter.") || len(values) == 0 {
				continue
			}
			col := strings.TrimPrefix(key, "filter.")
			if !allCols[col] || !isVeiligeKolomnaam(col) {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("onbekende filterkolom: %s", col)})
				return
			}
			val := strings.TrimSpace(values[0])
			if val == "" {
				continue
			}
			filters = append(filters, filterClause{
				condition: fmt.Sprintf("%s ILIKE ?", col),
				args:      []interface{}{"%" + val + "%"},
			})
		}

		// Pas alle filters toe op de data-query
		for _, f := range filters {
			query = query.Where(f.condition, f.args...)
		}

		// Sortering: ?sort=kolom&order=asc|desc
		if sortCol := c.Query("sort"); sortCol != "" {
			if !allCols[sortCol] || !isVeiligeKolomnaam(sortCol) {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("onbekende sorteerkolom: %s", sortCol)})
				return
			}
			order := "ASC"
			if strings.EqualFold(c.Query("order"), "desc") {
				order = "DESC"
			}
			query = query.OrderExpr(fmt.Sprintf("%s %s", sortCol, order))
		}

		err := query.Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Count-query met dezelfde filters voor consistente paginering
		countQuery := DB.NewSelect().Model(meta.DBFactory())
		for _, f := range filters {
			countQuery = countQuery.Where(f.condition, f.args...)
		}
		total, err := countQuery.Count(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		hasMore := offset+size < total

		c.JSON(http.StatusOK, gin.H{
			responseCollectionKey(meta): entities,
			"page":                      page,
			"size":                      size,
			"has_more":                  hasMore,
			"total_count":               total,
		})
	}
}

// MakeGetEntityByMetaHandler returns a gin.HandlerFunc that retrieves a single entity by meta.IDKolom.
func MakeGetEntityByMetaHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		if meta.DBFactory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "DBFactory ontbreekt voor type " + meta.Typenaam})
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

		entity := meta.DBFactory()
		err := DB.NewSelect().
			Model(entity).
			Where(meta.IDKolom+" = ?", entityID).
			Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if isZeroID(entity.GetID()) {
			c.JSON(http.StatusNotFound, gin.H{"message": meta.Typenaam + " not found"})
			return
		}

		c.JSON(http.StatusOK, entity)
	}
}

// MakeAddEntityByMetaHandler returns a gin.HandlerFunc that inserts an entity created by TypeMeta.DBFactory.
func MakeAddEntityByMetaHandler(meta model.TypeMeta) gin.HandlerFunc {
	return func(c *gin.Context) {
		if meta.DBFactory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "DBFactory ontbreekt voor type " + meta.Typenaam})
			return
		}

		newEntity := meta.DBFactory()
		if err := c.ShouldBindJSON(newEntity); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		_, err := DB.NewInsert().Model(newEntity).Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": meta.Typenaam + " created"})
	}
}
