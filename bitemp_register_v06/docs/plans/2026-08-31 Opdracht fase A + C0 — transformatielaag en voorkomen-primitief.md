# Opdracht: fase A + fase C0 — transformatielaag en het voorkomen-primitief

> **Voor:** de uitvoerende agent (Sol, via VS Code-chat of de GitHub coding
> agent). **Van:** Mark + Claude-ontwerpchat. **Datum:** 2026-08-31.
> **Branch:** `feat/archimate-exchange` (bestaat op origin, gelijk aan main).
> Commit en push naar díe branch; maak géén PR en merge niet naar main.

## Lees eerst, in deze volgorde

1. `CLAUDE.md` — werkafspraken. Voor deze opdracht extra: Nederlandse
   commits (`feat|fix|docs(scope): …`) en documentatie bijwerken in de meest
   specifieke `docs/*.md`. Vermeld jezelf als agent in de commit-trailer
   (niet "Claude" — dat waren eerdere sessies).
2. `bitemp_register_v06/docs/plans/2026-08-31 ArchiMate Model Exchange
   import-export (ontwerp).md` — het goedgekeurde ontwerp. Deze opdracht is
   **fase A + fase C0** uit §13, met §7.3, §8, §9.1, §9.6, §9.7 en de
   besluiten 11–13 (§15) als bindende ontwerpbeslissingen.
3. `bitemp_register_v06/docs/STUDIO-05-gedragsdiagrammen.md` §3 (de
   bestaande motor-primitieven) en `bitemp_register_v06/docs/plans/
   2026-07-29 Overdracht Notaties — diagramprofielen (status).md` (kaart van
   de code).

Alle code leeft in `bitemp_register_v06/web/vite/src/`. Tests: `npm test` in
`bitemp_register_v06/web/vite` (nu **423 groen — dat moet zo blijven**);
build: `npm run build`.

## Opdracht 1 — Fase A: transformatielaag geschikt voor standaardformaten

In `studio/activities/` (`transformatieRegistry.js`, `TransformatiePaneel.jsx`,
`transformaties.js`) en `diagramcore/model/createDiagramStore.js`:

1. **Registry compatibel uitbreiden** (ontwerp §8): optionele
   descriptor-velden `bron` (`{types, accept, mediaTypes,
   detecteer(({naam, tekst})) → score}`), declaratieve `opties`
   (`[{key, label, datatype, default}]`), en een **resultaatcontract**:
   `run` mag `{status: "success"|"warning", summary, diagnostics, created}`
   teruggeven. Bestaande descriptors zonder deze velden blijven ongewijzigd
   werken.
2. **TransformatiePaneel**: bestandskiezer filtert op `bron.accept` van de
   gekozen transformatie; declaratieve opties worden generiek gerenderd; na
   afloop toont het paneel `summary` + diagnostics (uitklapbaar bij veel
   regels) in plaats van alleen "Gelukt". Diagnostic-vorm:
   `{severity, code, message, sourceId, path}` (ontwerp §5.2).
3. **Atomische bulkimport** (ontwerp §7.3): actie
   `importeerModel({elements, diagrams, meta}, {modus: "toevoegen"})` op
   `createDiagramStore` — één Zustand-mutatie, dus één undo-stap; valideer
   het volledige resultaat vóór de mutatie (id-botsingen met bestaande
   elementen ⇒ fout, store onaangeraakt).
4. Tests voor 1–3, inclusief achterwaartse compatibiliteit van de bestaande
   map-JSON-/Markdown-/kopieertransformaties.

## Opdracht 2 — Fase C0: het voorkomen-primitief in diagramcore

Ontwerp staat volledig in §9.1/§9.6/§9.7 van het exchange-ontwerp; kern:

1. **`nodeId` naast `elementId`** op DiagramNode (`diagramcore/model/
   schema.js`, `createDiagramStore.js`, `canvas/DiagramCanvas.jsx`,
   `canvas/materialiseerConnectoren.js`). Optioneel; afwezig ⇒ het voorkomen
   heet `elementId`. **Bestaande diagrammen en werkbestanden moeten
   byte-voor-byte geldig blijven — géén migratie.** De React
   Flow-node-id wordt `nodeId ?? elementId`; het element reist al mee in
   `data`.
2. **Tweede plaatsing**: `addElementToDiagram` weigert nu een duplicaat;
   vervang dat door een pad dat bij een tweede plaatsing een uniek `nodeId`
   genereert. De UI (canvas-drop, boom-drop, "Van diagram halen" enz. in
   `studio/activities/maakDiagramActiviteit.jsx` / `modellerenActivity.jsx`)
   biedt een tweede voorkomen alleen aan waar het profiel het toestaat:
   nieuw veld `meerdereVoorkomens` (DiagramType-default, per ElementType te
   overschrijven; documenteer in `diagramcore/types/schema.js`).
   **Besluit Mark: aan in het ArchiMate-profiel én de UML-profielen
   (puur-uml, canoniek-uml); uit waar een tweede voorkomen betekenisloos is
   (formulier, sequence, toegangsregel).** Positie/maat/verwijderen
   (`updateNodePosition`, `updateNodeSize`, `removeElementFromDiagram`,
   drag/resize in DiagramCanvas) werken op het voorkomen, met behoud van de
   bestaande elementId-aanroepen als compat-pad.
3. **materialiseerConnectoren**: de `Map<elementId, node>` wordt meervoudig;
   een kale edge kiest per view een voorkomen-paar — default het paar met de
   kortste afstand. Selectie en inspector blijven element-gericht (twee
   voorkomens selecteren hetzelfde element — bedoeld gedrag).
   Rand-elementen (`data.randVan`) blijven in deze stap enkelvoudig;
   documenteer dat.
4. **Hide-list** (§9.7): `diagram.verborgenConnectoren: string[]`;
   materialiseerConnectoren slaat die connectoren over voor dat diagram.
   Contextmenu op een edge: "Verberg op dit diagram"; en een manier om ze
   terug te halen (bv. menu Beeld → "Toon verborgen relaties (n)").
5. **ArchiMate-profiel** (`diagramprofielen/archimate/index.js`): nieuw
   `kader`-elementtype (shape `"boundary"`, achtergrond, puur visueel —
   bewust géén ArchiMate-semantiek) en een view-only connector
   `toelichting` (gestippeld, geen markers) die `notitie` met elk
   elementtype verbindt (notitie zit nu niet in `ALLE_IDS` en is
   onverbindbaar). Zet `meerdereVoorkomens` aan op profielniveau.
6. **Tests** (node-testrunner; let op: bestanden die `.jsx` importeren zijn
   daar niet laadbaar — houd nieuwe logica in pure `.js`-modules, zie het
   patroon van `diagramprofielen/bpmn/sequenceFlow.js`): bestaand
   werkbestand zonder nodeId laadt ongewijzigd; twee voorkomens +
   edge-keuze-op-kortste-afstand; hide-list aan/uit; bulkimport = één
   undo-stap; fout vóór bulkmutatie laat de store exact gelijk.

## Afronding

- Werk de docs bij: nieuw §3.5 (het voorkomen) in
  `STUDIO-05-gedragsdiagrammen.md` in de stijl van §3.3/§3.4; de fase-status
  in het exchange-ontwerp (fase A en C0 ✅, mét wat er anders liep dan
  ontworpen); de motor-primitieven-tabel in het statusdocument van
  2026-07-29.
- Commit in logische stappen (fase A apart van C0; de profiel-aanvulling
  apart mag).
- Eindcheck: `npm test` volledig groen (bestaande 423 + nieuwe) en
  `npm run build` schoon; push alles naar `feat/archimate-exchange`.
- Rapporteer aan het eind: wat is gebouwd, welke ontwerpafwijkingen, de
  testtelling, en wat er van fase A/C0 eventueel bewust is blijven liggen.

## Niet doen

Fase B/C (parser, mapping, views), merge naar main, wijzigingen buiten deze
scope, of hernoemen van bestaande store-API's zonder compat-pad.
