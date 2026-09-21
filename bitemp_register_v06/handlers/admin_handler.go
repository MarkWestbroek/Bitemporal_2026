package handlers

import (
	"net/http"
	"os"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dbsetup"
	"github.com/gin-gonic/gin"
)

func isDropTablesAllowed() bool {
	return os.Getenv("ALLOW_DROP_TABLES") == "true"
}

// DropTables dropt alle (of per ?domein= gefilterde) modeltabellen.
// Drie ringen (BE-review 2026-07-07, §3.3): alleen in devtools-builds
// geregistreerd, rol "admin" bij AUTH_ENABLED=true, en ALLOW_DROP_TABLES +
// wachtwoord (constant-time; header X-Beheer-Wachtwoord of legacy :password).
func DropTables(c *gin.Context) {
	if !isDropTablesAllowed() {
		c.JSON(http.StatusForbidden, gin.H{"error": "drop tables is disabled"})
		return
	}

	if !eisBeheerWachtwoord(c, "ADMIN_DROP_PASSWORD") {
		return
	}

	if DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not initialized"})
		return
	}

	domein := c.Query("domein")

	if domein != "" {
		// Domein-specifiek: alleen tabellen van dit domein droppen
		err := dbsetup.DeleteTablesByDomein(DB, domein)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Tables for domein '" + domein + "' dropped successfully"})
		return
	}

	err := dbsetup.DeleteTables(DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tables dropped successfully"})
}

// CreateTables maakt (idempotent) alle tabellen aan. Geen wachtwoord: de route
// bestaat alleen in devtools-builds en vereist rol "admin" bij AUTH_ENABLED=true;
// de operatie is bovendien niet-destructief (IF NOT EXISTS).
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
