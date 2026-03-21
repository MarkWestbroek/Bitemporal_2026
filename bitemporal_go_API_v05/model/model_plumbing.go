package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

/* ======= GENERIEKE REPRESENTATIE INTERFACES EN HELPERS ====== */

// Representatie is de gemeenschappelijke interface voor alle representaties (entiteiten, relaties, gegevenselementen)
type Representatie interface {
	HasID
	Metatyped
	String() string // voor debuggen
}

// FormeleRepresentatie combineert de Representatie interface met opvoer/afvoer (formele tijdslijn)
type FormeleRepresentatie interface {
	Representatie
	HeeftOpvoerAfvoer
	HeeftClearID
}

// MaterieleRepresentatie combineert de FormeleRepresentatie interface met aanvang/einde (materiële tijdslijn)
type MaterieleRepresentatie interface {
	FormeleRepresentatie
	HeeftAanvangEinde
}

// HasID allows generic handlers to access an entity's ID
type HasID interface {
	GetID() any
}

type HeeftClearID interface {
	ClearID()
}

type Metatype string

const (
	MetatypeEntiteit        Metatype = "entiteit"
	MetatypeRelatie         Metatype = "relatie"
	MetatypeGegevenselement Metatype = "gegevenselement"
)

type Metatyped interface {
	Metatype() Metatype
}

// HeeftOpvoerAfvoer beschrijft representaties met opvoer/afvoer tijdstippen.
// Setters gebruiken pointer receivers op de concrete types.
type HeeftOpvoerAfvoer interface {
	GetOpvoer() *time.Time
	SetOpvoer(*time.Time)
	GetAfvoer() *time.Time
	SetAfvoer(*time.Time)
}

// HeeftAanvangEinde beschrijft representaties met aanvang/einde datums.
type HeeftAanvangEinde interface {
	GetAanvang() *Date
	SetAanvang(*Date)
	GetEinde() *Date
	SetEinde(*Date)
}

/*
	 Materiele tijd plumbing (aanvang en einde)
	 deze structs kunnen aan een representatie hangen
	 in de database worden ze gerepresenteerd als aparte tabellen:
		- dit vergt wel aparte database logica:
			- bij het creeren van de tabellen moeten alle materiele representaties ook een aanvang en einde tabel krijgen
			- bij het aanmaken van een representatie moeten er mogelijk ook aanvang en einde records worden aangemaakt
			- het zijn geen verplichte velden, maar ze zijn standaard wel enkelvoudig
			- ze volgen dus eigenlijk de logica van een enkelvoudig gegevenselement
		- Aanvang en einde zijn dus zelf weer materiele elementen
*/
type Aanvang struct {
	Entiteit_ID        int        `json:"entiteit_id,omitempty"`
	Gegevenselement_ID int        `json:"gegevenselement_id,omitempty"`
	Datum              *Date      `json:"datum" bun:"datum,type:date"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

type Einde struct {
	Entiteit_ID        int        `json:"entiteit_id,omitempty"`
	Gegevenselement_ID int        `json:"gegevenselement_id,omitempty"`
	Datum              *Date      `json:"datum" bun:"datum,type:date"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

// === Aanvang/Einde als FormeleRepresentatie per entiteitstype ===
// Elk type mapt direct op zijn plumbing-tabel: {entiteit}_aanvang / {entiteit}_einde.
// De "id" kolom in de tabel is de FK naar de entiteit; "versie" is het relatieve autoincrement.
// Ze gedragen zich als enkelvoudige gegevenselementen: handleRepresentatieOpvoer handelt ze af.
//
// LET OP: de expliciete `alias:` tag is noodzakelijk. Zonder alias leidt bun de alias af
// uit de Go struct naam: A_Aanvang → a__aanvang (dubbele underscore). De formeleTijdTargetVoorModel
// subquery referenceert de tabel met enkelvoudige underscore (a_aanvang.id::text), dus de alias
// moet overeenkomen om "invalid reference to FROM-clause entry" fouten te voorkomen.

type A_Aanvang struct {
	bun.BaseModel `bun:"table:a_aanvang,alias:a_aanvang"` // alias: voorkomt bun's automatische a__aanvang alias
	A_ID          int                                     `json:"a_id" bun:"a_id,pk"` // DB-kolom hernoemd van id→a_id (consistent met andere GE-types)
	Versie        int64                                   `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date                                   `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time                              `json:"opvoer,omitempty"`
	Afvoer        *time.Time                              `json:"afvoer,omitempty"`
}

func (a A_Aanvang) GetID() any              { return a.Versie }
func (a A_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_Aanvang) ClearID()               { a.Versie = 0 }
func (a A_Aanvang) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_Aanvang) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_Aanvang) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_Aanvang) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_Aanvang) String() string          { return RepresentatieToString(a) }

type A_Einde struct {
	bun.BaseModel `bun:"table:a_einde,alias:a_einde"` // alias: voorkomt bun's automatische a__einde alias
	A_ID          int                                 `json:"a_id" bun:"a_id,pk"` // DB-kolom hernoemd van id→a_id
	Versie        int64                               `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date                               `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time                          `json:"opvoer,omitempty"`
	Afvoer        *time.Time                          `json:"afvoer,omitempty"`
}

func (a A_Einde) GetID() any              { return a.Versie }
func (a A_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (a *A_Einde) ClearID()               { a.Versie = 0 }
func (a A_Einde) GetOpvoer() *time.Time   { return a.Opvoer }
func (a *A_Einde) SetOpvoer(t *time.Time) { a.Opvoer = t }
func (a A_Einde) GetAfvoer() *time.Time   { return a.Afvoer }
func (a *A_Einde) SetAfvoer(t *time.Time) { a.Afvoer = t }
func (a A_Einde) String() string          { return RepresentatieToString(a) }

type B_Aanvang struct {
	bun.BaseModel `bun:"table:b_aanvang,alias:b_aanvang"` // alias: voorkomt bun's automatische b__aanvang alias
	B_ID          int                                     `json:"b_id" bun:"b_id,pk"` // DB-kolom hernoemd van id→b_id
	Versie        int64                                   `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date                                   `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time                              `json:"opvoer,omitempty"`
	Afvoer        *time.Time                              `json:"afvoer,omitempty"`
}

func (b B_Aanvang) GetID() any              { return b.Versie }
func (b B_Aanvang) Metatype() Metatype      { return MetatypeGegevenselement }
func (b *B_Aanvang) ClearID()               { b.Versie = 0 }
func (b B_Aanvang) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B_Aanvang) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B_Aanvang) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B_Aanvang) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b B_Aanvang) String() string          { return RepresentatieToString(b) }

type B_Einde struct {
	bun.BaseModel `bun:"table:b_einde,alias:b_einde"` // alias: voorkomt bun's automatische b__einde alias
	B_ID          int                                 `json:"b_id" bun:"b_id,pk"` // DB-kolom hernoemd van id→b_id
	Versie        int64                               `json:"versie,omitempty" bun:"versie,pk,autoincrement"`
	Datum         *Date                               `json:"datum,omitempty" bun:"datum,type:date"`
	Opvoer        *time.Time                          `json:"opvoer,omitempty"`
	Afvoer        *time.Time                          `json:"afvoer,omitempty"`
}

func (b B_Einde) GetID() any              { return b.Versie }
func (b B_Einde) Metatype() Metatype      { return MetatypeGegevenselement }
func (b *B_Einde) ClearID()               { b.Versie = 0 }
func (b B_Einde) GetOpvoer() *time.Time   { return b.Opvoer }
func (b *B_Einde) SetOpvoer(t *time.Time) { b.Opvoer = t }
func (b B_Einde) GetAfvoer() *time.Time   { return b.Afvoer }
func (b *B_Einde) SetAfvoer(t *time.Time) { b.Afvoer = t }
func (b B_Einde) String() string          { return RepresentatieToString(b) }

// helper functies voor type checks
func IsEntiteit(v Metatyped) bool {
	return v.Metatype() == MetatypeEntiteit
}

func IsRelatie(v Metatyped) bool {
	return v.Metatype() == MetatypeRelatie
}

func IsGegevenselement(v Metatyped) bool {
	return v.Metatype() == MetatypeGegevenselement
}

/* ====== WIJZIGING EN REGISTRATIE STRUCTUREN ====== */

// WijzigingstypeEnum defines the possible values for Wijzigingstype
type WijzigingstypeEnum string

const (
	WijzigingstypeOpvoer WijzigingstypeEnum = "opvoer"
	WijzigingstypeAfvoer WijzigingstypeEnum = "afvoer"
)

// RegistratietypeEnum defines the possible values for Registratietype
type RegistratietypeEnum string

const (
	RegistratietypeRegistratie    RegistratietypeEnum = "registratie"
	RegistratietypeCorrectie      RegistratietypeEnum = "correctie"
	RegistratietypeOngedaanmaking RegistratietypeEnum = "ongedaanmaking"
)

// Wijziging zit tussen Registratie en om het even welke representatie in
// gebruikt om de gegevens in de database te zetten
type Wijziging struct {
	bun.BaseModel     `bun:"table:wijziging"`
	ID                int64              `json:"id" bun:"id,pk,autoincrement"`
	Wijzigingstype    WijzigingstypeEnum `json:"wijzigingstype"`                                         // Opvoer of Afvoer
	RegistratieID     int64              `json:"registratie_id"`                                         // verwijzing naar de registratie waarbij deze wijziging hoort
	Entiteitnaam      string             `json:"entiteitnaam"`                                           // type-naam van de eventueel bovenliggende entiteit, zoals "A" of "B"
	EntiteitID        string             `json:"entiteit_id"`                                            // Bewust een string to support both numeric and string IDs, or for instance UUIDs
	Representatienaam string             `json:"representatienaam"`                                      // type-naam van de representatie, zoals "A", "B", "Rel_A_B", "A_U", "A_V", "B_X" of "B_Y"
	RepresentatieID   string             `json:"representatie_id"`                                       // Bewust een string to support both numeric and string IDs, or for instance UUIDs
	Tijdstip          time.Time          `json:"tijdstip"`                                               //afgeleid van registratie tijdstip
	IsOngedaangemaakt bool               `json:"is_ongedaangemaakt,omitempty" bun:"is_ongedaan_gemaakt"` // afgeleid (wordt op true gezet bij een ongedaanmaking van deze wijziging)
}

// not used (yet?)
type WijzigingCompact struct {
	Wijzigingstype WijzigingstypeEnum `json:"wijzigingstype"`
}

// Registratie, Correctie, Ongedaanmaking
type Registratie struct {
	bun.BaseModel              `bun:"table:registratie"`
	ID                         int64               `json:"id" bun:"id,pk,autoincrement"`
	Registratietype            RegistratietypeEnum `json:"registratietype"`                                        // Registratie, Correctie, Ongedaanmaking
	Tijdstip                   time.Time           `json:"tijdstip"`                                               // Het tijdstip van de registratie, correctie of ongedaanmaking
	Opmerking                  *string             `json:"opmerking,omitempty"`                                    // optioneel veld voor extra informatie
	CorrigeertRegistratieID    *int64              `json:"corrigeert_registratie_id,omitempty"`                    // bij correcties: verwijzing naar de registratie die gecorrigeerd wordt
	MaaktOngedaanRegistratieID *int64              `json:"maakt_ongedaan_registratie_id,omitempty"`                // bij ongedaanmakings: verwijzing naar de registratie die ongedaan wordt gemaakt
	IsOngedaangemaakt          bool                `json:"is_ongedaangemaakt,omitempty" bun:"is_ongedaan_gemaakt"` // afgeleid (wordt op true gezet bij een ongedaanmaking van deze registratie)
	Wijzigingen                []Wijziging         `json:"wijzigingen,omitempty" bun:"rel:has-many,join:id=registratie_id"`
	RequestBody                json.RawMessage     `json:"request_body,omitempty" bun:"request_body,type:jsonb,nullzero"`   // raw request payload voor audit
	ResponseBody               json.RawMessage     `json:"response_body,omitempty" bun:"response_body,type:jsonb,nullzero"` // raw response payload voor audit
	ResponseCode               *int                `json:"response_code,omitempty" bun:"response_code,nullzero"`            // HTTP statuscode van de response
	RequestPath                *string             `json:"request_path,omitempty" bun:"request_path,nullzero"`              // request pad voor audit, bv /registreer/as
	RequestMethod              *string             `json:"request_method,omitempty" bun:"request_method,nullzero"`          // HTTP methode, bv POST
	DurationMs                 *int64              `json:"duration_ms,omitempty" bun:"duration_ms,nullzero"`                // afhandeltijd in milliseconden
}

func (reg Registratie) IsRegistratie() bool {
	return reg.Registratietype == RegistratietypeRegistratie
}

func (reg Registratie) IsCorrectie() bool {
	return reg.Registratietype == RegistratietypeCorrectie
}

func (reg Registratie) IsOngedaanmaking() bool {
	return reg.Registratietype == RegistratietypeOngedaanmaking
}

// UnmarshalJSON accepteert zowel snake_case als Camel/PascalCase sleutelvarianten
// voor compatibiliteit met bestaande clients.
func (reg *Registratie) UnmarshalJSON(data []byte) error {
	type registratieAlias Registratie
	aux := struct {
		registratieAlias
		CorrigeertRegistratieIDCamel    *int64 `json:"CorrigeertRegistratieID"`
		MaaktOngedaanRegistratieIDCamel *int64 `json:"MaaktOngedaanRegistratieID"`
	}{
		registratieAlias: registratieAlias(*reg),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	*reg = Registratie(aux.registratieAlias)

	if reg.CorrigeertRegistratieID == nil && aux.CorrigeertRegistratieIDCamel != nil {
		reg.CorrigeertRegistratieID = aux.CorrigeertRegistratieIDCamel
	}
	if reg.MaaktOngedaanRegistratieID == nil && aux.MaaktOngedaanRegistratieIDCamel != nil {
		reg.MaaktOngedaanRegistratieID = aux.MaaktOngedaanRegistratieIDCamel
	}

	return nil
}

// methodes op registratie en wijziging om ID te kunnen ophalen in de generic handlers
func (reg Registratie) GetID() any { return reg.ID } // waarschijnlijk niet nodig, want Registratie is geen representatie
func (wij Wijziging) GetID() any   { return wij.ID } //waarschijnlijk niet nodig, want Wijziging is geen representatie
