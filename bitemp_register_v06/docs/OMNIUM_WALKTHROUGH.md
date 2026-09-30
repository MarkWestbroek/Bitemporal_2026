# Omnium Studio: eerste kennismaking

Een leesroute en oefening voor iemand die de repository voor het eerst opent.
Bijgewerkt op 2026-09-30. De codebasis is een breed proof of concept; een werkende
editor is niet hetzelfde als een productiegeschikt register of een verliesvrije
uitwisseling met iedere externe modelleertool.

Voor de technische beoordeling en prioriteiten: zie de
[integrale review](reviews/2026-09-30-omnium-integrale-review.md).
De lokale Studio-shell en adaptertests zijn daarin gecontroleerd. Deze walkthrough
is nog niet als volledige clean-clone-installatie of gebruikers-E2E afgetekend.

## 1. Wat Heb Ik Voor Me?

**Omnium Studio** is de modelwerkbank. Het **bitemporele register** is een van de
uitvoerbare toepassingen van het canonieke model. Je kunt dus over modelleren en
uitwisseling praten zonder meteen een register te installeren of te publiceren.

| Begrip | Betekenis in dit project |
|---|---|
| MMM / M3 | de regels waarmee modeltalen/profielen beschreven worden; eigen implementatie, niet bewezen volledig OMG MOF-conform |
| Profiel / M2 | een modeltaal met elementtypen, relaties, eigenschappen en weergaveregels, bijvoorbeeld UML of ArchiMate |
| Model / M1 | jouw begrippen en relaties, bijvoorbeeld Persoon, Adres en WoontOp |
| Data / M0 | concrete personen en adressen in een register dat dat model uitvoert |
| Diagram | een weergave van een deel van een model; hetzelfde element kan op meerdere diagrammen staan |
| Canoniek model | de domeinbetekenis voor de uitvoeringsketen, met entiteiten, gegevenselementen, relaties en tijd |
| V3 JSON | uitwisselformaat voor het canonieke model; niet het universele bestandsformaat van alle profielen |
| MetaRegistry | de runtime-metadata waarmee de Go-applicatie routes, schemas en generieke verwerking opbouwt |

Omniums woord "profiel" is breder dan een formeel UML Profile. Een ArchiMate-model
is ook niet automatisch een canoniek registermodel. Een transformatie maakt de
betekenisvolle mapping expliciet.

## 2. Lees In Deze Volgorde

1. [Hoofdoverzicht](../../README.md): product en modelgedreven keten.
2. [Studio](STUDIO.md): activiteiten, projectbrowser en diagrammotor. Het document
   bevat ook historische uitbreidingen; de review geeft de actuele kanttekeningen.
3. [Architectuuroverzicht](diagrammen/architectuur-overzicht.md): samenhang tussen
   werkbank, modellen, API en opslag.
4. [Hub + Data](../ONTWERP_DATA_PATTERN.md): alleen nodig als je de registerruntime
   wilt begrijpen. Begin hier niet als je uitsluitend wilt modelleren.
5. [Codegen](CODEGEN.md) en [devloop](DEVLOOP.md): pas bij publiceren/uitvoeren.

Lees niet eerst alle chatlogs en planbestanden. Die verklaren ontwerpkeuzes, maar
zijn geen complete of altijd actuele gebruikershandleiding.

## 3. Lokaal Beginnen

De actieve code staat in `bitemp_register_v06/`. Oudere versies zijn archief.
Gebruik Go passend bij [go.mod](../go.mod) (momenteel 1.25.0) en een voor Vite 8
ondersteunde Node-versie, bijvoorbeeld Node 22.12 of hoger binnen een ondersteunde
release. PostgreSQL is nodig voor de registerruntime, niet voor pure adaptertests.

**Gebruik een eigen lege ontwikkel-/testdatabase.** De API maakt bij startup
tabellen aan en voert setup/migratiecode uit. Richt deze oefening niet op een
bestaand productieregister. Bestaande lokale configuratie niet overschrijven.

Vanuit de repository-root, in PowerShell:

```powershell
Set-Location bitemp_register_v06
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Vul lokaal de database- en overige instellingen in volgens het voorbeeldbestand
en de [deploymentdocumentatie](../docker.md). Deel geen credentials in een issue
of chatexport. Een demo met auth-uit is geen productieconfiguratie.

Start de API vanuit de v06-map:

```powershell
$env:PORT = '8082'
go run .
```

Gebruik `go run .`, niet `go run main.go`: package main bevat meerdere bestanden.
De normale build bevat geen devtools-endpoints. Alleen voor de expliciete
[devloop](DEVLOOP.md) is de build-tag `devtools` nodig.

Start in een tweede terminal, vanuit de repository-root:

```powershell
Set-Location bitemp_register_v06/web/vite
npm ci
npm run dev
```

Open de URL die Vite meldt met pad `/viz/react/studio.html`; standaard is dat
`http://localhost:5174/viz/react/studio.html`. Gebruik bij een bezette poort de
werkelijk gemelde poort. Stel waar nodig de API-basis-URL in op je lokale API.
Maak de Vite-devserver niet publiek: zijn Studio-ontwikkelendpoints kunnen
profiel-, vorm- en icoonbestanden schrijven.

## 4. Eerste Oefening: Een Bestaand Model Begrijpen

Doel: onderscheid leren tussen model, diagram en uitwisselformaat, zonder
registerdata of schema's te wijzigen.

1. Open **Modelleren**. Als de activiteit niet in de balk staat, gebruik **Ga naar**
   of het opdrachtenpalet. Activiteiten/favorieten kunnen per browser verschillen.
2. Maak een aparte oefenmap in de projectbrowser. Werk niet in een bestaand model.
3. Open voor die map de import/transformatiefunctie en kies de ArchiMate Exchange-
   import. Gebruik het meegeleverde
   [architectuurmodel](diagrammen/omnium-studio-architectuur.archimate.xml).
4. Lees de diagnostics voordat je het resultaat beoordeelt. Open de geimporteerde
   views en herken werkbank, runtime en deployment. Niet-ondersteunde details mogen
   niet ongemerkt als volledig ondersteund worden beschouwd.
5. Selecteer een element en verander in de oefenkopie de naam. Bekijk een andere
   view waarin datzelfde element voorkomt. De naam hoort modelbreed mee te veranderen;
   de positie hoort per diagram te blijven bestaan.
6. Probeer undo/redo en exporteer een lokale werkkopie. Noteer het exacte formaat:
   een Omnium-mapbestand is niet hetzelfde als ArchiMate Exchange voor Archi.
7. Bewaar de export buiten de browsercache. De review beschrijft nog open problemen
   met dirty-status, conflicten en map-import; gebruik dit dus nog niet als enige
   opslagplek voor waardevolle modellen. Een map-export bevat bovendien nog niet
   alle kruisverbanden en projectcontext.

**Verwachte uitkomst:** je kunt aanwijzen welke zaken semantische elementen zijn,
welke een diagramweergave zijn en welke door een specifieke adapter worden vertaald.
Deze oefening bewijst geen volledige Archi-terugreis; Exchange-export ontbreekt nog.

## 5. Tweede Oefening: Van Model Naar Contract

Open het canonieke model en de OAS-activiteit naast elkaar. Bekijk de beschikbare
OpenAPI-import naar het canonieke profiel: die leest `components.schemas` en maakt
expliciete aannames. Paths/operations worden daarbij bewust niet meegenomen.

Vergelijk een entiteit, een gegevenselement en een verwijzing met hun API-vorm.
Vraag telkens: welke informatie is puur domeinbetekenis, welke is een API-keuze,
en welke is registerplumbing? Een plat schema kan bijvoorbeeld niet vanzelf
vertellen of een adres een hub met geversioneerde data moet worden.

Publiceren is een aparte handeling. Het opslaan van een schema-versie verandert
niet automatisch de draaiende Go-types. Lees voor de roundtrip naar code eerst
[CODEGEN](CODEGEN.md) en [DEVLOOP](DEVLOOP.md). Doe geen rebuild tijdens een gewone
modelleerproef op een gedeelde omgeving.

## 6. Het Register Begrijpen

De schrijfhandeling heet **registratie** en bevat wijzigingen. Correctie en
ongedaanmaking maken de audit trail niet onzichtbaar. Formele tijd beantwoordt
"wat was geregistreerd op dat moment?"; materiele tijd "wanneer geldt het in de
werkelijkheid?". Het tijdstip van commit en dat van de registratie zijn niet
automatisch hetzelfde begrip.

Het huidige REST-contract gebruikt `peiltijdstip=<RFC3339>` voor formele tijd en
`t=<integer>` als synthetische demo-afkorting. Materiele aanvang/einde kunnen al
worden gemodelleerd; generiek queryen op een materiele peildatum is nog vervolgwerk.
Zie de [review](reviews/2026-09-30-omnium-integrale-review.md) voor de resterende
snapshot- en GraphQL-tijdreisbeperkingen.

De [regressiehandleiding](REGRESSIETEST.md) is een goede uitvoerbare toelichting
op registratie, correctie en ongedaanmaking. Let op: de integratiesuite wist en
herbouwt haar database. Gebruik uitsluitend haar dedicated testomgeving.

## 7. Waar Werk Ik Aan?

| Taak | Begin hier |
|---|---|
| Studio-shell en menu's | [studio](../web/vite/src/studio/StudioShell.jsx) |
| Profielcontracten | [typeRegistry](../web/vite/src/diagramcore/types/typeRegistry.js) |
| Elementen, diagrammen en undo | [createDiagramStore](../web/vite/src/diagramcore/model/createDiagramStore.js) |
| Een nieuwe import/transformatie | [transformatieRegistry](../web/vite/src/studio/activities/transformatieRegistry.js) en een bestaande pure adapter |
| Registratiegedrag | [registration_core](../handlers/registration_core.go) |
| Nieuwe prioriteiten | [integrale review](reviews/2026-09-30-omnium-integrale-review.md) en [backlog](BACKLOG.md) |

Begin met een kleine keten die je kunt testen. Meer diagramtypen toevoegen is
eenvoudiger dan verliesvrije uitwisseling, gedeelde opslag en consistente uitvoering;
juist die laatste drie bepalen of een ander op de werkbank kan vertrouwen.