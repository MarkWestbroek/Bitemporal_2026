# Studio — gedragsdiagrammen op de diagram-motor

> Datum: 2026-07-14 · **bijgewerkt 2026-07-17**
> Status: **richting → deels gebouwd.** Bouwt voort op de sectie
> "Metamodel-verkenning: gedragsdiagrammen" in `docs/plans/2026-07-11 STUDIO consolidatie.md`
> en op het eerste gedragsprofiel: **State machine v0** (`785e49d`,
> `web/vite/src/diagramprofielen/statemachine/`).
>
> **Stand 2026-07-17 (branch `feat/diagramcore-gedrag-primitieven`):** de twee
> primitieven uit §3 zijn **gebouwd** —
> **§3.1 rand-aanhechting** als `elementType.randElement` (aanhechten =
> op/naast de omtrek slepen → vastklikken op de dichtstbijzijnde zijde,
> meebewegen via React Flow-parentId, wegslepen = losmaken) en
> **§3.2 gedragsverwijzing** als `elementType.gedragsVerwijzing` +
> property-datatype `diagram-verwijzing` (dubbelklik opent het gekoppelde
> diagram; in de Modelleren-host als tab via menuBus "studio:open-diagram";
> ⧉-badge op de node). Bewijsvoering: **State machine v1** (keuze, junction,
> historie Ⓗ/Ⓗ*, samengestelde toestand als container, submachine met
> doorklik, entry/exit-points op de rand) en het **Use case-profiel**
> (kleinste declaratie-profiel: actor/use case/systeemkader,
> associatie/«include»/«extend»/generalisatie). Direct daarna is ook het
> **Activity-profiel** gebouwd (stap 3 uit §5): acties, beslissing/
> samenvoeging, fork/join (balk), object nodes, **pins als
> rand-elementen**, **aanroep (CallBehaviorAction) met doorklik** en
> partities als containers; controle- en objectstroom gescheiden,
> "[guard]"-labels. Daarna volgden **BPMN v0 op de eigen motor** (events
> incl. boundary op §3.1, gateways, lanes, subproces-doorklik) en —
> verrassend — **sequence v0**: het rand-primitief bleek ook dáár de
> mechaniek te dragen. De levenslijn is een bewust smalle, hoge node (de
> stippellijn; de naam-kop hangt er via overflow boven); **punten
> (occurrences) en activaties zijn rand-elementen** die op de lijn klemmen,
> er verticaal langs schuiven en meebewegen met de levenslijn; berichten
> (sync/async/retour) verbinden punt↔activatie; alt/opt/loop/par-fragmenten
> als kaders. Nog open uit de verkenning: het échte **as-primitief**
> (y-positie is nu volgorde-op-de-hand: geen auto-ordening, geen
> horizontaal-constraint, geen doorschuiven), lanes met betekenis
> (lane-layout), regio's en de validatie-hook. Vervolgplan:
> `docs/plans/2026-07-17 ArchiMate en verdere notaties (plan).md`.
>
> **Stand 2026-07-29:** derde motor-primitief erbij — het **buitenlabel**
> (`elementType.naamLabel: "binnen" | "buiten" | "geen"`, §3.3). Kleine vaste
> vormen kunnen hun naam niet ín zichzelf dragen; `ElementNode` zet hem er nu
> onder. Toegepast op de BPMN-events en -gateways, de state machine-pseudostates
> en de activity-knooppunten. Diagram-breed uit te zetten via Beeld →
> Buitenlabels. Tegelijk is de **breedtegrens** van element-boxen ingevoerd
> (`.dc-node { max-width: var(--dc-node-max, 280px) }`), zodat lange namen
> wrappen in plaats van de node eindeloos uit te rekken. Status per notatie:
> `docs/plans/2026-07-29 Overdracht Notaties — diagramprofielen (status).md`.
>
> **Stand 2026-07-31:** het rand-primitief (§3.1) draagt er twee notaties bij:
> **SysML-poorten** (ibd) en **CMMN-sentries**. Die laatste is het mooiste
> bewijs dat §3.1 het juiste primitief was — in CMMN is de bewaker-op-de-rand
> niet een detail maar de kérn van de taal: er zijn geen sequence flows, alle
> afhankelijkheid loopt via sentries.
>
> **Stand 2026-08-08:** vierde motor-primitief — **zwevende aanhechting**
> (`randAanhechting: "zijden" | "zwevend"`, §3.4). Vier handles is genoeg voor
> een gateway maar niet voor een klassebox met acht associaties; zwevend hecht
> aan de omtrek in plaats van aan een handle, zodat lijnen uitwaaieren en
> meeglijden bij het slepen. Aan in de structuur- en architectuurprofielen; de
> gedragsprofielen houden hun handles.

Dit document legt de richting vast voor sequence-, activity-, state-machine- en
BPMN-diagrammen op de generieke diagram-motor (`diagramcore`), met bijzondere aandacht
voor de vraag *"is BPMN eigenlijk een UML-profiel van het Activity-diagram?"* en voor het
**doorklikken in subprocessen / call-activities**.

---

## 1. Uitgangspunt: de motor is declaratief profiel-gedreven

Een diagramtype is (zie `statemachine/index.js`) een **declaratie**:

- `elementTypes` — nodes én connectors, met `shape`, `properties`, `compartments`, en voor
  connectors `bron`/`doel` (dat zíjn meteen de verbindings-/validatieregels: *begin* heeft
  geen inkomende, *eind* geen uitgaande), `edgePresentatie` en `hooks.edgeLabels`.
- `shapes` — kleine custom React-shapes (`registreerShape`).

State machine v0 is daarmee "twee shapes + een descriptor, verder geen motor-wijziging".
**Zolang het metamodel de constructie kan uitdrukken, is een nieuw diagramtype dus een
declaratie — geen motor-werk.** De echte investering zit niet in de losse profielen maar in
een handvol **motor-primitieven** die de profielen delen. Dat maakt de sequencing-vraag
("welk diagram eerst?") ondergeschikt aan de vraag "welk primitief eerst?".

---

## 2. De vier gedeelde motor-gaten (uit de verkenning)

Het plan benoemt vier gaten in de core. Ze zijn niet per-diagram maar **cross-cutting**:

| Motor-gat | Sequence | Activity | State machine | BPMN |
|-----------|:--------:|:--------:|:-------------:|:----:|
| **1. As-/volgorde-semantiek** (positie → orde, layout-constraints) | ● kern | ○ | ○ | ○ |
| **2. Semantische containers/lanes** (partities, fragments, composite states, pools/lanes) | fragments | partities | **composite states** | lanes (+pools, zie §4) |
| **3. Rand-aanhechting / ports** (elementen óp de rand) | — | pins | **entry/exit-points** | **boundary events** |
| **4. Connector→connector & sub-shapes** (aanhechten aan een lijn/bar) | message→activation | — | — | — |

● = grootste gat/kern · ○ = klein · — = n.v.t.

De twee gaten die de **meeste** diagrammen delen — **#2 (containers)** en **#3 (ports)** — zijn
de leverage-punten. State machine v0 stuit al op precies deze twee (composite states =
container; entry/exit = port).

---

## 3. Twee primitieven om éérst te bouwen

### 3.1 Ports / rand-aanhechting (gat #3)

Eén primitief — *"aanhechtpunt op de rand van een element, waar een connector op kan
landen/vertrekken"* — bedient:

- **BPMN boundary events** (message/timer/error… op de rand van een activity, interrupting of
  niet),
- **State machine entry/exit points** (en later junction/choice-pseudostates),
- **Activity pins** (object flow in/uit een action).

In termen van de descriptor: een `ports`-declaratie op een `elementType` (positie/rol op de
rand), en `bron`/`doel` van een connector die naar een port mag verwijzen i.p.v. het hele
element.

### 3.2 Behavior-reference & containers (gat #2) — het doorklik-primitief

Dit is het **hoogste-waarde** primitief en het antwoord op "goed kunnen doorklikken in
subprocessen en call-activities". Eén concept — *"een node die naar een ander gedrag
verwijst of het bevat"* (`verwijstNaarGedrag` / `bevatGedrag`) — bedient álle
gedragsdiagrammen:

| Notatie | Constructie | UML 2 |
|---------|-------------|-------|
| BPMN | **Call activity** (herbruikbaar) | `CallBehaviorAction → Activity` |
| BPMN | **Sub-process** (embedded) | `StructuredActivityNode` |
| State machine | **Composite state → submachine** | submachine state |
| Activity | genest gedrag | StructuredActivityNode / CallBehaviorAction |

Bouw dit één keer en:

- **dubbelklik op een call-activity/subproces → open het gerefereerde gedrag als nieuwe
  diagram-tab** (sluit naadloos aan op de projectbrowser + tabs uit fase 3);
- het werkt **cross-notatie**: een activity-node kan een BPMN-subproces callen en andersom,
  want het is dezelfde relatie;
- containers (embedded) en referenties (call) delen de metamodel-basis; embedded vraagt extra
  om **container-layout** (lanes/regio's), call niet.

### 3.3 Buitenlabel — de naam náást de vorm (gebouwd 2026-07-29)

Een derde primitief, klein maar cross-cutting. `ElementNode` deed niets met
`element.naam`: elke shape rendert zijn eigen tekst. Dat werkt voor boxen, maar
een BPMN-event is een ring van 30px en een gateway een ruit van 34px — daar
*past* geen tekst in. Gevolg: die elementen waren stilzwijgend naamloos, zonder
dat iets erover klaagde.

`ElementType.naamLabel` lost dat declaratief op:

- `"binnen"` (default) — de shape rendert de naam zelf; niets verandert;
- `"buiten"` — **de motor** zet de naam als los label onder de vorm;
- `"geen"` — nooit tonen.

Twee implementatiedetails die niet vanzelf spreken:

1. Het label is een **broer** van de shape, geen kind. `.dc-node` heeft
   `overflow: hidden` en zou het wegknippen; de React Flow-node-wrapper is
   `position: absolute` en fungeert als referentiekader.
2. Het label krijgt een **vaste** breedte, geen `max-width`. Een absoluut
   gepositioneerd element ontleent zijn shrink-to-fit-breedte aan het containing
   block — bij een event-ring is dat 30px, waardoor de tekst letter voor letter
   afbreekt.

Diagram-breed uit te zetten via **Beeld → Buitenlabels**, in hetzelfde patroon
als `data-dc-typering`: menuBus → localStorage per taakbalk → `data-dc-labels`
op het canvasvlak → één CSS-regel. Eén schakelaar voor álle profielen.

Toegepast op: BPMN start/tussen/eind/boundary-event en de drie gateways; state
machine begin/eind/keuze/junction/historie/entry/exit; activity begin/eind/
flow-eind/beslissing/fork/pin.

### 3.4 Zwevende aanhechting — de lijn hecht aan de omtrek (gebouwd 2026-08-08)

Een connector pakt vast aan één van vier handles: het midden van elke zijde.
Voor een BPMN-gateway of een begin-stip is dat prima — die vormen zijn klein,
vier punten dekken ze. Voor een UML-klasse met acht associaties is het armoede:
alle lijnen knijpen door hetzelfde punt.

`ElementType.randAanhechting` (met `DiagramType.randAanhechting` als
profiel-default) zet daar `"zwevend"` tegenover: het uiteinde ligt op de
**omtrek**, op de plek waar de lijn naar de buur hem kruist. Lijnen naar
verschillende buren waaieren dan vanzelf uit, en bij het slepen glijdt het
aanhechtpunt mee — je hoeft nooit meer een handle "goed te zetten". Dat is wat
EA, Archi en Visio doen, en de reden dat je daar nooit over handles nadenkt.

Twee begrenzingen die het ontwerp bewust klein houden:

1. **De zijde verandert niet.** Het zuivere snijpunt van de middellijn met de
   omtrek geeft bij een brede, lage node rare uitkomsten — een buur die
   duidelijk rechts ligt wordt dan via de bóvenrand verbonden, en de
   orthogonale router maakt daar een lange omweg omheen (in de praktijk
   geprobeerd; het zag er slechter uit dan het probleem dat het oploste).
   Daarom kiest de zwevende variant de zijde met exact dezelfde regel als
   `besteZijde`, en schuift alleen het punt **langs** die zijde op. Het
   verschil met de oude situatie is precies één ding: dezelfde zijde, een
   betere plek erop.
2. **Een handmatig gekozen handle wint altijd.** Zweven geldt per uiteinde en
   alleen waar `data.sourceHandle`/`targetHandle` leeg is — dus precies de
   stand die "normaliseer relaties" achterlaat. Wie een lijn met de hand heeft
   vastgezet, houdt hem.

Aan in de structuur- en architectuurprofielen (puur-UML, canoniek-UML, MIM,
OAS, ERD, SysML, ArchiMate, DMN DRD, use case); de gedragsprofielen houden hun
handles, want daar zijn de vormen klein en dragen de vier punten betekenis.

### 3.5 Voorkomen — element en plaatsing zijn niet hetzelfde (gebouwd 2026-08-31)

Een modelelement kan meer dan één keer op hetzelfde diagram staan. Dat is
normaal in grote architectuurplaten en zit expliciet in het ArchiMate Model
Exchange-formaat: het element heeft een identifier, ieder visueel voorkomen
een eigen node-identifier. Diagramcore vereenzelvigde die twee voorheen.

`DiagramNode.nodeId` maakt het onderscheid nu expliciet:

- `nodeId` is optioneel; zonder waarde blijft `elementId` de voorkomen-ID.
   Bestaande diagrammen en werkbestanden worden niet gemigreerd of herschreven;
- React Flow, positie, grootte en verwijderen werken op
   `nodeId ?? elementId`; selectie en inspector blijven naar het modelelement
   wijzen;
- `DiagramType.meerdereVoorkomens` staat standaard uit en kan per
   `ElementType` worden overschreven. Het staat aan voor ArchiMate, puur UML en
   canoniek UML;
- boomknop en canvasdrop bieden alleen dan een tweede voorkomen aan;
- connectoren groeperen voorkomens per element en kiezen standaard het paar
   met de kortste afstand. `diagram.connectorVoorkomens` kan per connector een
   expliciet `{bronNodeId, doelNodeId}` vastleggen;
- `diagram.verborgenConnectoren` is een view-eigen hide-list. Een edge kan via
   het contextmenu worden verborgen; **Beeld → Toon verborgen relaties** maakt
   ze weer zichtbaar;
- rand-elementen zijn in deze stap zelf enkelvoudig. Als hun gastheer meerdere
   voorkomens heeft, gebruiken ze voorlopig het eerste voorkomen. Een
   gastheer-voorkomen expliciet kiezen is vervolgwerk zodra een notatie dat
   nodig heeft.

ArchiMate gebruikt het primitief als eerste profiel volledig. Daarbij kwamen
ook twee view-only typen: `kader` (boundary-shape, zonder ArchiMate-semantiek)
en `toelichting` (een gestippelde lijn van een notitie naar een element).
Samen vormen voorkomen-ID, hide-list en view-only inhoud de basis waarop de
latere Exchange-viewimport kan landen.

---

## 4. "Is BPMN een UML-profiel van het Activity-diagram?"

**Grotendeels ja, als mentaal model en als sequencing — maar niet "een kleine stap".** De
token-flow-kern is gedeeld (beide Petri-net-achtig), dus ~60–70% is "Activity + labels":

| BPMN | UML 2 Activity | Verhouding |
|------|----------------|-----------|
| Task / Activity | Action / CallBehaviorAction | 1:1 |
| Exclusive (XOR) gateway | Decision / Merge | 1:1 |
| Parallel (AND) gateway | Fork / Join | 1:1 |
| Start/End event (plain) | Initial / FlowFinal | ~1:1 |
| Lane | ActivityPartition | 1:1 |
| Sequence/data flow | ControlFlow / ObjectFlow + pins | ~1:1 |
| Sub-process / Call activity | StructuredActivityNode / CallBehaviorAction | 1:1 |

De **echte delta** (waar "profiel" onderschat wordt):

1. **Event-model, niet gateways, is de bulk.** BPMN's event-taxonomie
   (start/intermediate/end × catching/throwing × message/timer/error/signal/escalation/
   compensation/conditional/link/terminate) + vooral **boundary events** (interrupting vs
   non-interrupting) vraagt precies om primitief §3.1 (ports). UML's AcceptEventAction /
   interruptible regions mappen niet 1:1.
2. **Niet alle gateways zijn hernoemde decisions.** XOR/AND ✓, maar **inclusive (OR) gateway**
   heeft niet-lokale join-semantiek (welke takken waren actief?), en **event-based** en
   **complex** gateways hebben geen schone Activity-tegenhanger. Dit is validatie-/
   uitvoeringssemantiek, geen tekenwerk.
3. **Pool ≠ lane.** Een lane is een partitie (§2), maar een **pool is een participant** en
   **message flow tussen pools is collaboration** — een laag *boven* Activity (meerdere
   Activities + berichten), geen intra-activity control flow. Het plan bundelt "pools" nu met
   de BPMN-gap; ik zou lane (partitie, gat #2) en pool (participant/collaboration, nieuw)
   scheiden.

Conclusie: **BPMN = Activity-core + een event/port-mechanisme + een collaboration-laag.** De
BPMN↔UML-mapping is een klassiek MDE-onderwerp (o.a. de SBQS-2008-paper,
`https://homepages.dcc.ufmg.br/~cascini/SBQS_2008.pdf`); diezelfde literatuur flagt steevast
events en collaboration als de mismatch-punten. Dat sluit aan bij bovenstaande.

---

## 5. Aanbevolen volgorde

Het plan zet **state machine → activity → BPMN → sequence** (van klein naar groot gat). Prima.
Aanvulling: **bouw de twee gedeelde primitieven eerst, motor-niveau**, zodat elk volgend
diagramtype "declaratie + validatie" wordt i.p.v. motor-werk:

1. **Ports / rand-aanhechting** (§3.1) — deblokkeert entry/exit (state machine), pins
   (activity) én boundary events (BPMN).
2. **Behavior-reference & container-layout** (§3.2) — deblokkeert composite states, subproces,
   call activity, en het doorklik-/tab-gedrag.
3. Dan de diagramtypes afmaken: **activity** (partities + geordende flow), **BPMN**
   (event-taxonomie + gateway-subtypes + pool/collaboration), **sequence** (as-semantiek +
   activations — grootste gat).

State machine v0 laat vast zien wat "core + labels" oplevert; de bekende open punten daar
(composite states, junction/choice, regio's/history) zijn exact de primitieven hierboven.

---

## 6. Openstaande semantiek-vragen (voor later)

- **Inclusive-OR join** en **event-based gateway**: uitvoeringssemantiek, niet alleen
  weergave — hoe ver willen we die valideren/simuleren?
- **Pool + message flow**: als aparte collaboration-laag modelleren, of BPMN-pools bewust
  buiten scope houden in v1?
- **Ordening/as** (sequence): positie-als-semantiek botst met vrije layout — apart
  diagram-subtype met layout-constraints?

---

*Zie ook:* `docs/plans/2026-07-11 STUDIO consolidatie.md` (§Metamodel-verkenning: gedragsdiagrammen),
`web/vite/src/diagramprofielen/statemachine/` (State machine v0, `785e49d`),
`docs/STUDIO-05-diagramcore-plan.md` (diagramcore), `docs/STUDIO.md`.
