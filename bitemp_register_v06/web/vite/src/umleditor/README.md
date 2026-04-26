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
| **Compositie-modus** | Toolbar: klik ◆ Compositie → cursor wordt crosshair → sleep edge van bron naar doel. Auto-reset na 1 edge. Escape of opnieuw klikken om te annuleren |
| **Generalisatie-modus** | Toolbar: klik ▷ Generalisatie → sleep edge tussen zelfde metatype (ENT↔ENT of GE↔GE). Maakt generalisatie-edge met open driehoek (▷). Weigert ongelijke metatypes |
| **Edge-mode indicator** | Bij actieve edge-mode toont het canvas een blauwe banner met de actieve modus en "Esc om te annuleren" |
| **Nieuwe GE via drag** | Alt+drag vanuit een ENT source-handle naar leeg canvas → maakt automatisch een nieuw GE + compositie-edge |
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
| **Edge optimaliseren** | Dubbelklik op een lijn → handles worden herberekend voor kortste route |
| **Gebiedsselectie** | Shift + sleep op canvas → rubber-band selectie van meerdere nodes |
| **Multi-selectie** | Ctrl + klik op nodes om ze individueel bij de selectie te voegen |
| **Uitlijnen / verdelen** | Selecteer 2+ nodes → rechtsklik voor `Links`, `Centreer`, `Rechts`, `Boven`, `Midden`, `Onder`; bij 3+ ook `Verdeel gelijk ↕` en `Verdeel gelijk ↔` |;
wanneer de selectie model-nodes bevat (entiteit / GE / relatie / etc.) verschijnt onderaan hetzelfde menu ook een **Domein wijzigen**-sectie |
| **Dependency verbergen / tonen** | Rechtsklik op een stippellijn `«use»` → `Verberg deze dependency`; rechtsklik op enum/gegevenstype → `Verberg dependencies` of `Toon dependencies` |
| **Undo canvas-acties** | `Ctrl + Z` → maakt de laatste canvasactie ongedaan (kleine undo-stack, o.a. verplaatsen, verbinden, verwijderen, uitlijnen en verdelen) |
| **Redo canvas-acties** | `Ctrl + Y` (of `Ctrl + Shift + Z`) → zet de laatste ongedaan gemaakte canvasactie opnieuw terug |
| **Kopiëren tussen diagrammen** | `Ctrl + C` → kopieer geselecteerde nodes (+ onderlinge edges) naar het clipboard. Werkt ook via rechtsklik → "📋 Kopiëren". Bij rechtsklik op een enkele node wordt die node gekopieerd |
| **Plakken op diagram** | `Ctrl + V` → plak gekopieerde nodes op het actieve diagram (midden viewport). Elementen die al op het diagram staan worden overgeslagen. Edges worden automatisch ontdekt via clipboard-edges + `discoverEdgesForNodes` (scant structuralEdges én alle diagrammen, ook ASOC-doelEdges, anker-edges en dependency-edges). Werkt ook via rechtsklik → "📋 Plakken" |
| **Shift+drag entiteit** | `Shift + drag` vanuit de ProjectBrowser → sleept de entiteit + alle onderliggende GE's/relaties in één keer op het diagram. Edges worden automatisch ontdekt via `discoverEdgesForNodes` (incl. ASOC, anker, dependency). Doel-entiteiten van relaties worden automatisch mee-toegevoegd zodat ASOC-doelEdges direct zichtbaar zijn |
| **Multi-drop vanuit PB** | `Ctrl + klik` op meerdere items in de ProjectBrowser → sleep een van de geselecteerde items naar het diagram → alle geselecteerde items worden in één keer gedropt. Auto-add van gerelateerde entiteiten is ook actief bij multi-drop |
| **Auto-add relatie-endpoints** | Bij het droppen van een relatie worden de owner-entiteit (bron) en doel-entiteit automatisch mee-toegevoegd aan het diagram als ze er niet al op staan. Dit zorgt ervoor dat zowel de structurele ownerEdge als de ASOC-doelEdge direct zichtbaar worden |
| **Export Mermaid** | Toolbar: 🧜 Mermaid → download `metamodel.mmd` |
| **Export PlantUML** | Toolbar: 🌱 PlantUML → download `metamodel.puml` |
| **Export XMI 1.1** | Toolbar: 📦 XMI 1.1 → download `metamodel.xmi` (incl. diagramposities) |
| **Import XMI** | Toolbar: 📥 XMI → laad `.xmi`/`.xml` bestand (incl. EA diagramposities) |
| **Import Mermaid** | Toolbar: 📥 Mermaid → laad `.mmd`/`.md`/`.txt` bestand |
| **Import PlantUML** | Toolbar: 📥 PlantUML → laad `.puml`/`.plantuml`/`.txt` bestand |
| **Ruwe staat opslaan** | Toolbar: 💾⚡ Ruwe staat → schrijft alleen `{ nodes, edges }` weg als `.editor-flow.json` (markering `_format: "editor-flow-v1"`). Bedoeld voor ontwikkeltijd: bewaar een werkende canvas-staat ook als die nog niet als V3 geldig is. Laden gaat via dezelfde `📂 Laden`-knop, die `flowState` automatisch herkent. |

Bij gebiedsselectie kan React Flow naast nodes ook relaties/edges als geselecteerd markeren. Het rechtsklikmenu voor uitlijnen blijft dan toch beschikbaar; de bewerking wordt bewust alleen op de geselecteerde nodes toegepast. Bevat de selectie ook model-nodes (entiteit/GE/relatie), dan is onderin hetzelfde uitlijnmenu ook de **Domein wijzigen**-sectie zichtbaar, zodat beide acties via één rechtsklik beschikbaar zijn.

Voor **dependency-edges** (`«use»`, stippellijnen) is er daarnaast een tweede rechtsklikpad: je kunt een losse dependency direct verbergen, of op een enum/gegevenstype alle inkomende dependencies in één keer verbergen of weer tonen. Dit is handig in drukkere diagrammen waar dezelfde datatype- of enum-node op veel plekken wordt gebruikt.

De editor bewaart deze keuze ook in **V3 JSON** via `useEdges[]`. Daarin worden per dependency-edge de layout-attributen en zichtbaarheid opgeslagen (`id`, `sourceHandle`, `targetHandle`, `hidden`), zodat een save/load of database-roundtrip de verborgen status niet verliest.

Dezelfde metadata blijft nu ook behouden bij een **code-roundtrip**: na een rebuild schrijft de codegenerator `useEdges[]` door naar `EditorLayout.UseEdges` in de gegenereerde `*_metaregistry.go` bestanden, en de V3 exporter geeft dit weer terug aan de editor. Daardoor blijft de route **editor → V3 → code → V3 → editor** layout-stabiel voor dependency-edges.

**Generalisatie-roundtrip**: overerving (generalisatie-edges, `isAbstract`) wordt volledig bewaard in de V3 JSON via de velden `isAbstract` en `erft` op entiteiten. Bij V3 export schrijft de editor de generalisatie-edges als `erft`-referenties naar de parent-entiteit; bij V3 import worden deze weer gereconstrueerd als generalisatie-edges in het canvas. De codegenerator schrijft `IsAbstract` en `ParentTypenaam` door naar de gegenereerde MetaRegistry. Ook de XMI-export genereert nu dynamisch `isAbstract` en `UML:Generalization`-elements, en Mermaid/PlantUML exporteren generalisatie als `--|>` resp. `<|--` pijlen. Bij **import** zijn alle drie de formaten symmetrisch: Mermaid/PlantUML herkennen `<|--`, `--|>`, `<|..` en `..|>`; XMI parseert `UML:Generalization`-elementen (incl. MIM `«Generalisatie»`).

**Stereotype-aliassen**: alle drie de importers (Mermaid, PlantUML, XMI) gebruiken een gedeelde resolver in `import/_helpers.js` met aliassen voor:

| Canoniek | Aliassen |
|---|---|
| entiteit | `ent`, `entiteit`, `objecttype` (MIM) |
| gegevenselement | `ge`, `gegevenselement`, `gegevensgroeptype` (MIM) |
| relatie | `rel`, `relatie`, `relatiesoort` (MIM), `relatieklasse`, `associationclass` |
| referentielijst | `reflijst`, `referentielijst` |
| referentielijst-item | `refitem`, `referentielijstitem` |
| referentielijst-items (relatie) | `refitems`, `referentielijstitems` |
| referentielijst-instantie | `refinstantie`, `referentielijstinstantie` |
| modifiers | `materieel`, `datatype`/`gestructureerd datatype` (MIM), `enum`/`enumeration` |

In XMI wordt naast `<<stereotype>>` ook de taggedValue `bitemp::metatype` herkend en via dezelfde resolver afgehandeld.

**Associatie-promotie bij import (bewust niet)**: Mermaid en PlantUML produceren van nature directe entiteit↔entiteit-edges. Eerder is geprobeerd die direct na import te promoten naar het ASOC-patroon, maar dat is ingetrokken: het kan een eenvoudige UML-import onnodig zwaar maken, en een associatieklasse zonder velden hoort één enkele bubble (de relatie is het anker). De helper `promoteEntiteitAssociaties` blijft beschikbaar in `_helpers.js` voor toekomstig handmatig of opt-in gebruik. De ENT→GE-cast en handmatige conversie naar associatieklasse landen in een volgend blok.

**Orphan-detectie bij import**: na het parsen van Mermaid, PlantUML of XMI loopt de geladen graaf door {@link import/ruwuml.js#detecteerOrphans}. Dit vindt:

- gegevenselementen die geen compositie-edge vanuit een entiteit hebben;
- relatie-nodes die geen koppeling naar een entiteit (of associatie-anker) hebben.

Bij treffers verschijnt de **OrphanDialog** ([components/OrphanDialog.jsx](components/OrphanDialog.jsx)) met per orphan drie keuzes:

| Actie | Effect |
|---|---|
| Placeholder-entiteit aanmaken | Maakt een entiteit `Placeholder_<naam>` (zachtgele kleur, `isPlaceholder: true`) en koppelt die via een compositie-edge (GE) of als bron+doel (relatie). |
| Overslaan | Verwijdert de orphan-node + alle edges die hem aanraken uit de import. |
| Hele import afbreken | Gooit een `ORPHAN_ABORT`-error; er wordt niets in het canvas geladen. |

De bulk-keuzeknop onderin past dezelfde actie toe op alle orphans tegelijk. Dezelfde dialoog wordt ook hergebruikt door de **IDE-importdialoog** ([../ide/ImportDialog.jsx](../ide/ImportDialog.jsx)) wanneer daar een textueel UML-bestand binnenkomt.

**RuwUML-tussenformaat (in opbouw)**: [import/ruwuml.js](import/ruwuml.js) bevat de JSDoc-spec van een neutraal tussenformaat (`RuwUMLModel`/`RuwUMLNode`/`RuwUMLEdge`) tussen de drie parsers en de editor. In deze iteratie zijn alleen de orphan-helpers daadwerkelijk in gebruik (op de editor-shape); een vervolgslice converteert de drie parsers eerst naar RuwUML en daarna via een gedeelde `ruwUMLNaarEditor` adapter — zodat stereotype-resolutie, ID-generatie en ASOC-mapping op één plek leven.

Voor canvasinteracties is er een **kleine undo/redo-stack**: met `Ctrl + Z` kun je de laatste grafische acties terugdraaien, en met `Ctrl + Y` of `Ctrl + Shift + Z` zet je de laatste ongedaan gemaakte canvasactie weer terug. Dit geldt voor **verplaatsen**, **verbinden**, **verwijderen**, **uitlijnen** en **verdelen**. Deze sneltoetsen grijpen niet in als je in een invoerveld of tekstvak aan het typen bent; dan blijft de normale browser/input-undo gelden. Bewerkingen in het inhouds-/zijpaneel vallen bewust buiten deze canvas-undo.

### Edge-modus (Verbinding-tekenmodus)

De toolbar bevat twee **edge-mode knoppen**: ◆ Compositie en ▷ Generalisatie. Deze werken als toggle:

1. **Klik op een knop** → de knop licht op, de cursor verandert in een crosshair, en een blauwe banner verschijnt ("…-modus actief — sleep van bron naar doel").
2. **Sleep van een handle naar een andere node** → een edge van dat specifieke type wordt aangemaakt, ongeacht de standaard auto-detectie.
3. **Na 1 edge** → de modus reset automatisch naar normaal.
4. **Annuleren** → druk `Escape` of klik opnieuw op dezelfde knop.

**Validatie**: generalisatie-edges worden alleen aangemaakt tussen nodes van hetzelfde metatype (ENT↔ENT of GE↔GE). Bij een ongeldige combinatie wordt de modus geannuleerd.

Zonder actieve edge-modus werkt de auto-detectie zoals voorheen:
- ENT → ENT = nieuwe collapsed REL-node
- ENT → GE = compositie-edge
- REL → ENT = tweede been (evt. ASOC-conversie)
- → enum/gegevenstype = dependency-edge

### Alt+drag (snelle GE-creatie)

Alt+drag (of Ctrl/Meta+drag) vanuit een source-handle van een entiteit naar leeg canvas maakt automatisch een nieuw gegevenselement + compositie-edge. Dit was voorheen Ctrl+drag, maar is gewijzigd naar Alt+drag omdat Ctrl gereserveerd is voor multi-selectie (`multiSelectionKeyCode="Control"`).

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
│       ├── Toolbar.jsx              ← Werkbalk: toevoegen, opslaan, laden, import, export
│       ├── NodeEditPanel.jsx        ← Sidebar: type en velden bewerken
│       └── EdgeEditPanel.jsx        ← Sidebar: relatie bewerken
├── export/
│   ├── exportMermaid.js             ← Editor → Mermaid class diagram
│   ├── exportPlantUML.js            ← Editor → PlantUML class diagram
│   └── exportXMI.js                 ← Editor → XMI 1.1 (incl. diagramposities)
├── import/
│   ├── _helpers.js                 ← Gedeeld: stereotype-aliassen + ASOC-promotie
│   ├── ruwuml.js                   ← RuwUML JSDoc-spec + orphan-detectie/-acties
│   ├── importXMI.js                ← XMI 1.1 → Editor (incl. EA diagramposities)
│   ├── importMermaid.js            ← Mermaid class diagram → Editor
│   └── importPlantUML.js           ← PlantUML class diagram → Editor
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

#### Klassenaam → typenaam afleiding bij GE/relatie

Bij het bewerken van een GE of relatie werkt de naam-synchronisatie als volgt:

- **Klassenaam** (korte naam, bijv. "Naam"): zichtbaar in "Naam (klassenaam)" veld
- **Typenaam** (volledig, bijv. "ApiStandaard_Naam"): prefix = parent-entiteit

Wanneer de gebruiker de klassenaam wijzigt:
1. Als typenaam al een waarde had die eindigt op de oude klassenaam → suffix wordt vervangen
2. Als typenaam **leeg** was → typenaam wordt automatisch afgeleid uit `parentEntiteit_klassenaam` (bijv. "ApiStandaard" + "_" + "Naam" → "ApiStandaard_Naam")

De V3 export (`editorNaarV3Model`) schrijft het `naam`-veld af uit de typenaam (prefix strippen), met fallback naar klassenaam als typenaam leeg mocht zijn.

Voor model-edges bewaart de V3 export ook editor-metadata voor stabiele round-trips: `id` voor edges `entiteit → gegevenselement` en `entiteit → relatie`, `doelId` voor de edge `relatie → doelentiteit`, plus de bestaande handle-velden. Bij import worden die ids hergebruikt als ze aanwezig zijn; oudere V3-bestanden zonder deze velden vallen automatisch terug op deterministische ids.

---

## Toekomstige mogelijkheden

- **MetaRegistry-generatie**: editor-output omzetten naar Go-code (MetaRegistry entries + struct definities)
- **Validatie**: controle op naamconventies, verplichte velden, referentiële integriteit
- **Undo/redo**: React Flow ondersteunt dit via een state-history wrapper
- ~~**XMI-export** voor import in Sparx Enterprise Architect of andere UML-tools~~ ✅ Gerealiseerd: export + import XMI 1.1 incl. EA diagramposities
- ~~**Integratie in de bitemporele frontend**: embedden als extra pagina naast de bestaande index/tijdlijn/registraties~~ ✅ Gerealiseerd (zie `UML_EDITOR_INTEGRATIE.md`)
