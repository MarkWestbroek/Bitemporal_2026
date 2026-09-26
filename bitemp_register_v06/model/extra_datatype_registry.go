package model

// Extra (handmatig onderhouden) DatatypeRegistry-entries die NIET door
// cmd/codegen worden overschreven. Wordt geregistreerd via init() in
// `metaregistry_plumbing.go` (zie initExtraDatatypeRegistry()-aanroep).
//
// Plan B.A.1: zie docs/BACKLOG_UITVOERING_INCREMENTEN.md.

func initExtraDatatypeRegistry() {
	DatatypeRegistry = append(DatatypeRegistry,
		V3Datatype{
			// Voor een enum-veld dat meerdere waarden mag bevatten zonder eigen GE
			// (bv. CG_laag: "Laag 1;Laag 2"). Het veld houdt zijn enum; elke waarde wordt
			// daartegen gecontroleerd (validation_walker.go). Tussenoplossing vóór
			// hermodelleren naar een meervoudig GE; zie docs/plans/2026-09-26 Invoersoort en vorm.
			Naam:        "EnumLijst",
			Description: "Meerdere waarden uit het enum van het veld, gescheiden door een puntkomma (bijv. \"Laag 1;Laag 2\").",
			Basistype:   "string",
			Domein:      "register",
			Weergave: &V3Weergave{
				Scheiding: ";",
			},
		},
		V3Datatype{
			Naam:        "Kleur",
			Description: "Hex-kleurcode in CSS-formaat (#RGB, #RRGGBB of #RRGGBBAA).",
			Basistype:   "string",
			Format:      "color-hex",
			Domein:      "register",
			Validatie: &V3Validatie{
				Pattern:     `^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$`,
				MinLength:   intPtr(4),
				MaxLength:   intPtr(9),
				Voorbeelden: []string{"#fff", "#1a2b3c", "#ff8800cc"},
				Foutmelding: "Voer een geldige hex-kleur in (bijv. #1a2b3c)",
			},
			Weergave: &V3Weergave{
				Placeholder: "#1a2b3c",
				Widget:      "color",
			},
		},
		V3Datatype{
			Naam:        "Duur",
			Description: "Tijdsduur in ISO-8601 notatie (bijv. P1Y, PT30M, P1DT2H).",
			Basistype:   "string",
			Format:      "duration",
			Domein:      "register",
			Validatie: &V3Validatie{
				// Vereenvoudigd ISO-8601 duration regex.
				Pattern:     `^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$`,
				MinLength:   intPtr(2),
				Voorbeelden: []string{"PT30M", "P1D", "P1Y2M3DT4H5M6S"},
				Foutmelding: "Voer een geldige ISO-8601 duration in (bijv. PT30M of P1Y)",
			},
			Weergave: &V3Weergave{
				Placeholder: "PT30M",
			},
		},
		V3Datatype{
			Naam:        "UrlHttps",
			Description: "URL die uitsluitend het https-schema accepteert.",
			Basistype:   "string",
			Format:      "uri-https",
			Domein:      "register",
			Validatie: &V3Validatie{
				Pattern:     `^https://[^\s]+$`,
				Voorbeelden: []string{"https://example.com/pad?x=1"},
				Foutmelding: "Voer een geldige https:// URL in",
			},
			Weergave: &V3Weergave{
				Placeholder: "https://example.com",
			},
		},
		V3Datatype{
			Naam:        "GeoPunt",
			Description: "Geografische coördinaat (WGS84) als 'lat,lng' (decimale graden).",
			Basistype:   "string",
			Format:      "geo-point",
			Domein:      "register",
			Validatie: &V3Validatie{
				// lat: -90..90 ; lng: -180..180 (basis-regex; precieze range-check in validator)
				Pattern:     `^-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?$`,
				Voorbeelden: []string{"52.3676,4.9041", "-33.8688,151.2093"},
				Foutmelding: "Voer een geldig 'lat,lng'-paar in (bijv. 52.3676,4.9041)",
				Regels: []V3Regel{
					{Naam: "geo-range", Type: "geo-range", Expressie: "lat in [-90,90] && lng in [-180,180]"},
				},
			},
			Weergave: &V3Weergave{
				Placeholder: "52.3676,4.9041",
			},
		},
	)
}
