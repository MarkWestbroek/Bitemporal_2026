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
			Positie:     &V3Positie{X: 615, Y: 495},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "URL",
			Description: "Volledig internetadres.",
			Basistype:   "string",
			Format:      "uri",
			Domein:      "CG",
			Positie:     &V3Positie{X: -510, Y: 255},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Emailadres",
			Description: "E-mailadres.",
			Basistype:   "string",
			Format:      "email",
			Domein:      "CG",
			Positie:     &V3Positie{X: -510, Y: -225},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "Telefoonnummer",
			Description: "Telefoonnummer in nationale of internationale notatie.",
			Basistype:   "string",
			Format:      "phone",
			Domein:      "CG",
			Positie:     &V3Positie{X: -525, Y: -15},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
		V3Datatype{
			Naam:        "GitAdres",
			Description: "Adres van een Git repository, bijvoorbeeld HTTPS of SSH.",
			Basistype:   "string",
			Format:      "git-address",
			Domein:      "CG",
			Positie:     &V3Positie{X: 975, Y: 315},
			Validatie:   &V3Validatie{},
			Weergave:    &V3Weergave{},
		},
	)
}
