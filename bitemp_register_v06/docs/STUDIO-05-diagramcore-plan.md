# Plan — Studio 0.5: generieke diagram-kern (diagramcore)

- **Datum:** 2026-07-02
- **Auteur:** Claude (Claude Code, Fable 5), op verzoek van Mark
- **Status:** vermoedelijke oorzaak **transient leeg canvas** gevonden en
  gefixt (2026-07-04, na React Flow-fout #015 in de console bij Mark): elke
  store-wijziging (elke toetsaanslag in de inspector) verving álle
  node-objecten, waardoor React Flow v12 ze compleet her-initialiseerde
  (meting `measured` zit op het node-object). Slepen in dat venster gaf
  #015 ("trying to drag a node that is not initialized"); tijdens de
  hermeting kon het hele canvas (tijdelijk) verborgen blijven — bij grote
  diagrammen (OAS-import, 100+ nodes) een flink venster. Fix: de rebuild
  **reconcilieert per id** en neemt het bestaande node-object als basis
  (measured/dragging/selected blijven bewaard; tijdens een actieve drag wint
  de sleep-positie). Stress-e2e (edit+drag-storm) blijft schoon; ook een
  prestatieverbetering. Praktijkbevestiging gevraagd — dit was de
  al drie keer gemelde heisenbug. Eerdere ronde: bugfix **multi-drag** (2026-07-03, gemeld bij het testen van de
  OAS-import): bij het slepen van een multi-selectie bleef alleen de
  daadwerkelijk gesleepte node op zijn nieuwe plek — `handleNodeDragStop`
  gebruikte alleen het tweede React Flow-argument, terwijl het derde álle
  meegesleepte nodes bevat; die gaan nu als bulk naar `onNodePosities`
  (met lidmaatschap-aanmaak voor auto-geplaatste connector-boxen).
  E2E: twee Ctrl-geselecteerde nodes samen verslepen → beide persistent,
  derde onaangeroerd. Eerdere stand: OAS 3.1 **YAML-import** (2026-07-03): *Bestand → Importeer
  OAS 3.1 (YAML/JSON)…* in de OAS-activiteit. Nieuwe pure adapter
  `diagramprofielen/oas31/adapter.js` (`vanOasDocument`):
  `components.schemas` → schema-/enum-elementen (properties met
  typen/formats, `required` → verplicht; `$ref`-properties → ref-connectoren
  met rolnaam; array-`items`-$refs → items-connectoren; `allOf` →
  allOf-connector + inline delen als eigen properties), `paths` →
  operatie-elementen met request-/response-refs (ook array-responses), en
  één grid-geplaatst diagram met de titel uit `info.title`. De fabriek
  kreeg daarvoor een **generiek `koppeling.importBestand`**-koppelpunt
  ({label, accept, verwerk(tekst) → coreModel}) en de Bestand-menu-items
  zijn per koppeling-onderdeel conditioneel. Parser: `yaml`
  (nieuwe dependency; YAML is een superset van JSON, dus .json werkt ook).
  Nog niet: YAML-export (terugreis) en oneOf/anyOf. Eerdere stand: fase 5-vuurproef: **OAS 3.1 als derde profiel** (2026-07-03,
  branch `feat/studio05-fase5`): activiteit **"OAS (0.5)"**
  (`diagramprofielen/oas31/` + fabriek-aanroep, verder niets). Schemas zijn
  elementen, verwijzingen connectoren: «schema» met properties
  (JSON-typen/formats, `verplicht` = OAS `required`), «enum», en «operation»
  — een element zónder bewerkbare compartimenten (method/pad/summary zijn
  element-properties, met een live "GET /personen/{id}"-weergaveregel via de
  `extraCompartimenten`-hook). Connectoren: **$ref** (gestippeld, met de
  property-naam als rolnaam), **allOf** (driehoek — compositie-overerving)
  en **items** (array-elementtype). Type-kiezer: JSON-primitieven (incl.
  formats) of een schema-$ref via de resolvers. Uitkomst van de vuurproef:
  **geen core- of shell-wijziging nodig** — descriptor-vocabulaire
  (compartimenten, properties, verbindingsregels, edge-presentatie, hooks)
  bleek toereikend voor een niet-UML-domein. Bewust nog niet: oneOf/anyOf,
  parameters/headers als elementen, YAML-import/-export (eigen
  serialisatie-fase, vgl. canoniek-uml fase 4). Eerdere ronde: fase 5-feedbackronde 1 (2026-07-03): **aggregatie** (◇) naast
  compositie en **associatie-richting**. Core: `ConnectorEdge` kent
  `markerStart: "ruit-open"` (zelfde pad-volgende geometrie, witte vulling —
  consistent met de generalisatie-driehoek, in beide thema's onderscheidbaar)
  en `materialiseerConnectoren` ondersteunt een **`hooks.edgePresentatie`**
  op het connector-ElementType: dynamische presentatie-overrides o.b.v. de
  connector-data (voorloper van de lijntypen-familie §8.5c). In de
  ASOC-gedaante verhuizen de markers mee (markerStart → bron-edge,
  markerEnd → doel-edge). Profiel puur-uml: aggregatie-connector, en op de
  associatie de properties kardinaliteit bron/doel + **"gericht (→ doel)"**
  (boolean; hook zet de open pijl). Eerdere stand: fase 4B afgerond + fase 5-lakmoesproef geslaagd (2026-07-03,
  branch `feat/studio05-fase4b`): (1) **4B-rest** — *Diagram (0.5) → Zet
  terug naar UML-model…* schrijft de sandbox terug naar de klassieke
  UML-activiteit (`naarCanoniekModel` → `useModelStore.loadModel`, met
  bevestiging; de API blijft onaangeroerd), en de publiceer-dialoog kreeg een
  **Activeer #id…**-knop (`PUT /api/schema/model/{id}/activeer`, met
  bevestiging — het register gaat die versie dan gebruiken). (2) **Fase 5**:
  de activiteit is gerefactord naar een fabriek
  (`studio/activities/maakDiagramActiviteit.jsx`) — descriptor + opties erin,
  complete activiteit (store, taakbalken, inspector, layout, menu's,
  optionele model-/V3-/API-koppeling) eruit; `diagramActivity.jsx` is nu een
  dunne aanroep. Het tweede profiel **puur-uml**
  (`diagramprofielen/puur-uml/`: klasse/interface/enumeratie, attributen +
  operaties, associatie mét attributen → **associatieklasse via de bestaande
  ASOC-materialisatie**, compositie, generalisatie, realisatie ⊳┄,
  dependency «use») draait als activiteit **"UML (0.5)"** zonder één regel
  core- of shell-wijziging — de abstractie houdt. Restpunten fase 5:
  zichtbaarheid (+/-/#), open aggregatie-ruit (marker-familie §8.5c), eigen
  auto-layout, eigen StyleType-tokens (§8.5b; leent nu "uml-klassiek").
  E2E: beide activiteiten naast elkaar, elk met eigen persistente store.
  Eerdere stand: fase 4B gestart (2026-07-03, branch `feat/studio05-fase4b`; 4A
  gemerged in `70e0141`): **laden vanaf en publiceren naar de Go-API** in het
  Bestand-menu van de 0.5-activiteit (`diagram05ApiDialogen.jsx`) — zelfde
  endpoints als de UML-IDE (`GET /api/schema/versies|model|model/{id}`,
  `POST /api/schema/model?opmerking=…` met `{bron: "studio-0.5", indiener,
  model}`). Laden toont de versielijst (of het actieve model) en vervangt de
  sandbox met bevestiging; publiceren maakt een nieuwe versie (status
  "proposed" — activeren blijft een aparte stap) en loopt via
  `exporteerV3` (dus incl. default-diagram en canonieke ids).
  E2E-geverifieerd tegen de echte API (laden versie-lijst + actief model;
  testpublicatie #91). Nog open in 4B: activeren/rebuild vanuit 0.5 en de
  terugschrijf-flow naar de UML-store. Eerdere ronde: fase 4A-feedbackronde (2026-07-03): (1) **round-trip-bug
  gefixt** — het default-diagram ("overzicht") kan hernoemd en samengesteld
  zijn (bv. "np-loc" met 29 van de 114 elementen), maar de oude adapters
  beschouwen het als afgeleid: export liet het weg en import reconstrueerde
  het met álles. De nieuwe `serialisatie.js` (profiel-laag; oude adapters
  ongemoeid) voert nu de hele V3-route (`exporteerV3`/`importeerV3`), neemt
  het default-diagram als gewone diagrammen-entry mee (mét edge-data:
  generalisaties!) en zet het bij import terug. Daarbij worden alle
  diagram-verwijzingen hernoemd naar de **canonieke V3-ids** die de import
  afleidt (entiteit → typenaam, GE → `Ent_naam`, enum → `enum_…`, …) — V3
  kent geen vrije element-ids, dus 0.5-ids als `el_…` zouden anders verweesde
  diagram-nodes geven. Diagram-samenstelling is nu stabiel over meerdere
  export/import-cycli (e2e-geverifieerd). (2) **Validatie-editor voor
  gegevenstypen** (was vergeten): validatie/normalisatie/weergave zijn nu
  element-properties met eigen PropertyTypeEditors ("validatieregels" en
  "weergaveregels" in de datatype-registry, `ValidatieEditors.jsx`) — pattern,
  lengtes (string) of bereik/veelvoud (numeriek, o.b.v. het basistype),
  foutmelding, voorbeelden, checksum-regels; placeholder/invoermasker/
  prefix/suffix. De validatie-/weergave-compartimenten op de node worden live
  gegenereerd via een `extraCompartimenten`-hook (voorheen statisch bij de
  heenreis), en de terugreis neemt de bewerkte waarden als delta mee naar V3.
  (3) Import/export verhuisd naar een eigen **Bestand**-menu (zelfde patroon
  als de UML-IDE). Eerdere stand: fase 4A opgeleverd (2026-07-03, branch `feat/studio05-fase4`):
  **serialisatie via spiegel + delta.** De heenreis (`vanCanoniekModel`) is
  verliesvrij gemaakt: elk element krijgt zijn volledige oude data als
  `data.bron`-bijlage, REL-connectoren de structurele edge als `data.bronEdge`,
  presentatie-edges hun ruwe edge-data als `data.bron`, en het model-brede deel
  (modelMeta, domains, domainMeta én `compositieEdges` — composities waarvan
  het kind op geen enkel diagram staat zouden anders verdwijnen) reist mee als
  `meta` (ook in de persist van de sandbox-store). De nieuwe **terug-adapter
  `naarCanoniekModel`** reconstrueert daaruit de oude storevorm (bron als
  basis, 0.5-bewerkingen als delta erover), waarna de bewezen
  `storeNaarV3Model`/`v3ModelNaarStore` uit `store/adapters.js` de V3-JSON
  doen. Menu *Bestand* (eigen bestand-menu van de activiteit, zoals de
  UML-IDE): **"Exporteer V3 JSON…"** (download; meldt elementen zonder
  V3-tegenhanger, zoals kaders) en **"Importeer V3 JSON…"** (file-picker,
  met bevestiging; vervangt de sandbox). Round-trip-tests in
  `canoniek-uml/terugreis.test.js` (V3-niveau op het demo-model + store-niveau
  met generalisatie/compositie/kardinaliteiten/afgeleid veld/delta-wint);
  e2e-geverifieerd incl. behoud van `entiteitSubtype` op refitem-entiteiten.
  Nog open in fase 4B: opslaan/publiceren via de API en de
  terugschrijf-flow naar het UML-model. Eerdere stand: fase 3B-feedbackronde 3 opgeleverd (2026-07-04): de
  kortste-weg-handles gelden nu ook **aan de anker-zijden** (ASOC-lijnen lopen
  strak door het anker, geen "haakje"; de link-edge vertrekt onderuit het
  anker naar de gecentreerde box) én voor **gespiegelde presentatie-edges**
  zonder handles — "Normaliseer relaties (alles)" wist daarom ook de handles
  van gespiegelde composities e.d. Lijntypen (recht/hoekig/boom) als
  connector-ShapeType genoteerd als §8.5c. Dev-hulp: `window.__diagram05Store`
  (alleen dev) voor e2e-tests en debugging. Eerdere ronde (2026-07-04):
  **normaliseren = kortste weg** — de materialisatie kiest automatisch de
  beste handle-zijden (op basis van relatieve posities) zodra een connector
  geen expliciete handles heeft; "Normaliseer relaties" (menu, contextmenu,
  ↔-knop in de Uitlijnen-balk, dubbelklik op een edge) wist de handles + de
  anker-positie en dwingt dat af. Rechtsklik werkt nu ook **op edges**
  (eigen contextmenu i.p.v. het browser-menu), en de **overgeërfde velden**
  staan ook in de inspector — als platte viewer-rijen (PropertyTypeViewer-
  kant, geen editors; `alleenWeergave` op het compartiment onderdrukt
  "+ veld"). Eerdere ronde (2026-07-04):
  **rechtsklik-contextmenu** op de canvas (uitlijnen met disabled-status,
  auto-layout, normaliseer, snap — core-raamwerk, acties uit de activiteit),
  **"Normaliseer relaties"** terug als menu-/contextmenu-actie én dubbelklik
  op een connector-edge (reset anker naar het middelpunt), nieuwe elementen
  landen in het **zichtbare viewport-midden**, **overgeërfde velden** in het
  kind via de `extraCompartimenten`-hook (generalisatie-keten, ↑-kopregel,
  cursief), veld-verwijderen ruimt box en anker op (kale gedaante), en het
  smalle-node-artefact is gefixt (resizer-minima = CSS-minima + overflow
  hidden). ⚠️ Onopgelost: incidenteel "leeg canvas" na inspector-bewerking +
  canvas-klik (derde melding; transient — diagramwissel herstelt; repro
  gezocht, graag console-output bij volgende keer). Fase 3B opgeleverd (2026-07-04): **ASOC-materialisatie in de
  core** — een connector mét velden materialiseert automatisch als anker +
  box + drie edges (synthetische canvas-nodes; anker-positie als
  `ankerPosition` op het diagram-lidmaatschap), zonder velden als kale edge.
  `relatie` is nu een écht `isConnector`-type: ENT→ENT slepen maakt een REL
  (generalisatie via expliciete keuze), edge-klik selecteert de connector in
  de inspector, en velden toevoegen laat het ASOC-patroon live verschijnen —
  het oude "normaliseer relaties" is daarmee ingebouwd gedrag. De adapter
  vouwt oude REL+anker+edges terug tot connector-elementen (bestaande
  sandbox: eerst "Herlaad uit UML-model"). Delete op box of anker verwijdert
  de connector. Restpunten fase 3: validatie-hook, uitgebreide
  zij-aan-zij-pariteitscheck. Fase 3A + feedbackronde opgeleverd (2026-07-04): uitlijn-balk
  met de vertrouwde SVG-iconen, taakbalken resizebaar (breed/plat of
  smal/hoog, persistent) en geclamped binnen het canvas, menubalk toont
  ✓-checkmarks per taakbalk (generiek `menu:ververs`-mechanisme in de shell),
  en de CEL-editor kent nu de **familie-context** (`GE.veld`-paden +
  autocomplete via `celContext.js`). Tweede feedbackronde: groep-separators in
  de uitlijn-balk, taakbalk-breedte gemaximeerd op de inhoud
  (`max-content`), kader met aparte rand- en achtergrondkleur + subtiele
  minimap-weergave, vers geplaatste elementen blijven geselecteerd, en de
  **undo-naar-leeg-bug** gefixt (persist-rehydratie telde als undo-stap;
  history wordt nu bij mount gewist). "Normaliseer relaties" keert terug in
  fase 3B (ASOC). **Layout-core** —
  uitlijnen/verdelen/snap-grid als pure geometrie in `diagramcore/layout/`
  met core-taakbalk "Uitlijnen" en menu-items; **auto-layout** als eerste
  `layouts`-strategie van canoniek-uml (hergebruikt `berekenAutoLayout`,
  eigen taakbalkje, één undo-stap); **boundary/kader-element** (§8.6b,
  `achtergrond: true` → onder de nodes). Nog te doen in fase 3B:
  ASOC-materialisatie (REL als echt connector-type), validatie-hook,
  pariteitscheck. Inspector-stap opgeleverd (2026-07-04): code getrokken op de
  metamodel-naamgeving — `PropertyType` (met **datatype-registry**: string,
  tekst, boolean, colour + profiel-eigen "cel-expressie"),
  `ReferenceType`/`ReferenceResolver` gesplitst (Definitie/Implementatie,
  descriptor blijft node-testbaar), `FieldTypeViewer` (rij-weergave),
  **VerwijzingsKiezer met minibrowser** (zoeken + per soort/pad), en de
  bestaande **CEL-ExpressieEditor** hergebruikt als PropertyTypeEditor.
  Fase 2 opgeleverd (2026-07-03): de activiteit is een **bewerkbare
  sandbox** (eigen persistente store + undo/redo) — elementen maken via de
  "Maken"-taakbalk, verbinden via "Verbinding" met verbindingsregels
  (connector-elementen + kale-edge-materialisatie), gegenereerde inspector uit
  `FieldType.editor` (incl. colorpicker en type-keuzelijst uit de
  modelcontext), element-resize (size per diagram-lidmaatschap), connecties
  wissen met Delete, viewport/actief-diagram buiten de undo-history.
  **Restpunten fase 2**: clipboard, checkmarks in het taakbalken-menu,
  herbruikbare CEL-expressie-editor als custom inspector-widget
  (widget-registry), rijkere details-pariteit (beschrijving/meervoud/subtype/
  supertype). Verbinden naar een REL en de layout-taakbalk zijn fase 3
  (ASOC-materialisatie resp. §4.5); terugschrijven naar het UML-model fase 4;
  thema-tokens per StyleType zie §8.5b.
  Fase 1 (2026-07-03): read-only spiegel. Fase 0 (2026-07-02): besluiten,
  `apiBase`, typecontract.
- **Context:** [`STUDIO.md`](STUDIO.md), [`STUDIO-code-review-2026-06-30.md`](STUDIO-code-review-2026-06-30.md)

## 1. Doel

De UML-editor in de Studio is nu een **concrete** editor voor het canonieke datamodel
(Entiteit, GE, REL, enumeraties, …). De onderliggende principes — een diagram is een
verzameling elementen, elementen leven in één model en kunnen op meerdere diagrammen
staan, connectoren verbinden elementen, elementen hebben compartimenten met velden —
zijn echter **algemeen**. Dit plan trekt die principes naar een abstractielaag
(**diagramcore**) die per *diagramtype* configureerbaar is, zodat dezelfde motor ook
andere representaties kan dragen:

- een **puur UML**-klassediagram (zonder Entiteit/GE/REL-semantiek),
- een **OAS 3.1**-specificatie (schemas, paths, components),
- een **GraphQL**-schema (types, fields, relaties),
- een **DRD** (DMN Decision Requirements Diagram),
- op termijn wellicht een **sequence diagram** (zie kanttekening §8).

De huidige, werkende versie blijft **parallel en onaangetast** bestaan als backup
(§6 beantwoordt "kan dat?" — ja).

## 2. Het metamodel

Het doel-metamodel (derde iteratie, 2026-07-02). De drie `namespace`-blokken
groeperen de klassen in domeinen zodat mermaid ze bij elkaar rendert — dit zijn
tegelijk de architectuurlagen: **Model** (instantie-data van de gebruiker),
**Definitie** (declaratieve configuratie, JSON-serialiseerbaar) en
**Implementatie** (code: hooks, shapes, stijlen):

```mermaid
classDiagram
    namespace Model {
      class User
      class Workspace
      class TaskbarConfiguration
      class Diagram {
        name
        size
        scale
      }
      class Element {
        name
      }
      class Connector
      class Compartment
      class Field {
        name
      }
      class Position {
        elementposition coordinates 0..1
        elementSize 0..1
        sourceHandle 0..1
        targetHandle 0..1
      }
    }
    namespace Definitie {
      class DiagramType { name }
      class TaskbarType { name }
      class ActionType { name }
      class ElementType { name }
      class CompartmentType { name }
      class FieldType { name }
      class PropertyType {
        name
        type
      }
      class ReferenceType { name }
    }
    namespace Implementatie {
      class ActionHook
      class StyleType { name }
      class ShapeType { name }
      class FieldTypeViewer
      class PropertyTypeViewer
      class PropertyTypeEditor
      class ReferenceResolver
    }

    User *-- "0..*" Workspace
    Workspace o-- "0..*" Diagram
    Workspace *-- "0..*" TaskbarConfiguration
    TaskbarConfiguration --> TaskbarType
    TaskbarConfiguration --> DiagramType
    TaskbarConfiguration o-- "1..*" ActionType

    Diagram o-- "0..*" Element
    Connector --|> Element
    Connector --> Element : source
    Connector --> Element : target
    Element *-- "0..9 (ordered)" Compartment
    Compartment *-- "0..* (ordered)" Field
    Position .. Diagram : associatieklasse op Diagram–Element
    Position .. Connector : en op source/target

    Diagram --> DiagramType
    Element --> ElementType
    Compartment --> CompartmentType
    Field --> FieldType

    DiagramType *-- ElementType
    ElementType *-- "0..9 (ordered)" CompartmentType
    CompartmentType *-- FieldType
    DiagramType o-- "0..*" TaskbarType
    TaskbarType o-- "1..*" ActionType

    FieldType o-- "0..*" PropertyType
    PropertyType o-- "0..*" ReferenceType

    ActionType --> ActionHook
    DiagramType --> StyleType
    StyleType *-- ShapeType
    ElementType --> ShapeType
    FieldType --> FieldTypeViewer
    PropertyType --> PropertyTypeViewer
    PropertyType --> PropertyTypeEditor
    ReferenceType --> ReferenceResolver
    FieldTypeViewer ..> PropertyTypeViewer : uses
    PropertyTypeEditor ..> ReferenceResolver : uses
```

*(Mermaid kent geen echte associatieklasse-notatie; de gestippelde lijnen bij
`Position` benaderen die. Ook de taakbalk-plek op het scherm is zo'n
associatie-attribuut, op Workspace–TaskbarConfiguration.)*

Lezing:

- **Model-domein**: de *data* die de gebruiker maakt — `Diagram`, `Element`,
  `Connector`, `Compartment`, `Field` — plus de gebruikerscontext: `User`,
  `Workspace` en `TaskbarConfiguration`.
- **Definitie-domein**: `DiagramType` t/m `FieldType`, `TaskbarType`, `ActionType`
  — de declaratieve *configuratie* die beschrijft wat er mogelijk is. Eén
  DiagramType = één "profiel" (canoniek-UML, OAS 3.1, GraphQL, …). Dit domein is
  per constructie JSON-serialiseerbaar — en daarmee de kandidaat voor het
  configuratie-register (§8.5).
- **Implementatie-domein**: `ActionHook`, `StyleType`, `ShapeType`,
  `PropertyTypeViewer`/`PropertyTypeEditor`, `ReferenceResolver` — de *code*
  waar de definities naar verwijzen. `ActionType → ActionHook` formaliseert de
  splitsing declaratief/code die het plan al maakte: het *wat* (naam, plek in
  menu/balk) staat in de definitie, het *hoe* is een frontend-hook, gekoppeld op
  id. Hetzelfde geldt voor `ElementType → ShapeType`: betekenis in de definitie,
  vorm (class-box, note, diamant, pill) in code.
- **Property-laag (vierde iteratie, 2026-07-04)**: een `FieldType` (attribuut,
  afgeleidVeld, …) heeft 0..* **`PropertyType`s** (naam, **datatype**) — de
  eigenschappen van zo'n veld (naam, type, verplicht, afleidingsregel, …).
  Elke PropertyType heeft een **viewer** (tonen) en een **editor** (bewerken)
  in het Implementatie-domein, gekoppeld via een **registry op datatype**:
  `string` → tekstveld, `boolean` → checkbox, `colour` → colorpicker,
  `cel-expressie` → CEL-editor, … Het datatype-assortiment is dus uitbreidbaar
  (een kleur is gewoon een waardenruimte die de widget zelf kent) zonder dat
  de core-inspector verandert; declaratief blijft het één string.
  Is de waarde een *verwijzing* — kandidaten die uit het model of runtime
  komen — dan somt de PropertyType 0..* **`ReferenceType`s** op (basistype,
  gegevenstype, enum, ref.lijstitem, …), elk met een **`ReferenceResolver`**
  die de kandidaten levert; de editor gebruikt die resolvers om de keuze aan
  te bieden (keuzelijst nu, minibrowser later — §4.5b). Regel: heeft een
  PropertyType ReferenceTypes, dan kiest de editor via resolvers; anders
  bepaalt het `datatype` de widget. Dit generaliseert de in fase 2 gebouwde
  `EditorRegel`/`VerwijzingsBron` (de code wordt bij de volgende
  inspector-stap op deze naamgeving getrokken).
- **`FieldTypeViewer`** (veld-weergave op de node): naast de
  inspector-weergave (alle PropertyTypes) heeft elk veld een compacte
  rij-weergave in het compartiment (bv. `postcode  NLPostcode`, vet bij
  verplicht, "/" bij afgeleid). De FieldTypeViewer is de veld-tegenhanger van
  `ElementType → ShapeType` en **componeert de PropertyTypeViewers** (uses):
  hij bepaalt welke properties zichtbaar zijn en hoe ze de regel beïnvloeden,
  het tonen zelf hergebruikt dezelfde viewers als de inspector. In de code
  heet dit nu `FieldType.render`. Wie in het register een FieldType
  definieert, kiest dus twee dingen: de PropertyTypes én de FieldTypeViewer.
- **`Position` is een associatieklasse** op Diagram–Element (elementpositie en
  -grootte per *diagram-lidmaatschap*, niet op het element zelf — zodat één
  element op meerdere diagrammen kan staan) en op de `source`/`target`-uiteinden
  van een connector (`sourceHandle`/`targetHandle`). Dit is exact hoe de
  implementatie het nu al doet: `DiagramDef.nodes[].position` en de handles op de
  React Flow-edges. Metamodel en praktijk zijn hier dus al in lijn.
- Een `Connector` is een **speciaal element** (met `source`/`target`) — geen apart
  concept. Dat is precies wat het bestaande ASOC-patroon al impliceert: een relatie
  mét velden materialiseert als node (anker + klasse-box), een relatie zonder
  velden als kale edge.
- **Taakbalken**: een `DiagramType` levert 0..* `TaskbarType`s met elk 1..*
  `ActionType`s (de *definitie*: welke balken kunnen er zijn); een
  `TaskbarConfiguration` in de `Workspace` legt vast hoe een gebruiker ze
  daadwerkelijk gebruikt — welke balken aan staan, waar ze staan, eventueel met
  een eigen actie-selectie (§4.6).
- **`Workspace`** is een dun maar handig tussenlaagje: de plek waar
  gebruikersvoorkeuren (taakbalk-configuratie, open diagrammen, paneel-standen)
  wonen, gescheiden van het model zelf. In de implementatie is dit aanvankelijk
  gewoon het localStorage-profiel van de browser (één impliciete workspace);
  het concept geeft een natuurlijk groeipad naar benoemde workspaces en
  server-side voorkeuren per `User`.
- `size`/`scale` op `Diagram` ≈ de bestaande `viewport {x, y, zoom}`; de
  `{ordered}`-annotaties op compartimenten en velden nemen we over als
  volgorde-behoudende arrays (dat zijn ze nu al).
- **Tags** (meta-informatie op alles) worden bewust **uitgesteld**; het model krijgt
  wel alvast een `data`-vrijveld per instantie zodat tags later niet-breaking passen.

## 3. Mapping op de huidige code

De verrassend goede boodschap: de **instantie-kant bestaat al bijna generiek**.
De type-kant is wat nu hardgecodeerd is.

| Metamodel | Huidige code | Oordeel |
|---|---|---|
| `Diagram` | `DiagramDef` in `useModelStore` (`{id, naam, nodes, edges, viewport}`) | ✅ al generiek; posities per diagram, element op meerdere diagrammen |
| `Element` | `ModelElement` (`{id, naam, type, domein, data}`) flat record | ✅ al generiek; `type` is nu een vrije string |
| `Connector` | `structuralEdges` + het REL/ASOC-patroon (`verversAsocVoorRelaties`) | ⚠️ verspreid: edge-vorm in de store, node-vorm (anker) als speciaal geval |
| `Position` (associatieklasse) | `DiagramDef.nodes[].position` + `sourceHandle`/`targetHandle` op diagram-edges | ✅ bestaat al precies zo |
| `User`/`Workspace` | impliciet: het localStorage-profiel van de browser (`useStudioStore`, `ide-model-store`) | ⚠️ bestaat als opslag, niet als concept |
| `TaskbarConfiguration` | — (balkjes altijd zichtbaar, stand niet instelbaar) | ❌ ontbreekt |
| `Compartment` | hardgecodeerde secties in de node-componenten (velden / afgeleide velden / overerving in `EntiteitNode` e.a.) | ❌ niet gemodelleerd; per component uitgeschreven JSX |
| `Field` | `velden[]` / `afgeleideVelden[]` / `waarden[]` in `element.data` | ⚠️ bestaat als data, maar vorm per elementtype verschillend |
| `DiagramType` | impliciet: er is er precies één (het canonieke model) | ❌ ontbreekt |
| `ElementType` | de `nodeTypes`-map in `DiagramCanvas.jsx` + 9 node-componenten + `METATYPES`/factories in `metamodel/types.js` | ❌ hardgecodeerd, code i.p.v. configuratie |
| `CompartmentType`/`FieldType` | JSX in de node-componenten + `VELDTYPEN` + `NodeEditPanel`/`DetailsPanel` per type | ❌ hardgecodeerd |
| `StyleType`/`ShapeType` | `editor.css` + inline kleuren (`defaultKleur`) + per-component markup | ❌ vermengd met de elementtypen; kleuren deels hardgecodeerd (zie code review §4) |
| `TaskbarType`/`ActionType` | de zwevende "Layout"/"Verbinding"/"Maken"-balkjes, hardgecodeerd in de IDE-canvas | ❌ niet configureerbaar, niet via het menu aan/uit te zetten |

UML-specifieke logica die nu door de generieke lagen heen geweven zit (en dus naar
een **profiel** moet verhuizen):

- het ASOC/anker-patroon (`useModelStore.verversAsocVoorRelaties`, delen van
  `materialiseerDiagramEdges` in `DiagramCanvas.jsx`),
- edge-materialisatie-regels (ENT→GE-compositie, dependencies «use», generalisatie),
- transformaties (`ide/transformations.js`), rep-creatie (`ide/repCreation.js`),
- validatie (`umleditor/validatie/`), overerving (`useOvergeerfdeVelden`),
- import/export (V3-model, XMI, Mermaid, PlantUML) en publiceren/rebuild.

Generiek herbruikbaar (blijft **core**): store-vorm + undo (zundo) + persist,
multi-diagram, clipboard/kopiëren-plakken, selectie, uitlijnen/verdelen/auto-layout,
snap-grid, pan/zoom/viewport, drag & drop vanaf een tree, node-resize, thema.

## 4. Architectuurvoorstel

### 4.1 Pakketstructuur

```
src/diagramcore/                 ← de generieke motor (géén domeinkennis)
  model/
    createDiagramStore.js        ← store-factory (generalisatie van useModelStore)
    schema.js                    ← @typedef's: Diagram, Element, Connector, Compartment, Field
  types/
    typeRegistry.js              ← registreer/resolve DiagramType-descriptors
    schema.js                    ← @typedef's: DiagramType, ElementType, CompartmentType,
                                    FieldType, StyleType, ShapeType
  canvas/
    DiagramCanvas.jsx            ← generieke React Flow-wrapper (dun; leest store + types)
    ElementNode.jsx              ← één generieke node: header + 0..9 compartimenten
    ConnectorEdge.jsx            ← generieke edge (labels, kardinaliteit, pijlstijlen)
    materialiseerConnectoren.js  ← generiek: connector-met-compartimenten → node + link-edges
  shapes/
    shapeRegistry.js             ← ShapeType-id → React-component
    ClassBoxShape.jsx, NoteShape.jsx, DiamondShape.jsx, PillShape.jsx, …
  inspector/
    ElementInspector.jsx         ← gegenereerd eigenschappen-paneel o.b.v. Field/CompartmentTypes
  layout/                        ← uitlijnen/verdelen/snap-grid (pure geometrie) +
                                    infrastructuur voor plaatsingsstrategieën (zie §4.5)

src/diagramprofielen/            ← één map per DiagramType ("profiel")
  canoniek-uml/                  ← het bestaande domein, als configuratie + hooks
    index.js                     ← DiagramType-descriptor
    elementTypes.js              ← entiteit, gegevenselement, relatie, enumeratie, …
    connectorRegels.js           ← wie mag met wie verbinden, ASOC-materialisatie
    serialisatie.js              ← V3-import/-export (hergebruikt bestaande functies)
    validatie.js                 ← hergebruikt umleditor/validatie
  puur-uml/                      ← fase 5: klasse/attribuut/operatie/associatie
  oas31/                         ← later
  …

src/studio/activities/
  diagramActivity.jsx            ← nieuwe activiteit "Diagrammen (0.5)" — naast umlActivity
```

De core kent **geen enkel** profiel; profielen kennen de core. Studio-activiteiten
binden een profiel + store + canvas aan de shell.

### 4.2 De descriptors (types-als-data, hooks-als-code)

Kern-ontwerpkeuze: descriptors zijn **plain objects** met een JSON-serialiseerbare
kern (id's, labels, compartimenten, shapes, verbindingsregels) plus optionele
**functie-hooks** voor wat niet declaratief kan (validatie, afgeleide weergave,
custom inspector-secties). Zo blijft de weg open om descriptors ooit in het
register zelf op te slaan (§8), terwijl we nu volle expressiekracht houden.

```js
/** ElementType (schets) */
{
  id: "entiteit",
  label: "Entiteit",
  stereotype: "«entiteit»",          // header-regel; mag functie zijn: (el) => string
  shape: "class-box",                // ShapeType-id binnen de StyleType
  kleur: "#bfdbfe",                  // default; instantie kan overriden
  isConnector: false,
  compartments: [                    // max 9, volgorde = tekenvolgorde
    { id: "velden",   label: null, fieldType: "attribuut" },
    { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
  ],
  hooks: { valideer, extraSecties }  // optioneel, niet-serialiseerbaar
}

/** ElementType van een connector */
{
  id: "relatie",
  isConnector: true,
  bron: { elementTypes: ["entiteit"], kardinaliteiten: ["0..1","1","0..*","1..*"] },
  doel: { elementTypes: ["entiteit"], kardinaliteiten: [...] },
  compartments: [ { id: "velden", fieldType: "attribuut" } ],
  // materialisatie: zonder velden → edge; met velden → node + ankerpatroon
  materialiseerAlsNode: (el) => (el.data.velden?.length ?? 0) > 0,
}

/** FieldType */
{
  id: "attribuut",
  render: "naam-type",               // ingebouwde regel-renderers: "naam-type" | "tekst" | "waarde"
  editor: [                          // genereert de inspector
    { key: "naam",      widget: "text",   verplicht: true },
    { key: "type",      widget: "select", opties: (ctx) => ctx.veldtypen },
    { key: "verplicht", widget: "checkbox" },
  ],
}

/** DiagramType */
{
  id: "canoniek-uml",
  label: "Canoniek datamodel",
  style: "uml-klassiek",             // StyleType
  elementTypes: [entiteit, gegevenselement, relatie, enumeratie, …],
  taakbalken: [                      // TaskbarTypes (§4.6); acties afgeleid of expliciet
    { id: "maken",       acties: "elementTypes" },   // één Action per niet-connector-elementtype
    { id: "verbinding",  acties: "connectorTypes" }, // kiest de edge-mode (vgl. Compositie/Generalisatie)
    { id: "auto-layout", acties: "layouts" },        // de plaatsingsstrategieën als knoppen
  ],
  layouts: [                         // plaatsingsstrategieën (DiagramType-afhankelijk, §4.5)
    { id: "gelaagd", label: "Auto-layout (heel diagram)", run: (model, diagram, selectie) => posities },
  ],
  serialisatie: { exporteer, importeer },   // profiel-eigen formaten
  menus: (ctx) => [...],             // optioneel: extra menubalk-items (zelfde vorm als nu)
}
```

### 4.3 De generieke node

Eén `ElementNode` vervangt de negen huidige node-componenten. Hij rendert:

1. de **shape** (via `shapeRegistry`, met thema-bewuste `--s-*`-kleuren — dit lost
   meteen code-review-punt §4 op voor de nieuwe motor),
2. de **header** (stereotype + naam + badges, uit de ElementType),
3. de **compartimenten** (0..9) met per compartiment de velden via de
   `FieldType.render`-regelrenderer,
4. de standaard acht handles + `NodeResizer` (identiek aan nu).

Bestaande specials worden hooks: overgeërfde velden (canoniek-uml-hook die een
extra compartiment aanlevert), de domein-overlay, notitie/constraint als eigen
ShapeTypes (`note`, `rounded`).

### 4.4 Store en connectoren

`createDiagramStore({ persistKey, diagramTypeId })` levert per activiteit/profiel
een eigen Zustand-store met exact de bewezen vorm van `useModelStore`
(elements / diagrams / undo / persist / isDirty), maar:

- **zonder** `verversAsocVoorRelaties` — connector-materialisatie wordt een
  core-algoritme (`materialiseerConnectoren.js`) dat per connector-ElementType
  beslist: kale edge, of node + bron-edge + doel-edge + link-edge (het huidige
  ASOC-patroon, veralgemeniseerd);
- connectoren zijn elementen met `source`/`target` (conform het metamodel) i.p.v.
  een aparte `structuralEdges`-lijst; de diagram-edges blijven puur visueel
  (handles, routing) en worden uit de connectoren afgeleid;
- eigen `persistKey` (bv. `"studio05-<profiel>"`) zodat localStorage nooit botst
  met de bestaande `ide-model-store`.

### 4.5 Layout: uitlijnen is core, plaatsen is profiel

Twee wezenlijk verschillende soorten "layout", met een verschillende plek:

- **Uitlijn-/schikfuncties zijn pure geometrie** en dus **core**: links/rechts/
  boven/onder uitlijnen, horizontaal/verticaal centreren en verdelen, snap-grid.
  Ze werken uitsluitend op posities en bounding-boxes van de selectie en weten
  niets van elementtypen. Deze verhuizen ongewijzigd van gedrag uit
  `umleditor/metamodel/autoLayout.js` / `DiagramCanvas` naar `diagramcore/layout/`.
- **Element-plaatsing (auto-layout) is semantiek** en dus **profiel**: het huidige
  auto-layout weet dat entiteiten bovenaan horen, GE's eronder, ankers op het
  middelpunt — dat is canoniek-uml-kennis. Een OAS-profiel wil een boom, een DRD
  een gelaagde requirements-flow, een sequence-diagram een strikte verticale
  ordening. Daarom levert de **DiagramType** één of meer `layouts`-strategieën
  aan (zie descriptor in §4.2): een functie `(model, diagram, selectie) → posities`.
  De core levert de omliggende infrastructuur (toepassen, undo-integratie,
  `layoutLocked` respecteren, animatie) en eventueel herbruikbare bouwstenen
  (gelaagde/boom-layout als bibliotheekfunctie waar profielen hun regels in
  prikken).

**Doorwerking in de menubalk.** De nieuwe `diagramActivity` bouwt zijn
Beeld-menu samen uit twee bronnen, via het bestaande `buildMenus`/`menuBus`-
mechanisme van de shell:

1. **core-items, altijd aanwezig**: *Uitlijnen ▸* (links/rechts/boven/onder,
   centreren, verdelen) en *Uitlijnen op raster* — voor élk diagramtype identiek,
   dus één keer gedefinieerd in de core en niet meer per activiteit gekopieerd
   (nu staat dit hardgecodeerd in `umlActivity.jsx`);
2. **profiel-items, uit de descriptor**: de `layouts`-strategieën verschijnen
   automatisch als menu-items (bv. *Auto-layout (heel diagram)* / *(selectie)*),
   en `menus` laat een profiel daarnaast vrije extra items toevoegen (zoals nu
   *Relaties normaliseren*, dat ASOC-kennis heeft en dus bij canoniek-uml hoort).

Zo blijft de menustructuur consistent over diagramtypen heen, terwijl de inhoud
per DiagramType meebeweegt.

### 4.5b Verwijzingen kiezen: het VerwijzingsBron-patroon

Veel veld-regels zijn geen vrije tekst maar een **verwijzing** naar iets anders
in (of buiten) het model: het type van een UML-attribuut (basistype |
gegevenstype | enumeratie | ref.lijstitem), een `$ref` in OAS 3.1, een
`typeRef`/itemDefinition in DMN, een type in GraphQL. De verleiding is om
hiervoor per geval een keuzelijst te bouwen — dan groeit er domeinkennis in de
inspector. Het patroon in plaats daarvan:

- **De pluriformiteit zit niet in het FieldType maar in de verwijzing.**
  "attribuut" blijft één FieldType; zijn type-property is een keuze waarvan de
  kandidaten uit meerdere soorten bronnen komen.
- **Metamodel-vorm (vierde iteratie)**: de property is een **`PropertyType`**
  van het FieldType; verwijst hij, dan somt hij **`ReferenceType`s** op
  (Definitie, register-klaar) en levert per ReferenceType een
  **`ReferenceResolver`** (Implementatie) de kandidaten —
  `resolver(ctx) → [{ waarde, label, icoon, groep, pad }]`, met in `ctx` het
  model en het element/veld voor contextuele filtering. Canoniek-uml heeft er
  vier: basistypen (statisch), gegevenstypen ✦, enumeraties ◇ en
  ref.lijstitems ▣. Een OAS-profiel levert straks "schemas" en
  "primitieven+formats"; DMN levert "FEEL-basistypen" en "itemDefinitions".
  Zelfde interface, ander lijstje. *(De fase 2-code heet nog
  `EditorRegel`/`VerwijzingsBron` — één object dat declaratie en code mengde;
  de metamodel-splitsing PropertyType/ReferenceType↔Resolver is zuiverder en
  wordt bij de minibrowser/CEL-stap in de code doorgevoerd.)*
- **Twee weergaven op dezelfde bronnen**:
  1. *nu*: een gegroepeerde keuzelijst (optgroups per bron, icoontjes zoals de
     oude editor: ✦ ◇ ▣);
  2. *later*: de **minibrowser** — een popover met zoekveld en een boom
     (`pad`, bv. domein/package → soort → item) om binnen context te kiezen,
     zoals de gebruiker voorstelt. Zelfde `VerwijzingsBron`-interface, alleen
     een rijkere kiezer; herbruikbaar overal waar naar elementen verwezen
     wordt (doel-entiteit, scopeRefs, DMN-binding, …).

### 4.6 Taakbalken (TaskbarType/Action)

De huidige zwevende balkjes op het canvas ("Layout", "Verbinding", "Maken") worden
een first-class concept, conform het metamodel (`DiagramType ◇— 0..* TaskbarType`,
`TaskbarType ◇— 1..* ActionType`, met `ActionType → ActionHook` voor de
implementatie):

- **Het raamwerk is core**: een generiek `Taskbar`-component (zwevend/versleepbaar,
  zoals nu), plus **aan/uit zetten via het menu** — `Beeld → Taakbalken ▸` met
  afvinkbare items, automatisch gegenereerd uit de taakbalk-lijst van het actieve
  DiagramType. Dat kon eerder niet goed omdat er geen menubalk was; nu die er is,
  hoort dit standaard in de core. Welke balken aan staan en waar ze staan is
  **gebruikersvoorkeur**, in het metamodel geformaliseerd als
  `TaskbarConfiguration` binnen de `Workspace`: per diagramtype onthouden in de
  studio-store (localStorage = de impliciete workspace van de lokale gebruiker) —
  net als de paneel-standen nu, met een groeipad naar server-side voorkeuren per
  `User`.
- **De samenstelling is DiagramType-configuratie**: welke balken er zijn en welke
  acties erop staan, komt uit de descriptor (`taakbalken` in §4.2). De acties
  kunnen **afgeleid** zijn uit de rest van de descriptor of expliciet opgesomd:
  - **"Maken"** — één actie per niet-connector-ElementType (klik-om-te-plaatsen
    of slepen), vergelijkbaar met de huidige ENT/GE/REL/ENUM/…-knoppen;
  - **"Verbinding"** — één actie per connector-ElementType; zet de edge-mode voor
    de volgende handle-drag (zoals nu Compositie/Generalisatie);
  - **"Auto-layout"** — een eigen balkje met de `layouts`-strategieën van het
    profiel (dezelfde acties als de menu-items uit §4.5, maar één klik dichterbij);
  - eventueel meer, met expliciete `Action`-lijsten (bv. een validatie- of
    publiceer-balkje) — het raamwerk is er niet aan gebonden.
- **Uitzondering**: het **uitlijn-balkje** (pure geometrie, §4.5) is core en bij
  elk diagramtype beschikbaar; het staat buiten de DiagramType-configuratie, maar
  is via hetzelfde menu aan/uit te zetten.

Menu-acties en taakbalk-acties delen dezelfde onderliggende `ActionType`-definitie
(id, label, icoon) met een `ActionHook` als implementatie, zodat een actie maar
één keer gedefinieerd wordt en zowel in het menu als op een balk kan verschijnen.

## 5. Wat is core, wat is profiel

| Core (diagramcore) | Profiel (bv. canoniek-uml) |
|---|---|
| store-factory, undo, persist, isDirty | element- en connector-typen, compartimenten, veldtypen |
| multi-diagram, element-op-meerdere-diagrammen | verbindingsregels + ASOC-materialisatiebeslissing |
| generieke node/edge, shapes, stijlen, thema | stereotype-teksten, kleuren, badges |
| selectie, clipboard, drag & drop, resize | validatieregels, overervings-weergave |
| uitlijnen, verdelen, snap-grid (pure geometrie) + menu-items daarvoor | plaatsings-/auto-layout-strategieën (`layouts`) + eigen menu-items (§4.5) |
| layout-infrastructuur (toepassen, undo, `layoutLocked`) | import/export (V3, XMI, Mermaid, PlantUML), publiceren |
| taakbalk-raamwerk: zweven/verslepen, aan/uit via `Beeld → Taakbalken ▸`, `TaskbarConfiguration` in de workspace + het uitlijn-balkje | taakbalk-samenstelling (`TaskbarType`s + `ActionType`s): Maken, Verbinding, Auto-layout, … (§4.6) |
| gegenereerde inspector (uit FieldTypes) | custom inspector-secties (bv. afleidingsregels/CEL) |
| tree-browser-koppeling (generiek itemmodel) | tree-inhoud (domeinen → entiteiten → GE's) |

## 6. Parallel naast de huidige versie — kan dat? Ja.

De Studio is hier al op gebouwd; er hoeft **niets** aan bestaande modules te
veranderen:

1. **Nieuwe activiteit** `diagramActivity` ("Diagrammen (0.5)", eigen icoon,
   groep "modelleren") wordt geregistreerd in `activities/index.jsx` naast de
   bestaande `umlActivity`. De oude UML-IDE blijft ongewijzigd bereikbaar — als
   activiteit én via `ide.html`.
2. **Eigen store-namespace** (`studio05-*` persist-keys) — geen botsing met
   `ide-model-store`; beide kunnen tegelijk open staan.
3. **Lazy loading** (zoals `umlActivity` al doet) — de nieuwe motor kost de
   bestaande bundle niets.
4. **Lezen zonder schrijven**: fase 1 gebruikt een adapter die het bestaande
   model uit `useModelStore` (of de API) *importeert* naar de nieuwe store;
   het schrijft nooit terug totdat we daar expliciet voor kiezen.
5. **Geen dubbele waarheid** in git: de oude code wordt niet geforkt of
   gekopieerd; de nieuwe motor is nieuwe code ernaast. Pas bij de omschakeling
   (fase 6) verhuist/verdwijnt oud spul, en dat is een aparte beslissing.

Risico van parallel draaien: tijdelijke duplicatie van *functionaliteit* (twee
UML-editors). Dat is bewust en tijdelijk; de fasering hieronder houdt de
pariteitslijst expliciet bij zodat de overstap toetsbaar is.

## 7. Fasering

Elke fase is afzonderlijk te bouwen op een eigen feature-branch, te verifiëren
met `npm run build` + visuele check, en levert iets werkends op.

- **Fase 0 — fundering (klein).** Besluiten over de open keuzes (§8). Optioneel
  vooraf: de opschoning uit de code review (gedeelde `apiBase`/`download*`-utils),
  zodat de nieuwe code schoon start. `// @ts-check` + JSDoc-typedefs aanzetten
  voor alles onder `diagramcore/` zodat het type-contract afdwingbaar is.
- **Fase 1 — read-only bewijs.** `diagramcore` model + typeRegistry + generieke
  `ElementNode` met `class-box`-shape; profiel `canoniek-uml` met alleen
  elementTypes/compartments; adapter die het bestaande model inleest; activiteit
  "Diagrammen (0.5)". **Klaar als:** een bestaand diagram er in de nieuwe motor
  (vrijwel) hetzelfde uitziet als in de oude.
- **Fase 2 — bewerken.** Elementen maken/hernoemen/verwijderen via de
  "Maken"-taakbalk, connectoren tekenen via de "Verbinding"-taakbalk (met
  verbindingsregels), het taakbalk-raamwerk zelf incl. `Beeld → Taakbalken ▸`
  (§4.6), velden bewerken via de gegenereerde inspector, undo/clipboard/
  multi-diagram. **Klaar als:** een klein model volledig in 0.5 te bouwen is.
- **Fase 3 — connector-materialisatie & layout.** Het generieke ASOC-patroon
  (connector-met-velden → node + 3 edges), generalisatie- en dependency-connectoren,
  uitlijnen/verdelen/snap-grid naar core (incl. de core-menu-items en het
  uitlijn-balkje), auto-layout als eerste `layouts`-strategie van het
  canoniek-uml-profiel met eigen taakbalkje (§4.5/§4.6), **boundary-element**
  (eigen ElementType + `boundary`-shape, achter de elementen — §8.6b),
  validatie-hook. **Klaar als:**
  de canoniek-uml-weergave pariteit heeft met de oude editor op een referentiemodel.
- **Fase 4 — serialisatie & persist.** Profiel-eigen import/export met hergebruik
  van `editorNaarV3Model`/import-functies; opslaan/laden via de bestaande API.
  **Klaar als:** een V3-round-trip door de nieuwe motor byte-vergelijkbaar is
  (m.u.v. bekende volgorde-verschillen).
- **Fase 5 — tweede profiel als lakmoesproef.** Voorstel: **puur UML** eerst
  (kleinste afstand: klasse, attribuut, operatie, associatie, generalisatie),
  daarna **OAS 3.1** (schemas als elementen, `$ref`s als connectoren). Pas hier
  blijkt of de abstractie klopt; verwacht: bijstellen van Field/CompartmentType.
- **Fase 6 — omschakeling (aparte beslissing).** Pariteitschecklist aflopen,
  oude `umlActivity` markeren als "klassiek", en pas na een gewenningsperiode
  opruimen. DRD en sequence-diagrammen: eerst een kort onderzoek (§8).
- **Fase 7 (optioneel) — configuratie in het register.** De declaratieve kern van
  de descriptors verhuist naar een gegenereerd bitemporeel configuratie-register
  met API; de Studio laadt profielen daarvandaan, met frontend-caching en
  gebundelde fallback (uitwerking in §8.5). Pas zinvol na fase 5.

## 8. Open keuzes & kanttekeningen

1. **Sequence-diagrammen passen niet vanzelf.** ✅ *Besloten (2026-07-02):
   uitgesteld.* Behalve de layout-semantiek (lifelines, activaties, verticale
   berichtvolgorde) zijn het ook **instantie-/objectdiagrammen**: de elementen
   zijn objecten/deelnemers met bericht-flow ertussen, geen typen — een andere
   verhouding tot het model dan de structuurdiagrammen waar de core op mikt.
   DRD past wél direct (beslissingen/inputs als elementen, requirements als
   connectoren) en blijft kandidaat-profiel.
2. **Compartimenten-maximum 0..9** uit het metamodel nemen we als harde grens in
   de core-validatie over.
3. **Tags** komen later; het `data`-vrijveld per instantie reserveert de plek.
4. **Taal & typing:** core-API in het Nederlands (consistent met de codebase),
   `// @ts-check` + JSDoc in heel `diagramcore/` (licht alternatief voor TS,
   conform de aanbeveling uit de code review §1).
5. **Descriptors in het bitemporele register (dogfooding).** Het hele
   **Definitie-domein** uit §2 — DiagramType t/m FieldType, TaskbarType/ActionType
   — is zelf een canoniek datamodel en past daarmee in de eigen pijplijn: het metamodel van §2 **inlezen in de Studio als model**,
   publiceren, en met de bestaande codegen een **register + API genereren**
   waaruit de Studio vervolgens zijn DiagramType-configuraties laadt. Profielen
   worden dan versioneerbaar en tijdreisbaar. Randvoorwaarden:
   - **Splitsing declaratief/code**: de JSON-serialiseerbare kern van de
     descriptors (§4.2) leeft in het register; de functie-hooks (validatie,
     custom renderers, `layouts.run`) blijven frontend-code en worden op
     descriptor-id gekoppeld. Het metamodel formaliseert dit nu zelf als de
     domeinen **Definitie** (register) en **Implementatie** (frontend):
     `ActionType → ActionHook`, `ElementType → ShapeType`,
     `PropertyType → PropertyTypeViewer/-Editor` en `ReferenceType →
     ReferenceResolver` zijn precies die koppelvlakken. Deze splitsing is de
     reden om de serialiseerbare kern vanaf fase 1 strikt te bewaken.
   - **Frontend-caching**: configuratie laden bij het openen van de activiteit,
     cachen in localStorage met versie-/ETag-check, en **gebundelde
     fallback-descriptors** in de frontend — zowel voor offline gebruik als voor
     het bootstrap-probleem (de editor moet werken vóórdat het configuratie-
     register bestaat).
   - **Volgorde**: pas ná fase 5, als de descriptor-vorm door een tweede profiel
     is gevalideerd — anders migreren we een nog bewegend schema het register in.
     Opgenomen als optionele fase 7 in §7.
5b. **Licht/donker-thema is een StyleType-verantwoordelijkheid.** ✅ *Besloten
   (2026-07-03):* elke `StyleType`/`ShapeType` moet **altijd een licht- én een
   donker-plan** hebben. Concreet: shapes en edges gebruiken geen letterlijke
   kleuren maar tokens die de StyleType per thema invult (CSS-variabelen onder
   `[data-studio-theme]`, zoals de shell dat al doet met `--s-*`). De vaste
   UML-pastels van canoniek-uml zijn dan het *lichte* plan van "uml-klassiek";
   het donkere plan mag dezelfde pastels houden (zoals de oude editor doet) of
   gedempte varianten kiezen — maar dat is een keuze ín de StyleType, niet in
   de shape-code. Uit te werken bij de StyleType-implementatie (fase 3-4);
   geldt ook als eis voor het configuratie-register (§8.5): de tokensets zijn
   onderdeel van het Definitie/Implementatie-koppelvlak.
6. **Waar de grens "shape vs. elementtype" ligt.** ✅ *Besloten (2026-07-02):*
   **notities en constraints zijn eigen ElementTypes** met dientengevolge hun
   eigen ShapeType (`note`, `rounded`); ShapeType is uitsluitend vorm, alles met
   betekenis is een ElementType.
5c. **Lijntypen als ShapeType van connectoren.** De edge-vorm (nu hardcoded
   bezier in `ConnectorEdge`) hoort — net als bij nodes — uit een ShapeType te
   komen: een connector is immers ook een element. Gewenste varianten: kromme
   (bezier), recht, hoekig (orthogonaal/step), boom. Per connector(-type)
   instelbaar, later via het rechtsklik-contextmenu op de edge. Sluit aan op
   §8.5b (thema-tokens) en het bestaande `edgePresentatie`-veld.
6a. **Integrale iconenset (ontwerp-sessie).** De "Maken"-taakbalk gebruikt nu
   tekstknoppen (ENT/GE/…); de uitlijn-balk heeft al SVG-iconen. Wens: één
   integrale iconenset per ElementType, hergebruikt in de Maken-balk, de
   tree-browser, de activity bar en (later) de minibrowser. Hoort bij het
   Implementatie-domein: een icoon-registry naast de shape-registry, met
   per-thema-varianten waar nodig (§8.5b). Bewust als ontwerp-sessie plannen
   (niet ad hoc), samen met de Omnium-merkstijl.
6b. **Boundaries komen wél vroeg mee.** ✅ *Besloten (2026-07-02):* kaders zoals
   de Definition/Implementation-boundaries in Sparx EA worden een **eigen
   ElementType** met een eigen `boundary`-ShapeType: een resizebaar kader dat
   *achter* de andere elementen rendert. Meestal puur vormgeving (groepering
   verduidelijken), maar een profiel kan er modelmatige betekenis aan hangen via
   een hook (vgl. de huidige `DomeinBoundaryOverlay`, die domein-scope toont).
   Omdat het een gewoon element met een shape is, kan het vanaf **fase 2/3** mee
   (z-order en resize zijn de enige extra's die de core ervoor nodig heeft).
7. **Naam en zichtbaarheid**: "Diagrammen (0.5)" als aparte activiteit met status
   "preview" in de activity bar, of verborgen achter een instelling? Voorstel:
   gewoon zichtbaar met preview-badge, dat dwingt tot echt gebruik.

## 9. Relatie met de code review van 2026-06-30

De nieuwe core neemt de review-aanbevelingen als ontwerpeisen mee in plaats van ze
achteraf te repareren: thema-kleuren uitsluitend via `--s-*`-variabelen en classes
(geen inline hardcoded kleuren), gedeelde utils i.p.v. gekopieerde helpers,
`@ts-check`-contracten, en toetsenbord-toegankelijkheid vanaf het begin in de
generieke inspector en het palet. De a11y-fixes voor de **menubalk** staan hier los
van en kunnen onafhankelijk (eerder) opgepakt worden.
