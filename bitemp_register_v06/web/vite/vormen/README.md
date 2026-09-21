# vormen/ — git-gepersisteerde data-shapes (Studio-instellingen)

Elk `.json`-bestand is één **data-shape**: een vorm beschreven als data i.p.v.
een code-component, gemaakt/bewerkt in **Studio-instellingen → Eigen vormen**.

```json
{
  "id": "zeshoek",
  "label": "Zeshoek",
  "grondvorm": "rechthoek|afgerond|stadium|chip|zeshoek|afgeknipt",
  "hoekRadius": 14,
  "clipPath": "polygon(…)",
  "randStijl": "solid|dashed",
  "randDikte": 2,
  "vulling": "#e0e7ff"
}
```

- De renderer zit in `src/diagramcore/shapes/dataShape.jsx`; registratie +
  opslag in `src/studio/activities/vormenRegistratie.js`.
- Geschreven door het dev-endpoint `/__studio05/vormen` (vite-plugin
  `studio05Map("vormen")`), bij het laden weer ingelezen (git wint van
  localStorage), en bij `vite build` in de bundle meegebakken
  (`import.meta.glob`) — dus **committen** om ze te delen.
- Eenmaal geregistreerd is een data-shape in élk profiel bruikbaar (galerij,
  PE shape-kiezers, shape-sets) — net als de ingebouwde shapes.
