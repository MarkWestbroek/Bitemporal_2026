package handlers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
)

// Inloggen, de admin-seed en wachtwoorden staan sinds het gebruikersbeheer (oktober 2026) in
// package gebruikers: de gebruiker is nu een bitemporele entiteit (docs/plans/gebruikersbeheer/).

// LogoutHandler verwerkt POST /api/auth/logout.
// Verwijdert de JWT-cookie.
func LogoutHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		isSecure := os.Getenv("GIN_MODE") == "release"
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(middleware.CookieNaam, "", -1, "/", "", isSecure, true)
		c.JSON(http.StatusOK, gin.H{"bericht": "Uitgelogd."})
	}
}

// MeHandler verwerkt GET /api/auth/me.
// Retourneert de huidige gebruiker op basis van het JWT in de cookie.
func MeHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := middleware.GetClaims(c)
		if claims == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Niet ingelogd."})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"gebruikersnaam": claims.Gebruikersnaam,
			"rol":            claims.Rol,
			"email":          claims.Email,
		})
	}
}

// AuthStatusHandler verwerkt GET /api/auth/status.
// Retourneert of authenticatie is ingeschakeld en of de gebruiker is ingelogd.
func AuthStatusHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		enabled := middleware.IsAuthEnabled()
		claims := middleware.GetClaims(c)
		result := gin.H{
			"auth_enabled": enabled,
			"ingelogd":     claims != nil,
		}
		if claims != nil {
			result["gebruikersnaam"] = claims.Gebruikersnaam
			result["rol"] = claims.Rol
		}
		c.JSON(http.StatusOK, result)
	}
}
