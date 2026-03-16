# React + Vite overzicht (team)

Dit document geeft een praktisch overzicht van de React + Vite frontend in deze repository.
Doel: snel kunnen onboarden, veilig kunnen wijzigen, en consequent kunnen documenteren.

## 1. Hoofdstructuur

```text
web/
  vite/                 # broncode (React + Vite)
    index.html          # entry voor index-pagina
    tijdlijn.html       # entry voor tijdlijn-pagina
    vite.config.js      # Vite build-config (multi-page + output locatie)
    package.json        # scripts en npm dependencies
    src/
      main.jsx
      App.jsx
      pages/
      components/
      shared/
      styles/
  react/                # build output (gegenereerd door `npm run build`)
  shared/               # gedeelde assets voor legacy html pagina's
  index_schema.html     # legacy pagina
  tijdlijn_schema.html  # legacy pagina
```

Kernidee:
- `web/vite` is de bron van de nieuwe frontend.
- `web/react` is build-output (niet handmatig aanpassen).
- Legacy pagina's in `web/` bestaan nog naast de nieuwe React-variant.

## 2. Vite build en routes

Belangrijk uit `vite.config.js`:
- `base: "/viz/react/"`
- `outDir: "../react"`
- Multi-page input:
  - `index.html`
  - `tijdlijn.html`

Na build zijn de belangrijkste routes:
- `/viz/react/`
- `/viz/react/tijdlijn.html`

## 3. Map `src/` uitgelegd

### `src/pages/`
Container-pagina's met page-level state en orkestratie:
- `IndexSchemaPage.jsx`
- `TijdlijnSchemaPage.jsx`

### `src/components/`
UI opgesplitst in herbruikbare stukken.

Submappen:
- `components/index/`
  - index-specifieke header, controls en visual-panels
- `components/tijdlijn/`
  - tijdlijn-specifieke header, controls en visual-panels
- `components/actions/`
  - actiepanelen die gedeeld kunnen worden tussen index en tijdlijn
  - huidige componenten:
    - `ActionFormParts.jsx`
    - `NieuweEntiteitActieBox.jsx`
    - `RegistratieActieBox.jsx`
    - `EntiteitActieBox.jsx`
    - `RepresentatieActieBox.jsx`

### `src/shared/`
Gedeelde logica en styling voor beide pagina's:
- `schemaUtils.js` (helpers)
- `SvgPatternDefs.jsx` (svg pattern defs)
- `schema-viz.css` (basis css)

### `src/styles/`
Pagina-specifieke css:
- `index-schema.css`
- `tijdlijn-schema.css`

## 4. Entrypoints en pagina-opbouw

- `index.html` laadt de React index-entry.
- `tijdlijn.html` laadt de tijdlijn-entry.
- Pagina's in `src/pages/` gebruiken componenten uit `src/components/`.
- Gedeelde util/css blijft in `src/shared/`.

Praktische regel:
- Page-level state in `pages/`.
- Presentatie en deel-ui in `components/`.
- Algemene helpers nooit dupliceren, maar in `shared/` plaatsen.

## 5. NPM scripts

In `web/vite/package.json`:
- `npm run dev` - lokale Vite dev server
- `npm run build` - productiebuild naar `web/react`
- `npm run preview` - lokale preview van build

PowerShell tip:
- Als script execution policy `npm` blokkeert, gebruik `npm.cmd`.

## 6. Projectdocumentatie (concreet ingevuld)

Onderstaand is het volledige lijstje uit punt 1 t/m 6, nu concreet voor deze codebase.

### 6.1 Routing en entrypoints

- Build-output routes:
  - `/viz/react/` -> index-pagina
  - `/viz/react/tijdlijn.html` -> tijdlijn-pagina
- HTML entrypoints in Vite bron:
  - `web/vite/index.html`
  - `web/vite/tijdlijn.html`
- Beide html-bestanden laden dezelfde JS entry: `src/main.jsx`.
- In `src/App.jsx` bepaalt `routeFromPath(window.location.pathname)` welke page wordt gerenderd:
  - pad eindigt op `/tijdlijn`, `/tijdlijn/` of `/tijdlijn.html` -> `TijdlijnSchemaPage`
  - anders -> `IndexSchemaPage`

### 6.2 Component-eigenaarschap (welke pagina gebruikt wat)

Index-pagina (`src/pages/IndexSchemaPage.jsx`) gebruikt:
- `components/index/SchemaIndexHeader`
- `components/index/SchemaIndexControls`
- `components/index/IndexRegistratieVisual`
- `components/index/IndexRepresentatieVisual`
- `components/actions/RegistratieActieBox`
- `components/actions/EntiteitActieBox`
- `components/actions/RepresentatieActieBox`

Tijdlijn-pagina (`src/pages/TijdlijnSchemaPage.jsx`) gebruikt:
- `components/tijdlijn/SchemaTijdlijnHeader`
- `components/tijdlijn/SchemaTijdlijnControls`
- `components/tijdlijn/TijdlijnRegistratiePaneel`
- `components/tijdlijn/TijdlijnRepresentatiePaneel`

Gedeelde/herbruikbare componenten:
- `components/actions/*` is bedoeld voor hergebruik over meerdere pagina's.
- `shared/SvgPatternDefs.jsx` en `shared/schemaUtils.js` zijn pagina-overstijgende bouwblokken.

### 6.2.1 Actieformulieren en hergebruik

De actie-overlays in de index-pagina zijn opgesplitst in:
- `NieuweEntiteitActieBox.jsx`
- `EntiteitActieBox.jsx`
- `RegistratieActieBox.jsx`
- `RepresentatieActieBox.jsx`

De gedeelde formulieropbouw zit in:
- `components/actions/ActionFormParts.jsx`

Daarin zitten de centrale bouwstenen voor de editstijl:
- `ActionBodyCard`
- `ActionTopFields`
- `ActionInlineField`
- `ActionSection`
- `ActionRowCard`
- `ActionFieldsGrid`
- `ActionLabeledEditorField`
- `ActionFieldControl`
- `ActionGroupedSections`

Praktische regel:
- aanpassingen aan de layout of basisgedrag van actieformulieren zoveel mogelijk in `ActionFormParts.jsx` doen
- alleen domeinspecifieke flow in de losse `*ActieBox.jsx` componenten houden

### 6.3 Dataflow en state

State-eigenaarschap:
- Page-level state leeft in:
  - `IndexSchemaPage`
  - `TijdlijnSchemaPage`
- Child-componenten zijn primair presentational en ontvangen data + callbacks via props.

Belangrijkste stategroepen in `IndexSchemaPage`:
- Routing/API: `baseUrl`
- Filter/selectie: `entiteitType`, `t`, `registratieId`, `selectedEntiteitId`, `geselecteerdeRep`
- Data: `responseData`, `registratieData`, `vizSchema`, `responseKey`
- UI-status: `loading`, `error`, `schemaError`
- Actieflow: `actie*`, `registratieActie*`, `entiteitNieuwe*`, `nieuweEntiteit*`, `relatieSecondaireOpties`

Belangrijkste stategroepen in `TijdlijnSchemaPage`:
- Routing/API: `baseUrl`
- Selectie/filter: `entityType`, `entityId`
- Data: `schema`, `items`, `overlayArrows`
- UI-status: `loading`, `exporting`, `copying`, `error`, `schemaError`

Callbacks met side effects (API/refresh/export):
- Index:
  - `loadSchema`, `loadData`
  - `voerRegistratieOngedaanMakingUit`, `voerRegistratieCorrectieUit`
  - `voerEntiteitActieUit`, `voerNieuweEntiteitActieUit`, `voerActieUit`
  - `navigeerNaarRegistratieVanOpvoer`
- Tijdlijn:
  - `loadSchema`, `loadTimeline`
  - `renderTimelineCanvas`, `downloadTimelineAsPng`, `copyTimelineAsPng`

### 6.4 API-afhankelijkheden

Configuratie:
- `baseUrl` komt uit `import.meta.env.VITE_API_BASE_URL` met fallback `window.location.origin`.

Endpoints die door de React+Vite pagina's worden gebruikt:
- Schema/viz:
  - `GET /api/viz/schema`
  - `GET /api/viz/entiteit/:typenaam/max-id`
  - `GET /api/viz/relatie/:typenaam/secondaire-ids`
- Registraties en snapshots:
  - `GET /full/registraties?page=:page&size=:size`
  - `GET /full/registraties/:id`
  - `GET /full/:segment/?t=:t`
  - `GET /full/:segment/:id?t=:t`
- Mutaties:
  - `POST /registratie/`

Belangrijke response-verwachtingen in frontendlogica:
- `fetchAlleRegistraties` verwacht `Registraties` + `has_more`.
- Bij mutatieacties wordt registratie-id uit response afgeleid via helperlogica (`Registratie` en gerelateerde sleutelvarianten).
- Voor entiteiten wordt response-key dynamisch bepaald (bijvoorbeeld `As`/`Bs`/... of andere array key).

### 6.4.1 Schema-gedreven veldtypes en validatie

De frontend gebruikt de veldmetadata uit `GET /api/viz/schema` actief voor formuliergedrag.

Relevante veldeigenschappen uit het schema:
- `naam`
- `type`
- `format`
- `verplicht`
- `autoIncrement`

Type- en formatinformatie wordt in `IndexSchemaPage.jsx` doorgezet naar `veldDefinities` voor:
- gegevenselementgroepen
- relatiegroepen

De centrale validatie en coercion zit in `ActionFormParts.jsx`:
- `validatieMeldingVoorVeld(...)`
- `coercedWaardeVoorVeld(...)`

Wat dit nu concreet doet:
- `integer` accepteert alleen gehele getallen
- `number` accepteert alleen geldige decimale getallen
- `boolean` wordt gestuurd via `true` / `false`
- `string + format=date` valideert op `YYYY-MM-DD`
- `string + format=date-time` valideert op datum+tijd invoer

Belangrijk ontwerpprincipe:
- live validatie in het formulier en coercion bij preview/submit gebruiken dezelfde centrale helpers
- daardoor kan de UI niet iets "goedkeuren" wat later in de payloadopbouw alsnog stukloopt

Gevolg voor onderhoud:
- als backendtypes of formats veranderen, moet de frontend primair op deze centrale helperlaag worden aangepast, niet per actiebox apart

Concreet voorbeeld:
- `rel_id` of `b_id` met `type=integer`
  - frontend accepteert alleen gehele getallen
  - invoer zoals `1.5` of `abc` geeft direct een foutmelding
  - payload bevat uiteindelijk een JSON number, niet een string
- `www` met `type=number` en `format=float64`
  - frontend accepteert decimale getallen
  - invoer zoals `12.34` is geldig
  - invoer zoals `12,34` of `abc` wordt afgekeurd
- `bbb` met `type=boolean`
  - frontend biedt alleen geldige boolean-invoer aan
  - payload bevat uiteindelijk `true` of `false`, niet de strings `"true"` of `"false"`
- `datum` met `type=string` en `format=date`
  - frontend gebruikt datumvalidatie op `YYYY-MM-DD`
  - ongeldige of incompleet getypte datums worden gemeld voordat submit plaatsvindt

### 6.5 Build/serve-koppeling

- Vite build schrijft naar `web/react` (`outDir: "../react"`).
- Backend serveert statische frontend via Gin:
  - `router.Static("/viz", "./web")` in `main.go`.
- Daardoor worden bestanden uit `web/react` beschikbaar onder `/viz/react/...`.
- `base: "/viz/react/"` in Vite is nodig zodat assets op de juiste publieke paden laden achter Gin.

### 6.6 Legacy versus nieuw

Nieuw (React + Vite):
- `web/vite` bevat de actieve React-broncode.
- `web/react` bevat de gegenereerde distributie.
- Beide hoofdschermen bestaan in React-vorm:
  - index
  - tijdlijn

Legacy (naast nieuw, nog aanwezig):
- `web/index_schema.html`
- `web/tijdlijn_schema.html`
- `web/shared/*` voor legacy gedeelde assets

Praktische status:
- React + Vite is functioneel leidend voor nieuwe wijzigingen.
- Legacy pagina's blijven aanwezig voor referentie/vergelijking en gefaseerde migratie.

## 7. Werkafspraken voor wijzigingen

Aanbevolen workflow:
1. Wijziging maken in `web/vite/src/...`.
2. Lokale build draaien (`npm run build` of `npm.cmd run build`).
3. Controleren of beide pagina's nog renderen.
4. Eventuele route-impact en component-impact bijwerken in documentatie.

## 8. Korte checklist voor nieuwe collega's

- Start in `web/vite/src/pages/` om de hoofdflow te begrijpen.
- Bekijk daarna `src/components/actions/` voor gedeelde actiepanelen.
- Lees `src/shared/schemaUtils.js` voor gedeelde business helpers.
- Controleer `vite.config.js` voor route/base/output gedrag.
