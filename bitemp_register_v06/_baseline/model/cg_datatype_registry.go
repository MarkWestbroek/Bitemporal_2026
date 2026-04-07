package model

// Additieve DatatypeRegistry-entries — voegt datatypes toe aan de bestaande DatatypeRegistry.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initCgDatatypeRegistry() {
	DatatypeRegistry = append(DatatypeRegistry,
		V3Datatype{
			Naam:        "Datum",
			Description: "Datum zonder tijdcomponent.",
			Basistype:   "string",
			Format:      "date",
			Domein:      "CG",
			Positie:     &V3Positie{X: 285, Y: -1875},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "URL",
			Description: "Volledig internetadres.",
			Basistype:   "string",
			Format:      "uri",
			Domein:      "CG",
			Positie:     &V3Positie{X: -675, Y: -1695},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Emailadres",
			Description: "E-mailadres.",
			Basistype:   "string",
			Format:      "email",
			Domein:      "CG",
			Positie:     &V3Positie{X: -765, Y: -2100},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Telefoonnummer",
			Description: "Telefoonnummer in nationale of internationale notatie.",
			Basistype:   "string",
			Format:      "phone",
			Domein:      "CG",
			Positie:     &V3Positie{X: -555, Y: -1995},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "GitAdres",
			Description: "Adres van een Git repository, bijvoorbeeld HTTPS of SSH.",
			Basistype:   "string",
			Format:      "git-address",
			Domein:      "CG",
			Positie:     &V3Positie{X: 915, Y: -1725},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
	)
}
