package model

// Additieve DatatypeRegistry-entries — voegt datatypes toe aan de bestaande DatatypeRegistry.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initRegisterDatatypeRegistry() {
	DatatypeRegistry = append(DatatypeRegistry,
		V3Datatype{
			Naam:        "KorteTekst",
			Description: "Alfanumerieke tekst, max 255 tekens (MIM: AN255).",
			Basistype:   "string",
			Positie:     &V3Positie{X: 2955, Y: 330},
			Validatie: &V3Validatie{
				MaxLength: intPtr(255),
			},
			Weergave: &V3Weergave{},
		},
		V3Datatype{
			Naam:        "LangeTekst",
			Description: "Onbeperkte tekst, meerdere regels (MIM: CharacterString).",
			Basistype:   "string",
			Positie:     &V3Positie{X: 2940, Y: 165},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "AN40",
			Description: "Alfanumerieke tekst, max 40 tekens (MIM: AN40).",
			Basistype:   "string",
			Positie:     &V3Positie{X: 3205, Y: 95},
			Validatie: &V3Validatie{
				MaxLength: intPtr(40),
			},
			Weergave: &V3Weergave{},
		},
		V3Datatype{
			Naam:        "AN200",
			Description: "Alfanumerieke tekst, max 200 tekens (MIM: AN200).",
			Basistype:   "string",
			Positie:     &V3Positie{X: 3195, Y: 330},
			Validatie: &V3Validatie{
				MaxLength: intPtr(200),
			},
			Weergave: &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Geheel",
			Description: "Geheel getal (MIM: Integer).",
			Basistype:   "integer",
			Format:      "int32",
			Positie:     &V3Positie{X: 3090, Y: 750},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Decimaal",
			Description: "Decimaal getal met 2 decimalen (MIM: Real).",
			Basistype:   "number",
			Format:      "double",
			Positie:     &V3Positie{X: 2880, Y: 750},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Bedrag",
			Description: "Geldbedrag in euro's, 2 decimalen.",
			Basistype:   "number",
			Format:      "double",
			Positie:     &V3Positie{X: 3810, Y: 600},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Percentage",
			Description: "Percentagewaarde met 1 decimaal.",
			Basistype:   "number",
			Format:      "double",
			Positie:     &V3Positie{X: 3780, Y: 75},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Datum",
			Description: "Kalenderdatum zonder tijdcomponent (MIM: Date).",
			Basistype:   "string",
			Format:      "date",
			Positie:     &V3Positie{X: 3480, Y: 315},
			Validatie:   &V3Validatie{},
			Weergave: &V3Weergave{
				Placeholder: "JJJJ-MM-DD",
			},
		},
		V3Datatype{
			Naam:        "DatumTijd",
			Description: "Datum en tijd met tijdzone (MIM: DateTime).",
			Basistype:   "string",
			Format:      "date-time",
			Positie:     &V3Positie{X: 3690, Y: 330},
			Validatie:   &V3Validatie{},
			Weergave: &V3Weergave{
				Placeholder: "JJJJ-MM-DDThh:mm",
			},
		},
		V3Datatype{
			Naam:        "Jaar",
			Description: "Jaartal, 4 cijfers (MIM: Year).",
			Basistype:   "integer",
			Positie:     &V3Positie{X: 3930, Y: 285},
			Validatie: &V3Validatie{
				MinLength: intPtr(4),
				MaxLength: intPtr(4),
			},
			Weergave: &V3Weergave{
				Placeholder: "2025",
			},
		},
		V3Datatype{
			Naam:        "JaNee",
			Description: "Ja/Nee keuze (MIM: Boolean).",
			Basistype:   "boolean",
			Positie:     &V3Positie{X: 3495, Y: 90},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "KvKNummer",
			Description: "KvK-nummer (8 cijfers).",
			Basistype:   "string",
			Format:      "kvk-nummer",
			Domein:      "register",
			Positie:     &V3Positie{X: 3420, Y: 720},
			Validatie: &V3Validatie{
				Pattern:     `^[0-9]{8}$`,
				MinLength:   intPtr(8),
				MaxLength:   intPtr(8),
				Voorbeelden: []string{"12345678"},
				Foutmelding: "Voer een geldig KvK-nummer in (8 cijfers)",
			},
			Weergave: &V3Weergave{
				Placeholder: "12345678",
				InputMask:   "00000000",
			},
		},
		V3Datatype{
			Naam:        "NLPostcode",
			Description: "Nederlandse postcode (4 cijfers + 2 letters)",
			Basistype:   "string",
			Format:      "nl-postcode",
			Domein:      "register",
			Positie:     &V3Positie{X: 570, Y: -330},
			Validatie: &V3Validatie{
				Pattern:     `^[1-9][0-9]{3}\s?[A-Za-z]{2}$`,
				MinLength:   intPtr(6),
				MaxLength:   intPtr(7),
				Voorbeelden: []string{"1234 AB", "9999ZZ"},
				Foutmelding: "Voer een geldige postcode in (bijv. 1234 AB)",
			},
			Normalisatie: "uppercase_letters",
			Weergave: &V3Weergave{
				Placeholder: "1234 AB",
				InputMask:   "0000 AA",
			},
		},
		V3Datatype{
			Naam:        "BSN",
			Description: "Burgerservicenummer (9 cijfers, 11-proef)",
			Basistype:   "string",
			Format:      "bsn",
			Domein:      "register",
			Positie:     &V3Positie{X: -720, Y: -570},
			Validatie: &V3Validatie{
				Pattern:     `^[0-9]{9}$`,
				MinLength:   intPtr(9),
				MaxLength:   intPtr(9),
				Voorbeelden: []string{"123456782"},
				Foutmelding: "Voer een geldig BSN in (9 cijfers, 11-proef)",
				Regels: []V3Regel{
					{Naam: "11-proef", Type: "checksum", Expressie: "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0"},
				},
			},
			Weergave: &V3Weergave{
				Placeholder: "123456782",
				InputMask:   "000000000",
			},
		},
	)
}
