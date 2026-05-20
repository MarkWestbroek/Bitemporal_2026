# Process Engine v01

UML-BPMN-DMN driehoek bovenop het bitemporele register. Operaton (Camunda 7-fork) als JVM-sidecar voor BPMN+DMN-uitvoering, een dunne Go-gateway als brug naar één of meer registers, en context-/ad-hoc taken in een lichte Go-laag (geen CMMN).

Dit project is **bovenop** [`bitemp_register_v06/`](../bitemp_register_v06/) gebouwd en heeft geen wijzigingen in het register nodig, behalve het optionele `proces_` domein voor context-taken (Fase 6).

## Status

Skeleton. Zie [docs/plans/2026-05-19 Process Engine.md](docs/plans/2026-05-19%20Process%20Engine.md) voor het volledige plan en [docs/CONTRACTEN.md](docs/CONTRACTEN.md) voor de vier kerncontracten.

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
