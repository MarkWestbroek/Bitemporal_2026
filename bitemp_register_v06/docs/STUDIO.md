# Studio — geïntegreerde werkbank (VS Code-stijl)

> Toegevoegd: 2026-06-17. Route: `/studio` (build: `/viz/react/studio.html`).
>
> **Code review (2026-06-30):** zie [`STUDIO-code-review-2026-06-30.md`](STUDIO-code-review-2026-06-30.md)
> voor bevindingen over onderhoudbaarheid, dubbelingen, veiligheid en toegankelijkheid.
>
> **Plan Studio 0.5 (2026-07-02):** zie [`STUDIO-05-diagramcore-plan.md`](STUDIO-05-diagramcore-plan.md)
> voor het voorstel om de UML-editor te veralgemeniseren naar een configureerbare
> diagram-kern (diagramcore + profielen), parallel naast de huidige versie.

De **Studio** is een geïntegreerde werkbank die de losse functie-pagina's onder één
VS Code-achtige schil brengt: een uitbreidbare **iconenbalk** links (activity bar) en
centrale werkvlakken met een uniforme UX (links een tree-browser, rechts een
eigenschappen-paneel, beide *auto-hide*).

## Waarom

De frontend had losse full-page apps (`ide.html`, `dmn-demo.html`, `bpmn-demo.html`,
`bericht-demo.html`, …). Elk met een eigen indeling. De Studio voegt ze samen tot
één werkbank met consistente bediening, terwijl de onderliggende modules
(`dmn/`, `bpmn/`, `bericht/`, `umleditor/`, …) **code-technisch gescheiden blijven**.

## Hoe de pagina's hierin passen

De losse pagina's worden **geen losse pagina's meer**, maar **activiteiten** binnen de
werkbank. De scheiding blijft netjes via een dun *contract*:

- Elke functie levert een **activiteit-descriptor** aan (`id`, `label`, `icon`, slots).
- De shell (`StudioShell`) kent alleen dat contract — niet de interne werking.
- De echte editor-componenten (DmnTableEditor, BpmnEditor, BerichttypeEditor,
  IdePage, ModelPicker …) blijven **onveranderd** in hun eigen module en worden
  hergebruikt als slot-inhoud.

De oude standalone HTML-pagina's (`dmn-demo.html`, enz.) blijven bestaan voor directe
links; ze delen dezelfde onderliggende componenten, dus er is geen duplicatie.

## Architectuur

```
src/studio/
  activityRegistry.js     ← uitbreidbaar register (registreer + ophalen)
  useStudioStore.js       ← Zustand: actieve activiteit + paneel-stand (persist)
  icons.jsx               ← inline SVG-iconenset (uitbreidbaar)
  ActivityBar.jsx         ← verticale iconenbalk (leest het register)
  SidePanel.jsx           ← inklapbaar/auto-hide zijpaneel (links én rechts)
  StudioShell.jsx         ← de schil: menubalk + activity bar + topbar + 3 regio's
  MenuBar.jsx             ← applicatie-menubalk bovenin (Bestand, Beeld, …, Help)
  buildMenus.js           ← stelt de menu's samen (standaard + per activiteit)
  menuBus.js              ← ontkoppelde event-bus voor activiteit-menu-acties
  studio.css              ← thema-bewuste opmaak (data-studio-theme)
  activities/
    index.jsx             ← registreert alle activiteiten (= iconvolgorde)
    PlaceholderActivity.jsx← fabriek voor nog-te-bouwen functies
    umlActivity.jsx        ← UML-IDE (fullMain: IdePage)
    dmnActivity.jsx        ← DMN-beslistabellen met DRD/Tabel-tabs + tree browser
    bpmnActivity.jsx       ← BPMN-processen (bpmn.io)
    berichtActivity.jsx    ← berichtdefinities
src/pages/StudioPage.jsx  ← instappunt (importeert activiteiten + css)
studio.html               ← Vite-entry
```

### Schematische opbouw van de shell

```
┌─────────────────────────────────────────────────────────────┐
│ Menubalk:  Bestand  Beeld  Ga naar  [activiteit] … Help      │  ← MenuBar (volledige breedte)
├──┬──────────────────────────────────────────────────────────┤
│A │ Topbar: paneel-toggles · titel · thema                   │
│c ├──────────┬───────────────────────────┬───────────────────┤
│t │ Sidebar  │          Main             │    Inspector      │
│i │ (tree)   │        (editor)           │   (properties)    │
│v │ pin/auto │                           │   pin/auto-hide   │
│  │  -hide   │                           │                   │
└──┴──────────┴───────────────────────────┴───────────────────┘
 ActivityBar (iconenbalk, uitbreidbaar)
```

De shell kent alleen het activiteit-*contract*; welke activiteiten bestaan en in welke
volgorde komt volledig uit het `activityRegistry`.

### Activiteit-contract

```js
{
  id, label, icon,            // identiteit + iconenbalk
  groep,                      // visuele groepering ("modelleren" | "diensten" | "data")
  Provider?,                  // optioneel: deelt state tussen de slots via context
  Sidebar?,                   // links (tree-browser). null → geen linkerpaneel
  Main,                       // midden (editor/canvas) — verplicht
  Inspector?,                 // rechts (eigenschappen). null → geen rechterpaneel
  sidebarLabel?, inspectorLabel?,
  fullMain?,                  // true → activiteit brengt eigen volledige layout mee
  menus?,                     // array of (ctx)=>array: extra/override menubalk-menu's
  status?,                    // bv. "concept" voor nog-te-bouwen functies
}
```

Activiteiten met gedeelde state tussen de drie slots (DMN, BPMN, berichten) leveren een
`Provider` aan die de state via een lokale React-context beschikbaar maakt. De
UML-IDE brengt zijn eigen FlexLayout-docking mee en is daarom `fullMain` (de shell
toont dan alleen de menubalk + iconenbalk).

### Auto-hide zijpanelen

`SidePanel` (links én rechts) kent **twee knoppen** in de titelbalk:

- **📌 pin / 📍 unpin** — schakelt tussen *vast gedockt* en *auto-hide*.
- **‹ / ›** — klap het paneel handmatig in tot een rail.

Drie standen:

1. **Gepind (default)** — vast gedockt; neemt layout-ruimte in. Sleep de binnenrand
   om de breedte te wijzigen.
2. **Auto-hide (na unpin)** — in de layout staat alleen een smalle **rail**. Zodra je
   die rail *aanwijst* verschijnt het paneel als **overlay** boven de canvas; het
   **klapt vanzelf weer in** zodra de muis het paneel verlaat (na ~350 ms) én er geen
   invoerveld in het paneel focus heeft. Dit is het klassieke auto-hide gedrag zoals
   in Visual Studio. *(Dit is wat eerder ontbrak: panelen krompen niet vanzelf bij
   focusverlies — nu wel, mits het paneel op auto-hide staat.)*
3. **Handmatig ingeklapt** — altijd een rail; klik om weer te tonen.

Open/dicht-stand én pin-stand worden **per activiteit** onthouden in `useStudioStore`
(localStorage). Beide panelen zijn ook te bedienen via menu **Beeld**.

### Menubalk (bovenin)

Een klassieke applicatie-menubalk (`MenuBar.jsx`), **flexibel per activiteit**:

- **Standaardmenu's** (`buildMenus.js`): **Bestand** (overzicht/herladen), **Beeld**
  (panelen tonen/verbergen, vastpinnen, thema), **Ga naar** (wisselen tussen
  activiteiten), **Help** (documentatie via de `/docs`-server, over).
- **Per-activiteit menu's**: een activiteit levert optioneel `menus` aan (array of
  `(ctx) => array`). De volgorde is verankerd: **Bestand** vooraan, daarna de
  activiteit-eigen menu's (bv. **Bewerken**, **Publiceer**, **Tabel**), gevolgd door
  **Beeld**, **Ga naar** en **Help**. Een activiteit-menu met een bestaand id
  (`bestand`/`beeld`) *overschrijft* de standaard op die ankerplek.
- **Submenu's (flyout)**: een item met een geneste `items`-array opent een flyout naar
  rechts (gebruikt voor o.a. **Bewerken → Maak ▸** en **Beeld → Uitlijnen ▸**).
- **Ontkoppeling**: activiteit-menu-acties bereiken de interne state van een activiteit
  via de `menuBus` (bv. `menuBus.emit("dmn:nieuw")`), zodat de shell de interne
  werking niet hoeft te kennen. Acties die op globale stores werken (undo/redo,
  representatie aanmaken) worden direct aangeroepen, zonder bus.

Het menu-itemmodel:
`{ id, label, onClick, shortcut?, disabled?, checked? }`,
`{ id, label, items: [ … ] }` (submenu) of `{ type: "separator" }`.

#### UML-menubalk (rijk, `fullMain`)

Omdat de UML-IDE `fullMain` is, vervangt zij vrijwel de hele menubalk:

| Menu          | Items                                                                                   |
|---------------|-----------------------------------------------------------------------------------------|
| **Bestand**   | Importeer… (bestand of API), Exporteer…, Upload bestand…, Overzicht (index), Pagina herladen |
| **Bewerken**  | Ongedaan maken (Ctrl+Z), Opnieuw (Ctrl+Y), **Maak ▸** (Entiteit, Gegevenselement, Relatie, Referentielijst, Enumeratie, Gegevenstype, Notitie, Constraint) |
| **Publiceer** | Publiceer schema-versie…, Delta-analyse…, Rebuild…, Publiceer + Rebuild…                 |
| **Beeld**     | Nieuw diagram…, Herlaad uit database, Bestanden-paneel, Auto-layout (heel/selectie), Uitlijnen op raster, Relaties normaliseren, **Uitlijnen ▸** (links/rechts/boven/onder, centreren, verdelen), thema |

De koppeling loopt op drie manieren:
- **Direct op de store**: undo/redo (`useModelStore.temporal`), en **Maak** via
  `voegNieuwRepToe(kind)` (werkt op het actieve diagram — `useUIStore.activeDiagramId`).
- **`menuBus` → `IdePage`**: dialoog-/paneel-acties. `IdePage` abonneert zich op
  `uml:import`, `uml:export`, `uml:upload`, `uml:nieuw-diagram`, `uml:herlaad`,
  `uml:bestanden`, `uml:publiceer`, `uml:delta`, `uml:rebuild`, `uml:publiceer-rebuild`.
- **`menuBus` → actief `DiagramCanvas`**: `uml:layout` met een mode (align/distribute/
  auto-layout/snap-grid/normaliseer). Alleen het actieve diagram reageert.

#### Menu's van de overige activiteiten

| Activiteit  | Menu       | Items                                                       |
|-------------|------------|-------------------------------------------------------------|
| DMN         | **Tabel**  | Nieuwe beslistabel (`dmn:nieuw`), Exporteer als JSON (`dmn:export`) |
| BPMN        | **Proces** | Nieuw berichttype (`bpmn:nieuw-bericht`), Exporteer BPMN XML (`bpmn:export-xml`) |
| Bericht     | **Bericht**| Nieuw berichttype (`bericht:nieuw`), Exporteer als JSON (`bericht:export`) |

Elke activiteit-`Provider` abonneert zich in een `useEffect` op zijn eigen
`menuBus`-events en voert de actie uit op de lokale context-state (export gebruikt een
ref voor de actuele waarde). Zo blijven de onderliggende modules ongewijzigd.

## Een nieuwe functie toevoegen

1. Maak een descriptor (eigen bestand in `src/studio/activities/` of via
   `maakPlaceholderActiviteit`).
2. Hergebruik bestaande editor-componenten als `Main`/`Sidebar`/`Inspector`.
3. Voeg een icoon toe in `icons.jsx` (of gebruik een bestaand).
4. Registreer de descriptor in `activities/index.jsx` (volgorde = iconvolgorde).
5. (Optioneel) Voeg `menus` toe voor activiteit-specifieke menubalk-items.

De iconenbalk, menubalk en routing passen zich automatisch aan; de shell hoeft niet
te wijzigen.

## Geregistreerde activiteiten

| Groep        | Functie            | Status   | Hergebruikt                        |
|--------------|--------------------|----------|------------------------------------|
| modelleren   | UML-model          | actief   | `IdePage` (FlexLayout, fullMain)   |
| modelleren   | Diagrammen (0.5)   | preview  | `diagramcore` + `diagramprofielen/canoniek-uml` (bewerkbare sandbox) |
| modelleren   | UML (0.5)          | preview  | `diagramcore` + `diagramprofielen/puur-uml` (fase 5-lakmoesproef) |
| modelleren   | OAS (0.5)          | preview  | `diagramcore` + `diagramprofielen/oas31` (fase 5-vuurproef) |
| modelleren   | Profiel (0.5)      | preview  | meta-editor: eigen profielen maken en live registreren (plan §8.9) |
| modelleren   | DMN-tabellen       | actief   | `dmn/DmnTableEditor` + ModelPicker |
| modelleren   | BPMN-processen     | actief   | `bpmn/BpmnEditor` + ModelPicker    |
| modelleren   | Berichtdefinities  | actief   | `bericht/BerichttypeEditor`        |
| diensten     | API's              | concept  | placeholder                        |
| diensten     | Toegangverlening   | concept  | placeholder (FTV/PBAC)             |
| data         | Rollen             | concept  | placeholder                        |
| data         | Referentielijsten  | concept  | placeholder                        |

DMN-modellering komt later bij de UML-activiteit (zelfde IDE), zoals gewenst.

### Diagrammen (0.5) — de generieke diagram-motor (bewerkbare sandbox)

> Toegevoegd: 2026-07-03 (fase 1+2 van [`STUDIO-05-diagramcore-plan.md`](STUDIO-05-diagramcore-plan.md)).

De activiteit **Diagrammen (0.5)** draait op de nieuwe generieke motor
(`src/diagramcore/` + profiel `src/diagramprofielen/canoniek-uml/`) en is sinds
fase 2 een **bewerkbare sandbox**:

- **Eigen persistente store** (localStorage `studio05-canoniek-uml`, met
  undo/redo via zundo). Het UML-model wordt alleen ingeladen als de sandbox
  leeg is, of expliciet via **Diagram (0.5) → Herlaad uit UML-model** (met
  bevestiging bij lokale wijzigingen). Er wordt **nooit** ongevraagd
  teruggeschreven naar het UML-model.
- **Serialisatie (fase 4A)**: **Bestand → Exporteer V3 JSON…** downloadt
  het sandbox-model als V3-JSON; **Bestand → Importeer V3 JSON…** laadt een
  V3-bestand in de sandbox (met bevestiging — vervangt alles). De activiteit
  levert daarvoor een eigen Bestand-menu (zelfde patroon als de UML-IDE). Onder water werkt dit via
  **spiegel + delta**: de heenreis-adapter bewaart de volledige oude data als
  `bron`-bijlagen plus model-meta, de terug-adapter (`naarCanoniekModel`)
  reconstrueert daaruit de oude storevorm en de bestaande
  `storeNaarV3Model`/`v3ModelNaarStore` doen de rest — georkestreerd door
  `diagramprofielen/canoniek-uml/serialisatie.js` (`exporteerV3`/
  `importeerV3`), die bovendien het **default-diagram** ("overzicht", vaak
  hernoemd en zelf samengesteld) als gewone diagrammen-entry meeneemt en bij
  import terugzet, en alle diagram-verwijzingen hernoemt naar de canonieke
  V3-ids (V3 kent geen vrije element-ids). Elementen zonder
  V3-tegenhanger (zoals kaders) worden bij export gemeld en overgeslagen.
  Round-trip-tests: `diagramprofielen/canoniek-uml/terugreis.test.js`.
- **API-koppeling (fase 4B)**: **Bestand → Laden vanaf API…** haalt de
  versielijst op en laadt het actieve model of een gekozen versie in de
  sandbox (met bevestiging); **Bestand → Publiceer naar API…** maakt een
  nieuwe schema-versie aan (`POST /api/schema/model`, bron "studio-0.5",
  status "proposed") met daarna een optionele **Activeer #id…**-knop
  (`PUT /api/schema/model/{id}/activeer`, met bevestiging).
  Dialogen in `studio/activities/diagram05ApiDialogen.jsx`; de V3-vertaling
  loopt via dezelfde `exporteerV3`/`importeerV3`.
- **Terugschrijven (fase 4B)**: **Diagram (0.5) → Zet terug naar
  UML-model…** vervangt het model in de klassieke UML-activiteit door de
  sandbox (met bevestiging; de API blijft onaangeroerd) — de inverse van
  "Herlaad uit UML-model".
- **0.5-werkbestand**: elk 0.5-profiel heeft **Bestand →
  Exporteer/Importeer 0.5-werkbestand…** — het eigen formaat integraal als
  JSON (elements + diagrammen incl. viewports + meta, met profiel-check bij
  import). Zo is een handmatig geschoven view (bv. een OAS-import) deelbaar
  en niet aan localStorage gebonden.
- **Lijnvormen**: edges kennen `presentatie.vorm` — bezier (default),
  hoekig (orthogonaal) of recht. Het puur-UML-profiel gebruikt hoekig voor
  de klassieke UML-look.
- **Fabriek + tweede profiel (fase 5)**: de activiteit-mechaniek zit in
  `studio/activities/maakDiagramActiviteit.jsx` (descriptor + opties →
  complete activiteit; model-/V3-/API-koppeling optioneel). De activiteit
  **"UML (0.5)"** (`diagramprofielen/puur-uml/`) is de lakmoesproef: pure
  UML-klassediagrammen (klasse/interface/enumeratie/«dataType»,
  attributen/operaties met typen uit primitieven + datatypes + enumeraties,
  associatie mét attributen → associatieklasse via de ASOC-materialisatie,
  aggregatie ◇ én compositie ◆, generalisatie, realisatie, dependency) —
  eigen persistente store, start leeg. Associaties hebben bewerkbare
  kardinaliteiten en een **"gericht (→ doel)"**-vinkje (open pijl aan de
  doelzijde) via de nieuwe `hooks.edgePresentatie` op connector-typen:
  presentatie-overrides o.b.v. connector-data; markers reizen in de
  ASOC-gedaante mee naar de bron-/doel-edge.
- **Meta-editor: "Profiel (0.5)"** (trede 1, plan §8.9): bewerk een
  profiel-descriptor (JSON, de serialiseerbare Definitie-kern) en registreer
  hem live als activiteit — hooks op id uit de `HOOK_CATALOGUS`, profielen
  persistent in localStorage (overleven herlaad), sjablonen "leeg" en
  "Graaf-demo". Die demo gebruikt de nieuwe **"bol"-ShapeType** (§8.10-POC):
  naam in een ronde kern, velden als satelliet-bolletjes eromheen.
- **Derde profiel: "OAS (0.5)"** (`diagramprofielen/oas31/`, vuurproef op een
  niet-UML-domein): «schema»-elementen met properties (JSON-typen/formats,
  required), «enum», «operation» (method/pad/summary als element-properties
  met live signatuurregel op de node), en de connectoren **$ref** (met
  property-naam als rolnaam), **allOf** (overerving) en **items**
  (array-elementtype). Ook hier: alleen een descriptor + fabriek-aanroep.
  **Bestand → Importeer OAS 3.1 (YAML/JSON)…** leest een echt
  OpenAPI-document in (`oas31/adapter.js`, parser: `yaml`): schemas, enums,
  paths → operaties, en alle $ref/allOf/items-relaties als connectoren, met
  een grid-geplaatst diagram genoemd naar `info.title`. Export terug naar
  YAML is een later punt (eigen terugreis, vgl. canoniek-uml fase 4).
- **Gegevenstype-validatie bewerken**: validatie, normalisatie en weergave
  zijn element-properties van het gegevenstype met eigen PropertyTypeEditors
  (`ValidatieEditors.jsx`, datatypes "validatieregels"/"weergaveregels"):
  pattern, min/max-lengte (string) of minimum/maximum/veelvoud (numeriek —
  volgt het basistype), foutmelding, voorbeelden en checksum-regels;
  placeholder, invoermasker, prefix en suffix. De validatie-/weergave-regels
  op de node bewegen live mee (`extraCompartimenten`-hook, met
  `verbergInInspector` zodat de inspector ze niet dubbel toont) en de
  wijzigingen gaan als delta mee in de V3-export.
- **Taakbalken** (zwevend, versleepbaar, aan/uit via Diagram (0.5) →
  Taakbalken ▸): **Maken** (één knop per elementtype) en **Verbinding**
  (kies een connector-type; zonder keuze wordt het type automatisch afgeleid
  uit de verbindingsregels van het DiagramType). Ongeldige verbindingen worden
  op de canvas geweigerd.
- **Connectoren zijn elementen** met source/target (metamodel); de motor
  materialiseert ze als kale edges (compositie ◆, generalisatie ▷, «use»,
  relatie) — en een connector **mét velden** automatisch als het
  **ASOC-patroon** (anker + relatiebox + drie edges). ENT→ENT slepen maakt
  een REL; klik op een connector-edge of -anker selecteert de connector in
  de inspector; velden toevoegen laat de box live verschijnen ("normaliseer
  relaties" is ingebouwd gedrag).
- **Gegenereerde inspector**: het eigenschappen-paneel wordt opgebouwd uit
  `FieldType.editor`-regels van het profiel — naam, element-datavelden
  (notitietekst, constraint-expressie) en compartiment-velden met
  toevoegen/verwijderen.
- Multi-diagram: aanmaken (＋), hernoemen (✎) en verwijderen (×) in de sidebar;
  sneltoetsen Ctrl+Z/Ctrl+Y (undo/redo) en Delete (element van diagram,
  connector uit het model). Elementen zijn resizebaar (grootte wordt per
  diagram onthouden); de inspector heeft een colorpicker en een
  type-keuzelijst via het **PropertyType/ReferenceType-patroon** (plan §2,
  vierde iteratie): widgets uit de datatype-registry (string, tekst, boolean,
  colour, cel-expressie) en verwijzende properties via de
  **VerwijzingsKiezer** — keuzelijst met optgroups (✦ ◇ ▣) én een
  🔍-**minibrowser** met zoekveld en pad (domein), gevoed door de
  ReferenceResolvers van het profiel. Afleidingsregels openen de bestaande
  **CEL-ExpressieEditor** (hergebruikt uit de umleditor, lazy). Pan/zoom en
  het actieve diagram vallen buiten de undo-history.
- **Layout (fase 3A)**: core-taakbalk **Uitlijnen** (links/rechts/boven/onder,
  centreren, verdelen — op de selectie via Ctrl-klik — plus alles-op-raster)
  en de **Auto-layout**-taakbalk met de gelaagde plaatsingsstrategie van het
  profiel; ook via menu Diagram (0.5). Iedere layout-actie is één undo-stap.
  Verder is er een **Kader**-element (boundary, §8.6b): gestippeld resizebaar
  kader dat achter de andere elementen rendert.
- Taakbalken zijn **resizebaar** (hoekgreep: breed & plat of smal & hoog,
  persistent) en blijven bij het slepen binnen het canvas; het
  Taakbalken-menu toont ✓ voor zichtbare balken. De CEL-editor kent de
  **familie-context**: velden van de eigen en gerelateerde GE's
  (`Naam.roepnaam`) met autocomplete.
- **Rechtsklik** op canvas, nodes én edges opent een contextmenu (uitlijnen
  — grijs bij <2 geselecteerd —, auto-layout, normaliseer relaties, snap).
  **Normaliseren = kortste weg**: expliciete handles en de anker-positie
  worden gewist, waarna de materialisatie automatisch de beste zijden en
  het middelpunt kiest. Te bereiken via menu, contextmenu, de ↔-knop in de
  Uitlijnen-balk, of dubbelklik op een connector-edge (alleen die ene).
  Nieuwe elementen landen in het zichtbare viewport-midden.
  **Overgeërfde velden** verschijnen in het kind (generalisatie-keten,
  ↑-kopregel, cursief) — weergave-compartiment via de profiel-hook, geen
  modeldata.
- Nog niet (bekend): rebuild vanuit 0.5, clipboard,
  validatie-hook, domein-overlay, licht/donker-tokens
  per StyleType (plan §8.5b), integrale iconenset voor de Maken-balk
  (ontwerp-sessie, plan §8.6a), overerving in de gespiegelde weergave
  (generalisaties uit het oude model zijn daar nog presentatie-edges),
  YAML-export en oneOf/anyOf in het OAS-profiel.
  Het incidentele **transient lege canvas** is vermoedelijk opgelost
  (2026-07-04): node-rebuilds reconciliëren nu per id zodat React Flow de
  nodes niet her-initialiseert (fout #015) — graag melden als het nog
  optreedt. Na de fase 4-update een bestaande sandbox eerst verversen via
  "Herlaad uit UML-model" — anders missen de `bron`-bijlagen die de export
  verliesvrij maken.

## DMN-activiteit: DRD + Tabel met dmn-js

> Toegevoegd: 2026-06-18. dmn-js v17.8.1 integratie.

De DMN-activiteit (`dmnActivity.jsx`) combineert nu twee views in tabs:

- **DRD-tab**: de volledige dmn-js Modeler voor Decision Requirements Diagrams
- **Tabel-tab**: de bestaande DmnTableEditor voor beslistabellen met FieldRef-binding

### Architectuur

```
src/dmn/
  DmnModeler.jsx          ← React-wrapper voor dmn-js Modeler (forwardRef)
  DmnTreeBrowser.jsx      ← Tree-view van DRD-elementen + diagrammen
  DmnTableEditor.jsx      ← Bestaande beslistabel-editor (ongewijzigd)
  starterDmn.js           ← Voorbeeld DMN 1.3 XML met DRD
  dmnModel.js             ← Helpers voor tabel-model (ongewijzigd)
  index.js                ← Module-exports
```

### DmnModeler component

De `DmnModeler` is een React-wrapper die dmn-js integreert via `forwardRef`:

- **Import**: laadt DMN XML via `importXML(xml)`
- **Export**: haalt XML op via `exportXML()`
- **View-management**: `getViews()`, `openView(viewId)`, `getActiveView()`
- **Events**: luistert naar `views.changed` en roept `onViewChange` callback
- **CSS**: importeert alle dmn-js assets (diagram-js, dmn-font, dmn-js-shared)

De component gebruikt `useImperativeHandle` om een imperative API bloot te geven, vergelijkbaar met het BPMN-patroon.

### DmnTreeBrowser component

De sidebar toont een tree-browser (react-arborist) met twee secties:

1. **Diagrammen** (40% hoogte): DRD-views uit de Modeler
   - Klik op een view opent die view in de Modeler
   - Iconen: 📐 voor DRD, 📊 voor Decision Table, 📝 voor Literal Expression
2. **Canoniek model** (60% hoogte): ModelPicker voor veld-binding

De tree wordt dynamisch opgebouwd vanuit `dmnViews` (uit de Modeler) en groepeert views per type.

### Tab-systeem

De main-area heeft twee tabs:

- **DRD**: toont de dmn-js Modeler met volledige editing-capaciteiten
- **Tabel**: toont de DmnTableEditor met FieldRef-binding

Tab-state wordt gedeeld via de lokale React-context (`Ctx`).

### Menu-integratie

Het "Tabel"-menu exporteert context-afhankelijk:

- **DRD-tab actief**: exporteert DMN XML (`diagram.dmn`)
- **Tabel-tab actief**: exporteert tabel als JSON

### Starter DMN

`starterDmn.js` bevat een voorbeeld DMN 1.3 document met:

- 2 input data: `Leeftijd`, `Inkomen`
- 2 decisions: `Bepaal categorie` (4 regels), `Bepaal korting` (4 regels, chained)
- Volledige DMNDI layout met shapes en edges

### Volgende stappen

- Input/output variabelen mappen op metamodel-velden (FieldRef-binding voor DRD)
- DMN-evaluatie integratie met process engine
- Cross-referentie tussen DRD en tabel (decision → table mapping)
