# Plan: Drie extra registratiemanieren (v06)

> Status: Fase 1 ✅ geïmplementeerd op 2026-04-28, incl. FK-propagatie ✅ E2E geverifieerd 2026-04-28. Fasen 0/2/3 nog open.
> Dit plan is door de Plan-agent voorbereid en daarna door de coding-agent
> geconcretiseerd; het hoort bij `docs/plans/2026-04-28 extra registratie manieren`.

## TL;DR
Drie complementaire schrijflagen bovenop de bestaande `RegistreerMetNieuweAanpak`-engine:
1. **Geneste "full" registratie-payload** — ENT met embedded GE's/relaties als één wijziging-blok, server splitst naar individuele Wijziging-rijen (audit blijft fijnmazig); originele payload in `Registratie.RequestBody`.
2. **REST/CRUD-laag** — POST/GET/PATCH/DELETE per padnaam (entiteit, GE, relatie). PATCH met JSON Merge Patch (RFC 7396) → diff-engine berekent wijzigingen tegen huidige toestand. `?modus=registratie|correctie` (default registratie).
3. **GraphQL Command-laag** — sterk getypeerde mutations per representatie, gegenereerd uit MetaRegistry (echte CQRS C-zijde). Naast bestaande JSON-mutations.

Alle drie vertalen naar dezelfde interne `RegistreerRequest` → één engine, één audit-pad, één transactiemodel.

---

## Architectuur — gedeelde kern

### Nieuwe centrale laag: `handlers/registration_normalizer.go`
Pure functie:
```
NormaliseerNaarWijzigingen(input GenestePayload, modus Registratietype) ([]WijzigingRequest, error)
```
- Input: geneste boom (full-style) of platte input (current-style) of single-record (REST CRUD).
- Output: vlakke lijst `WijzigingRequest` zoals huidige handler verwacht.
- Gebruikt `MetaRegistry.OnderliggendeGegevenselementen` om geneste velden te herkennen.
- Recursief: voor elk veld waarvan de JSON-key matcht een `JSONRolnaam` van een onderliggend GE/relatie → recurseer; anders → veld blijft op huidig niveau.
- Gebruikt `GetByVeldnaamMetPayload` voor disambiguatie (nu al in gebruik).

Daarmee wordt `RegistreerMetNieuweAanpak` één entry, en zijn de drie nieuwe lagen dunne adapters:
```
[Full JSON]  ─┐
[REST CRUD]  ─┼─► Normalizer ─► RegistreerRequest ─► RegistreerMetNieuweAanpak (engine)
[GraphQL]    ─┘
```

### Diff-engine voor PATCH: `handlers/registration_diff.go`
```
BerekenWijzigingen(huidig FullEntity, gewenst GenestePayload, meta TypeMeta) ([]WijzigingRequest, error)
```
- Laadt huidige toestand via bestaande `MakeGetFullEntityByMetaHandler` interne helper.
- Vergelijkt veld-voor-veld (ondiep én genest).
- Voor enkelvoudige GE's: bij verschil → afvoer oude rel_id + opvoer nieuwe.
- Voor meervoudige GE's (zoals `burgerschap[]`): match op natuurlijke sleutel of `rel_id`; bepaal toegevoegde/verwijderde/gewijzigde rijen.
- Voor materiële plumbing (`aanvang`/`einde`): nieuwe versie als datum verandert.
- RFC 7396 semantiek: `null` = expliciet verwijderen (afvoer); ontbrekend veld = ongewijzigd; aanwezig met waarde = set.

---

## Fase 1: Geneste full-registratie ✅ GEÏMPLEMENTEERD (2026-04-28)

Bestanden (definitief):
- `handlers/registration_normalizer.go` — `NormaliseerWijziging` / `NormaliseerWijzigingen`.
- `model/REST request models.go` — `RawPayload` veld op `RepresentatiePlusNaam`; `UnmarshalJSON` stript onderliggende-GE keys vóór typed-unmarshal en bewaart de originele payload.
- `handlers/registration_handlers.go` — leest raw body via `c.GetRawData()` (audit-fidelity), reset body voor downstream readers, roept `NormaliseerWijzigingen` vóór de wijziging-loop.
- `handlers/registration_normalizer_test.go` — 4 tests; alle groen. Volledige `go test ./...` groen.

### Doel
Eén wijziging-blok mag een entiteit-boom bevatten in dezelfde shape als `GET /full/{padnaam}/:id`-response.

### Wijzigingen
1. **Detectie in `RepresentatiePlusNaam.UnmarshalJSON`** — als payload ook keys bevat die matchen op `OnderliggendeGegevenselementen.JSONRolnaam`, worden die afgesplitst (en alleen het 'eigen' deel typed-unmarshald).
2. **Aanroepen `NormaliseerWijzigingen`** vóór de wijziging-loop in `RegistreerMetNieuweAanpak`.
3. **Audit**: raw body wordt nu rechtstreeks bewaard in `Registratie.RequestBody` — geen verlies door re-marshal.
4. **Roundtrip-symmetrie**: dezelfde JSON-shape als full-GET response is valide input → makkelijk te kopiëren/herzenden.

### Out of scope (Fase 1)
- Geen geneste afvoer-shortcuts (afvoer blijft per record); ENT-cascade werkt al.
- Geen ID-allocatie server-side: client levert ID's aan zoals nu.

### FK-propagatie (onderdeel Fase 1, ✅ E2E geverifieerd 2026-04-28)
Client hoeft de parent-FK (`{ent}_id`, bijv. `natuurlijkpersoon_id`) **niet** mee te sturen in geneste children. De normalizer injecteert de FK automatisch vanuit de parent-context, op basis van `childMeta.EntiteitIDKolom`.

Implementatie in `handlers/registration_normalizer.go`:
- `injecteerParentFK(raw, fkKolom, parentID)` — injecteert FK in child-JSON vóór `json.Unmarshal`; client-waarde heeft voorrang als al aanwezig.
- Aanroep in `NormaliseerWijziging` vóór elk child-unmarshal.

Dit principe geldt over alle fasen: **nooit FK verplicht in geneste payloads**.

### Verificatie
- Unit: `TestNormaliseer_*` (4 tests) op ABUVWXY-model — geneste opvoer/afvoer + lijst-aggregatie + vlakke pass-through. ✅
- Integration: `TestNormaliseer_NPLoc_*` (3 tests) op np_loc-domein — FK-injectie assertions, geen FKs in input. ✅
- E2E: POST geneste NatuurlijkPersoon zonder FKs in children → 201 met `natuurlijkpersoon_id` in alle child-responses. ✅
- Backward-compat: bestaande "platte" payloads blijven werken (regression suite groen). ✅

---

## Fase 2: REST/CRUD-laag (NL API Strategie)

### Doel
Per padnaam gebruikelijke REST-endpoints, intern → registratie. Compatibel met OpenKlant/OpenZaak-stijl clients.

### Endpoints per representatie (entiteit, GE, relatie)
| Methode | Pad | Vertaling |
|---|---|---|
| `GET /{padnaam}` | bestaat al | lijst |
| `GET /{padnaam}/:id` | bestaat al | detail |
| `GET /full/{padnaam}/:id` | bestaat al | detail incl. nested |
| `POST /{padnaam}` | bestaat al (bypass-insert) | **wijzigen**: route via Normalizer + RegistreerEngine; `?modus=registratie\|correctie` |
| `POST /full/{padnaam}` | bestaat (`MakeAddFullEntityByMetaHandler`) | **wijzigen**: idem, gebruikt geneste normalizer (Fase 1) |
| `PATCH /{padnaam}/:id` | **nieuw** | JSON Merge Patch (RFC 7396) → diff-engine → wijzigingen |
| `PATCH /full/{padnaam}/:id` | **nieuw** | merge-patch op nested boom → diff-engine |
| `DELETE /{padnaam}/:id` | **nieuw** | enkele afvoer-wijziging; ENT cascade-afvoer als nu |

### Nieuwe handlers (generiek)
- `MakePatchEntityByMetaHandler(meta)` — leest huidige full entity, accepteert merge-patch body, roept `BerekenWijzigingen` + `RegistreerCore` aan.
- `MakeDeleteEntityByMetaHandler(meta)` — bouwt enkele `WijzigingRequest{Afvoer: ...}` met `id` uit URL.
- `MakeFullPatchEntityByMetaHandler(meta)` — variant met geneste merge-patch.

### Header/Query semantiek
- `?modus=registratie|correctie` (default: `registratie`).
- `?modus=correctie` met PATCH/POST → `Registratietype=Correctie`, koppelt aan laatste registratie van dat object.
- `If-Match` / `If-Unmodified-Since`: optioneel later (concurrency); voor nu noteren in BACKLOG.
- `Prefer: return=representation` honoreren — return full entity na write.
- Idempotency-Key header → opslaan in `Registratie` voor deduplicatie (later, BACKLOG).

### Refactor engine voor interne aanroep (Fase 0)
- Huidige `RegistreerMetNieuweAanpak` is `gin.HandlerFunc` die request parsed. Splits in:
  - `RegistreerMetNieuweAanpak()` (HTTP-adapter, blijft voor `POST /registratie/`)
  - `RegistreerCore(ctx, db, req RegistreerRequest, audit AuditMeta) (RegistreerResponse, error)` — pure functie
- Beide nieuwe REST-handlers én GraphQL-mutations roepen `RegistreerCore` aan.
- Bestaande helpers (`handleRepresentatieOpvoer` etc.) gebruiken alleen `c.Request.Context()` → kunnen straightforward op `context.Context` worden gezet.

### OpenAPI-uitbreiding
- `handlers/openapi_handler.go`: per padnaam ook PATCH/DELETE-operaties genereren.
- Body-schema's voor PATCH = JSON Merge Patch over de nested-shape; documenteer `application/merge-patch+json` (RFC 7396).
- Documenteer `?modus`, `Prefer`-header.

### Verificatie
- Unit: `TestBerekenWijzigingen_*` — set/clear/add/remove/change op enkelvoud, meervoud, materieel.
- Integration: POST → PATCH (toevoeging veld) → PATCH (verwijdering met null) → DELETE → controleer wijziging-rijen + audit.
- NL API Strategie compliance check (referentie: openzaak-OAS).

---

## Fase 3: GraphQL Command-laag (sterk getypeerd)

### Doel
Per representatie typed input objects in GraphQL-schema, niet meer (alleen) JSONScalar. CQRS-Command-zijde formaliseren.

### Ontwerp
Voor elke `TypeMeta`:
- Input type `<Type>OpvoerInput` met velden = data-velden (geen `opvoer/afvoer` derivaten), incl. nested `<ChildType>OpvoerInput` voor onderliggende GE's/relaties (matching shape Fase 1).
- Mutations:
  - `registreer<Type>(input: <Type>OpvoerInput!, opmerking: String): RegistratieResultaat`
  - `corrigeer<Type>(id: ID!, input: <Type>OpvoerInput!, opmerking: String): RegistratieResultaat`
  - `voer<Type>Af(id: ID!, opmerking: String): RegistratieResultaat`
  - Optioneel: `wijzig<Type>(id: ID!, patch: <Type>PatchInput!, modus: Modus = REGISTRATIE)` — patch-variant met alle velden optioneel (= merge-patch).
- Plus generieke fallback: bestaande `registreer(input: JSON)`/`corrigeer`/`maak_ongedaan` mutations blijven werken (geen breaking change).
- Resolver delegeert naar `RegistreerCore` (zelfde pad als REST/Full).

### Schema-builder uitbreiding
- Nieuw bestand `dynql/mutation_input_builder.go`: bouwt `<Type>OpvoerInput`, `<Type>PatchInput` recursief uit MetaRegistry.
- `dynql/schema_builder.go`: registreer per type de typed mutations.

### Verificatie
- Unit: schema-build test → assert `registreerNatuurlijkPersoon` mutation bestaat met juiste input type fields.
- Integration: GraphQL mutation in GraphiQL → record in DB matcht equivalente REST-call.
- Schema introspection-snapshot test (volgorde-stabiel).

---

## Volgorde & afhankelijkheden

| Stap | Fase | Status | Afhankelijk van |
|---|---|---|---|
| 1 | Fase 1: Normalizer + nested input | ✅ 2026-04-28 | — |
| 2 | Tests + integratie + Postman Fase 1 | 🟡 in uitvoering | 1 |
| 3 | Fase 0: `RegistreerCore` extractie | ⏳ | 1 |
| 4 | Fase 2a: Diff-engine (`BerekenWijzigingen`) | ⏳ | 3 |
| 5 | Fase 2b: PATCH/DELETE handlers + routes | ⏳ | 4 |
| 6 | Fase 2c: OpenAPI uitbreiding | ⏳ | 5 |
| 7 | Fase 3a: typed input-builder | ⏳ | 3, 1 |
| 8 | Fase 3b: typed mutations + resolvers | ⏳ | 7 |
| 9 | Documentatie consolidatie | ⏳ | 6, 8 |

---

## Decisions
- **Audit-granulariteit (1)**: hybride — N Wijziging-rijen + originele geneste payload in `Registratie.RequestBody` (geïmplementeerd via raw body capture).
- **REST scope (2)**: alle representaties (entiteit, GE, relatie) krijgen POST/PATCH/DELETE; PATCH met JSON Merge Patch + diff-engine.
- **PATCH semantiek (2)**: `?modus=registratie|correctie`, default `registratie`.
- **GraphQL (3)**: sterk getypeerde input-types per representatie, gegenereerd uit MetaRegistry. Bestaande JSONScalar-mutations blijven (back-compat).
- **Afvoer-shortcuts (1)**: niet uitbreiden; ENT-cascade volstaat. Alleen documenteren.
- **Engine deduplicatie**: één `RegistreerCore` voor alle drie de lagen.
- **Geen ID-allocatie server-side** in deze iteratie (BACKLOG).
- **Geen optimistic concurrency** (`If-Match`) in deze iteratie (BACKLOG).
- **Geen Idempotency-Key** in deze iteratie (BACKLOG).

## Out of scope
- Bulk-operaties (PUT/PATCH op collection).
- ETag/concurrency control.
- Sub-resource POST (`POST /natuurlijke_personen/1/burgerschap`) — komt vanzelf via geneste payload.
- Server-side ID-generatie voor entiteiten zonder client-ID.

## Risks / further considerations
1. **Disambiguatie**: meerdere types met dezelfde `Veldnaam` (bv. "naam"): bestaande `GetByVeldnaamMetPayload` werkt op `EntiteitIDKolom`-aanwezigheid. In nested context is parent-context bekend → kunnen we strikter resolven (onderliggende GE's van parent in plaats van globale lookup). Aanbevolen: nieuwe helper `GetByJSONRolnaamBijOuder(parent, jsonRolnaam)`.
2. **PATCH op _Data versies**: een patch op een data-veld → nieuwe Versie binnen dezelfde rel_id (geen nieuwe rel_id). Diff-engine moet dit weten via TypeMeta `GESubtype=data`.
3. **Materiële plumbing in PATCH**: `aanvang.datum` wijzigen → nieuwe versie van `_Aanvang`-rij; geen nieuwe entiteit-rij.
4. **DELETE-cascade**: DELETE op een GE/relatie-rij voert alleen die rel_id af; DELETE op een entiteit cascadeert altijd naar onderliggende GE's en relaties. Een "cascade=false"-optie op entiteit-niveau wordt **niet** geboden: GE's/relaties zijn via compositie deel van de entiteit en kunnen niet zonder actieve parent bestaan (dat zou een incoherent register opleveren). Andersom kan wel: een GE/relatie mag formeel of materieel een korter bestaan hebben dan zijn parent — de parent-entiteit heeft per definitie de langste tijdslijn.
5. **GraphQL-naamgeving**: vermijd botsing met query-types. Convention: query=`<padnaam>`/`full_<padnaam>`, mutation=`registreer<Typenaam>` etc. (PascalCase op typenaam).
6. **OpenAPI body-schema voor merge-patch**: vereist `Content-Type: application/merge-patch+json` per RFC 7396 — moet expliciet gedocumenteerd.
