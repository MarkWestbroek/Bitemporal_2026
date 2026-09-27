package handlers

// validatie_api_handler.go — de validatie-API (27-09-2026): een waarde laten normaliseren en
// controleren volgens een V3Datatype, zonder iets te registreren. Dezelfde code als bij een
// registratie (model.NormaliseerWaarde, model.ValideerWaarde), dus dezelfde uitkomst.
//
//	POST /api/valideer         { "datatype": "BSN", "waarde": "123456789" }
//	                           of { "items": [ { "datatype", "waarde", "veld" }, … ] } (max 200)
//	GET  /api/valideer/functies  de benoemde functies en normalisaties die deze server kent
//
// Bedoeld als vangnet voor clients die een regel niet zelf kunnen uitvoeren (een `function`
// die de browser niet kent, een omgeving zonder evaluator), en voor andere systemen (Imprint).
// Niet per toetsaanslag aanroepen: bij het verlaten van een veld of vóór verzenden.
// Anoniem toegankelijk: het zegt alleen iets over de regels van het model, niets over data.

import (
	"net/http"
	"sort"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

const valideerMaxItems = 200

type valideerItem struct {
	Datatype string `json:"datatype"`
	Waarde   any    `json:"waarde"`
	Veld     string `json:"veld,omitempty"`
}

type valideerUitslag struct {
	Veld           string                `json:"veld,omitempty"`
	Datatype       string                `json:"datatype"`
	Bekend         bool                  `json:"bekend"`
	Geldig         bool                  `json:"geldig"`
	Genormaliseerd string                `json:"genormaliseerd"`
	Fouten         []model.ValidatieFout `json:"fouten"`
}

func valideerEen(it valideerItem) valideerUitslag {
	_, bekend := model.FindDatatype(it.Datatype)
	ruw := ""
	if it.Waarde != nil {
		ruw = model.WaardeAlsString(it.Waarde)
	}
	fouten := model.ValideerWaarde(it.Datatype, it.Waarde, it.Veld)
	if fouten == nil {
		fouten = []model.ValidatieFout{}
	}
	return valideerUitslag{
		Veld:           it.Veld,
		Datatype:       it.Datatype,
		Bekend:         bekend,
		Geldig:         len(fouten) == 0,
		Genormaliseerd: model.NormaliseerWaarde(it.Datatype, ruw),
		Fouten:         fouten,
	}
}

// MaakValideerHandler — POST /api/valideer.
func MaakValideerHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 256*1024)
		var body struct {
			valideerItem
			Items []valideerItem `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige body: " + err.Error()})
			return
		}
		if len(body.Items) > 0 {
			if len(body.Items) > valideerMaxItems {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "te veel items (maximaal 200)"})
				return
			}
			uit := make([]valideerUitslag, 0, len(body.Items))
			alleGeldig := true
			for _, it := range body.Items {
				u := valideerEen(it)
				alleGeldig = alleGeldig && u.Geldig
				uit = append(uit, u)
			}
			c.JSON(http.StatusOK, gin.H{"geldig": alleGeldig, "items": uit})
			return
		}
		if body.Datatype == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "datatype ontbreekt"})
			return
		}
		c.JSON(http.StatusOK, valideerEen(body.valideerItem))
	}
}

// MaakValideerFunctiesHandler — GET /api/valideer/functies.
func MaakValideerFunctiesHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		functies := model.ValidatieFunctieNamen()
		sort.Strings(functies)
		c.JSON(http.StatusOK, gin.H{
			"functies":      functies,
			"normalisaties": model.NormalisatieNamen(),
			"regeltypen":    []string{"checksum", "formula", "function"},
		})
	}
}
