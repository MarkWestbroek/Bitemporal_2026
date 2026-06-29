# Omnium Studio — merk & landing page

> Toegevoegd: 2026-06-29. Branding voor de geïntegreerde werkbank (`/studio`).

**Omnium** (Latijn, "van alles") staat voor de *rondom blik*: gegevensstructuur (UML/MIM),
procesflow (BPMN), regels (DMN), connectiviteit (berichten & API's), gebruikers/rollen/
autorisatie en basisgegevens (referentielijsten) — én het genereren van registers.
Breed over domeinen, diep over business-, applicatie- en data-architectuur.

## Bestanden

| Bestand | Gebruik |
|---|---|
| `index.html` | Zelfstandige product-landing page (start voor de website). Inline CSS, Inter-webfont, geen build nodig. |
| `assets/mark.svg` | Het logo-merk (orbit + facet-knooppunten + hub). Vierkant, met halo/spokes. |
| `assets/logo.svg` | Horizontale lockup (donkere achtergrond): merk + woordmerk "Omnium Studio". |
| `assets/logo-light.svg` | Lockup voor **lichte/witte** achtergronden (donker woordmerk, vollere mark-kleuren). |
| `assets/logo-mono.svg` | Eénkleurige lockup (`currentColor`) voor elke achtergrond. |
| `assets/favicon.svg` | Favicon (merk op afgeronde tegel), ook gekopieerd naar `vite/public/omnium-favicon.svg`. |
| `assets/og-image.png` | Social preview 1200×630 (Open Graph / Twitter card). Bron: `assets/og-image.html`. |
| `assets/og-square.png` | Vierkante preview 1200×1200 (Instagram / vierkante kaarten). Bron: `assets/og-square.html`. |
| `assets/icon.svg` · `assets/icon-maskable.svg` | Full-bleed app-icon bronnen (maskable = ~22% veilige marge). |
| `assets/icons/*.png` | App-icon set: `favicon-16/32/48`, `apple-touch-icon` (180), `icon-192`, `icon-512`, `icon-512-maskable`. |
| `site.webmanifest` | PWA-manifest dat naar de 192/512/maskable iconen wijst. |

**Welke variant waar:** donkere UI → `logo.svg`; witte/lichte pagina's, documenten, drukwerk → `logo-light.svg`; één kleur (stempel, gravure, watermerk) → `logo-mono.svg`.

**OG-images opnieuw genereren:** open `assets/og-image.html` (1200×630) resp. `assets/og-square.html` (1200×1200) en maak een schermafdruk van exact die afmeting naar `assets/og-image.png` / `assets/og-square.png`. De landing page verwijst naar `og-image.png` via `og:image` / `twitter:image`.

**App-iconen opnieuw genereren:** render de SVG-bronnen naar PNG op de doelmaten — `favicon.svg` → `favicon-16/32/48`, `icon.svg` → `apple-touch-icon` (180) / `icon-192` / `icon-512`, `icon-maskable.svg` → `icon-512-maskable`. De `<link rel="icon|apple-touch-icon|manifest">`-tags staan al in `index.html`.

## Logo-concept

De **"O" als orbit** met zes **facet-knooppunten** (de domeinen) rond een centrale
**hub** (het geïntegreerde platform/IDE). Leest tegelijk als een *O*, een *360°-blik*
en een *hub-and-spoke netwerk*. Elk knooppunt heeft zijn eigen tint uit het spectrum,
zodat losse domeinen samen één geheel vormen.

## Kleuren

| Rol | Hex |
|---|---|
| Blauw (gegevens) | `#3b82f6` |
| Indigo (proces) | `#6366f1` |
| Violet (regels) | `#8b5cf6` |
| Cyaan (connectiviteit) | `#22d3ee` |
| Sky (gebruikers/rollen) | `#0ea5e9` |
| Licht-blauw (basisgegevens) | `#38bdf8` |
| Merk-gradient | `linear-gradient(110deg, #60a5fa, #6366f1, #22d3ee)` |

De Studio-app gebruikt dezelfde blauwe accentkleur (`--s-accent: #3b82f6`).

## Integratie in de Studio

- Het merk staat **links in de menubalk** via `OmniumMark` (`src/studio/icons.jsx`),
  doorgegeven als `brand`-prop aan `MenuBar`. Opmaak: `.studio-menubar__product*` in
  `studio.css`.
- Paginatitel + favicon in `vite/studio.html`; "Over"-tekst in `buildMenus.js`.

## Een website opzetten

`index.html` is volledig zelfstandig — hosten kan op elke statische host (GitHub Pages,
Netlify, Cloudflare Pages). De knop "Open Omnium Studio" wijst naar `../vite/studio.html`;
pas dat aan naar de gepubliceerde Studio-URL bij deployment.
