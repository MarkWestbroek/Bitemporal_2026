package model

// Additieve DatatypeRegistry-entries — voegt datatypes toe aan de bestaande DatatypeRegistry.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initFinancieelDatatypeRegistry() {
	DatatypeRegistry = append(DatatypeRegistry,
		V3Datatype{
			Naam:        "IBAN",
			Description: "Internationaal bankrekeningnummer (IBAN).",
			Basistype:   "string",
			Format:      "iban",
			Domein:      "financieel",
			Positie:     &V3Positie{X: 3780, Y: 780},
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
	)
}
