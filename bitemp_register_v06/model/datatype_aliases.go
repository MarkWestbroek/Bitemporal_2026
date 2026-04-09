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

// KorteTekst — Alfanumerieke tekst, max 255 tekens (MIM: AN255).
type KorteTekst string

// LangeTekst — Onbeperkte tekst, meerdere regels (MIM: CharacterString).
type LangeTekst string

// AN40 — Alfanumerieke tekst, max 40 tekens (MIM: AN40).
type AN40 string

// AN200 — Alfanumerieke tekst, max 200 tekens (MIM: AN200).
type AN200 string

// Geheel — Geheel getal (MIM: Integer).
type Geheel int64

// Decimaal — Decimaal getal met 2 decimalen (MIM: Real).
type Decimaal float64

// Bedrag — Geldbedrag in euro's, 2 decimalen.
type Bedrag float64

// Percentage — Percentagewaarde met 1 decimaal.
type Percentage float64

// DatumTijd — Datum en tijd met tijdzone (MIM: DateTime).
type DatumTijd string

// Jaar — Jaartal, 4 cijfers (MIM: Year).
type Jaar int64

// JaNee — Ja/Nee keuze (MIM: Boolean).
type JaNee bool

// IBAN — Internationaal bankrekeningnummer (IBAN).
type IBAN string

// KvKNummer — KvK-nummer (8 cijfers).
type KvKNummer string

// Versie — Versienummer in semver-achtig formaat: m.n (verplicht), optioneel m.n.o of m.n.o.p.
type Versie string
