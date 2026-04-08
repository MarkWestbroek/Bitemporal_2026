# IDE — Online Metamodel-ontwerp omgeving

> Doelstelling: een Eclipse-achtige IDE-shell rondom de bestaande UML editor,
> met dockbare vensters, een project browser tree, multi-diagram tabs, en
> gecentraliseerd state management. Alleen voor metamodel-ontwerp, niet voor
> inhoudelijke data-entry.

## Architectuur

```
┌────────────────────────────────────────────────────────────────┐
│  FlexLayout Shell  (flexlayout-react)                          │
├──────────┬─────────────────────────────┬───────────────────────┤
│ Project  │  Diagram Tabs               │  Details Panel        │
│ Browser  │  ┌─────────┬──────────┐     │  (bewerkbaar          │
│ (react-  │  │ Diag. 1 │ Diag. 2  │    │   properties form)    │
│ arborist)│  ├─────────┴──────────┤     │                       │
│          │  │ React Flow Canvas  │     │                       │
│ Domeinen │  │ (bestaande node-   │     │                       │
│ ├ Elem.  │  │  componenten)      │     │                       │
│ └ Diag.  │  └────────────────────┘     │                       │
└──────────┴─────────────────────────────┴───────────────────────┘
│  Zustand Stores: useModelStore + useUIStore                    │
└────────────────────────────────────────────────────────────────┘
```

Alle panels zijn verplaatsbaar, resizable en dockable (Eclipse-stijl via FlexLayout).

## Technologiekeuzen

| Library              | Versie  | Doel                                         |
|----------------------|---------|----------------------------------------------|
| `flexlayout-react`   | ^0.7    | Docking window manager (tabs, splits, resize)|
| `react-arborist`     | ^3.4    | Tree view voor project browser               |
| `zustand`            | ^5.0    | State management met `persist` middleware     |
| `zundo`              | latest  | Undo/redo temporal middleware voor Zustand     |
| `@xyflow/react`      | ^12     | React Flow (bestaand, voor diagram canvas)   |

### Waarom deze keuzen?

- **FlexLayout** i.p.v. zelf bouwen: bewezen Eclipse-stijl docking met serialiseerbaar layout model. Persistentie in localStorage is ingebouwd.
- **react-arborist** i.p.v. MUI TreeView: virtualisatie uit de doos, drag & drop support, betere performance bij 100+ nodes.
- **Zustand** i.p.v. Redux: lichter, minder boilerplate, `persist` middleware voor auto-save, past bij de bestaande codestijl van het project.

## Ontwerpbeslissingen

1. **Wrapper-aanpak**: de IDE leeft in `web/vite/src/ide/` en `web/vite/src/store/`, *niet* in de `uml-editor/` subtree. Bestaande node-componenten (EntiteitNode, GegevensElementNode, etc.) worden hergebruikt via imports, niet gekopieerd of gewijzigd.
2. **EditorV2 blijft intact**: de bestaande `/editor-v2` route werkt ongewijzigd. De IDE is een volledig nieuwe route (`/ide`).
3. **Element/diagram-scheiding**: posities zitten in diagrammen, niet in elementen. Eén element kan op meerdere diagrammen voorkomen.
4. **Lokale persistentie eerst**: Zustand `persist` → localStorage. Database-sync en multi-user is een latere fase.
5. **V3 model format**: wordt gebruikt als import/export formaat. De IDE werkt intern met een flat `Record<id, element>` voor snelle lookups.

## Bestandsstructuur

```
web/vite/
├── ide.html                     # Entry point
├── src/
│   ├── store/
│   │   ├── useModelStore.js     # Zustand: elementen, edges, diagrammen, domeinen
│   │   ├── useUIStore.js        # Zustand: selectie, clipboard, actief diagram
│   │   └── adapters.js          # V3 ↔ Store transformatie
│   ├── ide/
│   │   ├── layoutConfig.js      # FlexLayout model + tab management
│   │   ├── ProjectBrowser.jsx   # react-arborist tree + zoek + sync
│   │   ├── BrowserContextMenu.jsx # Rechtermuisklik-menu
│   │   ├── DiagramCanvas.jsx    # React Flow wrapper (per diagram, met sync)
│   │   ├── DetailsPanel.jsx     # Bewerkbaar properties panel (inline-edit)
│   │   ├── ActionDialog.jsx     # Publiceer/Rebuild/Pub+Rebuild modale dialoog
│   │   └── ide-diagram.css      # Scoped dark theme voor diagram
│   └── pages/
│       └── IdePage.jsx          # Hoofd-IDE pagina met toolbar + FlexLayout
```

## Data-architectuur

### Zustand Model Store (`useModelStore`)

```
{
  elements: Record<id, {          // Flat lookup — alle types door elkaar
    id, naam, type, domein,
    data: { ...type-specifiek }
  }>,
  structuralEdges: [{             // Entiteit → GE/Relatie verbindingen
    id, source, target, data
  }],
  diagrams: Record<diagramId, {   // Visuele representaties
    id, naam, domein,
    nodes: [{ elementId, position }],
    edges: [{ id, source, target, type, data }],
    viewport: { x, y, zoom }
  }>,
  domains: string[],              // Gesorteerde domeinnamen
  domainMeta: Record<string, {    // Metadata per domein
    beschrijving, kleur, prefix
  }>,
  modelMeta: { bron, build_versie, go_module, id, indiener, versie }
}
```

Persist-key: `"ide-model-store"`, partialiseert naar elements + structuralEdges + diagrams + domains + domainMeta + modelMeta.

### Zustand UI Store (`useUIStore`)

Niet gepersisteerd. Bevat: `selectedElementId`, `selectedEdgeId`, `activeDiagramId`, `actiefDomein`, `clipboard`.

### V3 ↔ Store adapter (`adapters.js`)

- `v3ModelNaarStore(v3Full)` → converteert hiërarchisch V3 JSON naar flat store format. Maakt automatisch een "Overzicht" diagram aan met posities uit de V3 elementen.
- `storeNaarV3Model(state)` → inverse: converteert flat store format terug naar V3 JSON. Gebruikt structuralEdges om GE's en relaties bij hun parent-entiteit te nesten. Behoudt posities uit het overzicht-diagram en edge-handles voor roundtrip-fidelity.
- `exportStoreAsJson(state)` → IDE-native JSON export (`_format: "ide-v1"`).
- `importStoreFromJson(json)` → laadt IDE-native JSON.

## Fasen & Status

### Fase 1: Fundament ✅

| Component            | Status | Beschrijving                                        |
|----------------------|--------|-----------------------------------------------------|
| Zustand stores       | ✅     | useModelStore + useUIStore met persist               |
| V3→Store adapter     | ✅     | Converteert V3 model naar flat store format          |
| FlexLayout shell     | ✅     | 3-panel layout: browser, diagram, details            |
| Project Browser      | ✅     | Domein-gegroepeerde boom, inklapbaar, dark theme     |
| Diagram Canvas       | ✅     | React Flow met alle bestaande node/edge types        |
| Details Panel        | ✅     | Read-only properties weergave                        |
| Entry point + routing| ✅     | `/viz/react/ide.html` + route in App.jsx             |
| Layout persistentie  | ✅     | FlexLayout serialiseert naar localStorage            |
| Model persistentie   | ✅     | Zustand persist → localStorage auto-save             |
| Toolbar              | ✅     | Herlaad, Nieuw diagram, Importeer, Exporteer knoppen |
| Dark theme           | ✅     | Donkere IDE-shell met lichte nodes (EditorV2-stijl)  |

### Fase 2: Browser ↔ Diagram interactie 🔜

| Component                | Status | Beschrijving                                        |
|--------------------------|--------|-----------------------------------------------------|
| Zoekbalk in browser      | ✅     | Filter-input bovenaan; matcht op elementnaam         |
| Browser→Diagram sync     | ✅     | Klik in browser → node selecteert + centreert op diagram |
| Diagram→Browser sync     | ✅     | Klik op node in diagram → browser opent parent-takken en scrollt naar element |
| Rechtermuisklik-menu     | ✅     | "Toon op diagram", "Toon details", "Kopieer ID", "Open diagram", "Nieuw diagram" |
| Drag & drop browser→diag | ✅     | Native HTML5 drag/drop met drag ghost en `application/ide-element` payload |
| Verbindingen tekenen     | ✅     | ENT→GE / ENT→relatie en dependency-edges kunnen direct op het canvas getrokken worden |
| Uitlijnen/alignment      | ✅     | Toolbar + contextmenu voor uitlijnen en verdelen      |
| Edge selectie/contextmenu| ✅     | Geklikte edge highlight zichtbaar; RC op edge → selecteer bron/doel of verwijder edge van diagram |
### Fase 2.5: Bewerkbaar Properties Panel ✅

| Component                     | Status | Beschrijving                                                    |
|-------------------------------|--------|----------------------------------------------------------------|
| Element properties bewerken   | ✅     | Naam, domein, beschrijving, meervoud, kleur etc. inline editen |
| Velden bewerken (GE/relatie)  | ✅     | Toevoegen, verwijderen, herordenen, type/format/verplicht wijzigen |
| Enum waarden bewerken         | ✅     | Toevoegen, verwijderen, herordenen van enumeratiewaarden        |
| Edge properties bewerken      | ✅     | Rolnaam, JSON-rolnaam, momentvoorkomen, kardinaliteit           |
| Gegevenstype properties       | ✅     | Basistype en format selecteren                                  |
| Referentielijst-instantie     | ✅     | Systeemnaam en omschrijving bewerken                            |
| Afgeleide velden              | ✅     | Naam, goType, beschrijving, afleidingsregelTaal, afleidingsregel, isWeergaveVeld bewerken |
| Dynamische veld-types         | ✅     | Dropdown combineert primitieven + ✦ datatypes + ◇ enums + ▣ ref-items uit het model |
| Gegevenstype validatie        | ✅     | Pattern, min/maxLength, min/max, multipleOf, foutmelding, voorbeelden, validatieregels |
| Gegevenstype weergave         | ✅     | Placeholder, inputMask, prefix, suffix                         |
| Live doorvoering naar canvas  | ✅     | Naamwijzigingen worden direct zichtbaar op diagram-nodes        |

Het Details Panel is nu een volledig bewerkbaar inline-formulier. Tekstvelden worden
bijgewerkt bij blur of Enter; checkboxes en dropdowns werken direct. Wijzigingen gaan
via de Zustand store en zijn daarmee automatisch gepersisteerd in localStorage.
### Fase 3: Multi-Diagram �

- ✅ Nieuw diagram aanmaken via browser/toolbar
- ✅ Bestaand diagram opnieuw openen hergebruikt de bestaande tab in plaats van duplicaten te maken
- Meerdere diagram-tabs naast elkaar
- Node toevoegen aan diagram ≠ element aanmaken
- Node verwijderen van diagram ≠ element verwijderen
- Diagram-scoped viewport persistentie

### Fase 4: Persistentie & API ✅

| Component                     | Status | Beschrijving                                                      |
|-------------------------------|--------|------------------------------------------------------------------|
| storeNaarV3Model()            | ✅     | Inverse adapter: flat store → hiërarchisch V3 JSON met posities  |
| V3 Export button              | ✅     | "📄 V3 Export" knop in toolbar — download als `v3-model-*.json`   |
| Publiceer naar API            | ✅     | "🚀 Publiceer" knop → POST naar `/api/schema/model` (proposed versie) |
| Rebuild (devloop)             | ✅     | "⚙️ Rebuild" knop → POST naar `/admin/rebuild/:password` (codegen + herstart) |
| Unsaved changes indicator     | ✅     | Gele "● Gewijzigd" badge in toolbar + isDirty tracking in store  |
| Dirty tracking in store       | ✅     | Alle mutatie-acties zetten `isDirty: true`, load/publish reset   |

> **Publiceer vs Rebuild**: dit zijn twee aparte functies. *Publiceer* stuurt het V3 model
> naar `/api/schema/model` als voorgestelde versie (proposed). *Rebuild* stuurt het model
> naar `/admin/rebuild/:password` voor codegen + server herstart (alleen in devloop-modus).
> Beide tonen een bevestigingsdialoog.

### Fase 5: Polish & UX ✅

| Component                     | Status | Beschrijving                                                    |
|-------------------------------|--------|----------------------------------------------------------------|
| Undo/redo                     | ✅     | Zustand temporal middleware (zundo), 50-stappen historie voor model én diagramlayout (excl. viewport) |
| Undo/redo toolbar knoppen     | ✅     | ↩ Undo / ↪ Redo knoppen in toolbar                             |
| Keyboard shortcuts            | ✅     | Ctrl+S (publiceer), Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo), F2 (hernoemen) |
| Element hernoemen (F2)        | ✅     | Prompt-dialoog voor hernoemen van geselecteerd element           |
| Color picker                  | ✅     | HTML5 kleurkiezer + hex-input voor kleur-velden in DetailsPanel |
| Multi-select in browser       | ✅     | Ctrl+klik voor multi-selectie, multi-drag naar diagram          |
| Auto-create edges on drop     | ✅     | Bij drop op diagram: structurele edges automatisch aangemaakt als beide kanten zichtbaar zijn |
| Cross-panel live sync         | ✅     | Naamwijzigingen in DetailsPanel direct zichtbaar op canvas (via Zustand) |

### Fase 6: EditorV2-pariteit & UX-verbeteringen ✅

Naar aanleiding van een vergelijkende test van de IDE tegen EditorV2 zijn de volgende
functionaliteiten toegevoegd om feature-pariteit te bereiken en de gebruikerservaring
te verbeteren.

| Component                           | Status | Beschrijving                                                                       |
|-------------------------------------|--------|------------------------------------------------------------------------------------|
| Compositie-edges bij drop           | ✅     | Automatisch aangemaakte edges bij drop gebruiken nu `type: "metamodel"` met juiste data (rolnaam, momentvoorkomen, kardinaliteit) zodat compositie-diamanten en labels correct renderen |
| Shift-select in Project Browser     | ✅     | Shift+klik selecteert een bereik van elementen tussen de laatste klik en de huidige, aanvullend op bestaande Ctrl+klik toggle |
| Edge dubbelklik → kortste weg       | ✅     | Dubbelklik op een edge berekent de optimale handle-combinatie (top/right/bottom/left) via Euclidische afstand en past source/targetHandle aan |
| Edge types (compositie/dependency)  | ✅     | `MetamodelEdge` rendert compositie-diamant (◆) bij ENT→GE/relatie, stippellijn bij dependency, driehoekpijl bij generalisatie |
| Diagram hernoemen                   | ✅     | Rechtsklik → "✏️ Hernoem" in Project Browser + F2 sneltoets werkt nu ook voor diagrammen |
| Cross-panel sync op diagram         | ✅     | useEffect op `elements` store: wijzigingen in DetailsPanel (naam, kleur, beschrijving) worden direct doorgespeeld naar React Flow nodes |
| Rijke Publiceer-dialoog             | ✅     | `ActionDialog.jsx`: modal met versie, naam, indiener, API-base, opmerking — vervangt simpele `window.prompt` |
| Rijke Rebuild-dialoog               | ✅     | Zelfde ActionDialog: bron-selectie, wachtwoord, domein-checkboxes met alles/geen, prefix en mode per domein |
| Publiceer + Rebuild combi           | ✅     | "🚀⚙️ Pub+Rebuild" knop voert eerst publiceer uit, daarna automatisch rebuild     |
| Element-kleuren in Project Browser  | ✅     | Gekleurde stip (8×8 cirkel) naast het icoon in de boomstructuur, indien het element een kleur heeft |
| Domein als bewerkbaar element       | ✅     | Klik op domein-map in PB → DomainEditor in DetailsPanel: beschrijving, kleur, prefix. `domainMeta` in de store met `addDomain`/`removeDomain`/`updateDomainMeta` acties |
| Veld-omschrijvingen (OAS 3.1)      | ✅     | Description-invoerveld per veld in VeldEditBlock, placeholder "Omschrijving (OAS 3.1 description)…" |
| Afgeleide velden CEL expand/collapse| ✅     | Afleidingsregel-textareas hebben een ▼/▲ toggle-knop voor compact (28–36px) of uitgebreid (120px, 6 regels) |

#### Technische details Fase 6

##### ActionDialog (`ide/ActionDialog.jsx`)

Nieuwe modale dialoog-component die drie modi ondersteunt:

- `"publish"` — Publiceer-sectie: versie, naam, indiener, apiBase, opmerking
- `"rebuild"` — Rebuild-sectie: bron (dropdown), schemaVersieID, rebuildApiBase, wachtwoord, domein-checkboxes (per domein: prefix + mode) met alles/geen selectieknoppen
- `"publishAndRebuild"` — Beide secties in één dialoog

De dialoog gebruikt inline styles in het donkere IDE-thema. De Publiceer API-call stuurt:
```json
POST {apiBase}/api/schema/model?opmerking=...
{ "bron": "editor", "indiener": "ide-v1", "model": { "versie": "v3", "naam": "...", ...v3Model } }
```

De Rebuild API-call stuurt:
```json
POST {apiBase}/admin/rebuild/{wachtwoord}
{ "model": v3Model, "domeinen": [{ "naam": "register", "prefix": "a", "mode": "register" }, ...] }
```

##### berekenKortsteHandles (`DiagramCanvas.jsx`)

Brute-force berekening over 4×4 = 16 combinaties van handle-posities (top, right, bottom, left) voor source en target nodes. Per combinatie wordt het Euclidisch afstandspunt berekend op basis van nodecentrum ± halve breedte/hoogte. De combinatie met de kleinste afstand wordt als optimale sourceHandle + targetHandle teruggegeven.

##### Domain metadata (`useModelStore.js` + `adapters.js`)

Naast de bestaande `domains: string[]` is nu een `domainMeta: Record<string, { beschrijving, kleur, prefix }>` toegevoegd:

- Gepersisteerd in localStorage en in undo/redo partialize
- Acties: `addDomain(naam)`, `removeDomain(naam)`, `updateDomainMeta(naam, patch)`
- Meegenomen in IDE export/import (`_format: "ide-v1"`)
- V3 import retourneert lege `domainMeta: {}`
- ActionDialog leest `prefix` uit domainMeta voor pre-fill van rebuild-configuratie

##### Stabiliteit & undo/redo-bugfixes (2026-04-07)

Naar aanleiding van praktijktesten in de IDE zijn twee gerichte fixes doorgevoerd en gedocumenteerd:

- **Domain click crash** — In `DetailsPanel.jsx` gebruikt `DomainEditor` nu een stabiele `EMPTY_DOMAIN_META` fallback in plaats van `|| {}`. Daarmee wordt voorkomen dat de Zustand-selector bij elke render een nieuw object teruggeeft, wat eerder kon leiden tot `Maximum update depth exceeded` bij klikken op een domein zonder metadata.
- **Undo/redo voor node-verschuivingen** — In `useModelStore.js` staat de middleware-volgorde nu correct als `persist(temporal(...))`. Daarnaast neemt de temporal `partialize` nu ook de `diagrams` mee, maar expliciet **zonder** `viewport`, zodat node-posities en diagram-edges wel undoable zijn, terwijl pan/zoom geen ruis in de history geven.
- **Geen 'lege' undo-stappen meer** — De temporal-config gebruikt een `equality` check op de geprojecteerde undo-state, zodat wijzigingen die alleen `isDirty` of viewport raken geen zichtbare maar inhoudsloze undo-stap meer toevoegen.
- **React Flow sync na undo/redo** — In `DiagramCanvas.jsx` wordt de store-state na undo/redo teruggesynchroniseerd naar de canvas-nodes en -edges. Daardoor springen verschoven nodes nu ook visueel terug naar hun vorige positie.

> Opmerking: bestaande localStorage-data uit een oudere sessie kan nog oude history bevatten. Bij twijfel kan `localStorage.removeItem("ide-model-store")` in de browserconsole helpen om schoon te herstarten.

##### Veld-omschrijvingen

De `description` property bestond al in het velddata-model (aangemaakt in `addVeld()` en verwerkt in de V3 adapter `convertV3Veld()`), maar had geen UI. Nu wordt een invoerveld getoond tussen de naam/type-rij en de afgeleid-toggle in `VeldEditBlock`. Dit correspondeert met het `description` veld in OAS 3.1 schema-objecten.

## Styling & Thema-toggle (donker / licht)

De IDE ondersteunt zowel een **donker** als een **licht** thema. Het thema kan gewisseld worden via de **☀️ Licht / 🌙 Donker** knop in de toolbar. De keuze wordt opgeslagen in `localStorage` onder de sleutel `ide-theme` en blijft dus behouden na herladen.

Diagram nodes behouden hun **lichte achtergrondkleuren** in beide thema's — identiek aan EditorV2.

### Thema-architectuur

Het thema-systeem draait op **CSS custom properties** die geswitcht worden via een `data-ide-theme` attribuut op `<body>`:

```css
body[data-ide-theme="dark"]  { --ide-body-bg: #1e1e1e; --ide-body-color: #ccc; ... }
body[data-ide-theme="light"] { --ide-body-bg: #f5f5f5; --ide-body-color: #1e293b; ... }
```

Er zijn ~50 CSS variabelen die alle IDE-oppervlakken bestrijken: achtergronden, tekst, inputs, menus, panels, boomstructuur, veld-edit-blokken, knoppen, tabellen en dialogen.

### Componenten die schakelen

| Component         | Mechanisme                                                                |
|-------------------|---------------------------------------------------------------------------|
| **IDE CSS**       | `ide-diagram.css` — twee sets CSS variabelen (dark/light) op `body[data-ide-theme]` |
| **FlexLayout**    | Dynamische `<link>` swap tussen `dark.css` en `light.css` via Vite `?url` imports |
| **React Flow**    | `colorMode={theme}` prop op `<ReactFlow>` — ingebouwde ondersteuning     |
| **Inline styles** | Alle component-bestanden (DetailsPanel, ProjectBrowser, BrowserContextMenu, ActionDialog, DiagramCanvas) gebruiken `var(--ide-...)` in hun style-objecten |

### Zustand integratie

In `useUIStore.js`:
- `theme` — state property (`"dark"` of `"light"`), geïnitialiseerd vanuit `localStorage`
- `toggleTheme()` — wisselt thema en schrijft naar `localStorage`
- `IdePage.jsx` leest `theme` en `toggleTheme` uit de store en synchroniseert `document.body.dataset.ideTheme`

### CSS-strategie (volledig)

- `@xyflow/react/dist/style.css` — React Flow basis
- `@editor/styles/editor.css` — node/edge styling uit de uml-editor subtree
- `ide-diagram.css` — thema variabelen (dark + light) + canvas overrides

De `editor.css` bevat globale `*` en `body` resets. Die worden geneutraliseerd via `body:has(.ide-canvas)` in `ide-diagram.css`.

## Hoe te gebruiken

1. Start de Go API server (`bitemp-go-api` of `go run main.go`)
2. Start Vite dev server: `npm run dev -- --host` in `web/vite/`
3. Open `http://localhost:5174/viz/react/ide.html`
4. Het model wordt automatisch uit de database geladen, of het demo-model als fallback
5. Gebruik ➕ Diagram om een nieuw leeg diagram-tabblad aan te maken
6. Gebruik 🔄 Herlaad om een verse copy uit de DB te halen
7. Gebruik 💾 Exporteer om het model als JSON op te slaan
8. Gebruik 📂 Importeer om een V3 of IDE-JSON bestand te laden
