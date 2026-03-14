package handlers

import (
	"net/http"
	"reflect"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v04/model"
	"github.com/gin-gonic/gin"
)

type vizSchemaChildDTO struct {
	Rolnaam         string `json:"rolnaam"`
	JSONRolnaam     string `json:"jsonRolnaam,omitempty"`
	Doeltype        string `json:"doeltype"`
	Momentvoorkomen string `json:"momentvoorkomen"`
}

type vizSchemaTypeDTO struct {
	Typenaam                  string              `json:"typenaam"`
	Metatype                  model.Metatype      `json:"metatype"`
	Kleur                     string              `json:"kleur,omitempty"`
	Veldnaam                  string              `json:"veldnaam"`
	Velden                    []vizSchemaFieldDTO `json:"velden,omitempty"`
	Tabelnaam                 string              `json:"tabelnaam"`
	IDKolom                   string              `json:"idKolom"`
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
	Naam      string `json:"naam"`
	Type      string `json:"type"`
	Verplicht bool   `json:"verplicht"`
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

// jsTypeVoorReflectType mapt Go-types op simpele frontend-types.
func jsTypeVoorReflectType(t reflect.Type) string {
	if t == nil {
		return "string"
	}
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	switch t.Kind() {
	case reflect.Bool:
		return "boolean"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return "number"
	case reflect.String:
		return "string"
	default:
		return "string"
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

		velden = append(velden, vizSchemaFieldDTO{
			Naam: name,
			Type: jsTypeVoorReflectType(f.Type),
			// json omitempty => optioneel; zonder omitempty => verplicht.
			Verplicht: !hasOmitEmpty,
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
				Metatype:                  meta.Metatype,
				Kleur:                     meta.Kleur,
				Veldnaam:                  meta.Veldnaam,
				Velden:                    reflectedVeldenVoorMeta(meta),
				Tabelnaam:                 meta.Tabelnaam,
				IDKolom:                   meta.IDKolom,
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
