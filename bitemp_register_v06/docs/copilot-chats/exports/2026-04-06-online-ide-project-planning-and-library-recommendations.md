# Chat: Online IDE project planning and library recommendations

- **Datum**: 2026-04-06 17:26
- **Sessie-ID**: `67186035-66bd-441a-8433-3bd1d5b202fe`
- **Berichten**: 4

---

## 🧑 User

ik heb aan Gemini gevraagd hoe ik meer een online IDE kan maken voor dit project, even als vraag naar de mogelijkheden. Ik heb dezelfde vraag aan Claude gesteld en daar kwam een soortgelijk antwoord uit.

Zou je willen kijken naar beide vragen en antwoorden en daaruit een plan kunnen trekken voor dit project, met wat je weet van de inhoud, de achtergrond en het doel van dit project?

# Gemini: https://gemini.google.com/share/2b7cc20704bd

# Claude: 
## vraag
Is er een react -vite library waarin je een IDE / modelleer omgeving zou kunnen maken,  om een subset van UML class diagrams met enige uitbreiding daarop te kunnen maken? 

Ik zou de volgende dingen sowieso nodig hebben: 
- een project browser: een Windows Explorer-achtige view voor de elementen in het model, georded in mappen (packages of domeinen) 
- een diagram window, voor de klassen en relaties; meer dan 1 diagram moet tegelijk open kunnen staan
- een details window voor een formulier interface met properties van de elementen op het diagram of in de browser

Idealiter moeten de Windows te verplaatsen, de grootte instelbaar zijn en moeten ze te docken zijn. (Eclipse achtig)

## Antwoord:
Ja, zo'n stack is zeker te bouwen met React + Vite. Hier zijn de beste libraries per onderdeel:

---

## 🪟 Docking / Windowing (het moeilijkste stuk)

**`flexlayout-react`** — de beste keuze voor Eclipse-achtig gedrag
- Tabbladen, splits, dock, resize, alles erin
- Actief onderhouden, goed gedocumenteerd
- https://github.com/caplin/FlexLayout

Alternatief: **`rc-dock`** (iets lichter, ook solide)

---

## 📐 Diagram Canvas (UML klassen + relaties)

**`ReactFlow`** — verreweg de populairste optie
- Custom node types (perfect voor UML klassen met compartimenten)
- Edge types met labels, markers (pijlen, diamanten, etc.)
- Meerdere flows naast elkaar in aparte tabs mogelijk
- Grote community, veel voorbeelden
- https://reactflow.dev

Alternatief voor meer "klassieke" diagrammers: **`maxGraph`** (open-source opvolger van mxGraph / draw.io kern) — meer low-level maar krachtiger voor strikt UML.

---

## 🌳 Project Browser (pakket/mapstructuur)

**`react-arborist`** — beste virtuele tree met drag & drop, rename, etc.
- https://github.com/brimdata/react-arborist

Of **`@mui/x-tree-view`** als je toch MUI gebruikt.

---

## 📋 Properties / Details Panel

Gewone form libraries werken hier prima:
- **`react-hook-form`** voor formulierlogica
- **`@rjsf/core`** (React JSON Schema Form) als je properties dynamisch wil renderen op basis van het elementtype — ideaal voor een modelleertool

---

## Aanbevolen stack samengevat

| Onderdeel | Library |
|---|---|
| Docking layout | `flexlayout-react` |
| Diagram canvas | `ReactFlow` |
| Project tree | `react-arborist` |
| Properties form | `@rjsf/core` of `react-hook-form` |
| State management | `Zustand` (licht) of `Redux Toolkit` |
| Styling | `Tailwind CSS` of `MUI` |

---

## Belangrijke overwegingen

**ReactFlow + flexlayout-react** is de combinatie die ik zou aanraden. Je stopt elke open diagram in een eigen `FlexLayout` tab, en de browser en details panel zijn vaste panels in de layout. Gebruikers kunnen ze los trekken en herindelen.

Voor de UML-extensies (zoals stereotypes, tagged values, association classes) is ReactFlow flexibel genoeg om volledig custom node-componenten te bouwen — een UML klasse is gewoon een React component met drie compartimenten.

Wil je dat ik een schetsmatige projectstructuur of een starter-architectuur uitwerk?

---

## 🤖 Assistant

Let me gather context from the Gemini link and the current project state.  The Gemini link returned a 502 error. Let me also check the UML editor integration doc and the current model JSON to fully understand the context.  I couldn't fetch the Gemini page (502 error). Let me ask about that before proceeding. OK, ik wacht op de Gemini-tekst die je wilde plakken, zodat ik beide bronnen kan meenemen in het plan. Plak de Gemini-output wanneer je klaar bent.

---

## 🧑 User

gemini is in drie delen:

1


Dat is een ambitieus en gaaf project! Om een volledige IDE-ervaring (zoals Eclipse of VS Code) in React te bouwen, heb je eigenlijk een combinatie van drie verschillende soorten libraries nodig: een voor de **layout**, een voor de **diagrammen**, en een voor de **data/state**.

Hier is de beste stack om dit momenteel in React + Vite te realiseren:

---

## 1. De Layout Engine (Docking & Windows)
Voor het "Eclipse-gevoel" waarbij je vensters kunt slepen, docken en resizen, is er één absolute winnaar:

* **FlexLayout-React**
    * **Wat het is:** Een multi-tab docking window manager.
    * **Waarom:** Dit wordt gebruikt in professionele tools (zoals de IDE van Logic Pro of trading platforms). Het ondersteunt splitsen van schermen, tabbladen, en het "uit de boom slepen" van vensters. Je kunt hierin makkelijk je Project Browser (links), Diagram (midden) en Properties (rechts) configureren.

## 2. De Diagramming Core
Voor het tekenen van de UML-klassen en relaties heb je een krachtige canvas-library nodig. Je hebt twee sterke opties:

* **React Flow (SvelteFlow / Pro)**
    * **Voordeel:** Zeer modern, geweldige developer experience, en werkt perfect met React componenten als "nodes". Je kunt dus heel makkelijk een custom "UML Class" component maken met HTML/CSS.
    * **Nadeel:** Voor complexe UML-features (zoals specifieke nesting of geavanceerde auto-layout) moet je soms zelf wat rekenwerk doen.
* **JointJS / Rappid**
    * **Voordeel:** Dit is de industriestandaard voor diagrammen. Het heeft ingebouwde support voor UML-shapes en complexe poorten voor relaties.
    * **Nadeel:** Het is van origine een commerciële library (Rappid) en de leercurve is steiler dan die van React Flow.



---

## 3. Project Browser & Property Editor
Voor de zijbalken kun je vaak volstaan met gespecialiseerde UI-componenten:

* **Project Browser:** Gebruik **`react-arborist`**. Dit is de meest performante library voor "file explorer" achtige tree-structures. Het ondersteunt drag-and-drop (om klassen naar andere packages te verplaatsen) en virtuele rendering voor grote modellen.
* **Details Window:** Hier volstaat een standaard UI-kit zoals **Mantine** of **Ant Design**. Deze hebben krachtige "Form" componenten en "Property Grid" patronen.

---

## Aanbevolen Architectuur (De "Blueprint")

| Component | Library Advies |
| :--- | :--- |
| **Shell / Layout** | `flexlayout-react` |
| **Diagram Canvas** | `react-flow` (met custom nodes voor UML) |
| **Tree Navigation** | `react-arborist` |
| **State Management** | `Zustand` (voor het syncen tussen diagram en browser) |

### Waarom Zustand?
In een IDE-omgeving moet een naamswijziging in het **Details Window** direct zichtbaar zijn in zowel de **Project Browser** als het **Diagram**. Een lichtgewicht state-manager zoals `Zustand` is ideaal om deze drie losse vensters met elkaar te laten praten zonder dat je last krijgt van "prop drilling".

---

### Is er een alles-in-één oplossing?
Er is niet één library die "UML IDE" heet en alles kant-en-klaar aanbiedt, omdat de UI-eisen van een IDE vaak erg specifiek zijn. Echter, als je snel een prototype wilt maken, kijk dan naar **Eclipse Sprotty**. Dit is een framework specifiek voor diagram-gebaseerde IDE's in de browser, al is de integratie met React iets complexer dan de bovenstaande modulaire aanpak.

Zou je willen dat ik voor een van deze onderdelen (bijvoorbeeld de FlexLayout configuratie) een code-voorbeeld schets?

*(ja graag)*

*deel 2*

Hier is een compact voorbeeld van hoe je de "shell" van je IDE opzet met **FlexLayout-React**. Dit vormt het fundament: het regelt de vensters, het docken en het resizen.

In dit voorbeeld maken we een model met een **Project Browser** links, een **Diagram** in het midden en een **Properties** venster rechts.

### 1. De Basisconfiguratie (`App.tsx`)

```tsx
import React from "react";
import * as FlexLayout from "flexlayout-react";
import "flexlayout-react/style/light.css"; // Of dark.css voor die echte IDE look

// 1. Definieer de initiële layout van je vensters
const json: FlexLayout.IJsonModel = {
  global: { tabEnableFloat: true },
  borders: [],
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "tabset",
        weight: 20,
        children: [{ type: "tab", name: "Project Browser", component: "browser" }]
      },
      {
        type: "tabset",
        weight: 60,
        children: [{ type: "tab", name: "Class Diagram 1", component: "diagram" }]
      },
      {
        type: "tabset",
        weight: 20,
        children: [{ type: "tab", name: "Properties", component: "properties" }]
      }
    ]
  }
};

const model = FlexLayout.Model.fromJson(json);

const App = () => {
  // 2. De 'factory' bepaalt welk component er in welk venster komt
  const factory = (node: FlexLayout.TabNode) => {
    const component = node.getComponent();

    if (component === "browser") {
      return <div className="panel">Hier komt je React-Arborist Tree</div>;
    }
    if (component === "diagram") {
      return <div className="panel">Hier komt je React Flow Canvas</div>;
    }
    if (component === "properties") {
      return <div className="panel">Formulier met element properties</div>;
    }
  };

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw" }}>
      <FlexLayout.Layout model={model} factory={factory} />
    </div>
  );
};

export default App;
```

---

### Waarom dit werkt voor jouw use-case:

* **Multi-diagram support:** In de `factory` kun je checken op de naam of een ID van de tab. Gebruikers kunnen via een knop in de browser een nieuwe tab toevoegen aan het `model`, waardoor je meerdere diagrammen naast of over elkaar open kunt hebben.
* **Docking:** Je kunt de "Properties" tab oppakken en onder de "Project Browser" slepen. De library berekent automatisch de nieuwe verhoudingen.
* **Persistentie:** Je kunt `model.toJson()` aanroepen en de layout opslaan in `localStorage`. Als de gebruiker de browser ververst, staat zijn IDE precies zo ingesteld als hij het achterliet.



### Volgende stap: De inhoud van de vensters
Nu de "schil" staat, moet je de inhoud gaan vullen. Welk onderdeel is voor jouw subset van UML het meest cruciaal om nu naar te kijken?

1.  **Het Diagram:** Hoe je met **React Flow** klassen tekent met "compartimenten" (voor attributen en methoden).
2.  **De Project Browser:** Hoe je met **React Arborist** een mappenstructuur maakt die synchroon blijft met je diagrammen.

(mijn antwoord)
2. Ik heb domeinen met eventueel subdomeinen. Dat komt overeen met packages in UML.
Daarin zitten de elementen (klassen met attributen, relaties, typen, enums, referentielijsten), en diagrammen.
Diagrammen kunnen elementen bevatten uit andere packages. Zoals software een package kan importeren, ontstaat daar een afhankelijkheid.
Ik denk er aan om de file representaties van elementen en diagrammen ook op te nemen in de browser. Dat zijn jsons, XMI files, wellicht ook csv's, voor import en export en initiële vulling van data. Mogelijk ook test-sets.
Verplaatsen, kopiëren, plakken, verwijderen en navigeren (en openen, sluiten) ook met toetsen zou fijn zijn.

*antwoord deel 3*

Dit is een klassiek "Repository" vraagstuk. Omdat je elementen (zoals een klasse) in meerdere diagrammen kunt gebruiken, en diagrammen elementen uit andere packages kunnen bevatten, is het essentieel om je **data** los te koppelen van je **weergave**.

Hier is hoe je dit aanpakt met de voorgestelde stack:

---

## 1. De Data Structuur (The Source of Truth)
Je hebt een "plat" object nodig voor je elementen (voor snelle opzoekacties via ID) en een "boomstructuur" voor je browser.

```typescript
// Voorbeeld van hoe je state in Zustand eruit ziet
interface ProjectState {
  // De 'flat' repository van alle definities
  elements: Record<string, UMLElement>; 
  
  // De hiërarchie voor de Project Browser
  treeData: TreeNode[]; 
  
  // Acties
  moveNode: (sourceId: string, targetId: string) => void;
  openDiagram: (diagramId: string) => void;
}
```

### De Browser Node Typen
In `react-arborist` geef je elke node een `type`. Dit is cruciaal voor de icoontjes en de acties die je mag uitvoeren:
* `package`: Kan andere packages, klassen of diagrammen bevatten.
* `class`: Bevat attributen (vaak alleen zichtbaar in details of diagram, niet in de boom).
* `diagram`: Een view-definitie die verwijst naar `elementIds`.
* `file`: (JSON/XMI/CSV) Voor ruwe data of import/export.



---

## 2. Implementatie met React-Arborist
`react-arborist` is perfect voor jouw eisen wat betreft toetsenbordnavigatie en drag-and-drop.

```tsx
import { Tree } from "react-arborist";

const ProjectBrowser = () => {
  return (
    <Tree
      initialData={treeData}
      openByDefault={false}
      width={300}
      height={800}
      indent={20}
      rowHeight={32}
      // Toetsenbord interacties & manipulatie
      onDelete={({ ids }) => deleteElements(ids)}
      onMove={({ dragIds, parentId, index }) => handleMove(dragIds, parentId, index)}
      onRename={({ id, name }) => renameElement(id, name)}
    >
      {({ node, style, dragHandle }) => (
        <div style={style} ref={dragHandle} onDoubleClick={() => openTab(node)}>
          <NodeIcon type={node.data.type} />
          <span>{node.data.name}</span>
        </div>
      )}
    </Tree>
  );
};
```

### Toetsenbord & Acties
* **Navigatie:** De pijltjestoetsen werken standaard (omhoog/omlaag, links/rechts om mappen te openen).
* **Openen:** Je kunt een `onKeyDown` listener toevoegen. Als `Enter` wordt gedrukt op een 'diagram' node, roep je de FlexLayout API aan om een nieuwe tab te openen.
* **Copy/Paste:** Dit moet je in je state (Zustand) regelen. Sla de "gekopieerde" ID's op in een `clipboard` variabele in je store.

---

## 3. Het "Cross-Package" probleem
Omdat een diagram elementen uit andere packages kan bevatten, is de browser in feite een **organizer van definities**, terwijl het diagram een **visualisatie van referenties** is.

1.  **Browser:** Toont waar de "bron" van een klasse staat (bijv. in `Domain A`).
2.  **Diagram:** Als je een klasse uit `Domain A` naar een diagram in `Domain B` sleept, kopieer je de klasse niet, maar voeg je het `elementId` toe aan de `nodes` lijst van dat diagram.
3.  **Afhankelijkheden:** Je kunt in je model-logica een check inbouwen: *"Als Diagram B een klasse uit Package A bevat, teken dan een package-import relatie in de browser of een apart dependency view."*

---

## 4. Bestandsondersteuning (XMI / JSON)
Voor de JSON/XMI files in je browser kun je een speciale `file` handler maken:
* **Dubbelklik op .json:** Opent een tekst-editor tab (bijv. met **Monaco Editor**, de engine achter VS Code) in plaats van een diagram window.
* **Import/Export:** Je kunt een "Virtual File System" benadering gebruiken waarbij je bestanden in de browser simpelweg mapping-functies zijn die de interne Zustand-state omzetten naar XML/CSV en vice versa.

### Waarom dit voor jou werkt:
Met de combinatie van **FlexLayout** (voor de tabs) en **React-Arborist** (voor de boom) bouw je exact de workflow die je beschrijft. De browser is je "bron van waarheid", en de diagrammen zijn vensters op die data.

Wil je dat ik dieper inga op hoe je een "Klasse" vanuit de browser naar een "Diagram" sleept (de integratie tussen de tree en het canvas)?

(antwoord 4)

Het slepen van een element uit de boomstructuur naar een diagram is een cruciaal "Magic Moment" in een IDE. Omdat **React Arborist** (de boom) en **React Flow** (het diagram) verschillende libraries zijn, gebruik je de standaard **HTML5 Drag and Drop API** als brug.

Hier is het stappenplan en de code om dit te realiseren:

### 1. De "Bron": De Tree Node (`ProjectBrowser.tsx`)
Je moet de node in de boom "draggable" maken en data meegeven (zoals het ID van de klasse) via het `dataTransfer` object.

```tsx
const IconNode = ({ node, style, dragHandle }: any) => {
  const onDragStart = (event: React.DragEvent) => {
    // We geven het ID en het type door aan het 'sleep-event'
    event.dataTransfer.setData("application/reactflow", JSON.stringify({
      elementId: node.data.id,
      type: node.data.type, // bijv. 'class'
      name: node.data.name
    }));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div 
      style={style} 
      ref={dragHandle} 
      draggable 
      onDragStart={onDragStart}
    >
      <span>{node.data.type === 'package' ? '📁' : '📄'} {node.data.name}</span>
    </div>
  );
};
```

### 2. Het "Doel": Het Diagram (`DiagramCanvas.tsx`)
In het diagram-venster vang je de drop op. Je moet de muispositie omrekenen naar de coördinaten van het canvas.

```tsx
import ReactFlow, { useReactFlow, ReactFlowProvider } from 'reactflow';

const DiagramCanvas = () => {
  const reactFlowWrapper = React.useRef(null);
  const { screenToFlowPosition, setNodes } = useReactFlow();

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();

    const data = JSON.parse(event.dataTransfer.getData('application/reactflow'));

    // Alleen klassen mogen op het diagram gedropt worden
    if (data.type !== 'class') return;

    // Bereken de exacte positie op het canvas
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    // Voeg een nieuwe 'node' toe aan het diagram die refereert naar het elementId
    const newNode = {
      id: `node_${Date.now()}`,
      type: 'umlClass', // Je eigen custom UML component
      position,
      data: { 
        label: data.name, 
        elementId: data.elementId // De link naar de bron-data!
      },
    };

    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div ref={reactFlowWrapper} style={{ height: '100%' }}>
      <ReactFlow
        onDrop={onDrop}
        onDragOver={onDragOver}
        // ... overige props
      />
    </div>
  );
};
```



### 3. De Koppeling: Element vs. Node
Dit is het belangrijkste concept voor jouw UML-omgeving:

* **Het Element (in de Repository):** Bevat de "echte" data (lijst met attributen, methoden, types). Dit leeft in je Zustand store.
* **De Node (op het Diagram):** Is slechts een visualisatie. Deze bevat alleen een positie (`x, y`) en een verwijzing naar het `elementId`.

**Waarom dit essentieel is:**
Als de gebruiker in de **Project Browser** de naam van de klasse verandert van `Klant` naar `Gebruiker`, hoef je alleen de centrale store te updaten. Omdat alle diagrammen en de browser naar hetzelfde `elementId` kijken, verandert de naam overal tegelijkertijd mee ("Single Source of Truth").

### 4. Afhankelijkheden en Packages
Omdat je aangaf dat diagrammen elementen uit andere packages kunnen bevatten, kun je nu logica toevoegen:

* **Validatie:** Bij de `onDrop` kun je checken: *"Komt deze klasse uit een ander domein?"*. Zo ja, dan kun je automatisch een visuele indicator (bijv. een kleur of een kleine package-naam boven de klasse) toevoegen aan de node op het canvas.
* **Toetsenbord-navigatie:** Omdat je in React Flow zit, kun je met `onNodeClick` direct de **Properties** tab in FlexLayout focussen en het bijbehorende formulier laden voor dat specifieke `elementId`.

Zou je willen zien hoe zo'n **Custom UML Node** in React Flow eruit ziet (met vakjes voor attributen en methoden)?

(antoowrd 5)
Een custom node in React Flow is simpelweg een React-component. Voor een UML-klasse wil je de typische "stapel" van vakken (compartimenten) nabootsen: één voor de naam, één voor attributen en één voor operaties.

Hier is hoe je een functionele en herbruikbare **UML Class Node** bouwt:

### 1. De Custom Node Component (`UmlClassNode.tsx`)

In dit component gebruiken we de `Handle` componenten van React Flow om te bepalen waar relaties (zoals associaties of overerving) kunnen aankoppelen.

```tsx
import React from 'react';
import { Handle, Position } from 'reactflow';

// Tip: Gebruik een UI-kit zoals Tailwind voor de styling, of gewoon CSS
const UmlClassNode = ({ data }: any) => {
  return (
    <div className="uml-node-container">
      {/* 1. Header: De Klassenaam */}
      <div className="uml-header">
        <strong>{data.label}</strong>
      </div>

      {/* 2. Compartiment: Attributen */}
      <div className="uml-compartment">
        {data.attributes?.map((attr: any, i: number) => (
          <div key={i} className="uml-item">
            {attr.visibility} {attr.name}: {attr.type}
          </div>
        ))}
      </div>

      {/* 3. Compartiment: Methoden */}
      <div className="uml-compartment">
        {data.methods?.map((method: any, i: number) => (
          <div key={i} className="uml-item">
            {method.visibility} {method.name}(): {method.returnType}
          </div>
        ))}
      </div>

      {/* Connection points aan alle zijden */}
      <Handle type="source" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
};

export default UmlClassNode;
```



### 2. De Styling (CSS)
Om die strakke UML-look te krijgen, voeg je wat CSS toe. Het geheim zit hem in de `border-bottom` tussen de vakken.

```css
.uml-node-container {
  background: #fffbe6; /* Klassiek geel/wit UML kleurtje */
  border: 2px solid #333;
  border-radius: 2px;
  min-width: 150px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 12px;
}

.uml-header {
  padding: 8px;
  text-align: center;
  border-bottom: 1px solid #333;
}

.uml-compartment {
  padding: 5px;
  min-height: 20px;
}

.uml-compartment:not(:last-child) {
  border-bottom: 1px solid #333;
}

.uml-item {
  padding: 2px 4px;
  white-space: nowrap;
}
```

---

### 3. Registratie in je Diagram
Je moet React Flow vertellen dat de string `"umlClass"` bij dit nieuwe component hoort.

```tsx
const nodeTypes = {
  umlClass: UmlClassNode,
};

// In je Diagram component:
<ReactFlow 
  nodes={nodes} 
  nodeTypes={nodeTypes} 
  // ... rest van je props
/>
```

### Waarom dit krachtig is voor jouw IDE:

1.  **Dynamische Updates:** Omdat de `data` prop van de node verbonden is met je centrale store (Zustand), zal de klasse op het diagram direct "meegroeien" of veranderen als je in de **Details Window** een attribuut toevoegt of de naam wijzigt.
2.  **Referenties:** In plaats van de hele lijst met attributen in de `nodes`-state van React Flow op te slaan, kun je in de `data` van de node alleen het `elementId` opslaan. De node-component haalt dan zelf de actuele lijst met attributen op uit de globale repository. Dit voorkomt dat je diagram-state enorm zwaar wordt.
3.  **Relaties (Edges):** Je kunt vergelijkbare custom logic maken voor de lijnen (Edges). Een "Generalisatie" (inheritance) krijgt dan een open pijlpunt, terwijl een "Compositie" een ruitje krijgt.

### Hoe zie je de interactie voor je?
Als je nu op zo'n klasse klikt, zou de **Details Window** (het rechterpaneel in FlexLayout) moeten verspringen naar de editor voor die specifieke klasse. 

Wil je dat ik een voorbeeld geef van hoe je die **Properties Form** opzet zodat hij reageert op de selectie in het diagram?

(6)
Dit is waar de "lijm" van je applicatie echt tot leven komt. Om dit soepel te laten werken, gebruiken we de **Zustand store** als een soort zenuwstelsel. Wanneer je op een klasse klikt in het diagram (of in de browser), laat de store aan het Details Window weten: *"Hé, dit element is nu de baas, laat zijn eigenschappen zien."*

Hier is het ontwerp voor deze interactie:

---

## 1. De "Zenuwcentrale" (Zustand Store)

We breiden de store uit met een `selectedId` en een functie om data te updaten.

```typescript
import { create } from 'zustand';

interface ProjectStore {
  elements: Record<string, any>;
  selectedId: string | null;
  
  // Acties
  setSelectedId: (id: string | null) => void;
  updateElement: (id: string, newData: any) => void;
}

export const useStore = create<ProjectStore>((set) => ({
  elements: {
    'class_1': { id: 'class_1', name: 'Klant', attributes: [], type: 'class' },
  },
  selectedId: null,

  setSelectedId: (id) => set({ selectedId: id }),
  
  updateElement: (id, newData) => set((state) => ({
    elements: {
      ...state.elements,
      [id]: { ...state.elements[id], ...newData }
    }
  })),
}));
```

---

## 2. De Selectie-trigger in het Diagram

In je diagram-venster zorg je ervoor dat een klik de `selectedId` bijwerkt.

```tsx
import { useStore } from './store';

const DiagramCanvas = () => {
  const setSelectedId = useStore(state => state.setSelectedId);

  const onSelectionChange = (params: { nodes: any[] }) => {
    // Pak het elementId van de geselecteerde node
    const selectedNode = params.nodes[0];
    setSelectedId(selectedNode ? selectedNode.data.elementId : null);
  };

  return (
    <ReactFlow 
      onSelectionChange={onSelectionChange}
      // ... andere props
    />
  );
};
```

---

## 3. Het Details Window (Property Editor)

Dit component luistert naar de `selectedId` en rendert een formulier. Wanneer je typt, update de store de "Source of Truth", en omdat je Diagram-nodes daar ook naar kijken, zie je de naam op het diagram **live** veranderen terwijl je typt.

```tsx
const PropertiesPanel = () => {
  const { selectedId, elements, updateElement } = useStore();
  
  // Zoek het actieve element op
  const element = selectedId ? elements[selectedId] : null;

  if (!element) {
    return <div style={{ padding: 20 }}>Selecteer een element om eigenschappen te bewerken.</div>;
  }

  return (
    <div style={{ padding: 15 }}>
      <h3>Eigenschappen: {element.type}</h3>
      
      <label>Naam:</label>
      <input 
        value={element.name} 
        onChange={(e) => updateElement(selectedId!, { name: e.target.value })}
        style={{ width: '100%', marginBottom: 10, display: 'block' }}
      />

      <label>Attributen:</label>
      {/* Hier kun je een lijst met inputs maken voor je UML attributen */}
      <button onClick={() => {/* Logica voor nieuw attribuut */}}>
        + Attribuut toevoegen
      </button>

      <hr />
      <div style={{ fontSize: '10px', color: '#666' }}>
        ID: {element.id}
      </div>
    </div>
  );
};
```

---

## Hoe dit alles samenkomt in de IDE:

1.  **Selectie:** Je klikt op een klasse in het diagram. React Flow vuurt `onSelectionChange` af.
2.  **State Update:** De `selectedId` in de Zustand store wordt bijgewerkt naar bijv. `'class_1'`.
3.  **UI Reactie:** * Het **Details Window** ziet dat de ID niet meer `null` is en tekent het formulier voor 'Klant'.
    * De **Project Browser** kan de geselecteerde node ook highlighten (door ook naar `selectedId` te kijken).
4.  **Bewerken:** Je verandert de naam in het tekstvak naar 'Gebruiker'.
5.  **Live Sync:** De store wordt geüpdatet. Omdat je `UmlClassNode` (op het diagram) de data uit diezelfde store haalt, verandert het label op je canvas onmiddellijk mee.

### Geavanceerde Tip: "Docking" Context
Omdat je **FlexLayout** gebruikt, kun je zelfs instellen dat wanneer je op een element in de browser dubbelklikt, de IDE niet alleen de selectie aanpast, maar ook automatisch de tab met het juiste diagram op de voorgrond zet (via de `model.doAction` van FlexLayout).

Zijn er specifieke UML-uitbreidingen (zoals custom metadata of speciale relaties) waar je al over nadenkt en die dit formulier complexer maken?

(mijn antwoord)
Ja, die zijn er.



Ik gebruik afgeleide velden, waarin expressies kunnen zitten. (Bijv. CEL)

Dit heb ik op zich al gemaakt in mijn project in react, maar dat is enkel gebaseerd op Flow (https://github.com/MarkWestbroek/Bitemporal_2026/tree/main/bitemp_register_v06%2Fuml-editor).
Verder heb ik een heel aantal custom properties die ik gebruik voor het genereren van een API en een bitemporele database, waarvoor dingen als het meervoud van de klassenaan en wat andere dingen nodig zijn.
Ook is mijn kardinaliteit complexer dan enkel 1..* e.d. vanwege de bitemporaliteit. Dat geeft ook overal materieel en formeel stereotypen.
Verder maak ik onderscheid tussen 2 soorten van klassen (naast enums en referentielijst-items), waar ik visueel ook onderscheid tussen wil kunnen maken.
Ook associatieklassen komen voor.

(7)
Dat maakt het project een stuk serieuzer! Je gaat nu van een "tekening" naar een **Model-Driven Development (MDD)** tool. Omdat je al ervaring hebt met React Flow, is de overstap naar een volledige IDE-structuur met `FlexLayout` en `Zustand` de logische volgende stap om de complexiteit beheersbaar te houden.

Hier is hoe we je specifieke uitbreidingen technisch vertalen naar die IDE-omgeving:

---

## 1. Visueel onderscheid & Stereotypen
Voor de twee soorten klassen (bijv. *Bitemporeel* vs. *Regulier*) en de enums/referentielijsten, gebruik je in React Flow verschillende `nodeTypes`.

* **Stereotypen:** In je `UmlClassNode` voeg je boven de naam een sectie toe: `<div className="stereotype">«{data.stereotype}»</div>`. 
* **Visuele cues:** Gebruik verschillende randkleuren of subtiele achtergrondpatronen. Een "Referentielijst" krijgt bijvoorbeeld een blauwe header, terwijl een "Bitemporele Klasse" een dubbele rand of een specifiek icoon krijgt.



---

## 2. Associatieklassen: De "Heilige Graal" in Diagrammen
React Flow verbindt nodes met lijnen (edges). Een associatieklasse is echter een **node verbonden aan een lijn**. Dit is lastig, maar er zijn twee beproefde methoden:

1.  **De "Invisible Node" Methode:** Je plaatst een onzichtbare, piepkleine node precies in het midden van de lijn tussen Klasse A en Klasse B. De Associatieklasse-node verbind je vervolgens met een stippellijn aan die onzichtbare node.
2.  **De "Edge Renderer" Methode:** Je gebruikt een `CustomEdge`. In de code van die edge bereken je het middelpunt (`edgeCenterX`, `edgeCenterY`) en daar teken je een klein aankoppelingspunt waar de associatieklasse aan snapt.

---

## 3. Complexe Kardinaliteit & Bitemporaliteit
Omdat je kardinaliteit materieel en formeel onderscheidt, heb je meer nodig dan een simpel tekstveldje aan de uiteinden van een lijn.

* **Custom Edges:** Maak een `BitemporalEdge` component. In plaats van één label, geef je deze edge-secties voor de "Source" en "Target".
* **Edge Labels:** Je kunt binnen de edge meerdere `EdgeLabelRenderer` componenten gebruiken om zowel de kardinaliteit als de stereotypen (`«material»`, `«formal»`) op de juiste plek langs de lijn te positioneren.

---

## 4. De Details Window: Metadata & Expressies (CEL)
Dit is waar je de meeste winst boekt met de IDE-opzet. Je Details-window wordt een dynamisch formulier dat wisselt op basis van wat je selecteert.

### Voor Afgeleide Velden (CEL):
In plaats van een saai tekstveld, kun je in je Properties-panel de **Monaco Editor** (van VS Code) of **CodeMirror** embedden voor die specifieke velden.
* **Syntax Highlighting:** Je kunt een simpele linter schrijven voor je CEL-expressies.
* **Validation:** Terwijl de gebruiker typt, checkt de IDE of de gebruikte attributen wel bestaan in het model.

### Voor API/Database Generatie:
Voeg een tabblad "Generatie" toe aan je Properties-panel. Hierin zet je velden zoals:
* `Table Name` (default: meervoud van klassenaam)
* `API Endpoint`
* `Bitemporal Logic` (bijv. "History retention period")

---

## 5. De "Source of Truth" Architectuur
Omdat je data gebruikt voor generatie (API/DB), moet je JSON-structuur extreem zuiver zijn. 

**Mijn advies voor je Zustand store:**
Spoor de "Visual State" (waar staat de node op het diagram?) en de "Domain State" (wat is het meervoud van de naam?) strikt gescheiden op.

```json
{
  "domainModel": {
    "classes": {
      "c1": { "name": "Klant", "plural": "Klanten", "isBitemporal": true, "attributes": [...] }
    }
  },
  "diagrams": {
    "d1": {
      "nodes": [ { "id": "n1", "elementId": "c1", "position": { "x": 100, "y": 100 } } ],
      "edges": [ ... ]
    }
  }
}
```

---

## Volgende stap: Hoe ga je dit schalen?
Je hebt nu een repository-structuur nodig die packages (domeinen) begrijpt. Als je een element in de browser versleept van `Domein A` naar `Domein B`, moeten de diagrammen die dit element gebruiken dit "weten".

Zal ik een voorbeeld geven van hoe je in de `FlexLayout` factory een switch maakt tussen een **Diagram View** en een **Raw Data View** (bijv. de JSON/XMI weergave van een domein)? Dit helpt enorm bij het debuggen van je generatie-logica.

(Ja, maar hier snap ik het niet zo goed meer. Kun je mij eerst uitleggen wat die Factory is en doet? En dan de rest?)

Geen zorgen, de overstap van een "enkele pagina" naar een "IDE-architectuur" is ook even schakelen. Laten we bij de basis beginnen.

---

## Wat is de "Factory" in FlexLayout?

Stel je voor: **FlexLayout** is de aannemer van je kantoorpand. Hij regelt de muren, de ramen en de deuren (de tabs, de split-screens en de resize-handles). Maar de aannemer weet niet wat er in die kamers moet gebeuren. 

De **Factory** is de persoon die de kamers inricht. 

In code is de Factory simpelweg een **functie** die door FlexLayout wordt aangeroepen voor elke tab die getoond moet worden. FlexLayout zegt: *"Ik heb hier een tabblad met de naam 'Klant-Diagram', wat moet ik hierbinnen renderen?"* De Factory kijkt naar de gegevens van dat tabblad en geeft het juiste React-component terug.

### Hoe ziet dat eruit?

In je layout-configuratie (het JSON-model) geef je elke tab een `component` naam mee. De factory gebruikt die naam om te beslissen:

```tsx
const factory = (node: FlexLayout.TabNode) => {
  // 1. Pak de naam van het component dat in de JSON staat
  const componentName = node.getComponent(); 
  
  // 2. Pak eventuele extra data (zoals welk specifiek bestand/ID geopend is)
  const config = node.getConfig(); 

  // 3. De "Beslismachine"
  switch (componentName) {
    case "diagram":
      return <UmlDiagramCanvas diagramId={config.id} />;
    case "json-view":
      return <RawDataEditor elementId={config.id} />;
    case "browser":
      return <ProjectBrowser />;
    case "properties":
      return <PropertiesPanel />;
    default:
      return <div>Onbekend venster</div>;
  }
};
```

---

## Waarom is dit handig voor jouw "Raw Data View"?

Omdat je werkt met complexe metadata (CEL-expressies, bitemporele regels, API-generatie), wil je soms "onder de motorkap" kijken. In een echte IDE kun je vaak switchen tussen de **Designer** (het diagram) en de **Code** (de JSON/XMI).

Dankzij de Factory kun je dit heel makkelijk doen:

1.  **Meerdere views op dezelfde data:** Je kunt twee tabs naast elkaar openen. De linker tab vertelt de Factory: *"Ik ben een `diagram` voor Domein A"*. De rechter tab vertelt de Factory: *"Ik ben een `json-view` voor Domein A"*.
2.  **Live synchronisatie:** Omdat beide componenten in de Factory naar dezelfde **Zustand store** kijken, zie je de JSON rechts letterlijk veranderen terwijl je links in het diagram een klasse versleept of een attribuut toevoegt.



---

## Hoe werkt "de rest" dan samen?

Als we alles bij elkaar optellen, krijg je deze stroom:

1.  **De Project Browser:** Hier dubbelklik je op een Domein of Klasse.
2.  **De Actie:** Een functie in je app zegt tegen FlexLayout: `model.addTabWithContext(...)`. Hierin geef je aan: `component: "diagram"` en `id: "domein_1"`.
3.  **De Factory:** FlexLayout roept direct jouw Factory-functie aan. De Factory ziet `"diagram"` en rendert je **React Flow** canvas met de data van `"domein_1"`.
4.  **Het Diagram:** In dit canvas gebruik je de **Custom UML Nodes** die we eerder bespraken. Omdat je bitemporele klassen hebt, checkt de node in de store: *"Ben ik bitemporeel?"*. Zo ja, dan tekent hij die extra visuele kenmerken en stereotypen.
5.  **De Details Window:** Klik je op een node? Dan wordt de `selectedId` in de store bijgewerkt. Het Properties-venster (dat ook door de Factory is gemaakt) reageert daarop en toont de formulieren voor jouw specifieke kardinaliteiten en CEL-expressies.

### Samenvattend:
De **Factory** is de spil die ervoor zorgt dat je applicatie modulair blijft. Je hoeft niet één reusachtig bestand te maken; elk onderdeel (Browser, Diagram, Editor, Properties) is een los component dat de Factory op de juiste plek in de layout zet.

Is het concept van de Factory hiermee wat duidelijker geworden, of zal ik een specifiek onderdeel van de gegevensstroom verder uitdiepen?

(Is de state van Zustand ook te persisteren? Lokaal voor de gebruiker of centraal via een api in de database (die API voor het model / register heb ik toch al vanwege die generatie component.



Alleen zal het formaat in Zustand anders zijn / worden dan nu.)

Ja, dat is zeker mogelijk en voor een IDE zelfs essentieel. Omdat je een "Single Source of Truth" hebt in Zustand, kun je dit op twee niveaus regelen: lokaal (voor de snelheid en 'crash recovery') en centraal (voor de persistentie van je model).

Hier is hoe je dat aanpakt:

### 1. Lokaal persisteren (Zustand Persist Middleware)
Zustand heeft een ingebouwde "middleware" genaamd `persist`. Hiermee wordt de volledige state (of een deel ervan) automatisch opgeslagen in bijvoorbeeld `localStorage`. Zodra de gebruiker de pagina ververst, is de state er direct weer.

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      elements: {},
      // ... rest van je state
    }),
    {
      name: 'uml-ide-storage', // unieke naam voor localStorage
      storage: createJSONStorage(() => localStorage),
      // Optioneel: alleen bepaalde velden opslaan (bijv. wel het model, niet de UI-focus)
      partialize: (state) => ({ elements: state.elements }), 
    }
  )
);
```

### 2. Centraal persisteren (API / Database)
Voor je register/database wil je waarschijnlijk niet elke muisklik doorsturen, maar wel op gezette tijden het model opslaan.

Omdat je aangaf dat het formaat in Zustand anders is dan wat je API verwacht, werk je hier met een **Adapter-patroon**. Dit is een laagje code dat jouw "UI-vriendelijke" Zustand-state vertaalt naar "API-vriendelijke" JSON/XMI.



**Hoe je dit implementeert:**
Je kunt een "save" functie in je store maken die de data transformeert en verstuurt.

```typescript
const useStore = create((set, get) => ({
  elements: {},
  
  saveToDatabase: async () => {
    const currentState = get().elements;
    
    // Stap 1: Transformeren (Format aanpassen naar API-standaard)
    const apiData = transformToApiFormat(currentState); 
    
    // Stap 2: API call
    try {
      await fetch('/api/v1/model/save', {
        method: 'POST',
        body: JSON.stringify(apiData)
      });
      console.log("Model opgeslagen!");
    } catch (err) {
      console.error("Opslaan mislukt", err);
    }
  }
}));
```

### 3. "Auto-save" met Debouncing
In een IDE wil je vaak dat wijzigingen automatisch worden opgeslagen zonder dat de gebruiker op een knop drukt, maar je wilt je API niet platleggen met 60 verzoeken per seconde terwijl iemand een klasse versleept.

Je kunt hiervoor een `subscribe` gebruiken in Zustand in combinatie met een **debounce** (bijvoorbeeld 2 seconden wachten na de laatste wijziging):

```typescript
import debounce from 'lodash/debounce';

// Luister naar alle veranderingen in de store
const autoSave = debounce((state) => {
  // Roep hier je saveToDatabase functie aan
  console.log("Auto-saving naar API...", state.elements);
}, 2000);

useStore.subscribe((state) => {
  autoSave(state);
});
```

### Waarom het formaatverschil geen probleem is
Het is zelfs *goed* dat het formaat in Zustand verschilt van je API. 
* **Zustand (UI format):** Geoptimaliseerd voor snelle opzoekacties (bijv. een plat object met IDs als keys) en React Flow (nodes met x,y coördinaten).
* **API (Storage format):** Geoptimaliseerd voor bitemporaliteit, relaties en generatie-logica.

Door een `transformToApiFormat` en een `transformFromApiFormat` (voor het inladen) functie te schrijven, ontkoppel je de "werkkamer" (de IDE) van het "archief" (de database).

### Samenvattend voor jouw architectuur:
1.  **Zustand + Persist middleware:** Voor de lokale "werk-state" (zodat een refresh geen dataverlies geeft).
2.  **Adapter functies:** Om de UI-data om te zetten naar jouw bitemporele API-formaat.
3.  **Debounced API calls:** Voor het automatisch synchroniseren met je centrale register.

Zou je willen dat ik meedenk over hoe zo'n transformatie-functie (Adapter) eruit zou kunnen zien voor jouw bitemporele klassen?

---

## 🤖 Assistant

Uitstekend, nu heb ik beide bronnen. Laat me de bestaande codebase confronteren met de voorgestelde stack om een realistisch plan te maken.  Now I have a complete picture. Let me draft the plan. ## Plan: Online IDE voor Metamodel-ontwerp (v06)

### TL;DR
Bouw een Eclipse-achtige IDE-shell rondom de bestaande UML editor, met dockbare vensters (`flexlayout-react`), een project browser tree (`react-arborist`), multi-diagram tabs, en gecentraliseerd state management (`Zustand`). De bestaande React Flow componenten (nodes, edges, panels) worden hergebruikt. Persistentie via de bestaande V3 model API + lokale auto-save.

Zowel Gemini als Claude komen op dezelfde stack uit. Het project heeft al het zwaarste stuk (React Flow met custom UML nodes, V3 model format, schema-API) — wat ontbreekt is de IDE-*shell* eromheen.

```
┌────────────────────────────────────────────────────────────────┐
│  FlexLayout Shell  (flexlayout-react)                          │
├──────────┬─────────────────────────────┬───────────────────────┤
│ Project  │  Diagram Tabs               │  Details Panel        │
│ Browser  │  ┌─────────┬──────────┐     │  NodeEditPanel /      │
│ (react-  │  │ Diag. 1 │ Diag. 2  │    │  EdgeEditPanel /      │
│ arborist)│  ├─────────┴──────────┤     │  JSON view            │
│          │  │ React Flow Canvas  │     │                       │
│ Domeinen │  │ (bestaande nodes)  │     │                       │
│ ├ Elem.  │  │                    │     │                       │
│ ├ Diag.  │  └────────────────────┘     │                       │
│ └ Files  │                             │                       │
└──────────┴─────────────────────────────┴───────────────────────┘
│  Zustand Store (domainModel + diagrams + ui)                   │
└────────────────────────────────────────────────────────────────┘
```

---

### Fase 1: Fundament — Zustand Store + FlexLayout Shell

**Stap 1.1: Zustand store** (kan parallel met 1.2)
- Drie slices: **domainModel** (elements flat Record, domains, enums, datatypes), **diagrams** (Record per diagram met nodes/edges/posities), **ui** (selectedId, clipboard, undo/redo)
- Adapter-functies `v3ModelNaarStore()` en `storeNaarV3Model()` — refactor van bestaande `v3ModelNaarEditor.js`

**Stap 1.2: FlexLayout shell** (kan parallel met 1.1)
- Nieuw entry point `ide.html` + `IdePage.jsx` — bestaande editor pages blijven werken
- Factory-functie: `"browser"` / `"diagram"` / `"properties"` / `"json-view"`
- Initieel: browser 20% links, diagram 60% midden, properties 20% rechts
- Layout opslaan in localStorage

**Stap 1.3: MetamodelEditor refactoren** *(hangt af van 1.1)*
- 14 stukken lokale state → Zustand store
- MetamodelEditor wordt een "canvas-only" component
- NodeEditPanel/EdgeEditPanel lezen/schrijven via store i.p.v. callback props

---

### Fase 2: Project Browser

**Stap 2.1: react-arborist tree** *(na Fase 1)*
```
📁 register (domein)
│  📄 NLPostcode (datatype)
│  📄 BSN (datatype)
📁 np-loc (domein)
│  📦 NatuurlijkPersoon (entiteit)
│  │  📎 NP_Naam (GE)
📁 Diagrammen
│  📐 Diagram 1
📁 Bestanden
│  📄 model.json
```

**Stap 2.2: Browser interacties** *(parallel met 2.3)*
- Dubbelklik diagram → opent diagram-tab in FlexLayout
- Dubbelklik element → selecteert in diagram + toont in properties
- Keyboard: pijltoetsen, Enter, Delete, F2, context menu

**Stap 2.3: Drag & drop browser → diagram** *(parallel met 2.2)*
- HTML5 DnD als brug tussen react-arborist en React Flow
- Cross-domein indicator (badge/kleur als element uit ander domein komt)

---

### Fase 3: Multi-Diagram Support

**Stap 3.1: Diagram-concept in V3 model** *(na Fase 1)*
- `diagrams[]` array toevoegen aan V3 format
- Elk diagram bevat `elementRefs[]` + posities — niet de elementen zelf
- Default "Overzicht" diagram dat alles toont

**Stap 3.2: Diagram tabs in FlexLayout**
- Meerdere tabs naast/boven/onder elkaar
- Sluitbaar, hernoembaar

**Stap 3.3: Diagram-scoped bewerkingen**
- Node verwijderen van diagram ≠ element verwijderen uit model
- Undo/redo per diagram

---

### Fase 4: Persistentie & Synchronisatie

**Stap 4.1:** Zustand `persist` middleware → localStorage (debounced 2s, "unsaved changes" indicator)
**Stap 4.2:** V3 API adapter — hergebruik bestaande publish (`POST /api/schema/model`) en load (`GET /api/schema/versies`) flow
**Stap 4.3:** FlexLayout layout → localStorage

---

### Fase 5: Polish & UX

- Volledige undo/redo (command-pattern, ook property-edits)
- Cross-panel synchronisatie (selectie in diagram ↔ browser ↔ properties, live naam-updates)
- Keyboard shortcuts (Ctrl+S, Ctrl+N, Ctrl+C/V/X, Ctrl+Tab, F2)

---

### Relevante bestanden

| Actie | Bestanden |
|-------|-----------|
| **Nieuwe dependencies** | web/vite/package.json — `zustand`, `flexlayout-react`, `react-arborist` |
| **Nieuw entry point** | `web/vite/ide.html`, `web/vite/src/pages/IdePage.jsx` |
| **Nieuwe store** | `web/vite/src/store/useModelStore.js`, `useUIStore.js`, `adapters.js` |
| **Nieuwe IDE-componenten** | `web/vite/src/ide/ProjectBrowser.jsx`, `DiagramCanvas.jsx`, `DetailsPanel.jsx`, `layoutConfig.js` |
| **Te refactoren** | , , ,  |
| **Hergebruiken (niet wijzigen)** | Alle node-types in nodes/, , export/import functies |

### Verificatie

1. Na Fase 1: IDE opent op `localhost:8082/viz/react/ide.html` met 3 dockbare panels. Bestaande `/editor-v2` werkt nog.
2. Na Fase 2: Browser toont domein-boom. Dubbelklik navigeert.
3. Na Fase 3: Twee diagrammen naast elkaar open met verschillende element-subsets.
4. Na Fase 4: Page refresh → alles intact. Publiceer → V3 in database.
5. Na Fase 5: Naam wijzigen in properties → live update overal. Ctrl+Z werkt.
6. Doorlopend: `npm run build` slaagt, bestaande pages ongebroken.

### Beslissingen

- **IDE leeft in `web/vite/`**, niet in de editor subtree — de shell is project-specifiek
- **Bestaande editor pages blijven bestaan** — geen breaking changes
- **Zustand i.p.v. Redux** — lichter, past bij codestijl
- **V3 format uitbreiden** met `diagrams[]`, niet vervangen
- **Domeinen blijven flat** (geen sub-domeinen in v1)
- **Scope: alleen metamodel-ontwerp** — data-entry views buiten scope

### Overwegingen

1. **Subtree-strategie:** De editor subtree (`uml-editor/`) wordt nu via callback-props aangestuurd. De refactoring naar Zustand kan via **wrapper-componenten** in `web/vite/src/ide/` (subtree ongewijzigd) óf door de subtree zelf te migreren. Aanbeveling: **wrappers eerst**, migreer subtree later als het stabiel is.
2. **Monaco Editor** voor JSON/XMI views en CEL-expressie editing — logische latere toevoeging, niet in v1.
3. **Performance** bij grote modellen: react-arborist heeft ingebouwde virtualisatie; React Flow's viewport clipping helpt. Pas monitoren bij 100+ nodes.

---
