# Process Engine v01

UML-BPMN-DMN driehoek bovenop het bitemporele register. Operaton (Camunda 7-fork) als JVM-sidecar voor BPMN+DMN-uitvoering, een dunne Go-gateway als brug naar één of meer registers, en context-/ad-hoc taken in een lichte Go-laag (geen CMMN).

Dit project is **bovenop** [`bitemp_register_v06/`](../bitemp_register_v06/) gebouwd en heeft geen wijzigingen in het register nodig, behalve het optionele `proces_` domein voor context-taken (Fase 6).

## Status

**PoC werkend** — multi-branch `registreer_inwoner_v2`-flow draait end-to-end (smoke-test geslaagd 2026-05-21).

Zie [docs/plans/2026-05-19 Process Engine.md](docs/plans/2026-05-19%20Process%20Engine.md) voor het volledige plan en [docs/CONTRACTEN.md](docs/CONTRACTEN.md) voor de vier kerncontracten.

Zie ook [docs/processen/registreer nwe inwoner.md](docs/processen/registreer%20nwe%20inwoner.md) voor de procesbeschrijving.

## Snel lokaal starten

Productieprofiel (alles in containers, eigen Postgres voor Operaton):

```sh
docker compose up --build
```

Dev-profiel (deelt de Postgres-instantie van het bitemp register, eigen database `operaton`):

```sh
# zorg dat in de bitemp Postgres een db `operaton` met user `operaton` bestaat
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Health-check Process Engine: <http://localhost:8090/healthz>
Operaton Cockpit/Tasklist:    <http://localhost:8080/>

## Bouwen zonder Docker

```sh
cd process_engine_v01
go build ./...
go run ./cmd/process-engine
```

## Mappenstructuur

```
process_engine_v01/
├── cmd/process-engine/    entrypoint
├── internal/
│   ├── operaton/          REST-client tegen Operaton
│   ├── gateway/           HTTP-API
│   ├── registers/         multi-register configuratie
│   ├── adapter/           procesvariabele ↔ MetaRegistry mapping
│   ├── worker/            external-task workers (service-task, cel-script)
│   └── dmn/               DMN-evaluatie + output-conversie
├── deployments/poc/       PoC BPMN/DMN bestanden
├── config/registers.yaml  multi-register configuratie
├── docs/                  CONTRACTEN.md, plan, ideeën
├── docker-compose.yml     productieprofiel
├── docker-compose.dev.yml dev-profiel (deelt PG met register)
└── Dockerfile             multi-stage Go-build
```

## Versies

- Operaton: `2.1.0` (officiële Docker-image, Apache 2.0)
- Postgres: `16-alpine`
- Go: `1.25`

---

## PoC: External-task worker v2

De worker (`internal/worker/service_task.go`) implementeert het long-poll externe-taak-patroon. Bij opstarten pollt hij meerdere topics tegelijk via `/external-task/fetchAndLock`.

### Topics

| Topic | Actie |
|-------|-------|
| `check-locatie` | GET `/full/locaties/{locatie_id}` → zet `locatie_bestaat`, `locatie_actueel` |
| `check-np` | GET `/full/natuurlijk_personen/{np_id}` → zet `np_bestaat`, `np_actueel` |
| `registreer-np-bereikbaarheid` | POST `/registratie/` — nieuw NP + bereikbaarheid in één registratie |
| `registreer-bereikbaarheid` | POST `/registratie/` — alleen bereikbaarheid (NP bestaat al) |
| `register-call` | POST `/registratie/` — alleen NP (legacy, v1-compatibel) |

### Worker starten (lokaal)

```powershell
# Binary bouwen
go build -o _tmp/worker_v2.exe ./cmd/worker

# Starten (v06 API + Operaton moeten draaien)
$env:OPERATON_BASE_URL       = "http://localhost:8080/engine-rest"
$env:WORKER_ID               = "go-worker-v2"
$env:REGISTER_HOOFDREGISTER_URL = "http://localhost:8082"
.\_tmp\worker_v2.exe
```

### Operaton-provenance in registraties

Elke registratie aangemaakt door de worker bevat automatisch:

```json
"bron": "operaton",
"bron_kenmerk": "<operaton-process-instance-id>"
```

Dit verwijst naar de `bron`- en `bron_kenmerk`-velden op het `Registratie`-object in `bitemp_register_v06` (toegevoegd via DB-migratie `ensureRegistratieBronMigrated`).

### Bekende padnamen (bitemp v06 MetaRegistry)

Padnamen moeten exact overeenkomen met wat de MetaRegistry definieert (snake_case, meervoud):

| Type | Padnaam |
|------|---------|
| `Locatie` | `locaties` |
| `NatuurlijkPersoon` | `natuurlijk_personen` |
| `Bereikbaarheid` | `bereikbaarheden` |

⚠️ Fout: `/full/locatie/1` → 404. Correct: `/full/locaties/1`.

### BPMN v2: `registreer_inwoner_v2`

Bestand: `deployments/poc/registreer_inwoner_v2.bpmn`

```
[Start] → [check-locatie] → <locatie bestaat?>
                                  ↓ ja (default)         ↓ nee
                             [merge]          [CallActivity: registreer_locatie*]
                                ↓
                          [check-np] → <NP-status?>
                                ↓ niet gevonden (default)     ↓ bestaat & actueel     ↓ bestaat & niet-actueel
                     [registreer-np-bereikbaarheid]     [EndEvent: AL_INWONER fout]   [registreer-bereikbaarheid]
                                ↓
                          [COMPLETED]
```

\* `registreer_locatie` CallActivity is nog **niet** gedeployed. Bij `locatie_bestaat=false` zal het proces falen totdat dit sub-proces beschikbaar is.

### Testdata

`deployments/poc/start_pieter_v2.json` — happy path (locatie 1 bestaat, NP 4300 nieuw):
- BSN: `430050100` (geldig 11-proef: 9×4+8×3+5×5+3×1 = 88 = 8×11)
- Geboortedatum: 1990-06-15; Einde: 2099-12-31 (standaard open einde)

### Smoke-test resultaten (2026-05-21)

| Stap | Resultaat |
|------|-----------|
| `check-locatie` (locaties/1) | `bestaat=true`, `actueel=true` ✅ |
| `check-np` (natuurlijk_personen/4300) | `bestaat=false` ✅ |
| `registreer-np-bereikbaarheid` | `registratie_id=888`, HTTP 201 ✅ |
| `bron`/`bron_kenmerk` in registratie | `operaton` / `e8574958-…` ✅ |
| Process state | `COMPLETED` ✅ |

Wijzigingen in registratie 888: NatuurlijkPersoon, Persoonsidentificatie (BSN), Naam, NP_Aanvang (geboortedatum), NP_Einde (2099-12-31), Bereikbaarheid (Woonadres naar locatie 1), Bereikbaarheid_Aanvang (vandaag).
