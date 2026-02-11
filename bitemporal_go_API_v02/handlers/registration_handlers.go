package handlers

import (
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v02/model"
	"github.com/gin-gonic/gin"
)

func MakeRegisterFullEntityHandler[T model.HasID](entity_name string, relation_name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var newEntity T
		if err := c.ShouldBindJSON(&newEntity); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		/*
			3
			 Speciaal Registratie (POST) endpoint dat het volgende doet:
			 - post registratie (onthoudt ID en tijdstip)
			 - post gegevens (met reg_tijdstip in opvoer; opvoer kan altijd maar 1x, maar kan worden leeggemaakt bij ongedaanmaking van de opvoerende-registratie)
			    * onthoudt id's of stop ze in de structs
			 - post records in tussentabel wijziging (heel specifiek met soft links)
			 - doe van alles met eerdere records bij ongedaanmaking en correctie (ingewikkeld)

			4
			transactie over bovenstaande
		*/

	}
}
