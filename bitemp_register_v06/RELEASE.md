# Release checklist

## UML-editor + IDE: React 18 concurrent-mode + XyFlow ResizeObserver race-fix (2026-04-26)

**Kritieke bug-fix**: crash op elke paginalaad van editor-v2 (`/react/editor-v2.html`) en IDE (`/react/ide.html`).

### Symptomen
- Bij paginalaad: error boundary toont "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node"
- Crash treedt op na initiële commit van MetamodelEditor/DiagramCanvasInner
- Zou willekeurig lijken, maar reproduceerbaar op elke laad (niet HMR-gerelateerd)
- StrictMode al uitgeschakeld; single-mount pattern al aanwezig in EditorV2Page

### Root cause: React 18 concurrent mode + XyFlow 12 ResizeObserver race
1. React 18 committeert DOM in meerdere microtask-fases
2. XyFlow 12 plaatst een `ResizeObserver` in `useLayoutEffect` op het canvas-element
3. In Chrome vuurt `ResizeObserver` **synchroon** zodra `observe()` wordt aangeroepen (als element al dimensies heeft)
4. Dit gebeurt nog tijdens React's commit-fase → XyFlow probeert interne state te updaten en DOM-nodes te verplaatsen terwijl React nog bezig is met DOM-transfer
5. Resultaat: DOM-tree-mismatch, `removeChild` op node die React nog niet heeft vrijgegeven

### Fix: defer ReactFlow mount één animation frame
```js
const [reactFlowGereed, setReactFlowGereed] = useState(false);
useEffect(() => {
  const raf = requestAnimationFrame(() => setReactFlowGereed(true));
  return () => cancelAnimationFrame(raf);
}, []);

// In JSX:
{reactFlowGereed && <ReactFlow ... >...</ReactFlow>}
```

Hierdoor:
- React's initiële commit is compleet vóór `requestAnimationFrame` fired
- ResizeObserver vuurt in een schone phase, niet tijdens commit
- All state (nodes, edges) is al geïnitialiseerd; de ~16ms delay is onmerkbaar

**Bestanden**:
- [web/vite/src/umleditor/components/MetamodelEditor.jsx](web/vite/src/umleditor/components/MetamodelEditor.jsx#L292-L300) — editor-v2 fix
- [web/vite/src/ide/DiagramCanvas.jsx](web/vite/src/ide/DiagramCanvas.jsx#L728-L736) — IDE fix

**Impact**: beide pagina's nu stabiel laadbaar; geen functionaliteitsverandering.

---

## UML-import: RuwUML-tussenformaat + parser/adapter-splitsing (2026-04-26)

Derde slice van de UML-import-refactor. Doel: alle editor-conventies
(stereotype-resolutie, ID-generatie, kleurkeuze, generalisatie-richting,
edge-flags) op één plek concentreren, zodat de tekstuele parsers klein en
puur blijven en bug-fixes niet drie keer hoeven te landen.

### Nieuw: RuwUML als operationeel formaat
- `web/vite/src/umleditor/import/ruwuml.js` is uitgebreid van een spec-only
  bestand naar een volwaardige module: JSDoc-typedefs voor `RuwUMLModel` /
  `RuwUMLNode` / `RuwUMLEdge` / `RuwUMLVeld`, plus een nieuwe
  **`ruwUMLNaarEditor()`-adapter** die alle interpretatie naar editor-shape
  doet (stereotype-mapping, ID/kleur/positie, edge-conversie,
  auto-aanmaak van ontbrekende doel-nodes).
- Nieuw uitgebreid ontwerpdocument: [`docs/RAWUML.md`](docs/RAWUML.md) met
  het waarom, het formaat, de pijplijn en de motivatie waarom XMI buiten
  RuwUML blijft.

### Refactor: pure parsers
- `importMermaid.js` is van 309 → ~175 regels gegaan: alleen tokenisatie en
  block-parsing. `mermaidNaarRuw()` is nu apart geëxporteerd. `importVanMermaid`
  is een 1-liner: `ruwUMLNaarEditor(mermaidNaarRuw(text))`.
- `importPlantUML.js` op dezelfde manier herschreven (van 335 → ~175 regels,
  `plantumlNaarRuw()` apart geëxporteerd).
- `importXMI.js` blijft op zijn eigen pad — XMI heeft stabiele IDs, EA's
  AssociationClass-patroon en MIM-tagged-values die direct op editor-vorm
  mappen; een tussenstap zou informatie verliezen. Zie de uitleg in
  `docs/RAWUML.md` §6.

### Onveranderd
- De orphan-helpers (`detecteerOrphans`, `pasOrphanActiesToe`) en de
  OrphanDialog blijven ongewijzigd; ze werken op de editor-shape ná conversie
  en zijn dus identiek bruikbaar voor alle drie de bronnen.

## UML-editor + IDE: orphan-detectie bij UML-import + textuele formaten in IDE-importdialoog (2026-04-26)

Tweede blok van de UML-import-refactor (zie `docs/ontwerpgedachten/KISS/VAC/2026-04-26 refactor uml to v3.md`). Doel: voorkomen dat losliggende GE/relatie-nodes na een UML-import stilletjes als "modelleerfout" in het canvas blijven hangen, en dezelfde Mermaid/PlantUML/XMI-bronnen ook vanuit de IDE kunnen worden ingelezen.

### Nieuw: RuwUML-tussenformaat (JSDoc-spec) + orphan-helpers
- `web/vite/src/umleditor/import/ruwuml.js` documenteert via JSDoc een neutraal tussenformaat (`RuwUMLModel`/`RuwUMLNode`/`RuwUMLEdge`) tussen de drie parsers en de editor. In deze iteratie is alleen de spec gevuld; de drie parsers blijven editor-shape produceren.
- Twee runtime-helpers werken **direct op de editor-shape** (`{nodes, edges}`) en zijn dus meteen bruikbaar zonder parser-refactor:
  - `detecteerOrphans(graaf)`: vindt GE-nodes zonder compositie-edge vanuit een entiteit en relatie-nodes zonder koppeling naar een entiteit/anker.
  - `pasOrphanActiesToe(graaf, orphans, keuzes)`: voert per orphan de gekozen actie uit (`placeholder`, `overslaan`, `abort`) en geeft een nieuwe graaf + samenvattingsregels terug.
- Placeholders krijgen een eigen kleur (`#fde68a`) en een vlag `isPlaceholder: true`.

### Nieuw: OrphanDialog
- `web/vite/src/umleditor/components/OrphanDialog.jsx` toont per orphan naam + reden + drie radio-keuzes en een bulk-actie-dropdown ("alles op …"). Bevestigen levert een `keuzes`-map op; annuleren breekt de hele import af.
- Gestyled als overlay-modal in de bestaande IDE/editor-paletkleuren (geen nieuwe CSS-bestanden).

### Editor-v2: import-handlers door één wrapper
- `MetamodelEditor.jsx` heeft een nieuwe `importMetOrphanCheck(importerFn, accept, bron)`. De drie handlers (`handleImportXMI`, `handleImportMermaid`, `handleImportPlantUML`) zijn een 1-liner geworden die deze wrapper aanroepen. Bij orphans verschijnt de OrphanDialog; bij `abort` wordt er niets in het canvas geladen.

### IDE-importdialoog: textuele UML-bronnen + auto-detect
- `web/vite/src/ide/ImportDialog.jsx` accepteert nu naast V3/IDE-v1 JSON ook `.mmd`, `.md`, `.puml`, `.plantuml`, `.xmi`, `.xml` en `.txt`. Het formaat wordt automatisch bepaald op extensie en (bij ambigue extensies als `.md`/`.txt`/`.xml`) op een korte content-sniff (`classDiagram` → Mermaid, `@startuml` → PlantUML, `<XMI`/`<?xml` → XMI).
- Voor textuele formaten wordt direct na het kiezen van het bestand de juiste parser gedraaid; orphans verschijnen in dezelfde `OrphanDialog` als in de editor. Daarna wordt de graaf via `editorNaarV3Model` omgezet naar V3 en als V3-bestand aan de bestaande IDE-importflow doorgegeven (de `onImport`-handler hoeft dus niets te weten van de bron-syntax).

### Bewust niet in dit blok
- De drie parsers leveren nog steeds editor-shape op; de RuwUML-conversie + gedeelde `ruwUMLNaarEditor`-adapter staat in een vervolgslice. De huidige orphan-laag werkt op de editor-shape, dus dit blokkeert geen nieuwe functionaliteit.
- ENT→GE-cast en handmatige conversie naar associatieklasse blijven uitgesteld.

## UML-editor: import-roundtrip-bugs + stereotype-aliassen + ruwe save (2026-04-26)

Eerste blok van de UML-import-refactor (zie `docs/ontwerpgedachten/KISS/VAC/2026-04-26 refactor uml to v3.md`). Dit blok lost concrete roundtrip-bugs op en voegt enkele kleine, defensieve uitbreidingen toe; de bredere architectuur-refactor (RuwUML-tussenformaat, IDE-integratie, placeholder-dialoog) volgt in een volgend blok.

### Ingetrokken: ASOC-promotie bij import van directe entiteit↔entiteit-edges
- **Eerdere aanpak (verwijderd)**: een gedeelde helper `promoteEntiteitAssociaties` zette directe entiteit↔entiteit-edges direct na de import om naar het ASOC-patroon (anker + relatie-node + drie edges).
- **Reden van intrekking**: dit was te invasief voor eenvoudige UML-imports. Een associatieklasse ´zonder velden´ heeft conceptueel geen apart anker; de relatie í´s het anker (één bubble). Het patroon hoort een handmatige modelkeuze te zijn, niet een automatische import-bewerking. De ENT→GE-cast en de handmatige conversie naar associatieklasse landen in blok 2.
- **Bestanden**: `importMermaid.js`, `importPlantUML.js` — alleen het aanroepen is verwijderd. `promoteEntiteitAssociaties` blijft als ongebruikt hulpmiddel in `_helpers.js` staan voor toekomstig gebruik.

### Bug: PlantUML-import verloor generalisatie
- **Oorzaak**: `maakEdge` in `importPlantUML.js` had geen detectie voor `<|--`/`--|>`/`<|..`/`..|>` en zette zulke pijlen weg als gewone associaties (of als dependency wegens de `..`).
- **Fix**: generalisatie-detectie + bron/doel-omdraaiing analoog aan `importMermaid.js`. Dependency-detectie scherper gemaakt: `..` zonder `|` is dependency, `..|` is generalisatie.
- **Bestand**: `web/vite/src/umleditor/import/importPlantUML.js`.

### Uitbreiding: stereotype-aliassen + `bitemp::metatype` taggedValue
- Nieuwe gedeelde resolver `mapStereotypesNaarMeta` in `_helpers.js` met aliasmap voor: `ent`/`entiteit`/`objecttype`, `ge`/`gegevenselement`/`gegevensgroeptype`, `rel`/`relatie`/`relatiesoort`/`relatieklasse`/`associationclass`, `reflijst`/`referentielijst`, `refitem`/`referentielijstitem`, `refitems`/`referentielijstitems`, `refinstantie`/`referentielijstinstantie`, plus modifiers `materieel`, `datatype`/`gestructureerd datatype`, `enum`/`enumeration`.
- Mermaid en PlantUML gebruiken voortaan deze resolver; subtypes (`entiteitSubtype`, `relatieSubtype`) worden meegenomen.
- XMI-import herkent nu ook taggedValue `bitemp::metatype` en behandelt die via dezelfde alias-resolver. MIM-stereotypen blijven werken via de bestaande `mapStereotypeNaarMetatype`-fallback.
- **Bestanden**: `_helpers.js`, `importMermaid.js`, `importPlantUML.js`, `importXMI.js`.

### Toevoeging: rauwe editor-staat opslaan (`.editor-flow.json`)
- Extra toolbar-knop **💾⚡ Ruwe staat** slaat alleen `{ nodes, edges }` op met markering `_format: "editor-flow-v1"`. Bedoeld voor ontwikkeltijd: een werkende canvas-staat bewaren ook als die nog niet als V3 geldig is.
- Laden vereist geen wijziging: `handleLoad` herkende `payload.flowState` al en past die direct toe.
- **Bestanden**: `MetamodelEditor.jsx`, `panels/Toolbar.jsx`.

### Bug: `removeChild` runtime-crash na hot-reload van editor-v2
- **Oorzaak**: de HMR-handler in `main.jsx` triggerde alleen een volledige reload bij wijzigingen in `/uml-editor/src/` (oude editor-locatie) en `/web/vite/src/ide/`, niet bij `/web/vite/src/umleditor/` (de huidige editor-v2-module). Een partiële HMR-update liet React Flow met stale DOM-nodes achter; de eerstvolgende render gooide `Failed to execute 'removeChild' on 'Node'`.
- **Fix**: `/web/vite/src/umleditor/` toegevoegd aan de `heeftDomIntensieveWijziging`-check, zodat wijzigingen in de editor-v2-module ook een volledige page-reload veroorzaken.
- **Bestand**: `web/vite/src/main.jsx`.

### Bug: `removeChild`-crash bij eerste paginalaad van editor-v2
- **Echte oorzaak (al langer bestaand)**: `EditorV2Page` rendert eerst de editor met demo-data en doet daarna in een `useEffect` een fetch naar `/api/schema/versies`. Bij respons werd `setData(...)` én `setEditorKey(k+1)` aangeroepen om de editor met nieuwe data te remounten. Die geforceerde unmount-tijdens-startup race't met React Flow's interne DOM-cleanup (portals, observers); de reconciler ploft dan op `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node`. Symptomen: foutoverlay direct na harde reload (Cmd+Shift+R), Vite herstarten "loste" het op omdat de timing dan toevallig weer goed viel.
- **Fix**: editor wordt pas één keer gemount nádat de fetch klaar is (succes of fail-fallback naar demo). Tijdens het laden toont de pagina een lichte placeholder. `editorKey` is verwijderd; geen remount-trick meer nodig.
- **Bestand**: `web/vite/src/pages/EditorV2Page.jsx`.

## UML-editor: Mermaid-import overerving + domeinmenu multi-selectie (2026-04-26)

### Bug: Mermaid import herkende generalisatiepijlen niet
- **Oorzaak**: het regex-patroon voor pijlsyntax (`[\ \-\.\*<>o]+`) bevatte geen `|`, waardoor `<|--` en `--|>` pijlen (generalisatie/overerving) stil werden genegeerd en geen edge aanmaakten.
- **Fix**: `|` toegevoegd aan de tekenklasse in `importMermaid.js` → `[\ \-\.\*<>o|]+`. Generalisatie-edges worden nu correct herkend en als `isGeneralization: true` edge aangemaakt.
- **Bestand**: `web/vite/src/umleditor/import/importMermaid.js`

### Verbetering: domein wijzigen toegankelijk bij multi-selectie met edges
- **Probleem**: bij een selectie van meerdere nodes én edges vuurt React Flow `onSelectionContextMenu` in plaats van `onNodeContextMenu`. Hierdoor was het domein-wijzigen-menu niet bereikbaar via rechtsklik op een multi-selectie.
- **Fix**: `toonContextMenu` detecteert nu of de selectie model-nodes bevat (`heeftDomeinWijziging`-vlag). `ContextMenu` toont in het uitlijnmenu onderaan een **Domein wijzigen**-sectie (met bestaande domein-snelknoppen + vrij invoerveld) wanneer deze vlag actief is.
- **Bestanden**: `MetamodelEditor.jsx`, `ContextMenu.jsx`

---

Korte checklist voor een API-release met losse DB-stack.

## Replay: betere foutdiagnose + preview; fix GE-veldnaam-disambiguatie (2026-04-19)

### Bug: GE-veldnaam "naam" werd gekoppeld aan verkeerde entiteit bij replay
- **Oorzaak**: `UnmarshalJSON` in `model/REST request models.go` gebruikte `MetaRegistry.GetByVeldnaam(veldnaam)` voor het opzoeken van een representatietype op JSON-veldnaam. Omdat meerdere types dezelfde `Veldnaam` kunnen hebben (bijv. `ApiStandaard_Naam` en `NatuurlijkPersoon_Naam` → beide "naam"), werd de eerste match (niet-deterministisch) geretourneerd, wat leidde tot fouten als `NatuurlijkPersoon_Naam_Input` werd gebruikt terwijl `ApiStandaard_Naam` werd verwacht.
- **Fix**: `UnmarshalJSON` extraheert nu de JSON-sleutels uit de inner payload (bijv. `apistandaard_id`, `naam`) en roept de reeds bestaande `MetaRegistry.GetByVeldnaamMetPayload(veldnaam, payloadKeys)` aan. Die disambigueert op `EntiteitIDKolom` (bijv. `apistandaard_id` → `ApiStandaard_Naam`).
- **Impact**: replay files met GE's waarvan de veldnaam gedeeld wordt door meerdere types werken nu correct.

### Backend: uitgebreidere foutmeldingen in de registreer-handler
- De wijziging-loop in `handlers/registration_handlers.go` gebruikt nu een index (`wijzigingIdx`).
- Alle foutmeldingen bevatten nu `wijziging[N]`, de `representatienaam` én de `veldnaam`, zodat direct duidelijk is welke stap in de replay-body faalde.
- Oud: `"failed to handle opvoer van NatuurlijkPersoon_Naam: ..."`.
- Nieuw: `"wijziging[3]: opvoer van ApiStandaard_Naam (veldnaam=naam) mislukt: ..."`.

### Frontend: replay-preview toont de geïmporteerde file
- Na import van een replay file wordt de volledige JSON opgeslagen en getoond in de preview-sectie onderaan de pagina (inclusief bron, export-tijdstip en aantal entries). Vóór import blijft het voorbeeld van de huidige registratieselectie zichtbaar.
- `maxHeight` van de preview verhoogd naar 400px.

### Frontend: uitklapbare fout-details per replay-entry
- Foutrijen krijgen een rode achtergrond en zijn klikbaar (▸ / ▾).
- De detail-rij toont side-by-side:
  - **Request body** (zoals verzonden, inclusief ID-offsets).
  - **Response body** (volledige API-response, inclusief de nieuwe gedetailleerde foutmelding).
- De API `error`-string uit de response body wordt direct getoond in de "Fout / details" kolom.

---

## GraphQL enum cache fix — `rol` en andere enum-velden correct in response (2026-04-18)

### Bug: enum-velden (o.a. `rol`) waren `null` in GraphQL-responses
- **Oorzaak**: `schemaTypeVoorReflectType()` retourneerde `"string"` als Go-typenaam voor alle string-based enum-types (Gemeenterol, Fase, Organisatietype, etc.). `makeEnumType()` cachete het eerste enum-type onder key `"string"` in `enumTypeCache`, waarna alle volgende enums diezelfde (verkeerde) enum kregen. Bij serialisatie vond graphql-go de werkelijke waarde niet terug in de verkeerde enum → `null`.
- **Fix** (`dynql/field_builder.go`): in `fieldsVoorMeta()` wordt nu de werkelijke Go-typenaam (bijv. `"Gemeenterol"`) als enum-naam doorgegeven aan `goTypeToGraphQL()`, zodat elke enum een unieke cache-entry krijgt.
- **Impact**: alle enum-velden in alle hub+data types (InitiatiefGemeente.rol, Initiatief.fase, Organisatie.organisatietype, etc.) retourneren nu correcte waarden.
- **Documentatie**: zie `docs/graphql-enum-handling.md` voor de volledige analyse.

### Debug logging verwijderd
- Tijdelijke `[DEBUG laadHubKinderen]`, `[DEBUG entityToMap]` en `[DEBUG flattenEntityMap]` prints in `dynql/query_resolvers.go` zijn verwijderd.

### Frontend: pipe-karakter in data breekt markdown-tabellen niet meer
- **Oorzaak**: `renderTemplate()` injecteerde ruwe datawaarden (met `|`) in markdown-templates; `splitTabelRij()` splitste op álle pipes.
- **Fix**: `renderTemplate()` (`PublicatieDetail.jsx`) escaped pipes als `\|` bij invoeging. `splitTabelRij()` split nu alleen op niet-geëscapede pipes (lookbehind regex) en unescaped daarna — in zowel `PublicatieDetail.jsx` als `MarkdownWeergave.jsx`.

## Publicatie detail — GraphQL query builder, `[key=value]` filter, weergavenaam-verrijking (2026-04-17)

### Frontend: `[key=value]` filter in veldpad-templates
- Template-placeholders ondersteunen nu filter-syntax: `{{gemeenten[rol=Realiseert].weergavenaam}}` filtert een array op het veld `rol` vóór verdere navigatie.
- Geïmplementeerd in `parseSegment()` en `resolveVeldpadUitContext()`, verplaatst naar `publicatieUtils.js`.

### Frontend: `data`-segment skip (REST ↔ GraphQL transparantie)
- Templates die `producten.data.type` gebruiken, werken nu ook op GraphQL-responses waarbij `data` al afgevlakt is: het `data`-segment wordt geskipt als de key ontbreekt.

### Frontend: GraphQL query builder in `PublicatieDetail`
- Als een WeergaveDefinitie een `detailTemplate` heeft, haalt `PublicatieDetail` data op via GraphQL in plaats van REST `/full/`.
- Functies `extractVeldpaden()`, `buildSelectieTree()`, `treeNaarGql()`, `buildGraphQLQuery()` bouwen een gerichte GraphQL-query op basis van de template-placeholders.
- Voordeel: diepe navigatie via forward FK relaties (bijv. contactpersoon-naam via Initiatief → ContactpersoonRelatie → NatuurlijkPersoon) werkt nu zonder extra REST-calls.
- Herbruikbare functies zijn verplaatst naar `web/vite/src/publicatie/publicatieUtils.js`.

### Backend: weergavenaam-verrijking in GraphQL-responses (`dynql/query_resolvers.go`)
- `verrijkWeergavenamen()` wordt aangeroepen na `flattenEntityMap()` op alle vier call-sites (full entity, full list, forward relation, reverse relation).
- Per kind-entiteit met een `SecondaireEntiteitIDKolom` en een `IsWeergaveVeld`-AfgeleidVeld worden de FK-waarden gebatcht opgehaald, de weergavenaam berekend via `berekenWeergavenaamVlak()` + `evalueerCELConcatenatieVlak()`, en in de response-map ingezet.
- Nieuwe helperfuncties: `laadWeergavenamenBatch()`, `berekenWeergavenaamVlak()`, `evalueerCELConcatenatieVlak()`, `navigeerAfgeleidPadVlak()`, `extractIntFromMap()`.

### Tests toegevoegd
- **Go** (`handlers/full_handlers_weergavenaam_test.go`): 12 unit tests voor `evalueerCELConcatenatie`, `navigeerAfgeleidPad`, `berekenWeergavenaamVanEntiteit` — geen DB nodig, volledig in-memory.
- **JS** (`web/vite/src/publicatie/publicatieUtils.test.js`): 27 unit tests voor `parseSegment`, `segmentNaarString`, `resolveVeldpadUitContext`, `extractVeldpaden`, `buildSelectieTree`, `buildGraphQLQuery` — gedraaid met `node --test`.

## Publicatie markdown — tabelweergave hersteld (2026-04-16)

- Oorzaak: de lokale markdown-renderer in de frontend ondersteunde geen GFM-tabellen, waardoor tabelsyntax als platte tekst werd weergegeven op de publicatiepagina en in de markdown-preview.
- Oplossing: tabelparsing toegevoegd aan `markdownNaarHtml()` in zowel `web/vite/src/publicatie/PublicatieDetail.jsx` als `web/vite/src/components/editor/MarkdownWeergave.jsx`.
- Styling: tabelopmaak toegevoegd in `web/vite/src/styles/common-ground-theme.css` voor zowel `.cg-markdown-viewer__body table` als `.cg-form-card table`.
- Resultaat: geldige markdown-tabellen renderen nu als HTML-tabel in publicatie en editor-preview.

## Publicatie markdown — HTML entities niet meer zichtbaar (2026-04-16)

- Oorzaak: placeholderwaarden in `PublicatieDetail` werden eerst ge-escaped in `renderTemplate()` en daarna nogmaals via `markdownNaarHtml()`, waardoor tekst als `API&#39;s &amp; opslag` zichtbaar werd.
- Oplossing: placeholder-invoeging in `renderTemplate()` gebruikt nu ruwe tekst; escaping blijft centraal in `markdownNaarHtml()`.
- Resultaat: waarden uit de API worden weer normaal getoond, bijvoorbeeld `API's & opslag`.

## CG Portfolio — modeluitbreiding extra velden + meervoudige weergave (2026-04-16)

### DB-migratie: `20260415_add_cg_beoordeling_etalage_extra_velden.sql`
Voer dit script uit op de applicatiedatabase (`bitemp_go_db_v06`) vóór de volgende backend-start. Alle kolommen zijn nullable (backward-compatible).

Nieuwe kolommen op bestaande tabellen:

| Tabel | Kolom | Type | Toelichting |
|---|---|---|---|
| `initiatief_planning_data` | `obstakels` | TEXT | Beschrijving van obstakels voor de planning |
| `initiatief_planning_data` | `verwacht_ready_datum` | DATE | Verwachte datum van gereedmelding |
| `initiatief_product_data` | `vervangt_ouder_product` | BOOLEAN | Vervangt dit product een ouder product? |
| `initiatief_bijdrage_data` | `score` | INTEGER | Numerieke beoordelingsscore |
| `initiatief_initiatiefinfo_data` | `aanmeldingsdatum` | DATE | Datum van aanmelding van het initiatief |

Nieuwe tabellen (`initiatief_beoordeling`, `initiatief_beoordeling_data`, `initiatief_beoordeling_aanvang`, `initiatief_beoordeling_einde`, `initiatief_etalage`, `initiatief_etalage_data`) worden automatisch aangemaakt via Bun `IfNotExists()` bij backend-start — geen handmatige DDL nodig.

### Backend: meervoudige weergavenaam-verrijking (`handlers/full_handlers.go`)
Relatie-hubs met een `SecondaireEntiteitIDKolom` én een `IsWeergaveVeld`-AfgeleidVeld (zoals `InitiatiefDomein`) krijgen nu automatisch een `weergavenaam`-veld meegeleverd in de `/full/`-response. De waarde wordt server-side bepaald door de doelentiteit (bijv. `Domein`) op te halen en het AfgeleidVeld-pad te navigeren.

### Frontend: meervoudige veldpaden (`PublicatieTabel.jsx`)
`resolveVeldpad()` ondersteunt nu meervoudig `momentvoorkomen`: bij een GE/relatie met meerdere actieve items worden alle waarden verzameld en samengevoegd met `", "`. Voorbeeld: `"initiatief_domeinen.weergavenaam"` geeft `"Standaarden, Componenten"`.

### Weergave replay bijgewerkt
`registraties-replay-init-standaard-weergavedefinities.json`: kolom `"Domeinen"` (veldpad `"initiatief_domeinen.weergavenaam"`) toegevoegd aan de Initiatief-standaardweergave.

### Frontend: filter voor meervoudige kolommen (`PublicatieTabel.jsx`)
De globale zoekfunctie en per-kolom-filter werken nu ook correct voor meervoudige veldpaden (bijv. `"initiatief_domeinen.weergavenaam"`).

**Oorzaken van het probleem:**
1. TanStack Table kan kolom-IDs met punten (`.`) intern inconsistent afhandelen.
2. Kolommen gebaseerd op `accessorFn` + een verouderde `typeMetaByTypenaam`-closure konden `null` teruggeven in de filter-fase, ondanks correct tonen in de cell-renderer.

**Oplossing (dubbele aanpak):**
- `sanitizeKolId()`: vervangt punten in veldpaden door `__` voor veilige TanStack-sleutels.
- `resolvedData` memo: pre-berekent alle kolomwaarden upfront (inclusief meervoudige samenvoegingen) als directe string-properties op elke rij.
- Kolommen gebruiken nu `accessorKey` (eenvoudige string) i.p.v. `id + accessorFn`, zodat TanStack de waarde rechtstreeks uit `resolvedData[sanitizeKolId(veldpad)]` leest.
- `standaardSortering` ID is eveneens gesaniteerd.

Resultaat: filter en sortering werken nu voor alle kolomtypen — enkelvoudig en meervoudig.

## Editor v2 — dependency visibility & roundtrip fix (2026-04-08)

- `«use»` dependency-edges kunnen nu per stuk of per doel-node verborgen/getoond worden via rechtsklik in editor v2.
- Rechtsklik op een **stippellijn** → `Verberg deze dependency`.
- Rechtsklik op een **enum** of **gegevenstype** → `Verberg dependencies` / `Toon dependencies` voor alle inkomende `«use»`-lijnen.
- De metadata voor deze lijnen (`id`, `sourceHandle`, `targetHandle`, `hidden`) blijft nu behouden in **V3 JSON** via `useEdges[]`.
- Daarnaast blijft deze info nu ook behouden bij **editor → V3 → codegen → MetaRegistry → V3 → editor** roundtrips, doordat de codegenerator `useEdges[]` opslaat in `EditorLayout.UseEdges` in de gegenereerde `*_metaregistry.go` bestanden en de V3 exporter die weer teruggeeft.

## Frontend visual tweak (2026-04-01)

- Index visualisatie: centrale entiteitstekst schaalt nu mee met de lengte van de weergavetekst in de representatiekaart.
- Effect: lange labels (zoals bij Locatie-adressen) worden iets kleiner getoond dan korte labels, zodat de verhouding met NatuurlijkPersoon visueel consistenter blijft.

## Runtime fix notes (2026-03-21)

- `GET /full/<entiteit>?t=<...>`: tijdelijke workaround toegevoegd voor een Bun v1.1.14 panic bij geneste `has-many` relaties met callback-filters.
- Symptoom: `reflect: call of reflect.Value.Field on zero Value` tijdens `relation.selectMany`.
- Aanpak: peiltijdstip-filter blijft op hub-niveau actief; geneste hub-kinderen (`Data`, `Aanvang`, `Einde`) worden tijdelijk niet mee-geladen in dezelfde full-query.
- Trade-off: full-responses bevatten tijdelijk geen geneste hub-kinderen; clients moeten hiervoor (tijdelijk) dedicated endpoints gebruiken.
- TODO: na Bun-upgrade opnieuw valideren en callback-filter op geneste relaties herstellen.
- DB startup fix: bestaande functie `f_formele_wijziging_op_peil(timestamptz)` wordt nu eerst gedropt en daarna opnieuw aangemaakt.
- Reden: PostgreSQL staat geen wijziging van de `RETURNS TABLE` signature toe via `CREATE OR REPLACE FUNCTION` (SQLSTATE `42P13`).
- Post-load hub-kinderen: `laadHubKinderenNaQuery()` laadt Data/Aanvang/Einde records in aparte batch-queries na de hoofd-query, als workaround voor de Bun v1.1.14 geneste has-many panic. Zie `ONTWERP_DATA_PATTERN.md` §15.
- Afgeleide formele tijd: `vulAfgeleideFormeleTijdVoorFullEntity()` daalt nu ook af in hub-kinderen (Data/Aanvang/Einde) bij peiltijdstip-filtering.

## V3.1 runtime extensie (2026-03-29)

- V3 modelformaat uitgebreid met **runtime/deployment metadata** (`V3Runtime`), zodat frontends (content editor, formulieren) en API-clients alle benodigde paden, tabelnamen en kolominfo rechtstreeks uit de model-API (`/api/schema/model`) kunnen lezen — zonder de oudere `viz/schema`-API nodig te hebben.
- Nieuw type `V3Runtime` in `model/v3_format.go` met velden: `veldnaam`, `padnaam`, `tabelnaam`, `idKolom`, `heeftPFK`, `entiteitIDKolom`, `klassenaam`, `relatieveAutoincrement`.
- `V3Runtime` wordt als `"runtime"` (omitempty) opgenomen in `V3Entiteit`, `V3Gegevenselement` en `V3Relatie`.
- `V3Veld` uitgebreid met OAS 3.1 `type`, `format` en `verplicht` velden, zodat frontends weten welk invoerveld ze moeten renderen.
- V3 exporter (`model/v3_exporter.go`) aangevuld met `runtimeVanMeta()` en `oasTypeVoorGoType()` helpers; alle drie de builder-functies vullen nu `Runtime` en de veld-loop vult `Type`/`Format`/`Verplicht`.
- Volledig backward-compatible: alle nieuwe JSON-velden gebruiken `omitempty`, codegen en UML-editor negeren ze.
- Nieuwe tests in `model/v3_exporter_test.go` voor runtime op entiteiten, relaties, en OAS type/format op velden.
- Zie `docs/v3_1_runtime.md` voor de volledige technische documentatie.

## Runtime fix notes (2026-03-26)

- Editor v2 laadt bij opstart standaard de nieuwste DB-versie via `GET /api/schema/versies` en daarna `model_url`.
- Statusbar toont nu modelbron (`[DB #id (status)]` of `[demo]`) en modelnaam met tooltip op modelbeschrijving.
- CORS-fix: middleware-registratie staat nu vóór alle route-definities, zodat ook `GET /api/schema/versies` CORS-headers teruggeeft voor Vite dev-origin (`localhost:5174`).
- Persistency-fix afgeleide velden: Go V3 struct-model uitgebreid zodat deze velden niet meer wegvallen bij `POST /api/schema/model`:
	- `V3Entiteit.AfgeleideVelden`
	- `V3Veld.Afgeleid`
	- `V3Veld.AfleidingsregelTaal`
	- `V3Veld.Afleidingsregel`
	- nieuw type `V3AfgeleidVeld`
- Effect: afgeleide velden blijven nu behouden na publiceren naar DB en reload van editor v2.

## 1. Nieuwe image bouwen en pushen

```bash
docker build --no-cache -t markwestbroek/bitemp-go-api:v06.00.01 .
docker push markwestbroek/bitemp-go-api:v06.00.01
```

## 2. API tag bijwerken op server

In `.env.docker`:

```dotenv
API_IMAGE=markwestbroek/bitemp-go-api:v06.00.01
```

### 2.1 Eerste deployment op een lege server

Als de doel-database nog niet bestaat, kun je de API deze eenmalig laten aanmaken:

```dotenv
AUTO_CREATE_DATABASE=true
```

Optioneel (aanrader): gebruik een admin connectie met CREATEDB-rechten:

```dotenv
DATABASE_ADMIN_URL=postgres://postgres:<password>@<host>:5432/postgres?sslmode=disable
```

Na succesvolle eerste start kun je `AUTO_CREATE_DATABASE` weer uitzetten of verwijderen.

## 3. API stack redeployen

```bash
docker compose -f docker-compose.api-only.yml up -d
```

## 4. Smoke test

```bash
curl http://<server-ip>:8082/version
curl http://<server-ip>:8082/viz/index_schema.html
docker logs --tail 100 bitemp-go-api-v06
```

## 5. Rollback (indien nodig)

Zet `API_IMAGE` terug naar vorige stabiele tag in `.env.docker` en redeploy:

```bash
docker compose -f docker-compose.api-only.yml up -d
```

## 6. Opruimen (optioneel)

Verwijder lokaal oude ongebruikte images:

```bash
docker image prune -a
```

Verwijder oude tags in Docker Hub volgens je bewaarbeleid.
