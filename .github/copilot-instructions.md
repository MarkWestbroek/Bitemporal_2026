# Copilot Instructions — Bitemporeel Register v06

De actieve versie is `bitemp_register_v06/`. Eerdere versies (v01–v05) zijn archief; v05 dient als referentie.

## Algemene instructies
Documenteer altijd alle wijzigingen in duidelijke comments in de code en in (vaak specifiek per onderwerp benoemde of anders de generieke readme) markdown files.

Als je iets **substantieels** hebt gewijzigd of onderzocht, werk dan in dezelfde taak ook de **relevante documentatie** bij (bij voorkeur de meest specifieke `.md`, bijvoorbeeld `docs/DEVLOOP.md`, `docs/CODEGEN.md`, `docs/BACKLOG.md`, anders de algemene `README.md`).

## Domein

Dit project is een proof of concept voor een **bitemporeel register** in *Go* / *PostgreSQL*, met een focus op een flexibel datamodel via een aantal struct definities en dynamische metadata via een MetaRegistry.

**Bitemporeel** betekent dat we standaard werken met twee tijdsdimensies:

- **Formele tijd** (registratietijd): wanneer is iets geregistreerd? Velden: `opvoer`, `afvoer`, `registratie.tijdstip`.
- **Materiële tijd** (geldigheidstijd): wanneer geldt iets in de werkelijkheid? Velden: `aanvang` (datum), `einde` (datum).

Daarvoor bestaan er vele implementaties in de wereld, maar deze heeft een specfieke opbouw waarbij we bewust alle formele tijdstippen *niet* in de tabellen opnemen, maar in een aparte *wijzingen*-tabel, die altijd onderdeel is van een *registratie*.

Eén registratie kan meerdere wijzigingen bevatten, en elke wijziging kan meerdere representaties op- of afvoeren. Een registratie stelt het formele vastleggen van een set aan gegevens voor, dat typisch in een register wordt gedaan, op basis van een beslissing van een medewerker of proces. Het tijdstip waarop deze beslissing tot registratie is genomen, is het - formele - tijdstip van de registratie, en daarmee van alle wijzigingen en representaties die onderdeel zijn van die registratie.

Het interessante aan deze werkwijze is, dat we daarmee zelfs over verschillende registers (mits die dezelfde architectuur hebben) gegevenssets kunnen registeren, en over meerdere registers heen zouden kunnen tijdsreizen (zie hierna voor een uitgebreide uitleg). Dit tijdreizen is uiterst belangrijk om foutloos en naadloos de audit-trail van een gegeven te kunnen waarnemen.

#### Betekenis van de afgeleide opvoer en afvoer in de records
Het representatie-record zelf bevat wel een `opvoer` en `afvoer` veld, maar de betekenis daarvan is de afgeleide waarde van opvoer en afvoer van dat record, als we alle wijzigingen daarop tot en met het heden verwerkt hebben. Oftewel: de weergave van de actuele (formele) situatie van het gegeven.

### Tijdreizen
#### Formeel tijdreizen
Formeel tijdreizen is het ophalen van de toestand van (een subset van) het register op een bepaald formeel tijdstip t~f~. We kunnen op de formele tijdsas alleen tijdreizen naar het verleden. We kunnen immers niet in de toekomst registeren.

De API ondersteunt dit via query parameters `?t=2024-01-01T12:00:00Z` (ISO 8601-formaat).

#### Materieel tijdreizen
Materieel tijdreizen is het ophalen van de toestand van (een subset van) het register op een bepaald materieel tijdstip t~m~. We kunnen op de materiële tijdsas zowel naar het verleden als naar de toekomst tijdreizen, omdat we ook toekomstige aanvangs- en eindrecords kunnen registeren. (Bijvoorbeeld: een voorgenomen verhuizing van een persoon, die we al willen registeren maar waarvan de aanvangsdatum in de toekomst ligt.)

## Architectuur

### Hub + _Data patroon (v06-specifiek)

In v06 is het **Hub + _Data** patroon geïntroduceerd, een wezenlijk verschil met v05:

- **Hub**: stabiel associatief anker (compositie-relatie naar entiteit), bevat alleen structurele FK's + afgeleide `opvoer`/`afvoer`.
- **_Data**: geversioned content-record, PK: `(ent_id, rel_id, versie)`. Correcties en inhoudelijke wijzigingen leven in _Data.
- **_Aanvang / _Einde**: materiële plumbing op hub-niveau (niet op _Data). Alleen voor types met `IsMaterieel: true`.

Alle `opvoer`/`afvoer` waarden zijn **afgeleid** uit wijzigingen + registratie; ze worden nooit direct opgeslagen.

Zie `ONTWERP_DATA_PATTERN.md` voor het volledige ontwerp.

### Representatietypes

Elk type in het model is een **representatie** met een van drie metatypes:

| Metatype            | Voorbeelden                                | Kenmerken                                  |
|---------------------|--------------------------------------------|--------------------------------------------|
| `entiteit`          | A, B, NatuurlijkPersoon, Locatie           | Heeft `ID`, bevat onderliggende GE's/relaties |
| `gegevenselement`   | A_U, A_V, NP_Naam, NP_Naam_Data           | FK naar entiteit, relatieve `rel_id`, optioneel Hub+_Data |
| `relatie`           | Rel_A_B, NP_Nationaliteit                  | FK naar twee entiteiten, relatieve `rel_id` |

Elke representatie heeft `opvoer`/`afvoer` (formele tijd, afgeleid).

Alle representaties zijn structs in Go, met JSON-tags voor API-serialisatie en Bun-tags voor DB-mapping. Ze implementeren interfaces (`Representatie`, `FormeleRepresentatie`, `MaterieleRepresentatie`) die methoden definiëren voor ID, metatype, tijdvelden, etc.

Alle representaties implementeren ook `GetID()`, `Metatype()`, `ClearID()`, `GetOpvoer()`, `SetOpvoer()`, `GetAfvoer()`, `SetAfvoer()` methoden, zodat ze generiek kunnen worden behandeld in handlers en de MetaRegistry.

#### Velden
Velden in representaties zijn getypeerd volgens de beschikbare types in Go (string, int, time.Time, etc.). Er zijn 4 werelden van types:
- **Go**: de Go-types (incl. custom datatypes als `Datum`, `BSN`, `NLPostcode`, `Emailadres`, etc. uit `datatype_aliases.go`)
- **JSON**: OAS 3.1 systeem met `type` en `format` in de JSON-schema's van de schema-API. Bepaald op basis van Go-type of expliciet via de `schema` tag.
- **DB**: Bun-tags voor mapping van Go-types naar DB-kolommen
- **GraphQL**: dynamisch gemapt vanuit Go-types via `graphql-go/graphql` (zie GraphQL sectie)

##### Gebruik velden in de FrontEnd
In de frontend gebruiken we de JSON-veldnaam (snake_case) om data te binden in formulieren en weergaven. Veldtype en format uit de schema-API bepalen het type invoerveld (datepicker, text input, etc.).

#### Entiteiten
Entiteiten hebben een eigen ID en kunnen onderliggende gegevenselementen en relaties bevatten. Ze implementeren een `GeefOnderliggendeGegevenselementen()` methode die retourneert:
- **Rolnaam**: Go-veldnaam
- **JSON-rolnaam**: JSON-veldnaam
- **Doeltype**: het type-struct (bijv. A_U, Rel_A_B)
- **Momentvoorkomen**: enkelvoudig of meervoudig op een formeel tijdstip t

### Multi-domein architectuur (v06-specifiek)

Het model is opgedeeld in **domeinen**, elk met een eigen prefix en codegen-uitvoer:

| Domein          | Prefix           | Inhoud                                         |
|-----------------|------------------|-------------------------------------------------|
| Register        | `register_`      | Referentielijst, Land, AdellijkeTitel, etc.     |
| NL Personen/Loc | `np_loc_`        | NatuurlijkPersoon, Locatie, Bereikbaarheid      |
| ABUVWXY (ref)   | `abuvwxy_`       | A, B, GE's, Relaties (handmatig referentiemodel)|
| CG Portfolio    | `cg_`            | CG Portfolio domein                             |
| Configuratie    | `configuratie_`  | Configuratie/setup domein                       |

Elk domein genereert 7 bestanden: `{prefix}_modellen_entiteiten.go`, `{prefix}_modellen_ge_rel.go`, `{prefix}_modellen_methods.go`, `{prefix}_modellen_input.go`, `{prefix}_metaregistry.go`, `{prefix}_datatype_registry.go`, `{prefix}_enum_registry.go`.

Domeinen worden geïnitialiseerd via `initXxxMetaRegistry()` functies; de volgorde is belangrijk (afhankelijkheden eerst). Cross-domein relaties worden gelegd via `VoegOnderliggendGEToe()`.

### Relatieve autoincrement
Bij GE's en relaties wordt `rel_id` automatisch opgehoogd binnen de scope van de parent-entiteit en het type. Dit geldt ook voor `versie` bij _Data, _Aanvang en _Einde records.

### Materiële plumbing-types

Aanvang en einde worden gemodelleerd als **aparte enkelvoudige GE's** met eigen tabellen en versiegeschiedenis:

- `X_Aanvang`, `X_Einde` per materieel type
- PK: `(ent_id, versie)` — versie is autoincrement
- Leven op **hub-niveau** (niet op _Data), waardoor materiële tijd onafhankelijk van data gecorrigeerd kan worden
- Vorige versie wordt automatisch afgevoerd bij een nieuwe registratie

### MetaRegistry — de single source of truth

`model/metaregistry_plumbing.go` definieert de `TypeMeta`-struct en helpers; de daadwerkelijke entries worden per domein geïnitialiseerd in `{prefix}_metaregistry.go` bestanden.

De metaregistry is de **single source of truth** voor alle metadata over representatietypes. Alle handlers, routes, schema-API, GraphQL-laag, OpenAPI-generatie en frontend lezen dynamisch uit de metaregistry.

De metaregistry gaat over alle representatietypes (structs), niet over hun velden (die staan in de structs). De relatie-structuur is gedefinieerd via `OnderliggendeGegevenselementen` in entiteit-entries.

Elke entry beschrijft:

- **Typenaam**, **Description**, **Metatype**, **IsMaterieel**, **Domein**
- **Veldnaam** (JSON), **Padnaam** (URL), **Kleur** (visualisatie)
- **GESubtype** (`hub`, `data`, `aanvang`, `einde`), **DataTypenaam**, **BovenliggendTypenaam**
- **Factory/SliceFactory/DBFactory/DBSliceFactory** (constructors)
- **Tabelnaam**, **IDKolom**, **EntiteitIDKolom**, **HeeftPFK**, **RelatieveAutoincrement**
- **AfgeleideVelden** (lijst `AfgeleidVeld` met expressietaal + regel)
- **EditorLayout** (posities, kleuren, anker-info voor UML-editor)
- **ReferentielijstInstantieInfo** (voor referentielijst-items)
- **Directioneel** (voor relatie-types: directionele associatie)
- **OnderliggendeGegevenselementen**: `Rolnaam`, `JSONRolnaam`, `Doeltype`, `Momentvoorkomen`

### Afgeleide velden

Afgeleide velden bestaan op twee niveaus:
- **Veldniveau**: een veld binnen een GE/relatie waarvan de waarde wordt afgeleid uit andere velden (bijv. `weergavenaam` = `voornaam + " " + achternaam`).
- **Representatieniveau**: velden die over GE's heen worden samengesteld.

De expressietaal is primair **CEL** (Common Expression Language); ook `expr`, `jsonlogic` en `pseudo` worden ondersteund. In de UML-editor worden afgeleide velden getoond met oranje `/` prefix en cursieve stijl. Het veld `isWeergaveVeld` markeert velden die op visuele kaarten in de frontend worden getoond.

Zie `afgeleide-velden.md` voor het volledige ontwerp.

### Overerving (analyse)

Generalisatie/specialisatie is geanalyseerd met drie DB-strategieën: TPH, TPT, TPC. Aanbeveling is **TPT** (Table Per Type) omdat dat past bij het MetaRegistry-model: elk type is een eigen entry, subtypes hebben een impliciete parent-referentie.

Status: ontwerp gereed, nog niet geïmplementeerd. Zie `docs/overerving-analyse.md`.

#### Schema-API
De schema-API (`/api/schema/model`) retourneert de metadata van alle representatietypes in de MetaRegistry in **V3 JSON-formaat**, inclusief velden, onderliggende GE's/relaties, afgeleide velden, editor-layout en runtime-metadata (`V3Runtime`).

De frontend is volledig schema-gedreven: geen hardcoded veldnamen of structuren. Alles komt dynamisch uit de schema-API.

##### Velden
Velden in de schema-API worden beschreven met hun JSON-veldnaam, veldtype (OAS 3.1), format, enum-waarden en beschrijving (uit de `schema_desc` tag).

##### OnderliggendeGegevenselementen
Beschreven met rolnaam, JSON-rolnaam, doeltype en momentvoorkomen.

#### API Routes
Routes worden dynamisch geregistreerd in Gin op basis van `Padnaam` uit de MetaRegistry. Per type:
- `GET /{padnaam}?page=&size=` (lijst met paginering)
- `GET /{padnaam}/:id` (enkel record)
- `POST /{padnaam}` (insert)
- `GET /full/{padnaam}/:id` (entiteit met alle geneste GE's/relaties, met `?t=` voor formeel tijdreizen)

Registratie-endpoints:
- `POST /registreer` — opvoer/afvoer met audittrail
- `POST /corrigeer` — correctie van data
- `POST /maak_ongedaan` — ongedaanmaking van een registratie

### GraphQL (dynamisch, v06-specifiek)

De GraphQL-laag in `dynql/` is volledig dynamisch en wordt bij startup gebouwd vanuit de MetaRegistry. Geen codegeneratie, geen SDL-bestanden.

- **Technologie**: `graphql-go/graphql` v0.8.1 (programmatisch)
- **Queries**: `full_<padnaam>()`, `<padnaam>()`, `full_<padnaam>_list()` met `peiltijdstip`/`t`-parameter
- **Mutations**: `registreer()`, `corrigeer()`, `maak_ongedaan()`
- **Reverse relaties**: `gerelateerde_<bron-padnaam>` op doelentiteiten
- **Forward FK navigatie**: automatisch laden van secundaire entiteiten
- **Hub+Data flattening**: data-lagen worden server-side afgevlakt in GraphQL-responses
- **UI**: GraphiQL playground op `/graphql`

Zie `GRAPHQL.md` en `docs/dynamische-graphql-laag.md` voor de volledige documentatie.

### OpenAPI 3.1

Dynamisch gegenereerd vanuit de MetaRegistry, conform NL API Strategie (ADR 2.1.0).

- **Endpoints**: `/openapi.json`, `/openapi.yaml`, `/openapi/:domein`, `/swagger`, `/redoc`
- **CLI export**: `go run ./cmd/openapi-export` → `openapi/` directory (JSON + YAML per domein)

Zie `docs/OPENAPI.md`.

### Codegen (v06-specifiek)

De codegen-tool (`cmd/codegen/`) genereert Go-model-bestanden vanuit V3 JSON. De roundtrip is: **Code ↔ V3 JSON ↔ UML-Editor**.

- **Modi**: `standalone` (vervangt alles) vs. `additive` (init-functies voor multi-domein)
- **Input**: `--input` (bestand), `--from-url` (API-endpoint), `--domein`, `--prefix`
- **Output**: 7 bestanden per domein (zie Multi-domein sectie)
- **Validatie**: preflight-checks op V3-model (PascalCase types, geldig momentvoorkomen, bestaande doelEntiteit, etc.)
- **Shared**: `datatype_aliases.go` met merge-logica voor multi-domein

Zie `docs/CODEGEN.md`.

### Schema-diff en versioning

- **SchemaDiff** (`schemadiff/`): delta-berekening en migratiepad-suggesties tussen modelversies
- **SchemaVersie**: tabel die gepubliceerde modelversies bijhoudt
- **Diff endpoint**: `/api/schema/diff` voor vergelijking van schemas

### Devloop (v06-specifiek)

Self-rebuilding workflow (lokaal en Docker):

1. Editor → publiceer V3 JSON → API slaat model op
2. `POST /admin/rebuild/:password` triggert codegen + build
3. Bij exit code 42 herstart Docker de container automatisch
4. Fallback via `_baseline/model/` en `_pre_rebuild/model/` voor veiligheid

Zie `docs/DEVLOOP.md`.

#### Frontend
De frontend in `web/vite/` is volledig dynamisch en schema-gedreven. Pagina's:

- **Index**: entiteiten, GE's, relaties, registraties — met rijke visualisatie (weergavevelden, temporal metadata, relatienavigatie)
- **Tijdlijn**: registraties + formele/materiële snapshots
- **UML-Editor** (v2): visuele metamodel-editor met V3 JSON roundtrip (zie UML-Editor sectie)
- **3D Universum**: `react-force-graph-3d` + Three.js, 3 view-modes (Meta → Instances → Concreet), wormhole-navigatie, REST/GraphQL toggle, domeinfilter
- **Publicatie**: V3 JSON publiceren + devloop-rebuild triggeren

### UML-Editor (v06-specifiek)

De UML-editor (`uml-editor/`) is een React + React Flow editor voor het visuele metamodel:

- **V3 JSON ↔ Editor roundtrip**: importeer en exporteer V3 JSON
- **XMI import/export**: voor interoperabiliteit met Enterprise Architect e.d.
- **Nodetypen**: Entiteit, GE, Relatie, Referentielijst, AssociatieAnker
- **Edge-typen**: compositie (◆ diamond voor ENT→GE), associatie (ASOC-patroon voor relaties), dependency (`«use»` voor referentielijsten)
- **Associatieklasse (ASOC) weergave**: relaties worden getoond als `A──o──B` (solid line via ankernode) + dashed `o╌╌REL` (associatieklasse-link). Bij relaties zonder eigen velden klapt de REL in tot een naam-label.
- **Directioneel**: checkbox + open pijl op de edge
- **Afgeleide velden**: `/` prefix + italic, CEL-expressie weergave
- **Drag-drop, alignment, grid-snap, dependency visibility toggle**
- **Layout-persistentie**: posities, edge-metadata, hidden-status

### Autorisatie (ontwerp)

PBAC (Policy Based Access Control) met PxP-patroon (PIP/PAP/PDP/PEP), gebaseerd op XACML 3.0. Ontwerp gereed, nog niet geïmplementeerd. Zie `autoriseren/autoriseren.md`.

### Bestandsstructuur model/

**Plumbing (handmatig)**:

| Bestand                    | Inhoud                                                       |
|----------------------------|--------------------------------------------------------------|
| `metaregistry_plumbing.go` | `TypeMeta` struct (~87 velden), `MetaRegistry` declaratie, helpers (`GetTypeMeta`, `MustTypeMeta`, `GetByVeldnaam`, etc.) |
| `model_plumbing.go`        | Interfaces (`Representatie`, `FormeleRepresentatie`, `MaterieleRepresentatie`, `HeeftOnderliggendeGegevenselementen`), plumbing-types (Registratie, Wijziging, Taak) |
| `datatype_aliases.go`      | Go type-aliassen (NLPostcode, BSN, Datum, URL, Emailadres, etc.) |
| `date.go`                  | `Date` type (YYYY-MM-DD) met JSON/Bun marshaling |
| `v3_format.go`             | V3 JSON structs (`V3EntiteitModel`, `V3Entiteit`, `V3Relatie`, `V3Veld`, `V3Runtime`, etc.) |
| `v3_exporter.go`           | Export MetaRegistry → V3 JSON (met runtime-metadata) |
| `schema_versie.go`         | SchemaVersie entity (bijhouding gepubliceerde modelversies) |
| `nested.go`                | Helpers voor geneste entiteit-loading |

**Per domein (codegen-gegenereerd)**:

| Bestandspatroon                 | Inhoud                                  |
|---------------------------------|-----------------------------------------|
| `{prefix}_modellen_entiteiten.go` | Entiteitstructs + materiële plumbing  |
| `{prefix}_modellen_ge_rel.go`    | GE/relatie hubs + _Data + _Aanvang/_Einde structs + enum-declaraties |
| `{prefix}_modellen_methods.go`   | Interface-implementaties (GetID, Metatype, etc.), GeefOnderliggende...() |
| `{prefix}_modellen_input.go`     | Afgevlakte input-structs voor registratie-API |
| `{prefix}_metaregistry.go`      | TypeMeta entries + `VoegOnderliggendGEToe()` cross-domein + init-functie |
| `{prefix}_datatype_registry.go`  | Custom datatypes + init-functie |
| `{prefix}_enum_registry.go`     | Enums + init-functie |

### Generieke handlers

Handlers in `handlers/` zijn **generiek** en werken op basis van `TypeMeta`:

- `MakeGetEntitiesByMetaHandler(meta)` — lijst met paginering
- `MakeGetEntityByMetaHandler(meta)` — enkel record
- `MakeAddEntityByMetaHandler(meta)` — insert
- `MakeGetFullEntityByMetaHandler(meta)` — entiteit met alle geneste GE's/relaties
- `RegistreerMetNieuweAanpak()` — registratie van opvoer/afvoer met audittrail

Daarnaast:
- **Schema/metadata handlers**: V3 JSON export, domein-specifiek, OpenAPI, viz-schema
- **Admin handlers**: DB drop/rebuild, devloop-rebuild, async-taken
- **Diff handler**: schema-vergelijking
- **Bestanden handler**: file upload/management
- **Docs handler**: markdown-documentatie serveren

Routes worden dynamisch geregistreerd in `routes/addroutes.go` op basis van `Padnaam` uit de MetaRegistry.

### CLI-tools (cmd/)

| Tool                  | Doel                                                |
|-----------------------|-----------------------------------------------------|
| `cmd/codegen/`        | V3 JSON → Go-model codegen (multi-domein, additief) |
| `cmd/export_v3/`      | MetaRegistry → V3 JSON export                       |
| `cmd/openapi-export/` | OAS 3.1 specs exporteren naar bestanden             |
| `cmd/schemadiff/`     | Schema-versies vergelijken                          |

## Naamconventies

| Context        | Conventie                      | Voorbeeld                                  |
|----------------|-------------------------------|---------------------------------------------|
| Go struct      | PascalCase                    | `A_Aanvang`, `Rel_A_B`, `NP_Naam_Data`     |
| Go veld        | PascalCase                    | `Aanvang`, `RelABs`, `Voornaam`             |
| JSON tag       | snake_case                    | `"aanvang"`, `"einde"`, `"voornaam"`        |
| DB tabel       | snake_case                    | `a_aanvang`, `rel_a_b`, `np_naam_data`      |
| DB kolom       | snake_case                    | `a_id`, `rel_id`, `versie`                  |
| URL pad        | snake_case                    | `/a_aanvang`, `/rel_a_bs`, `/np_naam`       |

**Taal**: Domeintermen zijn Nederlands (opvoer, afvoer, aanvang, einde, wijziging, registratie). Code-identifiers en comments zijn Nederlands tenzij het Go/HTTP-conventie betreft.

## Tech stack

- **Go** met **Gin** (HTTP) en **Bun** (ORM/PostgreSQL)
- **PostgreSQL** als database
- **GraphQL** via `graphql-go/graphql` (dynamisch, geen codegen)
- **React + Vite** frontend in `web/vite/`, serveert vanuit `/viz/react/`
- **UML-Editor** in `uml-editor/` (React + React Flow)
- **3D Universum**: `react-force-graph-3d` + Three.js
- **OpenAPI 3.1**: dynamisch gegenereerd, Swagger + ReDoc UI
- **Docker**: Alpine-based images, devloop-compose, split-compose
- Frontend leest het schema dynamisch via de schema-API — geen hardcoded veldnamen

## V3 JSON als uitwisselingsformaat

V3 JSON is het **platform-onafhankelijke modelformaat** voor de roundtrip:

**Code ↔ V3 JSON ↔ UML-Editor**

Het V3-formaat bevat:
- Entiteiten met velden, metatype-info, momentvoorkomen, materialiteitsinstellingen
- Relaties met bron/doelEntiteit, kardinaliteit, directioneel-vlag
- GE's met Hub+_Data structuur
- Afgeleide velden met expressietaal en regels
- Datatypes en enums
- Editor-layout (posities, kleuren, use-edges, anker-posities)
- Runtime-metadata (`V3Runtime`)

Bewaard in `model/v3_format.go` (structs) en `model/v3_exporter.go` (export).

## Werkwijze bij modelwijzigingen

### Via codegen (aanbevolen)
1. Pas het V3 JSON model aan (via UML-Editor of handmatig)
2. Draai codegen: `go run ./cmd/codegen --input model.json --output model --domein <domein> --prefix <prefix> --mode additive`
3. De 7 domeinbestanden worden automatisch gegenereerd
4. Controleer met `go build ./...` en `go test ./...`

### Handmatig (voor plumbing of het ABUVWXY referentiemodel)
1. **Struct** in `{prefix}_modellen_entiteiten.go` of `{prefix}_modellen_ge_rel.go`
2. **Interface-methoden** in `{prefix}_modellen_methods.go`
3. **MetaRegistry-entry** in `{prefix}_metaregistry.go`
4. **OnderliggendeGegevenselementen** in de parent-entiteit entry
5. **GeefOnderliggendeGegevenselementen()** op de entiteit
6. **DB-tabel** in `dbsetup/createtables.go` en `dbsetup/createmodeltables.go`

Routes, handlers, GraphQL-schema en OpenAPI-specs hoeven **niet** handmatig toegevoegd; die worden dynamisch gegenereerd.

## Tests en build

```sh
cd bitemp_register_v06
go build ./...          # compileer
go test ./...           # unit tests
go test ./... -coverprofile coverage.out  # coverage
```

Er zijn VS Code tasks gedefinieerd voor build, test, coverage en devloop (zie `.vscode/tasks.json`):
- `go: test all (v06)`, `go: coverage all (v06)`, `go: coverage html (v06)`
- `vite: dev server (v06)`, `vite: build (v06)`
- `stop: api server (v06, :8082)`, `stop: vite server (v06, :5173/:5174/:5175)`

## Belangrijke referentiedocumentatie

| Document                             | Onderwerp                                      |
|--------------------------------------|-------------------------------------------------|
| `README.md`                          | Hoofdoverzicht, setup, features                 |
| `docs/DEVLOOP.md`                    | Devloop workflow en auto-rebuild                |
| `docs/CODEGEN.md`                    | Codegen architectuur en multi-domein            |
| `docs/OPENAPI.md`                    | OpenAPI 3.1 generatie en NL API Strategie       |
| `docs/BACKLOG.md`                    | Open items en prioriteiten                      |
| `docs/overerving-analyse.md`         | Overerving/generalisatie TPT-analyse            |
| `docs/dynamische-graphql-laag.md`    | GraphQL-laag implementatie                      |
| `docs/3D_UNIVERSUM.md`              | 3D visualisatie                                 |
| `docs/frontend-viz-design.md`        | Frontend visualisatie-ontwerp                   |
| `ONTWERP_DATA_PATTERN.md`           | Hub + _Data patroon                             |
| `afgeleide-velden.md`               | Afgeleide velden ontwerp                        |
| `materiele_tijd.md`                  | Materiële tijdsplumbing                         |
| `GRAPHQL.md`                         | GraphQL overzicht                               |
| `RELEASE.md`                         | Release notes                                   |
| `uml-editor/README.md`             | UML-editor features en gebruik                  |
| `autoriseren/autoriseren.md`        | Autorisatie-ontwerp (PBAC)                      |
