# Demo-project: Omnium demo — gemeente Waterstede

Datum: 2026-11-16 · Gemaakt door Claude (sessie DEMO-PROJECT) op verzoek van Mark, voor nieuwe
gebruikers van Omnium Studio. Alles is verzonnen: de gemeente Waterstede bestaat niet.

Het project laat één casus zien, de **evenementenvergunning**, in elke taal (M2-profiel) die de
Studio kent: 28 diagrammen in 26 talen, 42 kruisverbanden en een simulatie die werkt.

## Waar het staat

- **Op app.omnium-ide.nl** (eigenaar `claude`, id `0d3a5c1e-…-a501`; iedereen leest, Mark schrijft).
  **De server is de bron**: Mark en Claude bewerken het dáár (Studio, of de MCP-tool
  `model_wijzigen`). Ophalen: Studio → *Project → Van server ophalen…*.
- `omnium-demo-waterstede.studio-project.json`: de stand als werkbestand (`studio-project` v3),
  voor een andere instantie (*Project → Importeer project…*) en als reserve. Na wijzigingen op de
  server haal je hem opnieuw op met `naar-server.mjs … van-server`; het bestand volgt de server,
  niet andersom.
- Het is een demo, geen speelplaats. Een speelplaats waar iedereen in mag schrijven is een kopie
  onder een andere naam: `naar-server.mjs <basis> <token-env> nieuw "Omnium speelplaats"` (nog niet
  gedaan).

## Wat erin zit

| Map | Taal | Diagram |
|---|---|---|
| 1 Dienstverlening | Use case | Evenementenloket Waterstede |
| 2 Proces | BPMN | Evenementaanvraag behandelen · Veiligheidsadviezen inwinnen · Evenement op de kalender zetten |
| | State machine | Levensloop van een evenementaanvraag |
| 3 Besluiten | DMN (DRD + beslistabellen) | Risicoklasse en leges |
| 4 Gegevens | Canoniek model | Evenementen (canoniek) |
| | Formulier | Aanvraagformulier evenement |
| 5 Koppelvlakken | OAS 3.1, GraphQL, Sequence | Evenementen-API · Evenementen (GraphQL) · Aanvraag indienen via de API |
| 6 Architectuur | ArchiMate | Evenementenloket in lagen |
| 7 Toegang | Toegangsregels | Toegang tot evenementaanvragen |
| 8 Meer talen (een map per taal) | Activity, Requirements, Object, UML, Composite structure, Communication, Component & deployment, SysML, Business (EP), CMMN, MIM, ERD, SHACL, XML Schema, WSDL | elk één klein voorbeeld in hetzelfde domein |

**Over talen heen** (activiteit Koppelingen, en dubbelklik op een element met ⧉):

- de rode draad: use case *Bepaal de risicoklasse* ← BPMN-taak *Bepaal risicoklasse* ↔ DMN-beslissing
  *Risicoklasse* ← invoergegeven *Evenementaanvraag* ← cm-entiteit *Evenementaanvraag* → OAS-schema,
  GraphQL-type, ERD-tabel en SHACL-shape;
- het BPMN-data-object *Aanvraag* heeft de cm-entiteit als type (daaruit volgt de tracering);
- ArchiMate verwijst door naar de uitwerking: het bedrijfsproces naar het BPMN-diagram, de
  applicatie-interface naar het OAS-diagram, het bedrijfsobject naar het canonieke model.

De lijst staat leesbaar in `plannen/09-verbanden.ops.mjs`.

## De simulatie

Activiteit **Simulatie** (groep Modelleren) loopt het BPMN-model van het project door met de
beslistabellen uit het project; er is geen e-dienstmodel nodig. Het scenario staat (nog) niet in het
project: plak een van de drie bestanden uit `scenarios/` in het tekstvak *Scenario*.

| Scenario | Wat je ziet |
|---|---|
| `waterstede-1-buurtfeest.json` | 80 bezoekers → klasse A → melding bevestigd, in zes stappen |
| `waterstede-2-jaarmarkt.json` | wegafsluiting → klasse B, leges 150 → verleend → het signaal *vergunning verleend* start het kalenderproces |
| `waterstede-3-festival.json` | 6500 bezoekers → klasse C → call activity met twee parallelle adviezen → de run stopt bij *Beoordeel de aanvraag*: vul zelf `{"besluit": "verlenen"}` of `"weigeren"` in |

Zonder e-dienstmodel toont de simulatie de objecten als JSON (geen cm-vorm of kaart) en heeft een
user task geen formuliervelden: je vult vrije JSON in. Het data-object *Aanvraag* op het diagram
toont wel het object van de run, en de toets *Lijnen en objecten* is schoon.

`node docs/demo-project/simulatie-test.mjs [--log]` loopt de drie scenario's door met dezelfde kern
als het scherm (`web/vite/src/simulatie/`) en toetst einde, status, leges, de lijnen en het
startobject.

## Hoe het gemaakt is

Offline, langs dezelfde weg als `model_wijzigen` (plan → controle tegen de modeltalen → operaties),
tegen een server in het geheugen. Vanuit `bitemp_register_v06/` (met `npm install` in `web/vite`):

```
node docs/demo-project/bouw.mjs            # plannen/ → het werkbestand; meldt wat niet gedaan is
node docs/demo-project/simulatie-test.mjs  # de drie scenario's
node docs/demo-project/teken.mjs <map>     # elk diagram als SVG via render-svc (poort 8095)
node docs/demo-project/kijk.mjs            # overzicht: taal, diagram, aantal, maat
node docs/demo-project/naar-server.mjs <basis> <token-env> nieuw|van-server [naam]
```

- `plannen/NN-*.json`: een plan zoals `model_wijzigen` het krijgt, plus `na` voor wat een plan niet
  kan (een tweede compartiment met velden, eigenschappen buiten de samenvatting van de taal, plaats
  en maat van een knoop).
- `plannen/NN-*.ops.mjs`: rechtstreekse operaties: de beslistabellen (03b), het signaal en het type
  van het data-object (04b), de kruisverbanden en het doorklikken (09).

**Bijwerken gaat op de stand van de server** (`werk-bij.mjs` met een script uit `bijwerken/`): het
script krijgt de huidige stand, geeft operaties terug, die worden droog nagespeeld tot
`voorbeeld.studio-project.json` (te tekenen met `teken.mjs <map> docs/demo-project/voorbeeld.studio-project.json`)
en gaan pas met `toepassen` naar de server. `bijwerken/01-review-mark.mjs` is de review van Mark van
16-11: submappen per proces, koppelvlak en taal, maat naar inhoud met een nieuwe opstelling,
kraaienpoten in het ERD, SHACL-regels met parameters, de regels van de beslistabellen als notitie
op het DRD, en het festival heet Rietpop (Dijkpop bleek een bestaand festival).

**De plannen zijn de eerste bouw, niet de bron.** Na een wijziging op de server lopen ze achter; ze
blijven staan als voorbeeld van hoe je een project uit plannen opbouwt. Opnieuw bouwen en als
*nieuw* project neerzetten kan (andere naam), over het bestaande heen niet.

## Wat we onderweg leerden

- Element-ids zijn alleen binnen een taal uniek (`mcp_evenementaanvraag` bestaat in zeven talen);
  een kruisverband op id via een plan is dan niet eenduidig. Vandaar de verbanden als operaties.
- De opstel-acties rekenen met een standaardmaat (160 × 70). Elementen met veel velden worden in de
  Studio hoger en overlappen dan; de kerndiagrammen zijn daarom met `posities` geplaatst.
  `gql-lagen` is in Node niet beschikbaar.
- De toets *Lijnen en objecten* wil een schrijvende lijn naar élk data-object van het type op het
  diagram; twee data-objecten van hetzelfde type (*Aanvraag [ingediend]* en *[afgehandeld]*) geven
  dus altijd meldingen. Het demo-model heeft er één.
- De bouw geeft elke knoop een vaste maat (160 × 70); een element met velden is dan te klein.
  Zonder `size` neemt de knoop de maat van zijn inhoud aan (in de Studio: *Maat aanpassen aan
  inhoud*); de render-sidecar tekent die natuurlijke maat ook, dus de opstelling is in Node te
  beoordelen.
- In SHACL zijn de pijlen afgeleid uit de regels (`sh:class`, `sh:node`); een los getekende
  `verwijzing` wordt niet getoond. Zet de parameter op de regel en roep `leidAf` aan.
- ERD-kardinaliteiten zijn `een`, `nul-of-een`, `een-of-meer`, `nul-of-meer`; `0..*` tekent niets.
- Een DRD-beslissing op de motor draagt `data.beslistabel` (de simulatie rekent ermee), maar
  Modelleren toont of bewerkt die tabel niet. Tot dat er is staan de regels als notitie naast de
  beslissing.
- De MCP op Marks pc draait uit de hoofdclone; staat die op een oude branch, dan mist hij talen
  (hier SHACL).

## Open

- **Scenario's.** Nu moet een nieuwe gebruiker het scenario plakken. Besluit Mark 16-11: voorlopig
  de Waterstede-scenario's naast de GPK-voorbeelden in de keuzelijst (gevraagd aan sessie
  SIMULATIE, die ook bouwt aan scenario's in het project zelf).
- De cm-vorm van het startobject zonder e-dienstmodel (rechtstreeks op de entiteit uit `start.type`).
- De opstelling van CMMN, state machine en toegangsregels kan beter; dat gaat het snelst met de
  hand in de Studio.
- Van het toegangsregels-diagram naar de Toegangsspraak-tekst springen: vraag ligt bij OMNIUM-UI.
- Een weergave van de beslistabel op een DRD-beslissing in Modelleren.
