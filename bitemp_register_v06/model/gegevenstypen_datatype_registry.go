package model

// gegevenstypen_datatype_registry.go — Centraal, **handmatig onderhouden**
// register van algemene (cross-domein) datatypes met validatie-regels.
//
// Plan B.A.2 (zie docs/BACKLOG_UITVOERING_INCREMENTEN.md), refactor R2.
// Achtergrond: vóór deze refactor leefden algemene types verspreid over
// register/cg/financieel/extra (wat onlogisch is — een BSN of IBAN hoort
// niet bij domein "register" of "financieel" maar bij de gemeenschappelijke
// "gegevenstypen"-bibliotheek).
//
// Wordt als LAATSTE in init() aangeroepen (zie metaregistry_plumbing.go),
// zodat eventuele eerder geregistreerde duplicates (uit codegen-bestanden)
// vervangen worden door de canonieke versie hier — via `registreerOfVervangDatatype`.
//
// Toevoegen / wijzigen van een algemeen datatype gebeurt HIER. Codegen mag
// register_/cg_/financieel_-bestanden blijven vullen; deze registry overschrijft
// later wat conflicteert.

func initGegevenstypenDatatypeRegistry() {
	for _, dt := range gegevenstypen() {
		registreerOfVervangDatatype(dt)
	}
}

// gegevenstypen geeft de canonieke set algemene datatypes terug.
// Eén plek voor toekomstig onderhoud.
func gegevenstypen() []V3Datatype {
	return []V3Datatype{
		// — Tekstuele basistypen —
		{Naam: "KorteTekst", Description: "Alfanumerieke tekst, max 255 tekens (MIM: AN255).",
			Basistype: "string", Domein: "gegevenstypen",
			Validatie: &V3Validatie{MaxLength: intPtr(255)},
			Weergave:  &V3Weergave{}},
		{Naam: "LangeTekst", Description: "Onbeperkte tekst, meerdere regels (MIM: CharacterString).",
			Basistype: "string", Domein: "gegevenstypen",
			Validatie: &V3Validatie{},
			Weergave:  &V3Weergave{}},
		{Naam: "AN40", Description: "Alfanumerieke tekst, max 40 tekens (MIM: AN40).",
			Basistype: "string", Domein: "gegevenstypen",
			Validatie: &V3Validatie{MaxLength: intPtr(40)}},
		{Naam: "AN200", Description: "Alfanumerieke tekst, max 200 tekens (MIM: AN200).",
			Basistype: "string", Domein: "gegevenstypen",
			Validatie: &V3Validatie{MaxLength: intPtr(200)}},

		// — Numerieke basistypen —
		{Naam: "Geheel", Description: "Geheel getal (MIM: Integer).",
			Basistype: "integer", Format: "int32", Domein: "gegevenstypen",
			Validatie: &V3Validatie{}},
		{Naam: "Decimaal", Description: "Decimaal getal met 2 decimalen (MIM: Real).",
			Basistype: "number", Format: "double", Domein: "gegevenstypen",
			Validatie: &V3Validatie{}},
		{Naam: "Bedrag", Description: "Geldbedrag in euro's, 2 decimalen.",
			Basistype: "number", Format: "double", Domein: "gegevenstypen",
			Validatie: &V3Validatie{}},
		{Naam: "Percentage", Description: "Percentagewaarde met 1 decimaal.",
			Basistype: "number", Format: "double", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Regels: []V3Regel{
					{Naam: "0..100", Type: "formula", Expressie: "valueNum >= 0 && valueNum <= 100"},
				},
			}},

		// — Tijd-types —
		{Naam: "Datum", Description: "Kalenderdatum zonder tijdcomponent (MIM: Date).",
			Basistype: "string", Format: "date", Domein: "gegevenstypen",
			Validatie: &V3Validatie{Pattern: `^\d{4}-\d{2}-\d{2}$`},
			Weergave:  &V3Weergave{Placeholder: "JJJJ-MM-DD"}},
		{Naam: "DatumTijd", Description: "Datum en tijd met tijdzone (MIM: DateTime).",
			Basistype: "string", Format: "date-time", Domein: "gegevenstypen",
			Validatie: &V3Validatie{},
			Weergave:  &V3Weergave{Placeholder: "JJJJ-MM-DDThh:mm"}},
		{Naam: "Jaar", Description: "Jaartal, 4 cijfers (MIM: Year).",
			Basistype: "integer", Domein: "gegevenstypen",
			Validatie: &V3Validatie{MinLength: intPtr(4), MaxLength: intPtr(4)},
			Weergave:  &V3Weergave{Placeholder: "2025"}},
		{Naam: "Duur", Description: "Tijdsduur in ISO-8601 notatie (bijv. P1Y, PT30M, P1DT2H).",
			Basistype: "string", Format: "duration", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:     `^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$`,
				MinLength:   intPtr(2),
				Voorbeelden: []string{"PT30M", "P1D", "P1Y2M3DT4H5M6S"},
				Foutmelding: "Voer een geldige ISO-8601 duration in (bijv. PT30M of P1Y)",
			},
			Weergave: &V3Weergave{Placeholder: "PT30M"}},

		// — Boolean —
		{Naam: "JaNee", Description: "Ja/Nee keuze (MIM: Boolean).",
			Basistype: "boolean", Domein: "gegevenstypen",
			Validatie: &V3Validatie{}},

		// — Identificatie / nummers (NL-specifiek, maar generiek bruikbaar) —
		{Naam: "BSN", Description: "Burgerservicenummer (9 cijfers, 11-proef).",
			Basistype: "string", Format: "bsn", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{9}$`,
				MinLength: intPtr(9), MaxLength: intPtr(9),
				Voorbeelden: []string{"123456782"},
				Foutmelding: "Voer een geldig BSN in (9 cijfers, 11-proef)",
				Regels: []V3Regel{
					{Naam: "11-proef", Type: "checksum",
						Expressie: "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0"},
				},
			},
			Weergave: &V3Weergave{Placeholder: "123456782", InputMask: "000000000"}},
		{Naam: "KvKNummer", Description: "KvK-nummer (8 cijfers).",
			Basistype: "string", Format: "kvk-nummer", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{8}$`,
				MinLength: intPtr(8), MaxLength: intPtr(8),
				Voorbeelden: []string{"12345678"},
				Foutmelding: "Voer een geldig KvK-nummer in (8 cijfers)",
			},
			Weergave: &V3Weergave{Placeholder: "12345678", InputMask: "00000000"}},
		{Naam: "NLPostcode", Description: "Nederlandse postcode (4 cijfers + 2 letters).",
			Basistype: "string", Format: "nl-postcode", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[1-9][0-9]{3}\s?[A-Za-z]{2}$`,
				MinLength: intPtr(6), MaxLength: intPtr(7),
				Voorbeelden: []string{"1234 AB", "9999ZZ"},
				Foutmelding: "Voer een geldige postcode in (bijv. 1234 AB)",
			},
			Normalisatie: "uppercase_letters",
			Weergave:     &V3Weergave{Placeholder: "1234 AB", InputMask: "0000 AA"}},
		{Naam: "IBAN", Description: "Internationaal bankrekeningnummer (IBAN, ISO 13616), met mod-97 check.",
			Basistype: "string", Format: "iban", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$`,
				MinLength: intPtr(15), MaxLength: intPtr(34),
				Voorbeelden: []string{"NL91ABNA0417164300"},
				Foutmelding: "Voer een geldig IBAN in (bijv. NL91ABNA0417164300)",
				Regels: []V3Regel{
					{Naam: "mod-97", Type: "function", Expressie: "iban_mod97"},
				},
			},
			Weergave: &V3Weergave{Placeholder: "NL91ABNA0417164300", InputMask: "AA00 AAAA 0000 0000 00"}},

		// — Communicatie —
		{Naam: "Emailadres", Description: "E-mailadres conform RFC 5322 (vereenvoudigd).",
			Basistype: "string", Format: "email", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:     `^[^@\s]+@[^@\s]+\.[^@\s]+$`,
				Voorbeelden: []string{"naam@example.com"},
				Foutmelding: "Voer een geldig e-mailadres in",
			},
			Weergave: &V3Weergave{Placeholder: "naam@example.com"}},
		{Naam: "Telefoonnummer", Description: "Telefoonnummer in nationale of internationale notatie.",
			Basistype: "string", Format: "phone", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:     `^[+0-9][0-9\s\-()]{6,20}$`,
				Voorbeelden: []string{"+31 6 12345678", "0612345678"},
				Foutmelding: "Voer een geldig telefoonnummer in",
			},
			Weergave: &V3Weergave{Placeholder: "+31 6 12345678"}},
		{Naam: "URL", Description: "Volledig internetadres (http of https).",
			Basistype: "string", Format: "uri", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:     `^https?://[^\s]+$`,
				Voorbeelden: []string{"https://example.com/pad?x=1"},
				Foutmelding: "Voer een geldige http(s)-URL in",
			},
			Weergave: &V3Weergave{Placeholder: "https://example.com"}},
		{Naam: "UrlHttps", Description: "URL die uitsluitend het https-schema accepteert.",
			Basistype: "string", Format: "uri-https", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:     `^https://[^\s]+$`,
				Voorbeelden: []string{"https://example.com/pad?x=1"},
				Foutmelding: "Voer een geldige https:// URL in",
			},
			Weergave: &V3Weergave{Placeholder: "https://example.com"}},

		// — Visueel / geo —
		{Naam: "Kleur", Description: "Hex-kleurcode in CSS-formaat (#RGB, #RRGGBB of #RRGGBBAA).",
			Basistype: "string", Format: "color-hex", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$`,
				MinLength: intPtr(4), MaxLength: intPtr(9),
				Voorbeelden: []string{"#fff", "#1a2b3c", "#ff8800cc"},
				Foutmelding: "Voer een geldige hex-kleur in (bijv. #1a2b3c)",
			},
			Weergave: &V3Weergave{Placeholder: "#1a2b3c", Widget: "color"}},
		{Naam: "GeoPunt", Description: "Geografische coördinaat (WGS84) als 'lat,lng' in decimale graden.",
			Basistype: "string", Format: "geo-point", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:     `^-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?$`,
				Voorbeelden: []string{"52.3676,4.9041", "-33.8688,151.2093"},
				Foutmelding: "Voer een geldig 'lat,lng'-paar in (bijv. 52.3676,4.9041)",
				Regels: []V3Regel{
					// Bereik-check via named function: in lat ∈ [-90,90] en lng ∈ [-180,180].
					{Naam: "geo-range", Type: "function", Expressie: "geo_range"},
				},
			},
			Weergave: &V3Weergave{Placeholder: "52.3676,4.9041"}},

		// — Zorg / identificatie (NL-specifiek) —
		{Naam: "AGBCode", Description: "AGB-code: 8-cijferig identificatienummer voor zorgaanbieders en zorginstellingen (Agb = Algemeen Gegevens Beheer). Eerste 2 cijfers = specialismetype.",
			Basistype: "string", Format: "agb-code", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{8}$`,
				MinLength: intPtr(8), MaxLength: intPtr(8),
				Voorbeelden: []string{"04010700", "14010200"},
				Foutmelding: "Voer een geldige AGB-code in (8 cijfers)",
			},
			Weergave: &V3Weergave{Placeholder: "04010700", InputMask: "00000000"}},
		// TIN is het buitenlandse fiscale identificatienummer, bijv. voor UBO's bij KvK.
		// Elk land kent een eigen formaat, dus validatie is structureel: ISO 3166-1 alpha-2
		// landcode (2 hoofdletters) gevolgd door het land-specifieke nummer (1–20 tekens).
		// Voor NL-ingezetenen geldt het BSN; gebruik daarvoor het BSN-type.
		{Naam: "TIN", Description: "Tax Identification Number: buitenlands fiscaal identificatienummer, bijv. voor UBO's. Formaat: ISO 3166-1 alpha-2 landcode + 1–20 alfanumerieke tekens. Per land verschilt de structuur; dit type valideert alleen het basisformaat. Gebruik BSN voor NL-ingezetenen.",
			Basistype: "string", Format: "tin", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				// Twee hoofdletters landcode (ISO 3166-1) + 1–20 alfanumerieke tekens.
				// Ruime bovengrens; exacte lengte varieert sterk per land.
				Pattern:   `^[A-Z]{2}[A-Z0-9]{1,20}$`,
				MinLength: intPtr(3), MaxLength: intPtr(22),
				Voorbeelden: []string{"DE123456789", "BE12345678901", "FR12345678901", "GB1234567890"},
				Foutmelding: "Voer een geldig TIN in (ISO 3166-1 landcode + fiscaal nummer, bijv. DE123456789)",
			},
			Weergave: &V3Weergave{Placeholder: "DE123456789"}},
		{Naam: "EUBTWNummer", Description: "Europees BTW-identificatienummer (EU VAT, richtlijn 2006/112/EG). Twee hoofdletters landcode gevolgd door 2–12 alfanumerieke tekens (bijv. NL123456789B01, DE123456789).",
			Basistype: "string", Format: "eu-vat", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[A-Z]{2}[A-Z0-9]{2,12}$`,
				MinLength: intPtr(4), MaxLength: intPtr(14),
				Voorbeelden: []string{"NL123456789B01", "DE123456789", "BE0123456789"},
				Foutmelding: "Voer een geldig EU BTW-nummer in (landcode + 2–12 alfanumerieke tekens, bijv. NL123456789B01)",
			},
			Weergave: &V3Weergave{Placeholder: "NL123456789B01"}},

		// — Voertuigen / reisdocumenten / overheid —
		// Kenteken: alle sidecodes (1-14+) bestaan uit 6 alfanumerieke tekens in
		// drie groepen gescheiden door koppeltekens. De regex accepteert elk
		// realistisch splitpatroon; een volledige sidecode-tabel valt buiten scope.
		{Naam: "Kenteken", Description: "Nederlands kenteken (RDW): 6 alfanumerieke tekens in drie groepen gescheiden door koppeltekens (bijv. AB-12-34, 1-ABC-23). Dekt alle actieve sidecodes.",
			Basistype: "string", Format: "kenteken", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}$`,
				MinLength: intPtr(6), MaxLength: intPtr(11),
				Voorbeelden: []string{"AB-12-34", "12-AB-34", "1-ABC-23", "AB-123-C"},
				Foutmelding: "Voer een geldig kenteken in met koppeltekens (bijv. AB-12-34 of 1-ABC-23)",
			},
			Weergave: &V3Weergave{Placeholder: "AB-12-34"}},
		{Naam: "Paspoortnummer", Description: "Nederlands paspoortnummer: 9 alfanumerieke tekens (hoofdletters + cijfers), conform ICAO Doc 9303 (BRP/DienstTerugkeer).",
			Basistype: "string", Format: "passport-nl", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[A-Z0-9]{9}$`,
				MinLength: intPtr(9), MaxLength: intPtr(9),
				Voorbeelden: []string{"NX5R38654", "AB1234567"},
				Foutmelding: "Voer een geldig paspoortnummer in (9 hoofdletters en/of cijfers)",
			},
			Weergave: &V3Weergave{Placeholder: "NX5R38654", InputMask: "AAAAAAAAA"}},
		{Naam: "Rijbewijsnummer", Description: "Nederlands rijbewijsnummer (CBR/RDW): 10 cijfers.",
			Basistype: "string", Format: "rijbewijs-nl", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{10}$`,
				MinLength: intPtr(10), MaxLength: intPtr(10),
				Voorbeelden: []string{"1234567890"},
				Foutmelding: "Voer een geldig rijbewijsnummer in (10 cijfers)",
			},
			Weergave: &V3Weergave{Placeholder: "1234567890", InputMask: "0000000000"}},
		{Naam: "BIGNummer", Description: "BIG-registratienummer (Beroepen in de Individuele Gezondheidszorg): 11 cijfers; uniek identificatienummer in het BIG-register (CIBG).",
			Basistype: "string", Format: "big-nummer", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{11}$`,
				MinLength: intPtr(11), MaxLength: intPtr(11),
				Voorbeelden: []string{"19025051601"},
				Foutmelding: "Voer een geldig BIG-nummer in (11 cijfers)",
			},
			Weergave: &V3Weergave{Placeholder: "19025051601", InputMask: "00000000000"}},
		{Naam: "OIN", Description: "Organisatie-Identificatienummer (Logius/DigiKoppeling): 20 cijfers; identificeert overheidsinstellingen en aangewezen organisaties in de NL e-overheid.",
			Basistype: "string", Format: "oin", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{20}$`,
				MinLength: intPtr(20), MaxLength: intPtr(20),
				Voorbeelden: []string{"00000001001234567000"},
				Foutmelding: "Voer een geldig OIN in (20 cijfers)",
			},
			Weergave: &V3Weergave{Placeholder: "00000001001234567000", InputMask: "00000000000000000000"}},
		{Naam: "Loonheffingsnummer", Description: "Loonheffingsnummer (Belastingdienst): 9-cijferig RSIN of BSN, gevolgd door 'L' en een 2-cijferig volgnummer (bijv. 123456789L01). Identificeert het inhoudingsplichtig subject.",
			Basistype: "string", Format: "loonheffing-nl", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{9}L[0-9]{2}$`,
				MinLength: intPtr(12), MaxLength: intPtr(12),
				Voorbeelden: []string{"123456789L01", "987654321L99"},
				Foutmelding: "Voer een geldig loonheffingsnummer in (9 cijfers + L + 2 cijfers, bijv. 123456789L01)",
			},
			Weergave: &V3Weergave{Placeholder: "123456789L01"}},

		// — BAG / WOZ / OID (Basisregistraties en overheidsstandaarden) —
		// Alle BAG-objectidentificaties zijn 16 cijfers: 4-cijferige CBS-gemeentecode
		// + 2-cijferige objecttypecode + 10-cijferig volgnummer.
		// Opvraagbaar via de LVBAG REST API: https://lvbag.github.io/BAG-API/
		{Naam: "BAGPandID", Description: "BAG Pand-ID: 16-cijferige unieke identificatiecode van een pand (bouwkundige constructie) in de Basisregistratie Adressen en Gebouwen (BAG). Opbouw: 4 gemeentecode + objecttypecode 10 + 10 volgnummer. Beheerd door de gemeente; raadpleegbaar via de Kadaster LVBAG API.",
			Basistype: "string", Format: "bag-pand-id", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{16}$`,
				MinLength: intPtr(16), MaxLength: intPtr(16),
				Voorbeelden: []string{"0518100000258732", "0363100012345678"},
				Foutmelding: "Voer een geldig BAG Pand-ID in (16 cijfers)",
			},
			ExterneReferentie: "https://lvbag.github.io/BAG-API/Technische%20specificatie/",
			Weergave:          &V3Weergave{Placeholder: "0518100000258732", InputMask: "0000000000000000"}},
		{Naam: "BAGVBOID", Description: "BAG Verblijfsobject-ID (VBO-ID): 16-cijferige unieke identificatiecode van een verblijfsobject (woning, kantoor, winkel) in de BAG. De kleinste zelfstandige eenheid binnen een pand met eigen toegang. Objecttypecode: 01.",
			Basistype: "string", Format: "bag-vbo-id", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{16}$`,
				MinLength: intPtr(16), MaxLength: intPtr(16),
				Voorbeelden: []string{"0518010000258732", "0363010012345678"},
				Foutmelding: "Voer een geldig BAG VBO-ID in (16 cijfers)",
			},
			ExterneReferentie: "https://lvbag.github.io/BAG-API/Technische%20specificatie/",
			Weergave:          &V3Weergave{Placeholder: "0518010000258732", InputMask: "0000000000000000"}},
		{Naam: "BAGNummeraanduidingID", Description: "BAG Nummeraanduiding-ID: 16-cijferige unieke identificatiecode van een officieel adres (postcode + huisnummer) in de BAG. Objecttypecode: 20. Koppelt een adresseerbaar object aan een postcode en huisnummer.",
			Basistype: "string", Format: "bag-nummeraanduiding-id", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{16}$`,
				MinLength: intPtr(16), MaxLength: intPtr(16),
				Voorbeelden: []string{"0518200000258732", "0363200012345678"},
				Foutmelding: "Voer een geldig BAG Nummeraanduiding-ID in (16 cijfers)",
			},
			ExterneReferentie: "https://lvbag.github.io/BAG-API/Technische%20specificatie/",
			Weergave:          &V3Weergave{Placeholder: "0518200000258732", InputMask: "0000000000000000"}},
		// WOZ-objectnummer: 12-cijferig, 4-cijferige CBS-gemeentecode + 8-cijferig
		// volgnummer. Kan afwijken van het BAG-objectnummer omdat een WOZ-object
		// meerdere panden of percelen kan omvatten.
		{Naam: "WOZObjectnummer", Description: "WOZ-objectnummer: 12-cijferig identificatienummer voor een WOZ-object (Waardering Onroerende Zaken). Opgebouwd uit een 4-cijferige CBS-gemeentecode + 8-cijferig volgnummer. Beheerd door de gemeente; raadpleegbaar via het WOZ-waardeloket.",
			Basistype: "string", Format: "woz-objectnummer", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{12}$`,
				MinLength: intPtr(12), MaxLength: intPtr(12),
				Voorbeelden: []string{"030300001234", "051800012345"},
				Foutmelding: "Voer een geldig WOZ-objectnummer in (12 cijfers)",
			},
			ExterneReferentie: "https://www.wozwaardeloket.nl/",
			Weergave:          &V3Weergave{Placeholder: "030300001234", InputMask: "000000000000"}},
		// OID (Object Identifier) conform ISO/IEC 9834: een hiërarchische reeks van
		// niet-negatieve integers gescheiden door punten. Minimaal twee componenten.
		// Veelgebruikt in NL voor BIG-register, HL7-zorg, PKI en CIBG-applicaties.
		{Naam: "OIDCode", Description: "Object Identifier (OID) conform ISO/IEC 9834: een hiërarchische reeks van niet-negatieve integers gescheiden door punten (bijv. '2.16.528.1.1007.3.1' voor het NL BIG-register). Minimaal twee componenten. Gebruikt in zorg (CIBG, HL7), PKI en overheidssoftware.",
			Basistype: "string", Format: "oid", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:     `^[0-9]+(\.[0-9]+)+$`,
				MinLength:   intPtr(3),
				Voorbeelden: []string{"2.16.528.1.1007.3.1", "1.2.840.10065.1.12.1.1", "2.16.528.1.1003.1.2.5.5.2"},
				Foutmelding: "Voer een geldige OID in (punt-gescheiden integers, bijv. 2.16.528.1.1007.3.1)",
			},
			ExterneReferentie: "https://www.cibg.nl/oid-informatie",
			Weergave:          &V3Weergave{Placeholder: "2.16.528.1.1007.3.1"}},

		// — Boekidentificatoren / internationaal —
		// ISBN-10 gebruikt mod-11 met een speciaal controlecijfer (0-9 of X=10),
		// waarvoor de checksum-expressie niet volstaat → function-regel.
		// ISBN-13 gebruikt EAN-13 mod-10 (uitsluitend cijfers) → checksum-expressie.
		// LEI gebruikt ISO 7064 mod-97 identiek aan IBAN maar zonder herplaatsing.
		{Naam: "ISBN10", Description: "International Standard Book Number, 10-cijferige variant (vóór 2007). Bestaat uit 9 datacijfers + 1 controlecijfer (0-9 of 'X' voor 10). Checksum: gewogen som (gewichten 10..1) modulo 11 = 0.",
			Basistype: "string", Format: "isbn-10", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[0-9]{9}[0-9X]$`,
				MinLength: intPtr(10), MaxLength: intPtr(10),
				Voorbeelden: []string{"0306406152", "048665088X"},
				Foutmelding: "Voer een geldig ISBN-10 in (9 cijfers + controlecijfer 0-9 of X, bijv. 0306406152)",
				Regels: []V3Regel{
					{Naam: "mod-11", Type: "function", Expressie: "isbn10_mod11"},
				},
			},
			ExterneReferentie: "https://www.isbn-international.org/",
			Weergave:          &V3Weergave{Placeholder: "0306406152"}},
		{Naam: "ISBN13", Description: "International Standard Book Number, 13-cijferige variant (actuele standaard). Begint met EAN-prefix 978 of 979; controlecijfer via EAN-13 mod-10 (gewichten afwisselend 1 en 3).",
			Basistype: "string", Format: "isbn-13", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^97[89][0-9]{10}$`,
				MinLength: intPtr(13), MaxLength: intPtr(13),
				Voorbeelden: []string{"9780306406157", "9789020416138"},
				Foutmelding: "Voer een geldig ISBN-13 in (13 cijfers, beginnend met 978 of 979)",
				Regels: []V3Regel{
					{Naam: "EAN-13 mod-10", Type: "checksum",
						Expressie: "(d1 + 3*d2 + d3 + 3*d4 + d5 + 3*d6 + d7 + 3*d8 + d9 + 3*d10 + d11 + 3*d12 + d13) % 10 == 0"},
				},
			},
			ExterneReferentie: "https://www.isbn-international.org/",
			Weergave:          &V3Weergave{Placeholder: "9780306406157", InputMask: "0000000000000"}},
		// LEI: 20 tekens conform ISO 17442. Eerste 18 tekens vrij (alfanumeriek),
		// positie 19-20 zijn numerieke controlecijfers. Validatie: letters omzetten
		// (A=10..Z=35) en de volledige reeks mod 97 moet 1 zijn (ISO 7064 Mod-97,10).
		{Naam: "LEI", Description: "Legal Entity Identifier (ISO 17442): 20-teken code voor unieke identificatie van rechtspersonen wereldwijd. Eerste 4 tekens: LOU-prefix. Tekens 5-18: entiteitscode. Tekens 19-20: numerieke controlecijfers. Validatie via ISO 7064 mod-97 (zelfde principe als IBAN).",
			Basistype: "string", Format: "lei", Domein: "gegevenstypen",
			Validatie: &V3Validatie{
				Pattern:   `^[A-Z0-9]{18}[0-9]{2}$`,
				MinLength: intPtr(20), MaxLength: intPtr(20),
				Voorbeelden: []string{"AAAAAAAAAAAAAAAAAA26"},
				Foutmelding: "Voer een geldige LEI in (20 alfanumerieke tekens conform ISO 17442, bijv. AAAAAAAAAAAAAAAAAA26)",
				Regels: []V3Regel{
					{Naam: "ISO 7064 mod-97", Type: "function", Expressie: "lei_mod97"},
				},
			},
			ExterneReferentie: "https://www.gleif.org/en/about-lei/get-an-lei-find-lei-issuing-organizations",
			Weergave:          &V3Weergave{Placeholder: "AAAAAAAAAAAAAAAAAA26"}},
	}
}

// registreerOfVervangDatatype voegt een datatype toe of vervangt een bestaande
// entry met dezelfde Naam (laatste-wint-op-Naam). Hiermee kan de gegevenstypen-
// registry oudere duplicates uit codegen-bestanden overschrijven zonder dat we
// die bestanden hoeven aan te raken.
func registreerOfVervangDatatype(dt V3Datatype) {
	for i := range DatatypeRegistry {
		if DatatypeRegistry[i].Naam == dt.Naam {
			// Behoud Positie-info uit eerdere entry zodat de UML-editor-layout
			// niet verspringt na een rebuild.
			if dt.Positie == nil && DatatypeRegistry[i].Positie != nil {
				dt.Positie = DatatypeRegistry[i].Positie
			}
			DatatypeRegistry[i] = dt
			return
		}
	}
	DatatypeRegistry = append(DatatypeRegistry, dt)
}
