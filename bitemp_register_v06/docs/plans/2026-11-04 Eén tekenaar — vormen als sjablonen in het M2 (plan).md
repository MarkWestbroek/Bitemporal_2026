# Eén tekenaar — vormen als sjablonen in het M2 (plan, 04-11-2026)

Aanleiding: Imprint (INRICHTEN_VIZ) wil elk Studio-diagram als SVG via de render-API, de
documentgenerator en de gedeelde plaatjes tekenen nu een schets, en Mark stelde op 03-11 de
kernvraag: *"Alle M1's volgen hun M2 en alle M2's het M3; het is toch gewoon wat de Studio
tekent als je een diagram opent, maar dan zonder de bewerkmogelijkheid — een view in plaats
van een control?"* Dat klopt. Dit plan maakt die ene view, en legt uit waarom hij er nu niet is.

Betrokken sessies: OMNIUM-UI (motor en canvas), M3-MOF (het M3-contract), RENDER-API (de
serverkant), INRICHTEN_VIZ (afnemer). Mark besliste op 04-11 dat deze route (B) gevolgd wordt;
stap 1 van de render-API (de bestaande schets achter `POST /api/render/svg`, `taal=studio`)
loopt daar los van en vooruit op.

## 1. Hoe het nu zit — drie tekenaars

| Tekenaar | Waar | Wat | Beperking |
|---|---|---|---|
| **Canvas** | `diagramcore/canvas/ElementNode.jsx` + `shapes.jsx` per profiel | de echte view: React-componenten per ShapeType, geregistreerd met `registreerShape` | HTML + CSS (`.dc-node`, `.dc-stereotype`, …), alleen in de browser; export via `html-to-image` geeft `<foreignObject>`, wat Imprint verbiedt |
| **Schets** | `transformatie/sjabloon/schets.js` | DOM-loze SVG voor documenten (`{{svg}}`) en gedeelde plaatjes (`studio/gedeeldeBeelden.js`) | kent geen vormen, alleen 7 families uit een regex op de shape-id (`vormFamilie`); geen compartiment-opmaak, geen knikken |
| **diagramsvg** | `web/vite/src/diagramsvg/` (render-svc, `taal=v3`) | byte-stabiele SVG met vaste tekstmaten, Imprint-eisen | alleen canonieke V3-modellen |

De niveaus, zoals Mark ze op 03-11 corrigeerde:

- **M3** zegt alleen: een `ElementType` heeft een `shape` (ShapeType-id), een `DiagramType` kan
  `shapeSets` hebben (P07: per diagram een andere gedaante, `diagram.shapeSetId`), en er is een
  vormgrammatica (`kleur`, `randDikte`, `hoekRadius`, `randStijl`, `naamLabel`, `minBreedte`).
  Wat een ShapeType *is* staat niet in het M3; het is "Implementatie-domein".
- **M2** (de descriptor) kiest per elementtype een shape-id — bv. `bpmn-event` voor het message
  event — en levert de bijbehorende React-component in `shapes.jsx`. Die component is dus ook
  M2, maar als code, niet als gegevens.
- **M1** (het proces "aanvraag oppakken") kiest hooguit een shape-set per diagram.

Telling (04-11): **74 registraties in 15 bestanden** — 14 generiek (`diagramcore/shapes/
basisShapes.jsx`, waaronder `class-box`) en 60 profielspecifiek:

| bestand | shapes | `<div>` | svg-elementen |
|---|---|---|---|
| diagramcore/shapes/basisShapes.jsx | 14 | 54 | 5 |
| diagramcore/shapes/dataShape.jsx | 1 | 11 | 2 |
| activity | 8 | 11 | 5 |
| archimate | 3 | 5 | 2 |
| bpmn | 8 | 15 | 49 |
| business | 4 | 9 | 21 |
| cmmn | 7 | 13 | 21 |
| component-deployment | 1 | 4 | 4 |
| object | 1 | 5 | 0 |
| requirements | 1 | 9 | 0 |
| sequence | 4 | 10 | 15 |
| statemachine | 8 | 10 | 5 |
| sysml | 2 | 9 | 4 |
| toegangsregel | 9 | 30 | 16 |
| usecase | 3 | 6 | 5 |

Lees de tabel zo: de **omtrek en de iconen** zijn al grotendeels SVG (`iconenVocabulaire.jsx`
alleen al 91 svg-elementen, allemaal puur). De `<div>`s zitten in de **inhoud**: kop,
stereotype, badges, compartimenten en veldregels. Die inhoud is generiek en zit nu in élke
shape opnieuw (de 54 divs van `class-box` zijn er het grootste voorbeeld van). Dat is de echte
reden dat een tekenaar buiten de browser nu "per profiel" werk kost: niet de vormen, maar de
HTML-inhoud erin.

## 2. Doel — één view, twee hosts

Eén tekenaar die een diagram uit een projectstore (diagram + elements + descriptor + shape-set)
omzet in SVG, en die op twee plaatsen draait:

- **Canvas (control):** React Flow blijft de control — selectie, slepen, handles, resizer,
  inline bewerken, nesting van containers. Het *lichaam* van een node is de SVG van de tekenaar.
- **Server en documenten (view):** render-svc, de documentgenerator en de gedeelde plaatjes
  roepen dezelfde tekenaar aan en krijgen dezelfde SVG, byte-stabiel, zonder DOM, volgens de
  Imprint-eisen (`docs/RENDER_API.md` §Eisen).

Een nieuw M2 krijgt de tekenaar dan gratis: het levert alleen zijn vormen als sjablonen.

## 3. Ontwerp

### 3.1 M3: ShapeType (gegevens) en ShapeRenderer (code) — M3-MOF

Herzien 04-11 na de beoordeling van M3-MOF tegen het EA-Metametamodel (diagram "Editor"):
daar staat **ShapeType in de boundary Style** (gegevens; ShapeSet en StyleType zijn aggregaties
erop) en **ShapeRenderer in Implementation**, die het ShapeType realiseert — hetzelfde patroon als
LineStyle ← LineRenderer en LayoutStijl ← LayoutRenderer (`schema.js` noemt het al). De kop van
`schema.js` zegt bovendien "geen functies in nieuwe declaratieve velden". De eerste versie van
dit plan zette functies op ShapeType; dat was de verkeerde metaklasse. De huidige
React-componenten in `shapes.jsx` zijn dus ShapeRenderers, geen ShapeTypes (de zin
"ShapeType-componenten = Implementatie" in `schema.js` en `shapeRegistry.js` wordt rechtgezet).

```
ShapeType (Style — gegevens, serialiseerbaar; in het M2 of gedeeld)
  id            string
  renderer      ShapeRenderer-id          "rechthoek", "ellips", … (bibliotheek) of een eigen renderer
  parameters?   object                    bv. {hoekRadius: 8, kop: "boven"} voor een bibliotheek-renderer
  minMaat?      {w,h}                     standaard; ElementType.minBreedte/minHoogte overschrijft
  ankers?       "rechthoek"|"rand"        waar lijnen aanhechten (default rechthoek)

ShapeRenderer (Implementation — pure code, op id gekoppeld via registreerRenderer)
  omtrek(ctx)       → VormBoom            de vorm, met de opgeloste stijl uit ctx.stijl
  inhoudsvak(ctx)   → Vak | null          waar de motor de inhoud zet; null = geen inhoud (event,
                                          gateway: buitenlabel). Vak = {x,y,w,h, uitlijning, rotatie}
                                          (use case gecentreerd, class-box bovenaan, pool-kop gedraaid)
  kindervak?(ctx)   → Vak                 containers: waar de leden liggen (pool: níet het labelvak)
  ornament?(ctx)    → VormBoom            iconen en markeringen (BPMN event-soort, gateway-kruis,
                                          ArchiMate-icoon rechtsboven)
  rand?(ctx, hoek)  → {x,y}               aanhechtpunt op de omtrek voor `ankers: "rand"`; de
                                          bibliotheekvormen hebben hem, anders terugval op rechthoek
```

Met `ctx = {element, elementType, shapeType, maat, stijl, node?, diagram, thema, idPrefix}`:

- `stijl` is de door de motor **opgeloste** vormgrammatica (`kleur`, `randDikte`, `hoekRadius`,
  `randStijl`): element-waarde wint van type-waarde wint van thema. Dat vult de
  StyleType-aggregatie uit EA in; een renderer leest de grammatica niet zelf uit.
- `diagram` is alleen-lezen en vervangt store-toegang: de levenslijn leidt haar activaties nu af
  uit de berichten via `useStore` (`sequence/shapes.jsx`), en dat moet uit de ingang komen.
  Alternatief: een ElementType-hook die het afgeleide vooraf uitrekent.
- `node` (het DiagramNode-voorkomen, met `gedaante` voor samentrekking/opname) alleen als een
  renderer die echt nodig heeft; "gedaante" als ctx-naam vervalt — een ShapeSet kiest al een
  ander ShapeType.

Regels:

- Een **VormBoom** is een geneste gegevensboom `{tag, attrs, kinderen}` met alleen
  SVG-elementen uit een vaste lijst (`VORMBOOM_TAGS` in `diagramcore/types/shapeType.js`: g,
  rect, ellipse, circle, path, line, polyline, polygon, text, tspan, defs, clipPath, use,
  marker), gevalideerd door `valideerVormBoom` aldaar; `defs`/`clipPath`-id's dragen `idPrefix`. Geen `foreignObject`,
  `style`, HTML of DOM. Het boompje is bewust geen string en geen React: één beschrijving, twee
  lezers — `svg.js` serialiseert naar tekst (server, documenten), het canvas zet hem om in
  React-elementen (zodat `data-dc-veld` en klikdoelen blijven werken). Tekst via de
  tekstmaat-tabel (`diagramsvg/tekstmaat.js`).
- **Kleur:** thema-token `var(--diagram-<token>, <licht>)` (`diagramsvg/thema.js`), tenzij het
  element of type een kleur zet — die staat dan letterlijk in de SVG (zoals `diagramsvg` nu al
  doet voor entiteiten). Tekst op een gekleurd vlak kiest op contrast.
- **Inhoud is van de motor, niet van de vorm.** Naam, stereotype, type-icoon, badges (⚠, ⧉,
  materieel), compartimenten, veldregels (de `FieldType.viewer`s), het buitenlabel
  (`naamLabel: "buiten"`) en de rand-elementen tekent één inhoud-tekenaar in het `inhoudsvak`.
  **Eigen inhoud** van een type — `reqId`/`tekst`/`status` (requirements, sysml),
  links/op/rechts (toegangsregel-vergelijking), `instantieVan` (object), de `{specificatie}`
  van een constraint — gaat níet terug in de renderer maar in een nieuwe ElementType-hook
  `hooks.inhoudsregels(element) → [{delen: [{tekst, soort}]}]`, met hetzelfde vocabulaire als
  `edgeLabels`. Zo blijft de `<div>`-kolom uit §1 weg, ook voor toegangsregel (30 divs).
  OMNIUM-UI telt in stap 2 per vorm na wat de hook niet dekt.
- **Iconen** (`ElementType.icoon`, `iconenVocabulaire.jsx`) worden ook VormBoom, zodat palet en
  ornament één bron hebben.
- `ElementType.shape` en `DiagramType.shapeSets` blijven precies wat ze zijn (EA: ElementType →
  ShapeType, ElementtypeSet → ShapeSet). Een shape-set is al de "stijlkeuze per M1" waar Mark
  op doelde.
- **De twee tredes uit de eerste versie vallen samen:** een standaardvorm is een ShapeType met
  een bibliotheek-renderer (`rechthoek`, `afgerond`, `ellips`, `ruit`, `cirkel`, `kader`,
  `notitie`, `pad`) plus `parameters` — declaratief, dus later door de profiel-ontwerper te
  kiezen zonder code (naar schatting twee derde van de 74). Een eigen renderer is de tweede
  trede (strekfiguur, BPMN event-soorten, sequence-activaties). Het contract verandert niet
  tussen de tredes. Advies: renderer-contract en bibliotheek nu, ontwerper-UI later.
- **Overgang:** de oude React-component is modelmatig gewoon een tweede realisatie van
  hetzelfde ShapeType. `getShape(id)` blijft; een ShapeType met een renderer tekent via de
  tekenaar, anders via de oude component (zie 3.3).
- Voor Marks .qea is geen nieuwe klasse nodig (M3-MOF, 04-11, gelezen in het diagram
  "Editor"): ShapeType heeft nu alleen `name` (dat is de `id`), ShapeRenderer heeft nog geen
  attributen of operaties, en de Realisation ShapeRenderer → ShapeType bestaat al (in
  `schema.js` is dat de `renderer`-id). Erbij: op **ShapeType** de attributen `parameters`
  (sleutel/waarde), `minMaat` en `ankers`; op **ShapeRenderer** de operaties `omtrek`,
  `inhoudsvak`, `kindervak`, `ornament` en `rand`. Mark past de .qea zelf aan.

### 3.2 Motor: de tekenaar (OMNIUM-UI)

Module `diagramcore/tekenaar/` (naam open; `diagramsvg` blijft de V3-ingang en gaat er later
onder). Ingang:

```
tekenDiagram({diagram, elements, descriptor, shapeSet, opties: {thema, idPrefix, maten}})
  → { boom: VormBoom, maat: {w,h} }       en  naarSvg(boom) → string
```

Onderdelen, in de volgorde waarin ze nu in drie tekenaars verspreid zitten:

1. **Maat** — opgeslagen `node.size`, anders meten met de tekstmaat-tabel zoals het canvas nu
   doet (de rekensommen uit `schetsMaat` en de shapes), met `minMaat` uit het sjabloon.
2. **Vorm** — de renderer van het ShapeType (omtrek + ornament) met de opgeloste `stijl`.
3. **Inhoud** — de inhoud-tekenaar (zie 3.1), één keer, voor alle profielen, in het
   `inhoudsvak`; eigen inhoud via `hooks.inhoudsregels`.
4. **Nesting en kaders** — containers (`containerVoor`, `achtergrond`) en rand-elementen
   (`randElement`) zoals `canvas/nesting.js` ze bepaalt; dezelfde functies, geen kopie.
5. **Lijnen** — `edgePresentatie` (lijn, markers, kleur, dikte, `verbergBijNesting`), de
   handles/ankers en knikken uit het diagram, labels via `hooks.edgeLabels`, de rechte-lijn-regel
   van `schets.lijnTussen` als terugval zonder handles.
6. **Buitenlabels, badges, thema** — `thema.js`, stabiele id's met `idPrefix`.

Eisen: puur (geen DOM, geen store-toegang: de aanroeper geeft de stand mee), deterministisch
(vaste attribuutvolgorde, afronding — zoals `diagramsvg/svg.js`), golden-tests per profiel
(`fixtures/`), en de validatie van `diagramsvg/validatie.js` op elke uitvoer.

### 3.3 Canvas: dezelfde tekenaar als node-lichaam (OMNIUM-UI)

`ElementNode.jsx` krijgt één generieke `SjabloonShape`: hij vraagt de tekenaar om de boom van
dít voorkomen en zet die om in React-SVG. Eromheen blijft alles van React Flow: handles,
`ShapeResizer`, selectie-rand, de inline-editor (`data-dc-veld` op `<text>`-regels in plaats
van op divs), badges als overlay, de uitklap-kop van compartimenten.

Belangrijk voor de overgang: `getShape(id)` blijft bestaan. Een shape-id met een **sjabloon**
rendert via `SjabloonShape`; een id met alleen een oude React-component rendert zoals nu. Zo kan
elke vorm los worden omgezet, en is elke omgezette vorm meteen op canvas én server gelijk. Geen
big bang.

**Gebouwd 05-11 (OMNIUM-UI, `feat/tekenaar-canvas`).** `canvas/SjabloonShape.jsx` tekent een
voorkomen als `<svg>` op de maat van het voorkomen met dezelfde functies als de diagram-tekenaar:
`tekenaar/voorkomen.js` (`bouwVoorkomen`, `tekenVoorkomen`, uit index.js gelicht) en de nieuwe
canvas-lezer `tekenaar/naarReact.js` (VormBoom → React-elementen). `ElementNode` schakelt per
shape-id: `sjabloonOpCanvas(id)` = `tekenbareVorm(id)` min een korte uitzonderingslijst
(`diagramverwijzing`: naam van het doel live via `useDiagramNaam`). Daardoor tekenen de dertien
andere basisvormen nu via het sjabloon, en elke profielvorm die in stap 4 een ShapeType krijgt
meteen ook. Maat: `data.size` (bewaard) → live maat uit de `NodeResizer` tijdens slepen → gemeten
inhoud; de resizer-minima komen uit `minMaatVan`. Thema: diagramcore.css koppelt `--diagram-*` aan
de canvas-tokens; selectie zet de omtrek in `--dc-selectie` via CSS (`.dc-omtrek`). De
inline-editor vindt `data-dc-naam`/`data-dc-veld` op `<text>` (NaamEditor centreert ook op
`text-anchor`); de typering-stand verbergt `data-dc-stereotype`. De inhoud is geknipt op de maat
(zoals `overflow: hidden` eerder), ornamenten mogen uitsteken. Bewust weggelaten: de slagschaduw
van `.dc-node` (één view = documenten en canvas gelijk) en het type-icoon in de typering-stand
"icoon" (de tekenaar kent alleen de stereotype-tekst; iconen horen bij stap 4 als ornament).

**Stap 4 — eerste drie profielen, gebouwd 05-11 (OMNIUM-UI, `feat/tekenaar-profielvormen`).**
Use case, activity en ArchiMate (33 vormen) zijn ShapeTypes in een pure `vormen.js` naast de
descriptor, geïmporteerd uit `index.js` zodat canvas, documenten én de render-bundel (die `.jsx`
leeg laat) ze krijgen. Patroon per vorm, van licht naar zwaar:
- *bibliotheek-renderer + parameters* (de meeste): `uc-ellips` = `ellips`, `uc-actor` = `actor`,
  `act-begin/eind/flow-eind` = `cirkel` (nieuw: `kern`, `kruis`), `act-beslissing` = `ruit`,
  `act-object`/`act-pin`/`am-blok` = `rechthoek`, `uc-systeem`/`act-partitie` = `kader` (nieuw:
  `kopLijn`, `tint`);
- *eigen renderer in het profiel* waar de vorm van het element afhangt: `act-balk` (fork/join
  staand of liggend — nieuw contractpunt `ShapeRenderer.maat`), `am-box` (laagkleur, ronde hoeken
  voor gedrag, achthoek voor motivation, type-icoon als ornament), `am-laag` (grouping en
  blok-laag), `am-junction` (open bij "of");
- *de vorm als gegevens*: de negentien `am-vorm-*`-figuren (set "Iconen als vorm") zijn
  `parameters.figuur = {viewBox, kinderen}` op de nieuwe bibliotheek-renderer `figuur`, met
  plaatshouders `$vulling`/`$kleur`/`$open`; het figuur schaalt passend en zakt naar de onderkant,
  de naam wordt een buitenlabel. Dat is letterlijk "vormen als sjablonen in het M2".

Iconen: `archimate/glyphs.js` bevat de 47 hoek-iconen als VormBoom-gegevens; `iconen.jsx` maakt
er React van (taakbalk, inspector) en de tekenaar zet ze als ornament (`tekenaar/glyphs.js`,
`glyphVorm`). Motor-aanvullingen: `parameters.kleurAls: "rand"` (een kader neemt de typekleur
niet over; de eigen kleur kleurt de rand en de tekst blijft de thematekst — dat was al fout bij
`boundary`: witte naam op een open kader), `parameters.extraHoogte` (figuur boven de naam),
`ctx.inhoud` (de gemeten inhoud voor een renderer die zijn vak eromheen legt), en op het canvas:
een vorm zonder inhoudsvak draagt zijn naam als buitenlabel (`sjabloonNaamBuiten`) en kleine
vaste vormen krijgen `.dc-punt-node` (handles net buiten de vorm). De oude React-componenten
(`shapes.jsx`, `vormShapes.jsx`, `blokShapes.jsx`) staan er nog als tweede realisatie; opruimen
hoort bij de afronding van stap 4.

**Stap 4 — deel 2, gebouwd 05-11 (OMNIUM-UI, `feat/tekenaar-profielvormen-2`).** BPMN (8),
state machine (8) en sequence (4): twintig vormen in `bpmn/vormen.js`, `statemachine/vormen.js`,
`sequence/vormen.js`. BPMN heeft eigen renderers waar de vorm van het element afhangt: de
event-ring (dun/dubbel/dik per type, gestippeld bij niet-onderbrekend, soort-icoon erin; vult een
bewaarde maat zoals de EA-import die geeft), het gateway-symbool, het taaktype-icoon, de
⊞-markering van het subproces (uitgeklapt: naam linksboven via `Vak.tekstAnker`), data-object en
data store met de naam eronder, en de pool met de naam in een staande band (`Vak.rotatie`). De
lane en de samengestelde toestand zijn de bibliotheek-`kader` (nieuw: `vullingOpacity`); de
pseudotoestanden `cirkel`/`ruit`; alleen de historie (Ⓗ/Ⓗ*) is eigen. Sequence: punt (in
documenten onzichtbaar via `opacity: 0`, op het canvas bij hover of selectie via CSS op
`parameters.klasse: "dc-seq-punt"`), activatie en fragment (soort-chip, naam ernaast) tekenen op
het canvas via het sjabloon; de **levenslijn** heeft een ShapeType voor documenten en de server
(gestippelde lijn met de kop van 148 erbovenop, `maat`-hook houdt de node 14 breed), maar staat op
het canvas in `SjabloonShape.UITGEZONDERD`: de kop toont het type (instantieVan uit een ander
profiel), de activaties zijn afgeleid uit de berichten op het canvas en de lijn groeit mee met
haar laagste punt — canvas-kennis die de tekenaar niet heeft. Die drie zouden in een volgende
stap via `ctx.diagram` + de elementen kunnen (activaties uit berichten) en via een host-callback
(typenaam), zoals de diagramverwijzing.

**Stap 4 — deel 3, gebouwd 05-11 (OMNIUM-UI, `feat/tekenaar-profielvormen-3`).** De laatste 25:
CMMN (7, alle eigen renderers: mapvorm met vierkante tab, achthoek, task met soort-icoon en
markeringen, stadium, dubbele cirkel, dokje, sentry), SysML (poort; requirement op `rechthoek`),
component/deployment (kubus met kindervak), Eriksson-Penker (chevron, doel-ellips, resource met
groot icoon, gebeurtenisplaat), object (instantiedoos), requirements (eis op `rechthoek`) en
toegangsregel (9: kaft, regelkaart met gearceerde verbodsband via `clipPath`, badge, pijlblok,
cilinder, poort met soort-label, vergelijkingsstrook, vaandel, tag). Daarmee heeft **elke
profielvorm een ShapeType**; `getShape` tekent op het canvas alleen nog `diagramverwijzing` en
`seq-levenslijn`. Drie motoruitbreidingen waren nodig omdat deze vormen eigen inhoud dragen:
(1) **inhoudsregels** kunnen lopende tekst (afgebroken), chips (`soort: "badge"`), vaste breedte,
een scheidslijn en een gecentreerde regel zijn (eis: id/tekst/badges; SysML-requirement; policy;
voorwaarde; EP-resource) — de descriptor levert de regels, de motor tekent; (2) **`hooks.naamWeergave`**
(object "jan : Persoon [actief]", onderstreept via `parameters.naamOnderstreept`, slots via
`typePrefix`; voorwaarde met delen: geen naam); (3) de **host-callback** `tekenaar/host.js`:
de naam van een element in een ander profiel (`instantieVan`) vraagt de tekenaar aan de host; de
Studio registreert die in `elementVerwijzing.jsx`, de server geeft `null` → `klassifierLabel`.
Dat is het mechanisme waarmee ook de levenslijn-kop (typenaam) straks op het canvas via het
sjabloon kan. Twee descriptor-tweaks: SysML-requirement `stereotype: "«requirement»"` (stond
alleen in de shape), voorwaardepoort `naamLabel: "geen"`. Les: een vorm met een inspringend
inhoudsvak (icoon links, band, punt) hoort `factorW` op te geven, anders meet de motor de
natuurlijke breedte op de hele doos en loopt de naam in het icoon. Nog niet: de opruimstap
(oude `shapes.jsx` per profiel, `shapes/basisShapes.jsx`, `getShape`-route behalve de twee
uitzonderingen) en de levenslijn op het canvas.

**Lijnen — de tekenaar volgt het canvas (05-11, OMNIUM-UI, `feat/tekenaar-lijnen`).** Mark vroeg
of een lijn die je in de Studio via een omweg trekt of een andere vorm geeft, op de server net zo
rendert. De route (knikken, vorm, handles) kwam al uit dezelfde bron (`diagram.lijnen` +
`materialiseerConnectoren`), maar `tekenaar/lijnen.js` rekende de geometrie met een eigen "rand
tot rand"-regel uit diagramsvg: een rechte of gebogen lijn tussen twee schuin geplaatste dozen
liep op de server diagonaal van onderrand naar bovenrand, op het canvas verticaal langs de
dominante zijde (`aanhechtpunt`, inzet 8). Nu gebruikt `lijnen.js` dezelfde bouwstenen als
`ConnectorEdge.jsx`: `zwevendeUiteinden` (zelfde aanroep, inclusief de ingebakken
profiel-default `randAanhechting`, de 5 px / 12,5 px van de handle-stip, toppen, knikken, Z),
de React Flow-padfuncties uit `@xyflow/system` (bezier, smoothstep met radius 4, recht) en
spiegelingen van `lusPad`/`boomPad`/`knikPad`; markers en labelchips met de canvas-maten.
Bewijs: `naast-elkaar.mjs` legt per connector het `d`-pad uit de DOM naast dat uit de render-SVG
(`vergelijk-paden.py`): 65 lijnen in tien diagrammen gelijk op 0,5 px. Nog niet gelijk:
sequence-berichten (het canvas hecht aan de afgeleide activaties — hoort bij de levenslijn-stap).
Regel voortaan: wie `ConnectorEdge` aanpast, past `lijnen.js` mee aan, en andersom.

### 3.4 Server en documenten (RENDER-API, OMNIUM-UI)

- `render-svc` importeert de tekenaar; `taal=studio` krijgt daarmee vormtrouw. De route en het
  contract van stap 1 veranderen niet. Stap 1 staat sinds 04-11 (RENDER-API, `feat/render-taal-
  studio`, ongecommit): `diagramsvg/studio.js` roept `schets.js` op één plek aan
  (`renderStudioSvg`, daarna `werkAf` voor de SVG-eisen) — daar komt de tekenaar onder.
  Twee gevolgen voor de bouw: (1) **de bundel maakt van `.jsx` lege stubs**, dus
  ShapeRenderers en sjablonen horen in `.js` (bv. `diagramprofielen/<profiel>/vormen.js`
  naast de descriptor), nooit in `shapes.jsx`; (2) de sidecar kent profielen uit een vaste lijst
  (`render-svc/studioProfielen.js`) en geeft voor eigen profielen uit de ontwerper een 422 —
  stap 5 moet de descriptor uit de projectexport meenemen, anders tekent de server die niet.
- `documentContext.js` (`{{svg}}`) en `gedeeldeBeelden.js` roepen de tekenaar aan in plaats
  van `schetsDiagramSvg`. **De schets blijft** (besluit Mark 04-11, §5c): als lichte stand
  `detail=schets` van dezelfde tekenaar (7 families, geen compartiment-opmaak), naast de volle
  stand met renderers. De bestaande uitvoer van `schets.js` is de golden-test voor die stand.
- `diagramsvg` (V3): `v3ModelNaarEditor` levert al een editor-model; dat gaat door dezelfde
  tekenaar met de canoniek-uml-descriptor. Dan is er echt één tekenaar. Dit is de laatste stap,
  omdat Imprint nu op de byte-stabiliteit van de huidige V3-uitvoer leunt (BACKLOG §36).

## 4. Stappen en omvang

| # | Wie | Wat | Omvang | Afhankelijk van |
|---|---|---|---|---|
| 0 | M3-MOF | ShapeType (gegevens) en ShapeRenderer (contract) in `schema.js`, VormBoom-taglijst, `hooks.inhoudsregels`, rechtzetten "ShapeType = Implementatie"; Mark in de .qea | 1–2 dagen | keuzes §5 |
| 1 | RENDER-API | `POST …/svg?taal=studio` op de schets, bundeling, Imprint-eisen (**gebouwd 04-11**, `feat/render-taal-studio`, ongecommit; wacht op Mark) | 1–1,5 dag | — |
| 2 | OMNIUM-UI | tekenaar: maat, inhoud, lijnen, nesting, thema; de 14 basisvormen als ShapeType + renderer; schets als stand `detail=schets`; documenten en gedeelde plaatjes erop — **gebouwd 04-11** (`feat/tekenaar`: `diagramcore/tekenaar/`, terugval per vormfamilie voor vormen zonder ShapeType; de 35 diagrammen van het architectuurproject getekend met de echte profielen) | 1 week | 0 gemerged |
| 3 | OMNIUM-UI | canvas-adapter `SjabloonShape` + inline-editor en resizer op SVG — **gebouwd 05-11** (`feat/tekenaar-canvas`: alle basisvormen behalve `diagramverwijzing`; 1318 unit, 83 Studio-e2e groen; zie §3.3) | 3–4 dagen | 2 |
| 4 | OMNIUM-UI (parallel per profiel mogelijk) | 60 profielvormen omzetten naar sjablonen; per profiel e2e-screenshot vóór/na — **deel gebouwd 05-11** (`feat/tekenaar-profielvormen`: use case, activity, ArchiMate incl. beide shape-sets = 33 vormen; `feat/tekenaar-profielvormen-2`: BPMN, state machine, sequence = 20 vormen, levenslijn op het canvas nog oud; `feat/tekenaar-profielvormen-3`: CMMN, SysML, component/deployment, EP, object, requirements, toegangsregel = 25 vormen — **alle profielvormen zijn ShapeTypes**; rest: opruimen; zie §3.3) | ±½ dag per profiel, 1 week totaal | 3 |
| 5 | RENDER-API | render-svc op de tekenaar; `taal=v3` erachter; byte-vergelijking met de huidige fixtures | 2 dagen | 2, 4 |
| 6 | RENDER-API + BACKEND | `GET` op project/diagram met toegang (privacy-besluit) | 1–2 dagen | 5 |

Samen ongeveer drie weken OMNIUM-UI-werk, waarvan de laatste week mechanisch en te verdelen.
Dat is meer dan de "twee weken" van 03-11: de canvas-adapter (stap 3) zat daar niet in, en die
is nodig om het echt één view te maken in plaats van een tweede tekenaar naast het canvas.

## 5. Risico's en keuzes

- **Tekst meet anders.** Het canvas laat de browser nu afbreken; de tekenaar gebruikt de
  tekstmaat-tabel. Bestaande diagrammen met opgeslagen `node.size` verschuiven niet; vormen
  zonder maat kunnen een paar pixels anders uitvallen. Dat is de prijs van gelijkheid canvas ↔
  server, en al eerder aanvaard voor `diagramsvg`.
- **Sequence-diagrammen** (levenslijnen, activaties, berichten op volgorde) en **ArchiMate-
  iconen** zijn de lastigste vormen; die komen in stap 4 als laatste.
- **Thema.** `diagramcore.css` stijlt nu via klassen op HTML; in SVG gaat dat via
  `var(--diagram-*)` en klassen op `<g>`. Donker thema moet in stap 3 meteen mee.
- **Prestaties.** Een boom per node per hertekening is goedkoper dan de huidige div-bomen; de
  Zandbak (25.000 MIM-elementen) is de maat (meting in stap 3).
- **Beslist door Mark (04-11, via M3-MOF: "A ok, B ok, C blijft, D ja"):** (a) renderer-contract
  + bibliotheek nu, declaratief in de ontwerper later; (b) modulenaam `diagramcore/tekenaar/`;
  (c) **de schets blijft** als bewuste lichte stand (`detail=schets`) naast de volle tekening —
  `schets.js` vervalt dus niet in stap 2 maar wordt een stand van de tekenaar; (d) de
  splitsing ShapeType/ShapeRenderer zoals het EA-Metametamodel hem heeft.
- **Stap 0 gebouwd (M3-MOF, 04-11, `feat/m3-shapetype-contract`, ongecommit):**
  `diagramcore/types/shapeType.js` met `vorm()`, `VORMBOOM_TAGS`, `valideerVormBoom`,
  `valideerVak`, `valideerShapeType`, `valideerShapeRenderer`, `registreerShapeType`,
  `registreerRenderer`, `getShapeType`, `getRenderer`, **`tekenbareVorm(shapeId)`** (het
  schakelpunt van §3.3: `{shapeType, renderer}` of `null` = oude component; `null` zolang de
  renderer ontbreekt, want renderers registreren lui per profiel), `losStijlOp`, `minMaatVan`,
  `inhoudsregelsVan`; typedefs in `schema.js` (ShapeType, ShapeRenderer, ShapeContext,
  VormBoom, Vak, InhoudsRegel), `DiagramType.shapeTypes` (eigen vormen van een profiel, id-ruimte
  globaal zoals `registreerShape`), `hooks.inhoudsregels`; `typeRegistry.js` valideert en
  registreert `shapeTypes`. Keuzes van M3-MOF die OMNIUM-UI overneemt: `uitlijning` is
  verticaal ("boven"|"midden"), horizontaal bepaalt de inhoud-tekenaar; een deel van een
  InhoudsRegel draagt `veld` als sleutel voor inline bewerken (`data-dc-veld`); de
  VormBoom-validatie staat in `shapeType.js`, niet in `diagramsvg/validatie.js` (dat valideert
  V3-modellen).

## 6. Verwijzingen

- `docs/RENDER_API.md` — architectuur en Imprint-eisen; BACKLOG §36 (open punten render-API).
- `diagramcore/types/schema.js` — `ElementType.shape`, `DiagramType.shapeSets` (P07),
  vormgrammatica; `diagramcore/model/shapeSet.js`.
- `diagramcore/shapes/shapeRegistry.js`, `basisShapes.jsx`, `iconenVocabulaire.jsx`.
- `transformatie/sjabloon/schets.js` — de huidige schets (vervalt in stap 2).
- `docs/plans/2026-07-29 Overdracht Notaties` — "een nieuwe notatie is M2 plus adapter"; dit
  plan maakt dat ook voor de tekening waar.
