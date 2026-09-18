# Testbevinding 001 — `too many clients` bij loadtest (scenario 30, 100 vus)

| Veld | Waarde |
|---|---|
| Datum | 2026-09-18 |
| Gevonden in | Testsuite np-loc → tab *Load & performance* (`/admin/regressie`, poort 8099) |
| Test | `TestLoadNpLoc` ([regressie_load_test.go](../regressie_load_test.go)), `LOAD_SCENARIO=30` |
| Scenario | 30 — load: NP registreren en teruglezen |
| Profiel | **100 vus × 2 iteraties** (UI-override; scenario-default is 8 × 25) |
| Ernst | Middel: in productie kan een piek in verkeer Postgres uitputten |
| Status | **Opgelost op 2026-09-18** (zie *Afhandeling* onderaan); nog niet gecommit |
| Gemeld door | Claude-sessie (analyse van een screenshot van de gebruiker) |

## Waarneming

Resultaat: **drempel overschreden**.

```
100 vus × 2 iteraties · 596 requests in 0.65 s · 921.6 req/s · fouten 5 (0.84%) · p95 totaal 251.42 ms (drempel 250 ms)
p95 251.42 ms > drempel 250.00 ms
foutpercentage 0.84% > drempel 0.00%
```

| Stap | n | fouten | gem ms | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| registreer | 200 | 1 | 63.4 | 64.03 | 106.44 | 115.76 | 118.76 |
| lees detail | 199 | 2 | 29.47 | 36.36 | 56.7 | 73.64 | 92.62 |
| lees full | 197 | 2 | 189.37 | 183.27 | 307.03 | 334.91 | 454.31 |

Foutvoorbeelden: alle vijf zijn een **HTTP 500** op willekeurige stappen (POST en GET):

```
vu 86 iter 1 stap 3 «lees full» (GET /full/natuurlijk_personen/960001): wil status 200, kreeg 500
vu 67 iter 2 stap 1 «registreer» (POST /natuurlijk_personen): wil status 201, kreeg 500
...
```

Serverlog (load-log):

```
ERROR: GET /natuurlijk_personen/830002: kon NatuurlijkPersoon niet ophalen: FATAL: sorry, too many clients already (SQLSTATE=53300)
ERROR: GET /natuurlijk_personen/650002: kon NatuurlijkPersoon niet ophalen: FATAL: sorry, too many clients already (SQLSTATE=53300)
ERROR: GET /natuurlijk_personen/600002: kon NatuurlijkPersoon niet ophalen: FATAL: sorry, too many clients already (SQLSTATE=53300)
```

## Analyse

- `SQLSTATE 53300` betekent dat Postgres een **nieuwe verbinding weigert**, omdat
  `max_connections` (standaard **100**) al bereikt is. Het is geen fout in de API-logica
  of in de bitemporele queries. De handler krijgt geen verbinding en geeft 500 terug.
- De database wordt geopend met `sql.OpenDB(pgdriver.NewConnector(...))` **zonder**
  `SetMaxOpenConns`:
  - in de test: [regressie_np_loc_test.go:105](../regressie_np_loc_test.go#L105)
    (`nieuweRegressieOmgevingMet`, ook gebruikt door `TestLoadNpLoc`);
  - in de applicatie: [main.go:259](../main.go#L259) (en de admin-DB op
    [main.go:283](../main.go#L283)).
  Bij Go's `database/sql` betekent `MaxOpenConns = 0` **onbeperkt**.
- Met 100 gelijktijdige vus opent de pool bij een piek ongeveer 100 verbindingen. Samen met
  verbindingen die al openstaan (admin-DB, pgAdmin, andere processen) gaat dat net over de
  limiet. Daarom falen er maar een paar requests (0,84%), telkens op de piekmomenten.
- De p95-overschrijding (251 ms tegen 250 ms, vooral bij `lees full`) komt waarschijnlijk
  deels door hetzelfde probleem: veel gelijktijdige verbindingen die elkaar verdringen, plus
  de kosten van steeds nieuwe verbindingen opzetten. Pas na de fix kun je zien of er
  daarnaast een echt performanceprobleem in `lees full` zit.

## Reproductie

1. Open de testsuite (`/admin/regressie`) → *Load & performance*.
2. Kies scenario 30 en zet **vus = 100**, **iteraties = 2** → *Loadtest starten*.
3. Verwacht: een paar 500's met `too many clients already` in de load-log. Hoe vaak dat
   gebeurt, hangt af van hoeveel verbindingen er al openstaan op de Postgres (poort 5433).

## Voorgestelde oplossing

1. **Connection pool begrenzen (aanbevolen).** Direct na elke `sql.OpenDB(...)` (test én
   `main.go`):

   ```go
   sqldb.SetMaxOpenConns(25)
   sqldb.SetMaxIdleConns(25)
   sqldb.SetConnMaxIdleTime(5 * time.Minute)
   ```

   Maak de limiet bij voorkeur instelbaar met een env-var (bv. `DB_MAX_OPEN_CONNS`, default
   25). Requests wachten dan op een vrije verbinding in plaats van met 500 te falen. Ook voor
   productie is dit gewenst.
2. *(Aanvullend, optioneel)* `max_connections` van de regressie-Postgres verhogen
   (bv. 200). Dat verschuift het probleem alleen, dus niet als enige maatregel.
3. *(Workaround)* Minder vus (bv. ≤ 50). Dan wordt niet meer getest wat de bedoeling was.

## Acceptatiecriteria na fix

- Scenario 30 met 100 vus × 2 iteraties geeft **0 fouten** en geen `SQLSTATE=53300` in de log.
- De p95-drempel opnieuw beoordelen. Blijft `lees full` boven 250 ms, maak dan een aparte
  bevinding voor de performance van `/full/...`.
- Leg de pool-instelling (env-var + default) vast in `docs/REGRESSIETEST.md` en in de
  deployment-docs.

## Afhandeling (2026-09-18)

Dezelfde oorzaak kwam dezelfde ochtend los hiervan boven bij het bouwen van de gemengde loadtest
(sc 33), daar als uitputting van tijdelijke poorten op Windows: ruim 15.000 sockets in `TIME_WAIT`
omdat de pool maar twee idle verbindingen aanhield en dus per query opnieuw verbond.

- **Fix:** [db_pool.go](../db_pool.go) met `configureerPool`, aangeroepen in [main.go](../main.go)
  én in de testomgeving ([regressie_np_loc_test.go](../regressie_np_loc_test.go)), zodat een loadtest
  meet wat de app doet. Instelbaar via `DB_MAX_OPEN_CONNS` (default 25), `DB_MAX_IDLE_CONNS`
  (default gelijk aan open), `DB_CONN_MAX_LIFETIME` (30m) en `DB_CONN_MAX_IDLE_TIME` (5m);
  gedocumenteerd in `.env.example` en `docs/REGRESSIETEST.md`.
- De HTTP-client van de testomgeving kreeg om dezelfde reden een ruime keep-alive-pool
  (de standaard is twee idle verbindingen per host).
- De admin-verbinding op `main.go:283` is ongemoeid gelaten: die wordt eenmalig gebruikt om de
  database aan te maken en daarna gesloten.

**Acceptatiecriteria getoetst** (sc 30, 100 vus × 2 iteraties, reset + standaard-seed):

| | vóór | na |
|---|---|---|
| fouten | 5 (0,84%), `SQLSTATE=53300` | **0**, geen `53300` in de log |
| p95 totaal | 251 ms | **70 ms** |
| `lees full` p95 | 307 ms | 81 ms |
| doorvoer | 922 req/s | 3510 req/s |

Op de door elkaar gegooide dataset van 2000 NP's (sc 32, 16 vus): 674 → 2109 req/s en p95
87 → 23 ms. De p95-overschrijding was dus volledig het poolprobleem; een aparte bevinding voor
`/full/...` is niet nodig. Wel blijft `lees full` de duurste leesstap.
