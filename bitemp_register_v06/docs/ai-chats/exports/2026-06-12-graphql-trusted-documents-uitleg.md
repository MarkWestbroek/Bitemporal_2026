# Chat: GraphQL trusted documents uitleg

- **Datum**: 2026-06-12 15:43
- **Sessie-ID**: `ab0138c6-227e-46b9-9cd5-9d19ebed3810`
- **Berichten**: 8

---

## 🧑 User

We hebben een GraphQL server ingebouwd, die zichzelf initialiseert vanuit het Metamodel.

Nu heb ik recentelijk gehoord van zogenaamde "trusted documents" in GQL, maar ik snap het nog niet helemaal. Zouden deze TD's een uitkomst zijn om bepaalde veelvoorkomende GQL queries voor te definieren?

Helpen TD's ook met caching, of is dat een ander mechanisme?

---

## 🤖 Assistant

## Trusted Documents in GraphQL

Trusted Documents (ook wel *persisted queries* of *persisted documents* genoemd) zijn inderdaad een nuttig mechanisme. Hier is hoe ze werken en wat ze voor jullie architectuur kunnen betekenen:

### Wat zijn Trusted Documents?

In plaats van een volledige GraphQL-query over de lijn te sturen:

```json
// Zonder TD — elke keer de volledige query meesturen
POST /graphql
{
  "query": "query { full_natuurlijk_persoon(id: \"abc\") { np_naam { voornaam achternaam } np_geboortedatum { datum } } }"
}
```

Stuur je alleen een hash:

```json
// Met TD — alleen de hash
GET /graphql?documentId=sha256hash123abc
```

De server heeft de query vooraf geregistreerd onder die hash en voert hem uit.

### Wat levert het op?

| Voordeel | Toelichting |
|----------|-------------|
| **Security** | Alleen queries die jij hebt geregistreerd kunnen uitgevoerd worden. Een aanvaller kan geen willekeurige diepe `__schema`-introspectie of dure queries draaien. Dit is de kern van de naam "trusted": je vertrouwt alleen wat jijzelf hebt klaargezet. |
| **Performance (parse-cache)** | De server parsed en valideert de query maar één keer bij registratie. Daarna is het pure `execution` — de AST ligt klaar. |
| **HTTP caching** | Omdat het een `GET`-request is met een stabiele URL, kunnen proxies/CDN's het resultaat cachen als de query idempotent is. |
| **Bandbreedte** | Kleinere requests, vooral bij lange queries. |
| **Client-side tooling** | Relay, Apollo, en URQL ondersteunen allemaal persisted queries — de client stuurt automatisch eerst de hash, en valt terug op de volledige query als de server die hash niet kent. |

### Is caching een ander mechanisme?

Deels. Trusted Documents **faciliteren** caching op meerdere niveaus:

1. **Query-parse cache** — dit is inherent aan TD: de server parsed één keer, cached de AST voor altijd.
2. **HTTP/CDN cache** — TD's maken `GET`-requests met stabiele URLs mogelijk, wat CDN-caching ontsluit. Dit is *optioneel* en hangt af van of de query idempotent is en of je `Cache-Control` headers meestuurt.
3. **Response/data cache** (bv. Redis, Dataloader-caching, `response_cache`-directives) — dit is een **apart mechanisme** dat onafhankelijk van TD's werkt. Je kunt response-caching hebben zonder TD's, en TD's zonder response-caching.

Dus: TD's helpen met caching van de *query zelf* (niveau 1) en maken HTTP-caching *mogelijk* (niveau 2), maar zijn geen vervanging voor data-caching (niveau 3).

### Past dit in jullie v06 architectuur?

Absoluut — en het sluit naadloos aan op jullie aanpak:

```
┌──────────────────────────────────────────────────┐
│                Bij startup:                       │
│  MetaRegistry ──► dynql/ bouwt GraphQL schema    │
│                 ──► Genereert TD's per type       │
│                    (full_<padnaam>, lijst, etc.)  │
└──────────────────────────────────────────────────┘
```

Omdat jullie schema al volledig dynamisch is, kun je bij initialisatie automatisch trusted documents genereren voor:

- `full_{padnaam}(id, peiltijdstip)` — per entiteitstype
- `{padnaam}_list(page, size, filter)` — pagineringsqueries  
- `full_{padnaam}_tijdreis(id, t)` — de formele/materiële tijdreis-queries

Elk document krijgt een deterministische hash (SHA-256 van de query-string), en de client kan die gebruiken.

### Aanpak voor v06

Een minimale implementatie zou er zo uitzien:

1. **Registratie-map** in `dynql/trusted_documents.go` — een `map[string]string` (hash → query).
2. **Generator** die bij `InitGraphQLSchema()` voor elke entiteit de standaardqueries registreert.
3. **Middleware** op de `/graphql` endpoint: als `documentId` aanwezig is → lookup, anders fallback naar dynamische executie (voor de ## Trusted Documents in GraphQL

Trusted Documents (ook wel *persisted queries* of *persisted documents* genoemd) zijn inderdaad een nuttig mechanisme. Hier is hoe ze werken en wat ze voor jullie architectuur kunnen betekenen:

### Wat zijn Trusted Documents?

In plaats van een volledige GraphQL-query over de lijn te sturen:

```json
// Zonder TD — elke keer de volledige query meesturen
POST /graphql
{
  "query": "query { full_natuurlijk_persoon(id: \"abc\") { np_naam { voornaam achternaam } np_geboortedatum { datum } } }"
}
```

Stuur je alleen een hash:

```json
// Met TD — alleen de hash
GET /graphql?documentId=sha256hash123abc
```

De server heeft de query vooraf geregistreerd onder die hash en voert hem uit.

### Wat levert het op?

| Voordeel | Toelichting |
|----------|-------------|
| **Security** | Alleen queries die jij hebt geregistreerd kunnen uitgevoerd worden. Een aanvaller kan geen willekeurige diepe `__schema`-introspectie of dure queries draaien. Dit is de kern van de naam "trusted": je vertrouwt alleen wat jijzelf hebt klaargezet. |
| **Performance (parse-cache)** | De server parsed en valideert de query maar één keer bij registratie. Daarna is het pure `execution` — de AST ligt klaar. |
| **HTTP caching** | Omdat het een `GET`-request is met een stabiele URL, kunnen proxies/CDN's het resultaat cachen als de query idempotent is. |
| **Bandbreedte** | Kleinere requests, vooral bij lange queries. |
| **Client-side tooling** | Relay, Apollo, en URQL ondersteunen allemaal persisted queries — de client stuurt automatisch eerst de hash, en valt terug op de volledige query als de server die hash niet kent. |

### Is caching een ander mechanisme?

Deels. Trusted Documents **faciliteren** caching op meerdere niveaus:

1. **Query-parse cache** — dit is inherent aan TD: de server parsed één keer, cached de AST voor altijd.
2. **HTTP/CDN cache** — TD's maken `GET`-requests met stabiele URLs mogelijk, wat CDN-caching ontsluit. Dit is *optioneel* en hangt af van of de query idempotent is en of je `Cache-Control` headers meestuurt.
3. **Response/data cache** (bv. Redis, Dataloader-caching, `response_cache`-directives) — dit is een **apart mechanisme** dat onafhankelijk van TD's werkt. Je kunt response-caching hebben zonder TD's, en TD's zonder response-caching.

Dus: TD's helpen met caching van de *query zelf* (niveau 1) en maken HTTP-caching *mogelijk* (niveau 2), maar zijn geen vervanging voor data-caching (niveau 3).

### Past dit in jullie v06 architectuur?

Absoluut — en het sluit naadloos aan op jullie aanpak:

```
┌──────────────────────────────────────────────────┐
│                Bij startup:                       │
│  MetaRegistry ──► dynql/ bouwt GraphQL schema    │
│                 ──► Genereert TD's per type       │
│                    (full_<padnaam>, lijst, etc.)  │
└──────────────────────────────────────────────────┘
```

Omdat jullie schema al volledig dynamisch is, kun je bij initialisatie automatisch trusted documents genereren voor:

- `full_{padnaam}(id, peiltijdstip)` — per entiteitstype
- `{padnaam}_list(page, size, filter)` — pagineringsqueries  
- `full_{padnaam}_tijdreis(id, t)` — de formele/materiële tijdreis-queries

Elk document krijgt een deterministische hash (SHA-256 van de query-string), en de client kan die gebruiken.

### Aanpak voor v06

Een minimale implementatie zou er zo uitzien:

1. **Registratie-map** in `dynql/trusted_documents.go` — een `map[string]string` (hash → query).
2. **Generator** die bij `InitGraphQLSchema()` voor elke entiteit de standaardqueries registreert.
3. **Middleware** op de `/graphql` endpoint: als `documentId` aanwezig is → lookup, anders fallback naar dynamische executie (voor de GraphiQL playground).
4. **Manifest-endpoint** (`/graphql/documents`) dat de client kan ophalen om te weten welke hashes beschikbaar zijn.

Wil je dat ik dit verder uitwerk in een ontwerp-document, of wil je eerst nog specifieke vragen over TD's beantwoord hebben?

---

## 🧑 User

Ja, ik heb nog een vraag over het verschil tussen opvraag queries en mutation queries. Kun je de laatste ook persisteren?

---

## 🤖 Assistant

## Mutations als Trusted Documents

Ja, mutations kun je ook persisteren — maar er zijn belangrijke beperkingen en afwegingen:

### Het korte antwoord

Technisch kan het, maar het levert veel minder op dan bij queries. De meeste implementaties (Relay, Apollo, Hasura) ondersteunen het, maar in de praktijk zie je het zelden omdat de voordelen grotendeels wegvallen.

### Waarom het weinig toevoegt

| Aspect | Queries | Mutations |
|--------|---------|-----------|
| **Parse-cache** | ✅ Elke milliseconde telt bij leesverkeer (veel requests). | 🤏 Mutations zijn per definitie schrijfoperaties — veel minder frequent. De parse-winst is verwaarloosbaar. |
| **HTTP caching** | ✅ `GET` met stabiele URL → CDN/proxy-cache mogelijk. | ❌ Mutations zijn `POST` en veranderen state — je kunt en mag ze niet cachen. |
| **Bandbreedte** | ✅ Grote queries schelen veel bytes. | 🤏 Mutations zijn doorgaans compact: `registreer(...)`, `corrigeer(...)`. |
| **Security** | ✅ Alleen geregistreerde queries uitvoerbaar. | ✅ Dit voordeel geldt wél! Een aanvaller kan geen willekeurige mutaties sturen. |

Het enige argument vóór mutation-persistentie is dus **security**: je whitelist welke mutaties de server accepteert.

### De variabelen-kwestie

Dit is het belangrijkste verschil met queries:

```graphql
# Query — variabelen zijn simpel (filter, id, paginering)
query FullNP($id: ID!, $t: DateTime) {
  full_natuurlijk_persoon(id: $id, peiltijdstip: $t) {
    np_naam { voornaam achternaam }
  }
}
# ✅ Hash = SHA(query-string). Variabelen gaan apart mee.
```

```graphql
# Mutation — vaak complexe input-objecten
mutation Registreer($input: RegistreerInput!) {
  registreer(input: $input) {
    registratie { id tijdstip }
    wijzigingen { id }
  }
}
# ⚠️ Hash werkt nog steeds, maar $input is groot en variabel
```

Hier zit het probleem niet — de hash dekt de *query-structuur*, de `$input` gaat altijd apart. Het werkt technisch prima.

Maar de denkfout die mensen vaak maken: ze hopen de *volledige mutation + variabelen* als één blok te persisteren voor hergebruik. Dat kan niet — een registratie is per definitie uniek.

### Wat is wél interessant voor jullie architectuur?

Voor een bitemporeel register zijn de mutations juist heel gestructureerd — jullie hebben drie standaardmutaties:

```
registreer(input)    ← opvoeren/afvoeren van representaties
corrigeer(input)     ← correctie op bestaande data (nieuwe _Data-versie)
maak_ongedaan(input) ← ongedaanmaking van een registratie
```

Deze mutations hebben een **vaste structuur** maar unieke input. Daarmee zijn ze wél goede kandidaten voor TD — niet voor caching, maar puur voor **security en parse-cache**:

```go
// Bij startup registreren:
documents.Register("registreer", `
  mutation Registreer($input: RegistreerInput!) {
    registreer(input: $input) {
      registratie { id tijdstip }
      wijzigingen { id type opvoer afvoer }
    }
  }
`)
```

### Concreet advies voor v06

Zet TD's primair in voor **queries** — daar zit de echte winst. Voor mutations voegt het pas waarde toe als je een **productie-autorisatiemodel** hebt waarin je wilt afdwingen dat alleen deze drie mutations uitvoerbaar zijn (geen `__schema`-mutaties, geen handmatige DML-achtige queries).

Dit sluit ook aan bij jullie PBAC-autorisatieontwerp: de TD-laag fungeert als een **extra PEP-controle** — de Policy Enforcement Point kan mutations weigeren die niet in de trusted-document lijst staan, nog vóór de autorisatie-engine (PDP) wordt geraadpleegd.

---

## 🧑 User

ik snap het enigszins. Ik snap nog niet hoe variabelen aan een TD worden meegegeven

---

## 🤖 Assistant

## Variabelen bij Trusted Documents: het wire-formaat

De verwarring is begrijpelijk — het is subtiel. Het concept is: **de query-structuur is vooraf bekend (via hash), alleen de variabelen gaan over de lijn**.

### Zonder TD (standaard GraphQL)

```json
POST /graphql
{
  "query": "query FullNP($id: ID!) { full_natuurlijk_persoon(id: $id) { np_naam { voornaam } } }",
  "variables": { "id": "np-12345" }
}
```

Beide — query én variabelen — in één body.

### Met TD (persisted query)

```json
POST /graphql
{
  "documentId": "a3f8b2c1d4e5...",
  "variables": { "id": "np-12345" }
}
```

De server kent `a3f8b2c1d4e5...` → weet exact welke query-structuur erbij hoort → voegt de variabelen samen → executeert.

### Hoe de server dit intern oplost

```go
// Bij registratie (startup):
documents["a3f8b2c1d4e5..."] = `
  query FullNP($id: ID!) {
    full_natuurlijk_persoon(id: $id) {
      np_naam { voornaam achternaam }
    }
  }
`

// Bij request-afhandeling:
func ExecuteTrusted(docID string, variables map[string]interface{}) {
    query := documents[docID]          // "query FullNP($id: ID!) { ... }"
    schema := getSchema()
    result := graphql.Do(graphql.Params{
        Schema:         schema,
        RequestString:  query,          // ← de geregistreerde query-structuur
        VariableValues: variables,      // ← de variabelen uit het request
    })
}
```

De `$id`-placeholder in de geregistreerde query wordt gevuld met `"np-12345"` uit de `variables`-map. Het is dus **exact dezelfde variabelen-resolutie** als bij een normale GraphQL-request — het enige verschil is dat de query-string niet meer in het request zit.

### Drie manieren om variabelen mee te sturen

| Methode | Wire-formaat | Gebruik |
|---------|-------------|---------|
| **POST body** (standaard) | `{"documentId":"hash","variables":{...}}` | Meest gangbaar. Apollo noemt dit "Automatic Persisted Queries". |
| **GET query params** | `GET /graphql?documentId=hash&variables={"id":"x"}` | Handig voor CDN-caching van queries. Alleen voor queries, niet mutations. |
| **GET + extensions** | `GET /graphql?documentId=hash&extensions={"variables":{...}}` | Relay-conventie. |

### Voor mutation met TD

```json
POST /graphql
{
  "documentId": "7f9e3a...",
  "variables": {
    "input": {
      "entiteitType": "natuurlijk_persoon",
      "wijzigingen": [
        {"actie": "opvoer", "representatieType": "np_naam", "data": {"voornaam": "Jan"}}
      ]
    }
  }
}
```

De geregistreerde mutation is:

```graphql
mutation Registreer($input: RegistreerInput!) {
  registreer(input: $input) { registratie { id } }
}
```

De `$input` variabele wordt gevuld met het complete input-object uit de POST-body. De mutation-structuur zelf (hash `7f9e3a...`) is onveranderd.

### Kerninzicht

> De hash vervangt alleen de **query-string** — niet de variabelen, niet de operatie-naam, niet de context. Het GraphQL-executiemodel blijft volledig intact. Het is puur een transport-optimalisatie + security-laag.

Dit is ook waarom TD's zo goed passen bij jullie dynamische schema: de query-structuren zijn voorspelbaar (per entiteitstype dezelfde vorm), maar de ingevulde waarden (welke `id`, welk `peiltijdstip`) zijn per request uniek.

---

## 🧑 User

Cool! Zou je een ontwerp document willen maken over bovenstaande? Met wat achtergrond. Wat zijn TD's, hoe werken ze, waarom zijn ze nuttig voor ons project en hoe zou je het kunnen bouwen?

---

## 🤖 Assistant

Let me eerst de bestaande GraphQL-documentatie en de `dynql/`-implementatie bekijken, zodat het ontwerpdocument naadloos aansluit op de huidige architectuur.

---
