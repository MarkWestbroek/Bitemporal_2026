# Release-/wijzigingslog — Backend (Go API) & overall

> Dit is het chronologische wijzigingslog voor de **backend** en overkoepelende wijzigingen.
> Frontend/Studio heeft een eigen log in [`web/vite/CHANGELOG.md`](web/vite/CHANGELOG.md); de
> generator in [`cmd/codegen/CHANGELOG.md`](cmd/codegen/CHANGELOG.md). Versionering-conventie:
> [`docs/versiebeheer.md`](docs/versiebeheer.md) — backend-tags gebruiken de prefix `api/`
> (baseline `api/v0.5.0` op `main`). Entries hieronder zijn deels gemengd FE/BE (historisch).

---

## Operaton-provenance op Registratie + PoC Process Engine v2 (2026-05-21)

Twee gekoppelde wijzigingen: (1) `bron`/`bron_kenmerk` velden op `Registratie` in bitemp v06, en (2) de Go-worker en BPMN v2-flow in `process_engine_v01`.

### Wijzigingen in bitemp_register_v06

- **`model/model_plumbing.go`** — Twee nieuwe nullable velden op de `Registratie`-struct:
  - `Bron *string` (JSON: `bron`, Bun: `bron,nullzero`) — systeem of component dat de registratie aanmaakte
  - `BronKenmerk *string` (JSON: `bron_kenmerk`, Bun: `bron_kenmerk,nullzero`) — referentie in het bronsysteem (bijv. process instance ID)
- **`dbsetup/createtables.go`** — Nieuwe idempotente migratiefunctie `ensureRegistratieBronMigrated`: voegt `bron` en `bron_kenmerk` VARCHAR-kolommen toe aan de `registratie`-tabel als die nog niet bestaan. Aanroep in `CreateTables()` na `ensureRegistratieDomeinenMigrated`.

### Wijzigingen in process_engine_v01

- **`internal/worker/service_task.go`** — Worker v2 volledig herschreven met 5 topics en correcte padnamen uit de bitemp MetaRegistry:
  - `check-locatie` → GET `/full/locaties/{locatie_id}`
  - `check-np` → GET `/full/natuurlijk_personen/{np_id}`
  - `registreer-np-bereikbaarheid` → POST `/registratie/` (NP + bereikbaarheid in één registratie)
  - `registreer-bereikbaarheid` → POST `/registratie/` (alleen bereikbaarheid)
  - `register-call` → POST `/registratie/` (NP-only, v1-compatibel)
  - Alle `handleRegistreer`-aanroepen injecteren `"bron": "operaton"` + `"bron_kenmerk": processInstanceID`
- **`deployments/poc/registreer_inwoner_v2.bpmn`** — Nieuw multi-branch BPMN-proces: `check-locatie` → gateway → (locatie bestaat) → `check-np` → gateway → 3 paden (niet gevonden, actueel inwoner-fout, historisch)
- **`deployments/poc/start_pieter_v2.json`** — Testpayload met geldig BSN `430050100` (11-proef: 88 = 8×11)

### Smoke-test (2026-05-21)

Process `registreer_inwoner_v2` COMPLETED, registratie_id=888, `bron=operaton`, `bron_kenmerk=e8574958-5499-11f1-83f4-aaf489597b8d`.

Zie `process_engine_v01/README.md` voor volledige details en padnamen-referentie.

---

## GraphQL: typed `maakRegistratieOngedaan` mutation + registratie-flow docs (2026-05-01)

Aanvulling op de Fase 3B-full typed mutations: ongedaanmaking heeft nu ook een
volledig getypeerd pad in GraphQL, en de docs leggen de complete 3B-stijl flow
voor een NP uit (initiële opvoer → wijzigingen → correcties → afvoer → ongedaan).

- **Nieuw**: `maakRegistratieOngedaan(registratie_id: Int!, opmerking: String)` —
  typed mutation die op een `registratie_id` werkt (geen entiteit/GE/REL). De
  resolver bouwt de ongedaanmaking-payload server-side en delegeert aan dezelfde
  `RegistreerJSONCore` als de bestaande `maak_ongedaan(input: JSON!)`. Audit-trail
  en transactiegedrag zijn identiek.
- **Documentatie**:
  - [GRAPHQL.md](GRAPHQL.md) — Mutations-sectie herschreven: typed (voorkeur)
    vs JSON (fallback) met expliciete "normale flow" beschrijving (initiële
    opvoer via `registreer`, vervolgstappen typed, ongedaanmaking typed).
    Registraties+wijzigingen-query expliciet gedocumenteerd als read-only audit-pad.
  - [postman/graphql-nploc-requests.md](postman/graphql-nploc-requests.md) —
    Volledige NP-flow herschreven: §2a eenvoudige opvoer, §2b uitgebreide opvoer
    (NP + naam + BSN + burgerschap + naamgebruik + bereikbaarheid in één
    `registreer`), §2c-§2k typed wijzigingen/correcties/afvoer, §3 generieke
    JSON-fallback (multi-entiteit), §4a typed `maakRegistratieOngedaan`,
    §4b JSON-fallback, §5 stap-voor-stap workflow-tabel.
- **Tests**: 2 nieuwe tests in `dynql/maak_registratie_ongedaan_test.go`
  voor input-validatie van de nieuwe resolver.

Bestanden:
- `dynql/mutation_resolvers.go` — `makeMaakRegistratieOngedaanResolver()` toegevoegd
- `dynql/schema_builder.go` — `maakRegistratieOngedaan` field geregistreerd
- `dynql/maak_registratie_ongedaan_test.go` — nieuwe tests
- `GRAPHQL.md`, `postman/graphql-nploc-requests.md` — flow & docs

## C8 (Notities & Constraints) IDE↔EditorV2 roundtrip — Round 5 + Feature I54 (2026-05-01)

Twee items in één release: bugfix scope-edge verwijdering (Round 5) + nieuwe feature "Verplaats elementen naar ander domein" (I54).

### Wijzigingen

**Frontend (`web/vite/src/`):**

- **`store/useModelStore.js`** — Nieuwe action `removeStructuralEdge(edgeId)` voor het verwijderen van scope-edges (en andere structurele edges) uit de store.

- **`ide/DiagramCanvas.jsx`** — Nieuwe `handleEdgesChangeWrapped` wrapper rond `onEdgesChange` van React Flow: vangt `type === "remove"` changes (Delete-toets) en verwijdert scope-edges óók uit `structuralEdges`. Zonder deze wrapper bleven scope-edges in de store hangen na visueel verwijderen, en doken bij volgende V3-export weer op.

- **`ide/DiagramCanvas.jsx`** — `handleRemoveEdgeFromDiagram` (rechtsklik > "Verwijder uit diagram") roept nu ook `removeStructuralEdge` aan voor scope-edges.

- **`ide/BrowserContextMenu.jsx`** — Nieuw menu-item "↪️ Verplaats naar domein…" voor alle element-types (entiteit, GE, relatie, enumeratie, gegevenstype, referentielijstInstantie, notitie, constraint).

- **`ide/ProjectBrowser.jsx`** — Handler `verplaatsDomein`: detecteert multi-select (`_multiSelected.size > 1`), toont prompt met beschikbare domeinen + huidig domein als default, gevolgd door bevestigingsdialoog. Past `updateElement(id, { domein: ... })` toe op alle geselecteerde elementen. Lege invoer → "(geen domein)". Multi-selectie wordt na actie gewist.

- **`ide/ProjectBrowser.jsx`** — Drag & drop naar domein-rij: element(en) slepen vanuit de boom op een domein-map toont een bevestiging + verplaatst het domein. Visuele feedback: domein-rij kleurt groen met stippelrand (`--ide-tree-dragover`) tijdens hover. Multi-select (Ctrl+klik) wordt meegenomen bij de drop. Bugfixes: (1) `setTimeout(0)` in `onDrop` — browsers onderdrukken `window.confirm` tijdens drag-events. (2) **Scroll-back fix (iteratief)**: Eerst `prevScrollSelRef` getest, maar root cause bleek `treeData` in effect-deps. Definitieve fix: `treeData` volledig uit `useEffect([selectedElementId, selectieVersie])` verwijderd. Boom rendert nu zonder extra scroll-triggers. (3) `e.dataTransfer.effectAllowed = "copyMove"` — was `"copy"`, blokkeerde `dropEffect = "move"` in domein-drop-handler (browser vereist match tussen allowed ↔ drop). Canvas-drops ("copy") en domein-drops ("move") nu beide ondersteund.

### Tests

Test-run nog te draaien (Vitest watch-mode hing bij vorige poging).

### Technisch detail

**Root cause scope-edge bug**: Scope-edges leven uitsluitend in `useModelStore.structuralEdges` (niet in `diagram.edges`). React Flow's `onEdgesChange` werkt alleen de lokale `useEdgesState` bij. `handleNodesChangeWrapped` had al een sync-pad voor node-deletions, maar voor edges ontbrak die. Gevolg: V3-export las verouderde `structuralEdges` → scope-lijnen kwamen terug bij re-import.

**I54 feature**: Bewust een eenvoudige `prompt`+`confirm`-flow gekozen (consistent met bestaande "Hernoem"/"Verwijder uit model" patterns in dezelfde handler). Een rijkere modaal kan later komen zodra meer elementen gepaard verplaatst moeten worden.

---

## C8 (Notities & Constraints) IDE↔EditorV2 roundtrip — Position Fix Round 4 (2026-05-01)

Positie-fix voor V3 JSON imports waarbij posities alleen in `diagrammen[].nodes` staan (niet als entity-level `positie` velden). Tevens dubbele scope-lijntjes (scopeRefs) gefixt.

### Wijzigingen

**Frontend (`web/vite/src/`):**

- **`store/adapters.js`** — `v3ModelNaarStore`: Bouwt nu `namedDiagPos` map uit alle named diagrams bij import. Gebruikt als fallback voor Overzicht-diagram wanneer `ent.positie` / `ge.positie` / `rel.positie` ontbreken. Geldt voor entiteiten, GE's, relaties, anker, enums, datatypes en referentielijstInstanties.

- **`store/adapters.js`** — Import scopeRefs: Deduplicatie toegevoegd bij import van notitie- en constraint-scopeRefs (skip als target al gezien). Voorkomt dubbele scope-edges in de store.

- **`store/adapters.js`** — Export scopeRefs: `[...new Set(...)]` toegevoegd voor zowel notitie- als constraint-scopeRefs bij export. Voorkomt duplicaten in de V3 JSON.

- **`umleditor/metamodel/v3ModelNaarEditor.js`**: Zelfde `namedDiagPos` fallback toegevoegd voor directe EditorV2-import (alle 8 posities: enum, datatype, refInstantie, entiteit, GE, relatie, anker voor doelEnt en anker-node). Notities krijgen nu ook `naam`-veld en scopeRefs-edges bij directe import (was ontbrekend). Scope-edges gededupliceerd voor constraints én notities.

### Tests

Alle 115 unit-tests groen.

### Technisch detail

**Root cause positie-bug**: IDE exporteert posities via `elementPositie(diagrams, "overzicht")`. Wanneer een V3 JSON zonder entity-level `positie` velden wordt geïmporteerd, bouwen `v3ModelNaarStore` en `v3ModelNaarEditor.js` het Overzicht-diagram met default grid-posities. Vervolgens leest de export die defaults terug → EditorV2 ziet foute posities.

**Fix**: `namedDiagPos` map scannen alle `diagrammen[].nodes` bij import. Volgorde van prioriteit: `ent.positie` → `namedDiagPos.get(id)` → grid-fallback.

**Root cause dubbele scope-lijntjes**: Gebruiker tekende meerdere scope-lijntjes naar hetzelfde doel, of een V3 JSON had duplicaten in `scopeRefs[]`. Bij import werden alle entries omgezet naar structurele edges zonder deduplicatie. Fix: `Set` deduplicatie bij zowel import als export.

---

Drie additionele bugs gefixed in IDE/EditorV2 roundtrip na user-feedback:

### Wijzigingen

**Frontend (`web/vite/src/`):**

- **`ide/DetailsPanel.jsx`**: Naam-input voor notities nu custom `<input>` met `onBlur`
  callback (EditField ondersteunt geen `onBlur` prop). Naam beklijft nu correct.

- **`ide/DiagramCanvas.jsx`**: `handleEdgeDoubleClick` nu met early-return voor scope-edges
  (`data.kind === "scope"`). Gestippelde lijnen verdwijnen niet meer bij dubbelklik.
  
- **`ide/DiagramCanvas.jsx`**: Diagram-posities worden nu gesynchroniseerd. Bij drag/position-change,
  niet alleen het actieve diagram updaten, maar ook het Overzicht-diagram (single source of truth
  voor V3-export). Waarom: posities per diagram opgeslagen, maar V3-export leest uit Overzicht.
  Meerdiagram-scenario's nu consistent.

### Tests

Alle 115 unit-tests groen.

### Technisch detail

**Diagram-synchronisatie**: Elk diagram (`diagrams[diagramId].nodes`) bevat unieke node-posities.
Bij export, leest `posLookup()` prioritair uit `diagrams[overzicht]`. Maar als een element ALLEEN
in benoemd diagram staat (niet in Overzicht), zijn oude/afwezige posities. Fix: sync posities
naar Overzicht bij elke update. Dit voorkomt positie-divergentie en zorgt correcte IDE→EditorV2
roundtrip.

---

## C8 (Notities & Constraints) IDE↔EditorV2 roundtrip (2026-05-01)

Alle C8-elementen (notities en constraints) kunnen nu bidirectioneel
uitgewisseld worden tussen de IDE en EditorV2 via V3 JSON, met correcte
posities, scopeRefs en domeinfiltering.

### Wijzigingen

**Frontend (`web/vite/src/`):**

- **`ide/BrowserContextMenu.jsx`**: `notitie` en `constraint` toegevoegd aan alle
  context-menu-items (`toonInDiagram`, `toonDetails`, `hernoem`, `kopieerID`, `verwijder`).
  Beide node-typen hebben nu een volledig rechts-klik menu.

- **`ide/DetailsPanel.jsx`**: NotitieEditor krijgt een `naam`-veld. Notities kunnen
  nu een aangepaste naam hebben (gescheiden van de `tekst`). Naam wordt opgeslagen
  in `element.naam`; als niet ingesteld, valt terug op ID.

- **`ide/ProjectBrowser.jsx`**: Notities en constraints verschijnen nu in de
  domeinboom. Notities tonen hun `naam` (als ingesteld) of anders een preview
  van de `tekst` (eerste 40 tekens). Constraints tonen hun `naam`.

- **`store/adapters.js`**: 5 technische fixes:
  1. **Diagram-nodes export**: `elementId: n.elementId || n.id` (Zustand slaat op
     als `{ elementId, position }`, niet `{ id }`).
  2. **Diagram-nodes import**: `{ elementId: n.elementId, position }` format;
     nodes zonder elementId worden overgeslagen.
  3. **Notitie import**: `naam: n.naam || n.id` (voordien werd naam altijd op ID gesteld).
  4. **Notitie scopeRefs import**: Lus over `scopeRefs` array → stuctural edges
     met `data: { kind: "scope" }`.
  5. **Notitie export**: Teksteen en naam apart (voorheen fallback naar naam).
     ScopeRefs geëxporteerd als array van doelId's.

- **`pages/IdePage.jsx`**: `referentielijstInstanties` nu ook gefilterd bij
  domeinexport (voordien werden AdellijkeTitels/Landenlijst meegenomen).

- **`umleditor/components/MetamodelEditor.jsx`**: `onConnect` krijgt dezelfde
  scope-edge-logica als DiagramCanvas: als source een notitie/constraint is,
  wordt een scope-edge aangemaakt (type `"metamodel"`, `data: { kind: "scope" }`).
  MetamodelEdge rendert dit correct als dashed lijn.

### Testen

Alle 115 unit-tests groen (geen nieuwe tests nodig; bestaande tests valideren
de adapters.js-fixes).

### Notities

- **Positieverschil IDE ↔ EditorV2**: De IDE rendert ASOC-patronen met zichtbare
  anchor-nodes; EditorV2 heeft geen visuele anchors. Positieverschillen in de
  layout zijn daardoor normaal — element-level `positie` uit V3 is consistent.
- **ScopeRefs**: Scope-edges worden nu bidirectioneel uitgewisseld; meerdere
  scope-lijnen vanuit één notitie worden volledig bewaard.
- **Naam vs Tekst**: Notities hebben nu beide velden; `tekst` is inhoud, `naam`
  is optioneel label. V3 export/import respecteren dit onderscheid.

---

## GraphQL typed patch inputs: <Typenaam>PatchInput per ENT (2026-05-xx)

Fase 3B-full: het vrije `JSON!` scalar in `wijzig<X>` en `corrigeer<X>` is vervangen
door volledig getypeerde `<Typenaam>PatchInput` InputObject-types. Deze worden bij
startup dynamisch gebouwd vanuit de MetaRegistry (geen codegen nodig).

### Wijzigingen

- **`dynql/input_type_builder.go`** (nieuw):
  - `BuildPatchInputTypes()` — bouwt in twee stappen alle typed inputs:
    - Stap 1: GE/REL hub InputObjects (`<GETypenaam>Input`) via reflectie op de
      `_Data` struct. Bevat: `rel_id: Int`, inhoudsvelden uit `DataTypenaam`,
      secundaire FK (bij relaties, `SecondaireEntiteitIDKolom`), en `aanvang`/`einde`
      sub-inputs (`PlumbingDatumInput`) voor materiële types.
    - Stap 2: ENT PatchInputObjects (`<Typenaam>PatchInput`) via
      `OnderliggendeGegevenselementen`. Elk hub-type wordt als `[GEInput]`-lijst
      opgenomen; aanvang/einde plumbing-subtypes worden overgeslagen.
  - `PlumbingDatumInput` — gedeeld `{datum: Date}` input type voor materieel
    aanvang/einde.
  - `getPatchInputType(typenaam)` — geeft het gebouwde PatchInput type terug,
    valt terug op `JSONScalar` als niet beschikbaar.
  - `inputTypeCache` / `patchInputTypeCache` — voorkomen dubbele aanmaak.
  - Helpers: `buildInputSkipSet`, `addStructInputFields`, `goTypeToGraphQLInput`
    (parallellen aan de output type builder, maar produceren `graphql.Input`).

- **`dynql/typed_mutations.go`** (bijgewerkt):
  - `AddTypedMutationsForEntiteit` roept nu `getPatchInputType(meta.Typenaam)` aan
    voor het `patch`-argument type. Resolvers zijn **onveranderd** — graphql-go
    deserialiseert InputObject naar `map[string]interface{}`, en `json.Marshal`
    produceert dezelfde JSON.

- **`dynql/schema_builder.go`** (bijgewerkt):
  - `BuildPatchInputTypes()` wordt aangeroepen vlak vóór de mutations loop, zodat
    de `patchInputTypeCache` gevuld is wanneer `AddTypedMutationsForEntiteit` loopt.

### Tests

- **`dynql/input_type_builder_test.go`** (nieuw, 8 testcases):
  - `TestBuildPatchInputTypes_VultCacheVoorAlleEntiteiten` — alle ENTs krijgen
    een PatchInput type.
  - `TestBuildPatchInputTypes_NatuurlijkPersoonHeeftGERollen` — `NatuurlijkPersoonPatchInput`
    bevat `namen`, `persoonsidentificaties`, `burgerschappen`, `bereikbaarheden`;
    aanvang/einde plumbing ontbreken correct.
  - `TestBuildPatchInputTypes_GEInputHeeftRelID` — `rel_id` aanwezig.
  - `TestBuildPatchInputTypes_GEInputHeeftDataVelden` — inhoudsvelden uit `_Data`
    (`voorletters`, `achternaam`) aanwezig; PK-velden (`natuurlijkpersoon_id`,
    `versie`) afwezig.
  - `TestBuildPatchInputTypes_MaterieleGEHeeftAanvangEinde` — `aanvang`/`einde`
    aanwezig op `NatuurlijkPersoon_BurgerschapInput`.
  - `TestBuildPatchInputTypes_WijzigMutatieGebruiktTypedInput` — `wijzigNatuurlijkPersoon.Args["patch"]`
    is een `*graphql.InputObject`, niet meer `JSONScalar`.
  - `TestBuildPatchInputTypes_BereikbaarheidHeeftLocatieID` — `locatie_id` aanwezig,
    `natuurlijkpersoon_id` afwezig.
  - `TestGetPatchInputType_FallbackOpJSONScalar` — onbekend type valt terug op
    `JSONScalar`.
- **Totaal**: alle suites groen (`go test ./...`).

---

## GraphQL Command-laag: directe core-calls + per-ENT typed mutations (2026-04-30)

Fase 3 van de PATCH/DELETE/GraphQL-roadmap. De GraphQL-mutations roepen de pure
`handlers.*Core`-functies nu **direct** aan in plaats van een interne HTTP-roundtrip
te maken. Daarnaast krijgt elk entiteit-type drie typed mutations
(`wijzig<X>`, `corrigeer<X>`, `voer<X>Af`) bovenop de bestaande generieke
`registreer` / `corrigeer` / `maak_ongedaan`.

### Wijzigingen

- **`handlers/registration_handlers.go`**:
  - Nieuwe `RegistreerJSONCore(ctx, rawBody, defaultRegistratietype, audit)` —
    transport-onafhankelijke variant van `RegistreerMetNieuweAanpak`. Doet
    unmarshal + `NormaliseerWijzigingen` + `RegistreerCore`. Gebruikt door REST
    en GraphQL.
  - `RegistreerMetNieuweAanpak()` is nu een dunne Gin-adapter rond de core;
    response-shape onveranderd (incl. `registratieId`-alias).
- **`handlers/crud_handlers.go`**:
  - Nieuwe `WijzigEntiteitCore(ctx, meta, id, rawBody, modus, audit)` — pure
    PATCH-engine die `BouwWijzigingen` + `RegistreerCore` orkestreert. Retourneert
    `*RegistreerResult`, `meldingen[]` en `*RegistreerError`.
  - `MakePatchFullEntityByMetaHandler` is nu een dunne Gin-adapter rond de core.
  - `VoerEntiteitAfCore` (al toegevoegd in vorige stap) wordt nu hergebruikt
    door GraphQL.
- **`dynql/mutation_resolvers.go`** (vervangen):
  - `http.Post` naar `localhost:8082/registratie/...` is **weg**. Geen
    `registreerBaseURL` of `findEntiteitMetaVoorVeldnaam` meer.
  - `registreer`, `corrigeer`, `maak_ongedaan` roepen `RegistreerJSONCore` direct
    aan met de juiste `defaultRegistratietype`.
  - `SetRegistreerBaseURL` blijft als no-op (deprecated) voor back-compat.
- **`dynql/typed_mutations.go`** (nieuw):
  - `AddTypedMutationsForEntiteit(fields, meta)` registreert per ENT:
    - `wijzig<Typenaam>(id, patch: JSON!)` — PATCH-modus registratie
    - `corrigeer<Typenaam>(id, patch: JSON!)` — PATCH-modus correctie
    - `voer<Typenaam>Af(id)` — afvoer
  - Modus zit in de mutation-naam; geen `modus`-arg.
  - Voor GE/REL-types is dit (nog) een no-op — die hebben (entId, relId) nodig
    en volgen in de typed-input iteratie.
- **`dynql/schema_builder.go`**: roept `AddTypedMutationsForEntiteit` voor elke
  meta in de registry aan; `registeredEntiteitMetas` is verwijderd.

### Tests

- **`dynql/typed_mutations_test.go`** (nieuw, 3 testcases):
  - `TestAddTypedMutationsForEntiteit_RegistreertWijzigCorrigeerVoerAf` — assert
    `wijzigA`, `corrigeerA`, `voerAAf` aanwezig + arg-namen `id`/`patch`.
  - `TestAddTypedMutationsForEntiteit_GeenOpVoorNietEntiteit` — GE/REL geeft 0 velden.
  - `TestAddTypedMutationsForEntiteit_AlleEntiteitenKrijgenDrieMutations` — sweep
    over hele MetaRegistry.

### Vervolg (apart traject)

- Volle typed `<Type>OpvoerInput` met recursieve graphql-input-types
  (per onderliggende GE/REL-rol een veld), en typed mutations voor GE/REL
  met (entId, relId) — gepland in de "typed-input"-iteratie.

---

## REST/CRUD per padnaam: DELETE + PATCH + parent-context disambiguatie (2026-04-29)

Generieke REST CRUD-endpoints op basis van MetaRegistry, bovenop de gedeelde
`RegistreerCore`-engine (één audit-pad, één transactiemodel).

### Wijzigingen

- **`handlers/crud_handlers.go`** (nieuw):
  - `MakeDeleteEntityByMetaHandler(meta)` — `DELETE /{padnaam}/:id` → één
    `Afvoer`-wijziging via `RegistreerCore`. PFK-types (composite key) afgewezen
    met 400 — gebruik daar `POST /registratie/`.
  - `MakePatchFullEntityByMetaHandler(meta)` — `PATCH /full/{padnaam}/:id` met
    JSON Merge Patch (RFC 7396). Hybride wrapper (variant A/B), `?modus=registratie|correctie`,
    `meldingen[]` in response.
- **`handlers/wijziging_builder.go`** (nieuw, ~290 regels): pure `BouwWijzigingen(in)`
  vertaalt PATCH-body naar `[]WijzigingRequest`. Geen DB-toegang.
  - **Parent-context disambiguatie**: bouwt `RepresentatiePlusNaam` direct vanuit
    `og.Doeltype` i.p.v. via globale `GetByVeldnaamMetPayload`. Lost veldnaam-collisions
    op (bv. `"naam"` = `NatuurlijkPersoon_Naam` én `ApiStandaard_Naam` → in PATCH-context
    altijd correct het type van de parent).
- **`routes/addroutes_helper.go`**: DELETE-route in `addMetaRegistryRoutes`,
  PATCH-route in `addMetaRegistryFullRoutes`.
- **`handlers/openapi_generator.go`**: `delete`-operatie op `{padnaam}/{id}`,
  `patch`-operatie op `/full/{padnaam}/{id}` met modus-param + merge-patch+json
  request body schemas.

### Tests

- **`handlers/crud_handlers_test.go`** (3 tests): PFK-afwijzing, NotFound,
  happy-path delegatie naar `RegistreerCore`.
- **`handlers/wijziging_builder_test.go`** (12 tests): variant A/B wrapper,
  ID-mismatch (409), verboden ENT-veld (400), lege body (400), correctie zonder
  rel_id (400), correctie met rel_id (afvoer+opvoer), no-op rel_id melding,
  registratie genegeerd rel_id melding, onbekende modus (400), ongeldige JSON
  (400), array op meervoudige rol, **parent-context disambiguatie naar exact
  `NatuurlijkPersoon_Naam`** (vóór deze fix: `ApiStandaard_Naam`).
- **Totaal**: alle suites groen (`go test ./...`).

### Documentatie

- **`docs/REST_CRUD.md`** (nieuw): endpoints, body-formats, modus, foutcodes-tabel
  (200/400/404/409/412/500), ETag/If-Match-ontwerp (follow-up).
- **`docs/BACKLOG.md`**: Fase 2 DELETE + PATCH ✅; ETag 🟡 follow-up; nieuw
  open punt: domein/parent-filter op `GetByVeldnaamMetPayload` voor andere
  callers (POST `/registratie/`, normalizer).

## IDE: lossless mermaid/UML-import + V3-validator (2026-04-27)

Mermaid/PlantUML/XMI-import in de IDE-pagina was kapot: alleen klassen kwamen binnen,
geen velden, geen edges, geen default diagram. Root cause: het IDE-pad ging via
`editorNaarV3Model`, dat geen velden op entiteit-niveau en geen directe ent→ent edges
ondersteunt, dus die werden stilletjes weggegooid.

### Wijzigingen

- **`src/store/adapters.js`**:
  - Nieuwe `rawEditorNaarStore(graaf, opts)`: 1-op-1 lossless mapping van
    `rawUMLNaarEditor`-output naar IDE-store-shape (elements + structuralEdges +
    overzicht-diagram). Behoudt velden op entiteiten en directe entiteit→entiteit edges.
  - Nieuwe `valideerVoorV3(state)`: vlagt entiteiten met losse velden (regel V3-001) en
    directe entiteit→entiteit edges (V3-002). Bedoeld om bij V3-export en build te
    tonen, met directe links naar B5/B6/B7.
- **`src/ide/ImportDialog.jsx`**: textuele UML-imports worden ingepakt als
  `_format: "raw-editor"` envelope (niet meer omgezet naar V3). `editorNaarV3Model`-
  import verwijderd.
- **`src/pages/IdePage.jsx`** `handleImportResult`: extra case `"raw-editor"` →
  `rawEditorNaarStore`.
- **`src/ide/DetailsPanel.jsx`**: voor entiteit met losse velden tonen we de
  `VeldenEditor` met een waarschuwingsbanner ("⚠ niet metamodel-conform — gebruik B6
  om te splitsen"). Bewerkbaar zodat kleine opschoning (naam/type) vóór splitsen kan.
- **`src/umleditor/import/importMermaid.js`** + **`importPlantUML.js`**: relatieve
  imports `./rawuml` → `./rawuml.js` (node-ESM-compatibel, zoals al elders gedaan).

### Tests

- **`src/store/rawEditorAdapter.test.js`** (NIEUW, 19 tests):
  - `rawEditorNaarStore`: lege/undefined input, behoud van velden op entiteit,
    behoud van directe ent→ent edges, posities in overzicht-diagram, naam-collision.
  - `valideerVoorV3`: lege store, V3-001 entiteit-velden, V3-002 directe edges,
    generalisatie/dependency/GE-edges blijven OK.
  - End-to-end import van alle 5 demo-bestanden in `demos/orphan-tests/`
    (01–05): orphan-detectie + placeholder-roundtrip via `rawEditorNaarStore`.
- **Totaal**: 110/110 groen (was 91/91); `npm run build` succesvol.

### Backlog gevolgen

- 0.2 (IDE mermaid-import) en 0.3 (orphan-tests) gemarkeerd als opgelost.
- Vervolg: UI-banner bij "Exporteer V3" en "Publiceer/Rebuild" die `valideerVoorV3`
  aanroept en overtredingen toont met klikbare links naar de B5/B6/B7-acties.

---

## IDE: editor-bewerkingen B5/B6/B7 + Project Browser-icoonplaatsing + node:test infra (2026-04-27)

### Editor-bewerkingen (`src/ide/transformations.js`)

Drie pure transformaties die structurele wijzigingen op model-niveau doorvoeren met
gestructureerde `{ok, warnings, errors, elements, structuralEdges, newIds, removedIds}` output.

- **B5 — Cast Entiteit naar GE** (`castEntiteitNaarGE`): zet metatype, synct `domein` met
  parent (warning bij verschil), verwijdert inkomende edges van vreemde entiteiten en
  uitgaande edges naar entiteiten/relaties; voegt parent→GE compositie toe indien afwezig.
- **B6 — Splits Entiteit in GE's** (`splitsEntiteit`): genereert per geselecteerd veld
  een nieuwe GE `${ent.typenaam}_${PascalCase(veld.naam)}` met kardinaliteit `1` of
  `0..1` o.b.v. `verplicht`.
- **B7 — Promoot relatie tot associatieklasse** (`relatieNaarAssociatieklasse`):
  vervangt directe edge `A→B` door `A→Rel_A_B→B`. Velden=[] initieel — ASOC-vorm
  activeert pas bij eerste veld via `relatieVorm()`.

**UI-toegang**:
- B5/B6: contextmenu op entiteit in `ProjectBrowser.jsx` ("Cast naar GE" / "Splits in GE's")
- B7: edge-contextmenu in `DiagramCanvas.jsx` ("Promoot tot associatieklasse"), alleen
  zichtbaar voor entiteit↔entiteit edges die geen dependency zijn.

Caller patroon: `passToePatch(useModelStore, patch)` — controleert `ok`, toont warnings,
en commit elements/structuralEdges atomair via `setState`.

### Project Browser: + iconen in FlexLayout tab-titel (iteratie 2)

Eerdere iteratie plaatste de "📁+" en "📐+" iconen in een vaste header-strip boven
de tree. **Nieuwe plaatsing**: in de FlexLayout tab-titel zelf, links van de
"maximize"-knop, via `onRenderTabSet` met `renderValues.stickyButtons`.

```jsx
<FlexLayout.Layout
  onRenderTabSet={(tabSetNode, renderValues) => {
    const selected = tabSetNode.getSelectedNode();
    if (selected?.getComponent?.() === COMP_BROWSER) {
      renderValues.stickyButtons.push(
        <button onClick={handleNieuwDomein}>📁+</button>,
        <button onClick={handleNieuwDiagram}>📐+</button>
      );
    }
  }}
/>
```

Voordeel: de iconen staan nu **echt naast** de "Project Browser" tab-tekst en
nemen geen verticale ruimte meer in beslag.

### Test-infrastructuur: `node:test` + Vite-alias resolver

- `web/vite/test/register-aliases.mjs` + `alias-resolver.mjs`: minimale ESM-loader
  die `@umleditor/...`, `@store/...`, `@shared/...`, `@ide/...` aliases naar
  bestandspaden mapt zodat `node --test` de imports vindt.
- `package.json` script: `npm test` → `node --import ./test/register-aliases.mjs --test 'src/**/*.test.js'`.
- Nieuwe testbestanden:
  - `src/ide/transformations.test.js` (18 tests B5/B6/B7)
  - `src/umleditor/import/rawuml.test.js` (16 tests adapter + orphan-helpers)
  - `src/store/adapters.test.js` (12 tests filterStoreByDomein + mergeStoreDomein)
- Totaal: **91 tests groen**.
- Demo-bestanden voor handmatige UI-validatie: `demos/orphan-tests/*.mmd` met README.

### Side effects

- `src/umleditor/import/rawuml.js` en `src/umleditor/import/_helpers.js`:
  ontbrekende `.js` extensies toegevoegd op relatieve imports zodat
  Node ESM-resolutie werkt (Vite was hier toleranter).

---

## UML-editor + IDE: React 18 concurrent-mode + XyFlow ResizeObserver race-fix (2026-04-26)

**Kritieke bug-fix**: crash op elke paginalaad van editor-v2 (`/react/editor-v2.html`) en IDE (`/react/ide.html`).

### Symptomen
- Bij paginalaad: error boundary toont "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node"
- Crash treedt op na initiële commit van MetamodelEditor/DiagramCanvasInner
- Zou willekeurig lijken, maar reproduceerbaar op elke laad (niet HMR-gerelateerd)
- StrictMode al uitgeschakeld; single-mount pattern al aanwezig in EditorV2Page

### Root cause: React 18 concurrent mode + XyFlow 12 ResizeObserver race
1. React 18 committeert DOM in meerdere microtask-fases
2. XyFlow 12 plaatst een `ResizeObserver` in `useLayoutEffect` op het canvas-element
3. In Chrome vuurt `ResizeObserver` **synchroon** zodra `observe()` wordt aangeroepen (als element al dimensies heeft)
4. Dit gebeurt nog tijdens React's commit-fase → XyFlow probeert interne state te updaten en DOM-nodes te verplaatsen terwijl React nog bezig is met DOM-transfer
5. Resultaat: DOM-tree-mismatch, `removeChild` op node die React nog niet heeft vrijgegeven

### Fix: defer ReactFlow mount één animation frame
```js
const [reactFlowGereed, setReactFlowGereed] = useState(false);
useEffect(() => {
  const raf = requestAnimationFrame(() => setReactFlowGereed(true));
  return () => cancelAnimationFrame(raf);
}, []);

// In JSX:
{reactFlowGereed && <ReactFlow ... >...</ReactFlow>}
```

Hierdoor:
- React's initiële commit is compleet vóór `requestAnimationFrame` fired
- ResizeObserver vuurt in een schone phase, niet tijdens commit
- All state (nodes, edges) is al geïnitialiseerd; de ~16ms delay is onmerkbaar

**Bestanden**:
- [web/vite/src/umleditor/components/MetamodelEditor.jsx](web/vite/src/umleditor/components/MetamodelEditor.jsx#L292-L300) — editor-v2 fix
- [web/vite/src/ide/DiagramCanvas.jsx](web/vite/src/ide/DiagramCanvas.jsx#L728-L736) — IDE fix

**Impact**: beide pagina's nu stabiel laadbaar; geen functionaliteitsverandering.

---

## UML-import: RuwUML-tussenformaat + parser/adapter-splitsing (2026-04-26)

Derde slice van de UML-import-refactor. Doel: alle editor-conventies
(stereotype-resolutie, ID-generatie, kleurkeuze, generalisatie-richting,
edge-flags) op één plek concentreren, zodat de tekstuele parsers klein en
puur blijven en bug-fixes niet drie keer hoeven te landen.

### Nieuw: RuwUML als operationeel formaat
- `web/vite/src/umleditor/import/ruwuml.js` is uitgebreid van een spec-only
  bestand naar een volwaardige module: JSDoc-typedefs voor `RuwUMLModel` /
  `RuwUMLNode` / `RuwUMLEdge` / `RuwUMLVeld`, plus een nieuwe
  **`ruwUMLNaarEditor()`-adapter** die alle interpretatie naar editor-shape
  doet (stereotype-mapping, ID/kleur/positie, edge-conversie,
  auto-aanmaak van ontbrekende doel-nodes).
- Nieuw uitgebreid ontwerpdocument: [`docs/RAWUML.md`](docs/RAWUML.md) met
  het waarom, het formaat, de pijplijn en de motivatie waarom XMI buiten
  RuwUML blijft.

### Refactor: pure parsers
- `importMermaid.js` is van 309 → ~175 regels gegaan: alleen tokenisatie en
  block-parsing. `mermaidNaarRuw()` is nu apart geëxporteerd. `importVanMermaid`
  is een 1-liner: `ruwUMLNaarEditor(mermaidNaarRuw(text))`.
- `importPlantUML.js` op dezelfde manier herschreven (van 335 → ~175 regels,
  `plantumlNaarRuw()` apart geëxporteerd).
- `importXMI.js` blijft op zijn eigen pad — XMI heeft stabiele IDs, EA's
  AssociationClass-patroon en MIM-tagged-values die direct op editor-vorm
  mappen; een tussenstap zou informatie verliezen. Zie de uitleg in
  `docs/RAWUML.md` §6.

### Onveranderd
- De orphan-helpers (`detecteerOrphans`, `pasOrphanActiesToe`) en de
  OrphanDialog blijven ongewijzigd; ze werken op de editor-shape ná conversie
  en zijn dus identiek bruikbaar voor alle drie de bronnen.

## UML-editor + IDE: orphan-detectie bij UML-import + textuele formaten in IDE-importdialoog (2026-04-26)

Tweede blok van de UML-import-refactor (zie `docs/ontwerpgedachten/KISS/VAC/2026-04-26 refactor uml to v3.md`). Doel: voorkomen dat losliggende GE/relatie-nodes na een UML-import stilletjes als "modelleerfout" in het canvas blijven hangen, en dezelfde Mermaid/PlantUML/XMI-bronnen ook vanuit de IDE kunnen worden ingelezen.

### Nieuw: RuwUML-tussenformaat (JSDoc-spec) + orphan-helpers
- `web/vite/src/umleditor/import/ruwuml.js` documenteert via JSDoc een neutraal tussenformaat (`RuwUMLModel`/`RuwUMLNode`/`RuwUMLEdge`) tussen de drie parsers en de editor. In deze iteratie is alleen de spec gevuld; de drie parsers blijven editor-shape produceren.
- Twee runtime-helpers werken **direct op de editor-shape** (`{nodes, edges}`) en zijn dus meteen bruikbaar zonder parser-refactor:
  - `detecteerOrphans(graaf)`: vindt GE-nodes zonder compositie-edge vanuit een entiteit en relatie-nodes zonder koppeling naar een entiteit/anker.
  - `pasOrphanActiesToe(graaf, orphans, keuzes)`: voert per orphan de gekozen actie uit (`placeholder`, `overslaan`, `abort`) en geeft een nieuwe graaf + samenvattingsregels terug.
- Placeholders krijgen een eigen kleur (`#fde68a`) en een vlag `isPlaceholder: true`.

### Nieuw: OrphanDialog
- `web/vite/src/umleditor/components/OrphanDialog.jsx` toont per orphan naam + reden + drie radio-keuzes en een bulk-actie-dropdown ("alles op …"). Bevestigen levert een `keuzes`-map op; annuleren breekt de hele import af.
- Gestyled als overlay-modal in de bestaande IDE/editor-paletkleuren (geen nieuwe CSS-bestanden).

### Editor-v2: import-handlers door één wrapper
- `MetamodelEditor.jsx` heeft een nieuwe `importMetOrphanCheck(importerFn, accept, bron)`. De drie handlers (`handleImportXMI`, `handleImportMermaid`, `handleImportPlantUML`) zijn een 1-liner geworden die deze wrapper aanroepen. Bij orphans verschijnt de OrphanDialog; bij `abort` wordt er niets in het canvas geladen.

### IDE-importdialoog: textuele UML-bronnen + auto-detect
- `web/vite/src/ide/ImportDialog.jsx` accepteert nu naast V3/IDE-v1 JSON ook `.mmd`, `.md`, `.puml`, `.plantuml`, `.xmi`, `.xml` en `.txt`. Het formaat wordt automatisch bepaald op extensie en (bij ambigue extensies als `.md`/`.txt`/`.xml`) op een korte content-sniff (`classDiagram` → Mermaid, `@startuml` → PlantUML, `<XMI`/`<?xml` → XMI).
- Voor textuele formaten wordt direct na het kiezen van het bestand de juiste parser gedraaid; orphans verschijnen in dezelfde `OrphanDialog` als in de editor. Daarna wordt de graaf via `editorNaarV3Model` omgezet naar V3 en als V3-bestand aan de bestaande IDE-importflow doorgegeven (de `onImport`-handler hoeft dus niets te weten van de bron-syntax).

### Bewust niet in dit blok
- De drie parsers leveren nog steeds editor-shape op; de RuwUML-conversie + gedeelde `ruwUMLNaarEditor`-adapter staat in een vervolgslice. De huidige orphan-laag werkt op de editor-shape, dus dit blokkeert geen nieuwe functionaliteit.
- ENT→GE-cast en handmatige conversie naar associatieklasse blijven uitgesteld.

## UML-editor: import-roundtrip-bugs + stereotype-aliassen + ruwe save (2026-04-26)

Eerste blok van de UML-import-refactor (zie `docs/ontwerpgedachten/KISS/VAC/2026-04-26 refactor uml to v3.md`). Dit blok lost concrete roundtrip-bugs op en voegt enkele kleine, defensieve uitbreidingen toe; de bredere architectuur-refactor (RuwUML-tussenformaat, IDE-integratie, placeholder-dialoog) volgt in een volgend blok.

### Ingetrokken: ASOC-promotie bij import van directe entiteit↔entiteit-edges
- **Eerdere aanpak (verwijderd)**: een gedeelde helper `promoteEntiteitAssociaties` zette directe entiteit↔entiteit-edges direct na de import om naar het ASOC-patroon (anker + relatie-node + drie edges).
- **Reden van intrekking**: dit was te invasief voor eenvoudige UML-imports. Een associatieklasse ´zonder velden´ heeft conceptueel geen apart anker; de relatie í´s het anker (één bubble). Het patroon hoort een handmatige modelkeuze te zijn, niet een automatische import-bewerking. De ENT→GE-cast en de handmatige conversie naar associatieklasse landen in blok 2.
- **Bestanden**: `importMermaid.js`, `importPlantUML.js` — alleen het aanroepen is verwijderd. `promoteEntiteitAssociaties` blijft als ongebruikt hulpmiddel in `_helpers.js` staan voor toekomstig gebruik.

### Bug: PlantUML-import verloor generalisatie
- **Oorzaak**: `maakEdge` in `importPlantUML.js` had geen detectie voor `<|--`/`--|>`/`<|..`/`..|>` en zette zulke pijlen weg als gewone associaties (of als dependency wegens de `..`).
- **Fix**: generalisatie-detectie + bron/doel-omdraaiing analoog aan `importMermaid.js`. Dependency-detectie scherper gemaakt: `..` zonder `|` is dependency, `..|` is generalisatie.
- **Bestand**: `web/vite/src/umleditor/import/importPlantUML.js`.

### Uitbreiding: stereotype-aliassen + `bitemp::metatype` taggedValue
- Nieuwe gedeelde resolver `mapStereotypesNaarMeta` in `_helpers.js` met aliasmap voor: `ent`/`entiteit`/`objecttype`, `ge`/`gegevenselement`/`gegevensgroeptype`, `rel`/`relatie`/`relatiesoort`/`relatieklasse`/`associationclass`, `reflijst`/`referentielijst`, `refitem`/`referentielijstitem`, `refitems`/`referentielijstitems`, `refinstantie`/`referentielijstinstantie`, plus modifiers `materieel`, `datatype`/`gestructureerd datatype`, `enum`/`enumeration`.
- Mermaid en PlantUML gebruiken voortaan deze resolver; subtypes (`entiteitSubtype`, `relatieSubtype`) worden meegenomen.
- XMI-import herkent nu ook taggedValue `bitemp::metatype` en behandelt die via dezelfde alias-resolver. MIM-stereotypen blijven werken via de bestaande `mapStereotypeNaarMetatype`-fallback.
- **Bestanden**: `_helpers.js`, `importMermaid.js`, `importPlantUML.js`, `importXMI.js`.

### Toevoeging: rauwe editor-staat opslaan (`.editor-flow.json`)
- Extra toolbar-knop **💾⚡ Ruwe staat** slaat alleen `{ nodes, edges }` op met markering `_format: "editor-flow-v1"`. Bedoeld voor ontwikkeltijd: een werkende canvas-staat bewaren ook als die nog niet als V3 geldig is.
- Laden vereist geen wijziging: `handleLoad` herkende `payload.flowState` al en past die direct toe.
- **Bestanden**: `MetamodelEditor.jsx`, `panels/Toolbar.jsx`.

### Bug: `removeChild` runtime-crash na hot-reload van editor-v2
- **Oorzaak**: de HMR-handler in `main.jsx` triggerde alleen een volledige reload bij wijzigingen in `/uml-editor/src/` (oude editor-locatie) en `/web/vite/src/ide/`, niet bij `/web/vite/src/umleditor/` (de huidige editor-v2-module). Een partiële HMR-update liet React Flow met stale DOM-nodes achter; de eerstvolgende render gooide `Failed to execute 'removeChild' on 'Node'`.
- **Fix**: `/web/vite/src/umleditor/` toegevoegd aan de `heeftDomIntensieveWijziging`-check, zodat wijzigingen in de editor-v2-module ook een volledige page-reload veroorzaken.
- **Bestand**: `web/vite/src/main.jsx`.

### Bug: `removeChild`-crash bij eerste paginalaad van editor-v2
- **Echte oorzaak (al langer bestaand)**: `EditorV2Page` rendert eerst de editor met demo-data en doet daarna in een `useEffect` een fetch naar `/api/schema/versies`. Bij respons werd `setData(...)` én `setEditorKey(k+1)` aangeroepen om de editor met nieuwe data te remounten. Die geforceerde unmount-tijdens-startup race't met React Flow's interne DOM-cleanup (portals, observers); de reconciler ploft dan op `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node`. Symptomen: foutoverlay direct na harde reload (Cmd+Shift+R), Vite herstarten "loste" het op omdat de timing dan toevallig weer goed viel.
- **Fix**: editor wordt pas één keer gemount nádat de fetch klaar is (succes of fail-fallback naar demo). Tijdens het laden toont de pagina een lichte placeholder. `editorKey` is verwijderd; geen remount-trick meer nodig.
- **Bestand**: `web/vite/src/pages/EditorV2Page.jsx`.

## UML-editor: Mermaid-import overerving + domeinmenu multi-selectie (2026-04-26)

### Bug: Mermaid import herkende generalisatiepijlen niet
- **Oorzaak**: het regex-patroon voor pijlsyntax (`[\ \-\.\*<>o]+`) bevatte geen `|`, waardoor `<|--` en `--|>` pijlen (generalisatie/overerving) stil werden genegeerd en geen edge aanmaakten.
- **Fix**: `|` toegevoegd aan de tekenklasse in `importMermaid.js` → `[\ \-\.\*<>o|]+`. Generalisatie-edges worden nu correct herkend en als `isGeneralization: true` edge aangemaakt.
- **Bestand**: `web/vite/src/umleditor/import/importMermaid.js`

### Verbetering: domein wijzigen toegankelijk bij multi-selectie met edges
- **Probleem**: bij een selectie van meerdere nodes én edges vuurt React Flow `onSelectionContextMenu` in plaats van `onNodeContextMenu`. Hierdoor was het domein-wijzigen-menu niet bereikbaar via rechtsklik op een multi-selectie.
- **Fix**: `toonContextMenu` detecteert nu of de selectie model-nodes bevat (`heeftDomeinWijziging`-vlag). `ContextMenu` toont in het uitlijnmenu onderaan een **Domein wijzigen**-sectie (met bestaande domein-snelknoppen + vrij invoerveld) wanneer deze vlag actief is.
- **Bestanden**: `MetamodelEditor.jsx`, `ContextMenu.jsx`

---

Korte checklist voor een API-release met losse DB-stack.

## Replay: betere foutdiagnose + preview; fix GE-veldnaam-disambiguatie (2026-04-19)

### Bug: GE-veldnaam "naam" werd gekoppeld aan verkeerde entiteit bij replay
- **Oorzaak**: `UnmarshalJSON` in `model/REST request models.go` gebruikte `MetaRegistry.GetByVeldnaam(veldnaam)` voor het opzoeken van een representatietype op JSON-veldnaam. Omdat meerdere types dezelfde `Veldnaam` kunnen hebben (bijv. `ApiStandaard_Naam` en `NatuurlijkPersoon_Naam` → beide "naam"), werd de eerste match (niet-deterministisch) geretourneerd, wat leidde tot fouten als `NatuurlijkPersoon_Naam_Input` werd gebruikt terwijl `ApiStandaard_Naam` werd verwacht.
- **Fix**: `UnmarshalJSON` extraheert nu de JSON-sleutels uit de inner payload (bijv. `apistandaard_id`, `naam`) en roept de reeds bestaande `MetaRegistry.GetByVeldnaamMetPayload(veldnaam, payloadKeys)` aan. Die disambigueert op `EntiteitIDKolom` (bijv. `apistandaard_id` → `ApiStandaard_Naam`).
- **Impact**: replay files met GE's waarvan de veldnaam gedeeld wordt door meerdere types werken nu correct.

### Backend: uitgebreidere foutmeldingen in de registreer-handler
- De wijziging-loop in `handlers/registration_handlers.go` gebruikt nu een index (`wijzigingIdx`).
- Alle foutmeldingen bevatten nu `wijziging[N]`, de `representatienaam` én de `veldnaam`, zodat direct duidelijk is welke stap in de replay-body faalde.
- Oud: `"failed to handle opvoer van NatuurlijkPersoon_Naam: ..."`.
- Nieuw: `"wijziging[3]: opvoer van ApiStandaard_Naam (veldnaam=naam) mislukt: ..."`.

### Frontend: replay-preview toont de geïmporteerde file
- Na import van een replay file wordt de volledige JSON opgeslagen en getoond in de preview-sectie onderaan de pagina (inclusief bron, export-tijdstip en aantal entries). Vóór import blijft het voorbeeld van de huidige registratieselectie zichtbaar.
- `maxHeight` van de preview verhoogd naar 400px.

### Frontend: uitklapbare fout-details per replay-entry
- Foutrijen krijgen een rode achtergrond en zijn klikbaar (▸ / ▾).
- De detail-rij toont side-by-side:
  - **Request body** (zoals verzonden, inclusief ID-offsets).
  - **Response body** (volledige API-response, inclusief de nieuwe gedetailleerde foutmelding).
- De API `error`-string uit de response body wordt direct getoond in de "Fout / details" kolom.

---

## GraphQL enum cache fix — `rol` en andere enum-velden correct in response (2026-04-18)

### Bug: enum-velden (o.a. `rol`) waren `null` in GraphQL-responses
- **Oorzaak**: `schemaTypeVoorReflectType()` retourneerde `"string"` als Go-typenaam voor alle string-based enum-types (Gemeenterol, Fase, Organisatietype, etc.). `makeEnumType()` cachete het eerste enum-type onder key `"string"` in `enumTypeCache`, waarna alle volgende enums diezelfde (verkeerde) enum kregen. Bij serialisatie vond graphql-go de werkelijke waarde niet terug in de verkeerde enum → `null`.
- **Fix** (`dynql/field_builder.go`): in `fieldsVoorMeta()` wordt nu de werkelijke Go-typenaam (bijv. `"Gemeenterol"`) als enum-naam doorgegeven aan `goTypeToGraphQL()`, zodat elke enum een unieke cache-entry krijgt.
- **Impact**: alle enum-velden in alle hub+data types (InitiatiefGemeente.rol, Initiatief.fase, Organisatie.organisatietype, etc.) retourneren nu correcte waarden.
- **Documentatie**: zie `docs/graphql-enum-handling.md` voor de volledige analyse.

### Debug logging verwijderd
- Tijdelijke `[DEBUG laadHubKinderen]`, `[DEBUG entityToMap]` en `[DEBUG flattenEntityMap]` prints in `dynql/query_resolvers.go` zijn verwijderd.

### Frontend: pipe-karakter in data breekt markdown-tabellen niet meer
- **Oorzaak**: `renderTemplate()` injecteerde ruwe datawaarden (met `|`) in markdown-templates; `splitTabelRij()` splitste op álle pipes.
- **Fix**: `renderTemplate()` (`PublicatieDetail.jsx`) escaped pipes als `\|` bij invoeging. `splitTabelRij()` split nu alleen op niet-geëscapede pipes (lookbehind regex) en unescaped daarna — in zowel `PublicatieDetail.jsx` als `MarkdownWeergave.jsx`.

## Publicatie detail — GraphQL query builder, `[key=value]` filter, weergavenaam-verrijking (2026-04-17)

### Frontend: `[key=value]` filter in veldpad-templates
- Template-placeholders ondersteunen nu filter-syntax: `{{gemeenten[rol=Realiseert].weergavenaam}}` filtert een array op het veld `rol` vóór verdere navigatie.
- Geïmplementeerd in `parseSegment()` en `resolveVeldpadUitContext()`, verplaatst naar `publicatieUtils.js`.

### Frontend: `data`-segment skip (REST ↔ GraphQL transparantie)
- Templates die `producten.data.type` gebruiken, werken nu ook op GraphQL-responses waarbij `data` al afgevlakt is: het `data`-segment wordt geskipt als de key ontbreekt.

### Frontend: GraphQL query builder in `PublicatieDetail`
- Als een WeergaveDefinitie een `detailTemplate` heeft, haalt `PublicatieDetail` data op via GraphQL in plaats van REST `/full/`.
- Functies `extractVeldpaden()`, `buildSelectieTree()`, `treeNaarGql()`, `buildGraphQLQuery()` bouwen een gerichte GraphQL-query op basis van de template-placeholders.
- Voordeel: diepe navigatie via forward FK relaties (bijv. contactpersoon-naam via Initiatief → ContactpersoonRelatie → NatuurlijkPersoon) werkt nu zonder extra REST-calls.
- Herbruikbare functies zijn verplaatst naar `web/vite/src/publicatie/publicatieUtils.js`.

### Backend: weergavenaam-verrijking in GraphQL-responses (`dynql/query_resolvers.go`)
- `verrijkWeergavenamen()` wordt aangeroepen na `flattenEntityMap()` op alle vier call-sites (full entity, full list, forward relation, reverse relation).
- Per kind-entiteit met een `SecondaireEntiteitIDKolom` en een `IsWeergaveVeld`-AfgeleidVeld worden de FK-waarden gebatcht opgehaald, de weergavenaam berekend via `berekenWeergavenaamVlak()` + `evalueerCELConcatenatieVlak()`, en in de response-map ingezet.
- Nieuwe helperfuncties: `laadWeergavenamenBatch()`, `berekenWeergavenaamVlak()`, `evalueerCELConcatenatieVlak()`, `navigeerAfgeleidPadVlak()`, `extractIntFromMap()`.

### Tests toegevoegd
- **Go** (`handlers/full_handlers_weergavenaam_test.go`): 12 unit tests voor `evalueerCELConcatenatie`, `navigeerAfgeleidPad`, `berekenWeergavenaamVanEntiteit` — geen DB nodig, volledig in-memory.
- **JS** (`web/vite/src/publicatie/publicatieUtils.test.js`): 27 unit tests voor `parseSegment`, `segmentNaarString`, `resolveVeldpadUitContext`, `extractVeldpaden`, `buildSelectieTree`, `buildGraphQLQuery` — gedraaid met `node --test`.

## Publicatie markdown — tabelweergave hersteld (2026-04-16)

- Oorzaak: de lokale markdown-renderer in de frontend ondersteunde geen GFM-tabellen, waardoor tabelsyntax als platte tekst werd weergegeven op de publicatiepagina en in de markdown-preview.
- Oplossing: tabelparsing toegevoegd aan `markdownNaarHtml()` in zowel `web/vite/src/publicatie/PublicatieDetail.jsx` als `web/vite/src/components/editor/MarkdownWeergave.jsx`.
- Styling: tabelopmaak toegevoegd in `web/vite/src/styles/common-ground-theme.css` voor zowel `.cg-markdown-viewer__body table` als `.cg-form-card table`.
- Resultaat: geldige markdown-tabellen renderen nu als HTML-tabel in publicatie en editor-preview.

## Publicatie markdown — HTML entities niet meer zichtbaar (2026-04-16)

- Oorzaak: placeholderwaarden in `PublicatieDetail` werden eerst ge-escaped in `renderTemplate()` en daarna nogmaals via `markdownNaarHtml()`, waardoor tekst als `API&#39;s &amp; opslag` zichtbaar werd.
- Oplossing: placeholder-invoeging in `renderTemplate()` gebruikt nu ruwe tekst; escaping blijft centraal in `markdownNaarHtml()`.
- Resultaat: waarden uit de API worden weer normaal getoond, bijvoorbeeld `API's & opslag`.

## CG Portfolio — modeluitbreiding extra velden + meervoudige weergave (2026-04-16)

### DB-migratie: `20260415_add_cg_beoordeling_etalage_extra_velden.sql`
Voer dit script uit op de applicatiedatabase (`bitemp_go_db_v06`) vóór de volgende backend-start. Alle kolommen zijn nullable (backward-compatible).

Nieuwe kolommen op bestaande tabellen:

| Tabel | Kolom | Type | Toelichting |
|---|---|---|---|
| `initiatief_planning_data` | `obstakels` | TEXT | Beschrijving van obstakels voor de planning |
| `initiatief_planning_data` | `verwacht_ready_datum` | DATE | Verwachte datum van gereedmelding |
| `initiatief_product_data` | `vervangt_ouder_product` | BOOLEAN | Vervangt dit product een ouder product? |
| `initiatief_bijdrage_data` | `score` | INTEGER | Numerieke beoordelingsscore |
| `initiatief_initiatiefinfo_data` | `aanmeldingsdatum` | DATE | Datum van aanmelding van het initiatief |

Nieuwe tabellen (`initiatief_beoordeling`, `initiatief_beoordeling_data`, `initiatief_beoordeling_aanvang`, `initiatief_beoordeling_einde`, `initiatief_etalage`, `initiatief_etalage_data`) worden automatisch aangemaakt via Bun `IfNotExists()` bij backend-start — geen handmatige DDL nodig.

### Backend: meervoudige weergavenaam-verrijking (`handlers/full_handlers.go`)
Relatie-hubs met een `SecondaireEntiteitIDKolom` én een `IsWeergaveVeld`-AfgeleidVeld (zoals `InitiatiefDomein`) krijgen nu automatisch een `weergavenaam`-veld meegeleverd in de `/full/`-response. De waarde wordt server-side bepaald door de doelentiteit (bijv. `Domein`) op te halen en het AfgeleidVeld-pad te navigeren.

### Frontend: meervoudige veldpaden (`PublicatieTabel.jsx`)
`resolveVeldpad()` ondersteunt nu meervoudig `momentvoorkomen`: bij een GE/relatie met meerdere actieve items worden alle waarden verzameld en samengevoegd met `", "`. Voorbeeld: `"initiatief_domeinen.weergavenaam"` geeft `"Standaarden, Componenten"`.

### Weergave replay bijgewerkt
`registraties-replay-init-standaard-weergavedefinities.json`: kolom `"Domeinen"` (veldpad `"initiatief_domeinen.weergavenaam"`) toegevoegd aan de Initiatief-standaardweergave.

### Frontend: filter voor meervoudige kolommen (`PublicatieTabel.jsx`)
De globale zoekfunctie en per-kolom-filter werken nu ook correct voor meervoudige veldpaden (bijv. `"initiatief_domeinen.weergavenaam"`).

**Oorzaken van het probleem:**
1. TanStack Table kan kolom-IDs met punten (`.`) intern inconsistent afhandelen.
2. Kolommen gebaseerd op `accessorFn` + een verouderde `typeMetaByTypenaam`-closure konden `null` teruggeven in de filter-fase, ondanks correct tonen in de cell-renderer.

**Oplossing (dubbele aanpak):**
- `sanitizeKolId()`: vervangt punten in veldpaden door `__` voor veilige TanStack-sleutels.
- `resolvedData` memo: pre-berekent alle kolomwaarden upfront (inclusief meervoudige samenvoegingen) als directe string-properties op elke rij.
- Kolommen gebruiken nu `accessorKey` (eenvoudige string) i.p.v. `id + accessorFn`, zodat TanStack de waarde rechtstreeks uit `resolvedData[sanitizeKolId(veldpad)]` leest.
- `standaardSortering` ID is eveneens gesaniteerd.

Resultaat: filter en sortering werken nu voor alle kolomtypen — enkelvoudig en meervoudig.

## Editor v2 — dependency visibility & roundtrip fix (2026-04-08)

- `«use»` dependency-edges kunnen nu per stuk of per doel-node verborgen/getoond worden via rechtsklik in editor v2.
- Rechtsklik op een **stippellijn** → `Verberg deze dependency`.
- Rechtsklik op een **enum** of **gegevenstype** → `Verberg dependencies` / `Toon dependencies` voor alle inkomende `«use»`-lijnen.
- De metadata voor deze lijnen (`id`, `sourceHandle`, `targetHandle`, `hidden`) blijft nu behouden in **V3 JSON** via `useEdges[]`.
- Daarnaast blijft deze info nu ook behouden bij **editor → V3 → codegen → MetaRegistry → V3 → editor** roundtrips, doordat de codegenerator `useEdges[]` opslaat in `EditorLayout.UseEdges` in de gegenereerde `*_metaregistry.go` bestanden en de V3 exporter die weer teruggeeft.

## Frontend visual tweak (2026-04-01)

- Index visualisatie: centrale entiteitstekst schaalt nu mee met de lengte van de weergavetekst in de representatiekaart.
- Effect: lange labels (zoals bij Locatie-adressen) worden iets kleiner getoond dan korte labels, zodat de verhouding met NatuurlijkPersoon visueel consistenter blijft.

## Runtime fix notes (2026-03-21)

- `GET /full/<entiteit>?t=<...>`: tijdelijke workaround toegevoegd voor een Bun v1.1.14 panic bij geneste `has-many` relaties met callback-filters.
- Symptoom: `reflect: call of reflect.Value.Field on zero Value` tijdens `relation.selectMany`.
- Aanpak: peiltijdstip-filter blijft op hub-niveau actief; geneste hub-kinderen (`Data`, `Aanvang`, `Einde`) worden tijdelijk niet mee-geladen in dezelfde full-query.
- Trade-off: full-responses bevatten tijdelijk geen geneste hub-kinderen; clients moeten hiervoor (tijdelijk) dedicated endpoints gebruiken.
- TODO: na Bun-upgrade opnieuw valideren en callback-filter op geneste relaties herstellen.
- DB startup fix: bestaande functie `f_formele_wijziging_op_peil(timestamptz)` wordt nu eerst gedropt en daarna opnieuw aangemaakt.
- Reden: PostgreSQL staat geen wijziging van de `RETURNS TABLE` signature toe via `CREATE OR REPLACE FUNCTION` (SQLSTATE `42P13`).
- Post-load hub-kinderen: `laadHubKinderenNaQuery()` laadt Data/Aanvang/Einde records in aparte batch-queries na de hoofd-query, als workaround voor de Bun v1.1.14 geneste has-many panic. Zie `ONTWERP_DATA_PATTERN.md` §15.
- Afgeleide formele tijd: `vulAfgeleideFormeleTijdVoorFullEntity()` daalt nu ook af in hub-kinderen (Data/Aanvang/Einde) bij peiltijdstip-filtering.

## V3.1 runtime extensie (2026-03-29)

- V3 modelformaat uitgebreid met **runtime/deployment metadata** (`V3Runtime`), zodat frontends (content editor, formulieren) en API-clients alle benodigde paden, tabelnamen en kolominfo rechtstreeks uit de model-API (`/api/schema/model`) kunnen lezen — zonder de oudere `viz/schema`-API nodig te hebben.
- Nieuw type `V3Runtime` in `model/v3_format.go` met velden: `veldnaam`, `padnaam`, `tabelnaam`, `idKolom`, `heeftPFK`, `entiteitIDKolom`, `klassenaam`, `relatieveAutoincrement`.
- `V3Runtime` wordt als `"runtime"` (omitempty) opgenomen in `V3Entiteit`, `V3Gegevenselement` en `V3Relatie`.
- `V3Veld` uitgebreid met OAS 3.1 `type`, `format` en `verplicht` velden, zodat frontends weten welk invoerveld ze moeten renderen.
- V3 exporter (`model/v3_exporter.go`) aangevuld met `runtimeVanMeta()` en `oasTypeVoorGoType()` helpers; alle drie de builder-functies vullen nu `Runtime` en de veld-loop vult `Type`/`Format`/`Verplicht`.
- Volledig backward-compatible: alle nieuwe JSON-velden gebruiken `omitempty`, codegen en UML-editor negeren ze.
- Nieuwe tests in `model/v3_exporter_test.go` voor runtime op entiteiten, relaties, en OAS type/format op velden.
- Zie `docs/v3_1_runtime.md` voor de volledige technische documentatie.

## Runtime fix notes (2026-03-26)

- Editor v2 laadt bij opstart standaard de nieuwste DB-versie via `GET /api/schema/versies` en daarna `model_url`.
- Statusbar toont nu modelbron (`[DB #id (status)]` of `[demo]`) en modelnaam met tooltip op modelbeschrijving.
- CORS-fix: middleware-registratie staat nu vóór alle route-definities, zodat ook `GET /api/schema/versies` CORS-headers teruggeeft voor Vite dev-origin (`localhost:5174`).
- Persistency-fix afgeleide velden: Go V3 struct-model uitgebreid zodat deze velden niet meer wegvallen bij `POST /api/schema/model`:
	- `V3Entiteit.AfgeleideVelden`
	- `V3Veld.Afgeleid`
	- `V3Veld.AfleidingsregelTaal`
	- `V3Veld.Afleidingsregel`
	- nieuw type `V3AfgeleidVeld`
- Effect: afgeleide velden blijven nu behouden na publiceren naar DB en reload van editor v2.

## 1. Nieuwe image bouwen en pushen

```bash
docker build --no-cache -t markwestbroek/bitemp-go-api:v06.00.01 .
docker push markwestbroek/bitemp-go-api:v06.00.01
```

## 2. API tag bijwerken op server

In `.env.docker`:

```dotenv
API_IMAGE=markwestbroek/bitemp-go-api:v06.00.01
```

### 2.1 Eerste deployment op een lege server

Als de doel-database nog niet bestaat, kun je de API deze eenmalig laten aanmaken:

```dotenv
AUTO_CREATE_DATABASE=true
```

Optioneel (aanrader): gebruik een admin connectie met CREATEDB-rechten:

```dotenv
DATABASE_ADMIN_URL=postgres://postgres:<password>@<host>:5432/postgres?sslmode=disable
```

Na succesvolle eerste start kun je `AUTO_CREATE_DATABASE` weer uitzetten of verwijderen.

## 3. API stack redeployen

```bash
docker compose -f docker-compose.api-only.yml up -d
```

## 4. Smoke test

```bash
curl http://<server-ip>:8082/version
curl http://<server-ip>:8082/viz/index_schema.html
docker logs --tail 100 bitemp-go-api-v06
```

## 5. Rollback (indien nodig)

Zet `API_IMAGE` terug naar vorige stabiele tag in `.env.docker` en redeploy:

```bash
docker compose -f docker-compose.api-only.yml up -d
```

## 6. Opruimen (optioneel)

Verwijder lokaal oude ongebruikte images:

```bash
docker image prune -a
```

Verwijder oude tags in Docker Hub volgens je bewaarbeleid.
