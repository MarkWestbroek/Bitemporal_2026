# Chat Samenvatting

## Metadata

- Datum: 2026-11-12 / 2026-11-13
- Titel: Simulatie van BPMN en DMN met cm-objecten: review, verkenning en kern (Claude-sessie SIMULATIE)
- Bestandstamnaam: 2026-11-12-simulatie-bpmn-dmn-kern
- Gerelateerde export: nog niet gemaakt (`scripts/export-claude-chats.py`)
- Gerelateerde branch/commit: `claude/simulatie-bpmn-dmn-cm` (niet gecommit bij het schrijven van deze samenvatting)

## Doel

De review van FUNDAMENT en de wensen van Mark verwerken in het ontwerp en de opdracht voor de simulatie van BPMN en
DMN met cm-objecten, de verkenning (fase 0) doen en de kern zonder scherm (fase 1) bouwen.

## Beslissingen

- **CEL is de expressietaal in het BPMN- en DMN-model; JUEL en FEEL zijn uitvoer van een transformatie** (Mark,
  12-11). Reden van Mark: CEL staat al centraal in het cm, de afgeleide velden en de GraphQL-resolvers, en leest
  natuurlijker zonder `${}`.
- Fase 1 uitvoeren (Mark, 12-11), op het advies van §8 van het ontwerp waar Mark nog niet beslist heeft.
- Fase 2 (het scherm) mocht beginnen zonder op de antwoorden bij §8 te wachten (Mark, 13-11).
- Het token komt op het diagram via een stijlblok op element-id, zonder wijziging in de motor (keuze van de
  sessie; Mark heeft het scherm nog niet gezien).
- De demo volgt `inrichten-bpmn.bpmn-model.json` (drie processen, de stand van de stack), geijkt tegen de vijf
  scenario's uit `cg-stack-voor-simulatie.md` van FUNDAMENT.

## Waarom deze keuze

Het voorstel van FUNDAMENT was de bestaande JUEL en FEEL in te lezen. Mark koos de andere kant op: één expressietaal
in het model. De overgang is klein gehouden: een conditie die nog met `${` begint gaat ongewijzigd door de schrijver
en de simulatie leest hem door de haakjes eraf te halen. De XML uit de omgezette GPK-modellen is gelijk aan die van
daarvoor.

## Gewijzigde onderdelen

- Bestanden: `docs/plans/2026-11-12 Simulatie … (ontwerp).md` (§0, §2.1, §3.2 tot §3.6, §4, §6, §8, §9, §10),
  `docs/plans/2026-11-12 Opdracht simulatie BPMN-DMN …`, `docs/TRANSFORMATIES.md` §11.12, `docs/BACKLOG.md` §41.
- API routes: geen.
- DB/SQL: geen.
- Frontend: nieuw `web/vite/src/simulatie/` (store, procesmodel, beslistabel, gaten, simulatie, formaat, vijf
  scenario's) en `web/vite/src/transformatie/celOmzetting.js`; `bpmnXmlSchrijver.js` en `dmnXmlSchrijver.js` zetten
  CEL om; drie fixtures onder `fixtures/cg-test/` omgezet naar CEL. Fase 2: `studio/activities/simulatiePaneel.jsx`,
  `simulatie/weergave.js`, aansluiting in `bpmnMotorActivity.jsx`, e2e `63-studio-simulatie.spec.js`.

## Open punten

- De vragen 1, 3 tot 6 en 8 tot 14 in §8 en §10.4 van het ontwerp.
- Beslissing en beschikking komen naar verwachting 13-11 op main: binnenhalen en vraag 12 opnieuw bekijken.
- Het Studio-project Inrichten op omnium.fundament staat nog in JUEL en FEEL.

## Volgende stap

Mark bekijkt het scherm in de browser en leest het ontwerp (§8 en §10); daarna main binnenhalen (Beslissing en
beschikking) en vraag 12.
