package handlers

import (
	"fmt"
	"net/http"
	"reflect"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// vindDataMeta zoekt de data-TypeMeta van een referentielijst_item-entiteit:
// Entiteit → Hub GE (eerste onderliggende) → Data GE (via DataTypenaam).
// Retourneert ook de EntiteitIDKolom van het hub-GE (bijv. "gemeente_id").
func vindDataMeta(entiteitMeta model.TypeMeta) (dataMeta model.TypeMeta, entiteitIDKolom string, ok bool) {
	if len(entiteitMeta.OnderliggendeGegevenselementen) == 0 {
		return model.TypeMeta{}, "", false
	}
	// Vind het eerste hub-GE
	for _, oge := range entiteitMeta.OnderliggendeGegevenselementen {
		hubMeta, found := model.MetaRegistry.GetTypeMeta(oge.Doeltype)
		if !found || hubMeta.GESubtype != model.GESubtypeHub {
			continue
		}
		if hubMeta.DataTypenaam == "" {
			continue
		}
		dm, found := model.MetaRegistry.GetTypeMeta(hubMeta.DataTypenaam)
		if !found {
			continue
		}
		return dm, hubMeta.EntiteitIDKolom, true
	}
	return model.TypeMeta{}, "", false
}

// zoekbareKolommenVanFactory extraheert kolomnamen van string-velden uit een
// Representatie factory. Vergelijkbaar met zoekbareKolommen maar accepteert
// een losse factory-functie.
// Prioriteit: bun-tag > json-tag > veldnaam (lowercase). Velden zonder
// kolom­naam (bun:"-" of json:"-") worden overgeslagen.
func zoekbareKolommenVanFactory(factory func() model.Representatie) []string {
	if factory == nil {
		return nil
	}
	t := reflect.TypeOf(factory())
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	var cols []string
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.Type.Kind() != reflect.String {
			continue
		}
		// Probeer bun-tag eerst
		bunTag := f.Tag.Get("bun")
		if bunTag == "-" {
			continue
		}
		col := strings.SplitN(bunTag, ",", 2)[0]
		if col == "" {
			// Geen bun-tag: val terug op json-tag
			jsonTag := f.Tag.Get("json")
			if jsonTag == "-" {
				continue
			}
			col = strings.SplitN(jsonTag, ",", 2)[0]
		}
		if col == "" {
			// Geen json-tag: gebruik veldnaam als lowercase kolomnaam
			col = strings.ToLower(f.Name)
		}
		cols = append(cols, col)
	}
	return cols
}

// reflijstOptie is een lichtgewicht optie voor de combobox: entiteit-ID + weergavevelden.
type reflijstOptie struct {
	ID     any               `json:"id"`
	Velden map[string]string `json:"velden"`
}

// MaakVizReflijstOptiesHandler levert {id, velden}-opties voor een referentielijst_item-type.
// Handig voor combobox/autocomplete in de frontend.
//
// GET /api/viz/reflijst/:typenaam/opties?q=&size=50
//
// - typenaam: de typenaam van de entiteit (bijv. "Gemeente")
// - q:        optionele zoekterm (ILIKE op string-kolommen in de data-tabel)
// - size:     max aantal resultaten (standaard 50, max 200)
func MaakVizReflijstOptiesHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if DB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database not initialized"})
			return
		}

		typenaam := strings.TrimSpace(c.Param("typenaam"))
		if typenaam == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "typenaam ontbreekt"})
			return
		}

		entiteitMeta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "onbekend type: " + typenaam})
			return
		}
		if entiteitMeta.EntiteitSubtype != model.EntiteitSubtypeReferentielijstItem {
			c.JSON(http.StatusBadRequest, gin.H{"error": "type is geen referentielijst_item"})
			return
		}

		dataMeta, entiteitIDKolom, ok := vindDataMeta(entiteitMeta)
		if !ok || dataMeta.DBSliceFactory == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "data-type niet gevonden voor " + typenaam})
			return
		}

		size := 50
		if s := strings.TrimSpace(c.Query("size")); s != "" {
			var v int
			if _, err := fmt.Sscan(s, &v); err == nil && v > 0 {
				if v > 500 {
					v = 500
				}
				size = v
			}
		}

		ctx := c.Request.Context()

		query := DB.NewSelect().
			Table(dataMeta.Tabelnaam).
			Where("afvoer IS NULL").
			Limit(size)

		// Optionele zoekterm
		stringCols := zoekbareKolommenVanFactory(dataMeta.DBFactory)
		if q := strings.TrimSpace(c.Query("q")); q != "" && len(stringCols) > 0 {
			var clauses []string
			var args []interface{}
			pattern := "%" + q + "%"
			for _, col := range stringCols {
				clauses = append(clauses, fmt.Sprintf("%s ILIKE ?", col))
				args = append(args, pattern)
			}
			query = query.Where("("+strings.Join(clauses, " OR ")+")", args...)
		}

		// Selecteer alleen de entiteit-ID-kolom en string-kolommen
		selectCols := []string{entiteitIDKolom}
		selectCols = append(selectCols, stringCols...)
		query = query.Column(selectCols...)

		rows, err := query.Rows(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		columns, err := rows.Columns()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var opties []reflijstOptie
		for rows.Next() {
			vals := make([]interface{}, len(columns))
			ptrs := make([]interface{}, len(columns))
			for i := range vals {
				ptrs[i] = &vals[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				continue
			}

			optie := reflijstOptie{Velden: make(map[string]string)}
			for i, col := range columns {
				if col == entiteitIDKolom {
					optie.ID = vals[i]
				} else {
					optie.Velden[col] = fmt.Sprint(vals[i])
				}
			}
			opties = append(opties, optie)
		}

		if opties == nil {
			opties = []reflijstOptie{}
		}

		c.JSON(http.StatusOK, gin.H{
			"typenaam": typenaam,
			"opties":   opties,
		})
	}
}
