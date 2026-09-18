# Chat Samenvatting

## Metadata

- Datum: 2026-09-17 t/m 2026-09-18
- Titel: Diagrameditor §31 — containers, afbakening (pools), reconnect, magic link en zwevende aanhechting; Universum-doorklik
- Bestandstamnaam: 2026-09-17-editor-31-containers-afbakening-magic-link-universum
- Gerelateerde export: `../exports/2026-09-17-editor-31-containers-afbakening-magic-link-universum.md`
- Gerelateerde branch/commit: `feat/editor-31-containers-pools-reconnect` — `d663000`, `da8687b`, `133ef53`, `e6b0171`, `f54f98c`
- AI: **Claude** (Claude Code)

## Doel

Bevindingen uit het tekenen van een BPMN-diagram in de Studio (verdelen doet
raar, deselecteren, lane houdt inhoud niet vast, geen pool, lijnen niet te
verhangen, "magic link") vastleggen in de backlog en daarna bouwen. Tussendoor:
het 3D Universum klikte niet meer door naar de objecten, en lijnen bleken alleen
aan de vier handles te hangen.

## Beslissingen

- **Universum:** de tweede klik van een dubbelklik miste de (kleine, wegvliegende)
  node en kwam binnen als achtergrondklik. Opvang binnen 400 ms / 12 px;
  melding bij een entiteit zonder objecten; GraphQL-veldnamen met koppelteken
  (`nl-titel` → `nl_titel`).
- **Verdelen = gelijke tussenruimte**, niet gelijke linkerranden; aangehechte
  rand-elementen doen niet mee. **Escape** maakt de selectie leeg.
- **Containers (§31.3): presentatie relatief, opslag absoluut.** Een lid dat ín
  zijn container ligt rendert als React Flow-kind (reist mee, begrensd door de
  rand); **Alt+slepen** tilt eruit. Geen migratie; materialisatie, layout en
  export rekenen ongewijzigd. Nieuwe elementen die in een container belanden
  worden er meteen lid van.
- **Afbakening (§31.4) is een motor-primitief, geen regeltaal.** Er zijn twee
  soorten containers: *partitie* (lane, package — deelt alleen in) en
  *afbakening* (pool, uitgeklapt subproces, region, stage — begrenst
  verbindingen). Twee velden met vaste betekenis in de core:
  `ElementType.afbakeningVoor` en `ConnectorType.overbrugt`. BPMN-spec
  nagelopen: sequence flows zijn eigendom van het proces (niet over de
  poolgrens, wél door lanes); message flows verbinden verschillende pools,
  eventueel aan de poolrand (black box). Het menu noemt de reden.
- **Reconnect (§31.5):** type blijft gelijk, knikpunten vervallen, alleen de
  directe gedaante, weigering wordt uitgelegd.
- **Magic link (§31.7/31.8):** zonder gekozen type → één passend type direct,
  meerdere → keuzemenu op de losplek; op het lege vlak (ook het vlak van een
  pool) → nieuw element + lidmaatschap + verbinding. Canvasmenu's met het
  toetsenbord.
- **Zwevende aanhechting als standaard (§31.10):** tekenen/verhangen slaan bij
  zwevende types geen handle meer op (dat pinde elke nieuwe lijn); **Shift** of
  het contextmenu zet bewust vast. BPMN-rechthoeken zweven; events en gateways
  houden hun vier punten.

## Waarom deze keuze

Absolute opslag houdt alle bestaande rekenwerk en diagrammen intact; alleen de
canvas rekent om. De afbakening als benoemd primitief (naast `containerVoor` en
`randElement`) komt in veel notaties terug, is in de profiel-editor als vinkje
te tekenen en vraagt geen regel-interpreter. Alle verbindingstoetsen lopen via
één functie (`vindConnectorTypes(…, elements)`), zodat slepen, magic link en
reconnect dezelfde uitkomst en dezelfde uitleg geven.

## Gewijzigde onderdelen

- Bestanden: `diagramcore/canvas/{DiagramCanvas.jsx, materialiseerConnectoren.js,
  nesting.js, afbakening.js}` (+ tests), `diagramcore/layout/uitlijnen.js`,
  `diagramcore/types/schema.js`, `diagramcore/styles/diagramcore.css`,
  `diagramprofielen/bpmn/{index.js, shapes.jsx}`,
  `studio/activities/maakDiagramActiviteit.jsx`,
  `universum/{UniversumPage.jsx, graphqlFetcher.js, universum.css}`
- Docs: `docs/STUDIO.md`, `docs/3D_UNIVERSUM.md`, `docs/BACKLOG.md` §31,
  `docs/plans/2026-09-18 Diagrameditor — containers, afbakening (pools),
  reconnect en magic link (ontwerp).md`
- API routes / DB: geen
- Frontend: unit-tests 550/550; alle onderdelen in de browser nagelopen (BPMN)

## Open punten

- §31.6 knikpunten vindbaar maken (nu alleen Ctrl-klik).
- §31.9 lid kan over de naamband van de container; afbakening toetst alleen
  nieuwe verbindingen; `afbakeningVoor`/`overbrugt` nog niet in de
  profiel-editor (§30.4).
- §31.10 zweven: oordeel na gebruik.

## Volgende stap

Zweven en containers in de praktijk gebruiken; daarna §31.6 (menu-item
*Knikpunt toevoegen*) en de naamband-begrenzing uit §31.9.
