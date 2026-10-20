# Notities, constraints en doorklikken — het superprofiel (ontwerp)

*2026-10-20 · sessie M3-MOF (Claude) met Mark · status: ontwerp, nog niet gebouwd*

## 1. Aanleiding

Drie vragen kwamen samen:

- **Notities.** Elk profiel definieert zijn eigen notitie en notitielijn (bij
  ArchiMate heet de lijn "toelichting"), elk met een eigen lijstje toegestane
  doelen. Sinds 12-10 heeft een notitie alleen tekst; opmerkingen óver één
  element staan in de M3-**beschrijving** (UML `ownedComment`, EA Notes). Open
  stond de keuze: één notitie voor alle profielen (stap 1), en/of de notitie
  laten horen bij het diagram (stap 2).
- **Constraints.** Puur-uml heeft een eigen constraint met een scope-lijn; de
  andere profielen niet.
- **Doorklikken** naar een ander diagram (Mark, 20-10, via OMNIUM-UI), als
  generiek begrip, zoals EA's composite element en Archi's view reference.

## 2. Marks keuzes (20-10)

1. **Notities en constraints zijn modelinhoud.** Ze zijn van de modelleur, net
   als in UML, waar `Comment` en `Constraint` gewone modelelementen zijn. Ze
   horen dus niet bij het diagram. Stap 2 van het eerdere voorstel vervalt.
2. **Twee hardheden van hetzelfde gebaar:** iets kwijt willen dat niet in het
   standaardarsenaal past. Een **constraint** is de harde vorm (een regel,
   desnoods in een expressietaal: als kardinaliteit, id of ordered niet
   volstaat); een **notitie** de zachte (minder gedefinieerd, wel bedoeld).
3. **Ze hangen aan nul of meer elementen, en ook aan relaties:** "misschien
   samenvoegen" tussen twee klassen, "XOR" tussen twee relaties. In UML zijn
   `Comment.annotatedElement` en `Constraint.constrainedElement` allebei 0..*.
4. **Een superprofiel mag.** Notitie en constraint komen in elk profiel, ook
   waar de taal ze niet kent; het voordeel weegt zwaarder dan het
   taal-oneigene, en een purist gebruikt ze gewoon niet. (BPMN kent zelf
   *Text Annotation* met een *Association*: dat ís een notitie met een
   notitielijn.)
5. **De notitie volgt OMG; discussies volgen W3C.** Een notitie is een UML
   `Comment`: van de modelleur, in het model. **Discussies over modellen en
   diagrammen** (opmerkingen, vragen en antwoorden van lezers en reviewers)
   zijn **W3C-annotaties** (Web Annotation Data Model, zoals uitgewerkt in
   Imprint): orthogonaal en extern, bovenop een model, diagram of publicatie.
   Welkome aanvulling, maar UI-werk en geen deel van de notitie.

## 3. Het superprofiel

Een **superprofiel** is een set M3-ingebouwde elementtypen die de motor bij de
registratie aan elk profiel toevoegt, zoals elk profiel er impliciet van
erft. Een profiel kan een type uitzetten (`superprofiel: {constraint: false}`)
of een eigen variant geven met hetzelfde id; standaard staan ze aan.

| Type | Soort | Hoort bij | UML / EA |
|---|---|---|---|
| `notitie` | knoop | model | Comment / Note |
| `constraint` | knoop | model | Constraint / Constraint |
| `annotatielijn` | connector | model | annotatedElement, constrainedElement / NoteLink |
| `diagramverwijzing` | knoop | diagram | — / (Archi: diagram model reference) |

### 3.1 Notitie (model)

- Eigenschappen: `tekst`. Geen naam, geen beschrijving (de notitie ís tekst).
- Staat in het model van het profiel: in de boom, in de MCP, in documenten;
  mag op meerdere diagrammen staan (zoals een EA-Note).
- Waarvoor hij geldt: via annotatielijnen, 0..*.

### 3.2 Constraint (model)

- Eigenschappen: `naam` (optioneel), `specificatie` (tekst), `taal`
  (natuurlijk | OCL | CEL; CEL is wat het register al evalueert).
- Getekend als UML: `{specificatie}` in een kader, of als notitie met
  accolades; aan de constrained elements via annotatielijnen.
- Vervangt de eigen constraint van puur-uml.

### 3.3 Annotatielijn (model)

- Van notitie of constraint naar **elk** element en naar **relaties**.
- Vervangt de per-profiel `notitielijn`, ArchiMate's `toelichting` en de
  scope-lijn van de puur-uml-constraint.
- `aard: "annotatie"` (zie M3 LayoutStijl: telt niet mee voor de volgorde).
- **Motorwerk:** een lijn die aan een andere lijn vastzit (aan het midden van
  een relatie, voor "XOR tussen twee relaties") kan de motor nu niet.

### 3.4 Diagramverwijzing (diagram)

- Zoals Archi's view reference: een object op het canvas met een
  diagram-icoon en de naam van het doeldiagram (live opgezocht);
  dubbelklik opent het, ook in een ander profiel.
- Hoort bij het **diagram**, niet bij het model: niet in de boom, geen
  relaties behalve een annotatielijn. Het enige superprofiel-type dat
  weergave is; bewust, want het gaat over navigatie tussen platen.
- Data: `{profielId, diagramId}`.

## 4. Doorklikken vanaf een element: `verwijstNaar`

Los van de diagramverwijzing kan elk modelelement zelf naar een diagram
verwijzen, zoals EA's composite element ("child diagram").

- **Vaste M3-eigenschap** van elke knoop, naar het patroon van de
  beschrijving: `data.verwijstNaar = {profielId, diagramId}`, 0..1, ook over
  talen heen. Niet op connectoren en notities; een type zet hem uit met
  `verwijstNaar: false`. Module `diagramcore/model/verwijstNaar.js`.
- **Verhouding tot `gedragsVerwijzing`:** de gegevens blijven apart, het
  mechanisme wordt één. `gedragDiagramId` is betekenis (UML
  CallBehaviorAction.behavior, submachine, BPMN calledElement; gebruikt door
  de EA-lezer, transformaties en XMI). Zoals een MIM-`definitie` de vaste
  beschrijving vervangt (`betekenis: "beschrijving"`), krijgen de
  gedragDiagramId-properties `betekenis: "verwijzing"`: dan ís die de
  doorklik en zet de motor er geen tweede veld bij.
- Het datatype `diagram-verwijzing` accepteert dan ook het object
  `{profielId, diagramId}`; een kale string blijft "dit profiel".
- **Metametamodel:** Element —verwijstNaar→ 0..1 Diagram.
- **Gebouwd (20-10, M3-MOF, branch `feat/m3-verwijstnaar`):** `model/verwijstNaar.js`
  (VERWIJST_NAAR, heeftVerwijstNaar, metVerwijstNaar, normaliseerVerwijzing, doorklikVan),
  schema.js, de inspector toont hem, de editor verdraagt de objectvorm, `betekenis:
  "verwijzing"` op de vier gedragDiagramId-properties. Open: de V3-export van het canonieke
  model heeft er geen plek voor (verwijstNaar reist niet mee door V3); EA's composite element
  inlezen.

## 5. Migratie en EA

- Bestaande `notitie`, `notitielijn`, ArchiMate-`toelichting` en de
  puur-uml-constraint worden bij het laden omgezet naar de superprofiel-typen
  (zelfde ids, `migreerModel`-patroon).
- EA: Note → notitie, Constraint-object → constraint, NoteLink →
  annotatielijn; export terug hetzelfde. Een element-Constraint in EA
  (`t_objectconstraint`) is iets anders (een eigenschap van het element; bij
  use cases nu pre-/postconditie) en blijft dat.

## 6. Verdeling en volgorde

1. **`verwijstNaar`** kan los en eerst. M3-MOF: `model/verwijstNaar.js`,
   schema.js, `betekenis: "verwijzing"` op de profielen, de waardevorm van
   `diagram-verwijzing`. OMNIUM-UI: kiezer over alle profielen, navigatie
   naar een diagram in een andere activiteit, ⧉-badge, "Open …" in het
   contextmenu.
2. **Superprofiel** (notitie, constraint, annotatielijn, diagramverwijzing).
   M3-MOF: het registratiemechanisme, de typen, de migratie, de EA-lezer en
   -schrijver. OMNIUM-UI: de constraint-vorm, de diagramverwijzing-vorm, een
   lijn aan een lijn, het palet.
3. **Later, apart:** W3C-annotaties als externe laag (UI).

## 7. Besluiten (Mark, 20-10)

- **Vorm van de constraint:** UML-notatie — het notitie-symbool (ezelsoor) met de
  specificatie tussen accolades `{…}`, in **lichtblauw** in plaats van geel (zoals de
  constraint in de oude IDE). Tussen twee elementen of relaties: annotatielijnen naar
  beide, zoals `{xor}` tussen twee associaties (UML 2.5.1 §7.6.4).
- **Superprofiel-type "uit" in een profiel:** niet weghalen — dat druist in tegen
  overerving (in MOF haalt een subklasse geen geërfde eigenschap weg). Het type wordt
  altijd geërfd en blijft geldig (import, migratie, MCP); een profiel mag het alleen uit
  het **palet** halen met `inPalet: false` (weergave). Bv. ArchiMate erft de constraint
  maar toont hem niet in *Maken*.
- **Annotatielijn naar een relatie:** hecht aan **een plek op de relatie**, een getal van
  0 (bij de bron) via 0,5 (midden) tot 1 (bij het doel); daarmee kunnen midden en beide
  uiteinden, en is de plek sleepbaar. Motorwerk (deels OMNIUM-UI).

## 8. Gebouwd (20-10, M3-MOF, branch `feat/m3-superprofiel`)

- `diagramcore/types/superprofiel.js`: `superprofielTypen`, `vulSuperprofielAan` (bij validatie
  en registratie, na de overerving), `hoortBijDiagram`, `migreerHernoemdeTypen`,
  `maakSuperprofielElement` (terugval voor de palet-knop).
- **Pragmatische keuze:** de lijn houdt het id `notitielijn` (label "Annotatie-lijn"), zodat alle
  bestaande modellen en de EA-lezers blijven werken; alleen ArchiMate's `toelichting` migreert.
- notitie, notitielijn en diagramverwijzing: de superprofielversie wint van een eigen definitie
  (de per-profiel definities zijn daarmee overbodig en mogen later weg); een eigen `constraint`
  blijft (ArchiMate-motivatie, MIM, canoniek).
- Vormen: `constraint` (lichtblauw ezelsoor, `{…}`) en een **voorlopige** `diagramverwijzing`.
- Gecontroleerd: alle 25 profielen valideren met het superprofiel; in de browser (state machine)
  notitie en constraint uit het palet, annotatie-lijn naar een toestand.
- Voor OMNIUM-UI: de echte diagramverwijzing-vorm (doelnaam live, dubbelklik via
  openVerwijzing), `hoortBij: "diagram"` respecteren (niet in boom/MCP-modelinhoud/documenten,
  weg met het diagram), en de lijn aan een plek 0..1 op een relatie.
- Later: EA Constraint-objecten inlezen als superprofiel-constraint.

## 9. Volgorde (was)

Het superprofiel wordt gebouwd nadat Mark de doorklik (UI van OMNIUM-UI, branch
`feat/doorklikken`) getest heeft.
