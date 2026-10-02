# GraphQL-schema-profiel (M2) op de diagram-motor — voorstel

**Datum:** 2026-10-01
**Status:** stap 1 en het SDL-deel van stap 2 gebouwd (02-10-2026, branch `feat/graphql-profiel`); zie §12
**Bouwt op:** `diagramprofielen/oas31/` (dichtstbijzijnde analogie: een schemataal als
notatie, met adapter heen en terug), `canoniek-uml/oasNaarV3.js` (precedent voor
schemataal → canoniek), `docs/plans/2026-09-30 FTV GraphQL-profiel (GBO) versus modelpaden …`
(§2.2: de veldsleutel `ParentType.field` als projectie van het registerpad),
`authz/gbo-voorbeeld/scripts/gbo_model.py` (model → SDL, prototype), `dynql/` (runtime-schema
uit de MetaRegistry), `2026-07-29 Overdracht Notaties` (wat een profiel is op de motor).

Vraag van Mark: "ik denk dat het vrij goed te doen is om een profiel (M2) te maken voor het
GraphQL-schema." Dat klopt, en het is kleiner dan OAS: GraphQL's typesysteem is gesloten en
klein (spec §3: acht soorten typedefinities, twee wrappers, directives), en de motor heeft alles
al wat OAS nodig had. Hieronder wat het profiel is, wat het oplevert en in welke stappen.

---

## 1. Waarom een GraphQL-profiel

Drie gebruiksdoelen, oplopend in waarde:

1. **Notatie.** Een SDL tekenen, bewerken en terugschrijven, zoals OAS 3.1 nu. Op zichzelf
   handig (GraphiQL toont alleen tekst), maar niet de reden.
2. **De projectie zichtbaar maken.** Het GBO-profiel bindt regels op `ParentType.field`; wij
   zeggen dat die sleutel een projectie van het registerpad is. Met een GraphQL-profiel is die
   projectie een **transformatie tussen twee profielen op dezelfde motor** (canoniek → GraphQL),
   met de padtabel als kruisverbanden in de koppelingen-matrix. Dan is "het model als bron van
   SDL én regels" (werkgroep-punt 5) geen bewering maar een knop.
3. **Drift-check in Studio.** Ons runtime-schema (`dynql`) is introspecteerbaar. Importeer het
   in hetzelfde profiel en vergelijk het met de projectie uit het V3-model: dat is de H3-check
   uit het GBO-profiel (bundel-SDL = draaiend schema), maar dan vóór deployment en met een
   plaatje.

En als vierde, voor Toegangsspraak: een Gegevensselectie verwijst nu naar `(profiel, element)`
met het canoniek model als default. Met een GraphQL-profiel kan een regel ook rechtstreeks een
veldsleutel aanwijzen, en wordt de policybundel een export van de koppelingen in plaats van een
padtabel in een Python-script.

## 2. De M-niveaus, voor de scherpte

| Niveau | Hier |
|---|---|
| M3 | het type-contract van `diagramcore` (`ElementType`, `ConnectorType`, `FieldType`, `CompartmentType`) |
| **M2** | **dit profiel: GraphQL's typesysteem** (object, interface, union, enum, input, scalar, schema, directive; velden, argumenten; wrappers `!` en `[ ]`) |
| M1 | een concreet schema: het SDL van `gbo-persoon`, of van `dynql` |
| M0 | antwoorden op query's |

Het profiel beschrijft dus wat de GraphQL-spec in §3 *Type System* definieert, niets meer.
Apollo Federation (`@key`, entities) en Relay-conventies (connections, `Node`) zijn
uitbreidingen op M1-niveau via directives; ze horen niet in het M2 (zie §9).

## 3. Elementtypen

Alles op `class-box`, net als OAS en canoniek-uml: een kop met stereotype, een naam, en
compartimenten. Geen nieuwe shapes nodig.

| id | Stereotype | Wat | Compartimenten | Eigen properties |
|---|---|---|---|---|
| `schema` | «schema» | het schema-object: welke typen root zijn | weergave-regels `query: Query` enz. (hook) | `beschrijving`, `digest` (sha256 van het SDL, alleen-lezen, voor de bundel) |
| `object` | «type» | ObjectTypeDefinition | `velden` (fieldType `veld`) | `beschrijving`, `implements` (afgeleid uit connectoren, weergave) |
| `interface` | «interface» | InterfaceTypeDefinition | `velden` | `beschrijving` |
| `union` | «union» | UnionTypeDefinition | weergave-regel met de leden (hook) | `beschrijving` |
| `enum` | «enum» | EnumTypeDefinition | `waarden` (fieldType `literal`, met `deprecated`) | `beschrijving` |
| `input` | «input» | InputObjectTypeDefinition | `velden` (fieldType `inputveld`: geen argumenten) | `beschrijving` |
| `scalar` | «scalar» | custom ScalarTypeDefinition | — | `beschrijving`, `specifiedBy` (url) |
| `directive` | «directive» | DirectiveDefinition | `argumenten` | `locaties` (keuze-lijst), `repeatable` |
| `notitie`, `boundary` | — | zoals in elk profiel | | |

**Veldtypen (regels in compartimenten):**

| id | viewer | properties |
|---|---|---|
| `veld` | `naam-type` | `naam`, `typeExpressie` (zie §4), `argumenten` (viewer `sub-vak`: lijst van `argument`), `beschrijving`, `deprecated` (reden), `directives` (tekst, pass-through) |
| `argument` | `naam-type` | `naam`, `typeExpressie`, `standaard` (default value als tekst), `beschrijving` |
| `inputveld` | `naam-type` | `naam`, `typeExpressie`, `standaard`, `beschrijving` |
| `literal` | `waarde` | `naam` (enum-waarde), `deprecated` |

De node toont een veld als in SDL: `inkomens(jaren: [Int!]): [Inkomen!]`. De argumenten worden
in de inspector bewerkt (de `sub-vak`-viewer bestaat al voor precies dit soort geneste lijsten).

## 4. Type-expressies: wrappers zonder nieuwe motorprimitief

Een GraphQL-type in een veld is een *expressie*: `Inkomen`, `[Inkomen!]`, `String!`. OAS lost
het vergelijkbare probleem (`Persoon[]`, `string «date»`) op met een `typeLabel`-string plus
resolvers die kandidaten leveren. Hetzelfde hier:

- `typeExpressie` is een string; twee resolvers leveren kandidaten: `gql-scalar` (de vijf
  ingebouwde `Int Float String Boolean ID` plus de getekende «scalar»-elementen) en
  `gql-type-ref` (alle getekende object/interface/union/enum, of alleen `input`/`enum`/`scalar`
  op argument- en input-posities, want dat eist de spec).
- Een kleine helper `typeExpressie.js` parseert en serialiseert `!` en `[ ]` naar
  `{ naam, lijst, nonNull, itemNonNull }` en terug. Daarmee is de UML-kardinaliteit afleidbaar
  voor het connector-label: `T` → `0..1`, `T!` → `1`, `[T]` → `0..*`, `[T!]!` → `1..*`.

## 5. Connectoren

Connectoren worden **afgeleid** uit de typeExpressies (zoals OAS `$ref` → ref-connector), niet
los getekend; de adapter maakt ze bij import en de inspector bij het wijzigen van een veldtype.
Zo kan een diagram niet inconsistent worden met zijn SDL.

| id | Van → naar | Presentatie | Label |
|---|---|---|---|
| `veldtype` | object/interface → object/interface/union/enum | gestippeld, open pijl (als OAS `ref`) | rolnaam = veldnaam aan de bronzijde, kardinaliteit uit de wrappers aan de doelzijde |
| `implements` | object/interface → interface | dicht, open driehoek (generalisatie-notatie) | — |
| `lid` | union → object | gestippeld, «member» | — |
| `argumenttype` | object/interface → input/enum/scalar | gestippeld, fijn, «arg» | `veld.argument` |
| `root` | schema → object | dicht, «query» / «mutation» / «subscription» | de rootnaam |

Scalars en enums als veldtype krijgen *geen* lijn (zoals OAS geen lijn tekent naar `string`);
de expressie staat in de regel. Instelbaar: "toon enum-verwijzingen als lijn".

**Vormgrammatica.** Dezelfde kleurfamilie als OAS, zodat beide schematalen naast elkaar
herkenbaar blijven: object `#dbeafe` (blauw, "de entiteit-achtige"), interface `#ede9fe`,
union `#fae8ff`, enum `#fef3c7` (gelijk aan OAS-enum), input `#fee2e2` (inkomend), scalar
`#f1f5f9`, schema `#e0e7ff` met `randDikte: 3` (het identiteits-element, zoals OAS «api»).
Iconen uit `iconenVocabulaire` (interface, enumeratie, schema, package); geen nieuwe.

## 6. Adapter: SDL ↔ profielmodel, en introspectie

`diagramprofielen/graphql/adapter.js`, puur, zoals de OAS-adapter:

- **Import SDL.** `graphql-js` (`parse` + `buildASTSchema`) levert de AST met beschrijvingen
  en directives; de adapter maakt elementen, compartiment-regels en de afgeleide connectoren.
  Layout met de gedeelde rijen-logica van OAS: schema en root-typen boven, dan object-typen op
  afstand tot de root, dan input/enum/scalar onderaan.
- **Export SDL.** Eigen serializer (niet `printSchema`): die behoudt beschrijvingen,
  directives en volgorde zoals getekend, en geeft deterministische uitvoer voor de digest.
  Roundtrip-wet zoals bij OAS en Toegangsspraak: `parse(export(import(sdl)))` is structureel
  gelijk aan `parse(sdl)`.
- **Import introspectie.** Het JSON van een `__schema`-query (`buildClientSchema`) gaat door
  dezelfde import. Daarmee tekent Studio het draaiende `dynql`-schema met één knop. Let op:
  introspectie verliest directives en argument-defaults deels; markeren als "uit introspectie".
- **Pass-through** van wat het profiel niet kent (bv. extensies `extend type`, federation-
  directives) in `meta`, zoals OAS doet met securitySchemes, zodat de export niets kwijtraakt.

`graphql-js` is nog geen frontend-dependency (gecontroleerd: niet in `web/vite/package.json`;
de playground is server-side). Het is ~300 kB en zonder transitive deps; alternatief is een eigen
SDL-parser, maar dat is onnodig werk.

## 7. Transformaties en kruisverbanden (hier zit de waarde)

| Richting | Module | Wat |
|---|---|---|
| **canoniek (V3) → GraphQL** | `graphql/v3NaarGraphql.js` | de GBO-projectie uit `gbo_model.py` als JS: entiteit → «type», GE → «type» (naam `kort` = klassenaam, of `dynql` = `<Entiteit>_<Klassenaam>`), meervoudig → `[T!]`, veld → scalar met `!` bij verplicht; root-velden en argumenten uit een api-profiel (`persoon(bsn)`, `inkomens(jaren)`), later uit `dynql`'s eigen conventies (`full_<padnaam>(id)`, lijst-args). Levert ook de **kruisverbanden**: canoniek element ↔ GraphQL-veld (`Persoon.Naam.roepnaam` ↔ `Naam.roepnaam`), de padtabel als koppelingen-matrix |
| **GraphQL → canoniek** | `canoniek-uml/graphqlNaarV3.js` | spiegel van `oasNaarV3.js`: object-typen → entiteiten; een type dat alleen via één ouder bereikbaar is → GE van die ouder; gedeeld bereikbaar → entiteit + relatie. Precies hier wordt het type-versus-pad-punt (analyse §2.1) concreet: GraphQL kent alleen typen, het canoniek model wil weten langs welk pad |
| **toegangsregel → GraphQL** | koppelingen | een Gegevensselectie wijst naar `(graphql-schema, Persoon.inkomens)`; de bundel-compiler leest `covers_fields`/`covers_types` uit de koppelingen in plaats van uit een padtabel. Via canoniek → GraphQL volgt het ook indirect: regel → registerpad → veldsleutel |
| **dynql ↔ V3** | drift-check | introspectie-import vergeleken met de V3-projectie: ontbrekende/extra typen en velden als "Controle"-meldingen, en de digest van het getekende SDL als bundel-pin |

Dit is de plek waar "model als generieke, canonieke waarheid" aantoonbaar wordt: één
V3-bestand, en uit de koppelingen rollen SDL, padtabel en bundel.

## 8. Validatie op profielniveau

Zoals de typecontract-validatie bij canoniek-uml en de Controle-meldingen bij Toegangsspraak,
niet-blokkerend:

- unieke typenamen; velden uniek per type; namen volgens `[_A-Za-z][_0-9A-Za-z]*`;
- elke `typeExpressie` verwijst naar een bestaand type of ingebouwde scalar;
- een object dat een interface implementeert heeft al diens velden met compatibel type;
- union-leden zijn object-typen; argument- en inputvelden gebruiken alleen input-typen;
- `schema` heeft een `query`-root; root-typen zijn object-typen;
- introspectie-namen (`__…`) zijn gereserveerd.

`graphql-js` heeft `validateSchema` dat dit grotendeels doet; de meldingen vertalen naar
element- en veldverwijzingen zodat de inspector erheen springt.

## 9. Wat bewust niet in v1

- **Federation en Relay**: directives en conventies op M1; pass-through, geen eigen
  elementtypen. Later eventueel een "federation-laag" zoals ArchiMate 4 twee profielen heeft.
- **Mutaties en subscriptions als aparte notatie**: het zijn gewone root-typen; de connector
  `root` draagt alleen het label. Het GBO-profiel weigert ze toch (draft-01).
- **Resolvers, dataloaders, uitvoering**: M0-zaken, geen schema.
- **Query-documenten** (persisted queries) als elementen: aantrekkelijk voor de PQ-set per
  afnemer (analyse §9), maar een eigen profiel ("GraphQL-operaties") op M1 van dit schema;
  eerst het schema.

## 10. Stappenplan

| # | Stap | Omvang | Oplevert |
|---|---|---|---|
| 1 ✅ | Descriptor `diagramprofielen/graphql/index.js` (elementtypen, veldtypen, connectoren, resolvers, `typeExpressie.js`) + unit-tests op het typecontract | 1–2 dagen | tekenbaar schema in Studio (via `maakDiagramActiviteit`, groep "modelleren") |
| 2 🔶 | (SDL ✅, introspectie open) Adapter import/export SDL + introspectie, roundtrip-tests op `gbo-persoon` en op een `dynql`-introspectie | 2 dagen | SDL-bestand ↔ diagram, menu Importeer/Exporteer |
| 3 | `v3NaarGraphql.js` + kruisverbanden naar de koppelingen-matrix; menu "Projecteer canoniek model" | 1–2 dagen | de GBO-projectie als knop, padtabel als koppelingen |
| 4 | Drift-check: introspectie vs. projectie, meldingen in de inspector; digest op het schema-element | 1 dag | H3 vóór deployment |
| 5 | Toegangsregel: Gegevensselectie mag naar het GraphQL-profiel wijzen; bundel-compiler (`authz/gbo-voorbeeld`) leest koppelingen | 1 dag | regels → `covers_fields` zonder Python-padtabel |
| 6 | `graphqlNaarV3.js` (spiegel van OAS → canoniek), met de GE/entiteit-heuristiek | 2 dagen, optioneel | import van een vreemd schema als canoniek-startpunt |

Stap 1–2 is het profiel; 3–5 is waar het de GBO-discussie raakt. Na stap 3 kan het slide-plaatje
"registerpad → veldsleutels" uit de presentatie live uit Studio komen.

## 11. Open vragen — besluiten 02-10-2026

| Vraag | Besluit (Mark) |
|---|---|
| Naamgeving default: `kort` of `dynql`? | **`kort`.** Typenamen zijn uniek binnen één domein; dat is de eis, en meer is niet af te dwingen. De prefix-vorm (`Persoon_Adres`) is geen default. Gevolg voor de projectie canoniek → GraphQL (stap 3): GE-namen moeten binnen het domein uniek zijn, en de validatie meldt een botsing in plaats van hem weg te prefixen |
| Waar leven argumenten en filters? | **In het GraphQL-model zelf** (optie d). De transformatie is roundtrip maar niet onveranderlijk: logisch model en GraphQL zijn niet één-op-één hetzelfde, in elke laag maak je keuzes. Filters zijn aanvullingen op het model. Wáár ze precies bewaard worden (naast de projectie, bij herprojectie samenvoegen) is nog open |
| Eén diagram of meer? | nog open; v1 maakt één diagram "Schema" |

## 12. Wat er gebouwd is (02-10-2026)

`web/vite/src/diagramprofielen/graphql/` — vier modules, plain JS, geen dependencies, 24 unit-tests
(`graphql.test.js`):

| Module | Rol |
|---|---|
| `index.js` | de descriptor: acht elementtypen op `class-box`, vier veldtypen, vijf connectoren, drie resolvers, rijen-layout met rijhoogte naar het langste type, `maakElement` |
| `typeExpressie.js` | `[Inkomen!]!` ontleden, terugschrijven, basisnaam, kardinaliteit |
| `sdl.js` | eigen SDL-parser en -serializer voor het typesysteem; fouten met regel en kolom; deterministische uitvoer |
| `adapter.js` | schema-document ↔ diagram-model, `leidVeldConnectorenAf`, `valideerSchema` |

Plus de activiteit `studio/activities/graphqlActivity.jsx` (preview, via Modelleren) met
*Importeer/Exporteer GraphQL-schema (SDL)*.

**Afwijkingen van het voorstel hierboven, met reden:**

- **Eigen parser in plaats van `graphql-js`** (§6). De SDL-grammatica van het typesysteem is klein;
  een eigen parser houdt het profiel zonder dependency en in node testbaar, zoals de
  Toegangsspraak-parser. `extend …` wordt nog niet ondersteund (heldere fout). Introspectie-import
  is daarmee nog niet gebouwd.
- **Argumenten als SDL-tekst op het veld**, niet als `sub-vak` (§3). De `sub-vak`-viewer blijkt het
  opname-mechanisme (deel in geheel), geen generieke geneste lijst. De node toont een veld met
  argumenten als weergave-regel `inkomens(jaren: [Int!])`; de inspector bewerkt de tekst.
- **Kardinaliteit: een lijst is altijd `0..*`** (§4), ook `[T!]!`. GraphQL kent geen "minstens één";
  `1..*` zou meer beloven dan het typesysteem zegt.
- **De typekiezer is een keuzelijst zonder vrije invoer**; het profiel biedt per type de vier
  gangbare vormen aan (`T`, `T!`, `[T!]`, `[T!]!`). Andere vormen komen via import en blijven staan.
- **Geen lijn naar enums en scalars** als veldtype (de expressie staat in de regel); een argument
  krijgt alleen een lijn naar een input-type.
- **`implements`, `lid` en `root` zijn getekende connectoren** (de bron voor de SDL); `veldtype` en
  `argumenttype` zijn afgeleid. Het afleiden gebeurt bij import; de export leest alleen de velden,
  dus een verouderde lijn kan de SDL niet bederven. Automatisch herafleiden bij elke
  veldwijziging in de editor is nog niet aangesloten (er is geen profielhook voor).
- **Validatie** zit in `valideerSchema` en komt bij de export als commentaar bovenaan; een eigen
  paneel in de inspector is er nog niet.

**Geverifieerd:** het GBO-schema (`authz/gbo-voorbeeld/bundel/schema.graphql`) en een schema met
alle taalonderdelen gaan byte-gelijk heen en terug door SDL → diagram → SDL.
