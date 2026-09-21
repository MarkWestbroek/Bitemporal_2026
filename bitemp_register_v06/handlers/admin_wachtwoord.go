// Package handlers — admin_wachtwoord.go
//
// Gedeelde wachtwoordcontrole voor beheer-endpoints (droptables, rebuild,
// diff), BE-review 2026-07-07 §3.3:
//
//   - constante-tijd vergelijking (geen timing-lek);
//   - het wachtwoord mag via de header X-Beheer-Wachtwoord worden gestuurd
//     (voorkeur — het :password-padsegment belandt in access-logs en
//     proxy-caches; die padvariant blijft werken voor bestaande clients);
//   - de dev-default "1234" geldt alléén buiten productie: in productiecontext
//     zonder geconfigureerd wachtwoord wordt het endpoint geweigerd.
//
// Deze checks zijn de tweede ring; de eerste ring is dat de /admin/*-routes
// alleen bestaan in builds met -tags devtools (zie devtools_enabled.go) en
// rol "admin" vereisen zodra AUTH_ENABLED=true.
package handlers

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// defaultDevBeheerWachtwoord is de dev-fallback voor beheer-endpoints.
// Alleen bruikbaar buiten productie; zie controleerBeheerWachtwoord.
const defaultDevBeheerWachtwoord = "1234"

// BeheerWachtwoordHeader is de voorkeursheader voor het beheerwachtwoord.
const BeheerWachtwoordHeader = "X-Beheer-Wachtwoord"

// isProductieOmgeving spiegelt isProductionEnvironment uit main.go
// (APP_ENV=production of GIN_MODE=release).
func isProductieOmgeving() bool {
	return os.Getenv("APP_ENV") == "production" || os.Getenv("GIN_MODE") == gin.ReleaseMode
}

// aangebodenBeheerWachtwoord haalt het aangeboden wachtwoord uit de header
// X-Beheer-Wachtwoord, of anders uit het :password-padsegment (legacy).
func aangebodenBeheerWachtwoord(c *gin.Context) string {
	if h := c.GetHeader(BeheerWachtwoordHeader); h != "" {
		return h
	}
	return c.Param("password")
}

// controleerBeheerWachtwoord vergelijkt het aangeboden wachtwoord in constante
// tijd met het geconfigureerde wachtwoord. Retourneert (0, nil) bij succes, of
// een HTTP-status + fout:
//   - 403 als er geen wachtwoord is geconfigureerd terwijl we in productie
//     draaien (geen default-wachtwoord in productie);
//   - 401 bij een verkeerd wachtwoord.
func controleerBeheerWachtwoord(aangeboden, geconfigureerd string) (int, error) {
	if geconfigureerd == "" {
		if isProductieOmgeving() {
			return http.StatusForbidden, errors.New("beheerwachtwoord niet geconfigureerd; stel de bijbehorende env-variabele in (geen default in productie)")
		}
		geconfigureerd = defaultDevBeheerWachtwoord
	}
	if subtle.ConstantTimeCompare([]byte(aangeboden), []byte(geconfigureerd)) != 1 {
		return http.StatusUnauthorized, errors.New("ongeldig wachtwoord")
	}
	return 0, nil
}

// eisBeheerWachtwoord voert de volledige check uit op een Gin-context en
// schrijft zelf de foutresponse. Retourneert true als het request door mag.
func eisBeheerWachtwoord(c *gin.Context, envVar string) bool {
	status, err := controleerBeheerWachtwoord(aangebodenBeheerWachtwoord(c), os.Getenv(envVar))
	if err != nil {
		c.JSON(status, gin.H{"error": err.Error()})
		return false
	}
	return true
}
