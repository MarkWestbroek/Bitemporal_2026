# Simulatie van BPMN en DMN met cm-objecten (ontwerp, 2026-11-12)

Aanleiding: Mark (11-11 en 12-11, Claude-chat over Petri nets, BPMN en DMN): "Ik
zou eigenlijk BPMN en DMN willen kunnen simuleren, liefst met objecten (M0) als
input, met een concreet token dat door de flow gaat. Operaton/Valtimo zit in de
stack, maar echte simulaties heb ik daar niet in gevonden. Misschien is een
simpele simulatie wel te doen in de Studio."

Dit is een ontwerpnotitie, er is nog niets gebouwd. De opdracht voor de bouw
staat in `2026-11-12 Opdracht simulatie BPMN-DMN — kern en eerste demo.md`.

## 0. Doel en uitgangspunten

**Doel.** Laten zien dat je met een klein universum van elementen veel bereikt:
één aanvraag loopt door een proces en een beslistabel, en aan het eind ligt er
een stapeltje objecten met state, met het spoor erbij dat verklaart hoe ze zo
geworden zijn.

**Uitgangspunten van Mark (12-11).**

| # | Uitgangspunt |
|---|---|
| 1 | Het canoniek model (cm) is de essentie. Berichten, formulieren en API's zijn vorm en komen in de ideale wereld uit het cm. De simulatie praat dus van begin tot eind in cm-termen. |
| 2 | BPMN heeft een eigen M2 (het `bpmn`-profiel op de diagram-motor). De simulatie leest het M1-model in die vorm, geen BPMN-XML. |
| 3 | DMN mag eenvoudig: gewone beslistabellen, of een boompje van tabellen. FEEL hoeft niet. |
| 4 | Expressies lopen via de bestaande CEL-subset-evaluator, die cm-paden begrijpt. |
| 5 | De koppeling tussen cm en BPMN loopt langs vier wegen en niet meer: input-events (message of signal) met een cm-object als lading, message flows waarover cm-objecten stromen, data stores die cm-objecten vasthouden, en datamanipulatie die alleen binnen het proces gebeurt. |
| 6 | De store is voor "fire and forget" tijdelijk. De luxe variant bewaart hem, zodat ketens en bundels te testen zijn. |
| 7 | Adapters naar echte data stores, met vertalingen, zijn voor een volgende versie. |

**Wat het niet is.** Geen tweede process engine. Uitvoeren blijft het werk van
Operaton via `process_engine_v01/`. De simulatie is een denk- en demonstratie-
hulp in de browser en garandeert niet dat Operaton zich identiek gedraagt.

## 1. Het universum

| Element | Wat het is | Niveau |
|---|---|---|
| cm-type | Een type uit het canonieke model. | M1 |
| Object | Een instantie van een cm-type, met data en state. | M0 (simulatie) |
| Procesinstantie | Een lopend proces, subproces of call activity. Zelf ook een object: een instantie van een M1-proceselement. | M0 (simulatie) |
| Token | Wijst naar een plek in het proces en naar de scope van zijn procesinstantie. Draagt zelf geen data. | M0 (simulatie) |
| Event met lading | Een message of signal dat een cm-object draagt. | M1 (soort), M0 (voorkomen) |
| Store | Houdt objecten vast en beantwoordt vragen in cm-paden. | M0 (simulatie) |
| Stap | Een taak die objecten aanmaakt of wijzigt. | M1 |
| Expressie | CEL over cm-paden: condities, toekenningen, correlatie. | M1 |
| Beslistabel | Invoerkolommen als CEL-paden, regels, hit policy. | M1 |
| Gat | Een punt waar de simulatie een waarde nodig heeft die zij niet zelf kan afleiden. | M0 (simulatie) |

"M0 (simulatie)" staat los van het register: er wordt niets in de database
geschreven. CLAUDE.md reserveert M0 voor geregistreerde instanties; de simulatie
gebruikt dezelfde vorm in een eigen, tijdelijke store.

## 2. Hoe een simulatie loopt

De simulator is een interpreter over het M1-procesmodel met een store ernaast.

1. **Start.** Je zet een startobject van een cm-type klaar, bijvoorbeeld de
   payload van een formulier als `Aanvraag`. Dat object is de lading van het
   startevent. Er ontstaat een procesinstantie met één token.
2. **Stap.** Het token komt bij een element. De interpreter voert de regel van
   dat elementtype uit: een gateway evalueert condities, een taak voert haar
   mutaties uit, een business rule task rekent een beslistabel uit, een call
   activity start een kind-instantie.
3. **Gat.** Kan de interpreter niet verder zonder een waarde, dan pauzeert het
   token en ontstaat er een gat met een verwacht type.
4. **Einde.** De simulatie stopt in één van drie toestanden, zie §2.2.

### 2.1 Het gat als enig mechanisme voor invoer

Een user task, een gestubde API-aanroep, een ontbrekende waarde bij een gateway
en het startobject zijn hetzelfde: een gat met een verwacht cm-type of veldtype.
Omdat het type uit het cm komt, kan de Studio er een invoerformulier bij tonen.

Een gat kan op vier manieren gevuld worden:

- met de hand;
- met een willekeurige waarde die bij het type past;
- uit een fixture (een vooraf opgeslagen antwoord, voor herhaalbare runs);
- door de AI-assistent.

Voor herhaalbaarheid legt het spoor bij elk gevuld gat vast welke waarde
gebruikt is en hoe die gekozen is. Een run is dan opnieuw af te spelen zonder
dat iemand iets hoeft in te vullen.

### 2.2 Drie soorten einde

| Einde | Betekenis |
|---|---|
| Zakelijke uitkomst | Alle tokens zijn via een eindevent verbruikt. Een afwijzing is ook een geldige uitkomst. |
| Uitzondering | Een fout-, escalatie- of annuleringsevent heeft het verloop afgebroken. |
| Vastgelopen | Er zijn nog tokens, maar niets kan meer bewegen en er staat geen gat open. Dit is een fout in het model, bijvoorbeeld een join die nooit compleet wordt. |

Het derde geval is een bijvangst: de simulator signaleert een vastgelopen model
zonder dat daar formele analyse voor nodig is.

## 3. Vier keuzes (voorstel)

BPMN laat deze vier punten zelf open. Ze zijn nog niet door Mark bekrachtigd;
zie de vragen in §8.

### 3.1 Het mutatievocabulaire

Als alleen het proces data wijzigt, moet een taak kunnen zeggen wat zij doet.
Voorstel voor de kleinste bruikbare set:

| Mutatie | Betekenis |
|---|---|
| maak | Een nieuw object van een cm-type. |
| zet | Eén of meer velden van een bestaand object. |
| overgang | De state van een object verandert. |
| verbind / ontbind | Een relatie tussen twee objecten ontstaat of vervalt. |

De waarden komen uit een CEL-toekenning of uit een gat.

Het BPMN-profiel heeft al eigenschappen die hierop lijken: `actie` en
`actieDoel` op een service- of gebruikerstaak, `dossierstatus` en
`zetVariabelen` (plan van 05-11, "Servicetaken en dossierstatus uit het
model"). Die zijn gericht op zaakgericht werken en op de vertaling naar GZAC.
Het voorstel is om ze in de simulatie te lezen als bijzondere gevallen van
bovenstaande set, en pas een algemene mutatie-eigenschap toe te voegen als de
demo laat zien wat er ontbreekt.

### 3.2 Referentie of kopie

- **Binnen een proces: referentie.** Procesvariabelen wijzen naar objecten in
  de store. Zo is er één waarheid.
- **Over een message flow tussen pools: kopie.** Een bericht is een
  momentopname in cm-termen. De ontvanger beslist wat hij ermee in zijn eigen
  store doet.

Dit sluit aan op het bestaande Berichttype en het Procescontract (driehoek
proces – regels – data, stap 3 tot 5): die leggen per veld vast wat er over de
grens gaat.

### 3.3 Correlatie

Komt een bericht binnen bij een proces dat al loopt, dan bepaalt een sleutelpad
op het cm-object welke instantie het krijgt. Dat pad is een CEL-expressie. Bij
één losse run speelt dit nauwelijks, bij ketens is het nodig.

Message en signal verschillen alleen in adressering: een message heeft één
ontvanger, een signal bereikt iedereen die luistert.

### 3.4 De store als log

De store bewaart mutaties en leidt de toestand daaruit af. De twee varianten
van Mark zijn dan hetzelfde mechanisme:

- fire and forget: het log verdwijnt na de run;
- semi-permanent: het log blijft, zodat een volgende run erop verder bouwt.

Wat het log daarnaast oplevert:

- terugspoelen naar elke eerdere stap;
- per object de vraag beantwoorden waarom het deze state heeft;
- ketens: het eindbericht van proces A is het startevent van proces B, met
  hetzelfde cm-object als lading.

Voorstel voor de vorm: laat een logregel lijken op het paar registratie en
wijziging uit het register (één stap is één registratie, elke mutatie daarin
één wijziging). De adapter naar een echt register in een volgende versie is dan
een rechte afbeelding in plaats van een vertaling.

## 4. Afbakening van de eerste versie

**Wel.**

| Onderdeel | Dekking |
|---|---|
| Events | Start (geen, bericht, signaal), eind (geen, bericht, terminate). |
| Taken | User, service, business rule, send, receive. |
| Gateways | Exclusief en parallel. |
| Structuur | Subproces en call activity, elk als eigen procesinstantie. |
| Data | Data store en message flow met cm-objecten. |
| Beslissen | Beslistabel met CEL-invoer, hit policy uniek en eerste; een DRD als boom van tabellen. |
| Invoer | Gaten, te vullen met de hand of willekeurig. |
| Spoor | Het log, met terugspoelen. |

**Nog niet.** De inclusieve join, timers, compensatie, transacties,
multi-instance, event subprocessen, boundary events en de AI-vulling van gaten.
De eerste vier zijn de constructies die een blik over het hele proces vragen in
plaats van alleen de plek van het token; die maken een engine groot.

## 5. Wat er al ligt

| Bouwsteen | Waar |
|---|---|
| BPMN-profiel op de motor (M2): taken met `taakSoort`, gateways, events met `soort` en `bericht`, `conditie` op de sequence flow, `beslissing` en `resultaat` op de business rule task | `web/vite/src/diagramprofielen/bpmn/` |
| DMN-DRD-profiel op de motor | `web/vite/src/diagramprofielen/dmn-drd/` |
| CEL-subset-evaluator (paden, vergelijkingen, lambda's over lijsten) | `web/vite/src/shared/celEvaluator.js` |
| CEL-contextvelden uit het canonieke model | `web/vite/src/diagramprofielen/canoniek-uml/celContext.js` |
| Berichttype op events en Procescontract op proces en call activity | `web/vite/src/bpmn/bpmnBinding.js`, `procesContract.js` |
| Achtergrond van de koppeling proces, regels en data | `process_engine_v01/docs/driehoek-proces-regels-data.md` |
| Testmodellen GPK (processen en beslissingen) | `web/vite/src/diagramprofielen/canoniek-uml/fixtures/cg-test/` |
| Objectdiagram-activiteit | `web/vite/src/studio/activities/objectActivity.jsx` |

Drie dingen zijn bij het schrijven van deze notitie niet uitgezocht en horen
bij de verkenning in de opdracht:

1. In welke taal de bestaande `conditie` op sequence flows geschreven is. De
   modellen zijn op Operaton gericht, dus dat kan JUEL zijn (`${...}`) in
   plaats van CEL.
2. Waar de regels van een beslistabel in het motor-model staan. Het DRD-profiel
   beschrijft de beslissingen en hun afhankelijkheden; de tabel zelf is daar
   niet gevonden.
3. Of het Berichttype en het Procescontract ook op het motor-profiel beschikbaar
   zijn, of alleen in de bpmn.io-activiteit.

## 6. De demonstratie

Eén aanvraag, twee processen, één beslistabel. Het voorstel is de GPK-casus
(gehandicaptenparkeerkaart), omdat daar al proces- en beslismodellen van zijn:

1. Een `Aanvraag` komt binnen als lading van het startevent van
   "aanvraag oppakken".
2. Een business rule task bepaalt de ontvankelijkheid met een beslistabel.
3. Een exclusieve gateway kiest op die uitkomst.
4. Een bericht start "gehandicaptenparkeerkaart beoordelen" met een kopie van
   het object.
5. Een user task vraagt het oordeel van de behandelaar: een gat.
6. Aan het eind liggen er een aanvraag, een beslissing en twee procesinstanties,
   elk met state, en het log dat ze verklaart.

Het argument van de demonstratie is telbaar: het aantal elementsoorten uit §1
tegenover wat de run laat zien.

## 7. Fasering

| Fase | Inhoud | Resultaat |
|---|---|---|
| 0 | Verkenning: de drie open punten uit §5 en de vorm van het M1-model. | Een korte bevinding, en zo nodig bijgestelde keuzes. |
| 1 | Kern zonder scherm: store als log, interpreter, gaten, beslistabel. Pure modules met tests. | De demo-run slaagt als test. |
| 2 | Scherm in de Studio: token op het diagram, gatenformulier, objectenlijst, log met terugspoelen. | De demo is te geven. |
| 3 | Ketens en de semi-permanente store, correlatie. | Twee processen die elkaar via een bericht starten, over meerdere runs. |
| Later | Adapters naar echte stores, AI-vulling, de niet-lokale BPMN-constructies. | |

## 8. Vragen aan Mark

| # | Vraag | Advies |
|---|---|---|
| 1 | Mutaties: de bestaande taakeigenschappen hergebruiken, of meteen een algemene mutatie-eigenschap op de taak? | Eerst hergebruiken; uitbreiden op wat de demo mist. |
| 2 | Condities: bestaande JUEL-condities laten staan en er een CEL-conditie naast zetten, of omzetten? | Ernaast zetten. De transformatie naar Operaton blijft dan ongemoeid. |
| 3 | Kopie over message flows, referentie binnen het proces: akkoord? | Ja. |
| 4 | Het log vormen naar registratie en wijziging: akkoord, of is dat te vroeg? | Akkoord, maar licht: alleen de vorm, geen bitemporele tijdlijnen in de simulatie. |
| 5 | De GPK-casus als demo, of een kleinere, verzonnen casus die los staat van GZAC? | GPK, als de modellen zonder veel aanpassing te lezen zijn; anders een kleine casus in dezelfde vorm. |
| 6 | Waar komt het scherm: een eigen activiteit, of een stand van de bestaande BPMN-activiteit op de motor? | Een stand van de bestaande activiteit: het token hoort op het diagram dat je al open hebt. |

## Referenties

- W.M.P. van der Aalst, workflow nets en soundness: de drie eisen achter §2.2.
- BPMN 2.0 beschrijft procesgedrag in termen van tokens; een parallelle join is
  een Petri-net-transitie met meerdere invoerplaatsen.
- bpmn-js-token-simulation (bpmn.io, MIT): tokens op een diagram, zonder data.
  Niet gebruikt, wel het bekende voorbeeld van wat hier met objecten erbij
  bedoeld is.
