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

// HeeftAanvangEinde beschrijft representaties met aanvang/einde tijdstippen.
type HeeftAanvangEinde interface {
	GetAanvang() *time.Time
	SetAanvang(*time.Time)
	GetEinde() *time.Time
	SetEinde(*time.Time)
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
	Entiteit_ID        int        `json:"entiteit_id"`
	Gegevenselement_ID int        `json:"gegevenselement_id"`
	Aanvang            *time.Time `json:"aanvang,omitempty"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

type Einde struct {
	Entiteit_ID        int        `json:"entiteit_id"`
	Gegevenselement_ID int        `json:"gegevenselement_id"`
	Einde              *time.Time `json:"einde,omitempty"`
	Opvoer             *time.Time `json:"opvoer,omitempty"`
	Afvoer             *time.Time `json:"afvoer,omitempty"`
}

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
