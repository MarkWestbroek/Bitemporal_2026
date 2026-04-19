package model

// Additieve DatatypeRegistry-entries — voegt datatypes toe aan de bestaande DatatypeRegistry.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initCgDatatypeRegistry() {
	DatatypeRegistry = append(DatatypeRegistry,
		V3Datatype{
			Naam:        "URL",
			Description: "Volledig internetadres.",
			Basistype:   "string",
			Format:      "uri",
			Domein:      "CG",
			Positie:     &V3Positie{X: 1005, Y: -1575},
		},
		V3Datatype{
			Naam:        "Emailadres",
			Description: "E-mailadres.",
			Basistype:   "string",
			Format:      "email",
			Domein:      "CG",
			Positie:     &V3Positie{X: -690, Y: -2250},
		},
		V3Datatype{
			Naam:        "Telefoonnummer",
			Description: "Telefoonnummer in nationale of internationale notatie.",
			Basistype:   "string",
			Format:      "phone",
			Domein:      "CG",
			Positie:     &V3Positie{X: -465, Y: -2250},
		},
		V3Datatype{
			Naam:        "GitAdres",
			Description: "Adres van een Git repository, bijvoorbeeld HTTPS of SSH.",
			Basistype:   "string",
			Format:      "git-address",
			Domein:      "CG",
			Positie:     &V3Positie{X: 915, Y: -1725},
		},
	)
}
