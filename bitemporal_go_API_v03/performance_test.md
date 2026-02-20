# Performance test handleiding

## Quickstart (3 stappen)

1. **Leeg de database** (zodat `StartId=1` veilig is).
2. **Terminal 1** (server):

```powershell
cd d:\Git\Bitemporal_2026\bitemporal_go_API_v03
$env:GIN_MODE='release'; $env:APP_ENV='production'; $env:BUNDEBUG='0'; $env:APP_DEBUG_LOGS='0'; go run .
```

3. **Terminal 2** (benchmark):

```powershell
cd d:\Git\Bitemporal_2026\bitemporal_go_API_v03
powershell -ExecutionPolicy Bypass -File ".\scripts\compare_registration_perf.ps1" -Iterations 500 -Warmup 50 -Runs 7 -StartId 1 -CsvPath ".\perf-results\clean_run.csv"
```

Check daarna in `clean_run_summary.csv` dat `failures_total = 0` voor beide modes.

Deze handleiding beschrijft hoe je de twee implementaties van de registratie-endpoint vergelijkt:
- zonder reflectie (meta)
- met reflectie (`methode=reflectie`)

De test gebruikt het script:
- `scripts/compare_registration_perf.ps1`

## Doel

Meerdere registraties achter elkaar uitvoeren en de **totale verwerkingstijd** vergelijken tussen beide modi.

## Voorwaarden

1. API draait lokaal (standaard op `http://localhost:8080`).
2. Database is bereikbaar en schoon genoeg voor testdata.
3. PowerShell beschikbaar (`pwsh` of Windows PowerShell).

## Belangrijk: gebruik 2 terminals

`go run .` draait de server in de foreground. Daarom krijg je in die terminal geen prompt terug zolang de API draait.

- **Terminal 1**: start API
- **Terminal 2**: run benchmarkscript

### Terminal 1 (server, release + stille logging)

```powershell
cd d:\Git\Bitemporal_2026\bitemporal_go_API_v03
$env:GIN_MODE='release'; $env:APP_ENV='production'; $env:BUNDEBUG='0'; $env:APP_DEBUG_LOGS='0'; go run .
```

Stoppen van de server:

```powershell
Ctrl + C
```

### Terminal 2 (benchmark)

```powershell
cd d:\Git\Bitemporal_2026\bitemporal_go_API_v03
powershell -ExecutionPolicy Bypass -File ".\scripts\compare_registration_perf.ps1" -Iterations 100 -Warmup 10 -Runs 3 -StartId 1 -CsvPath ".\perf-results\test.csv"
```

## Veelgemaakte fout (VS Code content link)

Gebruik **geen** markdown-link zoals:

```text
[compare_registration_perf.ps1](http://_vscodecontentref_/0)
```

PowerShell ziet `http://_vscodecontentref_/0` dan als command en faalt. Gebruik altijd een echt pad, bijvoorbeeld:

```text
.\scripts\compare_registration_perf.ps1
```

## Script uitvoeren

Vanuit de map `bitemporal_go_API_v03`:

```powershell
pwsh -File ./scripts/compare_registration_perf.ps1 \
  -BaseUrl "http://localhost:8080" \
  -Iterations 300 \
  -Warmup 30 \
  -Runs 5
```

Of met Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\compare_registration_perf.ps1 -Iterations 300 -Warmup 30 -Runs 5
```

## Parameters

- `BaseUrl` (default: `http://localhost:8080`)
- `Iterations` aantal requests per mode per run (default: `200`)
- `Warmup` opwarmrequests per mode vóór metingen (default: `20`)
- `Runs` aantal herhaalde vergelijkingsruns (default: `3`)
- `StartId` basis-ID voor unieke testdata (default: `100000`)
- `CsvPath` optioneel pad voor CSV-export (per-run + `_summary`) (default: leeg)
- `WriteDbReport` schrijf automatisch een timestamped DB-rapport `.md`
- `DbContainer` docker containernaam van Postgres (default: `sweet_agnesi`)
- `DbName` databasenaam (default: `bitemp_go_db`)
- `DbUser` database user (default: `postgres`)
- `DbReportPath` optioneel expliciet pad voor DB-rapport

## Automatisch DB-rapport (.md)

Je kunt na elke perf-run automatisch een markdown rapport laten maken met:

- totale databasegrootte
- tabelgroottes + exact_rows (top-tabellen)
- herbruikbare SQL/commando-instructies

Voorbeeld (CSV + DB-rapport):

```powershell
pwsh -File ./scripts/compare_registration_perf.ps1 \
  -Iterations 500 \
  -Warmup 50 \
  -Runs 7 \
  -StartId 1 \
  -CsvPath "./perf-results/clean_run.csv" \
  -WriteDbReport
```

Wil je zelf het rapportpad bepalen:

```powershell
pwsh -File ./scripts/compare_registration_perf.ps1 \
  -Iterations 500 \
  -Runs 7 \
  -CsvPath "./perf-results/clean_run.csv" \
  -WriteDbReport \
  -DbReportPath "./perf-results/db_size_after_clean_run.md"
```

## CSV export (optioneel)

Wil je resultaten bewaren voor latere vergelijking, geef dan `CsvPath` mee:

```powershell
pwsh -File ./scripts/compare_registration_perf.ps1 \
  -Iterations 400 \
  -Warmup 40 \
  -Runs 5 \
  -CsvPath "./perf-results/registratie_compare.csv"
```

Dit schrijft twee bestanden:

- `./perf-results/registratie_compare.csv` (per run)
- `./perf-results/registratie_compare_summary.csv` (samenvatting per mode)

## Wat je in de output ziet

Per run:
- `total_ms`: totale tijd voor alle requests van die run
- `avg_ms`: gemiddelde requesttijd
- `p50_ms`, `p95_ms`: mediaan en 95e percentiel
- `rps`: requests per seconde
- `failures`: aantal mislukte requests

Samenvatting per mode:
- `total_ms_avg`: gemiddelde totale tijd over alle runs
- `avg_ms_avg`: gemiddeld requestgemiddelde over runs
- `p95_ms_avg`: gemiddeld 95e percentiel over runs
- `rps_avg`: gemiddelde throughput
- `failures_total`: totaal aantal fouten

## Interpretatie

Voor jouw doel ("totale tijd vergelijken") zijn dit de belangrijkste velden:
1. `total_ms_avg` (lager is beter)
2. `p95_ms_avg` (lager = stabielere tail-latency)
3. `failures_total` (moet 0 zijn voor eerlijke vergelijking)

## Tips voor consistente metingen

- Draai geen zware andere processen op dezelfde machine tijdens de test.
- Houd de API-config gelijk tussen runs.
- Gebruik meerdere runs (`Runs >= 5`) om ruis te dempen.
- Vergelijk alleen resultaten met `failures_total = 0`.
- Als logging veel output geeft, kan dit timings beïnvloeden.

## Wanneer is een verschil echt relevant?

Gebruik onderstaande vuistregels om meetruis te onderscheiden van echte performance-winst:

- **< 5% verschil in `total_ms_avg`**
  - Meestal ruis (machine load, GC, netwerkjitter, DB-cache effecten).
- **5% - 10% verschil**
  - Mogelijk echt; herhaal met hogere `Iterations` en `Runs`.
- **> 10% verschil**
  - Vaak betekenisvol, zeker als ook `p95_ms_avg` dezelfde richting op gaat.

Check altijd beide:

1. **Snelheid**: `total_ms_avg` (bulk throughput)
2. **Stabiliteit**: `p95_ms_avg` (tail-latency)

Interpretatievoorbeeld:

- Als mode A 12% sneller is op `total_ms_avg`, maar slechter op `p95_ms_avg`,
  dan is A sneller gemiddeld maar minder voorspelbaar.
- Als mode A zowel betere `total_ms_avg` als `p95_ms_avg` heeft,
  dan is A vrijwel zeker de betere keuze.

Voor een betrouwbaarder oordeel kun je extra herhalingen draaien:

```powershell
pwsh -File ./scripts/compare_registration_perf.ps1 -Iterations 800 -Warmup 80 -Runs 9
```

## Snelle benchmark (voorbeeld)

```powershell
pwsh -File ./scripts/compare_registration_perf.ps1 -Iterations 500 -Warmup 50 -Runs 7
```

Dit geeft een robuustere vergelijking door meer requests en meer herhalingen.