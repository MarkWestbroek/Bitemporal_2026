package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// loginRequest is de payload voor POST /api/auth/login.
type loginRequest struct {
	Gebruikersnaam string `json:"gebruikersnaam" binding:"required"`
	Wachtwoord     string `json:"wachtwoord" binding:"required"`
}

// LoginHandler verwerkt POST /api/auth/login.
// Valideert credentials via bcrypt en geeft een JWT als httpOnly cookie.
func LoginHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gebruikersnaam en wachtwoord zijn verplicht."})
			return
		}

		// Zoek gebruiker in de database
		var gebruiker model.Gebruiker
		err := DB.NewSelect().
			Model(&gebruiker).
			Where("gebruikersnaam = ?", req.Gebruikersnaam).
			Where("actief = true").
			Scan(c.Request.Context())
		if err != nil {
			// Generiek foutbericht om user enumeration te voorkomen
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Ongeldige gebruikersnaam of wachtwoord."})
			return
		}

		// Verifieer wachtwoord via bcrypt
		if err := bcrypt.CompareHashAndPassword([]byte(gebruiker.WachtwoordHash), []byte(req.Wachtwoord)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Ongeldige gebruikersnaam of wachtwoord."})
			return
		}

		// Genereer JWT
		token, err := middleware.GenereerJWT(gebruiker.Gebruikersnaam, string(gebruiker.Rol), gebruiker.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Kon geen token genereren."})
			return
		}

		// Update laatste login tijdstip
		now := time.Now()
		_, _ = DB.NewUpdate().
			Model(&gebruiker).
			Set("laatste_login_op = ?", now).
			Where("id = ?", gebruiker.ID).
			Exec(c.Request.Context())

		// Zet httpOnly cookie
		// COOKIE_SECURE=true vereist HTTPS (bijv. productie achter TLS-proxy).
		// Standaard false zodat HTTP-deployments (zoals TrueNAS zonder TLS) werken.
		isSecure := os.Getenv("COOKIE_SECURE") == "true"
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(middleware.CookieNaam, token, 3600*middleware.JwtExpiryHours(), "/", "", isSecure, true)

		c.JSON(http.StatusOK, gin.H{
			"bericht":        "Succesvol ingelogd.",
			"gebruikersnaam": gebruiker.Gebruikersnaam,
			"rol":            gebruiker.Rol,
		})
	}
}

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

// SeedAdminGebruiker maakt een standaard admin-gebruiker aan als die nog niet bestaat.
// Leest ADMIN_USERNAME en ADMIN_PASSWORD uit de environment.
func SeedAdminGebruiker(ctx context.Context) error {
	username := os.Getenv("ADMIN_USERNAME")
	password := os.Getenv("ADMIN_PASSWORD")
	if username == "" || password == "" {
		fmt.Println("AUTH: Geen ADMIN_USERNAME/ADMIN_PASSWORD ingesteld, standaard admin-seed overgeslagen.")
		return nil
	}

	// Controleer of gebruiker al bestaat
	exists, err := DB.NewSelect().
		Model((*model.Gebruiker)(nil)).
		Where("gebruikersnaam = ?", username).
		Exists(ctx)
	if err != nil {
		return fmt.Errorf("seed admin: kon niet controleren of gebruiker bestaat: %w", err)
	}
	if exists {
		fmt.Printf("AUTH: Admin-gebruiker '%s' bestaat al.\n", username)
		return nil
	}

	// Maak bcrypt hash
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("seed admin: bcrypt hash mislukt: %w", err)
	}

	admin := &model.Gebruiker{
		Gebruikersnaam: username,
		WachtwoordHash: string(hash),
		Email:          os.Getenv("ADMIN_EMAIL"),
		Rol:            model.RolAdmin,
		Actief:         true,
		AangemaaktOp:   time.Now(),
	}

	_, err = DB.NewInsert().Model(admin).Exec(ctx)
	if err != nil {
		return fmt.Errorf("seed admin: insert mislukt: %w", err)
	}
	fmt.Printf("AUTH: Admin-gebruiker '%s' aangemaakt.\n", username)
	return nil
}
