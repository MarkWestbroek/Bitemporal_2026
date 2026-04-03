# Devloop — Self-rebuilding Register in Docker

## Concept

De **devloop** omgeving is een Docker-setup waarin het register zichzelf kan
hergenereren en hercompileren. De container bevat niet alleen de draaiende
API, maar ook de volledige Go-toolchain en broncode. Hierdoor kun je via de
UML-editor het model wijzigen, code laten genereren, en de API herstarten —
allemaal binnen dezelfde container.

```
┌──────────────────────────────────────────────────────┐
│  Docker: bitemp-devloop-api                          │
│                                                      │
│   ┌──────────┐   V3 JSON    ┌──────────┐            │
│   │  Frontend │ ──────────→ │ /admin/  │            │
│   │  Editor   │             │ rebuild  │            │
│   └──────────┘             └────┬─────┘            │
│                                  │                   │
│                    ┌─────────────▼──────────────┐   │
│                    │  1. codegen (V3 → Go)      │   │
│                    │  2. go build               │   │
│                    │  3. herstart API (exit 42)  │   │
│                    └────────────────────────────┘   │
│                                                      │
│   ┌──────────────────────────────────┐              │
│   │  entrypoint.sh (restart loop)    │              │
│   │  → start binary                  │              │
│   │  → exit 42? → herstart           │              │
│   └──────────────────────────────────┘              │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  PostgreSQL DB   │
└──────────────────┘
```

## Bestanden

| Bestand | Doel |
|---------|------|
| `Dockerfile.devloop` | Docker image met Go + Node + volledige source |
| `docker-compose.devloop.yml` | Compose met PostgreSQL + devloop container |
| `scripts/devloop-entrypoint.sh` | Entrypoint met automatische herstart loop |
| `handlers/rebuild_handler.go` | API endpoint voor rebuild |

## Starten

```bash
cd bitemp_register_v06

# Bouw en start de devloop omgeving
docker compose -f docker-compose.devloop.yml up --build
```

De API is bereikbaar op `http://localhost:8082`.

## Model wijzigen en rebuilden

### Via de frontend editor

1. Open de UML-editor: `http://localhost:8082/viz/react/editor-v2.html`
2. Wijzig het model
3. Klik **Publiceer naar Schema Registry** (de V3 JSON wordt opgeslagen)
4. Stuur een rebuild request:

```bash
# Haal het gepubliceerde model op en stuur het door naar rebuild
curl -s http://localhost:8082/api/schema/model | \
  curl -X POST http://localhost:8082/admin/rebuild/1234 \
    -H "Content-Type: application/json" \
    -d @-
```

### Via een V3 JSON bestand

```bash
curl -X POST http://localhost:8082/admin/rebuild/1234 \
  -H "Content-Type: application/json" \
  -d '{
    "domein": "register",
    "prefix": "register",
    "mode": "additive",
    "model": { ... V3 JSON hier ... }
  }'
```

### Zonder model (huidige code re-exporteren en rebuilden)

```bash
curl -X POST http://localhost:8082/admin/rebuild/1234 \
  -H "Content-Type: application/json" \
  -d '{"domein": "register"}'
```

## Devloop status controleren

```bash
curl http://localhost:8082/admin/rebuild/status
```

Retourneert:
```json
{
  "devloop": true,
  "go_versie": "go version go1.24 linux/amd64",
  "codegen_beschikbaar": true,
  "werkdirectory": "/app",
  "model_directory": "/app/model"
}
```

## Hoe het werkt

1. **Entrypoint** (`devloop-entrypoint.sh`) start de API binary in een loop
2. **Rebuild endpoint** (`POST /admin/rebuild/:password`) ontvangt een V3 model:
   - Schrijft het model naar een tijdelijk bestand
   - Voert `go run ./cmd/codegen` uit (genereert Go bronbestanden)
   - Voert `go build` uit (compileert nieuwe binary)
   - Stuurt succes-response naar de client
   - Exit de API met code 42
3. **Entrypoint** detecteert exit code 42 en herstart de nieuwe binary
4. De API is weer beschikbaar met het bijgewerkte model

## Beveiliging

- Het rebuild endpoint is beveiligd met een wachtwoord (`DEVLOOP_PASSWORD`)
- Het endpoint is alleen actief als `DEVLOOP=true` is ingesteld
- **Gebruik dit NIET in productie** — de Go toolchain en broncode horen
  niet in een productie-image

## Configuratie

Omgevingsvariabelen in `docker-compose.devloop.yml`:

| Variabele | Default | Betekenis |
|-----------|---------|-----------|
| `DEVLOOP` | `true` | Activeert devloop modus |
| `DEVLOOP_PASSWORD` | `1234` | Wachtwoord voor rebuild endpoint |
| `ALLOW_DROP_TABLES` | `true` | Staat admin drop-tables toe |
| `DB_USER` | `postgres` | PostgreSQL gebruiker |
| `DB_PASSWORD` | `1234` | PostgreSQL wachtwoord |
| `DB_NAME` | `bitemp_go_db_v06` | Database naam |
| `API_PORT` | `8082` | Externe poort voor de API |

## Verschil met productie Docker

| Aspect | Productie (`Dockerfile`) | Devloop (`Dockerfile.devloop`) |
|--------|--------------------------|-------------------------------|
| Image grootte | ~30 MB (Alpine + binary) | ~800 MB (Go + Node + source) |
| Go toolchain | Niet aanwezig | Aanwezig |
| Broncode | Niet aanwezig | Volledig aanwezig |
| Rebuild mogelijk | Nee | Ja |
| Doel | Deployment | Ontwikkeling / demo |
