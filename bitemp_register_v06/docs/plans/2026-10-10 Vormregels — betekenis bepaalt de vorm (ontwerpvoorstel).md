# Vormregels — betekenis bepaalt de vorm (ontwerpvoorstel)

*2026-10-10. Aanleiding: Mark wil een lijnkleur, rand-dikte en lettergrootte, maar vooral **regels**:
"afgeleid = rood", "een klasse in een domein krijgt de kleur van dat domein", "enums en datatypes
kleiner", "tagged value *entiteit* geeft een dikke rand". Status: voorstel; besluiten van Mark (10-10) verwerkt in §7, nog niets gebouwd.*

## 1. Uitgangspunt

> Modellen zijn symbolen. De vorm heeft betekenis; het model is een taal. Geen PowerPoint.

Daaruit volgen drie ontwerpkeuzes:

1. **Vorm volgt uit het model, niet uit de hand.** Elke visuele variatie (kleur, dikte, grootte)
   is het gevolg van een **benoemde regel** op een modeleigenschap. Wie het diagram leest, kan
   altijd zien *waarom* iets rood is.
2. **Een kleine, vaste woordenschat.** Geen vrije hex-kleuren of pixelmaten, maar een
   **palet van benoemde tokens** en **stappen** (dun/normaal/dik, klein/normaal/groot). Dat is
   ook precies wat licht/donker oplost: een token heeft per thema een eigen waarde.
3. **Generiek in de motor, inhoud in profiel en project.** De motor kent "regel", "voorwaarde",
   "effect" en "token" (M3). Welke regels gelden, is notatie (M2, profiel) of huisstijl
   (M1, project). Geen profielspecifieke code (zie ook de aanhechting op toppen, 10-10).

## 2. Wat er nu al is

| Onderwerp | Stand | Bron |
|---|---|---|
| Vormgrammatica (M3) | `randDikte`, `hoekRadius`, `randStijl` op ElementType, maar alleen gelezen door class-box; `entiteit` krijgt hard-gecodeerd dikte 3 | `types/schema.js:132-135`, `basisShapes.jsx:153` |
| Gedaante (shape-set) | per diagram; ruilt shape/icoon/kleur **per elementtype**, niet op basis van data | `model/shapeSet.js` |
| Data → presentatie | alleen `hooks.edgePresentatie` (functies, catalogus in profielGereedschap) | `materialiseerConnectoren.js:282` |
| Vulkleur | `data.kleur` → `elementType.kleur` → token; EA-import zet `data.kleur` | `basisShapes.jsx`, `qeaKern.js:155` |
| Lijnkleur per connector | **bestaat niet** | — |
| Lettergrootte | **bestaat niet**; overal vaste px | `basisShapes.jsx` |
| Afgeleid | canoniek: `afgeleid` op attribuut, getoond als oranje "/"; MIM `indicatieAfleidbaar` toont niets; relaties hebben geen afgeleid-vlag | `canoniek-uml/index.js:42`, `mim12/index.js:68` |
| Domein | V3 `domein` → package `pkg_<slug>` + bevat (alleen canoniek); Studio-**mappen** zijn profieloverstijgend en hebben al een `kleur` (alleen het bolletje in de boom) | `canoniek-uml/adapter.js:331`, `structuurKern.js:57` |
| Stereotype / tags | `data.stereotype(n)`, `data.tags` (EA-import); geen presentatie hangt eraan | `qeaKern.js:195` |
| Donker thema | lijnen/randen via tokens; nodes houden bewust hun lichte pastel ("lichte kaarten op donker canvas") | `diagramcore.css:12-17` |
| **Render-API (diagramsvg)** | derde tekenaar: V3 → pure, byte-gelijke SVG voor Imprint; themacontract `var(--diagram-<token>, licht)`; entiteit erft al `domeinen[].kleur` (hex) | `diagramsvg/thema.js`, `docs/RENDER_API.md` |

## 3. Voorstel in vier lagen

### 3.1 Tokens: een themavast palet

Alle kleuren en maten die een regel mag gebruiken, zijn **tokens**. Het model bewaart de
**naam**, nooit de hex-waarde. Elk token heeft een lichte en een donkere waarde in
`diagramcore.css` (zoals de `--dc-lijn-slate-*` van vandaag).

| Familie | Tokens | Gebruik |
|---|---|---|
| **Accent** (lijn, rand, tekstaccent) | rood, oranje, oker, groen, blauw, paars, grijs | afgeleid, waarschuwing, nadruk |
| **Vlak** (vulling, het domeinpalet) | roze, oker, groenblauw, azuur, lichtgrijs, zand/bruin, lavendel, lichtblauw, grijsblauw, mint, perzik, olijf (12) | domeinkleuren, categorieën |
| **Dikte** | dun (1), normaal (1,5), dik (3) | rand en lijn |
| **Letter** | klein (85%), normaal, groot (115%) | naam en velden samen |
| **Lijnstijl** | doorgetrokken, gestreept, gestippeld | bestaat al |

De **vlaktinten** zijn tussenkleuren die onderling goed te onderscheiden zijn, ook voor
kleurenblinden. Dat toetsen we met een kleine validator (ΔE tussen elk paar, in licht én donker).
**Donker (besluit Mark 10-10, als proef):** vlaktokens worden in donker een *donkere* tint van
dezelfde kleur met **lichte tekst**, in plaats van de lichte kaarten van besluit 2026-07-05. We
bouwen het zo dat beide varianten één tokentabel zijn, zodat we na het proberen kunnen kiezen.

**Accent "rood" is een zacht rood** (besluit 10-10): helder en iets donker, niet fel. Gemeten
contrast (WCAG) van de lijnkleur op het canvas:

| Kleur | Licht, op wit | Donker, op `#1b1b1f` |
|---|---|---|
| fel rood `#dc2626` / `#f87171` | 4,8 : 1 | 6,2 : 1 |
| **zacht rood `#b84a55` / `#e98a92`** (voorstel) | **5,1 : 1** | **7,0 : 1** |
| huidig oranje "/" `#f59e0b` | 2,1 : 1 (valt weg) | 8,0 : 1 |
| gewone lijn (slate-600) | 7,6 : 1 | 10,7 : 1 |

Een andere lijnvorm (gestreept, gestippeld) voor afgeleid kan, maar die vormen zijn al in gebruik
voor realisatie en dependency. Kleur is nog vrij; daarom kleur.

### 3.2 Vormregels: wanneer → dan

Een vormregel is **declaratief en serialiseerbaar**, zonder functies, volgens de regel in
`schema.js` ("geen functies in nieuwe declaratieve velden"):

```json
{
  "id": "afgeleid-rood",
  "naam": "Afgeleid is rood",
  "geldtVoor": "connector",
  "wanneer": { "betekenis": "afgeleid" },
  "dan": { "lijn": { "kleur": "rood" } },
  "toelichting": "Afgeleide relaties zijn berekend, niet vastgelegd."
}
```

**Voorwaarden** (een kleine taal, uitbreidbaar):

| Voorwaarde | Voorbeeld | Betekenis |
|---|---|---|
| `type` | `["enumeratie", "gegevenstype"]` | elementtype-id(s), ook via `erft` |
| `veld` + `is` | `afgeleid` is `true` | een eigenschap uit `element.data` |
| `betekenis` | `afgeleid` | een eigenschap met die **betekenis** (M3 `PropertyType.betekenis`, M3-MOF 10-10), ongeacht de sleutelnaam: MIM `indicatieAfleidbaar` telt dan vanzelf mee. Beslist via `diagramcore/model/afgeleid.js` → `isAfgeleid(data, type)` |
| `stereotype` | `entiteit` | `data.stereotype(n)` of het type-stereotype |
| `tag` (+ `waarde`) | `entiteit` | tagged value (`data.tags`, EA-import) |
| `inDomein` | `true` | het element ligt in een domein (zie 3.3) |
| `alle` / `eenVan` | combinaties | en/of |

**Effecten**, alleen tokens:

| Effect | Op | Voorbeeld |
|---|---|---|
| `rand` | element | `{ kleur: "rood", dikte: "dik", stijl: "gestreept" }` |
| `vlak` | element | `"azuur"` of `"domein"` (de kleur van zijn domein) |
| `letter` | element | `"klein"` |
| `lijn` | connector | `{ kleur: "rood", dikte: "dik" }` |
| `tekst` | veld (attribuut) | `{ kleur: "rood" }` |

Effecten worden **samengevoegd per eigenschap**. Bij botsing wint de specifiekste laag
(zie 3.4), en binnen een laag de laatste regel.

### 3.3 Domein als profieloverstijgende map

V3 kent domeinen al, mét een kleur (`domeinen[].kleur`), en de render-API past de erfregel al
toe: kleur op de entiteit, anders die van het domein, anders de standaard. Die regel zit nu
ad hoc in `diagramsvg`; dit voorstel maakt hem een gewone vormregel, voor alle tekenaars.

Een domein is in de IDE en in V3 *first class* en profieloverstijgend: klassen, use cases, AD's
en BPMN horen erbij. Het metamodel kent het niet, maar de Studio heeft al iets dat precies zo
werkt: **mappen**. Een map bevat elementen en diagrammen van elk profiel, en heeft zelfs al een
`kleur`.

Voorstel:

- **Patroon (besluit 10-10): in UML-klassediagram, MIM en canoniek erven de klassen de
  domeinkleur** (UML klasse, MIM objecttype en gegevensgroeptype, canoniek entiteit en
  representatie). Andere profielen doen niet mee tenzij hun descriptor dat zegt.
- **Een map kan "domein" zijn.** Dat wordt een vinkje in de eigenschappen van de map, met een
  **vlaktoken** uit het domeinpalet.
- **Lidmaatschap** volgt de plaatsing: een element hoort bij het dichtstbijzijnde domein boven de
  map waarin het staat. Submappen van een domein erven dus mee.
- **Wie de kleur erft, is een eigenschap van het elementtype**, generiek in M3:
  `erftDomeinkleur: true`. Standaard staat dit aan voor klasse-achtigen (entiteit, objecttype,
  klasse, gegevensgroep). Use cases en BPMN doen niet mee, tenzij een profiel dat zet.
- **De regel zelf** is gewoon een vormregel: `wanneer: { inDomein: true }`,
  `dan: { vlak: "domein" }`, met `geldtVoor` op de typen met `erftDomeinkleur`.
- **V3-import** maakt per V3-domein een map aan, met de V3-domeinkleur, en plaatst de elementen
  daarin. Het package blijft bestaan voor de terugreis naar V3. Een V3-kleur is een vrije hex;
  die blijft toegestaan voor domeinen (zie 3.1), met een automatisch gedempte donkere variant.
  In de Studio kies je bij voorkeur een token uit het palet.

### 3.4 Waar regels wonen, en de volgorde

| Laag | Wat | Voorbeelden | Wie beheert |
|---|---|---|---|
| 1. Elementtype (M2) | het basisuiterlijk | shape, standaardkleur | profiel |
| 2. Gedaante | andere vorm per diagram | "Blokken (informeel)" | profiel |
| 3. **Notatieregels** (M2) | regels die bij de taal horen | canoniek: datatype/enum klein; entiteit dik; MIM: `indicatieAfleidbaar` telt als afgeleid | profiel (`descriptor.vormregels`) |
| 4. **Huisstijl** (M1) | afspraken van dit project | afgeleid = rood; domeinkleuren | project, via de Studio |
| 5. Handmatige afwijking | uitzondering, of een kleur uit EA | `data.kleur` | per element |

De huisstijl van het project wordt gedeeld via projectsync, net als mappen.

**Handmatig mag overrulen** (besluit 10-10). De inspector toont dan "wijkt af van regel
*Domeinkleur*" met een knop **Terug naar standaard**, die de handmatige waarde wist zodat de
regel weer geldt. Hetzelfde kan voor een selectie van meerdere elementen tegelijk (handig na een
EA-import met eigen kleuren).

## 4. Hoe het in de motor landt

- **Eén pure functie** `pasVormregelsToe(element, context) → stijl` in `diagramcore/model`.
  De context bevat het type, de profielregels, de huisstijl en het domein. De functie is
  node-testbaar en wordt gedeeld door canvas, minimap en documentexport (`schets.js`). Zo volgen
  gegenereerde documenten dezelfde taal.
- **Canvas:** de uitkomst gaat als CSS-variabelen op de node: `--dc-rand-kleur`,
  `--dc-rand-dikte`, `--dc-vlak` en `--dc-letterschaal`. De shapes lezen die één keer
  (`basisShapes`, `dataShape`, profielvormen), en de hard-gecodeerde `entiteit → 3` verdwijnt
  naar een notatieregel van canoniek. Connectoren krijgen het via de presentatie, zoals
  `edgePresentatie` nu.
- **Uitleg in de inspector:** "Vorm: rand rood (regel *Afgeleid is rood*), vlak azuur (domein
  *Zaken*)".
- **Legenda:** omdat vorm betekenis heeft, kan een diagram een **legenda** tonen die automatisch
  volgt uit de regels die erin voorkomen. Dat is ook een optie bij de documentexport.
- **Regelbewerker:** een formulier, geen vrije CSS. De voorwaarden kies je uit wat het profiel
  kent (booleaanse velden, enums, tags, typen). Effecten kies je uit het palet.

## 5. Drie tekenaars, één regelset

Omnium tekent op drie plekken, en alle drie moeten dezelfde taal spreken:

| Tekenaar | Invoer | Thema | Waar |
|---|---|---|---|
| Canvas (Studio) | Studio-stores | CSS-variabelen, licht/donker | `diagramcore/canvas` |
| Schets (documenten) | Studio-stores | vaste kleuren in de SVG | `transformatie/sjabloon/schets.js` |
| **Render-API** (Imprint) | V3-model | contract `var(--diagram-<token>, licht)`, of vast bij `theme=light/dark` | `diagramsvg`, `render-svc` |

Gevolgen voor het ontwerp:

- **Tokens en regels zijn pure JS zonder afhankelijkheden.** `vormTokens.js` (licht en donker per
  token) en `vormregels.js` (`pasVormregelsToe`) moeten in de render-sidecar draaien: Node, geen
  React, geen CSS. De CSS-variabelen van het canvas worden uit dezelfde tokentabel gezet, niet
  dubbel in `diagramcore.css` bijgehouden.
- **Thema in de render-API.** Accent- en diktetokens volgen het bestaande contract: bij
  `theme=auto` als `var(--diagram-accent-rood, <licht>)`, bij `light`/`dark` vast. Dat is
  **additief**: bestaande tokens en uitvoer veranderen niet, Imprint kan de nieuwe variabelen
  later aan de site koppelen. Vlakkleuren blijven, zoals het contract nu voorschrijft, letterlijk
  in de SVG, met tekst op contrast (`tekstOp`).
- **Waar haalt de render-API de regels vandaan?**
  - De **notatieregels** horen bij de taal en zitten in de tekenaar zelf (V3 = canoniek).
  - De **huisstijl** van het project komt mee in de Studio-envelop van het model, of als nieuwe
    request-parameter `vormregels` (gevalideerd; onbekende velden geven een 400, zoals nu).
  - Beide tellen mee in de **ETag**, want ze bepalen de uitvoer.
- **Determinisme.** Regels zijn data, de volgorde ligt vast en de functie is puur. Dezelfde invoer
  blijft byte-gelijke SVG geven; een fixture-test in `diagramsvg.test.js` bewaakt dat.
- **De bestaande erfregel** (entiteit → domeinkleur) in `diagramsvg` wordt de eerste notatieregel
  die via `pasVormregelsToe` loopt. De uitvoer blijft gelijk; dat is de regressietest.
- **`docs/RENDER_API.md`** krijgt een paragraaf "Vormregels" met de nieuwe tokens en de parameter.

### 5.1 Imprint: dag en nacht met twee renders (besluit Mark, 10-10)

Wat Imprint nu met kleur doet (Imprint-engine, `viewers.tsx`, `schemas.ts`, `omnium.ts`):

- De SVG staat **inline** in de pagina. Per widget is er één optie, `kleuren: licht | site`.
- Bij `site` koppelt Imprint de vijf `--diagram-*`-tokens aan de sitetokens: surface →
  `--color-surface`, border → `--color-line`, text → `--color-foreground`, muted («use»- en
  notitielijnen) → `--color-muted`, accent (relatielijnen, associatie-anker) → `--color-accent`.
- Imprint vraagt altijd `theme=auto` op en stuurt geen kleurparameters. Elementvullingen staan
  letterlijk in de SVG; tekst op een element kiest Omnium op contrast (afspraak 29-09).

Die vijf tokens dekken alleen de *standaard*kleuren. Een regelkleur (afgeleid-rood als lijn en
als tekst) of een domeintint wisselt daarmee niet mee tussen dag en nacht.

**Oplossing: Imprint vraagt twee SVG's op**, `theme=light` en `theme=dark`, en toont per
sitethema de juiste (`data-theme`; de andere `display: none`, zodat schermlezers één diagram
zien). Omnium rekent dan alles per thema uit: domeintinten, regelkleuren (lijn- en
tekstvariant), tekst op elementen. Gevolgen:

- **Geen nieuwe tokens in het Imprint-contract**, en de afspraak van 29-09 blijft staan.
- Aan Omnium-kant bestaat `theme=light/dark` al; die gaan de tokentabel uit §3.1 gebruiken.
- Twee SVG's op één pagina botsen niet: de standaard-`idPrefix` is een hash van de invoer,
  inclusief het thema.
- Kosten: twee keer de bytes; met de ETag cachen beide.

**Drie kleurmodi in Imprint:**

| Imprint `kleuren` | Opvragen | Voor |
|---|---|---|
| `licht` (standaard) | `theme=auto`, geen variabelen gezet | een lichte figuur, ook op een donkere site |
| **`dag-nacht`** (nieuw) | `theme=light` én `theme=dark` | modellen onder een kleurregime (domeinen, regels) |
| `site` | `theme=auto` + de vijf variabelen | modellen zonder kleurregime: het "kleursausje" van de site |

In `dag-nacht` staan **alle** kleuren vast per thema, ook de vijf `--diagram-*`-tokens: het
accent (relatielijnen) is dan overdag `#7c3aed` en 's nachts `#a78bfa`, niet het siteaccent. Dat
is bedoeld (Mark, 10-10): onder een kleurregime bepaalt het model de kleur, de site kiest alleen
dag of nacht.

**Opdracht voor Imprint** (klein): optie `dag-nacht` in `schemas.ts`/de editor, twee keer
`renderOmnium` in `omnium.ts`, en in `viewers.tsx` beide inline plaatsen met zichtbaarheid op
`data-theme`.

## 6. Gefaseerd bouwen

| Fase | Inhoud | Levert op |
|---|---|---|
| 1 | `vormTokens.js` (accent, vlak, dikte, letter; licht/donker) als enige bron; CSS-variabelen in de shapes; **lijnkleur en -dikte per connector** als token (inspector) | lijnkleur, rand-dikte en lettergrootte, al bruikbaar met de hand |
| 2 | `pasVormregelsToe` + notatieregels in de descriptor + huisstijl in het project; uitleg in de inspector; **diagramsvg** en schets gebruiken dezelfde functie | afgeleid = rood; datatype/enum klein; tag *entiteit* = dik — in Studio, documenten én Imprint |
| 3 | Domein-map, `erftDomeinkleur`, V3-import naar mappen | domeinkleuren, profieloverstijgend |
| 4 | Legenda (canvas, documenten, render-API als optie `legenda`); render-API-parameter `vormregels` en de nieuwe `--diagram-*`-tokens in `RENDER_API.md`, afgestemd met Imprint | het model leest als taal, ook op papier en op de site |

## 7. Besluiten en open vragen

**Besluiten (Mark, 10-10):**

1. **Relaties kunnen afgeleid zijn** in UML, MIM en canoniek: een `afgeleid`-vlag op de
   relatietypen (UML: `/` voor de naam). MIM's `indicatieAfleidbaar` telt als afgeleid.
2. **Domeinkleur erven** geldt voor klassen in UML-klassediagram, MIM en canoniek.
3. **Handmatig mag overrulen**, met *Terug naar standaard*.
4. **Donker:** donkere vlakken met lichte tekst proberen; de tokentabel houdt de keuze open.
5. **Afgeleid is een regel, dus instelbaar.** Standaard: het zachte rood, voor afgeleide
   relaties én afgeleide attributen, dezelfde kleur. Het oranje verdwijnt. Bij een attribuut
   kleurt de **hele attribuutnaam** mee, inclusief de "/" (Mark, 10-10); het type blijft
   gedempt grijs.

   Tekst staat op de vulling van de klasse, niet op het canvas, en heeft daar minder contrast.
   Een accenttoken heeft daarom een **lijn-** en een **tekstvariant** van dezelfde tint:

   | Vulling | lijnvariant `#b84a55` | tekstvariant `#a63d48` |
   |---|---|---|
   | lichtblauw `#bfdbfe` (entiteit, screenshot) | 3,6 : 1 | 4,4 : 1 |
   | blauw `#dbeafe` | 4,1 : 1 | 5,1 : 1 |
   | geel `#fef3c7` | 4,5 : 1 | 5,6 : 1 |
   | grijs `#f1f5f9` | 4,6 : 1 | 5,7 : 1 |

   In donker (donkere vlakken, lichte tekst) wordt de tekstvariant een lichte roze tint; de
   validator uit 3.1 toetst beide.

**Nog af te stemmen:**

6. ~~Render-API: huisstijl via envelop of parameter?~~ **Besloten (10-10):** het kleurregime
   (domeinen, huisstijl) reist mee met het model; dag en nacht via twee renders (§5.1); het
   sitesausje blijft de bestaande `theme=auto`. Geen nieuwe `--diagram-*`-tokens nodig.

**Oorspronkelijke vragen (beantwoord):**

1. **Afgeleide relaties:** canoniek, MIM en UML hebben geen afgeleid-vlag op relaties, alleen op
   attributen. Zal ik `afgeleid` toevoegen aan de relatietypen (canoniek: `/` voor de naam, zoals
   UML)?
2. **Domein = map:** past dat bij je beeld? En welke typen erven de domeinkleur: alleen klassen
   en entiteiten, of ook gegevenstypen en enums?
3. **Handmatige kleur tegenover regel:** wie wint (zie 3.4)?
4. **Donker:** gedempte lichte kaarten, of donkere getinte vlakken met lichte tekst?
5. **Afgeleid-"/":** moet die ook rood worden via dezelfde regel, of blijft het oranje teken een
   vaste notatie?
6. **Render-API:** huisstijl via de envelop van het model, via een request-parameter, of allebei?
   En moeten we de nieuwe tokens eerst met Imprint afstemmen voordat fase 2 live gaat?
