# API-standaarden-analyse — Bitemporeel Register v06

> Analyse van de registratie-API (mutatie-endpoint) in relatie tot REST, GraphQL en andere JSON/HTTP-standaarden, inclusief een voorstel voor een GraphQL-formulering.

## Inhoudsopgave

1. [Samenvatting](#1-samenvatting)
2. [Hoe de registratie-API werkt](#2-hoe-de-registratie-api-werkt)
3. [Vergelijking met REST](#3-vergelijking-met-rest)
4. [Vergelijking met GraphQL](#4-vergelijking-met-graphql)
5. [Vergelijking met andere JSON/HTTP-standaarden](#5-vergelijking-met-andere-jsonhttp-standaarden)
6. [Classificatie: CQRS + Event Sourcing](#6-classificatie-cqrs--event-sourcing)
7. [GraphQL-formulering van de registratie-API](#7-graphql-formulering-van-de-registratie-api)
8. [GraphQL-formulering van de full-opvraag API's](#8-graphql-formulering-van-de-full-opvraag-apis)
9. [Conclusie](#9-conclusie)
10. [Migratiepad naar een hybride API](#10-migratiepad-naar-een-hybride-api)
11. [Wat eerst in GraphQL moet landen](#11-wat-eerst-in-graphql-moet-landen)
12. [Een v06-nabij GraphQL-schema](#12-een-v06-nabij-graphql-schema)
13. [Typesystemen vergeleken](#13-typesystemen-vergeleken)

---

## 1. Samenvatting

De kern-mutatie-API van het bitemporeel register (`POST /registratie/`) wijkt fundamenteel af van zowel REST als GraphQL. De API past het best bij het patroon **CQRS (Command Query Responsibility Segregation) + Event Sourcing over JSON/HTTP**. GraphQL is van de gangbare standaarden het *dichtstbij*, met name door het single-endpoint model en de mogelijkheid tot bundeling van operaties.

| Standaard         | Passendheid | Reden                                                                 |
|-------------------|:-----------:|-----------------------------------------------------------------------|
| REST              | ≈30%        | Alleen JSON/HTTP en statelessness; rest wijkt af                      |
| GraphQL           | ≈45%        | Enkel endpoint, bundeling van operaties, typed schema                 |
| **CQRS + ES**     | **≈90%**    | Command/Query scheiding, event-als-bron, audit trail, immutability    |
| JSON Patch RFC 6902 | ≈35%      | Array van operaties, maar werkt op één document, niet op meerdere resources |
| JSON-RPC 2.0      | ≈25%       | RPC-patroon met batch, maar geen domein-envelop                       |
| gRPC               | ≈55%       | Sterk getypeerd command/query, envelop-structuur, maar binair protocol |
| Zalando REST Guidelines | ≈30% | Goede REST-design-richtlijnen, maar fundamenteel resource-georiënteerd |
| MS Graph API       | ≈40%       | JSON batch, $expand nesting, change tracking, maar resource-CRUD model |

---

## 2. Hoe de registratie-API werkt

### Endpoint

```
POST /registratie/
Content-Type: application/json
→ 201 Created
```

Eén endpoint verwerkt alle typen mutaties: opvoer, afvoer, correctie en ongedaanmaking.

### Request-structuur

```json
{
  "registratie": {
    "registratietype": "registratie | correctie | ongedaanmaking",
    "tijdstip": "2026-01-01T09:01:00Z",
    "opmerking": "Beschrijving van de registratie",
    "corrigeert_registratie_id": null,
    "maakt_ongedaan_registratie_id": null
  },
  "wijzigingen": [
    { "opvoer": { "<type_key>": { /* representatie-data */ } } },
    { "afvoer": { "<type_key>": { /* identificerende velden */ } } }
  ]
}
```

### Kernkenmerken

| Kenmerk                      | Beschrijving                                                                                          |
|------------------------------|------------------------------------------------------------------------------------------------------|
| **Enkel endpoint**           | Alle mutaties via `POST /registratie/`                                                                |
| **Envelop-structuur**        | Een `registratie`-object (metadata) omhult meerdere `wijzigingen`                                     |
| **Polymorf payload**         | Verschillende representatietypes in dezelfde structuur, type bepaald door JSON-key (`"a"`, `"u"`, `"rel_a_b"`) |
| **Operatietype per wijziging** | `opvoer` (voer op / creëer) of `afvoer` (voer af / deactiveer)                                      |
| **Drie registratietypen**    | `registratie` (nieuw), `correctie` (corrigeer eerder), `ongedaanmaking` (draai terug)                 |
| **Atomaire transactie**      | Alle wijzigingen in één DB-transactie; alles-of-niets                                                |
| **Ingebouwde audit trail**   | `request_body`, `response_body`, `response_code`, `duration_ms` worden opgeslagen bij registratie     |

### Concrete voorbeelden

#### Voorbeeld 1: Opvoer entiteit A met geneste GE's

```json
{
  "registratie": {
    "registratietype": "registratie",
    "tijdstip": "2026-01-01T09:01:00Z",
    "opmerking": "Initiële opvoer van entiteit A inclusief onderliggende gegevenselementen"
  },
  "wijzigingen": [
    {
      "opvoer": {
        "a": {
          "id": "1",
          "us": [
            { "rel_id": 1, "aaa": "a1", "bbb": true, "aanvang": "2025-10-07" }
          ],
          "vs": [
            { "rel_id": 1, "ccc": "c1-1" },
            { "rel_id": 2, "ccc": "c1-2" }
          ]
        }
      }
    }
  ]
}
```

#### Voorbeeld 2: Afvoer + opvoer (inhoudelijke wijziging)

```json
{
  "registratie": {
    "registratietype": "registratie",
    "tijdstip": "2026-01-10T11:02:00Z",
    "opmerking": "Afvoer van u1 en opvoer van u2"
  },
  "wijzigingen": [
    {
      "afvoer": { "u": { "rel_id": 1, "a_id": "1" } }
    },
    {
      "opvoer": { "u": { "rel_id": 2, "a_id": "1", "aaa": "aaa a1", "bbb": true } }
    }
  ]
}
```

#### Voorbeeld 3: Afvoer entiteit

```json
{
  "registratie": {
    "registratietype": "registratie",
    "tijdstip": "2026-02-16T10:30:03Z",
    "opmerking": "Afvoer van entiteit A"
  },
  "wijzigingen": [
    { "afvoer": { "a": { "id": "1" } } }
  ]
}
```

#### Voorbeeld 4: Correctie

```json
{
  "registratie": {
    "registratietype": "correctie",
    "tijdstip": "2026-01-12T11:00:00Z",
    "opmerking": "Corrigeer U3 van entiteit A2",
    "corrigeert_registratie_id": 1
  },
  "wijzigingen": [
    { "opvoer": { "u": { "rel_id": 3, "a_id": "2", "aaa": "a2-correctie" } } }
  ]
}
```

#### Voorbeeld 5: Ongedaanmaking

```json
{
  "registratie": {
    "registratietype": "ongedaanmaking",
    "tijdstip": "2026-01-20T14:00:00Z",
    "maakt_ongedaan_registratie_id": 5
  },
  "wijzigingen": []
}
```

### Response-structuur (201 Created)

```json
{
  "message": "De registratie 5 is succesvol verwerkt op 2026-01-05T00:00:05Z in 123 ms",
  "registratie_id": 5,
  "registratieId": 5,
  "tijdstip": "2026-01-05T00:00:05Z",
  "wijzigingen": [ /* echo van verwerkte wijzigingen */ ]
}
```

---

## 3. Vergelijking met REST

### Score: ≈30% — vrij ver weg

De v06 API heeft naast de registratie-API ook RESTful CRUD-endpoints (dynamisch gegenereerd via MetaRegistry):

```
GET  /as          → lijst A's
GET  /as/:id      → enkele A
POST /as          → voeg A toe
GET  /full/as/:id → A met alle geneste GE's/relaties
```

Maar de **kern-mutatieflow** via `POST /registratie/` wijkt fundamenteel af:

| REST-principe                  | v06 registratie-endpoint                      | Match? |
|--------------------------------|-----------------------------------------------|--------|
| Resource-georiënteerd (URLs = nouns) | Eén endpoint voor alle typen mutaties      | ❌     |
| HTTP-verbs = operaties         | Altijd `POST`; operatietype in payload         | ❌     |
| Eén resource per request       | Meerdere resources/types in één request        | ❌     |
| Idempotentie (PUT/DELETE)      | Niet idempotent (correctie/ongedaanmaking compenseert) | ❌ |
| HATEOAS / links                | Niet aanwezig                                  | ❌     |
| HTTP status = resource lifecycle | 201 voor alle succesvolle registraties       | ⚠️     |
| JSON over HTTP                 | Ja                                             | ✅     |
| Stateless                      | Ja                                             | ✅     |

**Waarom het geen REST is:** REST modelleert *resources* en hun lifecycle via HTTP-verbs. De registratie-API modelleert *commando's* (registraties) die als zijeffect meerdere resources aanmaken of deactiveren. De resource die daadwerkelijk wordt aangemaakt is de *registratie zelf*, maar de zijeffecten op representaties zijn het feitelijke werk.

---

## 4. Vergelijking met GraphQL

### Score: ≈45% — dichter bij dan REST

| GraphQL-kenmerk                       | v06 registratie-endpoint                      | Match? |
|---------------------------------------|-----------------------------------------------|--------|
| Enkel endpoint (`/graphql`)           | Eén URL voor alle mutaties                    | ✅     |
| Meerdere mutaties in één request      | Via `wijzigingen[]` array                     | ✅     |
| Typed operations                      | Impliciet via JSON-key, niet via schema       | ⚠️     |
| Schema-introspectie                   | Niet in mutations (wel via `/schema` API)     | ⚠️     |
| Field selection (alleen wat je nodig hebt) | Nee, hele representatie terug              | ❌     |
| Typesysteem in protocol               | Types bepaald door key-naam in JSON           | ❌     |
| Standaard query-taal                  | Geen query-taal; structuur bepaalt operatie   | ❌     |

> **Zie ook** [§13 Typesystemen vergeleken](#13-typesystemen-vergeleken) voor een uitgebreide vergelijking van de typeringskracht van GraphQL vs. andere standaarden.

### Waar het lijkt en verschilt

**Overeenkomsten:**
- Enkel endpoint voor alle operaties
- Bundeling van meerdere operaties in één request
- Typed response (JSON met vaste structuur)

**Verschillen:**
- GraphQL mutations zijn *individueel getypeerde operaties* (`createEntityA`, `deleteEntityA`), terwijl de registratie-API een *generiek envelop-patroon* gebruikt
- GraphQL laat de client bepalen welke velden worden geretourneerd; de registratie-API retourneert altijd alles
- GraphQL heeft ingebouwde schema-introspectie; de registratie-API heeft een aparte schema-API

---

## 5. Vergelijking met andere JSON/HTTP-standaarden

### JSON Patch (RFC 6902)

JSON Patch gebruikt ook een array van operaties op een JSON-document:

```json
[
  { "op": "add", "path": "/a/1", "value": { "aaa": "test" } },
  { "op": "remove", "path": "/u/5" }
]
```

**Structureel vergelijkbaar**, maar:
- JSON Patch werkt op *één JSON-document*; registratie op *meerdere database-resources*
- JSON Patch heeft pad-gebaseerde adressering (`/a/1/us/0`); registratie heeft type-gebaseerde (`"u": { "a_id": "1" }`)
- JSON Patch is gestandaardiseerd (RFC 6902); registratie is domeinspecifiek
- JSON Patch kent 6 operaties (add, remove, replace, move, copy, test); registratie kent 2 (opvoer, afvoer)

**Passendheid: ≈35%**

### JSON-RPC 2.0

JSON-RPC is een remote procedure call protocol met batch-support:

```json
[
  { "jsonrpc": "2.0", "method": "opvoer", "params": { "type": "a", ... }, "id": 1 },
  { "jsonrpc": "2.0", "method": "afvoer", "params": { "type": "u", ... }, "id": 2 }
]
```

**Vergelijkbaar** in de zin van command-dispatch, maar:
- JSON-RPC mist het envelop-concept (registratie als gezamenlijke context)
- JSON-RPC batch is een array van *onafhankelijke* calls; wijzigingen zijn *onderdeel van één registratie*
- Geen ingebouwde transactiesemantiek

**Passendheid: ≈25%**

### OData $batch

OData batch bundelt meerdere HTTP-requests in één multipart request. Elke sub-operatie is een volledige HTTP-request met eigen method/URL/headers.

- Te laag abstractieniveau voor het domein
- Geen concept van een gezamenlijke envelop/context
- **Passendheid: ≈15%**

### JSON:API

JSON:API is strikt resource-georiënteerd met compound documents en relatie-links.

- Vergelijkbare compound document structuur voor queries
- Mutations zijn nog steeds per-resource (POST/PATCH/DELETE)
- **Passendheid: ≈20%**

### CloudEvents (CNCF)

CloudEvents definieert een envelope-standaard voor events:

```json
{
  "specversion": "1.0",
  "type": "nl.register.registratie",
  "source": "/registratie",
  "data": { /* wijzigingen */ }
}
```

- Past goed op de *registratie als event* (na verwerking)
- Minder geschikt voor het *request-formaat* (geen ingebouwde batch/array)
- **Passendheid: ≈30%** (als event-formaat, niet als API-standaard)

### Zalando RESTful API Guidelines

De [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/) zijn een uitgebreid, openbaar gepubliceerd stel design-richtlijnen voor het bouwen van REST API's. Ze worden soms gezien als voorloper van OAS 3.1, maar dat klopt niet helemaal: het zijn *richtlijnen bovenop* OpenAPI, niet een specificatie zelf. Ze schrijven voor hoe je OpenAPI 3.x moet inzetten en voegen daar conventies aan toe.

#### Kernprincipes van de Zalando-guidelines

- **Strikt resource-georiënteerd**: elke API levert resources via noun-based URL's (`/orders`, `/customers/{id}`)
- **HTTP-verbs als enige operatie-semantiek**: GET, POST, PUT, PATCH, DELETE
- **JSON als standaard**: met `snake_case` veldnamen, `application/json` content-type
- **Problem Details (RFC 7807)** voor foutmeldingen
- **Paginering**: cursor- of offset-based, met standaard `limit`/`offset` of `cursor` parameters
- **Filtering en sortering**: via query parameters
- **Versiebeheer**: via URL-paden (`/v1/`) of media types
- **Events**: apart hoofdstuk over async events, met verwijzing naar CloudEvents
- **Bulk/batch**: de guidelines raden batch expliciet af en stellen voor om elke operatie als individuele resource-call te doen, behalve waar performance dat onmogelijk maakt

#### Vergelijking met v06 registratie-API

| Zalando-guideline                     | v06 registratie-API                          | Match? |
|---------------------------------------|----------------------------------------------|--------|
| Resource-georiënteerd (nouns)         | Eén command-endpoint                         | ❌     |
| HTTP-verbs = operaties                | Altijd POST, operatietype in payload         | ❌     |
| Eén resource per request              | Meerdere representaties in één registratie   | ❌     |
| Geen batch (liever per-resource)      | Batch is juist de kern (wijzigingen[])       | ❌     |
| `snake_case` veldnamen                | ✅ v06 gebruikt snake_case                   | ✅     |
| JSON als standaard                    | ✅                                           | ✅     |
| Problem Details (RFC 7807)            | Niet geïmplementeerd (eigen foutformaat)     | ❌     |
| Paginering (limit/offset)             | ✅ op de GET-endpoints                       | ✅     |
| Versiebeheer in URL                   | Niet aanwezig                                | ❌     |
| Events / async kant                   | Registratie *is* een event (maar synchroon)  | ⚠️     |

#### Wat de Zalando-guidelines wél bieden voor v06

Hoewel de registratie-API niet in de Zalando-mal past, zijn de guidelines wél nuttig voor de **query-kant** van v06:
- De `GET /as`, `GET /full/as/:id` endpoints volgen grotendeels de Zalando-principes
- Paginering, filtering en foutafhandeling kunnen naar Zalando-standaard worden ingericht
- De schema-API (`/schema`) zou als OpenAPI-conforme discovery-endpoint kunnen worden beschreven

Voor de mutatiekant biedt Zalando weinig: de guidelines gaan ervan uit dat mutaties per-resource plaatsvinden. Het bitemporele registratiepatroon (meerdere resources atomair muteren via een envelop) zit buiten de scope van de Zalando-guidelines.

**Passendheid: ≈30%** (goed voor query-designrichtlijnen, niet voor command-patroon)

> **Opmerking**: de Zalando-guidelines zijn geen specificatie of standaard in de zin van RFC's of W3C-specs. Het is een stel design-richtlijnen die *uitgaan van* REST + OpenAPI. Ze zijn geen voorloper van OAS 3.1 maar eerder een *best-practice-laag bovenop* OAS 3.x. De OpenAPI-specificatie zelf (OAS 3.0/3.1) definieert hoe je een API *beschrijft*; de Zalando-guidelines definiëren hoe je een API *ontwerpt*.

### Microsoft Graph API

De [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview) is Microsofts uniforme REST API voor toegang tot Microsoft 365-data (gebruikers, e-mail, agenda, bestanden, Teams, etc.). Het is geen open standaard maar een concreet API-ontwerp dat als referentiemodel wordt gebruikt door veel enterprise-organisaties.

#### Kernkenmerken van MS Graph

- **Enkel base-endpoint**: `https://graph.microsoft.com/v1.0/` (+ `/beta/`)
- **Resource-georiënteerd**: URL-paden als `/users/{id}`, `/groups/{id}/members`
- **OData query parameters**: `$select`, `$filter`, `$expand`, `$top`, `$skip`, `$orderby`, `$count`
- **`$expand` voor nesting**: vergelijkbaar met full-opvraag — je kunt gerelateerde resources inline ophalen
- **`$select` voor field selection**: client kiest welke velden terugkomen (vergelijkbaar met GraphQL field selection)
- **JSON Batch requests**: meerdere operaties in één POST naar `/$batch`
- **Change tracking / delta queries**: `GET /users/delta` voor incrementele wijzigingen
- **Webhooks / change notifications**: event-driven notificaties bij wijzigingen

#### MS Graph Batch — het meest vergelijkbare deel

MS Graph biedt een `/$batch` endpoint dat meerdere operaties bundelt:

```json
{
  "requests": [
    {
      "id": "1",
      "method": "POST",
      "url": "/users",
      "body": { "displayName": "Jan" },
      "headers": { "Content-Type": "application/json" }
    },
    {
      "id": "2",
      "method": "PATCH",
      "url": "/users/abc-123",
      "body": { "department": "IT" },
      "headers": { "Content-Type": "application/json" }
    }
  ]
}
```

Dit lijkt oppervlakkig op de registratie-API (meerdere operaties in één request), maar verschilt fundamenteel:
- Elke sub-request is een volledige HTTP-operatie met eigen method/URL/headers
- De sub-requests zijn *onafhankelijk* (geen gezamenlijke envelop/tijdstip)
- Geen transactiegarantie over de hele batch (tenzij `dependsOn` wordt gebruikt, en zelfs dan beperkt)
- Geen domeinspecifieke envelop (geen `registratie`-metadata)

#### Vergelijking met v06 registratie-API

| MS Graph kenmerk              | v06 registratie-API                          | Match? |
|-------------------------------|----------------------------------------------|--------|
| Enkel base-endpoint           | ✅ (voor mutaties: `POST /registratie/`)     | ✅     |
| Resource-georiënteerd         | Nee (command-georiënteerd)                   | ❌     |
| `$select` (field selection)   | Nee (hele representatie terug)               | ❌     |
| `$expand` (nesting)           | ✅ full-endpoints doen dit automatisch       | ⚠️     |
| JSON Batch                    | Vergelijkbaar (wijzigingen[]), maar semantisch anders | ⚠️     |
| Change tracking / delta       | Formeel tijdreizen biedt vergelijkbare functionaliteit | ⚠️     |
| OData query parameters        | Niet geïmplementeerd                         | ❌     |
| Transactie over batch         | ❌ MS Graph: beperkt; ✅ v06: altijd atomair | ❌     |
| Audit trail                   | Niet ingebouwd in MS Graph                   | ❌     |
| Temporele dimensies           | Niet aanwezig in MS Graph                    | ❌     |

#### Wat MS Graph wél biedt als inspiratie voor v06

**Voor de query-kant:**
- `$select` is functioneel equivalent aan GraphQL field selection, maar dan binnen REST. v06 zou `?select=id,us,vs` query parameters kunnen toevoegen aan de `GET /full/...` endpoints als lichtgewicht alternatief voor GraphQL.
- `$expand` is vergelijkbaar met de huidige full-opvraag, maar selectiever: je kunt kiezen welke relaties je wilt expanderen. Bijvoorbeeld: `GET /full/as/1?expand=us,relABs` in plaats van altijd alles ophalen.
- `$filter` zou nuttig zijn voor de lijst-endpoints: `GET /as?filter=opvoer ne null`.

**Voor change tracking:**
- MS Graph's delta-queries zijn een interessant model voor het ophalen van wijzigingen sinds een bepaald punt. v06 heeft al iets vergelijkbaars via formeel tijdreizen en de registratie-/wijzigingstabellen.

**Voor de mutatiekant:**
- MS Graph's batch-model voegt weinig toe voor v06. Het is te generiek (HTTP-in-HTTP) en mist de domeinspecifieke envelop die het bitemporele patroon vereist.

**Passendheid: ≈40%** (nuttig als inspiratie voor query-parameters en nesting, niet voor het command-patroon)

#### MS Graph vs GraphQL field selection

Een interessante observatie: MS Graph's `$select` en `$expand` bieden ~80% van de field-selection-meerwaarde van GraphQL, maar dan binnen een REST-model. Voor v06 zou dit een pragmatischer alternatief kunnen zijn dan een volledige GraphQL-laag, specifiek voor de query-kant:

```
# Huidige v06 REST (alles of niets)
GET /full/as/1

# MS Graph-stijl (selectief)
GET /full/as/1?$select=id,opvoer&$expand=us($select=rel_id,aaa),relABs($select=b_id)

# GraphQL equivalent
query { entiteitA(id:"1") { id opvoer us { relId aaa } relABs { bId } } }
```

Dit zou een tussenstap kunnen zijn: OData-achtige query parameters toevoegen aan de bestaande REST-endpoints, voordat (of in plaats van) een volledige GraphQL-laag wordt gebouwd.

### gRPC (Google Remote Procedure Call)

gRPC is een sterk getypeerd RPC-framework dat Protocol Buffers (protobuf) als Interface Definition Language (IDL) gebruikt en standaard over HTTP/2 communiceert met binaire serialisatie.

#### Hoe de registratie-API er in gRPC uit zou zien

```protobuf
syntax = "proto3";

import "google/protobuf/timestamp.proto";

service BitemporaalRegister {
  // Command: registreer, corrigeer of maak ongedaan
  rpc Registreer(RegistreerRequest) returns (RegistratieResult);
  
  // Queries
  rpc HaalEntiteitAOp(EntiteitRequest) returns (EntiteitAResponse);
  rpc HaalEntiteitenAOp(EntiteitenRequest) returns (EntiteitenAResponse);
  rpc HaalRegistratieOp(RegistratieRequest) returns (RegistratieResponse);
}

enum Registratietype {
  REGISTRATIE = 0;
  CORRECTIE = 1;
  ONGEDAANMAKING = 2;
}

enum Wijzigingstype {
  OPVOER = 0;
  AFVOER = 1;
}

message RegistreerRequest {
  Registratietype registratietype = 1;
  google.protobuf.Timestamp tijdstip = 2;
  optional string opmerking = 3;
  optional int64 corrigeert_registratie_id = 4;
  optional int64 maakt_ongedaan_registratie_id = 5;
  repeated WijzigingInput wijzigingen = 6;
}

message WijzigingInput {
  Wijzigingstype type = 1;
  // Polymorfie via oneof
  oneof representatie {
    AInput a = 10;
    BInput b = 11;
    AUInput u = 12;
    AVInput v = 13;
    AWInput w = 14;
    BXInput x = 15;
    BYInput y = 16;
    RelABInput rel_ab = 17;
  }
}

message AInput {
  string id = 1;
  repeated AUInput us = 2;
  repeated AVInput vs = 3;
  // ...
}

message AUInput {
  string a_id = 1;
  optional int32 rel_id = 2;
  optional string aaa = 3;
  optional bool bbb = 4;
}

// ... overige input-messages

message RegistratieResult {
  int64 registratie_id = 1;
  google.protobuf.Timestamp tijdstip = 2;
  Registratietype registratietype = 3;
  int64 duration_ms = 4;
  repeated WijzigingResult wijzigingen = 5;
}

message WijzigingResult {
  int64 id = 1;
  Wijzigingstype type = 2;
  string representatienaam = 3;
  string representatie_id = 4;
  string entiteitnaam = 5;
  string entiteit_id = 6;
}
```

#### Vergelijking gRPC vs v06 registratie-API

| Kenmerk                        | v06 registratie-API                      | gRPC                                          | Match? |
|--------------------------------|------------------------------------------|-----------------------------------------------|--------|
| Sterk getypeerd schema         | Nee (runtime JSON-parsing)               | Ja (protobuf IDL, compiletime)                | ✅     |
| Envelop-structuur              | `registratie` + `wijzigingen[]`          | `RegistreerRequest` met `repeated WijzigingInput` | ✅     |
| Command-patroon (RPC)          | POST met operatietype in payload         | Expliciete `rpc Registreer(...)` method        | ✅     |
| Polymorfie per wijziging       | Impliciet via JSON-key                   | Expliciet via `oneof representatie`             | ✅     |
| Bundeling van operaties        | `wijzigingen[]` array                    | `repeated WijzigingInput`                      | ✅     |
| JSON over HTTP                 | ✅ Native                                | ❌ Binair protobuf over HTTP/2 (standaard)     | ❌     |
| Browser-compatibiliteit        | ✅ Elke HTTP-client                      | ⚠️ Vereist gRPC-Web proxy of Connect           | ⚠️     |
| Field selection (client kiest) | Nee                                      | Nee (vaste response-shape)                     | ❌     |
| Schema-introspectie            | Via `/schema` API                        | Via protobuf reflection of `.proto`-bestanden  | ⚠️     |
| Streaming                      | Nee                                      | ✅ Server/client/bidirectional streaming        | —      |
| Code-generatie                 | Nee (handmatig)                          | ✅ Automatisch voor Go, JS, Python, etc.       | ✅     |
| Human-readable payloads        | ✅ JSON                                  | ❌ Binair (niet leesbaar in browser/Postman)   | ❌     |

#### Waar gRPC beter past dan GraphQL

- **Polymorfie**: protobuf's `oneof` lost het probleem op dat GraphQL niet heeft (geen union inputs). De `WijzigingInput` met `oneof representatie { AInput a; AUInput u; ... }` drukt exact uit dat precies één representatietype is gevuld — dat is beter dan GraphQL's huidige situatie.
- **Command-semantiek**: gRPC is van nature RPC — `rpc Registreer(...)` is een expliciete command-aanroep, geen workaround via een mutation-veld.
- **Code-generatie**: uit één `.proto`-bestand genereert `protoc` client- en server-stubs voor Go, TypeScript, Python, etc. Geen handmatige JSON-parsing meer.
- **Performantie**: binaire serialisatie is compacter en sneller dan JSON. Relevant bij hoge volumes registraties.

> **Zie ook** [§13 Typesystemen vergeleken](#13-typesystemen-vergeleken) voor een brede vergelijking van de typeringskracht van gRPC/protobuf vs. XSD, GraphQL en OAS 3.1.

#### Waar gRPC slechter past

- **Niet JSON over HTTP**: de oorspronkelijke eis was "het moet wel JSON over HTTP zijn". gRPC is standaard binair protobuf over HTTP/2. Er bestaan workarounds:
  - **gRPC-JSON transcoding** (Google API gateway-stijl): maakt het mogelijk om gRPC-services ook via REST/JSON aan te spreken, maar vereist extra configuratie.
  - **Connect (buf.build)**: een moderner protocol dat gRPC-compatibele services aanbiedt over standaard HTTP/1.1 met JSON. Dit dicht het gat grotendeels.
  - **grpc-gateway**: genereert een REST/JSON reverse proxy voor gRPC-services.
- **Browser-support**: native gRPC werkt niet in browsers. gRPC-Web of Connect zijn nodig voor frontend-communicatie.
- **Tooling**: Postman, curl, browser DevTools werken allemaal direct met JSON/REST en GraphQL. Voor gRPC heb je aparte tools nodig (grpcurl, Postman gRPC-support, BloomRPC).
- **Debugging**: binaire payloads zijn niet leesbaar in logfiles, network tabs of replay-bestanden. De huidige v06-aanpak met `request_body` als JSONB in de database werkt direct met leesbare JSON.
- **Geen field selection**: net als de huidige REST-API retourneert gRPC altijd de volledige response-shape. GraphQL biedt hier meer flexibiliteit.

#### gRPC met Connect als tussenoplossing

[Connect](https://connectrpc.com/) (van Buf) is een protocol dat gRPC-services aanbiedt met:
- Standaard HTTP/1.1 + JSON als transportlaag
- Volledige browser-compatibiliteit zonder proxy
- gRPC-wire-compatibiliteit (dezelfde `.proto`, zelfde server)
- Go-server via `connectrpc.com/connect`

Met Connect zou de registratie-API er zo uitzien:

```bash
# JSON over HTTP, browser-compatible
curl -X POST https://api.example.com/bitemporal.v1.BitemporaalRegister/Registreer \
  -H "Content-Type: application/json" \
  -d '{
    "registratietype": "REGISTRATIE",
    "tijdstip": "2026-01-01T09:01:00Z",
    "wijzigingen": [
      { "type": "OPVOER", "a": { "id": "1", "us": [...] } }
    ]
  }'
```

Dit geeft het beste van twee werelden: sterk getypeerde protobuf-definities met JSON over HTTP als transportlaag. Het lost de oorspronkelijke beperking ("moet JSON over HTTP zijn") op.

**Passendheid: ≈55%** (≈70% met Connect als JSON/HTTP transportlaag)

#### Samenvatting gRPC

gRPC zit qua *semantiek* (command-patroon, envelop, polymorfie, typeveiligheid) **dichter bij de registratie-API dan zowel REST als GraphQL**. Het struikelt over het transport: binair protobuf is niet JSON/HTTP. Met Connect als transportlaag wordt dit grotendeels opgelost, waardoor gRPC/Connect een serieus alternatief is — vooral voor de command-kant.

Voor de query-kant (full-opvraag met field selection en variabele diepte) blijft GraphQL sterker.

---

## 6. Classificatie: CQRS + Event Sourcing

De registratie-API past het best bij een combinatie van twee gevestigde architectuurpatronen:

### CQRS (Command Query Responsibility Segregation)

De v06 API scheidt al feitelijk:
- **Commands:** `POST /registratie/` — schrijven, één endpoint, bevat alle mutatie-intentie
- **Queries:** `GET /as/:id`, `GET /full/as/:id`, etc. — lezen, meerdere endpoints per type

De registratie is een **command** in CQRS-terminologie: een intentie om iets te veranderen, met alle benodigde data in één atomair pakket.

### Event Sourcing

De registratie + wijzigingen structuur *is* in essentie event sourcing:

| Event Sourcing concept     | v06 implementatie                                       |
|---------------------------|--------------------------------------------------------|
| Events als bron van waarheid | Wijzigingen worden opgeslagen, niet alleen de eindtoestand |
| Event types               | `opvoer` en `afvoer`                                    |
| Compensating events       | `ongedaanmaking` (draait wijzigingen terug)              |
| Event envelope            | `registratie` (metadata + tijdstip + type)               |
| Replay / tijdreizen       | Formeel tijdreizen = replay van wijzigingen tot t_f      |
| Immutability              | Records worden niet gemuteerd; alleen op-/afgevoerd      |
| Audit trail               | Volledig: request, response, code, duur opgeslagen       |

### Waarom dit de juiste keuze is

1. **Atomiciteit vereist bundeling** — meerdere representaties moeten in één formeel tijdstip worden geregistreerd
2. **Audit trail vereist event sourcing** — je wilt de wijzigingen bewaren, niet alleen de eindtoestand
3. **Tijdreizen vereist immutability** — je muteert niet, je voert op en af
4. **Bitemporaliteit vereist een apart formeel tijdstip** — dit wordt vastgelegd in de registratie, niet per resource

---

## 7. GraphQL-formulering van de registratie-API

Het huidige GraphQL-schema (`graph/schema.graphqls`) definieert conventionele CRUD-mutaties (`createEntityA`, `updateEntityA`, `deleteEntityA`). Dit past **niet** bij de bitemporele registratie-semantiek. Hieronder een voorstel dat de registratie-API vertaalt naar idiomatisch GraphQL, met behoud van de domeinlogica.

### 7.1 Schema-ontwerp

```graphql
# ============ SCALARS ============
scalar DateTime
scalar Date
scalar JSON

# ============ ENUMS ============

enum Registratietype {
  REGISTRATIE
  CORRECTIE
  ONGEDAANMAKING
}

enum Wijzigingstype {
  OPVOER
  AFVOER
}

# ============ MUTATIONS ============

type Mutation {
  """
  Voer een bitemporele registratie uit met nul of meer wijzigingen.
  Alle wijzigingen worden atomair verwerkt in één transactie.
  """
  registreer(input: RegistreerInput!): RegistratieResult!

  """
  Corrigeer een eerdere registratie.
  De corrigerende wijzigingen worden geregistreerd met een verwijzing
  naar de gecorrigeerde registratie.
  """
  corrigeer(input: CorrigeerInput!): RegistratieResult!

  """
  Maak een eerdere registratie ongedaan.
  Alle wijzigingen van de oorspronkelijke registratie worden teruggedraaid.
  """
  maakOngedaan(input: MaakOngedaanInput!): RegistratieResult!
}

# ============ INPUT TYPES ============

input RegistreerInput {
  """Formeel tijdstip van de registratie (ISO 8601). Optioneel; server default = now()."""
  tijdstip: DateTime
  opmerking: String
  wijzigingen: [WijzigingInput!]!
}

input CorrigeerInput {
  """ID van de te corrigeren registratie."""
  corrigeertRegistratieId: ID!
  tijdstip: DateTime
  opmerking: String
  wijzigingen: [WijzigingInput!]!
}

input MaakOngedaanInput {
  """ID van de ongedaan te maken registratie."""
  maaktOngedaanRegistratieId: ID!
  tijdstip: DateTime
  opmerking: String
}

input WijzigingInput {
  type: Wijzigingstype!

  # === Entiteiten ===
  a: AInput
  b: BInput

  # === Gegevenselementen ===
  u: AUInput
  v: AVInput
  w: AWInput
  x: BXInput
  y: BYInput

  # === Relaties ===
  relAB: RelABInput
}

# --- Entiteit inputs ---

input AInput {
  id: ID!
  """Geneste GE's; alleen bij opvoer van een nieuwe entiteit."""
  us: [AUInput!]
  vs: [AVInput!]
  ws: [AWInput!]
  relABs: [RelABInput!]
  aanvang: Date
  einde: Date
}

input BInput {
  id: ID!
  xs: [BXInput!]
  ys: [BYInput!]
  aanvang: Date
  einde: Date
}

# --- Gegevenselement inputs ---

input AUInput {
  aId: ID!
  relId: Int
  aaa: String
  bbb: Boolean
  aanvang: Date
}

input AVInput {
  aId: ID!
  relId: Int
  ccc: String
  ddd: String
  eee: String
  fff: Float
  ggg: ABCEnum
  datum: Date
}

input AWInput {
  aId: ID!
  relId: Int
  float: Float
  heel: Int
  aanvang: Date
  einde: Date
}

input BXInput {
  bId: ID!
  relId: Int
  fff: String
  ggg: String
}

input BYInput {
  bId: ID!
  relId: Int
  hhh: String
}

# --- Relatie inputs ---

input RelABInput {
  aId: ID!
  relId: Int
  bId: ID!
  soort: RelABSoort
  aanvang: Date
  einde: Date
}

# --- Domein-enums ---

enum ABCEnum {
  OPTIE_A
  OPTIE_B
  OPTIE_C
}

enum RelABSoort {
  LTT
  LAT
  LTA
}

# ============ RESULT TYPES ============

type RegistratieResult {
  """Server-toegekend registratie-ID."""
  registratieId: ID!
  tijdstip: DateTime!
  opmerking: String
  registratietype: Registratietype!
  """Verwerkingstijd in milliseconden."""
  durationMs: Int
  """De verwerkte wijzigingen met server-toegekende waarden (opvoer/afvoer timestamps, versies)."""
  wijzigingen: [WijzigingResult!]!
}

type WijzigingResult {
  id: ID!
  type: Wijzigingstype!
  representatienaam: String!
  representatieId: String!
  entiteitnaam: String!
  entiteitId: String!
  versie: Int
  tijdstip: DateTime!
}
```

### 7.2 Voorbeeldmutaties in GraphQL

#### Opvoer entiteit A met geneste GE's

```graphql
mutation OpvoerEntiteitA {
  registreer(input: {
    tijdstip: "2026-01-01T09:01:00Z"
    opmerking: "Initiële opvoer van entiteit A met onderliggende gegevenselementen"
    wijzigingen: [
      {
        type: OPVOER
        a: {
          id: "1"
          us: [{ aId: "1", relId: 1, aaa: "a1", bbb: true, aanvang: "2025-10-07" }]
          vs: [
            { aId: "1", relId: 1, ccc: "c1-1" }
            { aId: "1", relId: 2, ccc: "c1-2" }
          ]
        }
      }
    ]
  }) {
    registratieId
    tijdstip
    durationMs
    wijzigingen {
      id
      type
      representatienaam
      representatieId
    }
  }
}
```

#### Afvoer GE + opvoer nieuw GE

```graphql
mutation WijzigU {
  registreer(input: {
    tijdstip: "2026-01-10T11:02:00Z"
    opmerking: "Afvoer u1 en opvoer u2"
    wijzigingen: [
      { type: AFVOER, u: { aId: "1", relId: 1 } }
      { type: OPVOER, u: { aId: "1", relId: 2, aaa: "aaa a1", bbb: true } }
    ]
  }) {
    registratieId
    tijdstip
    wijzigingen { id type representatienaam }
  }
}
```

#### Correctie

```graphql
mutation CorrigeerRegistratie {
  corrigeer(input: {
    corrigeertRegistratieId: "1"
    tijdstip: "2026-01-12T11:00:00Z"
    opmerking: "Corrigeer U3 van entiteit A2"
    wijzigingen: [
      { type: OPVOER, u: { aId: "2", relId: 3, aaa: "a2-correctie" } }
    ]
  }) {
    registratieId
    tijdstip
    wijzigingen { id type representatienaam }
  }
}
```

#### Ongedaanmaking

```graphql
mutation MaakOngedaan {
  maakOngedaan(input: {
    maaktOngedaanRegistratieId: "5"
    tijdstip: "2026-01-20T14:00:00Z"
    opmerking: "Ongedaanmaking van registratie 5"
  }) {
    registratieId
    tijdstip
    registratietype
  }
}
```

### 7.3 Vergelijking REST-registratie vs GraphQL-formulering

| Aspect                   | Huidige REST (`POST /registratie/`) | Voorgestelde GraphQL                        |
|--------------------------|--------------------------------------|---------------------------------------------|
| Endpoint                 | `POST /registratie/`                 | `POST /graphql` (unified)                   |
| Operatietype             | In `registratietype` veld            | Aparte mutations (`registreer`, `corrigeer`, `maakOngedaan`) |
| Wijzigingstype           | Impliciet via `opvoer`/`afvoer` key  | Expliciet via `type: OPVOER` enum           |
| Representatietype        | Impliciet via JSON payload-key       | Expliciet via apart inputveld (`a`, `u`, `relAB`) |
| Typeveiligheid           | Runtime (handler parseert JSON)      | Compiletime (schema-validatie)              |
| Response field selection | Hele response altijd terug           | Client kiest welke velden terugkomen        |
| Schema-documentatie      | Via aparte `/schema` API             | Ingebouwde introspectie (`__schema`)        |
| Atomiciteit              | ✅ Alle wijzigingen in één transactie | ✅ Identiek (resolver-logica ongewijzigd)   |
| Audit trail              | ✅ Ingebouwd                         | ✅ Ongewijzigd (resolver slaat alles op)    |

### 7.4 Trade-offs

**Voordelen van de GraphQL-formulering:**
- Sterkere typeveiligheid door schema-validatie
- Client bepaalt welke velden in de response worden meegeleverd
- Ingebouwde schema-introspectie en documentatie
- Aparte mutations voor registreer/corrigeer/maakOngedaan maken de intentie explicieter
- Operatie-type (`OPVOER`/`AFVOER`) als enum in plaats van impliciet via key-structuur

**Nadelen / aandachtspunten:**
- GraphQL mutations in een array zijn *niet* gegarandeerd atomair in standaard GraphQL — de resolver moet dit zelf regelen (net als nu)
- De polymorfie van `WijzigingInput` (één van `a`, `u`, `v`, `relAB` etc. is gevuld) is in GraphQL lastiger te valideren dan in REST; GraphQL kent geen echte union inputs (er is een [RFC voor `@oneOf`](https://github.com/graphql/graphql-spec/pull/825) maar die is nog niet geratificeerd)
- De geneste opvoer (entiteit + GE's in één wijziging) maakt de input-types diep genest
- Bestaande clients moeten worden omgebouwd

---

## 8. GraphQL-formulering van de full-opvraag API's

De huidige REST API biedt "full" endpoints die een entiteit inclusief al haar geneste GE's, relaties en temporele plumbing teruggeven:

```
GET /full/as        → alle A's met geneste GE's/relaties
GET /full/as/:id    → één A met geneste GE's/relaties
```

### 8.1 Typen voor full-opvraag

```graphql
# ============ QUERIES ============

type Query {
  """Haal één entiteit A op met al haar gegevenselementen, relaties en temporele data."""
  entiteitA(id: ID!): EntiteitA

  """Haal alle entiteiten A op. Optioneel met formeel/materieel peiltijdstip."""
  entiteitenA(
    limit: Int
    offset: Int
    """Formeel peiltijdstip: toon de toestand zoals geregistreerd op dit moment."""
    formeelPeiltijdstip: DateTime
    """Materieel peiltijdstip: toon de toestand die geldt op deze datum."""
    materieelPeiltijdstip: Date
  ): [EntiteitA!]!

  entiteitB(id: ID!): EntiteitB
  entiteitenB(limit: Int, offset: Int, formeelPeiltijdstip: DateTime, materieelPeiltijdstip: Date): [EntiteitB!]!

  """Haal registraties op met hun wijzigingen."""
  registratie(id: ID!): Registratie
  registraties(limit: Int, offset: Int): [Registratie!]!
}

# ============ FULL ENTITY TYPES ============

type EntiteitA {
  id: ID!
  opvoer: DateTime
  afvoer: DateTime

  # Gegevenselementen
  us: [GegevensElementAU!]!
  vs: [GegevensElementAV!]!
  ws: [GegevensElementAW!]!

  # Relaties
  relABs: [RelatieAB!]!

  # Materiële-tijd plumbing
  aanvang: [AanvangRecord!]!
  einde: [EindeRecord!]!

  # Afgeleide velden (berekend door resolver)
  """Actuele aanvangsdatum (meest recente versie)."""
  actueleAanvang: Date
  """Actueel einde (meest recente versie), null als er geen einde is."""
  actueleEinde: Date
}

type EntiteitB {
  id: ID!
  opvoer: DateTime
  afvoer: DateTime
  xs: [GegevensElementBX!]!
  ys: [GegevensElementBY!]!
  aanvang: [AanvangRecord!]!
  einde: [EindeRecord!]!
  actueleAanvang: Date
  actueleEinde: Date
}

# ============ GEGEVENSELEMENT TYPES ============

type GegevensElementAU {
  aId: ID!
  relId: Int!
  opvoer: DateTime
  afvoer: DateTime
  """Versiegeschiedenis van de data (meest recent eerst)."""
  data: [AUData!]!
}

type AUData {
  aId: ID!
  relId: Int!
  versie: Int!
  aaa: String!
  bbb: Boolean
  opvoer: DateTime
  afvoer: DateTime
}

type GegevensElementAV {
  aId: ID!
  relId: Int!
  opvoer: DateTime
  afvoer: DateTime
  data: [AVData!]!
}

type AVData {
  aId: ID!
  relId: Int!
  versie: Int!
  ccc: String!
  ddd: String
  eee: String
  fff: Float!
  ggg: ABCEnum!
  datum: Date
  opvoer: DateTime
  afvoer: DateTime
}

type GegevensElementAW {
  aId: ID!
  relId: Int!
  opvoer: DateTime
  afvoer: DateTime
  data: [AWData!]!
  aanvang: [AanvangRecord!]!
  einde: [EindeRecord!]!
}

type AWData {
  aId: ID!
  relId: Int!
  versie: Int!
  float: Float!
  heel: Int!
  opvoer: DateTime
  afvoer: DateTime
}

type GegevensElementBX {
  bId: ID!
  relId: Int!
  opvoer: DateTime
  afvoer: DateTime
  data: [BXData!]!
}

type BXData {
  bId: ID!
  relId: Int!
  versie: Int!
  fff: String!
  ggg: String!
  opvoer: DateTime
  afvoer: DateTime
}

type GegevensElementBY {
  bId: ID!
  relId: Int!
  opvoer: DateTime
  afvoer: DateTime
  data: [BYData!]!
}

type BYData {
  bId: ID!
  relId: Int!
  versie: Int!
  hhh: String!
  opvoer: DateTime
  afvoer: DateTime
}

# ============ RELATIE TYPES ============

type RelatieAB {
  aId: ID!
  relId: Int!
  bId: ID!
  opvoer: DateTime
  afvoer: DateTime
  data: [RelABData!]!
  aanvang: [AanvangRecord!]!
  einde: [EindeRecord!]!
  """De gerelateerde entiteit B (resolved via bId)."""
  entiteitB: EntiteitB
}

type RelABData {
  aId: ID!
  relId: Int!
  versie: Int!
  soort: RelABSoort!
  opvoer: DateTime
  afvoer: DateTime
}

# ============ TEMPORELE PLUMBING ============

type AanvangRecord {
  versie: Int!
  datum: Date
  opvoer: DateTime
  afvoer: DateTime
}

type EindeRecord {
  versie: Int!
  datum: Date
  opvoer: DateTime
  afvoer: DateTime
}

# ============ AUDIT TYPES ============

type Registratie {
  id: ID!
  registratietype: Registratietype!
  tijdstip: DateTime!
  opmerking: String
  corrigeertRegistratieId: ID
  maaktOngedaanRegistratieId: ID
  isOngedaangemaakt: Boolean!
  wijzigingen: [Wijziging!]!
}

type Wijziging {
  id: ID!
  wijzigingstype: Wijzigingstype!
  registratieId: ID!
  entiteitnaam: String!
  entiteitId: String!
  representatienaam: String!
  representatieId: String!
  versie: Int
  tijdstip: DateTime!
  isOngedaangemaakt: Boolean!
}
```

### 8.2 Voorbeeld-queries

#### Full entity A ophalen

```graphql
query HaalEntiteitAOp {
  entiteitA(id: "1") {
    id
    opvoer
    afvoer
    actueleAanvang
    actueleEinde
    us {
      relId
      opvoer
      afvoer
      data {
        versie
        aaa
        bbb
        opvoer
        afvoer
      }
    }
    vs {
      relId
      data {
        versie
        ccc
        fff
        ggg
      }
    }
    relABs {
      relId
      bId
      data { soort }
      entiteitB {
        id
        xs { data { fff ggg } }
      }
    }
  }
}
```

#### Formeel tijdreizen

```graphql
query FormeleStandVanZaken {
  entiteitenA(
    formeelPeiltijdstip: "2026-01-05T00:00:00Z"
  ) {
    id
    opvoer
    us {
      relId
      data { aaa bbb opvoer afvoer }
    }
  }
}
```

#### Registraties met wijzigingen

```graphql
query BekijkRegistraties {
  registraties(limit: 10) {
    id
    registratietype
    tijdstip
    opmerking
    isOngedaangemaakt
    wijzigingen {
      wijzigingstype
      representatienaam
      representatieId
      entiteitnaam
      entiteitId
    }
  }
}
```

### 8.3 Kracht van GraphQL voor de full-opvraag

De full-opvraag API's zijn het punt waar GraphQL het **meeste toevoegt** ten opzichte van de huidige REST-aanpak:

| Aspect                    | REST (`GET /full/as/:id`)             | GraphQL                                      |
|---------------------------|---------------------------------------|----------------------------------------------|
| Data selectie             | Altijd alle GE's en relaties           | Client kiest precies welke GE's en velden    |
| Diepte                    | Vaste nesting-diepte                   | Client bepaalt diepte (bijv. wel/niet relatie-B resolven) |
| Tijdreisparameters        | Query params (`?t=...`)                | Typed arguments op query-velden              |
| N+1 probleem              | Server lost op (Bun eager loading)     | Resolvers + dataloaders                      |
| Over-fetching             | Vaak (alle velden komen terug)         | Opgelost door field selection                |
| Under-fetching            | Soms (aparte call voor relaties nodig) | Opgelost door nesting in query               |
| Schema-documentatie       | Aparte `/schema` API                   | Ingebouwde introspectie + field descriptions |
| Caching                   | HTTP caching (ETag, Last-Modified)     | Lastiger (POST), maar Apollo/Relay cache     |

---

## 9. Conclusie

### De registratie-API is geen REST, geen GraphQL, maar CQRS + Event Sourcing

De `POST /registratie/` API is een **command-endpoint** dat past in het CQRS + Event Sourcing patroon. Dit is een bewuste en architecturaal correcte keuze voor een bitemporeel register. Er is geen bestaande JSON/HTTP-standaard die dit patroon exact afdekt, maar de combinatie is breed geaccepteerd in domain-driven design.

### GraphQL kan twee dingen toevoegen

1. **Voor queries (full-opvraag):** GraphQL is een sterke match. De field selection, nesting en typed arguments sluiten goed aan bij de complexe, diep geneste structuur van bitemporele entiteiten met GE's, relaties en temporele plumbing. Hier is de meerwaarde het grootst.

2. **Voor mutations (registratie):** GraphQL kan de registratie-semantiek uitdrukken, maar voegt minder toe. De typeveiligheid en schema-introspectie zijn waardevol, maar de kern van de registratie-logica (atomaire transactie, audit trail, ongedaanmaking) blijft in de resolver/handler ongeacht het protocol.

### gRPC/Connect als derde optie

gRPC (met Connect als JSON/HTTP-transportlaag) scoort qua command-semantiek het hoogst van alle standaarden na CQRS+ES zelf. Protobuf's `oneof` lost het polymorfieprobleem op dat GraphQL niet heeft, en code-generatie bespaart handmatige parsing. Het nadeel is dat gRPC geen field selection biedt en minder geschikt is voor de query-kant.

### Aanbeveling

Een **hybride aanpak** is het meest pragmatisch:
- **GraphQL voor queries**: benutten van field selection en diepte-controle voor de full-opvraag API's
- **De huidige `POST /registratie/` voor mutaties**: behouden of optioneel parallel een GraphQL-mutation aanbieden
- **gRPC/Connect als toekomstige optie**: als er behoefte komt aan sterk getypeerde, gegenereerde clients voor de command-kant, dan is gRPC/Connect een sterkere kandidaat dan GraphQL-mutations
- De drie hoeven niet exclusief te zijn — ze kunnen naast elkaar bestaan

---

## 10. Migratiepad naar een hybride API

Als v06 zich doorontwikkelt richting een combinatie van REST en GraphQL, dan is het verstandig om **niet** eerst de registratie-mutaties naar GraphQL om te bouwen, maar te beginnen bij de query-kant. Daar is de winst direct zichtbaar en het risico kleiner.

### Fase 0: huidige situatie expliciet stabiliseren

Doel:
- de huidige registratie-API behouden als primaire schrijf-API
- de huidige full-REST endpoints als referentiegedrag beschouwen
- de GraphQL-laag niet als CRUD-experiment behandelen, maar als alternatieve query- en eventueel command-protocol-laag

Concreet:
- `POST /registratie/` blijft de bron voor alle formele registraties
- `GET /full/...` blijft de functionele referentie voor GraphQL full-queries
- het bestaande GraphQL-schema met CRUD-mutaties voor `createEntityA`, `updateEntityA` enzovoort wordt gezien als tijdelijk en niet leidend

### Fase 1: GraphQL eerst alleen voor lezen

Doel:
- full-opvraag in GraphQL beschikbaar maken zonder de mutatiekant aan te raken

Concreet:
- introduceer queryvelden zoals `entiteitA`, `entiteitenA`, `entiteitB`, `registratie`, `registraties`
- laat deze resolvers intern zoveel mogelijk dezelfde query-logica gebruiken als de bestaande full-handlers
- voeg formeel en materieel peiltijdstip toe als query-argumenten

Voordeel:
- de semantiek van v06 blijft intact
- de frontend kan experimenteren met GraphQL zonder risico op inconsistente mutaties
- eventuele performanceproblemen blijven beperkt tot de read-kant

### Fase 2: schema-gedreven GraphQL-querylaag koppelen aan MetaRegistry

Doel:
- voorkomen dat GraphQL een tweede handmatig gemodelleerde wereld wordt naast MetaRegistry en schema-API

Concreet:
- gebruik de MetaRegistry als bron voor type- en padmetadata
- gebruik dezelfde velddefinities en onderliggende relatie-informatie als de schema-API
- houd naamgeving in lijn met het domein en niet met generieke CRUD-namen

Dit is belangrijk omdat anders drie parallelle waarheden ontstaan:
- de Go-modellen
- de schema-API / MetaRegistry
- het GraphQL-schema

Voor v06 moet juist de bestaande architectuur behouden blijven: één metamodel, meerdere projecties.

### Fase 3: audit- en registratie-query's in GraphQL

Doel:
- de registratie- en wijzigingstabellen ook via GraphQL ontsluiten

Concreet:
- voeg queryvelden toe voor `registratie(id)`, `registraties(...)`, `wijziging(id)`, `wijzigingen(...)`
- maak nested opvraging van `registratie -> wijzigingen` en eventueel `wijziging -> registratie` mogelijk
- voeg filters toe op `registratietype`, `tijdstip`, `isOngedaangemaakt`

Deze fase is nuttig omdat audit-inzage inhoudelijk sterk past bij GraphQL: clients willen vaak net andere doorsneden van de audittrail.

### Fase 4: optionele GraphQL-commandlaag bovenop dezelfde registratie-service

Doel:
- een GraphQL-mutationpad aanbieden zonder een tweede mutatie-implementatie te bouwen

Concreet:
- introduceer mutations `registreer`, `corrigeer`, `maakOngedaan`
- laat deze resolvers intern dezelfde domeinservice of handlerlogica aanroepen als `POST /registratie/`
- voorkom duplicatie van validatie, transacties, auditlogging en afleidingslogica

Belangrijk uitgangspunt:

> GraphQL mag in v06 hooguit een **extra protocol-laag** zijn, niet een tweede implementatie van het registratiedomein.

### Fase 5: evalueren of REST-mutaties nog nodig zijn

Pas nadat de GraphQL-commandlaag stabiel is, kan bekeken worden of:
- `POST /registratie/` de hoofdroute blijft
- GraphQL-mutaties een volwaardig alternatief worden
- beide blijvend naast elkaar bestaan

Waarschijnlijk blijft een dubbele beschikbaarheid het meest pragmatisch:
- REST voor eenvoudige integraties en replay-bestanden
- GraphQL voor interactieve clients en rijke UI-opvraging

---

## 11. Wat eerst in GraphQL moet landen

Niet alles levert evenveel op. De beste volgorde is die waarin de **meerwaarde per implementatie-inspanning** het hoogst is.

### Prioriteit 1: full-opvraag van entiteiten

Als eerste kandidaten:
- `entiteitA(id, formeelPeiltijdstip, materieelPeiltijdstip)`
- `entiteitenA(...)`
- `entiteitB(...)`
- `entiteitenB(...)`

Waarom eerst:
- dit vervangt direct de zwaarste `GET /full/...` use-cases
- hier is de winst van field selection het grootst
- dit sluit aan op frontend-behoeften: schermen vragen vaak niet alle geneste velden tegelijk op

### Prioriteit 2: registratie- en wijzigingsquery's

Als tweede:
- `registratie(id)`
- `registraties(limit, offset, filters...)`
- `wijziging(id)`
- `wijzigingen(...)`

Waarom vroeg:
- audit-trail en terugkijken zijn van nature query-zwaar
- GraphQL is sterk in doorsneden zoals: alleen kopgegevens, alleen wijzigingmetadata, of inclusief details

### Prioriteit 3: full-opvraag van relaties en materiële GE's

Daarna:
- relaties zoals `relatieAB`
- materiële gegevenselementen met `aanvang` en `einde`
- eventueel gespecialiseerde query's per representatietype

Waarom daarna:
- dit voegt diepte toe aan het domeinmodel in GraphQL
- deze delen vragen vaak meer resolver-werk en aandacht voor N+1-problemen

### Prioriteit 4: alleen daarna de mutaties

Pas daarna:
- `registreer`
- `corrigeer`
- `maakOngedaan`

Waarom later:
- het domeinrisico zit vooral aan de mutatiekant
- de bestaande REST-command API werkt al en heeft auditgedrag
- GraphQL-mutaties leveren minder onmiddellijke functionele winst op dan GraphQL-queries

### Wat beter níet eerst moet gebeuren

Wat ik expliciet zou afraden als eerste GraphQL-stap:
- generieke CRUD-mutaties per representatie zoals `createEntityA`, `updateEntityA`, `deleteEntityA`
- losstaande update-mutaties op GE-data buiten registratie om
- een schema waarin GraphQL resource-mutaties aanbiedt die de formele registratielogica omzeilen

Dat zou botsen met de kern van v06:
- wijzigingen horen formeel via registratie te lopen
- de audittrail moet uniform blijven
- er mag geen tweede semantiek ontstaan naast opvoer/afvoer/correctie/ongedaanmaking

---

## 12. Een v06-nabij GraphQL-schema

De eerder voorgestelde GraphQL-vorm was bewust idiomatisch GraphQL. Voor v06 zelf is echter een tweede, nog pragmatischer variant nuttig: een schema dat **dichter op de huidige MetaRegistry- en registratie-architectuur zit** en dus met minder vertaalslag implementeerbaar is.

### Ontwerpprincipes voor een v06-nabij schema

> **Zie ook** [§13 Typesystemen vergeleken](#13-typesystemen-vergeleken) voor de typeringssterktes en -zwaktes van GraphQL in vergelijking met XSD, gRPC/protobuf en OAS 3.1.

1. Gebruik domeinnamen uit v06, niet generieke CRUD-terminologie.
2. Houd de registratie-semantiek centraal.
3. Laat GraphQL vooral een projectielaag zijn bovenop bestaande query- en commandservices.
4. Accepteer waar nodig wat meer generieke payloads als dat duplicatie voorkomt.
5. Laat de MetaRegistry leidend blijven voor typekennis.

### Variant A: sterk getypeerd en domeinzuiver

Dit is de mooiste vorm voor clients, maar niet de goedkoopste om te bouwen:

```graphql
scalar DateTime
scalar Date

enum Registratietype {
  REGISTRATIE
  CORRECTIE
  ONGEDAANMAKING
}

enum Wijzigingstype {
  OPVOER
  AFVOER
}

type Query {
  entiteitA(id: ID!, formeelPeiltijdstip: DateTime, materieelPeiltijdstip: Date): EntiteitA
  entiteitenA(limit: Int, offset: Int, formeelPeiltijdstip: DateTime, materieelPeiltijdstip: Date): [EntiteitA!]!
  entiteitB(id: ID!, formeelPeiltijdstip: DateTime, materieelPeiltijdstip: Date): EntiteitB
  entiteitenB(limit: Int, offset: Int, formeelPeiltijdstip: DateTime, materieelPeiltijdstip: Date): [EntiteitB!]!
  registratie(id: ID!): Registratie
  registraties(limit: Int, offset: Int): [Registratie!]!
}

type Mutation {
  registreer(input: RegistreerInput!): RegistratieResult!
  corrigeer(input: CorrigeerInput!): RegistratieResult!
  maakOngedaan(input: MaakOngedaanInput!): RegistratieResult!
}
```

Dit is inhoudelijk het beste model als GraphQL echt een first-class API moet worden.

### Variant B: MetaRegistry-nabij en implementatievriendelijk

Deze variant sluit nauwer aan op de huidige architectuur. In plaats van elk representatietype volledig als aparte input-structuur te modelleren, gebruikt deze variant de schema-API en MetaRegistry impliciet en draagt de payload generieker over.

```graphql
scalar DateTime
scalar Date
scalar JSON

enum Registratietype {
  REGISTRATIE
  CORRECTIE
  ONGEDAANMAKING
}

enum Wijzigingstype {
  OPVOER
  AFVOER
}

type Query {
  entity(typeNaam: String!, id: ID!, formeelPeiltijdstip: DateTime, materieelPeiltijdstip: Date): JSON
  entities(typeNaam: String!, limit: Int, offset: Int, formeelPeiltijdstip: DateTime, materieelPeiltijdstip: Date): [JSON!]!
  fullEntity(typeNaam: String!, id: ID!, formeelPeiltijdstip: DateTime, materieelPeiltijdstip: Date): JSON
  fullEntities(typeNaam: String!, limit: Int, offset: Int, formeelPeiltijdstip: DateTime, materieelPeiltijdstip: Date): [JSON!]!
  registratie(id: ID!): JSON
  registraties(limit: Int, offset: Int): [JSON!]!
}

input WijzigingInput {
  wijzigingstype: Wijzigingstype!
  typeNaam: String!
  payload: JSON!
}

input RegistreerInput {
  registratietype: Registratietype!
  tijdstip: DateTime
  opmerking: String
  corrigeertRegistratieId: ID
  maaktOngedaanRegistratieId: ID
  wijzigingen: [WijzigingInput!]!
}

type Mutation {
  registreer(input: RegistreerInput!): JSON!
}
```

Deze variant is minder elegant voor GraphQL-puristen, maar heeft echte voordelen voor v06:
- minimale duplicatie van types tussen schema-API en GraphQL
- direct koppelbaar aan MetaRegistry
- makkelijker uitbreidbaar bij nieuwe representatietypen
- lager risico op schema-drift

### Variant C: aanbevolen tussenvariant

Voor v06 lijkt een tussenvariant het meest verstandig:

- **typed GraphQL queries** voor de belangrijkste full-opvraag use-cases
- **meer generieke GraphQL mutations** voor registratie
- audit- en beheerquery's eventueel eerst generieker, later strakker getypeerd

Concreet betekent dat:
- `entiteitA`, `entiteitenA`, `entiteitB`, `registratie`, `registraties` typed modelleren
- `registreer` modelleren als mutation met een relatief generieke `WijzigingInput`
- geen CRUD-mutaties per representatie toevoegen

### Concreet voorstel voor v06

Als ik het zou aanscherpen tot een implementatieadvies, dan zou ik voor v06 deze lijn kiezen:

1. Houd `POST /registratie/` aan als canonieke command-API.
2. Bouw GraphQL eerst uit tot volwaardige read-API voor full-opvraging en audit.
3. Laat de resolvers intern dezelfde services gebruiken als de bestaande full-handlers.
4. Voeg alleen daarna een `registreer` mutation toe die dezelfde registratie-service aanroept.
5. Voeg pas in een latere fase aparte `corrigeer` en `maakOngedaan` mutations toe, of modelleer die eerst als varianten van `registreer` via `registratietype`.

Daarmee blijft de v06-architectuur coherent:
- MetaRegistry blijft de bron voor typekennis
- de schema-API blijft bruikbaar voor frontend-dynamiek
- GraphQL wordt een extra toegangsvorm, niet een concurrerende architectuur

---

## 13. Typesystemen vergeleken

> *Met XSD als referentiekader — de "gouden standaard" voor typering — vergelijken we hier de kracht van de typesystemen van alle besproken standaarden, en de consequenties voor de polymorfe registratie-payload van v06.*

### Waarom typering ertoe doet

De v06 registratie-API heeft een fundamenteel **polymorf** datamodel: de `wijzigingen[]`-array in een registratie-payload kan representaties bevatten van willekeurig welk type (A, A_U, A_V, A_W, B, B_X, B_Y, Rel_A_B, A_Aanvang, A_Einde, …). Het type wordt bepaald door de JSON-key van het object:

```json
{
  "wijzigingen": [
    { "type_wijziging": "opvoer", "a": { "id": 1 } },
    { "type_wijziging": "opvoer", "a_u": { "a_id": 1, "aaa": "test" } }
  ]
}
```

In de huidige situatie is er **geen compile-time validatie** van deze payload: de Go-handler parseert de JSON at runtime en controleert handmatig of de key-naam overeenkomt met een geldig MetaRegistry-type. Dit werkt, maar biedt geen bescherming tegen typefouten, missende velden of ongeldige combinaties tot het moment van uitvoering.

De kracht van een typesysteem bepaalt **hoeveel van deze fouten je vooraf kunt afvangen** — in het schema, bij code-generatie, of bij compilatie — in plaats van pas in productie.

### XSD als referentiekader

XSD (XML Schema Definition) is het historische ijkpunt voor *sterke, declaratieve typering*. Het werd ontwikkeld voor XML-webservices (SOAP/WSDL) en biedt mogelijkheden die geen enkele JSON-gebaseerde standaard volledig heeft overgenomen:

| XSD-mogelijkheid | Wat het doet | Voorbeeld |
|---|---|---|
| **Named complexTypes** | Nominale types met een naam, herbruikbaar en refereerbaar | `<xs:complexType name="AdresType">` |
| **xs:choice** | Discriminated union: precies één van de opgegeven elementen is aanwezig | `<xs:choice><xs:element ref="a"/><xs:element ref="a_u"/></xs:choice>` |
| **Facets** | Constraints op waarden: min/max, lengte, regex-pattern, enumeraties | `<xs:restriction base="xs:string"><xs:pattern value="[0-9]{4}[A-Z]{2}"/></xs:restriction>` |
| **Extension/restriction** | Echte overerving: een type kan een ander type uitbreiden of inperken | `<xs:extension base="BasisAdresType">` |
| **Opmerkingen (annotations)** | Documentatie in het schema zelf | `<xs:annotation><xs:documentation>Postcode NL</xs:documentation></xs:annotation>` |
| **Named simpleTypes** | Herbruikbare basistype-restricties | `<xs:simpleType name="Postcode"><xs:restriction base="xs:string">…</xs:restriction></xs:simpleType>` |
| **Sequence/all/choice** | Exacte volgorde-controle en verplicht/optioneel per element | `<xs:sequence><xs:element name="straat" minOccurs="1"/>…</xs:sequence>` |

Dit maakt het mogelijk om een *compleet, zelfbeschrijvend en valideerbaar contract* te definiëren dat bij compilatie al fouten vangt. De keerzijde: XSD is verbose, complex, en gebonden aan XML.

### Vergelijking op 7 typeringsdimensies

| Dimensie | XSD | gRPC / protobuf | GraphQL | OAS 3.1 / JSON Schema | v06 huidig |
|---|---|---|---|---|---|
| **Nominale types** | ✅ `complexType` met naam | ✅ `message` met naam | ✅ `type` / `input` / `enum` | ❌ Structureel (anoniem tenzij `$ref`) | ❌ Go structs, niet in protocol |
| **Discriminated unions** | ✅ `xs:choice` | ✅ `oneof` (input + output) | ⚠️ `union` alleen output; geen union input (`@oneOf` RFC pending) | ⚠️ `oneOf` + `discriminator` (fragiel, geen compiler-check) | ❌ JSON key-naam, runtime detectie |
| **Facets / constraints** | ✅ pattern, minLength, maxLength, minInclusive, maxInclusive, totalDigits, enumeration | ❌ Niet in protobuf zelf; via `protoc-gen-validate` plugin (buf.build/validate) | ❌ Niet ingebouwd; via custom `@constraint` directives (niet standaard) | ⚠️ `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `enum` — aanwezig maar niet alle validators controleren ze | ❌ Handmatige validatie in Go |
| **Overerving** | ✅ `extension` en `restriction` op complexTypes | ❌ Geen (alleen compositie via nesting) | ⚠️ `interface` (beperkt: geen field overrides, geen echte specialisatie) | ⚠️ `allOf` (compositie, geen echte overerving; geen restriction) | ❌ Interface-implementatie in Go |
| **Code-generatie** | ✅ JAXB (Java), xsd.exe (.NET), generateDS (Python) — volwassen | ✅ `protoc` — uitstekend, multi-taal (Go, TS, Python, Java, C#, …) | ✅ codegen (gqlgen, graphql-codegen) — goed voor queries, matig voor mutations | ⚠️ openapi-generator — breed maar inconsistente kwaliteit; veel handwerk nodig | ❌ Handmatig |
| **Runtime introspectie** | ❌ Schema is extern bestand, niet queryable | ⚠️ Protobuf reflection (beschikbaar maar niet standaard in alle talen) | ✅ Ingebouwd (`__schema`, `__type`) — eerste klas | ✅ Schema als JSON/YAML document, OpenAPI UI's (Swagger, Redoc) | ⚠️ Eigen `/schema` API |
| **Composability** | ✅ `xs:import`, `xs:include`, `xs:redefine` voor cross-schema hergebruik | ✅ `import` statements, packages, cross-proto referenties | ⚠️ Schema-stitching, federation (Apollo) — werkt maar complex | ✅ `$ref` naar externe/interne schema's | ❌ Alles in één MetaRegistry |

### Per standaard: sterkte en zwakte

#### XSD — de gouden standaard

**Sterkte**: XSD is het enige systeem dat *alle zeven dimensies* afdekt. Een XSD-schema voor de v06 registratie-payload zou er zo uitzien:

```xml
<xs:complexType name="WijzigingType">
  <xs:sequence>
    <xs:element name="type_wijziging" type="WijzigingstypeEnum"/>
    <xs:choice>
      <xs:element name="a" type="AType"/>
      <xs:element name="a_u" type="AUType"/>
      <xs:element name="a_v" type="AVType"/>
      <xs:element name="b" type="BType"/>
      <xs:element name="rel_a_b" type="RelABType"/>
      <!-- etc. -->
    </xs:choice>
  </xs:sequence>
</xs:complexType>

<xs:simpleType name="Postcode">
  <xs:restriction base="xs:string">
    <xs:pattern value="[0-9]{4}[A-Z]{2}"/>
  </xs:restriction>
</xs:simpleType>
```

`xs:choice` garandeert dat precies één representatietype aanwezig is. `xs:restriction` met `xs:pattern` valideert formaten. JAXB genereert Java-klassen met compile-time checks.

**Zwakte**: XML is verbose, JSON is de standaard voor web-API's, en XSD-tooling voor Go/TypeScript is beperkt. In de context van v06 (JSON over HTTP) is XSD niet direct toepasbaar, maar het *concept* is het referentiekader.

#### OAS 3.1 / JSON Schema — constructief maar zwak

JSON Schema (waarop OAS 3.1 is gebaseerd) is fundamenteel **structureel en niet nominaal**: types worden gedefinieerd door hun structuur, niet door een naam. Twee objecten met dezelfde velden zijn hetzelfde type, ook al heten ze anders. Dit maakt discriminated unions fragiel:

```yaml
# OAS 3.1 poging tot polymorfie
WijzigingInput:
  type: object
  properties:
    type_wijziging:
      type: string
      enum: [opvoer, afvoer]
  oneOf:
    - $ref: '#/components/schemas/WijzigingMetA'
    - $ref: '#/components/schemas/WijzigingMetAU'
    - $ref: '#/components/schemas/WijzigingMetB'
  discriminator:
    propertyName: _representatie_type  # moet als veld bestaan!
    mapping:
      a: '#/components/schemas/WijzigingMetA'
      a_u: '#/components/schemas/WijzigingMetAU'
```

**Problemen:**
- `discriminator` vereist een *expliciet veld* in het object — het kan niet discrimineren op de *aanwezigheid* van een key (wat v06 feitelijk doet)
- `oneOf` is een *validator*, geen *type-constructor*: het controleert achteraf, niet vooraf
- Geen facets als onderdeel van het type: `pattern`, `minLength` etc. zijn losse keywords, niet composeerbaar tot named types
- Code-generatie is inconsistent: openapi-generator produceert voor `oneOf` vaak `interface{}` of `any` in gegenereerde code
- Geen echte overerving: `allOf` is compositie ("voeg velden samen"), niet specialisatie

Vergelijking met XSD:
- Waar XSD `xs:choice` zegt "precies één van deze *types*", zegt OAS `oneOf` "het object valideert tegen precies één van deze *schema's*" — subtiel maar fundamenteel verschil
- Waar XSD `xs:restriction` een *nieuw type* maakt (refererbaar, composeerbaar), is JSON Schema `pattern` een *validatieregel* op een anoniem schema

**Passendheid voor v06**: zwak. Het polymorfie-patroon (type bepaald door key-naam) is niet idiomatisch OAS. De Zalando- en MS Graph-guidelines helpen hier ook niet: zij bouwen voort op OAS en erven dezelfde zwaktes.

#### GraphQL — sterk voor output, zwak voor input

GraphQL heeft een **nominaal typesysteem** met named types, enums, interfaces en unions. Voor de *query-kant* is dit uitstekend: de client krijgt exact het type dat het schema beschrijft, met compile-time validatie via codegen.

Voor de *mutatie-kant* (de command-kant, waar v06's registratie-API zit) is GraphQL zwakker:

- **Geen union inputs**: het kan `union WijzigingPayload = AInput | AUInput | BInput` niet definiëren als input-type. De `@oneOf` RFC is sinds 2021 in discussie maar nog niet geratificeerd.
- **Geen constraints**: er is geen standaard manier om `minLength`, `pattern`, of bereik-validatie in het schema uit te drukken. Custom directives (`@constraint(minLength: 5)`) bestaan maar zijn niet universeel.
- **Workarounds voor polymorfie**: je moet ofwel alle mogelijke representaties als nullable velden in één input type zetten (lelijk en foutgevoelig), ofwel aparte mutations per type maken (verliest de bundeling).

Vergelijking met XSD:
- XSD's `xs:choice` ≈ GraphQL's `union` — maar GraphQL beperkt dit tot output
- XSD's facets ≈ niets in standaard GraphQL
- XSD's `extension` ≈ GraphQL's `interface` — maar GraphQL `interface` kan geen velden overriden of restricties toevoegen

Vergelijking met gRPC:
- gRPC's `oneof` werkt voor input én output; GraphQL's `union` alleen voor output
- gRPC's `protoc` genereert sterkere types dan GraphQL codegen voor mutations

**Passendheid voor v06 typering**: goed voor queries (field selection + typed responses), matig voor mutations (polymorfie-probleem).

#### gRPC / protobuf — sterkste na XSD voor commands

Protobuf is een **nominaal, sterk getypeerd** IDL met echte discriminated unions via `oneof`. Voor de command-kant van v06 is dit de sterkste match na XSD:

```protobuf
message WijzigingInput {
  WijzigingsType type_wijziging = 1;
  oneof representatie {
    AInput a = 10;
    AUInput a_u = 11;
    AVInput a_v = 12;
    BWInput a_w = 13;
    BInput b = 20;
    BXInput b_x = 21;
    BYInput b_y = 22;
    RelABInput rel_a_b = 30;
  }
}
```

- `oneof` garandeert dat precies één veld gezet is — compile-time check
- `protoc` genereert Go-code met type-safe accessor-methoden
- Geen facets in protobuf zelf, maar `protoc-gen-validate` (buf.build) voegt dit toe:

```protobuf
import "validate/validate.proto";

message AUInput {
  int64 a_id = 1 [(validate.rules).int64.gt = 0];
  string aaa = 2 [(validate.rules).string = {min_len: 1, max_len: 100}];
}
```

Vergelijking met XSD:
- XSD's `xs:choice` ≈ protobuf's `oneof` — functioneel equivalent voor discriminated unions
- XSD's facets ≈ `protoc-gen-validate` — vergelijkbare kracht, maar als plugin in plaats van ingebouwd
- XSD's overerving ≈ niet beschikbaar in protobuf (alleen compositie via nesting)

**Passendheid voor v06 typering**: sterk voor commands, matig voor queries (geen field selection, geen introspectie als eerste klas feature).

### Hoe elke standaard de v06 polymorfe payload zou typeren

| Standaard | Mechanisme | Validatiemoment | Hoe "type bepaald door key-naam" uitgedrukt? |
|---|---|---|---|
| **XSD** | `xs:choice` in `WijzigingType` | Compile-time (schema-validatie) | Exact: choice-element bepaalt welk type aanwezig is |
| **gRPC** | `oneof representatie` in `WijzigingInput` | Compile-time (protoc-generatie) | Exact: oneof garandeert precies één veld |
| **GraphQL** | Nullable velden per type, of `@oneOf` (draft) | Deels compile-time, deels runtime | Krom: alle velden nullable, client moet er precies één vullen |
| **OAS 3.1** | `oneOf` + `discriminator` + extra property | Runtime (validator) | Krom: vereist expliciete discriminator-property |
| **v06 huidig** | JSON key-naam, Go runtime check | Runtime (handler-code) | Direct: key-naam = MetaRegistry VeldNaam → type lookup |

### Rangorde typeringskracht

```
  Sterkst                                                         Zwakst
    ┌───────┐    ┌───────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐
    │  XSD  │ >  │gRPC/proto │ >  │ GraphQL │ >  │OAS 3.1 / │ >  │v06 huidig│
    │       │    │ buf       │    │         │    │JSON Schma│    │(runtime) │
    └───────┘    └───────────┘    └─────────┘    └──────────┘    └──────────┘
     Facets       oneof +          Nominaal       Structureel     Geen schema
     Choice       validate         Geen union     oneOf fragiel   in protocol
     Overerving   Geen facets      input          Geen facets
     Nominaal     (plugin)         Geen facets    Geen overerving
                  Geen overerving
```

### Conclusie typeringsvergelijking

1. **XSD is en blijft de gouden standaard voor typering.** Geen enkel JSON-gebaseerd systeem heeft het volledige XSD-typesysteem overgenomen. De observatie dat OAS 3.1 "houtje touwtje" is vergeleken met XSD is correct — het verschil zit met name in nominale types, facets en discriminated unions.

2. **gRPC/protobuf komt het dichtstbij XSD** voor de command-kant: `oneof` is functioneel equivalent aan `xs:choice`, en met `protoc-gen-validate` krijg je facets erbij. De grootste manco is het ontbreken van echte overerving.

3. **GraphQL is sterk voor de query-kant** (nominale types, introspectie, field selection) maar **zwak voor de mutatie-kant** (geen union inputs, geen constraints). Dit matcht precies met de v06-splitsing: GraphQL voor queries, iets anders voor commands.

4. **OAS 3.1 is het zwakst** voor het v06-polymorfiepatroon. De Zalando-guidelines en MS Graph API bouwen voort op OAS/JSON Schema en erven dezelfde typeringszwaktes. Ze voegen convenience toe (design-richtlijnen, query-parameters) maar geen typeringskracht.

5. **Voor v06 betekent dit concreet:**
   - De huidige runtime-typering (JSON key → MetaRegistry lookup) is functioneel correct maar biedt geen compile-time garanties
   - Een gRPC/Connect-laag voor de command-kant (registratie) zou de sterkste typering opleveren met behoud van JSON/HTTP via Connect
   - Een GraphQL-laag voor de query-kant zou de sterkste typering opleveren voor full-opvraag en field selection
   - OAS 3.1 als API-beschrijving is nuttig voor documentatie en tooling, maar voegt weinig typeringskracht toe aan de runtime

6. **De ideale architectuur voor typering** zou zijn:
   - **Command-kant**: gRPC/Connect met protobuf IDL (`oneof` voor polymorfie, `validate` voor constraints)
   - **Query-kant**: GraphQL met typed schema (nominale types, introspectie, field selection)
   - **Documentatie**: OAS 3.1 voor de REST-endpoints die blijven bestaan
   - **MetaRegistry**: blijft de single source of truth voor typemetadata; protobuf-definities en GraphQL-schema's worden idealiter *gegenereerd* uit de MetaRegistry
