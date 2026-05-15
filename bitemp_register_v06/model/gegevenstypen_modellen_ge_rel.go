package model

// Hub + _Data structs voor het gegevenstypen-domein.
// Handmatig aangemaakt. Bevat één GE met een veld per valideerbaar gegevenstype.

import (
	"time"

	"github.com/uptrace/bun"
)

// TestEntiteitGegevenstypen_TestGEGegevenstypen — Hub GE die alle string-gebaseerde
// gegevenstypen uit de gegevenstypenregistry samenbrengt in één _Data record.
type TestEntiteitGegevenstypen_TestGEGegevenstypen struct {
	bun.BaseModel                   `bun:"table:testentiteitgegevenstypen_testgegegevenstypen,alias:testentiteitgegevenstypen_testgegegevenstypen"`
	TestEntiteitGegevenstypen_ID    int                                                  `json:"testentiteitgegevenstypen_id" bun:"testentiteitgegevenstypen_id,pk" schema_desc:"ID van de TestEntiteitGegevenstypen-entiteit"`
	Rel_ID                          int                                                  `json:"rel_id" bun:"rel_id,pk,autoincrement"`
	ParentTestEntiteitGegevenstypen *TestEntiteitGegevenstypen                           `json:"-" bun:"rel:belongs-to,join:testentiteitgegevenstypen_id=id,on_delete:cascade"`
	Opvoer                          *time.Time                                           `json:"opvoer,omitempty"`
	Afvoer                          *time.Time                                           `json:"afvoer,omitempty"`
	Data                            []TestEntiteitGegevenstypen_TestGEGegevenstypen_Data `bun:"rel:has-many,join:testentiteitgegevenstypen_id=testentiteitgegevenstypen_id,join:rel_id=rel_id" json:"data,omitempty"`
}

// TestEntiteitGegevenstypen_TestGEGegevenstypen_Data — geversioned inhoud.
// Elk veld correspondeert met één gegevenstype uit gegevenstypen_datatype_registry.go.
// Alle velden zijn optioneel (pointer of leeg string) zodat per test slechts één
// of een subset van velden hoeft te worden gevuld.
type TestEntiteitGegevenstypen_TestGEGegevenstypen_Data struct {
	bun.BaseModel                `bun:"table:testentiteitgegevenstypen_testgegegevenstypen_data,alias:testentiteitgegevenstypen_testgegegevenstypen_data"`
	TestEntiteitGegevenstypen_ID int   `json:"testentiteitgegevenstypen_id" bun:"testentiteitgegevenstypen_id,pk"`
	Rel_ID                       int   `json:"rel_id" bun:"rel_id,pk"`
	Versie                       int64 `json:"versie,omitempty" bun:"versie,pk,autoincrement"`

	// — Identificatie / nummers —
	Bsn         BSN         `json:"bsn,omitempty" schema:"datatype:BSN"`
	Kvknummer   KvKNummer   `json:"kvknummer,omitempty" schema:"datatype:KvKNummer"`
	Postcode    NLPostcode  `json:"postcode,omitempty" schema:"datatype:NLPostcode"`
	Iban        IBAN        `json:"iban,omitempty" schema:"datatype:IBAN"`
	Agbcode     AGBCode     `json:"agbcode,omitempty" schema:"datatype:AGBCode"`
	Tin         TIN         `json:"tin,omitempty" schema:"datatype:TIN"`
	EuBtwNummer EUBTWNummer `json:"eu_btw_nummer,omitempty" schema:"datatype:EUBTWNummer"`

	// — Communicatie —
	Emailadres Emailadres     `json:"emailadres,omitempty" schema:"datatype:Emailadres"`
	Telefoonnr Telefoonnummer `json:"telefoonnummer,omitempty" schema:"datatype:Telefoonnummer"`
	Url        URL            `json:"url,omitempty" schema:"datatype:URL"`
	UrlHttps   URL            `json:"url_https,omitempty" schema:"datatype:UrlHttps"`

	// — Visueel / geo —
	Kleur   string `json:"kleur,omitempty" schema:"datatype:Kleur"`
	Geopunt string `json:"geopunt,omitempty" schema:"datatype:GeoPunt"`

	// — Tekstueel —
	Kortetekst KorteTekst `json:"kortetekst,omitempty" schema:"datatype:KorteTekst"`
	An40       AN40       `json:"an40,omitempty" schema:"datatype:AN40"`
	An200      AN200      `json:"an200,omitempty" schema:"datatype:AN200"`

	// — Voertuigen / reisdocumenten / overheid —
	Kenteken        Kenteken           `json:"kenteken,omitempty" schema:"datatype:Kenteken"`
	Paspoortnummer  Paspoortnummer     `json:"paspoortnummer,omitempty" schema:"datatype:Paspoortnummer"`
	Rijbewijsnummer Rijbewijsnummer    `json:"rijbewijsnummer,omitempty" schema:"datatype:Rijbewijsnummer"`
	Bignummer       BIGNummer          `json:"bignummer,omitempty" schema:"datatype:BIGNummer"`
	Oin             OIN                `json:"oin,omitempty" schema:"datatype:OIN"`
	Loonheffingsnr  Loonheffingsnummer `json:"loonheffingsnummer,omitempty" schema:"datatype:Loonheffingsnummer"`

	// — BAG / WOZ / OID —
	BagPandId             BAGPandID             `json:"bag_pand_id,omitempty" schema:"datatype:BAGPandID"`
	BagVboId              BAGVBOID              `json:"bag_vbo_id,omitempty" schema:"datatype:BAGVBOID"`
	BagNummeraanduidingId BAGNummeraanduidingID `json:"bag_nummeraanduiding_id,omitempty" schema:"datatype:BAGNummeraanduidingID"`
	WozObjectnummer       WOZObjectnummer       `json:"woz_objectnummer,omitempty" schema:"datatype:WOZObjectnummer"`
	OidCode               OIDCode               `json:"oid_code,omitempty" schema:"datatype:OIDCode"`

	// — Boekidentificatoren / internationaal —
	Isbn10 ISBN10 `json:"isbn10,omitempty" schema:"datatype:ISBN10"`
	Isbn13 ISBN13 `json:"isbn13,omitempty" schema:"datatype:ISBN13"`
	Lei    LEI    `json:"lei,omitempty" schema:"datatype:LEI"`

	// — Temporeel —
	Datum Datum  `json:"datum,omitempty" bun:"datum" schema:"datatype:Datum"`
	Duur  string `json:"duur,omitempty" schema:"datatype:Duur"`

	Opvoer *time.Time `json:"opvoer,omitempty"`
	Afvoer *time.Time `json:"afvoer,omitempty"`
}
