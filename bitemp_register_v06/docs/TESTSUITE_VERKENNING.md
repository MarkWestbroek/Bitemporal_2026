# Testsuite: verkenning, keuze en vervolg

*2026-09-18, branch `chore/be-code-review`. Hoort bij [REGRESSIETEST.md](REGRESSIETEST.md), dat
beschrijft hoe het werkt; dit document beschrijft **waarom het zo is** en **waar het heen kan**.*

## De vraag

Consequent regressie, maar ook load en performance kunnen testen, met een uitgebreidere
testsuite-editor: testcases (tot nu toe in Go-code en replay-bestanden) **bewerkbaar**, de
**volgorde verschuifbaar**, en **een selectie of alles kopiëren naar een nieuwe test**. Op termijn
testcases koppelen aan requirements of use cases die in Studio als UML beheerd worden. En: als er
open source al iets bestaat dat dit kan, niet opnieuw bouwen.

## Wat er al bestaat

| Tool | Wat het is | Sterk in | Past hier niet vanwege |
|---|---|---|---|
| **Bruno** (MIT) | Desktop-API-client; collecties als tekstbestanden (`.bru`) in git; CLI `bru run` | Editor-ervaring: requests bewerken, ordenen, dupliceren, mappen; asserts en scripts | Draait tegen een *draaiende* API; kent geen DB-reset, seed, query-teller of env-wissel per test; load zit er niet in |
| **Hurl** (Apache-2.0) | Platte tekst: request + `[Captures]` + `[Asserts]`, één binary; JSONPath; `--test`, parallel en herhalen | Leesbare, diffbare functionele tests; CI | Geen editor; geen setup-haken; bitemporele "actieve voorkomen"-selectie is omslachtig in JSONPath |
| **Step CI** | YAML-workflows, functioneel én load uit dezelfde definitie | Eén formaat voor beide | Zelfde beperking: black-box, geen in-process haken; geen editor |
| **k6** (AGPL-3.0) | Loadtests als JavaScript; vus, scenario's, `thresholds` | Dé standaard voor load en performance, ook gedistribueerd | Alleen load; tests zijn code, geen bewerkbare data |
| **Artillery** | Loadtests als YAML (+JS) | Laagdrempelige load | Idem |
| **Postman / newman** | Collecties + CLI | Bekend; er ligt al een np-loc-collectie | Collectie-JSON is onprettig in git; zelfde black-box-beperking |
| **Kiwi TCMS, TestLink, Squash TM** | Testmanagement: testcases, testplannen, runs, koppeling aan requirements | Traceability en rapportage | Beheren *beschrijvingen* van tests, voeren geen API-tests uit; eigen server + database; zwaar voor één ontwikkelaar |

## De afweging

Drie dingen maken dit register anders dan een gemiddelde REST-API, en precies die drie kan geen
van de black-box-tools:

1. **Herhaalbaarheid vraagt een bekende begintoestand.** Registratie-id's en (synthetische)
   tijdstippen lopen op; een bitemporele test als "NP=2 bestaat niet op t=0, wel op t=1" klopt
   alleen na *reset + seed via replay*. De in-process runner doet dat in ~1 seconde.
2. **Sommige bewijzen zitten ónder de HTTP-laag.** De N+1-guard telt SQL-queries per request
   (`max_queries`); auth-sc's zetten `AUTH_ENABLED` alleen voor dat ene sc (`env`). Van buitenaf
   is dat niet te doen.
3. **Bitemporele responses vragen een eigen padtaal.** "De achternaam van het actieve voorkomen"
   is `namen[afvoer=null].data[afvoer=null].achternaam`. Dat is in de eigen runner één filter.

Daartegenover: wat de gevraagde editor moet kunnen (bewerken, ordenen, kopiëren) is klein zodra
de testcases **data** zijn in plaats van Go-code. En wat k6 en Hurl goed kunnen (gedistribueerde
load, CI-vriendelijke black-box-tests) hoeft niet nagebouwd te worden als de sc's daarnaartoe te
**exporteren** zijn.

## De keuze

**Een klein eigen formaat met een kleine eigen editor, en export naar de standaarden.**

- Alle sc's zijn JSON (formaat v2); alleen reset + seed is Go. De runner is ~500 regels.
- De editor is één ingebedde pagina zonder dependencies en zonder build-stap, achter dezelfde
  `devtools`-build-tag en hetzelfde beheerwachtwoord als de overige `/admin/*`-routes. In een
  productie-build bestaat hij niet.
- **Load hergebruikt de functionele sc's**: dezelfde stappen en verwachtingen, met vus ×
  iteraties en drempels die de test laten falen. Eén definitie, twee doelen.
- **Geen lock-in**: per sc een k6-script of Hurl-bestand. Wie morgen tegen een acceptatie-
  omgeving wil testen of echt wil stressen, gebruikt k6; de sc's gaan mee.
- Bewust **niet** gebouwd: gedistribueerde load, grafieken over tijd, testplannen/-cycli,
  gebruikersbeheer. Daar zijn k6 (+Grafana) en Kiwi TCMS voor als het zover komt.

Als de behoefte verschuift naar "vooral handmatig prikken met een fijne GUI", is **Bruno** de
logische aanvulling: een export naar `.bru` is van dezelfde orde als de Hurl-export.

## Wat er nu staat

| Onderdeel | Status |
|---|---|
| 25 sc's declaratief (01–18, 08b, 20, 21, 30–33), sc 00 in Go | draait groen, ~5 s (18 staat uit als bekend gat, 33 is alleen load) |
| Editor: bewerken, stappen en sc's verschuiven, dupliceren, selectie → nieuw sc, verwijderen met afhankelijkheidscontrole | getest met Playwright (11 controles) |
| Replay-import: opname → bewerkbaar sc | werkt |
| Loadrunner + loadprofiel + drempels + resultaten per stap | werkt; referentie ~1600 req/s, p95 ~10 ms (in-process, laptop, na de poolfix) |
| Rollen (`load.mix`), willekeurige id's met seed (`zet`, `rnd`, `kans`), database behouden, generator voor een dikke seed | werkt; vierfasenrecept in REGRESSIETEST.md; 2000 NP's: lezen ~2100 req/s, ook onder schrijflast |
| Dekking-tab op basis van `dekt` | werkt (nu: verwijzingen naar de BE-review) |
| Export k6 / Hurl | experimenteel; k6-script is syntactisch gevalideerd, **niet** met k6 zelf gedraaid (k6 en Hurl zijn hier niet geïnstalleerd) |

Inzichten uit de loadtests tot nu toe: (1) de connectiepool was niet ingesteld; het instellen
verdrievoudigde de leesdoorvoer en haalde de 500's bij 100 gelijktijdige gebruikers weg
(`db_pool.go`); (2) `GET /full/…` en vooral de tijdreis `?t=` zijn de duurste leesstappen, ruim
tien keer een detail-read; (3) lezen wordt niet merkbaar trager terwijl er geregistreerd wordt;
(4) twee open gaten: een dubbel id geeft 500 met SQL-tekst, en een deadlock bij samenloop geeft 500.

## Vervolg: naar requirements en use cases in Studio

Het veld `dekt` is de haak. De route in drie stappen, elk op zichzelf bruikbaar:

1. **Nu — vrije verwijzingen.** `dekt: ["UC-12", "REQ-7"]`; de Dekking-tab toont de omgekeerde
   index en de sc's zonder dekking. Werkt zonder Studio.
2. **Studio als bron van id's.** Requirements en use cases als UML-elementen in Studio (use case
   = `UseCase`; requirement bv. als klasse met stereotype `«requirement»`, zoals SysML dat doet),
   elk met een stabiele id. De editor krijgt een keuzelijst in plaats van vrije tekst
   (`GET` op het Studio-model), en de Dekking-tab kan dan ook tonen wat **níet** gedekt is:
   requirements zonder sc. Dat is de helft van traceability die nu ontbreekt.
3. **Terugkoppeling naar het model.** Het laatste run-resultaat per sc terugschrijven als
   eigenschap/tagged value op het element, zodat een use-case-diagram in Studio groen/rood kleurt.
   Dan is de cirkel rond: model → test → resultaat → model.

Aandachtspunten voor stap 2: waar leeft het requirements-model (eigen profiel in de
schema-repository?), en wat is de stabiele id (niet de naam; een hernoemde use case mag zijn
testdekking niet verliezen).

Overige kandidaten, in volgorde van verwachte waarde:

- **Tweede domein** (CG): seeds en sc-map parametriseren op domein. Daar geldt
  `REGISTRATIE_TIJD=klok`, dus sc's zonder `synthtijd`.
- **Run-historie**: regressie- en loadresultaten bewaren en de trend tonen (p95 per stap over tijd).
- **CI**: regressie bij elke push, load met drempels 's nachts.
- **Editor-gemak**: formuliervelden voor `verwacht.json` in plaats van ruwe JSON; een stap
  "proefdraaien" vanuit de editor.

## Bronnen

- Bruno — https://www.usebruno.com/ en https://blog.usebruno.com/bruno-tutorial
- Hurl — https://hurl.dev/ en https://hurl.dev/blog/2026/04/27/announcing-hurl-8.0.0.html
- Step CI — https://stepci.com/ en https://github.com/stepci/stepci
- k6 — https://en.wikipedia.org/wiki/K6_(software)
- Open-source testmanagement — https://getautonoma.com/blog/open-source-test-management en
  https://www.browserstack.com/guide/best-open-source-test-management-tools
