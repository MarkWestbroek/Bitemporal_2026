package middleware

// leestoegang.go — de "poort" voor anoniem lezen (plan 2026-09-22 §7.7 stap 3).
//
// Lezen is van oudsher openbaar: alle GET-routes en GraphQL-queries werken zonder inloggen,
// zodat de publicatiepagina zonder account kan draaien. Sinds de publicatiepagina haar data
// via opgeslagen documenten haalt (QueryDefinitie, `documentId`), kan dat dicht: anoniem mag
// dan alleen nog wat een QueryDefinitie expliciet publiek maakt. De rest van de registerdata
// vereist minimaal de rol "viewer".
//
// Wat óók anoniem open blijft, omdat de publicatiepagina het nodig heeft en het geen
// registerdata is: schema en metadata (/api/viz/schema, /api/schema/*), het
// configuratie-domein (WeergaveDefinitie, FormulierDefinitie, QueryDefinitie), de
// referentielijsten, GraphQL-introspectie en de documentatie. Zie routes.OpenbaarLeesbaar.
//
// Schakelaar: LEESTOEGANG=open (default, gedrag van vóór 24-09-2026) | documenten.
// Net als RequireRol is dit een no-op zolang AUTH_ENABLED=false.

import (
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	LeesToegangOpen       = "open"
	LeesToegangDocumenten = "documenten"
)

// LeesToegang geeft de ingestelde modus terug ("open" of "documenten").
func LeesToegang() string {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("LEESTOEGANG")))
	if v == LeesToegangDocumenten {
		return LeesToegangDocumenten
	}
	return LeesToegangOpen
}

// LeesToegangAlleenDocumenten meldt of de poort dicht is.
func LeesToegangAlleenDocumenten() bool {
	return LeesToegang() == LeesToegangDocumenten
}

// MagLezen beslist of dit verzoek registerdata mag lezen: altijd bij LEESTOEGANG=open, anders
// alleen met minimaal de rol "viewer". Bij false is het verzoek al afgebroken (401/403).
// Bruikbaar als guard in een handler (GraphQL) én via RequireLezer als middleware.
func MagLezen(c *gin.Context) bool {
	if !LeesToegangAlleenDocumenten() {
		return true
	}
	return ControleerRol(c, "viewer")
}

// RequireLezer is de middleware-vorm van MagLezen voor GET-routes op registerdata.
func RequireLezer() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !MagLezen(c) {
			return
		}
		c.Next()
	}
}
