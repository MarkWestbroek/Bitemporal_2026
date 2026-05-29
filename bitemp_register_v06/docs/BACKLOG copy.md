`# Backlog — Bitemporeel Register v06

> **Samengesteld**: 2026-04-07 (laatst bijgewerkt 2026-04-28)
> **Bron**: alle `.md` bestanden, Go-code TODOs, planbestanden, ontwerpgedachten en frontend-code in de v06 codebase.
> **Doel**: één overzicht van alle openstaande features, ideeën, verbeterplannen en toekomstige stappen.

---

## 0. Acute issues — IDE / editor (2026-04-27)

### 0.1 Editor-v2 `removeChild` crash blijft levensgroot in beeld
- Symptoom: `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node` toont na elke pagina-edit; alleen Vite-dev-server herstart helpt voorlopig.
- Eerdere RAF-deferral fix in `MetamodelEditor.jsx` werkt niet voor alle render-paden (HMR vs cold load).
- Onderzoek: ResizeObserver in XyFlow vs HMR-replace, eventueel `key`-strategie of strict-mode toggling per pagina-load.

### 0.2 IDE mermaid-import is "kapot" — ✅ OPGELOST (2026-04-27)
- Was: alleen klassen kwamen binnen, geen velden, geen edges, geen default diagram.
- Root cause: IDE-pad ging `rawUMLNaarEditor` → `editorNaarV3Model` → `v3ModelNaarStore`. `editorNaarV3Model` (`src/umleditor/metamodel/types.js:669`) ondersteunt geen velden op entiteit-niveau (V3 EntiteitModel kent alleen GE's) en geen directe entiteit→entiteit edges, dus die werden stilletjes weggegooid.
- Oplossing — "rawUML"-pad zonder V3-tussenstap, lossless:
  - Nieuwe `rawEditorNaarStore(graaf, opts)` in `src/store/adapters.js`: 1-op-1 mapping van editor-nodes/edges naar IDE-store; behoudt velden op entiteiten en directe ent→ent edges; één overzicht-diagram met posities uit de bron.
  - `ImportDialog.jsx`: textuele UML-imports worden ingepakt als `_format: "raw-editor"` (niet meer als V3-envelope).
  - `pages/IdePage.jsx` `handleImportResult`: extra case `"raw-editor"` → `rawEditorNaarStore`.
  - `DetailsPanel.jsx`: voor entiteit met losse velden tonen we `VeldenEditor` met een waarschuwingsbanner ("gebruik B6 om te splitsen"). Bewerkbaar — kleine opschoning vóór splitsen blijft mogelijk.
  - Nieuwe `valideerVoorV3(state)` in `adapters.js`: vlagt entiteit met velden (V3-001) en directe ent→ent edges (V3-002). Pas bij export/build af te dwingen.
  - 19 nieuwe unit-tests in `src/store/rawEditorAdapter.test.js`, inclusief end-to-end tegen alle 5 demo-`.mmd`-bestanden. Totaal 110/110 groen.
- Vervolg (apart op te pakken): UI-banner bij "Exporteer V3" en "Publiceer/Rebuild" die `valideerVoorV3` aanroept en overtredingen toont met directe links naar B5/B6/B7.

### 0.3 Orphan-testbestanden 01–04 falen bij IDE-import — ✅ OPGELOST (2026-04-27)
- Direct gevolg van 0.2; opgelost via dezelfde `rawEditorNaarStore`-route.
- End-to-end tests toegevoegd in `src/store/rawEditorAdapter.test.js` voor alle 5 demo-bestanden (orphan-detectie + placeholder-roundtrip).

### 0.4 B5/B6/B7 alleen in IDE, niet in editor-v2 — ✅ OPGELOST (2026-04-28)
- B5 (Cast entiteit naar GE) en B6 (Splits velden naar GE's) zijn nu ook beschikbaar in de editor-v2 via een rechtsklik-contextmenu op losse entiteitnodes.
- Rechtsklik op enkelvoudige entiteit → nieuw "Refactor"-menu (menuType `"refactor"`) met:
  - **✂ï¸ Splits velden naar GE's...** (B6): opent dialoog met checkboxes per veld → maakt per veld een nieuw GE-node + compositie-edge; verwijdert velden uit de entiteit.
  - **ðŸ”„ Cast entiteit naar GE...** (B5): opent dialoog met dropdown voor de parent-entiteit → converteert node-type naar `gegevenselement`; verwijdert losstaande entiteit-edges; voegt parent-edge toe.
- Implementatie: `MetamodelEditor.jsx` (`handleSplitsBevestigen`, `handleCastBevestigen`, dialoog-state); `ContextMenu.jsx` (nieuw `"refactor"` menuType); `editor.css` (`.refactor-dialoog-overlay`, `.refactor-dialoog-*`, dark-mode).
- Undo-integratie: beide acties pushen een canvas-snapshot → `Ctrl+Z` werkt.
- Bij meervoudige selectie toont rechtsklik op entiteit nog steeds het domein-menu (ongewijzigd).
- B7 (nieuwe relatie tussen twee entiteiten) is in editor-v2 al ingebouwd via de drag-connect-flow; geen aparte actie nodig.

### 0.5 IDE B5 Cast-naar-GE: window.prompt → modal dropdown — ✅ OPGELOST (2026-04-28)
- Was: `handleCastNaarGE` in `DiagramCanvas.jsx` delegeerde naar `promptCastNaarGE` (window.prompt + genummerde tekstlijst).
- Opgelost: inline modal met `<select>` dropdown, analoog aan de B5-modal in editor-v2 en de B6-splits-modal in de IDE.
  - `castDialoog` state: `{ entId, entNaam, kandidaten: [{id, naam, domein}], parentId }`.
  - Kandidaten: alle entiteiten uit de store, gesorteerd op zelfde-domein-eerst, daarna alfabetisch, met domeinnaam als suffix.
  - `handleCastDialoogBevestigen` roept `castEntiteitNaarGE` uit `transformations.js` aan, verwerkt warnings via `window.confirm`, past lokale RF-state aan (node-type → `gegevenselement`), en roept `passToePatch`.
  - Import `promptCastNaarGE` verwijderd; `castEntiteitNaarGE` toegevoegd aan import uit `./transformations`.
  - Theming via CSS-variabelen (`--ide-panel-bg`, `--ide-input-bg`, etc.) — werkt in zowel light als dark mode.
- Bestanden: `DiagramCanvas.jsx`.

### 0.6 Node-tekstleesbaarheid in dark mode — ✅ OPGELOST (2026-04-28)
- Was: in dark IDE-modus waren `.node-typenaam`, `.veld-naam` en `.veld-type` licht van kleur (`#e2e8f0`, `#cbd5e1`, `#64748b`). Omdat node-achtergronden altijd lichte user-defined kleuren zijn (bijv. `#bbf7d0`), was de tekst slecht leesbaar.
- Opgelost: dark-mode CSS-overrides voor node-tekstkleuren zetten tekst altijd op donker:
  - `.node-typenaam`: `#0f172a` (was `#e2e8f0`).
  - `.veld-naam`: `#1e293b` (was `#cbd5e1`).
  - `.veld-type`: `#475569` (was `#64748b` — zelfde waarde maar nu bewust als "donker op lichte achtergrond").
  - `.node-veld.enum-waarde`: `#92400e` donkere amber (was `#fcd34d` geel — onleesbaar op lichte achtergrond).
  - `.node-veld.leeg`: `#64748b` (was `#475569` — iets lichter maar nog steeds leesbaar op wit/lichtgroen).
- Motivatie: node-achtergronden zijn altijd lichte, user-defined `kleur`-waarden; de dark-mode-state geldt voor de IDE-omgeving (panelen, toolbars, canvas), niet voor node-inhoud.
- Bestand: `editor.css`.

### 0.7 Project Browser — domein hernoemen + verwijderen
- Hernoemen: prompt voor nieuwe naam → controle of doelnaam al bestaat → alle elementen + diagrammen met `domein === oud` updaten.
- Verwijderen: confirm-dialoog met telling van te raken elementen + diagrammen → cascade delete of verplaatsen naar `(geen domein)`.
- Beide via rechter-muisklik op het domein-mapje in de Project Browser.

### 0.9 IDE-fixes: tab-naam sync + validatie scope & leesbaarheid + verwijder-acties (2026-04-29)

#### Tab-naam sync bij hernoemd diagram — ✅ OPGELOST
- Was: `renameDiagram()` in de Zustand-store updaten de diagramnaam in de store, maar de FlexLayout-tab hield zijn oude naam.
- Opgelost: nieuwe helper `renameDiagramTab(model, diagramId, nieuweNaam)` in `layoutConfig.js` loopt via `model.visitNodes()` alle tabs af, vergelijkt `node.getConfig().diagramId` en vuurt `FlexLayout.Actions.renameTab` af.
- Twee aanroeppaden gedekt: rechtsklik in Project Browser (`ProjectBrowser.jsx` prop `onRenameDiagram`) en F2-toets in `IdePage.jsx`.
- Bestanden: `src/ide/layoutConfig.js`, `src/ide/ProjectBrowser.jsx`, `src/pages/IdePage.jsx`.

#### Rebuild-validatie: domein-scope + leesbare foutmeldingen — ✅ OPGELOST
- Was: `validateV3Model()` valideerde altijd het volledige model, ook wanneer in de publiceer/rebuild-dialoog slechts één domein geselecteerd was. Foutmeldingen gebruikten index-context (`entiteiten[17].relaties[3]`) — onleesbaar.
- Opgelost:
  - Nieuwe optionele parameter `domeinFilter?: string[]` in `validateV3Model(v3, domeinFilter)`. Entiteiten waarvan `ent.domein` niet in de filter staat worden overgeslagen; cross-referentie-checks idem.
  - Context-strings gebruiken nu typenamen: `Trefwoord`, `Trefwoord.Rel_KA` i.p.v. `entiteiten[17].relaties[3]`.
  - `handleDialogChange` in `IdePage.jsx` hervalideert met de geselecteerde domeinen wanneer de `beschikbareDomeinen`-checkbox wijzigt.
- Bestanden: `src/validation/validateV3Model.js`, `src/pages/IdePage.jsx`.

#### A3: afgeleide velden op relatie triggeren ASOC-expansie — ✅ OPGELOST
- Was: in `DiagramCanvas.jsx` werd de forward/reverse ASOC-trigger berekend op basis van `(el.data?.velden || []).length`. Een afgeleid veld toevoegen aan een relatie zonder gewone velden expandeerde de relatie niet.
- Opgelost: trigger-formule telt nu zowel `velden` als `afgeleideVelden` mee — één regel wijziging in de `useEffect`. De canonieke `relatieVorm()`-helper in `shared/asoc.js` (al correct) blijft single source of truth voor de uiteindelijke vorm.
- Bestanden: `src/ide/DiagramCanvas.jsx`.

#### B6 + 0.7: diagram + domein verwijderen via PB-rechtsklik — ✅ OPGELOST
- Was: rechtsklik in de Project Browser kon alleen elementen verwijderen. Diagrammen en domeinen waren alleen via omwegen weg te krijgen.
- Opgelost:
  - `BrowserContextMenu.jsx`: twee nieuwe menu-items "ðŸ—‘ï¸ Verwijder diagram…" (op `diagram`-nodes) en "ðŸ—‘ï¸ Verwijder domein…" (op `domain`-nodes).
  - `layoutConfig.js`: nieuwe helper `closeDiagramTab(model, diagramId)` (analoog aan `renameDiagramTab`) sluit alle FlexLayout-tabs die op het diagram wijzen.
  - `ProjectBrowser.jsx`:
    - **Diagram verwijderen**: confirm met telling van nodes/edges + duidelijke melding dat elementen in het model blijven; daarna `deleteDiagram` + `onDeleteDiagram` callback voor tab-sluiten.
    - **Domein verwijderen**: tweetraps-confirm. Eerste vraag toont telling van elementen + diagrammen en bevestigt verwijdering van het domein-label (elementen verhuizen impliciet naar "(geen domein)"). Tweede vraag biedt cascade-delete (alle elementen + diagrammen ook weg). "(geen domein)" pseudo-domein wordt expliciet geweigerd.
  - `IdePage.jsx`: `handleDeleteDiagram` callback + `closeDiagramTab` import + nieuwe `onDeleteDiagram`-prop op `<ProjectBrowser>`.
- Bestanden: `src/ide/BrowserContextMenu.jsx`, `src/ide/ProjectBrowser.jsx`, `src/ide/layoutConfig.js`, `src/pages/IdePage.jsx`.

#### Visuele e2e-tester (Playwright) — ✅ SKELET TOEGEVOEGD (2026-04-30)
- Doel: agent (en mens) kan visueel UI-flows verifiëren met screenshots, traces en headless/UI-runs.
- Toegevoegd:
  - `web/vite/playwright.config.js`: chromium-project, baseURL via `PLAYWRIGHT_BASE_URL` (default `http://localhost:5173`), trace + screenshot on failure.
  - `web/vite/tests/e2e/01-ide-laadt.spec.js`: smoke — `/ide/` laadt en window-hook is beschikbaar.
  - `web/vite/tests/e2e/02-verwijder-diagram-context-menu.spec.js`: rechtsklik op diagram → "Verwijder diagram" zichtbaar → annuleren → diagram blijft staan.
  - `web/vite/tests/e2e/helpers/model.js`: `injectMinimaalModel(page)` — vult store met 2 entiteiten + 1 diagram via `window.__useModelStore`.
  - Dev-only hook in `src/store/useModelStore.js`: in `import.meta.env.DEV` exposeren we `window.__useModelStore` voor test-injectie. In productie tree-shaked.
  - npm scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:install`.
  - `.gitignore`: `playwright-report/`, `test-results/` uitgesloten.
- Setup eenmalig: `cd web/vite && npm i -D @playwright/test && npm run test:e2e:install`.
- Voorwaarde: vite dev-server moet draaien (taak `vite: dev server (v06)`).

---

### 0.8 Verzamelde UML-UI-issues / vragen (2026-04-29)

Inventarisatie van een batch vragen en bugs over editor-v2 én IDE. Ge­ordend op grootte; onderlinge afhankelijkheden gemarkeerd.

**A. Bugs (klein–middelgroot)**

1. **ASOC edge-labels worden niet getoond.** Eerder werkte de spiegel-conventie: het label *aan de ankerkant* van de A→anker edge is feitelijk het label *bij B*, en omgekeerd. Daarbij hoort: alleen de relatie­eigenschappen (multipliciteit bij A, multipliciteit bij B, naamLabelHeen, naamLabelTerug) bewerken op de relatie-node; edges zijn slechts visualisatie. Status: regressie — ergens gesneuveld.
2. **Lege veld-compartiment in entiteit-nodes** geeft een dubbele lijn. Wanneer een entiteit géén directe velden heeft (normale situatie in V3) moet het lege compartiment verborgen worden zodat er nog één scheidings­lijn overblijft.
3. **Afgeleid veld toevoegen aan een relatie expandeert deze niet naar associatie­klasse.** ✅ OPGELOST (2026-04-29) — trigger in `DiagramCanvas.jsx` telt nu ook `afgeleideVelden` mee.
4. **V3-import in IDE bouwt diagram niet op.** Bij import van een V3 JSON die uit editor-v2 komt (mét layout) wordt in de IDE geen diagram gereconstrueerd. Doel: editor-v2 als schetsblok kunnen gebruiken en naar IDE exporteren *inclusief* layout (posities, edges, anker-posities).

**B. Features (middelgroot)**

5. **Verplaatsbare edge-labels.** Labels (rolnamen, multipliciteiten, anker-labels) moeten met de muis verplaatst kunnen worden, met persistente offset. Persistentie­paden:
   - V3 JSON (per edge: `labelOffset`, eventueel per label-type)
   - IDE-store / IDE-export
   - DB-publicatie + MetaRegistry round-trip
   - Beide UI's (editor-v2 en IDE) moeten lezen/schrijven
6. **Diagram verwijderen via rechtsklik in IDE Project Browser.** ✅ OPGELOST (2026-04-29) — confirm met telling, sluit ook open tabs.
7. **Domein verwijderen via rechtsklik in IDE Project Browser.** ✅ OPGELOST (2026-04-29) — tweetraps-confirm met cascade-keuze; "(geen domein)" geweigerd.

**C. Backlog / nieuwe features (groter)**

8. **Notes en constraints als element.** UML-stijl note + constraint nodes met stippellijn-anchor naar een element of (liefst) ook naar een edge. Zowel in editor-v2 als IDE; persistentie in V3 + IDE-store + DB.
9. **Afgeleide associaties / GE's / RELs.** Analoog aan afgeleide velden: een relatie of GE die compleet door regels berekend wordt (CEL-expressie over andere model­elementen). Vraagstukken om uit te werken:
   - Berekening: live (FE) vs. gematerialiseerd (BE) — instelling per item
   - Cache-invalidatie bij wijziging van bron-elementen (lijkt op view-refresh in DB)
   - Effect op API/GraphQL: read-only veld vs. virtueel endpoint
   - Visuele markering in UML (oranje + cursief, analoog aan afgeleide velden, maar dan op edge/node-niveau)
   - Round-trip via V3 JSON + MetaRegistry
   - Ontwerpdocument apart maken voordat er code geschreven wordt
10. **Taal als fundamenteel aspect (i18n / meertaligheid).** Discussie­stuk in `docs/2026-04-29 taal aspect.md`: moet meertaligheid een **core-aspect** worden van representaties (à la `materieel` → optioneel `aanvang/einde`; analoog `talig` → optioneel `taal`-veld op _Data, met multipliciteit "enkelvoudig per taal"), of blijft het een per-register modellerings­keuze (zoals nu de `Taalvariant`-cluster in het kennis-domein)? Onderzoek nodig naar:
    - Bestaande patronen / standaarden in CMS-, API- en register-wereld (Drupal/Magnolia/Adobe AEM, OData, JSON-LD `@language`, IETF BCP 47, ICU, INSPIRE, ISA²)
    - Impact op MetaRegistry, codegen, schema-API, querystring (`?taal=nl`), GraphQL en frontend-rendering
    - Multipliciteit-semantiek: "enkelvoudig in tijd én in taal" als gecombineerde constraint
    - Migratie-pad voor bestaande registers

---

### 0.9 V3 uitwisseling: A4-rev (diagrammen), B5 (label-offsets), C8 (notes/constraints) — datalaag IMPLEMENTED (2026-05)

Voortgang op punten A4 (V3-import diagrammen), B5 (verplaatsbare edge-labels) en C8 (notes/constraints) op het niveau van het V3-uitwisselingsformaat en de IDE-adapter:

- **A4-rev (V3 ↔ IDE diagram-roundtrip):**
  - Go: `V3Diagram` / `V3DiagramNode` / `V3DiagramEdge` toegevoegd in `model/v3_format.go`; veld `Diagrammen` in `V3Model`.
  - IDE: `storeNaarV3Model` exporteert benoemde diagrammen (`Overzicht` blijft afgeleid en wordt geskipt); `v3ModelNaarStore` importeert ze terug naar de zustand-store.
  - Codegen blijft transparant: kent het veld niet, maar bewaart het door JSON-roundtrip.
- **B5 (verplaatsbare edge-labels — datalaag + UI):**
  - Go: `V3LabelOffsets { heen?, terug? }` met `V3Offset { x, y }` per `V3DiagramEdge`.
  - IDE-store: edge `data.labelOffsets.{heen,terug}.{x,y}`; geüpdatet via bestaande `updateDiagramEdge(diagramId, edgeId, patch)`.
  - Adapter: serialiseert offsets alleen als ze gezet zijn (≠ {0,0}).
  - UI: `MetamodelEdge.jsx` rendert nu twee extra labels (`naamLabelHeen` en `naamLabelTerug`) met UML-driehoekjes (▶ / ◀), schaal-bewust draggable (zoom-correct), en met dubbelklik-reset naar default-positie. Werkt op compositie- én associatie-edges.
  - Test: `v3_b5_c8_roundtrip.test.js` valideert dat offsets behouden blijven door storeNaarV3Model + v3ModelNaarStore.
- **C8 (notes en constraints — datalaag):**
  - Go: `V3Notitie` (gele post-it: tekst, positie, kleur, breedte, hoogte) en `V3Constraint` (lichtblauwe rounded-rect: naam, expressie, taal, scopeRefs[]) toegevoegd; velden `Notities` en `Constraints` op `V3Model`.
  - IDE-store: nieuwe element-types `notitie` en `constraint`. Scope-edges van een constraint naar elementen (`structuralEdges` met `data.kind === "scope"`) worden bij export omgezet naar `scopeRefs` en bij import teruggevormd. Scope-edges zijn semantisch altijd zichtbaar en kunnen niet verborgen worden.
  - Adapter-roundtrip getest in `v3_b5_c8_roundtrip.test.js`.

**Open follow-ups:**
- B5: cross-platform — editor-v2 leest/schrijft `labelOffsets` nog niet; idem MetaRegistry/DB-publicatie.
- C8: UI-rendering ontbreekt nog (palette-icons voor "notitie" en "constraint", node-componenten in IDE-canvas, scope-edge styling als gestippelde grijze lijn). Datalaag is klaar zodat dit zonder format-wijziging kan worden aangevuld.

---

## 1. README.md — TODO-sectie (lijnnummers 811+)

### API & Backend

```
05  Log àlle requests en responses? (hoe?)
08  Loop tijdsreizen nog eens na (KVK voorbeelden) want corrigeren is nu nog hetzelfde als wijzigen. Je hebt twee soorten tijdreizen (of 3).
10  Testdata, bootstrap
11  Autogen testdata vanuit model
```

### Drie extra registratiemanieren (plan 2026-04-28)

Plan: één gedeelde engine `RegistreerCore` met drie schrijflagen.
Sessieplan: zie `/memories/session/plan.md`.

- ✅ **Fase 1 (geneste full-payload, 2026-04-28).** Een `WijzigingRequest.opvoer/afvoer` mag een geneste boom bevatten (zelfde shape als `GET /full/{padnaam}/:id`-response). De server splitst die in platte wijzigingen, één per representatie. Audit-granulariteit blijft fijnmazig; de originele geneste payload wordt letterlijk in `Registratie.RequestBody` bewaard. Implementatie: [handlers/registration_normalizer.go](handlers/registration_normalizer.go), `RepresentatiePlusNaam.RawPayload` in [model/REST request models.go](model/REST%20request%20models.go), wiring + raw-body-capture in [handlers/registration_handlers.go](handlers/registration_handlers.go). Tests: [handlers/registration_normalizer_test.go](handlers/registration_normalizer_test.go) + [handlers/registration_normalizer_nploc_test.go](handlers/registration_normalizer_nploc_test.go).
- ✅ **FK-propagatie (2026-04-28, cross-cutting).** Client hoeft de parent-FK (`{ent}_id`) **nooit** mee te sturen in geneste children — de normalizer injecteert die automatisch via `injecteerParentFK` in `registration_normalizer.go`. Geldt voor Fasen 1/2/3. E2E geverifieerd: POST NatuurlijkPersoon zonder FK in children → response bevat `natuurlijkpersoon_id` in alle child-records.
- ✅ **Padnaam-fallback in flat format (2026-04-29).** `GetByVeldnaamMetPayload` valt nu terug op `Padnaam` (meervoud) als de outer key niet als `Veldnaam` (enkelvoud) bekend is. Hierdoor werkt het klassieke platte format ook met `"persoonsidentificaties"`/`"namen"` (consistent met geneste format). Implementatie + nieuwe `GetAllByPadnaam` in [model/metaregistry_plumbing.go](model/metaregistry_plumbing.go); 4 subtests in [model/metamodel_test.go](model/metamodel_test.go).
- ✅ **Input-structs gesaneerd (2026-04-29).** `_Input`-structs van materiële GE's/relaties (`NatuurlijkPersoon_Burgerschap_Input`, `Bereikbaarheid_Input`, en CG-types `Initiatief_Planning/Product/Bijdrage/Beoordeling_Input`) hadden directe `Aanvang *Date`/`Einde *Date` velden, terwijl de MetaRegistry deze al als onderliggende GE's (`*_Aanvang`/`*_Einde`) definieert. Resultaat: payloads met `"aanvang": {"datum": "..."}` faalden op unmarshal (object → string). Velden verwijderd; de normalizer splitst `aanvang`/`einde` nu correct uit als aparte wijzigingen — conform Hub+_Data ontwerp.
- ✅ **Fase 0 (refactor, 2026-04-29).** Pure engine `RegistreerCore(ctx, db, req, audit) (RegistreerResult, *RegistreerError)` geëxtraheerd in [handlers/registration_core.go](handlers/registration_core.go). Alle helpers in [handlers/registration_helpers_generiek.go](handlers/registration_helpers_generiek.go) gebruiken nu `context.Context` i.p.v. `*gin.Context` (mechanische refactor; helpers gebruikten `c` enkel voor `c.Request.Context()`). De ONGEDAANMAKING-tak leeft in `verwerkOngedaanmaking`. `RegistreerMetNieuweAanpak` in [handlers/registration_handlers.go](handlers/registration_handlers.go) is nu een dunne Gin-adapter (~75 regels, was ~513): rawBody lezen → normaliseren → `AuditMeta` bouwen → Core aanroepen → JSON-response. Response-shape (incl. `registratieId`-alias) ongewijzigd. Tests: 4 nieuwe core-tests in [handlers/registration_core_test.go](handlers/registration_core_test.go) (happy path, BeginTx-fout, Insert-fout/rollback, audit-velden); bestaande gin-handler-tests blijven groen.
- 🟡 **Fase 2 (REST/CRUD per padnaam, deels af).**
  - ✅ **DELETE per padnaam (2026-04-29).** `MakeDeleteEntityByMetaHandler` in [handlers/crud_handlers.go](handlers/crud_handlers.go) laadt het record, bouwt een `RegistreerRequest` met één `Afvoer`-wijziging en delegeert naar `RegistreerCore`. Audit-trail + transactiegedrag identiek aan POST `/registratie/`. Geregistreerd in [routes/addroutes_helper.go](routes/addroutes_helper.go); OpenAPI uitgebreid in [handlers/openapi_generator.go](handlers/openapi_generator.go) (`delete`-operatie op `{padnaam}/{id}`). PFK-types worden expliciet afgewezen met 400 (composite key niet adresseerbaar via één URL-id) — gebruik daar POST `/registratie/`. Tests: 3 nieuwe scenario's in [handlers/crud_handlers_test.go](handlers/crud_handlers_test.go) (PFK afwijzing, 404, happy-path delegatie).
  - ✅ **PATCH /full/{padnaam}/:id (2026-04-29).** JSON Merge Patch (RFC 7396) op onderliggende GE's/RELs. Pure wijziging-builder in [handlers/wijziging_builder.go](handlers/wijziging_builder.go) (`BouwWijzigingen(input) → []WijzigingRequest + meldingen[]`); handler `MakePatchFullEntityByMetaHandler` in [handlers/crud_handlers.go](handlers/crud_handlers.go) delegeert naar `RegistreerCore`. Hybride wrapper-detectie (variant A mét, B zonder ENT-wrapper). `?modus=registratie|correctie` (default `registratie`); correctie vereist `rel_id` per GE/REL. ENT-velden zelf zijn niet patchable (400). Response bevat `meldingen[]` met niet-fatale waarschuwingen (genegeerde `rel_id` in registratie, no-op items in correctie). Route en OpenAPI bijgewerkt. **Parent-context disambiguatie**: bouwt `RepresentatiePlusNaam` direct vanuit `og.Doeltype` i.p.v. globale `GetByVeldnaamMetPayload` — lost veldnaam-collisions op (bv. `"naam"` = `NatuurlijkPersoon_Naam` én `ApiStandaard_Naam`). Tests: 12 scenario's in [handlers/wijziging_builder_test.go](handlers/wijziging_builder_test.go). Foutcodes en design gedocumenteerd in [docs/REST_CRUD.md](docs/REST_CRUD.md).
  - 🟡 **ETag / If-Match (concurrency, optioneel, follow-up).** Ontwerp gedocumenteerd in [docs/REST_CRUD.md](docs/REST_CRUD.md) (sectie "Concurrency"). Niet in code in deze iteratie — implementatie vergt een query die de hoogste `registratie_id` voor een entiteit bepaalt over meerdere onderliggende GE-tabellen.
- ï¿½ **Fase 3A (GraphQL: directe core-calls, 2026-04-30).** De HTTP-roundtrip in `dynql/mutation_resolvers.go` is verwijderd. Mutations `registreer` / `corrigeer` / `maak_ongedaan` roepen nieuwe `handlers.RegistreerJSONCore` direct aan (één audit/transactie-pad). Pure cores `WijzigEntiteitCore` en `VoerEntiteitAfCore` geëxtraheerd; PATCH/DELETE-handlers zijn nu dunne Gin-adapters.
- 🟢 **Fase 3B-light (per-ENT typed mutations, 2026-04-30).** Voor elk entiteit-type registreert [dynql/typed_mutations.go](dynql/typed_mutations.go) drie mutations: `wijzig<Typenaam>(id, patch: JSON!)`, `corrigeer<Typenaam>(id, patch: JSON!)`, `voer<Typenaam>Af(id)`. Modus zit in de naam (geen `modus`-arg). Hergebruikt PATCH/DELETE-cores. Tests in [dynql/typed_mutations_test.go](dynql/typed_mutations_test.go).
- ï¿½ **Fase 3B-full (typed `<Typenaam>PatchInput`, 2026-05-xx).** Het `JSON!` scalar in `wijzig<X>`/`corrigeer<X>` is vervangen door dynamisch gebouwde `*graphql.InputObject` types. Nieuw bestand [dynql/input_type_builder.go](dynql/input_type_builder.go): `BuildPatchInputTypes()` bouwt bij startup `<GETypenaam>Input` (via reflectie op `_Data`-structs) en `<Typenaam>PatchInput` (via `OnderliggendeGegevenselementen`). Materieel: `aanvang`/`einde` sub-inputs (`PlumbingDatumInput`). Relaties: secundaire FK opgenomen. Tests in [dynql/input_type_builder_test.go](dynql/input_type_builder_test.go) (8 cases). Resolvers onveranderd — graphql-go deserialiseert InputObject naar `map[string]interface{}`.

Out-of-scope (BACKLOG): server-side ID-allocatie; optimistic concurrency (`If-Match`/ETag); `Idempotency-Key` deduplicatie; bulk-operaties op collections.

- 🟡 **Domein/parent-context filter op `GetByVeldnaamMetPayload` (2026-04-29).** De huidige globale lookup faalt bij veldnaam-collisions tussen domeinen (`"naam"` = `NatuurlijkPersoon_Naam` én `ApiStandaard_Naam`); de payload-key disambiguatie (`<ent>_id`) helpt alleen als de juiste FK-kolom in de payload zit. Voorgestelde uitbreidingen:
  - `GetByVeldnaamBijOuder(ouderMeta, jsonRolnaam)` — kijkt alleen in `ouderMeta.OnderliggendeGegevenselementen`. Sterkste vorm; al gebruikt in PATCH-builder via `og.Doeltype`.
  - `GetByVeldnaamWithinDomein(veldnaam, domein, payloadKeys)` — beperkt tot één domein. Nuttig in `RepresentatiePlusNaam.UnmarshalJSON` als parent al bekend is (POST `/registratie/` met geneste payload, normalizer).
  - Doel: ook in POST `/registratie/`, full-POST en GraphQL-mutations parent-context-aware disambigueren in plaats van te leunen op `<ent>_id` in de payload of de WARN-fallback. Verwijdert een hele klasse "verkeerd type gekozen"-bugs.

### Validatie (R1 + R2, input-structs, gegevenstypen-testmodel)

**Validatie-walker** (`model/validation_walker.go`): reflecteert over exported fields op zoek naar `schema:"datatype:X"` tags; voor string-kinded velden wordt `ValideerWaarde(datatypeNaam, s, veldPad)` aangeroepen. Gecombineerd resultaat = één `ValidationResult` met alle fouten. Aanroeppad: `ValideerRepresentatie(rep)` → walker → `ValideerWaarde` per veld.

- ✅ **R1: BSN 11-proef + IBAN mod-97 + NLPostcode regex (sessie 2026-04).** `ValideerWaarde` dispatcht op datatypeNaam; eigen implementaties voor BSN (11-proef), IBAN (mod-97), NLPostcode, Emailadres, URL, Kleur, GeoPunt enz. in `gegevenstypen_datatype_registry.go`. Tests in `model/validation_test.go`.
- ✅ **R2: Validatie-walker + `ValideerRepresentatie` (sessie 2026-04).** Walker reflecteert `_Input`-structs; groepeert foutmeldingen per veldpad; retourneert HTTP 422 bij eerste ongeldige request in `registration_core.go`. `ValideerRepresentaties([]Representatie) error` als batch-helper. Tests: `TestValideerRepresentatie_Walker` + `TestValideerRepresentatie_InputStructBSN` in `model/validation_test.go`.
- ✅ **Normalizer-regressions gefixed (sessie 2026-04).** Twee bugs in batch-registraties:
  1. FK-injectie (`injecteerParentFK`) gebruikte `GetID()` i.p.v. `leesIntUitRawMap(rawMap, childMeta.EntiteitIDKolom)` — nieuwe helper in `handlers/registration_normalizer.go`.
  2. `leidRelIDVoorHubKindAf` gaf "niet eenduidig"-error bij >1 actieve hub; nu `max(actieveHubIDs64)` retourneren (normalizer interleaved [hub, aanvang, hub, aanvang]). Test bijgewerkt: `TestLeidRelIDVoorHubKindAf_ErrorsOnAmbiguousActiveHub`.
- ✅ **`_Input`-structs missen `schema:"datatype:..."` tag (sessie 2026-04).** Walker werkt op de `_Input`-struct (die gematerialiseerd wordt in `registration_core.go`), niet op `_Data`. Oplossing: (1) tag handmatig toegevoegd aan `NatuurlijkPersoon_Persoonsidentificatie_Input.Bsn`; (2) `inputContentField` in `cmd/codegen/conventions.go` propageert nu `schema:`-tags (datatype, enum) naar gegenereerde `_Input`-structs. Test: `TestValideerRepresentatie_InputStructBSN`.
- ✅ **`TestEntiteitGegevenstypen` + Postman collection (sessie 2026-04).** Handmatig aangemaakt testmodel in het gegevenstypen-domein:
  - 6 nieuwe Go-bestanden: `model/gegevenstypen_modellen_entiteiten.go`, `_ge_rel.go`, `_methods.go`, `_input.go`, `gegevenstypen_metaregistry.go`, `gegevenstypen_enum_registry.go`.
  - Entiteit `TestEntiteitGegevenstypen` + Hub GE `TestEntiteitGegevenstypen_TestGEGegevenstypen` met één `_Data`-struct die elk string-gebaseerd valideerbaar gegevenstype (BSN, KvK, NLPostcode, IBAN, Emailadres, Telefoonnummer, URL, UrlHttps, Kleur, GeoPunt, KorteTekst, AN40, AN200, Datum, Duur) als apart veld met `schema:"datatype:X"` tag bevat.
  - Init-functies gekoppeld in `model/metaregistry_plumbing.go` (na `initGegevenstypenDatatypeRegistry`).
  - Postman-collectie: `postman/validatietest-gegevenstypen.postman_collection.json` met 13 requests: entity aanmaken, happy path, één invalid request per datatype (requests 2–11), en multi-fout test (request 12). Verwacht HTTP 422 bij elke invalid request.

### Afgeleide velden

```
15  *Afgeleide velden*
    - opnemen in:
      a. de wijzigings handler: de nu-staat uitrekenen m.b.v. go packages voor CEL etc.
      b. de database (liever niet)
    - opnemen in de API's of niet?
    - maken voor NP naam incl. naamgebruik
```

### Referentielijsten

```
16  Referentielijsten
    - vullen met data
    - meer lijsten
```

### React frontend (bestaande pagina's)

```
20  react - edit popups
    - corrigeren en afvoeren hebben heel weinig met elkaar te maken en staan gebroederlijk naast elkaar
      - functioneel scheiden
        - door niet te klikken maar rechts te klikken: bekijk | bewerk | voer af
        - door eerst een popup met alle data te tonen in een view-kaart
        - op die kaart:
          1 bewerk (= afvoer + nieuwe opvoer) (enkelvoudig is eigenlijk altijd dit)
          2 corrigeer (= corrigeer)
          3 voer af zonder opvolger

21  react pagina's
    - enkelvoudig meervoudig tonen (1 of *)
    - corrigeert registratie r ook een lijntje tekenen?
    - enkele view:
      - inhoudelijke info over wijzigingen
      - Klikken op gerelateerde record: record ophalen en ook tonen, inclusief kinderen en relaties
      - Dan kun je het hele model doorklikken
      - inklappen inclusief kinderen tonen (klein, maar zonder data)?

25  react pagina's uitbreiden met:
    - (latere!) ongedaangemaaktheid van regs tonen
    - dit is een soort 'blik op de toekomst'
```

### UML Model versies

```
30  UML model versies
    - ~~delta tussen een nieuwe en de huidige bepalen~~ ✅ (schemadiff + IDE Delta-knop)
    - ~~impact van de delta bepalen (breaking of niet)~~ ✅ (ernst-classificatie in schemadiff)
    - Export naar MIM linked data json iets
    - kleur uit EA importeren
```

### UML Editor (EditorV2)

```
31  UML editor
    - meerdere canvassen, per domein één (of naar keuze)
    - afhankelijkheid kunnen instellen
    - overerving zelf kunnen tekenen ✅
    - ~~alignen~~ ✅ (context menu align-acties)
    - relatie-visualisatie:
      - ~~met velden: associatieklasse~~ ✅ (ASOC-patroon: anker + 3 edges)
        - ~~probleem: de lijnen tussen A en REL en REL en B zijn geen relaties, maar alleen maar de link~~ ✅
          - ~~ze hebben een richting: hoe visualiseren?~~ ✅ (directioneel checkbox + pijl op anker→B)
      - ~~zonder: alleen een lijn met een label "relatie"~~ ✅ (collapsed badge)
      - labels bij rollen verplaatsbaar (hoe in V3 en metareg?)
    - ~~V3 import ASOC alleen bij velden~~ ✅
    - ~~reverse ASOC behoudt directioneel~~ ✅
    - ~~default bestandsnaam opslaan = versie~~ ✅
    - ~~normaliseer alle relaties (toolbar + context menu)~~ ✅
    - ~~snap alle elementen naar grid (toolbar + context menu)~~ ✅
    - ~~auto-layout: logische ordening van alle REPs (ENT centraal, GE's eronder/ring, RELs tussen ENTs, per domein gegroepeerd) — toolbar `🎯 Auto-layout` + rechtsklik op canvas~~ ✅
    - ~~kopiëren/plakken van nodes tussen diagrammen (Ctrl+C/V + rechtsklik)~~ ✅
    - ~~Shift+drag entiteit vanuit PB = ENT + alle onderliggende GE's/relaties~~ ✅
    - edge-eigenschappen conceptueel incorrect: A-anker en anker-B zijn geen relaties maar links
      - Toekomst: edit via relatie-node, niet via edges
    - grid-grootte instelbaar (optioneel)
```

### IDE

```
35  IDE
    - ~~multiselect in PB~~ ✅ (Ctrl+click toggle, Shift+click range)
    - ~~drag and drop GE en ENT is er al: relaties moeten getekend~~ ✅ (auto-add owner + doel entiteiten)
      - ~~niet altijd (reproduce)~~ ✅
    - ~~drag and drop - complete (shift?): ENT + alle GE's (en RELs) mee?~~ ✅ (Shift+drag entiteit bevat alle onderliggende + doel-entiteiten worden auto-toegevoegd)
    - ~~Ctrl+click multi-select + multi-drop~~ ✅
    - auto-order
    - ~~dubbelklik op edge: straighten~~ ✅ (berekenKortsteHandles)
    - undo / redo doet het niet ✅ 
    - edge types: ~~compositie~~✅, ~~overerving~~✅, ~~associatieklasse~~✅ (!)
    - ~~diagram of any element rename in PB~~ ✅ (tab-naam sync via `renameDiagramTab` + PB-prop + F2-handler — 2026-04-29)
    - domeinkleur instellen, uberhaupt properties van domein instellen mogelijk ✅
      - welke properties allemaal?
    - layout bar verplaatsbaar ✅
    - any bar
    - afgeleide velden CEL expressie breakout met kleurcodes en autocomplete enzo? Proberen met testwaarden
    - voorbeelden en testwaarden in REPs (t.b.v. expressies bijv. maar ook als document bij example)
    - velden (attr) ook omschrijving
      - meer dan dat: [0..*] enz
    - ~~normaliseer alle relaties~~ ✅ (gedeeld via MetamodelEditor)
    - ~~snap naar grid~~ ✅ (gedeeld via MetamodelEditor)
```

### Codegenerator

```
40  Generator
    - optie om project leeg te halen voor het genereren
      - optie database drop tables of migreer
      - oppassen met reflijst plumbing in generiek!
```

### Database migratie

```
45  Database migratie / backup naar json
    - dat dus
```

### Overige uit README

```
- Error handling and TODO validation of input data  (lijn 11)
- TODO: implement and enforce singularity/plurality constraints  (lijn 529)
- Reeds afgevoerde records kunnen niet weer afgevoerd worden (todo: goed testen)  (lijn 703)
- Een _data element op een GE (todo, punt 2 eerst)  (lijn 745 — DONE in DB)
```

---

## 2. docs/TODO.md — API Logging

```
## API logging
- [ ] Voeg file-based API logging toe voor requests en responses.
- [ ] Schrijf logs naar een configureerbaar pad via env var (bijv. `API_LOG_FILE`).
- [ ] Voeg logrotatie toe (max size / aantal backups / age).
- [ ] Log minimaal: timestamp, method, path, status, latency, request-id.
- [ ] Maak body logging configureerbaar (uit in productie, aan in debug).
- [ ] Voeg redactie toe voor gevoelige velden (bijv. tokens, bsn, auth headers).
- [ ] Documenteer alle env vars en defaults in README.
```

---

## 3. docs/IDE.md — Toekomstige fasen

### Fase 3 (Multi-diagram) — onvoltooide items

```
- Meerdere diagram-tabs naast elkaar
- Node toevoegen aan diagram ≠ element aanmaken
- Node verwijderen van diagram ≠ element verwijderen
- Diagram-scoped viewport persistentie
```

### Latere-fase items (uit ontwerpbeslissingen)

```
- Lokale persistentie eerst: Zustand persist → localStorage. Database-sync en multi-user is een latere fase.
```

---

## 4. docs/DEVLOOP.md — Geen expliciete TODO's

Documentatie is actueel. Geen openstaande items gevonden.

---

## 5. plans/2026-03-29 Forms plan 01.md — Content Editor Plan

### Toekomstige features (expliciet "buiten scope Iteratie 1-2")

```
- Inline editing in tabeloverzicht
- Bulk-operaties
- Export CSV/Excel
- Tijdreis in editor (peil-/tijdstipkiezer)
- Audit-trail weergave per record
- RBAC op veld-/formulierniveau
- Visuele drag-and-drop formulier-builder
```

---

## 6. plans/2026-03-29 Forms plan 02.md — Content Editor Plan (uitgebreid)

### Iteratie 2 — Custom Formulieren (nog niet geïmplementeerd)

```
15. Formulierdefinitie-schema — JSON-formaat dat layout en veldgroepering beschrijft
16. <CustomFormulier> — Renderer die formulierdefinitie + schema-API data combineert
17. Conditionele zichtbaarheid — Velden/secties tonen/verbergen op basis van andere veldwaarden
18. Formulierdefinities opslaan — In database of als JSON, gekoppeld aan entiteittype
```

### Toekomstige features (buiten scope Iteratie 1-2)

```
- Inline editing in tabeloverzicht
- Bulk-operaties (meerdere records tegelijk bewerken/verwijderen)
- Export naar CSV/Excel
- Formele/materiële tijdreis in de editor (peil-/tijdstipkiezer)
- Audit-trail weergave per record
- Role-based access control op veld-/formulierniveau
- Drag-and-drop formulier-builder (visueel, à la form.io)
```

---

## 7. plans/2026-03-29 referentielijsten PLAN.md

### Openstaande overwegingen

```
- Cross-model referentielijsten: nu buiten scope, maar structuur moet dit niet blokkeren.
  Referentielijsten en gegevenstypen zijn potentieel generiek over modellen heen. Toekomstige iteratie.
- Items-relatie FK constraint: referentielijst_id is altijd het ID van de gebonden instantie.
  Nu via applicatielogica afgedwongen; in toekomstige iteratie evt. DB CHECK constraint.
- Codegenerator aanpassen voor referentielijsten (buiten scope huidig plan).
```

---

## 8. plans/2026-03-31 dynamic graphql plan — Dynamische GraphQL

Volledig plan voor vervanging van de huidige gqlgen-implementatie:

```
Fase 1: Infrastructuur — dependency graphql-go/graphql, directory dynql/ met 7 bestanden
Fase 2: Output types bouwen — per MetaRegistry entry met reflectie
Fase 3: Query resolvers — full entity, lijst, registraties, formeel tijdreizen
Fase 4: Mutation resolvers — registreer mutation → hergebruik registratie-flow
Fase 5: Integratie — vervang gqlgen, verwijder graph/ (~10.300 regels)
Fase 6: Verfijning — field selection, enum types, afgeleide velden, referentielijsten

Verder overwegen:
- Typed mutations later? Generieke data:JSON mutation aanvullen met typed input-types per domein.
- Subscriptions? graphql-go/graphql ondersteunt geen subscriptions out of the box.
```

---

## 9. ontwerpgedachten/2026-04-03 domeinen — Domeinbeheer

```
Uitgangspunten:
- Een schema heeft een primair domein
- "domein" in alle top level elementen opnemen (ENT, enum, gegevenstype)
- schema_domeinen tabel in database met endpoint
- Bij opslaan schema: primair domein checken en toevoegen als het niet in de tabel staat

Editor:
- Domein als "actief domein"
- Nieuwe base types automatisch het domein geven
- GE met domein Y niet koppelbaar aan ENT uit domein X → melden, vragen om verplaatsing
- Validatie vóór publish/rebuild:
  o waarschuwing als meerdere domeinen door elkaar staan
  o waarschuwing als domein leeg is
- Rebuild alleen toestaan voor het geselecteerde domein

Visualisatie:
- Niet-actieve domein-elementen fletser
- Domein-boundary (dashed rounded-corners-rechthoek) als hulp-element
```

---

## 10. UML_EDITOR_INTEGRATIE.md — Editor toekomst

### uml-editor/README.md — Toekomstige mogelijkheden

```
- MetaRegistry-generatie: editor-output omzetten naar Go-code (MetaRegistry entries + struct definities)
- Validatie: controle op naamconventies, verplichte velden, referentiële integriteit
```

---

## 11. GRAPHQL.md — Next Steps

```
1. Implement Task Resolvers — Start with the existing Task model since you already have it
2. Implement Entity Resolvers — Use Entity A/B as templates
3. Add Filtering — Enhance queries with filter inputs
4. Add Sorting — Support ordering results
5. Batching — Use DataLoader for N+1 query prevention
6. Authorization — Add middleware for security
```

N.B. deze worden potentieel vervangen door het dynamische GraphQL plan (item 8).

---

## 12. afgeleide-velden.md — Toekomstige doorontwikkeling

```
1. Code-generatie: afgeleide velden vertalen naar berekende Go-methoden op de entiteit-struct,
   zodat de API ze automatisch meelevert bij GET-responses.

4. CEL-evaluatie in Go: implementatie van een CEL-runtime (github.com/google/cel-go)

5. Validatie: afleidingsregels valideren bij opslaan in de editor (syntax-check via CEL-compiler)
```

---

## 13. CEL-evaluatie-js.md — Frontend CEL

```
Korte termijn: Huidige subset-evaluator behouden, gericht uitbreiden.
Middellange termijn: Proof of concept met @marcbachmann/cel-js of cel-js library.
Lange termijn: Overweeg afleiding backend-first te maken.
```

---

## 14. materiele_tijd.md — Toekomstige uitbreidingen

```
- Materiële tijdreizen: queryparameter geldig_op=2023-06-15 om de toestand op een
  materieel peiltijdstip te bevragen (combinatie met formeel peiltijdstip → volledige bitemporaliteit).
- Aanvang/einde voor gegevenselementen en relaties: tabellen bestaan al (bijv. a_w_aanvang),
  maar de handler-, struct- en UI-ondersteuning is nog niet uitgewerkt.
- Materiële validatie: controle dat einde >= aanvang, en dat periodes niet overlappen
  bij een nieuw opgevoerde aanvang/einde.
```

---

## 15. RELEASE.md — Runtime fix

```
- TODO: na Bun-upgrade opnieuw valideren en callback-filter op geneste relaties herstellen.
```

---

## 16. Go code TODOs

### handlers/core_handlers.go (lijn 22)

```go
// TODO: full entity get and post to include all fields, not just ID.
```

### dbsetup/createmodeltables.go (lijn 4)

```go
/*
TODO: omschrijven naar een meer generieke aanpak,
waarbij de tabellen automatisch worden gemaakt op basis van
- de metadata in model/metamodel.go en
- de structuren in model/modellen_ge_rel.go en model/modellen_entiteiten.go
*/
```

### handlers/full_handlers.go (lijn 18)

```go
/* GENERAL TODO:
Full entity get and post to include all fields, not just ID.
This will require changes to the model structs and the handlers
to bind JSON to the full struct instead of just an ID field.
*/
```

### handlers/registration_handlers.go (lijn 284)

```go
/* ### TODO ###
ONGEDAANMAKING VAN EEN ONGEDAANMAKING
- check of de te ongedaan maken registratie zelf een ongedaanmaking is
- dat is op zich te doen, want je doet dan gewoon weer het omgekeerde van de eerste ongedaanmaking
- check of er wijzigingen zijn doorgevoerd sinds de ongedaanmaking die we nu willen ongedaan maken
*/
```

### handlers/registration_handlers.go (lijn 368)

```go
// TODO: hier komt de nieuwe aanpak van registratie, waarbij we de registratie en
// wijziging(en) in één endpoint verwerken
```

---

## 17. model/ontwerpkeuzen.md — Delta-analyse ✅ GEÏMPLEMENTEERD

**Status**: volledig geïmplementeerd in `schemadiff/` package + `cmd/schemadiff/` CLI + `--diff`/`--diff-only` in codegen + IDE integratie via `POST /admin/diff/:password`.
Zie [docs/schemadiff.md](schemadiff.md) voor volledige documentatie.

Oorspronkelijk plan:
```
Bij een upgrade van het metamodel is het waardevol om een delta te bepalen tussen de
huidige en de voorgestelde versie. Deze delta kan achterhalen of de upgrade breaking of
non-breaking is.

Dit kan later als aparte CLI tool (cmd/schemadiff/) naast cmd/codegen/, die twee
v3-JSON's vergelijkt en een migratierapport genereert. Eventueel ook DDL-migratiescripts
(ALTER TABLE ADD COLUMN ...).
```

---

## 18. docs/API-standaarden-analyse.md — Aanbevelingen

```
- gRPC/Connect als toekomstige optie: als er behoefte komt aan sterk getypeerde,
  gegenereerde clients voor de command-kant, dan is gRPC/Connect een sterkere kandidaat
  dan GraphQL-mutations
- Voeg pas in een latere fase aparte corrigeer en maakOngedaan mutations toe,
  of modelleer die eerst als varianten van registreer via registratietype.
```

---

## 19. docs/codegen_analyse_roundtrip.md — Volgende stappen

```
1. Fix alle 9 gaps in de codegen
2. Definieer V3 JSON voor RegisterDomein (4 GE's: Naam, Omschrijving, Code, Schema)
3. Genereer RegisterDomein code via codegen
4. Roundtrip-test: exporteer np-loc model → genereer → diff met hand-geschreven code
5. Itereer tot diff leeg is (of alleen verwachte volgorde-verschillen bevat)
```

---

## 20. docs/overerving-analyse.md — Volgende stappen

```
1. TypeMeta uitbreiden met SupertypeRef en IsAbstract
2. Database createtables aanpassen voor PFK-structuur
3. Generieke handler uitbreiden voor supertype-join
4. Schema-API uitbreiden met overervingsvelden
5. Editor: generalisatie-edge visueel weergeven (driehoek-pijl)
6. Frontend: geërfde velden tonen in formulieren
```

---

## 21. docs/inhoud-editor-technisch.md — Bekende aandachtspunten

```
1. CSS-bundlegrootte: Utrecht CSS + design tokens ~553 KB (49 KB gzip). Overwegen: tree-shaking.
2. API-paginering: client-side max 1000 records. Bij grote datasets: server-side paginering nodig.
3. Registratie-payload: test met werkelijke backend.
4. Toetsenbordnavigatie: verdere ARIA-attributen kunnen worden toegevoegd.
5. Responsive design: zijbalk 240px vast. Op smalle schermen: uitklapbare/hamburger variant.
6. Secondaire entiteit-ID: Optie B (toekomstig): Select Combobox / zoekinterface voor >100 opties.
7. Ongedaan maken: andere interface nodig dan per-GE acties. Wordt apart ontworpen.
```

---

## 22. docs/inhoud-editor-handleiding.md — FAQ-items

```
- Records verwijderen: In de huidige versie (Iteratie 1) nog niet beschikbaar via de editor.
- Tijdreizen: Nog niet. Gepland voor een toekomstige iteratie.
```

---

## 23. Referentielijsten.md — Openstaande items

```
- Fase B t/m H: Gepland maar status uit plan zegt ✅ Compleet (check: de Referentielijsten.md
  zelf toont nog "Gepland" maar het plan-bestand zegt ✅ Compleet → deze md is mogelijk achterhaald)
- Cross-model referentielijsten: toekomstige iteratie
- Items-relatie FK constraint: later evt. DB CHECK constraint
- Code generator aanpassen: buiten scope huidig plan
- Referentielijst-omschrijvingen updaten naar logische definities (NP, Locatie, Adres, BAGLocatie)
```

---

## 24. web/vite/src/ide/ActionDialog.jsx

```
Lijn 4: "Gebaseerd op het patroon uit EditorV2 ActionDialog, aangepast voor de IDE."
```

Geen expliciete TODOs in de IDE .jsx/.js bestanden gevonden.

---

## 25. Samenvatting per categorie

### Backend / API

| # | Item | Bron |
|---|------|------|
| B1 | API file-based logging met logrotatie | docs/TODO.md |
| B2 | Validatie van input data | README.md |
| B3 | Enforce singularity/plurality constraints | README.md |
| B4 | Afgeleide velden in wijzigingshandler (CEL evaluatie in Go) | README.md, afgeleide-velden.md |
| B5 | Afgeleide velden meegeven in API responses | afgeleide-velden.md |
| B6 | Afleidingsregels valideren bij opslaan (syntax-check) | afgeleide-velden.md |
| B7 | Materiële tijdreizen (queryparameter geldig_op) | materiele_tijd.md |
| B8 | Aanvang/einde voor GE's en relaties (handler+struct+UI) | materiele_tijd.md |
| B9 | Materiële validatie (einde >= aanvang, geen overlap) | materiele_tijd.md |
| B10 | Bun-upgrade + callback-filter op geneste relaties herstellen | RELEASE.md |
| B11 | Ongedaanmaking van een ongedaanmaking | registration_handlers.go |
| B12 | Nieuwe registratie-aanpak (één endpoint) | registration_handlers.go |
| B13 | Testdata bootstrap / autogen vanuit model | README.md |
| B14 | Tijdsreizen nalopen (KVK voorbeelden, 2-3 soorten) | README.md |
| B15 | Database migratie / backup naar JSON | README.md |
| B16 | Server-side sort/filter op lijstendpoints | Forms plan 02 |
| B17 | Zoek-endpoint referentielijsten (?q= met ILIKE) | Forms plan 02 |
| B18 | gRPC/Connect als toekomstige command-API | API-standaarden-analyse.md |
| B19 | enums hebben ook een beschrijving van de term | |
| B20 | ✅ Domein-tracking in registraties: `domeinen TEXT[]` kolom, afgeleide domein-set per wijziging, GIN index | nieuw |
| B21 | ✅ Backfill script bestaande registraties: `cmd/backfill_registratie_domeinen/` | nieuw |
| B22 | ✅ API domein-filter: `?domein=` queryparameter op `GET /full/registraties` met `@>` array containment | nieuw |
| B23 | ✅ GraphQL `domeinen` veld op RegistratieType | nieuw |
| B24 | Extra endpoint voor registratie (per domein?) dat wijziging niet nodig heeft: kan alleen als alle wijzigingen gelijkvormig zijn: alle opvoer of afvoer | nieuw |
| B25 | 'backward'-compatible REST PATCH / DELETE mapping naar wijziging | nieuw |
| B26 | ✅ **Sterkere typering**: uitbreiding aantal first-class datatypes (Telefoon, IBAN, GeoPunt, GeoVlak, Kleur, Bestand-FK, Bedrag, Percentage, …); koppelt direct aan widget-laag (D.2) en validatie (B27). *Eerste iteratie 2026-05-13: Kleur, Duur, UrlHttps, GeoPunt toegevoegd. Tweede iteratie 2026-05-14: ISBN10, ISBN13, LEI toegevoegd. Derde iteratie 2026-05-15: DatumIncompleet, RSIN, Vestigingsnummer, Bestand, GeoLijn, GeoVlak, BAGLigplaatsID, BAGStandplaatsID toegevoegd in `model/datatype_aliases_extra.go` + `model/gegevenstypen_datatype_registry.go`. Validatiefuncties `geolijn_geojson` en `geovlak_geojson` in `model/regels_eval.go`. Unit tests in `model/validation_test.go`. Alle types gedocumenteerd in `docs/validatie.md` (40 types, alles ✅).* | ✅ 2026-05-15 |
| B27 | 🟡 **Validatieregels op alle typen**: per-datatype regels (regex, range, checksum, lengte) + optionele veld- en cross-veld-CEL-regels op MetaRegistry; *opt-in* uitvoering in registratie-API met response-melding (warning vs hard fail). *Fundament geleverd 2026-05-13: `model/validation.go` + walker + integratie in `RegistreerCore` met query-flag `?validatiestrengheid=strict\|lenient\|warnings-only`. Builtin: BSN-11-proef, IBAN mod-97, NLPostcode, Email, GeoPunt range, Kleur. Open: per-veld `Validatieregels`, cross-veld CEL (afh. B4), client-side preview (B6).* | brainstorm 2026-05-13 |
| B28 | **Modelvarianten verder doortesten**: combinaties materieel × overerving × Hub+_Data × meervoudig × cross-domein-relatie systematisch dekken met test-fixtures | brainstorm 2026-05-13 |
| B29 | **Berekende klassen** (afgeleide entiteiten/GE's/REL's): analoog aan afgeleide velden, complete representatie wordt door regels berekend uit andere model-elementen. Beslispunten: live (FE) vs gematerialiseerd (BE), cache-invalidatie, read-only API (zie 0.8 C9) | brainstorm 2026-05-13 |
| B30 | **Afgeleide velden optioneel materialiseren in DB**: actuele aanvang/einde projecteren naar Hub-record (analoog aan opvoer/afvoer), eventueel andere afgeleide velden ook. Vereist dependency-tracking: bij wijziging van bron-record alle records die het in afgeleid veld gebruiken hertriggeren. Beslissing of dit wenselijk is per veld vastleggen. | brainstorm 2026-05-13 |
| B31 | **Materieel tijdreizen** (was B7) — eerst formele semantiek goed, daarna materieel `?geldig_op=` over de hele API + GraphQL | brainstorm 2026-05-13 |
| B32 | ✅ **Operaton-provenance op Registratie**: `bron` en `bron_kenmerk` nullable VARCHAR-kolommen op `registratie`-tabel; `Registratie`-struct in `model/model_plumbing.go`; idempotente migratie `ensureRegistratieBronMigrated` in `dbsetup/createtables.go`. Go-worker injecteert `bron="operaton"` + `bron_kenmerk=<process-instance-id>` automatisch bij elke registratie. | ✅ 2026-05-21 |

### Database / DDL

| # | Item | Bron |
|---|------|------|
| D1 | createmodeltables.go → meer generieke aanpak | dbsetup/createmodeltables.go |
| D2 | Generator: optie om project leeg te halen / drop tables / migreer | README.md |
| ~~D3~~ | ~~Delta-analyse CLI tool (cmd/schemadiff/)~~ **✅ DONE** — zie docs/schemadiff.md | model/ontwerpkeuzen.md |
| ~~D4~~ | ~~DDL-migratiescripts genereren (ALTER TABLE ADD COLUMN)~~ **✅ DONE** — schemadiff/migration.go | model/ontwerpkeuzen.md |
| D5 | Items-relatie FK constraint (DB CHECK) | Referentielijsten.md |

### GraphQL

| # | Item | Bron |
|---|------|------|
| G1 | Dynamische GraphQL-laag vanuit MetaRegistry (volledig plan) | plans/2026-03-31 dynamic graphql plan |
| G2 | Implement entity resolvers | GRAPHQL.md |
| G3 | Add filtering op queries | GRAPHQL.md |
| G4 | Add sorting op queries | GRAPHQL.md |
| G5 | DataLoader batching (N+1 preventie) | GRAPHQL.md |
| G6 | Authorization middleware | GRAPHQL.md |
| G7 | Typed mutations (per domein, naast generieke) | dynamic graphql plan |
| G8 | Subscriptions | dynamic graphql plan |

### Codegenerator

| # | Item | Bron |
|---|------|------|
| C1 | Fix alle 9 gaps in de codegen | codegen_analyse_roundtrip.md |
| C2 | V3 JSON voor RegisterDomein genereren | codegen_analyse_roundtrip.md |
| C3 | Roundtrip-test np-loc model | codegen_analyse_roundtrip.md |
| C4 | Codegenerator aanpassen voor referentielijsten | Referentielijsten.md |

### Overerving

| # | Item | Bron |
|---|------|------|
| O1 | ✅ TypeMeta uitbreiden met `IsAbstract` en `ParentTypenaam` | overerving-analyse.md |
| O2 | ✅ Database + Codegen voor PFK-structuur: codegen genereert PFK-veld + belongs-to relatie op subtypes, `entiteitRelatieFieldPK` voor has-many joins met juiste PK-kolom, `createmodeltables` met topologische sort (parent-before-child) + `ensureSubtypeFK` voor FK-constraint | overerving-analyse.md |
| O3 | ✅ Generieke handlers voor supertype-join: `addOnderliggendeRelations` laadt parent via `Relation("Parent{Type}")`, `laadHubKinderenNaQuery` recursief voor parent hub-children, `ensureParentRecordBijOpvoer` maakt transparant parent-record aan in registratie-handler (TPT) | overerving-analyse.md |
| O4 | ✅ Schema-API met overervingsvelden: `IsAbstract`, `ParentTypenaam`, `GeerfdeVelden` (recursief) in DTO + builder | overerving-analyse.md |
| O5 | ✅ Editor: generalisatie-edge (driehoek-pijl) — rendering ✅, sidebar-dropdown ✅, toolbar edge-mode ✅ | overerving-analyse.md |
| O6 | ✅ Frontend: geërfde velden in formulieren. Codegen: parent belongs-to JSON tag fix (`json:"-"` → `json:"parent_{lower},omitempty"`). RepresentatieFormulier: geërfde velden boven eigen velden, bewerkbaar, twee-wijziging patroon (parent vóór child). EntiteitFormulier: cross-GE save met parent velden (isParentVeld marker, shared PK), standaard-weergave met aparte parent sectie. | overerving-analyse.md |
| O7 | ✅ V3 JSON roundtrip: `isAbstract` + `erft` velden op V3Entiteit, export/import generalisatie-edges | — |
| O8 | ✅ Codegen: schrijft `IsAbstract` + `ParentTypenaam` naar gegenereerde MetaRegistry | — |
| O9 | ✅ Exporters: XMI (dynamisch isAbstract + UML:Generalization), Mermaid (--|>), PlantUML (<|--) | — |
| O10 | ✅ Bugfix: afgeleide velden in subklassen tonen nu correct (shallow equality fix in useOvergeerfdeVelden) | — |
| O11 | ✅ Schemadiff: `isAbstract`-wijziging (→ modificatie), `erft`-wijziging (toevoegen → modificatie, verwijderen/wijzigen → destructief), DDL-migratie voor PFK-constraints. 7 tests. | — |

### UML Editor (EditorV2)

| # | Item | Bron |
|---|------|------|
| E1 | Meerdere canvassen per domein | README.md |
| E2 | Afhankelijkheid instellen | README.md |
| E3 | ✅ Overerving zelf tekenen | README.md |
| E4 | Relatie-visualisatie: associatieklasse | README.md |
| E5 | Labels bij rollen verplaatsbaar | README.md |
| E6 | MetaRegistry-generatie vanuit editor | uml-editor/README.md |
| E7 | Validatie: naamconventies, verplichte velden, referentiële integriteit | uml-editor/README.md |
| E8 | Export naar MIM linked data JSON | README.md |
| E9 | Kleur uit EA importeren | README.md |
| E10| (ook IDE) Extra REP veld "Alias" | nieuw |
| E11| ✅ Node resize: gebruiker kan nodes groter/kleiner maken (React Flow `<NodeResizer>`) + CSS max-width verwijderd | nieuw |
| E12| ✅ ENT-node dikkere rand als standaardstijl (border-width 3px vast) | nieuw |
| E13| ✅ ENT→ENT edge trekken = nieuwe REL aanmaken (collapsed/ASOC-small, geen velden) + genormaliseerde handles | nieuw |
| E14| ✅ Alt-drag vanuit ENT source-handle naar canvas = nieuwe GE aanmaken, genormaliseerde edge (was Ctrl-drag, gewijzigd wegens conflict met multiSelectionKeyCode) | nieuw |
| E15| ✅ Edge-mode toolbar: Compositie (◆) en Generalisatie (▷) knoppen — selecteer mode, sleep edge, auto-reset | nieuw |
| E16| ✅ Edge-mode indicator: visuele banner + crosshair cursor bij actieve mode, Escape om te annuleren | nieuw |
| E17| ✅ rechtsklik domein wijzigen voor selectie | nieuw |
| E18| ✅ importeren uit mermaid neemt ook overerving mee | nieuw |
| E19| ✅ Auto-layout: hiërarchische ordening van alle (zichtbare) REPs op het canvas — ENT centraal/bovenaan, GE's eronder (rij of grid; ring bij ≥ 8 GE's), enums/datatypes/reflijsten als kleine boxen onder de bijbehorende GE, RELs op halverwege tussen ENT-uiteinden, ankers tussen REL en ENT, ENT-clusters per **domein** gegroepeerd in eigen blokken. Inclusief toolbar-knop `🎯 Auto-layout` en context-menu item `🎯 Auto-layout (alles)` (canvas-rechtsklik werkt nu ook zonder selectie). Implementatie in [`metamodel/autoLayout.js`](../web/vite/src/umleditor/metamodel/autoLayout.js) | nieuw |
| E20| ✅ Auto-layout: directionele ordening — binnen een domein worden ENT's gesorteerd op netto-flow (uitgaand vs. inkomend op REL-niveau) en met een swap-pass uitgelijnd, zodat REL-pijlen zoveel mogelijk van bron→doel (links→rechts) lopen. Inclusief compactere secundair-grid (≈√(N) kolommen i.p.v. lange verticale stack) bij veel enum/datatype/reflijst-instanties per ENT. | nieuw |
| E21| ✅ Auto-layout (selectie): rechtsklik bij 2+ geselecteerde nodes → `🎯 Auto-layout (selectie)`. Reorganiseert alleen de selectie-subgraaf, gecentreerd in de bounding-box van de oorspronkelijke selectie zodat de rest van het diagram visueel op zijn plek blijft. Edges met een eindpunt in de selectie worden mee-genormaliseerd. Optie `selectie` in [`pasAutoLayoutToe`](../web/vite/src/umleditor/metamodel/autoLayout.js). | nieuw |
| E22| ✅ Sticky / locked nodes voor auto-layout: nodes met `data.layoutLocked === true` blijven door auto-layout (alles én selectie) op hun plek staan; andere nodes plaatsen zich daar omheen. Optie `respecteerLocked` (default `true`). UI-toggle (rechtsklik → "🔒 Vergrendel positie") staat als follow-up open. | nieuw |
| E23| ✅ Notities & constraints landen bij hun onderwerp: auto-layout plaatst float-nodes (notitie/constraint) met dependency-edge(s) rechts naast het zwaartepunt van hun buren, met conflict-shift; notities zonder edges vallen terug op de oude rechts-stapel. | nieuw |
| E24| ✅ Auto-layout ook in de IDE: dezelfde `pasAutoLayoutToe`-implementatie wordt gebruikt door [`ide/DiagramCanvas.jsx`](../web/vite/src/ide/DiagramCanvas.jsx). Toolbar krijgt twee knoppen (`🎯` voor alles, `🎯Ë¢` voor selectie ≥ 2) en het rechter-muisknop-menu krijgt dezelfde items. Posities worden direct in de diagram-store opgeslagen via `updateDiagramNodes`. | nieuw |
| E25| ✅ Auto-layout — follow-ups doorgevoerd: (a) richting-keuze `TB`/`BT`/`LR`/`RL`/`radial` via nieuwe `richting`-optie + toolbar-dropdown in editor én IDE (gepersisteerd in `localStorage`); (b) lichte force-directed nabewerking (springs + Coulomb-repulsie, ~80 iteraties, max 25 px/stap) als laatste pass van `pasAutoLayoutToe` — respecteert locked nodes en (bij selectie-mode) de niet-geselecteerde nodes als pins; (c) hub-ringmodus voor ENT's met ≥ `hubDrempel` (=6) verbindingen waarvan de tegenpartijen in ≥ 2 domeinen leven: eigen RELs op een cirkel rond de hub-ENT; (d) `data.layoutLocked` toggelbaar via rechtsklik → `🔒 Vergrendel positie` / `🔓 Ontgrendel positie` in editor (selectie-context-menu) en IDE (node-context-menu, valt terug op selectie). Aanvullend: scale-to-fit (`vulSelectie`) bij `Auto-layout (selectie)` zodat de subgraaf de oorspronkelijke selectie-bounding-box maximaal vult (factor ≤ 2.5×) — lost het "opgepropt"-effect op. | nieuw |
| E26| ✅ Lock-status persistent gemaakt over de **volledige roundtrip** (editor ↔ V3 ↔ codegen ↔ MetaRegistry ↔ V3-export ↔ editor). In de **IDE** wordt `layoutLocked` per diagram opgeslagen op `DiagramNode` (`ref.layoutLocked`), zodat een 🔒 een tab-wissel of pagina-reload overleeft én per diagram verschillend kan zijn. In de **UML editor** wordt `layoutLocked` opgenomen in V3 JSON op alle node-typen (entiteit, GE, relatie, anker via `ankerLayoutLocked`, enum, gegevenstype, referentielijst-instantie, notitie, constraint). In de **backend** is `EditorLayout` uitgebreid met `LayoutLocked` + `AnkerLayoutLocked`; codegen (`gen_registry.go`, `gen_enum_registry.go`, `gen_datatypes.go`) emit deze velden in de gegenereerde `_metaregistry.go`/`_enum_registry.go`/`_datatype_registry.go` bestanden, en `v3_exporter.go` schrijft ze terug naar V3 zodat de lock-status het rebuild-traject overleeft. Notities en constraints lopen via de opgeslagen V3 JSON (geen MetaRegistry-tussenstap). Auto-layout respecteerde `data.layoutLocked` al. | nieuw |
| E27| ✅ Secundairen (enum / datatype / referentielijst) worden bij auto-layout direct **onder hun consumer-GE in dezelfde kolom** geplaatst, in plaats van in één globaal blok onderaan het ENT-cluster. RELs die zelf een secundair consumeren (bv. `Bereikbaarheid.soort → Bereikbaarheidssoort`) krijgen hun secundair direct ónder de REL. Dit voorkomt de lange kruisende dependency-lijnen die ontstonden wanneer BSN/Naamgebruiksoort/Bereikbaarheidssoort ver van hun owner werden gestapeld. Topologie uitgebreid met `relNaarSecundair`. | nieuw |


### IDE (metamodel-ontwerp omgeving)

| # | Item | Bron |
|---|------|------|
| I1 | Multi-diagram: tabs naast elkaar | docs/IDE.md |
| I2 | Node toevoegen ≠ element aanmaken | docs/IDE.md |
| I3 | Node verwijderen ≠ element verwijderen | docs/IDE.md |
| I4 | Diagram-scoped viewport persistentie | docs/IDE.md |
| I5 | Database-sync en multi-user | docs/IDE.md |
| I6 | Drag & drop: Complete ENT + alle GE's drag & drop (shift D&D?) | README.md -> testen |
| I7 | PB: Auto-order; custom order;  | README.md |
| I8 | CEL expressie breakout met kleurcodes en autocomplete | README.md |
| I9 | Voorbeelden en testwaarden in REPs | README.md |
| I10 | Velden: kardinaliteit [0..*] enz | README.md |
| I11 | ✅Layout bar verplaatsbaar | README.md |
| I12 | Any bar: custom bar met functies? | README.md |
| I13 | ✅ Edge types: compositie, overerving, associatieklasse — rendering ✅, toolbar edge-mode (comp+gen) ✅ | README.md |
| I14 | Document by example compartiment in klassen | readme.md |
| I15 | Testwaarden in REPs (t.b.v. expressies bijv. maar ook als document bij example) | README.md |
| I16 | ✅IDE toolbar: knoppen voor aanmaken nieuwe REPs (ENT, GE, REL, reflijst, type, enum) | nieuw |
| I17 | ✅IDE toolbar + rechtsklik: normaliseer en snap-to-grid knoppen toevoegen | nieuw |
| I18 | ✅ Verplaatsbare toolbars: drag naar gewenste positie, snap verticaal bij zijranden / horizontaal bij boven-/onderrand | nieuw |
| I19 | PB rechtsklik: "Nieuw element" per type (rechtsklik op ENT → nieuw GE, etc.) | nieuw |
| I20 | ✅ PB rechtsklik: "Verwijder uit model" element verwijderen inclusief alle diagrammen | nieuw |
| I21 | ✅ Domein auto-toevoegen: updateElement voegt nieuw domein automatisch toe aan domeinlijst | nieuw |
| I22 | ✅ AlignToolbar verticale layout: toolbar wisselt correct naar kolom-layout bij verticale snap | nieuw |
| I23 | ✅ Lege veldencompartimenten verbergen: ENT toont geen velden-compartiment, GE/REL tonen leeg vak i.p.v. "— geen velden —" | nieuw |
| I24 | ✅ NodeEditPanel: velden-sectie verborgen voor entiteiten (alleen afgeleide velden beschikbaar) | nieuw |
| I25 | ✅ PB diagrammen onder domeinen: domein-specifieke diagrammen verschijnen als ðŸ“ Diagrammen subfolder per domein | nieuw |
| I26 | ✅ Import-dialoog: bestand/API bron, domeinfilter, merge/vervang, auto-diagram aanmaken bij import | nieuw |
| I27 | ✅ PB rechtsklik import/export: importeer/exporteer domein met pre-ingevuld domeinfilter | nieuw |
| I28 | meerdere edge-typen (rond, hoekig, direct, zelf zoeken, kneedbaar) | nieuw |
| I29 | edge knikbaar / duw- en trekbaar | nieuw |
| I30 | ? edge verbergbaar | klaar: beter testen: alle edges of allen dependencies kunnen dat? |
| I31 | edges zoeken (ivm verbergen kunnen ze weg zijn) | nieuw |
| I32 | match size (hoogte / breedte / beide) | nieuw |
| I33 | meer nodes (per element instelbaar / automatisch bij vergroten) | nieuw |
| I34 | edges naar andere handle trekken of anderszins | nieuw |
| I35 | domein selectie ; boundary element introduceren? | nieuw |
| I36 | Refactor in model → refactor in db? (Ook data, nu alleen structuur SQL in Delta) | nieuw |
| I37 | Link referentie data content: file (t.b.v. vulling) / live view | nieuw |
| I38 | Jump naar view / edit pagina's data | nieuw |
| I39 | Relatie naam labels tonen op diagram (rechtsklik toon/hide) | nieuw |
| I40 | Model geheel (bi?)temporeel in database? | nieuw |
| I41 | ✅ IDE diagram-positie synchronisatie: posities werden alleen in het actieve diagram opgeslagen, maar V3-export leest uit `overzicht`. Fix Round 3 + 4 (2026-05-01): `handleNodesChangeWrapped` synchroniseert posities naar Overzicht; bij V3-import wordt een `namedDiagPos` map gebouwd uit alle named diagrams als fallback voor entiteiten zonder `positie`-veld. Tevens scope-edge dedup. Zie RELEASE.md. | nieuw |
| I42 | business rule in model | nieuw |
| I43 | complex types achtig iets = combi gegevenstypen? | nieuw |
| I44 | import IDE: meerdere diagrammen? Hele IDE setup? | testen |
| I45 | import V3: naam overnemen in diagram naam | nieuw |
| I46 | verwijderen van diagrammen | nieuw |
| I47 | attributen vak verbergen indien leeg | nieuw |
| I48 | importeer UML, MIM en mermaid weer | nieuw |
| I49 | auto route model | nieuw |
| I50 | ✅ PB nesting: ent→ent compositie-edges produceerden dubbele entries (Plan onder OverkoepelendPlan **én** als losse entiteit) → react-arborist key-collision → visuele overlap bij domein-toggle. Fix: entiteit-typed children worden niet meer als sub-knoop getoond, en `idAccessor` gebruikt een composite `treeKey` voor child-rows. (2026-04-28) | nieuw |
| I51 | ✅ B5/B6/B7 (cast/splits/relatie) faalden op raw-imported elementen met "Element X is geen entiteit" omdat `rawNodeNaarElement` geen top-level `metatype` zette. Fix: metatype op top-level én in `data`; transformations.js `isEntiteit/isGE/isRelatie` accepteren nu ook `el.type` en `el.data.metatype` als fallback. Regression-test toegevoegd. (2026-04-28) | nieuw |
| I52 | Editor-v2 `Failed to execute 'removeChild'` treedt nog steeds op na openen. De huidige defer (rAF + null-data-mount) is onvoldoende; vermoedelijk XyFlow ResizeObserver vs React 18 concurrent commits. Onderzoek: aparte `key` op `<MetamodelEditor>` per data-load; downgrade React-Flow; of `<Suspense>`-grens rond editor. Zie todo #2. | nieuw |
| I53 | Select elementen op een canvas - rechtsklik domein wijzigen -> of via I54?| vanuit editor |
| I54 | ✅ Verplaatsen elementen in PB → domein wijzigen. Rechtsklik > "↪ï¸ Verplaats naar domein…" én drag & drop naar domein-map. Multi-select (Ctrl+klik) wordt meegenomen. Bevestigingsdialoog; updates via `updateElement(id, { domein })`. Bugfixes: `setTimeout(0)` in onDrop (confirm-suppression in drag), `treeData` uit effect-deps (scroll-back fix), `effectAllowed="copyMove"` (drop-handler mismatch). (2026-05-02) | ✅ |
| I |  | nieuw |
| I |  | nieuw |
| I |  | nieuw |


### Frontend — Content Editor (Inhoud-editor)

| # | Item | Bron |
|---|------|------|
| F1 | ✅ Iteratie 2: custom formulierdefinities in JSON — FormulierDefinitie als bitemporale entiteit (configuratie-domein) + CustomFormulierRenderer + useFormulierDefinitie hook + integratie in EntiteitFormulier | Forms plan 02, F1-Q1Q2Q3 plan |
| F2 | ✅ Conditionele zichtbaarheid — `evalueerConditie()` in CustomFormulierRenderer (==, !=, truthy, falsy) | Forms plan 02, F1-Q1Q2Q3 plan |
| F3 | Inline editing in tabeloverzicht | Forms plan 02 |
| F4 | Bulk-operaties | Forms plan 02 |
| F5 | Export CSV/Excel | Forms plan 02 |
| F6 | Tijdreis in editor (peil-/tijdstipkiezer) | Forms plan 02, handleiding |
| F7 | Audit-trail weergave per record | Forms plan 02 |
| F8 | RBAC op veld-/formulierniveau | Forms plan 02 |
| F9 | Drag-and-drop formulier-builder | Forms plan 02 |
| F10 | Records verwijderen via editor | inhoud-editor-handleiding.md |
| F11 | Ongedaan maken registraties: aparte interface | inhoud-editor-technisch.md |
| F12 | Secondaire entiteit-ID: Select Combobox voor >100 opties | inhoud-editor-technisch.md |
| F13 | Responsive design / hamburger menu | inhoud-editor-technisch.md |
| F14 | Verdere ARIA-attributen / toetsenbordnavigatie | inhoud-editor-technisch.md |
| F15 | CSS tree-shaking Utrecht components | inhoud-editor-technisch.md |
| F16 | Server-side paginering bij grote datasets | inhoud-editor-technisch.md |
| F17 | Zoek-endpoint referentielijsten (?q= met ILIKE) | inhoud-editor-technisch.md |
| F18 | Labels-configuratie voor veldnamen e.d. (InitiatiefDomein -> domein) | nieuw |
| F19 | ✅ Betekenisvolle gegevenstypen (MIM): presentatie-datatypes + weergave-hints | F1-Q1Q2Q3 plan |
| F20 | ✅ API endpoint `/api/viz/schema/datatypes` | F1-Q1Q2Q3 plan |
| F21 | ✅ SchemaFormField: widget-rendering op basis van datatype weergave-hints | F1-Q1Q2Q3 plan |
| F22 | ✅ Custom tabelweergaven (WeergaveDefinitie ENT + PublicatieTabel + TabelConfig kolom-selectie/sortering) | F1-Q1Q2Q3 Fase Q2 |
| F23 | ✅ Server-side zoek/filter endpoint: `?filter.*`, `?sort=`, `?order=`, `total_count` in response | F1-Q1Q2Q3 Fase Q2 |
| F24 | ✅ Detail-pagina template renderer (PublicatieDetail met `{{veldpad}}` inserts via CEL-paden) | F1-Q1Q2Q3 Fase Q2 |
| F31 | ✅ WeergaveDefinitie bitemporale entiteit (codegen configuratie-domein: ENT + Meta/TabelConfig/DetailTemplate GE's) | F1-Q1Q2Q3 Fase Q2 |
| F32 | ✅ useWeergaveDefinitie hook + publicatie.html apart entrypoint (HashRouter, server-side paginering) | F1-Q1Q2Q3 Fase Q2 |
| F33 | ✅ Replay file: standaard WeergaveDefinities voor NatuurlijkPersoon, Initiatief, A en Land (v0.1, hub-veldnamen, definitie_versie) | F1-Q1Q2Q3 Fase Q2 |
| F25 | ✅ FormulierDefinitie bitemporale entiteit (codegen configuratie-domein: ENT + Meta GE + Layout GE) | F1-Q1Q2Q3 Fase B |
| F26 | ✅ CustomFormulierRenderer.jsx (layout JSON → formulier met groep/rij/veld/conditioneel) | F1-Q1Q2Q3 Fase B |
| F27 | ✅ useFormulierDefinitie hook (fetch actieve FormulierDefinitie voor een doeltype) | F1-Q1Q2Q3 Fase B |
| F28 | ✅ EntiteitFormulier integratie: toggle custom/standaard weergave bij actieve FormulierDefinitie | F1-Q1Q2Q3 Fase B |
| F29 | ✅ Custom formulier: editable modus met cross-GE save (één registratie, meerdere GE-wijzigingen) | F1-Q1Q2Q3 Fase B vervolg |
| F30 | Visuele FormulierDefinitie layout-editor (drag-and-drop veldindeling) | F1-Q1Q2Q3 Fase B vervolg |
| F34 | ✅ JSON- en Markdown-widget: side-by-side editor + live preview, full-width grid spanning, `widget: "json"` en `widget: "markdown"` in layout | inhoud-editor-technisch.md |
| F41 | ✅ CEL evaluator uitbreiding met lijstoperaties: `celEvaluator.js` herschreven met tokenizer-ondersteuning voor `>=`, `<=`, `>`, `<`, `[`, `]`, `,`; parser met `parsePostfix` voor `.field`, `.method(args)`, `[key]`; lambda-methoden `filter(x, pred)`, `map`, `exists`, `all`; `size()`; `evaluate()` voor `index`, `methodcall`, `gt/gte/lt/lte`. `bouwCelContext` exposeert nu full actieve lijst onder `group.rolnaam` (naast enkelvoudig via `klassenaam`) zodat expressies als `Lijst.filter(x, x.veld == "v")[0].veld` werken. `childWeergave()` in `EntiteitFormulier` omgezet van minimale `ctx[klassenaam]` naar `bouwCelContext` voor uniforme lijstondersteuning. (2026-05-12) | CEL-evaluatie-js.md |
| F42 | ✅ Afgeleide velden kennis2-domein: `AfgeleideVelden` in `kennis2_metaregistry.go` gevuld voor `Kennisartikel` (`nl-titel` via `KennisartikelTaalvarianten.filter(...)`), `KennisartikelTaalvariant` (`taal` en `titel` via enkelvoudige GE-klassenaam), `Trefwoord` (`nl-trefwoord` via `Trefwoordtaalvarianten.filter(t, t.taal == "nl")[0].woord`). Alle met `IsWeergaveVeld: true`. (2026-05-12) | afgeleide-velden.md |
| F35 | Geïntegreerde code-editor (één paneel, type "in" de gekleurde code). Opties: **react-simple-code-editor** (~3 KB, licht), **CodeMirror 6** (~150 KB, volledig), **Monaco** (~2 MB, overkill). Zie §12.8 in inhoud-editor-technisch.md | inhoud-editor-technisch.md |
| F36 | Code splitting per doelgroep: publicatie (mobiel/licht), inhoud-editor (desktop), IDE (zwaar/desktop). Vite multi-entry is al ingericht. | inhoud-editor-technisch.md |
| F37 | Inhoud.html (content editor): export data als Bootstrap / replay file / sql | nieuw |
| F38 | zelfde loading en filtering als de publicatie pagina | nieuw  |
| F39 | validatie bij opvoer waarden |   |
| F40 | edit widgets |   |
| F |  |   |

| F |  |   |

| F |  |   |

| F |  |   |


### Frontend — Bestaande pagina's (Index/Tijdlijn/Registraties)

| # | Item | Bron |
|---|------|------|
| V1 | Edit popups: functioneel scheiden (bekijk/bewerk/voer af) | README.md |
| V2 | Enkelvoudig/meervoudig tonen (1 of *) | README.md |
| V3 | Corrigeert registratie: lijntje tekenen | README.md |
| V4 | Doorklikken naar gerelateerd record | README.md |
| V5 | Ongedaangemaaktheid van registraties tonen | README.md |
| V6 | ✅ Domein-badges en domeinfilter op RegistratieReplayPage: gekleurde chips per registratie, dropdown-filter, klikbare badges | nieuw |

### Domeinen

| # | Item | Bron |
|---|------|------|
| DM1 | schema_domeinen tabel in database met endpoint | ontwerpgedachten/domeinen |
| DM2 | Domein als "actief domein" in editor | ontwerpgedachten/domeinen |
| DM3 | ✅ Validatie vóór publish: scope beperkt tot geselecteerd domein + leesbare foutmeldingen (typenamen i.p.v. indices) — `validateV3Model(v3, domeinFilter)` + `handleDialogChange` hervalidatie (2026-04-29) | ontwerpgedachten/domeinen |
| DM4 | ✅ Rebuild alleen voor geselecteerd domein — dialoog filtert validatie op gekozen domeinen (2026-04-29) | ontwerpgedachten/domeinen |
| DM5 | Domein-boundary visualisatie | ontwerpgedachten/domeinen |
| DM6 | Cross-model referentielijsten | Referentielijsten.md |
| DM7 | Domein verwijderen: flow in frontend + opschoning codegen-bestanden, `datatype_aliases.go` en `metaregistry_plumbing.go` init-calls. Basisdomein `register` kan nooit verwijderd. | DEVLOOP.md §3 rebuild-scenario's |
| DM8 | **Meertaligheid als domein-instelling** (uitwerking van punt 10 in 0.8): per domein aan/uit. Indien aan, krijgen *talige* content-velden op _Data een **taal-as** naast de formele tijds-as: extra kolommen `taal` (BCP 47) + `taaltype` (eigen / automatisch / juridisch / variant) op het _Data-record (geen extra tabellen). Multipliciteit-constraint: enkelvoudig in tijd én per taal — er kan dus per moment per taal maar één geldige waarde zijn; meervoudige GE's hebben die constraint niet. | brainstorm 2026-05-13 |

### CEL / Evaluatie

| # | Item | Bron |
|---|------|------|
| CEL1 | CEL-evaluatie in Go (github.com/google/cel-go) | afgeleide-velden.md |
| CEL2 | Frontend CEL: evalueren overstap naar library | CEL-evaluatie-js.md |
| CEL3 | Afleiding backend-first overwegen (lange termijn) | CEL-evaluatie-js.md |
| CEL4 | Check: condities in velden in expressie | t.b.v. detailpagina's |

### Referentielijst-specifiek

| # | Item | Bron |
|---|------|------|
| R1 | Referentielijsten vullen met data | README.md |
| R2 | Meer referentielijsten toevoegen | README.md |
| R3 | Cross-model referentielijsten | Referentielijsten.md |
| R4 | Items-relatie FK constraint (DB CHECK) | Referentielijsten.md |
| R5 | Codegenerator aanpassen voor referentielijsten | Referentielijsten.md |
| R6 | Omschrijvingen updaten (NP, Locatie, Adres, BAGLocatie) | Referentielijsten.md |
| R7 | Ref lijst id uniek maken: hoe? Unieke shorthand code, id of uuid? | nieuw |
| R8 | **Aparte registreer-variant voor ref-lijst-items**: simpeler en-masse-opvoer; verbergt de complexiteit van een replay-file zoals nu gebruikt | brainstorm 2026-05-13 |
| R9 | **Ref-lijst items wijzigen**: standaard-flow voor de meeste gevallen; specifieker pad voor uitzonderingen (correctie vs. opvolger) | brainstorm 2026-05-13 |
| R10 | **Materiele tijd in ref-lijsten**: typisch oneindig aan beide kanten, maar soms niet — visueel duidelijk maken (icoon / tooltip / kleur) wanneer aanvang/einde bewust beperkt zijn | brainstorm 2026-05-13 |

### Publicatie site

> Aparte Vite-entry (`publicatie.html`), eindgebruikersgerichte weergave van registerdata via WeergaveDefinities. Fundament (F22–F24, F31–F33) is ✅ gebouwd.

| # | Item | Bron |
|---|------|------|
| P1 | Meervoudige items tonen in tabelweergave (GE's met momentvoorkomen meervoudig) | nog doortesten |
| P2 | ✅ Doorzoekbare / filterbare tabelweergave voor eindgebruikers | nieuw |
| P3 | ✅ Navigatie vanuit detailpagina naar gerelateerde entiteiten (doorklikken) | nieuw |
| P4 | Tijdreis-kiezer (formeel/materieel peiltijdstip) in publicatieweergave | nieuw |
| P5 | Responsive / mobiel-vriendelijk ontwerp | nieuw |
| P6 | WeergaveDefinitie beheer-UI (aanmaken, bewerken, archiveren) | nieuw |
| P7 | ad P1: meervoudig formaat "A, B en C" | nieuw |
| P8 | Widgets kunnen gebruiken voor speciale gevallen | nieuw |
| P9 | ✅ Zoeken over alle rijen: preload alle rijen | Nieuw |
| P10 | Doorklikken naar detailpaginavariatie x (speciale link) | Nieuw |
| P11 | Lijstjes in detailweergave simpel (A, B en C) notatieformaat: CEL? | Nieuw |
| P12 | condities in detailweergave (gem, rol=maker) + lijstjes (CEL?)| Nieuw |
| P13 | Filter ingewikkelder: uitsluitingen enz. | Nieuw |
| P14 | Sorteren | Nieuw |
| P15 | Bij een enum-veld een dropdownfilter / datum een range enz. | Nieuw |
| P16 | Bij een lijst-veld een dropdownfilter afh. v lengte lijst? | Nieuw |
| P17 | websites vanzelf ook als link tonen | Nieuw |
| P | | Nieuw |
| P | | Nieuw |
| P | | Nieuw |
| P | | Nieuw |

### Requirements Management (RM)

| # | Item | Bron |
|---|------|------|
| RM1 | Requirements management (RM) opzetten | nieuw |
| RM2 | req ENT met type, inhoud, fase | nieuw |
| RM3 | REL naar opvoeder, bijwerker, uitvoerder | nieuw |
| RM4 | REL naar zichzelf met type link: aggregatie, realisatie, zelf aangeven | nieuw |
| RM5 | Im/exporteer reqs als: linked data, mim, ea | nieuw |
| RM6 | Visualiseer reqs als boomstructuur pagina / verslepen / inline edit / relaties maken (IDE specialisatie: nodes / edges / tree) | nieuw |
| RM7 | Per project / domein / werkgroep | nieuw |

### Gebruiker

| # | Item | Bron |
|---|------|------|
| GB1 | Gebruiker en Werkgroep ENT'n maken | nieuw |
| GB2 | Rollen tabel | nieuw |

### Data-universum

> Overkoepelend inzicht in alle instanties en hun onderlinge samenhang, over entiteitstypes heen.

| # | Item | Bron |
|---|------|------|
| DU1 | Dashboard: aantallen per entiteitstype, actief vs. afgevoerd | nieuw |
| DU2 | Cross-entity zoeken: vrije tekst doorzoekt alle entiteitstypes tegelijk | nieuw |
| DU3 | Tijdreis over het gehele register (combinatie formeel + materieel peiltijdstip) | nieuw |
| DU4 | Export van het complete register (JSON / CSV) | nieuw |
| DU5 | Graaf-visualisatie van instantie-relaties (wie is verbonden met wie) | nieuw |


### Model: inhoudelijk
- type datum incompleet
- kaart: geo iets

### Autorisatie / FTV / PBAC

> Aansluitend op het ontwerp in `autoriseren/autoriseren.md` (PxP-patroon op basis van XACML 3.0).

| # | Item | Bron |
|---|------|------|
| AUTH1 | **FTV-policy editor aansluiten en gebruiken** in v06: niet alleen ontwerp maar ook in de IDE/admin-UI policies bewerken en publiceren | brainstorm 2026-05-13 |
| AUTH2 | **Experimenteren met policies, rollen, gebruikers**: meerdere policy-sets, rolovererving, attribuut-gedreven scenario's | brainstorm 2026-05-13 |
| AUTH3 | **Organisatieregister opzetten** (bitemporeel, eigen domein): Organisatie, OrganisatieEenheid, Functie, Gebruiker, Lidmaatschap, met aanvang/einde | brainstorm 2026-05-13 |
| AUTH4 | **PBAC ophangen aan organisatieregister**: PIP haalt principal-attributen direct uit het org-register; tijdsdimensie maakt "wie was er bevoegd op tijdstip t" beantwoordbaar | brainstorm 2026-05-13 |
| AUTH5 | **AuthZEN tokens experimenteren**: PEP→PDP via OpenID AuthZEN evaluatie-API; vergelijken met directe Go-PDP | brainstorm 2026-05-13 |

### Documentatie by example

| # | Item | Bron |
|---|------|------|
| DOC1 | **Voorbeelden als first-class element op REPs**: per ENT/GE/REL een lijst voorbeeld-instanties met JSON-payload + label; roundtrippen in V3 + MetaRegistry; tonen op detailpagina's en in API-docs | brainstorm 2026-05-13 |
| DOC2 | **Data-scenario's als object-diagrammen**: scenario beschrijft een verzameling instanties + relaties, gerenderd als UML-object-diagram (lollipop met instantienaam:Klassenaam); zelfde editor als metamodel maar met *instances* als nodes; basis voor testdata-generatie (TD1) en uitleg (DOC1) | brainstorm 2026-05-13 |

### Testdata-generatie

| # | Item | Bron |
|---|------|------|
| TD1 | **Testdata genereren via UI/IDE**: kies groepje REPs, geef variatie-eisen (aantal, distributie, randwaarden, talenmix), genereer en publiceer als replay-file of direct via registratie-API | brainstorm 2026-05-13 |
| TD2 | **MCP-koppeling voor AI-gestuurde testdata**: Model Context Protocol-server zodat een LLM met sampled schema-context realistische data kan voorstellen; aandachtspunten: kostenbegrenzing, authenticatie, rate-limit, dry-run-preview | brainstorm 2026-05-13 |
| TD3 | **Bij rebuild ook data-variaties binnenhalen**: data-bootstrap vanuit replay-files in `replay files/`, met variant-keuze (leeg / minimaal / demo / stress) | brainstorm 2026-05-13 |
| TD4 | Data-scenario's (DOC2) als bron voor TD1: scenario → fixture → replay-file → DB | brainstorm 2026-05-13 |

### Backlog-hygiëne

| # | Item | Bron |
|---|------|------|
| BH1 | **Backlog opschonen**: meerdere items zijn al gebouwd maar niet afgevinkt. Aanpak: per increment-afsluiting backlog-pass; ✅-marker + datum + verwijzing naar implementatie-bestand. Optioneel: `cmd/backlog-check/` script dat per item zoekt naar "BACKLOG_REF: B27" o.i.d. in code-comments en automatisch open/dicht-status bijhoudt | brainstorm 2026-05-13 |

---

## Visie & Plan — Increment 2

Onderstaande indeling is een voorstel voor de volgende ontwikkelfasen, gebaseerd op de afhankelijkheden en de waarde die elk blok levert.

### Increment 2A — IDE verdiepen (fundamenten)

Focus: de IDE robuust en productief maken voor dagelijks modelwerk.

| Prio | Items | Reden |
|------|-------|-------|
| 1 | **I1–I4** Multi-diagram (tabs, node ≠ element, viewport) | Ontgrendelt werken met grotere modellen |
| 2 | **I10** Kardinaliteit [0..*] op velden | Essentieel voor correcte modellering |
| 3 | ~~**O5** Generalisatie-edge in IDE~~ **✅ DONE** | Rendering + toolbar edge-mode knoppen |
| 4 | **I6** Drag & drop: ENT + alle GE's mee | Kwaliteit van leven bij herindelen |
| 5 | **I7** Auto-order | Layout-kwaliteit bij grotere diagrammen |
| 6 | **DM2–DM5** Domein als actief domein, validatie, boundary | Domeinscheiding zichtbaar en afdwingbaar |
| 7 | **E11** Node resize | Gebruiker kan nodes groter/kleiner maken |
| 8 | **E13** ENT→ENT edge = maak REL | Snelle relatie-creatie op canvas |
| 9 | ~~**E14** Alt-drag vanuit ENT → maak GE~~ **✅ DONE** | Snelle GE-creatie op canvas |
| 10 | ~~**I16–I17** IDE toolbar: create-knoppen + normaliseer/snap~~ **✅ DONE** | Volledige IDE-werkbalk |
| 11 | ~~**E15–E16** Edge-mode toolbar (comp+gen)~~ **✅ DONE** | Associatietype kiezen en tekenen |
| 11 | **I18** Verplaatsbare toolbars | Professionele IDE-layout |
| 12 | **I19** PB rechtsklik: nieuw element per type | Creëren vanuit projectbrowser |

### Increment 2B — Codegenerator betrouwbaar

Focus: van IDE-model naar werkende Go-code zonder handmatig bijwerken.

| Prio | Items | Reden |
|------|-------|-------|
| 1 | **C1** Fix alle 9 gaps in codegen | Basisbetrouwbaarheid |
| 2 | **C3** Roundtrip-test np-loc model | Bewijs dat codegen correct is |
| ~~3~~ | ~~**O1** ✅, **O7–O10** ✅, **O2–O4** ✅ Overerving in DB, handlers, schema-API~~ **✅ DONE** | Foundations voor generalisatie |
| ~~4~~ | ~~**D3–D4** Delta-analyse CLI + DDL-migratie~~ **✅ DONE** | Veilig upgraden van modellen |
| 5 | **C4** Codegen voor referentielijsten | Referentielijsten mee laten genereren |

### Increment 2C — Backend verrijking

Focus: de API sterker en completer maken.

| Prio | Items | Reden |
|------|-------|-------|
| 1 | **B7–B9** Materiële tijdreizen + validatie | Kernvaardigheid bitemporeel register |
| 2 | **B4–B6** Afgeleide velden (CEL in Go, validatie, API) | Modelgedreven berekende waarden |
| 3 | **B11–B12** Nieuwe registratie-aanpak + ongedaanmaking² | Registratie-flow compleet |
| 4 | **G1** Dynamische GraphQL-laag | Vervangt gqlgen, minder code |
| 5 | **B1** API logging met logrotatie | Operationele volwassenheid |
| 6 | **B14** Tijdsreizen nalopen (KVK voorbeelden) | Validatie van het bitemporele model |

### Increment 2D — Frontend: content editor iteratie 2

Focus: content editor (formulieren) doorontwikkelen.

| Prio | Items | Reden |
|------|-------|-------|
| 1 | **F1** Custom formulierdefinities in JSON | Flexibele formulieren |
| 2 | **F2** Conditionele zichtbaarheid | Gebruiksvriendelijkheid |
| 3 | **F6** Tijdreis in editor (peil-/tijdstipkiezer) | Kernfeature voor eindgebruikers |
| 4 | **F7** Audit-trail weergave per record | Transparantie |
| 5 | **F10–F11** Records verwijderen + ongedaan maken | Basis CRUD afronden |
| 6 | **V1–V5** Bestaande pagina's verbeteren | Views, doorklikken, corrigeren |

### Increment 2E — Publicatie site

Focus: de publicatieweergave geschikt maken voor eindgebruikers.

| Prio | Items | Reden |
|------|-------|-------|
| 1 | **P1** Meervoudige items in tabelweergave | Correcte weergave van meervoudige GE's |
| 2 | **P2** Doorzoekbare / filterbare tabel | Bruikbaarheid voor eindgebruikers |
| 3 | **P3** Navigatie naar gerelateerde entiteiten | Doorklikken binnen het register |
| 4 | **P4** Tijdreis-kiezer in publicatieweergave | Kernfeature bitemporeel register |
| 5 | **P5** Responsive / mobiel ontwerp | Bereikbaarheid op alle apparaten |
| 6 | **P6** WeergaveDefinitie beheer-UI | Zelfbeheer door functioneel beheerder |

### Horizon (later, bewust geparkeerd)
### Horizon (later, bewust geparkeerd)

| Items | Reden om te wachten |
|-------|---------------------|
| **I5** Multi-user / database-sync | Eerst lokaal solide maken |
| **F8** RBAC op veldniveau | Pas relevant bij multi-user |
| **F9** Drag-and-drop formulier-builder | Hoge complexiteit, lage urgentie |
| **B18** gRPC/Connect | Pas overwegen bij typed-client behoefte |
| **G7–G8** Typed mutations, subscriptions | GraphQL eerst basaal werkend |
| **CEL3** Afleiding backend-first | Eerst CEL in Go en frontend stabiel |
| **DU2–DU5** Cross-entity zoeken, tijdreis register-breed, export, graaf | Pas waardevol bij voldoende data en stabiele registers |


## 26. Process Engine (Operaton) integratie

Toegevoegd 2026-05-21 — externe integratie via BPMN-workfloworkestratie bovenop bitemp_register_v06.

### Gereed (PoC smoke-test geslaagd 2026-05-21)

| # | Item | Status |
|---|------|--------|
| PE1 | Operaton 2.1.0 als Docker-sidecar met eigen PostgreSQL-backend | ✅ |
| PE2 | Go external-task worker v2 (long-poll, **6 topics**) | ✅ |
| PE3 | BPMN v2: 
egistreer_inwoner_v2 — multi-branch locatie+NP-flow | ✅ |
| PE4 | check-locatie topic — GET /full/locaties/{id} met estaat/ctueel variabelen | ✅ |
| PE5 | check-np topic — GET /full/natuurlijk_personen/{id} met 
p_bestaat/
p_actueel | ✅ |
| PE6 | 
egistreer-np-bereikbaarheid topic — nieuw NP + bereikbaarheid in 1 registratie | ✅ |
| PE7 | 
egistreer-bereikbaarheid topic — alleen bereikbaarheid (NP bestaat al, historisch) | ✅ |
| PE8 | ron/ron_kenmerk Operaton-provenance in elke registratie (zie B32) | ✅ |

### Openstaand / toekomstig

| # | Item | Prio |
|---|------|------|
| PE9 | CallActivity registreer_locatie sub-process deployen (locatie bestaat niet-pad) | ✅ |
| PE10 | Error-handling op AL_INWONER BPMN-fout (persoon al geregistreerd als actueel inwoner) | Hoog |
| PE11 | DMN-tabel voor beslissingslogica (bijv. welk bereikbaarheidstype) | Midden |
| PE12 | CMMN / ad-hoc taken voor niet-gestructureerde gemeenteprocessen | Laag |
| PE13 | Worker-retry-strategie voor transiënte fouten (HTTP 5xx, timeout) — nu 0 retries bij zakelijke fout | Hoog |
| PE14 | BSN-generatie in testdata-helpers (geldige 11-proef BSN's) | Laag |
| PE15 | Operaton Cockpit Tasklist koppelen aan bitemp-formulieren | Laag |
| PE16 | Landen-referentielijst vullen (nu leeg); land=0 is tijdelijke waarde in locatie-adres | Midden |

### Referentie

- process_engine_v01/README.md — volledige architectuurbeschrijving, worker-setup, smoke-test resultaten
- process_engine_v01/deployments/poc/registreer_inwoner_v2.bpmn — BPMN v2 definitie (versie 2, met locatie-adresvelden + camunda:in/out)
- process_engine_v01/deployments/poc/registreer_locatie.bpmn — CallActivity sub-proces
- process_engine_v01/deployments/poc/start_locatie_nieuw.json — testpayload voor locatie_bestaat=false pad
- process_engine_v01/internal/worker/service_task.go — external-task worker implementatie (6 topics)
- Padnamen: zie MetaRegistry — altijd snake_case + meervoud (bijv. locaties, 
atuurlijk_personen)
