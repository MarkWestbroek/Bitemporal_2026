# Inhoud Editor — Technische Documentatie

> **Datum**: 29 maart 2026  
> **Versie**: Iteratie 1 — MVP  
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
| `src/components/editor/RepresentatieFormulier.jsx` | Formulier voor één representatie. Dynamisch opgebouwd uit `typeMeta.velden`. Opslaan via `POST /api/registratie/` als bitemporele registratie. Readonly voor PK/autoincrement velden. Formele tijd metadata (opvoer/afvoer) als readonly sectie |
| `src/components/editor/EntiteitFormulier.jsx` | Volledig entiteitformulier. Haalt data op via `/api/full/{padnaam}/{id}`. Toont hoofd-entiteit velden + per onderliggend GE/relatie een sectie: enkelvoudig → formulier, meervoudig → tabel |
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

### Wat is gebouwd

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

### Wat is uitgesteld naar Iteratie 2+

- ❌ Custom formulierdefinities (JSON-based layout)
- ❌ Conditionele zichtbaarheid van velden
- ❌ Referentielijst-zoeker (autocomplete)
- ❌ Server-side sorteren en filteren
- ❌ Delete/afvoer van records vanuit de editor
- ❌ Formeel/materieel tijdreizen in de editor
- ❌ Inline editing in tabeloverzicht
- ❌ Export naar CSV/Excel
- ❌ Audit-trail weergave per record

---

## 12. Bekende aandachtspunten

1. **CSS-bundlegrootte**: De Utrecht CSS + design tokens zijn ~553 KB (49 KB gzip). Dit is een eenmalige kosten. Overwegen: tree-shaking of alleen gebruikte componenten importeren.
2. **API-paginering**: De tabel haalt nu maximaal 1000 records op en pagineert client-side. Bij grote datasets kan dit traag worden; server-side paginering is dan nodig.
3. **Registratie-payload**: De `RepresentatieFormulier` bouwt een registratie-payload met één wijziging. Het bestaande endpoint verwacht een specifiek formaat — test dit met de werkelijke backend.
4. **Toetsenbordnavigatie**: Tabelrijen zijn focusbaar (`tabIndex={0}`) en klikbaar met Enter. Verdere ARIA-attributen kunnen worden toegevoegd.
5. **Responsive design**: De zijbalk heeft een vaste breedte van 240px. Op smalle schermen kan een uitklapbare/hamburger variant wenselijk zijn.
