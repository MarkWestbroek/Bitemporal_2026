package model

// gegevenstypen_modellen_input.go — afgevlakte input-structs voor de registratie-API.
// Alle velden zijn plain string zodat de validatie-walker de schema:"datatype:X"
// tags kan evalueren op de ingestuurde tekst.
// Handmatig aangemaakt.

// TestEntiteitGegevenstypen_TestGEGegevenstypen_Input — afgevlakte invoer
// voor opvoer / afvoer / corrigeer van een TestGEGegevenstypen-record via de
// registratie-API.  Schema-tags zijn gelijk aan die van de _Data struct.
type TestEntiteitGegevenstypen_TestGEGegevenstypen_Input struct {
	TestEntiteitGegevenstypen_ID int `json:"testentiteitgegevenstypen_id"`
	Rel_ID                       int `json:"rel_id"`

	// — Identificatie / nummers —
	Bsn         string `json:"bsn,omitempty" schema:"datatype:BSN"`
	Kvknummer   string `json:"kvknummer,omitempty" schema:"datatype:KvKNummer"`
	Postcode    string `json:"postcode,omitempty" schema:"datatype:NLPostcode"`
	Iban        string `json:"iban,omitempty" schema:"datatype:IBAN"`
	Agbcode     string `json:"agbcode,omitempty" schema:"datatype:AGBCode"`
	Tin         string `json:"tin,omitempty" schema:"datatype:TIN"`
	EuBtwNummer string `json:"eu_btw_nummer,omitempty" schema:"datatype:EUBTWNummer"`

	// — Communicatie —
	Emailadres     string `json:"emailadres,omitempty" schema:"datatype:Emailadres"`
	Telefoonnummer string `json:"telefoonnummer,omitempty" schema:"datatype:Telefoonnummer"`
	Url            string `json:"url,omitempty" schema:"datatype:URL"`
	UrlHttps       string `json:"url_https,omitempty" schema:"datatype:UrlHttps"`

	// — Visueel / geo —
	Kleur   string `json:"kleur,omitempty" schema:"datatype:Kleur"`
	Geopunt string `json:"geopunt,omitempty" schema:"datatype:GeoPunt"`

	// — Tekstueel —
	Kortetekst string `json:"kortetekst,omitempty" schema:"datatype:KorteTekst"`
	An40       string `json:"an40,omitempty" schema:"datatype:AN40"`
	An200      string `json:"an200,omitempty" schema:"datatype:AN200"`

	// — Voertuigen / reisdocumenten / overheid —
	Kenteken        string `json:"kenteken,omitempty" schema:"datatype:Kenteken"`
	Paspoortnummer  string `json:"paspoortnummer,omitempty" schema:"datatype:Paspoortnummer"`
	Rijbewijsnummer string `json:"rijbewijsnummer,omitempty" schema:"datatype:Rijbewijsnummer"`
	Bignummer       string `json:"bignummer,omitempty" schema:"datatype:BIGNummer"`
	Oin             string `json:"oin,omitempty" schema:"datatype:OIN"`
	Loonheffingsnr  string `json:"loonheffingsnummer,omitempty" schema:"datatype:Loonheffingsnummer"`

	// — BAG / WOZ / OID —
	BagPandId             string `json:"bag_pand_id,omitempty" schema:"datatype:BAGPandID"`
	BagVboId              string `json:"bag_vbo_id,omitempty" schema:"datatype:BAGVBOID"`
	BagNummeraanduidingId string `json:"bag_nummeraanduiding_id,omitempty" schema:"datatype:BAGNummeraanduidingID"`
	WozObjectnummer       string `json:"woz_objectnummer,omitempty" schema:"datatype:WOZObjectnummer"`
	OidCode               string `json:"oid_code,omitempty" schema:"datatype:OIDCode"`

	// — Boekidentificatoren / internationaal —
	Isbn10 string `json:"isbn10,omitempty" schema:"datatype:ISBN10"`
	Isbn13 string `json:"isbn13,omitempty" schema:"datatype:ISBN13"`
	Lei    string `json:"lei,omitempty" schema:"datatype:LEI"`

	// — Temporeel —
	Datum string `json:"datum,omitempty" schema:"datatype:Datum"`
	Duur  string `json:"duur,omitempty" schema:"datatype:Duur"`
}
