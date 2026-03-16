# Docker Guide (API apart van database)

Deze handleiding beschrijft hoe je de API als losse Docker image bouwt en draait, terwijl PostgreSQL apart blijft draaien.

Snelle releaseflow: zie ook [RELEASE.md](RELEASE.md).

Doel:
- API eenvoudig vervangen/upgraden.
- Data behouden in een aparte database.
- Geen afhankelijkheid van docker compose.

## 1. Vereisten

- Docker Engine op je machine of server.
- Een bereikbare PostgreSQL database (lokaal, remote of aparte container).
- Correcte PostgreSQL connectiestring in `DATABASE_URL`.

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

## 2. Image bouwen

Ga naar de map `bitemporal_go_API_v04` en build de image.

De Dockerfile bouwt nu zelf:
- de Go API binary
- de React/Vite frontend naar statische assets in `web/react`

Dus je hoeft vooraf lokaal geen `npm run build` meer te doen.

### PowerShell

```powershell
$commit = (git rev-parse --short HEAD)
$bt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
docker build --no-cache --build-arg COMMIT=$commit --build-arg BUILD_TIME=$bt -t bitemp-go-api:v04.01.02 .
```

### Bash

```bash
docker build --no-cache \
  --build-arg COMMIT=$(git rev-parse --short HEAD) \
  --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t bitemp-go-api:v04.01.02 .
```

Opmerking:
- De runtime-image bevat geen Node/Vite dev server.
- Alleen de Go binary en de benodigde statische `/viz` assets worden meegenomen.
- Build opnieuw na relevante frontend- of Dockerfile-wijzigingen en push een nieuwe tag.

## 3. API starten (zonder compose)

Belangrijk: vervang placeholders in `DATABASE_URL` door echte waarden.

### Voorbeeld: DB op Windows host

```powershell
docker run -d --name bitemp-go-api \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db?sslmode=disable" \
  -e APP_ENV=production \
  -e GIN_MODE=release \
  -e ALLOW_DROP_TABLES=false \
  -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" \
  --restart unless-stopped \
  bitemp-go-api:v04.01.02
```

In 1 regeL:
```
docker run -d --name bitemp-go-api -p 8080:8080 -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db?sslmode=disable" -e APP_ENV=production -e GIN_MODE=release -e ALLOW_DROP_TABLES=false -e ADMIN_DROP_PASSWORD="1234" --restart unless-stopped bitemp-go-api:v04.01.02
```

of met backticks:
```
docker run -d --name bitemp-go-api `
  -p 8080:8080 `
  -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db?sslmode=disable" `
  -e APP_ENV=production `
  -e GIN_MODE=release `
  -e ALLOW_DROP_TABLES=false `
  -e ADMIN_DROP_PASSWORD="1234" `
  --restart unless-stopped `
  bitemp-go-api:v04.01.02
```

### Voorbeeld: DB op aparte server

```powershell
docker run -d --name bitemp-go-api \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://USER:PASSWORD@10.0.0.25:5432/DB_NAME?sslmode=require" \
  -e APP_ENV=production \
  -e GIN_MODE=release \
  -e ALLOW_DROP_TABLES=false \
  -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" \
  --restart unless-stopped \
  bitemp-go-api:v04.01.02
```

## 4. Handige controlecommando's

```powershell
# Lopende containers
docker ps

# Ook gestopte containers
docker ps -a

# Logs
docker logs --tail 200 bitemp-go-api

# API versie-endpoint
curl http://localhost:8080/version
```

## 5. Nieuwe API versie uitrollen zonder dataverlies

Omdat de database apart staat, kun je de API-container veilig vervangen.

```powershell
# 1) Nieuwe image bouwen (voorbeeld tag v04.00.02)
$commit = (git rev-parse --short HEAD)
$bt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
docker build --no-cache --build-arg COMMIT=$commit --build-arg BUILD_TIME=$bt -t bitemp-go-api:v04.00.02 .

# 2) Oude API stoppen/verwijderen
docker rm -f bitemp-go-api

# 3) Nieuwe API starten met exact dezelfde DATABASE_URL
docker run -d --name bitemp-go-api \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://..." \
  -e APP_ENV=production \
  -e GIN_MODE=release \
  -e ALLOW_DROP_TABLES=false \
  -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" \
  --restart unless-stopped \
  bitemp-go-api:v04.00.02
```

Bijv.
```
docker run -d --name bitemp-go-api 
  -p 8080:8080
  -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db?sslmode=disable" 
  -e APP_ENV=production 
  -e GIN_MODE=release 
  -e ALLOW_DROP_TABLES=false 
  -e ADMIN_DROP_PASSWORD="1234" 
  --restart unless-stopped 
  bitemp-go-api:v04.01.01
```

## 6. Image delen zonder registry (bestand)

### Op bronmachine

```powershell
docker save -o bitemp-go-api_v04.00.01.tar bitemp-go-api:v04.00.02
```

Kopieer `bitemp-go-api_v04.00.02.tar` naar de doelmachine.

NAS: \\TRUENAS\share\Docker\Bitemporal\bitemp-go-api_v04.00.01.tar


### Op doelmachine

```powershell
docker load -i bitemp-go-api_v04.00.01.tar
docker run -d --name bitemp-go-api -p 8080:8080 -e DATABASE_URL="postgres://USER:PASSWORD@DB_HOST:5432/DB_NAME?sslmode=require" -e APP_ENV=production -e GIN_MODE=release -e ALLOW_DROP_TABLES=false -e ADMIN_DROP_PASSWORD="sterk-geheim" --restart unless-stopped bitemp-go-api:v04.00.01
```

bijv.:
```
docker run -d --name bitemp-go-api 
  -p 8080:8080
  -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db?sslmode=disable" 
  -e APP_ENV=production 
  -e GIN_MODE=release 
  -e ALLOW_DROP_TABLES=false 
  -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" 
  --restart unless-stopped 
  bitemp-go-api:v04.00.01
```

## 7. Image delen via registry (aanrader)

### Tag en push

```powershell
docker tag bitemp-go-api:v04.00.01 <registry-user>/bitemp-go-api:v04.00.01
docker push <registry-user>/bitemp-go-api:v04.00.01
```

Voorbeeld repository:
- `markwestbroek/bitemp-go-api`

```
docker tag bitemp-go-api:v04.01.02 markwestbroek/bitemp-go-api:v04.01.02
docker push markwestbroek/bitemp-go-api:v04.01.02
``

### Op server pull en run

```powershell
docker pull <registry-user>/bitemp-go-api:v04.00.01
docker rm -f bitemp-go-api
docker run -d --name bitemp-go-api -p 8080:8080 -e DATABASE_URL="postgres://..." -e APP_ENV=production -e GIN_MODE=release -e ALLOW_DROP_TABLES=false -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" --restart unless-stopped <registry-user>/bitemp-go-api:v04.00.01
```

## 8. TrueNAS en Dockge (aanbevolen op server)

Als je TrueNAS gebruikt met Dockge, gebruik dan 2 aparte stacks:
- DB stack: `docker-compose.db-only.yml`
- API stack: `docker-compose.api-only.yml`

Zo blijft de database zelfstandig draaien en kun je de API los upgraden.

### 8.1 Eenmalig: env-bestand klaarzetten

```bash
cp .env.docker.example .env.docker
```

Pas secrets aan in `.env.docker` voordat je deployt.

### 8.2 Database stack deployen (eerst)

Gebruik bestand:
- `docker-compose.db-only.yml`

Plak in Dockge of gebruik via CLI:

```bash
docker compose -f docker-compose.db-only.yml up -d
```

Controle:

```bash
docker logs --tail 100 bitemp-postgres
docker exec -it bitemp-postgres pg_isready -U postgres -d bitemp_go_db
```

### 8.3 API stack deployen (daarna)

Gebruik bestand:
- `docker-compose.api-only.yml`

Plak in Dockge of gebruik via CLI:

```bash
docker compose -f docker-compose.api-only.yml up -d
```

Belangrijk:
- In deze opzet gebruikt de API als DB hostnaam: `bitemp-postgres`.
- Dat werkt omdat beide stacks op dezelfde named network `bitemp-net` zitten.
- De network `bitemp-net` wordt automatisch aangemaakt door compose (als die nog niet bestaat).
- Beide stacks lezen variabelen uit `.env.docker`.

### 8.4 Updaten in Dockge

DB upgraden:
1. Pas `image: postgres:...` aan in de DB stack.
2. Redeploy de DB stack.

API upgraden:
1. Push nieuwe image tag (bijv. `v04.00.02`).
2. Pas `image: markwestbroek/bitemp-go-api:v04.00.02` aan in de API stack.
3. Redeploy de API stack.

Voordeel:
- API is eenvoudig vervangbaar.
- Data blijft staan in volume van de DB stack.
- Beheer via UI met behoud van reproduceerbare compose-config.

## 9. Veelvoorkomende fouten

### Fout: containernaam bestaat al

Melding:
`Conflict. The container name "/bitemp-go-api" is already in use`

Oplossing:

```powershell
docker rm -f bitemp-go-api
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

Extra:
- Commit geen `.env.docker` met echte secrets naar Git.

## 11. Image lifecycle en opruimbeleid

Om te voorkomen dat je Docker Hub-repo volloopt, gebruik een vast bewaarbeleid.

Aanbevolen beleid:
- Bewaar de laatste 10 versie-tags (bijv. `v04.00.01` t/m `v04.00.10`).
- Bewaar altijd 1 bewezen rollback-tag naast de huidige productie-tag.
- Verwijder pre-release/test-tags na validatie.

Voorbeeld (huidig + rollback):
- `current`: `v04.00.10`
- `rollback`: `v04.00.09`

### 11.1 Lokaal opruimen (build machine/server)

Verwijder ongebruikte images:

```bash
docker image prune -a
```

Verwijder een specifieke oude tag:

```bash
docker rmi markwestbroek/bitemp-go-api:v04.00.01
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
docker build --no-cache -t markwestbroek/bitemp-go-api:v04.00.02 .
docker push markwestbroek/bitemp-go-api:v04.00.02
```

### 12.2 Tag in stack bijwerken

Werk op de server in `.env.docker` bij:

```dotenv
API_IMAGE=markwestbroek/bitemp-go-api:v04.00.02
```

### 12.3 API redeployen

```bash
docker compose -f docker-compose.api-only.yml up -d
```

### 12.4 Smoke test

```bash
curl http://<server-ip>:8080/version
curl http://<server-ip>:8080/viz/index_schema.html
docker logs --tail 100 bitemp-go-api
```

### 12.5 Rollback (indien nodig)

Zet `API_IMAGE` terug naar de vorige stabiele tag en redeploy opnieuw:

```bash
docker compose -f docker-compose.api-only.yml up -d
```
