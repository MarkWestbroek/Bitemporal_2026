# Use case — doel, trigger, condities, flows en scenario's (ontwerp)

*2026-10-18 · sessie M3-MOF (Claude) met Mark · status: stap 1 gebouwd, de rest is richting*

## 1. Aanleiding

De auto-layout van use case-diagrammen moest secundaire actoren rechts zetten
(meting ARCH-PROJECT). Dat leidde tot de vraag wat "primair" en "secundair"
betekenen, en wat een use case verder vastlegt.

## 2. Wat de taal zegt en wat de methode zegt

- **UML 2.5.1** kent het begrip *primaire actor* niet. Een actor hangt met een
  gewone associatie aan een use case; een pijl (navigeerbaarheid) mag, maar
  betekent formeel niet "deze actor start". Een use case hoeft volgens de
  taal geen actor te hebben: hij levert waarde voor actoren *of andere
  belanghebbenden*.
- **De pijl** als "initiatief" was een conventie uit de RUP-tijd, nooit iets
  uit de norm. Mark vindt hem informatief, maar de conventie "primair links,
  secundair rechts" geeft een rustiger plaatje.
- **Jacobson** (de methode): elke use case heeft een actor die hem start;
  daarom werd een timer als actor opgevoerd voor batch-use cases.
- **Cockburn** (*Writing Effective Use Cases*) scheidt twee dingen: de
  **primaire actor** (de belanghebbende met het doel) en de **trigger** (wat
  de use case start: die actor, een tijdstip, een gebeurtenis). Een timer is
  dan geen actor maar een trigger.

Keuze (Mark, 18-10): de lijn van Cockburn. Doel en trigger horen in de use
case zelf.

## 3. Stap 1 — gebouwd (18-10, branch `feat/usecase-cockburn`)

**Betekenis (M2, use case-profiel):**

| Waar | Eigenschap | Soort |
|---|---|---|
| use case | `doel` | tekst |
| use case | `trigger` | tekst |
| use case | `triggerSoort` | keuze: actor, tijd, gebeurtenis |
| use case | `preconditie`, `postconditie` | tekst |
| use case | `flowOfEvents` | tekst (voorlopig, zie §4) |
| associatie | `primair` | boolean: de primaire actor |

- **Controle** (`usecase/controle.js`, hook `valideer`): een waarschuwing, geen
  fout, als een use case geen primaire actor én geen trigger heeft.
- **EA-import:** pre- en postcondities komen uit EA's constraints
  (`t_objectconstraint`, soort Pre-condition / Post-condition), één regel per
  constraint.
- **Weergave:** geen pijl. De layout zet primaire actoren links en de rest
  rechts (renderer: OMNIUM-UI, stijl-optie die `primair` leest; zonder
  `primair` de bestaande heuristiek als terugval).

## 4. Richting — flows

De flow of events is nu één tekstveld. Preciezer:

- **Primair visueel:** de flows staan in het activiteitendiagram dat onder de
  use case hangt (M3 `uitwerking`). Dat is de bron.
- **Tekst als afleiding:** genummerde stappen in tabellen, geordend per flow
  (hoofdflow, alternatieve flows, uitzonderingen), afgeleid uit het
  activiteitendiagram. Mark deed dit eerder met een EA-script dat het AD
  parste.
- **Waar:** een bijzonder documentsjabloon (documentgeneratie), niet een
  invoerveld. Het tekstveld `flowOfEvents` blijft voor wie geen AD tekent.
- **EA** heeft hiervoor zijn *scenario's* (`t_objectscenarios`: Basic Path,
  Alternate, Exception, met stappen in XML). Die zijn in EA-termen paden, dus
  flows; een latere import kan ze naar AD of naar tekst brengen.

## 5. Richting — scenario's

- Een **scenario** is één pad door de flows: een permutatie van hoofdflow en
  alternatieven. Dat kunnen er veel zijn.
- Scenario's krijgen een **naam** en een **prioriteit**; een scenario is een
  goede basis voor een **testscenario**.
- Afleidbaar uit het activiteitendiagram (paden door de graaf); benoemen en
  prioriteren is handwerk dat bij de use case bewaard wordt.
- Let op de woordkeus: EA noemt een flow al "scenario". In Omnium houden we
  flow (stuk gedrag) en scenario (pad door de flows) uit elkaar.

## 6. Open

- De pijl als optionele weergave voor wie hem wil (stijlkeuze, zelfde gegeven
  `primair`).
- Flows uit het AD afleiden (graaf → stappen → tabel) en het documentsjabloon.
- Scenario's als eigen begrip: naam, prioriteit, pad, koppeling met tests.
- EA-scenario's importeren.
