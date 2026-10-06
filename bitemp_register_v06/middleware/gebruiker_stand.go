package middleware

// gebruiker_stand.go — rol en status per verzoek uit het register (gebruikersbeheer, besluit B;
// docs/plans/gebruikersbeheer/).
//
// Het JWT zegt alleen *wie* er is ingelogd. Welke rol iemand nu heeft en of het account
// geblokkeerd is, staat in de bitemporele entiteit Gebruiker (domein beheer). Bij elk verzoek
// leest de middleware die stand via een resolver (gezet door package gebruikers, zodat
// middleware niet van dynql afhangt), met een korte cache. Zo werkt een blokkade of een
// verlopen proefrol binnen StandCacheDuur, niet pas als het token verloopt.
//
// Daarnaast zet de middleware de claims in de request-context, zodat de registratie-engine
// (die geen gin.Context kent) kan controleren of iemand het beheerdomein mag wijzigen.

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// DomeinBeheer is het domein van Gebruiker. Lezen en wijzigen vraagt de rol admin.
const DomeinBeheer = "beheer"

// StandCacheDuur is hoe lang een opgezochte stand wordt hergebruikt.
const StandCacheDuur = 30 * time.Second

// GebruikerStand is wat de middleware per verzoek over een gebruiker nodig heeft.
type GebruikerStand struct {
	Rol   string // hoogste geldige rol (zonder domein); leeg = geen rechten
	Email string
}

// GebruikerResolver zoekt de actuele stand op. ok=false: onbekend, geblokkeerd of geen rol.
type GebruikerResolver func(ctx context.Context, gebruikersnaam string) (stand GebruikerStand, ok bool, err error)

var (
	resolverMu sync.RWMutex
	resolver   GebruikerResolver
	standCache = map[string]gecachteStand{}
)

type gecachteStand struct {
	stand GebruikerStand
	ok    bool
	tot   time.Time
}

// ZetGebruikerResolver registreert de opzoekfunctie (main.go → gebruikers.Resolver).
// Zonder resolver gelden de claims uit het token, zoals vóór het gebruikersbeheer.
func ZetGebruikerResolver(r GebruikerResolver) {
	resolverMu.Lock()
	defer resolverMu.Unlock()
	resolver = r
	standCache = map[string]gecachteStand{}
}

// VergeetGebruikerStand wist de cache, bv. na een wachtwoordwijziging of nieuwe rol.
func VergeetGebruikerStand() {
	resolverMu.Lock()
	defer resolverMu.Unlock()
	standCache = map[string]gecachteStand{}
}

// actueleClaims past de claims aan de stand in het register aan. Nil = behandel het verzoek
// als anoniem. Bij een fout bij het opzoeken blijven de claims uit het token gelden (een
// database-storing mag niet iedereen buitensluiten).
func actueleClaims(ctx context.Context, claims *JWTClaims) *JWTClaims {
	resolverMu.RLock()
	r := resolver
	c, gecached := standCache[claims.Gebruikersnaam]
	resolverMu.RUnlock()
	if r == nil {
		return claims
	}
	if !gecached || time.Now().After(c.tot) {
		stand, ok, err := r(ctx, claims.Gebruikersnaam)
		if err != nil {
			fmt.Printf("WARN: stand van gebruiker %q niet op te zoeken: %v\n", claims.Gebruikersnaam, err)
			return claims
		}
		c = gecachteStand{stand: stand, ok: ok, tot: time.Now().Add(StandCacheDuur)}
		resolverMu.Lock()
		standCache[claims.Gebruikersnaam] = c
		resolverMu.Unlock()
	}
	if !c.ok || c.stand.Rol == "" {
		return nil
	}
	kopie := *claims
	kopie.Rol = c.stand.Rol
	kopie.Email = c.stand.Email
	return &kopie
}

type claimsSleutel struct{}
type systeemSleutel struct{}

// MetClaims zet de claims in een context (door JWTAuthMiddleware op het request gezet).
func MetClaims(ctx context.Context, claims *JWTClaims) context.Context {
	return context.WithValue(ctx, claimsSleutel{}, claims)
}

// ClaimsUitContext haalt de claims uit een context (nil als niet ingelogd).
func ClaimsUitContext(ctx context.Context) *JWTClaims {
	claims, _ := ctx.Value(claimsSleutel{}).(*JWTClaims)
	return claims
}

// AlsSysteem markeert een context als interne aanroep (seed, migratie), die het
// beheerdomein mag wijzigen zonder ingelogde admin.
func AlsSysteem(ctx context.Context) context.Context {
	return context.WithValue(ctx, systeemSleutel{}, true)
}

// MagBeheren zegt of de aanroeper in deze context het beheerdomein mag lezen of wijzigen:
// auth uit (dev), een systeemaanroep, of een ingelogde admin.
func MagBeheren(ctx context.Context) bool {
	if !IsAuthEnabled() {
		return true
	}
	if systeem, _ := ctx.Value(systeemSleutel{}).(bool); systeem {
		return true
	}
	claims := ClaimsUitContext(ctx)
	return claims != nil && rolToegestaan(claims.Rol, "admin")
}
