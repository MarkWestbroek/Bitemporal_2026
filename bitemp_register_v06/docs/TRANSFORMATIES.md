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

**Buiten de registry** (ouder, eigen ingang):

- IDE-import/-export van klassediagrammen: Mermaid, PlantUML en XMI via het
  tussenformaat RawUML (`umleditor/import/`, `umleditor/export/`, zie
  [RAWUML.md](RAWUML.md) en [IDE_IMPORT_EXPORT.md](IDE_IMPORT_EXPORT.md)).
- IDE-bewerkingen binnen het model (entiteit → gegevenselement, entiteit
  splitsen, relatie → associatieklasse): pure functies met een patch-contract in
  `ide/transformations.js`, zie [EDITOR_BEWERKINGEN.md](EDITOR_BEWERKINGEN.md).
- Codegen (canoniek model → code en API-schema's): eigen pijplijn, zie
  [CODEGEN.md](CODEGEN.md).

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
| **Regelset** | de *betekenis*: welk bron-patroon wordt wat in het doel | **data** — geordende `als … maak …`-regels | `diagramprofielen/<profiel>/…Regels.js` |
| **Toepasser** | niets van bron of doel; voert regels uit | generieke code | `transformatie/regels.js` |
| **Schrijver** | de syntax van het doelformaat | code of een tekstsjabloon | (nog niet gebouwd) |

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
- Waarden zijn sjablonen: `"{tekst|eenregel}"`, `"{doel.romp}"`.

De **eerste** regel die past wint. Past er geen, dan komt er een waarschuwing en
wordt het item niet overgenomen — de toepasser raadt nooit. Het resultaat bevat
naast het plan een **trace** (per bron-item: welke regel, welk doel) en meldingen.

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
2. **Regelset** in `diagramprofielen/<doelprofiel>/`: de regels als data;
   `valideerRegelset` in een test.
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

## 7. Vervolg (voorstel, in volgorde van opbrengst)

1. **Tweede regelset op dezelfde toepasser**, bij voorkeur een `transform`
   (model → model), zodat de vorm aan twee echte afbeeldingen getoetst is — de
   aanbeveling uit de review. Kandidaat: use case → activity/BPMN-proceslijst, of
   de Mermaid-klassediagram-import overzetten van RawUML-code naar een regelset.
2. **Bereik** in het contract (§4): selectie, diagram en profiel naast map.
3. **Trace bewaren**: bij `transform` als kruisverband; bij import als herkomst
   op het element, zodat een tweede import kan bijwerken in plaats van toevoegen.
4. **Proefdraaien**: het plan en de meldingen tonen vóór het toepassen.
5. **Regelsets als bestand** in het project (JSON), bewerkbaar in de Studio; de
   validatie (`valideerRegelset`) is daar al op voorbereid.
6. **Schrijver** voor export met tekstsjablonen, en dezelfde runner in een CLI.
