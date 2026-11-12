# Simulatie van BPMN en DMN met cm-objecten (ontwerp, 2026-11-12)

Aanleiding: Mark (11-11 en 12-11, Claude-chat over Petri nets, BPMN en DMN): "Ik
zou eigenlijk BPMN en DMN willen kunnen simuleren, liefst met objecten (M0) als
input, met een concreet token dat door de flow gaat. Operaton/Valtimo zit in de
stack, maar echte simulaties heb ik daar niet in gevonden. Misschien is een
simpele simulatie wel te doen in de Studio."

De opdracht voor de bouw staat in
`2026-11-12 Opdracht simulatie BPMN-DMN — kern en eerste demo.md`.

**Bijgewerkt 12-11 (sessie SIMULATIE).** Verwerkt: de review van FUNDAMENT, de
wensen en het besluit van Mark van 12-11 (§0, nummers 8 tot 12) en de
verkenning van fase 0 (§9). De referentie voor wat de simulatie naspeelt is
`docs/cg-stack-voor-simulatie.md` in de repo Fundament: wat de CG-stack met een
GPK-aanvraag doet, per stap in cm-termen, met vijf scenario's. Besloten is
alleen wat in §8 als besloten staat; de rest van §3 en §8 is voorstel.

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
| 8 | (12-11) Gegevens blijven in cm-taal; de M0-store komt erbij. |
| 9 | (12-11) Het formulier bij een gat is rudimentair, naar het type. Noemt de user task een formulier, dan gebruikt het gat dat formulier. Een form.io-weergave mag, hoeft niet. Zie vraag 9 in §8. |
| 10 | (12-11) Op elke plek waar gegevens in moeten staat een stub: willekeurig of uit een fixture. De vulwijze is per gat of per run in te stellen, zodat een run zonder stoppen doorloopt. Een bericht naar een pool zonder proces (ketenpartner) is ook een gat met een stub. |
| 11 | (12-11) Simulaties bewaren op het niveau van een M1-set en een M0-set: niet in de eerste versie, wel het formaat voorbereiden (§3.5). |
| 12 | (12-11, besluit) **CEL is de expressietaal in het model**, ook voor de condities in een proces en de expressies in een beslistabel. JUEL en FEEL zijn uitvoer: een transformatie schrijft ze bij de export naar de engine. Reden: CEL staat al centraal in het cm, in de afgeleide velden en in de GraphQL-resolvers daarvan, en leest natuurlijker zonder `${}`. Zie §3.6. |

Uitgangspunt 12 scherpt 3 en 4 aan: FEEL hoeft de simulatie niet te lezen,
want het model bevat het niet meer.

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
- door de AI-assistent (niet in de eerste versie).

De **vulwijze** is in te stellen per run, met een uitzondering per gat. Staat
de run op "fixture" of "willekeurig", dan stopt hij bij geen enkel gat en loopt
hij in één keer door tot een einde. Staat een gat op "met de hand", dan
pauzeert de run daar. Heeft een fixture voor een gat geen antwoord, dan valt
dat gat terug op "met de hand".

Ook dit zijn gaten:

- een bericht naar een pool zonder proces (een ketenpartner, of de inwoner in
  het portaal): het antwoord dat terugkomt is het gat;
- een servicetaak die iets doet wat de simulatie niet in cm-termen kan lezen:
  het resultaat is het gat;
- een conditie of expressie die de simulatie niet kan lezen, of die een
  variabele noemt die er niet is: de uitkomst is het gat.

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

- **Binnen één afhandeling: referentie.** Procesvariabelen wijzen naar
  objecten in de store. Zo is er één waarheid. Een afhandeling is alles wat
  dezelfde sleutel deelt (§3.3), ook als het over meerdere processen loopt die
  elkaar met berichten starten.
- **Naar een andere partij: kopie.** Een bericht naar een ketenpartner is een
  momentopname in cm-termen. De ontvanger beslist wat hij ermee in zijn eigen
  store doet.

De eerste versie van dit ontwerp legde de grens bij de pool: elk bericht een
kopie. De stack doet het anders (bevinding e van FUNDAMENT): oppakken,
behandelen en beoordelen zijn drie processen met één dossier en één business
key, en de berichten ertussen dragen alleen procesvariabelen. Het voorstel is
daarom de grens bij de partij te leggen; zie vraag 3.

Dit sluit aan op het bestaande Berichttype en het Procescontract (driehoek
proces – regels – data, stap 3 tot 5): die leggen per veld vast wat er over de
grens gaat.

### 3.3 Correlatie

Komt een bericht binnen bij een proces dat al loopt, dan bepaalt een sleutel
welke instantie het krijgt. In de stack is dat de business key van het dossier;
in cm-termen is de sleutel dus het startobject zelf (de aanvraag). Alle
procesinstanties van één afhandeling delen die sleutel. Dat is genoeg voor de
demo. Een sleutelpad als CEL-expressie op het cm-object is pas nodig bij ketens
met een andere partij (fase 3).

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

### 3.5 M1-set, scenario en run

Voorbereiding op het bewaren van simulaties (uitgangspunt 11). De eerste versie
bewaart niets, maar houdt deze drie dingen in de kern al uit elkaar, elk als
gewone JSON:

| Wat | Inhoud | Niveau |
|---|---|---|
| **M1-set** | Waar de simulatie op draait: het cm, het procesmodel en de beslistabellen, elk met naam en hash. Voor de demo hoort het e-dienstmodel er ook bij: dat zegt welk diagram welk proces is en hoe een taakformulier eruitziet (§9.1, §9.7). | M1 |
| **Scenario** | Wat erin gaat: het startobject, de startvariabelen (de envelop, vraag 13), de antwoorden op de gaten, de vulwijze en het zaadje voor willekeurige waarden. Verwijst naar een M1-set. | M0 (simulatie) |
| **Run** | Wat eruit komt: het log. Verwijst naar een scenario en naar de hashes van de M1-set waarop gedraaid is. | M0 (simulatie) |

Een fixture is een scenario: hetzelfde scenario op dezelfde M1-set geeft
dezelfde run. Is een hash van de M1-set veranderd, dan is een oude run niet
meer te vergelijken en zegt de simulatie dat. De hash is dezelfde als bij de
inrichtingsartefacten: sha256 over JCS (`transformatie/jcs.js`).

Een antwoord op een gat is in het scenario te vinden op de plek van het gat
(het element in het procesmodel) en het volgnummer van het bezoek, zodat een
lus (twee keer beoordelen) twee antwoorden kan hebben.

### 3.6 CEL in het model, JUEL en FEEL als uitvoer

Besluit van Mark (12-11, uitgangspunt 12). Uitwerking, als voorstel:

| Plek in het model | Nu | Wordt | Bij de export |
|---|---|---|---|
| `conditie` op een sequence flow | JUEL: `${uitkomst == 'toegekend'}` | CEL: `uitkomst == 'toegekend'` | CEL → JUEL: `${…}` eromheen; wat JUEL anders schrijft wordt omgezet |
| `expressie` op een invoerkolom van een beslistabel | FEEL: `bijlagen != null and (some b in bijlagen satisfies b.naam = "pasfoto")` | CEL: `bijlagen != null && bijlagen.exists(b, b.naam == "pasfoto")` | CEL → FEEL |
| Een cel in een beslistabel | een waarde, een lijst van waarden of leeg (`"bestuurder"`, `null, ""`) | blijft zo: het is een waarde, geen expressie (vraag 7) | ongewijzigd |
| `bericht` en `zetVariabelen` met `${variabele}` | JUEL | vraag 11 | |

De omzetting is één module met twee richtingen uit: `celNaarJuel` en
`celNaarFeel`, op de boom die `parseCelExpressie` geeft. Wat de doeltaal niet
kan uitdrukken wordt bij de export een foutmelding op het element, geen stille
benadering.

| CEL | JUEL | FEEL |
|---|---|---|
| `a == b`, `a != b` | gelijk | `a = b`, `a != b` |
| `a && b`, `a \|\| b`, `!a` | gelijk | `a and b`, `a or b`, `not(a)` |
| `c ? x : y` | gelijk | `if c then x else y` |
| `l.exists(x, p)`, `l.all(x, p)` | melding (geen lambda in de JUEL van de engine) | `some x in l satisfies p`, `every x in l satisfies p` |
| `l.size()`, `size(l)` | melding | `count(l)` |
| `l.filter(x, p)` | melding | `l[p]` met `item` voor `x` |

De JUEL-kolom is bewust smal: een conditie in een proces vergelijkt in de
praktijk een variabele met een waarde. Of de JUEL van Operaton lambda's kent,
is niet uitgezocht.

**Overgang.** Bestaande modellen bevatten nog JUEL en FEEL. Voorstel:

1. De schrijvers (`bpmnXmlSchrijver`, `dmnXmlSchrijver`) zetten CEL om. Een
   conditie die al met `${` begint, gaat ongewijzigd door, zodat een model dat
   nog niet is omgezet dezelfde XML blijft geven.
2. De simulatie leest alleen CEL. Een conditie in `${…}` leest zij door de
   haakjes eraf te halen (§9.2: voor de GPK-processen geeft dat geldige CEL);
   lukt dat niet, dan is het een gat.
3. De fixtures in deze repo worden omgezet. De toets: de XML die de export
   uit het omgezette model maakt, is gelijk aan de XML van daarvoor.
4. De bron van de GPK-processen is het Studio-project Inrichten op
   omnium.fundament. Dat omzetten is een afspraak met FUNDAMENT; tot dan werkt
   punt 1 en 2.

## 4. Afbakening van de eerste versie

**Wel.**

| Onderdeel | Dekking |
|---|---|
| Events | Start (geen, bericht, signaal), eind (geen, bericht, terminate), en het tussen-event met een bericht: werpend (start of wekt een ander proces) en vangend (wacht op een bericht). |
| Taken | User, service, business rule, send, receive. |
| Gateways | Exclusief en parallel. |
| Structuur | Subproces en call activity, elk als eigen procesinstantie. Een proces is een diagram (§9.1). |
| Data | Data store en message flow met cm-objecten; daarnaast procesvariabelen voor wat geen cm-object is (§9.2). |
| Condities | CEL in `conditie` op de sequence flow (§3.6). Onleesbaar, of een onbekende variabele, wordt een gat. |
| Beslissen | Beslistabel zoals hij in het DMN-model staat: invoer via het cm-pad van de kolom of een CEL-expressie, cellen als waarde of lijst van waarden, hit policy uniek en eerste; een DRD als boom van tabellen. |
| Invoer | Gaten, te vullen met de hand, willekeurig of uit een fixture; de vulwijze per run en per gat. |
| Spoor | Het log, met terugspoelen. |
| Formaat | M1-set, scenario en run als gescheiden JSON (§3.5). Nog niet bewaard. |
| Export | CEL → JUEL en CEL → FEEL in de bestaande schrijvers (§3.6). |

**Nog niet.** De inclusieve join, timers, compensatie, transacties,
multi-instance, event subprocessen, boundary events, de AI-vulling van gaten en
het bewaren van M1-sets, scenario's en runs. De eerste vier zijn de
constructies die een blik over het hele proces vragen in plaats van alleen de
plek van het token; die maken een engine groot.

De GPK-processen hebben één multi-instance taak (Documenten koppelen) en één
termijn (de portaaltaak verloopt na 14 dagen; die staat alleen in de stack,
niet in het model). Zie vraag 10 voor de eerste; de tweede speelt de simulatie
niet na.

## 5. Wat er al ligt

| Bouwsteen | Waar |
|---|---|
| BPMN-profiel op de motor (M2): taken met `taakSoort`, gateways, events met `soort` en `bericht`, `conditie` op de sequence flow, `beslissing` en `resultaat` op de business rule task | `web/vite/src/diagramprofielen/bpmn/` |
| DMN-DRD-profiel op de motor | `web/vite/src/diagramprofielen/dmn-drd/` |
| CEL-subset-evaluator (paden, vergelijkingen, lambda's over lijsten) | `web/vite/src/shared/celEvaluator.js` |
| CEL-contextvelden uit het canonieke model | `web/vite/src/diagramprofielen/canoniek-uml/celContext.js` |
| Berichttype op events en Procescontract op proces en call activity | `web/vite/src/bpmn/bpmnBinding.js`, `procesContract.js` |
| Achtergrond van de koppeling proces, regels en data | `process_engine_v01/docs/driehoek-proces-regels-data.md` |
| Testmodellen GPK: `inrichten-bpmn.bpmn-model.json` (drie processen, stand van de stack), `gpk-beslissingen.dmn-model.json`, `gpk-edienst.json`, `inrichten-domeinen-v3.json` (het cm) | `web/vite/src/diagramprofielen/canoniek-uml/fixtures/cg-test/` |
| Typen en velden van het cm zonder scherm (`pickerTypesUitV3`, `fieldRefsOpUuid`) | `web/vite/src/modelpicker/` |
| Hash over een model (sha256 over JCS) | `web/vite/src/transformatie/jcs.js` |
| Objectdiagram-activiteit | `web/vite/src/studio/activities/objectActivity.jsx` |

Drie dingen waren bij het schrijven van deze notitie niet uitgezocht. De
verkenning heeft ze beantwoord (§9.2, §9.3 en §9.4):

1. In welke taal de bestaande `conditie` op sequence flows geschreven is. De
   modellen zijn op Operaton gericht, dus dat kan JUEL zijn (`${...}`) in
   plaats van CEL.
2. Waar de regels van een beslistabel in het motor-model staan. Het DRD-profiel
   beschrijft de beslissingen en hun afhankelijkheden; de tabel zelf is daar
   niet gevonden.
3. Of het Berichttype en het Procescontract ook op het motor-profiel beschikbaar
   zijn, of alleen in de bpmn.io-activiteit.

## 6. De demonstratie

Eén aanvraag, drie processen, één beslistabel: de GPK-casus
(gehandicaptenparkeerkaart) zoals de CG-stack hem afhandelt. De simulatie leest
`inrichten-bpmn.bpmn-model.json`; dat model heeft de drie processen van de
stack. (`gpk-processen.bpmn-model.json` is de oudere stand met twee processen,
waarin het oppakken het beoordelen rechtstreeks start.)

1. Een `GehandicaptenparkeerkaartAanvraag` komt binnen als lading van het
   startevent van "Aanvraag oppakken", met de envelopvelden (het bsn) als
   startvariabelen.
2. Een business rule task bepaalt de ontvankelijkheid met de beslistabel
   `aanvraag-ontvankelijk`.
3. Een exclusieve gateway kiest op die uitkomst. Niet ontvankelijk: de status
   van de aanvraag wordt `nietInBehandeling` en het proces eindigt zonder zaak.
4. Ontvankelijk: vier servicetaken maken de zaak, koppelen rol en documenten en
   zetten de status (vraag 8). Een bericht start "Aanvraag behandelen".
5. Dat proces start met een bericht "Gehandicaptenparkeerkaart beoordelen" en
   wacht op het antwoord.
6. Een user task vraagt het oordeel van de behandelaar: een gat (toegekend,
   afgewezen of aanvulling, met een toelichting).
7. Op de uitkomst kiest het behandelen: beschikking opstellen (een gat),
   afwijzen (een gat), of aanvulling vragen bij de klant (een gat met een stub:
   de inwoner is een pool zonder proces) en daarna opnieuw beoordelen.
8. Aan het eind liggen er een aanvraag met state, wat de servicetaken hebben
   aangemaakt, de uitkomsten van beslistabel en beoordeling, en drie
   procesinstanties, met het log dat ze verklaart.

**IJken.** De vijf scenario's uit `cg-stack-voor-simulatie.md` §8 zijn de
toets: drie die bij de beslistabel eindigen (zonder bsn, zonder pasfoto,
bestuurder zonder rijbewijsnummer), één die toekent en één met een ronde
aanvulling en daarna een afwijzing. Elk scenario is een fixture (§3.5).
FUNDAMENT kan na het herstel van cg-test scenario 1, 2 en 4 op de echte keten
draaien en de objecten aanleveren.

Het argument van de demonstratie is telbaar: het aantal elementsoorten uit §1
tegenover wat de run laat zien.

## 7. Fasering

| Fase | Inhoud | Resultaat |
|---|---|---|
| 0 | Verkenning: de drie open punten uit §5 en de vorm van het M1-model. | Gedaan 12-11: §9. |
| 1 | Kern zonder scherm: store als log, interpreter, gaten met vulwijze en fixture, beslistabel, het formaat van §3.5, en CEL → JUEL en FEEL in de export (§3.6). Pure modules met tests. | Gebouwd 12/13-11: §10. De vijf scenario's slagen als test; de export geeft dezelfde XML als voorheen. |
| 2 | Scherm in de Studio: token op het diagram, gatenformulier, objectenlijst, log met terugspoelen. | Gebouwd 13-11: §10.5. Mark heeft het nog niet gezien. |
| 3 | Ketens en de semi-permanente store, correlatie. | Twee processen die elkaar via een bericht starten, over meerdere runs. |
| Later | Adapters naar echte stores, AI-vulling, de niet-lokale BPMN-constructies. | |

## 8. Vragen aan Mark

Bijgewerkt 12-11. Vraag 2 en 7 zijn besloten. Vraag 3 en 5 hebben een ander
advies gekregen door de review en de verkenning; vraag 8 tot 13 zijn nieuw en
open. Fase 1 bouwt op het advies waar Mark nog niet beslist heeft.

| # | Vraag | Advies of besluit |
|---|---|---|
| 1 | Mutaties: de bestaande taakeigenschappen hergebruiken, of meteen een algemene mutatie-eigenschap op de taak? | Eerst hergebruiken; uitbreiden op wat de demo mist. Zie ook vraag 8. |
| 2 | Condities: JUEL laten staan, er CEL naast zetten, of omzetten? | **Besloten (Mark 12-11): CEL in het model, JUEL als uitvoer van een transformatie** (§3.6). Het voorstel van FUNDAMENT (de JUEL-subset inlezen) blijft alleen als overgang voor modellen die nog niet zijn omgezet. |
| 3 | Referentie of kopie? | **Gewijzigd advies:** referentie binnen één afhandeling, ook over berichten tussen de eigen processen; kopie alleen naar een andere partij (§3.2). |
| 4 | Het log vormen naar registratie en wijziging: akkoord, of is dat te vroeg? | Akkoord, maar licht: alleen de vorm, geen bitemporele tijdlijnen in de simulatie. |
| 5 | De GPK-casus als demo, of een kleinere, verzonnen casus die los staat van GZAC? | **Aangescherpt advies:** GPK, op het model met drie processen (`inrichten-bpmn.bpmn-model.json`), geijkt tegen de vijf scenario's van FUNDAMENT. Wat niet in cm-termen te lezen is, staat in vraag 8, 10 en 11. |
| 6 | Waar komt het scherm: een eigen activiteit, of een stand van de bestaande BPMN-activiteit op de motor? | Een stand van de bestaande activiteit: het token hoort op het diagram dat je al open hebt. |
| 7 | FEEL in de beslistabel: de GPK-tabel heeft een invoerexpressie in FEEL. | **Besloten (Mark 12-11): CEL in het model, FEEL als uitvoer van een transformatie** (§3.6). Nog open, als detail: de cellen. Advies: die blijven een waarde of een lijst van waarden (`"bestuurder"`, `null, ""`); dat is geen expressie en het is in beide talen hetzelfde. |
| 8 | **ZGW-acties.** De servicetaken zijn zaak aanmaken, rol koppelen, document koppelen en zaakstatus zetten. Het cm kent geen Zaak, Rol of Document (§9.5). Hoe leest de simulatie ze? | Voor de demo als gat met een stub die een verwijzing teruggeeft (een url, zoals de stack), en de stap in het log met de naam van de actie. Dan blijft het cm zoals het is. Komen Zaak en Rol later in het cm, dan worden het maak en verbind. Alleen `dossierstatus` is nu al een echte overgang op de aanvraag. |
| 9 | **Het formulier bij een user task** (uitgangspunt 9). De taak noemt `aanvraag-beoordelen`. Dat is in het e-dienstmodel een dossierformulier (form.io voor GZAC). Formulier-neutraal bestaat alleen voor het formulier van de inwoner, en de voorbeeldweergave daarvan zit in de werkplaats (IMPRINT-CORE), niet in de Studio (§9.7). | Eerste versie: het gat leest de invulbare velden van het dossierformulier uit het e-dienstmodel (naam, label, keuzes, verplicht) en toont ze rudimentair naar type. Dat is wat een behandelaar invult, zonder nieuwe weergave. Formulier-neutraal ook voor dossierformulieren maken en de voorbeeldweergave in de Studio halen is een eigen stuk werk voor later. Akkoord, of is formulier-neutraal met de voorbeeldweergave juist het punt? |
| 10 | **Multi-instance.** "Documenten koppelen" loopt parallel over `documentUrls`. Multi-instance staat bij "nog niet". | Lezen als één stap die de actie per element uitvoert: één token, meerdere regels in het log. Geen tokens per element. |
| 11 | **Het dossier lezen en `${variabele}` buiten condities.** "Uitkomst vastleggen" zet `uitkomst` met `${documentDelegateService.findValueByJsonPointerOrDefault("/beoordeling", …)}`. Dat is GZAC-techniek, maar betekent: lees het veld `beoordeling` van het object van deze afhandeling. Het werpende event noemt zijn bericht met `${beoordelingsbericht}`. | In de lijn van vraag 2: in het model CEL (`uitkomst=beoordeling`), en de regelset voor GZAC schrijft de aanroep van de bean. Dat raakt `bpmnGzacRegels.js` en hoort bij de afspraak met FUNDAMENT. Tot dan herkent de simulatie dit ene patroon en leest het als cm-pad; elke andere aanroep van een bean is een gat. Een berichtnaam in `${…}` leest zij als variabele. |
| 12 | **Behandelvelden staan niet in het cm.** `beoordeling`, `beoordelingToelichting`, `beschikkingToelichting` en `afwijzingReden` zijn behandelvelden van het dossierschema; het e-dienstmodel zegt zelf dat het cm nog geen beoordeling of besluit kent. Dat schuurt met uitgangspunt 8. | Wachten op Beslissing en beschikking (verwacht 13-11 op main), main binnenhalen en dan bepalen of de antwoorden op deze gaten een Beslissing in het cm worden. Tot dan staan ze als losse velden bij de aanvraag in de store, zoals in het dossier. |
| 13 | **De envelop.** Het bsn voor de beslistabel staat in de envelop (`envelop:bsn`), niet in de aanvraag. | Het startobject is de cm-instantie; de envelopvelden zijn startvariabelen in het scenario (§3.5). De simulatie speelt de envelop zelf niet na. |

## 9. Bevindingen verkenning (fase 0, 12-11)

Gelezen op de branch `claude/simulatie-bpmn-dmn-cm` (main van 12-11). Gedraaid
is alleen §9.2: de condities zijn door de bestaande evaluator gehaald. De rest
is gelezen, niet uitgeprobeerd.

### 9.1 De vorm van het M1-procesmodel

Een BPMN-model op de motor is `{ model_naam, model: { elements, diagrams } }`.

- **Elementen** staan plat in `elements`, op id: `{ id, naam, elementType,
  compartimenten, data }`. Verbindingen zijn ook elementen, met `source` en
  `target`: `sequence-flow`, `message-flow`, `data-associatie`, `bevat`.
- **Eigenschappen** staan in `data`: `taakSoort`, `bpmnId`, `beslissing` en
  `resultaat`, `formulier`, `actie` en `actieDoel`, `dossierstatus`,
  `zetVariabelen`, `meervoudig`, `aangeroepenProces`; op events `soort`,
  `richting` en `bericht`; op de sequence flow `conditie` en `standaard`.
- **Een proces is een diagram.** Er is geen proceselement en geen
  `processRef`. Welke elementen bij een proces horen, volgt uit de `nodes` van
  het diagram; de `edges` van een diagram zijn leeg. De process-id staat niet
  in het BPMN-model maar in het e-dienstmodel (artefact van soort `bpmn`,
  `bron.diagram`). `bpmnArtefact.js` leest het zo; de simulatie kan hetzelfde
  doen.
- **Containers.** Pool en lane zijn elementen; lidmaatschap is een
  `bevat`-verbinding. Een pool is in de bestaande schrijver een deelnemer
  buiten het proces (`deelnemersBuitenProces` in
  `transformatie/bpmnXmlSchrijver.js`). In het behandelproces is dat de pool
  Klantportaal: een pool zonder uitvoerbaar proces, dus een gat met een stub.
- **Berichten** koppelen op naam: een werpend event met `bericht` start het
  proces met een message start event van die naam, of wekt een proces dat in
  een vangend tussen-event op die naam wacht. De naam mag een variabele zijn
  (`${beoordelingsbericht}`, gezet met `zetVariabelen`).
- `inrichten-bpmn.bpmn-model.json` heeft vijf diagrammen: de drie processen en
  twee schetsen (Oppakken verzoek, Kies zaak uit werkbak) die niet uitvoerbaar
  zijn. De simulatie neemt alleen de diagrammen die als proces zijn aangewezen.

### 9.2 De taal van de condities

Nu JUEL over procesvariabelen, niet over cm-paden:
`${ontvankelijkheid.ontvankelijk}`, `${!ontvankelijkheid.ontvankelijk}`,
`${uitkomst == 'toegekend'}` (ook `'afgewezen'` en `'aanvulling'`).

Zonder `${}` zijn ze alle geldige CEL voor `shared/celEvaluator.js`, en ze
geven de verwachte uitkomst (gedraaid, 12-11). Omzetten naar CEL (§3.6) is
voor deze modellen dus alleen de haakjes weghalen. Twee dingen om op te
letten:

- De evaluator geeft bij een onbekende variabele stil `null` (en `x == 'a'`
  wordt dan `false`). De simulatie moet daarom vóór het uitrekenen nagaan of
  de variabelen in de conditie bestaan; `parseCelExpressie` geeft de boom
  waarin dat te zien is. Bestaat een variabele niet, dan is dat een gat.
- JUEL die geen CEL is (`empty x`, `eq`, een aanroep van een bean) geeft een
  parsefout.

Procesvariabelen zijn dus nodig naast de store: `ontvankelijkheid` (uitkomst
van de beslistabel), `uitkomst` (de beoordeling) en `beoordelingsbericht`
(routering). De eerste twee zijn inhoudelijk een beslissing (vraag 12).

### 9.3 Waar de beslistabel staat

In het DMN-model, op het element van de beslissing: `data.beslistabel` met
`hitPolicy`, `inputs`, `outputs` en `rules` (de vorm van `dmn/dmnModel.js`).

- Elke invoerkolom heeft een `fieldRef.veldpad`: het cm-pad van het veld
  (`Gehandicaptenparkeerkaartaanvraag.GpkAanvraagKaart.soort`), of
  `envelop:bsn` voor een envelopveld. De simulatie kan de invoer dus in
  cm-termen uit het object halen, zonder de omweg via dossier en JSON-pointer
  die `dmnArtefact.js` voor GZAC maakt.
- Eén kolom heeft daarnaast een `expressie` in FEEL:
  `bijlagen != null and (some b in bijlagen satisfies b.naam = "pasfoto")`.
  De evaluator leest dat niet (parsefout); de CEL-vorm
  `bijlagen != null && bijlagen.exists(b, b.naam == "pasfoto")` wel.
- De cellen zijn van de eenvoudigste soort: leeg (elke waarde), een waarde
  (`"bestuurder"`, `true`, `false`) of een lijst (`null, ""`).
- Hit policy FIRST, uitvoer `ontvankelijk` en `reden`. De tabel staat
  uitgeschreven in `cg-stack-voor-simulatie.md` §4.

### 9.4 Berichttype en Procescontract

Alleen in de bpmn.io-activiteit: `bpmnBinding.js` en `procesContract.js` staan
in `web/vite/src/bpmn/` en worden daarbuiten niet gebruikt. Het motor-profiel
heeft ze niet; een bericht is daar een naam. De eerste versie heeft ze niet
nodig (referentie binnen de afhandeling, §3.2). Ze komen terug bij de kopie
naar een andere partij (fase 3): daar leggen ze vast wat over de grens gaat.

### 9.5 Het cm als typebron

`inrichten-domeinen-v3.json` is het cm van de casus (V3). De typen: Partij,
Partijrol, Referentielijst, Aanvraag, Aanvraagtype, Gehandicaptenparkeerkaart,
GehandicaptenparkeerkaartAanvraag (erft van Aanvraag) en MedischAdvies, elk
met gegevenselementen. **Zaak, Rol, Document, Beslissing en Beschikking staan
er niet in** (vraag 8 en 12).

Typen en velden zonder scherm: `modelpicker/pickerTypesUitV3.js` met
`fieldRefsOpUuid` (zo doet `dmnArtefact.js` het al, op het V3-model).
`celContext.js` werkt op het diagrammodel van de editor en
`typeMetaByTypenaam` op het schema van een draaiend register; beide liggen
verder van de simulatie af.

### 9.6 De reikwijdte van de CEL-subset

Wel: tekst, getal, `true`/`false`/`null`; paden; `+`; `==`, `!=`, `<`, `<=`,
`>`, `>=`; `&&`, `||`, `!`; `? :`; `filter`, `map`, `exists`, `all`, `size`;
indexeren; `string()`, `int()`, `size()`, `leeftijd()`.

Niet: `-`, `*`, `/`, `in`, tekstfuncties, datums vergelijken anders dan als
tekst. Voor de GPK-casus is niets daarvan nodig. De evaluator hoeft voor de
demo niet uitgebreid te worden, en `celexpr/` (Go) blijft dus ongemoeid.

### 9.7 Het formulier bij een taak

- De user task noemt het formulier op identifier (`formulier:
  "aanvraag-beoordelen"`). Dat is in `gpk-edienst.json` een `dossierformulier`
  met panelen; het invulbare paneel noemt de velden met label, keuzes en
  verplicht. De typen staan bij de `behandelvelden` van het dossierschema.
- `formulier-neutraal` wordt alleen gemaakt bij een artefact van soort
  `formulier` (het formulier van de inwoner; `inrichtingsBundel.js`), niet bij
  een dossierformulier.
- De voorbeeldweergave die formulier-neutraal leest zit in de werkplaats
  (IMPRINT-CORE, `fromNeutraal()`), niet in deze repo.

Zie vraag 9.

### 9.8 Wat dit verandert aan de keuzes

| Keuze of vraag | Verandering |
|---|---|
| §3.1 mutaties | `dossierstatus` is een overgang; de vier ZGW-acties hebben geen cm-type om op te werken (vraag 8). |
| §3.2 referentie of kopie | Grens bij de partij in plaats van bij de pool (vraag 3). |
| §3.3 correlatie | De sleutel is het startobject; geen sleutelpad nodig in de demo. |
| §3.6, vraag 2 en 7 | CEL in het model, JUEL en FEEL als uitvoer (besluit Mark). |
| §4 afbakening | Erbij: tussen-events met een bericht, procesvariabelen, fixture en vulwijze, het formaat van §3.5, de omzetting in de export. |
| Nieuw | Vraag 8 tot 13. |

## 10. Stand na fase 1 (13-11)

Gebouwd op de adviezen van §8, behalve waar Mark besloten heeft (vraag 2 en
7). De kern (§10.1 tot §10.4) is een stel pure modules met tests
(`web/vite/src/simulatie/`, en `transformatie/celOmzetting.js`); het scherm
staat in §10.5.

### 10.1 Wat werkt

| Onderdeel | Waar | Wat |
|---|---|---|
| Omzetting | `transformatie/celOmzetting.js` | `celNaarJuel` en `celNaarFeel`; aangesloten op `bpmnXmlSchrijver` (conditie) en `dmnXmlSchrijver` (invoerexpressie). |
| Store | `simulatie/store.js` | Het log en de toestand die eruit volgt. Alles staat in het log, ook tokens, procesvariabelen en gaten; terugspoelen is het log afkappen. |
| Procesmodel | `simulatie/procesmodel.js` | Een proces is een diagram; de process-id komt uit het e-dienstmodel. |
| Beslistabel | `simulatie/beslistabel.js` | Invoer via cm-veld of CEL, cellen als waarde of lijst, FIRST en UNIQUE, DRD als boom. |
| Gaten | `simulatie/gaten.js` | Vier aarden (taak, partner, dienst, expressie); met de hand, willekeurig met een zaadje, of uit de fixture; de vulwijze per run, per aard en per gat. |
| Interpreter | `simulatie/simulatie.js` | `start`, `stap`, `loop`, `vul`, `stand`, `spoelTerug`, `toestand`. |
| Formaat | `simulatie/formaat.js` | M1-set met hashes, scenario, run; en welke delen van een M1-set veranderd zijn. |
| Scenario's | `simulatie/fixtures/gpk-scenario-1…5.json` | De vijf van FUNDAMENT, met verzonnen gegevens. |

De fixtures `inrichten-bpmn.bpmn-model.json`, `gpk-processen.bpmn-model.json`
en `gpk-beslissingen.dmn-model.json` zijn omgezet naar CEL. De XML die de
export eruit maakt is vergeleken met die van vóór de omzetting: gelijk, voor
alle processen en voor de beslistabel.

De vijf scenario's lopen zonder stoppen door en geven het verwachte einde.
Scenario 4 (toegekend) is 23 stappen over drie procesinstanties, scenario 5
(aanvulling, daarna afgewezen) 32 stappen over vier.

### 10.2 Keuzes die bij het bouwen gemaakt zijn

Deze volgen niet uit §8 en staan hier zodat Mark ze kan terugdraaien.

1. **De vorm van het object.** Het startobject heeft de vorm van het
   objecttype: de velden plat (`soort`, `bijlagen[]`, `eerdereKaart`), zoals
   `data` in de envelop en zoals de invoerexpressie van de beslistabel ze
   noemt. Niet de vorm van het cm met gegevenselementen
   (`GpkAanvraagKaart.soort`). De kolom van de beslistabel bindt wel aan het
   cm-pad, maar de simulatie leest het veld op zijn laatste naam. Zie vraag 14.
2. **Procesvariabelen horen bij de afhandeling**, niet bij één proces. In de
   stack geeft elk bericht alle variabelen door; het resultaat is hetzelfde.
3. **Een ZGW-actie is een mutatie `extern`**: de actie, het doel en de
   verwijzing die de stub teruggeeft. Het staat in het log en in de toestand,
   maar is geen cm-object (vraag 8).
4. **Multi-instance** is één stap met een regel per element (vraag 10).
5. **Een bericht zonder ontvanger blijft liggen** tot een vangend event het
   ophaalt. Wacht een token op een bericht dat niemand werpt, dan is de run
   vastgelopen.
6. **Een element dat de simulatie niet naspeelt** (inclusieve gateway,
   event-based gateway, boundary event) laat het token staan: de run eindigt
   als vastgelopen, met de reden erbij. Een timer of signaal als tussen-event
   loopt door zonder te wachten.
7. **Een open gat van een afgebroken proces vervalt.**

### 10.3 Wat de demo liet zien dat ontbreekt

- **De uitkomst is geen object.** Na scenario 4 ligt er een aanvraag met
  losse velden (`beoordeling`, `beschikkingToelichting`) en twee variabelen
  (`ontvankelijkheid`, `uitkomst`). Een Beslissing en een Beschikking als
  cm-objecten ontbreken; de Gehandicaptenparkeerkaart zelf, die het cm wel
  kent, wordt nergens gemaakt. Dit is vraag 12, en het is het duidelijkste gat
  tussen "een stapeltje objecten met state" en wat de run nu oplevert.
- **De status van de aanvraag verandert alleen bij "niet in behandeling".**
  Zo doet de stack het ook; in de simulatie valt het op dat een toegekende
  aanvraag aan het eind nog `ingediend` is.
- **De zaak bestaat alleen als verwijzing** (vraag 8).
- **`zetVariabelen` en de berichtnaam zijn nog JUEL** in het model (vraag 11).
- **De BPMN-import** (`bpmnXmlImport`) zet een conditie uit XML als JUEL in het
  model. Dat blijft werken (de schrijver laat `${…}` door, de simulatie leest
  het), maar een geïmporteerd model is dus niet meteen CEL. JUEL → CEL bij de
  import is niet gebouwd.

### 10.4 Nieuwe vraag

| # | Vraag | Advies |
|---|---|---|
| 14 | **De vorm van een object in de store**: plat zoals het objecttype (nu), of zoals het cm met gegevenselementen? | Plat laten zolang de beslistabel en de formulieren die namen gebruiken; het is de vorm waarin FUNDAMENT de objecten van de echte keten kan aanleveren. De cm-vorm wordt nodig bij de adapter naar een register (later). |

### 10.5 Fase 2: het scherm (13-11)

Mark gaf op 13-11 aan dat fase 2 mocht beginnen zonder op zijn antwoorden te
wachten. Het scherm is een onder-dock van de BPMN-activiteit op de motor
(vraag 6): `studio/activities/simulatiePaneel.jsx`, aangesloten in
`bpmnMotorActivity.jsx`. Het paneel is alleen weergave; de run zelf is de kern
van fase 1.

![Het token op de gateway, na de beslistabel](img/2026-11-13-simulatie-token.png)

![Een open gat: de taak Aanvraag beoordelen](img/2026-11-13-simulatie-gat.png)

**Het token op het diagram.** Het element waar een token staat krijgt een rand
en een bolletje rechtsboven; staan er meer tokens (na een parallelle gateway),
dan staat het aantal in het bolletje. De kleur zegt hoe het token erbij staat:

| Kleur | Betekenis |
|---|---|
| indigo, met een pulserend bolletje | kan verder: de volgende stap is hier |
| oranje | wacht op invoer: een open gat |
| cyaan | wacht op een bericht, een ander proces of een samenkomst |
| rood | vastgelopen |

Waar het token geweest is blijft een dunne cyaan rand staan, en de flows die
het gevolgd heeft kleuren mee. Met "volg het token" aan opent de Studio het
diagram van het proces waar het token heen gaat.

De motor weet niets van de simulatie. Het paneel zet een stijlblok neer dat de
canvas-nodes aanwijst op hun element-id (`simulatie/weergave.js`). Dat kost
geen wijziging in de motor; het is ook de reden dat het token op een element
staat en niet over een lijn beweegt.

**Het paneel**, drie kolommen:

1. Bediening (Start, Stap, Doorlopen, Terug, Stop), de stand in woorden, het
   open gat met een formulier naar de verwachte velden, en vóór de start het
   scenario als JSON met de vijf GPK-scenario's als voorbeeld.
2. De objecten met hun state, de procesvariabelen en wat er buiten het cm
   gebeurd is.
3. Het log; een klik op een regel spoelt daarheen terug.

**De M1-set in het scherm.** Het proces is het BPMN-model van de activiteit.
De beslistabellen komen uit de DMN-profielen van het project. Het
e-dienstmodel is een bestand dat je kiest. "GPK-voorbeeld laden" zet de drie
GPK-processen in de activiteit, met beslistabel, e-dienstmodel en scenario 4.

**Getoetst** met `tests/e2e/63-studio-simulatie.spec.js`: voorbeeld laden,
starten, het token op startevent en gateway, doorlopen tot het gat bij Aanvraag
beoordelen (het diagram volgt naar het beoordelingsproces), een verplicht veld
dat geweigerd wordt, invullen, doorlopen tot Beschikt, en terugspoelen.

**Wat het scherm nog niet heeft.**

- De startdialoog is JSON, geen formulier naar het cm-type. De opdracht vroeg
  "kies een cm-type, vul het object met de hand of willekeurig".
- De vulwijze stel je in het scenario in (JSON), niet met knoppen.
- Een scenario of run bewaren kan niet (bewust, §3.5); kopiëren uit het
  tekstvak wel.
- Staan er twee gaten tegelijk open, dan toont het paneel het eerste.
- Het onder-dock staat standaard open bij elke BPMN-diagram, ook als je niet
  simuleert. Inklappen onthoudt de Studio.

## Referenties

- W.M.P. van der Aalst, workflow nets en soundness: de drie eisen achter §2.2.
- BPMN 2.0 beschrijft procesgedrag in termen van tokens; een parallelle join is
  een Petri-net-transitie met meerdere invoerplaatsen.
- bpmn-js-token-simulation (bpmn.io, MIT): tokens op een diagram, zonder data.
  Niet gebruikt, wel het bekende voorbeeld van wat hier met objecten erbij
  bedoeld is.
