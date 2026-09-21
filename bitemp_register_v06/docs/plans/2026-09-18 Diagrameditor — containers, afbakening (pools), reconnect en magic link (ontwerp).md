# Diagrameditor — containers, afbakening (pools), reconnect en magic link

*Ontwerpnotitie, 2026-09-18. Claude-sessie met Mark; hoort bij backlog §31
(31.3, 31.4, 31.5, 31.8). Raakt `diagramcore/` (motor) en
`diagramprofielen/bpmn/` (eerste afnemer).*

> **Status 2026-09-18: alle vier gebouwd** en in de browser nagelopen (BPMN).
> Tijdens het bouwen bijgekomen: (1) een nieuw element dat via *Maken* of de
> magic link ín een container belandt wordt er meteen lid van — anders ligt het
> er wél in maar hoort het er niet bij, en weigert de afbakening onbegrijpelijk
> een sequence flow; (2) binnen een pool ís het lege vlak de pool zelf, dus
> loslaten op het *vlak* van een container telt als leeg vlak, loslaten op een
> *handle* als verbinding naar die container. Restpunten: backlog §31.9.

## 1. Containers houden hun inhoud vast (§31.3)

### Stand vóór deze wijziging
Lidmaatschap is een connector in het **model** (`ElementType.containerVoor`
wijst naar het connectortype, bv. `bevat`); het geldt dus op elk diagram waar
container en lid samen staan. Posities zijn **absoluut per diagram**. De
container wist visueel niets van zijn leden: verslepen liet ze staan.

### Besluit
> *Mark: "relatief is goed voor elementen die in een container zijn gevallen.
> Dan moeten ze wel beperkt worden door de grenzen van de container."*

- **Presentatie relatief, opslag absoluut.** Bij het opbouwen van de React
  Flow-nodes krijgt een lid `parentId` = het container-voorkomen en een
  positie relatief daaraan (`extent: "parent"` → begrensd door de container).
  De store blijft absolute posities voeren; de canvas rekent om bij het
  opbouwen (absoluut → relatief) en bij dragstop (relatief → absoluut).
  Waarom niet relatief opslaan: materialisatie van connectoren
  (`besteZijde`), auto-layout, afbeelding-export, V3-export en de
  container-dropdetectie rekenen allemaal met absolute posities — en er is
  dan geen migratie van bestaande diagrammen nodig.
- **"Erin gevallen" = lid én geometrisch erin.** Alleen een lid waarvan het
  middelpunt binnen de container ligt wordt genest. Een lid dat erbuiten
  ligt blijft vrij en toont zijn lidmaatschapslijn — exact de bestaande regel
  van `edgePresentatie.verbergBijNesting`, zodat lijn en nesting nooit
  tegenstrijdig zijn. Bestaande diagrammen verspringen daardoor niet.
- **Container verslepen** = alle (ook diepere) leden schuiven mee; de canvas
  schrijft hun nieuwe absolute posities in dezelfde bulk-mutatie terug (één
  undo-stap).
- **Eruit halen**: de begrenzing maakt wegslepen onmogelijk, dus:
  **Alt+slepen** tilt een lid over de rand (begrenzing tijdelijk uit); laat je
  het buiten elke container los, dan vervalt het lidmaatschap; in een andere
  container = verhangen. Daarnaast bestaat *Losmaken uit "…"* al in het
  contextmenu.
- **Nesting in nesting** (lane in pool, package in package) werkt: ouders
  worden vóór kinderen aangeboden, op diepte gesorteerd.
- **Geen automatisch meegroeien.** Een container groeit niet vanzelf; dat
  vecht met handmatig resizen. (Later eventueel een actie "pas aan inhoud
  aan".)

Rand-elementen (boundary events) blijven zoals ze waren: die slaan hun
positie wél relatief op (`randVan`). Uitlijnen/verdelen werkt op absolute
posities en slaat alleen aangehechte rand-elementen over.

## 2. Pools — het primitief "afbakening" (§31.4)

### Wat zegt de BPMN 2.0-specificatie?
- Een **Pool** is de grafische weergave van een **Participant** in een
  **Collaboration**. Een Participant verwijst naar ten hoogste één **Process**
  (`processRef`); een pool zonder inhoud is een *black box*. Een pool is dus
  inderdaad een actor (PartnerEntity/PartnerRole).
- Een **Lane** is formeel géén actor: het is een *partitie* binnen een Process
  (`LaneSet` → `Lane` → `flowNodeRefs`). De spec geeft lanes uitdrukkelijk geen
  eigen semantiek — "used to organize and categorize Activities"; dat ze
  meestal rollen voorstellen is conventie.
- Een **Sequence Flow** is een `FlowElement` en leeft ín een
  `FlowElementsContainer` (Process of Sub-Process); bron en doel moeten
  FlowNodes in **dezelfde** container zijn. Daaruit volgen de bekende regels:
  een sequence flow mag de grens van een **Pool** niet kruisen, en ook niet de
  grens van een (uitgeklapt) **Sub-Process** — maar wél vrij door **Lanes**,
  want een lane is geen container van flow-elementen.
- Een **Message Flow** hoort bij de Collaboration en verbindt twee
  *verschillende* Participants: "MUST connect two separate Pools … MUST NOT
  connect two objects within the same Pool". Hij mag aan de poolrand zelf
  hangen (black box) of aan een flow-node erbinnen.
- Een proces mag ook **zonder** pool getekend worden (de impliciete
  deelnemer); ten hoogste één pool per collaboration mag zo onzichtbaar zijn.

Marks lezing klopt dus: *"de pool heeft de beperking dat een proces niet
buiten de pool mag lopen; een proces hangt aan elkaar van sequence flows."*
In spec-termen: de sequence flows zijn **eigendom** van het proces, en de pool
bakent dat proces af.

### Is dit een primitief? Ja.
Er zijn twee soorten containers, en het verschil komt in veel notaties terug:

| | **Partitie** (deelt alleen in) | **Afbakening** (begrenst verbindingen) |
|---|---|---|
| BPMN | Lane | Pool (Participant/Process), uitgeklapt Sub-Process |
| UML Activity | Partition (swimlane) | StructuredActivityNode, InterruptibleRegion |
| State machine | — | Region van een samengestelde toestand |
| CMMN | — | Stage (sentries/koppelingen binnen de stage) |
| SysML (ibd) | — | Block-context: connector tussen parts van hetzelfde blok |
| UML packages / ArchiMate groepering | Package, Grouping | — |

Het is dus geen BPMN-eigenaardigheid en ook geen "regel" die je per profiel in
een regeltaaltje wilt uitschrijven. Het is een **vaste eigenschap van een
containertype**, net als `containerVoor` en `randElement`: de motor kent de
betekenis, het profiel wijst alleen aan.

### Voorstel — twee velden, semantiek in de core
- `ElementType.afbakeningVoor: [connectorTypeId, …]` — dit containertype
  **begrenst** die verbindingen: bron en doel moeten binnen **dezelfde**
  afbakening liggen (of allebei in géén). BPMN: `pool.afbakeningVoor =
  ["sequence-flow"]`.
- `ConnectorType.overbrugt: [elementTypeId, …]` — deze verbinding **moet**
  zo'n grens kruisen: bron en doel liggen in **verschillende** afbakeningen
  van dat type. BPMN: `message-flow.overbrugt = ["pool"]`.

De *afbakening van een element* is de dichtstbijzijnde voorouder (via de
`containerVoor`-lidmaatschappen, transitief: taak → lane → pool) van het
gevraagde type; een pool is zijn eigen afbakening (black box); geen voorouder
= de impliciete deelnemer.

De toets zit op één plek — `vindConnectorTypes()` — zodat slepen, de magic
link en straks reconnect dezelfde uitkomst geven. De magic link kan daardoor
ook de **reden** noemen: *"Sequence flow mag de grens van een Pool niet
kruisen — wel mogelijk: Message flow."*

Bewust níet declaratief-algemeen (`context: "zelfde-container"` e.d.): twee
benoemde begrippen met vaste betekenis zijn in de profiel-editor als vinkje /
keuzelijst te tekenen en vragen geen regel-interpreter.

### Afbakening v0 (BPMN)
- Nieuw elementtype **Pool** (container, `containerVoor: "bevat"`, bevat lanes
  en flow-elementen); black box = pool zonder leden.
- Geen `processRef`: de pool is notatie, het proces erachter is impliciet.
- De regels gelden voor **nieuwe** verbindingen; bestaande diagrammen worden
  niet afgekeurd.

## 3. Eindpunten lostrekken — reconnect (§31.5)
Akkoord (Mark): React Flow `onReconnect`, met:
1. **Het type blijft gelijk.** Geldig als het connectortype tussen het nieuwe
   paar mag (zelfde toets als bij tekenen, incl. afbakening). Mag het niet →
   het magic-link-menu legt uit.
2. **Alleen de directe (kale) gedaante**; bij een ASOC-box niet.
3. **Knikpunten vervallen** bij verhangen; de handle wordt de zijde waar je
   loslaat.
4. Verhangen is een gewone modelbewerking (compositie verhangen = GE naar een
   andere entiteit); geen bevestiging, undo dekt het.

## 4. Magic link op het lege vlak (§31.8)
1. Loslaten op het lege vlak → menu met de **elementtypen die als doel mogen**
   vanaf deze bron (met gekozen verbindingstype: alleen voor dat type). Kiezen
   maakt het element op de losplek én legt de verbinding. Past er per
   elementtype meer dan één connectortype, dan wint de descriptor-volgorde.
2. Het nieuwe element komt gecentreerd op de losplek.
3. **Toetsenbordbediening van het keuzemenu** — dit was punt 3 dat onduidelijk
   was. Bedoeld is alleen: als het menu opent hoef je niet naar de muis. De
   eerste optie is gemarkeerd, ↑/↓ verplaatst de markering, **Enter** kiest,
   **Escape** sluit. Handig omdat je de lijn net met de muis hebt losgelaten en
   in de meeste gevallen gewoon de eerste optie wilt.

## 5. Volgorde
31.3 (fundament) → 31.5 (los daarvan) → 31.8 → 31.4 (leunt op 31.3 voor
bruikbare pools en op de gedeelde toets in `vindConnectorTypes`).
