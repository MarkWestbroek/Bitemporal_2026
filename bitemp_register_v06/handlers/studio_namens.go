package handlers

// `namens` op het operatielog (werkplaats-plan §4B; akkoord Mark 10-11).
//
// Imprint schrijft in de werkplaats met één serviceaccount (omnium-schrijver; het token staat
// alleen in een k8s-secret). Zonder meer zou elke op dan dat account als actor hebben. Met
// `namens` in de op-batch geeft Imprint de ingelogde Imprint-gebruiker mee; de server bewaart
// die naast `actor` en toont hem in GET …/ops en SSE ("omnium-schrijver namens jan").
//
// Alleen accounts in OMNIUM_NAMENS_ACCOUNTS (komma-gescheiden gebruikersnamen) mogen dat;
// iedereen anders krijgt 403 "namens_niet_toegestaan", zodat een modelleur niet op naam van
// een ander kan schrijven. `actor` blijft altijd het echte account: `namens` is wat het
// serviceaccount verklaart. Zonder AUTH_ENABLED (dev) mag iedereen, zoals alles dan mag.
// Token exchange (een Omnium-token per Imprint-gebruiker) maakt dit later overbodig.

import (
	"os"
	"regexp"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
)

// namensPatroon: een gebruikersnaam of e-mailadres.
var namensPatroon = regexp.MustCompile(`^[A-Za-z0-9._@+-]{1,128}$`)

// namensAccounts leest OMNIUM_NAMENS_ACCOUNTS (per aanroep, zodat tests hem kunnen zetten).
func namensAccounts() map[string]bool {
	uit := map[string]bool{}
	for _, d := range strings.Split(os.Getenv("OMNIUM_NAMENS_ACCOUNTS"), ",") {
		if d = strings.TrimSpace(d); d != "" {
			uit[d] = true
		}
	}
	return uit
}

// magNamensSchrijven: mag deze actor `namens` meesturen?
func magNamensSchrijven(actor string) bool {
	if !middleware.IsAuthEnabled() {
		return true
	}
	return actor != "" && namensAccounts()[actor]
}
