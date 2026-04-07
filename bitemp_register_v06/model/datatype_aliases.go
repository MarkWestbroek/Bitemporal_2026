package model

// Datatype aliases — Go type-definities voor custom datatypes.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

// NLPostcode — Nederlandse postcode (4 cijfers + 2 letters)
type NLPostcode string

// BSN — Burgerservicenummer (9 cijfers, 11-proef)
type BSN string

// Datum — Datum zonder tijdcomponent.
type Datum string

// URL — Volledig internetadres.
type URL string

// Emailadres — E-mailadres.
type Emailadres string

// Telefoonnummer — Telefoonnummer in nationale of internationale notatie.
type Telefoonnummer string

// GitAdres — Adres van een Git repository, bijvoorbeeld HTTPS of SSH.
type GitAdres string
