package model

// Additieve DatatypeRegistry-entries — voegt datatypes toe aan de bestaande DatatypeRegistry.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initNpLocDatatypeRegistry() {
	DatatypeRegistry = append(DatatypeRegistry,
		V3Datatype{
			Naam:      "NLPostcode",
			Basistype: "string",
			Format:    "nl-postcode",
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
			Naam:      "BSN",
			Basistype: "string",
			Format:    "bsn",
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
		V3Datatype{
			Naam:        "NLPostcode",
			Description: "Nederlandse postcode (4 cijfers + 2 letters)",
			Basistype:   "string",
			Format:      "nl-postcode",
			Domein:      "register",
			Positie:     &V3Positie{X: 750, Y: 345},
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
			Positie:     &V3Positie{X: -480, Y: 165},
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
