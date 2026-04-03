# Copilot Instructions — Bitemporal Go API v05

De actieve versie is `bitemporal_go_API_v05/`. Eerdere versies (v01–v04) zijn archief.

We zijn aan het bouwen aan `bitemp_register_v06/`, een doorontwikkeling van deze v05, met een aantal verbeteringen in de architectuur en implementatie. De v05 blijft beschikbaar als referentie en voor vergelijking, maar de focus ligt nu op de v06.

## Algemene instructies
Documenteer altijd alle wijzigingen in duidelijke comments in de code en in (vaak specifiek per onderwerp benoemde of anders de generieke readme) markdown files.

Als je iets **substantieels** hebt gewijzigd of onderzocht, werk dan in dezelfde taak ook de **relevante documentatie** bij (bij voorkeur de meest specifieke `.md`, bijvoorbeeld `docs/DEVLOOP.md`, anders de algemene `README.md`).

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

### Representatietypes

Elk type in het model is een **representatie** met een van drie metatypes:

| Metatype            | Voorbeelden                      | Kenmerken                                  |
|---------------------|----------------------------------|--------------------------------------------|
| `entiteit`          | A, B                             | Heeft `ID` (autoincrement), bevat onderliggende GE's/relaties |
| `gegevenselement`   | A_U, A_V, A_W, B_X, B_Y         | FK naar entiteit (`a_id`/`b_id`), relatieve `rel_id` |
| `relatie`           | Rel_A_B                          | FK naar twee entiteiten, relatieve `rel_id` |

Elke representatie heeft `opvoer`/`afvoer` (formele tijd).

Alle representaties zijn structs in Go, met JSON-tags voor API-serialisatie en Bun-tags voor DB-mapping. Ze implementeren interfaces (`Representatie`, `FormeleRepresentatie`, `MaterieleRepresentatie`) die methoden definiëren voor ID, metatype, tijdvelden, etc.

Alle representaties implementeren ook een `GetID()`, `Metatype()`, `ClearID()`, `GetOpvoer()`, `SetOpvoer()`, `GetAfvoer()`, `SetAfvoer()` methoden, zodat ze generiek kunnen worden behandeld in handlers en de MetaRegistry.

Alle representaties worden opgeslagen in een eigen tabel in de database, met velden die via bun-tags zijn gedefinieerd.

#### Velden
Velden in representaties zijn getypeerd volgens de beschikbare types in Go (string, int, time.Time, etc.). Omdat we eigenlijk 3 werelden van types hebben (4 als we GraphQL meenemen), heeft elke wereld haar eigen typeringssysteem:
- Go: de go-types
- JSON: we gebruiken het systeem van OAS 3.1, met `type` en `format` in de JSON-schema's van de schema-API. Het type en format worden bepaald op basis van de Go-type van het veld, maar kunnen ook expliciet worden opgegeven in de `schema` tag van het veld.
- DB: we gebruiken bun-tags om de mapping van Go-types naar DB-kolommen te definiëren
- GraphQL: we gebruiken gqlgen, waarbij we in de gqlgen config kunnen definiëren hoe Go-types worden gemapt naar GraphQL-types

##### Gebruik velden in de FrontEnd
In de frontend gebruiken we de JSON-veldnaam (de snake_case versie van het veld) om de data te binden in formulieren en weergaven. Daarnaast gebruiken we de veldtype en format uit de schema-API om te bepalen welk type invoerveld we moeten renderen (bijv. datepicker voor datumvelden, text input voor strings, etc.).

#### Entiteiten (voorbeeld: A, B)
Entiteiten hebben een eigen ID ("id" in de eigen tabel, "a_id" of "b_id" als (P)FK in andere tabellen, voor nu nog niet autoincrement, maar via de API of UI ingegeven) en kunnen onderliggende gegevenselementen en relaties bevatten. Ze implementeren ook een `GeefOnderliggendeGegevenselementen()` methode die een lijst van hun onderliggende GE's/relaties retourneert, inclusief:
- Rolnaam: de rolnaam van het gegevenselement of de relatie
- JSON-rolnaam: de JSON-veldnaam van het gegevenselement of de relatie
- Doeltype: het type (struct) van het gegevenselement of de relatie (bijv. A_U, Rel_A_B, etc.)
- momentvoorkomen: dit is of het gerelateerde gegevenselement:
  - enkelvoudig is als je de tijd stilzet, dus op een formeel tijdstip t, of
  - meervoudig is, waardoor er meerdere GE's/relaties van hetzelfde type op enig moment tegelijk kunnen voorkomen. Bijv. meerdere A_U's bij een A op formeel tijdstip t.

### Routes in de database.
Relatieve autoincrement: bij gegevenselementen en relaties wordt de `rel_id` automatisch opgehoogd binnen de scope van de parent-entiteit (a_id of b_id) en het type van het gegevenselement of de relatie. Dit maakt het mogelijk om meerdere GE's/relaties van hetzelfde type te hebben bij een entiteit, en om eenvoudig te verwijzen naar specifieke GE's/relaties via hun `rel_id`.

Dit geldt ook voor aanvang en einde: er kunnen meerdere aanvangs- en eindrecords zijn voor een entiteit, en de `versie` wordt automatisch opgehoogd binnen de scope van de parent-entiteit (a_id of b_id) en het type (A_Aanvang, A_Einde, etc.). Hierdoor kunnen we een volledige geschiedenis van aanvangs- en eindrecords bijhouden, en altijd de meest recente versie ophalen.

### Materiële plumbing-types

Aanvang en einde worden gemodelleerd als **aparte enkelvoudige GE's** met eigen tabellen en versiegeschiedenis:

- `A_Aanvang`, `A_Einde`, `B_Aanvang`, `B_Einde`
- PK: `(a_id|b_id, versie)` — versie is autoincrement
- Vorige versie wordt automatisch afgevoerd bij een nieuwe registratie
- Gedefinieerd in `model/modellen_entiteiten.go` en `model/modellen_GE_rel.go` (todo)

### MetaRegistry — de single source of truth

`model/metaregistry.go` bevat een `MetaRegistryType` map van `TypeMeta`-entries.

Dit is nodig om te voorkomen dat er eindeloos veel custom tags in de structs gezet worden.

De metaregistry - die we kort ook wel metamap noemen - is de **single source of truth** voor alle metadata over de representatietypes in het model. Alle informatie over de types, hun relaties, database mapping, URL-paden, etc. staat in deze metaregistry. Handlers, routes, schema-API en frontend lezen deze informatie dynamisch uit de metaregistry, zodat er niet steeds reflectie over structs of tags nodig is.

De metaregistry gaat over alle representatietypes (structs dus) in het model, dus entiteiten, gegevenselementen en relaties, en niet over hun velden. Die staan in de structs. De relatie-structuur tussen de representatie-structs is ook in de metaregistry gedefinieerd, via de `OnderliggendeGegevenselementen` lijst in de entiteit-entries. Deze lijst beschrijft welke gegevenselementen en relaties er onder een entiteit vallen, en hoe ze gerelateerd zijn aan de struct-velden van de entiteit.

Elke entry beschrijft:

- **Typenaam**, **Description**, **Metatype**, **IsMaterieel**
- **Veldnaam** (JSON-veldnaam), **Padnaam** (URL-pad), **Kleur** (visualisatie)
- **Factory/SliceFactory/DBFactory/DBSliceFactory** (constructors)
- **Tabelnaam**, **IDKolom**, **EntiteitIDKolom**, **HeeftPFK**, **RelatieveAutoincrement**
- **OnderliggendeGegevenselementen** (alleen voor entiteiten): lijst met `Rolnaam` (Go-veldnaam), `JSONRolnaam`, `Doeltype`, `Momentvoorkomen`

Routes, handlers, schema-API en frontend worden allemaal **dynamisch gedreven** door de MetaRegistry.

#### Schema-API
De schema-API (`/schema`) retourneert de metadata van alle representatietypes in de MetaRegistry, inclusief hun velden en onderliggende gegevenselementen/relaties. De frontend gebruikt deze informatie om dynamisch formulieren en weergaven te genereren, zonder hardcoded veldnamen of structuren.

N.B.: de gehele frontend is dynamisch gedreven door de schema-API, die op zijn beurt weer gedreven wordt door de MetaRegistry. Er zijn geen hardcoded veldnamen of structuren in de frontend; alles komt uit de schema-API.

##### Velden (zie bovenstaande uitleg over veldtypen)
Velden in de schema-API worden beschreven met hun JSON-veldnaam, veldtype (bepaald op basis van de Go-type of expliciet opgegeven in de `schema` tag), format (voor datums, etc.), enum-waarden (indien van toepassing) en beschrijving (uit de `schema_desc` tag).

##### OnderliggendeGegevenselementen
OnderliggendeGegevenselementen worden beschreven met hun rolnaam (de Go-veldnaam in de entiteitstruct), JSON-rolnaam (de JSON-veldnaam van dat veld), doeltype (het type van het gegevenselement of de relatie) en momentvoorkomen (enkelvoudig of meervoudig).

#### API Routes 
Routes worden beschreven met hun padnaam (zoals `/a_aanvang`, `/rel_a_bs`, etc.) en worden dynamisch geregistreerd in Gin op basis van de MetaRegistry. Handlers worden ook dynamisch gegenereerd op basis van de metadata in de MetaRegistry, zodat we geen handmatige route- of handlerdefinities hoeven te schrijven voor elk type.

##### Routes voor Wijzigingen en Registraties
Voor registratie van wijzigingen hebben we een speciale route `/registreer` die een volledige registratie met wijzigingen en representaties accepteert. Deze route gebruikt de `RegistreerMetNieuweAanpak()` handler, die de logica bevat voor het verwerken van de registratie, inclusief het automatisch afvoeren van vorige versies van aanvangs- en eindrecords.


#### Frontend
De frontend in `web/vite/` is volledig dynamisch en leest alle metadata uit de schema-API. Hierdoor kunnen we zonder codewijzigingen nieuwe representatietypes, velden of relaties toevoegen, zolang ze maar correct in de MetaRegistry staan.

De bestaat uit een aantal pagina's om de inhoudelijke gegevens in het register te bekijken en te bewerken, en een aparte pagina om de lijst registraties te kunnen inzien.


### Bestandsstructuur model/

| Bestand                    | Inhoud                                                       |
|----------------------------|--------------------------------------------------------------|
| `model_plumbing.go`        | Interfaces (`Representatie`, `FormeleRepresentatie`, `MaterieleRepresentatie`), helpers, plumbing-types (A_Aanvang etc.) |
| `metaregistry_plumbing.go` | `TypeMeta` struct, `MetaRegistryType`, `OnderliggendGegevenselement`, constanten |
| `metaregistry.go`          | De `MetaRegistry` variabele met alle type-entries            |
| `modellen_entiteiten.go`   | Entiteitstructs (A, B) met hun GE-relaties en `GeefOnderliggendeGegevenselementen()` |
| `modellen_ge_rel.go`       | GE- en relatiestructs (A_U, A_V, A_W, Rel_A_B, B_X, B_Y) met formele-tijd methoden |

### Generieke handlers

Handlers in `handlers/` zijn **generiek** en werken op basis van `TypeMeta`:

- `MakeGetEntitiesByMetaHandler(meta)` — lijst met paginering
- `MakeGetEntityByMetaHandler(meta)` — enkel record
- `MakeAddEntityByMetaHandler(meta)` — insert
- `MakeGetFullEntityByMetaHandler(meta)` — entiteit met alle geneste GE's/relaties
- `RegistreerMetNieuweAanpak()` — registratie van opvoer/afvoer met audittrail

Routes worden dynamisch geregistreerd in `routes/addroutes.go` op basis van `Padnaam` uit de MetaRegistry.

## Naamconventies

| Context        | Conventie                      | Voorbeeld                        |
|----------------|-------------------------------|----------------------------------|
| Go struct      | PascalCase                    | `A_Aanvang`, `Rel_A_B`          |
| Go veld        | PascalCase                    | `Aanvang`, `RelABs`             |
| JSON tag       | snake_case, zonder entiteitsprefix voor materieel | `"aanvang"`, `"einde"`, `"us"` |
| DB tabel       | snake_case                    | `a_aanvang`, `rel_a_b`          |
| DB kolom       | snake_case                    | `a_id`, `rel_id`, `versie`      |
| URL pad        | snake_case                    | `/a_aanvang`, `/rel_a_bs`       |

**Taal**: Domeintermen zijn Nederlands (opvoer, afvoer, aanvang, einde, wijziging, registratie). Code-identifiers en comments zijn Nederlands tenzij het Go/HTTP-conventie betreft.

## Tech stack

- **Go** met **Gin** (HTTP) en **Bun** (ORM/PostgreSQL)
- **PostgreSQL** als database
- **React + Vite** frontend in `web/vite/`, serveert vanuit `/viz/react/`
- Frontend leest het schema dynamisch via de schema-API — geen hardcoded veldnamen
- **GraphQL** via gqlgen (experimenteel)

## Werkwijze bij modelwijzigingen

Bij het toevoegen of wijzigen van een representatietype, pas aan:

1. **Struct** in `modellen_entiteiten.go` of `modellen_ge_rel.go`
2. **Interface-methoden** (GetID, Metatype, ClearID, Get/SetOpvoer, Get/SetAfvoer)
3. **MetaRegistry-entry** in `metaregistry.go`
4. **OnderliggendeGegevenselementen** in de parent-entiteit entry (Rolnaam + JSONRolnaam moeten matchen met struct-veld en JSON-tag)
5. **GeefOnderliggendeGegevenselementen()** methode op de entiteit
6. **DB-tabel** aanmaken in `dbsetup/createtables.go` en `dbsetup/createmodeltables.go`

Routes en handlers hoeven **niet** handmatig toegevoegd; die worden dynamisch gegenereerd.

## Tests en build

```sh
cd bitemporal_go_API_v05
go build ./...          # compileer
go test ./...           # unit tests
go test ./... -coverprofile coverage.out  # coverage
```

Er zijn VS Code tasks gedefinieerd voor build, test en coverage (zie `.vscode/tasks.json`).
