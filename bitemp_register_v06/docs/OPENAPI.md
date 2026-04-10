# OpenAPI 3.1 — Specificaties, Swagger UI & ReDoc

> Automatisch gegenereerde OAS 3.1.0 specificaties uit de MetaRegistry, conform de NL API Strategie (ADR 2.1.0).

[![Swagger UI](https://img.shields.io/badge/Open-Swagger%20UI-85ea2d?style=for-the-badge&logo=swagger&logoColor=black)](http://localhost:8082/swagger)
[![ReDoc](https://img.shields.io/badge/Open-ReDoc-6ec5ab?style=for-the-badge)](http://localhost:8082/redoc)
[![OpenAPI JSON](https://img.shields.io/badge/Open-OpenAPI%20JSON-0d47a1?style=for-the-badge)](http://localhost:8082/openapi.json)
[![OpenAPI YAML](https://img.shields.io/badge/Open-OpenAPI%20YAML-0d47a1?style=for-the-badge)](http://localhost:8082/openapi.yaml)

---

## Inhoudsopgave

- [Overzicht](#overzicht)
- [Runtime endpoints](#runtime-endpoints)
  - [Specificatie-endpoints](#specificatie-endpoints)
  - [Interactieve documentatie](#interactieve-documentatie)
  - [Domeinoverzicht-endpoint](#domeinoverzicht-endpoint)
- [Bestanden exporteren (CLI)](#bestanden-exporteren-cli)
- [Architectuur](#architectuur)
  - [Generatie uit MetaRegistry](#generatie-uit-metaregistry)
  - [Bestandsstructuur](#bestandsstructuur)
- [NL API Strategie compliance (ADR 2.1.0)](#nl-api-strategie-compliance-adr-210)
- [Content negotiation](#content-negotiation)
- [Domeinen](#domeinen)
- [Gegenereerde schema's](#gegenereerde-schemas)

---

## Overzicht

De API genereert **volledig automatisch** OpenAPI 3.1.0 specificaties op basis van de MetaRegistry. Er is geen handmatig onderhoud van YAML/JSON-bestanden nodig: als het model verandert (structs, MetaRegistry-entries, velden), veranderen de specs mee.

Er zijn twee manieren om de specs te gebruiken:

1. **Runtime** — de draaiende API serveert de specs op `/openapi.json`, `/openapi.yaml` en per domein
2. **CLI-export** — genereer bestanden naar disk voor versiebeheer in Git

---

## Runtime endpoints

### Specificatie-endpoints

| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| GET | `/openapi.json` | Geconsolideerde spec — alle domeinen (JSON) |
| GET | `/openapi.yaml` | Geconsolideerde spec — alle domeinen (YAML) |
| GET | `/openapi/:domein` | Per-domein spec, bijv. `/openapi/abuvwxy.json` |

De domein-parameter accepteert optioneel een `.json` of `.yaml` suffix:

```
GET /openapi/abuvwxy.json   → JSON formaat
GET /openapi/abuvwxy.yaml   → YAML formaat
GET /openapi/abuvwxy        → formaat via Accept header (standaard JSON)
```

Alle spec-endpoints zetten de volgende headers:

| Header | Waarde | Reden |
|--------|--------|-------|
| `Access-Control-Allow-Origin` | `*` | CORS — zodat de spec vanuit elke frontend opgehaald kan worden |
| `API-Version` | `0.6.0` | Conform ADR `/core/version-header` |

### Interactieve documentatie

| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| GET | `/swagger` | Swagger UI — interactieve API-verkenner |
| GET | `/redoc` | ReDoc — leesbare, gestructureerde API-documentatie |

Beide pagina's:

- Laden standaard de **geconsolideerde** spec (`/openapi.json`)
- Hebben een **dropdown** om te wisselen tussen de geconsolideerde en per-domein specs
- Bevatten links naar de **JSON/YAML downloads** en naar de andere viewer
- Worden volledig inline gegenereerd (geen externe bestanden nodig)
- Laden Swagger UI 5 / ReDoc via CDN (geen npm-installatie nodig)

**Query parameter**: met `?spec=/openapi/abuvwxy.json` kun je direct een specifieke spec laden:

```
http://localhost:8082/swagger?spec=/openapi/abuvwxy.json
http://localhost:8082/redoc?spec=/openapi/CG.json
```

### Domeinoverzicht-endpoint

```
GET /openapi
```

Retourneert een JSON-overzicht van alle beschikbare domeinen met links:

```json
{
  "domeinen": ["CG", "abuvwxy", "configuratie", "np-loc", "register"],
  "geconsolideerd": {
    "json": "/openapi.json",
    "yaml": "/openapi.yaml"
  },
  "per_domein": [
    { "domein": "CG", "json": "/openapi/CG.json", "yaml": "/openapi/CG.yaml" },
    { "domein": "abuvwxy", "json": "/openapi/abuvwxy.json", "yaml": "/openapi/abuvwxy.yaml" }
  ]
}
```

---

## Bestanden exporteren (CLI)

Met de CLI-tool `cmd/openapi-export` kun je de specs naar bestanden schrijven, zodat je ze kunt committen naar Git.

### Gebruik

```sh
# Alle specs (JSON + YAML) naar de standaardmap openapi/
go run ./cmd/openapi-export

# Naar een andere map
go run ./cmd/openapi-export --output docs/openapi

# Alleen één specifiek domein
go run ./cmd/openapi-export --domein abuvwxy

# Alleen JSON of alleen YAML
go run ./cmd/openapi-export --format json
go run ./cmd/openapi-export --format yaml
```

### Vlaggen

| Vlag | Standaard | Beschrijving |
|------|-----------|--------------|
| `--output` | `openapi` | Uitvoermap (wordt aangemaakt als die niet bestaat) |
| `--domein` | _(leeg = alles)_ | Genereer alleen voor dit domein |
| `--format` | _(leeg = beide)_ | `json`, `yaml`, of leeg voor beide formaten |

### Gegenereerde bestanden

Bij `go run ./cmd/openapi-export` worden de volgende bestanden aangemaakt:

```
openapi/
├── openapi.json          # Geconsolideerde spec (alle domeinen)
├── openapi.yaml
├── abuvwxy.json           # Domein: abuvwxy
├── abuvwxy.yaml
├── CG.json                # Domein: CG
├── CG.yaml
├── configuratie.json      # Domein: configuratie
├── configuratie.yaml
├── np-loc.json            # Domein: np-loc
├── np-loc.yaml
├── register.json          # Domein: register
└── register.yaml
```

### Tip: pre-commit of CI

Je kunt de export opnemen in een pre-commit hook of CI-pipeline:

```sh
go run ./cmd/openapi-export --output openapi
git add openapi/
```

---

## Architectuur

### Generatie uit MetaRegistry

De specs worden **runtime gegenereerd** uit de MetaRegistry — er zijn geen statische YAML-bestanden die handmatig bijgehouden moeten worden. De generatie werkt als volgt:

```
MetaRegistry (model/metaregistry.go)
    ↓
GenereerOpenAPIDocument(domein)         (handlers/openapi_generator.go)
    ├── genereerPaths()                 → alle pad-definities (CRUD, full, registratie)
    │     ├── voegCRUDPathsToe()        → LIST/POST + GET/:id per type
    │     └── voegFullPathsToe()        → /full/ routes voor entiteiten
    └── genereerComponents()            → alle schema-definities
          ├── genereerSchemaVoorMeta()   → schema per representatietype
          ├── genereerFullSchemaVoorEntiteit() → "Full" schema met geneste GE's
          └── plumbing-schemas           → Registratie, Wijziging, etc.
    ↓
serveerOASDocument()                    (handlers/openapi_handler.go)
    → JSON of YAML via content negotiation
```

De CLI-tool (`cmd/openapi-export`) roept dezelfde `GenereerOpenAPIDocument()` aan en schrijft het resultaat naar bestanden.

### Bestandsstructuur

| Bestand | Rol |
|---------|-----|
| `handlers/openapi_generator.go` | Kernlogica: bouwt het OAS 3.1.0 document op uit de MetaRegistry |
| `handlers/openapi_handler.go` | HTTP-handlers: content negotiation, Swagger UI, ReDoc |
| `cmd/openapi-export/main.go` | CLI-tool: schrijft specs naar bestanden |
| `main.go` | Routeregistratie: `/openapi.*`, `/swagger`, `/redoc` |

---

## NL API Strategie compliance (ADR 2.1.0)

De OpenAPI-implementatie volgt de regels uit de [NL API Strategie ADR 2.1.0](https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1.0/):

| ADR-regel | Status | Toelichting |
|-----------|--------|-------------|
| `/core/doc-openapi` — OAS v3+ verplicht | ✅ | OpenAPI 3.1.0 |
| `/core/publish-openapi` — Publiceer spec | ✅ | `/openapi.json` + `/openapi.yaml` |
| `/core/doc-openapi-contact` — `info.contact` | ✅ | `name` + `email` in info-blok |
| `/core/naming-collections` — Meervoud voor collecties | ✅ | Via MetaRegistry `Padnaam` |
| `/core/interface-language` — Nederlands | ✅ | Domeintermen in het Nederlands |
| `/core/doc-language` — Documentatie in NL | ✅ | Beschrijvingen in het Nederlands |
| `/core/no-trailing-slash` — Geen trailing slash | ✅ | Behalve legacy `/registratie/` |
| `/core/semver` — Semantic versioning | ✅ | `info.version: "0.6.0"` |
| `/core/version-header` — API-Version header | ✅ | Op spec-endpoints |
| `/core/http-methods` — Standaard HTTP methods | ✅ | GET/POST/PATCH/PUT/DELETE |
| `/core/transport/cors` — CORS headers | ✅ | `Access-Control-Allow-Origin: *` op spec-endpoints |
| `/core/uri-version` — Major versie in URI | ❌ | Uitgesteld — breaking change, aparte taak |

### URI-versioning (`/core/uri-version`)

Deze regel vereist een major-versieprefix in alle API-paden (bijv. `/v1/as`). Dit is bewust **uitgesteld** omdat:

- Alle bestaande routes (100+) zouden moeten wijzigen
- De frontend en Postman-collecties zijn afgestemd op de huidige paden
- Dit is een breaking change die als aparte taak uitgevoerd wordt

---

## Content negotiation

De spec-endpoints ondersteunen meerdere manieren om het gewenste formaat aan te geven:

| Methode | Voorbeeld | Resultaat |
|---------|-----------|-----------|
| URL-extensie | `/openapi.json`, `/openapi.yaml` | Vast formaat |
| Suffix op domeinparam | `/openapi/abuvwxy.yaml` | YAML |
| Accept header | `Accept: application/x-yaml` | YAML |
| Accept header | `Accept: text/yaml` | YAML |
| Accept header | `Accept: application/yaml` | YAML |
| _(standaard)_ | `/openapi/abuvwxy` | JSON |

---

## Domeinen

De specs worden gegenereerd per **domein** zoals gedefinieerd in de MetaRegistry (`TypeMeta.Domein`). De huidige domeinen zijn:

| Domein | Beschrijving |
|--------|--------------|
| `abuvwxy` | Hoofddomein met entiteiten A, B en hun GE's/relaties |
| `CG` | Common Ground gerelateerde types |
| `configuratie` | Configuratie-instellingen |
| `np-loc` | Natuurlijk persoon / locatie |
| `register` | Register-brede plumbing (registratie, wijziging) |

De geconsolideerde spec bevat **alle domeinen** in één document. De per-domein specs bevatten alleen de types en paden die tot dat domein behoren.

---

## Gegenereerde schema's

De OAS-specs bevatten automatisch gegenereerde schema's voor:

### Representatietypes (uit MetaRegistry)

Voor elk type in de MetaRegistry (entiteiten, gegevenselementen, relaties) wordt een schema gegenereerd met:

- Alle velden uit de Go-struct (met JSON-namen)
- Type en format op basis van het Go-type (bijv. `time.Time` → `string` + `date-time`)
- Enum-waarden waar van toepassing
- Beschrijvingen uit de `schema_desc` tag

### Full-schemas (voor entiteiten)

Entiteiten krijgen een extra `{Type}Full` schema dat de entiteit inclusief al haar onderliggende gegevenselementen en relaties beschrijft (genest).

### Plumbing-schemas

| Schema | Beschrijving |
|--------|--------------|
| `Registratie` | Een registratie met tijdstip en lijst wijzigingen |
| `RegistratieFull` | Registratie met wijzigingen inclusief representaties |
| `Wijziging` | Een wijziging binnen een registratie |
| `RegistreerRequest` | Request-body voor `POST /registreer` |
| `WijzigingRequest` | Wijziging in een registreerverzoek |
| `RepresentatiePlusNaam` | Representatie met veldnaam (oneOf alle typenamen) |
| `RegistratieResponse` | Response van het registratie-endpoint |
