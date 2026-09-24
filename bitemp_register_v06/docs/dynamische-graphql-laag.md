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

> **Enum handling**: enum-velden gebruiken GraphQL enum-types met gesanitizede namen.
> Zie [graphql-enum-handling.md](graphql-enum-handling.md) voor de volledige analyse van de enum cache-bug en het underscore-serialisatiegedrag.
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
| `natuurlijk_personen(filter?, peiltijdstip?, t?, limit?, offset?)` | `filter: NatuurlijkPersoonFilter`, `peiltijdstip: DateTime`, `t: Int`, `limit: Int = 20`, `offset: Int = 0` | `[NatuurlijkPersoon]` | Lijst NatuurlijkPersoon (paginering, [filter](#filteren)) |
| `full_locaties(id, peiltijdstip?, t?)` | `id: Int!`, `peiltijdstip: DateTime`, `t: Int` | `Locatie` | Volledige Locatie met GE's |
| `locaties(filter?, peiltijdstip?, t?, limit?, offset?)` | idem | `[Locatie]` | Lijst Locaties |
| `full_locaties_list(filter?, peiltijdstip?, t?, limit?, offset?)` | idem | `[Locatie]` | Lijst Locaties met alle GE's |
| `/graphql/query` met `documentId` | `documentId`, `variables?` | — | Opgeslagen document (QueryDefinitie) op naam uitvoeren, zie [Uitvoeren op naam](#uitvoeren-op-naam-opgeslagen-documenten-persisted-queries) |
| `POST /graphql/valideer` | `document` | `{geldig, fouten}` | Document valideren zonder uitvoeren |
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

Voor elke entiteit in de MetaRegistry worden drie queries geregistreerd:

```graphql
# Volledige entiteit met alle geneste GE's/relaties
query {
  full_<padnaam>(id: <Int|String>!, peiltijdstip: DateTime, t: Int) {
    id
    # ... alle velden inclusief onderliggende GE's/relaties
  }
}

# Lijst met filter en paginering (alleen de entiteit zelf)
query {
  <padnaam>(filter: <Entiteit>Filter, peiltijdstip: DateTime, t: Int, limit: Int = 20, offset: Int = 0) {
    id
    # ... velden
  }
}

# Idem, met alle onderliggende GE's/relaties (hub+data platgeslagen)
query {
  full_<padnaam>_list(filter: <Entiteit>Filter, peiltijdstip: DateTime, t: Int, limit: Int = 20, offset: Int = 0) {
    id
    # ... alle velden
  }
}
```

De lijsten zijn gesorteerd op `id`, zodat `limit`/`offset` stabiele pagina's geven.
Met een `peiltijdstip` tonen ze de situatie op dat formele moment; zie ook [Filteren](#filteren).

Voorbeelden (afhankelijk van actuele MetaRegistry-inhoud):
- `full_natuurlijk_personen(id: 1)` — NatuurlijkPersoon met alle GE's
- `locaties(limit: 10)` — lijst van Locaties
- `full_as(id: 1, peiltijdstip: "2026-01-05T00:00:00Z")` — A op formeel peiltijdstip
- `full_natuurlijk_personen(id: 1, t: 3)` — NatuurlijkPersoon op shorthand peilmoment `t`

`t` gebruikt dezelfde vertaling als in de REST handlers:

`2026-01-01T00:00:00Z + t uur + t microseconden`.

Als zowel `peiltijdstip` als `t` is meegegeven, krijgt `peiltijdstip` voorrang.

### Filteren

*Sinds 22 september 2026 (Claude-sessie). Code: `dynql/filter.go`; achtergrond: plan
`docs/plans/2026-09-22 Aanmeldformulier CG PF als formulierdefinitie (analyse).md` §7.6.*

De lijst-queries hebben een `filter`-argument. Het type ervan (`<Entiteit>Filter`) wordt
volledig uit de MetaRegistry gegenereerd; er staat geen typenaam in de code. Het volgt de
vorm van het outputtype: per onderliggend GE of relatie een genest object met de velden van
hub én `_Data` samen.

```graphql
# Initiatieven waar gemeente 363 aan meerealiseert, met een planning in de fase Idee
query {
  initiatieven(filter: {
    initiatief_gemeenten: { gemeente_id: { eq: 363 }, rol: { eq: "Realiseert" } }
    planningen:           { fase: { eq: "Idee (nog geen concrete opbrengsten)" } }
  }) { id weergavenaam }
}

# Initiatieven zonder (actieve) beoordeling, of met id 1
query {
  initiatieven(filter: { or: [ { not: { beoordelingen: {} } }, { id: { eq: 1 } } ] }) { id }
}
```

**Betekenis van een GE-object.** `initiatief_gemeenten: { … }` betekent: *er is ten minste
één actief record van dit GE dat aan alle opgegeven condities voldoet*. Condities binnen één
object gelden voor **hetzelfde record**: het eerste voorbeeld vindt dus niet een initiatief
waar 363 alleen *gebruikt* en een andere gemeente *realiseert*. Een leeg object
(`beoordelingen: {}`) betekent "er is een actief record"; met `not` eromheen "er is er geen".

**Actief.** Hub én data niet afgevoerd. Met een `peiltijdstip` (of `t`): actief op dat
moment — voor hub, data én de entiteit zelf. Filter en formele tijd gaan dus samen.

**Operatoren** per soort veld:

| Soort | Inputtype | Operatoren |
|---|---|---|
| tekst (ook enums) | `TekstFilter` | `eq`, `ne`, `in`, `contains`, `isNull` |
| geheel getal | `GeheelGetalFilter` | `eq`, `ne`, `in`, `lt`, `lte`, `gt`, `gte`, `isNull` |
| decimaal | `DecimaalFilter` | idem |
| datum | `DatumFilter` | idem (waarden als `"2026-01-31"`) |
| tijdstip | `TijdstipFilter` | idem (ISO 8601) |
| ja/nee | `WaarheidFilter` | `eq`, `isNull` |

- Meerdere operatoren of velden in één object gelden samen (EN); `and`, `or` en `not`
  combineren op entiteitniveau.
- `ne` is NULL-veilig (`IS DISTINCT FROM`): "fase is niet X" omvat ook records zonder fase.
- `contains` is hoofdletterongevoelig; `%` en `_` in de zoektekst zijn letterlijk.
- `in: []` is nooit waar.
- `and`/`or` accepteren null-items, en die tellen niet mee: in een `and` zijn ze neutraal, in
  een `or` voegen ze geen alternatief toe. Een `or` zonder alternatieven (`or: []`) is nooit
  waar. Zo past een optionele variabele in een opgeslagen document zonder het filter te kunnen
  verruimen: `filter: { and: [ { <vast deel> }, $extra ] }` met `$extra: <Entiteit>Filter`
  — de aanroeper kan alleen versmallen (test: `TestFilter_OpgeslagenDocumentAanroeperVersmaltAlleen`).
- **Enums** worden als tekst vergeleken, zoals ze in de output staan. Een waarde die niet in
  de enum voorkomt geeft een fout met de toegestane waarden, in plaats van stilletjes nul
  resultaten.

**Nog niet mogelijk** (bewust buiten de eerste versie):

- **Afgeleide velden** (bv. `weergavenaam`): die worden pas ná het laden in Go berekend en
  bestaan niet in SQL. Zie plan §7.6.1 voor de routes (materialiseren).
- **Hops** naar een andere entiteit, zoals filteren op de *naam* van de gemeente in plaats
  van op `gemeente_id`.
- **"Alle records voldoen"**: een GE-object betekent altijd "ten minste één".
- **REST**: het filter bestaat alleen in GraphQL.

Technisch wordt elk GE-object één `EXISTS`-subquery over hub + `_Data`; waarden gaan als
parameters mee, identifiers gequote via `bun.Ident`. Tests: `dynql/filter_test.go`
(SQL en schema, met sqlmock) en `dynql/filter_pg_test.go` (semantiek tegen een echte
PostgreSQL; draait alleen met `DYNQL_TEST_PG_DSN`, instructies in de kop van het bestand).

### Uitvoeren op naam (opgeslagen documenten, persisted queries)

*Sinds 24 september 2026 (Claude-sessie). Code: `dynql/opgeslagen_documenten.go`; model:
`QueryDefinitie` in het configuratie-domein; achtergrond: plan
`docs/plans/2026-09-22 Aanmeldformulier CG PF als formulierdefinitie (analyse).md` §7.4.*

Naast een ad-hoc `query` accepteert `/graphql/query` een **`documentId`**: de naam van een
opgeslagen `QueryDefinitie`. De frontend stuurt dan geen query-tekst meer, alleen de naam en
eventueel variabelen — het patroon van *trusted documents* in GraphQL-over-HTTP.

```http
POST /graphql/query
{ "documentId": "publieke-initiatieven", "variables": { "extra": { "id": { "eq": 3 } } } }

GET /graphql/query?documentId=publieke-initiatieven&variables={"extra":{"id":{"eq":3}}}
```

`query` en `documentId` sluiten elkaar uit (400).

**Er wordt niets opgebouwd.** Een QueryDefinitie is registerdata, geen model: het schema komt
bij het opstarten uit de MetaRegistry, de documenten komen **per aanroep** uit de database. Een
nieuwe of gewijzigde definitie werkt dus zonder herstart, en een vooruit geregistreerde status
("actief vanaf 1 oktober") gaat vanzelf op die dag werken. Per aanroep zoekt de handler de
definitie op naam en leest per GE het record dat op dat moment **formeel actueel én materieel
geldig** is: naam, status (+ reden), toegankelijkheid en document.

| Situatie | Antwoord |
|---|---|
| status `actief`, toegankelijkheid `publiek` | 200, het resultaat van het document |
| status `actief`, toegankelijkheid `intern` (of ontbrekend) | uitgevoerd voor een ingelogde gebruiker (minimaal `viewer`); anders 401/403 |
| status `inactief` | **410** `{"error":"document ingetrokken","reden":…}` — de reden is voor de afnemer |
| onbekende naam, status `concept`, status nog niet/niet meer geldig, buiten de levensduur van de definitie, formeel afgevoerd, geen geldig document | **404** `onbekend of niet beschikbaar document` (bewust niet onderscheiden: een klad is niet zichtbaar) |
| het opgeslagen document bevat een mutatie | 400 |
| het contract klopt niet met het model (zie onder) | 501 |

**Variabelen versmallen alleen.** Het document legt het vaste deel vast en laat de aanroeper
via een optionele variabele alleen extra condities toevoegen — zie de opmerking bij `and`/`or`
onder [Filteren](#filteren):

```graphql
query PubliekeInitiatieven($extra: InitiatiefFilter) {
  initiatieven(filter: { and: [ { planningen: {} }, $extra ] }) { id weergavenaam }
}
```

**Valideren vóór het opslaan.** `POST /graphql/valideer` met `{"document": "…"}` geeft
`{"geldig": bool, "fouten": [...]}` terug zonder iets uit te voeren; een mutatie telt als fout.
Bedoeld voor de frontend bij het bewerken van een QueryDefinitie. (Afdwingen in de
registratie-engine — een ongeldig document weigeren — is nog niet gebouwd.)

**Bij het opstarten** gebeuren twee controles, zichtbaar in het log:

1. het **contract**: bestaat het gereserveerde type `QueryDefinitie` met de GE's
   `QuerydefinitieNaam`, `…Beschrijving`, `…Status` (materieel), `…Toegankelijkheid` (materieel)
   en `…Document` (materieel) en hun velden? Zo nee: `WARN … staat uit: <reden>` en elke
   `documentId`-aanroep geeft 501;
2. de **documenten**: alle actuele documenten worden tegen het schema gevalideerd
   (`ValideerOpgeslagenDocumenten`), één logregel per definitie, `ONGELDIG — …` als het model
   onder een document vandaan is veranderd. Zo'n document wordt bij aanroep gewoon uitgevoerd
   en geeft dan een GraphQL-fout (200 met `errors`), geen 500.

`QueryDefinitie` is een **gereserveerd woord**, zoals `Referentielijst` dat feitelijk ook is:
`opgeslagen_documenten.go` kent de typenamen; laden, formele tijd en het platslaan van hub+data
lopen via dezelfde generieke code als de gewone resolvers.

**De poort (`LEESTOEGANG=documenten`, standaard uit).** Met de poort dicht mag een anonieme
aanroeper op `/graphql/query` alleen nog `documentId` (publieke documenten) en introspectie
(`__schema`, `__type`); een ad-hoc `query` vereist minimaal de rol `viewer`. Hetzelfde geldt
voor de REST-GET's op registerdata; configuratie (WeergaveDefinitie enz.), referentielijsten
en schema-endpoints blijven open. Zie `docs/AUTH_DEVELOPER_GUIDE.md` §7.

**Enkelvoudig en materieel — een bekende beperking.** De uitvoerder kiest per GE uit álle
formeel actieve hubs de hub die op dat moment materieel geldig is (`kiesGeldigeHub`). Dat is de
bedoelde semantiek van enkelvoudig op een materieel GE: één geldig record tegelijk op de
materiële lijn, meerdere formeel actief (zoals een woongeschiedenis). De exclusieconstraint
in `dbsetup` laat nu echter maar één formeel actieve hub toe; tot die is aangepast (backlog
B33) vervangt een vooruit geregistreerde status de vorige meteen en is de definitie tot de
aanvangsdatum niet opvraagbaar.

Tests: `dynql/opgeslagen_documenten_test.go` (contract, materiële keuze, validatie, handler)
en `dynql/opgeslagen_documenten_pg_test.go` (13 scenario's tegen een echte PostgreSQL,
`DYNQL_TEST_PG_DSN`).

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

### 5. Formele tijdfilter (vereenvoudigd) — zonder peiltijdstip is "nu" bedoeld

De query resolvers gebruiken een vereenvoudigd formeel tijdfilter (`opvoer <= ? AND (afvoer IS NULL OR afvoer > ?)`), vergelijkbaar met de REST handlers. Het geavanceerde filter via de `f_formele_wijziging_op_peil()` functie kan later toegevoegd worden.

**Sinds 24 september 2026 geldt dat filter ook zónder `peiltijdstip`, met "nu" als peilmoment** — voor de entiteit, de hubs, de `_Data`/aanvang/einde-kinderen en de forward-/reverse-relaties (`actueelOfPeil` in `query_resolvers.go`). Daarvoor werd zonder peiltijdstip níet gefilterd: afgevoerde entiteiten en hubs laadden mee en `flattenHubData` nam `data[0]`, dus mogelijk een oude dataversie. Dat is anders dan REST, dat alle versies teruggeeft en het kiezen aan de client laat; GraphQL slaat plat en móet kiezen. Gevolg: `full_<padnaam>(id)` van een afgevoerde entiteit geeft nu `null`. Test: `TestLijst_ZonderPeiltijdstipIsActueel`.

**Weergavenaam van een relatiedoel.** `verrijkWeergavenamen` berekent de `weergavenaam` van bv. de ApiStandaard achter `initiatief_api_standaarden` uit diens afleidingsregel. Zo'n regel gebruikt de **klassenaam** van een GE (`Naam.naam`), terwijl de padnavigatie tot 24-09-2026 alleen op **rolnaam** matchte (`ApiStandaardNamen`) — ApiStandaard bleef leeg, Gemeente werkte toevallig (`Gemeentegegevens` ≈ `GemeenteGegevens`). De gedeelde `model.PadSegmentMatcht` (rolnaam, JSON-rolnaam, klassenaam, typenaam-suffix) wordt nu door REST én GraphQL gebruikt.

### 6. Filter als EXISTS per gegevenselement

Alle gegevens van een entiteit zitten in GE's, dus filteren op een waarde betekent altijd
over hub + `_Data` heen kijken. Een `JOIN` in de hoofdquery zou een entiteit met drie
passende records drie keer opleveren (en paginering stil breken); een `EXISTS`
(semi-join) toetst alleen óf zo'n record er is. Eén `EXISTS` per GE-object zorgt dat
condities op hub-kolommen (bv. `gemeente_id`) en data-kolommen (bv. `rol`) voor hetzelfde
record gelden. Zie [Filteren](#filteren).

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

---

## Omgekeerde relaties (reverse navigation)

De GraphQL-laag ondersteunt **automatische omgekeerde relatie-velden** op entiteiten. Als een relatie A→B bestaat (bijv. Bereikbaarheid: NatuurlijkPersoon → Locatie), dan krijgt B (Locatie) automatisch een veld `gerelateerde_<bron-padnaam>` (bijv. `gerelateerde_natuurlijk_personen`) waarmee je de bron-entiteiten (NatuurlijkPersonen) kunt ophalen die naar dat record wijzen.

### Motivatie

In het registermodel zijn relaties eenrichtingsverkeer: een relatie kent een primaire entiteit (bron) en een secondaire entiteit (doel). Via de reguliere forward-navigatie kun je vanuit een NatuurlijkPersoon de Bereikbaarheden opvragen en daarmee de Locaties zien. Maar de **omgekeerde vraag** — "Welke NatuurlijkPersonen wonen op Locatie X?" — was niet mogelijk zonder een apart REST endpoint.

GraphQL is hiervoor een natuurlijke oplossing: het graph-model maakt bidirectionele navigatie intuïtief. De reverse-velden worden volledig automatisch gegenereerd op basis van de MetaRegistry.

### Architectuur

```
Startup: BuildOutputTypes()
    ↓
buildReverseRelationMap()
    scant MetaRegistry → voor elke relatie met SecondaireEntiteitIDKolom:
    vindDoelEntiteit(secIDKolom)  →  match op conventie: secIDKolom == <veldnaam>_id
    ↓
reverseRelationMap[doelEntiteit] = [ ...ReverseRelationInfo ]
    ↓
buildObjectType()  →  voor entiteiten:
    voor elke reverse relatie:
        voeg "gerelateerde_<bron-padnaam>" veld toe (list type, limit arg)
        met makeReverseRelationResolver()
```

### ReverseRelationInfo struct

| Veld | Type | Beschrijving |
|------|------|-------------|
| `BronEntiteitTypenaam` | `string` | Typenaam van de bron-entiteit (bijv. "NatuurlijkPersoon") |
| `BronEntiteitMeta` | `TypeMeta` | Volledige TypeMeta van de bron-entiteit |
| `RelatieMeta` | `TypeMeta` | TypeMeta van de tussenliggende relatie (bijv. "Bereikbaarheid") |
| `SecondaireIDKolom` | `string` | FK-kolom in de relatie naar het doel (bijv. "locatie_id") |
| `BronIDKolom` | `string` | FK-kolom in de relatie naar de bron (bijv. "natuurlijkpersoon_id") |
| `GQLVeldnaam` | `string` | Naam van het GraphQL veld (bijv. "gerelateerde_natuurlijk_personen") |

### Naamconventie doelentiteit

`vindDoelEntiteit()` gebruikt een conventie-gebaseerde lookup:

```go
secIDKolom == meta.Veldnaam + "_id"
// Bijv.: "locatie_id" → entiteit met Veldnaam "locatie" → Locatie
//        "b_id"       → entiteit met Veldnaam "b"       → B
```

Dit werkt voor alle bestaande relaties in de MetaRegistry.

### Resolver: `makeReverseRelationResolver()`

De resolver voert twee queries uit:

1. **Bron-IDs ophalen**: `SELECT DISTINCT <bron_id_kolom> FROM <relatie_tabel> WHERE <sec_id_kolom> = ? AND afvoer IS NULL LIMIT ?`
2. **Bron-entiteiten laden**: volledige geneste structuur via `SliceFactory`, `addOnderliggendeRelations`, `laadHubKinderenNaQuery`, en `flattenEntityMap`

Het `limit` argument is optioneel (default: 20, max: 100). Alleen actieve relaties (afvoer IS NULL) worden meegenomen.

### Voorbeeld: backward navigation

```graphql
# Welke NatuurlijkPersonen zijn bereikbaar op Locatie 1?
query {
  full_locaties(id: 1) {
    id
    weergaveadres
    adressen {
      straatnaam
      huisnummer
      postcode
      plaats
    }
    gerelateerde_natuurlijk_personen(limit: 10) {
      id
      weergavenaam
      namen {
        roepnaam
        achternaam
      }
      bereikbaarheden {
        soort
        locatie_id
      }
    }
  }
}
```

Dit retourneert de Locatie met al haar adresgegevens, plus alle NatuurlijkPersonen die via een Bereikbaarheid-relatie naar deze Locatie wijzen — inclusief hun volledige geneste structuur.

### Betrokken bestanden

| Bestand | Wijziging |
|---------|-----------|
| `dynql/type_builder.go` | `ReverseRelationInfo` struct, `reverseRelationMap`, `buildReverseRelationMap()`, `vindDoelEntiteit()`, reverse-velden in `buildObjectType()`, `resolveEntityGraphQLType()` |
| `dynql/query_resolvers.go` | `makeReverseRelationResolver()` — 2-staps query (bron-IDs + volledige entiteiten) |

---

## Trusted Documents (ontwerp)

Zie [`docs/trusted-documents.md`](./trusted-documents.md) voor het volledige ontwerp van **Trusted Documents** (persisted queries) bovenop deze dynamische GraphQL-laag. Het ontwerp beschrijft:

- Wat TD's zijn en hoe ze werken (wire-formaat, variabelen, mutations)
- Waarom ze nuttig zijn voor dit project (natuurlijke fit met dynamisch schema, security, parse-cache)
- Hoe caching en TD's samenhangen (parse-cache, HTTP/CDN-cache, response-cache)
- Een concreet implementatievoorstel in 5 fases
