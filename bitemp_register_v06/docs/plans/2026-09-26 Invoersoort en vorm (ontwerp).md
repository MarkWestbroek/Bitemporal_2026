# Invoersoort en vorm — ontwerp

> Status: **voorstel + eerste implementatie** (branch `feat/invoer-vorm`, 26 september 2026).
> Gebouwd: de begrippen, de vormen-registry, de vorm `image-map` (klikbare afbeelding) op
> veld en lijst, en de round-trip door de Studio. Nog niet: de Studio-inspector voor
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

### 4.1 Kandidaten (brainstorm 26 september 2026)

| Vorm | Bedient | Idee van | Opmerking |
|---|---|---|---|
| `switch` | ja-nee | Mark | schuifschakelaar zoals op de MusicBrain-modules |
| `rotary` | getal, één uit een **geordende** lijst | Mark | draaiknop met klikstanden; aanslagen = min/max of de eerste/laatste optie |
| `range` | getal, één uit een geordende lijst | Mark | schuif voor een schaal (1–4, 1–10), eventueel met kleurverloop per stap (`vormConfig.kleuren`); past direct op het enum `Schaal` |
| `address-search` | een **groep** velden (straat, huisnummer, postcode, plaats) | Mark | één zoekveld dat via een adresdienst (PDOK Locatieserver/BAG) meerdere velden vult; eventueel ook het BAG-id bewaren |
| `ai-assist` | tekst | Mark | tekstvak met een assistent die voorstelt (herschrijven, inkorten, aanvullen); de invuller beslist altijd zelf |
| `rating-grid` | een groep **vaste rijen** met dezelfde schaal | Claude | matrix of likert: vragen als rijen, de schaal als kolommen. Precies de drie bijdragen (Wendbaarheid, Dienstverlening, Regie × Schaal 1–4) van FD 2 |
| `map` | één of meer uit een lijst, locatie | Claude | gebieden op een echte kaart (GeoJSON, zoals Imprints `map`-widget): gemeenten kiezen op de kaart, direct op `initiatief_gemeenten` |
| `ranking` | **volgorde** uit een lijst | Claude | slepen om te ordenen (prioriteiten); nieuwe invoersoort, opgeslagen als rijen met een volgnummer |
| `cards` | één of meer uit een lijst | Claude | keuzekaarten met icoon, titel en uitleg (producttype met toelichting) |
| `period` | een groep van twee datums | Claude | begin en einde als één balk op een tijdlijn; past bij aanvang/einde en materiële geldigheid |
| `button-group`, `stepper`, `file-drop` | één uit een lijst, getal, bestand | Claude | segmentknoppen, +/−, sleepvak |
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
4. **AI stelt voor, de mens beslist.** Voor `ai-assist` en `ai-extract` gaat de aanroep via de
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

## 10. Bestanden en tests

| Bestand | Rol |
|---|---|
| `web/vite/src/vormen/vormen.js` (+ `.test.js`) | registry, aliassen, invoersoort, `keuzesNaarRijen` |
| `web/vite/src/vormen/keuzeReducer.js` (+ `.test.js`) | toestand en toetsenbord |
| `web/vite/src/vormen/useKeuze.js` | de hook |
| `web/vite/src/vormen/imageMap.js` (+ `.test.js`) | vormConfig → SVG |
| `web/vite/src/vormen/ImageMapKeuze.jsx` | de vorm `image-map` |
| `components/editor/SchemaFormField.jsx` | `vorm`/`vormConfig` op een veld; namen genormaliseerd |
| `components/editor/CustomFormulierRenderer.jsx` | `vorm` op een lijst; `image-map` via `keuzesNaarRijen` |
| `diagramprofielen/formulier/adapter.js` (+ test) | `vorm`/`vormConfig` door de Studio (vormConfig als JSON-tekst in de node-data) |

`cd web/vite && node --import ./test/register-aliases.mjs --test src/vormen/*.test.js`.

**Voorbeeldformulier:** `replay files/registraties-replay-init-formulierdefinitie-voorbeeld-image-map-2026-09-26.json`
(*Voorbeeld: klikbare afbeelding*, doeltype Initiatief). Het FD-id is een plaatshouder
(`$nieuw.fd`), dus het botst op geen enkele instantie. Het formulier gebruikt twee
afbeeldingen uit `web/vite/public/voorbeelden/`:
- het CG-lagenmodel voor `Initiatief.producten.CG_laag` (één uit een lijst, `rect` in px);
- het ecosysteem voor `Initiatief.betrokken_organisatie.type` (meer uit een lijst,
  `circle` in px).

Openen: `inhoud.html#/t/initiatieven/nieuw?formulier=<id>`.

**Getest op 26 september 2026** (lokaal, Playwright, verzenden onderschept):
- klikken, wisselen en het toetsenbord werken;
- de legenda volgt de keuze;
- de registratie bevat `product.CG_laag = "Laag 1"` en één `betrokkenorganisatie`-rij per
  gekozen soort.

Bijvangst: `/full/formulier_definities` geeft standaard een pagina van 20. Bij meer
FD's vielen de nieuwste weg uit *Invoer via*, de formulierindex en
`degradeerAndereStandaarden`, waardoor er twee standaarden konden blijven. Alle vier
aanroepen vragen nu `?size=1000`.

Stijl: gekozen gebieden krijgen een amberkleurige rand (`vormConfig.accentColor`). Zodra er
iets gekozen is, worden de andere gebieden gedimd. Elke omtrek heeft een witte halo, zodat
de keuze zichtbaar blijft op lichte én donkere afbeeldingen.
Let op: het npm-script `npm test` vindt onder Windows (cmd) met de glob tussen enkele
aanhalingstekens 0 tests. Geef de bestanden daar expliciet mee.
