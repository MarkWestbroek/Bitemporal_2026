# Dynamische GraphQL-laag vanuit MetaRegistry

> Datum: 1 april 2026
> Status: **Geïmplementeerd** — build en tests OK

## Samenvatting

De oude gqlgen-gebaseerde GraphQL-implementatie (~10.000 regels gegenereerde code, gebaseerd op het verouderde A/B-model) is vervangen door een **dynamische GraphQL-laag** die het schema at runtime opbouwt vanuit de MetaRegistry. Hierdoor hoeft er bij modelwijzigingen geen code meer gegenereerd te worden — het GraphQL schema reflecteert automatisch de actuele staat van de MetaRegistry bij elke serverstart.

### Waarom?

| Probleem (gqlgen)                                    | Oplossing (dynql)                                      |
|------------------------------------------------------|--------------------------------------------------------|
| ~10k regels gegenereerde code bij elke modelwijziging | Schema wordt dynamisch gebouwd bij startup             |
| Verouderd model (alleen A/B, geen NatuurlijkPersoon) | Alle MetaRegistry-types automatisch beschikbaar        |
| 27 van 34 resolvers waren lege stubs                  | Generieke resolvers voor alle entiteiten               |
| Codegen vereist (gqlgen generate)                     | Geen codegen nodig                                     |
| Statisch schema.graphqls te onderhouden               | Schema volgt automatisch MetaRegistry + struct-velden  |

## Architectuur

```
MetaRegistry (startup)
    │  itereer entiteiten, GE's, relaties
    ▼
Dynamic Schema Builder (dynql/schema_builder.go)
    │  bouw GraphQL types/queries/mutations programmatisch
    ▼
graphql.Schema (in-memory)
    │  registreer op /graphql/query
    ▼
Gin Handler (dynql/handler.go)
    │  ontvangt GraphQL request → graphql.Do()
    ▼
Generic Resolvers (dynql/query_resolvers.go, mutation_resolvers.go)
    │  hergebruik bestaande Bun-query patronen
    ▼
Bun / PostgreSQL
```

## Library

**`graphql-go/graphql`** (v0.8.1) — programmatisch schema, geen codegen.

In tegenstelling tot gqlgen (dat een `.graphqls` schema-file en code generation vereist) wordt het schema hier in Go opgebouwd via `graphql.NewObject()`, `graphql.NewSchema()`, etc. Dit maakt het mogelijk om de MetaRegistry te itereren en types+queries+mutations dynamisch te registreren.

## Bestanden

### `dynql/` directory

| Bestand                 | Regel­telling | Doel                                                                                  |
|-------------------------|:---:|---------------------------------------------------------------------------------------|
| `scalars.go`            | ~185 | DateTime, Date, JSON custom scalars + `goTypeToGraphQL()` mapping + enum-aanmaak     |
| `field_builder.go`      | ~210 | Struct-reflectie → `graphql.Fields` (geporteerd patroon uit `viz_schema_handler.go`) |
| `type_builder.go`       | ~155 | `TypeMeta` → `graphql.Object` met hub+data flattening, geneste GE's, afgeleide velden |
| `query_resolvers.go`    | ~315 | Full-entity, lijst en registratie resolvers met directe Bun queries                  |
| `mutation_resolvers.go` | ~125 | Registreer/corrigeer/maakOngedaan via REST round-trip naar eigen server               |
| `schema_builder.go`     | ~160 | `BuildSchema()` — assembleert alles vanuit MetaRegistry                               |
| `handler.go`            | ~95  | Gin HTTP handler (`graphql.Do()`) + GraphiQL UI                                       |

### Gewijzigde bestanden

- **`main.go`** — `dynql` import toegevoegd, GraphQL routes vervangen door `dynql.BuildSchema()` + `dynql.GraphQLHandler()` + `dynql.PlaygroundHandler()`

### Verwijderde bestanden

- `graph/` directory (~10.300 regels: `generated.go`, `schema.resolvers.go`, `resolver.go`, `datetime.go`, `schema.graphqls`, `model/models_gen.go`)
- `handlers/graphql_handler.go` (46 regels, oude gqlgen handler)
- `gqlgen.yml` (gqlgen configuratie)
- `gqlgen` + `gqlparser` dependencies uit `go.mod`/`go.sum`

## Endpoints

| Methode | Pad                    | Beschrijving                                |
|---------|------------------------|---------------------------------------------|
| GET     | `/graphql/playground`  | GraphiQL UI                                 |
| POST    | `/graphql/query`       | GraphQL query/mutation endpoint             |
| GET     | `/graphql/query`       | GraphQL query endpoint (GET met querystring) |

### UI: GraphiQL (live)

De UI op `/graphql/playground` gebruikt nu **GraphiQL**.

GraphiQL is het actief onderhouden alternatief van de GraphQL Foundation. Voordelen:
- Modern React-based interface
- Plugin-systeem (explorer sidebar, etc.)
- Geen CDN-bugs met tooltips
- Betere autocompletion en documentatie-integratie

---

## Quick reference: beschikbare queries en mutations

> Beknopt overzicht van alle beschikbare GraphQL operaties.

### Queries

| Query | Argumenten | Retourtype | Beschrijving |
|-------|-----------|------------|-------------|
| `full_natuurlijk_personen(id, peiltijdstip?, t?)` | `id: Int!`, `peiltijdstip: DateTime`, `t: Int` | `NatuurlijkPersoon` | Volledige NP met alle GE's/relaties |
| `natuurlijk_personen(limit?, offset?)` | `limit: Int = 20`, `offset: Int = 0` | `[NatuurlijkPersoon]` | Lijst NatuurlijkPersoon (paginering) |
| `full_locaties(id, peiltijdstip?, t?)` | `id: Int!`, `peiltijdstip: DateTime`, `t: Int` | `Locatie` | Volledige Locatie met GE's |
| `locaties(limit?, offset?)` | `limit: Int = 20`, `offset: Int = 0` | `[Locatie]` | Lijst Locaties |
| `registratie(id)` | `id: Int!` | `Registratie` | Eén registratie met wijzigingen |
| `registraties(limit?, offset?)` | `limit: Int = 20`, `offset: Int = 0` | `[Registratie]` | Lijst registraties (nieuwste eerst) |

> `id` wordt per entiteit dynamisch getypeerd bij schema-opbouw (bijv. `Int` voor NP/Locatie, `String` waar een entiteit een string-id heeft).

### Mutations

| Mutation | Argument | Beschrijving |
|----------|----------|-------------|
| `registreer(input: JSON!)` | Registratie+wijzigingen JSON | Nieuwe registratie (opvoer/afvoer) |
| `corrigeer(input: JSON!)` | Correctie JSON | Correctie (ongedaanmaking + heropvoer) |
| `maak_ongedaan(input: JSON!)` | Ongedaanmaking JSON | Maak een registratie ongedaan |

---

## Beschikbare queries (detail)

### Per entiteit (dynamisch vanuit MetaRegistry)

Voor elke entiteit in de MetaRegistry worden twee queries geregistreerd:

```graphql
# Volledige entiteit met alle geneste GE's/relaties
query {
  full_<padnaam>(id: <Int|String>!, peiltijdstip: DateTime, t: Int) {
    id
    # ... alle velden inclusief onderliggende GE's/relaties
  }
}

# Lijst met paginering
query {
  <padnaam>(limit: Int = 20, offset: Int = 0) {
    id
    # ... velden
  }
}
```

Voorbeelden (afhankelijk van actuele MetaRegistry-inhoud):
- `full_natuurlijk_personen(id: 1)` — NatuurlijkPersoon met alle GE's
- `locaties(limit: 10)` — lijst van Locaties
- `full_as(id: 1, peiltijdstip: "2026-01-05T00:00:00Z")` — A op formeel peiltijdstip
- `full_natuurlijk_personen(id: 1, t: 3)` — NatuurlijkPersoon op shorthand peilmoment `t`

`t` gebruikt dezelfde vertaling als in de REST handlers:

`2026-01-01T00:00:00Z + t uur + t microseconden`.

Als zowel `peiltijdstip` als `t` is meegegeven, krijgt `peiltijdstip` voorrang.

### Registraties

```graphql
# Eén registratie met wijzigingen
query {
  registratie(id: Int!) {
    id
    registratietype
    tijdstip
    wijzigingen { ... }
  }
}

# Lijst (nieuwste eerst)
query {
  registraties(limit: Int = 20, offset: Int = 0) {
    id
    registratietype
    tijdstip
  }
}
```

## Beschikbare mutations

Mutations gebruiken hetzelfde JSON-formaat als de REST `POST /registratie/<padnaam>` endpoints. Het `input` argument is een vrij JSON-object (via de `JSON` scalar):

```graphql
mutation {
  registreer(input: JSON!) # → JSON resultaat
  corrigeer(input: JSON!)
  maak_ongedaan(input: JSON!)
}
```

De mutations delegeren intern naar de REST registratie-endpoints via een HTTP round-trip doorloopt, zodat alle bestaande registratielogica (transacties, correctievalidatie, hub-conversie, relatieve autoincrement, etc.) ongewijzigd hergebruikt wordt.

## Ontwerpbeslissingen

### 1. Programmatisch schema i.p.v. SDL

Het schema wordt niet beschreven in een `.graphqls` bestand maar in Go-code via `graphql.NewObject()`. Dit maakt het mogelijk om de MetaRegistry te itereren en per type automatisch een GraphQL Object aan te maken.

### 2. Hub+data flattening

Hub-types (GESubtypeHub) tonen in GraphQL ook de velden van hun onderliggende `_Data` child. Hierdoor ziet de API-gebruiker een plat type i.p.v. de interne hub-structuur:

```graphql
# In GraphQL ziet de gebruiker:
type NatuurlijkPersoon_Naam {
  np_id: Int
  rel_id: Int
  roepnaam: String    # ← afkomstig uit NatuurlijkPersoon_Naam_Data
  achternaam: String   # ← afkomstig uit NatuurlijkPersoon_Naam_Data
  opvoer: DateTime
  afvoer: DateTime
}
```

### 3. Mutations via REST round-trip

In plaats van de complexe registratielogica te dupliceren in GraphQL resolvers, delegeren mutations naar de bestaande REST endpoints. Dit garandeert dat:
- Alle transactielogica (inclusief rollback) werkt
- Correctie- en ongedaanmakingregels identiek zijn
- Hub-conversie, relatieve autoincrement en niet-afgevoerde-wijziging-checks meelopen

### 4. JSON scalar voor mutation input

De `JSON` scalar accepteert vrije JSON-payloads. Dit is bewust gekozen zodat het mutation-formaat identiek is aan het REST request-formaat, zonder dat er per representatietype een apart input-type nodig is.

### 5. Formele tijdfilter (vereenvoudigd)

De query resolvers gebruiken momenteel een vereenvoudigd formeel tijdfilter (`opvoer <= ? AND (afvoer IS NULL OR afvoer > ?)`), vergelijkbaar met de REST handlers. Het geavanceerde filter via de `f_formele_wijziging_op_peil()` functie kan later toegevoegd worden.

## Type mapping

| Go type         | GraphQL type   | Scalar       |
|-----------------|----------------|-------------|
| `string`        | `String`       | —           |
| `int`, `int64`  | `Int`          | —           |
| `float64`       | `Float`        | —           |
| `bool`          | `Boolean`      | —           |
| `time.Time`     | `DateTime`     | Custom      |
| `model.Date`    | `Date`         | Custom      |
| Enum-velden     | `<Naam>Enum`   | Dynamisch via `EnumWaarden` registry |
| Vrij JSON       | `JSON`         | Custom      |

## Relatie met de MetaRegistry

De GraphQL-laag is volledig afhankelijk van de MetaRegistry:

1. **Schema build** — `BuildSchema()` itereert `model.MetaRegistry` en bouwt voor elke entiteit queries
2. **Type build** — `BuildOutputTypes()` maakt per TypeMeta een `graphql.Object` via struct-reflectie op `Factory()`
3. **Onderliggende GE's** — `OnderliggendeGegevenselementen` bepaalt welke geneste velden er in het GraphQL type komen
4. **Hub+data** — `GESubtype` en `DataTypenaam` sturen de flattening
5. **Afgeleide velden** — `AfgeleideVelden` worden als extra velden toegevoegd

Bij het toevoegen van een nieuw type aan de MetaRegistry verschijnt het automatisch in het GraphQL schema bij de volgende serverstart.

---

## Voorbeelden (NP-Loc domein)

Onderstaande voorbeelden gebruiken het NatuurlijkPersoon / Locatie / Bereikbaarheid domeinmodel.

### Queries

#### Volledige NatuurlijkPersoon ophalen

```graphql
query {
  full_natuurlijk_personen(id: 1) {
    id
    opvoer
    afvoer
    weergavenaam
    persoonsidentificaties {
      natuurlijkpersoon_id
      rel_id
      bsn
      ingezetene
      opvoer
      afvoer
    }
    namen {
      natuurlijkpersoon_id
      rel_id
      voorletters
      roepnaam
      tussenvoegsel
      achternaam
      opvoer
      afvoer
    }
    burgerschappen {
      natuurlijkpersoon_id
      rel_id
      landcode
      nationaliteit
      opvoer
      afvoer
      aanvang {
        datum
        versie
      }
      einde {
        datum
        versie
      }
    }
    naamgebruiken {
      naamgebruik
    }
    bereikbaarheden {
      natuurlijkpersoon_id
      rel_id
      locatie_id
      soort
      opvoer
      afvoer
      aanvang {
        datum
      }
    }
    aanvang {
      datum
      versie
    }
    einde {
      datum
      versie
    }
  }
}
```

#### Volledige NatuurlijkPersoon op formeel peiltijdstip

```graphql
query {
  full_natuurlijk_personen(id: 1, peiltijdstip: "2025-06-01T00:00:00Z") {
    id
    weergavenaam
    namen {
      voorletters
      achternaam
    }
    burgerschappen {
      nationaliteit
      aanvang { datum }
    }
  }
}
```

#### Volledige NatuurlijkPersoon met shorthand peilmoment `t`

```graphql
query {
  full_natuurlijk_personen(id: 1, t: 3) {
    id
    weergavenaam
    namen {
      voorletters
      achternaam
    }
    burgerschappen {
      nationaliteit
    }
  }
}
```

####Uitgebreider
```
{
  full_natuurlijk_personen(id: 1, peiltijdstip: "2026-01-02T10:00:00.000034Z") {
    id
    opvoer
    afvoer
    weergavenaam
    persoonsidentificaties {
      natuurlijkpersoon_id
      rel_id
      bsn
      ingezetene
      opvoer
      afvoer
    }
    namen {
      natuurlijkpersoon_id
      rel_id
      voorletters
      roepnaam
      tussenvoegsel
      achternaam
      opvoer
      afvoer
    }
    partnernamen {
      achternaam
    }
    naamgebruiken {
      naamgebruik
    }
    burgerschappen {
      natuurlijkpersoon_id
      rel_id
      landcode
      nationaliteit
      opvoer
      afvoer
      aanvang {
        datum
        versie
      }
      einde {
        datum
        versie
      }
    }
    bereikbaarheden {
      natuurlijkpersoon_id
      rel_id
      locatie_id
      soort
      opvoer
      afvoer
      aanvang {
        datum
      }
    }
    aanvang {
      datum
      versie
    }
    einde {
      datum
      versie
    }
  }
}
```

#### Lijst Locaties met paginering

```graphql
query {
  locaties(limit: 5, offset: 0) {
    id
    opvoer
    weergaveadres
  }
}
```

#### Volledige Locatie ophalen

```graphql
query {
  full_locaties(id: 1) {
    id
    opvoer
    weergaveadres
    adressen {
      locatie_id
      rel_id
      straatnaam
      huisnummer
      postcode
      plaats
      land
      opvoer
    }
    baglocaties {
      adresaanduiding
    }
    aanvang {
      datum
      versie
    }
  }
}
```

#### Registraties opvragen

```graphql
query {
  registraties(limit: 10) {
    id
    registratietype
    tijdstip
    opmerking
  }
}

query {
  registratie(id: 1) {
    id
    registratietype
    tijdstip
    opmerking
    wijzigingen {
      id
      type_naam
      opvoer_of_afvoer
    }
  }
}
```

### Mutations

#### Registreer nieuwe NatuurlijkPersoon (opvoer met GE's)

```graphql
mutation {
  registreer(input: {
    registratie: {
      registratietype: "registratie",
      tijdstip: "2026-04-01T09:00:00Z",
      opmerking: "Opvoer NatuurlijkPersoon met naam en burgerschap"
    },
    wijzigingen: [
      {
        opvoer: {
          natuurlijkpersoon: {
            id: 5,
            persoonsidentificaties: [
              { bsn: "987654321", ingezetene: true }
            ],
            namen: [
              {
                voorletters: "A.B.",
                roepnaam: "Anna",
                achternaam: "de Vries"
              }
            ],
            burgerschappen: [
              {
                landcode: "NL",
                nationaliteit: "Nederlandse",
                aanvang: "1995-08-20"
              }
            ],
            naamgebruiken: [
              { naamgebruik: "EigenNaam" }
            ],
            aanvang: [
              { datum: "1995-08-20" }
            ]
          }
        }
      }
    ]
  })
}
```

#### Registreer nieuwe Locatie

```graphql
mutation {
  registreer(input: {
    registratie: {
      registratietype: "registratie",
      tijdstip: "2026-04-01T09:05:00Z",
      opmerking: "Opvoer Locatie met adres"
    },
    wijzigingen: [
      {
        opvoer: {
          locatie: {
            id: 10,
            adressen: [
              {
                straatnaam: "Keizersgracht",
                huisnummer: "42",
                postcode: "1015 CR",
                plaats: "Amsterdam",
                land: 6030
              }
            ],
            aanvang: [
              { datum: "2026-04-01" }
            ]
          }
        }
      }
    ]
  })
}
```

#### Registreer Bereikbaarheid (relatie NP ↔ Locatie)

```graphql
mutation {
  registreer(input: {
    registratie: {
      registratietype: "registratie",
      tijdstip: "2026-04-01T09:10:00Z",
      opmerking: "Koppel NP 5 aan Locatie 10 als woonadres"
    },
    wijzigingen: [
      {
        opvoer: {
          bereikbaarheid: {
            natuurlijkpersoon_id: 5,
            locatie_id: 10,
            soort: "Woonadres",
            aanvang: "2026-04-01"
          }
        }
      }
    ]
  })
}
```

#### Correctie: achternaam wijzigen

```graphql
mutation {
  corrigeer(input: {
    registratie: {
      registratietype: "correctie",
      tijdstip: "2026-04-02T10:00:00Z",
      opmerking: "Correctie achternaam NP 5"
    },
    wijzigingen: [
      {
        afvoer: {
          natuurlijkpersoon_naam_data: {
            natuurlijkpersoon_id: 5,
            rel_id: 1,
            versie: 1
          }
        }
      },
      {
        opvoer: {
          natuurlijkpersoon_naam_data: {
            natuurlijkpersoon_id: 5,
            rel_id: 1,
            voorletters: "A.B.",
            roepnaam: "Anna",
            achternaam: "Bakker"
          }
        }
      }
    ]
  })
}
```

> **Let op**: het `input` argument bij mutations is een vrij JSON-object (via de `JSON` scalar). Het formaat is identiek aan het REST `POST /registratie/` request body.

---

## Nog te doen (Fase 6: verfijning)

- **Field selection optimalisatie** — alleen de door de GraphQL query gevraagde velden uit de database laden
- **Formeel tijdfilter via wijzigingen-tabel** — gebruik `f_formele_wijziging_op_peil()` i.p.v. het vereenvoudigde opvoer/afvoer filter
- **Unit tests** voor de `dynql` package
- **Introspection test** — `{ __schema { types { name } } }` valideren met een live server
- **Materieel tijdreizen** via `peildatum` argument op full-entity queries
