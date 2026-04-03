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

De API is standaard bereikbaar op `http://localhost:8182` in de devloop-compose.

> In de UML-editor wordt bij lokaal Vite-dev (`:5173`/`:5174`/`:5175`) standaard ook `http://localhost:8182` als API-basis voorgesteld. Buiten Vite-dev valt de editor terug op `window.location.origin`.

## Model wijzigen en rebuilden

### Via de frontend editor

1. Open de UML-editor: `http://localhost:8182/viz/react/editor-v2.html`
2. Wijzig het model
3. Klik **Publiceer naar Schema Registry** (de V3 JSON wordt opgeslagen)
4. Stuur een rebuild request:

```bash
# Haal het gepubliceerde model op en stuur het door naar rebuild
curl -s http://localhost:8182/api/schema/model | \
  curl -X POST http://localhost:8182/admin/rebuild/1234 \
    -H "Content-Type: application/json" \
    -d @-
```

### Via een V3 JSON bestand

```bash
curl -X POST http://localhost:8182/admin/rebuild/1234 \
  -H "Content-Type: application/json" \
  -d '{
    "domein": "register",
    "prefix": "register",
    "mode": "additive",
    "model": { ... V3 JSON hier ... }
  }'
```

### Multi-domein rebuild/codegen

De rebuild-endpoint ondersteunt ook meerdere codegen-runs in één keer. Dat is de standaardroute voor het schema waarin bijvoorbeeld `register`, `np-loc` en `abuvwxy` naast elkaar bestaan.

```bash
curl -X POST http://localhost:8182/admin/rebuild/1234 \
  -H "Content-Type: application/json" \
  -d '{
    "schema_versie_id": 27,
    "domeinen": [
      { "domein": "register", "prefix": "register", "mode": "additive" },
      { "domein": "np-loc",   "prefix": "np_loc",   "mode": "additive" },
      { "domein": "abuvwxy",  "prefix": "abuvwxy",  "mode": "additive" }
    ]
  }'
```

> In de editor wordt dit nu via checkboxen ondersteund: je kunt één of meer beschikbare domeinen aankruisen voor `Rebuild` of `Publiceer + Rebuild`.

### Rebuild vanuit databaseversie

Het endpoint kan het model ook rechtstreeks uit `schema_versies` laden. Dat is handig om een eerder gepubliceerd model opnieuw te genereren zonder eerst iets vanuit de editor op te halen.

```bash
curl -X POST http://localhost:8182/admin/rebuild/1234 \
  -H "Content-Type: application/json" \
  -d '{
    "schema_versie_id": 27,
    "domeinen": [
      { "domein": "register", "prefix": "register", "mode": "additive" },
      { "domein": "np-loc",   "prefix": "np_loc",   "mode": "additive" },
      { "domein": "abuvwxy",  "prefix": "abuvwxy",  "mode": "additive" }
    ]
  }'
```

Ondersteunde bronnen zijn:
- `model` in de request body — actuele editorinhoud
- `schema_versie_id` — expliciet record uit `schema_versies`
- `schema_bron: "actief"`
- `schema_bron: "latest_proposed"`
- geen body — export vanuit de huidige code/MetaRegistry

### Zonder model (huidige code re-exporteren en rebuilden)

```bash
curl -X POST http://localhost:8182/admin/rebuild/1234 \
  -H "Content-Type: application/json" \
  -d '{"domein": "register"}'
```

## Devloop status controleren

```bash
curl http://localhost:8182/admin/rebuild/status
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

1. **Entrypoint** (`devloop-entrypoint.sh`) start de API binary in een loop.
2. **Rebuild endpoint** (`POST /admin/rebuild/:password`) ontvangt een V3 model of haalt er één uit de database/code.
3. Voor de codegen start:
   - `model/` wordt eerst hersteld vanuit `_baseline/model/` (schone bewezen toestand)
   - daarna wordt een extra backup gemaakt in `_pre_rebuild/model/`
4. Daarna volgt per geselecteerd domein een aparte codegen-run.
5. Vervolgens draait `go build` om de nieuwe binary te compileren.
6. Alleen bij succes:
   - wordt `_baseline/model/` bijgewerkt naar de nieuw bewezen toestand
   - stuurt de API een succes-response terug
   - exit de API met code `42`
7. **Entrypoint** detecteert exit code `42` en herstart de nieuwe binary.

### Fallback / rollback gedrag

De devloop is expliciet defensief gemaakt zodat een mislukte generatie niet meteen de hele applicatie onbruikbaar maakt:

- **Codegen fout** → `model/` wordt direct teruggezet vanuit `_pre_rebuild/model/`
- **Build fout** → `model/` wordt teruggezet vanuit `_pre_rebuild/model/`
- **Crash kort na herstart** (standaard: binnen `10` seconden) → entrypoint herstelt `model/` vanuit `_baseline/model/`, bouwt opnieuw en probeert opnieuw te starten

Hierdoor blijft er altijd een laatste bewezen toestand beschikbaar.

### Verificatie op 2026-04-04 (schema_versie_id = 27)

Voor het record `schema_versie_id=27` is gecontroleerd dat opnieuw genereren naar tijdelijke output dezelfde code oplevert als de huidige codebasis, met deze uitkomst:

| Domein | Uitkomst |
|--------|----------|
| `register` | modelbestanden identiek; verschillen alleen in editorposities/layout |
| `np-loc` | model grotendeels identiek; inhoudelijk alleen verbetering naar getypeerde velden zoals `BSN` en `NLPostcode` |
| `abuvwxy` | verwacht verschil, omdat dit handmatig onderhouden referentiecode betreft en geen 1-op-1 additive gegenereerde set |

Praktisch betekent dit dat **1x publiceren naar de schema registry + meervoudige codegen per domein** een werkbare en controleerbare workflow is.

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
