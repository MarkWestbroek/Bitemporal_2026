// Package handlers — http_fouten.go
//
// Gedeelde foutafhandeling voor HTTP-handlers (BE-review 2026-07-07, §4.2/§4.3):
//
//   - Bun's Scan retourneert sql.ErrNoRows als er niets gevonden is; dat is
//     een 404, geen 500. Vóór deze helper gaven de GET-handlers bij een
//     onbekend ID `500 {"error":"sql: no rows in result set"}` — de
//     isZeroID-check erna was dood pad.
//   - Interne fouten (databaseteksten, tabelnamen) horen niet naar de client
//     te lekken: de client krijgt een generieke boodschap, de volledige fout
//     gaat naar de server-log.
package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// isNoRows is true als de fout (mogelijk gewrapt) sql.ErrNoRows is.
func isNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

// interneFout logt de volledige fout server-side en stuurt de client een
// generieke 500 zonder interne details.
func interneFout(c *gin.Context, publiek string, err error) {
	fmt.Printf("ERROR: %s %s: %s: %v\n", c.Request.Method, c.Request.URL.Path, publiek, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": publiek})
}

// scanFoutNaar404OfInterneFout handelt het standaardpatroon af voor een
// single-record Scan: onbekend ID → 404 met "not found"-boodschap, andere
// fouten → generieke 500 (met server-side log). Retourneert true als er een
// response is geschreven (caller moet dan stoppen).
func scanFoutNaar404OfInterneFout(c *gin.Context, err error, typenaam string) bool {
	if err == nil {
		return false
	}
	if isNoRows(err) {
		c.JSON(http.StatusNotFound, gin.H{"message": typenaam + " not found"})
		return true
	}
	interneFout(c, "kon "+typenaam+" niet ophalen", err)
	return true
}
