package model

// Additieve DatatypeRegistry-entries — voegt datatypes toe aan de bestaande DatatypeRegistry.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initConfiguratieDatatypeRegistry() {
	DatatypeRegistry = append(DatatypeRegistry,
		V3Datatype{
			Naam:        "Versie",
			Description: "Versienummer in semver-achtig formaat: m.n (verplicht), optioneel m.n.o of m.n.o.p.",
			Basistype:   "string",
			Format:      "versie",
			Domein:      "configuratie",
			Positie:     &V3Positie{X: 3390, Y: 495},
			Validatie: &V3Validatie{
				Pattern:     `^\d+\.\d+(\.\d+)?(\.\d+)?$`,
				Foutmelding: "Voer een geldig versienummer in (bijv. 1.0, 2.1.3 of 1.0.0.1)",
			},
			Weergave: &V3Weergave{
				Placeholder: "bijv. 1.0 of 2.1.3",
			},
		},
	)
}
