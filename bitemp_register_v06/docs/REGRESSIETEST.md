# Geautomatiseerde regressietest (np-loc)

*Ingericht 2026-09-16 op branch `chore/be-code-review`, als vervolg op de BE-review van 2026-07-07.*

## Wat het is

Een **integratietest die de échte API in-process draait** (`NewRouter` + `httptest`) tegen een
**échte, eigen Postgres**, het np-loc domein opbouwt uit replay-bestanden en daarna ~20
gedragsscenario's afloopt. np-loc is representatief voor het register: ENT, GE (hub+data),
REL, ENUM, referentielijst-items en datatypen (BSN, NLPostcode).

Bestanden:

| Bestand | Rol |
|---|---|
| `regressie_np_loc_test.go` | de test zelf (`//go:build integration`, package `main`) |
| `scripts/regressie-np-loc.ps1` | runner: start een dedicated Postgres-container (poort **5433**) en draait de test |
| `scripts/regressie-ui.ps1` | start de devtools-API (8099) voor de regressie-UI, incl. container + eigen DB |
| `postman/regressie-np-loc.postman_collection.json` + `…environment.json` | dezelfde scenario's voor handmatig prikken of `newman run` |
| `regressie_declaratief_test.go` | runner voor declaratieve (JSON-)scenario's; draait ze als sub-subtests onder scenario 90 |
| `regressie/scenarios/*.json` | de declaratieve scenario's zelf (één bestand per scenario; ook via de UI aan te maken) |
| `handlers/regressie_ui_handler.go` | devtools-pagina `/admin/regressie`: scenario's tonen (incl. inhoud), afspelen, declaratieve scenario's toevoegen |
| `replay files/registraties-replay-synth-natuurlijkpersoon-locatie-woonadres.json` | seed: 5 NP's + 5 locaties + woonadres-links (15 registraties) |
| `replay files/registraties-replay-init-adellijketitels.json` | seed: referentielijst-items |

## Draaien

```powershell
cd bitemp_register_v06
.\scripts\regressie-np-loc.ps1              # productie-variant (geen /admin/*)
.\scripts\regressie-np-loc.ps1 -Devtools    # devloop-variant (mét /admin/*)
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
| 00 | seed via replay | replay-formaat + engine-opvoer (18 registraties) |
| 01 | lijst + detail + `/full` | lezen; hub+data-navigatie (`namen[].data[].achternaam`) |
| 02 | onbekend id | **404**, geen SQL-tekst in de body (§4.2/4.3) |
| 03 | tijdreizen `?t=` | NP=2 bestaat niet op t=0, wel op t=1 |
| 04 | referentielijst-items | `/adellijke_titels` (item = gewone padnaam-route) + `/referentielijsten` |
| 05 | `POST /{padnaam}` | loopt via de engine: `registratie_id` in response, registratie bestaat, record heeft `opvoer` (§3.5) |
| 06 | synthetisch tijdstip | `tijdstip == 2026-01-01 + id·uur + id·µs` (`REGISTRATIE_TIJD=synthetisch`) |
| 07 | `POST /full` geneste shape | `namen[].data[]` wordt genormaliseerd tot hub+data |
| 08 | `PATCH /full` (merge patch) | nieuwe naam actief, oude afgevoerd |
| 08b | PATCH zónder expliciete FK | URL-id is leidend: builder injecteert de parent-FK (gefixt 2026-09-16) |
| 09 | ongedaanmaking van 08 | vorige naam weer actief |
| 10 | `DELETE /{padnaam}` | 200 + registratie; 404 op afvoertijdstip, 200 ervoor; tweede DELETE → **409** |
| 11 | `POST /registraties`, `/wijzigingen` | **404** (audit-routes read-only, §3.5) |
| 12 | ongeldige BSN | **422** `application/problem+json` + rollback (NP bestaat niet) |
| 13 | ongeldige enumwaarde | **422** met enumnaam in de melding (enum-validatie toegevoegd 2026-09-16) |
| 14 | GraphQL introspectie | endpoint werkt |
| 15 | `/admin/rebuild` | 404 (productie-build) / 403 (devtools-build zonder `DEVLOOP`) (§3.3) |
| 16 | N+1-guard | `GET /full/…?t=&size=5` → **21 queries** (grens 40; vóór §4.4 was dit 60+) |
| 17 | auth | `AUTH_ENABLED=true`: anonieme POST 401, lezen open, login → cookie → 201, logout → 401 |
| 90 | declaratieve scenario's | speelt elk `regressie/scenarios/*.json` af als eigen sub-subtest (bv. `20 locatie via padnaam`) |

### Waar staan de scenario's?

- **Gecodeerd (00–17):** in `regressie_np_loc_test.go`, elk als `t.Run("NN naam", …)`. Go-code, dus
  vrij in wat je kunt asserteren (query-teller, cookies, env-vlaggen), maar aanpassen vereist Go.
- **Declaratief (20+):** in `regressie/scenarios/<id>-<slug>.json`. Geen Go nodig; te schrijven
  in een editor of via het formulier op `/admin/regressie`. Formaat:

```json
{
  "id": "20", "naam": "locatie via padnaam", "beschrijving": "optioneel",
  "stappen": [
    {"method": "POST", "path": "/locaties", "body": {"id": 42},
     "verwacht": {"status": 201, "json": {"registratie_id": ">0"}},
     "bewaar": {"regId": "registratie_id"}},
    {"method": "GET", "path": "/registraties/{{regId}}",
     "verwacht": {"status": 200, "json": {"registratietype": "registratie", "id": "{{regId}}"}}}
  ]
}
```

Per stap: `method` (default GET), `path`, optioneel `body`; `verwacht.status` (default 200),
`verwacht.bevat` (substring), `verwacht.json` (gepunt pad → waarde; `">0"`, `">=1"`, `"<10"`,
`"!=null"`, `"null"` of letterlijke waarde); `bewaar` (variabelenaam → gepunt pad). Variabelen zijn als
`{{naam}}` bruikbaar in `path`, `body` en verwachtingswaarden; ingebouwd is
`{{seedLaatsteRegistratieID}}`. Declaratieve scenario's draaien **na** de gecodeerde en na de
seed — kies eigen id's (entiteit-id's ≥ 40) die niet met seed of andere scenario's botsen.

### Beleid voor bekende gaten

Een regressietest bewaakt *bestaand* gedrag. Gedrag dat nog nooit werkte, hoort in de backlog,
niet als permanent rode test. Zulke scenario's staan er wél in, maar eindigen in `t.Skipf("BEKEND GAT: …")`
zodra ze het bekende (foute) resultaat zien. Ze blijven zichtbaar in de output als `SKIP`, en
zodra iemand het gat dicht, slaat de skip niet meer aan en gaat de echte assertie lopen.

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

## Regressie-UI (devtools-build)

In een build met `-tags devtools` is er een pagina op **`/admin/regressie`** die de scenario's
toont, ze alle of een selectie afspeelt en het resultaat live laat zien:

- `GET /admin/regressie` — pagina (inline HTML, geen CDN); `GET …/scenarios` — lijst (geparsed
  uit `regressie_np_loc_test.go`); `GET …/status` — snapshot van de run;
  `POST …/run` — start `go test -tags integration -run '^TestRegressieNpLoc$/^(00|05|…)_' -json`.
- Seed (00) en afhankelijkheden (06←05, 09←08) worden automatisch aan een selectie toegevoegd; een
  declaratief scenario wordt gedraaid als `^TestRegressieNpLoc$/^(00|90)_/^(<id>)_`.
- Per scenario is de **inhoud** uitklapbaar: de Go-broncode van de subtest, of de JSON.
- Bij scenario **00** zijn ook de **seed-replaybestanden** uitklapbaar: per bestand een samenvatting
  per entry (index, registratietype, opmerking, verwachte status, welke opvoer/afvoer) plus de ruwe
  JSON. De lijst volgt `REGRESSIE_SEEDS` of anders `defaultSeeds` uit het testbestand.
- Onderaan staat een formulier **Nieuw declaratief scenario** (id, naam, stappen-JSON, overschrijven);
  `POST /admin/regressie/scenarios` schrijft het bestand. Id's van gecodeerde scenario's zijn geblokkeerd.
- Beveiliging als de overige `/admin/*`-routes: alleen in devtools-builds, rol `admin` bij
  `AUTH_ENABLED=true`, run vereist `DEVLOOP=true` + header `X-Beheer-Wachtwoord` (`DEVLOOP_PASSWORD`).
  Eén run tegelijk (409 bij samenloop). De dev-DSN wordt geweigerd.
- Vereist Go-toolchain + broncode in de API-omgeving (zoals de devloop-container) en een Postgres
  op de opgegeven DSN (default `REGRESSIE_DATABASE_URL` of 5433).

**Snelstart:** `.\scripts\regressie-ui.ps1` — start/maakt de Postgres-container (5433) en de eigen
API-database, en draait een devtools-build op **http://localhost:8099/admin/regressie**
(wachtwoord default `regressie`, aanpasbaar met `-Wachtwoord`; poort met `-Port`). Ctrl+C stopt.
Deze instantie staat volledig los van je dev-omgeving (5432/8082): eigen poort, eigen databases.
Handmatig: `DEVLOOP=true DEVLOOP_PASSWORD=… PORT=8099 DATABASE_ADMIN_URL="" go run -tags devtools .`

## Uitbreiden

- Nieuw scenario zonder Go: JSON in `regressie/scenarios/` (zie boven) of via de UI.
- Nieuw gecodeerd scenario: voeg een `t.Run("NN …", func(t *testing.T) { o := o.met(t); … })` toe; helpers
  `o.eisStatus`, `o.do`, `actieveDataVeld`. Scenario's delen state en lopen in volgorde.
- Ander domein: kopieer het bestand, wijzig seeds + padnamen; of parametriseer op domein.
- Nieuwe seed: leg vast als replay-bestand (FE-replaypagina kan exporteren) en zet het in
  `defaultSeeds` of `REGRESSIE_SEEDS`. Let op (4): synthetische, zelfstandige data.
- CI: `go test ./...` (unit) draait zonder DB; de integratietest vereist `-tags integration` en
  een Postgres — in CI een `postgres:16` service-container op 5433.
