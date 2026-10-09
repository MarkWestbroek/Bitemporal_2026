# Transformaties — stand, vorm en richting

> Stand per 2026-10-05. Dit document bundelt wat er over transformeren verspreid
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
| transform | Kopieer map-inhoud naar een map | code |
| export | Map → JSON, Map → Markdown-overzicht | code |
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

**Wat ontbreekt:** tot nu toe was elke transformatie specifieke code achter één
`run()`. Er was geen gedeelde, leesbare vorm voor de afbeelding zelf; het bereik
is alleen "een map"; trace wordt niet bewaard; er is geen proefdraaien met een
verschil-overzicht en geen runner buiten de browser.

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
bekijken, te testen en te bewerken — en om ze, *eat your own dogfood*, als
geregistreerde gegevens in het register te brengen. Het zijn **twee
verschillende dingen** die elkaar op één punt raken.

### 9.1 De regelset als gegevens: entiteit `Transformatie`

Zoals de andere definities in het configuratiedomein (FormulierDefinitie,
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
- **`bron` en `doel` zijn tekstsleutels** (`usecase`, `mermaid-flowchart`) met een
  versie, geen relaties: profielen (M2) leven niet in het register.

**Drie vindplaatsen, één vorm.** Dezelfde JSON leeft ingebouwd in de code (de
standaardregelsets), in de projectboom (lokaal, zonder register) en in het
register (gedeeld en gepubliceerd). De Studio laadt ze in die volgorde van
voorkeur: register als het er is, anders project, anders ingebouwd; wie wat
overschrijft wordt getoond, niet verzwegen. Deze laadroute is het eerste
bouwwerk; de entiteit komt daarna.

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
   geplakte tekst of gekozen map. Dwingt de laadroute (9.1, drie vindplaatsen) en
   het bereik (§4) uit.
2. **Entiteit `Transformatie`** in het configuratiedomein, met de formulier-widget
   voor `regels_json`; de Studio leest uit het register.
3. **Bewerken in de live view** met bewaren als registratie.
4. **Stapelen** als relatie tussen regelsets (§7.7), zodra het bereik `map` met
   meerdere profielen er is.
