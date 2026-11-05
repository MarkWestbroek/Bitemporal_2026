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

- Elke vorm wordt een ShapeType op de renderer `data-vorm`
  (`src/diagramcore/tekenaar/dataVorm.js`, pure `.js`: dezelfde tekenaar als elke andere
  vorm, dus ook in documenten); registratie + opslag in
  `src/studio/activities/vormenRegistratie.js`. Een `clipPath` moet een CSS-`polygon(…)`
  zijn (procenten, px, `calc(100% - Npx)`); een andere clip-path-functie tekent als doos.
- Geschreven door het dev-endpoint `/__studio05/vormen` (vite-plugin
  `studio05Map("vormen")`), bij het laden weer ingelezen (git wint van
  localStorage), en bij `vite build` in de bundle meegebakken
  (`import.meta.glob`) — dus **committen** om ze te delen.
- Eenmaal geregistreerd is een data-shape in élk profiel bruikbaar (galerij,
  PE shape-kiezers, shape-sets) — net als de ingebouwde shapes.
