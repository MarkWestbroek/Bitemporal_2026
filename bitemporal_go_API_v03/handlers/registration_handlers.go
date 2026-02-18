package handlers

import (
	"fmt"
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
	"github.com/gin-gonic/gin"
)

func RegistreerMetNieuweAanpak() gin.HandlerFunc {
	return func(c *gin.Context) {
		var request model.RegistreerRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Output request body for debugging as pretty JSON
		LogRequestBodyAsJSON(c)

		// TODO: hier komt de nieuwe aanpak van registratie, waarbij we de registratie en wijziging(en) in één endpoint verwerken
		// we kunnen hierbij gebruik maken van de "entiteitID" param in de URL (optioneel) en/of de IDs in de opvoer/afvoer van de wijziging(en)
		// om te bepalen op welke entiteit en/of gegevenselementen de registratie betrekking heeft

		// Step 2: Process each wijziging
		for _, wijziging := range request.Wijzigingen {
			var rep *model.RepresentatiePlusNaam
			if wijziging.Opvoer != nil {
				rep = wijziging.Opvoer // geen specifieke representatie verwacht; daar dealen we later wel mee

			} else if wijziging.Afvoer != nil {
				rep = wijziging.Afvoer // geen specifieke representatie verwacht; daar dealen we later wel mee
			}
			// process de wijziging
			fmt.Printf("HANDLER: representatienaam=%s metatype=%s id=%v\n",
				rep.Representatienaam, rep.Representatie.Metatype(), rep.Representatie.GetID())
		}

		c.JSON(http.StatusOK, gin.H{"message": "Received registration request",
			"registratie": request.Registratie, "wijzigingen": request.Wijzigingen})

	}

}

// MakeRegisterFullEntityHandlerA handles bitemporal registration for Full_A entities
func MakeRegisterFullEntityHandlerA() gin.HandlerFunc {
	return func(c *gin.Context) {
		var request model.RegistreerRequest
		// Hier wordt de UnmarshalJSON method op RepresentatiePlusNaam aangeroepen,
		// die op zijn beurt de UnmarshalJSON (json.Unmarshal) method op Representatie aanroept,
		// waardoor de juiste struct (Full_A of Full_B) wordt geïnitialiseerd
		// op basis van het "type" veld in de JSON body
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Output request body for debugging as pretty JSON
		LogRequestBodyAsJSON(c)

		// Start transaction
		tx, err := DB.BeginTx(c.Request.Context(), nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to start transaction: %v", err)})
			return
		}
		defer tx.Rollback()

		// Step 1: Insert Registratie and get ID + Tijdstip
		_, err = tx.NewInsert().
			Model(&request.Registratie).
			Returning("id").
			Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to insert registratie: %v", err)})
			return
		}
		registratieID := request.Registratie.ID
		registratieTijdstip := request.Registratie.Tijdstip

		/* check of er een param "ID" is meegegeven in de URL
		dit is dan de ID van de entiteit waarop de registratie betrekking heeft,
		en die we kunnen gebruiken voor:
		- Afvoer van de gehele entiteit (in dat geval is deze ID gelijk aan de ID van de entiteit in de opvoer)
		- wijziging op een of meer van de gegevenselementen van de entiteit (in dat geval is deze ID ook gelijk aan de ID van de entiteit,
		en waarnaar het gegevenselement verwijst via haar (bijv.) a_ID of B_ID veld.
		In de database is dit de FK naar de entiteit-tabel.
		- Bij correctie van een bestaande registratie (in dat geval is deze ID ook gelijk aan de ID van de entiteit).
		*/
		if c.Param("id") != "" {
			// we slaan deze ID op in de context zodat we er later bij kunnen
			c.Set("entiteitID", c.Param("id"))
		}

		// Step 2: Process each wijziging
		for _, wijziging := range request.Wijzigingen {
			if wijziging.Opvoer != nil {
				opvoerA, err := wijziging.Opvoer.AsA()
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid opvoer for A flow: %v", err)})
					return
				}

				// Handle OPVOER scenario
				if err := handleOpvoerA(c, tx, opvoerA, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle opvoer: %v", err)})
					return
				}
			} else if wijziging.Afvoer != nil {
				afvoerA, err := wijziging.Afvoer.AsA()
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid afvoer for A flow: %v", err)})
					return
				}

				// Handle AFVOER scenario
				if err := handleAfvoerA(c, tx, afvoerA, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle afvoer: %v", err)})
					return
				}
			}
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to commit transaction: %v", err)})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Registration completed successfully", "registratie_id": registratieID})
	}
}

// MakeRegisterFullEntityHandlerB handles bitemporal registration for Full_B entities
func MakeRegisterFullEntityHandlerB() gin.HandlerFunc {
	return func(c *gin.Context) {
		var request model.RegistreerRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Output request body for debugging as pretty JSON
		LogRequestBodyAsJSON(c)

		// Start transaction
		tx, err := DB.BeginTx(c.Request.Context(), nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to start transaction: %v", err)})
			return
		}
		defer tx.Rollback()

		// Step 1: Insert Registratie and get ID + Tijdstip
		_, err = tx.NewInsert().
			Model(&request.Registratie).
			Returning("id").
			Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to insert registratie: %v", err)})
			return
		}
		registratieID := request.Registratie.ID
		registratieTijdstip := request.Registratie.Tijdstip

		// Step 2: Process each wijziging
		for _, wijziging := range request.Wijzigingen {
			if wijziging.Opvoer != nil {
				opvoerB, err := wijziging.Opvoer.AsB()
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid opvoer for B flow: %v", err)})
					return
				}

				// Handle OPVOER scenario
				if err := handleOpvoerB(c, tx, opvoerB, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle opvoer: %v", err)})
					return
				}
			} else if wijziging.Afvoer != nil {
				afvoerB, err := wijziging.Afvoer.AsB()
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid afvoer for B flow: %v", err)})
					return
				}

				// Handle AFVOER scenario
				if err := handleAfvoerB(c, tx, afvoerB, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle afvoer: %v", err)})
					return
				}
			}
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to commit transaction: %v", err)})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Registration completed successfully", "registratie_id": registratieID})
	}
}
