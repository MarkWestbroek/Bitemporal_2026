# M3 en projectmetamodel als modellen in Omnium (plan, 15-11-2026)

*Sessie M3-MOF (Claude), op voorstel van OMNIUM-UI met akkoord van Mark (15-11). Status: plan
goedgekeurd 15-11 (§8); stap 1 in uitvoering.*

## 1. Aanleiding

Het M3 staat nog in Marks EA-Metametamodel (`Zandbak MW / Metametamodel`, diagram "Editor"), en
dat was de bron van `diagramcore/types/schema.js`. In EA lopen twee dingen door elkaar: het M3
(waarmee profielen beschreven worden) en de structuur van een project (de werkbank en het
werkbestand). Mark wil beide naar Omnium halen, als **documentatie in onze eigen vorm**:

1. twee modellen: het **M3** en het **projectmetamodel**;
2. **alleen-lezen** in de Studio: de feitelijke implementatie is de code;
3. **afgeleid uit de code**, met een controletest, zodat het model niet uit de pas loopt (zoals de
   profielvingerafdruk `render-svc/profielVersies.vast.json`).

## 2. Wat er in welk model komt

**M3** (wat een profiel kan zeggen; bron `schema.js` en de typen-modules):

- Definitie: DiagramType, ElementType (met `erft`, `isAbstract`, `aard`, `facetten`, `opname`,
  `samentrekking`, `containerVoor`, `randElement`, `uitwerking`, …), ConnectorEindpunt en de
  verbindingsregels, CompartmentType, FieldType, PropertyType (met `betekenis`, `zichtbaarAls`),
  ReferenceType, ActionType, TaskbarType; het superprofiel; de vaste eigenschappen `beschrijving`
  en `verwijstNaar`.
- Stijl: ShapeType, ShapeSet, LineStyle (edgePresentatie), LayoutStijl, StyleType.
- Implementatie: ShapeRenderer, LayoutRenderer, ReferenceResolver, PropertyTypeEditor/-Viewer,
  FieldTypeViewer en de hooks (uit `handlerCatalogus.js`).
- Enumeraties rechtstreeks uit de code: `AARD_CONNECTOR`, `AARD_ELEMENT`, `VORMBOOM_TAGS`, de
  betekenissen van PropertyType, de ankers.

Indeling in pakketten zoals de boundaries in EA: **Definitie**, **Stijl**, **Implementatie**.

**Projectmetamodel** (het werkbestand en de werkbank; geen M3):

- project (id, naam, formaatversie = `PROJECT_FORMAAT_VERSIE`, nu 3; straks 4 met uuid's),
  profielgebruik met `profielVersies`, map, plaatsing (ook onder een element als ouder; hooguit
  één ouder, besluit 04-11), modelelement (met uuid vanaf formaat 4), diagram, voorkomen,
  bundel en gedeelde bundel, kruisverband, branch (basis/tak);
- apart en gemarkeerd: de **werkruimte** (niet in het werkbestand: tabs, viewports).

Formaat 4 (OMNIUM-UI, feat/samenvoegen-per-veld, nog niet gemerged): `PROJECT_FORMAAT_VERSIE = 4`;
elk element van een soort in `UUID_SOORTEN` (canoniek-uml) heeft `data.uuid`, en elk veld met een
naam in het compartiment "velden" ook. Ontbrekende uuid's vult de Studio aan met een uuid v5
(`afgeleideUuidMaker`, `canoniek-uml/uuids.js`; stam: `herkomst.ouderProject` bij een branch,
anders het project). Een v3-bestand laadt en wordt v4 bij de volgende snapshot. Het
projectmetamodel neemt dit op als eis (constraint) zodra het gemerged is.

## 3. Vorm: welk profiel

**Advies: puur-uml voor allebei.** Het zijn klassenmodellen van metaklassen: klassen met
attributen, generalisatie (ElementType `erft`), compositie (ElementType ◆ CompartmentType ◆
FieldType), associaties met kardinaliteit, enumeraties en pakketten. Zo stond het ook in EA (UML
in EA), en puur-uml heeft al klasse, enumeratie, package, boundary en de relaties.

Niet gekozen:

- **canoniek-uml**: dat is het registermodel (entiteit, gegevenselement, relatie, materieel). Een
  metaklasse is geen registerentiteit; het zou niveaus door elkaar halen.
- **profiel-ontwerp**: die tekent één M2 *met* het M3; hij beschrijft het M3 zelf niet.

## 4. Waar het model leeft

**Advies: gegenereerd bestand in de repo, gepubliceerd naar een alleen-lezen project op app.**

- Bron in de repo: `docs/metamodel/omnium-m3.studio-project.json` en
  `docs/metamodel/omnium-projectmetamodel.studio-project.json` (gewoon werkbestandsformaat), te
  openen in elke Studio.
- Bij een release zet een script ze in twee projecten op app, eigenaar het Claude-account (zoals
  "Omnium architectuur"). Iedereen krijgt **leestoegang**: dan is alleen-lezen er al, via de
  bestaande projecttoegang, zonder nieuwe UI.
- Later, als OMNIUM-UI een leesmodus voor ingebouwde projecten bouwt, kunnen ze ook in de Studio
  zelf meekomen. Dat is niet nodig voor versie 1.

Alternatief: alleen ingebouwd in de Studio-bundel. Dat vraagt eerst een leesmodus in de UI.

## 5. Hoe de afleiding werkt

`schema.js` is JSDoc; dat betrouwbaar ontleden is broos. Daarom een kleine, machine-leesbare
beschrijving náást de code, die de test dwingt gelijk te blijven:

1. **`diagramcore/types/m3.js`** (M3-MOF): per metaklasse het pakket, de eigenschappen (naam,
   type, kardinaliteit, één regel uitleg) en de relaties. Enumeraties **importeert** het uit de
   code (geen kopie). Leesbaar én gegevens.
2. **`studio/projectMetamodel.js`** (M3-MOF, met OMNIUM-UI): hetzelfde voor het werkbestand,
   plus de formaatversie.
3. **Generator** `scripts/genereer-metamodellen.mjs`: maakt van beide een werkbestand in
   puur-uml, met de bestaande auto-layout per pakket. Uitvoer deterministisch (vaste ids, vaste
   volgorde), zodat een diff iets zegt.
4. **Controletests** (in `npm test`):
   - M3: elke `@property` van elke `@typedef` in `schema.js` staat in `m3.js`, en omgekeerd; de
     hooks uit `handlerCatalogus` staan erin.
   - Projectmetamodel: `PROJECT_FORMAAT_VERSIE` = de versie in het model; elke sleutel die in
     echte werkbestanden voorkomt (de fixtures en `docs/architectuur/…studio-project.json`) is
     beschreven, en omgekeerd.
   - Het gegenereerde bestand is actueel (zelfde patroon als `profielVersies.vast.json`: de test
     zegt "draai `npm run metamodellen`").

Zo kan een sessie geen veld toevoegen zonder het model bij te werken; de test wijst het aan.

## 6. EA

Na versie 1 is Omnium de documentatie. Voorstel: het EA-Metametamodel bevriezen met een notitie
"bron is nu Omnium", in plaats van beide bij te houden. Ter controle kan de EA-lezer het pakket
eenmalig inlezen, zodat we zien wat EA had en het model niet.

## 7. Stappen

| # | Wie | Wat |
|---|---|---|
| 1 | M3-MOF | `m3.js` + controletest tegen `schema.js` — **klaar 16-11** (ook dekking van alle profielen in render-svc; zie STUDIO.md §Het M3 als gegevens) |
| 2 | M3-MOF + OMNIUM-UI | `projectMetamodel.js` + controletest; formaat 4 staat op main (studio 0.44.0, ad6f9bc8), voorbeeldbestand van OMNIUM-UI |
| 3 | M3-MOF | generator naar puur-uml, layout, "actueel"-test |
| 4 | M3-MOF | publicatiescript naar app (leestoegang voor iedereen), bij de release |
| 5 | Mark | EA-pakket bevriezen |

## 8. Besluiten Mark (15-11)

- (a) **puur-uml** voor beide. "Het komt niet in een bitemporeel register, dus canoniek is
  overdone."
- (b) **Alleen-lezen project op app, maar bewerkbaar voor Mark**, zodat hij de layout kan
  aanpassen. Gevolg voor de generator: elke klasse heeft een vaste id; posities en maten neemt
  hij over uit het bestaande project; alleen nieuwe klassen krijgen een plek van de auto-layout,
  verdwenen klassen gaan eruit. Het publicatiescript werkt alleen de inhoud bij, nooit de layout,
  en het repo-bestand neemt Marks layout bij een release over uit app.
- (c) **EA bevriezen** na versie 1.
- (d) **Hooks als associatie**: in Implementatie een klasse **Hook** (naam, beschrijving uit
  `handlerCatalogus.js`); DiagramType en ElementType hebben een associatie `hooks` 0..* naar Hook
  (een attribuut met een klasse als type is in UML gewoon een associatie). De soorten komen als
  enumeratie **HookSoort** rechtstreeks uit de catalogus; de controletest houdt ze gelijk.
