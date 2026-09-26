# Invoersoort en vorm — ontwerp

> Status: **voorstel + eerste implementatie** (branch `feat/invoer-vorm`, 26 september 2026).
> Gebouwd: de begrippen, de vormen-registry, de vorm `image-map` (klikbare afbeelding) op
> veld en lijst, de vorm `rating-grid` (matrix, §7b), de vorm `button-group` (knoppenvlak, §7c), en de round-trip door de Studio. Nog niet: de Studio-inspector voor
> `vorm`/`vormConfig` (zie §9).
> Naslag van de layout zelf: `docs/FORMULIERDEFINITIES.md`.

## 1. Aanleiding

De FormulierDefinitie kreeg een eigenschap `widget` (`radio`, `textarea`, `meerkeuze`, …).
Twee problemen:

1. **Inhoud en vorm lopen door elkaar.** `meerkeuze` op een lijst zegt *wat* er ingevoerd
   wordt (meer waarden uit een lijst). `radio` zegt *hoe* dat eruitziet. Voor nieuwe
   vormen, zoals klikbare gebieden op een afbeelding, moet dat onderscheid scherp zijn.
   Onder water is zo'n afbeelding gewoon "één of meer uit een lijst".
2. **"Widget" botst met Imprint.** Daar is een widget een inhoudsblok op een pagina
   (`{ type, config }`: `text`, `callout`, `code`, …), geen invoercomponent.

Het principe geldt voor alle projecten (Omnium, Imprint): **een vorm verandert nooit de
data.** Wisselen van vinkjes naar een klikbare afbeelding levert dezelfde rijen op, en
het model verandert daar niet door.

## 2. Begrippen

| Begrip | Betekenis | Wie bepaalt het | XForms |
|---|---|---|---|
| **invoersoort** (inhoud) | wát er ingevoerd wordt: tekst, getal, datum, ja/nee, één uit een lijst, meer uit een lijst | het **model** (datatype, enum, referentielijst, meervoudig GE/relatie) | de abstracte control: `input`, `select1`, `select`, … |
| **vorm** | hoe de invoer eruitziet en zich gedraagt | de **formulierontwerper** (`vorm` in de layout) | `appearance` |
| **vormConfig** | wat een vorm extra nodig heeft (bv. de afbeelding en de gebieden) | de formulierontwerper | — |

**Waarom deze namen.** XForms (W3C) scheidt dit al sinds 2003: `select1` = één uit een
lijst, `select` = één of meer, en het attribuut `appearance` (`minimal`, `compact`,
`full` of een eigen waarde) bepaalt de vorm. *Vorm* is de Nederlandse tegenhanger
(*verschijningsvorm*) en sluit aan op "inhoud en vorm". Deze namen zijn afgevallen:

- *weergave*: al bezet door de WeergaveDefinitie en door `weergave` op een V3-datatype;
- *widget*: in Imprint een paginablok;
- *control*, *component*: zeggen niet of het om inhoud of vorm gaat.

NL Design System noemt het invulgedeelte een **invoerveld** (in een *Form Field*). Dat is
bij ons het `veld` in de layout. NLDS biedt vooral standaard HTML-vormen; wij willen
daarnaast rijkere vormen, met dezelfde toegankelijkheidsregels (label,
beschrijving, foutmelding, toetsenbord).

## 3. Invoersoorten

De invoersoort volgt uit het model. De ontwerper vult hem niet in
(`invoersoortVanVeld` in `web/vite/src/vormen/vormen.js`):

| Invoersoort | Uit het model | XForms |
|---|---|---|
| `tekst` | string | `input` / `textarea` |
| `getal` | integer / number | `input` |
| `datum` | format `date` / `date-time` | `input` |
| `ja-nee` | boolean | `select1` |
| `een-uit-lijst` | enum, referentielijst (`ref`), relatie naar een entiteit (`doelEntiteit`) | `select1` |
| `meer-uit-lijst` | een `lijst` met een vorm (of het oude `widget: "meerkeuze"`) over een meervoudig GE / relatie, met één keuzeveld | `select` |
| `een-uit-lijst-per-rij` | een `lijst` met vorm `rating-grid`: vaste rijen (waarden van het rijveld) met per rij één uit een lijst | `repeat` + `select1` |

`meer-uit-lijst` wordt opgeslagen als **rijen**: één rij per keuze, met de vaste waarden
van de lijst. Dat is hetzelfde als nu. XForms bewaart een `select` als een lijst
waarden, gescheiden door spaties. Bij ons is elke keuze een eigen rij met eigen
geldigheid. Dat is een bewuste afwijking die past bij het bitemporele model.

## 4. Vormen — een gedeelde woordenlijst

De vormnamen zijn **dezelfde in Omnium en Imprint**. Ze zijn Engels in kebab-case en
ontleend aan NL Design System, ARIA en HTML. Labels in de UI zijn Nederlands.

| Vorm | Label | Bedient | XForms-appearance | Status in Omnium |
|---|---|---|---|---|
| `text-input` | Invoerveld | tekst, getal, datum | — | bestaand (standaard) |
| `text-area` | Tekstvak | tekst | — | bestaand (was `textarea`) |
| `json`, `markdown` | code-editor | tekst | eigen | bestaand |
| `select` | Keuzelijst | één uit lijst, ja/nee | `minimal` | bestaand (standaard voor enum) |
| `radio-group` | Keuzerondjes | één uit lijst, ja/nee | `full` | bestaand (was `radio`) |
| `checkbox-group` | Vinkjes | meer uit lijst | `full` | bestaand (standaard voor enum-meerkeuze) |
| `combobox` | Zoeken en kiezen | één én meer uit lijst | `minimal` + zoeken | bestaand voor referentielijsten (`RefCombobox`, `RefMeerkeuze`) |
| `image-map` | Klikbare afbeelding | één én meer uit lijst | eigen | **nieuw** |
| `rating-grid` | Matrix | één uit lijst per rij | `repeat` + `full` | **nieuw** (§7b) |
| `button-group` | Knoppenvlak | één én meer uit lijst | eigen | **nieuw** (§7c) |

### 4.1 Kandidaten (brainstorm 26 september 2026)

| Vorm | Bedient | Idee van | Opmerking |
|---|---|---|---|
| `switch` | ja-nee | Mark | schuifschakelaar zoals op de MusicBrain-modules |
| `rotary` | getal, één uit een **geordende** lijst | Mark | draaiknop met klikstanden; aanslagen = min/max of de eerste/laatste optie |
| `range` | getal, één uit een geordende lijst | Mark | schuif voor een schaal (1–4, 1–10), eventueel met kleurverloop per stap (`vormConfig.kleuren`); past direct op het enum `Schaal` |
| `address-search` | een **groep** velden (straat, huisnummer, postcode, plaats) | Mark | één zoekveld dat via een adresdienst (PDOK Locatieserver/BAG) meerdere velden vult; eventueel ook het BAG-id bewaren |
| `ai-assist` | tekst | Mark | tekstvak met een assistent die voorstelt (herschrijven, inkorten, aanvullen); de invuller beslist altijd zelf |
| `rating-grid` | een groep **vaste rijen** met dezelfde schaal | Claude | **gebouwd** (§7b): vragen als rijen, de schaal als kolommen, zoals de drie bijdragen van FD 2 |
| `map` | één of meer uit een lijst, locatie | Claude | gebieden op een echte kaart (GeoJSON, zoals Imprints `map`-widget): gemeenten kiezen op de kaart, direct op `initiatief_gemeenten` |
| `ranking` | **volgorde** uit een lijst | Claude | slepen om te ordenen (prioriteiten); nieuwe invoersoort, opgeslagen als rijen met een volgnummer |
| `cards` | één of meer uit een lijst | Claude | keuzekaarten met icoon, titel en uitleg (producttype met toelichting) |
| `period` | een groep van twee datums | Claude | begin en einde als één balk op een tijdlijn; past bij aanvang/einde en materiële geldigheid |
| `button-group` | één of meer uit een lijst | Mark | **gebouwd** (§7c): knoppenvlak zoals de akkoordknoppen van een accordeon; API-standaarden |
| `stepper`, `file-drop` | getal, bestand | Claude | +/−, sleepvak |
| `ai-extract` | het hele **formulier** | Claude | plak een tekst of URL; de AI vult velden voor, de invuller controleert en verzendt |

### 4.2 Wat de brainstorm zegt over het model

1. **Drie assen, niet twee.** Naast *invoersoort* en *vorm* is er de **keuzebron**:
   enum, referentielijst, entiteit, of een **externe dienst** (adressen, kaartgebieden, AI).
   Dat is precies de scheiding in downshift: `items` wordt aangeleverd, de hook weet niet
   waar ze vandaan komen. Een vorm vraagt dus niet zelf de opties op, maar krijgt ze.
2. **Sommige vormen overspannen meerdere velden:** adres, periode, matrix en AI-extractie.
   `vorm` moet daarom ook op een `groep` kunnen (op een `lijst` kan het al), met in
   `vormConfig` welk resultaat naar welk veld gaat, net als `kopieerNaar`.
3. **Geordend is een eigenschap van de inhoud.** Een schuif of draaiknop op een enum
   vraagt een geordende lijst. De volgorde van V3-enumwaarden is al vast; een vlag
   `geordend` op het enum maakt dit expliciet, zodat een schuif niet op `Organisatietype`
   belandt.
4. **Opslag is de laag ónder de inhoud.** Mark (26-09): de CG-laag van een product is
   eigenlijk *meer uit een lijst*, maar het model kent één veld `CG_laag`. De inhoud is
   meer-uit-lijst; wat verschilt is hoe het wordt **opgeslagen**:

   | Opslag | Voorbeeld | Status |
   |---|---|---|
   | rijen van een meervoudig GE / relatie | `bijdragen`, `initiatief_api_standaarden` | bestaat |
   | één veld met scheidingsteken | `CG_laag = "Laag 1;Laag 2"` | **gebouwd** (§7d) |
   | hermodelleren naar een eigen entiteit/GE | `Initiatief.lagen[]` | "de nette oplossing", later |

   Dit hoort bij het **model** (het datatype van het veld), niet bij het formulier: elke view,
   filter en export moet weten dat `CG_lagen` een lijst is. Een datatype dat zegt "lijst van
   enum-waarden, gescheiden door `;`" laat `invoersoortVanVeld` vanzelf *meer uit een lijst*
   opleveren, en daarmee elke meer-uit-lijst-vorm (image-map, knoppen). XForms doet het ook zo:
   de waarde van een `select` is één knoop met spatie-gescheiden tokens. Het alternatief, het
   enum uitbreiden met `Laag 1+2` en `Laag 4+5`, is sneller, maar maakt van een combinatie een
   categorie. Gekozen (Mark, 26-09): de `;`-variant, met een datatype (§7d).
5. **AI stelt voor, de mens beslist.** Voor `ai-assist` en `ai-extract` gaat de aanroep via de
   server (sleutel, rate-limit, logging). Op een **openbaar** formulier is het versturen van
   ingevulde tekst naar een AI-dienst een gegevensverwerking (AVG): het moet opt-in zijn, of
   het draait lokaal of op eigen infrastructuur.

**Een vorm geeft aan welke invoersoorten hij bedient** (`VORMEN[naam].invoersoorten`).
Past een gekozen vorm niet bij de inhoud, dan valt de renderer terug op de
standaardvorm. Een foute layout breekt het formulier dus niet
(`effectieveVorm`).

## 5. In de layout

```json
{ "type": "veld", "veld": "Reservering.ruimtes.ruimte", "vorm": "image-map",
  "vormConfig": { "image": "/media/plattegrond.svg", "alt": "Plattegrond begane grond",
                  "areas": [ { "value": "zaal-a", "label": "Zaal A", "shape": "rect", "coords": [0.05, 0.1, 0.35, 0.5] },
                             { "value": "hal", "shape": "circle", "coords": [0.5, 0.75, 0.08] } ] } }
```

```json
{ "type": "lijst", "bron": "Initiatief.initiatief_gemeenten", "label": "Gemeenten die realiseren",
  "vorm": "image-map", "vormConfig": { "image": "/media/gemeenten-utrecht.svg", "units": "px", "width": 800, "height": 600,
                                        "areas": [ { "value": "344", "shape": "poly", "coords": [120,80, 180,70, 200,140, 130,150] } ] },
  "elementen": [ { "type": "veld", "veld": "rol", "vasteWaarde": "Realiseert" },
                 { "type": "veld", "veld": "gemeente_id" } ] }
```

- `vorm` en `vormConfig` mogen op een **veld** (één uit een lijst) en op een **lijst**
  (meer uit een lijst). Een lijst met een `vorm` is een meer-uit-lijst. Een lijst zonder
  vorm is een lijst met rijen (blokken), zoals nu.
- **Oude schrijfwijze blijft werken.** `widget: "radio"` wordt `radio-group`,
  `widget: "textarea"` wordt `text-area`, `widget: "meerkeuze"` op een lijst wordt een
  meer-uit-lijst met de standaardvorm (`checkbox-group` voor een enum, `combobox` voor
  een referentielijst). `vorm` wint van `widget`.
- **Migratie** (nog niet gedaan): de replays 16, 17 en 19 (FD 2) kunnen later van `widget`
  naar `vorm` via een nieuwe replay. Nodig is dat niet, omdat de aliassen blijven.

## 6. Imprint

- Sleutel: **`appearance`** (Imprint is Engelstalig), met **dezelfde waarden** en
  **dezelfde `vormConfig`** (in Imprint `appearanceConfig`). Die config is daarom
  bewust Engels (`image`, `areas`, `shape`, `coords`), anders dan de rest van de
  Omnium-layout.
- In JSON Schema (Imprints `SchemaForm`, `/api/meta`): als annotatie `"x-appearance"`
  (+ `"x-appearance-config"`). Nu kiest `SchemaForm` de vorm op veldnaam
  (`MARKDOWN_KEYS`); dat wordt: eerst `x-appearance`, dan de veldnaam.
- Een V3-datatype houdt `weergave.widget` als *standaardvorm* voor dat datatype. De
  waarde wordt genormaliseerd met dezelfde aliastabel.
- De bestanden in `web/vite/src/vormen/` hangen niet van Omnium af: geen SchemaContext,
  geen fetch, alleen React en CSS-variabelen met een terugvalwaarde. Ze kunnen zo naar een
  gedeeld package (zie het plan in Imprints `docs/design/nl-design-system.md`: de
  renderer als package met aangereikte schema-, validatie- en optiebron).

## 7. De vorm `image-map` (klikbare afbeelding)

### 7.1 vormConfig — volgt HTML `<map>`/`<area>`

| Sleutel | Betekenis |
|---|---|
| `image` | URL of pad van de afbeelding (SVG, PNG, …) |
| `alt` | beschrijving van de afbeelding |
| `units` | `"fraction"` (0..1, standaard) of `"px"` |
| `width`, `height` | alleen bij `px`: het coördinatenvlak (meestal de pixelmaat van de afbeelding) |
| `areas[]` | `{ value, label?, shape, coords }`, in tabvolgorde |
| `legend` | `false` = geen tekstregel met de gekozen labels onder de afbeelding |
| `accentColor` | randkleur van gekozen gebieden (standaard amber `#f59e0b`) |
| `maxWidth` | optionele maximale breedte (CSS) |

`shape`/`coords` zijn gelijk aan HTML: `rect` `[x1,y1,x2,y2]`, `circle` `[cx,cy,r]`,
`poly` `[x1,y1,x2,y2,…]`, plus `ellipse` `[cx,cy,rx,ry]` als uitbreiding. Daardoor is de
uitvoer van elke gewone image-map-generator (pixels) direct bruikbaar via
`units: "px"`. Fracties schalen mee met de breedte van het veld, net als bij
Imprint-widgets. `value` is de waarde die in de data komt: een enum-waarde, of het id
van een referentielijst-item. Areas waarvan de `value` niet in de keuzelijst voorkomt,
worden gemeld en niet getekend.

### 7.2 Tekenen

Een `<img>` met daarover een `<svg viewBox="0 0 1 1" preserveAspectRatio="none">`.
Relatieve coördinaten vallen daardoor precies over de afbeelding, ongeacht de
schermbreedte. Een `circle` in fracties wordt met de beeldverhouding een ellips in het
uitgerekte vlak, zodat hij rond blijft. Lijnen hebben `vector-effect:
non-scaling-stroke`, met een witte halo eronder. Gekozen gebieden krijgen een dikke rand
in `accentColor`. Het gemarkeerde gebied (muis of toetsenbord) krijgt een blauwe rand.
Zodra er iets gekozen is, worden de overige gebieden gedimd; daarvoor hebben ze alleen
een gestippelde omtrek. Elke area heeft een `<title>` (tooltip).

### 7.3 Toegankelijkheid

- De SVG is een ARIA-`listbox` (`aria-multiselectable` bij meer uit een lijst), elk gebied
  een `option` met `aria-selected`. De focus blijft op de listbox; het gemarkeerde gebied
  loopt via `aria-activedescendant`, zoals bij downshift.
- Toetsen: pijlen (rondlopend, slaan uitgeschakelde items over), Home/End, Enter of spatie
  om te kiezen, Escape om de markering op te heffen.
- Het label van het formulierveld of de lijst benoemt de listbox (`aria-labelledby`).
- Een **legenda** onder de afbeelding noemt de keuze in tekst (`aria-live`), met ✕ om te
  verwijderen, net als de chips van `RefMeerkeuze`.

## 7b. De vorm `rating-grid` (matrix)

Eén `lijst` in plaats van een lijst per vraag. De rijen zijn de waarden van het **rijveld**,
de kolommen die van het **kolomveld**. Per rij kies je één waarde. Elke matrixrij is één
lijstrij: dezelfde data als de drie losse vaste-rij-lijsten die FD 2 nu gebruikt
(`matrix.js`, `MatrixKeuze.jsx`).

```json
{ "type": "lijst", "bron": "Initiatief.bijdragen", "label": "Bijdrage aan Common Ground", "vorm": "rating-grid",
  "vormConfig": {
    "rows":    [ { "value": "Wendbaarheid", "description": "sneller en goedkoper kunnen veranderen" }, "Dienstverlening", "Regie" ],
    "columns": [ { "value": "Schaal 1", "label": "1 · klein", "color": "#fef3c7" }, { "value": "Schaal 2", "label": "2" },
                 { "value": "Schaal 3", "label": "3" }, { "value": "Schaal 4", "label": "4 · groot", "color": "#fbbf24" } ] },
  "elementen": [ { "type": "veld", "veld": "type_bijdrage", "label": "Doel" },
                 { "type": "veld", "veld": "schaal", "label": "Schaal" },
                 { "type": "veld", "veld": "toelichting", "label": "Toelichting", "vorm": "text-area" } ] }
```

| vormConfig | Standaard | Betekenis |
|---|---|---|
| `rowField` | eerste sjabloonveld zonder vasteWaarde | het veld dat de rij bepaalt (`type_bijdrage`) |
| `columnField` | het volgende sjabloonveld | het veld dat per rij gekozen wordt (`schaal`) |
| `rows` | alle waarden van het rij-enum | subset en volgorde van de rijen, met `label` en `description` |
| `columns` | alle waarden van het kolom-enum | labels (`1 · klein`) en een `color` per stap (kleurverloop) |
| `required` | `verplicht` van het kolomveld | elke rij moet een keuze hebben; geen wisknop |

- **Overige sjabloonvelden** (zoals `toelichting`) zijn *extra velden per rij*. Ze staan
  onder de rij en zijn uitklapbaar, met de gewone veldcomponenten. Is zo'n veld verplicht
  in het model, of staat er al iets, dan is het standaard open.
- **Labels:** het label van het rijveld wordt de hoekkop (*Doel*), het label van het
  kolomveld de kop boven de schaal (*Schaal*).
- **Data:** een cel kiezen werkt de bestaande lijstrij bij (geen afvoer en opvoer) of voegt
  een rij toe met de vaste waarden van de lijst. Wissen, alleen als de matrix niet verplicht
  is, haalt een lege rij weg. Een toelichting blijft staan.
- **Toegankelijkheid:** een echte `<table>` met `th scope=col/row` en per rij native
  radioknoppen met dezelfde `name`. Schermlezers noemen zo rij én kolom, en de pijltjes
  lopen binnen een rij. Bij een verplichte matrix krijgt een rij zonder keuze na
  *Verzenden* de melding *Kies een waarde* (`role=alert`).
- **Past op** elke combinatie van een meervoudig GE of relatie met twee enum-velden, of een
  referentielijst met `rows` in de config.
- Voor FD 2 is dit een mogelijke vervanging van de drie lijsten onder *Bijdrage aan Common
  Ground* (vraag 19–24). Dat is nog niet gedaan: het is een wijziging van een formulier dat
  in gebruik is.

## 7c. De vorm `button-group` (knoppenvlak)

Een vlak van afgeronde knoppen die je aan- en uitklikt: een *ingedrukte* knop is de keuze,
zoals de akkoordknoppen van een accordeon. Bedient één uit een lijst (los veld, bv. het
producttype) en meer uit een lijst (lijst, bv. de API-standaarden). Gebouwd op `useKeuze`,
net als de image-map: dit is het bewijs dat de headless opzet werkt. Alleen het tekenen is nieuw.

| vormConfig | Standaard | Betekenis |
|---|---|---|
| `sort` | `"alpha"` | `"alpha"` (A–Z, getallen op waarde), `"order"` (op id = volgorde van registratie), `"none"` |
| `sortToggle` | `false` | de invuller kan wisselen tussen A–Z en `order` |
| `orderLabel` | "Volgorde van registratie" | label van de tweede sortering |
| `minWidth` | 104 | minimale knopbreedte in px (het raster vult de breedte) |

- **Keuzebron:** voor een referentielijst haalt `useRefOpties` (Omnium-kant) de items op; de
  vorm zelf haalt niets op (draagbaar naar Imprint).
- **Historisch sorteren** (oudste standaard eerst) kan pas als ApiStandaard **materieel** is:
  dan heeft elke standaard een aanvang en einde, is `order` de aanvangsdatum, en verdwijnen
  vervallen standaarden vanzelf uit het vlak. Nu is `IsMaterieel` false (modelwijziging, nog
  niet gedaan); daarom heet de tweede sortering eerlijk *Volgorde van registratie*.
- Woordafbreking op Nederlandse lettergrepen (`lang="nl"`, `hyphens: auto`).

## 7d. Lijst in één veld: datatype `EnumLijst` (CG-lagen)

Tussenoplossing vóór hermodelleren naar een meervoudig GE: een enum-veld mag meerdere waarden
bevatten, gescheiden door `;`. De **inhoud** is meer uit een lijst; alleen de **opslag**
verschilt. Het staat in het model, dus elke vorm, validatie en export ziet het.

- **Datatype `EnumLijst`** (`model/extra_datatype_registry.go`, handmatig onderhouden, blijft
  bij codegen staan): basistype string, `weergave.scheiding = ";"` (nieuw veld
  `V3Weergave.Scheiding`). Het veld houdt zijn enum: `schema:"enum=CGLaag,datatype:EnumLijst"`.
  Codegen schreef die combinatie al, maar het schema-endpoint, de validatie-walker en de
  V3-exporter lazen de tag alleen op het begin, waardoor het datatype verdween. Nu leest één
  parser (`model/schema_tag.go`, `ParseSchemaTag`) de tag per komma-deel.
- **Validatie (backend):** elke waarde wordt apart tegen het enum gecontroleerd
  (`validation_walker.go`). `"Laag 1;Laag 9"` geeft 422 op `Laag 9` (NL API-foutformaat).
  Let op: de walker controleert de `_Input`-structs, en daar stonden in het CG-model nog
  geen schema-tags (gegenereerd vóór codegen ze daar ging schrijven). De enum-controle gold
  dus niet voor `CG_laag`; nu wel, per waarde.
- **Schema-endpoint:** een veld krijgt `lijstScheiding: ";"`. Voor de frontend is het dan
  *meer uit een lijst* (`invoersoortVanVeld`). Standaardvorm: vinkjes; `image-map` en
  `button-group` werken ook. Opslaan gebeurt in de volgorde van het enum (`voegLijstSamen`),
  dus dezelfde keuze geeft altijd dezelfde tekst. De frontend-validatie controleert per waarde.
- **CG-model:** `Initiatief.producten.CG_laag` krijgt datatype `EnumLijst`; het enum `CGLaag`
  krijgt `Utility`, een kolom naast alle lagen (bv. FTV, `public/voorbeelden/cg-lagen-utility.svg`).
  Bestaande waarden (één laag) blijven geldig.
- **Nog te doen:**
  - **Model in de Studio.** Zet datatype `EnumLijst` op `CG_laag` en `Utility` in het enum.
    De Go-bestanden in de repo zijn aangepast zoals codegen ze zou schrijven, maar een rebuild
    vanuit een oud opgeslagen model zet ze terug.
  - **GraphQL-filter:** `CG_laag: { eq: "Laag 1" }` mist `"Laag 1;Laag 2"`. Een
    `contains`-achtig filter of splitsen in de query is nodig.
  - **Weergaven** tonen de ruwe tekst `Laag 1;Laag 2`.
  - **Hernoemen** naar `CG_lagen` is een aparte migratie (kolom, GraphQL, weergaven, FD 2).

## 8. Architectuur: headless, zoals downshift

```
vormen.js          inhoud ↔ vorm: registry, aliassen, invoersoort, keuzesNaarRijen   (puur)
keuzeReducer.js    toestand + stateChangeTypes, zoals downshift                     (puur)
useKeuze.js        React-hook: prop-getters, gecontroleerde props, callbacks
imageMap.js        vormConfig → SVG-vormen, controle tegen de keuzelijst            (puur)
ImageMapKeuze.jsx  de vorm: tekent met useKeuze
```

**`useKeuze`** is een "altijd open" keuzelijst: `useSelect` en `useMultipleSelection`
van downshift in één, zonder uitklapmenu. De API heeft bewust dezelfde namen als
downshift. Een vorm op `useKeuze` en de combobox op `useCombobox` zijn daardoor
uitwisselbaar op het niveau van props en callbacks:

| downshift | useKeuze |
|---|---|
| `items`, `itemToString`, `itemToKey`, `isItemDisabled` | idem |
| `selectedItem` / `onSelectedItemChange` (useSelect, useCombobox) | idem, bij `multiple: false` (select1) |
| `selectedItems` / `onSelectedItemsChange` (useMultipleSelection) | idem, bij `multiple: true` (select) |
| `highlightedIndex`, `onHighlightedIndexChange` | idem |
| `stateReducer(state, { type, changes })`, `onStateChange` | idem |
| `useX.stateChangeTypes` (`ItemClick`, `FunctionSelectItem`, …) | `useKeuze.stateChangeTypes`, dezelfde namen waar ze bestaan |
| `getMenuProps`, `getItemProps({ item, index })`, `getLabelProps` | idem |
| `selectItem`, `removeSelectedItem`, `setHighlightedIndex`, `reset` | idem |
| `getToggleButtonProps`, `getInputProps`, `isOpen` | — (altijd open, geen invoerveld) |

**Het datacontract is gelijk voor elke vorm.** Een vorm levert sleutels: één sleutel,
of een array bij meer uit een lijst. Bij een lijst maakt `keuzesNaarRijen` daar rijen
van. Rijen van andere lijsten op dezelfde bron (vaste-waardenfilter) blijven ongemoeid,
en een rij die gekozen blijft, blijft hetzelfde object. Dat voorkomt een onnodige afvoer
en opvoer. Een nieuwe vorm hoeft dus alleen te tekenen.

**Een nieuwe vorm toevoegen:** registreer hem in `VORMEN` (naam, label, invoersoorten),
bouw een component op `useKeuze` (of downshift) met als contract
`waarde`/`onChange(sleutel|sleutels)`/`readOnly`/`labelId`, en koppel hem in
`SchemaFormField` (veld) en `CustomFormulierRenderer` (lijst).

## 9. Open punten

1. **Studio-inspector.** Een keuzelijst *vorm* die alleen de vormen toont die bij de
   invoersoort passen (`vormenVoor`), en een editor voor `vormConfig`. Te beginnen met
   JSON, later gebieden tekenen op de afbeelding. Tot die tijd: `vorm`/`vormConfig` in
   de layout-JSON zetten. De adapter bewaart ze bij een round-trip.
2. **Afbeeldingen hosten.** Voor het openbare formulier moet `image` publiek bereikbaar
   zijn (`/media/…` of een asset-endpoint). Nu is het een URL.
3. **`combobox` voor een enum** en **`checkbox-group` voor een referentielijst** zijn
   geregistreerd maar vallen nog terug op de standaard (select, respectievelijk chips).
4. **Server.** De server kijkt niet naar `vorm`. De rijen van een image-map-lijst zijn
   gewone lijstrijen en gaan door dezelfde controles bij opvoeren en openbaar indienen.
   Nog na te gaan: of een enum-waarde buiten de lijst daar ook wordt geweigerd. Dat
   hangt niet van de vorm af, maar een vorm met eigen `value`s maakt het wel relevanter.
5. **Migratie van `widget` naar `vorm`** in FD 2 (replays 16/17/19) en in de naslag.
6. **Imprint:** `x-appearance` in `SchemaForm`, en de map `vormen/` als gedeeld package.

## 9b. Formulier 3.0: modelmatig (denkwerk 26-09, nog niet besloten)

Mark, na het bekijken in de Studio: het formulierprofiel loopt achter. Het is in wezen het schema
van de formuliertaal, maar `vorm`/`vormConfig` ontbreken en `widget` is een vrij tekstveld.

**Wat een veld nu draagt, ingedeeld naar laag:**

| Eigenschap | Laag | Opmerking |
|---|---|---|
| `veld` (veldpad) | binding | de link naar de bron; de inhoud heeft geen eigen type, dat volgt uit de bron |
| `label`, `beschrijving` | tekst (inhoud) | de vraagtekst in dit formulier; standaard de naam uit het model. Kandidaat voor meertaligheid (taalversies op een hub). Groepen hebben ook een label; in het profiel is dat de node-naam |
| `widget` → `vorm` + `vormConfig` | vorm | `widget` blijft als alias |
| `breedte` | vorm (lay-out) | |
| `readonly` | **modus**, geen vormConfig | elke vorm kent invoer en weergave (alleen-lezen); dezelfde modus als de weergavevorm |
| `vasteWaarde` | **verwerking** (laag 4) | procesregel; hoort in de BFF die het formulier ontvangt, niet in de client. De server dwingt hem nu al af bij openbaar indienen. Het tweede gebruik, als filter van een lijst (vaste rijen), is een ander begrip: selectie |
| `kopieerNaar` | **verwerking** | één invoer, twee doelen: de startdatum gaat ook naar `Initiatief.aanvang.datum` (materiële aanvang); een afleidingsregel |
| `nieuwFormulier` | compositie | op `organisatie_id`: "＋ Nieuwe organisatie" opent FD 3 ingebed en maakt een nieuwe Organisatie aan |

**Een tweede universum: de vormtypen**, analoog aan de informatieniveaus in MIM (klassen naast
datatypen en referentielijsten):
- **inhoudtype**: naam, verwijst naar een of meer datatypen in het canonieke model
  (koppeling over modellen heen);
- **vormtype**: naam, een configuratietype, en *realiseert/toont* 0..* inhoudtypen;
- **vormconfiguratietype**: het schema van de vormConfig (eigenschappen: naam, type, standaard);
- de koppelingen inhoud × vorm vormen samen de matrix "wat kan met wat".

**Richting (Claude):**
- **Apart profiel.** Een eigen *vormenprofiel* naast het formulierprofiel. Het formulierprofiel
  krijgt alleen `vorm` (een verwijzing naar een vormtype; het profielsysteem kent
  `referenceTypes`) en `vormConfig` (een eigen datatype). De editor daarvan tekent een formulier
  uit het configuratietype van het gekozen vormtype. Zo hoeft niet elk vormtype in het
  formulierprofiel, en kun je de eigenschappen toch in het diagram invullen.
- **Code en data gescheiden.** Een vormtype heeft altijd code (een component). De
  *implementatie* staat dus in de code-registry (met configSchema). De *beschrijving en de
  keuzes* (welke vormen hier zijn toegestaan, de standaardvorm per inhoudtype) kunnen data in de
  database zijn: bitemporeel, per instantie. Begin met een alleen-lezen vormenmodel dat uit de
  registry wordt geëxporteerd, zoals `v3_exporter` het canonieke model uit de code haalt. De
  matrix wordt pas data als er behoefte is aan instellen per instantie.
- **Verwerking later naar laag 4.** `vasteWaarde` en `kopieerNaar` op termijn naar een
  verwerkingsdeel dat de BFF uitvoert; het formulier toont alleen.

**Gezien in de Studio (26-09), nog op te lossen:**
- **Onbekende veldpaden.** De live preview van de formuliereditor kent de relatieve velden van
  lijsten niet ("Onbekend veldpad: type/rol/gemeente_id"). Daardoor meldt het knoppenvlak
  "zonder keuzeveld" en valt de matrix/image-map in een lijst terug. In de inhoud-editor werkt
  het wel.
- **Geen `lijstScheiding`.** De veldinformatie van de Studio heeft geen `lijstScheiding`, dus
  `CG_laag` toont daar nog één keuze.

## 10. Bestanden en tests

| Bestand | Rol |
|---|---|
| `web/vite/src/vormen/vormen.js` (+ `.test.js`) | registry, aliassen, invoersoort, `keuzesNaarRijen` |
| `web/vite/src/vormen/keuzeReducer.js` (+ `.test.js`) | toestand en toetsenbord |
| `web/vite/src/vormen/useKeuze.js` | de hook |
| `web/vite/src/vormen/imageMap.js` (+ `.test.js`) | vormConfig → SVG |
| `web/vite/src/vormen/ImageMapKeuze.jsx` | de vorm `image-map` |
| `web/vite/src/vormen/matrix.js` (+ `.test.js`) | matrix: assen, cel en extra veld zetten |
| `web/vite/src/vormen/MatrixKeuze.jsx` | de vorm `rating-grid` |
| `web/vite/src/vormen/buttonGroup.js` (+ `.test.js`), `ButtonGroupKeuze.jsx` | de vorm `button-group` |
| `components/editor/useRefOpties.js`, `ButtonGroupVeld.jsx` | keuzebron (enum of referentielijst) → knoppenvlak |
| `components/editor/SchemaFormField.jsx` | `vorm`/`vormConfig` op een veld; namen genormaliseerd |
| `components/editor/CustomFormulierRenderer.jsx` | `vorm` op een lijst; `image-map` via `keuzesNaarRijen` |
| `diagramprofielen/formulier/adapter.js` (+ test) | `vorm`/`vormConfig` door de Studio (vormConfig als JSON-tekst in de node-data) |

`cd web/vite && node --import ./test/register-aliases.mjs --test src/vormen/*.test.js`.

**Tweede versie van het aanmeldformulier (voor online, eerst intern testen):**
`replay files/registraties-replay-init-formulierdefinitie-aanmelding-vormen-2026-09-26.json`:
*Aanmelding initiatief (vormen)*. Een kopie van FD 2 layout v3, met:
- knoppenvlak voor het producttype (vraag 2) en de API-standaarden (27, met sorteerwissel);
- klikbare afbeelding voor de CG-laag (26) en de soorten betrokken organisaties (7);
- één matrix voor de bijdragen (19–24, was drie lijsten);
- `widget` → `vorm` waar dat kan.

Het is actief, maar niet standaard en niet openbaar; openbaar maken = het id toevoegen aan
`OPENBARE_FORMULIEREN`. Het id is een plaatshouder; FD 3 blijft het subformulier *Nieuwe
organisatie*. Daarnaast `registraties-replay-init-apistandaarden-soap-2026-09-26.json`: SOAP
in de referentielijst, ook met een plaatshouder-id. Lokaal getest: alle vormen werken en
sorteren houdt de keuze vast.

**Voorbeeldformulier:** `replay files/registraties-replay-init-formulierdefinitie-voorbeeld-image-map-2026-09-26.json`
(*Voorbeeld: vormen*, doeltype Initiatief). Het FD-id is een plaatshouder
(`$nieuw.fd`), dus het botst op geen enkele instantie. Het formulier gebruikt twee
afbeeldingen uit `web/vite/public/voorbeelden/`:
- het CG-lagenmodel voor `Initiatief.producten.CG_laag` (één uit een lijst, `rect` in px);
- het ecosysteem voor `Initiatief.betrokken_organisatie.type` (meer uit een lijst,
  `circle` in px);
- de matrix voor `Initiatief.bijdragen` (drie doelen × Schaal 1–4, met toelichting).

Openen: `inhoud.html#/t/initiatieven/nieuw?formulier=<id>`.

**Getest op 26 september 2026** (lokaal, Playwright, verzenden onderschept):
- klikken, wisselen en het toetsenbord werken;
- de legenda volgt de keuze;
- de registratie bevat `product.CG_laag = "Laag 1"` en één `betrokkenorganisatie`-rij per
  gekozen soort.

**Matrix getest:**
- bij een lege verplichte rij verschijnt *Kies een waarde*;
- de pijltjes lopen binnen een rij;
- verplichte toelichtingen staan open;
- de registratie bevat drie `bijdrage`-opvoeren met `type_bijdrage`, `schaal` en `toelichting`.

Bijvangst: `/full/formulier_definities` geeft standaard een pagina van 20. Bij meer
FD's vielen de nieuwste weg uit *Invoer via*, de formulierindex en
`degradeerAndereStandaarden`, waardoor er twee standaarden konden blijven. Alle vier
aanroepen vragen nu `?size=1000`.

Stijl: gekozen gebieden krijgen een amberkleurige rand (`vormConfig.accentColor`). Zodra er
iets gekozen is, worden de andere gebieden gedimd. Elke omtrek heeft een witte halo, zodat
de keuze zichtbaar blijft op lichte én donkere afbeeldingen.
Let op: het npm-script `npm test` vindt onder Windows (cmd) met de glob tussen enkele
aanhalingstekens 0 tests. Geef de bestanden daar expliciet mee.
