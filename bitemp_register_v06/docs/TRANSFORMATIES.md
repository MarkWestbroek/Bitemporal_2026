# Transformaties — stand, vorm en richting

> Stand per 2026-10-20 (eerste versie 2026-10-05). Dit document bundelt wat er over transformeren verspreid
> vastlag (consolidatieplan 2026-07-13, ArchiMate-exchange-ontwerp 2026-08-31 §8,
> integrale review 2026-09-30 §5) en legt de **vorm** vast waarin nieuwe
> transformaties worden geschreven. Eerste toepassing van die vorm: *Mermaid
> flowchart → use case-model* (§6).

## 1. Begrippen

Transformeren is de generieke term; importeren en exporteren zijn transformaties
met een externe bron of bestemming.

| Richting | Bron | Doel | Metaniveau |
|---|---|---|---|
| `import` | buiten de Studio (bestand, geplakte tekst, later API) | een model in een map | externe syntax → M1 |
| `transform` | een model | een (ander) model | M1 → M1, beschreven als afbeelding M2 → M2 |
| `export` | een model | buiten de Studio | M1 → externe syntax |

Een transformatie is dus altijd een afbeelding tussen twee **talen** (profielen of
externe formaten); wat ze omzet is een model in zo'n taal. Bij `transform` horen
de **kruisverbanden** in de koppelingen-matrix: zij zijn de bewaarde trace tussen
bron- en doelelement.

## 2. Stand

**De laag zelf** (gereed sinds fase A, 2026-08-31):

- `studio/activities/transformatieRegistry.js` — register en contract: `id`,
  `richting`, `profielTypes`, `bron` (types/accept/`detecteer`), declaratieve
  `opties`, en het resultaat `{status, summary, diagnostics, created}`.
- `studio/activities/TransformatiePaneel.jsx` — het generieke scherm (actie, bron,
  doel, transformatie, opties, meldingen). Bron bij import: een bestand **of
  geplakte tekst**.
- `diagramcore/model/createDiagramStore.js` → `importeerModel` — atomische
  bulkimport: valideren vóór de mutatie, één undo-stap.

**Wat erop is aangesloten:**

| Richting | Transformatie | Vorm |
|---|---|---|
| import | JSON-map-export → map | code (`transformaties.js`) |
| import | ArchiMate Model Exchange → ArchiMate-model | code: parser → IR → core-model (`archimate/exchange/`) |
| import | OpenAPI → canoniek model | code: `oasNaarV3` → V3 → core-model |
| import | **Mermaid flowchart → use case-model** | **lezer + regelset + toepasser** (§3, §6) |
| import | **BPMN 2.0 XML → BPMN-model** (bpmn-motor) | **lezer + regelset + toepasser** (§10) — mét BPMNDI-diagramlaag |
| import | **DMN XML → DMN DRD-model** | **lezer + regelset + toepasser** (§10) — mét DMNDI |
| transform | Kopieer map-inhoud naar een map | code |
| export | Map → JSON, Map → Markdown-overzicht | code |
| export | Map → document (per documentsjabloon één transformatie, `document-<id>`) | sjabloon-renderer (`transformatie/sjabloon/`), zie *plans/2026-10-09 Documentsjablonen* |
| export | **Use case-model → Mermaid flowchart** | **graafbeeld + regelset + toepasser + schrijver** (§3, §6) — de terugweg van de import, roundtrip getest |

**Buiten de registry** (ouder, eigen ingang):

- IDE-import/-export van klassediagrammen: Mermaid, PlantUML en XMI via het
  tussenformaat RawUML (`umleditor/import/`, `umleditor/export/`, zie
  [RAWUML.md](RAWUML.md) en [IDE_IMPORT_EXPORT.md](IDE_IMPORT_EXPORT.md)).
- IDE-bewerkingen binnen het model (entiteit → gegevenselement, entiteit
  splitsen, relatie → associatieklasse): pure functies met een patch-contract in
  `ide/transformations.js`, zie [EDITOR_BEWERKINGEN.md](EDITOR_BEWERKINGEN.md).
- **Sparx EA `.qea` → puur-uml / activity / use case / MIM** (2026-10-08): lezer op de SQLite-repository
  van EA, client-side met sql.js, via *Bestand → Importeer Sparx EA (.qea)…* in
  de UML-activiteit. Eén pakket met deelpakketten, mét diagrammen (posities,
  maten, knikpunten, verborgen lijnen) en stabiele ids uit de EA-GUID;
  stereotypen/tagged values reizen mee op `data`. `diagramprofielen/ea/`
  (`qeaLezer.js` sql.js → rijen, `qeaNaarPuurUml.js` rijen → model, puur;
  `qeaHulp.js` parsers, `qeaKern.js` gedeeld, `qeaNaarActivity.js` en
  `qeaNaarUsecase.js` via de Activity- en Use case-activiteit, `qeaNaarMim.js`
  via de MIM-activiteit met tagged values → mim12-properties; in Modelleren
  *Bestand → Importeer Sparx EA (.qea)…* voor alle diagramsoorten tegelijk,
  `importQeaProject.js`), getest op de pakketten
  *Metametamodel* en *UC.NPA.REG.0010* uit het Gemeentelijk Gegevensmodel. Ontwerp en EA-schema: `plans/2026-10-07 Sparx
  EA-sync — vier routes vergeleken (onderzoek).md` §5–§7.
- Codegen (canoniek model → code en API-schema's): eigen pijplijn, zie
  [CODEGEN.md](CODEGEN.md).
- **Toegangsspraak → ODRL (ODRL-AP-NL)**, een export in de vorm van §3 mét
  schrijver (§8). Nog niet in de registry: een beleid leeft in de
  Toegangverlening-activiteit, niet in een Modelleren-map.
- **Canoniek model + e-dienst → objecttype (JSON Schema)**, een artefact voor
  de inrichting van e-diensten op Fundament (§11): samengestelde bron, regelset,
  JSON-schemaschrijver en een runner (`scripts/maak_inrichtingsartefact.mjs`).
  Nog niet in de registry: de bron is een V3-bestand plus een e-dienstmodel,
  niet een Modelleren-map.
- **EA-lezer per profiel**: naast de `.qea`-lezer hierboven heeft een tiental
  profielen een `eaMapping.js` (bpmn, dmn-drd, xsd, wsdl, object, …) — ook
  **data**, maar in een eigen tabelvorm (EA-objecttype + stereotype →
  elementtype), niet als regelset van §3. Zie
  [PROFIELEN-EA-AANVULLING.md](PROFIELEN-EA-AANVULLING.md).

**Wat is configuratie en wat is code.** Bij de transformaties in de vorm van §3
— Mermaid ↔ use case, BPMN-XML, DMN-XML, Toegangsspraak → ODRL: vijf regelsets —
is de *afbeelding* configuratie: wat wordt wat staat als regels in een
regelset, en de toepasser is generiek. Code blijven: de **lezers en schrijvers**
(syntax per extern formaat; zo bedoeld), de **aansluiting** per transformatie
(registratie, plan → model; voor imports grotendeels generiek via
`planNaarCoreModel`), en de **vindplaats**: de regelsets zijn `.js`-bestanden in
de broncode. Configureren kan dus alleen wie de code wijzigt — bewust: eerst
experimenteren met regelsets als JS-data, dan pas vastleggen (§9).

**Wat ontbreekt:** de oudere transformaties (map-JSON, ArchiMate Exchange,
OpenAPI → canoniek, de IDE-importen) zijn nog specifieke code zonder regelset;
het bereik is alleen "een map"; de trace wordt niet bewaard; er is geen viewer of
editor voor regelsets (§9) en geen runner buiten de browser. Proefdraaien met een
verschil-overzicht bestaat voor de EA-import (*plans/2026-10-07 Sparx EA-sync*),
nog niet generiek.

## 3. De vorm: lezer → regelset → toepasser → schrijver

```
externe tekst ──lezer──▶ brongraaf ─┐
                                    ├──regelset + toepasser──▶ plan ──▶ doelmodel ──schrijver──▶ externe tekst
model (bereik) ─────────────────────┘                          │
                                                               └─ trace + meldingen
```

| Deel | Wat het weet | Vorm | Waar |
|---|---|---|---|
| **Lezer** | de *syntax* van een extern formaat | code (een parser) | `transformatie/mermaidFlowchart.js` |
| **Graafbeeld** (de lezer voor de modelkant) | niets van een profiel: element → knoop, connector → verbinding, `containerVoor` → `groep` | generieke code | `transformatie/modelNaarGraaf.js` |
| **Regelset** | de *betekenis*: welk bron-patroon wordt wat in het doel | **data** — geordende `als … maak …`-regels | `diagramprofielen/<profiel>/…Regels.js` |
| **Toepasser** | niets van bron of doel; voert regels uit | generieke code | `transformatie/regels.js` |
| **Schrijver** | de syntax van het doelformaat | code of een tekstsjabloon | `transformatie/turtleSchrijver.js` (RDF/Turtle), `transformatie/mermaidSchrijver.js` (Mermaid flowchart) |

Alles wat een model is — een Mermaid-tekening, een OAS-document, een Studio-model
— is hier een **graaf**: knopen met eigenschappen, groepen (containers) en
verbindingen. Dat is ook precies de vorm van het Studio-model zelf (`Element` met
`elementType` en `data`; een connector is een element met `source`/`target`). De
regelset matcht op die graaf en beschrijft de doelgraaf; syntax blijft erbuiten.

### De regel

```js
{ naam: "Extend", bij: "verbinding",
  als:  { label: { patroon: "^(<<|«)?\\s*extends?\\s*(>>|»)?$" },
          bron: { type: "usecase" }, doel: { type: "usecase" } },
  maak: { type: "extend" } }
```

- `bij` — `knoop`, `groep` of `verbinding`.
- `als` — voorwaarden op eigenschappen van het bron-item; bij een verbinding ook
  op zijn uiteinden (`bron: {…}`, `doel: {…}`), inclusief het doel-`type` dat de
  knoopregels er net aan gaven. Toetsen: een waarde, een lijst (één van),
  `{patroon}`, `{leeg}`, `{niet}`.
- precies één actie:
  - `maak: { type, naam?, data?, omgekeerd? }` — een element of connector;
  - `zet: { op, data, vervalt? }` — een eigenschap op een uiteinde (zo wordt een
    notitie de toelichting van het element waar hij aan hangt);
  - `negeer: true` — bewust niets.
- `meld: true` — de toepassing verschijnt als melding (voor regels die een
  interpretatie zijn).
- Waarden zijn sjablonen: `"{tekst|eenregel}"`, `"{doel.romp}"`. Een sjabloon dat
  uit precies één placeholder zonder filter bestaat (`"{waarde}"`) geeft een
  **getypeerde waarde** — getal, boolean of object — ongemoeid door; strings en
  ontbrekende waarden blijven tekst. Constanten die geen tekst zijn
  (`{ iri: "odrl:purpose" }`) gaan altijd ongemoeid door.

De **eerste** regel die past wint. Past er geen, dan komt er een waarschuwing en
wordt het item niet overgenomen — de toepasser raadt nooit. Het resultaat bevat
naast het plan een **trace** (per bron-item: welke regel, welk doel) en meldingen.

### Gereserveerde namen in de brongraaf

De toepasser legt een *view* over elk bron-item en zet daarin zelf een paar
eigenschappen. Een lezer die dezelfde naam gebruikt wordt overschreven:

| Op | Naam | Betekenis |
|---|---|---|
| knoop, groep | `soort` | `knoop` of `groep` — gebruik voor het eigen brontype dus een andere naam (`aard`, `vorm`, `klasse`) |
| knoop, groep | `type` | begint leeg en wordt het doel-type; daarop toetsen verbindingsregels |
| knoop, groep | `klasse`, `romp`, `inGroep` | ← `klassen`, ← `romp ?? tekst`, ← `groep != null` |
| verbinding | `soort` | `verbinding` |
| verbinding | `bron`, `doel` | worden vervangen door de view van het uiteinde; het id is dus `{bron.id}`. In `als` zijn `bron` en `doel` altijd deelvoorwaarden op een uiteinde |

Verder leest de toepasser `id` (uniek over knopen én groepen), `groep`, `regel`
(bronregelnummer, voor meldingen), `tekst` (standaard voor de naam) en `vorm`
(alleen in de tekst van de geen-regel-melding). Eén knoop geeft hoogstens één
element; een connector vereist dat beide uiteinden een element zijn. De
connectoren in het plan staan in de **volgorde van de verbindingen** in de graaf
(getest) — een schrijver mag daarop bouwen. Meerwaardige eigenschappen horen in
connectoren, niet in `zet` (dat plakt twee teksten aan elkaar). Meldingen van
de toepasser beginnen met `TRF-`; een lezer of aansluiting neemt een eigen
voorvoegsel (`MMD-`, `TS-`, `TTL-`).

### De schrijver (RDF)

`transformatie/turtleSchrijver.js` zet een plan om naar RDF, in twee stappen:
`planNaarTriples` (context-gedreven) en `triplesNaarTurtle`. Voor RDF is de keuze
van de regelset letterlijk: het doel-`type` van een element is een klasse, dat van
een connector een predicaat, en de sleutels van `data` zijn predicaten.

De **vorm van een waarde** staat niet in de regelset maar in een contexttabel,
hetzelfde idee als een JSON-LD-`@context`: prefixes, het naam-predicaat per type,
en per predicaat `tekst` (met taal), `iri`, `datum` of `lijst` (de connectoren van
één bron worden één RDF-lijst, in planvolgorde). Waar één predicaat per keer een
ander soort waarde draagt, levert de lezer een getypeerde waarde: een getal, een
boolean, of `{ iri }`, `{ tekst, taal }`, `{ letterlijk }`, `{ datum }`,
`{ zelf: true }`. Er is bewust géén ingebedde notatie in strings: dan is er ook
niets te ontsnappen. De uitvoer is deterministisch, zodat een vaste verwachte
tekst per voorbeeld als test kan dienen.

### Verwantschap met wat je kent

| | Lijkt op | Verschil |
|---|---|---|
| `als` | `match="…"` in XSLT, met XPath-predicaten | werkt op een graaf (knopen én verwijzingen), niet op een XML-boom |
| volgorde = prioriteit | template-prioriteit in XSLT | expliciet: bovenaan wint |
| `maak` | de template-body; een *matched rule* (`from … to …`) in ATL/QVT | het doel is een modelelement, geen tekst |
| trace | de impliciete trace-links van ATL/QVT | wordt teruggegeven; nog niet opgeslagen als kruisverband |
| schrijver | de sjablonen van Sparx EA (per metaklasse een tekstsjabloon) | alleen voor de laatste stap, model → tekst |

### Waarom niet een bestaande taal

| Kandidaat | Sterk in | Waarom hier niet (nu) |
|---|---|---|
| **XSLT / XPath** | boom → boom/tekst, uitgekristalliseerd | XML als drager; een model is een graaf met kruisverwijzingen, daar wordt XSLT omslachtig |
| **Sparx EA-sjablonen** | model → tekst (code, DDL) | geen model → model; gebonden aan EA's metamodel |
| **ATL / QVT-Operational / Epsilon** | precies dit probleem (regels, trace, model → model) | Eclipse/Java-ecosysteem; in een browser-werkbank niet inzetbaar. De *begrippen* zijn hier overgenomen |
| **QVT-Relations / triple graph grammars** | tweerichting en synchronisatie | zwaar; pas zinvol als roundtrip een eis wordt |
| **JSONata** | JSON-boom → JSON-boom, veldmapping | geen graafpatronen, geen trace; wél geschikt als *expressie* binnen een regel |
| **Eigen JavaScript per transformatie** | alles kan | niet leesbaar, niet configureerbaar, geen gedeelde trace/meldingen — de situatie tot nu toe |

Lijn: **het regelmodel is van ons en klein; expressies lenen we.** Voor toetsen
en sjablonen volstaat nu gelijkheid/lijst/patroon. Wordt dat te krap, dan komt
daar CEL (al gekozen voor validatieregels, zie *Invoersoort en vorm* §
Expressietalen) of JSONata voor waardeberekening — geen vrij JavaScript in een
regelset. Complexe afbeeldingen (OAS → canoniek, met zijn heuristiek over wat een
entiteit is) blijven voorlopig geteste code achter hetzelfde registry-contract.

## 4. Bereik

Een transformatie werkt op een **bereik**: de verzameling elementen die de bron
vormt. Nu bestaat alleen `map` (`collectMapModel`). De andere drie zijn dezelfde
soort ding — een functie die een bereik oplost tot element-id's per profiel — en
horen in het contract, niet in elke transformatie:

| Bereik | Lost op tot |
|---|---|
| `map` | de geplaatste diagrammen en elementen van een map (bestaat) |
| `selectie` | de geselecteerde elementen op het actieve diagram |
| `diagram` | alle elementen met een voorkomen op één diagram |
| `profiel` | alle elementen van één profieltype |

Connectoren tussen twee elementen in het bereik gaan mee (zoals `collectMapModel`
al doet). Dit is nog **niet gebouwd**.

## 5. Een transformatie toevoegen

1. **Lezer** (alleen bij een nieuw extern formaat): tekst → `{knopen, groepen,
   verbindingen, waarschuwingen}`. Geen kennis van het doelprofiel.
2. **Regelset**: de regels als data; `valideerRegelset` in een test. De regelset
   staat bij de kant die een Studio-taal is — bij een import dus bij het
   doelprofiel (`diagramprofielen/<doelprofiel>/`), bij een export bij de brontaal
   (`toegangsspraak/`). Zijn beide kanten een Studio-taal, dan bij het doel.
3. **Aansluiting**: een module die `pasRegelsToe` aanroept, het plan omzet naar
   een core-model (ids, hergebruik, verbindingsregels van het profiel, layout) en
   zich registreert met `registreerTransformatie`. Stores worden geïnjecteerd
   (patroon `archimateImport.js`), de wiring staat in `studio/activities/`.
4. **Tests** met de node-testrunner; houd alles in pure `.js`.

## 6. Mermaid flowchart → use case-model

*Transformeren → Importeren →* **"Mermaid flowchart → use case-model"**; kies een
bestand (`.mmd`, `.mermaid`, `.md`, `.txt`) of plak de tekst. Mermaid kent geen
use case-diagram; de regelset (`diagramprofielen/usecase/mermaidRegels.js`) volgt
de gangbare flowchart-conventie:

| In Mermaid | Wordt |
|---|---|
| cirkel `(( ))`, of klasse `actor` | actor |
| stadion `([ ])` / afgerond `( )`, of klasse `usecase` | use case |
| `subgraph` (ook genest) | systeemkader, met `bevat` naar zijn leden |
| rechthoek `[ ]` of klasse `note`, met een lijn naar een element | de **toelichting** van dat element (zonder de vetgedrukte kopregel); de notitie zelf vervalt |
| losse rechthoek | notitie op het diagram |
| label `<<include>>` / `<<extend>>` tussen use cases | include / extend |
| label `specialisatie`, `generalisatie`, `is een` | generalisatie (pijl van specifiek naar algemeen) |
| doorgetrokken lijn actor ↔ use case | associatie |
| benoemde stippelpijl tussen twee actoren of twee use cases (bv. `gespreksvorm`) | generalisatie met het label als naam — een *interpretatie*, dus gemeld |

- **Meerdere flowcharts** in één tekst geven meerdere diagrammen op één model.
  Een regel als `actor model:` of `# Titel` vlak vóór `flowchart LR` wordt de
  diagramnaam.
- **Hergebruik** (optie, standaard aan): een element met hetzelfde type en
  dezelfde naam is hetzelfde element — binnen één import en ten opzichte van wat
  er al staat. Bestaande elementen worden nooit overschreven; alleen een nog lege
  toelichting wordt aangevuld. Zo komen de actoren uit een actor-model en een use
  case-model op elkaar uit.
- De **verbindingsregels van het profiel** blijven gelden: wat het profiel niet
  toestaat wordt gemeld en overgeslagen.
- Opmaak (`classDef`, `style`) wordt niet overgenomen; de positie komt uit een
  eenvoudige kolommen-layout (`transformatie/kolommenLayout.js`): actoren links,
  systeemkaders rechts, wat verbonden is naast elkaar.

Voor deze import kreeg het use case-profiel een eigenschap **Toelichting** op
actor, use case en systeemkader, en mag een systeemkader een systeemkader bevatten.

### De terugweg: use case-model → Mermaid flowchart

*Transformeren → Exporteren →* **"Use case-model → Mermaid flowchart"** schrijft
de use case-diagrammen van een map als `.mmd`, één flowchart per diagram met de
diagramnaam als titelregel (elementen op geen enkel diagram komen in een laatste
flowchart "overige elementen"). Route:

```
model ──modelNaarGraaf──▶ graaf ──mermaidExportRegels──▶ plan ──mermaidSchrijver──▶ tekst
```

De regelset (`diagramprofielen/usecase/mermaidExportRegels.js`) is het
spiegelbeeld van de importregels: actor → cirkel, use case → stadion,
systeemkader → subgraph, toelichting → notitie aan een stippellijn, include/
extend → `<<include>>`/`<<extend>>`, generalisatie → `specialisatie` (of de eigen
naam als die er is), associatie → doorgetrokken pijl; `bevat` zit in de nesting.
De schrijver kent alleen Mermaid: vormen, ontsnapping (`#quot;`, `#60;`, …),
subgraphs, `class`-regels.

**Roundtrip** (`mermaidExport.test.js`): import → export → import geeft hetzelfde
model (elementen, relaties, toelichtingen, diagrammen), de lezer leest de
geschreven tekst zonder waarschuwingen, en een tweede rondgang schrijft letterlijk
dezelfde tekst. Wat níet terugkomt is wat het model niet kent: opmaak
(`classDef`-kleuren uit de bron) en de precieze volgorde en bewoording van de
oorspronkelijke tekst — de export schrijft in zijn eigen vaste volgorde, met
element-id's als Mermaid-id's.

## 7. Vervolg (voorstel, in volgorde van opbrengst)

1. **Tweede regelset op dezelfde toepasser** — gedaan met de ODRL-export (§8),
   al is dat een `export` en geen `transform`. Een model → model-afbeelding
   blijft de ontbrekende toets. Kandidaat: use case → activity/BPMN-proceslijst,
   of de Mermaid-klassediagram-import overzetten van RawUML-code naar een regelset.
2. **Bereik** in het contract (§4): selectie, diagram en profiel naast map.
   Hoort samen met punt 7: een map met meerdere profielen is een samengestelde
   bron.
3. **Trace bewaren**: bij `transform` als kruisverband; bij import als herkomst
   op het element, zodat een tweede import kan bijwerken in plaats van toevoegen.
4. **Proefdraaien**: het plan en de meldingen tonen vóór het toepassen.
5. **Regelsets als bestand** in het project (JSON), bewerkbaar in de Studio; de
   validatie (`valideerRegelset`) is daar al op voorbereid.
6. **Schrijver** voor export met tekstsjablonen (vrije tekst: code, DDL), en
   dezelfde runner in een CLI. De RDF-schrijver (§3, §8) en de Mermaid-schrijver
   (§6) bestaan; een JSON-LD-serialisatie hoeft alleen `triplesNaarTurtle` te
   vervangen.
7. **Bronnen samenvoegen en regelsets stapelen.** Een transformatie heeft vaak
   méér dan één bron, en dan is één regelset niet genoeg. Het speelt nu op drie
   plekken, telkens anders opgelost:

   | Plek | Wat samenkomt | Hoe nu |
   |---|---|---|
   | ODRL-export (§8) | het beleid + wat het uitvoert, aan de **invoerkant** | `aanvulling` (extra knopen/verbindingen op de graaf) en `extraRegels` vóór de regelset, als opties van de aansluiting |
   | Mermaid-import (§6) | het geïmporteerde model + wat er al in de store staat, aan de **uitvoerkant** | hergebruik op type + naam in de aansluiting |
   | bereik `map` (§4, te bouwen) | de modellen van **meerdere profielen** in één map, met kruisverbanden ertussen | `collectMapModel` levert ze per profiel, als los setje |

   De keuzes die nu impliciet zijn en in het contract van de toepasser horen:

   - **Identiteit over bronnen heen.** Uiteinden worden op `id` opgelost, uniek
     over alle knopen. Dus: een naamruimte per bron (`beleid:regel-1`,
     `uitvoering:module-1`) met expliciete koppelingen ertussen, of gedeelde
     id's op afspraak. Een botsend id is een fout, geen stille overschrijving
     (nu wint de laatste, ongemerkt).
   - **Herkomst.** Elke knoop en verbinding draagt zijn bron mee, en het trace
     ook; anders is geen verliesrapport per bron mogelijk.
   - **Koppelingen tussen bronnen** zijn gewone verbindingen met een eigen
     `aard`, zodat een regel erop kan matchen. Hier komen de kruisverbanden uit
     de koppelingen-matrix de graaf in.
   - **Stapelen = overschrijven kunnen.** Omdat volgorde prioriteit is, kan een
     laag erbóven de basisregels overschaduwen (vergelijk `xsl:import` en de
     CSS-cascade). Dat is nuttig voor een projectspecifieke laag op een
     standaardregelset, maar moet zichtbaar zijn: melden, of een regel expliciet
     als `overschrijft` markeren.
   - **Identiteit van de stapel.** Elke laag is een volwaardige regelset met id
     en versie; de samengestelde set krijgt een afgeleide id, zodat de kopregel
     van de uitvoer ("gemaakt met regelset … v…") blijft kloppen. Nu zegt die
     kopregel bij extra regels iets wat niet waar is.

   Beoogde vorm: `voegSamen([{bron, graaf}, …], {koppelingen})` en
   `stapel([basis, aanvulling])` in `transformatie/`, in plaats van opties per
   aansluiting. **Nog niet bouwen**: de ODRL-export is het eerste geval en
   werkt; het bereik `map` met meerdere profielen wordt het tweede en bepaalt
   pas de vorm (vooral hoe kruisverbanden binnenkomen). Bouw het dan samen met
   punt 2.

8. **Documentsjablonen**: een document (use case-overzicht, gegevenswoordenboek) als
   *schrijver* op het graafbeeld van een bereik, met de publicatie-placeholdertaal plus lussen
   (`{{#elk …}}`) en `{{svg}}` voor diagrammen; ingebouwde sjablonen per profiel, eigen sjablonen
   in het project. Ontwerp: `docs/plans/2026-10-09 Documentsjablonen — documenten genereren uit
   een map (ontwerpvoorstel).md`.

## 8. Toegangsspraak → ODRL (ODRL-AP-NL)

De eerste **export** in deze vorm, en de eerste met een schrijver. Aanleiding: de
ODRL-viewer van de werkgroep FTV, die elk ODRL-beleid als leesbaar document toont
mits het de *ODRL Visualisation Note* volgt (labels bij elke IRI, regels en
voorwaarden met een eigen IRI, `partOf`-hiërarchie, geldigheid, realisatielinks).

| Deel | Waar | Wat |
|---|---|---|
| graafbeeld (de rol van de lezer) | `toegangsspraak/graaf.js` | het beleid uit elkaar gelegd in de begrippen van de taal: regel, handeling, partij, voorwaarde, registerdeel, term … met `aard` en de zinsnede als `tekst` |
| regelset | `toegangsspraak/odrlApNlRegels.js` | wat elk onderdeel in ODRL wordt; ODRL wint waar het een woord al kent (bekijken = `odrl:read`, doel = `odrl:purpose`, rol = `apnl:rolAanvrager`) |
| toepasser | `transformatie/regels.js` | ongewijzigd, op de getypeerde waarde in `vul` na |
| schrijver | `transformatie/turtleSchrijver.js` | plan → Turtle |
| aansluiting | `toegangsspraak/odrlExport.js` | de context van de schrijver; geeft Turtle, trace en meldingen terug |

Het graafbeeld leest geen syntax (dat doet de parser); het is de pijl "model
(bereik)" in het schema van §3. Eén keuze zit daar en niet in de regelset: een
voorwaarde over het verzoek (aanvraag, aanvrager) hangt aan de **handeling**, een
voorwaarde over de gegevens of een bestaansvraag aan de **regel**. De regelset
maakt daar `odrl:refinement` respectievelijk `odrl:constraint` van, zoals
ODRL-AP-NL voorschrijft.

Een **aanvulling** uit een tweede bron kan knopen en eigen regels toevoegen. Het
GBO-voorbeeld gebruikt dat voor de realisatie: de uit dezelfde ODRL gegenereerde
Rego-modules als `apnl:RegoModule`, met een anker dat de regel en de werkelijk
getoetste voorwaarden realiseert (`prov:wasDerivedFrom`).

De **trace** is het verliesrapport: wat `geen-regel` of `overgeslagen` is, zit niet
in de ODRL. De tests eisen dat op alle voorbeelden niets verloren gaat, en leggen
de Turtle van het voorbeeldbeleid vast als gouden bestand.

Voorbeelden, de runner en hoe je ze in de viewer bekijkt:
`authz/odrl-viewer-voorbeelden/`. De bestaande JSON-LD-export uit de editor
(`toegangsspraak/odrl.js`) blijft ernaast bestaan; het verschil staat in
[TOEGANGSSPRAAK.md](TOEGANGSSPRAAK.md).

## 9. Viewer, editor en de Transformatie-entiteit (ontwerp, 2026-10-06)

Regelsets zijn nu `.js`-bestanden in de broncode. Dit is het ontwerp om ze te
bekijken, te testen en te bewerken, en om ze later vast te leggen. Het zijn
**twee verschillende dingen** die elkaar op één punt raken.

### 9.0 Een transformatie is M2, geen M1 (aanscherping 2026-10-20)

Een regelset is een afbeelding tussen twee **talen** — profiel ↔ profiel, of
profiel ↔ extern formaat. Ze zegt niets over een concreet model, maar hoe *elk*
model in taal A in taal B uitkomt. Dat is **M2**, op dezelfde hoogte als de
profielen; een M1-model is alleen haar invoer (de proefbron, de map waarop je
haar toepast). Daaruit volgt:

- **Regelsets volgen de profielen.** Ze noemen elementtypen en connectoren van
  een profiel en kloppen alleen bij een versie daarvan. Waar de profielen
  komen te leven — in de code, in de projectsync, als bitemporele entiteit in het
  toolregister — daar leven ook de regelsets; die beslissing wordt één keer
  genomen, voor beide.
- **Overdraagbaar.** Een profiel met zijn regelsets wil je kunnen meegeven aan
  een andere instantie of een collega, los van de tool — zoals een
  XSLT-stylesheet of een EA-MDG-technologie rondgaat. Daarom is de **JSON-vorm**
  de eigenlijke drager: een bestand dat je deelt, in git versioneert en inleest.
  Opslag in het register is één plek waar zo'n bestand bitemporeel bewaard
  wordt, niet de enige vorm.
- **Volgorde: eerst experimenteren, dan vastleggen.** Nu als JS-data in de code
  (vijf regelsets); vastleggen pas als de vorm zich bewezen heeft, en dan samen
  met de profielen.

### 9.1 Mogelijkheid: de regelset als entiteit `Transformatie`

Een **mogelijkheid**, geen besluit (zie 9.0): als profielen bitemporele
entiteiten in het toolregister worden, dan regelsets ook, op dezelfde manier
als de andere definities in het configuratiedomein (FormulierDefinitie,
QueryDefinitie, NotificatieDefinitie): één entiteit, de inhoud in GE's. Daarmee
komt gratis mee: bitemporele historie (welke regel gold op het moment van die
export, wie veranderde wat), correctie via registraties, replay naar een andere
instantie, API en GraphQL, en het entiteitsformulier als bewerker.

```
ENT Transformatie                      domein configuratie, isMaterieel
  GE Meta       enkelvoudig            naam, code (= regelset-id), versie, bron, doel,
                                       beschrijving, status
  GE Regels     enkelvoudig            regels_json — de regels als JSON, in volgorde
```

- **De regels blijven JSON in één veld**, zoals `layout_json` van de
  FormulierDefinitie. Er zijn (nog) geen sub-GE's; en de JSON-vorm is toch al de
  uitwisselvorm. Een formulier-widget maakt het veld toonbaar; `valideerRegelset`
  is de controle bij registratie, dezelfde als in de Studio.
- **Een regel is geen eigen entiteit.** Een regel betekent niets zonder zijn
  plaats in de volgorde (volgorde = prioriteit), en een gedeelde regel die in
  twee regelsets verandert is het overschaduw-probleem van §7.7 in het verborgene.
  Dezelfde regel in twee regelsets is een kopie, zoals een template bij zijn
  stylesheet hoort en een rule bij zijn ATL-module.
- **Hergebruik is een relatie tussen regelsets**: `Transformatie bouwt voort op
  Transformatie` — het stapelen van §7.7, met de laag als eigen entiteit met eigen
  `code`, en het samengestelde id in de kop van de uitvoer.
- **`bron` en `doel`**: zolang profielen niet in het register leven,
  tekstsleutels (`usecase`, `mermaid-flowchart`) met een versie; leven ze er wel,
  dan een verwijzing naar de profielversie.

**Eén vorm, meerdere vindplaatsen.** Dezelfde JSON kan ingebouwd in de code
staan (de standaardregelsets), als bestand bij een profiel of in de projectboom,
en eventueel in het register. De Studio laadt ze in een vaste volgorde van
voorkeur; wie wat overschrijft wordt getoond, niet verzwegen. Deze laadroute is
het eerste bouwwerk; waar de regelsets uiteindelijk wonen volgt uit 9.0.

### 9.2 De formulier-editor

De kale ingang: het entiteitsformulier van `Transformatie`, met een widget op
`regels_json` die de regels als tabel toont (volgorde, naam, `bij`, `als`, actie)
en bewerkt. Geen zicht op het effect — dat is niet erg, want elke wijziging
wordt gevalideerd en is te proberen in 9.3.

### 9.3 De live view (werkbank, geen formulier)

Een Studio-activiteit "Transformaties". In M-termen:

| Wat erin gaat | Niveau | Vorm |
|---|---|---|
| de regelset | een afbeelding tussen twee M2's (profiel ↔ profiel) of tussen een M2 en een extern formaat | uit het register, de projectboom of ingebouwd (9.1) |
| de proefbron | M1 | een bestand, geplakte tekst, of een bereik uit het interne model: map, diagram, selectie (§4) |
| de twee talen | M2 | het profiel (elementtypen, verbindingsregels, containers) en de lezer/schrijver van het formaat |

Wat eruit komt:

- **het plan en de trace, per regel**: welke bron-items elke regel pakte, welke
  items nergens landden (`geen-regel`, `overgeslagen`) en welke in een ander
  opgingen — regels die niets raken zijn net zo zichtbaar als items zonder regel;
- **de meldingen**, gebundeld zoals in het transformatiepaneel;
- **een voorvertoning van het resultaat**: een diagram als het doel een profiel
  is (het core-model op een tijdelijk canvas, niets in de store), tekst als het
  doel een formaat is (de Turtle, de Mermaid).

Testen gebeurt dus altijd tegen een echt model, nooit tegen de regels alleen;
daarom kan dit geen formulier zijn. Het is tegelijk de ontwikkelomgeving voor
nieuwe regelsets (de ODRL-export heeft nu alleen een CLI) en het "proefdraaien"
van §7.4: dezelfde functie, vóór het toepassen.

### 9.4 Waar de twee elkaar raken

De live view opent een regelset en toont per regel het effect. Bewerken in de
live view is **dezelfde JSON met dezelfde validator**; "bewaren" is een
registratie op de Transformatie-entiteit (of schrijven naar de projectboom als
er geen register is). Zo blijft er één waarheid en één bewerkpad: het formulier
is de kale ingang, de live view de ingang met zicht op het effect.

### 9.5 Volgorde

1. **Live view als lezer** over de ingebouwde regelsets, met de proefbron als
   geplakte tekst of gekozen map. Dwingt de laadroute (9.1) en het bereik (§4)
   uit.
2. **Regelsets als overdraagbaar JSON-bestand** naast de ingebouwde: inlezen,
   valideren, exporteren.
3. **Bewerken in de live view**, met bewaren naar dat bestand — of als
   registratie, als de beslissing over de plek van profielen en regelsets (9.0)
   op het toolregister uitkomt (dan ook de entiteit `Transformatie` met de
   formulier-widget, 9.1–9.2).
4. **Stapelen** als relatie tussen regelsets (§7.7), zodra het bereik `map` met
   meerdere profielen er is.

## 10. BPMN 2.0 XML en DMN XML → eigen model (2026-10-10)

Opdracht Mark (via EA-SYNC): de native uitwisselformaten van BPMN en DMN naar
onze profielen `bpmn-motor` en `dmn-drd`, in de vorm van §3; de EA-smaak
(uit een `.qea`) loopt via de generieke EA-lezer op `eaMapping.js` van die
profielen.

| Deel | Bestand |
|---|---|
| XML-hulpjes (namespace-onverschillig, DOMParser geïnjecteerd) | `transformatie/xmlBoom.js` |
| Lezer BPMN: process/collaboration/participant/laneSet/lane, flow nodes met event-definities, boundary (`randVan`, `cancelActivity`), `default`-flow, data-associaties, text annotations; **BPMNDI** (Bounds, waypoints) als `diagrammen` | `transformatie/bpmnXml.js` |
| Lezer DMN: decision (question/description), inputData, BKM, knowledgeSource, textAnnotation; requirements in DRD-richting (vereiste → vereiser); **DMNDI** | `transformatie/dmnXml.js` |
| Regelsets (data) | `diagramprofielen/bpmn/bpmnXmlRegels.js`, `diagramprofielen/dmn-drd/dmnXmlRegels.js` |
| **Generieke aansluiting** plan → core-model: ids, lidmaatschap (`containerVoor`), verbindingsregels van het profiel, rand-elementen (positie relatief aan de gastheer, geen containerlid), posities/maten uit de diagramlaag, waypoints → `data.knikken`, uitgeklapt subproces → eigen diagram + `gedragDiagramId`; zonder diagramlaag een automatische opstelling (`kolommenLayout`) | `transformatie/planNaarCoreModel.js` |
| Aansluiting + registratie (stores geïnjecteerd) | `diagramprofielen/bpmn/bpmnXmlImport.js`, `diagramprofielen/dmn-drd/dmnXmlImport.js`; wiring `studio/activities/bpmnDmnTransformaties.js` |
| Tests met fixtures (`bestelling.bpmn`, `kredietbeoordeling.dmn`) | `bpmnXmlImport.test.js`, `dmnXmlImport.test.js` |

Regelset-bijzonderheden: de event-*soort* (bericht/timer/fout/signaal) is een
vaste vertaling van `eventDefinitie` — één regel per (event, definitie)-paar,
gegenereerd uit twee tabelletjes maar nog steeds data. Event-based en complex
gateways hebben geen eigen type en worden exclusief/inclusief, gemeld. Een
annotatie-associatie wordt altijd een notitie-lijn mét de notitie als bron
(`omgekeerd` waar nodig); beide profielen kregen daarvoor een `notitielijn`.

Knikpunten landen op `element.data.knikken` (de plek op main). De branch van
EA-SYNC verhuist lijndata naar `diagram.lijnen[connectorId]` en migreert
`data.knikken`; de aansluiting hoeft dan alleen daar te schrijven.

## 11. Inrichting van e-diensten: canoniek model + e-dienst → objecttype (2026-10-25)

Eerste transformatie voor de **inrichting** van e-diensten op Fundament
(opdracht en coördinatie: *plans/2026-10-22 Omnium op Fundament — inrichting van
e-diensten*). Uit één canoniek model worden de artefacten gegenereerd die in
Common Ground-componenten landen; FUNDAMENT registreert ze in het
inrichting-register en rolt ze uit. Deze eerste stap maakt het
**objecttype** (JSON Schema, voor Open Object) van de e-dienst "Aanvraag
(voorbeeld)".

### 11.1 Drie bronnen, één graaf (samengestelde bron, §7.7)

| Bron | Niveau | Wat erin staat | Voorbeeld |
|---|---|---|---|
| canoniek datamodel | M1 | entiteiten, GE's, velden, relaties, datatypen, enums | `aanvraag-domein-v3.json` |
| e-dienst-inrichtingsmodel | M1 (inrichting) | per artefact: bron-entiteit, **positieve selectie** van velden als modelpaden, **projectie** (relatie ingebed of niet, referentielijst als code), metadata, passthrough | `aanvraag-edienst.json` |
| referentielijst-items | M0 | de items, op een **peiltijdstip** | Aanvraagtype: parkeervergunning, evenement |

Wat specifiek is voor één e-dienst staat in het e-dienstmodel, niet in de
regelset (die is M2 en geldt voor elk canoniek model) en niet in het datamodel.
De lezer `transformatie/v3Graaf.js` maakt van de drie één graaf: de
bron-entiteit als wortel, GE's en ingebedde relaties als groepen, velden als
knopen, met als id het **modelpad** dat ook het e-dienstmodel gebruikt
(`Aanvraag.AanvraagAanvrager.Aanvrager.AanvragerNaam.naam`). De V3-feiten worden
in de lezer opgelost: datatype (eerst het model, dan de gedeelde bibliotheek),
enum-waarden, de verwijzing naar een referentielijst volgens de projectie.

**Gedeelde datatypen.** De gedeelde datatypebibliotheek van codegen en het
register (`model/gegevenstypen_datatype_registry.go`) staat als snapshot in
`testdata/gegevenstypen.json`. Een Go-test
(`model/gegevenstypen_snapshot_test.go`) faalt zodra de snapshot achterloopt —
zo lopen de JS-transformatie en de backend niet uit elkaar (zoals
`testdata/cel-pariteit.json` voor CEL). Bijwerken:
`SCHRIJF_GEGEVENSTYPEN=1 go test ./model -run TestGegevenstypenSnapshot`.

### 11.2 Regelset en schrijver

| Deel | Bestand |
|---|---|
| Regelset "canoniek-naar-objecttype" (data) | `diagramprofielen/canoniek-uml/objecttypeRegels.js` |
| Schrijver plan → JSON Schema 2020-12 | `transformatie/jsonSchemaSchrijver.js` |
| JCS (RFC 8785) en de hash | `transformatie/jcs.js` |
| Aansluiting → artefact + `verschillen` | `diagramprofielen/canoniek-uml/objecttypeArtefact.js` |
| Runner | `scripts/maak_inrichtingsartefact.mjs` |
| Tests + fixtures | `objecttypeArtefact.test.js`, `jcs.test.js`, `canoniek-uml/fixtures/aanvraag/` |

De regels in het kort: de bron-entiteit wordt het schema (`title`,
`additionalProperties: false`); een **enkelvoudig GE** is een groepering en
verdwijnt — zijn velden staan in het omvattende object (in de trace:
`opgegaan`); een **meervoudig GE** wordt een array van objecten met de
meervoudsnaam van het GE; een **ingebedde relatie** wordt een object, verplicht
als de `doelKardinaliteit` met 1 begint; een **veld** wordt een property met
type, format, pattern, min/maxLength en enum uit het datatype of de enum, en de
`description` van het veld. Niet geselecteerde velden worden weggelaten (in de
trace: `weggelaten`).

Twee bewuste keuzes:

- **`required` staat gesorteerd.** In JSON Schema is het een verzameling, maar
  JCS telt lijstvolgorde mee; gesorteerd hangt de hash niet af van de volgorde
  van de properties.
- **De beschrijving van een GE gaat niet mee** naar het schema. Die beschrijft
  de groepering en de modelkeuze ("gegevenselement, geen entiteit: …") en is voor
  de modelleur. De beschrijvingen van velden en relaties gaan wel mee.

De schrijver laat lege waarden weg (`""`, `null`, lege lijst), zodat een regel
altijd alle sleutelwoorden mag noemen.

### 11.3 Het artefact

Eén JSON-object in de vorm van het inrichting-register (afspraak FUNDAMENT):
`artefactIdentificatie` (soort, identifier, naam, versienummer),
`artefactInhoud` (formaat, payload = metadata + `jsonSchema`, `payloadHash`),
`artefactHerkomst` (regelset-id en -versie, `bronmodelHash`, schrijver-id,
`peiltijdstip`), `traceregels` (per modelknoop: regel, actie, `doelPad` als
JSON Pointer in de payload), `edienstversie`, `doelcomponent` en
`afhankelijkheden`. FUNDAMENT registreert het bestand en rolt het uit; de runner
schrijft niets in het register.

**Hashregel**: `payloadHash` en `bronmodelHash` zijn sha256 over JCS
(RFC 8785) — voor het model het object onder `model`. Voor niet-JSON (BPMN-XML,
zip) sha256 over de bytes.

### 11.4 De hash-toets

Gelijke hash met het artefact dat al in het register staat = de uitrol geeft
"ongewijzigd"; dat bewijst dat de transformatie hetzelfde maakt als het
handwerk. Stand 25-10 tegen het handgemaakte `objecttypes/aanvraag.json` (na
besluit A van Mark, open punt 8; hash `42409679…`): vijf verschillen, alle aan
de kant van het handgemaakte schema:

| Pad | Gegenereerd | Handwerk | Oorzaak |
|---|---|---|---|
| `aanvrager/description` | "De partij die de aanvraag indient." | "Partij die de aanvraag indient" | beschrijving van de relatie in het model |
| `aanvrager/properties/naam/maxLength` | 255 | — | datatype KorteTekst |
| `bijlagen/items/properties/naam/maxLength` | 255 | — | datatype KorteTekst |
| `bijlagen/items/required` | `["documentUrl","naam"]` | `["naam","documentUrl"]` | gesorteerd |
| `required` | gesorteerd | modelvolgorde | gesorteerd |

Met die vijf aanpassingen in het handgemaakte schema is de hash gelijk (getest).

**Uitkomst (25-10).** FUNDAMENT heeft de vijf aanpassingen in het handwerk
doorgevoerd (onder besluit A van Mark) en het als versie 5 naar Open Object
uitgerold. Daarna is de hash van het handwerk gelijk aan die van het
gegenereerde artefact (`0211a15d…73c4`; ook hier nagerekend met de runner, exit
0). Het artefact is in het register op Fundament geregistreerd als nieuwe
inhoud van artefact 1, met herkomst uit de regelset (de handwerk-inhoud is
formeel afgevoerd), en een uitrol vanuit het register gaf **"ongewijzigd"**
tegen Open Object. Daarmee is de transformatie bewezen op dit artefact.
Openstaand: `bronmodelVersie` en `peiltijdstip` uit de herkomst hebben in het
inrichting-register nog geen veld (open punt 7 in het voorstel van FUNDAMENT).

De runner toont de lijst zelf:

```
node scripts/maak_inrichtingsartefact.mjs --model <v3.json> --edienst <edienst.json> \
  --artefact aanvraag --peiltijdstip 2026-10-25T06:51:13Z --doel <objecttypes/aanvraag.json>
```

### 11.5 Regelset 0.2.0: overerving en partijen met een rol (2026-10-27)

Aanleiding: de eerste echte e-dienst, de gehandicaptenparkeerkaart (GPK), en
aanvraag v2 (besluiten Mark 26/27-10; CG-Fundament
`docs/gehandicaptenparkeerkaart-voorstel.md`). Bron is voortaan het
**samengestelde model** van de instantie (`omnium-model-cg-test-v3.json`),
omdat relaties en referentielijsten over domeinen heen lopen (AanvraagPartij →
relatiebeheer.Partij, Partijrol).

| Wat | Lezer (`v3Graaf.js`) | Regelset |
|---|---|---|
| **`erft`** | de GE's en relaties van elke voorouder onder een groep `ouder`; ids naar de entiteit waar ze gedefinieerd zijn (`Aanvraag.AanvraagIdentificatie.aanvraagnummer`) | ouder → opgegaan: één schema voor ouder + subtype (één objecttype per specialisatie, besluit Mark) |
| **velden op een relatie** | knopen in de relatiegroep (`Aanvraag.AanvraagPartij.partijrol`) | gewone property in het relatie-object |
| **doel van een relatie** | eigen groep `doel` (`Aanvraag.AanvraagPartij.Partij`), vlag `metVelden` | met velden → object `partij` náást de velden, verplicht; zonder velden → opgegaan (vorm van 0.1.0) |
| **veld binnen een doel** | vlag `inDoel` | property, nooit `required` |
| **namen** | `projectie.namen` {modelpad: naam} in het e-dienstmodel | — |

Keuzes, met reden:

- **Een lijst `partijen` van {partijrol, partij}**, niet "de partij met rol
  aanvrager". Kiezen op een M0-waarde (een rolcode) hoort niet in een regelset
  die voor elk model geldt, en een aanvraag door een gemachtigde heeft zowel de
  aanvrager als het subject nodig.
- **De partij als de sleutels van haar "is"-GE's** (bsn, kvkNummer,
  vestigingsnummer, of naam + e-mail zonder registratie) plus `klantUrl` als
  die bekend is; geen Omnium-id. Het formulier kent dat id niet; DigiD of
  eHerkenning levert de sleutel, en Partij is in relatiebeheer juist de proxy
  met één partij per sleutel. De aanvraagservice zoekt of maakt de Partij op
  de sleutel. Welke sleutels: positieve selectie in het e-dienstmodel.
- **`verplicht` binnen een doel telt niet.** V3 kent geen verplicht GE;
  `verplicht` op een veld geldt binnen zijn GE. Voor de eigen GE's van de bron
  blijft dat `required` (zoals in 0.1.0), maar de GE's van een doel kunnen
  elkaar uitsluiten (precies één "is"-GE per Partij, bedrijfsregel). Gevolg
  voor het oude v1-model: `aanvrager` verliest `required: ["naam"]`. "Precies
  één" zelf staat niet in het schema (het model kan het nog niet uitdrukken;
  BACKLOG B35).
- **Twee velden met dezelfde naam** (in de GPK twee keer `toelichting`) geven
  `JSN-DUBBEL`; de e-dienst kiest er één of hernoemt met `projectie.namen`.

Fixtures en tests: `canoniek-uml/fixtures/cg-test/` (kopie van het
samengestelde model, de e-dienstbestanden van aanvraag v2 en de GPK, met een
neutraal contactadres) en `objecttypeCgTest.test.js`. Stand 27-10: aanvraag v2
verschilt van het geregistreerde objecttype precies op `aanvrager` →
`partijen` en `required`; de rest is gelijk.

### 11.6 Formulier: canoniek model + e-dienst → Open Formulieren-export (2026-10-27)

Tweede artefactsoort, voor de GPK-aanvraag (akkoord Mark 27-10). Zelfde bron
(samengesteld model + e-dienstmodel + referentielijst-items) en dezelfde
artefactvorm als het objecttype; de payload is de export van Open Formulieren
als JSON-object {bestandsnaam: inhoud} (`forms.json`, `formDefinitions.json`,
`formSteps.json`, `formLogic.json`, `formVariables.json`, `_meta.json`), het
formaat dat de uitrol-adapter van FUNDAMENT importeert.

| Deel | Bestand |
|---|---|
| Lezer (stappen + veldfeiten via `v3Graaf`) | `transformatie/formulierGraaf.js` |
| Regelset "canoniek-naar-formulier" 0.1.0 | `diagramprofielen/canoniek-uml/formulierRegels.js` |
| Schrijver plan → export | `transformatie/openformsSchrijver.js` |
| Aansluiting → artefact + aansluitingscontrole | `diagramprofielen/canoniek-uml/formulierArtefact.js` |
| Tests + golden file | `formulierArtefact.test.js`, `fixtures/openforms-export-aanvraag/` |

**Wie bepaalt wat.** De e-dienst kiest de stappen, de velden en hun volgorde,
key, label en eventueel `verplicht`, `toonAls` (tonen-als op een andere key),
`toelichting` (hulptekst) en een afwijkende `component`. Het model levert de
feiten; de regelset kiest daaruit de vorm (inhoud ≠ vorm): verwijzing naar een
referentielijst → select met de items als keuzes (waarde = code, label =
omschrijving), enum → radio, JaNee → checkbox, Geheel → number, Emailadres →
email, Datum/DatumTijd → date/datetime, Telefoonnummer → phoneNumber,
LangeTekst → textarea, anders textfield. Lengte en patroon van het datatype
komen in `validate`, zodat het formulier weigert wat het objecttype weigert;
niet bij een vorm die de e-dienst zelf noemt (een bestand is geen tekst).
De **beschrijving** uit het model gaat níét mee als hulptekst: die is voor wie
het schema leest.

**Deterministisch.** De uuid's van formulier, stappen en definities zijn
afgeleid van sha256 over identifier + deel (vorm v5); de url's volgen het
patroon van de export (`http://openforms/api/v2/…`). Dezelfde invoer geeft
dezelfde payloadHash. `_meta.json` bevat alleen `of_release`, geen tijdstip.
De uuid's dienen alleen de hash: Open Formulieren maakt bij elke import een
nieuw formulier met nieuwe uuid's (de adapter van FUNDAMENT hernoemt eerst het
bestaande formulier). Proefimport 27-10 met ingevulde plaatshouders geslaagd,
ook de paden in array-items (`["partijen", 0, "partijrol"]`; Open Formulieren
geeft de index terug als tekst); of de registratie een geldig object maakt,
blijkt bij de eerste inzending.

**Aansluiting key ↔ property.** Met het objecttype-artefact erbij (`--objecttype`)
toetst de aansluiting per component, vaste waarde en inlogwaarde of de
modelknoop ook een property in het objecttype is (via beide traces). Zo niet:
`FRM-AANSLUITING` — het gegeven gaat bij de registratie verloren. Het
aanvraagformulier geeft er één (de toelichting bij de indiening zit niet in
objecttype aanvraag); het GPK-formulier geen.

**Tegen de golden file** (aanvraag-voorbeeld, uuid's gemaskeerd): alleen
`_meta` (tijdstip en commit), de keuzelijst (uit het register in plaats van met
de hand) en `maxLength`/`pattern` uit KorteTekst en Emailadres.

**Inloggen.** `inloggen: ["digid"]` in de e-dienst geeft `auth_backends:
[{backend: "digid", options: {}}]` (Open Formulieren vult `loa` aan) en
`login_required: true` op de **eerste formulierdefinitie**: in Open
Formulieren is "inloggen verplicht" van het formulier afgeleid uit de
definities (proefimport FUNDAMENT 27-10). DigiD zelf is op cg-test nog niet
ingericht.

**Registratie naar Open Object** (keuze A met FUNDAMENT, 27-10). Met het
objecttype erbij schrijft de schrijver een `objects_api`-backend (versie 2):

- per component een `variables_mapping` {variable_key: de key, target_path:
  padsegmenten}, afgeleid uit de trace van het objecttype
  (`/jsonSchema/properties/bijlagen/items/properties/documentUrl` →
  `["bijlagen", 0, "documentUrl"]`; een lijst wordt het eerste item, want het
  formulier levert één voorkomen);
- per vaste waarde (`registratie.vasteWaarden`) een gebruikersvariabele
  `vast_<pad>` in `formVariables.json` met de waarde als `initial_value`, plus
  zijn mapping;
- de BSN uit de inlog (`registratie.uitInlog`) via de statische variabele
  `auth_bsn` in de mapping; `auth_attribute_path` blijft staan, maar schrijft
  in 4.0.3 niets in het object (alleen eigenaarschap bij
  `update_existing_object`);
- waarden die Open Formulieren zelf kent (`registratie.uitOpenFormulieren`
  {modelpad: variabele}) direct in de `variables_mapping`: voor de GPK
  registratievariabele `public_reference` → aanvraagnummer (het
  inzendingskenmerk, bv. `OF-2HD83V`) en statische variabele `now` →
  ingediendOp. Zonder die twee weigerde Open Object de eerste inzending
  (verplicht in het objecttype); besluit Mark 27-10, tot er een
  aanvraagservice is.

Wat per omgeving verschilt is een **plaatshouder**, die de uitrol-adapter
invult: `${OBJECTTYPE_URL:<identifier>}` en `${OBJECTTYPE_VERSION:<identifier>}`
uit het UitrolResultaat van de afhankelijkheid in dezelfde omgeving, en
`${OBJECTS_API_GROUP}` van de omgeving. Zo blijft het artefact omgevingsvrij.
De registratie staat ook in de trace (regels "Registratie: …"). Open Object
neemt de paden in array-items aan (`partijen[0]`, `bijlagen[0]`; getoetst door
FUNDAMENT 27-10).

**Lijsten en volgorde** (derde inzending, FUNDAMENT 27-10). Open Formulieren
schrijft de mapping in volgorde met glom (`Assign`, `missing=dict`): een
indexpad als `["partijen", 0, "partijrol"]` werkt alleen in een lijst die al
bestaat, anders wordt `"0"` een sleutel en weigert Open Object het object
("is not of type 'array'"). Per lijst komt er daarom een gebruikersvariabele
`vast_<lijst>` (data_type `array`) met één item als **aanzet**: de vaste
waarden van dat item plus lege objecten op de tussenliggende paden
(`vast_partijen = [{partijrol: "aanvrager", partij: {}}]`). De mapping begint
met de vaste waarden (aanzetten eerst), dan het BSN, dan de componenten en de
variabelen van Open Formulieren; zo overschrijft de pasfoto de url in het
aanzet-item. Een lijst in een lijst krijgt geen aanzet (`FRM-LIJST`). Eerste
geslaagde object: OF-BKZPCT (FUNDAMENT, hotfix in deze vorm).

**Getallen.** Een geheel getal in het model (`integer`) wordt een getalveld met
`decimalLimit: 0`, zodat het formulier geen 50,5 aanneemt dat het schema
weigert (regelset 0.2.0).

**Bestanden naar de Documenten API.** Zonder catalogus en informatieobjecttype
in de registratie-opties registreert Open Formulieren een bestand niet en zet
het `""` in `bijlagen[0].documentUrl`; Open Object weigert dat (geen uri;
tweede inzending, FUNDAMENT 27-10). De e-dienst noemt het informatieobjecttype
(`registratie.bijlagen.informatieobjecttype`, de omschrijving, hier
`Bijlage`) → `iot_attachment` (snake_case zoals alle opties in het exportformaat; de import negeert `iotAttachment`); de catalogus verschilt per omgeving en is een
plaatshouder: `catalogue: {domain: "${CATALOGUS_DOMEIN}", rsin:
"${CATALOGUS_RSIN}"}`. Open: of de url van het enkelvoudig informatieobject
inderdaad in `documentUrl` landt (volgende inzending). Gezien bij OF-BKZPCT: `documentUrl` is de url van het
enkelvoudig informatieobject in Open Zaak; de `titel` van dat document is de
formuliernaam, dus de naam van de bijlage komt uit de vaste waarde.

**Bij afronden** (`registratie.bijAfronden` {modelpad: statische variabele}).
`now` direct in de mapping is het registratiemoment: bij een herkansing schuift
`ingediendOp` op. Open Formulieren 4.0.3 kent geen variabele voor het
inzendtijdstip (registration_variables: public_reference, pdf_url, …;
statisch: now, today, …). Daarom (besluit Mark 27-10, weg c): een eigen
variabele `afronden_<veld>` (datetime) die een logica-regel vult met
`{"var": "now"}`, en die gaat naar het objecttype. 4.0.3 heeft geen
`trigger_from_step`: Open Formulieren bepaalt de stap uit de variabelen in de
trigger. De schrijver hangt de regel daarom aan het (verplichte) component van
de laatste stap, `{"!!": [{"var": "pasfoto"}]}`; een letterlijke `true` als
trigger geeft een 500. Het moment is de laatste evaluatie bij het afronden,
vlak vóór het indienen; minuutprecisie. Doel later (weg b): de ontvanger van
de inzending zet `ingediendOp` uit `completed_on`.

Valkuil bij de import: een geïmporteerde logica-regel heeft in 4.0.3 geen
stapkoppeling (`form_steps` leeg) en draait dan nooit. De uitrol-adapter van
FUNDAMENT slaat de regels na de import opnieuw op (`PUT …/logic-rules`),
waarna Open Formulieren de stap bepaalt; het artefact blijft zoals het is.

**Stand v1 (27-10).** Vijf echte inzendingen op cg-test; de laatste twee
(OF-7ETATE, OF-TY9VTY) in één keer geregistreerd uit het register, zonder
hotfix: soort passagier en instelling met leeg kenteken, BSN uit de inlog in
`partijen[0]`, pasfoto als enkelvoudig informatieobject in Open Zaak
(verkleind, alleen jpeg/png), `ingediendOp` uit de logica-regel.

**Open punten na de eerste inzendingen.** Een optioneel veld met patroon, formaat of
enum dat verborgen of leeg blijft (kenteken bij soort ≠ bestuurder) gaat als
`""` mee, en Open Object weigerde dat tegen het patroon. Opgelost in de
objecttype-regelset 0.3.0 (besluit Mark 27-10: "optionele velden zijn
optioneel"): een string die niet verplicht is en eisen heeft (format,
pattern, minLength, enum) krijgt `anyOf: [{const: ""}, {…eisen…}]`; de eisen
blijven zichtbaar, `maxLength` blijft buiten de `anyOf` (daar voldoet "" al
aan). Verplichte velden blijven streng. De schrijver
(`jsonSchemaSchrijver.js`, `data.leegToegestaan`) doet de omzetting, de
regelset zet het beleid. Nieuwe objecttypeversie in Open Object voor aanvraag
en gehandicaptenparkeerkaartaanvraag.

**Uploadveld.** Een `file`-component met alleen de basisgegevens laat de SDK
vastlopen ("Oeps! Er ging helaas iets fout"). De schrijver (0.2.0) zet daarom
de volledige standaarddefinitie van de formulierbouwer
(`@open-formulieren/formio-builder`, `registry/file/edit.tsx`): o.a.
`fileMaxSize: "10MB"`, `filePattern: "*"`, `useConfigFiletypes`,
`isSensitiveData`, `of.image.resize`. Geen `storage`/`url`: die vult Open
Formulieren zelf in. Per veld kan de e-dienst `bestand` opgeven: `typen`
(mime-typen; dan een eigen lijst in plaats van die uit de configuratie) en
`verkleinTot {breedte, hoogte}` (verkleinen bij upload). Dat laatste is nodig
voor foto's: de Documenten API van Open Zaak 1.31 weigert een request-body
boven 2,5 MB (`RequestDataTooBig`), en het bestand gaat base64 in de body.

**Nog niet:** formulierlogica anders dan tonen-als, machtigen en eHerkenning.

### 11.7 Zaaktype: aanvraagtype + e-dienst → Catalogi API (2026-10-27)

Op verzoek van FUNDAMENT (Mark akkoord 27-10) het derde artefact van de GPK:
soort `zaaktype`, formaat `catalogi-api-json`, identifier = de
zaaktype-identificatie (`GPK`). De payload heeft de vorm van
`catalogi/<naam>.json` in de Fundament-repo, die de adapter
`scripts/openzaak-catalogus.ps1` via de Catalogi API aanmaakt en publiceert:
`{catalogus, informatieobjecttypen, zaaktype}`. Selectielijst-verwijzingen zijn
namen (procestype `{jaar, nummer}`, resultaat als klasse `11.1.1`); de adapter
zoekt de url's op.

**Weinig model, veel e-dienst.** Het canonieke model kent de inhoud van een
zaaktype niet: statustypen, roltypen, resultaattypen, selectielijst en termijnen
zijn procesinrichting. Die staan letterlijk in de e-dienst. De regelset
`canoniek-naar-zaaktype` 0.1.0 (`zaaktypeRegels.js`) leidt alleen af wat model
en register al weten:

| Doel | Bron | Wanneer |
|---|---|---|
| `zaaktype.identificatie` | aanvraagtype (M0) `zaaktypeIdentificatie` | altijd; een afwijking in de e-dienst of in de identifier is een fout |
| `zaaktype.onderwerp` | aanvraagtype (M0) `omschrijving` | als de e-dienst het niet zet |
| `zaaktype.omschrijving` | naam van de e-dienst | als de e-dienst het niet zet |
| `statustypevolgnummer`, `volgnummer` | volgorde in de e-dienst | als het er niet staat |

Het aanvraagtype komt uit het register (`--referentielijst
Aanvraagtype=<items.json>`), anders uit `referentielijsten.Aanvraagtype.nieuwItem`
van de e-dienst (melding `ZTT-NIEUW-ITEM`).

**Toetsen** (`zaaktypeArtefact.js`): de bijlage die een formulier van de e-dienst
vastlegt (`registratie.bijlagen.informatieobjecttype`) is een
informatieobjecttype van het zaaktype (`ZTT-BIJLAGE`), elk informatieobjecttype
van het zaaktype staat in de catalogus (`ZTT-IOT`), er is een roltype
`initiator` (`ZTT-INITIATOR`), elk resultaattype heeft een selectielijstklasse
en er is een procestype (`ZTT-SELECTIELIJST`), en het aanvraagtype dat een
formulier als vaste waarde zet is dat van het zaaktype (`ZTT-AANVRAAGTYPE`).

**Afhankelijkheid.** Het formulier hangt nu ook af van het zaaktype (bijlagen
met een informatieobjecttype uit zijn catalogus; `${CATALOGUS_DOMEIN}` en
`${CATALOGUS_RSIN}` vult de uitrol uit het zaaktype in). Dat verandert de
afhankelijkheden van het formulier-artefact, niet zijn payload.

**Keuzes voor de GPK** (voorzet, `fixtures/cg-test/gpk-edienst.json`): dezelfde
testcatalogus en informatieobjecttypen als zaaktype AANVRAAG; statustypen
Ontvangen / In behandeling / Afgehandeld; roltypen Aanvrager (initiator) /
Behandelaar; resultaattypen Verleend / Geweigerd / Ingetrokken (11.1.1, 11.2,
11.3); referentieproces "Aanvraag oppakken"; doorlooptijd P56D, servicenorm
P42D (het model kent geen termijnen). Vertrouwelijkheid `vertrouwelijk`
(voorstel: gegevens over de beperking; het objecttype is `confidential`).

### 11.8 Verzoek-envelop voor GZAC (objecttype 0.4.0, 2026-10-27)

Besluit Mark 27-10: de Verzoek-plugin van GZAC pakt het GPK-object op en maakt
de zaak ("we willen in dit gebied nu niet zelf bouwen"). Die plugin
(VerzoekPluginEventListener) verwacht het productaanvraag-formaat. Het canonieke
model verandert niet, alleen de projectie: `projectie.envelop: {soort:
"verzoek", type: "gehandicaptenparkeerkaart"}` in de e-dienst.

**Objecttype.** De vorm van een envelop is doelformaat en staat in de regelset
(`objecttypeRegels.js`, `enveloppen.verzoek`, versie 0.4.0). Het schema van 0.3.0
wordt ongewijzigd de property `data` (inclusief de `anyOf` voor optionele
velden). Erbij komen:

| Veld | Schema | Betekenis voor GZAC |
|---|---|---|
| `type` | string, `const` = het aanvraagtype | kiest de verzoekconfiguratie (hoofdletterongevoelig) |
| `bsn` | string | initiator van de zaak |
| `attachments` | array van string (uri) | documenten, gekoppeld aan de zaak |
| `pdf_url` | string (uri) | het inzendingsrapport |

Verplicht zijn `["type", "data"]`; er is geen `additionalProperties`-beperking
bovenin. De trace schuift mee (`/jsonSchema/properties/data/…`), en elk envelopveld
krijgt een spoor `envelop:<veld>`. Zonder `projectie.envelop` blijft het
schema zoals in 0.3.0 (objecttype aanvraag).

**Formulier.** De aansluiting leest de envelop uit de trace van het objecttype,
dus niet uit de e-dienst. Alle koppelingen beginnen met `data`, maar de
variabelenamen blijven gelijk (`vast_partijen`, `vast_status`). De envelopvelden
komen achteraan in `variables_mapping`:
- `type` wordt de gebruikersvariabele `verzoek_type` (de `const` uit het schema);
- `bsn` komt uit `auth_bsn`, en die blijft daarnaast naar
  `data.partijen[0].partij.bsn` gaan;
- `attachments` komt uit de registratievariabele `attachment_urls`;
- `pdf_url` komt uit de registratievariabele `pdf_url`.

`pdf_url` vult Open Formulieren alleen als het rapport een informatieobjecttype
heeft. Daarom zet de e-dienst `registratie.rapport.informatieobjecttype:
"Aanvraagformulier"`, en dat wordt de exportoptie `iot_submission_report`.
Ontbreekt die, dan valt `pdf_url` weg met melding `FRM-ENVELOP`. Het zaaktype
toetst dat ook dit informatieobjecttype bij het zaaktype hoort (`ZTT-BIJLAGE`).

### 11.9 GZAC-dossierbundel: documentdefinitie, form.io-formulieren, tabbladen (2026-10-30)

Opdracht Mark 30-10 (via FUNDAMENT): de GPK-specifieke bestanden van de
GZAC-dossierbundel komen uit een transformatie, niet uit handwerk ("Ik wil zo min
mogelijk, liefst geen, handwerk. Dit is de proef die we hier doen."). Een
handgemaakt bestand mag even als proef dienen, maar moet daarna vervangen worden
door een gegenereerd bestand.

Er is één artefact per bestand (regelset `canoniek-naar-gzac-dossier` 0.1.0,
`dossierRegels.js`; aansluiting `dossierArtefact.js`; schrijver
`gzac-dossier-schrijver@0.1.0`). De payload is de inhoud van het bestand.
FUNDAMENT leidt het pad in de bundel af uit soort + identifier:

| Soort | Formaat | Bestand in de bundel | GPK |
|---|---|---|---|
| `dossierschema` | `json-schema` | `document/definition/<id>.schema.document-definition.json` | `gehandicaptenparkeerkaart` |
| `dossierformulier` | `formio-json` | `form/<id>.form.json` | `gehandicaptenparkeerkaart.summary`, `aanvraag-beoordelen` |
| `dossiertabbladen` | `gzac-case-tab-json` | `case/tab/<id>.case-tab.json` | `gehandicaptenparkeerkaart` |

Schema en tabbladen dragen allebei de key van het dossier als identifier; de
soort onderscheidt ze. Daarom kan een afhankelijkheid in de e-dienst `soort` en
`afhankelijkVanSoort` noemen, en neemt de runner `--soort`.

**Bron.** De dossierinhoud is het schema van het **objecttype-artefact**, zonder
de verzoek-envelop: de Verzoek-plugin kopieert `data` naar het dossier. De
traceregels van het objecttype geven per veld de modelknoop. Zo leest de
aansluiting het model niet opnieuw en blijft er één projectie. Daarbij komen de
**behandelvelden** uit de e-dienst (bij het dossierschema, bv. `beoordeling`
met een enum en `beoordelingToelichting`). Het canonieke model kent nog geen
beoordeling of besluit; komt dat er, dan horen de behandelvelden daaruit te
komen.

**Documentdefinitie.** Draft-07 (Valtimo), `$id` = `<id>.schema`. De properties
zijn die van het objecttype plus de behandelvelden, met de beschrijvingen en
beperkingen uit het model (enum, patroon, lengte, `required`). Formats die
draft-07 niet kent (`bsn`, `kenteken`, `int32`, …) vallen weg (melding
`DOS-FORMAT`, info); het patroon ernaast blijft de controle. Bovenaan is het
schema open, zonder `additionalProperties: false`: de inhoud groeit in GZAC
(behandelvelden, wat een taakformulier meestuurt). Dieper in het schema blijven
de beperkingen van het model staan.

**Formulieren.** De e-dienst zegt welke velden in welke volgorde in welk paneel
staan (`panelen[].velden`, `kolommen`, `alleenLezen`). Een paneel `{uit:
<formulier>}` neemt de panelen van een ander dossierformulier over; zo herhaalt
het taakformulier de samenvatting. Het componenttype volgt uit het schema
(eerste regel die past):

| Veld | Component |
|---|---|
| behandelveld met enum | `radio` (labels uit `opties`) |
| boolean | `checkbox` |
| integer / number | `number` |
| string zonder lengte, enum, format of patroon | `textarea` |
| de rest (ook enum en tijdstip, alleen-lezen) | `textfield` |

Alleen-lezen panelen (standaard) zetten `disabled` en geen validatie, met
rij voor rij twee kolommen. Invoerpanelen krijgen `validate.required` bij
`verplicht`. `verzenden` geeft een submit-knop; zonder die knop doet GZAC niets
met het taakformulier. Het model kent geen labels: zonder label uit de
e-dienst maakt de regelset er een uit de veldnaam (`ingediendOp` → "Ingediend
op").

**Tabbladen.** Generiek: de vijf standaardtabbladen (samenvatting, documenten,
voortgang, historie, notities) staan in de regelset; een lijst `tabbladen` in de
e-dienst vervangt ze.

**Toetsen.** `DOS-VELD`: een veld in een paneel staat niet in de dossierinhoud.
`DOS-BEHANDELVELD`: een behandelveld bestaat al in het objecttype.
`DOS-OBJECTTYPE`: geen objecttype-artefact, of een ander dan de e-dienst noemt.
`DOS-PANEEL`: `uit` noemt geen dossierformulier.

**Harde test.** In de test zijn de handgemaakte bestanden uit de Fundament-repo
de referentie (`fixtures/cg-test/gzac-handwerk`). De uitkomst:
- samenvatting en taakformulier zijn gelijk op de labels na;
- de tabbladen zijn gelijk;
- de documentdefinitie heeft dezelfde properties en typen, maar is strenger
  (beperkingen en beschrijvingen uit het model).

Niet modelgebonden en dus nog sjabloon of inrichting bij FUNDAMENT:
case-definition, process-document-link, process-link (plugin-acties),
zaak-type-link en document-list-column.

### 11.10 Exportstap in de Studio: alle artefacten van een e-dienst (2026-10-30)

Stap (a) en (b) van het voorstel aan FUNDAMENT (go Mark 30-10): de aansturing
van de CLI (`scripts/maak_inrichtingsartefact.mjs`) als export in het
transformatiepaneel, **Exporteren → Inrichtingsartefacten (e-dienst → register
op Fundament)**. Dezelfde modules, dus dezelfde payloadHash als de CLI.

| Deel | Bestand |
|---|---|
| Bundel: alle artefacten van een e-dienst, objecttype eerst, per artefact een eigen fout | `transformatie/inrichtingsBundel.js` |
| Lezen uit het register + vergelijken (nieuw / gewijzigd / ongewijzigd) | `transformatie/inrichtingsRegister.js` |
| De stap zonder Studio: referentielijsten, bundel, register, zip-inhoud + `OVERZICHT.md` | `transformatie/inrichtingsExport.js` |
| Studio-kant: map → V3, opties, download | `studio/activities/inrichtingsExport.js` |
| Datatypen in de frontend (kopie van `testdata/gegevenstypen.json`, test bewaakt gelijkheid) | `transformatie/gegevenstypen.snapshot.json` |
| Tests | `inrichtingsBundel/Register/Export.test.js`, e2e `37-studio-inrichtingsartefacten` |

**Invoer.**

- **Model:** het canonieke model in de bron-map (`diagram05`, via `exporteerV3`),
  of een gekozen V3-bestand; het bestand wint.
- **E-dienstmodel:** een JSON-bestand (verplicht). Een modeltaal voor de e-dienst
  is stap (c).
- **Referentielijsten:** per lijst in de e-dienst, in deze volgorde:
  1. een gekozen bestand waarvan de naam de lijstnaam bevat
     (`aanvraag-aanvraagtypen.json` → `Aanvraagtype`);
  2. het register (bron `register: /full/…`, laatste stand);
  3. de `eersteVulling` in de e-dienst.

  Per lijst zegt een melding (`INR-REFLIJST`) waar de items vandaan kwamen.
- **BPMN-modellen:** voor bpmn-artefacten (§11.11) het BPMN-model als JSON-bestand;
  de bestandsnaam is `bron.model` van het artefact. Ontbreekt het, dan faalt
  alleen dat artefact.
- **Peiltijdstip:** leeg = nu (RFC 3339, op de seconde).

**Uitvoer.** Een zip `inrichting-<e-dienst>-<versie>.zip` met per artefact
`<identifier>.artefact.json` (bij de dossiersoorten `<identifier>.<soort>.artefact.json`,
zoals de CLI) en een `OVERZICHT.md`. FUNDAMENT registreert de bestanden met
`omnium-registreer-artefact.ps1` (per bestand, of met `-Map` in
afhankelijkheidsvolgorde). Het paneel toont per artefact soort, identifier, hash
en de stand in het register.

**Vergelijken met het register (b, lezen).** Met "vergelijk met het
inrichting-register" leest de stap `full/artefacten`, `full/artefactsoorten`,
`full/ediensten` en `full/edienstversies` (`?size=500`, met `has_more`). Elke
relatie in /full is een lijst voorkomens met versies. De geldende stand is het
laatste voorkomen zonder afvoer of einde, en daarin de hoogste versie. Soort is
een id; de code komt uit de artefactsoorten. De match gaat op e-dienstnaam +
versienummer, soort en identifier:

| Stand | Betekenis |
|---|---|
| `ongewijzigd` | zelfde payloadHash |
| `gewijzigd` | andere payloadHash |
| `nieuw` | nog niet in het register |

Is het register niet te lezen, dan komt de zip er toch, met een waarschuwing
`INR-REGISTER`.

**Toegang.** De leesroutes vereisen een sessie (zonder: 401). De stap stuurt
een token als `Authorization: Bearer`; zonder token stuurt hij de sessiecookie
mee. CORS staat (30-10) open voor `http://localhost:5176`, niet voor de
app-host. Schrijven (registreren) vanuit de browser kan nog niet: daarvoor zijn
een service-account en CORS voor de app-origin nodig, en dat ligt bij BACKEND.
Tot dan registreert FUNDAMENT met de zip, of draait een server-runner (§11.12).

**Model uit de map (beperking opgelost 30-10, BACKLOG §39).** Sinds 30-10
bewaart de omzetting `verplicht`, `uniek`, `type` en `format`. Model uit de map
en V3-bestand geven nu dezelfde payloads. De waarschuwing `INR-MODEL-UIT-MAP`
is weg, en de e2e-test "zelfde payloads als uit het bestand" draait en bewaakt
dit. Wat er tot dan misging: de omzetting V3 ↔ canoniek profiel
(`store/adapters.js`, `convertV3Veld`/`veldNaarV3`) kent de nieuwere
veldsleutels `verplicht`, `uniek` en `type` niet. Ze leidt verplicht af uit
`goType` zonder `*`, en schrijft alleen `goType` terug. Uit de map vallen
daardoor `required` en de codes van referentielijsten weg: twee van de zeven
GPK-artefacten kregen een andere hash.

### 11.11 BPMN: model → uitvoerbare BPMN voor GZAC, en de rondgang (2026-10-30)

Opdracht Mark via FUNDAMENT (30-10): de processen van de dossierbundel komen
uit een BPMN-model in Omnium in plaats van uit handgemaakte XML. Eerste stap is
de rondgang: de handgemaakte artefacten 6 en 7 inlezen met de lezer (§10),
terugschrijven en het verschil bekijken.

**De keten.**
- Schrijver: `transformatie/bpmnXmlSchrijver.js` maakt van één diagram van het
  BPMN-profiel `bpmn:definitions` met één `bpmn:process` en BPMNDI (bounds,
  waypoints uit de knikpunten). Kale BPMN, engine-neutraal.
- Engine-regelset: `diagramprofielen/bpmn/bpmnGzacRegels.js` (`bpmn-naar-gzac`
  0.1.0, Operaton/Camunda 7-dialect) zegt wat de engine extra nodig heeft (tabel
  hieronder).
- Aansluiting: `diagramprofielen/bpmn/bpmnArtefact.js` maakt er een artefact
  van, soort `bpmn`, formaat `bpmn-xml`.

De engine-regelset:

| Element | GZAC (Operaton) |
|---|---|
| process | `isExecutable="true"` |
| userTask | `camunda:candidateGroups="ROLE_USER"` |
| serviceTask | `camunda:expression="${true}"` + `camunda:asyncAfter`; de actie zelf zit in de process-link |
| multi-instance | `camunda:collection` / `camunda:elementVariable` uit het model; asyncAfter per instantie op de lus |
| callActivity | `calledElement` uit het model, `camunda:in businessKey` + `camunda:in variables="all"`, asyncAfter |

Een andere engine is een andere regelset. Plugin-acties en taakformulieren
horen niet in de XML: die binden de process-links van de dossierbundel op de
activityId (FUNDAMENT).

**Het model bewaart wat uitvoerbaarheid vraagt.** Het taakelement van het
BPMN-profiel kreeg vier velden; de lezer vult ze bij het inlezen (importregelset
versie 2):
- `bpmnId`: de activityId;
- `meervoudig`, `lusVerzameling`, `lusElement`: multi-instance;
- `aangeroepenProces`: de call activity.

Events kregen er twee bij (importregelset versie 3): `richting` ("werpt" voor
een intermediateThrowEvent) en `bericht`, de naam van de `bpmn:message` waar
een bericht-event naar verwijst.

De id's zijn stabiel: de schrijver gebruikt `bpmnId`, en anders een slug van de
naam (melding `BPMN-GEEN-ID`). De process-id is de identifier van het artefact.
`activityIds` in de e-dienst noemt waarop de process-links binden; een
ontbrekende id is een fout (`BPMN-ACTIVITYID`).

**Rondgang.** Beide handgemaakte processen zijn semantisch gelijk na inlezen en
terugschrijven: process, id's, namen, typen, flows, bounds, waypoints en
camunda-attributen. Er is één verschil. De `processService.startProcessBy…`-
expressie die het vervolgproces startte, is engine-logica die het model niet
kent. Het BPMN-model (`fixtures/cg-test/gpk-processen.bpmn-model.json`, ingelezen
uit 6 en 7) maakt er daarom een **call activity** van, met `calledElement` =
`gehandicaptenparkeerkaart-beoordelen`. Eerst stond daar de expressie
`${processDefinitionKey}` (de variabele van de Verzoek-plugin). Operaton voert
die uit, maar de export van de dossierbundel in GZAC (Valtimo
ProcessDefinitionExporter) zoekt elk aangeroepen proces op sleutel op en faalde
erop (uitrol 26). Regelset 0.2.0 vraagt daarom een vaste proces-id: een
expressie is een fout, en een proces dat geen bpmn-artefact van de e-dienst is,
geeft een waarschuwing (`BPMN-AANGEROEPEN`). Het oppakproces noemt daarmee het
specifieke proces van dit aanvraagtype. De activityId
`vervolgproces-starten` blijft gelijk.

**Regelset 0.3.0: losse processen, start op een bericht.** Mark besloot dat
oppakken en behandelen losse processen zijn: oppakken is de brug tussen aanvraag
en zaak en eindigt bij de zaak (docs/plans/2026-10-30 Beslissing en beschikking
§6). Een call activity laat het oppakproces wachten tot de behandeling klaar is.
Daarom is `vervolgproces-starten` nu een **werpend bericht-event** ("Beoordeling
gevraagd"), en het beoordelingsproces start op een **message start event** met
dezelfde berichtnaam (`gehandicaptenparkeerkaart-beoordelen-gevraagd`, conventie
`<proces-id>-gevraagd`; de naam moet engine-breed uniek zijn).
- De schrijver zet één `bpmn:message` per naam op definitions-niveau en een
  `messageRef` op de eventdefinitie.
- De regelset (`berichten.werpen`) zet op de definitie van het werpende event
  een expressie die het bericht correleert via de engine-API
  (`createMessageCorrelation(…).processInstanceBusinessKey(…).setVariables(…)
  .correlateStartMessage()`), plus `asyncAfter`. Dezelfde businessKey is het
  dossier, dus Valtimo koppelt het nieuwe proces aan hetzelfde dossier. Er is
  geen `calledElement` meer om te volgen, dus de dossierexport werkt
  (FUNDAMENT, proef op cg-test 30-10).
- Alle procesvariabelen gaan mee; een smallere overdracht kan later per bericht.
- Toets `BPMN-BERICHT` (waarschuwing): een geworpen bericht moet een message
  start event raken in een ander bpmn-artefact van de e-dienst.
  `maakBpmnArtefact` geeft die processen terug als `gestart`.

De call activity blijft ondersteund, voor een specifiek deel dat de aanroeper
wél afwacht (generiek beoordelen → specifiek beoordelen; bezwaar en herziening
roepen hetzelfde deel aan, besluit Mark).

**Hash.** De payload is de XML-tekst; payloadHash = sha256 over de UTF-8-tekst
(niet JCS, afspraak FUNDAMENT). bronmodelHash = sha256 over JCS van het
BPMN-model.

Nog niet in de schrijver: pools/lanes, message flows, data-objecten, notities,
boundary events en de inhoud van subprocessen (melding `BPMN-SCHRIJVER`).

### 11.12 Vervolg

1. Formulier: machtigen (gemachtigde + subject) en eHerkenning; de documenttitel
   van een bestandscomponent uit het label (FUNDAMENT 30-10).
2. Zaaktype: termijnen en resultaten in het model (bv. bij het aanvraagtype)
   zodra meer e-diensten ze delen; nu letterlijk in de e-dienst.
3. BPMN: lanes (rollen → candidateGroups), boundary events, ad-hoc subproces;
   het generieke beoordeelproces met call activity naar het specifieke deel;
   een smallere variabelenoverdracht per bericht (§11.11).
4. Dossier: Beslissing en Beschikking in het canonieke model (docs/plans/
   2026-10-30), zodat de behandelvelden (§11.9) uit het model komen; labels als
   modeleigenschap.
5. Server-side draaien: dezelfde modules in een Node-runner (render-svc-patroon),
   geen Go-port. Kan `transformatie/inrichtingsExport.js` ongewijzigd aanroepen.
6. Studio: registreren vanuit de browser (schrijfkant van §11.10) zodra BACKEND
   een service-account en CORS voor de app-origin heeft; daarna een modeltaal
   voor de e-dienst (stap c) en het formulierdiagram als bron (stap d).
