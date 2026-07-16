# Chat Samenvatting

## Metadata

- Datum: 2026-06-29
- Titel: Omnium Studio — branding, logo, landing page & app-iconen
- Bestandstamnaam: `2026-06-29-omnium-studio-branding-logo-landingpage`
- Gerelateerde export: `../exports/2026-06-29-omnium-studio-branding-logo-landingpage.md`
- Gerelateerde branch/commit: nog niet gecommit (op verzoek "laat eerst maar zo staan")
- Assistent: Claude (Claude Code, Opus 4.8)

## Doel

Een productmerk ontwerpen voor de geïntegreerde Studio-werkbank — naam **"Omnium Studio"** — met logo, een zelfstandige landing page als basis voor een website, social/OG-images en een app-icon set, en het merk terug laten komen in de Studio zelf.

## Beslissingen

- Naam **Omnium Studio**; logo-concept = de "O" als orbit-ring met 6 facet-knooppunten (de domeinen) rond een centrale hub (de IDE). Spectrum blauw→indigo→violet→cyaan, afgestemd op het Studio-accent `#3b82f6`.
- Alle merk-assets in een aparte map `web/omnium-studio/` (los van de Vite-app), zodat het als statische site naar bv. Plesk te deployen is.
- In de Studio alleen **productgerichte teksten/branding** wijzigen; module-/bestandsnamen ongewijzigd laten.
- OG-images als **PNG** vastleggen (previews laden geen externe webfonts); SVG/HTML-bronnen bewaren voor regeneratie.
- App-iconen: rounded-tile favicons (16/32/48) + full-bleed apple-touch/PWA (180/192/512) + aparte maskable (~22% marge).

## Waarom deze keuze

- Aparte `omnium-studio/`-map houdt branding/website schoon gescheiden van de applicatiecode en is direct als statische site te syncen.
- "Omnium" is een zwak/veelgebruikt woord; onderscheid zit in combinatie + logo. Naamconflict met een Bulgaarse 1-mans logo-ontwerpstudio is laag risico (andere klasse/branche/territorium, waarschijnlijk niet geregistreerd) — wél eerst EUIPO/WIPO/BOIP checken en evt. zelf registreren (klasse 9 + 42).

## Gewijzigde onderdelen

- Bestanden (nieuw): `web/omnium-studio/index.html`, `README.md`, `site.webmanifest`; `assets/{mark,logo,logo-light,logo-mono,favicon,icon,icon-maskable}.svg`; `assets/{og-image,og-square}.{html,png}`; `assets/icons/*.png`.
- Studio-integratie: `src/studio/icons.jsx` (`OmniumMark`), `MenuBar.jsx` (`brand`-prop), `StudioShell.jsx`, `studio.css` (`.studio-menubar__product*`), `studio.html` (titel+favicon), `buildMenus.js` (over-tekst), `vite/public/omnium-favicon.svg`.
- API routes: n.v.t. · DB/SQL: n.v.t.
- Frontend: menubalk toont nu het Omnium Studio-merk linksboven.

## Open punten

- Trademark-check (EUIPO/WIPO/BOIP) en domein/handles nog uitvoeren; naamkeuze definitief maken.
- Woordmerk-font staat op Inter via systeem-fallback; evt. naar outlines/paths omzetten voor een vaste look.
- Eventueel naam-variant overwegen (Omnium / Omnium IDE) afhankelijk van trademark-uitkomst.

## Volgende stap

Een aparte, deploybare git-structuur/branch opzetten om `web/omnium-studio/` naar Plesk te syncen (op verzoek nog niet gedaan).
