// Package schemadiff vergelijkt twee V3-metamodellen en genereert een delta-rapport
// met ernst-classificatie (informatief, additief, modificatie, destructief).
package schemadiff

import "time"

// ---- Ernst-niveaus ----

// Ernst beschrijft de impact van een delta-item.
type Ernst int

const (
	// Informatief: geen DB-impact, alleen metadata (description, kleur, layout).
	Informatief Ernst = iota
	// Additief: veilig toepasbaar — nieuwe tabellen, kolommen.
	Additief
	// Modificatie: vereist controle — type-wijzigingen, NOT NULL constraints.
	Modificatie
	// Destructief: mogelijk dataverlies — DROP TABLE, DROP COLUMN.
	Destructief
)

func (e Ernst) String() string {
	switch e {
	case Informatief:
		return "informatief"
	case Additief:
		return "additief"
	case Modificatie:
		return "modificatie"
	case Destructief:
		return "destructief"
	}
	return "onbekend"
}

// ---- Categorieën ----

const (
	CategorieEntiteit        = "entiteit"
	CategorieGegevenselement = "gegevenselement"
	CategorieRelatie         = "relatie"
	CategorieVeld            = "veld"
	CategorieEnum            = "enum"
	CategorieDatatype        = "datatype"
	CategorieReferentielijst = "referentielijst"
)

// ---- Acties ----

const (
	ActieToeGevoegd = "toegevoegd"
	ActieVerwijderd = "verwijderd"
	ActieGewijzigd  = "gewijzigd"
)

// ---- Delta-item ----

// DeltaItem beschrijft één verschil tussen twee modelversies.
type DeltaItem struct {
	Ernst        Ernst  // impact-niveau
	Categorie    string // entiteit, gegevenselement, relatie, veld, enum, datatype
	Actie        string // toegevoegd, verwijderd, gewijzigd
	Pad          string // leesbaar pad, bijv. "NatuurlijkPersoon > NP_Naam > achternaam"
	OudeWaarde   string // beschrijving oude situatie (leeg bij toevoeging)
	NieuweWaarde string // beschrijving nieuwe situatie (leeg bij verwijdering)
	Omschrijving string // mensleesbare beschrijving van het verschil
	Tabelnaam    string // afgeleide tabelnaam voor DDL (indien van toepassing)
	Kolomnaam    string // afgeleide kolomnaam voor DDL (indien van toepassing)
	DBType       string // PostgreSQL kolomtype voor DDL (indien van toepassing)
}

// ---- Delta-rapport ----

// DeltaRapport bevat de volledige vergelijking tussen twee modelversies.
type DeltaRapport struct {
	OudModelNaam     string
	NieuwModelNaam   string
	OudModelVersie   string // V3Model.Versie
	NieuwModelVersie string
	Domein           string // optioneel domeinfilter dat is toegepast
	Tijdstip         time.Time
	Items            []DeltaItem
}

// PerErnst retourneert alle items met de opgegeven ernst.
func (r DeltaRapport) PerErnst(e Ernst) []DeltaItem {
	var result []DeltaItem
	for _, item := range r.Items {
		if item.Ernst == e {
			result = append(result, item)
		}
	}
	return result
}

// Additief retourneert alle additieve items.
func (r DeltaRapport) Additief() []DeltaItem { return r.PerErnst(Additief) }

// Modificaties retourneert alle modificatie-items.
func (r DeltaRapport) Modificaties() []DeltaItem { return r.PerErnst(Modificatie) }

// Destructief retourneert alle destructieve items.
func (r DeltaRapport) Destructief() []DeltaItem { return r.PerErnst(Destructief) }

// Informatief retourneert alle informatieve items.
func (r DeltaRapport) Informatief() []DeltaItem { return r.PerErnst(Informatief) }

// IsBreaking retourneert true als er destructieve of modificatie-items zijn.
func (r DeltaRapport) IsBreaking() bool {
	for _, item := range r.Items {
		if item.Ernst == Destructief || item.Ernst == Modificatie {
			return true
		}
	}
	return false
}

// HeeftDBMigratie retourneert true als er items zijn die DB-wijzigingen vereisen.
func (r DeltaRapport) HeeftDBMigratie() bool {
	for _, item := range r.Items {
		if item.Ernst != Informatief {
			return true
		}
	}
	return false
}

// Samenvatting retourneert een beknopte samenvatting van het rapport.
func (r DeltaRapport) Samenvatting() string {
	if len(r.Items) == 0 {
		return "Geen verschillen gevonden."
	}
	a := len(r.Additief())
	m := len(r.Modificaties())
	d := len(r.Destructief())
	i := len(r.Informatief())

	result := "Delta: "
	parts := []string{}
	if d > 0 {
		parts = append(parts, intToStr(d)+" destructief")
	}
	if m > 0 {
		parts = append(parts, intToStr(m)+" modificatie")
	}
	if a > 0 {
		parts = append(parts, intToStr(a)+" additief")
	}
	if i > 0 {
		parts = append(parts, intToStr(i)+" informatief")
	}
	for idx, p := range parts {
		if idx > 0 {
			result += ", "
		}
		result += p
	}
	return result
}

func intToStr(i int) string {
	if i < 10 {
		return string(rune('0' + i))
	}
	// Eenvoudige conversie voor kleine getallen
	s := ""
	for i > 0 {
		s = string(rune('0'+i%10)) + s
		i /= 10
	}
	return s
}
