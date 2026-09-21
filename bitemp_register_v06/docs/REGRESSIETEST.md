# Geautomatiseerde regressietest (np-loc)

*Ingericht 2026-09-16 op branch `chore/be-code-review`, als vervolg op de BE-review van 2026-07-07.
Uitgebreid 2026-09-18 tot een bewerkbare testsuite: alle scenario's declaratief (formaat v2),
suite-editor, loadtests en export naar k6/Hurl. Achtergrond en afwegingen (o.a. waarom geen
bestaande open-source tool): zie [TESTSUITE_VERKENNING.md](TESTSUITE_VERKENNING.md).*

## Wat het is

Een **integratietest die de échte API in-process draait** (`NewRouter` + `httptest`) tegen een
**échte, eigen Postgres**, het np-loc domein opbouwt uit replay-bestanden en daarna ruim 20
gedragsscenario's afloopt. np-loc is representatief voor het register: ENT, GE (hub+data),
REL, ENUM, referentielijst-items en datatypen (BSN, NLPostcode).

De scenario's (afgekort: **sc**) zijn **data, geen code**: één JSON-bestand per sc in
`regressie/scenarios/`. Alleen sc 00 (database-reset + seed via replay) is Go. Daardoor zijn
sc's te bewerken, te herordenen en te kopiëren in de suite-editor, en zijn dezelfde sc's
herbruikbaar als loadtest.

Bestanden:

| Bestand | Rol |
|---|---|
| `regressie/scenarios/<id>-<slug>.json` | **de scenario's** (formaat v2, zie hieronder); de bron van waarheid |
| `regressie_np_loc_test.go` | testomgeving (`//go:build integration`, package `main`): DB-reset, seed (sc 00), query-teller, daarna alle JSON-sc's als subtest |
| `regressie_declaratief_test.go` | de runner voor formaat v2: variabelen, JSON-paden met filters, verwachtingen, replay- en actie-stappen |
| `regressie_load_test.go` | loadrunner `TestLoadNpLoc`: speelt de request-stappen van één sc af met N virtuele gebruikers × iteraties |
| `handlers/regressie_ui_*.go` | suite-editor `/admin/regressie` (alleen `-tags devtools`): lijst/run, beheer, load, export, pagina |
| `scripts/regressie-np-loc.ps1` | runner: start een dedicated Postgres-container (poort **5433**) en draait de test |
| `scripts/regressie-ui.ps1` | start de devtools-API (8099) voor de suite-editor, incl. container + eigen DB |
| `scripts/regressie-bekijk.ps1` | start een gewone API-instantie (8097) op een gekozen testdatabase, om de data met inhoud.html / publicatie.html te bekijken |
| `scripts/genereer-load-seed.py` | maakt een dik, synthetisch replay-bestand (bv. 2000 NP's + locaties + links) als begintoestand voor loadtests |
| `db_pool.go` | connectiepool van de app én van de testomgeving (`DB_MAX_OPEN_CONNS` e.a.) |
| `postman/regressie-np-loc.postman_collection.json` + `…environment.json` | een deel van dezelfde scenario's voor handmatig prikken of `newman run` |
| `replay files/registraties-replay-synth-natuurlijkpersoon-locatie-woonadres.json` | seed: 5 NP's + 5 locaties + woonadres-links (15 registraties) |
| `replay files/registraties-replay-init-adellijketitels.json` | seed: referentielijst-items |

## Draaien

```powershell
cd bitemp_register_v06
.\scripts\regressie-np-loc.ps1              # productie-variant (geen /admin/*)
.\scripts\regressie-np-loc.ps1 -Devtools    # devloop-variant (mét /admin/*)
.\scripts\regressie-ui.ps1                  # suite-editor op http://localhost:8099/admin/regressie
```

Of direct (Postgres op 5433 moet dan al draaien):

```sh
REGRESSIE_DATABASE_URL="postgres://postgres:1234@127.0.0.1:5433/bitemp_regressie_np_loc?sslmode=disable" \
  go test -tags integration -run TestRegressieNpLoc -v -count=1 .
```

Looptijd: ~4 seconden (na compilatie). Elke run wist en herbouwt de database volledig.

**Veiligheid:** de test weigert een DSN met `bitemp_go_db_v06` (je dev-database). Gebruik altijd
een dedicated database; de default (`bitemp_regressie_np_loc`) wordt automatisch aangemaakt.

Omgevingsvariabelen: `REGRESSIE_DATABASE_URL` (DSN), `REGRESSIE_SEEDS` (puntkomma-gescheiden
replay-bestanden; default de twee hierboven).

## Scenario's

| # | Scenario | Bewijst |
|---|---|---|
| 00 | seed via replay *(Go)* | replay-formaat + engine-opvoer (18 registraties) |
| 01 | lijst + detail + `/full` | lezen; hub+data-navigatie (`namen[].data[].achternaam`) |
| 02 | onbekend id | **404**, geen SQL-tekst in de body (§4.2/4.3) |
| 03 | tijdreizen `?t=` | NP=2 bestaat niet op t=0, wel op t=1 |
| 04 | referentielijst-items | `/adellijke_titels` (item = gewone padnaam-route) + `/referentielijsten` |
| 05 | `POST /{padnaam}` | loopt via de engine: `registratie_id` in response, registratie bestaat, record heeft `opvoer` (§3.5) |
| 06 | synthetisch tijdstip | `tijdstip == 2026-01-01 + id·uur + id·µs` (`REGISTRATIE_TIJD=synthetisch`); vereist 05 |
| 07 | `POST /full` geneste shape | `namen[].data[]` wordt genormaliseerd tot hub+data |
| 08 | `PATCH /full` (merge patch) | nieuwe naam actief, oude afgevoerd |
| 08b | PATCH zónder expliciete FK | URL-id is leidend: builder injecteert de parent-FK (gefixt 2026-09-16) |
| 09 | ongedaanmaking van 08 | vorige naam weer actief; vereist 08 |
| 10 | `DELETE /{padnaam}` | 200 + registratie; 404 op afvoertijdstip, 200 ervoor; tweede DELETE → **409** |
| 11 | `POST /registraties`, `/wijzigingen` | **404** (audit-routes read-only, §3.5) |
| 12 | ongeldige BSN | **422** `application/problem+json` + rollback (NP bestaat niet) |
| 13 | ongeldige enumwaarde | **422** met enumnaam in de melding (enum-validatie toegevoegd 2026-09-16) |
| 14 | GraphQL introspectie | endpoint werkt |
| 15 | `/admin/rebuild` | 404 (productie-build) / 403 (devtools-build zonder `DEVLOOP`) (§3.3) |
| 16 | N+1-guard | `GET /full/…?t=&size=5` binnen `max_queries: 40` (gemeten 21; vóór §4.4 was dit 60+) |
| 17 | auth | `env: AUTH_ENABLED=true`: anonieme POST 401, lezen open, login → cookie → 201, logout → 401 |
| 18 | dubbel id bij opvoer | **409 Conflict** zonder SQL-tekst of constraintnaam in de body (gefixt 2026-09-18) |
| 19 | enkelvoudige hub vervangen | na wijzigen (met en zonder `rel_id`) en corrigeren precies één actieve hub met één actief data-record; data onder een afgevoerde hub wordt geweigerd (merge-notitie 2026-09-21 §3D; faalt zonder `fix/enkelvoudige-hub-afvoer`) |
| 20 | locatie via padnaam | tweede entiteit door dezelfde engine-route |
| 21 | replay-stap | speelt midden in de suite een replay-bestand af (50 extra locaties) en controleert het resultaat |
| 30 | load: NP registreren en teruglezen | functioneel sc mét loadprofiel (8 vus × 25 iteraties, drempel p95 250 ms, 0% fouten) |
| 31 | load: mutaties door elkaar | schrijver-rol: NP met GE's registreren, willekeurige NP en LOC corrigeren, soms ongedaanmaken, soms afvoeren |
| 32 | load: parallel lezen | lezer-rol: detail, full (NP en LOC), lijstpagina en tijdreis op willekeurige id's; wijzigt niets |
| 33 | load: lezen terwijl er geregistreerd wordt | mix van 31 en 32 tegelijk (`load.mix`); heeft zelf geen stappen en is in de gewone run SKIP |

De kolom *Dekking* in de suite-editor toont per requirement/use case (`dekt`) welke sc's hem raken.

## Formaat v2

Eén bestand per sc: `regressie/scenarios/<id>-<slug>.json`. De editor schrijft precies dit
formaat (vaste sleutelvolgorde, 2 spaties, geen HTML-escaping), dus handmatig bewerken en via de
UI bewerken geven dezelfde nette diffs.

```json
{
  "id": "05",
  "naam": "POST per padnaam loopt via de engine",
  "volgorde": 50,
  "vereist": [],
  "dekt": ["BE-REVIEW-3.5"],
  "tags": ["engine", "audit"],
  "stappen": [
    {"naam": "opvoeren", "method": "POST", "path": "/natuurlijk_personen", "body": {"id": 42},
     "verwacht": {"status": 201, "json": {"registratie_id": ">0"}},
     "bewaar": {"$regPost42": "registratie_id"}},
    {"naam": "registratie bestaat", "path": "/registraties/{{$regPost42}}",
     "verwacht": {"json": {"registratietype": "registratie"}}}
  ]
}
```

**Scenario-velden**

| Veld | Betekenis |
|---|---|
| `id` | 2–3 cijfers, optioneel één letter (`08b`); `00` is gereserveerd voor de seed |
| `naam`, `beschrijving` | vrije tekst; de naam bepaalt de slug in de bestandsnaam |
| `volgorde` | sorteersleutel (daarna `id`); de editor hernummert bij verschuiven naar 10, 20, 30, … |
| `vereist` | id's van sc's waarvan dit sc state gebruikt; gaan automatisch (transitief) mee in een selectie |
| `dekt` | verwijzingen naar requirements / use cases (traceability, zie verkenning) |
| `tags` | vrije labels |
| `uit` | `true` = overslaan (zichtbaar als SKIP); bedoeld voor bekende gaten en werk-in-uitvoering |
| `env` | omgevingsvariabelen alléén tijdens dit sc, bv. `{"AUTH_ENABLED": "true"}` |
| `vars` | scenariovariabelen, bv. `{"npVan": "1", "npTot": "2000"}`; bij een loadtest te overschrijven (veld *vars* / `LOAD_VARS`) |
| `load` | loadprofiel: `{"vus": 8, "iteraties": 25, "drempels": {"p95_ms": 250, "fout_pct": 0}}`; optioneel `mix` (rollen, zie *Loadtests*) |
| `stappen` | lijst van stappen, in volgorde; mag leeg zijn als `load.mix` gevuld is |

**Stappen** — precies één van drie soorten:

| Soort | Vorm |
|---|---|
| request | `{"naam", "method" (default GET), "path", "body", "verwacht", "bewaar", "max_queries", "uit", "zet", "kans"}` |
| replay | `{"replay": "replay files/x.json"}` — speelt elke entry af met zijn `expected_response_code`; zet `{{laatsteRegistratieID}}` en `{{replayAantal}}` |
| actie | `{"actie": "seed_admin"}` — maakt de admin-gebruiker aan (voor auth-sc's) |

**Verwachtingen** (`verwacht`)

| Sleutel | Betekenis |
|---|---|
| `status` | exacte HTTP-status (default 200) |
| `status_in` | één van de genoemde statussen, bv. `[403, 404]` |
| `bevat` / `bevat_niet` | substring wel / niet in de body (bv. `"bevat_niet": "sql:"`) |
| `header` | headernaam → substring, bv. `{"Content-Type": "problem+json"}` |
| `json` | pad → verwachting: `">0"`, `">=1"`, `"<10"`, `"!=null"`, `"null"` of een letterlijke waarde |

JSON-paden: gepunt, met index (`adressen.0.data.0.straatnaam`) of **filter**
(`namen[afvoer=null].data[afvoer=null].achternaam` = eerste element waar het veld null/afwezig
is; `a[veld=waarde]` voor een gewone match). Het filter `[afvoer=null]` is dé manier om in een
bitemporele respons "het actieve voorkomen" aan te wijzen.

`max_queries` faalt de stap als de request meer SQL-queries doet dan de grens (N+1-guard).

`zet` zet variabelen **vóór** de request, met functies: `"zet": {"npId": "{{rnd:npVan-npTot}}"}` kiest
een willekeurige bestaande NP en onthoudt hem voor de volgende stappen. `kans` (tussen 0 en 1) laat
een stap maar soms draaien, bv. `"kans": 0.5` voor "de helft van de correcties weer ongedaan maken".
Beide gebruiken een **geseede** generator: zelfde seed, zelfde reeks, dus herhaalbaar.

**Variabelen**

| Vorm | Betekenis |
|---|---|
| `bewaar: {"regId": "pad"}` → `{{regId}}` | lokaal: alleen binnen dit sc |
| `bewaar: {"$regPatch": "pad"}` → `{{$regPatch}}` | globaal: ook in latere sc's (combineer met `vereist`) |
| `{{seedLaatsteRegistratieID}}` | laatste registratie-id van de seed |
| `{{vu}}`, `{{iter}}`, `{{uniek}}` | loadtest: virtuele gebruiker, iteratie, en een uniek id (`100000 + vu·10000 + iter`); functioneel vast |
| `{{synthtijd:var}}` | synthetisch registratietijdstip van registratie-id `var` (voor `?t=`) |
| `{{min1:var}}` | waarde − 1 |
| `{{rnd:a-b}}` | willekeurig geheel getal in [a, b]; a en b zijn getallen of variabelen (`{{rnd:1-seedLaatsteRegistratieID}}`) |
| `"{{int:var}}"` | mét quotes in de JSON; wordt een kaal getal in de body |

Variabelen werken in `path`, `body`, het replay-pad, `bevat`/`bevat_niet`, JSON-paden en
verwachtingswaarden (niet in `header`). Sc's delen één database en
lopen in volgorde: kies eigen entiteit-id's (≥ 40) die niet met de seed of andere sc's botsen.

### Beleid voor bekende gaten

Een regressietest bewaakt *bestaand* gedrag. Gedrag dat nog nooit werkte, hoort in de backlog,
niet als permanent rode test. Leg zo'n sc wél vast, maar zet het op `"uit": true` met de reden in
de beschrijving: het blijft zichtbaar als SKIP, en wie het gat dicht, zet het sc aan. De twee
gaten uit de eerste run (08b, 13) zijn inmiddels gedicht en draaien strikt.

## Bevindingen uit de eerste run (2026-09-16)

1. **Fout in eigen §4.1-fix, hersteld.** De partial unique index voor de enkelvoudig-invariant
   brak ongedaanmaking: bij het terugdraaien van [afvoer oude naam, opvoer nieuwe naam] doet de
   engine eerst *ont-afvoer* en dan *ont-opvoer*, waardoor er binnen de transactie tijdelijk twee
   actieve records zijn. Een unique index checkt per statement en weigert dat. Vervangen door een
   **`EXCLUDE … WHERE (…) DEFERRABLE INITIALLY DEFERRED`**-constraint (checkt bij COMMIT): de
   tussenstand mag, de eindtoestand is geborgd. Zie `dbsetup.createEnkelvoudigInvariantIndexes`.
2. **PATCH `/full/{padnaam}/:id` injecteerde de URL-id niet als parent-FK** (`wijziging_builder.go`).
   Zonder `natuurlijkpersoon_id` in elk kind-item faalde de engine met 500 "bovenliggende … id
   ontbreekt". **Gefixt (zelfde dag):** `bouwWijzigingVoorItem` injecteert nu de URL-id via
   `injecteerParentFK` (een meegestuurde FK wint); de FK telt niet mee als "inhoud", zodat een
   correctie-item met alleen `rel_id` een no-op blijft. → scenario 08b (strikt).
3. **Enumwaarden werden niet gevalideerd.** Twee oorzaken: `model/validation_walker.go` kende alleen
   `datatype:`-tags, én de ingecheckte `np_loc_modellen_input.go` miste de `schema:`-tags die de
   generator (`inputContentField`) inmiddels wél uitschrijft. **Gefixt:** walker valideert
   `enum=<Naam>` tegen `EnumWaarden` (code `enum`, 422 problem+json), en de drie ontbrekende tags
   zijn op de np-loc-Input-structs gezet. Let op: de branch-generator zou bij regeneratie óók
   `Aanvang`/`Einde` terugzetten op `Burgerschap_Input`/`Bereikbaarheid_Input`, wat het ingecheckte
   bestand bewust niet heeft — die keuze is niet aangeraakt; bij een merge met `main` (nieuwere
   codegen) verdient dit een blik. Andere domeinen krijgen de enum-tags bij hun volgende regeneratie.
   → scenario 13 (strikt).
4. **`DATABASE_ADMIN_URL` kan de database op de verkeerde server aanmaken.** De (ingecheckte) `.env`
   zet `DATABASE_ADMIN_URL` naar 5432; `ensureDatabaseExists` maakt de DB dan dáár aan terwijl de
   app op 5433 verbindt ("database does not exist" direct na "created successfully"). De regressietest
   negeert `DATABASE_ADMIN_URL` daarom expliciet. Start je de API zelf tegen 5433, zet dan
   `DATABASE_ADMIN_URL=""` of maak de DB vooraf aan.
5. **Replay-opnames zijn niet altijd zelfstandige seeds.** `registraties-replay-p1-… allerlei leuke
   ongedaanmakingen test.json` verwijst naar NP=1 / rel_id=1 uit een andere basisdataset en is dus
   alleen afspeelbaar op die basis. Synth-bestanden (`…-synth-…`) zijn wél zelfstandig.
6. **Dubbel entiteit-id bij opvoer gaf 500 met de ruwe SQL-fout** (2026-09-18, gevonden bij de
   loadtests): `duplicate key value violates unique constraint "natuurlijkpersoon_pkey" (SQLSTATE=23505)`
   stond letterlijk in de body. **Gefixt (zelfde dag):** 409 zonder SQL-tekst, zie bevinding 8.
   → sc 18 (strikt).
7. **De connectiepool was niet ingesteld** (2026-09-18). `database/sql` houdt standaard twee idle
   verbindingen aan en opent onbeperkt nieuwe. Onder parallelle last gaf dat 500's met
   `too many clients already` (bij 100 vus) en op Windows uitputting van tijdelijke poorten.
   **Gefixt** in `db_pool.go`, gebruikt door app én testomgeving: 674 → 2109 req/s en p95 87 → 23 ms
   op dezelfde data. Zie `test/2026-09-18-bevinding-001-…md`.
8. **Een samenloop-botsing gaf 500 met SQL-tekst** (2026-09-18). Twee schrijvers op hetzelfde record
   gaven twee soorten 500:
   - `23P01` bij de commit: twee gelijktijdige correcties op dezelfde naam of hetzelfde adres. De
     uitgestelde enkelvoudig-constraint uit §4.1 laat er één winnen. **De data bleef dus correct**
     (nooit twee actieve voorkomens); alleen het antwoord aan de verliezer was verkeerd.
   - `40P01`: deadlock bij ongedaanmaking naast een correctie; Postgres breekt er één af na 1 s.

   **Gefixt (zelfde dag)** in `handlers/db_conflict.go`: alle engine-fouten lopen door
   `newRegistreerErr`, en die vertaalt `23505`, `23P01`, `40P01` en `40001` naar **409 Conflict** met
   een boodschap zonder interne details; de volledige fout gaat naar de server-log
   (`CONFLICT (SQLSTATE … → 409)`). Geldt daarmee voor REST, PATCH/DELETE én GraphQL. Bij een
   deadlock of serialisatiefout doet `RegistreerJSONCore` **één herkansing** vanaf de ruwe body
   (de transactie is dan volledig teruggedraaid); het PATCH/DELETE-pad herkanst niet, omdat daar
   een opgebouwde tussenstand hergebruikt zou worden, en geeft 409.

   Controle (4 schrijvers op de kleine seed, 691 requests): vóór de fix ~5% 500's; erna **geen
   enkele 500**, 45 × 409, en 2 van de 4 deadlocks alsnog geslaagd door de herkansing. Hoe vaak een
   conflict optreedt hangt af van het id-bereik: op 2000 NP's met 6 schrijvers 1 op ~750. Sc 31
   blijft daarom standaard op 1 vu: een 409 is correct gedrag, maar telt in een loadtest als fout.
   Een geweigerde ongedaanmaking omdat een ander intussen hetzelfde gegeven wijzigde (400) is
   bestaand, bedoeld gedrag en wordt door sc 31 geaccepteerd.

## Suite-editor (devtools-build)

In een build met `-tags devtools` staat op **`/admin/regressie`** de suite-editor: één pagina
(inline HTML/JS, geen CDN, geen build-stap) met vier tabs.

**Snelstart:** `.\scripts\regressie-ui.ps1` — start/maakt de Postgres-container (5433) en de eigen
API-database, en draait een devtools-build op **http://localhost:8099/admin/regressie**
(wachtwoord default `regressie`, aanpasbaar met `-Wachtwoord`; poort met `-Port`). Ctrl+C stopt.
Deze instantie staat volledig los van je dev-omgeving (5432/8082): eigen poort, eigen databases.
Handmatig: `DEVLOOP=true DEVLOOP_PASSWORD=… PORT=8099 DATABASE_ADMIN_URL="" go run -tags devtools .`
Na een `git pull` of wijziging in `handlers/regressie_ui_*.go`: herstarten (de pagina zit in de binary).

### Tab Suite

- De sc-lijst is direct zichtbaar (ook vóór de eerste run), met tags, `dekt`-labels,
  `vereist`-pijltjes, aantal stappen en de uitklapbare inhoud. Bij sc 00 zijn de
  **seed-replaybestanden** uitklapbaar (samenvatting per entry + ruwe JSON).
- **▶ Alles afspelen** / **▶ Selectie afspelen**: seed (00) en `vereist` (transitief) gaan
  automatisch mee. Status, duur en foutregels verschijnen live per sc.
- **▲▼** verschuift een sc; de volgorde wordt direct opgeslagen (hernummerd naar 10, 20, …).
- **✎ bewerk** opent de editor; **⧉ kopie** opent een kopie als nieuw sc (eerstvolgende vrije id);
  **🗑** verwijdert (geweigerd als een ander sc het `vereist`, tenzij je bevestigt).
- **+ Nieuw scenario** en **⇪ Replay importeren als scenario**: kiest een bestand onder
  `replay files/` en zet **elke entry om in een eigen, bewerkbare request-stap**
  (`POST /registratie/` met de opgenomen body en verwachte status). Zo wordt een opname uit de
  FE-replaypagina een testcase waar je verwachtingen aan toevoegt. Wil je het bestand juist
  ongewijzigd afspelen, gebruik dan een replay-stap.

**Editor.** Bovenin de sc-velden (id, naam, vereist, dekt, tags, beschrijving, uit, loadprofiel,
env). Per stap een regel met de snelle velden (naam, method, path, verwachte status) en daaronder
uitklapbaar de **volledige stap als JSON** — alles wat het formaat kan, kan dus ook in de editor,
zonder dat elk veld een eigen formulierelement nodig heeft. Per stap ▲▼ (verschuiven), ⧉ (dupliceren),
🗑 en *uit*. Vink stappen aan en kies **⧉ Selectie → nieuw scenario** om een deel van een sc (of,
met alles aangevinkt, het geheel) naar een nieuw sc te kopiëren. *Hele scenario als JSON* schakelt
naar één tekstvak voor wie liever plakt. Opslaan valideert server-side (id-vorm, precies één
stapsoort, geldige JSON) en hernoemt het bestand als id of naam wijzigt.

### Tab Dekking

Omgekeerde index van `dekt`: per requirement / use case de sc's die hem raken, plus de sc's
zónder `dekt`. Dit is bewust de kleinste vorm van traceability; de koppeling met
requirements/use cases die in Studio als UML beheerd worden staat als vervolgstap in
[TESTSUITE_VERKENNING.md](TESTSUITE_VERKENNING.md).

### Tab Load & performance

Kiest een sc en start `TestLoadNpLoc`. *vus* en *iteraties* leeg laten betekent: neem het
loadprofiel van het sc. Verder: **database behouden** (geen reset, geen seed), **vars**
(bv. het id-bereik van de dikke seed), **seed** (voor `rnd` en `kans`) en **seeds bij reset**
(replay-bestanden onder `replay files/`). Het resultaat toont requests/s, foutpercentage, p95
totaal tegenover de drempel, en per stap n / fouten / gem / p50 / p95 / p99 / max — bij een
mix met de rol ervoor. Het vierfasenrecept staat op de tab zelf. Zie *Loadtests* hieronder.

### Tab Formaat

Spiekbrief van formaat v2 (zelfde inhoud als de tabellen hierboven).

### Endpoints en beveiliging

| Endpoint | Doel |
|---|---|
| `GET /admin/regressie` | de pagina |
| `GET /admin/regressie/scenarios` | sc's + seeds + replay-bestanden + dekking |
| `POST /admin/regressie/scenarios` | opslaan: `{scenario, vorig_id, overschrijf}` |
| `DELETE /admin/regressie/scenarios/:id` | verwijderen (`?forceer=1` negeert `vereist`-afhankelijkheden) |
| `POST /admin/regressie/volgorde` | `{ids: […]}` → hernummert `volgorde` |
| `POST /admin/regressie/import-replay` | replay-bestand → nieuw sc (alleen onder `replay files/`, geen `..`) |
| `POST /admin/regressie/run`, `GET …/status` | regressierun starten / volgen |
| `POST /admin/regressie/load`, `GET …/load/status` | loadtest starten / volgen |
| `GET /admin/regressie/export/k6?id=…`, `…/hurl?id=…` | export (zie hieronder) |

Beveiliging als de overige `/admin/*`-routes: alleen in devtools-builds, rol `admin` bij
`AUTH_ENABLED=true`; alles wat schrijft of start vereist `DEVLOOP=true` + header
`X-Beheer-Wachtwoord` (`DEVLOOP_PASSWORD`). Eén run tegelijk, regressie óf load (409 bij
samenloop). De dev-DSN wordt geweigerd. Vereist Go-toolchain + broncode in de API-omgeving
(zoals de devloop-container) en een Postgres op de opgegeven DSN.

## Loadtests

`TestLoadNpLoc` (`regressie_load_test.go`) speelt de **request-stappen van een sc** af met
N virtuele gebruikers (vus) × iteraties. Elke vu is een goroutine, dus de vus lopen **echt
parallel**; binnen één vu lopen de stappen na elkaar. Alles draait in-process tegen API + Postgres,
op een **eigen database** (de UI plakt `_load` achter de databasenaam). Dezelfde verwachtingen
gelden als functioneel: een stap die faalt, telt als fout.

```sh
REGRESSIE_DATABASE_URL="postgres://postgres:1234@127.0.0.1:5433/bitemp_regressie_load?sslmode=disable" \
  LOAD_SCENARIO=30 LOAD_VUS=8 LOAD_ITERATIES=25 \
  go test -tags integration -run '^TestLoadNpLoc$' -v -count=1 .
```

| Variabele | Betekenis |
|---|---|
| `LOAD_SCENARIO` | id van het sc (verplicht) |
| `LOAD_VUS`, `LOAD_ITERATIES` | overschrijven het loadprofiel (bij een mix: van elke rol). In de UI: leeg = "uit profiel" |
| `LOAD_BEHOUD=1` | database **niet** resetten en niet seeden: draai op de dataset die er al staat |
| `LOAD_SEED` | seed voor `{{rnd:a-b}}` en `kans` (default 1); zelfde seed = zelfde reeks |
| `LOAD_VARS` | `npVan=1;npTot=2000` — overschrijft de `vars` van het sc |
| `REGRESSIE_SEEDS` | replay-bestanden voor de seed bij reset (puntkomma-gescheiden) |
| `LOAD_UIT` | pad voor het JSON-resultaat |

- Gebruik `{{uniek}}` (of `{{vu}}`/`{{iter}}`) voor nieuwe id's, zodat vus niet op elkaars records
  botsen. Bij `LOAD_BEHOUD` schuift de basis van `{{uniek}}` mee met de klok, zodat ook herhaalde
  runs op dezelfde database niet botsen.
- **Drempels** uit het loadprofiel (`p95_ms`, `fout_pct`) laten de test **falen** — zo wordt een
  performance-regressie een rode test in plaats van een gevoel.
- Elk resultaat wordt ook bewaard als `perf-results/regressie-load-<id>-<tijdstip>.json`
  (niet in git), zodat je runs over tijd kunt vergelijken.

### Rollen: lezen terwijl er geregistreerd wordt

Een sc met `load.mix` speelt **meerdere sc's tegelijk** af, elk met eigen vus en iteraties:

```json
"load": {"drempels": {"p95_ms": 500, "fout_pct": 2},
         "mix": [{"scenario": "31", "vus": 1, "iteraties": 60},
                 {"scenario": "32", "vus": 12, "iteraties": 60}]}
```

Sc 33 doet precies dit: standaard 1 schrijver (sc 31) naast 12 lezers (sc 32); op de dikke seed zet je er meer schrijvers bij. Het resultaat toont per stap
de rol, zodat je de lees-p95 *onder schrijflast* kunt vergelijken met een run van alleen sc 32.
Zo'n sc heeft zelf geen stappen en is in de gewone regressierun een SKIP. `env` is procesbreed en
geldt daarom alleen van het mix-sc zelf, niet van de rollen.

### Recept: performancetest op 'rommelige' data

Een verse seed staat netjes op volgorde in de tabellen; echte data niet. Daarom in vier fasen:

1. **Vullen.** Maak een dik replay-bestand en speel het af als seed, samen met de CBS-gemeentelijst
   waar de adressen naar verwijzen:

   ```sh
   python scripts/genereer-load-seed.py --np 2000      # 2000 NP's + 2000 locaties + 2000 woonadres-links
   ```

   Het script zet NP's en locaties door elkaar, geeft elke NP GE's (identificatie met geldige BSN,
   naam, burgerschap, naamgebruik, aanvang, soms partnernaam) en elke locatie een adres met een
   gemeente uit de CBS-lijst. Herhaalbaar via `--seed`. Het bestand (3,8 MB bij 2000) staat in
   `.gitignore`. Afspelen van 6000 registraties duurt ongeveer anderhalve minuut.
2. **Door elkaar gooien.** Sc 31 met veel iteraties, `LOAD_BEHOUD=1` en nu wél meerdere vus
   (standaard staat sc 31 op 1 vu, omdat meerdere schrijvers op de kleine seed alleen maar botsen): nieuwe NP's met GE's,
   correcties op willekeurige bestaande NP's en adressen, de helft van de correcties weer
   ongedaan, een deel van de nieuwe NP's weer afgevoerd. Door de parallelle vus en de willekeurige
   id's raken oude en nieuwe versies verspreid over de tabellen.
3. **Parallel lezen.** Sc 32 met `LOAD_BEHOUD=1`.
4. **Lezen terwijl er geregistreerd wordt.** Sc 33 met `LOAD_BEHOUD=1`.

```sh
export REGRESSIE_DATABASE_URL="postgres://postgres:1234@127.0.0.1:5433/bitemp_regressie_load?sslmode=disable"
export LOAD_VARS="npVan=1;npTot=2000;locVan=1;locTot=2000"
T="go test -tags integration -run ^TestLoadNpLoc\$ -v -count=1 -timeout 60m ."

REGRESSIE_SEEDS="replay files/registraties-replay-init-gemeenten-cbs-2026.json;replay files/registraties-replay-load-np-loc-2000.json" \
  LOAD_SCENARIO=31 LOAD_VUS=1 LOAD_ITERATIES=1 $T          # fase 1: reset + dikke seed
LOAD_BEHOUD=1 LOAD_SCENARIO=31 LOAD_VUS=6 LOAD_ITERATIES=250 $T   # fase 2
LOAD_BEHOUD=1 LOAD_SCENARIO=32 LOAD_ITERATIES=100 $T              # fase 3
LOAD_BEHOUD=1 LOAD_SCENARIO=33 $T                                 # fase 4
```

In de suite-editor doe je hetzelfde op de tab *Load & performance* met de velden *seeds bij reset*,
*database behouden*, *vars* en *seed*; het recept staat daar ook.

Clashes op records die op hetzelfde moment bewerkt worden, zijn bewust **geen** doel van deze sc's:
de schrijver corrigeert willekeurige NP's uit een groot bereik en voert alleen zijn eigen nieuwe
NP's af. Botst het toch, dan antwoordt de API met 409 (zie bevinding 8); een gericht
samenloopscenario is iets voor later.

### Referentiecijfers

Dev-laptop, 2026-09-18, in-process, Postgres 16 in Docker, 2000 NP's na fase 2, pool 25:

| Run | req/s | p95 totaal | opvallend |
|---|---|---|---|
| sc 30, 8 × 25, kleine seed | ~1600 | ~10 ms | vóór de poolfix ~950 req/s en ~21 ms |
| sc 30, 100 × 2, kleine seed | ~3500 | ~70 ms | 0 fouten (vóór de poolfix: 500's met `too many clients`) |
| sc 31, 6 × 100 (fase 2) | ~460 | ~20 ms | registratie met GE's p95 ~22 ms, correctie ~10 ms, ongedaanmaking ~19 ms; schrijven is latency-gebonden, niet pool-gebonden |
| sc 32, 16 × 100 (fase 3) | ~2100 | ~23 ms | detail 1 ms · lijst 2 ms · LOC full 6 ms · NP full 15 ms · tijdreis 28 ms |
| sc 33, 3 schrijvers + 12 lezers (fase 4; mix aangepast) | ~1700 | ~23 ms | lezen wordt **niet** merkbaar trager onder schrijflast |

De tijdreis (`/full/…?t=`) en de full-shape-read zijn de duurste leesstappen: de eerste plek om te
kijken als de doorvoer tegenvalt.

### Connectiepool

De pool van de app wordt ingesteld in `db_pool.go` en de testomgeving gebruikt dezelfde functie,
zodat een loadtest meet wat de app doet.

| Variabele | Default | |
|---|---|---|
| `DB_MAX_OPEN_CONNS` | 25 | houd dit onder Postgres' `max_connections` (standaard 100), gedeeld met andere clients |
| `DB_MAX_IDLE_CONNS` | = open | te laag = voortdurend opnieuw verbinden |
| `DB_CONN_MAX_LIFETIME` | 30m | |
| `DB_CONN_MAX_IDLE_TIME` | 5m | |

Bij meer gelijktijdige requests dan verbindingen **wachten** requests op een vrije verbinding in
plaats van te falen. Zie bevinding 7 voor de meting vóór en na.

**Wat dit wel en niet is.** In-process betekent: geen netwerk, geen TLS, geen reverse proxy, en
de loadgenerator deelt CPU met de API. Het is een **regressie-instrument voor performance**
(wordt de engine trager door een wijziging?), geen capaciteitstest van een deployment. Voor dat
laatste: exporteer naar k6 en draai tegen een echte omgeving.

## De testdata bekijken

De React-pagina's praten met de backend waar ze vandaan komen. De suite-editor (8099) heeft een
eigen, lege database; de testdata staan in ándere databases op dezelfde Postgres (5433). Start
daarom een kijk-instantie op de database die je wilt zien:

```powershell
.\scripts\regressie-bekijk.ps1                                          # keuzelijst met aantallen registraties
.\scripts\regressie-bekijk.ps1 -Database bitemp_regressie_np_loc_load   # loadtest vanuit de UI
```

Daarna: **http://localhost:8097/viz/react/inhoud.html** en **…/publicatie.html**. De instantie
draait naast 8099 en naast je dev-backend (8082).

| Database | Gevuld door |
|---|---|
| `bitemp_regressie_np_loc` | regressierun (script, of UI met de standaard-DSN) |
| `bitemp_regressie_np_loc_load` | loadtest vanuit de UI (de UI plakt `_load` achter de naam uit het DSN-veld) |
| `bitemp_regressie_load` | loadtest vanaf de commandoregel (voorbeeld hierboven) |

- De JavaScript-bundels (`web/react/assets`) staan niet in git. In een worktree zonder gebouwde
  frontend gebruikt het script automatisch de gebouwde frontend van de hoofdcheckout, via de
  env-variabele **`WEB_DIR`** (`main.go`; standaard `./web`). Die frontend kan nieuwer zijn dan
  deze backend. Zelf kiezen kan met `-WebDir`.
- Een run met reset bouwt de database opnieuw op: ververs daarna de pagina. Gebruik *database
  behouden* als je wilt blijven kijken naar dezelfde dataset.
- Het is een gewone API zonder auth: muteren via de pagina's kan, en verandert de testdata.

## Export naar k6 en Hurl

Per sc, via de knoppen **k6** / **hurl** in de lijst of de export-endpoints. Doel: de sc's
zijn niet opgesloten in eigen tooling.

- **k6** (`…/export/k6?id=30`): een zelfstandig k6-script met de request-stappen, checks uit
  `verwacht`, `bewaar`/`zet`/`kans`/`rnd`, `per-vu-iterations` uit het loadprofiel en `thresholds`
  uit de drempels. Een mix (sc 33) wordt één script met **gelijktijdige k6-scenario's**, één per
  rol. Omdat de doeldatabase niet gereset wordt, schuift `{{uniek}}` mee met de klok
  (`-e UNIEK_BASIS=…` zet hem vast). Verder: `-e VARS="npVan=1;npTot=2000"` overschrijft de
  scenariovariabelen en `-e LOGIN_USER=… -e LOGIN_PASSWORD=…` logt elke vu eerst in (nodig voor
  muteren bij `AUTH_ENABLED=true`). k6 kent geen geseede generator: de willekeur is daar niet herhaalbaar. Draaien: `k6 run -e BASE_URL=http://host:8082 sc30.js`. Padfilters (`[afvoer=null]`)
  werken ook in k6: het script bevat een kleine helper die dezelfde paden begrijpt.
- **Hurl** (`…/export/hurl?id=05`): een `.hurl`-bestand met captures en asserts. Draaien:
  `hurl --test --variable base=http://host:8082 --variable uniek=110001 sc05.hurl`.
- Beide zijn **experimenteel** en vertalen alleen wat het doel kent: replay- en actie-stappen,
  `env` en `max_queries` komen als notitie/commentaar mee, niet als uitvoerbare stap; Hurl
  vertaalt bovendien geen padfilters en geen functies (`synthtijd`, `min1`). De export reset of
  seedt de doeldatabase niet.

## Uitbreiden

- **Nieuw sc:** in de suite-editor (nieuw, kopie, selectie van stappen, replay-import) of als
  JSON-bestand in `regressie/scenarios/`. Beide routes leveren hetzelfde bestand op.
- **Nieuwe stapsoort of verwachting:** in `regressie_declaratief_test.go` (`declStap`,
  `controleerStap`, `voerActieUit`) en de spiegel-structs in `handlers/regressie_ui_handler.go`;
  werk dan ook de tab *Formaat* en dit document bij.
- **Ander domein:** de runner is domein-agnostisch; seeds en sc-map zijn nu np-loc. Parametriseer
  `defaultSeeds` en de sc-map (bv. `regressie/<domein>/scenarios`) zodra een tweede domein erbij komt.
- **Nieuwe seed:** leg vast als replay-bestand (de FE-replaypagina kan exporteren) en zet het in
  `defaultSeeds` of `REGRESSIE_SEEDS`. Let op bevinding 5: synthetische, zelfstandige data.
- **CI:** `go test ./...` (unit) draait zonder DB; regressie en load vereisen `-tags integration`
  en een Postgres — in CI een `postgres:16` service-container op 5433. Drempels maken de
  loadtest geschikt als (nachtelijke) performance-bewaking.
