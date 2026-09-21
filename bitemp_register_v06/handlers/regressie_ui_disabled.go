//go:build !devtools

package handlers

import "github.com/gin-gonic/gin"

// RegistreerRegressieRoutes is een no-op in builds zonder -tags devtools: de
// regressie-UI (die `go test` uitvoert) bestaat dan niet in de binary.
// Zie regressie_ui_handler.go voor de devtools-variant.
func RegistreerRegressieRoutes(gin.IRoutes, gin.HandlerFunc) {}
