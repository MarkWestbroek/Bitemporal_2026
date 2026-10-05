# Chat Samenvatting

## Metadata

- Datum: 2026-10-05
- Titel: Transformatievorm (lezer → regelset → toepasser) en de Mermaid → use case-import
- Bestandstamnaam: 2026-10-05-transformatievorm-en-mermaid-usecase-import
- Gerelateerde export: `../exports/2026-10-05-transformatievorm-en-mermaid-usecase-import.md` (Claude-sessie)
- Gerelateerde branch/commit: `feat/mermaid-usecase-import`, gemerged naar `main`

## Doel

Mark vroeg naar de stand van de transformatie-"motor" (importeren, transformeren, exporteren),
zocht een eerdere brainstorm over de vorm ervan, en wilde een universele, leesbare vorm om
(delen van) een model te transformeren. Acuut: twee Mermaid-flowcharts (een actor-model en een
use case-model) inlezen als use case-model.

## Beslissingen

- **De vorm is lezer → regelset → toepasser → schrijver** (door Mark bevestigd). De regelset is
  data: geordende `als … maak …`-regels, de eerste die past wint; de toepasser is generiek en
  geeft een trace en meldingen terug. Past er geen regel, dan volgt een waarschuwing — geen gok.
- **Het regelmodel is eigen en klein, expressies worden geleend.** Begrippen uit ATL/QVT (matched
  rules, trace); geen XSLT (boom, geen graaf), geen vrij JavaScript in een regelset. Als
  toetsen te krap worden: CEL of JSONata binnen een regel.
- **Complexe afbeeldingen blijven code** achter hetzelfde registry-contract (bv. OAS → canoniek).
- **Notitie aan een element = toelichting van dat element** in het model; de notitie zelf
  vervalt. Daarvoor kreeg het use case-profiel de eigenschap *Toelichting*.
- **Hergebruik op type + naam**: dezelfde actor in twee diagrammen is één element; bestaande
  elementen worden nooit overschreven.
- **Een benoemde stippelpijl** tussen twee gelijksoortige elementen (hier: `gespreksvorm`) wordt
  als generalisatie gelezen en als interpretatie gemeld.

## Waarom deze keuze

Tot nu toe was elke transformatie specifieke code achter één `run()`: niet leesbaar en niet
configureerbaar. Een Studio-model is al een graaf (element met type en data; een connector is
een element met bron en doel), dus een regelmodel op een graaf past zonder vertaalslag. De
bestaande model-naar-model-talen passen begripsmatig, maar hun ecosysteem (Eclipse/Java) is in
een browser-werkbank niet inzetbaar. De integrale review van 30-09 raadde dezelfde lijn aan en
vroeg om toetsing aan twee echte afbeeldingen; dit is de eerste.

De eerdere brainstorm is niet teruggevonden. Wat vastlag: de review van 30-09 (§5) en de
expressietalen-vergelijking in *Invoersoort en vorm* (27-09). Stand en vorm staan nu in
`docs/TRANSFORMATIES.md`.

## Gewijzigde onderdelen

- Bestanden:
  - `web/vite/src/transformatie/` — `mermaidFlowchart.js` (lezer), `regels.js` (toepasser),
    `kolommenLayout.js` (startopstelling), elk met tests;
  - `web/vite/src/diagramprofielen/usecase/` — `mermaidRegels.js` (de regelset),
    `mermaidImport.js` (aansluiting), test en fixture; `index.js` (Toelichting, genest
    systeemkader); `shapes.jsx` (actornaam);
  - `web/vite/src/studio/activities/` — `usecaseTransformaties.js` (wiring),
    `TransformatiePaneel.jsx` (bron plakken), `index.jsx`;
  - `docs/TRANSFORMATIES.md` (nieuw), `docs/STUDIO.md`, `web/vite/CHANGELOG.md`.
- API routes: geen.
- DB/SQL: geen.
- Frontend: nieuwe import *Transformeren → Importeren → "Mermaid flowchart → use case-model"*.

## Open punten

- Notities ook als notitie op het diagram tonen (regelvariant + toelichting-lijn in het profiel).
- Het plakveld in het transformatiepaneel is gebouwd maar niet met de hand doorgeklikt.
- Bereik is nog alleen "een map"; selectie, diagram en profieltype ontbreken.
- De trace wordt teruggegeven maar niet bewaard (geen herkomst op het element, geen kruisverband).
- Regelsets staan in de broncode; bekijken en bewerken in de Studio is nog niet gebouwd.

## Volgende stap

Een tweede regelset op dezelfde toepasser, bij voorkeur model → model, zodat de vorm aan twee
echte afbeeldingen getoetst is (`docs/TRANSFORMATIES.md` §7).
