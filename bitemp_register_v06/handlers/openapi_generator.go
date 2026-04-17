package handlers

// openapi_generator.go — Genereert OpenAPI 3.1.0 specificaties uit de MetaRegistry.
//
// Conform NL API Strategie (ADR 2.1.0):
//   - /core/doc-openapi: OAS v3+ documentatie
//   - /core/publish-openapi: publiceer op /openapi.json en /openapi.yaml
//   - /core/doc-openapi-contact: info.contact object
//   - /core/naming-collections: meervoud voor collecties (via MetaRegistry Padnaam)
//   - /core/interface-language: Nederlands
//   - /core/no-trailing-slash: geen trailing slashes (behalve legacy /registratie/)
//   - /core/semver: semantic versioning in info.version
//   - /core/http-methods: alleen standaard HTTP methods (GET/POST/PATCH/PUT/DELETE)
//   - /core/doc-language: documentatie in het Nederlands

import (
	"reflect"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// APIVersion is de huidige API-versie (SemVer).
const APIVersion = "0.6.0"

// oasMap is een shorthand voor een geordende map in de OAS-structuur.
type oasMap = map[string]any

// GenereerOpenAPIDocument bouwt een volledig OpenAPI 3.1.0 document voor het
// opgegeven domein. Als domein leeg is, wordt de geconsolideerde spec gegenereerd.
func GenereerOpenAPIDocument(domein string) oasMap {
	titel := "Bitemporeel Register v06 API"
	beschrijving := "OpenAPI 3.1.0 specificatie, automatisch gegenereerd uit de MetaRegistry. " +
		"Bevat alle CRUD-endpoints voor entiteiten, gegevenselementen en relaties, " +
		"inclusief het bitemporele registratie-endpoint."
	if domein != "" {
		titel = "Bitemporeel Register v06 — " + domein + " API"
		beschrijving = "OpenAPI 3.1.0 specificatie voor het domein '" + domein + "', " +
			"automatisch gegenereerd uit de MetaRegistry."
	}

	doc := oasMap{
		"openapi": "3.1.0",
		"info": oasMap{
			"title":       titel,
			"version":     APIVersion,
			"description": beschrijving,
			"contact": oasMap{
				"name":  "Bitemporeel Register beheerder",
				"email": "beheer@register.nl",
			},
		},
		"servers": []oasMap{
			{"url": "http://localhost:8082", "description": "Lokale dev server"},
		},
		"paths":      genereerPaths(domein),
		"components": genereerComponents(domein),
	}

	return doc
}

// BeschikbareDomeinen retourneert de unieke domeinnamen uit de MetaRegistry.
func BeschikbareDomeinen() []string {
	set := map[string]struct{}{}
	for _, meta := range model.MetaRegistry {
		if meta.Domein != "" {
			set[meta.Domein] = struct{}{}
		}
	}
	domeinen := make([]string, 0, len(set))
	for d := range set {
		domeinen = append(domeinen, d)
	}
	sort.Strings(domeinen)
	return domeinen
}

// ──────────────────────────────────────────────────────────────────────
// Paths
// ──────────────────────────────────────────────────────────────────────

func genereerPaths(domein string) oasMap {
	paths := oasMap{}

	typeNamen := gesorteerdeTypeNamen()
	for _, typeNaam := range typeNamen {
		meta := model.MetaRegistry[typeNaam]
		if !isRelevantVoorOAS(meta, domein) {
			continue
		}

		// Basis CRUD routes: GET list, GET detail, POST
		if meta.DBFactory != nil && meta.Padnaam != "" {
			basePath := bepaalBasePath(meta)
			voegCRUDPathsToe(paths, basePath, meta)
		}

		// Full routes voor entiteiten
		if meta.Metatype == model.MetatypeEntiteit && meta.Factory != nil && meta.SliceFactory != nil && meta.Padnaam != "" {
			fullBase := "/full/" + bepaalPadnaam(meta)
			voegFullPathsToe(paths, fullBase, meta)
		}
	}

	// Registratie endpoint (alleen in geconsolideerde spec of als er geen domeinfilter is)
	if domein == "" {
		paths["/registratie/"] = oasMap{
			"post": oasMap{
				"operationId": "registreer",
				"summary":     "Registreer opvoer/afvoer van representaties",
				"description": "Hoofdendpoint voor bitemporele registratie. De payload bevat een " +
					"registratie-object plus een lijst wijzigingen. Elke wijziging heeft " +
					"een opvoer en/of afvoer met als sleutel de veldnaam uit de MetaRegistry.",
				"tags": []string{"Registratie"},
				"requestBody": oasMap{
					"required": true,
					"content": oasMap{
						"application/json": oasMap{
							"schema": oasMap{"$ref": "#/components/schemas/RegistreerRequest"},
						},
					},
				},
				"responses": oasMap{
					"200": oasMap{
						"description": "Registratie succesvol verwerkt",
						"content": oasMap{
							"application/json": oasMap{
								"schema": oasMap{"$ref": "#/components/schemas/RegistratieResponse"},
							},
						},
					},
					"400": oasMap{"description": "Ongeldige payload"},
					"500": oasMap{"description": "Interne serverfout"},
				},
			},
		}

		// Registraties list/detail
		paths["/registraties"] = oasMap{
			"get": oasMap{
				"operationId": "getRegistraties",
				"summary":     "Lijst van alle registraties",
				"tags":        []string{"Registratie"},
				"parameters":  paginatieParameters(),
				"responses":   lijstResponse("registraties", "Registratie"),
			},
		}
		paths["/registraties/{id}"] = oasMap{
			"get": oasMap{
				"operationId": "getRegistratie",
				"summary":     "Haal één registratie op",
				"tags":        []string{"Registratie"},
				"parameters":  []oasMap{idPathParameter()},
				"responses":   detailResponse("Registratie"),
			},
			"patch": oasMap{
				"operationId": "patchRegistratie",
				"summary":     "Wijzig een registratie gedeeltelijk",
				"tags":        []string{"Registratie"},
				"parameters":  []oasMap{idPathParameter()},
				"requestBody": oasMap{
					"required": true,
					"content": oasMap{
						"application/json": oasMap{
							"schema": oasMap{"$ref": "#/components/schemas/Registratie"},
						},
					},
				},
				"responses": detailResponse("Registratie"),
			},
		}

		// Wijzigingen
		paths["/wijzigingen"] = oasMap{
			"get": oasMap{
				"operationId": "getWijzigingen",
				"summary":     "Lijst van alle wijzigingen",
				"tags":        []string{"Registratie"},
				"parameters":  paginatieParameters(),
				"responses":   lijstResponse("wijzigingen", "Wijziging"),
			},
		}

		// Full registraties
		paths["/full/registraties"] = oasMap{
			"get": oasMap{
				"operationId": "getFullRegistraties",
				"summary":     "Registraties met geneste wijzigingen",
				"tags":        []string{"Registratie"},
				"parameters":  paginatieParameters(),
				"responses":   lijstResponse("registraties", "RegistratieFull"),
			},
		}
		paths["/full/registraties/{id}"] = oasMap{
			"get": oasMap{
				"operationId": "getFullRegistratie",
				"summary":     "Eén registratie met geneste wijzigingen",
				"tags":        []string{"Registratie"},
				"parameters":  []oasMap{idPathParameter()},
				"responses":   detailResponse("RegistratieFull"),
			},
		}
	}

	return paths
}

func voegCRUDPathsToe(paths oasMap, basePath string, meta model.TypeMeta) {
	tag := bepaalTag(meta)
	schemaRef := oasMap{"$ref": "#/components/schemas/" + meta.Typenaam}
	collectionKey := collectieSleutel(meta)

	// GET /{padnaam} — lijst
	listParams := paginatieParameters()
	listParams = append(listParams, oasMap{
		"name":        "q",
		"in":          "query",
		"description": "Zoekterm (ILIKE op tekstvelden)",
		"schema":      oasMap{"type": "string"},
	})
	listParams = append(listParams, oasMap{
		"name":        "sort",
		"in":          "query",
		"description": "Sorteerveld",
		"schema":      oasMap{"type": "string"},
	})

	listPath, ok := paths[basePath].(oasMap)
	if !ok {
		listPath = oasMap{}
	}
	listPath["get"] = oasMap{
		"operationId": "get" + meta.Typenaam + "Lijst",
		"summary":     "Lijst van " + collectionKey,
		"tags":        []string{tag},
		"parameters":  listParams,
		"responses": oasMap{
			"200": oasMap{
				"description": "Gepagineerde lijst",
				"content": oasMap{
					"application/json": oasMap{
						"schema": oasMap{
							"type": "object",
							"properties": oasMap{
								collectionKey: oasMap{
									"type":  "array",
									"items": schemaRef,
								},
								"page":     oasMap{"type": "integer"},
								"size":     oasMap{"type": "integer"},
								"has_more": oasMap{"type": "boolean"},
							},
						},
					},
				},
			},
		},
	}
	listPath["post"] = oasMap{
		"operationId": "add" + meta.Typenaam,
		"summary":     "Voeg een " + meta.Typenaam + " toe",
		"tags":        []string{tag},
		"requestBody": oasMap{
			"required": true,
			"content": oasMap{
				"application/json": oasMap{
					"schema": schemaRef,
				},
			},
		},
		"responses": oasMap{
			"201": oasMap{
				"description": "Aangemaakt",
				"content": oasMap{
					"application/json": oasMap{
						"schema": schemaRef,
					},
				},
			},
			"400": oasMap{"description": "Ongeldige payload"},
		},
	}
	paths[basePath] = listPath

	// GET /{padnaam}/{id} — detail
	detailPath := basePath + "/{id}"
	paths[detailPath] = oasMap{
		"get": oasMap{
			"operationId": "get" + meta.Typenaam,
			"summary":     "Haal één " + meta.Typenaam + " op",
			"tags":        []string{tag},
			"parameters":  []oasMap{idPathParameter()},
			"responses":   detailResponse(meta.Typenaam),
		},
	}
}

func voegFullPathsToe(paths oasMap, fullBase string, meta model.TypeMeta) {
	tag := bepaalTag(meta)
	fullSchemaName := meta.Typenaam + "Full"
	fullSchemaRef := oasMap{"$ref": "#/components/schemas/" + fullSchemaName}
	collectionKey := collectieSleutel(meta)

	peiltijdParam := oasMap{
		"name":        "t",
		"in":          "query",
		"description": "Formeel peiltijdstip (ISO 8601). Alleen naar het verleden.",
		"schema":      oasMap{"type": "string", "format": "date-time"},
	}

	listParams := paginatieParameters()
	listParams = append(listParams, peiltijdParam)

	paths[fullBase] = oasMap{
		"get": oasMap{
			"operationId": "getFull" + meta.Typenaam + "Lijst",
			"summary":     "Lijst van " + collectionKey + " met geneste gegevenselementen",
			"tags":        []string{tag},
			"parameters":  listParams,
			"responses": oasMap{
				"200": oasMap{
					"description": "Gepagineerde lijst met geneste GEs",
					"content": oasMap{
						"application/json": oasMap{
							"schema": oasMap{
								"type": "object",
								"properties": oasMap{
									collectionKey: oasMap{
										"type":  "array",
										"items": fullSchemaRef,
									},
									"page":     oasMap{"type": "integer"},
									"size":     oasMap{"type": "integer"},
									"has_more": oasMap{"type": "boolean"},
								},
							},
						},
					},
				},
			},
		},
		"post": oasMap{
			"operationId": "addFull" + meta.Typenaam,
			"summary":     "Voeg een volledige " + meta.Typenaam + " toe met geneste GEs",
			"tags":        []string{tag},
			"requestBody": oasMap{
				"required": true,
				"content": oasMap{
					"application/json": oasMap{
						"schema": fullSchemaRef,
					},
				},
			},
			"responses": oasMap{
				"201": oasMap{
					"description": "Aangemaakt",
					"content": oasMap{
						"application/json": oasMap{
							"schema": fullSchemaRef,
						},
					},
				},
				"400": oasMap{"description": "Ongeldige payload"},
			},
		},
	}

	// GET /full/{padnaam}/{id}
	detailParams := []oasMap{idPathParameter(), peiltijdParam}
	paths[fullBase+"/{id}"] = oasMap{
		"get": oasMap{
			"operationId": "getFull" + meta.Typenaam,
			"summary":     "Volledige " + meta.Typenaam + " met alle geneste gegevenselementen",
			"tags":        []string{tag},
			"parameters":  detailParams,
			"responses": oasMap{
				"200": oasMap{
					"description": "Volledige entiteit met geneste GEs",
					"content": oasMap{
						"application/json": oasMap{
							"schema": fullSchemaRef,
						},
					},
				},
				"404": oasMap{"description": "Niet gevonden"},
			},
		},
	}
}

// ──────────────────────────────────────────────────────────────────────
// Schemas (components)
// ──────────────────────────────────────────────────────────────────────

func genereerComponents(domein string) oasMap {
	schemas := oasMap{}

	typeNamen := gesorteerdeTypeNamen()
	for _, typeNaam := range typeNamen {
		meta := model.MetaRegistry[typeNaam]
		if !isRelevantVoorOAS(meta, domein) {
			continue
		}

		// Basis-schema
		schemas[meta.Typenaam] = genereerSchemaVoorMeta(meta)

		// Full-schema voor entiteiten
		if meta.Metatype == model.MetatypeEntiteit && len(meta.OnderliggendeGegevenselementen) > 0 {
			schemas[meta.Typenaam+"Full"] = genereerFullSchemaVoorEntiteit(meta)
		}
	}

	// Plumbing schemas (alleen in geconsolideerde spec)
	if domein == "" {
		schemas["Registratie"] = genereerRegistratieSchema()
		schemas["RegistratieFull"] = genereerRegistratieFullSchema()
		schemas["Wijziging"] = genereerWijzigingSchema()
		schemas["RegistreerRequest"] = genereerRegistreerRequestSchema()
		schemas["WijzigingRequest"] = genereerWijzigingRequestSchema()
		schemas["RepresentatiePlusNaam"] = genereerRepresentatiePlusNaamSchema()
		schemas["RegistratieResponse"] = genereerRegistratieResponseSchema()
	}

	return oasMap{"schemas": schemas}
}

// genereerSchemaVoorMeta bouwt een OAS schema-object voor één MetaRegistry-type.
func genereerSchemaVoorMeta(meta model.TypeMeta) oasMap {
	schema := oasMap{
		"type": "object",
	}
	if meta.Description != "" {
		schema["description"] = meta.Description
	}

	properties := oasMap{}
	required := []string{}

	rep := meta.Factory()
	if rep == nil {
		return schema
	}
	t := reflect.TypeOf(rep)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return schema
	}

	techFields := map[string]struct{}{
		"opvoer": {}, "afvoer": {},
	}

	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.PkgPath != "" {
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

		// Sla technische formele-tijdvelden over
		if _, isTech := techFields[strings.ToLower(name)]; isTech {
			continue
		}

		// Sla relatie-velden over (bun rel:has-many etc.) — die zitten in het Full schema
		bunTag := f.Tag.Get("bun")
		if strings.Contains(bunTag, "rel:") {
			continue
		}

		prop := veldeigenschappenVoorField(f, meta)
		properties[name] = prop

		if !hasOmitEmpty {
			required = append(required, name)
		}
	}

	schema["properties"] = properties
	if len(required) > 0 {
		schema["required"] = required
	}

	return schema
}

// genereerFullSchemaVoorEntiteit maakt een "Full" schema dat de entiteitsvelden
// plus alle onderliggende gegevenselementen/relaties bevat.
func genereerFullSchemaVoorEntiteit(meta model.TypeMeta) oasMap {
	// Start met allOf: eerst het basis-schema
	basisRef := oasMap{"$ref": "#/components/schemas/" + meta.Typenaam}

	// Voeg properties toe voor elk onderliggend gegevenselement
	extraProperties := oasMap{}
	for _, child := range meta.OnderliggendeGegevenselementen {
		childRef := oasMap{"$ref": "#/components/schemas/" + child.Doeltype}
		if child.Momentvoorkomen == model.Meervoudig {
			extraProperties[child.JSONRolnaam] = oasMap{
				"type":  "array",
				"items": childRef,
			}
		} else {
			// Enkelvoudig: toch als array met maxItems:1 (zo werkt de API)
			extraProperties[child.JSONRolnaam] = oasMap{
				"type":     "array",
				"items":    childRef,
				"maxItems": 1,
			}
		}
	}

	return oasMap{
		"allOf": []oasMap{
			basisRef,
			{
				"type":       "object",
				"properties": extraProperties,
			},
		},
		"description": "Volledige " + meta.Typenaam + " met alle geneste gegevenselementen en relaties",
	}
}

// veldeigenschappenVoorField zet een reflect.StructField om naar OAS property-attributen.
func veldeigenschappenVoorField(f reflect.StructField, _ model.TypeMeta) oasMap {
	prop := oasMap{}

	apiType, format := oasTypeVoorReflectType(f.Type)
	prop["type"] = apiType
	if format != "" {
		prop["format"] = format
	}

	// Enum-waarden
	enumVals := resolveEnumWaarden(f)
	if len(enumVals) > 0 {
		prop["enum"] = enumVals
	}

	// Beschrijving uit schema_desc tag
	desc := strings.TrimSpace(f.Tag.Get("schema_desc"))
	if desc != "" {
		prop["description"] = desc
	}

	return prop
}

// oasTypeVoorReflectType converteert Go-types naar OAS 3.1 type/format paren.
// Verschilt van schemaTypeVoorReflectType doordat het altijd pure OAS types teruggeeft.
func oasTypeVoorReflectType(t reflect.Type) (string, string) {
	if t == nil {
		return "string", ""
	}
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}

	// Arrays worden niet als property-type getoond; die zitten in het Full schema.
	// Maar voor het geval dat er array-velden in een struct staan:
	if t.Kind() == reflect.Slice || t.Kind() == reflect.Array {
		return "array", ""
	}

	if t == timeType {
		return "string", "date-time"
	}
	if t == dateType {
		return "string", "date"
	}

	switch t.Kind() {
	case reflect.Bool:
		return "boolean", ""
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32:
		return "integer", "int32"
	case reflect.Int64:
		return "integer", "int64"
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "integer", ""
	case reflect.Float32:
		return "number", "float"
	case reflect.Float64:
		return "number", "double"
	case reflect.String:
		return "string", ""
	default:
		return "string", ""
	}
}

// ──────────────────────────────────────────────────────────────────────
// Plumbing schemas (Registratie, Wijziging, etc.)
// ──────────────────────────────────────────────────────────────────────

func genereerRegistratieSchema() oasMap {
	return oasMap{
		"type":        "object",
		"description": "Een registratie, correctie of ongedaanmaking in het bitemporele register",
		"properties": oasMap{
			"id":                            oasMap{"type": "integer", "format": "int64"},
			"registratietype":               oasMap{"type": "string", "enum": []string{"registratie", "correctie", "ongedaanmaking"}},
			"tijdstip":                      oasMap{"type": "string", "format": "date-time"},
			"opmerking":                     oasMap{"type": "string"},
			"corrigeert_registratie_id":     oasMap{"type": "integer", "format": "int64"},
			"maakt_ongedaan_registratie_id": oasMap{"type": "integer", "format": "int64"},
			"is_ongedaangemaakt":            oasMap{"type": "boolean"},
		},
	}
}

func genereerRegistratieFullSchema() oasMap {
	return oasMap{
		"allOf": []oasMap{
			{"$ref": "#/components/schemas/Registratie"},
			{
				"type": "object",
				"properties": oasMap{
					"wijzigingen": oasMap{
						"type":  "array",
						"items": oasMap{"$ref": "#/components/schemas/Wijziging"},
					},
				},
			},
		},
		"description": "Registratie met geneste wijzigingen",
	}
}

func genereerWijzigingSchema() oasMap {
	return oasMap{
		"type":        "object",
		"description": "Een individuele wijziging (opvoer of afvoer) binnen een registratie",
		"properties": oasMap{
			"id":                 oasMap{"type": "integer", "format": "int64"},
			"wijzigingstype":     oasMap{"type": "string", "enum": []string{"opvoer", "afvoer"}},
			"registratie_id":     oasMap{"type": "integer", "format": "int64"},
			"entiteitnaam":       oasMap{"type": "string"},
			"representatienaam":  oasMap{"type": "string"},
			"representatie_id":   oasMap{"type": "string"},
			"versie":             oasMap{"type": "integer", "format": "int64"},
			"tijdstip":           oasMap{"type": "string", "format": "date-time"},
			"is_ongedaangemaakt": oasMap{"type": "boolean"},
		},
	}
}

func genereerRegistreerRequestSchema() oasMap {
	return oasMap{
		"type":     "object",
		"required": []string{"registratie", "wijzigingen"},
		"description": "Payload voor het registratie-endpoint. Bevat een registratie-object " +
			"en een lijst van wijzigingen met opvoer/afvoer representaties.",
		"properties": oasMap{
			"registratie": oasMap{
				"type":     "object",
				"required": []string{"registratietype", "tijdstip"},
				"properties": oasMap{
					"registratietype":               oasMap{"type": "string", "enum": []string{"registratie", "correctie", "ongedaanmaking"}},
					"tijdstip":                      oasMap{"type": "string", "format": "date-time"},
					"opmerking":                     oasMap{"type": "string"},
					"corrigeert_registratie_id":     oasMap{"type": "integer", "format": "int64"},
					"maakt_ongedaan_registratie_id": oasMap{"type": "integer", "format": "int64"},
				},
			},
			"wijzigingen": oasMap{
				"type":  "array",
				"items": oasMap{"$ref": "#/components/schemas/WijzigingRequest"},
			},
		},
	}
}

func genereerWijzigingRequestSchema() oasMap {
	return oasMap{
		"type": "object",
		"description": "Een wijziging bevat een opvoer en/of een afvoer. De waarde is een " +
			"object met exact één sleutel: de veldnaam van het representatietype " +
			"(bijv. \"natuurlijkpersoon\", \"naam\", \"burgerschap\").",
		"properties": oasMap{
			"opvoer": oasMap{"$ref": "#/components/schemas/RepresentatiePlusNaam"},
			"afvoer": oasMap{"$ref": "#/components/schemas/RepresentatiePlusNaam"},
		},
	}
}

func genereerRepresentatiePlusNaamSchema() oasMap {
	// Genereer oneOf met alle bekende veldnamen
	oneOf := []oasMap{}
	seen := map[string]struct{}{}

	typeNamen := gesorteerdeTypeNamen()
	for _, typeNaam := range typeNamen {
		meta := model.MetaRegistry[typeNaam]
		if meta.Veldnaam == "" || meta.Factory == nil {
			continue
		}
		if _, exists := seen[meta.Veldnaam]; exists {
			continue
		}
		seen[meta.Veldnaam] = struct{}{}

		oneOf = append(oneOf, oasMap{
			"type": "object",
			"properties": oasMap{
				meta.Veldnaam: oasMap{"$ref": "#/components/schemas/" + meta.Typenaam},
			},
		})
	}

	return oasMap{
		"description": "Dynamisch object — precies één sleutel (de MetaRegistry veldnaam) " +
			"met als waarde het representatie-object.",
		"oneOf": oneOf,
	}
}

func genereerRegistratieResponseSchema() oasMap {
	return oasMap{
		"type":        "object",
		"description": "Response van het registratie-endpoint",
		"properties": oasMap{
			"message":        oasMap{"type": "string"},
			"registratie_id": oasMap{"type": "integer", "format": "int64"},
			"tijdstip":       oasMap{"type": "string", "format": "date-time"},
			"wijzigingen": oasMap{
				"type":  "array",
				"items": oasMap{"$ref": "#/components/schemas/Wijziging"},
			},
		},
	}
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

func gesorteerdeTypeNamen() []string {
	namen := make([]string, 0, len(model.MetaRegistry))
	for naam := range model.MetaRegistry {
		namen = append(namen, naam)
	}
	sort.Strings(namen)
	return namen
}

func isRelevantVoorOAS(meta model.TypeMeta, domein string) bool {
	if meta.Factory == nil {
		return false
	}
	if domein != "" && meta.Domein != domein {
		return false
	}
	return true
}

func bepaalBasePath(meta model.TypeMeta) string {
	padnaam := bepaalPadnaam(meta)
	if meta.EntiteitSubtype == model.EntiteitSubtypeReferentielijst {
		return "/referentielijsten/" + padnaam
	}
	return "/" + padnaam
}

func bepaalPadnaam(meta model.TypeMeta) string {
	return meta.Padnaam
}

func bepaalTag(meta model.TypeMeta) string {
	if meta.Domein != "" {
		return meta.Domein
	}
	return string(meta.Metatype)
}

func collectieSleutel(meta model.TypeMeta) string {
	if meta.Meervoud != "" {
		return meta.Meervoud
	}
	return meta.Padnaam
}

func paginatieParameters() []oasMap {
	return []oasMap{
		{
			"name":        "page",
			"in":          "query",
			"description": "Paginanummer (1-gebaseerd)",
			"schema":      oasMap{"type": "integer", "default": 1},
		},
		{
			"name":        "size",
			"in":          "query",
			"description": "Aantal resultaten per pagina",
			"schema":      oasMap{"type": "integer", "default": 20},
		},
	}
}

func idPathParameter() oasMap {
	return oasMap{
		"name":        "id",
		"in":          "path",
		"required":    true,
		"description": "Uniek ID van de resource",
		"schema":      oasMap{"type": "integer"},
	}
}

func lijstResponse(collectionKey string, schemaName string) oasMap {
	return oasMap{
		"200": oasMap{
			"description": "Gepagineerde lijst",
			"content": oasMap{
				"application/json": oasMap{
					"schema": oasMap{
						"type": "object",
						"properties": oasMap{
							collectionKey: oasMap{
								"type":  "array",
								"items": oasMap{"$ref": "#/components/schemas/" + schemaName},
							},
							"page":     oasMap{"type": "integer"},
							"size":     oasMap{"type": "integer"},
							"has_more": oasMap{"type": "boolean"},
						},
					},
				},
			},
		},
	}
}

func detailResponse(schemaName string) oasMap {
	return oasMap{
		"200": oasMap{
			"description": "Resource gevonden",
			"content": oasMap{
				"application/json": oasMap{
					"schema": oasMap{"$ref": "#/components/schemas/" + schemaName},
				},
			},
		},
		"404": oasMap{"description": "Niet gevonden"},
	}
}
