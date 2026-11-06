# Linked data als M2 — SHACL, SKOS, OWL (plan)

*Status: plan, 06-11-2026. Niets gebouwd. Uitkomst van een verkenning met Mark (sessie M2,
04 t/m 06-11), met een haalbaarheidsantwoord van OMNIUM-UI over de projectboom.*

Omnium dekt zestien+ modeltalen, maar nog geen linked data. Dit plan zet uiteen welke
linked-data-standaarden een M2-profiel worden, hoe ze op de motor en het canonieke model
landen, en in welke volgorde. Het vervangt het korte advies in
[2026-07-17 ArchiMate en verdere notaties](2026-07-17%20ArchiMate%20en%20verdere%20notaties%20(plan).md) §4 ("OWL / linked data").

## 1. Wat is wat

Niet alles wat "linked data" heet is een modeltaal. In de termen van CLAUDE.md (M0–M3):

| | Wat het is | In Omnium |
|---|---|---|
| **RDF** | datamodel: triples (onderwerp, predicaat, object) | onderlaag; hooguit een graafweergave (het "Graaf (demo)"-profiel) |
| **Turtle** (ook JSON-LD, RDF/XML, TriG) | bestandsformaat voor RDF | **lezer en schrijver**, geen profiel |
| **SPARQL** | querytaal over RDF | **geen profiel**; hoort bij de leeskant (§9) |
| **SHACL** | beperkingen op RDF-data (shapes) | **M2-profiel** |
| **OWL / RDFS** | ontologietaal: klassen, properties, logica | **M2-profiel** |
| **SKOS** | begrippenkaders: begrippen en hun samenhang | **M2-profiel** |

**RDF mengt de niveaus.** Eén Turtle-bestand kan tegelijk een ontologie (OWL), shapes (SHACL),
begrippen (SKOS) en instanties bevatten. Het officiële
[ODRL22.ttl](https://www.w3.org/ns/odrl/2/ODRL22.ttl) is daar een voorbeeld van: OWL- en
RDFS-klassen, properties én SKOS-collecties in één bestand, zonder SHACL. De lezer sorteert de
triples dus op vocabulaire en stuurt ze naar het juiste profiel; één bestand kan meer dan één
model opleveren.

**Een SHACL-bestand is een M1.** Het is een model in de taal SHACL. Beschrijft het een andere
taal (zoals [odrl22-kern.shacl.ttl](../../model-exchange/linked-data/odrl22-kern.shacl.ttl) de
taal ODRL), dan speelt dat M1 de rol van metamodel; het ODRL-beleid dat het controleert is
daar de data. Vergelijk het EA-Metametamodel: een M1 in UML dat M3 beschrijft.

## 2. Standaardvisualisaties

Geen van deze talen heeft een normatieve W3C-notatie. Wel gewoontes:

| Taal | Gangbaar |
|---|---|
| RDF | ellips, pijl, ellips; letterlijke waarden als rechthoek |
| SHACL | UML-achtig klassendiagram (SHACL Play Draw van Sparna, semanticz-shaclviz); ShapeUML en ShapeVOWL zijn voorstellen (IDLab Gent), geen standaard |
| OWL | VOWL / WebVOWL (de facto); het UML-profiel ODM van de OMG |
| SKOS | vooral een boom (broader/narrower), soms een graaf |

[SHACL Play Draw](https://shacl-play.sparna.fr/play/draw) zet SHACL via PlantUML om naar een
plaatje. Dat is eenrichtingsverkeer en ondersteunt een deel van SHACL; wij willen een bewerkbaar
model met rondreis. De mapping van Sparna is wel een goed vertrekpunt (§4).

De PLDN-werkgroep Linked Data-visualisaties (contact Marco Brattinga) verzamelt Nederlandse
praktijk, maar heeft nog geen aanbeveling gepubliceerd.

## 3. Bouwstenen

- **Turtle-lezer** (nieuw, gedeeld, geen profiel). Er is nog geen RDF-bibliotheek in
  `web/vite/package.json`; voorstel: N3.js (ook TriG en N-Quads). JSON-LD later.
- **Turtle-schrijver** bestaat: `transformatie/turtleSchrijver.js` (`planNaarTriples` +
  `triplesNaarTurtle`), nu gebruikt door de ODRL-export van Toegangsspraak.
- **Vorm**: lezer → regelset → toepasser ([TRANSFORMATIES.md](../TRANSFORMATIES.md)); het plan
  gaat via `planNaarCoreModel` naar het canvas. Wat niet past wordt een `nietGedaan`-melding,
  nooit stil verlies.
- **Identiteit**: in RDF is de IRI tegelijk identiteit en naam; bij ons scheiden we uuid
  (identiteit) en naampad (betekenis). De IRI wordt dus een **eigen, stabiel veld** op het
  element; hernoemen in de Studio verandert de IRI niet. Bij export: de bewaarde IRI, anders
  een IRI uit namespace + naam.
- **Wat de parser weggooit**: commentaar en prefixvolgorde. Rondreis is semantisch, niet
  tekstueel.

## 4. SHACL-profiel

| SHACL | In het profiel |
|---|---|
| `sh:NodeShape` | element (box) |
| property shape met `sh:datatype` / zonder doel | attribuut in de box |
| property shape met `sh:class` of `sh:node` naar een andere shape | relatie (pijl) |
| `sh:class` naar een klasse zonder shape | gegenereerd element + pijl (zoals Sparna) |
| `sh:minCount` / `sh:maxCount` | kardinaliteit; **ontbreken = 0..\*** (niet de UML-standaard 1) |
| `sh:in` | waardelijst |
| `sh:pattern`, `sh:minLength`, … | `{…}` bij het attribuut |
| `sh:or`, `sh:xone`, `sh:not`, `sh:and` | **superprofiel-constraint** (`{or}`, `{xor}`, `{not}`), met annotatielijnen naar de betrokken elementen/relaties |
| `sh:sparql` | superprofiel-constraint met taal SPARQL |
| `sh:path` | eigenschap van de property shape, in SHACL-vorm (§5) |
| `sh:order`, `sh:group` | leesvolgorde, compartimenten |
| `sh:severity`, `sh:message` | eigenschappen van de property shape / constraint |
| `dct:title`, `foaf:depiction` | diagramtitel, diagram per waarde (zoals Sparna) |

**Constraints.** `sh:or` en verwanten zijn gewoon constraints, en daar hebben we sinds studio
0.24.0 het superprofiel voor
([ontwerp](2026-10-20%20Notities,%20constraints%20en%20doorklikken%20—%20het%20superprofiel%20(ontwerp).md)).
De korte vorm (`{xor}`) is genoeg om te tekenen, niet om terug te schrijven: een geneste
`sh:or` met `sh:not` laat zich niet uit tekst en lijnen reconstrueren. De constraint bewaart
daarom het SHACL-fragment als **body met taal** (zoals UML `OpaqueExpression`: taal + body).
*Na te gaan:* of de superprofiel-constraint al een taalveld heeft; zo niet, dan is dat één
eigenschap op de descriptor, geen motorwerk.

**ShapeUML en ShapeVOWL: vormsets, geen profielen.** Beide zijn notaties voor dezelfde taal
(SHACL core): het model eronder is identiek, alleen de tekening verschilt. Twee profielen zijn
pas nodig als de concepten verschillen, zoals bij ArchiMate 3.2 en 4 (twee profielen met een
transformatie, [ontwerp](2026-09-08%20ArchiMate%204%20—%20twee%20profielen%20met%20transformatie%20(ontwerp).md)).
Hier hoeft niets omgezet te worden. Sinds de tekenaar vormen als sjablonen in het M2 heeft
(ShapeType, [plan 04-11](2026-11-04%20Eén%20tekenaar%20—%20vormen%20als%20sjablonen%20in%20het%20M2%20(plan).md)),
worden het twee **vormsets** van het SHACL-profiel, zoals ArchiMate er al twee heeft (vormen en
blokken). Voorstel: ShapeUML als standaard (sluit aan bij de UML-vormen en lijkt op Sparna),
ShapeVOWL later als tweede.

Eén verschil gaat verder dan een andere omtrek: ShapeUML zet een property shape als regel in de
box, ShapeVOWL (in VOWL-stijl) tekent hem als eigen knoop met een lijn. In het model is het
dezelfde property shape; de vraag is alleen of hij als compartimentregel of als knoop getekend
wordt.

**Haalbaarheid (OMNIUM-UI, 06-11, uit de code gelezen, niets gebouwd; grof):** het mechanisme
bestaat al als `ElementType.opname` (`diagramcore/canvas/opname.js`; precedent: GE in de
entiteit bij canoniek-uml). Een voorkomen met gedaante `"ingebed"` tekent geen eigen knoop, de
lijn geheel → deel verdwijnt, andere lijnen van het deel hangen aan het geheel, en het deel
verschijnt als regel in een compartiment. De verborgen knoop bewaart positie en maat; staat het
geheel niet op het diagram, dan valt het deel terug op een eigen knoop. Canvas en tekenaar delen
dit (`verrijkElement`/`bepaalOpnames`), dus ook de server-SVG en documenten.

*Voorwaarde:* het eigendom is een **connectortype** (`sh:property`, node shape → property
shape), geen veld "ouder". Dat past bij VOWL, waar die connector de lijn is.

| Wat ontbreekt | Schatting |
|---|---|
| (a) standaardgedaante per vormset (ShapeUML: property shape → ingebed); `bepaalOpnames` gebruikt `node.gedaante ?? standaard van de set`; wisselen per diagram via `diagram.shapeSetId`, een expliciete gedaante wint | 0,5–1 dag |
| (b) compacte regel `pad : type [kard] {constraints}`: het M2 levert de tekst, de motor een viewer (nu toont "sub-vak" kop en compartimenten) | 0,5 dag |
| (c) klik op de regel selecteert het deel (inspector, F2, Delete); inline hernoemen op de regel bestaat nog niet | 1 dag |
| (d) volgorde uit `sh:order` (sorteersleutel uit het deel) | 0,25 dag |
| tests, incl. pariteit canvas = tekenaar | 0,5 dag |

Samen ongeveer 3 dagen. Risico's: auto-layout ziet ingebedde delen niet, dus een property shape
die nooit los stond heeft geen gekozen positie en ligt bij wisselen naar ShapeVOWL op een hoop
(oplossing: bij maken naast het geheel plaatsen, of bij wisselen de layout over de vrijgekomen
knopen draaien); de set-standaard mag alleen gelden voor elementtypen die de set noemt; de
opstelling van de MCP moet ingebedde delen overslaan, zoals nu `randVan`-elementen.

**Niveau en contract (M3-MOF, 06-11, niets gebouwd):** een weergavekeuze in het Stijl-domein;
het M1 verandert niet. De keuze hoort in het **M2, in de vormset** (per diagram via
`diagram.shapeSetId`, per voorkomen te overschrijven); niet op ElementType (dat is Definitie) en
niet op ShapeType (omtrek van één knoop, niet óf er een knoop is). Het contract:

- `X.opname = {relatieTypes: [Z], compartiment: C}` op het elementtype: wát ingebed mag worden
  (M2-Definitie; bestaat al);
- vormset `Y: {X: {opname: "standaard"}}`: dát het standaard gebeurt (M2-Stijl; nieuwe
  skin-sleutel). Elk deel van type X telt als ingebed zodra zijn geheel op het diagram staat,
  **ook zonder eigen voorkomen**; een voorkomen met `gedaante: "los"` is de uitzondering;
- C is een compartiment met een regel-viewer ("naam-type"/"tekst") die de tekst uit
  `X.hooks.inhoudsregels` haalt (de hook uit het vormcontract van 04-11), zodat ShapeUML geen eigen
  code voor de regel nodig heeft en canvas, tekenaar en server dezelfde regel tonen;
- volgorde: `opname.volgordeVeld` (hier `order`).

Voor het SHACL-profiel: X = property shape, Z = `sh:property`, Y = `shape-uml`; `shape-vowl`
geeft alleen een eigen vorm. Werkverdeling: de skin-sleutel `opname`, `volgordeVeld` en de
typedefs zijn M3 (M3-MOF); `bepaalOpnames` zonder voorkomen, de regel-viewer, klikken op de regel
en de tekenaar zijn motor/canvas (OMNIUM-UI).

*Af te stemmen bij de bouw:* "ingebed zonder eigen voorkomen" (M3-MOF) gaat verder dan
`node.gedaante ?? standaard` (OMNIUM-UI, vraagt een voorkomen). Het neemt het layoutrisico deels
weg (een nooit getekend deel krijgt pas een positie bij wisselen naar ShapeVOWL), maar dan moet
het wisselen wel voorkomens met een positie aanmaken.

## 5. Padexpressies en afgeleide relaties

Een SHACL-pad zegt **waarop** een beperking werkt; het beperkt zelf niets. Een padreeks
`ex:a/ex:b` is wat onze afleidingsregel `a.b` doet (CEL-subset, inclusief verzamelen over
lijsten; [ontwerp afgeleide relaties](2026-10-11%20Afgeleide%20relaties%20backend%20—%20ontwerp.md)).
De twee dekken niet hetzelfde:

| SHACL-pad | Onze CEL-subset |
|---|---|
| reeks `a/b` | `a.b` — past |
| invers `^a` | nog niet; `inverse('Persoon', 'ouders')` staat als latere functie in het ontwerp |
| alternatief `a\|b` | geen directe vorm |
| `a?` | geen directe vorm |
| `a*`, `a+` (transitief) | geen recursie |
| — | `filter(...)`: kan een SHACL-pad niet |

**Een afgeleide relatie is meer dan tekening**: het register berekent haar live en stelt haar
open via de API. Daarom:

1. **In het SHACL-profiel** blijft het pad een eigenschap van de property shape, in SHACL-vorm.
   Alles is uitdrukbaar, ook `a*`.
2. **SHACL → canoniek**: een reeks wordt een **voorgestelde** afgeleide relatie (de modelleur
   beslist, en geeft de naam); wat niet past (`a*`, `a|b`) wordt een melding.
3. **Canoniek → SHACL**: `a.b` wordt een padreeks; een regel met `filter` past niet in een pad
   en gaat naar `sh:sparql` of een melding (open, §11).

Inverse navigatie stond al open; SHACL en OWL gebruiken haar veel (`sh:inversePath`,
`owl:inverseOf`). Dat is een reden om die functie naar voren te halen (backend).

## 6. OWL-profiel

OWL beschrijft wat begrippen betekenen, in logica bovenop RDF; een *reasoner* leidt er nieuwe
feiten uit af.

- **Klassen** met `subClassOf` (meer ouders mag; een ding kan tot meer klassen tegelijk horen).
- **Individuen**: de concrete dingen.
- **Properties** als zelfstandige begrippen, met `domain` en `range`, een eigen hiërarchie
  (`subPropertyOf`) en kenmerken (transitief, symmetrisch, functioneel, `inverseOf`).
- **Klassedefinities**: `unionOf`, `intersectionOf`, `complementOf`, `equivalentClass`,
  `disjointWith`, restricties ("heeft minstens één kind dat arts is").
- **Open wereld**: wat er niet staat is onbekend, niet onwaar; geen unieke-naamaanname.
- **OWL leidt af, SHACL controleert**: `domain Persoon` op een property die een hond gebruikt
  is geen fout; OWL concludeert dat de hond een Persoon is.

**Property als eigen element**, niet als attribuut in een box. Dat is wat een property in OWL is
(VOWL tekent ze ook zelfstandig), en `subPropertyOf` gaat van property naar property: als
connector kan dat niet, want een relatie is bij ons nooit bron of doel van een relatie (besluit
Mark 09-10). `domain` en `range` worden gewone connectors. Een compacte weergave kan later.

De echte afbeeldingsvraag zit in het **kruisverband met canoniek**: een property met twee
domeinen is daar geen gewoon attribuut.

## 7. SKOS-profiel

- **Elementen**: `skos:Concept` (begrip), `skos:ConceptScheme` (begrippenkader),
  `skos:Collection`.
- **Relaties**: `broader`/`narrower` (hiërarchie), `related`, `inScheme`, `topConceptOf`,
  mapping-relaties (`exactMatch`, `closeMatch`, …).
- **Eigenschappen**: `prefLabel`, `altLabel`, `definition`, `scopeNote`, … (meertalig).
- **Primaire weergave**: de boom (§8); het diagram is daar een afgeleide.
- **Kruisverbanden**: begrip ↔ objecttype (zoals MIM "begrip"), begrippenlijst ↔ canonieke
  waardelijst. De Nederlandse overheid werkt met begrippenkaders op SKOS-basis (NL-SBB).

## 8. De projectboom

Een ontologie of begrippenkader wil je als boom opbouwen. Dat kan met het bestaande model, mits
de boom elementen kan maken en nesten.

**Besluit Mark (04-11): een element heeft hooguit één ouder in de boom.** Meer ouders maakt het
te ingewikkeld, en dan is het geen boom meer.

**Haalbaarheid (OMNIUM-UI, 04-11, uit de code gelezen, niets gebouwd; grof):**

| Onderdeel | Stand | Schatting |
|---|---|---|
| Nieuw element in de boom | het mapmenu kent alleen "Nieuw diagram" en "Nieuwe submap"; het model eist geen diagram | 1–2 dagen |
| Nesten door slepen in de boom | `verhangNaarContainer` (regels + kringbeveiliging) bestaat, maar alleen op het canvas en in "Niet ingedeeld" | 1–2 dagen |
| ~~Meer ouders~~ | vervalt door het besluit | ~~2–3 dagen~~ |

Twee vormen, per M2-profiel te kiezen; beide met bestaande sleutels, geen nieuwe M3-sleutel:

- **Echte bevatting** (namespace, module, map, en Marks "EL in EL"): `containerVoor` plus
  `hierarchie` op hetzelfde connectortype, zoals xsd en wsdl al doen. Eén ouder per ontwerp.
- **Hiërarchie die een relatie is** (`rdfs:subClassOf`, `skos:broader`): `hierarchie` met
  `{type, omgekeerd: true}` (wijst van kind naar ouder; dmn-drd gebruikt die vorm al).

`uitwerking` valt af: dat is alleen ordening, een export ziet het niet.

**Meer ouders in de bron.** OWL- en SKOS-bestanden hebben soms twee keer `subClassOf` of
`broader` bij één element. Voorstel: de eerste in een vaste volgorde wordt de boomouder, de
rest blijft een gewone relatie (zichtbaar op het diagram, ongewijzigd in de export), met een
melding bij import. De code moet die keuze deterministisch maken; nu wint de laatste.

**Gebouwd in fase 0 (OMNIUM-UI, 06-11, branch `feat/boom-element-maken-nesten`; uitgebracht in studio 0.31.0, main 82852285):**
- *Nieuw element ▸ taal ▸ type* op een map maakt een element zonder diagram.
- *Nieuw element hierin*, slepen naar een element, een kind naar een map slepen en *Uit de
  container halen* leggen of verwijderen de echte relatie, via `hangOmNaarContainer`
  (`diagramcore/model/omhangen.js`, gedeeld door canvas en boom). Alleen waar het connectortype van
  `containerVoor` ook de `hierarchie` is. Bij `containerVoor` én `uitwerking`: wat het type kan
  bevatten wordt een relatie, de rest een uitwerking.
- `bouwHierarchie`: de boomouder (`ouderVan`) is de eerste in vaste volgorde (connector-id, dan de
  hook); een kring telt niet en komt in `kringen`.
- "Op geen enkel diagram" is een rustig teken ◌ met uitleg.

**Afwijking — besloten (Mark, 06-11):** de *weergave* toont een kind nog onder élke ouder; alleen de
boomouder is enkelvoudig. OAS (`ref`) en GraphQL (`veldtype`) gebruiken de hiërarchie bewust als
graaf (een schema onder elke operatie) en houden dat. SKOS en OWL tonen één ouder via een **vlag per
profiel**; die komt met fase 4/5.

**Niet gedaan:** nesten voor `{type, omgekeerd: true}` (`subClassOf`, `broader`). Omhangen mag
daar de andere relaties niet weghalen; hoort bij fase 4/5.

**Meekomend:**
- "Op geen enkel diagram" (cursief) klinkt bij een boom-first-profiel als een fout; anders tonen.
- Kringen (A broader B broader A) worden nu alleen bij diepte 8 afgekapt: validatie in het M2.
- ~~`hierarchie` staat niet in de typedef van `schema.js`~~: gedocumenteerd door M3-MOF
  (06-11, op main 2b5e4c28, niet gepusht).

## 9. SPARQL

Geen notatie. Twee plekken waar het wel landt: als `sh:sparql`-constraint (§4), en later als
leesinterface op het register (registerdata als RDF met een SPARQL-eindpunt). Dat laatste is
een apart onderwerp.

## 10. Testbestanden

In [model-exchange/linked-data/](../../model-exchange/linked-data/README.md):

- `odrl22-kern.shacl.ttl` — de kern van het ODRL 2.2-informatiemodel als SHACL, volgens de
  [spec](https://www.w3.org/TR/odrl-model/). Gebruikt node shapes, `sh:class`-pijlen,
  kardinaliteit, `sh:in` (als waarschuwing), `sh:alternativePath`, `sh:or`, `sh:xone` en één
  `sh:sparql`. Gecontroleerd met pyshacl 0.40.2, ook met meta-SHACL.
- `odrl22-kern.goed.ttl` (klopt) en `odrl22-kern.fout.ttl` (negen gevallen, elk één bekende
  melding).
- Voor OWL en SKOS: [ODRL22.ttl](https://www.w3.org/ns/odrl/2/ODRL22.ttl) van W3C.

Maatstaf voor de tekening: de figuur in de ODRL-spec (Policy, Rule, Asset, Party, Constraint,
Action met hun relaties en subklassen).

## 11. Valkuilen bij SHACL — wat de import moet melden

Bij het opzetten van het testbestand bleek hoe makkelijk een SHACL-bestand er goed uitziet en
toch niet doet wat het zegt. Geen van deze fouten wordt door een Turtle-parser, een
tekendienst of de meta-SHACL-controle gemeld:

| Patroon | Wat er gebeurt |
|---|---|
| `sh:path ( a b c )` voor "a of b of c" | dat is een **reeks** a/b/c; bedoeld is `sh:alternativePath`. Sparna tekent het als `a/b/c`, wat als "of" leest |
| `sh:or ( [sh:path a] [sh:path b] )` zonder `sh:minCount` | elke kant klopt altijd; de or doet niets |
| `a sh:SPARQLConstraint` met `sh:targetClass` | geen shape; de regel draait niet. Hoort: `sh:NodeShape` met `sh:sparql [...]` |
| SPARQL in een tekstwaarde | wordt pas bij uitvoeren geparst; een syntaxfout valt niet op als de regel nooit draait |
| `sh:in` op `rdf:type` om verouderde termen te weren | omgekeerde logica: alles wat níet in de lijst staat wordt afgekeurd; hoort `sh:not` |
| `sh:targetNode` naar een niet-bestaande knoop | de shape controleert niets |
| geen `sh:maxCount` | 0..\* — ook voor wat in de spec "precies één" is |

**Les**: een tekening uit SHACL laat juist de kapotte delen weg (wat de tekendienst niet
begrijpt, tekent hij niet). Ons profiel moet bij import **lint-meldingen** geven voor deze
patronen, en niet-getekende onderdelen zichtbaar houden (als constraint of melding).

## 12. Fasering

0. **Boom** (OMNIUM-UI, na akkoord Mark): element maken in de boom; nesten via `containerVoor`
   + `hierarchie`. Generiek: elk profiel met `hierarchie` krijgt het mee (ook xsd, wsdl).
   **Gebouwd 06-11, uitgebracht in studio 0.31.0** (§8). Daarna erbij: "erin" ook voor insluiting (M3-aard `insluiting`, canonieke compositie), packages met `uitwerking`, meervoudige selectie in de boom, Ctrl+C/V op het canvas; één undo voor boom en diagram staat als UNDO-1 in de backlog.
1. **Turtle-lezer + SHACL lezen en tekenen**, met de lint-meldingen van §11. Test:
   `odrl22-kern.*`.
   **Gebouwd 07-11** (branch `feat/linked-data-shacl`, ongecommit):
   - `transformatie/turtleLezer.js`: eigen lezer voor Turtle 1.1 (geen dependency, zoals de
     SDL-parser) plus een kleine `RdfGraaf` (opzoeken, lijsten, compacte IRI's, fragmenten).
     Geeft voor de drie testbestanden en ODRL22.ttl (2157 triples) een graaf die isomorf is
     met die van rdflib.
   - `diagramprofielen/shacl/`: profiel `shacl` (activiteit `shacl05`, preview). Elementen:
     shapes graph (titel, prefixen, `sh:declare`), node shape, losse property shape, klasse
     (doel van `sh:class` zonder shape) en een eigen constraint (taal SHACL of SPARQL).
     Property shapes zijn regels `pad : type [kard] {facetten}`; het pad in SPARQL-padsyntax
     (`a|b`, `a/b`, `^a`, `a*`). Elke parameter heeft een eigen veld; de weergave en de
     pijlen worden in `hooks.migreerModel` afgeleid (`afleiding.js`). Klasse → shape: de meest
     specifieke shape (de minste doelklassen). Een `sh:or` van alleen `sh:class` wordt `a | b`
     met twee pijlen `{or}`.
   - Niets gaat stil verloren: onbekende predicaten in `overig` (Turtle), triples zonder shape
     in `overig` van de shapes graph, met een melding.
   - `lint.js`: alle valkuilen van §11, plus onbekende `sh:`-predicaten/klassen (tikfouten),
     SPARQL-vorm (haakjes, strings, niet-gedeclareerde prefixen, `$this`), shapes zonder doel,
     property shapes zonder pad. Op het oude collega-bestand komen alle bekende fouten boven; de
     ODRL-kern geeft geen enkele melding. Na de import toont een dialoog de meldingen.
   - Ook geregistreerd in de render-dienst (`studioProfielen.js`) en de MCP (`profielen.json`).
   - Tests: `turtleLezer.test.js` (8), `shacl.test.js` (9), e2e `46-studio-shacl-import` (2: import
     via het menu, dialoog met meldingen). Unit 1458/1458, e2e 119/120 (02-verwijder-diagram faalt
     ook zonder deze wijziging).
   - *Nog niet:* een melding is nog niet per element terug te vinden in de
     Studio (de dialoog toont ze bij import); de rijen-layout is grof; taaltags op
     `sh:name`/`sh:message` met meer dan één taal gaan naar `overig` (één taal wordt bewaard, zie fase 2).
2. **SHACL schrijven + rondreis** (IRI-veld, constraint-body met taal).
   **Gebouwd 07-11** (zelfde branch, ongecommit): `diagramprofielen/shacl/schrijver.js`
   (`naarTurtle`) en `pad.js` (`padNaarTurtle`, de terugweg van de pad-tekst). Menu *Exporteer
   SHACL (Turtle)…*; meldingen en de lint van de uitvoer komen als `#`-commentaar bovenaan.
   - **Rondreis = dezelfde graaf** (isomorf volgens rdflib) voor de drie ODRL-testbestanden,
     ODRL22.ttl (2157 triples, alles in de losse triples), het oude collega-bestand (652) en een
     lastig grammaticabestand (kring van lege knopen, geneste lijsten).
   - Daarvoor bewaart de import nu ook: de taal van teksten (`messageTaal`, …), of de naam uit
     `rdfs:label` kwam, `a sh:NodeShape`/`a sh:PropertyShape` (`getypeerd`), het klassetype van
     een shape, predicaat en taal van titel en beschrijving, de SPARQL-query letterlijk (`ruw`,
     zolang de specificatie niet bewerkt is) en `ask`/`select`. Triples die bij geen shape
     horen staan in een eigen veld *losse triples* van de shapes graph.
   - IRI = identiteit: hernoemen verandert de IRI niet (de naam wordt `rdfs:label`); een nieuw
     element krijgt een IRI uit de namespace van de shapes graph (anders `ex:`).
   - Elk bewerkbaar Turtle-fragment (overig, logica, `sh:in`, waarden, pad) wordt vóór het
     schrijven gelezen; wat niet klopt wordt overgeslagen met een fout-melding met de plek, dus
     de uitvoer is altijd geldige Turtle. Een constraint in natuurlijke taal of zonder
     annotatie-lijn naar een shape geeft een waarschuwing.
   - Tests: `schrijver.test.js` (7), e2e 46 nu 3 (ook export na hernoemen). Unit 1465/1465.
   - *Grenzen:* een lege knoop die op twee plekken gebruikt wordt, wordt bij het schrijven twee
     knopen (komt in SHACL zelden voor); een benoemde property shape in meer node shapes wordt
     één keer geschreven (de eerste kopie).
3. **Canoniek → SHACL** als kruisverband: shapes uit het eigen model. Raakt backlog E8 (MIM
   linked data) en RM5; MIM's LD-vorm is gebaseerd op OWL/RDFS/SHACL
   ([MIM_VERGELIJKING](../MIM_VERGELIJKING.md) §4). Proef: de ODRL-export van Toegangsspraak
   valideren tegen `odrl22-kern.shacl.ttl`.
   **Gebouwd 07-11** (zelfde branch, ongecommit): `diagramprofielen/shacl/vanCanoniek.js`
   (`canoniekNaarShacl`, puur) en de transformatie *Canoniek model → SHACL-shapes* (richting
   transform, `studio/activities/shaclTransformatie.js`). Afbeelding:

   | Canoniek | SHACL |
   |---|---|
   | entiteit | node shape die zelf de klasse is (`a sh:NodeShape, rdfs:Class`, impliciet klassedoel) |
   | veld : basistype / gegevenstype | regel met `xsd:`-datatype; pattern, min/maxLength, min/maxInclusive uit de validatie (eigen gegevenstype, anders de catalogus `gegevenstypen.snapshot.json`); verplicht → minCount 1; maxCount 1 |
   | veld : enumeratie | `sh:in ( … )` |
   | veld : ref.lijstitem | `sh:class` |
   | ENT ◆ GE | `sh:node` naar de shape van het GE (geen doel, zoals een MIM-gegevensgroep) |
   | relatie | `sh:class` naar de doel-entiteit, kardinaliteit van het doel |
   | generalisatie | `rdfs:subClassOf` |
   | afgeleid veld, {uniek} | niet (melding) |

   - **Momentbeeld**: de shapes beschrijven de geldige stand op één moment. `{enkelvoudig}` →
     maxCount 1; de tijdlijn (formeel/materieel) staat er niet in. Een historie-beeld kan later.
   - **IRI's** per domein: `<basis-IRI><domein>#`, prefix = domeinnaam (optie *basis-IRI*).
   - **Kruisverbanden**: per shape "genereert" in de koppelingen-matrix (canoniek = kolom).
     Opnieuw uitvoeren werkt bij: posities blijven, wat niet meer gegenereerd wordt verdwijnt met
     zijn kruisverbanden.
   - Gecontroleerd met pyshacl op het aanvraag-domein: de shapes zijn geldig (meta-SHACL), een
     kloppende aanvraag conform, een foute gaf precies de vier verwachte meldingen.
   - **Proef Toegangsspraak → ODRL** (drie beleiden: schuldhulp, het voorbeeld, de FTV-demo),
     met ODRL22.ttl erbij als vocabulaire. Twee bevindingen, in alle drie gelijk:
     1. *Fout in de export*: een entiteit met gegevens eronder (`reg:NatuurlijkPersoon`) is
        `odrl:Asset`, maar staat als waarde van `odrl:partOf`; ODRL 2.2 vraagt daar een
        `odrl:AssetCollection`. Oplossing in de regelset: zo'n knoop ook `odrl:AssetCollection`.
        **Nog niet aangepast** (Toegangsspraak; eerst Mark).
     2. *Vocabulaire ontbreekt*: `apnl:rolAanvrager` als leftOperand is nergens
        `odrl:LeftOperand`; dat hoort uit de ODRL-AP-NL-vocabulaire te komen, die hier niet
        beschikbaar is. De eigen `ts:`-termen typeert de export wel zelf.
     De kern-SHACL is daarbij verbeterd: aantal en klasse van leftOperand/operator in aparte
     property shapes, zodat een verkeerd type niet als "precies één" gemeld wordt (309 triples).
   - Tests: `vanCanoniek.test.js` (6), e2e 46 nu 4 (transformatiepaneel → shapes + 12
     kruisverbanden). Unit 1471/1471.
   - *Nog niet*: velden van een relatie (associatieklasse), uniciteit als `sh:sparql`, de
     regelvorm (§3 van TRANSFORMATIES: nu geteste code achter het registry-contract, zoals OAS →
     canoniek).
4. **SKOS-profiel**, boom eerst.
5. **OWL-profiel**, boom eerst; property als element.

Inverse navigatie in de CEL-subset (backend) kan parallel.

## 13. Open

- ~~Welke ouder wordt de boomouder bij meer `subClassOf`/`broader` (§8)~~: de eerste in vaste volgorde (gebouwd in fase 0); de weergave per profiel (besloten 06-11).
- Canoniek → SHACL voor een afleidingsregel met `filter`: `sh:sparql` of melding (§5).
- Heeft de superprofiel-constraint een taalveld (§4)?
- ODRL 3.0: het testbestand volgt 2.2; zie
  [ODRL 3.0 — W3C-workshop](2026-08-18%20ODRL%203.0%20—%20W3C-workshop%20en%20gevolgen%20voor%20Toegangsspraak.md).
- JSON-LD naast Turtle: wanneer.
