# Docker Guide (API apart van database)

Deze handleiding beschrijft hoe je de API als losse Docker image bouwt en draait, terwijl PostgreSQL apart blijft draaien.

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

## 2. Image bouwen

Ga naar de map `bitemporal_go_API_v04` en build de image.

### PowerShell

```powershell
$commit = (git rev-parse --short HEAD)
$bt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
docker build --no-cache --build-arg COMMIT=$commit --build-arg BUILD_TIME=$bt -t bitemp-go-api:v04 .
```

### Bash

```bash
docker build --no-cache \
  --build-arg COMMIT=$(git rev-parse --short HEAD) \
  --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t bitemp-go-api:v04 .
```

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
  bitemp-go-api:v04
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
  bitemp-go-api:v04
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
# 1) Nieuwe image bouwen (voorbeeld tag v05)
$commit = (git rev-parse --short HEAD)
$bt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
docker build --no-cache --build-arg COMMIT=$commit --build-arg BUILD_TIME=$bt -t bitemp-go-api:v05 .

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
  bitemp-go-api:v05
```

Bijv.
```
docker run -d --name bitemp-go-api 
  -p 8080:8080
  -e DATABASE_URL="postgres://postgres:1234@host.docker.internal:5432/bitemp_go_db?sslmode=disable" 
  -e APP_ENV=production 
  -e GIN_MODE=release 
  -e ALLOW_DROP_TABLES=false 
  -e ADMIN_DROP_PASSWORD="kies-een-sterk-geheim" 
  --restart unless-stopped 
  bitemp-go-api:v04
```

## 6. Image delen zonder registry (bestand)

### Op bronmachine

```powershell
docker save -o bitemp-go-api_v04.tar bitemp-go-api:v04
```

Kopieer `bitemp-go-api_v04.tar` naar de doelmachine.

NAS: \\TRUENAS\share\Docker\Bitemporal\bitemp-go-api_v04.tar


### Op doelmachine

```powershell
docker load -i bitemp-go-api_v04.tar
docker run -d --name bitemp-go-api -p 8080:8080 -e DATABASE_URL="postgres://USER:PASSWORD@DB_HOST:5432/DB_NAME?sslmode=require" -e APP_ENV=production -e GIN_MODE=release -e ALLOW_DROP_TABLES=false -e ADMIN_DROP_PASSWORD="sterk-geheim" --restart unless-stopped bitemp-go-api:v04
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
  bitemp-go-api:v04
```

## 7. Image delen via registry (aanrader)

### Tag en push

```powershell
docker tag bitemp-go-api:v04 <registry-user>/bitemp-go-api:v04
docker push <registry-user>/bitemp-go-api:v04
```

Gedaan: `markwestbroek/bitemp-go-api`

### Op server pull en run

```powershell
docker pull <registry-user>/bitemp-go-api:v04
docker rm -f bitemp-go-api
docker run -d --name bitemp-go-api -p 8080:8080 -e DATABASE_URL="postgres://..." --restart unless-stopped <registry-user>/bitemp-go-api:v04
```

## 8. Veelvoorkomende fouten

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

## 9. Security advies

Gebruik in productie:
- `APP_ENV=production`
- `GIN_MODE=release`
- `ALLOW_DROP_TABLES=false`
- Sterk `ADMIN_DROP_PASSWORD`
- Sterke DB credentials
- `sslmode=require` (of strenger) waar mogelijk
