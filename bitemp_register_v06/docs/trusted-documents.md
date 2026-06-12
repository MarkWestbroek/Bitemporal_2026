# Trusted Documents — ontwerp voor de dynamische GraphQL-laag

> Datum: 12 juni 2026
> Status: **Ontwerp** — nog niet geïmplementeerd

## Samenvatting

**Trusted Documents** (TD's, ook wel *persisted queries* of *persisted documents* genoemd) is een GraphQL-patroon waarbij queries vooraf bij de server worden geregistreerd. De client stuurt niet langer de volledige query mee in het request, maar alleen een hash (bv. SHA-256). De server kent de query al en voert hem uit.

Dit ontwerp beschrijft wat TD's zijn, waarom ze nuttig zijn voor de v06-architectuur, en hoe we ze kunnen implementeren bovenop de bestaande dynamische GraphQL-laag (`dynql/`).

---

## 1. Achtergrond: wat zijn Trusted Documents?

### 1.1 Het probleem

Bij standaard GraphQL stuurt de client bij élk request de volledige query-string mee:

```json
POST /graphql/query
{
  "query": "query FullNP($id: ID!) { full_natuurlijk_personen(id: $id) { id weergavenaam namen { roepnaam achternaam } burgerschappen { landcode } } }",
  "variables": { "id": "np-12345" }
}
```

Dit heeft drie nadelen:

1. **Bandbreedte**: de query-string kan honderden bytes zijn — vooral bij diep geneste queries met veel velden.
2. **Parse-overhead**: de server moet elke request de query opnieuw parsen, valideren, en een AST bouwen — ook als het exact dezelfde query is die al duizenden keren eerder is uitgevoerd.
3. **Security**: elke client kan willekeurige queries sturen, inclusief diepe `__schema`-introspectie of dure queries die de server kunnen overbelasten.

### 1.2 De oplossing

Bij Trusted Documents registreert de client (of de build-pipeline) queries vooraf bij de server:

```
┌───────────┐     registreer query      ┌──────────┐
│  Client   │ ──────────────────────────│  Server  │
│  (build)  │   hash = SHA256(query)    │          │
└───────────┘                            │  map[   │
                                         │   hash → query
                                         │  ]      │
                                         └──────────┘
```

Daarna stuurt de client alleen nog de hash + variabelen:

```json
POST /graphql/query
{
  "documentId": "a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
  "variables": { "id": "np-12345" }
}
```

De server kijkt de hash op, vindt de geregistreerde query-structuur, parsed die uit de cache (of voert de al-geparste AST uit), en voegt de variabelen samen.

### 1.3 Wire-formaat met variabelen

Een veelvoorkomende misvatting is dat TD's de variabelen óók vervangen. Dat is niet zo. Het concept is:

> **De hash vervangt alleen de query-string, niet de variabelen.**

Drie gangbare transportvormen:

| Methode | Wire-formaat | Gebruik |
|---------|-------------|---------|
| **POST body** (APQ) | `{"documentId":"hash","variables":{...}}` | Apollo Automatic Persisted Queries |
| **GET query params** | `GET /graphql?documentId=hash&variables={"id":"x"}` | CDN-caching (alleen queries) |
| **Relay extensions** | `GET /graphql?doc_id=hash&extensions={"variables":{...}}` | Relay-conventie |

De server-resolutie is identiek aan een normaal GraphQL-request — het enige verschil is de bron van de query-string:

```go
func ExecuteTrusted(docID string, variables map[string]interface{}) {
    query := documents[docID]          // ← geregistreerde query-structuur
    result := graphql.Do(graphql.Params{
        Schema:         schema,
        RequestString:  query,          // ← de opgezochte query
        VariableValues: variables,      // ← de variabelen uit het request
    })
}
```

### 1.4 Mutations als TD

Mutations kunnen ook als TD worden geregistreerd, maar de voordelen zijn beperkter:

| Aspect | Queries | Mutations |
|--------|---------|-----------|
| **Parse-cache** | ✅ Hoge frequentie → parse-winst telt | 🤏 Lage frequentie → verwaarloosbaar |
| **HTTP/CDN-cache** | ✅ `GET` mogelijk → proxy-cache | ❌ Mutations zijn `POST` → geen cache |
| **Bandbreedte** | ✅ Lange queries schelen bytes | 🤏 Mutations zijn compact |
| **Security (whitelist)** | ✅ Alleen geregistreerde queries | ✅ **Dit voordeel telt wél** |

Voor mutations is het primaire argument dus **security**: je kunt afdwingen dat alleen `registreer`, `corrigeer` en `maak_ongedaan` uitvoerbaar zijn. Dit fungeert als een PEP-laag (Policy Enforcement Point) nog vóór de autorisatie-engine.

---

## 2. Waarom Trusted Documents voor dit project?

### 2.1 Natuurlijke fit met dynamisch schema

Omdat ons GraphQL-schema volledig dynamisch uit de MetaRegistry wordt opgebouwd, zijn de query-patronen **voorspelbaar** en **herhalend**:

| Query-patroon | Aantal (bij N entiteiten) |
|---------------|---------------------------|
| `full_{padnaam}(id, peiltijdstip)` | N queries |
| `{padnaam}(limit, offset)` | N queries |
| `full_{padnaam}_list(limit, offset)` | N queries |
| `registratie(id)` | 1 query |
| `registraties(limit, offset)` | 1 query |

Bij ~15 entiteitstypes in de huidige MetaRegistry levert dat al ~48 standaardqueries op — perfect voor automatische TD-registratie.

### 2.2 Security op mutations

Onze mutations (`registreer`, `corrigeer`, `maak_ongedaan`):

- Hebben een **vaste structuur** maar unieke input
- Zijn ideale TD-kandidaten voor **whitelisting**
- Sluiten aan op het PBAC-autorisatieontwerp (`autoriseren/autoriseren.md`): de TD-laag kan niet-geregistreerde mutations weigeren vóórdat de PDP wordt geraadpleegd

### 2.3 Parse-cache bij opvraag queries

De `full_{padnaam}`-queries zijn complex — met hub+data flattening, geneste GE's, relaties, en afgeleide velden. Het parsen en valideren hiervan bij élk request is verspilling. Met TD's wordt elke query één keer geparsed en gevalideerd, daarna alleen nog uitgevoerd.

### 2.4 Toekomstige publieke API

Als het register ooit een publieke API krijgt (bijv. voor ketenpartners), zijn TD's essentieel:

- **Geen willekeurige queries**: partners kunnen alleen queries uitvoeren die wij hebben goedgekeurd
- **Geen schema-introspectie**: `__schema`-queries zijn niet toegestaan tenzij expliciet geregistreerd
- **DDoS-preventie**: dure, diep-geneste queries worden niet geaccepteerd

---

## 3. Caching en TD's: wat is het verband?

Trusted Documents **faciliteren** caching op meerdere niveaus, maar zijn géén caching op zichzelf:

### 3.1 Query-parse-cache (inherent aan TD)

```
Zonder TD:
  Request → parse query → validate → execute → response
           ^^^^^^^^^^^^^^ elke request opnieuw!

Met TD:
  Startup → parse query → sla AST op
  Request → lookup AST → execute → response
           ^^^^^^^^^^^ geen parse/validate nodig
```

Dit is altijd actief zodra TD's zijn ingeschakeld — de server parsed en valideert een geregistreerde query maar één keer.

### 3.2 HTTP/CDN-cache (mogelijk gemaakt door TD)

Omdat TD-queries via `GET` kunnen worden uitgevoerd (de query-string zit niet meer in de body), kan een CDN of reverse proxy het resultaat cachen:

```
Client → GET /graphql?documentId=hash&variables={"id":"x"}
           │
           ▼
         CDN/Proxy → Cache hit? → return cached response
                      Cache miss → forward to server → cache result → return
```

Dit vereist wél dat de query **idempotent** is en dat de server `Cache-Control`-headers meestuurt. Mutations komen hier niet voor in aanmerking (ze zijn `POST` en veranderen state).

### 3.3 Response/data-cache (apart mechanisme)

Response-caching (bv. Redis, Dataloader, `@cacheControl`-directives) is een **ander mechanisme** dat onafhankelijk van TD's werkt:

- Je kunt response-caching hebben zonder TD's
- Je kunt TD's hebben zonder response-caching
- TD's maken HTTP-caching wél mogelijk, wat een extra laag toevoegt

Samengevat:

```
TD's ──► maken mogelijk: HTTP/CDN-cache (niveau 2)
     ──► leveren altijd:  parse-cache (niveau 1)

Response-cache (niveau 3) staat hier los van.
```

---

## 4. Ontwerp voor v06

### 4.1 Componentenoverzicht

```
┌─────────────────────────────────────────────────────────┐
│                     Startup                              │
│                                                          │
│  MetaRegistry ──► dynql/schema_builder.go                │
│              ──► BuildSchema()                           │
│              ──► dynql/trusted_documents.go  (nieuw)     │
│                  └── GenereerAlleStandaardQueries()      │
│                  └── GenereerMutationQueries()           │
│                  └── Registreer(docID, query)            │
│                                                          │
│  Resultaat: documents map[string]*TrustedDocument        │
│            { "a3f8b2...": {query, ast, meta} }          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     Request-afhandeling                  │
│                                                          │
│  POST /graphql/query                                     │
│    │                                                     │
│    ├─ documentId aanwezig?                               │
│    │   ├─ Ja → lookup in documents map                   │
│    │   │   ├─ Gevonden → gebruik geregistreerde AST      │
│    │   │   └─ Niet gevonden → fout (of fallback)         │
│    │   └─ Nee → dynamische executie (huidige gedrag)     │
│    │                                                     │
│    └─ Voer uit via graphql.Do()                          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Nieuw bestand: `dynql/trusted_documents.go`

Dit bestand bevat:

1. **`TrustedDocument` struct** — geregistreerde query met metadata
2. **`DocumentRegistry`** — thread-safe map van hash → document
3. **`GenerateStandardQueries()`** — genereert voor elke entiteit de standaardqueries
4. **`GenerateMutationQueries()`** — registreert de drie standaardmutations
5. **`Lookup()`** — zoekt een document op hash
6. **`Manifest()`** — retourneert alle geregistreerde hashes met metadata

#### Datastructuur

```go
// TrustedDocument is een vooraf geregistreerde GraphQL-query.
type TrustedDocument struct {
    Hash       string          // SHA-256 van de query-string
    Query      string          // de originele GraphQL query-string
    Operation  string          // operatienaam (bv. "FullNP")
    Type       string          // "query" of "mutation"
    Entity     string          // gerelateerde entiteit (leeg voor registratie-queries)
    Persisted  time.Time       // wanneer geregistreerd
    Tags       []string        // voor filtering in manifest (bv. "lijst", "full", "tijdreis")
}

// DocumentRegistry beheert alle trusted documents.
type DocumentRegistry struct {
    mu        sync.RWMutex
    documents map[string]*TrustedDocument // hash → document
    byEntity  map[string][]string         // entiteit → []hash (voor manifest-filtering)
    byTag     map[string][]string         // tag → []hash
}
```

#### Hash-berekening

```go
import "crypto/sha256"

func ComputeHash(query string) string {
    h := sha256.Sum256([]byte(query))
    return fmt.Sprintf("%x", h)
}
```

De hash is deterministisch: dezelfde query-string levert altijd dezelfde hash. Dit betekent dat de client de hash zelf kan berekenen (build-time) en de server onafhankelijk dezelfde hash produceert (startup-time) — er is geen registratie-handshake nodig.

#### Query-generatie

```go
func (r *DocumentRegistry) GenerateStandardQueries(registry map[string]model.TypeMeta) error {
    for typenaam, meta := range registry {
        if meta.Metatype != model.MetatypeEntiteit {
            continue
        }
        padnaam := meta.Padnaam
        if padnaam == "" {
            padnaam = meta.Veldnaam
        }

        // 1. full_<padnaam> — volledige entiteit
        r.register(TrustedDocument{
            Query:     fmt.Sprintf(`query Full%s($id: ID!, $peiltijdstip: DateTime, $t: Int) { full_%s(id: $id, peiltijdstip: $peiltijdstip, t: $t) { ... } }`, typenaam, padnaam),
            Operation: "Full" + typenaam,
            Type:      "query",
            Entity:    typenaam,
            Tags:      []string{"full", "tijdreis"},
        })

        // 2. <padnaam> — lijst
        r.register(TrustedDocument{
            Query:     fmt.Sprintf(`query %sList($limit: Int, $offset: Int) { %s(limit: $limit, offset: $offset) { ... } }`, typenaam, padnaam),
            Operation: typenaam + "List",
            Type:      "query",
            Entity:    typenaam,
            Tags:      []string{"list"},
        })

        // 3. full_<padnaam>_list — volledige lijst
        r.register(TrustedDocument{
            Query:     fmt.Sprintf(`query Full%sList($limit: Int, $offset: Int) { full_%s_list(limit: $limit, offset: $offset) { ... } }`, typenaam, padnaam),
            Operation: "Full" + typenaam + "List",
            Type:      "query",
            Entity:    typenaam,
            Tags:      []string{"full", "list"},
        })
    }
    return nil
}
```

> **Ontwerpvraag**: moeten de gegenereerde queries de **volledige veldenlijst** bevatten (concreet) of alleen de **query-structuur met `...`** (abstract)? Zie §5.1.

#### Mutation-registratie

```go
func (r *DocumentRegistry) GenerateMutationQueries() error {
    r.register(TrustedDocument{
        Query:     `mutation Registreer($input: JSON!) { registreer(input: $input) { message registratie_id tijdstip wijzigingen } }`,
        Operation: "Registreer",
        Type:      "mutation",
        Tags:      []string{"mutatie", "registratie"},
    })
    r.register(TrustedDocument{
        Query:     `mutation Corrigeer($input: JSON!) { corrigeer(input: $input) { message registratie_id tijdstip wijzigingen } }`,
        Operation: "Corrigeer",
        Type:      "mutation",
        Tags:      []string{"mutatie", "correctie"},
    })
    r.register(TrustedDocument{
        Query:     `mutation MaakOngedaan($input: JSON!) { maak_ongedaan(input: $input) { message registratie_id tijdstip wijzigingen } }`,
        Operation: "MaakOngedaan",
        Type:      "mutation",
        Tags:      []string{"mutatie", "ongedaanmaking"},
    })
    return nil
}
```

### 4.3 Aanpassing in `dynql/handler.go`

De bestaande `GraphQLHandler` wordt uitgebreid met TD-ondersteuning:

```go
func GraphQLHandler(schema *graphql.Schema, docs *DocumentRegistry) gin.HandlerFunc {
    return func(c *gin.Context) {
        var params struct {
            Query         string                 `json:"query"`
            DocumentID    string                 `json:"documentId"`
            OperationName string                 `json:"operationName"`
            Variables     map[string]interface{} `json:"variables"`
        }

        // ... bestaande POST/GET binding ...

        // Trusted Document lookup
        if params.DocumentID != "" {
            doc, ok := docs.Lookup(params.DocumentID)
            if !ok {
                c.JSON(http.StatusNotFound, gin.H{
                    "error": "Document niet gevonden",
                    "documentId": params.DocumentID,
                })
                return
            }
            params.Query = doc.Query
        }

        // Fallback: als query leeg is én geen documentId → fout
        if params.Query == "" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "query of documentId is verplicht"})
            return
        }

        // ... bestaande graphql.Do() ...
    }
}
```

### 4.4 Aanpassing in `dynql/schema_builder.go`

In `BuildSchema()` wordt de registry aangemaakt en gevuld:

```go
func BuildSchema(database *bun.DB) (*graphql.Schema, *DocumentRegistry, error) {
    InitDB(database)

    docs := NewDocumentRegistry()
    docs.GenerateStandardQueries(model.MetaRegistry)
    docs.GenerateMutationQueries()

    // ... bestaande schema-opbouw ...

    return &schema, docs, nil
}
```

### 4.5 Aanpassing in `main.go`

```go
schema, docs, err := dynql.BuildSchema(db)
// ...
router.POST("/graphql/query", dynql.GraphQLHandler(schema, docs))
router.GET("/graphql/query", dynql.GraphQLHandler(schema, docs))
```

### 4.6 Manifest-endpoint (optioneel)

Een `/graphql/documents` endpoint dat de client kan ophalen:

```go
// GET /graphql/documents?entity=natuurlijk_persoon&tag=full
func ManifestHandler(docs *DocumentRegistry) gin.HandlerFunc {
    return func(c *gin.Context) {
        entity := c.Query("entity")
        tag := c.Query("tag")
        docs := docs.Filter(entity, tag)
        c.JSON(http.StatusOK, docs)
    }
}
```

Dit stelt de frontend in staat om beschikbare TD's te ontdekken en te gebruiken.

### 4.7 Security: strict mode

Een optionele `--strict-documents` flag die, indien actief, **alleen** TD-requests toestaat:

```go
if strictMode && params.DocumentID == "" {
    c.JSON(http.StatusForbidden, gin.H{
        "error": "Alleen trusted documents zijn toegestaan in strict mode",
    })
    return
}
```

In strict mode worden ook `__schema`-introspectie-queries geblokkeerd tenzij expliciet als TD geregistreerd.

### 4.8 Parse-cache (optioneel, fase 2)

In de eerste fase is de winst al aanzienlijk (geen query-string in requests, security-whitelist). In fase 2 kan de AST worden gecached:

```go
type TrustedDocument struct {
    // ... bestaande velden ...
    cachedAST *graphql.Document  // geparsete AST (lazy init)
}
```

`graphql-go/graphql` ondersteunt dit via `graphql.ParseSchema()` en `graphql.NewSchema()` — de AST wordt één keer gebouwd en daarna hergebruikt.

### 4.9 Bestandsoverzicht

| Bestand | Wijziging |
|---------|-----------|
| `dynql/trusted_documents.go` | **Nieuw**: `DocumentRegistry`, `TrustedDocument`, query/mutation generators |
| `dynql/handler.go` | **Aanpassing**: `documentId`-parameter toevoegen aan handler |
| `dynql/schema_builder.go` | **Aanpassing**: `BuildSchema()` retourneert ook `*DocumentRegistry` |
| `main.go` | **Aanpassing**: `DocumentRegistry` doorgeven aan handler, optionele manifest-route |
| `docs/trusted-documents.md` | Dit document |

---

## 5. Open vragen en ontwerpbeslissingen

### 5.1 Concrete vs. abstracte queries

Bij het genereren van TD's zijn er twee benaderingen:

**A) Concrete queries** (volledige veldenlijst)
```graphql
query FullNP($id: ID!) {
  full_natuurlijk_personen(id: $id) {
    id opvoer afvoer weergavenaam
    namen { roepnaam achternaam voorletters }
    burgerschappen { landcode nationaliteit }
    # ... alle velden expliciet
  }
}
```
- ✅ Client krijgt altijd alle velden — simpel
- ❌ Query is groot; de client kan niet kiezen welke velden hij wil
- ❌ Bij modelwijzigingen moet de query opnieuw gegenereerd worden

**B) Structuur-queries** (placeholder `...`)
```graphql
query FullNP($id: ID!) {
  full_natuurlijk_personen(id: $id) {
    # client specificeert velden via @skip/@include of fragmenten
  }
}
```
- ✅ Flexibeler — client kiest velden
- ❌ Complexer — client moet fragmenten meesturen

**Aanbeveling voor v06**: begin met **concrete queries** (A) voor de `full_*`-patronen. De frontend gebruikt al het volledige schema; het is onwaarschijnlijk dat clients slechts 2 van de 15 velden willen. Voor lijst-queries (`{padnaam}_list`) kan de concrete variant ook de standaard zijn, met een aparte `_light` variant voor minimale weergave.

### 5.2 Hash-algoritme

SHA-256 wordt aanbevolen boven MD5 of SHA-1 vanwege:
- Cryptografische veiligheid (moeilijker collisions te forceren)
- Universeel beschikbaar in Go stdlib (`crypto/sha256`)
- Voldoende kort voor URLs (64 hex karakters)

### 5.3 Registratie-timing

Twee opties:

1. **Build-time**: client berekent hash en registreert bij server via API
   - Voordeel: client bepaalt welke queries beschikbaar zijn
   - Nadeel: extra API-endpoint nodig, coördinatie tussen client en server

2. **Startup-time**: server genereert alle queries bij initialisatie (ons ontwerp)
   - Voordeel: geen coördinatie, deterministisch, altijd actueel met schema
   - Nadeel: minder flexibel voor ad-hoc client queries

Voor v06 is **startup-time** (optie 2) de juiste keuze — het sluit aan bij de dynamische schema-filosofie en vereist geen aanpassingen in de frontend-build.

### 5.4 GraphiQL en TD's

In de GraphiQL playground (`/graphql/playground`) wil je géén TD's afdwingen — gebruikers moeten vrij kunnen experimenteren. De handler kan dit onderscheiden via:

- `/graphql/playground` → altijd dynamische executie
- `/graphql/query` → TD's optioneel (of verplicht in strict mode)

Of via een HTTP-header: `X-GraphQL-Mode: playground` vs. `X-GraphQL-Mode: production`.

---

## 6. Fasering

| Fase | Inhoud | Prioriteit |
|------|--------|-----------|
| **Fase 1** | `trusted_documents.go`: registry, startup-generatie, handler-aanpassing voor `documentId` | Hoog |
| **Fase 2** | AST parse-cache in `TrustedDocument`, manifest-endpoint | Middel |
| **Fase 3** | Strict mode (`--strict-documents`), security-integratie met PBAC-autorisatie | Middel |
| **Fase 4** | Client-side integratie: frontend gebruikt `documentId` i.p.v. query-string | Laag |
| **Fase 5** | HTTP/CDN-caching met `Cache-Control` headers voor GET TD-requests | Laag |

---

## 7. Referenties

- [Apollo Persisted Queries](https://www.apollographql.com/docs/apollo-server/performance/apq/)
- [Relay Persisted Queries](https://relay.dev/docs/guides/persisted-queries/)
- [GraphQL over HTTP spec — Persisted Documents](https://github.com/graphql/graphql-over-http/blob/main/spec/GraphQLOverHTTP.md#persisted-documents)
- [GraphQL Foundation — Trusted Documents](https://graphql.org/learn/trusted-documents/)
- Onze dynamische GraphQL-laag: [`docs/dynamische-graphql-laag.md`](./dynamische-graphql-laag.md)
- Ons PBAC-autorisatieontwerp: [`autoriseren/autoriseren.md`](../autoriseren/autoriseren.md)
