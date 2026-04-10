// Package naamgeving bevat gedeelde naamgevingsconventies en afleidingslogica
// die zowel door de codegenerator (cmd/codegen) als de schema-diff tool (schemadiff)
// worden gebruikt.
package naamgeving

import (
	"strings"
	"unicode"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// ---- Naamconventies ----

// ToSnakeCase converteert PascalCase/camelCase naar snake_case.
// "RelAB" → "rel_a_b", "A_U" → "a_u" (al snake), "ID" → "id"
func ToSnakeCase(s string) string {
	var result strings.Builder
	for i, r := range s {
		if unicode.IsUpper(r) {
			if i > 0 {
				prev := rune(s[i-1])
				if unicode.IsLower(prev) || (unicode.IsUpper(prev) && i+1 < len(s) && unicode.IsLower(rune(s[i+1]))) {
					result.WriteRune('_')
				}
			}
			result.WriteRune(unicode.ToLower(r))
		} else {
			result.WriteRune(r)
		}
	}
	return result.String()
}

// ToPascalCase converteert snake_case naar PascalCase.
// "a_u" → "AU", "rel_a_b" → "RelAB". Houdt underscores in output als ze in het origineel zitten.
func ToPascalCase(s string) string {
	parts := strings.Split(s, "_")
	var result strings.Builder
	for _, part := range parts {
		if part == "" {
			continue
		}
		result.WriteString(strings.ToUpper(part[:1]) + part[1:])
	}
	return result.String()
}

// NormalizeIdentifierParts vervangt niet-alfanumerieke tekens door underscores
// en converteert naar lowercase, zodat gebruikersprefixen zoals "np-loc" of "CG"
// veilige en deterministische Go-identifiers opleveren.
func NormalizeIdentifierParts(s string) string {
	if s == "" {
		return s
	}
	var b strings.Builder
	lastWasSep := false
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' {
			b.WriteRune(unicode.ToLower(r))
			lastWasSep = false
			continue
		}
		if !lastWasSep {
			b.WriteRune('_')
			lastWasSep = true
		}
	}
	clean := strings.Trim(b.String(), "_")
	if clean == "" {
		return "generated"
	}
	return clean
}

// GeHubTypeName bepaalt de type-naam voor een GE-hub.
// De entiteitsnaam wordt altijd als prefix toegevoegd, zodat tabelnamen uniek zijn
// over entiteiten heen (bijv. "ApiStandaard_Naam" → tabel "apistandaard_naam").
func GeHubTypeName(ent model.V3Entiteit, geNaam string) string {
	return ent.Typenaam + "_" + geNaam
}

// ---- Afgeleid metatype ----

// DerivedType bevat alle afgeleide informatie voor een type (hub, data, aanvang, einde, entiteit).
type DerivedType struct {
	Typenaam               string
	Klassenaam             string // korte weergavenaam (zonder entiteitsprefix)
	Meervoud               string // expliciete meervoudsvorm uit het model
	Metatype               string // "entiteit", "gegevenselement", "relatie"
	GESubtype              string // "", "hub", "data", "aanvang", "einde"
	Tabelnaam              string
	IDKolom                string
	HeeftPFK               bool
	RelatieveAutoincrement bool
	EntiteitIDKolom        string
	SecEntiteitIDKolom     string // alleen voor relaties
	Padnaam                string
	Veldnaam               string
	IsMaterieel            bool
	DataTypenaam           string // alleen voor hubs
	BovenliggendTypenaam   string
}

// DeriveEntiteit leidt alle metadata af voor een entiteit.
func DeriveEntiteit(ent model.V3Entiteit) DerivedType {
	padnaam := ent.Meervoud
	meervoud := strings.ReplaceAll(ent.Meervoud, "_", " ")
	return DerivedType{
		Typenaam:    ent.Typenaam,
		Klassenaam:  ent.Typenaam,
		Meervoud:    meervoud,
		Metatype:    "entiteit",
		GESubtype:   "",
		Tabelnaam:   strings.ToLower(ent.Typenaam),
		IDKolom:     "id",
		HeeftPFK:    false,
		Padnaam:     padnaam,
		Veldnaam:    strings.ToLower(ent.Typenaam),
		IsMaterieel: ent.IsMaterieel,
	}
}

// DeriveHub leidt alle metadata af voor een hub (GE of relatie).
func DeriveHub(parentEnt string, typeName string, metatype string, isMaterieel bool, padnaam string, secEntIDKolom string) DerivedType {
	entIDKolom := strings.ToLower(parentEnt) + "_id"
	tabelnaam := strings.ToLower(typeName)
	veldnaam := strings.ToLower(typeName)
	klassenaam := typeName
	if metatype == "gegevenselement" {
		parts := strings.Split(typeName, "_")
		if len(parts) >= 2 {
			veldnaam = strings.ToLower(parts[len(parts)-1])
			klassenaam = parts[len(parts)-1]
		}
	}

	return DerivedType{
		Typenaam:               typeName,
		Klassenaam:             klassenaam,
		Metatype:               metatype,
		GESubtype:              "hub",
		Tabelnaam:              tabelnaam,
		IDKolom:                "rel_id",
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        entIDKolom,
		SecEntiteitIDKolom:     secEntIDKolom,
		Padnaam:                padnaam,
		Meervoud:               padnaam,
		Veldnaam:               veldnaam,
		IsMaterieel:            isMaterieel,
		DataTypenaam:           typeName + "_Data",
	}
}

// DeriveData leidt metadata af voor een _Data type.
func DeriveData(hubTypeName string, parentEnt string) DerivedType {
	typeName := hubTypeName + "_Data"
	entIDKolom := strings.ToLower(parentEnt) + "_id"
	return DerivedType{
		Typenaam:               typeName,
		Klassenaam:             "Data",
		Metatype:               "gegevenselement",
		GESubtype:              "data",
		Tabelnaam:              strings.ToLower(typeName),
		IDKolom:                "versie",
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        entIDKolom,
		Padnaam:                strings.ToLower(typeName),
		Meervoud:               strings.ToLower(typeName),
		Veldnaam:               strings.ToLower(typeName),
		BovenliggendTypenaam:   hubTypeName,
	}
}

// DeriveAanvangEinde leidt metadata af voor een _Aanvang of _Einde type.
func DeriveAanvangEinde(parentTypeName string, parentEnt string, suffix string) DerivedType {
	typeName := parentTypeName + "_" + suffix
	entIDKolom := strings.ToLower(parentEnt) + "_id"
	subtype := "aanvang"
	if suffix == "Einde" {
		subtype = "einde"
	}
	return DerivedType{
		Typenaam:               typeName,
		Klassenaam:             suffix,
		Metatype:               "gegevenselement",
		GESubtype:              subtype,
		Tabelnaam:              strings.ToLower(typeName),
		IDKolom:                "versie",
		HeeftPFK:               true,
		RelatieveAutoincrement: true,
		EntiteitIDKolom:        entIDKolom,
		Padnaam:                strings.ToLower(typeName),
		Meervoud:               strings.ToLower(typeName),
		Veldnaam:               strings.ToLower(typeName),
		BovenliggendTypenaam:   parentTypeName,
	}
}

// ---- Go-type naar DB-type mapping ----

// GoTypeToDBType vertaalt een Go-type naar het corresponderende PostgreSQL kolomtype.
func GoTypeToDBType(goType string) string {
	// Strip pointer prefix
	clean := strings.TrimPrefix(goType, "*")

	switch clean {
	case "string":
		return "TEXT"
	case "int", "int32":
		return "INTEGER"
	case "int64":
		return "BIGINT"
	case "float64":
		return "DOUBLE PRECISION"
	case "float32":
		return "REAL"
	case "bool":
		return "BOOLEAN"
	case "time.Time":
		return "TIMESTAMPTZ"
	case "Date":
		return "DATE"
	case "json.RawMessage":
		return "JSONB"
	default:
		// Enum types en custom datatypes worden als TEXT opgeslagen
		return "TEXT"
	}
}

// ---- Hogere-orde afleidingen vanuit V3 model ----

// AlleDerivedTypes berekent alle afgeleide types (entiteiten, hubs, data, aanvang, einde)
// voor een volledig V3 model. Dit is de basis voor delta-vergelijkingen.
func AlleDerivedTypes(v3 model.V3Model) []DerivedType {
	var result []DerivedType

	for _, ent := range v3.Entiteiten {
		// Entiteit zelf
		result = append(result, DeriveEntiteit(ent))

		// Materiële aanvang/einde op entiteitsniveau
		if ent.IsMaterieel {
			result = append(result, DeriveAanvangEinde(ent.Typenaam, ent.Typenaam, "Aanvang"))
			result = append(result, DeriveAanvangEinde(ent.Typenaam, ent.Typenaam, "Einde"))
		}

		// Gegevenselementen
		for _, ge := range ent.Gegevenselementen {
			hubType := GeHubTypeName(ent, ge.Naam)
			padnaam := ge.Meervoud
			if padnaam == "" {
				padnaam = ToSnakeCase(hubType)
			}
			hub := DeriveHub(ent.Typenaam, hubType, "gegevenselement", ge.IsMaterieel, padnaam, "")
			result = append(result, hub)
			result = append(result, DeriveData(hubType, ent.Typenaam))

			// Materiële aanvang/einde op GE-niveau
			if ge.IsMaterieel {
				result = append(result, DeriveAanvangEinde(hubType, ent.Typenaam, "Aanvang"))
				result = append(result, DeriveAanvangEinde(hubType, ent.Typenaam, "Einde"))
			}
		}

		// Relaties
		for _, rel := range ent.Relaties {
			secIDKolom := ""
			if rel.DoelEntiteit != "" {
				secIDKolom = strings.ToLower(rel.DoelEntiteit) + "_id"
			}
			hub := DeriveHub(ent.Typenaam, rel.Naam, "relatie", rel.IsMaterieel, rel.Meervoud, secIDKolom)
			result = append(result, hub)

			if len(rel.Velden) > 0 {
				result = append(result, DeriveData(rel.Naam, ent.Typenaam))
			}

			// Materiële aanvang/einde op relatieniveau
			if rel.IsMaterieel {
				result = append(result, DeriveAanvangEinde(rel.Naam, ent.Typenaam, "Aanvang"))
				result = append(result, DeriveAanvangEinde(rel.Naam, ent.Typenaam, "Einde"))
			}
		}
	}

	return result
}
