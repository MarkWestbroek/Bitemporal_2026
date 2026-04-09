# Inhoud Editor — Technische Documentatie

> **Datum**: 30 maart 2026  
> **Versie**: Iteratie 2 — GE-acties  
> **Scope**: Schema-gedreven CRUD-editor voor bitemporeel register v06

---

## 1. Overzicht

De **Inhoud Editor** is een nieuwe Single Page Application (SPA) binnen de bestaande v06 frontend die het mogelijk maakt om registerinhoud te bekijken en bewerken via dynamisch opgebouwde tabellen en formulieren. Alle velden, types en navigatie worden automatisch afgeleid uit de schema-API (`/api/viz/schema`), zodat bij modelwijzigingen géén frontend-code hoeft te worden aangepast.

### Kernprincipes

- **Schema-gedreven**: alle UI wordt volledig opgebouwd uit de MetaRegistry via de schema-API
- **NL Design System**: UI-componenten volgen de NL Design System richtlijnen via `@utrecht/component-library-react` met Common Ground branding
- **Bitemporeel registratiepatroon**: wijzigingen gaan via het bestaande `/api/registratie/` endpoint (niet via directe CRUD)
- **Minimale impact**: bestaande pagina's (index, tijdlijn, registraties, UML-editors) zijn ongewijzigd gebleven
- **Geen backend-wijzigingen**: de MVP werkt volledig met bestaande API-endpoints

---

## 2. Architectuur

### 2.1 Entry point & routing

De editor is een apart Vite entry point (`inhoud.html`) met een eigen React-applicatie. Dit volgt het bestaande MPA-patroon: elke pagina heeft een eigen HTML-bestand en JavaScript-bundle.

**Routing**: `HashRouter` (react-router v7). URL-patroon: `/viz/react/inhoud.html#/t/{padnaam}`.

HashRouter is gekozen omdat de Go-server statische bestanden serveert via `router.Static("/viz", "./web")` zonder catch-all voor SPA sub-paden. Met hash-routing werkt de navigatie zonder server-aanpassingen.

**Route-structuur**:

| Hash-pad | Component | Beschrijving |
|---|---|---|
| `#/` | Welkomstpagina | Tekst: "Kies een entiteittype in de zijbalk" |
| `#/t/:typePad` | `InhoudEditorPage` | Tabeloverzicht voor één type |
| `#/t/:typePad/nieuw` | `NieuwRecordFormulier` | Formulier voor nieuw record |
| `#/t/:typePad/:id` | `EntiteitFormulier` | Detail/bewerk formulier met geneste GE's |

### 2.2 Componenthiërarchie

```
main.jsx
├── EditorErrorBoundary       (error catching)
└── HashRouter
    └── EditorApp
        ├── SchemaProvider     (schema context)
        ├── <header>           (Common Ground nav met logo)
        ├── EditorNavigatie    (zijbalk: entiteittype-links)
        └── <Routes>
            ├── InhoudEditorPage
            │   └── RepresentatieTabel
            │       └── FilterInvoer (per kolom)
            ├── NieuwRecordFormulier
            │   └── RepresentatieFormulier
            │       └── SchemaFormField (per veld)
            └── EntiteitFormulier
                ├── RepresentatieFormulier (hoofd-entiteit)
                └── Per onderliggend GE/relatie:
                    ├── RepresentatieFormulier (enkelvoudig)
                    └── <table> (meervoudig)
```

### 2.3 Data-flow

```
Schema-API (/api/viz/schema)
       │
       ▼
SchemaProvider (React Context)
  ├── typeMetaByTypenaam  (map: typenaam → typeMeta)
  ├── typeMetaByPadnaam   (map: padnaam/veldnaam → typeMeta)
  ├── entiteitTypes       (array: gefilterd op metatype === "entiteit")
  └── baseUrl             (API base URL, poort 8082)
       │
       ▼
Componenten lezen typeMeta uit context
       │
       ├── RepresentatieTabel  →  GET /api/{padnaam}?page=1&size=1000
       ├── EntiteitFormulier   →  GET /api/full/{padnaam}/{id}
       └── RepresentatieFormulier → POST /api/registratie/ (opslaan)
```

---

## 3. Nieuwe bestanden

### 3.1 Entry point & SPA shell

| Bestand | Beschrijving |
|---|---|
| `web/vite/inhoud.html` | HTML entry point. Laadt `src/editor/main.jsx` |
| `web/vite/src/editor/main.jsx` | SPA root: HashRouter, SchemaProvider, layout (header + sidebar + main), ErrorBoundary |
| `web/vite/public/common-ground-logo.svg` | Common Ground logo (gekopieerd uit `visuals/`) |

### 3.2 Context

| Bestand | Beschrijving |
|---|---|
| `web/vite/src/context/SchemaContext.jsx` | React Context die `/api/viz/schema` eenmaal ophaalt. Biedt: `vizSchema`, `typeMetaByTypenaam`, `typeMetaByPadnaam`, `entiteitTypes`, `baseUrl`, `loading`, `error`. Hook: `useSchema()` |

### 3.3 Stijlen

| Bestand | Beschrijving |
|---|---|
| `web/vite/src/styles/common-ground-theme.css` | Common Ground design tokens (CSS custom properties die Utrecht tokens overriden). Layout-klassen voor editor (`.cg-editor-nav`, `.cg-editor-sidebar`, `.cg-editor-layout`, `.cg-editor-main`). Aanvullend: `.cg-form-card`, `.cg-form-section`, `.cg-feedback--succes/--fout`, `.cg-pagination` |

### 3.4 Pagina-componenten

| Bestand | Beschrijving |
|---|---|
| `web/vite/src/pages/InhoudEditorPage.jsx` | Hoofdpagina: leest `typePad` uit URL, zoekt typeMeta op via `typeMetaByPadnaam`, rendert `RepresentatieTabel` + "Nieuw" knop |

### 3.5 Editor-componenten

| Bestand | Beschrijving |
|---|---|
| `src/components/editor/EditorNavigatie.jsx` | Zijbalk met dynamisch opgebouwde NavLink's naar elk entiteittype. Kleur-bolletje per type (uit `meta.kleur`). Actieve link krijgt blauwe border-left |
| `src/components/editor/RepresentatieTabel.jsx` | Generiek tabel-component. Kolommen uit `typeMeta.velden`, data uit API. Client-side sortering (kolomklik), filtering (per-kolom input/select), paginering (`@tanstack/react-table`). Rijklik navigeert naar detailformulier |
| `src/components/editor/SchemaFormField.jsx` | Generiek formulierveld. Rendert juiste invoertype op basis van `veld.type`/`format`: text, date, datetime-local, number, boolean (radio), enum (select). Validatie via `validatieMeldingVoorVeld()` |
| `src/components/editor/RepresentatieFormulier.jsx` | Formulier voor één representatie. Dynamisch opgebouwd uit `typeMeta.velden`. Props: `isEnkelvoudig` (bepaalt beschikbare acties), `onCancel` (voor annuleren bij meervoudige correcties). **Acties per modus** — zie §8b. Dirty tracking (knopactivering pas bij wijziging). Similarity check bij Wijzigen (suggestie Corrigeren bij weinig wijzigingen). Readonly voor PK/autoincrement velden. Formele tijd metadata als readonly sectie |
| `src/components/editor/EntiteitFormulier.jsx` | Volledig entiteitformulier. Haalt data op via `/api/full/{padnaam}/{id}`. Toont hoofd-entiteit velden + per onderliggend GE/relatie een sectie: enkelvoudig → formulier met acties, meervoudig → tabel met per-rij ✎ (corrigeren) en ✕ (verwijderen) knoppen + inline correctieformulier |
| `src/components/editor/NieuwRecordFormulier.jsx` | Wrapper rond `RepresentatieFormulier` zonder `initialData` (nieuw record) |

---

## 4. Gewijzigde bestanden

| Bestand | Wijziging |
|---|---|
| `web/vite/vite.config.js` | `inhoud: resolve(__dirname, "inhoud.html")` toegevoegd aan `build.rollupOptions.input` |
| `web/vite/package.json` | Nieuwe dependencies toegevoegd (zie §5) |

**Niet gewijzigd**: `App.jsx`, `main.go`, `addroutes.go`, bestaande components, Go handlers.

---

## 5. Dependencies

| Package | Versie | Doel |
|---|---|---|
| `react-router` | ^7.x | Client-side hash-routing |
| `react-hook-form` | ^7.x | Formulier state management (beschikbaar voor Iteratie 2) |
| `@tanstack/react-table` | ^8.x | Headless tabel met sort/filter/paginering |
| `@utrecht/component-library-react` | ^13.0.3 | NL Design System React componenten |
| `@utrecht/component-library-css` | ^9.x | NL Design System CSS klassen |
| `@utrecht/design-tokens` | ^5.x | Basis design tokens (overridden door CG-thema) |

Installatie met `--legacy-peer-deps` vanwege een optionele peer dependency conflict (`vega@5` vs `vega@6`).

---

## 6. Hergebruikte bestaande code

De editor hergebruikt bestaande utilities om duplicatie te voorkomen:

| Bron | Functie | Gebruik in editor |
|---|---|---|
| `shared/schemaUtils.js` | `safeArray()` | Overal: veilig arrays uitpakken uit schema/API responses |
| `components/actions/ActionFormParts.jsx` | `validatieMeldingVoorVeld()` | `SchemaFormField`: veldvalidatie op basis van type/format/verplicht |
| `components/actions/ActionFormParts.jsx` | `coercedWaardeVoorVeld()` | `RepresentatieFormulier`: waarden coercen naar juist type bij submit |

---

## 7. Design: Common Ground thema

Het thema is geïmplementeerd als CSS custom properties die de standaard Utrecht design tokens overriden. De wrapper-klasse `.common-ground-theme` wordt gezet op de root van de editor-app.

### Brandkleuren

| Token | Hex | Gebruik |
|---|---|---|
| `--cg-geel` | `#ffc200` | Focus-ring, sectie-borders, accenten |
| `--cg-blauw` | `#00a1e5` | Primaire knoppen, links, actieve borders |
| `--cg-donkerblauw` | `#143462` | Tabelkoppen, navigatiebalk, headings, tekst |
| `--cg-wit` | `#ffffff` | Cards, formulieren, knoptekst |
| `--cg-lichtgrijs` | `#f4f6f8` | Pagina-achtergrond, zebra-rijen tabel |
| `--cg-grijs` | `#e2e8f0` | Borders, scheidingslijnen |
| `--cg-succes` | `#16a34a` | Succes-feedback |
| `--cg-fout` | `#dc2626` | Foutmeldingen, validatie |

### Layout-structuur

```
┌──────────────────────────────────────────────────────┐
│  header (.cg-editor-nav)                             │
│  [Logo]  Register — Inhoud Editor                    │
├──────────┬───────────────────────────────────────────┤
│ sidebar  │  main (.cg-editor-main)                   │
│ 240px    │                                           │
│          │  Tabeloverzicht / Formulier               │
│ Entiteit │                                           │
│ links    │                                           │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

---

## 8. API-endpoints gebruikt

| Endpoint | Methode | Component | Doel |
|---|---|---|---|
| `/api/viz/schema` | GET | `SchemaContext` | Schema ophalen (eenmalig) |
| `/api/{padnaam}?page=1&size=1000` | GET | `RepresentatieTabel` | Lijst records ophalen |
| `/api/full/{padnaam}/{id}` | GET | `EntiteitFormulier` | Volledig entiteit met geneste GE's |
| `/api/registratie/` | POST | `RepresentatieFormulier` | Nieuwe registratie met wijzigingen |

---

## 8b. GE-acties in de Inhoud Editor (Iteratie 2)

Sinds iteratie 2 ondersteunt de Inhoud Editor bitemporeel correcte acties op GE's en relaties.

### Enkelvoudige GE's (momentvoorkomen = "enkelvoudig")

Bij een bestaand enkelvoudig GE worden de velden direct bewerkbaar getoond.
Drie actieknoppen verschijnen onder het formulier:

| Knop | Enabled | Registratietype | Payload | Semantiek |
|---|---|---|---|---|
| **Wijzigen** | Alleen als velden gewijzigd zijn | `registratie` | `opvoer` van nieuw record | Backend voert de oude versie automatisch af. Inhoudelijk nieuw gegeven op de formele tijdsas. |
| **Corrigeren** | Alleen als velden gewijzigd zijn | `correctie` | `opvoer` van gecorrigeerd record | Correctie: fout in origineel herstellen, geen inhoudelijke wijziging |
| **Beëindigen** | Altijd | `registratie` | `afvoer` van huidig record | Beëindigt het GE zonder vervanging. Bevestigingsdialoog. |

#### Similarity check bij Wijzigen

Bij klik op Wijzigen controleert het formulier hoeveel velden zijn gewijzigd:
- Als ≤ helft van de bewerkbare velden gewijzigd is (en er >1 veld is), verschijnt een `confirm()`-dialoog:
  > "Er zijn slechts N van de M velden gewijzigd. Wilt u niet eigenlijk corrigeren?"
- **OK** → voert een correctie uit; **Annuleren** → voert de wijziging gewoon door.

Dit voorkomt dat een kleine taalfout per ongeluk als inhoudelijke wijziging wordt geregistreerd.

### Meervoudige GE's (momentvoorkomen = "meervoudig")

Meervoudige GE's worden getoond als een compacte tabel. Elke rij heeft twee actieknoppen:

| Knop | Actie | Registratietype | Payload |
|---|---|---|---|
| ✎ (potlood) | Opent inline correctieformulier onder de tabel | — | — |
| ✕ (kruis) | Verwijdert het record (na bevestiging) | `registratie` | `afvoer` van het geselecteerde record |

Het inline correctieformulier (een `RepresentatieFormulier` met `isEnkelvoudig=false`) biedt:

| Knop | Enabled | Registratietype | Payload |
|---|---|---|---|
| **Corrigeren** | Alleen als velden gewijzigd zijn | `correctie` | `opvoer` van gecorrigeerd record |
| **Verwijderen** | Altijd | `registratie` | `afvoer` van huidig record |
| **Annuleren** | Altijd | — | Sluit het correctieformulier |

Toevoegen van een nieuw meervoudig GE-record is ongewijzigd ("+ toevoegen" knop).

### State management

- `bewerkRij` state: `{ doeltype, index }` — welke meervoudige rij in correctiemodus is
- `nieuwGE` state: `doeltype` — welk GE-type in toevoegmodus is
- Deze twee states zijn wederzijds exclusief: openen van correctie sluit toevoeg-formulier en vice versa

### API payloads

```json
// Wijzigen (enkelvoudig): registratietype = "registratie", opvoer
{
  "registratie": { "registratietype": "registratie" },
  "wijzigingen": [{ "opvoer": { "partnernaam": { "natuurlijkpersoon_id": 7, "achternaam": "NewName" } } }]
}

// Corrigeren: registratietype = "correctie", opvoer
{
  "registratie": { "registratietype": "correctie" },
  "wijzigingen": [{ "opvoer": { "burgerschap": { "rel_id": 1, "natuurlijkpersoon_id": 7, "landcode": "NLD" } } }]
}

// Beëindigen/Verwijderen: registratietype = "registratie", afvoer
{
  "registratie": { "registratietype": "registratie" },
  "wijzigingen": [{ "afvoer": { "bereikbaarheid": { "rel_id": 1, "natuurlijkpersoon_id": 2 } } }]
}
```

---

## 9. Ontwerpbeslissingen

| Beslissing | Reden |
|---|---|
| **HashRouter** i.p.v. BrowserRouter | Go server serveert `/viz` als statische directory zonder SPA catch-all. Hash-routing vermijdt server-wijzigingen |
| **Eigen entry point** (`inhoud.html`) | Isolatie van bestaande pagina's. Eigen CSS-bundle (553 KB incl. Utrecht). Onafhankelijke ontwikkeling |
| **react-hook-form + eigen componenten** i.p.v. RJSF | Volledige controle over NL Design System styling. Hergebruik bestaande validatiefuncties. Eenvoudig uitbreidbaar naar custom formulieren (Iteratie 2) |
| **Client-side sort/filter** | Voldoende voor MVP. Server-side kan later worden toegevoegd zonder architectuurwijziging |
| **Opslaan via `/api/registratie/`** | Behoudt bitemporeel registratiepatroon. Elke wijziging is traceerbaar |
| **`@tanstack/react-table` (headless)** | Volledige controle over markup/styling. Geen conflict met Utrecht CSS |
| **Geen Go-wijzigingen** | Alle benodigde endpoints bestonden al. Geen risico op regressie |

---

## 10. Build output

Na `npm run build` in `web/vite/`:

```
../react/inhoud.html                      0.54 kB
../react/assets/inhoud-bUb5O4i3.css     553.26 kB (incl. Utrecht CSS + design tokens)
../react/assets/inhoud-CwxnIV1D.js      106.99 kB (editor JS bundle)
```

Het bestand `common-ground-logo.svg` wordt door Vite mee gekopieerd vanuit `public/`.

---

## 11. Scope Iteratie 1 (huidige implementatie)

### Iteratie 1 — MVP

- ✅ Dynamisch tabeloverzicht per entiteittype
- ✅ Client-side sortering (kolomklik, asc/desc)
- ✅ Client-side filtering (per kolom: tekst of enum-dropdown)
- ✅ Paginering (20 per pagina)
- ✅ Klik-door naar detailformulier
- ✅ Dynamisch formulier per representatietype (alle veldtypen)
- ✅ Geneste GE/relatie secties in entiteitformulier
- ✅ Nieuw record aanmaken
- ✅ Opslaan via bitemporeel registratiepatroon
- ✅ Formele tijd metadata (opvoer/afvoer) als readonly
- ✅ Validatie op basis van veldtype en verplicht-vlag
- ✅ NL Design System compliant met Common Ground thema
- ✅ Error boundary voor foutafhandeling
- ✅ Zijbalk-navigatie tussen entiteittypen

### Iteratie 2 — GE-acties (30 maart 2026)

- ✅ Enkelvoudige GE: Wijzigen (= opvoer nieuw, backend voert oude af)
- ✅ Enkelvoudige GE: Corrigeren (= correctie-registratie met opvoer)
- ✅ Enkelvoudige GE: Beëindigen (= afvoer zonder vervanging)
- ✅ Meervoudige GE: Rij verwijderen (= afvoer per record)
- ✅ Meervoudige GE: Rij corrigeren (inline formulier onder tabel)
- ✅ Dirty tracking: knoppen pas actief na veldwijziging
- ✅ Similarity check: suggestie Corrigeren bij weinig wijzigingen
- ✅ State-coördinatie: bewerkRij en nieuwGE wederzijds exclusief
- ✅ Secondaire entiteit-ID dropdown voor relaties (Optie A — `<select>` via API)
- ✅ Custom formulierdefinities (JSON-layout met groepen, rijen, conditionele blokken)
- ✅ Expliciete widget-overrides in formulierlayout, incl. `widget: "json"` voor syntax-highlight preview

### Iteratie 2b — Configuratievelden met JSON- en Markdown-widget (9 april 2026)

- `SchemaFormField` ondersteunt nu een expliciete **widget-override** naast datatype-gedreven widgets.
- `CustomFormulierRenderer` kan per layout-element een widget afdwingen, bijvoorbeeld `{ "type": "veld", "veld": "layout_json", "widget": "json" }`.
- Beschikbare widget-overrides: **`json`** (syntax-highlighted JSON) en **`markdown`** (syntax-highlighted Markdown).
- De volgende configuratievelden krijgen automatisch een widget-override via `widgetOverrides.js`:
  - `FormulierDefinitie_Layout.layout_json` → `json`
  - `WeergaveDefinitie_TabelConfig.tabel_config_json` → `json`
  - `WeergaveDefinitie_DetailTemplate.template_tekst` → `markdown`
- **Geïntegreerde code-editor**: Gebruikt `react-simple-code-editor` + `prismjs` — je typt direct "in" de gekleurde code (transparante textarea over een syntax-highlighted `<pre>`). Geen apart invoerveld en preview naast elkaar meer.
- **Volle breedte**: JSON- en Markdown-widgets spannen altijd de volle breedte van het formuliergrid, zodat ze niet worden ingedrukt door smalle velden zoals `definitie_versie`.
- **JSON-validatie**: Bij `json`-widgets wordt een parse-foutmelding getoond in de header als de inhoud geen geldige JSON is.
- In readonly-modus is de editor niet bewerkbaar maar toont wel syntax-highlighting.

#### Widget configureren in een FormulierDefinitie layout_json

Een widget-override kan ook expliciet worden meegegeven in de layout JSON:

```json
{
  "type": "formulier",
  "elementen": [
    { "type": "veld", "veld": "tabel_config_json", "widget": "json" },
    { "type": "veld", "veld": "template_tekst", "widget": "markdown" },
    { "type": "veld", "veld": "definitie_versie" }
  ]
}
```

De volgorde van widget-resolutie is:
1. **Expliciet in layout JSON** — `element.widget` in de FormulierDefinitie
2. **widgetOverrides.js** — hardcoded mapping per typenaam + veldnaam (voor configuratie-entiteiten)
3. **DatatypeRegistry** — `weergave.widget` uit het datatype (bijv. `textarea` voor LangeTekst)
4. **Standaard** — normaal invoerveld op basis van type/format

### Wat is uitgesteld naar Iteratie 3+

- ❌ Secondaire entiteit-ID zoekcomponent (Optie B — schaalbaar alternatief, zie §12 punt 6)
- ❌ Visuele layout-editor voor custom formulierdefinities
- ❌ Referentielijst-zoeker (autocomplete)
- ❌ Server-side sorteren en filteren
- ❌ Formeel/materieel tijdreizen in de editor
- ❌ Inline editing in tabeloverzicht
- ❌ Export naar CSV/Excel
- ❌ Audit-trail weergave per record
- ❌ Ongedaan maken interface

---

## 12. Bekende aandachtspunten

1. **CSS-bundlegrootte**: De Utrecht CSS + design tokens zijn ~553 KB (49 KB gzip). Dit is een eenmalige kosten. Overwegen: tree-shaking of alleen gebruikte componenten importeren.
2. **API-paginering**: De tabel haalt nu maximaal 1000 records op en pagineert client-side. Bij grote datasets kan dit traag worden; server-side paginering is dan nodig.
3. **Registratie-payload**: De `RepresentatieFormulier` bouwt een registratie-payload met één wijziging. Het bestaande endpoint verwacht een specifiek formaat — test dit met de werkelijke backend.
4. **Toetsenbordnavigatie**: Tabelrijen zijn focusbaar (`tabIndex={0}`) en klikbaar met Enter. Verdere ARIA-attributen kunnen worden toegevoegd.
5. **Responsive design**: De zijbalk heeft een vaste breedte van 240px. Op smalle schermen kan een uitklapbare/hamburger variant wenselijk zijn.
6. **Secondaire entiteit-ID bij relaties**: Relaties hebben een `secondaireEntiteitIDKolom` (bijv. `locatie_id` bij Bereikbaarheid).

   **Optie A (huidig, geïmplementeerd)**: `<select>` dropdown in `RepresentatieFormulier`, gevuld via `GET /api/viz/relatie/{typenaam}/secondaire-ids`. Het veld wordt apart van de bewerkbare velden behandeld: het is niet immutable (gebruiker moet het kunnen selecteren), maar ook niet zomaar een tekstveld. Bij het laden van het formulier haalt een `useEffect` de beschikbare IDs op en vult de dropdown. De geselecteerde waarde wordt meegenomen in de opvoer-payload (`Number(secRaw)`) en in de afvoer-sleutel. Fallback: als de API geen IDs retourneert, wordt een gewoon tekstveld getoond. Werkt goed bij <100 opties.

   **Optie B (toekomstig, schaalbaar alternatief)**: Read-only weergave van huidige waarde + een "Zoek {doelentiteit}" knop/component. Gebruiker zoekt/filtert de doelentiteit en selecteert er één. Het NL Design System heeft een **[Select Combobox](https://nldesignsystem.nl/select-combobox/)** component (status: Help Wanted) die hiervoor geschikt zou zijn — een invoerveld met filterfunctie over een optielijst. Deze is nog niet als React component beschikbaar in `@utrecht/component-library-react`, dus zou als custom component gebouwd moeten worden (met `<datalist>`, of een lightweight library zoals `downshift` of `react-select`), gestyled conform NL Design System tokens. Alternatieven: een modal/drawer met `RepresentatieTabel` (hergebruik van bestaande tabel met filtering) als zoekinterface. Aanbevolen wanneer het aantal secondaire entiteiten >100 wordt.
7. **Ongedaan maken**: Voor het ongedaan maken van registraties is een andere interface nodig dan de per-GE acties. Dit wordt apart ontworpen.
8. **Geïntegreerde code-editor voor JSON/Markdown** — De huidige side-by-side layout (textarea + preview) werkt zonder extra dependency. Als upgrade naar een "type in de gekleurde code"-ervaring zijn er drie opties:

   | Optie | Pakket | Grootte (min+gzip) | Kenmerken |
   |-------|--------|--------------------|-----------|
   | **A** | `react-simple-code-editor` + `prismjs` | ~3 KB + ~6 KB | Transparante textarea over `<pre>` met syntax-highlight. Zeer licht, geen autocomplete, geen folding. Goed genoeg voor korte JSON/Markdown fragmenten. |
   | **B** | CodeMirror 6 (`@codemirror/view` + taal-extensies) | ~40–150 KB (afhankelijk van extensies) | Volwaardige editor: autocomplete, bracket matching, zoeken, folding, meerdere cursors. Modulair: je importeert alleen wat je nodig hebt. |
   | **C** | Monaco Editor (`@monaco-editor/react`) | ~2 MB | VS Code-engine in de browser. Overkill voor formuliervelden; nuttig als je een volledige IDE-achtige ervaring wilt (bijv. in de UML/IDE-pagina). |

   **Aanbeveling**: Optie A als snelle verbetering; optie B als de JSON-configs complexer worden (>50 regels). De ~150 KB van CodeMirror is voor desktopgebruik verwaarloosbaar — het is vergelijkbaar met de huidige `jsx-runtime` bundle (140 KB). Bovendien wordt het alleen geladen in de entry points die het gebruiken, niet in de publicatie-pagina.

9. **Code splitting per doelgroep** — Vite multi-entry is al ingericht met 7 aparte HTML-bestanden. Elke pagina laadt alleen haar eigen JS/CSS bundle:

   | Entrypoint | Doelgroep | Bundlegrootte | Toelichting |
   |------------|-----------|---------------|-------------|
   | `publicatie.html` | Eindgebruiker, ook mobiel | ~14 KB JS | Licht, read-only, geen edit-componenten |
   | `inhoud.html` | Redacteur, desktop | ~52 KB JS | Formulieren, GE-acties, widget-editors |
   | `ide.html` | Beheerder, desktop | ~212 KB JS | Metamodel-editor, kan zwaardere componenten bevatten |

   Een zware dependency zoals CodeMirror kan via `React.lazy()` + dynamic `import()` alleen worden geladen wanneer een JSON/Markdown-veld daadwerkelijk in beeld komt. Hierdoor betaalt de publicatie-pagina er niets voor, en zelfs in de inhoud-editor wordt het pas geladen bij het openen van een configuratie-entiteit. Dit is de standaard Vite-aanpak en vereist geen extra configuratie.
