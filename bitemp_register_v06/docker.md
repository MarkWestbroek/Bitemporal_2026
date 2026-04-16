# Docker Guide (modulaire 4-componenten stack)

Deze handleiding beschrijft hoe je de vier componenten van het register als losse Docker images/services bouwt en draait.

Snelle releaseflow: zie ook [RELEASE.md](RELEASE.md).

## Vier componenten

De stack bestaat uit vier onafhankelijke deelservices:

| Component    | Image / service          | Doel                                        | Standaard poort |
|--------------|--------------------------|---------------------------------------------|-----------------|
| **DB**       | `postgres:16-alpine`     | PostgreSQL database (data-opslag)           | 5433 → 5432    |
| **Filestore**| `minio/minio:latest`     | MinIO S3-compatibele objectopslag (IDE-bestanden, modellen) | 9000 (API), 9001 (console) |
| **BE (API)** | `bitemp-go-api:v06.*`    | Go backend — REST, GraphQL, schema-API      | 8082 → 8080    |
| **FE**       | `bitemp-viz-frontend:v06.*` | Vite/React frontend via nginx            | 8083 → 80      |

Doel:
- Elk component eenvoudig apart vervangen/upgraden.
- Data behouden in aparte database- en filestore-volumes.
- Geen afhankelijkheid van één groot docker compose bestand.

## Beschikbare Docker-varianten in deze repo

| Compose-bestand                       | Bevat                                      | Gebruik                                      |
|---------------------------------------|--------------------------------------------|----------------------------------------------|
| `docker-compose.yml`                  | DB + Filestore + BE (alles-in-één)         | Lokale ontwikkeling                          |
| `docker-compose.devloop.yml`          | DB + Filestore + BE (devloop/self-rebuild) | Ontwikkel/devloop-variant                    |
| `docker-compose.split.yml`            | DB + Filestore + BE + FE (4 services)      | Complete stack met aparte FE-image           |
| `docker-compose.db-only.yml`          | Alleen DB                                  | Dockge/server: DB als losse stack            |
| `docker-compose.filestore-only.yml`   | Alleen Filestore (MinIO + init)            | Dockge/server: filestore als losse stack     |
| `docker-compose.api-only.yml`         | Alleen BE (API)                            | Dockge/server: API als losse stack           |
| `docker-compose.frontend-only.yml`    | Alleen FE                                  | FE tegen externe API                         |

Bij de split-variant horen ook:
- `Dockerfile.api` — bouwt alleen de Go-backend.
- `Dockerfile.frontend` — bouwt alleen de Vite/nginx-frontend.
- `nginx.frontend.conf` — reverse proxy zodat frontend en API via dezelfde origin werken.

### Aanbevolen stack-combinaties

**Lokaal ontwikkelen** (alles in één):
```
docker-compose.yml
```

**Server/Dockge (3 losse stacks)**:
```
docker-compose.db-only.yml          # stack 1: DB
docker-compose.filestore-only.yml   # stack 2: Filestore
docker-compose.api-only.yml         # stack 3: API
```
Alle drie draaien op het gedeelde `bitemp-net` netwerk.

**Complete split (4 services in 1 compose)**:
```
docker-compose.split.yml            # DB + Filestore + BE + FE
```

## 1. Vereisten

- Docker Engine op je machine of server.
- Een bereikbare PostgreSQL database (lokaal, remote of aparte container).
- Correcte PostgreSQL connectiestring in `DATABASE_URL`.
- Een bereikbare MinIO filestore (lokaal, remote of aparte container) voor bestandsopslag.

Voorbeelden van host in `DATABASE_URL`:
- PostgreSQL op Windows host vanuit container: `host.docker.internal`
- PostgreSQL op andere server: echte hostnaam of IP
- PostgreSQL in andere container op zelfde network: containernaam

## 1.1 Configuratie via `.env.docker` (aanrader)

Voor Dockge/compose is het netter om credentials en tags in een env-bestand te zetten.

Bestanden:
- `.env.docker.example` (template)
- `.env.docker` (jouw echte waarden, lokaal op server)

Maak je lokale env-bestand:

```bash
cp .env.docker.example .env.docker
```

Pas daarna minimaal aan in `.env.docker`:
- `POSTGRES_PASSWORD`
- `ADMIN_DROP_PASSWORD`
- eventueel `API_IMAGE`

### 1.2 Eerste deployment op nieuwe omgeving (database automatisch laten aanmaken)

De API kan bij startup optioneel zelf de database aanmaken als die nog niet bestaat.

Zet hiervoor in `.env.docker`:

```dotenv
AUTO_CREATE_DATABASE=true
```

Optioneel (aanrader in productie): geef een aparte admin connectie op met CREATEDB-rechten:

```dotenv
DATABASE_ADMIN_URL=postgres://postgres:<password>@<host>:5432/postgres?sslmode=disable
```

Gedrag:
- Als `AUTO_CREATE_DATABASE=true`: app checkt of de database uit `DATABASE_URL` bestaat.
- Bestaat die niet, dan probeert de app `CREATE DATABASE` uit te voeren.
- Zonder voldoende rechten krijg je een duidelijke foutmelding bij startup.

Voor bestaande omgevingen kun je dit uit laten (`AUTO_CREATE_DATABASE=false` of weglaten).

## 2. Image bouwen

Ga naar de map `bitemporal_go_API_v05` en build de image.

De Dockerfile bouwt nu zelf:
- de Go API binary
- de React/Vite frontend naar statische assets in `web/react`

Dus je hoeft vooraf lokaal geen `npm run build` meer te doen.

### PowerShell

```powershell
$commit = (git rev-parse --short HEAD)
$bt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
docker build --no-cache --build-arg COMMIT=$commit --build-arg BUILD_TIME=$bt -t bitemp-go-api:v06.00.01 .
```

### Bash

```bash
docker build --no-cache \
  --build-arg COMMIT=$(git rev-parse --short HEAD) \
  --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t bitemp-go-api:v06.00.01 .
```

Opmerking:
- De runtime-image bevat geen Node/Vite dev server.
- Alleen de Go binary en de benodigde statische `/viz` assets worden meegenomen.
- Build opnieuw na relevante frontend- of Dockerfile-wijzigingen en push een nieuwe tag.

## 2A. Frontend + backend als twee losse exporteerbare images

Als je backend en frontend los wilt uitrollen of als aparte `.tar` wilt exporteren, gebruik dan de nieuwe split-variant:

- compose: `docker-compose.split.yml`
- backend Dockerfile: `Dockerfile.api`
- frontend Dockerfile: `Dockerfile.frontend`

### Builden

```bash
docker compose -f docker-compose.split.yml build
```

### Starten

```bash
docker compose -f docker-compose.split.yml up -d
```

Standaard draait dan:
- frontend op `http://localhost:8083/viz/react/`
- API direct op `http://localhost:8082/`

De frontend-image serveert alleen de Vite-build via nginx. Alle API-calls naar `/api`, `/full`, `/registratie`, `/docs`, `/swagger`, `/redoc`, enz. worden doorgeproxied naar de backend-container, zodat `window.location.origin` gewoon blijft werken.

### Los exporteren als bestanden

```bash
docker save -o bitemp-go-api_v06-split.tar bitemp-go-api:v06-split
docker save -o bitemp-viz-frontend_v06-split.tar bitemp-viz-frontend:v06-split
```

### Weer inladen op een andere machine

```bash
docker load -i bitemp-go-api_v06-split.tar
docker load -i bitemp-viz-frontend_v06-split.tar
```

> Gebruik `FRONTEND_PORT`, `API_PORT` en `PG_PORT` in `.env.docker` als je deze stack naast een bestaande deployment wilt laten draaien.

## 2B. Alleen de frontend (tegen een externe API)

Als de API al ergens draait en je alleen de frontend wilt deployen:

```bash
# Bouw met de URL van de externe API
docker compose -f docker-compose.frontend-only.yml build \
  --build-arg VITE_API_BASE_URL=https://api.example.com

# Start
docker compose -f docker-compose.frontend-only.yml up -d
```

De frontend draait dan op `http://localhost:8083/viz/react/`. Zorg dat `VITE_API_BASE_URL` naar je API wijst (inclusief protocol en poort).

## 2C. Selectieve domeinbuild (deelverzameling van modellen)

Het register bevat meerdere gegenereerde domeinen. Met het selectieve-build script (`scripts/selectieve-build.ps1`) kun je de API compileren met alleen de gewenste domeinen. De domeinen **abuvwxy** en **register** worden altijd meegenomen.

Optionele domeinen: `np_loc`, `cg`, `configuratie`, `financieel`.

### Voorbeelden

```powershell
# Alleen abuvwxy + register + np_loc
.\scripts\selectieve-build.ps1 -Include np_loc

# Alles behalve financieel en cg
.\scripts\selectieve-build.ps1 -Exclude financieel,cg

# Met Docker image erbij
.\scripts\selectieve-build.ps1 -Include np_loc -DockerBuild -DockerTag bitemp-api:np-loc
```

### Hoe werkt het?

1. Verplaatst de `model/{prefix}_*.go` bestanden van uitgesloten domeinen naar `_temp/model_exclude/`.
2. Commentarieert de bijbehorende `init...()` calls uit in `metaregistry_plumbing.go`.
3. Voert `go build ./...` uit (en optioneel `docker build`).
4. Herstelt **altijd** alle bestanden naar de originele staat (ook bij fouten).

Routes, handlers en DB-setup zijn volledig generiek (gedreven door de MetaRegistry), dus die hoeven niet aangepast — alleen de model-bestanden en de init-registratie tellen.

## 3. API starten (zonder compose)

Belangrijk: vervang placeholders in `DATABASE_URL` door echte waarden.

### Voorbeeld: DB op Windows host

```powershell
docker run -d --name bitemp-go-api-v06 \
  -p 8082:8080 \
  -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db_v06?sslmode=disable" \
  -e APP_ENV=production \
  -e GIN_MODE=release \
  -e ALLOW_DROP_TABLES=false \
  -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" \
  --restart unless-stopped \
  bitemp-go-api:v06.00.01
```

In 1 regeL:
```
docker run -d --name bitemp-go-api-v06 -p 8082:8080 -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db_v06?sslmode=disable" -e APP_ENV=production -e GIN_MODE=release -e ALLOW_DROP_TABLES=false -e ADMIN_DROP_PASSWORD="1234" --restart unless-stopped bitemp-go-api:v06.00.01
```

of met backticks:
```
docker run -d --name bitemp-go-api-v06 `
  -p 8082:8080 `
  -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db_v06?sslmode=disable" `
  -e APP_ENV=production `
  -e GIN_MODE=release `
  -e ALLOW_DROP_TABLES=false `
  -e ADMIN_DROP_PASSWORD="1234" `
  --restart unless-stopped `
  bitemp-go-api:v06.00.01
```

### Voorbeeld: DB op aparte server

```powershell
docker run -d --name bitemp-go-api-v06 \
  -p 8082:8080 \
  -e DATABASE_URL="postgres://USER:PASSWORD@10.0.0.25:5432/DB_NAME?sslmode=require" \
  -e APP_ENV=production \
  -e GIN_MODE=release \
  -e ALLOW_DROP_TABLES=false \
  -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" \
  --restart unless-stopped \
  bitemp-go-api:v06.00.01
```

## 4. Handige controlecommando's

```powershell
# Lopende containers
docker ps

# Ook gestopte containers
docker ps -a

# Logs
docker logs --tail 200 bitemp-go-api-v06

# API versie-endpoint
curl http://localhost:8082/version
```

## 5. Nieuwe API versie uitrollen zonder dataverlies

Omdat de database apart staat, kun je de API-container veilig vervangen.

```powershell
# 1) Nieuwe image bouwen (voorbeeld tag v06.00.01)
$commit = (git rev-parse --short HEAD)
$bt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
docker build --no-cache --build-arg COMMIT=$commit --build-arg BUILD_TIME=$bt -t bitemp-go-api:v06.00.01 .

# 2) Oude API stoppen/verwijderen
docker rm -f bitemp-go-api-v06

# 3) Nieuwe API starten met exact dezelfde DATABASE_URL
docker run -d --name bitemp-go-api-v06 \
  -p 8082:8080 \
  -e DATABASE_URL="postgres://..." \
  -e APP_ENV=production \
  -e GIN_MODE=release \
  -e ALLOW_DROP_TABLES=false \
  -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" \
  --restart unless-stopped \
  bitemp-go-api:v06.00.01
```

Bijv.
```
docker run -d --name bitemp-go-api-v06 
  -p 8082:8080
  -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db_v06?sslmode=disable" 
  -e APP_ENV=production 
  -e GIN_MODE=release 
  -e ALLOW_DROP_TABLES=false 
  -e ADMIN_DROP_PASSWORD="1234" 
  --restart unless-stopped 
  bitemp-go-api:v06.00.01
```

## 6. Image delen zonder registry (bestand)

### Op bronmachine

```powershell
docker save -o bitemp-go-api_v06.00.01.tar bitemp-go-api:v06.00.01
```

Kopieer `bitemp-go-api_v06.00.01.tar` naar de doelmachine.

NAS: \\TRUENAS\share\Docker\Bitemporal\bitemp-go-api_v06.00.01.tar


### Op doelmachine

```powershell
docker load -i bitemp-go-api_v06.00.01.tar
docker run -d --name bitemp-go-api-v06 -p 8082:8080 -e DATABASE_URL="postgres://USER:PASSWORD@DB_HOST:5432/DB_NAME?sslmode=require" -e APP_ENV=production -e GIN_MODE=release -e ALLOW_DROP_TABLES=false -e ADMIN_DROP_PASSWORD="sterk-geheim" --restart unless-stopped bitemp-go-api:v06.00.01
```

bijv.:
```
docker run -d --name bitemp-go-api-v06 
  -p 8082:8080
  -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db_v06?sslmode=disable" 
  -e APP_ENV=production 
  -e GIN_MODE=release 
  -e ALLOW_DROP_TABLES=false 
  -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" 
  --restart unless-stopped 
  bitemp-go-api:v06.00.01
```

## 7. Image delen via registry (aanrader)

### Tag en push

```powershell
docker tag bitemp-go-api:v06.00.01 <registry-user>/bitemp-go-api:v06.00.01
docker push <registry-user>/bitemp-go-api:v06.00.01
```

Voorbeeld repository:
- `markwestbroek/bitemp-go-api`

```
docker tag bitemp-go-api:v06.00.01 markwestbroek/bitemp-go-api:v06.00.01
docker push markwestbroek/bitemp-go-api:v06.00.01
``

### Op server pull en run

```powershell
docker pull <registry-user>/bitemp-go-api:v06.00.01
docker rm -f bitemp-go-api-v06
docker run -d --name bitemp-go-api-v06 -p 8082:8080 -e DATABASE_URL="postgres://..." -e APP_ENV=production -e GIN_MODE=release -e ALLOW_DROP_TABLES=false -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" --restart unless-stopped <registry-user>/bitemp-go-api:v06.00.01
```

## 8. TrueNAS en Dockge (aanbevolen op server)

Als je TrueNAS gebruikt met Dockge, gebruik dan 3 aparte stacks:
- DB stack: `docker-compose.db-only.yml`
- Filestore stack: `docker-compose.filestore-only.yml`
- API stack: `docker-compose.api-only.yml`

Zo blijven database en filestore zelfstandig draaien en kun je de API los upgraden.

### 8.1 Eenmalig: env-bestand klaarzetten

```bash
cp .env.docker.example .env.docker
```

Pas secrets aan in `.env.docker` voordat je deployt. Let op de MinIO-variabelen:

```dotenv
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=kies-een-sterk-geheim
MINIO_BUCKET=ide-bestanden
MINIO_ENDPOINT=bitemp-minio-v06:9000
```

### 8.2 Database stack deployen (eerst)

Gebruik bestand:
- `docker-compose.db-only.yml`

```bash
docker compose -f docker-compose.db-only.yml up -d
```

Controle:

```bash
docker logs --tail 100 bitemp-postgres-v06
docker exec -it bitemp-postgres-v06 pg_isready -U postgres -d bitemp_go_db_v06
```

### 8.3 Filestore stack deployen (daarna)

Gebruik bestand:
- `docker-compose.filestore-only.yml`

```bash
docker compose -f docker-compose.filestore-only.yml up -d
```

Controle:

```bash
docker logs --tail 50 bitemp-minio-v06
# MinIO console openen in browser:
# http://<server-ip>:9001  (login: MINIO_ACCESS_KEY / MINIO_SECRET_KEY)
```

De init-container maakt automatisch de bucket `ide-bestanden` aan (of bevestigt dat deze al bestaat).

### 8.4 API stack deployen (als laatste)

Gebruik bestand:
- `docker-compose.api-only.yml`

```bash
docker compose -f docker-compose.api-only.yml up -d
```

Belangrijk:
- In deze opzet gebruikt de API als DB hostnaam: `bitemp-postgres-v06`.
- Dat werkt omdat beide stacks op dezelfde named network `bitemp-net` zitten.
- De network `bitemp-net` wordt automatisch aangemaakt door compose (als die nog niet bestaat).
- Beide stacks lezen variabelen uit `.env.docker`.

### 8.5 Updaten in Dockge

DB upgraden:
1. Pas `image: postgres:...` aan in de DB stack.
2. Redeploy de DB stack.

Filestore upgraden:
1. Pas `image: minio/minio:...` aan in de Filestore stack.
2. Redeploy de Filestore stack. Data blijft staan in het volume.

API upgraden:
1. Push nieuwe image tag (bijv. `v06.00.01`).
2. Pas `image: markwestbroek/bitemp-go-api:v06.00.01` aan in de API stack.
3. Redeploy de API stack.

Voordeel:
- Elk component is onafhankelijk vervangbaar.
- Data blijft staan in de volumes van DB en Filestore stacks.
- Beheer via UI met behoud van reproduceerbare compose-config.

## 9. Veelvoorkomende fouten

### Fout: containernaam bestaat al

Melding:
`Conflict. The container name "/bitemp-go-api-v06" is already in use`

Oplossing:

```powershell
docker rm -f bitemp-go-api-v06
```

### Fout: `lookup DB_HOST ... no such host`

Oorzaak:
- `DB_HOST` is placeholder en niet vervangen.

Oplossing:
- Gebruik een echte host in `DATABASE_URL`.
- Voor Windows host vanuit container vaak: `host.docker.internal`.

## 10. Security advies

Gebruik in productie:
- `APP_ENV=production`
- `GIN_MODE=release`
- `ALLOW_DROP_TABLES=false`
- Sterk `ADMIN_DROP_PASSWORD`
- Sterke DB credentials
- `sslmode=require` (of strenger) waar mogelijk
- Sterke MinIO credentials (`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`)
- MinIO console-poort (9001) niet publiek exposen tenzij nodig

Extra:
- Commit geen `.env.docker` met echte secrets naar Git.

## 11. Image lifecycle en opruimbeleid

Om te voorkomen dat je Docker Hub-repo volloopt, gebruik een vast bewaarbeleid.

Aanbevolen beleid:
- Bewaar de laatste 10 versie-tags (bijv. `v05.01.01` t/m `v05.01.10`).
- Bewaar altijd 1 bewezen rollback-tag naast de huidige productie-tag.
- Verwijder pre-release/test-tags na validatie.

Voorbeeld (huidig + rollback):
- `current`: `v05.01.10`
- `rollback`: `v05.01.09`

### 11.1 Lokaal opruimen (build machine/server)

Verwijder ongebruikte images:

```bash
docker image prune -a
```

Verwijder een specifieke oude tag:

```bash
docker rmi markwestbroek/bitemp-go-api:v06.00.01
```

### 11.2 Docker Hub opruimen (remote)

Verwijder oude tags in Docker Hub UI:
1. Open repository `markwestbroek/bitemp-go-api`.
2. Ga naar tab `Tags`.
3. Verwijder oude tags die buiten je bewaarbeleid vallen.

Praktische routine per release:
1. Push nieuwe tag.
2. Update productie naar die tag.
3. Houd vorige productietag als rollback.
4. Verwijder tags ouder dan je afgesproken venster (bijv. ouder dan laatste 10).

## 12. Release checklist (2 minuten)

Gebruik dit bij elke nieuwe API-versie.

### 12.1 Build en push

```bash
docker build --no-cache -t markwestbroek/bitemp-go-api:v06.00.01 .
docker push markwestbroek/bitemp-go-api:v06.00.01
```

### 12.2 Tag in stack bijwerken

Werk op de server in `.env.docker` bij:

```dotenv
API_IMAGE=markwestbroek/bitemp-go-api:v06.00.01
```

### 12.3 API redeployen

```bash
docker compose -f docker-compose.api-only.yml up -d
```

### 12.4 Smoke test

```bash
curl http://<server-ip>:8082/version
curl http://<server-ip>:8082/viz/index_schema.html
docker logs --tail 100 bitemp-go-api-v06
```

### 12.5 Rollback (indien nodig)

Zet `API_IMAGE` terug naar de vorige stabiele tag en redeploy opnieuw:

```bash
docker compose -f docker-compose.api-only.yml up -d
```

## 13. MinIO / Filestore

MinIO is de S3-compatibele objectopslag voor het register. De API gebruikt MinIO voor:
- Opslag van IDE-bestanden (UML-editor exports, gepubliceerde V3 JSON modellen)
- Bestandsbeheer via de bestanden-handler (`/api/bestanden/...`)

### 13.1 Configuratie-variabelen

| Variabele            | Standaard        | Beschrijving                                         |
|----------------------|------------------|------------------------------------------------------|
| `MINIO_ENDPOINT`     | `minio:9000`     | Endpoint dat de API gebruikt (containernaam:poort)   |
| `MINIO_ACCESS_KEY`   | `minioadmin`     | Toegangssleutel (equivalent van AWS access key)      |
| `MINIO_SECRET_KEY`   | `minioadmin`     | Geheime sleutel (equivalent van AWS secret key)      |
| `MINIO_BUCKET`       | `ide-bestanden`  | Naam van de bucket                                   |
| `MINIO_USE_SSL`      | `false`          | SSL gebruiken voor verbinding (true/false)           |
| `MINIO_API_PORT`     | `9000`           | Host-poort voor MinIO API                            |
| `MINIO_CONSOLE_PORT` | `9001`           | Host-poort voor MinIO webconsole                     |

### 13.2 Bucket-initialisatie

Alle compose-bestanden die MinIO bevatten hebben een `minio-init` service die automatisch:
1. Een alias aanmaakt naar de MinIO-server.
2. De bucket `ide-bestanden` aanmaakt (of bevestigt dat deze al bestaat).

### 13.3 Handmatig beheer via MinIO console

Open `http://localhost:9001` (of `http://<server-ip>:9001`) en log in met `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`. Hier kun je:
- Bestanden bekijken en downloaden
- Buckets aanmaken/verwijderen
- Toegangsbeleid instellen

### 13.4 Data-persistentie

MinIO-data wordt opgeslagen in een named Docker volume:
- `docker-compose.yml`: `minio_data`
- `docker-compose.devloop.yml`: `devloop_minio_data`
- `docker-compose.split.yml`: `minio_data_split`
- `docker-compose.filestore-only.yml`: `bitemp-minio-data`

Het volume blijft bestaan bij container-herstarts en -upgrades. Verwijder het volume alleen bewust met `docker volume rm <naam>`.
