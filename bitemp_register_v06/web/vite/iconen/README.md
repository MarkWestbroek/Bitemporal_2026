# iconen/ — git-gepersisteerde data-iconen (Studio-instellingen)

Elk `.json`-bestand is één **data-icoon**: een geïmporteerde/geplakte SVG,
gemaakt in **Studio-instellingen → Eigen iconen**.

```json
{
  "id": "mijn-icoon",
  "label": "Mijn icoon",
  "monochroom": true,
  "svg": "<svg viewBox=\"0 0 24 24\">…</svg>"
}
```

- `monochroom: true` → eigen fills/strokes weg, alles volgt de tekstkleur
  (currentColor) — past bij de bestaande stroke-iconenset.
- De renderer zit in `src/diagramcore/shapes/dataIcoon.jsx`; registratie +
  opslag in `src/studio/activities/iconenRegistratie.js`.
- Geschreven door het dev-endpoint `/__studio05/iconen` (vite-plugin
  `studio05Map("iconen")`), bij het laden weer ingelezen, en bij `vite build`
  in de bundle meegebakken — dus **committen** om ze te delen.
- Eenmaal geregistreerd is een data-icoon in élk profiel bruikbaar (galerij,
  PE icoon-kiezers, shape-set-cellen) — net als de ingebouwde iconen.
