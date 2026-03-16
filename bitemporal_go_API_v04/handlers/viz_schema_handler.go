package handlers

import (
	"net/http"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v04/model"
	"github.com/gin-gonic/gin"
)

var (
	timeType = reflect.TypeOf(time.Time{})
	dateType = reflect.TypeOf(model.Date{})
)

type vizSchemaChildDTO struct {
	Rolnaam         string `json:"rolnaam"`
	JSONRolnaam     string `json:"jsonRolnaam,omitempty"`
	Doeltype        string `json:"doeltype"`
	Momentvoorkomen string `json:"momentvoorkomen"`
}

type vizSchemaTypeDTO struct {
	Typenaam                  string              `json:"typenaam"`
	Description               string              `json:"description,omitempty"`
	Metatype                  model.Metatype      `json:"metatype"`
	Kleur                     string              `json:"kleur,omitempty"`
	Veldnaam                  string              `json:"veldnaam"`
	Velden                    []vizSchemaFieldDTO `json:"velden,omitempty"`
	Tabelnaam                 string              `json:"tabelnaam"`
	IDKolom                   string              `json:"idKolom"`
	IDAutoIncrement           bool                `json:"idAutoIncrement,omitempty"`
	HeeftPFK                  bool                `json:"heeftPFK"`
	EntiteitIDKolom           string              `json:"entiteitIDKolom,omitempty"`
	SecondaireEntiteitIDKolom string              `json:"secondaireEntiteitIDKolom,omitempty"`
	Momentvoorkomen           string              `json:"momentvoorkomen,omitempty"`
	Onderliggende             []vizSchemaChildDTO `json:"onderliggende,omitempty"`
}

type vizSchemaResponse struct {
	Versie string             `json:"versie"`
	Types  []vizSchemaTypeDTO `json:"types"`
}

type vizSchemaFieldDTO struct {
	Naam          string   `json:"naam"`
	Description   string   `json:"description,omitempty"`
	Type          string   `json:"type"`
	Format        string   `json:"format,omitempty"`
	Enum          []string `json:"enum,omitempty"`
	Verplicht     bool     `json:"verplicht"`
	AutoIncrement bool     `json:"autoIncrement,omitempty"`
}

// hasBunOption controleert of een bun-struct-tag een bepaalde optie bevat (bijv. "autoincrement").
func hasBunOption(tag, option string) bool {
	for _, part := range strings.Split(tag, ",") {
		if strings.EqualFold(strings.TrimSpace(part), option) {
			return true
		}
	}
	return false
}

// parseJSONTag haalt veldnaam en omitempty-informatie uit een json-tag.
// skip=true betekent dat het veld niet naar de API moet (bijv. json:"-").
func parseJSONTag(tag string) (name string, hasOmitEmpty bool, skip bool) {
	if tag == "-" {
		return "", false, true
	}
	if tag == "" {
		return "", false, false
	}
	parts := strings.Split(tag, ",")
	name = strings.TrimSpace(parts[0])
	for i := 1; i < len(parts); i++ {
		if strings.TrimSpace(parts[i]) == "omitempty" {
			hasOmitEmpty = true
			break
		}
	}
	if name == "-" {
		return "", hasOmitEmpty, true
	}
	return name, hasOmitEmpty, false
}

func enumValuesFromSchemaTag(tag string) []string {
	if tag == "" {
		return nil
	}
	for _, part := range strings.Split(tag, ",") {
		trimmed := strings.TrimSpace(part)
		if !strings.HasPrefix(trimmed, "enum=") {
			continue
		}
		rawValues := strings.Split(strings.TrimPrefix(trimmed, "enum="), "|")
		values := make([]string, 0, len(rawValues))
		for _, rawValue := range rawValues {
			value := strings.TrimSpace(rawValue)
			if value != "" {
				values = append(values, value)
			}
		}
		if len(values) > 0 {
			return values
		}
	}
	return nil
}

// schemaTypeVoorReflectType mapt Go-types op API-typen en optionele formats.
func schemaTypeVoorReflectType(t reflect.Type) (string, string) {
	if t == nil {
		return "string", ""
	}
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}

	isArray := false
	for t.Kind() == reflect.Slice || t.Kind() == reflect.Array {
		isArray = true
		t = t.Elem()
		for t.Kind() == reflect.Ptr {
			t = t.Elem()
		}
	}

	if t == timeType {
		if isArray {
			return "string", "array:date-time"
		}
		return "string", "date-time"
	}

	if t == dateType {
		if isArray {
			return "string", "array:date"
		}
		return "string", "date"
	}

	if meta, ok := model.MetaRegistry.GetTypeMeta(t.Name()); ok {
		if isArray {
			return meta.Typenaam, "array"
		}
		return meta.Typenaam, ""
	}

	switch t.Kind() {
	case reflect.Bool:
		if isArray {
			return "boolean", "array"
		}
		return "boolean", ""
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		if isArray {
			return "integer", "array"
		}
		return "integer", ""
	case reflect.Float32:
		if isArray {
			return "number", "array:float32"
		}
		return "number", "float32"
	case reflect.Float64:
		if isArray {
			return "number", "array:float64"
		}
		return "number", "float64"
	case reflect.String:
		if isArray {
			return "string", "array"
		}
		return "string", ""
	default:
		if isArray {
			return t.Name(), "array"
		}
		if t.Name() != "" {
			return t.Name(), ""
		}
		return "string", ""
	}
}

// reflectedVeldenVoorMeta leest de representatie-struct via reflectie uit
// en zet die om naar formuliervelden voor de frontend.
// Technische tijdvelden worden expliciet weggefilterd.
func reflectedVeldenVoorMeta(meta model.TypeMeta) []vizSchemaFieldDTO {
	ignore := map[string]struct{}{
		"opvoer":  {},
		"afvoer":  {},
		"aanvang": {},
		"einde":   {},
	}

	rep := meta.Factory()
	if rep == nil {
		return nil
	}
	t := reflect.TypeOf(rep)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return nil
	}

	velden := make([]vizSchemaFieldDTO, 0, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.PkgPath != "" {
			// Alleen exported velden meenemen.
			continue
		}

		name, hasOmitEmpty, skip := parseJSONTag(f.Tag.Get("json"))
		if skip {
			continue
		}
		if name == "" {
			if f.Anonymous {
				continue
			}
			name = strings.ToLower(f.Name)
		}
		if _, shouldSkip := ignore[strings.ToLower(name)]; shouldSkip {
			continue
		}

		veldType, format := schemaTypeVoorReflectType(f.Type)
		enum := enumValuesFromSchemaTag(f.Tag.Get("schema"))
		description := strings.TrimSpace(f.Tag.Get("schema_desc"))

		velden = append(velden, vizSchemaFieldDTO{
			Naam:          name,
			Description:   description,
			Type:          veldType,
			Format:        format,
			Enum:          enum,
			Verplicht:     !hasOmitEmpty,
			AutoIncrement: hasBunOption(f.Tag.Get("bun"), "autoincrement"),
		})
	}

	return velden
}

func momentvoorkomenNaarString(m model.Momentvoorkomen) string {
	if m == model.Enkelvoudig {
		return "enkelvoudig"
	}
	return "meervoudig"
}

func MaakVizSchemaHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Sorteer voor stabiele output (fijn voor frontend en tests).
		typeNamen := make([]string, 0, len(model.MetaRegistry))
		for typeNaam := range model.MetaRegistry {
			typeNamen = append(typeNamen, typeNaam)
		}
		sort.Strings(typeNamen)

		items := make([]vizSchemaTypeDTO, 0, len(typeNamen))
		for _, typeNaam := range typeNamen {
			meta, ok := model.MetaRegistry.GetTypeMeta(typeNaam)
			if !ok {
				continue
			}

			item := vizSchemaTypeDTO{
				Typenaam:                  meta.Typenaam,
				Description:               meta.Description,
				Metatype:                  meta.Metatype,
				Kleur:                     meta.Kleur,
				Veldnaam:                  meta.Veldnaam,
				Velden:                    reflectedVeldenVoorMeta(meta),
				Tabelnaam:                 meta.Tabelnaam,
				IDKolom:                   meta.IDKolom,
				IDAutoIncrement:           meta.RelatieveAutoincrement,
				HeeftPFK:                  meta.HeeftPFK,
				EntiteitIDKolom:           meta.EntiteitIDKolom,
				SecondaireEntiteitIDKolom: meta.SecondaireEntiteitIDKolom,
			}

			if meta.Metatype != model.MetatypeEntiteit {
				item.Momentvoorkomen = momentvoorkomenNaarString(meta.Momentvoorkomen)
			}

			if len(meta.OnderliggendeGegevenselementen) > 0 {
				children := make([]vizSchemaChildDTO, 0, len(meta.OnderliggendeGegevenselementen))
				for _, child := range meta.OnderliggendeGegevenselementen {
					children = append(children, vizSchemaChildDTO{
						Rolnaam:         child.Rolnaam,
						JSONRolnaam:     child.JSONRolnaam,
						Doeltype:        child.Doeltype,
						Momentvoorkomen: momentvoorkomenNaarString(child.Momentvoorkomen),
					})
				}
				item.Onderliggende = children
			}

			items = append(items, item)
		}

		c.JSON(http.StatusOK, vizSchemaResponse{
			Versie: "v1",
			Types:  items,
		})
	}
}
