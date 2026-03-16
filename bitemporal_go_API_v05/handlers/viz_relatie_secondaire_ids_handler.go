package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v05/model"
	"github.com/gin-gonic/gin"
)

type vizRelatieSecondaireIDsResponse struct {
	Typenaam                  string `json:"typenaam"`
	SecondaireEntiteitType    string `json:"secondaireEntiteitType"`
	SecondaireEntiteitIDKolom string `json:"secondaireEntiteitIDKolom"`
	IDs                       []int  `json:"ids"`
}

// Leidt uit een FK-kolomnaam zoals "b_id" het entiteittype "B" af.
func entiteitTypeUitKolomnaam(kolomnaam string) string {
	prefix := strings.ToUpper(strings.TrimSpace(strings.Split(kolomnaam, "_")[0]))
	if prefix == "" {
		return ""
	}
	return prefix
}

// Parse een positieve query-int met default en bovengrens (voor veilige API-calls).
func parsePositiveInt(c *gin.Context, name string, defaultValue int, maxValue int) (int, error) {
	raw := strings.TrimSpace(c.Query(name))
	if raw == "" {
		return defaultValue, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return 0, err
	}
	if v > maxValue {
		v = maxValue
	}
	return v, nil
}

// MaakVizRelatieSecondaireIDsHandler levert suggesties voor secundaire entiteit-ID's
// bij een relatie-type. Dit wordt in de frontend gebruikt als dropdown-opties.
func MaakVizRelatieSecondaireIDsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if DB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database not initialized"})
			return
		}

		typeNaam := strings.TrimSpace(c.Param("typenaam"))
		if typeNaam == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "type naam ontbreekt"})
			return
		}

		relatieMeta, ok := model.MetaRegistry.GetTypeMeta(typeNaam)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "onbekend type"})
			return
		}
		if relatieMeta.Metatype != model.MetatypeRelatie {
			c.JSON(http.StatusBadRequest, gin.H{"error": "type is geen relatie"})
			return
		}
		if strings.TrimSpace(relatieMeta.SecondaireEntiteitIDKolom) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "relatie heeft geen secondaire entiteit-id kolom"})
			return
		}

		// Limit voorkomt dat de endpoint per ongeluk te veel IDs terugstuurt.
		limit, err := parsePositiveInt(c, "limit", 200, 2000)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige limit parameter"})
			return
		}

		secondaireEntiteitType := entiteitTypeUitKolomnaam(relatieMeta.SecondaireEntiteitIDKolom)
		if secondaireEntiteitType == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "kan secondaire entiteittype niet afleiden"})
			return
		}

		secondaireMeta, ok := model.MetaRegistry.GetTypeMeta(secondaireEntiteitType)
		if !ok || secondaireMeta.Metatype != model.MetatypeEntiteit {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "kan secondaire entiteitmeta niet vinden"})
			return
		}

		ids := make([]int, 0)
		// Alleen actieve (niet-afgevoerde) secondaire entiteiten aanbieden,
		// zodat de UI niet naar afgesloten records linkt.
		err = DB.NewSelect().
			Table(secondaireMeta.Tabelnaam).
			Column(secondaireMeta.IDKolom).
			Distinct().
			Where("afvoer IS NULL").
			OrderExpr(secondaireMeta.IDKolom+" ASC").
			Limit(limit).
			Scan(c.Request.Context(), &ids)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, vizRelatieSecondaireIDsResponse{
			Typenaam:                  relatieMeta.Typenaam,
			SecondaireEntiteitType:    secondaireEntiteitType,
			SecondaireEntiteitIDKolom: relatieMeta.SecondaireEntiteitIDKolom,
			IDs:                       ids,
		})
	}
}
