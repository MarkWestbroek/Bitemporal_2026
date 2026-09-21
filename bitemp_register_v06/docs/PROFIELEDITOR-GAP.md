# Gap: wat kan een profiel wél, en de profiel-editor niet?

Peildatum **2026-09-17**. Deze notitie inventariseert het verschil tussen wat
de **profiel-descriptor** (het metamodel in
`web/vite/src/diagramcore/types/schema.js`) toestaat en wat je met de
**profiel-editor** in Omnium Studio kunt maken of terugzien. Bedoeld als
werklijst voor wie die editor bijwerkt; geen ontwerpvoorstel.

Twee treden, met een eigen gat:

| | Trede 1 — **JSON** (`Profiel (0.5)`, `profielActivity.jsx`) | Trede 2 — **tekenen** (`Profiel-ontwerp`, `profielOntwerp.js`) |
|---|---|---|
| Vorm | de hele descriptor-kern als JSON in één tekstvak | een diagram van elementtypen, compartimenttypen, veldtypen en lijnen |
| Grens | alles wat **JSON** is, kan; code (functies) niet | een **deel** van de JSON; de rest kun je niet tekenen en gaat bij teruglezen verloren |

Het canonieke profiel (`diagramprofielen/canoniek-uml/index.js`) is code en
gebruikt allebei die grenzen ruim: het valt dus niet volledig in een van de
treden te maken.

---

## 1. Trede 1 (JSON): de grens is "code"

De JSON die je intypt **ís** de descriptor. Er is geen witte lijst van
sleutels: `vertaalHooks` kopieert alles door en raakt alleen
`elementTypes[].hooks` aan (`profielGereedschap.js:53`). Alles uit het schema
dat JSON is, kun je dus zetten — inclusief de nieuwe `opname`,
`samentrekking`, `placeholder`, `opties` en `randElement`.

### Kan niet, omdat het functies zijn

| Descriptor-deel | Waar | Gevolg |
|---|---|---|
| `referenceResolvers` | `schema.js:240` | geen eigen keuzelijsten uit het model |
| `layouts[].run` | `schema.js:221` | een layout-knop zonder werking |
| `serialisatie`, `menus` | `schema.js:245-247` | geen eigen import/export of menu's |
| element-hooks buiten de catalogus | zie hieronder | geen afgeleide compartimenten, stereotypes, drop-gedrag |
| diagram-hooks `migreerModel`, `hierarchieParen` | `maakDiagramActiviteit.jsx:141`, `:1130` | worden **niet** vertaald: een string blijft staan en crasht bij aanroep |

### De hook-catalogus is klein

Benoembaar zijn precies **twee** ids (`HOOK_CATALOGUS` in
`profielGereedschap.js:19-44`):

- `edgeLabels: "kardinaliteiten"`
- `edgePresentatie: "directioneel-pijl"`

De core gebruikt daarnaast `extraCompartimenten`, `stereotype`,
`ontvangtDrop` en `valideer` — die staan wel met naam en beschrijving in
`handlerCatalogus.js`, maar dat is alleen naamgeving voor de weergave, geen
koppeling. Een JSON-profiel kan ze dus niet gebruiken.

### Validatie dekt weinig

`valideerDiagramType` (`typeRegistry.js:74-127`) controleert: `id`, `label`,
`style` en een niet-lege `elementTypes`; per elementtype `id`, `label`,
`shape` en maximaal 9 compartimenten; dubbele element-ids; `hierarchie` wijst
naar een bestaand connectortype; elke connector heeft minstens één
verbindingsregel met bestaande bron- en doeltypen.

Niet gecontroleerd: of `style` en `shape` bestaan (elke string wordt
geaccepteerd), of `compartments[].fieldType` naar een bestaand `FieldType`
wijst, of een property-`datatype` een editor heeft, en verder
`taakbalken.acties`, `layouts`, `referenceTypes`, `shapeSets`,
`typeWeergave` en kardinaliteiten. Let op: `vervangDiagramType`
(`typeRegistry.js:151`) valideert wel, maar overschrijft daarna een bestaand
id zonder waarschuwing — ook dat van een ingebouwd profiel.

---

## 2. Trede 2 (tekenen): het grootste gat

### ElementType

Wel: `id`/`label` (uit de naam), `kort`, `shape`, `icoon`, `kleur`,
`stereotype`, `standaardDichtInBoom`, `containerVoor` (uit het
container-vinkje), `properties` en `compartments`
(`profielOntwerp.js:272-288`).

Niet, hoewel het schema ze kent (`schema.js:105-183`):

- **vormgrammatica:** `randDikte`, `hoekRadius`, `randStijl`, `handleStijl`
  (behalve automatisch bij `note`/`boundary`), `resizebaar`, `minBreedte`,
  `minHoogte`, `achtergrond` (behalve bij `boundary`);
- **plaatsing en gedrag:** `naamLabel`, `randAanhechting`, `randElement`,
  `meerdereVoorkomens`, `gedragsVerwijzing`, `taakbalkGroep`,
  `omschrijving`;
- **gedaanten van een samenstel:** `samentrekking` en `opname`;
- **hooks**, op de twee connector-hooks hierna na.

Bovendien: van de 60 geregistreerde shapes staan er **11** op de witte lijst
(`GELDIGE_SHAPES`, `profielOntwerp.js:170`). Een profiel met een andere shape
laat die bij genereren terugvallen op `class-box`.

### Connector-ElementType

Wel: naam, `bron`/`doel` (of meerdere `verbindingsregels` door lijnen met
dezelfde naam te bundelen), `edgePresentatie` met lijn, vorm, kleur en
markers, een kardinaliteitspaar en een richting-vinkje, plus de twee
catalogus-hooks (`profielOntwerp.js:295-346`).

Niet: `ConnectorEindpunt.kardinaliteiten`, `edgePresentatie.labels`, eigen
connector-properties, andere hooks. Een lijn tússen connectortypen wordt
stil overgeslagen, omdat alleen niet-connectoren een node in het ontwerp
krijgen (`profielOntwerp.js:451`, `:571`).

### CompartmentType en FieldType

- CompartmentType: alleen `id`, `label` en `fieldType`, en alleen het
  **eerste** veldtype-kind telt (`profielOntwerp.js:264`). `alleenWeergave`
  en `verbergInInspector` kun je niet tekenen.
- FieldType: `viewer` staat vast op `"naam-type"` (`:240`, `:250`). De
  viewers `tekst`, `waarde` en `sub-vak` zijn onbereikbaar. Twee veldtypen
  met dezelfde naam: de tweede verdwijnt stil (`:237`).

### PropertyType

Alleen `key` (uit de naam), `label` en een `datatype` uit
`string | tekst | boolean | colour` (`GELDIGE_DATATYPES`,
`profielOntwerp.js:183`). Niet te tekenen: `opties` (dus datatype `keuze`),
`referenceTypes`, `verplicht` en `placeholder`.

### Round-trip: descriptor → tekening → descriptor

`ontwerpUitProfiel` (`profielOntwerp.js:440-619`) leest minder terug dan een
descriptor kan bevatten. Genereer je daarna opnieuw, dan verlies je alles uit
de lijsten hierboven, plus:

- **`key`s van properties worden herschreven.** Alleen `label || key`
  overleeft als veldnaam; bij genereren wordt de key `slug(label)`. Zo wordt
  `{key: "typeLabel", label: "type"}` stil `{key: "type"}` — en dan leest de
  node de data niet meer. Dit raakt ook het eigen `LEEG_SJABLOON` en
  `GRAAF_DEMO` van de editor (`profielGereedschap.js:116`, `:159`): de viewer
  `naam-type` leest hard `data.typeLabel` (`basisShapes.jsx:87`), dus na één
  round-trip toont zelfs het startsjabloon geen veldtype meer.
- **`style` gaat verloren:** genereren zet altijd `"uml-klassiek"`
  (`profielOntwerp.js:376`).
- **`layouts` wordt leeg** (`:389`) en de **taakbalken** worden altijd
  dezelfde twee (`:385`).
- Het compartiment "implementatie" op een elementtype-node is
  **alleen weergave** (hooks, property-datatypes, referentietypen met naam
  en beschrijving uit `handlerCatalogus`). Genereren leest het niet terug.

---

## 3. Instellingen op diagramtype-niveau

| Instelling | Trede 1 (JSON) | Trede 2 (tekenen) |
|---|---|---|
| `elementTypes`, `fieldTypes` | ja | deels (zie §2) |
| `hierarchie` | ja, ook `{type, omgekeerd}` | alleen via het vinkje "bevat-relatie" per lijn, dus geen `omgekeerd` |
| `shapeSets` | ja | ja (ShapeSet-paneel) |
| `typeWeergave` | ja | alleen doorgegeven; geen UI |
| `style` | ja (verplicht, niet gecontroleerd) | nee, altijd `uml-klassiek` |
| `randAanhechting`, `meerdereVoorkomens` | ja | nee |
| `taakbalken` | zetbaar, maar alleen `acties: "elementTypes" \| "connectorTypes" \| "layouts"` werkt; een eigen `ActionType[]` levert een lege balk (`maakDiagramActiviteit.jsx:2240`) | nee, twee vaste balken |
| `layouts` | alleen `{id, label}`; zonder `run` doet de knop niets | nee, altijd leeg |
| `referenceTypes` | zetbaar, maar zonder resolver (code) leeg | nee, alleen zichtbaar |
| `serialisatie`, `menus`, diagram-hooks | nee | nee |

## 4. Waar zelfgemaakte profielen leven

- `localStorage["studio05-profielen"]` — `{profielId: kern}`
  (`profielRegistratie.jsx:12`, `:44-58`); posities van het ontwerp in
  `localStorage["studio05-profiel-layouts"]` (`:69`).
- Per dynamisch profiel maakt de activiteit `studio05-dyn-<id>` (de sandbox)
  en `studio05-taakbalken-dyn-<id>`.
- Daarnaast gebundelde profielen in `web/vite/profielen/*.json`, die van de
  localStorage-versie winnen (`profielRegistratie.jsx:129-198`), en het
  dev-endpoint `/__studio05/profielen`.
- Hooks in een bewaard profiel kunnen alleen de twee catalogus-ids zijn.
  Functies zijn onmogelijk: opslag gaat via `JSON.stringify`.

---

## 5. Samengevat: drie soorten gat

1. **Code kan niet in data.** Resolvers, layout-strategieën, serialisatie,
   menu's en de meeste hooks zijn functies. Wil je die vanuit een profiel
   beschikbaar maken, dan moet er een **benoembare catalogus** bij komen
   (zoals `HOOK_CATALOGUS`, nu twee ids).
2. **De tekening kent maar een deel van de definitie.** Vooral
   vormgrammatica, plaatsingsgedrag, de gedaanten van een samenstel
   (`samentrekking`, `opname`), viewers en de rijkere PropertyTypes
   (`keuze` met `opties`, `referenceTypes`, `placeholder`).
3. **Stille verliezen bij teruglezen.** Een round-trip via de tekening
   herschrijft property-`key`s, wist `style`, taakbalken en layouts, en laat
   onbekende shapes terugvallen. Zolang dat zo is, is de tekening geschikt om
   een profiel te *maken*, niet om een bestaand profiel te *beheren*.
