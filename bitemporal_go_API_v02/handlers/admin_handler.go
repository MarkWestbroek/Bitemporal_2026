package handlers

import (
	"net/http"
	"os"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v02/dbsetup"
	"github.com/gin-gonic/gin"
)

const defaultAdminDropTablesPassword = "1234"

func isDropTablesAllowed() bool {
	return os.Getenv("ALLOW_DROP_TABLES") == "true"
}

func getAdminDropTablesPassword() string {
	password := os.Getenv("ADMIN_DROP_PASSWORD")
	if password == "" {
		return defaultAdminDropTablesPassword
	}
	return password
}

func DropTables(c *gin.Context) {
	password := c.Param("password")

	if !isDropTablesAllowed() {
		c.JSON(http.StatusForbidden, gin.H{"error": "drop tables is disabled"})
		return
	}

	if password != getAdminDropTablesPassword() {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid password"})
		return
	}

	if DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not initialized"})
		return
	}

	err := dbsetup.DeleteTables(DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tables dropped successfully"})
}

// handler voor het aanmaken van tabellen, alleen toegankelijk via admin route, zonder authenticatie (beveiliging via obscurity)
func CreateTables(c *gin.Context) {
	if DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not initialized"})
		return
	}

	err := dbsetup.CreateTables(DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tables created successfully (or they already existed)"})
}
