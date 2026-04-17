package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTClaims bevat de JWT-claims voor een ingelogde gebruiker.
type JWTClaims struct {
	jwt.RegisteredClaims
	Gebruikersnaam string `json:"gebruikersnaam"`
	Rol            string `json:"rol"`
	Email          string `json:"email,omitempty"`
}

const (
	// CookieNaam is de naam van de httpOnly cookie voor het JWT-token.
	CookieNaam = "bitemp_token"
	// ContextKeyGebruiker is de Gin context-key voor de ingelogde gebruiker claims.
	ContextKeyGebruiker = "gebruiker"
)

// jwtSecret geeft het JWT-signeringsgeheim, geladen uit de JWT_SECRET env var.
func jwtSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "bitemp-dev-secret-change-in-production"
	}
	return []byte(secret)
}

// JwtExpiryHours geeft de JWT-geldigheidsduur in uren (exported voor handlers).
func JwtExpiryHours() int {
	return jwtExpiryHours()
}

// jwtExpiryHours geeft de JWT-geldigheidsduur in uren.
func jwtExpiryHours() int {
	if v := os.Getenv("JWT_EXPIRY_HOURS"); v != "" {
		if h, err := strconv.Atoi(v); err == nil && h > 0 {
			return h
		}
	}
	return 24 // standaard: 24 uur
}

// GenereerJWT maakt een nieuw JWT-token aan voor de opgegeven gebruiker.
func GenereerJWT(gebruikersnaam, rol, email string) (string, error) {
	now := time.Now()
	claims := JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   gebruikersnaam,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(jwtExpiryHours()) * time.Hour)),
			Issuer:    "bitemp-register-v06",
		},
		Gebruikersnaam: gebruikersnaam,
		Rol:            rol,
		Email:          email,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret())
}

// ValideerJWT parseert en valideert een JWT-tokenstring.
func ValideerJWT(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("onverwachte signing-methode: %v", token.Header["alg"])
		}
		return jwtSecret(), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("ongeldige token-claims")
}

// IsAuthEnabled controleert of authenticatie is ingeschakeld via AUTH_ENABLED env var.
func IsAuthEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_ENABLED")))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

// JWTAuthMiddleware extraheert en valideert het JWT uit de httpOnly cookie.
// Bij een geldig token worden de claims in de Gin context geplaatst.
// Bij een ongeldig of ontbrekend token gaat het request gewoon door (zonder claims).
// Gebruik RequireAuth() om afgedwongen authenticatie toe te passen.
func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !IsAuthEnabled() {
			c.Next()
			return
		}

		tokenString, err := c.Cookie(CookieNaam)
		if err != nil || tokenString == "" {
			c.Next()
			return
		}

		claims, err := ValideerJWT(tokenString)
		if err != nil {
			c.Next()
			return
		}

		c.Set(ContextKeyGebruiker, claims)
		c.Next()
	}
}

// RequireAuth is een Gin middleware die een geldig JWT vereist.
// Retourneert 401 als de gebruiker niet is ingelogd.
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !IsAuthEnabled() {
			c.Next()
			return
		}

		_, exists := c.Get(ContextKeyGebruiker)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authenticatie vereist. Log in via POST /api/auth/login.",
			})
			return
		}
		c.Next()
	}
}

// RequireRol is een Gin middleware die een specifieke rol (of hoger) vereist.
// Rolhiërarchie: admin > editor > viewer.
func RequireRol(minimaalRol string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !IsAuthEnabled() {
			c.Next()
			return
		}

		val, exists := c.Get(ContextKeyGebruiker)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authenticatie vereist.",
			})
			return
		}

		claims := val.(*JWTClaims)
		if !rolToegestaan(claims.Rol, minimaalRol) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": fmt.Sprintf("Onvoldoende rechten. Vereist: %s, huidig: %s.", minimaalRol, claims.Rol),
			})
			return
		}
		c.Next()
	}
}

// rolToegestaan controleert of de huidige rol voldoende is voor de vereiste rol.
// Hiërarchie: admin (3) > editor (2) > viewer (1).
func rolToegestaan(huidig, vereist string) bool {
	niveaus := map[string]int{
		"viewer": 1,
		"editor": 2,
		"admin":  3,
	}
	return niveaus[huidig] >= niveaus[vereist]
}

// GetClaims haalt de JWT-claims uit de Gin context (of nil als niet ingelogd).
func GetClaims(c *gin.Context) *JWTClaims {
	val, exists := c.Get(ContextKeyGebruiker)
	if !exists {
		return nil
	}
	claims, ok := val.(*JWTClaims)
	if !ok {
		return nil
	}
	return claims
}
