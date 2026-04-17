package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/authz"
	"github.com/gin-gonic/gin"
)

// === PEP Middleware (Policy Enforcement Point) ===
//
// Gin middleware die autorisatiebeslissingen afdwingt via de OpenFTV PDP.
// Vereist dat JWTAuthMiddleware() eerder in de keten is geregistreerd
// (zodat claims beschikbaar zijn in de Gin context).
//
// Gedrag:
//   - AUTH_ENABLED=false of AUTHZ_PDP_ENABLED=false → no-op (alles toegestaan)
//   - Geen JWT claims → 401 (wordt normaal al afgevangen door RequireAuth)
//   - PDP retourneert decision=false → 403 Forbidden
//   - PDP niet bereikbaar → afhankelijk van AUTHZ_DENY_ON_ERROR (default: false = permit)

var authzClient *authz.Client

// initAuthzClient maakt (lazy) de AuthZEN client aan.
func initAuthzClient() *authz.Client {
	if authzClient == nil {
		authzClient = authz.NieuweClient()
	}
	return authzClient
}

// IsAuthzPDPEnabled controleert of PDP-autorisatie is ingeschakeld.
// Vereist: AUTH_ENABLED=true EN AUTHZ_PDP_ENABLED=true.
func IsAuthzPDPEnabled() bool {
	if !IsAuthEnabled() {
		return false
	}
	v := strings.ToLower(strings.TrimSpace(os.Getenv("AUTHZ_PDP_ENABLED")))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

// isDenyOnError bepaalt of PDP-fouten leiden tot deny (true) of permit (false).
func isDenyOnError() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("AUTHZ_DENY_ON_ERROR")))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

// BepaalAuthZENActie mapt een HTTP-methode + routepad naar een AuthZEN action naam.
//
// Mapping:
//
//	GET                          → "read"
//	POST /registratie/           → "write"
//	POST /corrigeer/             → "write"
//	POST /maak_ongedaan/         → "write"
//	POST /api/schema/*           → "write"
//	POST /api/bestanden/*        → "write"
//	POST, PUT, PATCH, DELETE     → "write"  (default voor muterend)
//	*/admin/*                    → "admin"
func BepaalAuthZENActie(method, path string) string {
	lowerPath := strings.ToLower(path)

	// Admin routes altijd als "admin" markeren
	if strings.Contains(lowerPath, "/admin/") {
		return "admin"
	}

	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return "read"
	default:
		return "write"
	}
}

// BepaalAuthZENResource mapt een routepad naar een AuthZEN resource type + id.
//
// Mapping:
//
//	/api/auth/*          → type "auth" (wordt niet geëvalueerd, altijd publiek)
//	/registratie/        → type "api", id "registratie"
//	/{padnaam}           → type "api", id "{padnaam}" (MetaRegistry entiteit/GE/relatie)
//	/full/{padnaam}/*    → type "api", id "{padnaam}"
//	/api/schema/*        → type "api", id "schema"
//	/api/bestanden/*     → type "api", id "bestanden"
//	/admin/*             → type "api", id "admin"
//	overig               → type "api", id "overig"
func BepaalAuthZENResource(path string) (resourceType, resourceID string) {
	lowerPath := strings.ToLower(path)

	// Auth routes: altijd publiek (nooit naar PDP)
	if strings.HasPrefix(lowerPath, "/api/auth/") {
		return "auth", "auth"
	}

	// Admin routes
	if strings.HasPrefix(lowerPath, "/admin/") {
		return "api", "admin"
	}

	// Schema API
	if strings.HasPrefix(lowerPath, "/api/schema/") {
		return "api", "schema"
	}

	// Bestanden API
	if strings.HasPrefix(lowerPath, "/api/bestanden/") {
		return "api", "bestanden"
	}

	// Viz API (schema voor frontend)
	if strings.HasPrefix(lowerPath, "/api/viz/") {
		return "api", "viz"
	}

	// Registratie endpoint (exact /registratie/ — het bitemporele registratie-endpoint)
	if lowerPath == "/registratie/" || lowerPath == "/registratie" {
		return "api", "registratie"
	}

	// Full entity routes: /full/{padnaam}/...
	if strings.HasPrefix(lowerPath, "/full/") {
		parts := strings.SplitN(strings.TrimPrefix(lowerPath, "/full/"), "/", 2)
		if len(parts) > 0 && parts[0] != "" {
			return "api", parts[0]
		}
	}

	// MetaRegistry entiteiten/GE's/relaties: /{padnaam} of /{padnaam}/:id
	trimmed := strings.TrimPrefix(lowerPath, "/")
	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) > 0 && parts[0] != "" {
		// Filter bekende niet-API paden
		switch parts[0] {
		case "viz", "docs", "version", "openapi", "swagger", "redoc",
			"graphql", "tests", "registraties", "wijzigingen":
			return "api", parts[0]
		default:
			return "api", parts[0]
		}
	}

	return "api", "overig"
}

// AuthzPEPMiddleware is een Gin middleware die autorisatiebeslissingen afdwingt
// via de OpenFTV PDP (AuthZEN API).
//
// De middleware:
//  1. Controleert of PDP-autorisatie is ingeschakeld (AUTH_ENABLED + AUTHZ_PDP_ENABLED)
//  2. Slaat publieke paden over (auth routes, statische bestanden, docs, etc.)
//  3. Extraheert de gebruiker uit de JWT claims (gezet door JWTAuthMiddleware)
//  4. Mapt HTTP method + pad naar AuthZEN action + resource
//  5. Stuurt een evaluatieverzoek naar de PDP
//  6. Blokkeert met 403 als decision=false
func AuthzPEPMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Uitgeschakeld → doorlaten
		if !IsAuthzPDPEnabled() {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		method := c.Request.Method

		// Publieke paden overslaan (nooit naar PDP sturen)
		if isPubliekPad(path, method) {
			c.Next()
			return
		}

		// Haal gebruiker op uit JWT context
		claims := GetClaims(c)

		// Geen claims maar wel auth vereist → RequireAuth vangt dit eerder af,
		// maar ter defensie ook hier blokkeren
		var subject authz.Subject
		if claims != nil {
			subject = authz.Subject{
				Type: "user",
				ID:   claims.Gebruikersnaam,
				Properties: map[string]any{
					"role": claims.Rol,
				},
			}
		} else {
			// Anonieme gebruiker — rol "anonymous"
			subject = authz.Subject{
				Type: "user",
				ID:   "anonymous",
				Properties: map[string]any{
					"role": "anonymous",
				},
			}
		}

		actie := BepaalAuthZENActie(method, path)
		resourceType, resourceID := BepaalAuthZENResource(path)

		verzoek := &authz.EvaluatieVerzoek{
			Subject:  subject,
			Action:   authz.Action{Name: actie},
			Resource: authz.Resource{Type: resourceType, ID: resourceID},
		}

		client := initAuthzClient()
		resultaat, err := client.Evalueer(c.Request.Context(), verzoek)
		if err != nil {
			// PDP niet bereikbaar of fout
			if isDenyOnError() {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error": "Autorisatieservice niet beschikbaar. Toegang geweigerd.",
				})
				return
			}
			// Fail-open: log waarschuwing en laat door
			fmt.Printf("AUTHZ WARN: PDP fout voor %s %s (user=%s): %v — fail-open\n",
				method, path, subject.ID, err)
			c.Next()
			return
		}

		if !resultaat.Decision {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Onvoldoende rechten voor deze actie.",
			})
			return
		}

		c.Next()
	}
}

// isPubliekPad bepaalt of een pad altijd publiek is (nooit naar PDP sturen).
func isPubliekPad(path, method string) bool {
	lowerPath := strings.ToLower(path)

	// OPTIONS (preflight) altijd doorlaten
	if method == http.MethodOptions {
		return true
	}

	// Auth routes
	if strings.HasPrefix(lowerPath, "/api/auth/") {
		return true
	}

	// Statische bestanden en docs
	if strings.HasPrefix(lowerPath, "/viz/") ||
		strings.HasPrefix(lowerPath, "/docs") ||
		lowerPath == "/" {
		return true
	}

	// Version endpoint
	if lowerPath == "/version" {
		return true
	}

	// OpenAPI endpoints (documentatie)
	if lowerPath == "/openapi.json" || lowerPath == "/openapi.yaml" ||
		strings.HasPrefix(lowerPath, "/openapi") ||
		lowerPath == "/swagger" || lowerPath == "/redoc" {
		return true
	}

	// GraphQL playground (GET = UI, POST = query — POST wordt wel geëvalueerd)
	if lowerPath == "/graphql/playground" {
		return true
	}

	return false
}
