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
- **Domeinfilter**: verberg/toon groepen types per domein (nodes worden uit graphData gefilterd)
- **Wormhole-navigatie**: drie view-modes (meta → instances → concreet) met visuele wormhole-transitie
- **Breadcrumb**: navigatiepad boven in de toolbar (🌌 Meta › Entiteit › Instantie)

---

## Tech stack

| Component | Technologie |
|-----------|------------|
| 3D engine | [`react-force-graph-3d`](https://github.com/vasturiano/react-force-graph) (Three.js) |
| Labels | `CSS2DRenderer` (Three.js) |
| State | React hooks (`useState`, `useMemo`, `useCallback`, `useRef`) |
| Data bron | REST — `GET /api/schema/model/code` (schema), `GET /full/{padnaam}` (instances), `GET /full/{padnaam}/:id` (concreet) |
| Styling | Custom CSS met glassmorphism-achtige semi-transparante panels |

---

## Bestandsstructuur

```
web/vite/src/universum/
├── UniversumPage.jsx    — Hoofdcomponent: 3 view-modes, wormhole-transitie, breadcrumb
├── schemaToGraph.js     — Schema → { nodes, links } transformatie + domeinfilter
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
Klik op een knop om dat domein te verbergen — de nodes en links worden direct uit de graaf verwijderd. Klik opnieuw om het terug te zetten.

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
- Hub-types worden geflattend (geneste `_Data`-array)
- Materiële plumbing (Aanvang/Einde) krijgt cyaan kleur
- Relaties krijgen roze kleur
- `GET /full/{padnaam}/:id`

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

## Geplande uitbreidingen

Zie ook het oorspronkelijke conceptontwerp voor de volledige roadmap.

- [ ] **Ghost loading** — instance nodes eerst als ID-skeletten laden, details on-demand
- [ ] **Semantic zoom** — GE-labels alleen tonen als camera dichtbij genoeg is
- [ ] **Tijdreizen** — slider/playback langs formele en materiële tijdsas
- [x] ~~**HUD breadcrumbs**~~ — gerealiseerd als breadcrumb in toolbar
- [ ] **Zustand store** — gedeelde state tussen 3D view en HUD
- [x] ~~**Metamodel/instance toggle**~~ — gerealiseerd als wormhole view-modes
- [ ] **GraphQL integratie** — efficiëntere nested queries voor drill-down
- [ ] **Bidirectionele relaties** — API uitbreiden voor backward-navigatie

---

## Iteratiegeschiedenis

| Datum | Iteratie | Wijzigingen |
|-------|---------|-------------|
| 2026-04-12 | v1 — PoC | Eerste werkende 3D graaf met camera-tween, gekleurde nodes per metatype, CSS2D-labels, HUD info-panel. API: `/api/viz/schema` |
| 2026-04-12 | v2 — Verbeteringen | Omgeschakeld naar `/api/schema/model/code` (volledigere data). Edges helderder. GE-nodes kleiner voor diepte-contrast. HUD verplaatst naar rechtsboven. Labels op alle types. Schema-kleuren per type. |
| 2026-04-12 | v3 — Interactie | Domeinfilter (linksboven toggle-knoppen). Instance drill-down (dubbelklik/Enter). Keyboard navigatie: Alt+←/→ voor geschiedenis, Escape voor deselecteren. Navigatiegeschiedenis met browser-achtig forward/back-model. |
| 2026-04-12 | v4 — Visuele drill-down | Instance-kubusjes in de 3D-graaf (later vervangen door v5). |
| 2026-04-12 | v5 — Wormhole | **Drie view-modes**: meta → instances → concreet universum, verbonden door visuele wormhole-transitie (donkere radial-gradient overlay). **Domeinfilter fix**: nodes worden nu uit graphData gefilterd i.p.v. via CSS2DRenderer visibility hacks. **Instances-view**: entiteitsbol als semi-transparant centrum (glow-ring) met instance-bolletjes eromheen, d3-force tuning per mode. **Concreet universum**: `GET /full/{padnaam}/:id`, GE-data als tweeregelslabels (klassenaam + waarden), hub-type flattening, materieel-nodes in cyaan. **Breadcrumb**: "🌌 Meta › Type › Instantie" — klik om terug te navigeren. **Keyboard**: Enter = wormhole, Escape/Backspace = terug. |
