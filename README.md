# Bitemporal_2026

Verzamelrepository voor een **bitemporeel register** in Go / PostgreSQL — van eerste experiment tot volwassen proof of concept.

> **De actieve ontwikkelversie is [`bitemp_register_v06/`](bitemp_register_v06/README.md).**
> Eerdere versies (v01 – v05) zijn archief; v05 kan als referentie dienen.

---

## Snelle navigatie (v06)

| Onderwerp | Link |
|-----------|------|
| **Hoofdoverzicht & setup** | [`bitemp_register_v06/README.md`](bitemp_register_v06/README.md) |
| **Devloop & self-rebuild** | [`bitemp_register_v06/docs/DEVLOOP.md`](bitemp_register_v06/docs/DEVLOOP.md) |
| **Codegen (multi-domein)** | [`bitemp_register_v06/docs/CODEGEN.md`](bitemp_register_v06/docs/CODEGEN.md) |
| **OpenAPI 3.1** | [`bitemp_register_v06/docs/OPENAPI.md`](bitemp_register_v06/docs/OPENAPI.md) |
| **GraphQL (dynamisch)** | [`bitemp_register_v06/GRAPHQL.md`](bitemp_register_v06/GRAPHQL.md) |
| **Hub + _Data patroon** | [`bitemp_register_v06/ONTWERP_DATA_PATTERN.md`](bitemp_register_v06/ONTWERP_DATA_PATTERN.md) |
| **Docker handleiding** | [`bitemp_register_v06/docker.md`](bitemp_register_v06/docker.md) |
| **3D Data Universum** | [`bitemp_register_v06/docs/3D_UNIVERSUM.md`](bitemp_register_v06/docs/3D_UNIVERSUM.md) |
| **UML-Editor** | [`bitemp_register_v06/uml-editor/README.md`](bitemp_register_v06/uml-editor/README.md) |
| **Backlog** | [`bitemp_register_v06/docs/BACKLOG.md`](bitemp_register_v06/docs/BACKLOG.md) |
| **Release notes** | [`bitemp_register_v06/RELEASE.md`](bitemp_register_v06/RELEASE.md) |

### Interactieve documentatie (draaiende API op poort 8082)

| Pagina | URL |
|--------|-----|
| Swagger UI | `http://localhost:8082/swagger` |
| ReDoc | `http://localhost:8082/redoc` |
| GraphiQL | `http://localhost:8082/graphql` |
| Viz index | `http://localhost:8082/viz/react/` |
| 3D Universum | `http://localhost:8082/viz/react/universum.html` |

---

## Wat is bitemporeel?

Een bitemporeel register werkt met **twee tijdsdimensies**:

- **Formele tijd** (registratietijd) — wanneer is iets geregistreerd?
- **Materiële tijd** (geldigheidstijd) — wanneer geldt iets in de werkelijkheid?

Met deze twee assen kun je **tijdreizen**: de stand van het register opvragen zoals die op een bepaald moment geregistreerd was, óf zoals die op een bepaalde datum geldig was. Zie de [uitgebreide uitleg in de copilot-instructions](.github/copilot-instructions.md).

---

## Overzicht mappen

### Actieve versie

| Map | Beschrijving |
|-----|--------------|
| [`bitemp_register_v06/`](bitemp_register_v06/) | **Actieve ontwikkelversie** — Go + Gin + Bun, MetaRegistry, codegen, GraphQL, React frontend, UML-editor, 3D visualisatie |

### Archief (v01 – v05)

| Map | Beschrijving |
|-----|--------------|
| [`bitemporal_go_API_v05/`](bitemporal_go_API_v05/) | Referentieversie (laatste pre-v06 iteratie) |
| [`bitemporal_go_API_v04/`](bitemporal_go_API_v04/) | GraphQL + Docker introducie |
| [`bitemporal_go_API_v03/`](bitemporal_go_API_v03/) | Materiële tijd, schema-API |
| [`bitemporal_go_API_v02/`](bitemporal_go_API_v02/) | Formeel tijdreizen |
| [`bitemporal_go_API_v01/`](bitemporal_go_API_v01/) | Eerste Go-implementatie |

### SQL (referentie)

| Map | Beschrijving |
|-----|--------------|
| [`Bitemp2026-PG/`](Bitemp2026-PG/) | PostgreSQL DDL, views en queries voor het HR-model |
| [`HRv4-SQLLite/`](HRv4-SQLLite/) | SQLite-variant van het HR-model |

### Overig

| Map | Beschrijving |
|-----|--------------|
| [`Source_material/`](Source_material/) | Bronmateriaal en referentiedocumenten |
