# Chat Samenvatting

## Metadata

- Datum: 2026-08-08
- Titel: Taakbalk-iconen ronde 2 — ERD, SysML en CMMN (Claude-sessie)
- Bestandstamnaam: 2026-08-08-taakbalk-iconen-ronde2-erd-sysml-cmmn
- Gerelateerde export: (nog geen transcript geëxporteerd)
- Gerelateerde branch/commit: `feat/notaties-erd-sysml-cmmn`
- Specimenvel: <https://claude.ai/code/artifact/9259e6f4-9093-4983-96cb-f3da15f0caca>

## Doel

ERD, SysML en CMMN hadden geen elementtype-iconen en vielen terug op hun
ShapeType: in de ERD-balk drie keer hetzelfde doosje, en álle 24 connectoren
van de drie profielen deelden één lijn-glyph. Ontwerp de ontbrekende set in de
familie van ronde 1 (4/5 juli) en neem een besluit over de gedeelde
gedragsset, die zichzelf nog "placeholder" noemde.

Opdracht: `docs/plans/2026-08-08 Designbrief taakbalk-iconen ronde 2 (ERD,
SysML, CMMN).md`. Volledig antwoord: `docs/STUDIO-05-iconen-ronde2-antwoord.md`.

## Beslissingen

- **Mini-vorm of symbool — een regel in drie stappen.** Silhouet als het
  silhouet onderscheidt binnen het profiel; anders een symbool van wat er ín de
  doos staat; en een silhouet dat samenvalt met de neutrale fallback telt niet
  als onderscheidend. Uitkomst: CMMN → mini-vormen, SysML → symbolen,
  ERD → gemengd.
- **Hergebruik gaat over begrip, niet over vorm.** SysML-blok krijgt een eigen
  glyph (staat in een bdd naast vier andere class-boxen), ERD-entiteit ook
  (een tabel, geen klasse), CMMN-task ook (het soort-badge is het silhouet).
  Waardetype/interfaceblok/constraintblok/enumeratie/pakket lenen wél.
  Eindstand: 22 nieuwe iconen, 13 geleende ids.
- **Grondpatroon voor connector-iconen**: horizontale lijn op de middenas,
  markersymbool altijd rechts (ook als de notatie hem aan de bronkant hangt),
  geen diagonalen, iets-op-de-lijn in het midden, en containment toont de
  container als silhouet met het gevulde lid erin.
- **Sentry en kraaienpoot: één glyph elk.** De aanname dat entry/exit naast
  elkaar in de browser staan klopt niet — `TypeIcoon` kiest per *elementType*,
  en entry/exit is een `soort`-property van één type.
- **Twee nieuwe familiemiddelen**: *context gestreept, onderwerp gevuld*, en
  het **randelement-motief** (gestreepte gastheerrand met het element erop) voor
  alles wat via `randElement` op een omtrek klemt.
- **Gedragsset bevestigd, niet herontworpen**, met twee correcties:
  `gedrag-toestand` was pixel-identiek aan de `rounded`-fallback, en BPMN's
  drie gateways deelden één ruit.

## Waarom deze keuze

De brief vroeg om een expliciete regel in plaats van per geval improviseren, en
die regel moest ook de bestaande set kunnen beoordelen. Dat is de toets die
stap 3 opleverde ("een icoon dat gelijk is aan geen-icoon is geen icoon") — en
die legde meteen twee echte bugs bloot in de gedragsset. Voor de gedragsset zelf
is *bevestigen* gekozen omdat hij de regel al volgt: bij gedragsnotaties ís het
silhouet de betekenis. Herontwerpen zou verandering om de verandering zijn.

De iconen zijn tijdens het tekenen naar PNG gerenderd en teruggekeken. Dat
leverde vier correcties op die op papier niet zichtbaar waren: het
ERD-sleutelaccent liep dicht tot een blok, de stage-afschuining verdween onder
de eigen 1.2-lijn, de sentry kreeg een streepjeslijn dwars door zijn open ruit,
en de toestand-kopbalk was zo zwaar dat hij op 11px vollliep.

## Gewijzigde onderdelen

- Bestanden (nieuw): `diagramprofielen/{erd,sysml,cmmn}/iconen.jsx`,
  `docs/STUDIO-05-iconen-ronde2-antwoord.md`
- Bestanden (gewijzigd): `icoon`-ids op alle 38 elementtypen in
  `diagramprofielen/{erd,sysml,cmmn}/index.js`; `gedragTypeIconen.jsx`
  (kop-comment + `gedrag-toestand` + drie gateway-glyphs); `bpmn/index.js`;
  `studio/activities/erdActivity.jsx`; `docs/STUDIO-05-vormgeving-handover.md`
- API routes: —
- DB/SQL: —
- Frontend: taakbalken "Maken"/"Verbinding", elementen-browser en projectboom
  van ERD, SysML, CMMN en BPMN

## Open punten

- **De connector-iconen van ronde 1 zijn zwak op 14px**: `compositie`,
  `associatie` en `afhankelijkheid` lijken in de balk sterk op elkaar. Valt nu
  op omdat SysML elf lijnen in één balk zet. Voorstel voor een korte ronde 3:
  markers ~20% groter, lijn iets korter.
- `formulier` heeft nog geen iconen (dogfood-profiel, lage prioriteit).
- ArchiMate en toegangsregel zijn bewust ongemoeid gelaten.

## Volgende stap

Ronde 3 overwegen voor de markermaat van de ronde-1-connectoren, en het
randelement-motief uitrollen naar BPMN-boundary-events, activity-pins en de
entry/exit-points van de state machine.

## Implementatienoot

`erd/index.js` blijft bewust vrij van `.jsx`-imports, want `erd.test.js` laadt
het rechtstreeks in node (anders dan sysml/ en cmmn/, die eigen shapes hebben).
De ERD-iconen worden daarom in `erdActivity.jsx` geregistreerd in plaats van in
`registreerErd()`.
