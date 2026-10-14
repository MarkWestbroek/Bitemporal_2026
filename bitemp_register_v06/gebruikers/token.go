package gebruikers

// token.go — persoonlijke API-tokens (AI-1, 14-10-2026): voor de Omnium-MCP-server of een script.
// Een token werkt als de gebruiker zelf (zelfde rol en rechten, per verzoek uit het register).
// Alleen de sha256 wordt bewaard; het token zie je één keer. Met een token kun je geen nieuwe
// tokens maken (daarvoor log je gewoon in), wel je tokens bekijken of intrekken.
//
// Routes (main.go), achter inloggen:
//   GET    /api/auth/tokens       je eigen tokens (zonder het token zelf)
//   POST   /api/auth/tokens       {naam, dagen?} → {token, …} — alleen met de login-cookie
//   DELETE /api/auth/tokens/:id   intrekken

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

const (
	tokenDagenStandaard = 90
	tokenDagenMax       = 365
	tokensMaxPerPersoon = 20
)

// nieuwToken: het token (omt_ + 43 tekens) en zijn hash.
func nieuwToken() (token, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token = middleware.TokenVoorvoegsel + base64.RawURLEncoding.EncodeToString(b)
	return token, hashVanToken(token), nil
}

func hashVanToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// tokenGeldig: niet ingetrokken en niet verlopen op `nu`. Zuiver (testbaar).
func tokenGeldig(t *model.GebruikerToken, nu time.Time) bool {
	return t != nil && t.IngetrokkenOp == nil && (t.Verloopt == nil || nu.Before(*t.Verloopt))
}

var (
	gebruiktMu sync.Mutex
	gebruikt   = map[int64]time.Time{} // laatst_gebruikt hooguit één keer per minuut schrijven
)

// TokenResolver is de opzoekfunctie voor de middleware (middleware.ZetTokenResolver).
func TokenResolver(ctx context.Context, token string) (string, bool, error) {
	t := new(model.GebruikerToken)
	err := handlers.DB.NewSelect().Model(t).Where("token_hash = ?", hashVanToken(token)).Limit(1).Scan(ctx)
	if err != nil {
		if isGeenRij(err) {
			return "", false, nil
		}
		return "", false, err
	}
	nu := time.Now()
	if !tokenGeldig(t, nu) {
		return "", false, nil
	}
	gebruiktMu.Lock()
	vorige := gebruikt[t.ID]
	schrijf := nu.Sub(vorige) > time.Minute
	if schrijf {
		gebruikt[t.ID] = nu
	}
	gebruiktMu.Unlock()
	if schrijf {
		_, _ = handlers.DB.NewUpdate().Model((*model.GebruikerToken)(nil)).Set("laatst_gebruikt = ?", nu).Where("id = ?", t.ID).Exec(ctx)
	}
	return t.Gebruikersnaam, true, nil
}

func ingelogdeNaam(c *gin.Context) (string, *middleware.JWTClaims) {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return "", nil
	}
	return claims.Gebruikersnaam, claims
}

// TokensLijstHandler — GET /api/auth/tokens
func TokensLijstHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		naam, _ := ingelogdeNaam(c)
		var lijst []model.GebruikerToken
		if err := handlers.DB.NewSelect().Model(&lijst).Where("gebruikersnaam = ?", naam).OrderExpr("aangemaakt DESC").Scan(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Tokens lezen mislukt."})
			return
		}
		if lijst == nil {
			lijst = []model.GebruikerToken{}
		}
		c.JSON(http.StatusOK, lijst)
	}
}

// TokenMakenHandler — POST /api/auth/tokens {naam, dagen?}
func TokenMakenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		naam, claims := ingelogdeNaam(c)
		if claims == nil || naam == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Log eerst in."})
			return
		}
		if claims.ViaToken {
			c.JSON(http.StatusForbidden, gin.H{"error": "Met een token maak je geen nieuw token; log in in de Studio."})
			return
		}
		var in struct {
			Naam  string `json:"naam"`
			Dagen int    `json:"dagen"`
		}
		_ = c.ShouldBindJSON(&in)
		in.Naam = strings.TrimSpace(in.Naam)
		if in.Naam == "" || len(in.Naam) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geef het token een naam (waarvoor), max 100 tekens."})
			return
		}
		if in.Dagen == 0 {
			in.Dagen = tokenDagenStandaard
		}
		if in.Dagen < 1 || in.Dagen > tokenDagenMax {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geldigheid: 1 tot 365 dagen."})
			return
		}
		ctx := c.Request.Context()
		n, _ := handlers.DB.NewSelect().Model((*model.GebruikerToken)(nil)).
			Where("gebruikersnaam = ? AND ingetrokken_op IS NULL", naam).Count(ctx)
		if n >= tokensMaxPerPersoon {
			c.JSON(http.StatusConflict, gin.H{"error": "Je hebt al 20 tokens; trek er eerst een in."})
			return
		}
		token, hash, err := nieuwToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Kon geen token maken."})
			return
		}
		nu := time.Now()
		verloopt := nu.Add(time.Duration(in.Dagen) * 24 * time.Hour)
		rec := &model.GebruikerToken{Gebruikersnaam: naam, Naam: in.Naam, Begin: token[:10], TokenHash: hash, Aangemaakt: nu, Verloopt: &verloopt}
		if _, err := handlers.DB.NewInsert().Model(rec).Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Token opslaan mislukt."})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"token": token, "id": rec.ID, "naam": rec.Naam, "verloopt": rec.Verloopt})
	}
}

// TokenIntrekkenHandler — DELETE /api/auth/tokens/:id (alleen je eigen)
func TokenIntrekkenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		naam, _ := ingelogdeNaam(c)
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig id."})
			return
		}
		res, err := handlers.DB.NewUpdate().Model((*model.GebruikerToken)(nil)).Set("ingetrokken_op = ?", time.Now()).
			Where("id = ? AND gebruikersnaam = ? AND ingetrokken_op IS NULL", id, naam).Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Intrekken mislukt."})
			return
		}
		if k, _ := res.RowsAffected(); k == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Token niet gevonden (of al ingetrokken)."})
			return
		}
		c.Status(http.StatusNoContent)
	}
}
