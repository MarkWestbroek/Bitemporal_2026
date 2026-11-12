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
`process_engine_v01/docs/driehoek-proces-regels-data.md`, en in de repo
Fundament `docs/cg-stack-voor-simulatie.md`: wat de echte CG-stack met een
GPK-aanvraag doet, per stap in cm-termen, met vijf scenario's om tegen te
ijken. De simulatie speelt die stack na.

**Bijgewerkt 12-11 (sessie SIMULATIE)** na de review van FUNDAMENT, de wensen
en het besluit van Mark van die dag en de verkenning. Fase 0 is gedaan. Mark
heeft gevraagd fase 1 uit te voeren.

**Stand 13-11:** fase 1 en fase 2 zijn gebouwd; zie §10 van het ontwerp
(§10.5 voor het scherm). Mark gaf op 13-11 aan dat fase 2 mocht beginnen
zonder op zijn antwoorden bij §8 te wachten. Hij heeft het scherm nog niet in
de browser gezien.

**Wat Mark ermee wil aantonen.** Dat een klein universum van elementen veel
bereikt. Elke toevoeging die het universum groter maakt, werkt tegen het doel.
Twijfel je of iets erbij moet, laat het weg en noteer het als vraag.

**Niet het doel.** Een tweede process engine, of gelijk gedrag met Operaton.
Uitvoeren blijft bij `process_engine_v01/`.

## Fase 0 — verkenning (gedaan 12-11)

De bevindingen staan in §9 van het ontwerp. Kort: een proces is een diagram;
de condities zijn JUEL over procesvariabelen en zijn zonder `${}` geldige CEL;
de beslistabel staat in `data.beslistabel` van de beslissing, met een cm-pad
per kolom en één FEEL-expressie; Berichttype en Procescontract bestaan alleen
in de bpmn.io-activiteit; het cm kent geen Zaak, Rol, Document of Beslissing;
de CEL-subset is groot genoeg voor de GPK-casus.

Besloten door Mark (12-11): **CEL is de expressietaal in het model, JUEL en
FEEL zijn uitvoer van een transformatie** (ontwerp §3.6). De overige vragen in
§8 van het ontwerp zijn open; bouw fase 1 op het advies in die tabel, tenzij
Mark anders beslist.

## Fase 1 — de kern, zonder scherm

Bouw pure modules, zonder React en zonder afhankelijkheid van de editor, zoals
`bpmnBinding.js` en `procesContract.js` dat doen. Voorstel voor de plek:
`web/vite/src/simulatie/`. Wijk af als de verkenning een betere plek aanwijst.

| Module | Verantwoordelijkheid |
|---|---|
| Store | Een log van mutaties (maak, zet, overgang, verbind, ontbind) en de daaruit afgeleide toestand. Opvragen op type en op cm-pad. Terugspoelen naar een eerdere stap. |
| Interpreter | Leest het M1-procesmodel, houdt procesinstanties en tokens bij, zet per aanroep één stap. Geen timers, geen eigen klok: de aanroeper bepaalt het tempo. |
| Gaten | Maakt een gat met een verwacht type als een waarde ontbreekt, en hervat het token als het gat gevuld is. Vullen met de hand, willekeurig naar type of uit een fixture. De vulwijze is per run in te stellen, met een uitzondering per gat; een run op "fixture" of "willekeurig" loopt zonder stoppen door. Ook een bericht naar een pool zonder proces en een servicetaak die niet in cm-termen te lezen is, zijn gaten. |
| Beslistabel | Rekent een tabel uit zoals hij in het DMN-model staat: invoer via het cm-pad van de kolom of een CEL-expressie, cellen als waarde of lijst van waarden, hit policies uniek en eerste; rekent een boom van tabellen van onder naar boven uit. |
| Formaat | M1-set (cm, proces, beslistabellen, e-dienstmodel; elk met hash), scenario (startobject, startvariabelen, gat-antwoorden, vulwijze, zaadje) en run (log) als gescheiden JSON (ontwerp §3.5). Niets wordt bewaard. |
| Omzetting | `celNaarJuel` en `celNaarFeel` op de boom van `parseCelExpressie` (ontwerp §3.6), aangesloten op `bpmnXmlSchrijver` en `dmnXmlSchrijver`. Wat de doeltaal niet kan uitdrukken wordt een foutmelding op het element. |

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
6. **De uitvoer naar Operaton en GZAC verandert niet.** De schrijvers krijgen
   de omzetting van CEL naar JUEL en FEEL erbij (besluit Mark 12-11), maar de
   XML die uit de GPK-modellen komt blijft gelijk: een conditie die al met
   `${` begint gaat ongewijzigd door, en een model dat naar CEL is omgezet
   geeft dezelfde XML als daarvoor. Nieuwe eigenschappen op het BPMN-profiel
   zijn optioneel.
7. **De fixtures omzetten naar CEL** (`inrichten-bpmn.bpmn-model.json`,
   `gpk-processen.bpmn-model.json`, `gpk-beslissingen.dmn-model.json`), met de
   toets van eis 6. Het Studio-project Inrichten op omnium.fundament is de
   bron van die modellen; dat omzetten is een afspraak met FUNDAMENT en hoort
   niet bij deze opdracht.

**Acceptatie fase 1.** De vijf scenario's uit `cg-stack-voor-simulatie.md` §8
draaien als test op `inrichten-bpmn.bpmn-model.json`, elk als fixture en
zonder stoppen, en geven het verwachte einde. De test van scenario 4
controleert daarnaast: de objecten in de store met hun state, de volgorde van
het log, en dat terugspoelen naar een tussenstap de toestand van dat moment
geeft. Verder één test per soort einde, waaronder een model dat vastloopt op
een onvolledige parallelle join, en een test dat de export van de omgezette
fixtures dezelfde XML geeft als voorheen.

Tests draaien met `npm test` in `bitemp_register_v06/web/vite` (node --test,
bestanden `*.test.js` naast de module).

## Fase 2 — het scherm (pas na akkoord op fase 1)

Een simulatiestand in de BPMN-activiteit op de motor (`bpmnMotorActivity.jsx`),
tenzij Mark bij vraag 6 anders kiest:

- het token zichtbaar op het diagram;
- een startdialoog: kies een cm-type, vul het object met de hand of willekeurig;
- een paneel voor het open gat, met een rudimentair formulier naar het
  verwachte type; noemt de user task een formulier, dan de invulbare velden
  daarvan (ontwerp §8 vraag 9);
- de vulwijze: per run, en per gat;
- de objectenlijst met state, bijgewerkt per stap;
- het log, met terugspoelen;
- knoppen: stap, doorlopen tot het volgende gat, opnieuw.

Volg de bestaande vormgeving van de Studio en de branding in
`web/omnium-studio/`. Laat Mark het in de browser zien voordat je het af noemt.

## Werkafspraken

- Werk op de branch waarop deze opdracht staat, of op een branch daarvan. Niet
  op `main`. Commit en push alleen als Mark erom vraagt.
- Mark zet Beslissing en beschikking naar verwachting 13-11 op `main`. Haal
  `main` daarna binnen vóór de demo, en kijk dan opnieuw naar vraag 12 van het
  ontwerp (de behandelvelden die nog niet in het cm staan).
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
