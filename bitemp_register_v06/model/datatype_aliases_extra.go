package model

// Extra (handmatig onderhouden) Go type-aliassen voor uitbreidings-datatypes
// die NIET door cmd/codegen worden gegenereerd of overschreven.
//
// Plan B.A.1 (zie docs/BACKLOG_UITVOERING_INCREMENTEN.md):
//   - Versterken van het type-systeem met semantisch rijkere datatypes.
//   - Bijbehorende V3Datatype-entries staan in `extra_datatype_registry.go`.
//   - Bijbehorende runtime-validators staan in `validation.go`.
//
// Toevoegen van nieuwe types:
//   1. Voeg hier een Go type-alias toe (typisch `type X string`).
//   2. Voeg een V3Datatype-entry toe in `extra_datatype_registry.go`.
//   3. Voeg eventueel een validator toe in `validation.go` (`builtinValidators`).

// Kleur is een hex-kleurcode in CSS-formaat (#RGB, #RRGGBB of #RRGGBBAA).
type Kleur string

// Duur is een ISO-8601 duration string (bijv. "P1Y2M3DT4H5M6S", "PT30M").
type Duur string

// UrlHttps is een URL die alleen het https-schema accepteert.
type UrlHttps string

// GeoPunt is een geografische coördinaat (WGS84) als "lat,lng" string.
// Bijv. "52.3676,4.9041" (Amsterdam). Een struct-variant kan later toegevoegd worden.
type GeoPunt string

// AGBCode is een AGB-code (Agb = Algemeen Gegevens Beheer): 8-cijferig
// nummer dat een zorgaanbieder of zorginstelling identificeert.
// De eerste twee cijfers duiden het specialismetype aan.
type AGBCode string

// TIN is een Tax Identification Number (fiscaal identificatienummer).
// In Nederland is dit het BSN voor natuurlijke personen of het RSIN voor
// rechtspersonen; beide voldoen aan de 11-proef.
type TIN string

// EUBTWNummer is een Europees BTW-identificatienummer conform EU-richtlijn
// 2006/112/EG. Formaat: twee hoofdletters landcode gevolgd door 2–12
// alfanumerieke tekens (bijv. "NL123456789B01", "DE123456789").
type EUBTWNummer string

// Kenteken is een Nederlands kenteken (RDW) in gestreepte notatie
// met koppeltekens, bijv. "AB-12-34" of "1-ABC-23".
// Alle sidecodes (1 t/m 14+) hebben 6 alfanumerieke tekens verdeeld
// over drie groepen gescheiden door koppeltekens.
type Kenteken string

// Paspoortnummer is een Nederlands paspoortnummer: 9 alfanumerieke tekens
// (hoofdletters en cijfers), conform ICAO Doc 9303.
type Paspoortnummer string

// Rijbewijsnummer is een Nederlands rijbewijsnummer: 10 cijfers (CBR/RDW).
type Rijbewijsnummer string

// BIGNummer is een BIG-registratienummer (Beroepen in de Individuele
// Gezondheidszorg): 11 cijfers; identificeert een BIG-geregistreerde
// zorgprofessional (CIBG/BIG-register).
type BIGNummer string

// OIN is een Organisatie-Identificatienummer: 20 cijfers; gebruikt
// door overheidsinstellingen en aangewezen organisaties in de NL
// e-overheid (Logius/DigiKoppeling).
type OIN string

// Loonheffingsnummer is het fiscale nummer voor de loonheffingen:
// 9-cijferig RSIN/BSN gevolgd door de lettercode "L" en een 2-cijferig
// volgnummer, bijv. "123456789L01" (Belastingdienst).
type Loonheffingsnummer string

// BAGPandID is de 16-cijferige unieke identificatiecode van een pand in de
// Basisregistratie Adressen en Gebouwen (BAG). Opbouw: 4-cijferige CBS-
// gemeentecode + objecttypecode "10" + 10-cijferig volgnummer. (Kadaster LVBAG)
type BAGPandID string

// BAGVBOID is de 16-cijferige unieke identificatiecode van een verblijfsobject
// (VBO) in de BAG: de kleinste eenheid binnen een pand met eigen toegang
// (woning, kantoor, winkel). Objecttypecode: "01". (Kadaster LVBAG)
type BAGVBOID string

// BAGNummeraanduidingID is de 16-cijferige unieke identificatiecode van een
// nummeraanduiding (officieel adres = postcode + huisnummer) in de BAG.
// Objecttypecode: "20". (Kadaster LVBAG)
type BAGNummeraanduidingID string

// WOZObjectnummer is het 12-cijferige identificatienummer van een WOZ-object
// (Waardering Onroerende Zaken). Opgebouwd uit een 4-cijferige CBS-gemeentecode
// + 8-cijferig volgnummer. Beheerd door de gemeente/Waarderingskamer.
type WOZObjectnummer string

// OIDCode is een hiërarchische Object Identifier (OID) conform ISO/IEC 9834:
// punt-gescheiden niet-negatieve integers (bijv. "2.16.528.1.1007.3.1" voor het
// NL BIG-register). Gebruikt in zorg (CIBG), PKI en overheidssoftware.
type OIDCode string

// ISBN10 is een International Standard Book Number in de 10-cijferige variant
// (voor 2007 uitgegeven boeken). Bestaat uit 9 datacijfers + 1 controlecijfer
// (0-9 of 'X' voor 10). Checksum: gewogen som modulo 11 = 0.
// Voorbeeld: "0306406152", "048665088X".
type ISBN10 string

// ISBN13 is een International Standard Book Number in de 13-cijferige variant
// (actuele standaard, EAN-prefix 978 of 979). Controlecijfer via EAN-13
// mod-10 algoritme; alleen cijfers, geen letters.
// Voorbeeld: "9780306406157".
type ISBN13 string

// LEI is een Legal Entity Identifier conform ISO 17442: 20 alfanumerieke
// tekens (18 vrij + 2 numerieke controlecijfers). Unieke identificatie van
// rechtspersonen wereldwijd; uitgifte via GLEIF-erkende LOU's.
// Controlecijfer via ISO 7064 mod-97 (zelfde mechanisme als IBAN).
// Voorbeeld: "AAAAAAAAAAAAAAAAAA26" (synthetisch, checksum geverifieerd).
type LEI string
