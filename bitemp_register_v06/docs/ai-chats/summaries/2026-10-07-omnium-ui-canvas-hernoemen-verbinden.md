# Chat Samenvatting

## Metadata

- Datum: 2026-10-07
- Titel: Omnium Studio UI — inline hernoemen, verbind-modus, kaders en canvas-ergernissen (Claude-sessie "OMNIUM-UI")
- Bestandstamnaam: 2026-10-07-omnium-ui-canvas-hernoemen-verbinden
- Gerelateerde export: exports/2026-10-07-omnium-ui-canvas-hernoemen-verbinden.md
- Gerelateerde branch/commit: feat/canvas-hernoem-verbind → main, release studio/v0.13.0

## Doel

Mark meldde twee dingen: F2/enkelklik hernoemen werkte niet op het canvas, en lijnen trekken vanaf
een use case (ellips) greep slecht. Daarna volgde een reeks meldingen uit gebruik (datatype-hernoeming
ververste niet in de klasse, naamloze events toonden hun id, diagram niet te verwijderen, taakbalken
verspreid over het canvas, kaders die raar resizen, …) die in dezelfde sessie zijn opgelost.

## Beslissingen

- Inline bewerken is één motor-primitief (`NaamEditor.jsx` + `InlineNaamContext`): F2, dubbelklik,
  klik op de naam, op een veldregel (attribuut) en op een relatienaam; shapes markeren hun tekst
  met `data-dc-naam`/`data-dc-veld`. Ook in projectboom en lijsten, zonder `window.prompt`.
- Verbind-modus: een onzichtbare vlak-handle per node; Shift = grijpen op het hele vlak, tijdens
  slepen is elke plek op een doelvorm losplek. React Flow in `loose`-modus met vangstraal 24.
  Handles dragen `nokey` (anders slikt Shift-kaderselectie de pointerdown in).
- Hernoemen trekt naam-verwijzingen door (`model/hernoemen.js`, één undo-stap) omdat velden bij
  naam verwijzen (`referenceTypes`); een echte referentie is backlog 31.12.
- Informeel kader (`boundary`) ook in use case; `sleeptInhoudMee` (M3) = inhoud sleept mee zonder
  modelrelatie. Resizer nooit onder het shape-minimum (`ShapeResizer`); resize-positie bewaard en
  live tijdens trekken (`resizing` wint in de rebuild).
- Taakbalken: automatische rij bovenin (auto-vlag), compacte knoppen 30×30, breedte alleen bewaard
  bij de hoekgreep. Lijnselectie = kleur + gloed i.p.v. dikker (pijlpunt groeide mee).

## Waarom deze keuze

Alles generiek in de motor (M3-vlaggen, data-attributen op shapes) i.p.v. per profiel; informeel
versus formeel bewust gescheiden (kader vs. systeemkader/`containerVoor`). Browserverificatie met
Playwright-scripts tegen een dev-server met gemockte auth, zodat elke melding reproduceerbaar was.

## Gewijzigde onderdelen

- Bestanden: `diagramcore/canvas/{DiagramCanvas,ElementNode,ConnectorEdge,NaamEditor}.jsx`,
  `inlineNaam.js`, `model/{hernoemen,weergaveNaam}.js`, `createDiagramStore.js`,
  `shapes/basisShapes.jsx`, `taskbar/Taskbar.jsx`, `styles/diagramcore.css`,
  `diagramprofielen/{usecase,puur-uml,activity}/`, `studio/activities/{maakDiagramActiviteit,
  modellerenActivity}.jsx`, docs STUDIO.md en BACKLOG.md (§31.11, §31.12).
- API routes: geen.
- DB/SQL: geen.
- Frontend: studio 0.13.0.

## Open punten

- Rolnamen/kardinaliteiten op lijnen inline bewerken.
- Attribuuttype als referentie i.p.v. naam-string (BACKLOG 31.12).
- Actoren in een systeemkader: bewust niet (UML); één regel in de bevat-connector als Mark het wil.

## Volgende stap

Image bouwen en uitrollen (frontend 0.13.0), zie RELEASE.md.
