package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

/*
RequestBodyLogger is een Gin middleware die de request body logt voor
POST/PUT/PATCH requests. Het vangt de body op vóórdat ShouldBindJSON het
consumeert, zodat de body altijd beschikbaar is.

Activering: zet APP_DEBUG_LOGS=1 (of true/yes/on) als omgevingsvariabele.
Zonder die variabele doet de middleware niets.

Daarnaast logt het de response status en duur nadat de handler klaar is,
zodat je in de Go-output de volledige request→response cyclus kunt zien.
*/
func RequestBodyLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !debugLogsEnabled() {
			c.Next()
			return
		}

		method := c.Request.Method
		// Alleen body loggen voor muterende methoden
		if method != "POST" && method != "PUT" && method != "PATCH" {
			c.Next()
			return
		}

		start := time.Now()
		path := c.Request.URL.Path

		// Lees body en zet hem terug voor handlers
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			fmt.Printf("[BODY-LOG] %s %s — fout bij lezen body: %v\n", method, path, err)
			c.Next()
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

		// Pretty-print als het geldige JSON is
		bodyStr := "(leeg)"
		if len(body) > 0 {
			var parsed any
			if json.Unmarshal(body, &parsed) == nil {
				prettyBytes, _ := json.MarshalIndent(parsed, "  ", "  ")
				bodyStr = string(prettyBytes)
			} else {
				// Geen geldige JSON — toon ruw (max 2000 bytes)
				raw := string(body)
				if len(raw) > 2000 {
					raw = raw[:2000] + "…(afgekapt)"
				}
				bodyStr = raw
			}
		}

		fmt.Printf("[BODY-LOG] ──── %s %s ────\n", method, path)
		fmt.Printf("  Request body:\n  %s\n", indent(bodyStr))

		// Ga verder met de handler-keten
		c.Next()

		status := c.Writer.Status()
		elapsed := time.Since(start)
		fmt.Printf("[BODY-LOG] ──── %s %s → %d (%s) ────\n", method, path, status, elapsed.Round(time.Millisecond))
	}
}

func indent(s string) string {
	return strings.ReplaceAll(s, "\n", "\n  ")
}
