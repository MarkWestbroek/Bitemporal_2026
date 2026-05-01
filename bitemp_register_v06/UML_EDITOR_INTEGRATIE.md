# UML Editor Integratie

> **Status (april 2026)**: De UML-editor is **volledig geïntegreerd** in de Vite-app
> en zit nu onder `bitemp_register_v06/web/vite/src/umleditor/`. De voormalige
> standalone-map `bitemp_register_v06/uml-editor/` (met eigen `package.json`,
> `vite.config.js`, `index.html`, etc.) is verwijderd. Alle imports gaan via de
> alias `@umleditor` (voorheen `@umleditor`).
>
> Onderstaande paragrafen bevatten de **historische context** van de oorspronkelijke
> Git-subtree-integratie. Padverwijzingen naar `uml-editor/...` lezen tegenwoordig
> als `web/vite/src/umleditor/...`.
>
> Zie ook [`docs/ASOC.md`](docs/ASOC.md) voor de single-source-of-truth regel
> die bepaalt of een relatie als associatieklasse (ASOC) of collapsed wordt
> getekend.

## Doel

De UML editor is opgenomen zodat:

- de afstemming met de schema-API directer wordt;
- frontend-code en editor-code in dezelfde applicatie kunnen draaien;
- de editor via dezelfde Go-server op poort `8082` beschikbaar is;
- het editor-project toch apart onderhoudbaar blijft via een Git subtree.

## Projectstructuur

De integratie bestaat uit twee delen:

1. De originele editor-code staat als subtree in:

   `bitemp_register_v06/uml-editor/`

2. De bestaande Vite-frontend gebruikt die code via een alias en een wrapper page in:

   `bitemp_register_v06/web/vite/`

Belangrijke bestanden:

- `uml-editor/`: subtree met de originele editor-repo
- `web/vite/editor.html`: extra HTML entry point voor de editor
- `web/vite/src/pages/EditorPage.jsx`: wrapper die de editor in de bestaande app rendert
- `web/vite/vite.config.js`: bevat de Vite alias en de extra build input
- `web/vite/src/App.jsx`: route-detectie voor `/editor` en `/editor.html`

## Waarom een subtree

De editor is niet simpelweg gekopieerd, maar als Git subtree opgenomen. Daardoor:

- blijft de editor logisch een apart project;
- kun je updates uit de editor-repo binnenhalen;
- kun je lokale wijzigingen vanuit dit repo terugpushen naar de editor-repo;
- blijft de integratie technisch simpel, zonder submodule-gedrag in de werkmap.

De subtree is toegevoegd op:

- prefix: `bitemp_register_v06/uml-editor`
- remote: `uml-editor`
- bronrepo: `https://github.com/MarkWestbroek/UML-editor.git`

## Frontend-integratie

### Vite alias

In `web/vite/vite.config.js` is een alias toegevoegd:

- `@umleditor` -> `src/umleditor`

Daardoor kan de Vite-app editor-code importeren zonder duplicatie van bestanden.

Daarnaast is expliciet resolve-configuratie toegevoegd voor:

- `@xyflow/react`

Dat is nodig omdat de editor-code fysiek buiten `web/vite/src/` staat, terwijl de dependency wel in `web/vite/node_modules/` is geïnstalleerd.

### Extra HTML entry point

De bestaande React/Vite setup had al meerdere entry points:

- `index.html`
- `tijdlijn.html`
- `registraties.html`

Daar is aan toegevoegd:

- `editor.html`

Na build resulteert dat in een extra door Gin geserveerde pagina.

### Wrapper page

De daadwerkelijke editor wordt niet direct als zelfstandige app gestart, maar als pagina in de bestaande frontend opgenomen via:

- `web/vite/src/pages/EditorPage.jsx`

Deze wrapper importeert:

- `@umleditor/components/MetamodelEditor`
- `@umleditor/metamodel/demoData`
- `@umleditor/styles/editor.css`

## Routing en URLs

De Go-server gebruikt:

- `router.Static("/viz", "./web")`

Daardoor worden de gebuilde Vite-bestanden onder `web/react/` automatisch beschikbaar onder `/viz/react/`.

Voor de editor betekent dat:

- development via Vite: `http://localhost:5174/viz/react/editor.html`
- via de Go-server: `http://localhost:8082/viz/react/editor.html`

Ook de route-detectie in `web/vite/src/App.jsx` kent nu:

- `/editor`
- `/editor/`
- `/editor.html`

## Build- en runtime-model

### Development

Frontend development draait via Vite op poort `5174`.

Start in:

- `bitemp_register_v06/web/vite`

Command:

```powershell
"C:\Program Files\nodejs\npm.cmd" run dev -- --host
```

De editor gebruikt dan dezelfde Vite dev server als de andere React-pagina's.

### Productie / lokale Go-run

De Go-app serveert op poort `8082` de statische bestanden uit `web/`.

Na een build:

```powershell
"C:\Program Files\nodejs\npm.cmd" run build
```

komt de output terecht in:

- `bitemp_register_v06/web/react/`

en wordt de editor beschikbaar op:

- `http://localhost:8082/viz/react/editor.html`

## Dependency-keuze

De UML editor gebruikt:

- `@xyflow/react`

Die dependency is toegevoegd aan:

- `bitemp_register_v06/web/vite/package.json`

De editor wordt lazy-loaded in `App.jsx`. Daardoor blijft de editor in een apart chunk en worden de bestaande visualisatiepagina's niet onnodig zwaarder.

## Subtree beheer

### Eenmalig toegevoegd

De subtree is toegevoegd met:

```powershell
git remote add uml-editor https://github.com/MarkWestbroek/UML-editor.git
git fetch uml-editor
git subtree add --prefix=bitemp_register_v06/uml-editor uml-editor main --squash
```

### Updates uit de editor-repo ophalen

```powershell
git subtree pull --prefix=bitemp_register_v06/uml-editor uml-editor main --squash
```

### Lokale editor-wijzigingen terugsturen

```powershell
git subtree push --prefix=bitemp_register_v06/uml-editor uml-editor main
```

## Praktische werkwijze

Als je alleen aan de editor werkt:

- pas primair bestanden aan onder `bitemp_register_v06/uml-editor/`
- houd Vite-integratiestukken beperkt tot `web/vite/`

Als je editor en API op elkaar wilt afstemmen:

- maak editor-aanpassingen in de subtree;
- maak app/routing/build-aanpassingen in `web/vite/`;
- test vervolgens via zowel de Vite dev server als de Go-server.

## Relevante bestanden

- `bitemp_register_v06/UML_EDITOR_INTEGRATIE.md`
- `bitemp_register_v06/uml-editor/README.md`
- `bitemp_register_v06/web/vite/README.md`
- `bitemp_register_v06/web/vite/vite.config.js`

## Association Class (ASOC) rendering voor relaties

Relaties (REL) worden in de UML-editor weergegeven als **association classes** conform de UML-standaard. Dit is een afwijking van de eerdere aanpak waarbij relaties als samengestelde kinderen (composition diamond) werden getekend.

### Patroon

Oud: `A ◆──→ REL ──→ B` (2 composition edges)
Nieuw: `A ── o ── B` (solid association) + `o ╌╌ REL` (dashed class link)

Visueel:
- **Associatie-anker** (`o`): klein cirkelknooppunt (14px), versleepbaar, verbindt de twee entiteiten
- **A→o edge**: ononderbroken lijn, geen diamond, optioneel kardinaliteitslabel
- **o→B edge**: ononderbroken lijn, optioneel open pijlpunt (bij directionele relatie)
- **o╌╌REL edge**: gestreepte lijn (association class link), geen labels

### Collapsible REL-blok

Wanneer een relatie geen inhoudelijke velden EN geen afgeleide velden heeft, toont het `RelatieNode`-component een compact naambadge in plaats van het volledige class-box. Dit maakt visueel duidelijk dat de relatie puur structureel is.

### Directioneel

Relaties kunnen als `directioneel` worden gemarkeerd (boolean). Bij directionele relaties:
- verschijnt een **open pijlpunt** (niet gevuld) op de o→B edge
- het kardinaliteitslabel op de A-kant kan worden weggelaten

### Edge-classificaties in MetamodelEdge

| Classificatie            | Lijnstijl     | Markers            | Voorbeeld                       |
|--------------------------|---------------|--------------------|----------------------------------|
| `composition`            | Ononderbroken | Diamond bij bron   | Entiteit → Gegevenselement      |
| `isAssociation`          | Ononderbroken | Geen / open pijl   | A → anker, anker → B            |
| `isAssociationClassLink` | Gestreept     | Geen               | anker → REL-blok                 |
| `dependency`             | Gestreept     | Open pijl + «use»  | GE → Enum/Datatype              |
| `generalization`         | Ononderbroken | Driehoek bij doel  | Sub → Super                     |

### Gewijzigde bestanden

**Editor (React/JS)**:
- `web/vite/src/umleditor/components/nodes/AssociatieAnkerNode.jsx` — nieuw ankerknooppunt
- `web/vite/src/umleditor/components/nodes/RelatieNode.jsx` — collapsible mode toegevoegd
- `web/vite/src/umleditor/components/edges/MetamodelEdge.jsx` — 5 edge-classificaties
- `web/vite/src/umleditor/components/MetamodelEditor.jsx` — `associatieAnker` node type geregistreerd
- `web/vite/src/umleditor/metamodel/v3ModelNaarEditor.js` — 3-edge + ankerpatroon voor relaties
- `web/vite/src/umleditor/metamodel/types.js` — round-trip export via ankerpatroon
- `web/vite/src/umleditor/import/importXMI.js` — XMI import met ankerpatroon
- `web/vite/src/umleditor/export/exportXMI.js` — XMI export via ankerdetectie
- `web/vite/src/ide/DiagramCanvas.jsx` — `associatieAnker` node type geregistreerd

**Go backend**:
- `model/metaregistry_plumbing.go` — `Directioneel bool` op TypeMeta, `AnkerPositie`/`ClassLink*` op EditorLayout
- `model/v3_format.go` — V3Relatie: `directioneel`, `doelKardinaliteit`, `ankerPositie`, `classLinkId/SourceHandle/TargetHandle`
- `model/v3_exporter.go` — export van nieuwe velden
- `cmd/codegen/gen_registry.go` — codegen ondersteunt nieuwe layout-velden en `Directioneel`

### Backward compatibility

Het oude patroon (directe A→REL→B edges zonder anker) wordt nog steeds ondersteund bij:
- `types.js` (export): herkent zowel anker- als legacy-patroon
- `exportXMI.js`: probeert eerst anker, valt terug op legacy
- `v3ModelNaarEditor.js`: genereert altijd het nieuwe ankerpatroon
- `bitemp_register_v06/web/vite/src/App.jsx`
- `bitemp_register_v06/web/vite/src/pages/EditorPage.jsx`

---

## Interactie: edge-optimalisatie en gebiedsselectie

### Dubbelklik op een edge → kortste route

Wanneer je **dubbelklikt** op een lijn (edge) tussen twee elementen, worden de handle-posities automatisch herberekend zodat de lijn zo kort mogelijk is.

Achtergrond: elke node heeft vier aansluitpunten (handles): `top`, `bottom`, `left`, `right`. Bij het aanmaken van een edge worden de handles bepaald door waar je de lijn vandaan sleept. Maar als je daarna nodes verplaatst, kan de lijn suboptimaal lopen (bijv. van boven naar beneden terwijl de nodes naast elkaar staan).

De functie `berekenKortsteHandles()` in `MetamodelEditor.jsx` berekent voor alle 4×4 combinaties welk paar ankerpunten (rekening houdend met node-afmetingen) de kortste euclidische afstand oplevert, en past `sourceHandle` en `targetHandle` automatisch aan.

### Shift + sleep → gebiedsselectie (rubber-band)

Houd **Shift** ingedrukt en sleep op het canvas om een selectierechthoek te tekenen. Alle nodes die (deels) overlappen worden geselecteerd. Je kunt de geselecteerde nodes vervolgens als groep verslepen.

Aanvullend: **Ctrl + klik** op individuele nodes voegt ze toe aan of verwijdert ze uit de selectie.

### Rechtsklikmenu voor uitlijnen en verdelen

Wanneer **minstens 2 nodes** geselecteerd zijn, kun je met **rechtsklik** een compact contextmenu openen. Dat menu werkt zowel na **Ctrl + klik** als na **Shift + sleep** (gebiedsselectie), en mag ook geopend worden wanneer er tegelijk relaties/edges mee geselecteerd zijn. De acties worden dan **alleen op de geselecteerde nodes** toegepast; edges worden genegeerd.

Beschikbare acties:

- **Links / Centreer / Rechts** — horizontale uitlijning van de geselecteerde nodes
- **Boven / Midden / Onder** — verticale uitlijning van de geselecteerde nodes
- **Verdeel gelijk ↕ / Verdeel gelijk ↔** — verdeelt de tussenruimte gelijkmatig; deze opties verschijnen pas bij **3 of meer** geselecteerde nodes
- **Ctrl + Z** — draait de laatste canvasactie terug via een kleine undo-stack (o.a. verplaatsen, verbinden, verwijderen, uitlijnen en verdelen)
- **Ctrl + Y** of **Ctrl + Shift + Z** — zet de laatste ongedaan gemaakte canvasactie opnieuw terug

Technisch: het contextmenu is gekoppeld aan `onNodeContextMenu`, `onPaneContextMenu`, `onEdgeContextMenu` en `onSelectionContextMenu` in `MetamodelEditor.jsx`, zodat het menu ook bruikbaar blijft als React Flow naast nodes ook de selectiebox of onderliggende edges als geselecteerd markeert.

Technisch: dit zijn React Flow props op de `<ReactFlow>` component:

| Prop | Waarde | Effect |
|------|--------|--------|
| `selectionKeyCode` | `"Shift"` | Shift ingedrukt → rubber-band selectie i.p.v. canvas pan |
| `selectionMode` | `"partial"` | Nodes die deels overlappen met de selectierechthoek worden ook geselecteerd |
| `multiSelectionKeyCode` | `"Control"` | Ctrl + klik om nodes individueel bij de selectie te voegen |

### Dependency-edges tijdelijk verbergen

Voor **stippellijnen met `«use»`** (dependency-edges van GE/relatie naar enum, gegevenstype of referentielijst-item) is er nu een apart rechtsklikmenu:

- **Rechtsklik op een dependency-edge** → **`Verberg deze dependency`**
- **Rechtsklik op een enum- of gegevenstype-node** → **`Verberg dependencies`** of **`Toon dependencies`** voor alle inkomende `«use»` edges naar die node

Alleen edges met `data.isDependency === true` zijn op deze manier verbergbaar. Gewone compositie- en relatie-edges blijven dus altijd zichtbaar.

De verborgen status blijft behouden bij een **V3 roundtrip**: in de V3 JSON worden dependency-layoutgegevens opgeslagen onder `useEdges[]`, inclusief `id`, `sourceHandle`, `targetHandle` en `hidden`. Daardoor kun je een diagram opslaan, later opnieuw laden, en dezelfde dependency-edges verborgen houden.

Sinds 2026-04-08 geldt dit ook voor de **code-roundtrip** via de gegenereerde Go-bestanden: de codegenerator schrijft `useEdges[]` door naar `EditorLayout.UseEdges` in de `*_metaregistry.go` bestanden, en `ExportMetaRegistryToV3()` exporteert die metadata weer terug naar V3. Daardoor blijft de editor-layout van dependency-edges behouden in de volledige route **editor → V3 → code → V3 → editor**.

---

## Import en Export

### Export

De editor ondersteunt drie exportformaten. Alle exports worden als bestandsdownload aangeboden via de toolbar.

| Formaat | Bestand | Knop | Doel |
|---------|---------|------|------|
| **Mermaid** | `metamodel.mmd` | 🧜 Mermaid | Class diagram syntax voor Mermaid.js |
| **PlantUML** | `metamodel.puml` | 🌱 PlantUML | Class diagram syntax voor PlantUML |
| **XMI 1.1** | `metamodel.xmi` | 📦 XMI 1.1 | UML 1.4 XMI voor Sparx Enterprise Architect e.a. |

#### XMI export met diagramposities

De XMI export bevat naast het UML-model ook een `<XMI.extension>` blok met diagramposities per element in EA-compatibel formaat:

```xml
<XMI.extension extender="UML-editor">
  <diagrams>
    <diagram>
      <elements>
        <element subject="EAID_node_1" left="150" right="330" top="-50" bottom="-170"/>
      </elements>
    </diagram>
  </diagrams>
</XMI.extension>
```

De coördinaten gebruiken EA's conventie: `left`/`right` zijn X-bereik, `top`/`bottom` zijn Y-bereik met negatieve waarden (EA's scherm-Y is omgekeerd).

### Import

De editor kan ook modellen **importeren** uit de drie formaten. Importknoppen staan in de toolbar naast de exportknoppen.

| Formaat | Knop | Bestandstypen |
|---------|------|---------------|
| **XMI** | 📥 XMI | `.xmi`, `.xml` |
| **Mermaid** | 📥 Mermaid | `.mmd`, `.md`, `.txt` |
| **PlantUML** | 📥 PlantUML | `.puml`, `.plantuml`, `.txt` |

> **Let op**: import vervangt het huidige model volledig. Sla het huidige model eerst op als je het wilt bewaren.

#### XMI import

De XMI importer (`web/vite/src/umleditor/import/importXMI.js`) ondersteunt:

- `UML:Class` met stereotype → entiteit / gegevenselement / relatie
- `UML:Class` met `<<enumeration>>` → enumeratie
- `UML:DataType` → gegevenstype
- `UML:AssociationClass` → relatie-node met twee edges naar de participerende entiteiten
- `UML:Association` → edge met rolnaam, kardinaliteit en momentvoorkomen
- `UML:Dependency` → dependency-edge (stippellijn met `<<use>>`)
- **EA diagramposities**: als het XMI-bestand een EA extensie-blok bevat met `<element subject="..." left/right/top/bottom>` of `<DiagramElement>` met geometry-strings, worden de posities uitgelezen en toegepast op de nodes

#### Mermaid import

De Mermaid importer (`web/vite/src/umleditor/import/importMermaid.js`) ondersteunt:

- `class Foo { <<entiteit>> ... }` → node met stereotype-bepaling
- Velden met `+type naam` (verplicht) of `-type naam` (optioneel)
- Enum-waarden (regels zonder marker in een `<<enumeration>>` blok)
- Relaties: `Foo --> Bar : label`, `Foo "1" --> "0..*" Bar : label`
- Dependencies: `Foo ..> Bar` (stippellijn)

#### PlantUML import

De PlantUML importer (`web/vite/src/umleditor/import/importPlantUML.js`) ondersteunt:

- `class Foo <<entiteit, materieel>> { ... }` → node met metatype en materialiteit
- `enum Foo { ... }` → enumeratie
- `class Foo <<datatype>> { ... }` → gegevenstype
- Velden: `+ naam : type` (verplicht) of `- naam : type` (optioneel)
- Relaties: `Foo "1" --> "0..*" Bar : label`
- Dependencies: `Foo ..> Bar` (stippellijn)

### Import/export bestanden

| Bestand | Doel |
|---------|------|
| `web/vite/src/umleditor/export/exportMermaid.js` | Editor → Mermaid class diagram |
| `web/vite/src/umleditor/export/exportPlantUML.js` | Editor → PlantUML class diagram |
| `web/vite/src/umleditor/export/exportXMI.js` | Editor → XMI 1.1 (incl. diagramposities) |
| `web/vite/src/umleditor/import/importXMI.js` | XMI 1.1 → Editor (incl. EA diagramposities) |
| `web/vite/src/umleditor/import/importMermaid.js` | Mermaid class diagram → Editor |
| `web/vite/src/umleditor/import/importPlantUML.js` | PlantUML class diagram → Editor |

## Bugfix: Unieke Handle IDs (removeChild crash)

**Datum:** 2026-04-10  
**Probleem:** De editor en IDE crashten met een `removeChild` fout in React.  
**Oorzaak:** Alle 6 React Flow node-componenten hadden **dubbele `id`** attributen op `<Handle>` elementen: zowel `<Handle type="source" id="top"/>` als `<Handle type="target" id="top"/>` bestonden op dezelfde node. React Flow maakt DOM-elementen per handle-ID; duplicaten veroorzaken dat React probeert nodes te verwijderen die al zijn vervangen tijdens reconciliation.

### Oplossing

Elke Handle heeft nu een uniek `id` in het formaat `{type}-{positie}`:

| Oud | Nieuw (source) | Nieuw (target) |
|-----|----------------|----------------|
| `id="top"` | `id="source-top"` | `id="target-top"` |
| `id="bottom"` | `id="source-bottom"` | `id="target-bottom"` |
| `id="left"` | `id="source-left"` | `id="target-left"` |
| `id="right"` | `id="source-right"` | `id="target-right"` |

### Gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `web/vite/src/umleditor/components/nodes/*.jsx` (6 bestanden) | Handle `id` attributen geprefixed |
| `web/vite/src/umleditor/components/MetamodelEditor.jsx` | `berekenKortsteHandles` retourneert geprefixte IDs; `swapConnectionDirection` past prefixes aan bij het omdraaien |
| `web/vite/src/ide/DiagramCanvas.jsx` | `berekenKortsteHandles` idem |
| `web/vite/src/umleditor/components/panels/EdgeEditPanel.jsx` | Dropdown option values geprefixed |
| `web/vite/src/umleditor/metamodel/v3ModelNaarEditor.js` | Backward-compat migratiefuncties `migrateSourceHandle()`/`migrateTargetHandle()` voor oude DB-modellen met kale positienamen |
| `web/vite/src/umleditor/metamodel/demoData.js` | Handle IDs bijgewerkt |
| `web/vite/src/demoV3Model.js` | Handle IDs bijgewerkt |
| `web/vite/src/umleditor/metamodel/referentielijstRoundtrip.test.js` | Testverwachtingen bijgewerkt |
| `web/vite/src/umleditor/metamodel/types.js` | Geen wijziging nodig — passthrough van handle waarden |

### Backward compatibiliteit

Modellen opgeslagen in de database met het oude formaat (`"top"`, `"bottom"`, etc.) worden automatisch gemigreerd bij het laden via `migrateSourceHandle()`/`migrateTargetHandle()` in `v3ModelNaarEditor.js`. Nieuw opgeslagen modellen gebruiken het geprefixte formaat.

---

## Donker/licht thema — gedeeld met IDE

**Datum:** april 2026

### Samenvatting

De UML-editor v2 en de IDE delen één thema-toggle via de Zustand-store `useUIStore`. Beide editors bewegen mee op hetzelfde `data-ide-theme`-attribuut op `<body>`. De CEL-expressie-editor (breakout-modal in zowel de IDE als de UML-editor) volgt automatisch mee.

### Architectuur

```
localStorage["ide-theme"]
       │
       ▼
 useUIStore.theme ("dark" | "light")
       │
       ├─── IdePage.jsx (bestaand): body.setAttribute("data-ide-theme", theme)
       │
       └─── MetamodelEditor.jsx (nieuw): useEffect → body.setAttribute("data-ide-theme", theme)
                                                     ▲
                                              gedeelde store,
                                              beide lezen dezelfde waarde
```

- De `useUIStore` persisteert het thema in `localStorage` onder de sleutel `ide-theme`.
- Zodra een van beide editors het thema wisselt, ziet de andere het direct (zelfde tab) of na een herlaad (ander tabblad).
- Er zijn geen afzonderlijke thema-variabelen nodig: de CSS-overrides luisteren op `body[data-ide-theme="dark"]` en `body[data-ide-theme="light"]`.

### Gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `web/vite/src/umleditor/components/MetamodelEditor.jsx` | Import `useUIStore`; lees `theme` + `toggleTheme`; `useEffect` die `data-ide-theme` op body synct; `theme` en `onToggleTheme` props doorgegeven aan `Toolbar` |
| `web/vite/src/umleditor/components/panels/Toolbar.jsx` | Nieuwe props `theme` (default `"dark"`) en `onToggleTheme`; toggle-knop ☀️/🌙 toegevoegd als eerste knop in de rechter actierij |
| `web/vite/src/umleditor/styles/editor.css` | ~250 regels thema-overrides toegevoegd **aan het einde** van het bestand (bestaande regels ongewijzigd) |

### CSS-aanpak

De bestaande `editor.css` gebruikt uitsluitend hardcoded hex-kleuren (geen variabelen). Om maximale backward-compatibiliteit te behouden, zijn er géén bestaande regels gewijzigd. Alle thema-overrides staan als **attribute-selector-blokken onderaan** het bestand:

```css
/* Donker thema: canvas, sidebar, panels, nodes, context menu, test-invoer */
body[data-ide-theme="dark"] .editor-sidebar { ... }
body[data-ide-theme="dark"] .edit-panel h3  { ... }
/* ... */

/* Licht thema: alleen de expressie-editor-modal (was altijd donker) */
body[data-ide-theme="light"] .expressie-editor-modal          { ... }
body[data-ide-theme="light"] .expressie-editor-code           { ... }
body[data-ide-theme="light"] .expressie-editor-code .token.keyword { color: #1d4ed8; }
/* ... */
```

**Wat schakelt per thema:**

| Onderdeel | Donker | Licht |
|-----------|--------|-------|
| Canvas achtergrond | `#0d1117` | standaard `#f8fafc` (bestaande CSS) |
| Sidebar / edit panel | `#0f172a`, lichte tekst | standaard wit |
| Metamodel-nodes | `#1e293b` achtergrond | standaard wit |
| Context menu | `#1e293b` | standaard wit |
| CEL-expressie-editor | altijd donker (bestaand) | licht (override) |
| CEL syntax-kleuren licht | n.v.t. | blauw keywords, groen strings, rood numbers |
| Toolbar | altijd donker | altijd donker (geen override) |

### Toggle-knop

- In de **IDE**: bestaande ☀️/🌙 knop rechtsboven in de IDE-toolbar.
- In de **UML-editor v2**: nieuwe ☀️/🌙 knop als eerste knop in de rechter actierij van de toolbar.

Beide knoppen roepen `toggleTheme()` aan op dezelfde `useUIStore`; het resultaat is altijd synchroon zichtbaar in de actieve editor.

---

## C8: Notities en constraints

**Datum:** mei 2026

### Samenvatting

De editor (zowel EditorV2 als IDE) ondersteunt nu twee nieuwe node-typen voor annotaties en modelregels:

| Type | Visueel | Doel |
|------|---------|------|
| **Notitie** | Gele post-it (📝) | Vrije tekst-annotatie op het canvas |
| **Constraint** | Lichtblauwe rounded-rect (🔒) | Modelregel in OCL, CEL of tekst |

### Gebruik

- **EditorV2**: toolbar heeft nieuwe knoppen `📝 Notitie` en `🔒 Constraint`.
- **IDE**: CREATE_BUTTONS-palette heeft knoppen `📝` en `🔒`.
- Selecteer een notitie/constraint → **rechterpanel** toont een eenvoudige editor (tekst, kleur, naam, taal, expressie, domein).
- Constraints kunnen via een **scope-edge** (gestippeld grijs, `data.kind="scope"`) worden gekoppeld aan een entiteit of GE. Die edges leven in `structuralEdges` en zijn altijd zichtbaar.

### V3 JSON roundtrip

Notities en constraints worden opgeslagen als eigen arrays in het V3-model:

```json
{
  "notities": [{ "id": "note1", "tekst": "...", "positie": {"x":10,"y":20}, "kleur": "#fffde7" }],
  "constraints": [{ "id": "cstr1", "naam": "C1", "expressie": "self.x > 0", "taal": "ocl", "scopeRefs": ["A"] }]
}
```

Positie wordt opgeslagen in `V3Notitie.positie` / `V3Constraint.positie` en bij import teruggezet in `diagrams[overzicht].nodes`.

### Gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `web/vite/src/umleditor/components/nodes/NotitieNode.jsx` | **Nieuw** — gele post-it node component (resizable) |
| `web/vite/src/umleditor/components/nodes/ConstraintNode.jsx` | **Nieuw** — lichtblauwe constraint node (naam+taal badge+expressie) |
| `web/vite/src/umleditor/components/MetamodelEditor.jsx` | nodeTypes uitgebreid met `notitie`/`constraint`; **mei 2026: scope-edge-logica in `onConnect`** |
| `web/vite/src/umleditor/components/panels/Toolbar.jsx` | Knoppen `📝 Notitie` en `🔒 Constraint` toegevoegd |
| `web/vite/src/umleditor/components/panels/NodeEditPanel.jsx` | Early-return editors voor notitie en constraint |
| `web/vite/src/umleditor/metamodel/types.js` | `maakLegeNotitie()` en `maakLegeConstraint()` factory-functies |
| `web/vite/src/ide/DiagramCanvas.jsx` | nodeTypes + CREATE_BUTTONS uitgebreid; stap 5 scope-edges in `materialiseerDiagramEdges` |
| `web/vite/src/ide/BrowserContextMenu.jsx` | **mei 2026: notitie/constraint toegevoegd aan alle menu-items** |
| `web/vite/src/ide/ProjectBrowser.jsx` | **mei 2026: notities + constraints in domeinboom; naam vs tekst-preview** |
| `web/vite/src/ide/DetailsPanel.jsx` | `NotitieEditor` + `ConstraintEditor`; **mei 2026: naam-veld in NotitieEditor** |
| `web/vite/src/ide/repCreation.js` | `bouwStoreElement` cases voor `notitie` en `constraint` |
| `web/vite/src/ide/components/edges/MetamodelEdge.jsx` | Scope-edge short-circuit (gestippeld grijs) |
| `web/vite/src/store/adapters.js` | **mei 2026: 5 fixes — diagram nodes export/import, notitie naam+scopeRefs; round 4: namedDiagPos + scopeRefs deduplicatie** |
| `web/vite/src/pages/IdePage.jsx` | **mei 2026: referentielijstInstanties domeinfilter in handleExportDialog** |
| `model/v3_format.go` | `V3Notitie` en `V3Constraint` structs (eerder al toegevoegd) |
| `web/vite/src/store/__tests__/v3_b5_c8_roundtrip.test.js` | Roundtrip-tests bijgewerkt (positie in `diagram.nodes` i.p.v. `data.positie`) |

### Mei 2026: IDE↔EditorV2 roundtrip kwaliteit

Aanvullende fixes voor bidirectionele uitwisseling:

1. **PB context-menu** (BrowserContextMenu.jsx): Notitie/constraint nu ondersteuning voor `toonInDiagram`, `toonDetails`, `hernoem`, `kopieerID`, `verwijder`.

2. **Notitie naam** (DetailsPanel.jsx, adapters.js): Notities krijgen een aangepaste `naam` (apart van `tekst`). Export/import respecteert dit onderscheid.

3. **Diagram-nodes format** (adapters.js): Export gebruikt `elementId: n.elementId || n.id` (robuust tegen legacy-format). Import gebruikt `{ elementId, position }` format consistent met store.

4. **referentielijstInstanties filter** (IdePage.jsx): Bij domeinexport nu ook gefilterd, zodat AdellijkeTitels/Landenlijst niet meekomen voor andere domeinen.

5. **EditorV2 scope-edges** (MetamodelEditor.jsx): `onConnect` heeft nu dezelfde scope-edge-logica als DiagramCanvas — notitie/constraint als source → gestippelde lijn.

6. **Notitie scopeRefs** (adapters.js): Export en import van meerdere scope-lijnen vanuit één notitie; volledig bidirectioneel.

### Mei 2026: IDE↔EditorV2 Quality Fixes Round 3

User-rapportage: drie bugs in IDE/EditorV2 roundtrip:

1. **Notitienaam beklijft niet** (DetailsPanel.jsx): EditField ondersteunt geen `onBlur` prop.
   - **Fix**: Custom input-element met `onBlur={handleNaamBlur}` callback. Naam wordt nu correct opgeslagen in `updateElement`.

2. **Scope-edge verdwijnt bij dubbelklik** (DiagramCanvas.jsx): `handleEdgeDoubleClick` probeerde gestippelde scope-edges te normaliseren (kortste route).
   - **Fix**: Early-return als `edge.data?.kind === "scope"`. Scope-edges blijven nu intact.

3. **Posities IDE→EditorV2 totaal anders** (DiagramCanvas.jsx): Diagram nodes zijn **per diagram** opgeslagen (elk diagram eigen subset nodes+posities). Beweeg node in diagram "Kennis" → update naar `diagrams["kennis"].nodes`, maar `diagrams["overzicht"]` onveranderd. Bij V3-export, `posLookup()` leest uit Overzicht → stale/missing posities.
   - **Fix**: Bij position-change, sync posities ook naar Overzicht-diagram. Het Overzicht is de single source of truth voor V3-export. Meerdiagram-scenario's nu consistent.

**Resultaat:** Notitienamen blijven behouden, scope-edges normaliseren niet, posities IDE↔EditorV2 identiek.

### Mei 2026: Positie-fix Round 4 — namedDiagPos en scopeRefs deduplicatie

User-rapportage: na import van een V3 JSON staan alle posities in EditorV2 nog steeds verkeerd. Root cause: posities staan alleen in `diagrammen[].nodes` van de JSON, niet als `ent.positie` fields.

**Problemen:**

1. **Posities uit named diagram worden genegeerd bij import** (`adapters.js`, `v3ModelNaarEditor.js`): Import-code gebruikte `ent.positie || grid-fallback`; als `ent.positie` ontbrak, werden posities in `diagrammen[].nodes` genegeerd. Overzicht-diagram kreeg default-grid-posities. V3-export leest uit Overzicht → EditorV2 zag foute posities.
   - **Fix**: `namedDiagPos` map scant alle `diagrammen[].nodes` (first-wins per elementId). Prioriteitsvolgorde: `ent.positie` → `namedDiagPos.get(id)` → grid-fallback. Geldt voor: entiteiten, GE's, relaties, anker-nodes, enums, datatypes, referentielijstInstanties.

2. **Dubbele scope-lijntjes** (`adapters.js`): Scope-edges werden dubbel ingevoegd als `scopeRefs[]` dezelfde target meerdere keren bevatte. Bij import → meerdere structurele edges met gelijke source/target. Bij export → duplicaten in JSON.
   - **Fix**: `Set`-deduplicatie bij zowel import als export van notitie- en constraint-scopeRefs.

3. **Notitie scopeRefs ontbraken in EditorV2 direct-import** (`v3ModelNaarEditor.js`): Constraints hadden al scope-edge generatie; notities niet. Tevens `naam`-veld voor notities.
   - **Fix**: ScopeRefs-loop toegevoegd voor notities; `naam`-veld doorgegeven; scope-edges in beide typen gededupliceerd.

**Resultaat:** Posities IDE↔EditorV2 identiek bij import van V3 JSON, ongeacht of posities op entity-level of in `diagrammen[].nodes` staan. Geen dubbele scope-lijntjes meer.

---

**Resultaat round 1+2+3+4:** 115 tests groen; beide editors (IDE en EditorV2) kunnen C8-elementen zonder verlies of visuele inconsistenties uitwisselen.

