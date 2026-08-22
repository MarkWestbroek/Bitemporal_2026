# Changelog — Frontend / Omnium Studio

Alle noemenswaardige wijzigingen aan de web-frontend (`web/vite/`: Studio-werkbank,
inhoud-editor, publicatie, IDE). Formaat: [Keep a Changelog](https://keepachangelog.com);
versionering volgens [`docs/versiebeheer.md`](../docs/versiebeheer.md) (prefix `studio/`).

De single source of truth voor het nummer is `package.json` `"version"`.

## [Unreleased]
### Gerepareerd
- **Diagram-export sneed tekening af.** Het kader kwam van `getNodesBounds`
  (alleen de node-boxen uit het model). Alles wat daarbuiten getekend wordt
  viel weg: de satelliet-velden van de graaf-bol, buitenlabels, bochtige of
  geknikte lijnen, edge-labels en rand-elementen (relatieve kind-positie). Het
  kader wordt nu aan de DOM gemeten (`diagramcore/export/tekenBounds.js`).
- **Selectie-export**: tekent alleen nog de selectie — geen half-afgesneden
  buren meer in de rand, en zonder de blauwe resize-lijntjes van een
  geselecteerde node. Lijnen buiten de selectie bleven eerst nog wél staan:
  html-to-image kloont een `<svg>` in één keer diep en negeert daarbinnen het
  `filter`, en React Flow zet elke edge in zo'n `<svg>`-wikkel.

### Gewijzigd
- **Kader-selectie** (Shift+slepen) neemt geen lijnen meer mee naar elementen
  buiten het kader; een lijn hoort pas bij de selectie als beide uiteinden erin
  zitten.

## [studio/v0.6.0] — 2026-07-29
### Toegevoegd — Toegangsspraak & Toegangsregel
- **Toegangsspraak-editor**: ontleding van regeltekst met autocomplete,
  element-focus, bijzinsvolgorde, spans en koppeling aan het metamodel;
  structuurwoorden en modaliteit-kleur, plus een canonieke tab.
- **Existentie-voorwaarden** ("er is een lopend dossier voor de betrokkene").
- **Toegangsregel-profiel** op de diagram-motor: read-only Diagram-tab (stap 1–2),
  policy + map en kruisverbanden (stap 3), kolom-resolutie naar echte
  canoniek-elementen, **de terugweg** diagram-model → tekst (stap 4), en
  **ArchiMate-koppeling** naar wet, doel en begrippen (stap 5 v0).
- **Vormentaal**: de zin als silhouetten; lijnlabels alleen op structuur,
  layout blijft heilig bij herpubliceren.

### Toegevoegd — diagram-motor & notaties
- **Sequence v1 — hermetisch minimum** (ontwerp "Sequence hermetisch" §5.1):
  getypeerde levenslijnen via het nieuwe cross-profiel **instantie-van**-concept
  (datatype "element-verwijzing"; kop toont `naam:Type` onderstreept; element
  uit de boom op de lijn droppen typeert hem), **OperatieResolver-facet** per
  profieltype (puur-UML-operaties, OAS-operations) en **operatie-keuze op
  berichten** (label = signatuur, met argumenten-veld).
- Core: `onExternDrop` op de canvas + `ELEMENT_REF_MIME` (cross-profiel
  drag-and-drop referenties) + descriptor-hook `hooks.ontvangtDrop`.
- **Sequence-profiel (v0)**: levenslijnen (smalle hoge node met naam-kop);
  punten (occurrences) en activaties als rand-elementen die op de lijn
  klemmen en meebewegen; sync/async/retour-berichten;
  alt/opt/loop/par-fragmenten. Volgorde = y-positie (as-primitief = v1).
- Core: `elementType.minBreedte`/`minHoogte` voor de NodeResizer
  (smalle balken zoals activaties resizen nu correct).
- **BPMN-profiel op de eigen motor (v0)**: taak, subproces (doorklik), events
  met soort (bericht/timer/fout/signaal), boundary events op het
  rand-primitief, gateways ×/+/○, lane, data-object; sequence flow met
  [conditie], message flow. Naast de bestaande bpmn.io-activiteit.
- **ArchiMate-profiel (v0)**: ~22 elementtypen over vier lagen in de
  laag-kleuren (archimate-box met type-icoon rechtsboven), junction (en/of)
  en alle elf relaties; geldigheidsmatrix volgt in v1.
- Core: property-datatype **"keuze"** (select over `PropertyType.opties`).

### Gewijzigd
- Core: **lijndikte per connector** (`presentatie.dikte`).
- Kaderselectie selecteert wat het raakt; node-acties in het selectie-menu.

### Gepubliceerd
- Docker: `markwestbroek/bitemp-viz-frontend:0.6.0` + `latest`
  (zie [`docs/DOCKER_RELEASE.md`](../../docs/DOCKER_RELEASE.md)).

## [studio/v0.5.0] — 2026-07-17  _(bij merge van `feat/diagramcore-gedrag-primitieven`)_
### Toegevoegd
- **Gedragsdiagram-primitieven in de diagram-motor** (STUDIO-05-gedragsdiagrammen §3):
  - **rand-aanhechting** (`elementType.randElement`): elementen die vastklikken op de
    omtrek van een gastheer en meebewegen (entry/exit-points, pins; straks BPMN
    boundary-events);
  - **gedragsverwijzing** (`elementType.gedragsVerwijzing` + property-datatype
    `diagram-verwijzing`): dubbelklik opent het gekoppelde diagram (ook als tab in
    Modelleren), ⧉-badge op de node.
- **State machine v1**: keuze, junction, historie (Ⓗ/Ⓗ*), samengestelde toestand
  (container), submachine met doorklik, entry/exit-points op de rand.
- **Use case-profiel** (nieuw): actor, use case, systeemkader;
  associatie/«include»/«extend»/generalisatie.
- **Activity-profiel** (nieuw): acties, beslissing/samenvoeging, fork/join,
  object nodes, pins (rand), aanroep (CallBehaviorAction, doorklik), partities;
  controle- vs objectstroom, "[guard]"-labels.
- **Sprekende taakbalken**: eigen vorm-glyphs per elementtype
  (`gedragTypeIconen.jsx`, koppelvlak plan §8.6a) + **eigen tooltips** met naam
  en één-regel-omschrijving (`ElementType.omschrijving`); toggle in
  Studio-instellingen → Taakbalken.
- **Gedeelde naam-modal** (`vraagNaam`) vervangt `window.prompt` bij
  diagram-aanmaak (ook in de Modelleren-host).
- Plan: **ArchiMate en verdere notaties** (ArchiMate v0–v2, C4, SysML, ERD, OWL,
  mindmap) — `docs/plans/2026-07-17 ArchiMate en verdere notaties (plan).md`.
### Gewijzigd
- Handles zijn hulpchrome: overal klein en gedempt tot hover/selectie; op
  punt-nodes (junction e.d.) liggen ze búiten de vorm — kern blijft sleepbaar.
- Lidmaatschaps-lijnen (bevat) verbergen zichzelf zolang het lid geometrisch
  ín zijn container ligt (`edgePresentatie.verbergBijNesting`).
### Opgelost
- "Nieuw diagram" deed niets bij koppeling-profielen (canoniek/MIM): de
  auto-herlaad-guard telde alleen `elements`, waardoor een net aangemaakt leeg
  diagram werd overschreven; guard telt nu ook `diagrams`.
- `.dc-node` was content-box → shapes staken buiten hun node (scheve handles);
  nu border-box, exact gevuld en gecentreerd.
- Begin/eind-pseudotoestanden werden overwoekerd door de standaard-handles.

## [studio/v0.4.0] — 2026-07-16  _(bij merge van `feat/formulier-editor-studio`)_
### Toegevoegd
- **Visuele FormulierDefinitie-editor** als nieuwe Studio-activiteit "Formulieren"
  (balkgroep *Presentatie*): palette (ModelPicker) → veld met padadressering `ENT.GE.veld`
  → structuur-boom → inspector → live preview via `CustomFormulierRenderer`.
- **Opslaan naar register**: definitie als nieuwe `FormulierDefinitie` (max-id + opvoer).
- **Meervoudigheid** via het `lijst`-element: auto-wrap van meervoudige velden, herhaalbare
  sectie met item toevoegen/verwijderen; per-item opvoer/afvoer bij opslaan.
- Renderer-uitbreidingen (backwards compatible): label-/beschrijving-override, object-condities,
  padgebaseerde veldadressering naast korte namen.
### Gewijzigd
- `EntiteitFormulier`: mapping/save geëxtraheerd naar pure, geteste `customFormMapping.js`.

## [studio/v0.3.0] — 2026-07-14
### Toegevoegd
- Grafische kruisverband-view (fase 4) en kruisverbanden-matrix.
- Transformatie-generatoren (bv. "Map → Markdown-overzicht") op de map.
- State-machine-profiel v0 (gedragsdiagram).
- Diagram/selectie exporteren als afbeelding (PNG/SVG + klembord) + export-voorkeuren.

## [studio/v0.2.1] — 2026-07-13
### Toegevoegd
- Koppelingen v0 (kruisverbanden-matrix) + transformeren-raamwerk (import/export/transform).
- Studio-versie zichtbaar in de UI; versionering-conventie vastgelegd.
### Gefixt
- Prism-syntaxkleuring in de productiebundel.

## [studio/v0.2.0] — 2026-07-12
### Toegevoegd
- Consolidatie fase 0–2: Modelleren-tab-host (klassieke editors als profieltype),
  projectboom met mappen/hiërarchie/contextmenu's, project-werkbestand.
- Structuur-undo (Ctrl+Z) + multiselect in de elementen-onderboom.
- Shape-/icoon-editor in de Studio-instellingen.

## [studio/v0.1.0] — 2026-06-17
### Toegevoegd
- Raamwerk van de geïntegreerde werkbank (VS Code-schil): activity-registry, auto-hide
  panelen, menubalk; eerste activiteiten (UML/canoniek model, DMN, BPMN, berichten).

---

Vóór `studio/v0.1.0`: de frontend deelde commits met de backend; niet per component te
reconstrueren (zie `git log`).
