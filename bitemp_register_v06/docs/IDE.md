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
│ Browser  │  ┌─────────┬──────────┐     │  (read-only, later   │
│ (react-  │  │ Diag. 1 │ Diag. 2  │    │   editable forms)     │
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
│   │   ├── DetailsPanel.jsx     # Properties panel (read-only v1)
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
  modelMeta: { bron, build_versie, go_module, id, indiener, versie }
}
```

Persist-key: `"ide-model-store"`, partialiseert naar elements + structuralEdges + diagrams + domains + modelMeta.

### Zustand UI Store (`useUIStore`)

Niet gepersisteerd. Bevat: `selectedElementId`, `selectedEdgeId`, `activeDiagramId`, `actiefDomein`, `clipboard`.

### V3 ↔ Store adapter (`adapters.js`)

- `v3ModelNaarStore(v3Full)` → converteert hiërarchisch V3 JSON naar flat store format. Maakt automatisch een "Overzicht" diagram aan met posities uit de V3 elementen.
- `exportStoreAsJson(state)` → IDE-native JSON export (`_format: "ide-v1"`).
- `importStoreFromJson(json)` → laadt IDE-native JSON.
- `storeNaarV3Model()` → TODO (Fase 4): terugtransformatie naar V3 format.

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

### Fase 3: Multi-Diagram �

- ✅ Nieuw diagram aanmaken via browser/toolbar
- ✅ Bestaand diagram opnieuw openen hergebruikt de bestaande tab in plaats van duplicaten te maken
- Meerdere diagram-tabs naast elkaar
- Node toevoegen aan diagram ≠ element aanmaken
- Node verwijderen van diagram ≠ element verwijderen
- Diagram-scoped viewport persistentie

### Fase 4: Persistentie & API 📋

- `storeNaarV3Model()` implementeren
- Publish naar database via bestaande API
- V3 format uitbreiden met `diagrams[]` sectie
- "Unsaved changes" indicator
- Debounced auto-save (2s)

### Fase 5: Polish & UX 📋

- Undo/redo (command pattern)
- Keyboard shortcuts (Ctrl+S, Ctrl+Z, F2, etc.)
- Element hernoemen (F2)
- Monaco Editor voor JSON/CEL views
- Cross-panel live sync (naam wijzigen → overal bijwerken)

## Styling

De IDE gebruikt een **donker thema** voor de shell (FlexLayout, toolbar, browser, details panel) maar de diagram nodes behouden hun **lichte achtergrondkleuren** — identiek aan EditorV2.

CSS-strategie:
- `@xyflow/react/dist/style.css` — React Flow basis
- `@editor/styles/editor.css` — node/edge styling uit de uml-editor subtree
- `ide-diagram.css` — dark theme overrides voor canvas, controls, minimap

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
