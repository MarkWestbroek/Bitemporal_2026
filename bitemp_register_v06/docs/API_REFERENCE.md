# v06 API Reference — Complete Endpoint Documentation

> Auto-generated from source analysis of `bitemp_register_v06/`.  
> All routes registered in `main.go`, `routes/addroutes.go`, and `routes/addroutes_helper.go`.

---

## Table of Contents

1. [Root & Static](#1-root--static)
2. [Documentation Endpoints](#2-documentation-endpoints)
3. [Test CRUD Endpoints](#3-test-crud-endpoints)
4. [MetaRegistry-driven Entity Endpoints (flat)](#4-metaregistry-driven-entity-endpoints-flat)
5. [MetaRegistry-driven Full Entity Endpoints (nested)](#5-metaregistry-driven-full-entity-endpoints-nested)
6. [Referentielijst Endpoints](#6-referentielijst-endpoints)
7. [Registratie & Wijziging Endpoints](#7-registratie--wijziging-endpoints)
8. [Bitemporele Registratie Endpoint](#8-bitemporele-registratie-endpoint)
9. [Schema Model Endpoints](#9-schema-model-endpoints)
10. [Viz / Frontend API Endpoints](#10-viz--frontend-api-endpoints)
11. [GraphQL Endpoints](#11-graphql-endpoints)
12. [Admin Endpoints](#12-admin-endpoints)
13. [Version Endpoint](#13-version-endpoint)
14. [Query Parameter Reference](#14-query-parameter-reference)

---

## 1. Root & Static

### `GET /`
- **Handler**: `handlers.HomePage` (`tasks_handler.go`)
- **Description**: Serves `./web/root_index.html` if it exists, otherwise returns a JSON welcome document with navigation links.
- **Query params**: none
- **URL params**: none

### `GET /viz/*` (static)
- **Source**: `router.Static("/viz", "./web")` in `main.go`
- **Description**: Serves all static files from `./web/` (React frontend, coverage reports, etc.)
- **Query params**: none
- **URL params**: filesystem path

---

## 2. Documentation Endpoints

### `GET /docs`
- **Handler**: `handlers.DocsIndex` (`docs_handler.go`)
- **Description**: Returns an HTML index page listing all `.md` files found under the project root.
- **Query params**: none
- **URL params**: none

### `GET /docs/*filepath`
- **Handler**: `handlers.DocsPage` (`docs_handler.go`)
- **Description**: Renders a specific Markdown file as HTML. Only `.md` files are supported. Path traversal (`../`) is rejected.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `*filepath` | string | Relative path to the `.md` file within the project root |
- **Query params**: none

---

## 3. Test CRUD Endpoints

Legacy test/demo entity for basic CRUD validation.

### `GET /tests`
- **Handler**: `handlers.GetTests` (`tests_handler.go`)
- **Description**: Returns all test records.
- **Query params**: none
- **URL params**: none

### `GET /tests/:id`
- **Handler**: `handlers.GetTest` (`tests_handler.go`)
- **Description**: Returns a single test record by ID.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:id` | string | Test record ID |

### `POST /tests`
- **Handler**: `handlers.AddTest` (`tests_handler.go`)
- **Description**: Creates a new test record. Body: JSON `Test` object.
- **Query params**: none

### `PUT /tests/:id`
- **Handler**: `handlers.UpdateTest` (`tests_handler.go`)
- **Description**: Updates the `name` field of an existing test record.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:id` | string | Test record ID |

### `DELETE /tests/:id`
- **Handler**: `handlers.RemoveTest` (`tests_handler.go`)
- **Description**: Deletes a test record by ID.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:id` | string | Test record ID |

---

## 4. MetaRegistry-driven Entity Endpoints (flat)

Dynamically generated for **every type in the MetaRegistry** that has a `DBFactory`, a `Padnaam`, and is **not** a `referentielijst` subtype.

> Registered in `routes/addroutes_helper.go` → `addMetaRegistryRoutes()`.

For each type with padnaam `{pad}`:

### `GET /{pad}`
- **Handler**: `handlers.MakeGetEntitiesByMetaHandler(meta)` (`core_handlers.go`)
- **Description**: Returns a paginated list of entities of this type.
- **Query params**:
  | Param | Type | Default | Description |
  |-------|------|---------|-------------|
  | `page` | int | `1` | Page number (1-based, must be > 0) |
  | `size` | int | `20` | Page size (max 100) |
- **Response**: `{ "{pad}": [...], "page": N, "size": N, "has_more": bool }`

### `GET /{pad}/:id`
- **Handler**: `handlers.MakeGetEntityByMetaHandler(meta)` (`core_handlers.go`)
- **Description**: Returns a single entity by its `IDKolom`.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:id` | string/int | Entity primary key |
- **Query params**: none

### `POST /{pad}`
- **Handler**: `handlers.MakeAddEntityByMetaHandler(meta)` (`core_handlers.go`)
- **Description**: Inserts a new entity. Body: JSON matching the type's struct fields.
- **Query params**: none

---

## 5. MetaRegistry-driven Full Entity Endpoints (nested)

Dynamically generated for **every entiteit-type** in the MetaRegistry (metatype = `entiteit`, has `Factory`, `SliceFactory`, `Padnaam`, not a `referentielijst`).

> Registered in `routes/addroutes_helper.go` → `addMetaRegistryFullRoutes()`.

For each entiteit with padnaam `{pad}`:

### `GET /full/{pad}`
- **Handler**: `handlers.MakeGetFullEntitiesByMetaHandler(meta)` (`full_handlers.go`)
- **Description**: Returns a paginated list of full (nested) entities, including all onderliggende GE's/relaties via Bun relations. Supports **formeel tijdreizen** (peiltijdstip). Zonder peiltijdstip worden alle records geretourneerd (inclusief afgevoerde), zie [Gedrag zonder peiltijdstip](#gedrag-zonder-peiltijdstip).
- **Query params**:
  | Param | Type | Default | Description |
  |-------|------|---------|-------------|
  | `page` | int | `1` | Page number (1-based) |
  | `size` | int | `20` | Page size (max 100) |
  | `peiltijdstip` | string (RFC3339Nano) | — | Formeel peiltijdstip; filters on formele tijd |
  | `t` | int | — | Shorthand: generates peiltijdstip as `2026-01-01T00:00:00Z + t hours + t µs`. Ignored if `peiltijdstip` is set |
  | `toonafvoer` | `"1"` | — | Alleen relevant bij peiltijdstip. Standaard worden `afvoer`-keys gestript bij peiltijdstip. Met `toonafvoer=1` blijven ze zichtbaar. Zonder peiltijdstip worden `afvoer`-keys altijd meegestuurd. |

### `GET /full/{pad}/:id`
- **Handler**: `handlers.MakeGetFullEntityByMetaHandler(meta)` (`full_handlers.go`)
- **Description**: Returns a single full (nested) entity by ID, with all children loaded. Supports formeel tijdreizen. Zonder peiltijdstip worden alle records geretourneerd (inclusief afgevoerde), zie [Gedrag zonder peiltijdstip](#gedrag-zonder-peiltijdstip).
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:id` | string/int | Entity primary key |
- **Query params**:
  | Param | Type | Default | Description |
  |-------|------|---------|-------------|
  | `peiltijdstip` | string (RFC3339Nano) | — | Formeel peiltijdstip |
  | `t` | int | — | Shorthand peiltijdstip |
  | `toonafvoer` | `"1"` | — | Houd `afvoer`-keys in response bij peiltijdstip |

### `POST /full/{pad}`
- **Handler**: `handlers.MakeAddFullEntityByMetaHandler(meta)` (`full_handlers.go`)
- **Description**: Inserts a full entity with child relations in one request. Sets FK values on children automatically via bun relation tags.
- **Query params**: none

---

## 6. Referentielijst Endpoints

> Registered in `routes/addroutes_helper.go` → `addReferentielijstRoutes()`.

### `GET /referentielijsten`
- **Handler**: `handlers.MakeGetEntitiesHandler[model.Referentielijst]("Referentielijsten")` (`core_handlers.go`)
- **Description**: Returns all referentielijst system records (overview of registered reference lists).
- **Query params**:
  | Param | Type | Default | Description |
  |-------|------|---------|-------------|
  | `page` | int | `1` | Page number |
  | `size` | int | `20` | Page size (max 100) |

For each referentielijst-entiteit with padnaam `{pad}`:

### `GET /referentielijsten/{pad}`
- **Handler**: `handlers.MakeGetEntitiesByMetaHandler(meta)` (`core_handlers.go`)
- **Description**: Paginated list of items in this referentielijst.
- **Query params**: `page`, `size` (same as §4)

### `GET /referentielijsten/{pad}/:id`
- **Handler**: `handlers.MakeGetEntityByMetaHandler(meta)` (`core_handlers.go`)
- **URL params**: `:id`

### `POST /referentielijsten/{pad}`
- **Handler**: `handlers.MakeAddEntityByMetaHandler(meta)` (`core_handlers.go`)

### `GET /full/referentielijsten/{pad}`
- **Handler**: `handlers.MakeGetFullEntitiesByMetaHandler(meta)` (`full_handlers.go`)
- **Description**: Full nested referentielijst entity listing.
- **Query params**: `page`, `size`, `peiltijdstip`, `t`, `toonafvoer` (same as §5)

### `GET /full/referentielijsten/{pad}/:id`
- **Handler**: `handlers.MakeGetFullEntityByMetaHandler(meta)` (`full_handlers.go`)
- **URL params**: `:id`
- **Query params**: `peiltijdstip`, `t`, `toonafvoer`

### `POST /full/referentielijsten/{pad}`
- **Handler**: `handlers.MakeAddFullEntityByMetaHandler(meta)` (`full_handlers.go`)

---

## 7. Registratie & Wijziging Endpoints

### `GET /registraties`
- **Handler**: `handlers.MakeGetEntitiesHandler[model.Registratie]("Registraties")` (`core_handlers.go`)
- **Description**: Paginated list of registratie records (flat, without wijzigingen).
- **Query params**: `page`, `size`

### `GET /registraties/:id`
- **Handler**: `handlers.MakeGetEntityHandler[model.Registratie]("Registratie")` (`core_handlers.go`)
- **URL params**: `:id` (registratie ID, int)

### `POST /registraties`
- **Handler**: `handlers.MakeAddEntityHandler[model.Registratie]("Registratie")` (`core_handlers.go`)
- **Description**: Inserts a flat registratie record (low-level; prefer `/registratie/` for proper bitemporal registration).

### `PATCH /registraties/:id`
- **Handler**: `handlers.PatchRegistratie()` (`registration_patch_handler.go`)
- **Description**: Updates mutable metadata fields on an existing registratie. Currently only `opmerking` is supported.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:id` | string (int) | Registratie ID |
- **Body**: `{ "opmerking": "string or null" }`
- **Query params**: none

### `GET /wijzigingen`
- **Handler**: `handlers.MakeGetEntitiesHandler[model.Wijziging]("Wijzigingen")` (`core_handlers.go`)
- **Description**: Paginated list of wijziging records (flat).
- **Query params**: `page`, `size`

### `GET /wijzigingen/:id`
- **Handler**: `handlers.MakeGetEntityHandler[model.Wijziging]("Wijziging")` (`core_handlers.go`)
- **URL params**: `:id`

### `POST /wijzigingen`
- **Handler**: `handlers.MakeAddEntityHandler[model.Wijziging]("Wijziging")` (`core_handlers.go`)

### `GET /full/registraties`
- **Handler**: `handlers.MakeGetRegistratiesMetWijzigingenHandler()` (`full_handlers.go`)
- **Description**: Paginated list of registraties with nested wijzigingen. Supports formeel tijdreizen and registratie-type filtering. Response includes `full_entiteit_links` with hrefs to the affected full entities.
- **Query params**:
  | Param | Type | Default | Description |
  |-------|------|---------|-------------|
  | `page` | int | `1` | Page number |
  | `size` | int | `20` | Page size (max 100) |
  | `peiltijdstip` | string (RFC3339Nano) | — | Formeel peiltijdstip; filters registraties and wijzigingen with `tijdstip <=` |
  | `t` | int | — | Shorthand peiltijdstip (same formula) |
  | `ta` | int | — | Interval start (inclusive). Converted via `tijdstipUitT(ta)`. Filters `tijdstip >= ta` |
  | `tb` | int | — | Interval end (inclusive). Converted via `tijdstipUitT(tb)`. Filters `tijdstip <= tb` |
  | `type` | string (multi/CSV) | — | Filter on registratietype. Values: `registratie`, `correctie`, `ongedaanmaking`. Supports `c.QueryArray("type")` and comma-separated within one value. Multiple values allowed. |

### `GET /full/registraties/:id`
- **Handler**: `handlers.MakeGetRegistratieMetWijzigingenByIDHandler()` (`full_handlers.go`)
- **Description**: Returns a single registratie with nested wijzigingen by ID. Includes `full_entiteit_links`.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:id` | string (int) | Registratie ID |
- **Query params**: none

---

## 8. Bitemporele Registratie Endpoint

### `POST /registratie/`
- **Handler**: `handlers.RegistreerMetNieuweAanpak()` (`registration_handlers.go`)
- **Description**: **Main bitemporal registration endpoint**. Processes opvoer (create), afvoer (retire), correctie (correction), and ongedaanmaking (undo) of representaties within a single transactional registratie. Handles automatic relative autoincrement IDs, wijziging records, and audit trail. The registratie tijdstip is currently auto-derived from the registratie ID.
- **Query params**: none
- **URL params**: none
- **Body**: `RegistreerRequest` JSON containing:
  - `registratie`: Registratie metadata (registratietype, opmerking, corrigeertRegistratieID, maaktOngedaanRegistratieID)
  - `wijzigingen[]`: Array of wijziging objects, each with `opvoer` and/or `afvoer` maps keyed by entiteit type

---

## 9. Schema Model Endpoints

### `GET /api/schema/model`
- **Handler**: `handlers.MaakGetSchemaModelHandler()` (`schema_model_handler.go`)
- **Description**: Returns the active register model in v3 format. If an active version exists in `schema_versies` DB table, that's returned. Otherwise falls back to on-the-fly export from MetaRegistry code.
- **Query params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `domein` | string | Optional. Filters the fallback code-export by model domain (e.g. `"np-loc"`). Only used when no active DB version exists. |
  | `strict` | bool | Optional. Only relevant together with `domein` and only in fallback mode. If true, excludes register base entiteiten from the fallback export. |

### `GET /api/schema/model/code`
- **Handler**: `handlers.MaakGetSchemaModelCodeHandler()` (`schema_model_handler.go`)
- **Description**: Always returns the current code-state of the model (from MetaRegistry), regardless of any database versions.
- **Query params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `domein` | string | Optional. Filter export by domain. Filtering is recursive from root entiteiten (`Domein == <waarde>` plus `register`) and includes all reachable onderliggende types, even when those child types have no explicit `Domein` value. |
  | `strict` | bool | Optional. Only relevant together with `domein`. If true, uses strict domain filtering: no register-root entiteiten in `model.entiteiten` and no register-root types in `types`. |

### `GET /api/schema/model/:id`
- **Handler**: `handlers.MaakGetSchemaModelVersieHandler()` (`schema_model_handler.go`)
- **Description**: Returns a specific schema version by database ID. No fallback.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:id` | string (int) | Schema version ID |
- **Query params**: none

### `POST /api/schema/model`
- **Handler**: `handlers.MaakPostSchemaModelHandler()` (`schema_model_handler.go`)
- **Description**: Submits a new v3 model as a `proposed` schema version. Accepts either a bare `V3Model` or a `{ "bron": "...", "indiener": "...", "model": {...} }` wrapper.
- **Query params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `build_versie` | string | Optional build version tag |
  | `go_module` | string | Optional Go module path |
  | `opmerking` | string | Optional remark |
- **Body**: V3Model JSON (see model definition)

### `PUT /api/schema/model/:id/activeer`
- **Handler**: `handlers.MaakActiveerSchemaVersieHandler()` (`schema_model_handler.go`)
- **Description**: Activates a `proposed` schema version. Archives the current active version and transitions the specified version to `active`.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:id` | string (int) | Schema version ID (must have status `proposed`) |
- **Query params**: none

### `GET /api/schema/versies`
- **Handler**: `handlers.MaakLijstSchemaVersiesHandler()` (`schema_model_handler.go`)
- **Description**: Returns all schema versions (metadata only, no full model JSON).
- **Query params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `model_naam` | string | Optional. Case-insensitive ILIKE filter on `model_naam` |
  | `sort` | string | Sort order. Values: `id_desc` (default), `id_asc`, `model_naam_asc`, `model_naam_desc` |

---

## 10. Viz / Frontend API Endpoints

### `GET /api/viz/schema`
- **Handler**: `handlers.MaakVizSchemaHandler()` (`viz_schema_handler.go`)
- **Description**: Returns the full type registry for the frontend: all MetaRegistry types with their fields, children, metatype, kleur, tabelnaam, etc. Domain-agnostic (returns all types).
- **Query params**: none
- **Response**: `{ "versie": "v1", "types": [...] }`

### `GET /api/viz/entiteit/:typenaam/max-id`
- **Handler**: `handlers.MaakVizEntiteitMaxIDHandler()` (`viz_entiteit_max_id_handler.go`)
- **Description**: Returns the current maximum ID and suggested next ID for an entity type. Used by the frontend to pre-fill new entity IDs.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:typenaam` | string | MetaRegistry type name (must be metatype `entiteit`) |
- **Query params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `atLeast` | int | Optional. If provided and greater than the natural `nextID`, uses this value as `nextID` |
- **Response**: `{ "typenaam": "...", "idKolom": "...", "maxId": N, "nextId": N }`

### `GET /api/viz/relatie/:typenaam/secondaire-ids`
- **Handler**: `handlers.MaakVizRelatieSecondaireIDsHandler()` (`viz_relatie_secondaire_ids_handler.go`)
- **Description**: Returns a list of available (non-retired) secondary entity IDs for a relation type. Used by the frontend to populate dropdown options.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:typenaam` | string | MetaRegistry type name (must be metatype `relatie`) |
- **Query params**:
  | Param | Type | Default | Description |
  |-------|------|---------|-------------|
  | `limit` | int | `200` | Max number of IDs to return (max 2000) |
- **Response**: `{ "typenaam": "...", "secondaireEntiteitType": "...", "secondaireEntiteitIDKolom": "...", "ids": [...] }`

---

## 11. GraphQL Endpoints

### `GET /graphql/playground`
- **Handler**: `handlers.PlaygroundHandler()` (`graphql_handler.go`)
- **Description**: Serves the GraphQL Playground UI (interactive query explorer).
- **Query params**: none

### `POST /graphql/query`
- **Handler**: `handlers.GraphQLHandler()` (`graphql_handler.go`)
- **Description**: GraphQL query execution endpoint (POST). Body: standard GraphQL JSON (`query`, `variables`, `operationName`).
- **Query params**: none

### `GET /graphql/query`
- **Handler**: `handlers.GraphQLHandler()` (`graphql_handler.go`)
- **Description**: GraphQL query execution endpoint (GET). Supports query via URL parameters (standard GraphQL-over-GET).
- **Query params**: standard GraphQL GET params

---

## 12. Admin Endpoints

### `DELETE /admin/db/droptables/:password`
- **Handler**: `handlers.DropTables` (`admin_handler.go`)
- **Description**: Drops all database tables. Requires `ALLOW_DROP_TABLES=true` environment variable and correct password.
- **URL params**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `:password` | string | Admin password. Defaults to `"1234"`, overridden by env `ADMIN_DROP_PASSWORD` |
- **Query params**: none
- **Security**: Guarded by env `ALLOW_DROP_TABLES` and password check.

### `POST /admin/db/createtables`
- **Handler**: `handlers.CreateTables` (`admin_handler.go`)
- **Description**: Creates database tables (idempotent — skips existing tables).
- **Query params**: none
- **URL params**: none

---

## 13. Version Endpoint

### `GET /version`
- **Handler**: inline lambda in `main.go`
- **Description**: Returns build metadata.
- **Query params**: none
- **Response**: `{ "commit": "...", "build_time": "..." }`

---

## 14. Query Parameter Reference

Consolidated lookup of all query parameters used across the API.

| Parameter | Type | Used In | Description |
|-----------|------|---------|-------------|
| `page` | int (≥1) | `GET /{pad}`, `GET /full/{pad}`, `GET /registraties`, `GET /full/registraties`, `GET /referentielijsten/*` | Page number for pagination (default: 1) |
| `size` | int (1–100) | Same as `page` | Page size (default: 20, max: 100) |
| `peiltijdstip` | string (RFC3339Nano) | `GET /full/{pad}`, `GET /full/{pad}/:id`, `GET /full/registraties` | Formeel peiltijdstip for time-travel queries. Filters to state at this moment. |
| `t` | int | Same as `peiltijdstip` | Shorthand: `2026-01-01T00:00:00Z + t*hour + t*µs`. Ignored when `peiltijdstip` is set. |
| `ta` | int | `GET /full/registraties` | Registratie interval start (inclusive). Same time formula as `t`. |
| `tb` | int | `GET /full/registraties` | Registratie interval end (inclusive). Must be ≥ `ta`. |
| `type` | string (multi) | `GET /full/registraties` | Filter registratietype: `registratie`, `correctie`, `ongedaanmaking`. Supports `QueryArray` and comma-separated. |
| `toonafvoer` | `"1"` | `GET /full/{pad}`, `GET /full/{pad}/:id` | When `"1"` **and** peiltijdstip is set, keeps `afvoer` keys in response. Zonder peiltijdstip worden `afvoer`-keys altijd meegestuurd. Zie [Gedrag zonder peiltijdstip](#gedrag-zonder-peiltijdstip). |
| `domein` | string | `GET /api/schema/model`, `GET /api/schema/model/code` | Filter schema export by model domain (e.g. `"np-loc"`). |
| `model_naam` | string | `GET /api/schema/versies` | Case-insensitive ILIKE filter on schema version model name. |
| `sort` | string | `GET /api/schema/versies` | Sort order: `id_desc` (default), `id_asc`, `model_naam_asc`, `model_naam_desc`. |
| `build_versie` | string | `POST /api/schema/model` | Optional build version metadata for submitted schema. |
| `go_module` | string | `POST /api/schema/model` | Optional Go module path metadata. |
| `opmerking` | string | `POST /api/schema/model` | Optional remark for submitted schema version. |
| `atLeast` | int | `GET /api/viz/entiteit/:typenaam/max-id` | Minimum `nextId` value; if natural next is lower, uses this. |
| `limit` | int (1–2000) | `GET /api/viz/relatie/:typenaam/secondaire-ids` | Max IDs to return (default: 200). |

### URL Parameters Reference

| Parameter | Type | Used In | Description |
|-----------|------|---------|-------------|
| `:id` | string/int | Most `GET /:id`, `PATCH`, `DELETE` routes | Primary key of the resource |
| `:typenaam` | string | `/api/viz/entiteit/:typenaam/*`, `/api/viz/relatie/:typenaam/*` | MetaRegistry type name |
| `:password` | string | `DELETE /admin/db/droptables/:password` | Admin password for destructive operation |
| `*filepath` | string | `GET /docs/*filepath` | Relative path to markdown file |

---

## Middleware

Registered in `routes/addroutes.go` → `SetupMiddleware()`:

1. **CORS middleware** — Allows origins: `localhost:5173/5174/5175`, `127.0.0.1:5173/5174/5175`, `test1.pleio.local:8000`. Handles preflight `OPTIONS` requests with 204.
2. **Request body logger** — Logs POST/PUT/PATCH bodies when `APP_DEBUG_LOGS=1`.
3. **Preflight handler** — `OPTIONS /*path` catch-all to let CORS middleware handle all routes.

## Environment Variables (affecting handlers)

| Variable | Default | Used By |
|----------|---------|---------|
| `ALLOW_DROP_TABLES` | `"false"` | `DropTables` handler |
| `ADMIN_DROP_PASSWORD` | `"1234"` | `DropTables` handler |
| `APP_DEBUG_LOGS` | `""` | Request body logger, debug prints |
| `SCHEMA_CODE_MODEL_NAAM` | `""` | Schema code export metadata |
| `SCHEMA_CODE_MODEL_BESCHRIJVING` | `""` | Schema code export metadata |
| `SCHEMA_CODE_MODEL_VERSIE` | `""` | Schema code export metadata |
| `SCHEMA_CODE_BUILD_VERSIE` | `""` | Schema code export metadata |
| `SCHEMA_CODE_GO_MODULE` | `""` | Schema code export metadata |
| `SCHEMA_CODE_INDIENER` | `""` | Schema code export metadata |
| `SCHEMA_CODE_OPMERKING` | `""` | Schema code export metadata |

---

## Gedrag zonder peiltijdstip

De full-entity endpoints (`GET /full/{pad}`, `GET /full/{pad}/:id`) werken verschillend afhankelijk van of er een peiltijdstip meegegeven wordt:

### Met `peiltijdstip` (of `t`)

1. **Formeel tijdfilter** wordt toegepast op de entiteit én alle onderliggende GE's/relaties: alleen records waarvan de laatste niet-ongedaan-gemaakte wijziging op dat peilmoment een opvoer is, worden opgenomen.
2. **Afgeleide formele tijd** (`opvoer`/`afvoer`) wordt berekend per representatie.
3. **`afvoer`-keys** worden standaard gestript uit de JSON-response (tenzij `toonafvoer=1`).

### Zonder peiltijdstip (default)

1. **Geen formeel tijdfilter**: alle records komen terug, inclusief afgevoerde representaties.
2. **Geen afgeleide formele tijd**: `opvoer` en `afvoer` bevatten hun database-waarden (de afgeleide actuele waarden).
3. **`afvoer`-keys** blijven in de response (worden niet gestript).

> **Let op**: de huidige default toont dus ook afgevoerde records, met de actuele afgeleide `opvoer`/`afvoer`-waarden. Er is nog geen "actueel"-filter dat standaard alleen niet-afgevoerde representaties toont zonder expliciet peiltijdstip.

### Peilmoment-formule (`t`)

De `t`-parameter wordt omgezet naar een tijdstip via:

```
peiltijdstip = 2026-01-01T00:00:00Z + (t × uur) + (t × microseconde)
```

Dit maakt het mogelijk om met de synthetische replay-data een deterministische formele tijdas te gebruiken, waarbij `t=1` het eerste uur vertegenwoordigt, `t=2` het tweede, etc.

### Interval-filter (`ta`/`tb`)

Alleen beschikbaar op `GET /full/registraties`. Filtert registraties en wijzigingen op:
- `tijdstip >= tijdstipUitT(ta)` (indien `ta` gezet)
- `tijdstip <= tijdstipUitT(tb)` (indien `tb` gezet)

Beide moeten integers zijn. `ta` moet ≤ `tb` zijn als beide gezet zijn.
