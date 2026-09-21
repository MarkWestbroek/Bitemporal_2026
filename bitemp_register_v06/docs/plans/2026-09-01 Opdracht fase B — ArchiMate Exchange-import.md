# Opdracht: fase B — de ArchiMate Model Exchange-import

> **Voor:** de uitvoerende agent (Sol, via VS Code-chat of de GitHub coding
> agent). **Van:** Mark + Claude-regiechat. **Datum:** 2026-09-01.
> **Branch:** `feat/archimate-exchange`. **Begin met `git pull`** — er staan
> drie rondes werk van ná jouw fase A/C0-beurt (paneel-fixes en de
> shapeSet "Iconen als vorm"). Commit en push naar deze branch; geen PR,
> niet mergen naar main.

## Lees eerst

1. `CLAUDE.md` — werkafspraken (Nederlandse commits, docs bijwerken; vermeld
   jezelf in de commit-trailer).
2. `bitemp_register_v06/docs/plans/2026-08-31 ArchiMate Model Exchange
   import-export (ontwerp).md` — hoofdstukken **4, 5, 6, 7, 9, 11 en 12**
   zijn je bouwtekening; de **besluiten 1–13 (§15) zijn bindend**. Deze
   opdracht is **fase B volledig, plus de verticale view-slice uit fase C**
   (§17): één import die óók de views herkenbaar op het canvas zet, zodat
   het resultaat klikbaar te bewijzen is.
3. Wat er sinds jouw vorige beurt al ligt en dat je **moet gebruiken**:
   - jouw fase A: het uitgebreide transformatiecontract
     (`studio/activities/transformatieRegistry.js`) en de atomische
     `importeerModel` op `diagramcore/model/createDiagramStore.js`;
   - fase C0: het **voorkomen-primitief** (`DiagramNode.nodeId`,
     `diagramcore/model/voorkomens.js`), `diagram.verborgenConnectoren`,
     `diagram.connectorVoorkomens`, en in het ArchiMate-profiel `kader` en
     de `toelichting`-connector.

Alle code in `bitemp_register_v06/web/vite/src/`. Tests: `npm test` in
`bitemp_register_v06/web/vite` — nu **443 groen, blijft groen**. Build:
`npm run build`.

## Wat je bouwt

### 1. De Exchange-laag (ontwerp §5.1–§5.3)

Nieuwe map `diagramprofielen/archimate/exchange/` met:

- `exchangeModel.js` — JSDoc-typedefs van het neutrale bronmodel (§5.2) en
  van `Diagnostic` (`{severity, code, message, sourceId, path}`).
- `parseExchange.js` — pure parser op `DOMParser`: root/namespace-controle
  (bekende Open Group-namespacefamilie, parsing op `localName`, expliciete
  fout bij onbekende hoofdnamespace), indexes voor elementen, relaties,
  views, property definitions en organizations, controle op dubbele
  identifiers en ontbrekende referenties. Geen store, geen UI, geen
  `window.alert`; diagnostics als data.
- `typeMapping.js` — de tabellen uit §6.1/§6.2, inclusief de expliciete
  naamvarianten (`Composition` én `CompositionRelationship`, enz. — **niet**
  generiek het achtervoegsel strippen). Onbekende typen: melden
  (`AMX-TYPE-*`), overslaan, relaties naar zo'n element gecontroleerd mee
  overslaan; het neutrale model behoudt ze.
- `naarCoreModel.js` — adapter naar het diagramcore-contract
  (`{diagramTypeId: "archimate", elements, diagrams, meta}`):
  - naamkeuze volgens de taalregels van §6.3 (importtaal → primaire taal →
    Engels → zonder taal → eerste → "(naamloos)"); alle varianten onder
    `data.exchange.names`/`.documentation`;
  - properties getypeerd naar `data.exchange.properties` (§6.4), niet naar
    profielproperties;
  - `Access.accessType` → `data.toegang` (r/w/rw), `Influence.modifier` →
    `data.invloed`, relatienaam → `naam` (§6.2);
  - identiteit volgens §7.1: interne id `amx:<importId>:<identifier>`,
    origineel in `data.exchange.identifier`, `importId` in `meta.exchange`.
- `diagnostics.js` — codefamilies uit §11.2.
- `fixtures/` — minimaal handgeschreven: `minimaal-model.xml`,
  `meerdere-views.xml`, `properties-en-stijl.xml`, `onbekende-typen.xml`,
  plus één fixture met **twee voorkomens van hetzelfde element in één view**
  en een **Label + Container**. Gebruik geen netwerk; als Mark een echte
  Archi-export aanlevert komt die er later bij.

### 2. Views — de verticale slice uit fase C, op het C0-primitief

Iedere Exchange-view wordt één diagram (§6.5), en hier betaalt fase C0 zich
uit — gebruik hem echt:

- view-node-identifier → **`nodeId`** op de DiagramNode; **meerdere
  voorkomens van één element per view zijn dus gewoon toegestaan** (besluit
  11 heeft de oude MVP-beperking en `AMX-DUPLICATE-OCCURRENCE` vervangen);
- bounds → `position`/`size`; geneste nodecoördinaten naar absolute
  diagramcoördinaten (§9.3: geometrie behouden, géén semantiek afleiden);
- connections die naar specifieke node-voorkomens verwijzen →
  `diagram.connectorVoorkomens`;
- een relatie waarvan beide uiteinden in de view staan maar zónder
  connection → `diagram.verborgenConnectoren` + info-diagnostic (§9.7);
- view-`Label` → `notitie`-element, `Container` → `kader` (§9.6); een kale
  connection van een Label → `toelichting`-connector;
- bendpoints, styles, fonts, attachments: bewaren in bronmetadata +
  `AMX-LOSS-*` melden (besluit 4); viewstijlkleur optioneel naar
  `data.kleur` via de importoptie `stijlen`.

### 3. De transformatie zelf (§5.4)

Nieuw `studio/activities/archimateTransformaties.js`, geregistreerd via het
fase A-contract: id `import-archimate-model-exchange`, richting `import`,
profielTypes `["archimate05"]`, `bron.accept` `.xml`/`.archimate` met een
`detecteer` op root/namespace, opties `taal` (default "nl") en `stijlen`
(default true). `run`: parse → adapter → **atomisch toepassen via
`importeerModel`** → diagrammen én niet-gevisualiseerde elementen in de
gekozen doelmap plaatsen (volg het patroon van de bestaande
map-JSON-import in `transformaties.js`) → resultaat met
`summary` ("3 views, 42 elementen en 51 relaties geïmporteerd") en
diagnostics. Fouten vóór de mutatie laten store én mapstructuur exact
gelijk. Organizations: parsen en bewaren in meta, **niet** naar mappen
projecteren (besluit 6).

### 4. Tests (§12.1/§12.2)

- `parseExchange.test.js` en `naarCoreModel.test.js` — de lijstjes uit
  §12.1 zijn je checklist (namespace-varianten, meertaligheid, dubbele
  ids, alle elf relaties, junctionvarianten, taalkeuze, absolute posities,
  onbekende typen zonder halve connectoren, ongebruikte elementen).
- Integratie: transformatie vindbaar via `getTransformaties("import")`;
  import in lege doelmap; bestaande store-inhoud blijft; één undo-stap;
  fout vóór de bulkmutatie verandert niets.
- Let op de testrunner-valkuil: node kan geen `.jsx` laden — parser,
  mapping en adapter zijn pure `.js` en importeren niets uit de
  profiel-`index.js` behalve eventueel een gedeelde puur-js mapping.

### 5. Verplicht: in de browser naklikken

Jouw vorige beurt was 435 groen én had twee UI-bugs die alleen klikken
vond (hook na een early return; achtergebleven `setKlaar`). Daarom, niet
onderhandelbaar: dev-server `npx vite --port 5177 --strictPort` in
`bitemp_register_v06/web/vite`, playwright via
`bitemp_register_v06/web/vite/node_modules/playwright/index.mjs`,
localStorage `studio-shell` → `{"activeId":"modelleren"}`. Doorloop
Modelleren → Project → Transformeren → Importeren: kies je
`meerdere-views.xml`-fixture, voer uit, en bewijs met screenshots:

1. het paneel met samenvatting en diagnostics;
2. een geïmporteerde view op het canvas met herkenbare posities, inclusief
   het element dat er twee keer op staat;
3. de projectboom met de diagrammen in de gekozen doelmap;
4. undo (Ctrl+Z) die de héle import in één stap terugneemt.

Server na afloop stoppen. Zero pageerrors is onderdeel van het bewijs.

## Afronding

- Docs: fase B + view-slice afvinken in het exchange-ontwerp (§13, mét
  afwijkingen), de ondersteunde subset en grenzen eerlijk benoemen; korte
  regel in `docs/STUDIO.md` bij de transformaties.
- Commits in logische stappen (parser / adapter / transformatie+UI /
  docs); `npm test` en `npm run build` groen; push.
- Rapporteer: aantallen (typen gedekt, diagnostics-codes), afwijkingen van
  het ontwerp, testtelling, paden van de bewijs-screenshots.

## Niet doen

Fase D/E (export, bendpoints, organizations→mappen, merge/sync), geen
tweede parser achter het profielmenu (besluit 1), geen wijzigingen aan de
transformatielaag-API's zonder compat, niet mergen naar main.
