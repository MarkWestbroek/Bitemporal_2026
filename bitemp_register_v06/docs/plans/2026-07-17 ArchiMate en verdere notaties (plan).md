# ArchiMate op de diagram-motor — plan (+ verkenning SysML, OWL, ERD, mindmap, C4)

> Datum: 2026-07-17 (autonome nachtsessie) · **bijgewerkt 2026-07-17 (avond)**
> Status: **v0 gebouwd** (§3 fase 1 ✅) — plus **BPMN v0** op de eigen motor.
> Het afzonderlijke ontwerp voor standaarduitwisseling staat in
> [`2026-08-31 ArchiMate Model Exchange import-export (ontwerp).md`](2026-08-31%20ArchiMate%20Model%20Exchange%20import-export%20%28ontwerp%29.md).
> Bouwt voort op `docs/STUDIO-05-gedragsdiagrammen.md` en de twee inmiddels
> gebouwde motor-primitieven: **rand-aanhechting** (`randElement`, §3.1) en
> **gedragsverwijzing** (`gedragsVerwijzing` + dubbelklik, §3.2).
>
> **Stand na de bouw-sessie:**
> - **ArchiMate v0** (`diagramprofielen/archimate/` + `archimateActivity`):
>   ~22 elementtypen over Business/Application/Technology/Motivation in de
>   laag-kleuren, één `archimate-box`-shape met het type-icoon rechtsboven
>   (gedrag = ronde hoeken), junction (en/of), en alle **elf relaties** op
>   bestaande markers — toegang met lezen/schrijven-keuze, beïnvloeding met
>   +/−-label, stroom met naam-label. Regels bewust permissief; **v1 =
>   geldigheidsmatrix als datatabel** (§2.3/§3.2 hieronder) — nog open.
> - **BPMN v0** (`diagramprofielen/bpmn/` + `bpmnMotorActivity`): taak,
>   subproces (doorklik §3.2), start/tussen/eind-events met soort
>   (bericht/timer/fout/signaal), **boundary events op het rand-primitief**
>   (niet-onderbrekend = gestippeld), gateways ×/+/○, lane-container,
>   data-object; sequence flow met [conditie], message flow (permissief).
>   Pools/collaboration = v1, zoals gepland.
> - Nieuw core-datatype **"keuze"** (select over `PropertyType.opties`).

## 1. Waarom ArchiMate past bij deze motor

ArchiMate 3.2 is notationeel verrassend uniform: (vrijwel) elk element is een
**rechthoek met een klein type-icoon in de rechterbovenhoek**, gekleurd naar
laag. Gedragselementen hebben afgeronde hoeken, structuurelementen rechte.
Dat is precies het soort vormgrammatica dat de motor al declaratief kan
(`kleur`, `hoekRadius`, `typeWeergave: "icoon"` met het bestaande
`dc-type-icoon`-mechanisme uit het MIM-profiel). **De tekenlaag is dus geen
werk van betekenis.** De echte inhoud van ArchiMate zit in twee dingen:

1. **De relatiesemantiek** — elf relatietypen met een strikte
   geldigheidsmatrix (welke relatie mag tussen welke elementparen).
2. **De laag-structuur** — Business / Application / Technology (+ Physical),
   plus Motivation, Strategy en Implementation & Migration.

Beide zijn data, geen motor-code. Dat maakt ArchiMate een **declaratie-
profiel** — groot, maar zonder nieuwe primitieven.

## 2. Notatie → motor-mapping

### 2.1 Elementen (per laag een kleur, per type een hoek-icoon)

| Laag | Kleur (conventie) | v0-subset (voorstel) |
|------|-------------------|----------------------|
| Business | geel `#fffbe6`/`#ffff99` | actor, rol, proces, functie, service, object, event |
| Application | blauw `#e6f2ff`/`#99ccff` | component, service, functie, interface, data-object |
| Technology | groen `#e6ffe6`/`#99ff99` | node, device, systeemsoftware, service, artifact, netwerk |
| Motivation | paars `#f3e6ff` | stakeholder, driver, goal, principle, requirement |
| Strategy | oranje/zand `#fff0e0` | capability, resource, course of action |
| Impl. & Migration | roze `#ffe6f0` | work package, deliverable, plateau, gap |

- **Shape**: één nieuwe `archimate-box` (rechthoek, `hoekRadius` uit het
  elementtype: gedrag = rond, structuur = recht) die het type-icoon
  rechtsboven rendert. De ~25 hoek-iconen zijn kleine SVG's in de
  icoonregistry (zelfde patroon als `iconenRegistratie.js`).
- **Alternatieve gedaante** (het icoon *als* vorm, bv. de actor-poppetje-
  variant) kan later gratis via **shapeSets** (P07) — de Definitie blijft
  gelijk, alleen de skin wisselt.
  **✅ Gebouwd (31-08, shapeSet "Iconen als vorm") en aangevuld (01-09):**
  motivation-elementen dragen nu in béide gedaanten hun eigen vormgrammatica —
  **afgeschuinde hoeken** (achthoek), conform spec en Archi; en de afgeleide
  Maken-/Verbinding-balken tonen **scheidingstekens per laag** via het nieuwe
  `ElementType.taakbalkGroep` (generiek motor-veld, zie
  `diagramcore/taskbar/scheidingen.js`).
  **✅ gebouwd** (2026-09-01): shape-set `vormen` — "Iconen als vorm", te
  kiezen via **Beeld → Shape-set**. Twaalf vormshapes
  (`archimate/vormShapes.jsx`) over zestien elementtypen
  (`archimate/vormSet.js`): poppetje, liggende cilinder, proces-pijl,
  chevron, afgerond blok (de drie services), event-pijl, rechthoek met
  kopstreep (business- én data-object), component met uitsteeksels,
  3D-doos, device, systeemsoftware-bol en artifact-dokje. De naam staat
  ín de node onder het symbool (`naamLabel` is Definitie-niveau en wisselt
  niet mee met een set); het symbool schaalt mee met de nodemaat, zodat een
  in de box-gedaante opgerekte node bruikbaar blijft. De
  **motivation**-elementen (stakeholder/driver/goal/principle/requirement/
  constraint) blijven bewust de box met hoek-icoon: de spec kent daar geen
  eigen-vorm-variant. Terugwisselen naar "Standaard" herstelt de boxen
  (de set is puur skin, geen model).

### 2.2 Relaties (alle elf zijn met bestaande edge-middelen te doen)

| ArchiMate-relatie | Lijn | Marker | Al aanwezig? |
|---|---|---|---|
| Composition | solid | ruit (dicht) aan bron | ✓ `ruit` |
| Aggregation | solid | ruit-open aan bron | ✓ `ruit-open` |
| Assignment | solid | bol aan bron + pijl-dicht aan doel | ✓ `bol`, `pijl-dicht` |
| Realization | dotted | driehoek (open) | ✓ `driehoek`, lijnstijl dotted |
| Serving | solid | pijl-open | ✓ |
| Access | dotted | pijl-open (klein); r/w/rw via `data.toegang` → `edgePresentatie`-hook | ✓ (hook bestaat) |
| Influence | dotted | pijl-open + `+`/`−`-label | ✓ via edgeLabels-hook |
| Triggering | solid | pijl-dicht | ✓ |
| Flow | dashed | pijl-dicht | ✓ |
| Specialization | solid | driehoek | ✓ |
| Association | solid | (geen), evt. half-pijl gericht | ✓ |
| **Junction (and/or)** | — | punt-node (klein, gevuld/open) | ✓ patroon `dc-punt-node` (state machine) |

### 2.3 De geldigheidsmatrix — het echte werk

De Open Group-specificatie definieert per elementpaar welke relaties zijn
toegestaan (inclusief afleidingsregels). Handgeschreven `verbindingsregels`
per connector zou honderden regels betekenen. **Voorstel: de matrix als
datatabel** (`archimate/relatiematrix.js`: `{bronType: {doelType:
"cagrs…"}}`, de letter-codering die de spec zelf hanteert) en de
`verbindingsregels` daaruit **genereren** bij registratie. Voordelen:
onderhoudbaar, diffbaar tegen de spec, en herbruikbaar voor een
validatie-hook die bestaande diagrammen naloopt.

### 2.4 Nesting & views

- ArchiMate staat **nesting** toe als alternatieve notatie voor
  composition/aggregation/assignment → ons bestaande container-patroon
  (`containerVoor`) dekt dit; de bevat-connector ís dan de relatie.
- **Viewpoints** (baseline: Layered, Application Usage, Technology Usage,
  Motivation, …) zijn voorgedefinieerde filters op element-/relatietypen.
  V1: gewoon meerdere diagrammen; v2: viewpoint-keuze per diagram die de
  "Maken"-taakbalk en validatie inperkt (descriptor-filter — klein werk).

## 3. Fasering

1. **v0 (1 sessie):** subset van ~20 elementtypen over Business/Application/
   Technology/Motivation, alle 11 relaties met *permissieve* regels
   (alleen laag-agnostische no-go's), `archimate-box`-shape + hoek-iconen,
   kleuren per laag, junction. Activity "ArchiMate" (standaardVerborgen).
2. **v1:** volledige elemententabel + relatiematrix als data → gegenereerde
   verbindingsregels; nesting via containers; validatie-hook (matrix-check
   op bestaand diagram).
   **✅ Elemententabel volledig (04-09):** alle 60 typen van 3.2 (strategy,
   physical, impl & migration, location, grouping, collaborations,
   interactions, interfaces, …) in `archimate/elementen.js` (pure data) met
   laagkleuren, hoek-iconen en taakbalkgroepen — afgedwongen door de eerste
   echte imports (Marks testexport en de GEMMA-doelarchitectuur: 1108
   elementen, 0 overgeslagen). De **relatiematrix en nesting blijven het
   open v1-restant**.
3. **v2:** viewpoints; **Open Exchange Format (XML) import/export** — dé
   killer-feature: uitwisseling met Archi/BiZZdesign. Import mapt op
   elements/diagrams; onze kruisverbanden kunnen ArchiMate-relaties naar
   andere profielen dragen (bv. ArchiMate-applicatiecomponent ⇢ canoniek
   model-entiteit "realiseert").
4. **Later:** afleidingsregels (derived relations), plateaus/roadmapping.

Risico's: de matrix is groot (spec-bijlage B) — mitigatie: genereren + niet
alles in v0 willen; kleurconventies verschillen per huisstijl — mitigatie:
laag-kleur als elementtype-default, per element overschrijfbaar (bestaat al).

## 4. Verkenning overige notaties (kort)

### SysML (v1) ✅ **gebouwd 2026-07-31**
SysML v1 ís een UML-profiel; het meeste is hergebruik:
- **bdd** (block definition) ≈ class-diagram met «block»-stereotype — bijna
  gratis op de bestaande structuur-motor.
- **ibd** (internal block): parts met **ports** aan de rand en connectors
  ertussen — exact ons rand-aanhechting-primitief (§3.1) + containers. Dít
  was vóór deze sessie het gat; dat is nu gedicht.
- **req** (requirements): boxes met «requirement» + trace-relaties
  (satisfy/verify/derive) — de trace-kant past zelfs beter bij
  **Koppelingen/kruisverbanden** dan bij een eigen diagram.
- **parametrics**: constraint blocks — kan, maar nichewaarde; achteraan.
SysML **v2** heeft een eigen metamodel/notatie — bewust negeren tot er
vraag is. *Advies: na ArchiMate; begin met bdd + req.*

**Zo is het gegaan** (`diagramprofielen/sysml/`, activiteit `sysml05`): het
advies is gevolgd — bdd en req — maar **ibd is meteen meegenomen**, want het
enige dat daarvoor ontbrak (ports) is in juli gebouwd. Het blok is nu óók het
ibd-frame: parts erin via `containerVoor`, poorten erop via `randElement`, met
de poortnaam eronder via het buitenlabel (een vierkantje van 16px draagt geen
tekst). Connector en item flow verbinden de poorten.

De **req**-kant bracht twee kleine vondsten. (1) De vijf traceerrelaties zijn
notationeel identiek — gestreept, open pijl, alleen het «stereotype» verschilt.
Vijf knoppen in de balk die er hetzelfde uitzien is slechtere UX dan één
connector met een `soort`-keuze; dat is het geworden (`traces.js`, getest).
(2) **Containment** (⊕ aan de ouderkant) vroeg een nieuwe marker,
`kruis-cirkel` — mogelijk sinds `markerStart` echte SVG-markers aankan (zie
ERD hieronder).

Nog open: **parametrics** (zoals voorspeld achteraan), SysML v2, en het punt
dat het plan zelf maakt — satisfy/verify/derive horen eigenlijk óók in de
**kruisverbanden-matrix** (Koppelingen), niet alleen in een tekening.

### OWL / linked data
Semantisch anders (open world, naamruimten, punning). Tekenen kan de motor
nu al (nodes + gerichte edges, zie het "Graaf (demo)"-profiel), maar een
ontologie wíl je vooral als boom + facetten browsen, niet primair tekenen.
*Advies: pas oppakken samen met een import (Turtle/JSON-LD) en de
projectboom als primaire view; het diagram is daar een afgeleide.*

### ERD met kraaienpoten ✅ **gebouwd 2026-07-31**
Bijna gratis: entiteiten zijn class-boxes; alleen **vier nieuwe
marker-defs** (één/veel × verplicht/optioneel: `||`, `|<`, `o|`, `o<`) in de
markerregistry, en een connector die de kardinaliteit per uiteinde uit
`data` haalt (de `edgePresentatie`-hook bestaat). *Advies: quick win van
een dagdeel; mooi testgeval voor per-uiteinde markers.*

**Zo is het gegaan** (`diagramprofielen/erd/`, activiteit `erd05`): de
inschatting klopte, met één toevoeging die het plan niet zag. De vier markers
zijn er (`kraai-een`, `kraai-nul-of-een`, `kraai-een-of-meer`,
`kraai-nul-of-meer` — opgebouwd uit twee symbolen: één/veel tegen de entiteit,
verplicht/optioneel erachter), en de connector vertaalt `bronKardinaliteit`/
`doelKardinaliteit` via `hooks.edgePresentatie`. **Maar:** `markerStart` kon
tot nu toe alléén een ruit zijn (compositie/aggregatie, en die is geen
SVG-marker maar een polygon dat met de curve meebuigt). ERD-notatie vraagt
dezelfde symbolenset aan *beide* uiteinden, dus `ConnectorEdge` is uitgebreid
met echte bronmarkers. Dat was het werkelijke motor-werk — en het is meteen
wat de BPMN default flow mogelijk maakte.

Verder in het profiel: de entiteit heeft twee compartimenten (**sleutel** boven
de streep, **kolommen** eronder — de klassieke ERD-doos, gratis via het
bestaande compartiment-mechanisme), een **subtype**-relatie voor
supertype/subtype-hiërarchieën, en een **domein**-container om entiteiten te
groeperen. Niet-identificerende relaties zijn gestreept (IE-conventie).

Nog open: Chen-notatie (ruiten en ovalen — een andere vormentaal), afleiding
uit het canoniek model (kandidaat: adapter zoals `mim12/`), en DDL-import/
-export. **DFD (Gane/Sarson)** is nu het volgende kleine ding, zoals gepland.

### Mindmap
De motor kan het tekenen (kale nodes, edges zonder markers), maar een
mindmap staat of valt met **toetsenbord-flow** (Tab = kind, Enter = broer)
en **automatische boom-/radiaallayout**. Dat is UX- en layout-werk
(LayoutStrategie "boom" bestaat als vorm-waarde voor edges, niet als
plaatsings-strategie). *Advies: eerst een generieke boom-LayoutStrategie
(ook nuttig voor packages/composieten), daarna mindmap als dun profiel.*

### C4 (context/container/component)
Zelfde familie als ArchiMate maar veel kleiner: 4 elementtypen + relaties
met tekstlabels, nesting via containers, en **doorklikken van niveau naar
niveau = ons gedragsverwijzing-primitief** (context → container-diagram →
component-diagram). *Advies: goedkoop en populair bij developers; kandidaat
direct na ArchiMate v0 — deelt de box-met-ondertitel-shape.*

### CMMN ✅ **gebouwd 2026-07-31** (stond niet in dit plan)
Case Management Model and Notation — de tegenhanger van BPMN: geen proces dat
je vóóraf uittekent maar een **casus**, waarin dingen *kunnen* gebeuren zodra
aan voorwaarden is voldaan. Er zijn dan ook geen sequence flows; er zijn
**sentries** — bewakers op de rand van een task, stage of milestone.

Dat maakt het een verrassend goede match: die sentry ís het
rand-aanhechtingsprimitief (§3.1 van `STUDIO-05-gedragsdiagrammen.md`), de
stage is een container, en het case plan model de buitenste. Hetzelfde
mechanisme dat BPMN-boundary-events, state machine entry/exit-points,
activity-pins en SysML-poorten draagt, draagt hier de **kern** van de taal.

v0 (`diagramprofielen/cmmn/`, activiteit `cmmn05`): case plan model (mapvorm),
stage (achthoek), task met soort (human/process/case/decision) en de
planningsmarkeringen `!`/`#`/`▷`, milestone (stadion), event listener (dubbele
cirkel), case file item, sentry (open = entry, gevuld = exit) en de on-part-
lijn. Zeven eigen shapes — CMMN's vormentaal ís de betekenis.

Nog open: de **planningstabel** (discretionary items die een behandelaar
tijdens de uitvoering toevoegt), caseFileItem-relaties, en de **expressietaal**
achter sentries en rules. Dat laatste is de interessantste: koppelen aan
CEL/Toegangsspraak in plaats van er een taal bij te verzinnen.

### Nog niet geadresseerd (bewust)
Sequence (grootste gat: as-semantiek + activations), activity/BPMN (volgende
in de gedragslijn), DFD (Gane/Sarson — klein, na ERD), netwerk/deployment
(kan met bestaande vormen + iconen).

## 5. Volgorde-advies (alles bij elkaar)

1. **Activity-profiel** (gedragslijn afmaken: lanes/partities = containers,
   pins = rand-elementen — primitieven zijn er nu);
2. **ArchiMate v0 → v1** (dit plan, §3);
3. **C4** (klein, deelt shapes met ArchiMate) en **ERD-kraaienpoten**
   (marker-werk) als tussendoortjes;
4. **BPMN op eigen motor** (event-taxonomie + boundary events op §3.1);
5. **SysML bdd/req**, dan **sequence** (as-primitief), dan OWL/mindmap.

---
*Zie ook:* `STUDIO-05-gedragsdiagrammen.md` (primitieven §3),
`diagramprofielen/statemachine/` (v1: composiet/submachine/entry-exit),
`diagramprofielen/usecase/` (kleinste declaratie-profiel als sjabloon).
