# 3D Data Universum

Interactieve 3D-visualisatie van het registermodel als een force-directed graaf.
Alle typen uit de MetaRegistry (entiteiten, gegevenselementen, relaties) worden weergegeven als gekleurde bollen in een navigeerbare 3D-ruimte.

[![Open 3D Universum](https://img.shields.io/badge/Open-3D%20Universum-6366f1?style=for-the-badge)](http://localhost:8082/viz/react/universum.html)

---

## Ontwerp

Het concept is gebaseerd op het idee van een "Data Universum" waarin de gebruiker door metamodel- en datastructuren navigeert alsof het een VR-omgeving is. Het oorspronkelijke conceptontwerp staat in:

- [`docs/plans/2026-04-12 Volledig Ontwerp 3D Data Universum V2.md`](plans/2026-04-12%20Volledig%20Ontwerp%203D%20Data%20Universum%20V2.md)

### Visualisatielagen

| Laag | Status | Beschrijving |
|------|--------|--------------|
| **Metamodel** | ✅ Gerealiseerd | Alle typen uit de MetaRegistry als 3D nodes met onderlinge edges |
| **Instance data** | ✅ Wormhole | Dubbelklik op entiteit → wormhole-transitie → instances-view |
| **Concreet universum** | ✅ Wormhole | Dubbelklik op instantie → transitie → GE-data als nodes |
| **Tijdreizen** | 🔮 Gepland | Formeel/materieel tijdreizen via slider en playback |

### Kernprincipes

- **Schema-driven**: haalt alle metadata op via `GET /api/schema/model/code` — geen hardcoded typen
- **Focus-centric**: camera beweegt vloeiend naar het geselecteerde object (tweening)
- **Domeinfilter**: verberg/toon groepen types per domein (via `useEffect` op mesh- en CSS2D-visibility)
- **Wormhole-navigatie**: drie view-modes (meta → instances → concreet) met visuele wormhole-transitie
- **Breadcrumb**: navigatiepad boven in de toolbar (🌌 Meta › Entiteit › Instantie)

---

## Tech stack

| Component | Technologie |
|-----------|------------|
| 3D engine | [`react-force-graph-3d`](https://github.com/vasturiano/react-force-graph) (Three.js) |
| Labels | `CSS2DRenderer` (Three.js) |
| State | React hooks (`useState`, `useMemo`, `useCallback`, `useRef`) |
| Data bron | REST of GraphQL (toggle in toolbar) — `GET /api/schema/model/code` (schema), `GET /full/{padnaam}` / GraphQL (instances), `GET /full/{padnaam}/:id` / GraphQL (concreet) |
| Styling | Custom CSS met glassmorphism-achtige semi-transparante panels |

---

## Bestandsstructuur

```
web/vite/src/universum/
├── UniversumPage.jsx    — Hoofdcomponent: 3 view-modes, wormhole-transitie, breadcrumb, drone-integratie
├── graphqlFetcher.js    — Dynamische GraphQL query-builder + fetcher (alternatief voor REST)
├── schemaToGraph.js     — Schema → { nodes, links } transformatie + domeinfilter
├── sfx.js               — Synthesized sound effects (Web Audio API): 5 effecten + ambient drone
└── universum.css        — Styling: container, toolbar, domein-knoppen, HUD, labels
```

Overige bestanden:

| Bestand | Wijziging |
|---------|-----------|
| `web/vite/src/App.jsx` | Route `/universum` + lazy-load `UniversumPage` |
| `web/vite/vite.config.js` | Entry point `universum.html` in build |
| `web/vite/universum.html` | HTML entry point |
| `web/vite/package.json` | `react-force-graph-3d` + `three` als dependencies |

---

## Gebruiksaanwijzing

### Navigatie

| Actie | Toets / Muis |
|-------|-------------|
| Selecteer node | Klik |
| Wormhole naar instances | Dubbelklik op entiteit, of Enter |
| Wormhole naar concreet | Dubbelklik op instantie, of Enter |
| Terug (1 niveau) | Escape of Backspace |
| Terug naar meta | Klik op "🌌 Meta" in breadcrumb |
| Roteren | Muis slepen (linkerknop) |
| Zoomen | Scrollwiel |
| Pannen | Muis slepen (rechterknop) |

### Domeinfilter

Linksboven verschijnen knoppen per domein (bijv. `abuvwxy`, `np-loc`, `configuratie`).
Klik op een knop om dat domein te verbergen — de Three.js mesh en CSS2D-labels worden onzichtbaar gezet, en de links via `linkVisibility` verborgen. Klik opnieuw om het terug te zetten.

> **Technische achtergrond**: `CSS2DRenderer` gebruikt `traverseVisible()` dat hidden subtrees overslaat maar eerder-zichtbare CSS2D-elements met `display:""` laat staan. Daarom stelt een `useEffect` beide `child.visible` en `element.style.display` expliciet in op elke CSS2DObject, gesynchroniseerd met de actieve domeinen.

### Wormhole-navigatie

Het 3D Universum heeft drie view-modes, verbonden door een visuele "wormhole"-transitie:

#### 1. Meta-universum (standaard)
Het schema-graph: alle typen als gekleurde bollen. Domeinfilter actief.

#### 2. Instances-view
Dubbelklik op een **entiteit** → camera zoomt in op de bol → wormhole-overlay → je zit "in" de entiteit.
- Grote semi-transparante entiteitsbol als centrum (radius 10, opacity 0.35, glow-ring)
- Instanties als kleinere bollen eromheen (radius 3)
- Elke instantie toont de **weergavenaam** (via CEL) of een fallback van de eerste inhoudelijke velden
- d3-force is strak afgesteld: instances clusteren dicht rond de entiteit
- `GET /full/{padnaam}?page=1&size=50`

#### 3. Concreet universum
Dubbelklik op een **instantie** → wormhole → je zit in die persoon/entity's wereld.
- Centrumnode = de instantie ("Lars de Bakker")
- GE-data als bollen eromheen: elke actieve GE krijgt een node met tweeregelslabel (type + data)
- Hub-types worden geflattend (data-velden op hub-niveau, geen geneste `_Data`-arrays)
- Materiële plumbing (Aanvang/Einde) als kleine **manen** dicht bij hun parent: groen (aanvang) / rood (einde), radius 1.0–1.2, korte link distance
- Relaties krijgen roze kleur
- **Relatie follow-through**: relaties met een `doelEntiteit` (bijv. Bereikbaarheid → Locatie) worden automatisch gevolgd. De secondaire entiteit wordt opgehaald en als extra bol weergegeven, met haar eigen GE-data en manen eromheen.
- Data wordt genormaliseerd naar geflattend formaat (zowel vanuit REST als GraphQL)

#### Terug-navigatie
- **Escape** of **Backspace** gaat één niveau terug (concreet → instances → meta)
- **Breadcrumb** ("🌌 Meta › NatuurlijkPersoon › Lars de Bakker") — klik op elk segment

---

## Nodes en edges

### Nodes

Elke node vertegenwoordigt één type uit de MetaRegistry:

| Metatype | Bol-radius | Standaardkleur | Label |
|----------|-----------|----------------|-------|
| Entiteit | 6 | `#60a5fa` (blauw) of schema-kleur | Vet, 13px |
| Relatie | 3 | `#f472b6` (roze) of schema-kleur | Italic, 11px |
| Gegevenselement | 2 | `#a3e635` (groen) of schema-kleur | Licht, 10px |
| Instance (instances-view) | bol 3 | Entiteitskleur | 11px, amber accent |
| Centrum (instances/concreet) | bol 10 / 7 | Entiteitskleur, 35% opacity + glow-ring | Vet, 14px |
| GE-data (concreet) | bol 3 | Schema-kleur | 2-regels: titel + data |

De kleur uit het schema (`kleur`-veld in MetaRegistry/editor) heeft altijd voorrang.

### Edges (links)

| Type | Van → Naar | Kleur |
|------|-----------|-------|
| Onderliggende | Entiteit → GE/relatie hub | `rgba(148,163,184,0.45)` (grijs) |
| Relatie-doel | Relatie → secondaire entiteit | `rgba(244,114,182,0.65)` (roze) |
| Instance-link | Centrum → instantie (instances-view) | `rgba(251,191,36,0.30)` (amber) |
| GE-link | Centrum → GE-data (concreet) | Type-kleur met alpha |

Edges hebben bewegende particles als flow-indicator.

---

## Data transformatie

De functie `schemaToGraph(schema)` in `schemaToGraph.js` transformeert de `/api/schema/model/code` response:

1. **Nodes** — één per type: `id`=typenaam, `color`=kleur, `val`=grootte per metatype
3. **Links** — twee soorten:
   - *Onderliggende*: van elk type naar de entries in `onderliggende[]` (entiteit→GE, hub→data/aanvang/einde)
   - *Relatie-doel*: van relatie naar `doelEntiteit` (de secondaire entiteit)

---

## Databron: REST / GraphQL toggle (`graphqlFetcher.js`)

Rechtsboven in de toolbar staan twee knoppen: **REST** (default) en **GQL**. Hiermee kun je live wisselen welke API het Universum gebruikt voor data-opvraging. De schema-fetch (`/api/schema/model/code`) blijft altijd REST.

### Wat de toggle doet

| Databron | Instances-lijst | Volledige entiteit | Secondaire entiteiten |
|----------|-----------------|--------------------|-----------------------|
| **REST** | `GET /full/{padnaam}?page=1&size=50` | `GET /full/{padnaam}/{id}` | `GET /full/{padnaam}/{id}` |
| **GQL** | `{ <padnaam>(limit: 50) { ...fields } }` | `{ full_<padnaam>(id: X) { ...fields } }` | `{ full_<padnaam>(id: X) { ...fields } }` |

### Hoe GraphQL queries worden opgebouwd

`graphqlFetcher.js` bouwt dynamisch GraphQL queries uit de schema-metadata die al geladen is via `/api/schema/model/code`:

1. **Velden**: alle `velden[].naam` uit het schema-type, plus `opvoer`/`afvoer`
2. **Afgeleide velden**: `afgeleideVelden[].naam` (bijv. `weergavenaam`)
3. **Onderliggende GE's/relaties**: recursief opgelost tot depth 2 via `onderliggende[].jsonRolnaam` → doeltype velden
4. **ID-type detectie**: numerieke ID's worden als `Int` verstuurd, strings als `String`

De queries worden via `POST /graphql/query` verstuurd met `Content-Type: application/json`.

### Twee functies

- `fetchInstancesGraphQL(apiBase, padnaam, typenaam, typesByTypenaam, limit)` — voor instances-lijst
- `fetchFullEntityGraphQL(apiBase, padnaam, id, typenaam, typesByTypenaam)` — voor `full_<padnaam>(id: X)`

### Doel

De toggle maakt het mogelijk om live te vergelijken:
- Werkt de GraphQL-laag correct (zelfde data als REST)?
- Zijn er verschillen in responstijd of responsestructuur?
- Kunnen we later naar GraphQL-only overschakelen (bijv. voor field selection optimalisatie)?

---

## Geluidseffecten (`sfx.js`)

Het 3D Universum heeft gesynthetiseerde geluidseffecten via de **Web Audio API**. Geen samples of externe dependencies — alles wordt realtime gegenereerd met oscillatoren, filters en gain-envelopes. Elke publieke functie is verpakt in `try-catch` zodat een audiofout nooit de React-app laat crashen.

### Architectuur

```
AudioContext (lazy init, autoplay-policy safe)
├── Shared stereo ping-pong delay bus
│   ├── dry → destination (direct geluid)
│   └── wet → delayL (270ms, pan -0.7) ↔ delayR (350ms, pan +0.7)
│       └── feedback 40%/35%, lowpass darkening 1200/1000 Hz
├── Fire-and-forget effecten (woosh, ping, tick, zoom, buzz)
└── Ambient drone (continu, reageert op muisbewegingen)
```

De delay-bus geeft alle effecten een ruimtelijk, dromerig karakter — herhalingen kaatsen links/rechts en worden steeds donkerder door lowpass-filtering in de feedbackloop.

### Effecten

| Functie | Trigger | Beschrijving | Freq. bereik | Duur | Delay |
|---------|---------|--------------|-------------|------|-------|
| `woosh("in")` | Wormhole drill-down | Stijgende saw-sweep + noise | 35→800 Hz | 0.7s | Shared bus |
| `woosh("out")` | Wormhole terug | Dalende saw-sweep, lager en langzamer | 400→18 Hz | 1.4s | **Eigen delay** (450ms/600ms, fb 35%, LP 600 Hz) |
| `ping()` | Node selectie | FM-belletje (carrier 340 Hz, mod 110 Hz) | 340 Hz ± FM | 0.35s | Shared bus |
| `tick(on)` | Domeinfilter toggle | Mechanisch klikje, square-wave | 600/380 Hz | 0.08s | Geen (dry only) |
| `zoom()` | Camera-beweging | Tonale glide + noise | 110→240→170 Hz | 0.45s | Shared bus |
| `buzz()` | Geblokkeerde actie | Korte sawtooth-buzz | 55 Hz, LP 200 | 0.2s | Geen (dry only) |

De woosh-out heeft bewust een eigen, tragere delay (450ms/600ms) in plaats van de shared bus (270ms/350ms), voor een dromerig uitfade-effect bij het terugnavigeren.

### Ambient drone

Een continu achtergrondgeluid dat reageert op muisbewegingen in de 3D-ruimte:

**Signaalpad:**
```
2× detuned sawtooth (42 / 43.5 Hz) → sawGain (0.5)
    → lowpass (idle: 280 Hz, Q 1.5; moving: 1200 Hz)
        → master gain (idle: 0.03; moving: 0.18) → delay bus + destination
Noise (8s looped buffer) → bandpass (300 Hz, Q 2.5)
    + LFO sweep (0.07 Hz, ±200 Hz) → noiseGain (0.3) → master
```

**API:**
- `droneStart()` — Start de drone (idempotent, meerdere calls zijn veilig)
- `droneStop()` — Fade-out (τ=0.15s) en cleanup na 0.6s
- `droneMove(intensity)` — `0..1`, stuurt gain + filter mee:
  - Gain: `0.03 + t² × 0.15` (exponentiële curve voor natuurlijk gevoel)
  - Filter cutoff: `280 + t × 920` Hz
  - Overgang via `setTargetAtTime` met τ=0.08s voor vloeiende transities

**Integratie in UniversumPage.jsx:**
- `useEffect` met `[]` luistert op `window` (niet `containerRef`) voor `pointermove`
- Reden: de eerste render is een loading-state early-return zonder `ref={containerRef}` — als we op `containerRef.current` luisteren, wordt de listener nooit geattacht
- Snelheidsberekening: `|Δx| + |Δy|` / `Δt` (px/ms) → genormaliseerd naar 0..1 met drempel 1.5 px/ms
- Drone start lazy bij eerste beweging, fadt naar idle na 120ms zonder beweging
- Cleanup: `droneStop()` bij unmount

---

## Geplande uitbreidingen

Zie ook het oorspronkelijke conceptontwerp voor de volledige roadmap.

- [ ] **Ghost loading** — instance nodes eerst als ID-skeletten laden, details on-demand
- [ ] **Semantic zoom** — GE-labels alleen tonen als camera dichtbij genoeg is
- [ ] **Tijdreizen** — slider/playback langs formele en materiële tijdsas
- [x] ~~**HUD breadcrumbs**~~ — gerealiseerd als breadcrumb in toolbar
- [ ] **Zustand store** — gedeelde state tussen 3D view en HUD
- [x] ~~**Metamodel/instance toggle**~~ — gerealiseerd als wormhole view-modes
- [x] ~~**GraphQL integratie**~~ — gerealiseerd als REST/GraphQL toggle in de toolbar (zie hieronder)
- [x] ~~**Bidirectionele relaties**~~ — gerealiseerd via GraphQL reverse relaties (zie `docs/dynamische-graphql-laag.md`)

---

## Iteratiegeschiedenis

| Datum | Iteratie | Wijzigingen |
|-------|---------|-------------|
| 2026-04-12 | v1 — PoC | Eerste werkende 3D graaf met camera-tween, gekleurde nodes per metatype, CSS2D-labels, HUD info-panel. API: `/api/viz/schema` |
| 2026-04-12 | v2 — Verbeteringen | Omgeschakeld naar `/api/schema/model/code` (volledigere data). Edges helderder. GE-nodes kleiner voor diepte-contrast. HUD verplaatst naar rechtsboven. Labels op alle types. Schema-kleuren per type. |
| 2026-04-12 | v3 — Interactie | Domeinfilter (linksboven toggle-knoppen). Instance drill-down (dubbelklik/Enter). Keyboard navigatie: Alt+←/→ voor geschiedenis, Escape voor deselecteren. Navigatiegeschiedenis met browser-achtig forward/back-model. |
| 2026-04-12 | v4 — Visuele drill-down | Instance-kubusjes in de 3D-graaf (later vervangen door v5). |
| 2026-04-12 | v5 — Wormhole | **Drie view-modes**: meta → instances → concreet universum, verbonden door visuele wormhole-transitie (donkere radial-gradient overlay). **Domeinfilter fix**: nodes worden nu uit graphData gefilterd i.p.v. via CSS2DRenderer visibility hacks. **Instances-view**: entiteitsbol als semi-transparant centrum (glow-ring) met instance-bolletjes eromheen, d3-force tuning per mode. **Concreet universum**: `GET /full/{padnaam}/:id`, GE-data als tweeregelslabels (klassenaam + waarden), hub-type flattening, materieel-nodes in cyaan. **Breadcrumb**: "🌌 Meta › Type › Instantie" — klik om terug te navigeren. **Keyboard**: Enter = wormhole, Escape/Backspace = terug. |
| 2026-07 | v6 — Geluid + fixes | **Geluidseffecten** (`sfx.js`): 5 fire-and-forget effecten (woosh, ping, tick, zoom, buzz) + ambient drone — puur Web Audio API, geen samples. Stereo ping-pong delay bus voor ruimtelijk effect. Woosh-out heeft eigen tragere delay (450ms/600ms) voor dromerig uitfade. **Ambient drone**: 2 detuned saws (42/43.5 Hz) + LFO-gesweepte noise, reageert op muisbeweging (gain + filter cutoff). Luistert op `window` i.p.v. `containerRef` (fix: `useEffect([])` draait vóór ref-attachment bij conditional render). **Relatie follow-through fix**: secondaire entiteiten worden correct gevolgd en weergegeven in het concrete universum. **Alt+← crash fix**: navigatiegeschiedenis stack boundary-check. |
| 2026-07 | v7 — REST/GraphQL toggle | **Databron-switch**: toggle in toolbar (REST / GQL) om live te wisselen tussen REST `/full` endpoints en GraphQL queries. **`graphqlFetcher.js`**: bouwt dynamisch GraphQL queries op uit de schema-metadata (velden, onderliggende GE's, afgeleide velden, recursief tot depth 2). Alle 3 data-fetches (instances-lijst, volledige entiteit, secondaire entiteiten) switchen op basis van `dataSource` state. Schema-fetch (`/api/schema/model/code`) blijft altijd REST. |
| 2026-07 | v8 — Geflattend formaat + manen | **Uniform geflattend dataformaat**: REST en GraphQL responses worden genormaliseerd naar één formaat voordat de frontend ze verwerkt. Hub+Data flattening (data-velden gepromoveerd naar hub-niveau, `"data"` key verwijderd), enkelvoudige types als object i.p.v. array. **`flattenRecord()`** in `graphqlFetcher.js` normaliseert REST responses client-side. **Backend `full_<padnaam>_list`**: nieuwe GraphQL query die de lijst met alle onderliggende GE's/relaties retourneert (geflattened), zodat instances-view weergavenamen correct berekent. **Aanvang/Einde als manen**: kleine bollen (radius 1.0–1.2) dicht bij hun parent (link distance 10–15) met groen (aanvang) / rood (einde) kleurcodes i.p.v. reguliere GE-bollen. Per-link afstand in d3-force voor concrete view. **Vereenvoudigde helpers**: `berekenWeergavenaam`, `extractGEDisplay`, `buildConcreteGraph` werken nu op het platte formaat zonder hub→data digging. |
| 2026-07 | v8.1 — GQL drilldown fix | **Bugfix: GQL drilldown hing de pagina.** Twee oorzaken gevonden en opgelost: (1) **Dubbele veldnamen in GQL query**: de schema-API bevat child-relaties zowel in `velden` (als leaf) als in `onderliggende` (als genest object). `buildFieldSelection()` nam beide op, waardoor het GraphQL-schema validatiefouten gaf ("must have a sub selection"). Fix: `onderliggendeNamen`-set die leaf-velden filtert die al als genest object worden opgenomen. (2) **Wormhole-overlay bleef permanent actief**: bij een fetch-fout resette de `.catch()` handler `wormholeActive`, maar de `setTimeout(() => setWormholeActive(true), 200)` daarna overschreef dit weer. Het 97%-opaque overlay bedekte het hele scherm permanent — de "hang". Fix: `clearTimeout(wormholeTimer)` in zowel de error- als de lege-resultaten-handler. |
| 2026-07 | v8.2 — Reverse relaties in concrete view | **Bidirectionele navigatie**: entiteiten die eerder een doodlopend punt waren (bijv. Gemeente, Organisatie) tonen nu welke andere entiteiten naar hen verwijzen via relaties. **Client-side reverse relation discovery**: `discoverReverseRelations()` in `graphqlFetcher.js` scant alle relatie-types in de schema-metadata en vindt welke bron-entiteiten via hun `doelEntiteit` naar het huidige type wijzen. **GQL reverse velden**: `fetchFullEntityGraphQL()` voegt `gerelateerde_<bronPadnaam>(limit: 20)` velden toe aan de query — gebruikt de bestaande backend `gerelateerde_*` resolvers uit `type_builder.go`. **Visualisatie**: reverse entiteiten worden getoond als `rev_entity` nodes (amberkleurige rand) met links die NAAR het centrale `__self__` record wijzen, visueel onderscheiden van forward secundaire entiteiten. **Drill-through navigatie**: dubbelklik (of Enter) op een sec_entity of rev_entity node in concrete view navigeert direct naar de concrete view van die entiteit. `enterConcrete` accepteert een optionele `overrideEntity` parameter zodat het niet afhankelijk is van `focusedEntity` state. Breadcrumb en focusedEntity worden automatisch bijgewerkt. `goBack` na een drill-through gaat direct naar meta (geen instances-lijst beschikbaar). **Scope**: alleen GQL-modus; REST reverse relaties worden in een volgende iteratie toegevoegd. |
