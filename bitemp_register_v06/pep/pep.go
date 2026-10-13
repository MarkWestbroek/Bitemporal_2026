// Package pep is de PEP (Policy Enforcement Point) op het leespad: het dwingt de beslissingen
// van de PDP (package toegang) af in de antwoorden van de API.
//
// Plan: docs/plans/"2026-10-12 Toegang op beleid — PAP, PDP en PEP (plan).md", fase 1b.
//
// Schakelaar: TOEGANG_BUNDEL=<pad naar een gecompileerde beleidsbundel>. Zonder die variabele
// doet de PEP niets en gedraagt de API zich als voorheen (LEESTOEGANG blijft dan bepalend).
// Met een bundel:
//   - leest de PEP het subject uit de JWT-claims (anoniem zonder geldige cookie);
//   - weigert hij een leesverzoek met 403 als het subject van dat type zeker niets mag zien;
//   - snoeit hij elk record tot de velden die het subject mag bekijken, per veld, met de
//     gegevens van het record zelf als "betrokkene" voor voorwaarden;
//   - laat hij records weg waarvan niets zichtbaar overblijft (detail: 404).
//
// Beleidspaden zijn de veldpaden van de Studio (modelpicker/veldenlijst.js): entiteit +
// jsonRolnaam-keten + JSON-veldnaam. In een /full-antwoord valt het Hub+_Data-niveau `data`
// daarbij weg, en technische sleutels (id, opvoer, afvoer, rel_id, versie, *_id) zijn geen
// beleidspaden: zij gaan mee met de inhoud waar ze bij horen.
package pep

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/toegang"
	"github.com/gin-gonic/gin"
)

var actief atomic.Pointer[toegang.Bundel]

// Init laadt de bundel uit TOEGANG_BUNDEL (indien gezet). Een fout is fataal voor de
// aanroeper: met een kapotte bundel open draaien zou het beleid stilzwijgend negeren.
func Init() error {
	pad := strings.TrimSpace(os.Getenv("TOEGANG_BUNDEL"))
	if pad == "" {
		fmt.Println("toegang: geen TOEGANG_BUNDEL — PEP op het leespad staat uit")
		return nil
	}
	data, err := os.ReadFile(pad)
	if err != nil {
		return fmt.Errorf("TOEGANG_BUNDEL %q: %w", pad, err)
	}
	b, err := toegang.LaadBundel(data)
	if err != nil {
		return fmt.Errorf("TOEGANG_BUNDEL %q: %w", pad, err)
	}
	actief.Store(b)
	fmt.Printf("toegang: beleid %q actief (%d regels, standaard %s, conflict %s)\n",
		b.Beleid.Naam, len(b.Regels), b.Standaard, b.Conflict)
	return nil
}

// Actief geeft de actieve bundel, of nil als de PEP uit staat.
func Actief() *toegang.Bundel { return actief.Load() }

// ZetBundel vervangt de actieve bundel (nil = uit). Voor tests en, later, publiceren vanuit
// de Studio zonder herstart.
func ZetBundel(b *toegang.Bundel) { actief.Store(b) }


// SubjectUit leidt het subject af uit de JWT-claims. Voorlopig (besluit Mark 12-10) alleen
// gebruiker of anoniem; kenmerken: rol (met hiërarchie) en gebruikersnaam.
func SubjectUit(c *gin.Context) toegang.Subject {
	return subjectUitClaims(middleware.GetClaims(c))
}

// SubjectUitContext: idem uit een request-context (de JWT-middleware zet de claims daar ook
// in; GraphQL krijgt alleen de context).
func SubjectUitContext(ctx context.Context) toegang.Subject {
	return subjectUitClaims(middleware.ClaimsUitContext(ctx))
}

func subjectUitClaims(claims *middleware.JWTClaims) toegang.Subject {
	if claims == nil {
		return toegang.Subject{Anoniem: true}
	}
	// Een hogere rol heeft de lagere rollen ook (rangorde en aliassen: middleware/rollen.go),
	// zodat beleid op "viewer" ook voor een admin of bouwer geldt.
	rollen := middleware.RollenTotEnMet(strings.ToLower(claims.Rol))
	k := map[string][]string{"rol": rollen}
	if claims.Gebruikersnaam != "" {
		k["gebruikersnaam"] = []string{claims.Gebruikersnaam}
	}
	return toegang.Subject{Kenmerken: k}
}

// verzoekUit bouwt de basis van een leesverzoek. Het peilmoment voor de geldigheid van het
// beleid is "nu"; het formele peiltijdstip van de query (?peiltijdstip=) gaat over de data,
// niet over welk beleid nu geldt.
func verzoekUit(c *gin.Context) toegang.Verzoek {
	return toegang.Verzoek{Subject: SubjectUit(c), Handeling: "bekijken", Peilmoment: time.Now()}
}

func verzoekUitContext(ctx context.Context) toegang.Verzoek {
	return toegang.Verzoek{Subject: SubjectUitContext(ctx), Handeling: "bekijken", Peilmoment: time.Now()}
}

// Weiger schrijft het 403-antwoord van de PEP.
func Weiger(c *gin.Context) {
	c.JSON(403, gin.H{"error": "geen toegang volgens het actieve toegangsbeleid"})
}

// PlumbingLezer bewaakt leesroutes die (nog) niet per veld met beleid te adresseren zijn:
// registraties, wijzigingen, bestanden en id-opvragingen. Zonder actieve bundel doet hij
// niets; met een bundel moet het subject ingelogd zijn (tussenstap fase 1b, besluit Mark:
// ook een open probeer-register zet de plumbing niet open). Later vervangen door beleid op
// de plumbing zelf (registratie per zichtbare wijziging).
func PlumbingLezer() gin.HandlerFunc {
	return func(c *gin.Context) {
		if Actief() == nil || !SubjectUit(c).Anoniem {
			c.Next()
			return
		}
		c.AbortWithStatusJSON(401, gin.H{"error": "inloggen vereist: deze gegevens vallen onder het actieve toegangsbeleid"})
	}
}
