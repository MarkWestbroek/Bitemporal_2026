# Method Draw (gevendord)

In-browser SVG-editor, gebruikt in **Omnium Studio → Studio-instellingen → Eigen
vormen** als "rijke" silhouet-tekenaar (naast de eigen polygon-tekenaar).

- **Bron:** https://github.com/methodofaction/Method-Draw
- **Commit:** `c01c2f72b4497027eecb2a27e066c9bc5bf754c0`
- **Licentie:** MIT (zie `LICENSE`), © Mark MacKay
- **Wat is gekopieerd:** alleen de inhoud van `src/` (front-end assets). De
  `build:`-comments in `index.html` zijn inert, dus de map is direct te serveren
  zonder de gulp-build.

## Hoe Studio het gebruikt

De editor draait in een `<iframe>` (`/viz/react/method-draw/index.html`, same-origin).
Studio leest de tekening uit via de globale API `window.svgCanvas.getSvgString()`
en zet een bestaand silhouet terug met `setSvgString(...)`. De getekende paden
worden genormaliseerd naar een `{ inner, box }`-silhouet en als node-achtergrond
gerenderd (inline `<svg viewBox … preserveAspectRatio="none">`, zie
`src/diagramcore/shapes/dataShape.jsx`).

## Enige toevoeging: `omnium-bridge.js`

Deze build laadt `method-draw.js` niet; `svgCanvas`/`editor` zijn lexicale
`const`-globals en hangen dus niet aan `window`. `omnium-bridge.js` (ons bestand,
als laatste script in `index.html` ingehaakt) zet die referenties op `window`,
zodat de Studio-modal ze via `iframe.contentWindow` kan aanroepen. Dat is de
**enige** afwijking van de upstream-kopie.

## Bijwerken

Vervang de inhoud van deze map door een nieuwe `src/` van bovenstaande repo, werk
de commit-hash hierboven bij en haak `omnium-bridge.js` opnieuw in als laatste
script in `index.html`. Verder niet handmatig patchen; houd het een schone kopie.
