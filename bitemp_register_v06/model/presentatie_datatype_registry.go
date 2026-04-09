package model

// Presentatie-datatypes — domeinonafhankelijke gegevenstypen die beschrijven hoe een
// veld wordt getoond en ingevoerd. Gebaseerd op MIM (Metamodel Informatiemodellering,
// Geonovum) classificatie: AN, AN{n}, CharacterString, N{n,m}, Date, DateTime, etc.
//
// Deze types worden als eerste in de DatatypeRegistry geladen, vóór domeinspecifieke types.
// Frontend leest widget/prefix/suffix/multiline uit de Weergave om het juiste invoercomponent
// te renderen (bijv. textarea voor LangeTekst, valuta-prefix voor Bedrag).

func initPresentatieDatatypeRegistry() {
	DatatypeRegistry = append(DatatypeRegistry,
		// ── Tekst ───────────────────────────────────────────────
		V3Datatype{
			Naam:        "KorteTekst",
			Description: "Alfanumerieke tekst, max 255 tekens (MIM: AN255).",
			Basistype:   "string",
			Validatie:   &V3Validatie{MaxLength: intPtr(255)},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "LangeTekst",
			Description: "Onbeperkte tekst, meerdere regels (MIM: CharacterString).",
			Basistype:   "string",
			Weergave: &V3Weergave{
				Widget:    "textarea",
				Multiline: true,
			},
		},
		V3Datatype{
			Naam:        "AN40",
			Description: "Alfanumerieke tekst, max 40 tekens (MIM: AN40).",
			Basistype:   "string",
			Validatie:   &V3Validatie{MaxLength: intPtr(40)},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "AN200",
			Description: "Alfanumerieke tekst, max 200 tekens (MIM: AN200).",
			Basistype:   "string",
			Validatie:   &V3Validatie{MaxLength: intPtr(200)},
			Weergave:    &V3Weergave{},
		},

		// ── Numeriek ────────────────────────────────────────────
		V3Datatype{
			Naam:        "Geheel",
			Description: "Geheel getal (MIM: Integer).",
			Basistype:   "integer",
			Format:      "int32",
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Decimaal",
			Description: "Decimaal getal met 2 decimalen (MIM: Real).",
			Basistype:   "number",
			Format:      "double",
			Weergave: &V3Weergave{
				Decimalen: intPtr(2),
			},
		},
		V3Datatype{
			Naam:        "Bedrag",
			Description: "Geldbedrag in euro's, 2 decimalen.",
			Basistype:   "number",
			Format:      "double",
			Weergave: &V3Weergave{
				Widget:    "currency",
				Prefix:    "€",
				Decimalen: intPtr(2),
			},
		},
		V3Datatype{
			Naam:        "Percentage",
			Description: "Percentagewaarde met 1 decimaal.",
			Basistype:   "number",
			Format:      "double",
			Weergave: &V3Weergave{
				Suffix:    "%",
				Decimalen: intPtr(1),
			},
		},

		// ── Datum/Tijd ──────────────────────────────────────────
		V3Datatype{
			Naam:        "Datum",
			Description: "Kalenderdatum zonder tijdcomponent (MIM: Date).",
			Basistype:   "string",
			Format:      "date",
			Weergave: &V3Weergave{
				Placeholder: "JJJJ-MM-DD",
			},
		},
		V3Datatype{
			Naam:        "DatumTijd",
			Description: "Datum en tijd met tijdzone (MIM: DateTime).",
			Basistype:   "string",
			Format:      "date-time",
			Weergave: &V3Weergave{
				Placeholder: "JJJJ-MM-DDThh:mm",
			},
		},
		V3Datatype{
			Naam:        "Jaar",
			Description: "Jaartal, 4 cijfers (MIM: Year).",
			Basistype:   "integer",
			Validatie: &V3Validatie{
				MinLength: intPtr(4),
				MaxLength: intPtr(4),
			},
			Weergave: &V3Weergave{
				Placeholder: "2025",
			},
		},

		// ── Boolean ─────────────────────────────────────────────
		V3Datatype{
			Naam:        "JaNee",
			Description: "Ja/Nee keuze (MIM: Boolean).",
			Basistype:   "boolean",
			Weergave: &V3Weergave{
				Widget: "checkbox",
			},
		},

		// ── Domeinspecifiek (financieel / register) ─────────────
		V3Datatype{
			Naam:        "IBAN",
			Description: "Internationaal bankrekeningnummer (IBAN).",
			Basistype:   "string",
			Format:      "iban",
			Domein:      "financieel",
			Validatie: &V3Validatie{
				Pattern:     `^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$`,
				MinLength:   intPtr(15),
				MaxLength:   intPtr(34),
				Voorbeelden: []string{"NL91ABNA0417164300"},
				Foutmelding: "Voer een geldig IBAN in (bijv. NL91ABNA0417164300)",
			},
			Weergave: &V3Weergave{
				Placeholder: "NL91ABNA0417164300",
				InputMask:   "AA00 AAAA 0000 0000 00",
			},
		},
		V3Datatype{
			Naam:        "KvKNummer",
			Description: "KvK-nummer (8 cijfers).",
			Basistype:   "string",
			Format:      "kvk-nummer",
			Domein:      "register",
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
	)
}
