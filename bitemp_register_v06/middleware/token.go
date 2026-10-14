package middleware

// token.go — persoonlijke API-tokens (AI-1, 14-10-2026): naast de JWT-cookie accepteert de
// middleware `Authorization: Bearer omt_…`. Het token hoort bij een gebruiker; rol en status komen
// daarna, net als bij de cookie, per verzoek uit het register (gebruiker_stand.go). De opslag zit
// in package gebruikers (ZetTokenResolver), zodat middleware niet van de database afhangt.

import (
	"context"
	"strings"
	"sync"
)

// TokenVoorvoegsel herkent een Omnium-token (en houdt JWT's en andere Bearer-waarden apart).
const TokenVoorvoegsel = "omt_"

// TokenResolver zoekt bij een token de gebruikersnaam. ok=false: onbekend, ingetrokken of verlopen.
type TokenResolver func(ctx context.Context, token string) (gebruikersnaam string, ok bool, err error)

var (
	tokenMu       sync.RWMutex
	tokenResolver TokenResolver
)

// ZetTokenResolver registreert de opzoekfunctie (main.go → gebruikers.TokenResolver).
func ZetTokenResolver(r TokenResolver) {
	tokenMu.Lock()
	defer tokenMu.Unlock()
	tokenResolver = r
}

// BearerToken haalt een Omnium-token uit de Authorization-header ("" als er geen is).
func BearerToken(header string) string {
	const pre = "Bearer "
	if len(header) <= len(pre) || !strings.EqualFold(header[:len(pre)], pre) {
		return ""
	}
	t := strings.TrimSpace(header[len(pre):])
	if !strings.HasPrefix(t, TokenVoorvoegsel) {
		return ""
	}
	return t
}

// claimsUitToken: claims voor een geldig token, of nil.
func claimsUitToken(ctx context.Context, token string) *JWTClaims {
	tokenMu.RLock()
	r := tokenResolver
	tokenMu.RUnlock()
	if r == nil || token == "" {
		return nil
	}
	naam, ok, err := r(ctx, token)
	if err != nil || !ok || naam == "" {
		return nil
	}
	return &JWTClaims{Gebruikersnaam: naam, ViaToken: true}
}
