// Package handlers — registratie_tijd.go
//
// Bepaalt hoe het formele registratietijdstip wordt gezet (BE-review 2026-07-07, actiepunt 2).
//
// Twee modi, gekozen via de env-variabele REGISTRATIE_TIJD:
//
//   - "synthetisch" (default): demo-/testmodus. Elk registratietijdstip wordt
//     afgeleid van het registratie-ID: 2026-01-01T00:00:00Z + ID uren + ID µs.
//     De frontend-tijdlijnvisualisaties (t=1, t=2, …) en de querystring-
//     shorthands ?t= / ?ta= / ?tb= bouwen op deze afbeelding. Voor demo's van
//     bitemporaliteit is dit veel leesbaarder dan echte kloktijden.
//
//   - "klok": productiemodus. Het registratietijdstip is de echte kloktijd
//     (UTC) op het moment van registreren. Vereist voor echte implementaties
//     (zoals het CG-domein), waar de formele tijdlijn de werkelijkheid moet
//     weerspiegelen. De ?t=-shorthand blijft technisch werken maar wijst dan
//     naar de synthetische as en is dus niet zinvol; gebruik ?peiltijdstip=.
package handlers

import (
	"os"
	"strings"
)

// Waarden voor RegistratieTijdModus.
const (
	RegistratieTijdSynthetisch = "synthetisch"
	RegistratieTijdKlok        = "klok"
)

// RegistratieTijdModus leest de REGISTRATIE_TIJD env-variabele.
// Onbekende of lege waarden vallen terug op "synthetisch" (backward compatible
// met de bestaande demo-frontend).
func RegistratieTijdModus() string {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("REGISTRATIE_TIJD")))
	switch v {
	case RegistratieTijdKlok, "reeel", "echt", "real", "clock":
		return RegistratieTijdKlok
	default:
		return RegistratieTijdSynthetisch
	}
}

// IsKlokTijdModus is true wanneer registraties de echte (UTC-)kloktijd krijgen.
func IsKlokTijdModus() bool {
	return RegistratieTijdModus() == RegistratieTijdKlok
}
