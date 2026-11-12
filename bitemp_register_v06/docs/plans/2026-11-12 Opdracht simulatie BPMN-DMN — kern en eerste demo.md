# Opdracht (voor een aparte Claude-chat): simulatie van BPMN en DMN, kern en eerste demo

**Context.** Mark wil in Omnium Studio een BPMN-proces met beslistabellen
kunnen simuleren met echte objecten uit het canonieke model (cm): een
startobject triggert een startevent, een token loopt door het proces, taken
maken en wijzigen objecten, en aan het eind ligt er een stapeltje objecten met
state. Het ontwerp staat in
`2026-11-12 Simulatie van BPMN en DMN met cm-objecten (ontwerp).md`. Lees dat
eerst helemaal; deze opdracht herhaalt het niet.

Lees daarna `CLAUDE.md`, `.github/copilot-instructions.md`,
`bitemp_register_v06/docs/STUDIO.md` en
`process_engine_v01/docs/driehoek-proces-regels-data.md`.

**Wat Mark ermee wil aantonen.** Dat een klein universum van elementen veel
bereikt. Elke toevoeging die het universum groter maakt, werkt tegen het doel.
Twijfel je of iets erbij moet, laat het weg en noteer het als vraag.

**Niet het doel.** Een tweede process engine, of gelijk gedrag met Operaton.
Uitvoeren blijft bij `process_engine_v01/`.

## Fase 0 — verkenning (eerst, en rapporteer vóór je bouwt)

Zoek uit en schrijf de bevindingen in een korte paragraaf onderaan het
ontwerpdocument (§9 "Bevindingen verkenning"):

1. **De vorm van het M1-procesmodel.** Hoe ziet een BPMN-model op de motor eruit
   als data: elementen, connectoren, `data`-eigenschappen, containers (pool,
   lane, subproces)? Kijk in `web/vite/src/diagramprofielen/bpmn/` en in de
   fixtures onder `canoniek-uml/fixtures/cg-test/` (`*.bpmn-model.json`).
2. **De taal van de condities.** Wat staat er nu in `conditie` op sequence
   flows: JUEL (`${...}`), CEL, of vrije tekst? Zie `sequenceFlow.js`,
   `bpmnArtefact.js` en de fixtures.
3. **Waar de beslistabel staat.** Het DRD-profiel (`dmn-drd/`) beschrijft
   beslissingen en afhankelijkheden. Waar staan de regels, de invoer- en
   uitvoerkolommen en de hit policy? Kijk ook in `dmnArtefact.js`,
   `dmnXmlImport.js`, `*.dmn-model.json` en `src/studio/activities/dmnActivity.jsx`.
4. **Berichttype en Procescontract.** Zijn die beschikbaar op het motor-profiel,
   of alleen in de bpmn.io-activiteit (`web/vite/src/bpmn/`)?
5. **Het cm als typebron.** Hoe vraag je de velden en typen van een cm-type op
   zonder scherm? Kandidaten: `celContext.js`, `web/vite/src/modelpicker/`, de
   MetaRegistry-vorm die `celEvaluator.js` gebruikt (`typeMetaByTypenaam`).
6. **De reikwijdte van de CEL-subset.** Wat kan `shared/celEvaluator.js` wel en
   niet? Lees ook `bitemp_register_v06/CEL-evaluatie-js.md`.

Raken de bevindingen een van de vier keuzes uit §3 of een vraag uit §8 van het
ontwerp, leg dat dan aan Mark voor en wacht op antwoord. De vragen in §8 zijn
nog niet beantwoord; bouw fase 1 op het advies in die tabel, tenzij Mark anders
beslist.

## Fase 1 — de kern, zonder scherm

Bouw pure modules, zonder React en zonder afhankelijkheid van de editor, zoals
`bpmnBinding.js` en `procesContract.js` dat doen. Voorstel voor de plek:
`web/vite/src/simulatie/`. Wijk af als de verkenning een betere plek aanwijst.

| Module | Verantwoordelijkheid |
|---|---|
| Store | Een log van mutaties (maak, zet, overgang, verbind, ontbind) en de daaruit afgeleide toestand. Opvragen op type en op cm-pad. Terugspoelen naar een eerdere stap. |
| Interpreter | Leest het M1-procesmodel, houdt procesinstanties en tokens bij, zet per aanroep één stap. Geen timers, geen eigen klok: de aanroeper bepaalt het tempo. |
| Gaten | Maakt een gat met een verwacht type als een waarde ontbreekt, en hervat het token als het gat gevuld is. Vullen met de hand of willekeurig naar type. |
| Beslistabel | Rekent een tabel uit met CEL-invoer en de hit policies uniek en eerste; rekent een boom van tabellen van onder naar boven uit. |

Eisen:

1. **Dekking** zoals in §4 van het ontwerp, en niet meer.
2. **Eén stap per aanroep**, met als resultaat wat er gebeurde: welk token
   bewoog, welke mutaties, welk gat. Het scherm van fase 2 tekent daaruit.
3. **Herhaalbaar.** Dezelfde invoer en dezelfde gevulde gaten geven dezelfde
   run. Willekeurige waarden komen uit een generator met een meegegeven zaadje.
4. **Drie soorten einde** uit §2.2 van het ontwerp, elk herkenbaar in het
   resultaat. "Vastgelopen" krijgt de tokens mee die niet meer kunnen bewegen.
5. **Expressies via de bestaande CEL-evaluator.** Breid die alleen uit als de
   demo het vraagt, met tests, en houd `testdata/cel-pariteit.json` en
   `celexpr/` (de Go-kant) in de gaten: de twee evaluatoren horen gelijk te
   blijven.
6. **Geen wijzigingen aan de transformaties naar Operaton en GZAC.** Nieuwe
   eigenschappen op het BPMN-profiel zijn optioneel en mogen bestaande modellen
   en exports niet veranderen.

**Acceptatie fase 1.** Een test speelt de demonstratie uit §6 van het ontwerp
af, van startobject tot eindtoestand, en controleert: de objecten in de store
met hun state, de volgorde van het log, en dat terugspoelen naar een
tussenstap de toestand van dat moment geeft. Daarnaast één test per soort
einde, waaronder een model dat vastloopt op een onvolledige parallelle join.

Tests draaien met `npm test` in `bitemp_register_v06/web/vite` (node --test,
bestanden `*.test.js` naast de module).

## Fase 2 — het scherm (pas na akkoord op fase 1)

Een simulatiestand in de BPMN-activiteit op de motor (`bpmnMotorActivity.jsx`),
tenzij Mark bij vraag 6 anders kiest:

- het token zichtbaar op het diagram;
- een startdialoog: kies een cm-type, vul het object met de hand of willekeurig;
- een paneel voor het open gat, met een formulier naar het verwachte type;
- de objectenlijst met state, bijgewerkt per stap;
- het log, met terugspoelen;
- knoppen: stap, doorlopen tot het volgende gat, opnieuw.

Volg de bestaande vormgeving van de Studio en de branding in
`web/omnium-studio/`. Laat Mark het in de browser zien voordat je het af noemt.

## Werkafspraken

- Werk op de branch waarop deze opdracht staat, of op een branch daarvan. Niet
  op `main`. Commit en push alleen als Mark erom vraagt.
- Documenteer in het Nederlands. Werk het ontwerpdocument bij als een keuze
  verandert, en voeg een regel toe aan `docs/BACKLOG.md` en waar passend aan
  `docs/STUDIO.md`.
- Houd de metaniveaus uit `CLAUDE.md` aan. De simulatie-objecten hebben de vorm
  van M0, maar staan los van het register: er wordt niets in de database
  geschreven.
- De repo is publiek. Gebruik in fixtures en voorbeelden alleen verzonnen
  gegevens.
- Bewaar aan het eind een samenvatting van de chat volgens `CLAUDE.md`
  (§ Belangrijke chats archiveren).

## Wat je oplevert

1. De bevindingen van fase 0 in het ontwerpdocument.
2. De modules van fase 1 met tests, groen.
3. Een korte stand voor Mark: wat werkt, welke vragen uit §8 nog open staan, en
   wat de demo liet zien dat ontbreekt in het universum.
