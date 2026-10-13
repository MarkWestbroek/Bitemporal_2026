# React + Vite (Schema Viz)

Deze map bevat stap 2 van de migratie van de schema-visualisaties naar React + Vite.

## Wat staat hier

- `src/pages/IndexSchemaPage.jsx`: migratie van `web/index_schema.html`
- `src/pages/TijdlijnSchemaPage.jsx`: migratie van `web/tijdlijn_schema.html`
- `src/pages/EditorPage.jsx`: wrapper rond de UML editor subtree
- `src/shared/schemaUtils.js`: gedeelde helpers (ESM)
- `src/shared/SvgPatternDefs.jsx`: gedeelde SVG pattern-defs (React component)
- `src/shared/schema-viz.css`: gedeelde basis-CSS
- `src/styles/index-schema.css`: index-specifieke CSS
- `src/styles/tijdlijn-schema.css`: tijdlijn-specifieke CSS

## Routes (na build)

Omdat Gin `router.Static("/viz", "./web")` gebruikt, worden de buildbestanden onder `web/react` geserveerd als:

- `/viz/react/` (index)
- `/viz/react/tijdlijn.html` (tijdlijn)
- `/viz/react/editor.html` (UML editor)

De editorcode is volledig geïntegreerd binnen deze Vite-app:

- `src/umleditor/` — UML/metamodel-editor module (voorheen `../../uml-editor/`)

Vite importeert die code via de alias:

- `@umleditor` -> `src/umleditor`

Zie ook `../../UML_EDITOR_INTEGRATIE.md`.

## Studio — geïntegreerde werkbank (`/studio`)

`src/studio/` bevat een VS Code-achtige werkbank die de losse functie-pagina's
(UML, DMN, BPMN, berichten, …) onder één schil brengt: een uitbreidbare iconenbalk
links en centrale werkvlakken met auto-hide tree-browser (links) en eigenschappen-paneel
(rechts). Elke functie is een *activiteit* met een dun contract (`Sidebar`/`Main`/`Inspector`);
de onderliggende modules blijven ongewijzigd. Een nieuwe functie toevoegen = één
descriptor registreren in `src/studio/activities/index.jsx`.

Volledige uitleg: `../../docs/STUDIO.md`.

## Ontwikkelen

1. Zorg dat Node.js + npm beschikbaar zijn op je machine.
2. Installeer dependencies:

   `npm install`

3. Start dev server:

   `npm run dev`

**In een git-worktree met gedeelde `node_modules`** (junction/symlink naar de hoofdclone):
start met `VITE_PRESERVE_SYMLINKS=1`, bv. `VITE_PRESERVE_SYMLINKS=1 npx vite --port 5175`
(PowerShell: `$env:VITE_PRESERVE_SYMLINKS="1"; npx vite --port 5175`). Zonder die vlag volgt Vite
de junction naar een pad buiten de root en faalt de EA-import ("Failed to fetch dynamically
imported module … sql-wasm.wasm?import&url"). Zie `resolve.preserveSymlinks` in `vite.config.js`.

## Regressietests Studio

Unittests (puur, Node): `node --import ./test/register-aliases.mjs --test "src/**/*.test.js"`
(op Windows via npm vindt het patroon niets door de quotes; roep node dan direct aan).

Gedrag in de interface staat in Playwright-specs `tests/e2e/1x-studio-*.spec.js` (selectie en
kaders, relaties en Delete, inspector, projectboom, vormen en vergroten). Ze mocken de API, dus
alleen een dev-server is nodig:

```bash
VITE_PRESERVE_SYMLINKS=1 npx vite --port 5175 --strictPort --host     # eigen poort (in een worktree)
PLAYWRIGHT_BASE_URL=http://localhost:5175 PLAYWRIGHT_API_URL=http://127.0.0.1:9 npm run test:e2e:studio
```

`PLAYWRIGHT_API_URL` naar een dode poort laat de global-setup de login overslaan. Gedeelde opzet:
`tests/e2e/helpers/studio.js` (Studio openen, model in een profiel zetten, selectie lezen,
HTML5-slepen). Na een codewijziging in een draaiende dev-server: eerst herstarten, anders laden
de tests via HMR een tweede module-instantie.

## Builden naar door Gin geserveerde map

- `npm run build`

De output gaat naar `web/react` via `vite.config.js` (`outDir: "../react"`).

## API base URL

Standaard gebruiken de pagina's `window.location.origin`.
Je kunt overschrijven met:

- `VITE_API_BASE_URL`
