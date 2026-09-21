# Chat Samenvatting

## Metadata

- Datum: 2026-09-15
- Titel: Verdwenen compositielijnen — composities als connector, handle-normalisatie
- Bestandstamnaam: 2026-09-15-composities-als-connector-verdwenen-lijnen
- Gerelateerde export: `../exports/2026-09-15-composities-als-connector-verdwenen-lijnen.md` (nog te exporteren)
- Gerelateerde branch/commit: `feat/archimate-exchange`, nog niet gecommit
- AI: **Claude** (Claude Code)

## Doel

In het canonieke diagram waren compositielijnen (ENT ◆ GE) verdwenen, en ze
kwamen ook niet mee als je een entiteit met haar gegevenselementen op een leeg
diagram zette. Oorzaak vinden en repareren, op demodag.

## Beslissingen

- **Twee defecten, niet één.** De eerste hypothese (kale handles op de
  *connector*) bleek met echte data onjuist: er wáren geen
  compositie-connectoren. De handles zaten op de *presentatie-edges*, en dat
  verklaarde maar één van de twee symptomen.
- **Composities worden `compositie`-connectoren**, zoals relaties sinds fase
  3B. Alternatief was het leeg-diagram-probleem render-time op te lossen vanuit
  `meta.compositieEdges` in de canvas; afgewezen, omdat de diagramcore dan
  profielkennis krijgt en de README dat uitdrukkelijk verbiedt.
- **Normaliseren bij het lezen, niet alleen bij import.** De sandbox
  persisteert; een import-fix alleen had het al geladen model niet hersteld.
- **Handles komen genormaliseerd terug in de V3-export** (`source-left`
  i.p.v. `left`). Geen verlies: de oude editor gebruikt die vorm zelf ook.

## Waarom deze keuze

De MIM-adapter, de CEL-context en de elementenbrowser (`hierarchie:
["bevat", "compositie"]`) kenden `compositie`-connectoren al — het ontwerp
verwachtte ze, alleen de V3-import maakte ze niet. De terug-adapter had zelfs
al een `case "compositie"`, maar die overschreef de bij de heenreis gezaaide
edge-data met `{}`; dat is meegerepareerd.

## Gewijzigde onderdelen

- `diagramcore/canvas/materialiseerConnectoren.js` — `normaliseerHandle()`.
- `diagramcore/canvas/DiagramCanvas.jsx` — normalisatie van opgeslagen edges.
- `diagramprofielen/canoniek-uml/adapter.js` — vouwen, filteren, terugreis.
- `diagramprofielen/canoniek-uml/index.js` — `hooks.edgeLabels` voor `compositie`.
- Tests: `materialiseerConnectoren.test.js`, `adapter.test.js`,
  `terugreis.test.js` (één verouderde telling aangepast: compositie-connectoren
  zijn geen canvas-nodes). Frontend 515/515 groen, build groen.
- Docs: `docs/STUDIO.md`, `docs/BACKLOG.md` §29.9–29.11.

## Open punten

- Label-offsets van de oude edge gaan verloren (29.10).
- Eén handle-paar per connector voor alle diagrammen (29.11).

## Volgende stap

Het demo-model opnieuw importeren (**Bestand → Importeer V3 JSON…**); een
gewone paginaherlaad houdt de oude, gepersisteerde toestand vast.
