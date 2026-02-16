package handlers

import (
	"fmt"
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v02/model"
	"github.com/gin-gonic/gin"
)

// MakeRegisterFullEntityHandlerA handles bitemporal registration for Full_A entities
func MakeRegisterFullEntityHandlerA() gin.HandlerFunc {
	return func(c *gin.Context) {
		var request model.RegisterRequestA
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
				// Handle OPVOER scenario
				if err := handleOpvoerA(c, tx, wijziging.Opvoer, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle opvoer: %v", err)})
					return
				}
			} else if wijziging.Afvoer != nil {
				// Handle AFVOER scenario
				if err := handleAfvoerA(c, tx, wijziging.Afvoer, registratieID, registratieTijdstip); err != nil {
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
		var request model.RegisterRequestB
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
				// Handle OPVOER scenario
				if err := handleOpvoerB(c, tx, wijziging.Opvoer, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle opvoer: %v", err)})
					return
				}
			} else if wijziging.Afvoer != nil {
				// Handle AFVOER scenario
				if err := handleAfvoerB(c, tx, wijziging.Afvoer, registratieID, registratieTijdstip); err != nil {
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
