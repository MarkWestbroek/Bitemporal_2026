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
| `postman/regressie-np-loc.postman_collection.json` + `…environment.json` | dezelfde scenario's voor handmatig prikken of `newman run` |
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
| 08b | PATCH zónder expliciete FK | **SKIP — bekend gat**, zie hieronder |
| 09 | ongedaanmaking van 08 | vorige naam weer actief |
| 10 | `DELETE /{padnaam}` | 200 + registratie; 404 op afvoertijdstip, 200 ervoor; tweede DELETE → **409** |
| 11 | `POST /registraties`, `/wijzigingen` | **404** (audit-routes read-only, §3.5) |
| 12 | ongeldige BSN | **422** `application/problem+json` + rollback (NP bestaat niet) |
| 13 | ongeldige enumwaarde | **SKIP — bekend gat**, zie hieronder |
| 14 | GraphQL introspectie | endpoint werkt |
| 15 | `/admin/rebuild` | 404 (productie-build) / 403 (devtools-build zonder `DEVLOOP`) (§3.3) |
| 16 | N+1-guard | `GET /full/…?t=&size=5` → **21 queries** (grens 40; vóór §4.4 was dit 60+) |
| 17 | auth | `AUTH_ENABLED=true`: anonieme POST 401, lezen open, login → cookie → 201, logout → 401 |

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
2. **PATCH `/full/{padnaam}/:id` injecteert de URL-id niet als parent-FK** (`wijziging_builder.go`).
   Zonder `natuurlijkpersoon_id` in elk kind-item faalt de engine met 500 "bovenliggende … id
   ontbreekt". De builder gebruikt de URL-id alleen voor de id-mismatch-check, en `WijzigEntiteitCore`
   roept `NormaliseerWijzigingen` (die bij POST wél FK's injecteert) niet aan. Workaround: FK
   meesturen. Fix: FK-injectie in de builder (klein). → scenario 08b.
3. **Enumwaarden worden niet gevalideerd.** Velden dragen `schema:"enum=Naamgebruiksoort"` en
   `EnumWaarden` bestaat, maar `model/validation.go` kent geen enum-regel; "Onzin" wordt
   opgeslagen. Fix: enum-check toevoegen aan de validatie-walker (klein). → scenario 13.
4. **Replay-opnames zijn niet altijd zelfstandige seeds.** `registraties-replay-p1-… allerlei leuke
   ongedaanmakingen test.json` verwijst naar NP=1 / rel_id=1 uit een andere basisdataset en is dus
   alleen afspeelbaar op die basis. Synth-bestanden (`…-synth-…`) zijn wél zelfstandig.

## Uitbreiden

- Nieuw scenario: voeg een `t.Run("NN …", func(t *testing.T) { o := o.met(t); … })` toe; helpers
  `o.eisStatus`, `o.do`, `actieveDataVeld`. Scenario's delen state en lopen in volgorde.
- Ander domein: kopieer het bestand, wijzig seeds + padnamen; of parametriseer op domein.
- Nieuwe seed: leg vast als replay-bestand (FE-replaypagina kan exporteren) en zet het in
  `defaultSeeds` of `REGRESSIE_SEEDS`. Let op (4): synthetische, zelfstandige data.
- CI: `go test ./...` (unit) draait zonder DB; de integratietest vereist `-tags integration` en
  een Postgres — in CI een `postgres:16` service-container op 5433.
