# Overdracht Notaties — UML, DMN, BPMN, ArchiMate, sequence (+ ERD)

**Datum:** 2026-07-29, bijgewerkt 2026-07-31 · **Branch:** het werk t/m 25-07 zit in `main`;
de motor- en notatie-wijzigingen van 29/31-07 staan op `feat/diagramcore-labels`.
**Werk gedaan:** 14–17 juli (nachtsessies), de formulier- en toegangsregel-lijn (16–24 juli),
en de afronding van 29/31 juli (buitenlabels, tekstoverloop, BPMN-labels + default flow, ERD,
SysML, CMMN).
**Stand:** groen — **zestien** profielen op de generieke motor, 402 unit-tests, build in orde.
**Zusterdocumenten:** `2026-07-24 Overdracht Toegangsspraak (laptop).md` ·
`2026-07-25 Overdracht Formulieren (laptop).md`. Dit document dekt de **notatie-lijn**.

---

## 1. Wat er staat (in één alinea)

De diagram-motor (`diagramcore`) is inmiddels bewezen als **declaratieve kern**: een nieuwe
notatie is een *descriptor* (`elementTypes` met `shape`, `properties`, `bron`/`doel`,
`edgePresentatie`, `hooks`) plus een handvol custom shapes — géén motor-werk. Dat is
uitgevent over **zestien profielen**: de structuurlijn (puur-UML, canoniek-UML, MIM 1.2,
OAS 3.1, ERD, SysML), de gedragslijn (state machine v1, use case, activity, BPMN v0,
sequence v1, CMMN), de beslislijn (DMN DRD), de architectuurlijn (ArchiMate 3.2 v0) en twee
"dogfood"-profielen (formulier, toegangsregel). Onderweg zijn **vier motor-primitieven** gebouwd die de profielen
delen: **rand-aanhechting** (`randElement`), **gedragsverwijzing** (`gedragsVerwijzing` +
dubbelklik-doorklik), het **buitenlabel** (`naamLabel`) en **markers aan de bronzijde**. Wat nog ontbreekt is per notatie klein en goed
afgebakend (§4). De laatste notatie die nog op de lijst stond — **ERD met kraaienpoten** —
is op 31-07 gebouwd.

## 2. De motor-primitieven (het echte kapitaal)

Uit `STUDIO-05-gedragsdiagrammen.md` §2 kwamen vier cross-cutting motor-gaten. Stand:

| Motor-gat | Stand | Waar |
|---|---|---|
| **#3 Rand-aanhechting / ports** | ✅ `elementType.randElement` — vastklikken op de dichtstbijzijnde zijde, meebewegen via React Flow-`parentId`, wegslepen = losmaken | BPMN boundary events, state entry/exit-points, activity pins, **en verrassend ook de sequence-mechaniek** |
| **#2 Semantische containers** | ✅ `containerVoor` | packages, composite states, activity-partities, BPMN lanes, sequence-fragmenten |
| **#2b Gedragsverwijzing (doorklik)** | ✅ `gedragsVerwijzing` + property-datatype `diagram-verwijzing`; dubbelklik opent het diagram als tab (menuBus `studio:open-diagram`), ⧉-badge op de node | submachine state, BPMN subproces, activity-aanroep (CallBehaviorAction) |
| **#1 As-/volgorde-semantiek** | ❌ **nog open** — de grootste resterende lacune | sequence: y-positie ís de volgorde, maar blijft handwerk |
| **#4 Connector→connector** | ❌ niet nodig gebleken | sequence lost bericht→activatie op met rand-elementen |
| **Buitenlabel** (29-07) | ✅ `elementType.naamLabel: "buiten"` — ElementNode zet de naam ónder de vorm; diagram-breed uit te zetten (`data-dc-labels`) | BPMN-events/gateways, state machine begin/eind/keuze/junction/historie/entry/exit, activity begin/eind/flow-eind/beslissing/fork/pin |
| **Zwevende aanhechting** (08-08) | ✅ `randAanhechting: "zwevend"` — het uiteinde ligt op de omtrek i.p.v. op een handle; zelfde zijde als voorheen, betere plek erop. Handmatig gekozen handles winnen | alle structuur- en architectuurprofielen; gedragsprofielen houden hun handles |
| **Markers aan de bronzijde** (31-07) | ✅ `markerStart` was tot dan alléén de ruit (een polygon dat met de curve meebuigt); nu ook echte SVG-markers | ERD-kraaienpoten aan beide uiteinden, BPMN default flow |

Daarnaast is er core-datatype **`keuze`** bijgekomen (select over `PropertyType.opties`) en
lijndikte per connector (`presentatie.dikte`).

## 3. Kaart — waar het leeft

**Profielen** (`bitemp_register_v06/web/vite/src/diagramprofielen/`):

| Map | Notatie | Omvang | Shapes |
|---|---|---|---|
| `puur-uml/` | UML klassediagram (klassiek) | 17 typen | hergebruik basisShapes |
| `canoniek-uml/` | het canoniek model als UML | 19 typen | + CEL-editor, adapter, terugreis |
| `mim12/` | MIM 1.2 | 21 typen | + adapter |
| `oas31/` | OpenAPI 3.1 | 17 typen | + adapter |
| `dmn-drd/` | DMN Decision Requirements Diagram | 9 typen | `dmn-input-data`, `dmn-bkm`, `dmn-knowledge-source` (in basisShapes) |
| `usecase/` | UML use case | 9 typen | actor, ellips, systeemkader |
| `statemachine/` | UML state machine v1 | 14 typen | punt-nodes, composiet-container |
| `activity/` | UML 2 activity | 14 typen | balk (fork/join), ruit, pin, partitie |
| `bpmn/` | BPMN v0 op de eigen motor | 16 typen | `bpmn-event`, `-gateway`, `-subproces`, `-data`, `-lane` |
| `sequence/` | UML sequence v1 "hermetisch" | 9 typen | levenslijn, punt, activatie, fragment |
| `archimate/` | ArchiMate 3.2 v0 | 22 elementen + 11 relaties | één `archimate-box` + 22 hoek-iconen |
| `erd/` | ERD met kraaienpoten (IE) | 6 typen | géén — puur declaratief |
| `sysml/` | SysML v1: bdd + ibd + req | 10 typen + 10 relaties | `sysml-requirement`, `sysml-poort` |
| `cmmn/` | CMMN 1.1 casusmodel | 8 typen + 3 relaties | 7 eigen vormen (case plan, stage, task, milestone, event, case file, sentry) |
| `formulier/` | FormulierDefinitie als diagram | 8 typen | dogfood, zie overdracht Formulieren |
| `toegangsregel/` | Toegangsspraak-regel als vormentaal | 19 typen | dogfood, zie overdracht Toegangsspraak |

**Activiteiten** (`web/vite/src/studio/activities/`): elk profiel heeft een dun
`…Activity.jsx` dat `registreerX()` aanroept en `maakDiagramActiviteit` configureert —
`bpmnMotorActivity`, `archimateActivity`, `sequenceActivity`, `activityActivity`,
`statemachineActivity`, `usecaseActivity`, `dmnDrdActivity`, `puurUmlActivity`, …
De meeste staan `standaardVerborgen` en zijn te bereiken via **Ga naar**.

> Let op het naast elkaar bestaan van **twee BPMN's**: de oude bpmn.io-activiteit
> ("BPMN-processen", `bpmnActivity.jsx`) én het eigen-motor-profiel
> (`bpmnMotorActivity.jsx`). Dat is bewust — het profiel deelt projectboom,
> kruisverbanden, export en de gedragsprimitieven; bpmn.io niet. Op termijn is
> convergeren een keuze die nog gemaakt moet worden.

**Docs:**
- `docs/STUDIO-05-gedragsdiagrammen.md` — richting + de vier motor-gaten + "is BPMN een
  UML-profiel van activity?" (§4). Statusblok bovenin is bijgewerkt t/m 17-07.
- `docs/plans/2026-07-17 ArchiMate en verdere notaties (plan).md` — ArchiMate-fasering én de
  verkenning van SysML, OWL, **ERD**, mindmap, C4.
- `docs/plans/2026-07-17 Sequence hermetisch — objecten en operaties (ontwerp).md`
- `docs/STUDIO.md`, `docs/STUDIO-05-verslag.md` — de werkbank eromheen.

## 4. Openstaand per notatie

### ArchiMate — v0 staat, v1 is het echte werk
- **v1: de geldigheidsmatrix als datatabel.** Nu zijn de regels bewust permissief. Plan:
  `archimate/relatiematrix.js` met `{bronType: {doelType: "cagrs…"}}` (de letter-codering van
  de spec zelf) → `verbindingsregels` **genereren** bij registratie. Onderhoudbaar, diffbaar
  tegen de spec, en herbruikbaar voor een validatie-hook over bestaande diagrammen.
- **Nesting** als alternatieve notatie voor composition/aggregation/assignment — het
  container-patroon (`containerVoor`) dekt het al, moet alleen gedeclareerd worden.
- **v2: Open Exchange Format (XML) import/export** — dé killer-feature (uitwisseling met
  Archi/BiZZdesign). Import mapt op elements/diagrams; kruisverbanden kunnen
  ArchiMate-relaties naar andere profielen dragen.
- Viewpoints als descriptor-filter op de "Maken"-taakbalk; afleidingsregels; plateaus.

### BPMN — v0 staat
- ~~Default flow ontbreekt~~ ✅ **opgelost 31-07.** Het schuine streepje aan de bron van de
  sequence flow (de standaard-uitgang van een exclusieve/inclusieve gateway) stond *nergens* —
  niet in het profiel, niet in de docs. Geen bewuste keuze, gewoon gemist. Nu: vinkje
  **default flow** op de sequence flow → `markerStart: "schuine-streep"` via
  `hooks.edgePresentatie`. Zoals de rest van v0 permissief: het vinkje staat op elke sequence
  flow, niet alleen op die vanaf een gateway.
- ~~Namen van events en gateways worden niet getoond~~ ✅ **opgelost 29-07** via het
  buitenlabel-primitief (§5a). `maakElement` zet de naam voor die typen nog steeds op `""` —
  dat blijft goed: naamloze events zijn in BPMN de norm, de inspector vult ze aan.
- ~~NL/EN-mengelmoes in de labels~~ ✅ **opgelost 31-07.** Was door elkaar: `Start-event`,
  `Tussen-event`, `Eind-event` (NL) naast `Boundary event`, `Lane`, `gateway`, `Sequence flow`
  (EN). Nu volgen de labels consequent de Engelse BPMN-termen: Start / Intermediate / End /
  Boundary event, Task, Sub-process, de drie Gateways, Lane, Data object, Text annotation,
  Sequence flow, Message flow, Data association, Lane membership. De **omschrijvingen blijven
  Nederlands** — het gaat om de vaktermen, niet om de uitleg. ⚠ Alleen `label` en `kort` zijn
  gewijzigd: de `id`'s (`tussen-event`, `eind-event`, …) staan als `elementType` in opgeslagen
  diagrammen en werkbestanden en zijn onaangeroerd.
- **Pools + collaboration** blijven bewust buiten v0 (message flow is er al, permissief).
  Lane = partitie (gat #2), pool = participant — een laag *boven* activity.
- Rest van de **event-taxonomie**: escalation, compensation, conditional, link, terminate;
  en het onderscheid **catching vs throwing** (gevuld icoontje).
- **Event-based** en **complex** gateway; de **inclusive-OR-join**-semantiek blijft notatie
  (bekende, gedocumenteerde gap — uitvoeringssemantiek, geen tekenwerk).

> **Niet** openstaand, ook al lijkt het zo: het ontbrekende onderscheid tussen een
> *splitsende* en een *samenvoegende* gateway. BPMN kent dat verschil notationeel niet — de
> richting volgt uit de in-/uitgaande flows. Een activity diagram doet hetzelfde: decision en
> merge zijn beide een lege ruit, fork en join beide een balk. Ons `activity`-profiel
> modelleert dat expliciet zo ("Beslissing/samenvoeging", "Fork/join"). Het onderscheid dat
> je in AD wél ziet — ruit vs balk — hebben we in BPMN als × vs +.

### Sequence — v1 staat, het as-primitief niet
De verticale positie ís de volgorde maar blijft handwerk: **geen auto-ordening**, geen
"berichten horizontaal"-constraint, geen herordenen-met-doorschuiven. Dat is motor-gat #1 en
het laatste grote primitief. Buiten scope gebleven: gates, found/lost messages,
state-invariants.

### Activity / state machine
Lanes mét betekenis (lane-layout in plaats van vrije containers), regio's, en de
validatie-hook. Klein werk, lage urgentie.

### UML (puur / canoniek)
Restpunten fase 5: zichtbaarheid (+/−/#) als eigen property, een auto-layout-strategie, en
eigen StyleType-tokens.

### ERD met kraaienpoten ✅ **gebouwd 31-07**
`diagramprofielen/erd/` + activiteit `erd05` ("ERD", standaard verborgen → via *Ga naar*).
Zes elementtypen, géén eigen shapes — puur declaratief, zoals het plan voorspelde.

- **entiteit** — class-box met twee compartimenten: **sleutel** boven de scheidingslijn,
  **kolommen** eronder. Dat is de klassieke ERD-doos, gratis via het bestaande
  compartiment-mechanisme (de divider zit al tussen compartimenten).
- **relatie** — de kraaienpootlijn. `bronKardinaliteit` / `doelKardinaliteit` (keuze: precies
  één ‖ · nul of één ○| · één of meer |< · nul of meer ○<) worden via `hooks.edgePresentatie`
  naar markers vertaald; `soort` maakt een niet-identificerende relatie gestreept (IE);
  `bronRol`/`doelRol` als labels aan de uiteinden.
- **subtype** (open driehoek) en **domein** (container om entiteiten te groeperen).

Het echte motor-werk zat niet in de vier markers maar in iets dat het plan niet zag:
**`markerStart` kon alleen een ruit zijn.** Compositie/aggregatie is namelijk géén SVG-marker
maar een polygon dat met de curve meebuigt; er was dus helemaal geen bronmarker-pad.
`ConnectorEdge` heeft dat nu wél — en dat is meteen wat de BPMN default flow mogelijk maakte.
De markers staan nog steeds hardcoded in `ConnectorEdge.jsx`; een markerregistry is nu
duidelijker de moeite waard, maar nog niet nodig.

Nog open: Chen-notatie (andere vormentaal), afleiding uit het canoniek model (kandidaat:
adapter zoals `mim12/`), DDL-import/-export. Daarna is **DFD (Gane/Sarson)** klein.

### SysML ✅ **gebouwd 31-07**
`diagramprofielen/sysml/` + activiteit `sysml05`. Het plan adviseerde "begin met bdd + req";
**ibd is meteen meegenomen**, want het enige dat daarvoor ontbrak (ports) was in juli al
gebouwd.

- **bdd** — blok, valueType, interfaceBlock, constraint block, enumeratie, pakket; compositie
  /aggregatie/generalisatie/associatie/afhankelijkheid op bestaande edge-middelen.
- **ibd** — het blok ís het frame: parts erin via `containerVoor`, **poorten erop** via
  `randElement`, poortnaam eronder via het buitenlabel (een vierkantje van 16px draagt geen
  tekst). Connector en item flow verbinden de poorten.
- **req** — de «requirement»-doos met id en tekst (eigen shape: dat zijn er per requirement
  precies één, dus properties en geen veldenlijst). **Eén** traceerconnector met een
  `soort`-keuze in plaats van vijf knoppen: satisfy/verify/deriveReqt/refine/trace zijn
  notationeel identiek en verschillen alleen in het «stereotype»-label (`traces.js`, getest).
  **Containment** (⊕) vroeg de nieuwe marker `kruis-cirkel`.

Nog open: **parametrics** (zoals het plan al zei: achteraan), **SysML v2** (eigen metamodel
én notatie — pas bij vraag), en het punt dat het plan zelf maakt: satisfy/verify/derive horen
óók in de **kruisverbanden-matrix** (Koppelingen), niet alleen in een tekening.

### CMMN ✅ **gebouwd 31-07** (stond in geen enkel plan)
`diagramprofielen/cmmn/` + activiteit `cmmn05`. De tegenhanger van BPMN: geen proces dat je
vóóraf uittekent maar een **casus** — wat er *kan* gebeuren, en onder welke voorwaarden. Er
zijn geen sequence flows; alle afhankelijkheid loopt via **sentries**, bewakers op de rand.

Dat maakt het de sterkste bevestiging tot nu toe dat het rand-primitief goed gekozen is: waar
een boundary event in BPMN een randgeval is, is de sentry in CMMN de **kern van de taal** —
en hij komt uit hetzelfde `randElement` als de BPMN-boundary, de state machine-entry/exit, de
activity-pin en de SysML-poort.

v0: case plan model (mapvorm) en stage (achthoek) als containers, task met soort
(human/process/case/decision) en de planningsmarkeringen `!`/`#`/`▷`, milestone (stadion),
event listener (dubbele cirkel, timer/user), case file item, sentry (open = entry, gevuld =
exit) en de on-part-lijn met standaardgebeurtenis. Zeven eigen shapes — bij CMMN ís de
vormentaal de betekenis.

Nog open: de **planningstabel** (discretionary items die een behandelaar tijdens de uitvoering
toevoegt), caseFileItem-relaties, en de **expressietaal** achter sentries en rules. Dat
laatste is het interessantst: koppelen aan CEL/Toegangsspraak in plaats van er een taal bij
te verzinnen. Plus één klein en waardevol punt: de **process task en case task missen nog
`gedragsVerwijzing: true`** — met die paar regels klik je van een casus door naar het
BPMN-proces dat één stap ervan uitvoert.

Achtergrond bij de notatie zelf (begrippen, levenscyclus, toepasbaarheid, de fusie met
BPMN): `docs/CMMN-in-het-kort.md`.

### Nog helemaal open (volgorde-advies uit het plan)
**C4** (4 elementtypen, nesting via containers, doorklikken van niveau naar niveau = het
gedragsverwijzing-primitief — goedkoop en populair) → **DFD** (Gane/Sarson, klein na ERD) →
**mindmap** (vereist eerst een generieke boom-LayoutStrategie + toetsenbord-flow) →
**OWL** (vereist import Turtle/JSON-LD en de projectboom als primaire view; het diagram is
daar een afgeleide).

## 5. Cross-cutting: twee dingen die álle profielen raakten ✅ (29-07)

Geen notatie-punten maar motor-punten. Beide zijn gebouwd op
`feat/diagramcore-labels`:

**a) Buitenlabel-primitief.** `ElementNode` deed níets met `element.naam` — elke shape
renderde de naam zelf. Gevolg: alle punt-node-achtige vormen (BPMN events en gateways, state
machine begin/eind/keuze/junction/historie/entry/exit, activity begin/eind/flow-eind/
beslissing/fork/pin) waren stilzwijgend naamloos, zónder foutmelding.

Nu: `ElementType.naamLabel = "binnen" | "buiten" | "geen"` (naast `shape` in
`diagramcore/types/schema.js`). Bij `"buiten"` rendert **ElementNode** de naam als los label
onder de vorm — de shape hoeft er niets van te weten. Het label is bewust een *broer* van de
shape en geen kind: `.dc-node` heeft `overflow: hidden` en zou het wegknippen; de React
Flow-node-wrapper is `position: absolute` en dus het referentiekader. Het label heeft een
**vaste** breedte (132px), geen `max-width` — een absoluut gepositioneerd element ontleent
zijn shrink-to-fit-breedte aan het containing block, en dat is bij een event-ring maar 30px
(anders breekt de tekst letter voor letter af; dat was de eerste poging).

Diagram-breed uit te zetten via **Beeld → Buitenlabels**, in exact het patroon van
`data-dc-typering`: menuBus-event → localStorage per taakbalk → `data-dc-labels` op het
canvasvlak → één CSS-regel. Eén schakelaar, dus hij geldt voor **alle profielen tegelijk**.

**b) Tekstoverloop in element-boxen.** `.dc-naam` had géén `white-space: nowrap` — het wrapte
in theorie al. De echte oorzaak: `.dc-node` was `min-width: 180px; width: 100%` zónder
`max-width`, en een niet-geresizede React Flow-node is shrink-to-fit. Er was dus nooit een
grens om tegenaan te wrappen.

Nu: `.dc-node { max-width: var(--dc-node-max, 280px) }`. Zodra de gebruiker een node zélf een
maat geeft, zet `DiagramCanvas` `--dc-node-max: none` op de wrapper — handmatige breedte wint.
Verder `overflow-wrap: anywhere` op `.dc-naam` en `.dc-veld-naam` (+ `min-width: 0`, anders
houdt de flex-basis-op-inhoud de regel toch op één lijn), en de shapes die `nowrap`+ellipsis
forceerden zijn omgezet naar wrappen: BPMN data-object, use case actor + ellips, de
sequence-levenslijnkop. **Niet** aangepast: de package-tab (hangmap-tab, bewust kort) en het
toegangsregel-profiel (ontworpen vormentaal — apart bekijken).

> ⚠ Dit verandert bestaande diagrammen visueel: elementen zonder expliciete maat die breder
> dan 280px stonden, worden nu smaller en hoger. Elementen die je ooit met de hand hebt
> geresized behouden hun maat.

## 6. Valkuilen & geleerde lessen

- **`elementType`-id's zijn persistente data.** Ze staan in opgeslagen diagrammen,
  werkbestanden en localStorage. Labels hernoemen mag altijd, id's nooit zomaar.
- **Shapes zijn zelf verantwoordelijk voor hun tekst.** Wie een nieuwe shape schrijft en
  vergeet `element.naam` te renderen, krijgt een stille naamloze node — geen foutmelding.
  (Precies wat er bij de BPMN-events gebeurde.) Het buitenlabel-primitief uit §5a haalt die
  valkuil weg.
- **`children` altijd renderen** in een custom shape: daar zitten de React Flow-handles,
  de resizer en de badges in.
- **Diagram-inhoud reist niet mee via git.** De Studio bewaart werk in **localStorage**
  (machine-gebonden). Overdraagbaar via `docs/exports/Studio exports/` — importeren via het
  Bestand-menu (project-werkbestand). Zie ook §4 van de overdracht Toegangsspraak.
- **Permissief beginnen werkt.** ArchiMate v0 en BPMN v0 zijn bewust zonder strenge
  verbindingsregels gebouwd. Dat leverde snel bruikbare profielen; de strengheid komt in v1
  als *data* (matrix), niet als honderden handgeschreven regels.
- **Playwright + de Studio-pagina** hangt lokaal regelmatig (harnas-probleem, geen
  productbug). Unit-test de logica, verifieer de UI met één screenshot.

## 7. Op een andere machine beginnen

```bash
git fetch && git checkout main
cd bitemp_register_v06/web/vite
npm install
npm run dev        # → http://localhost:5173/viz/react/studio.html
```

- Studio → **Modelleren**, of via **Ga naar** de losse profiel-activiteiten (BPMN, ArchiMate,
  Sequence, Activity, State machine, Use case, DMN DRD, …).
- Tests: `npm test` (op Windows-bash zonodig
  `shopt -s globstar && node --import ./test/register-aliases.mjs --test src/**/*.test.js`).
- Zonder Go-backend (`:8082`) werken de zuivere teken-profielen gewoon; alleen de
  model-gekoppelde profielen (canoniek-UML, MIM, OAS, formulier, toegangsregel) hebben de
  schema-API nodig.

---

*Zie ook:* `docs/STUDIO-05-gedragsdiagrammen.md` · `docs/plans/2026-07-17 ArchiMate en verdere
notaties (plan).md` · `docs/plans/2026-07-11 STUDIO consolidatie.md` · `docs/STUDIO.md`
