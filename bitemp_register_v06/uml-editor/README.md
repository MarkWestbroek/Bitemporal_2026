# Metamodel Editor

Een visuele editor voor het bitemporele metamodel, gebouwd met **React Flow** (`@xyflow/react`) in een **React + Vite** project.

De editor weerspiegelt het metamodel achter het bitemporele register: drie klasse-typen (entiteit, gegevenselement, relatie) met hun onderlinge relaties, attributen, enumeraties en constraints.

---

## Uitgangspunten

### Domein: het bitemporele metamodel

Het metamodel kent drie representatietypen:

| Metatype | Voorbeeld | Kenmerken |
|---|---|---|
| **Entiteit** | A, B | Hoofdobject met eigen ID, kan onderliggende GE's en relaties bevatten |
| **Gegevenselement** | A_U, A_V, B_X | Attribuutgroep onder een entiteit, met FK naar parent en relatieve `rel_id` |
| **Relatie** | Rel_A_B | Verbinding tussen twee entiteiten, met FK naar beide + relatieve `rel_id` |

Daarnaast:

- **Momentvoorkomen**: `{enkelvoudig}` (max 1 actief per entiteit op formeel tijdstip t) of `{meervoudig}` (meerdere tegelijk mogelijk)
- **Kardinaliteit**: `0..1`, `1`, `0..*`, `1..*`
- **Rollen**: elke relatie van entiteit→GE/relatie heeft een rolnaam (Go-veldnaam) en JSON-rolnaam
- **Materialiteit**: sommige typen hebben een materiële tijdlijn (aanvang/einde)
- **Enumeraties**: benoemde sets van toegestane waarden (bijv. `RelABSoort: LTT|LAT|LTA`)
- **Veldtypen**: gebaseerd op OAS 3.1 mapping van Go-types (string, integer, number, boolean, date, date-time)

### Technische keuze: React Flow

**Waarom React Flow** in plaats van een bestaande UML-editor (draw.io, JointJS, Eclipse GLSP)?

1. **Pure React** — past naadloos in de bestaande Vite-frontend, geen iframe of wrapper nodig
2. **Lichtgewicht** — één dependency (`@xyflow/react`), geen jQuery, geen aparte server
3. **Gratis interactie**: drag & drop, pan, zoom, selectie, snapping, minimap, verbindingen trekken
4. **Custom nodes zijn gewone React-componenten** — maximale flexibiliteit, geen framework-lock-in
5. **Het metamodel is gespecialiseerd genoeg** dat een generieke UML-tool meer in de weg zit dan helpt, en **simpel genoeg** dat zelf bouwen haalbaar is

### Brug naar de backend

De editor kan het bestaande model inladen vanuit de **schema-API** (`/schema`) van de bitemporele Go-backend. De functie `schemaResponseNaarEditor()` converteert de schema-API response rechtstreeks naar React Flow nodes + edges. Omgekeerd exporteert `editorNaarMetamodel()` de editor-state als een plat JSON-object dat verder verwerkt kan worden (bijv. naar MetaRegistry-formaat of XMI).

---

## Functies

| Actie | Hoe |
|---|---|
| **Node verslepen** | Drag & drop op het canvas |
| **Zoom/pan** | Scrollwiel / twee vingers |
| **Relatie trekken** | Sleep van een ● handle naar een andere node |
| **Type bewerken** | Klik op een node → sidebar toont velden |
| **Veld toevoegen** | In sidebar: "+ Veld toevoegen" |
| **Veld verplaatsen** | In sidebar: ↑ / ↓ knoppen |
| **Relatie bewerken** | Klik op een edge → sidebar toont rolnaam, kardinaliteit, constraint |
| **Nieuw type toevoegen** | Toolbar: +Entiteit / +GE / +Relatie / +Enumeratie |
| **Opslaan als JSON** | Toolbar: 💾 → download `metamodel.json` (bevat zowel model als layout) |
| **Opslaan als V3 JSON** | Toolbar: 💾 Opslaan (V3 JSON) → download `metamodel_v3.json` (codegen-ready) |
| **Publiceren naar schema-API** | Toolbar: ☁ Publiceer schema-model → POST naar `/api/schema/model` met prompts voor versie/naam/indiener/opmerking |
| **Laden vanuit JSON** | Toolbar: 📂 → upload eerder opgeslagen bestand (flowState) of V3-model JSON (`entiteiten`) |
| **Laden vanuit schema-API** | Toolbar: 🔌 → voer URL in (bijv. `http://localhost:8080/schema`) |
| **Verwijderen** | Selecteer + Delete/Backspace, of via rode knop in sidebar |

Bij enums en gegevenstypen geldt extra veiligheid:

- Bij hernoemen worden veldreferenties automatisch meegeüpdatet.
- Bij verwijderen krijg je een waarschuwing als het type nog gebruikt wordt.

### Demo-data

Bij het opstarten toont de editor het bitemporele voorbeeldmodel:
- Entiteiten **A** (blauw) en **B** (rood)
- Gegevenselementen **A_U**, **A_V**, **A_W**, **B_X**, **B_Y** (groen/oranje/geel)
- Relatie **Rel_A_B** (paars) met edges naar zowel A als B
- Enumeraties **RelABSoort** en **ABCEnum**

---

## Code-uitleg

### Projectstructuur

```
src/
├── metamodel/
│   ├── types.js              ← Data types, helpers, schema-API ↔ editor conversie
│   └── demoData.js           ← Bitemporeel model als startdata (A, B, GE's, Rel_A_B)
├── components/
│   ├── MetamodelEditor.jsx   ← Hoofdcomponent: React Flow canvas + sidebar
│   ├── nodes/
│   │   ├── EntiteitNode.jsx         ← Blauw UML-blok met «entiteit»
│   │   ├── GegevensElementNode.jsx  ← Groen UML-blok met «gegevenselement»
│   │   ├── RelatieNode.jsx          ← Paars UML-blok met «relatie»
│   │   └── EnumeratieNode.jsx       ← Geel blok met «enumeratie»
│   ├── edges/
│   │   └── MetamodelEdge.jsx        ← Edge met rolnaam, kardinaliteit, constraint
│   └── panels/
│       ├── Toolbar.jsx              ← Werkbalk: toevoegen, opslaan, laden
│       ├── NodeEditPanel.jsx        ← Sidebar: type en velden bewerken
│       └── EdgeEditPanel.jsx        ← Sidebar: relatie bewerken
├── styles/
│   └── editor.css
├── App.jsx
└── main.jsx
```

### React Flow kernconcepten (zoals toegepast)

#### 1. Node Types registratie

```jsx
// MetamodelEditor.jsx — BUITEN de component (stabiele referentie)
const nodeTypes = {
  entiteit: EntiteitNode,
  gegevenselement: GegevensElementNode,
  relatie: RelatieNode,
  enumeratie: EnumeratieNode,
};
```

React Flow kijkt naar het `type` veld van elke node en rendert het bijbehorende React-component. Dit object moet een stabiele referentie zijn (buiten de component of in `useMemo`), anders triggert React Flow oneindige re-renders.

#### 2. State hooks

```jsx
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
```

React Flow levert `useNodesState` en `useEdgesState` als state-management hooks:
- `nodes` / `edges` — de huidige arrays
- `setNodes` / `setEdges` — directe setters (voor inserts, deletes, updates)
- `onNodesChange` / `onEdgesChange` — event handlers die React Flow aanroept bij drag, selectie, delete, etc. Deze verwerken automatisch de inkomende "changes"

#### 3. Handles (connectiepunten)

```jsx
// In je custom node component:
<Handle type="source" position={Position.Bottom} id="bottom" />
<Handle type="target" position={Position.Top} id="top" />
```

Handles zijn de punten waarop edges "aansluiten". `type="source"` is het vertrekpunt, `type="target"` het aankomstpunt. React Flow tekent ze als klikbare/sleepbare cirkels op de node.

#### 4. onConnect callback

```jsx
const onConnect = useCallback((connection) => {
  const newEdge = {
    ...connection,
    id: generateId("edge"),
    type: "metamodel",
    data: { rolnaam: "", momentvoorkomen: "enkelvoudig", kardinaliteit: "0..1" },
  };
  setEdges((eds) => addEdge(newEdge, eds));
}, [setEdges]);
```

Wordt getriggerd wanneer een gebruiker een lijn trekt van een source handle naar een target handle. De `connection` bevat `source`, `target`, `sourceHandle`, `targetHandle`. Wij verrijken dit met ons metamodel-data.

#### 5. Custom edges met labels

```jsx
// MetamodelEdge.jsx
<BaseEdge id={id} path={edgePath} />
<EdgeLabelRenderer>
  <div style={{ transform: `translate(${labelX}px, ${labelY}px)` }}>
    <span>{rolnaam}</span>
    <span>{kardinaliteit}</span>
    <span>{constraint}</span>
  </div>
</EdgeLabelRenderer>
```

`BaseEdge` tekent de SVG-lijn. `EdgeLabelRenderer` is een portal die HTML-elementen over de SVG canvas plaatst, zodat je rijke labels kunt tonen (rolnaam, `{enkelvoudig}`, `0..*`).

#### 6. Ingebouwde UI-helpers

```jsx
<ReactFlow ...>
  <MiniMap nodeColor={minimapColor} zoomable pannable />
  <Controls />
  <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
</ReactFlow>
```

- **MiniMap**: een klein overzichtskaartje rechtsonder
- **Controls**: zoom in/out/fit-to-view knoppen
- **Background**: rasterpatroon voor visuele referentie

### Custom node componenten

Elke node is een gewoon React-component dat `data` en `selected` als props ontvangt. De visuele structuur volgt het UML class diagram patroon:

```
┌─────────────────────────┐
│  «stereotype»           │  ← metatype als UML stereotype
│  Typenaam               │  ← bold, prominent
│  [materieel]            │  ← badge als isMaterieel=true
├─────────────────────────┤
│  veldnaam : type        │  ← verplichte velden in bold
│  veldnaam : type {AI}   │  ← auto-increment indicator
│  veldnaam : type {enum} │  ← enum-waarden inline
└─────────────────────────┘
```

Elke node-variant heeft zijn eigen border-kleur (blauw/groen/paars/geel) en achtergrondkleur uit de MetaRegistry.

### Sidebar edit panels

Bij selectie van een node of edge verschijnt rechts een edit panel:

- **NodeEditPanel**: bewerken van typenaam, beschrijving, metatype, kleur, materialiteit, en de volledige veldenlijst (toevoegen, verwijderen, herordenen, type/format/verplicht/autoincrement instellen)
- **EdgeEditPanel**: bewerken van rolnaam, JSON-rolnaam, momentvoorkomen en kardinaliteit
- **EnumeratieNode**: bewerken van naam en de lijst waarden

### Schema-API integratie

De functie `schemaResponseNaarEditor()` in `types.js` converteert de JSON-response van de Go schema-API naar React Flow nodes en edges:

1. **Eerste pass**: maakt een node per type, entiteiten bovenaan, GE's/relaties eronder
2. **Tweede pass**: maakt edges op basis van `onderliggende` relaties in de entiteit-entries
3. **Derde pass**: voor relatie-typen wordt ook een edge naar de secondaire entiteit gemaakt

De omgekeerde richting (`editorNaarMetamodel()`) exporteert de huidige editor-state als een plat metamodel JSON-object, geschikt voor verdere verwerking.

---

## Opstarten

```bash
npm install
npx vite           # dev server op http://localhost:5173
npx vite build     # productie-build in dist/
```

## Editor v2 — V3 registermodel (zonder plumbing)

Naast de originele editor (v1, gebaseerd op het platte `/api/viz/schema` endpoint) is er een **v2** die werkt met het hiërarchische **V3 registermodel** van `/api/schema/model/code`.

### Verschil v1 vs v2

| Aspect | Editor v1 | Editor v2 |
|--------|-----------|-----------|
| API bron | `/api/viz/schema` (platte lijst van alle types) | `/api/schema/model/code` (V3 hiërarchisch uit code) |
| Plumbing velden | a_id, rel_id, b_id, versie, opvoer, afvoer zichtbaar | **Geen** — alleen inhoudelijke velden |
| Hub/Data/Aanvang/Einde | Zichtbaar als aparte nodes | **Niet zichtbaar** — alleen logische GE's |
| Materieel | Badge op node | Badge op node (ongewijzigd) |
| Enum-velden | Inline waarden-array | Opgelost via V3 enums (goType → waarden lookup) |
| Veldtypen | OAS type+format vanuit schema-API | Go types, automatisch geconverteerd |

### Waarom v2?

Het V3 model beschrijft het **logische registermodel** zonder implementatiedetails:
- Geen plumbing (id, FK's, versie, opvoer/afvoer) — dat is infrastructuur, niet des UML's
- GE's bevatten hun inhoudelijke velden direct, zonder hub/data-splitsing
- Aanvang/einde zijn niet zichtbaar als aparte types — materialiteit is een label op het GE
- Autoincrement is een patroon op basis van metatype, niet per veld geconfigureerd

De code generator kan alle DB-structuur (tabellen, triggers, FK's) **afleiden** uit het metatype + `isMaterieel` flag + aanwezigheid van inhoudelijke velden.

### Converter: `v3ModelNaarEditor.js`

De converter in `web/vite/src/v3ModelNaarEditor.js` transformeert een V3Model naar React Flow nodes + edges:

1. **Enums** → enumeratie-nodes
2. **Datatypes** → gegevenstype-nodes
3. **Entiteiten** → entiteit-nodes (zonder velden — id is plumbing)
4. **Gegevenselementen** → GE-nodes met inhoudsvelden, edge van parent-entiteit
5. **Relaties** → relatie-nodes met inhoudsvelden, edge van parent-entiteit + edge naar doelentiteit

Go types worden automatisch gemapt naar editor-veldtypen:

| Go type | Editor type + format |
|---------|---------------------|
| `string` | string |
| `int`, `int32`, `int64` | integer |
| `float32`, `float64` | number, float64 |
| `bool` | boolean |
| `Date` | string, date |
| `time.Time` | string, date-time |
| `*T` (pointer) | zelfde, maar `verplicht: false` |
| enum (named type) | string + enum-waarden uit V3 enums |

### Bestanden

| Bestand | Doel |
|---------|------|
| `web/vite/src/v3ModelNaarEditor.js` | V3Model → React Flow nodes/edges converter |
| `web/vite/src/demoV3Model.js` | Demo V3 model (hetzelfde register als demoData.js) |
| `web/vite/src/pages/EditorV2Page.jsx` | Page component met V3 loader en header bar |
| `web/vite/editor-v2.html` | HTML entry point |

### URLs

- Vite dev server: `http://localhost:5174/viz/react/editor-v2.html`
- Go server: `http://localhost:8082/viz/react/editor-v2.html`

De "V3 Model laden"-knop in de header bar fetcht standaard van `/api/schema/model/code` en converteert automatisch. Daarmee laad je expliciet de actuele code-toestand, niet de actieve schema-versie uit de database. In de toolbar is nu ook een aparte knop **"Opslaan (V3 JSON)"** toegevoegd: die exporteert een codegen-ready V3 modelbestand zonder `flowState`.

---

## Toekomstige mogelijkheden

- **XMI-export** voor import in Sparx Enterprise Architect of andere UML-tools
- **MetaRegistry-generatie**: editor-output omzetten naar Go-code (MetaRegistry entries + struct definities)
- **Validatie**: controle op naamconventies, verplichte velden, referentiële integriteit
- **Undo/redo**: React Flow ondersteunt dit via een state-history wrapper
- ~~**Integratie in de bitemporele frontend**: embedden als extra pagina naast de bestaande index/tijdlijn/registraties~~ ✅ Gerealiseerd (zie `UML_EDITOR_INTEGRATIE.md`)
