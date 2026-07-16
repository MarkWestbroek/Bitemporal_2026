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
> associatie/«include»/«extend»/generalisatie). Nog open uit de verkenning:
> as-/volgorde-semantiek (sequence), lanes met betekenis, regio's,
> connector→connector (activations) en de validatie-hook. Vervolgplan:
> `docs/plans/2026-07-17 ArchiMate en verdere notaties (plan).md`.

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
