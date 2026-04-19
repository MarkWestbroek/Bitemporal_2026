# TrueNAS / Dockge Deployment Guide

> Datum eerste deployment: 17 april 2026
> Host: TrueNAS SCALE, IP `192.168.2.22`
> Dockge stack: `bitemp` → `/mnt/Pool1/share/Docker/Bitemporal/bitemp/`

---

## 1. Overzicht: wat draait er?

| Container               | Image                                          | Poort(en)         | Doel                        |
|------------------------|-------------------------------------------------|-------------------|-----------------------------|
| bitemp-postgres-06     | postgres:16-alpine                              | 5433              | Bitemp database             |
| bitemp-minio           | minio/minio                                     | 9000, 9001        | Bestandsopslag (S3)         |
| bitemp-go-api-06       | markwestbroek/bitemp-go-api:latest              | 8085              | Go API backend              |
| bitemp-viz-frontend    | markwestbroek/bitemp-viz-frontend:latest         | 8086              | Nginx + React frontend      |
| bitemp-openftv-db      | postgres:16-alpine                              | 5400              | OpenFTV database            |
| bitemp-openftv-manager | registry.gitlab.com/.../eam/manager:2.2.3       | 9010, 9110, 8110  | OpenFTV PAP+PIP             |
| bitemp-openftv-pdp     | registry.gitlab.com/.../eam/pdp:2.2.3           | 9004, 9104, 8104  | OpenFTV PDP (AuthZEN)       |
| bitemp-openftv-mi      | registry.gitlab.com/.../eam/management-interface:2.2.3 | 8180        | OpenFTV Management UI       |

**URLs:**
- Frontend: `http://192.168.2.22:8086/viz/react/`
- API direct: `http://192.168.2.22:8085/`
- OpenFTV MI: `http://192.168.2.22:8180/`
- Minio Console: `http://192.168.2.22:9001/`

---

## 2. Eerste deployment: doorlopen stappen en valkuilen

### 2.1 Dockge stack aanmaken
- Stack-naam = mapnaam in `/mnt/Pool1/share/Docker/Bitemporal/`
- Compose-bestand wordt opgeslagen als `compose.yaml` (niet `docker-compose.yml`)
- Als "stack bestaat al" error: map bestaat al → compose.yaml erin zetten, Dockge herkent het

### 2.2 Authz-bestanden aanmaken op TrueNAS
De `./authz/manager/` map moet handmatig aangemaakt worden op TrueNAS (wordt via volume gemount):

```bash
sudo mkdir -p /mnt/Pool1/share/Docker/Bitemporal/bitemp/authz/manager/{policies,bundles,tags,data}
```

Bestanden die nodig zijn:
- `authz/manager/policies/bitemp_authz.rego` — Rego autorisatiebeleid
- `authz/manager/bundles/bitemp-pdp.yaml` — Bundle config voor PDP
- `authz/manager/tags/tags.yaml` — Tag definitie

### 2.3 Valkuil: OpenFTV Policy package-naam
**Probleem**: De manager evalueert intern op OPA-pad `/authz`. Als je `package bitemp.authz` gebruikt, registreert de policy zich op `/bitemp/authz` → altijd "undefined".

**Oplossing**: De policy moet `package authz` gebruiken (niet `package bitemp.authz`).

### 2.4 Valkuil: OpenFTV bundle 403
**Probleem**: De PDP haalt bundles op via `GET /v1/bundle/bitemp-pdp` op de manager. Dit is een machine-to-machine verzoek zonder JWT. De policy moet dit expliciet toestaan.

**Oplossing**: Voeg deze regel toe aan `bitemp_authz.rego`:
```rego
allow if {
    input.resource.type == "service"
    startswith(input.resource.id, "/v1/bundle/")
}
```

### 2.5 Valkuil: `openftv_adl` database
**Probleem**: De PDP crasht als de `openftv_adl` database niet bestaat.

**Oplossing**: Na eerste start van `openftv-db`:
```bash
sudo docker exec bitemp-openftv-db psql -U openftv -c "CREATE DATABASE openftv_adl;"
```
Of gebruik `authz/init-db.sh` als Docker-entrypoint.

### 2.6 Valkuil: OpenFTV distroless images
De OpenFTV images zijn distroless (geen shell, geen wget, geen nc). Healthchecks met `CMD` werken niet. Gebruik `service_started` als depends_on conditie i.p.v. `service_healthy`.

### 2.7 Valkuil: `$` in wachtwoorden
**Probleem**: Het `$`-teken in env-variabelen (bijv. `ADMIN_PASSWORD=M$rk0k12bi`) wordt door de shell geïnterpreteerd als variabele.

**Oplossing**: Vermijd `$` in wachtwoorden in `.env`/Dockge, of escape met `$$`. Gebruik bijv. `Mark0k12bi`.

### 2.8 Valkuil: Secure cookies over HTTP
**Probleem**: `GIN_MODE=release` zorgde ervoor dat `Secure=true` op de auth-cookie werd gezet. Browsers slaan Secure cookies niet op over HTTP → login leek te werken maar sessie bleef niet bestaan.

**Oplossing**: Nieuwe env var `COOKIE_SECURE` (default `false`). Alleen op `true` zetten bij HTTPS.

### 2.9 Valkuil: Nginx DNS-cache na API recreate
**Probleem**: Na `docker compose up -d --force-recreate api` krijgt de API een nieuw IP. Nginx cached het oude IP → 502 Bad Gateway.

**Oplossing**: Altijd ook de frontend herstarten na een API recreate:
```bash
sudo docker restart bitemp-viz-frontend
```

### 2.10 Valkuil: minio-init stopt de stack
**Probleem**: `minio-init` (bucket-aanmaker) stopt na zijn taak. Dockge toont de hele stack als "gestopt".

**Oplossing**: `profiles: ["init"]` op minio-init, zodat hij alleen bij eerste opzet meedraait.

### 2.11 Go-versie in Dockerfiles
Bij upgrade van Go (bijv. 1.24 → 1.25), moeten **alle** Dockerfiles bijgewerkt worden:
- `Dockerfile`
- `Dockerfile.api`
- `Dockerfile.devloop`

---

## 3. Nieuwe versie deployen (cheatsheet)

### Backend (Go API) updaten

**Op je lokale machine (Windows, PowerShell):**
```powershell
cd D:\Git\Bitemporal_2026\bitemp_register_v06

# 1. Build het image
docker build -f Dockerfile.api -t markwestbroek/bitemp-go-api:latest .

# 2. Push naar Docker Hub
docker push markwestbroek/bitemp-go-api:latest
```

**Op TrueNAS:**
```bash
# 3. Pull het nieuwe image
sudo docker compose -f /mnt/Pool1/share/Docker/Bitemporal/bitemp/compose.yaml pull api

# 4. Recreate de API container
sudo docker compose -f /mnt/Pool1/share/Docker/Bitemporal/bitemp/compose.yaml up -d --force-recreate api

# 5. ALTIJD: herstart nginx (anders 502 door DNS-cache)
sudo docker restart bitemp-viz-frontend

# 6. Controleer logs
sudo docker logs bitemp-go-api-06 --tail 10
```

Of via Dockge: **Update** knop → **Opzetten**.

### Frontend (Vite/React) updaten

**Op je lokale machine (Windows, PowerShell):**
```powershell
cd D:\Git\Bitemporal_2026\bitemp_register_v06

# 1. Bouw Vite productie-build (optioneel, zit al in Docker build)
# Let op: PowerShell gebruikt ; als separator, niet &&
cd web\vite; npm run build; cd ..\..

# 2. Build het image
docker build -f Dockerfile.frontend -t markwestbroek/bitemp-viz-frontend:latest .

# 3. Push naar Docker Hub
docker push markwestbroek/bitemp-viz-frontend:latest
```

**Op TrueNAS:**
```bash
# 4. Pull en recreate
sudo docker compose -f /mnt/Pool1/share/Docker/Bitemporal/bitemp/compose.yaml pull frontend
sudo docker compose -f /mnt/Pool1/share/Docker/Bitemporal/bitemp/compose.yaml up -d --force-recreate frontend

# 5. Controleer
sudo docker logs bitemp-viz-frontend --tail 5
```

### Beide tegelijk updaten

**Op TrueNAS (na push van beide images):**
```bash
sudo docker compose -f /mnt/Pool1/share/Docker/Bitemporal/bitemp/compose.yaml pull
sudo docker compose -f /mnt/Pool1/share/Docker/Bitemporal/bitemp/compose.yaml up -d --force-recreate api frontend
```

---

## 4. Domeinnaam + SSL voor TrueNAS

### Kan dat?
Ja, dat kan. Er zijn meerdere routes:

### Optie A: Cloudflare Tunnel (aanbevolen, geen port-forwarding nodig)
1. **Domeinnaam** registreren bij een registrar (bijv. TransIP, Cloudflare, Namecheap)
2. **DNS beheren via Cloudflare** (gratis plan)
3. **Cloudflare Tunnel** (`cloudflared`) als Docker-container op TrueNAS:
   - Maakt een uitgaande verbinding naar Cloudflare (geen port-forwarding op router nodig)
   - SSL wordt automatisch afgehandeld door Cloudflare
   - Je configureert: `bitemp.jouwdomein.nl` → `http://localhost:8086`
   - Voordeel: NAS niet direct bereikbaar vanaf internet

```yaml
# Toevoegen aan compose:
cloudflared:
  image: cloudflare/cloudflared:latest
  container_name: bitemp-cloudflared
  restart: unless-stopped
  command: tunnel --no-autoupdate run
  environment:
    TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
  networks:
    - bitemp_net
```

### Optie B: Nginx Proxy Manager + Let's Encrypt
1. **Domeinnaam** + DNS A-record → publiek IP van je router
2. **Port-forwarding** op router: poort 80/443 → TrueNAS IP
3. **Nginx Proxy Manager** als Docker-container:
   - Beheert reverse proxy + automatische Let's Encrypt certificaten
   - Web UI voor configuratie
   - Route `bitemp.jouwdomein.nl` → `http://bitemp-viz-frontend:8080`

### Optie C: Caddy als reverse proxy
1. Vergelijkbaar met optie B, maar Caddy regelt SSL automatisch met minder configuratie
2. Eenvoudiger maar minder UI

### Aanbeveling
**Cloudflare Tunnel** als je geen port-forwarding wilt (veiligst).
**Nginx Proxy Manager** als je volledige controle wilt en port-forwarding acceptabel is.

Bij beide opties: zet daarna `COOKIE_SECURE=true` in de Dockge `.env`.

---

## 5. Relevante bestanden

| Lokaal pad                                      | TrueNAS pad                                              |
|-------------------------------------------------|----------------------------------------------------------|
| `docker-compose.truenas.yml`                    | `/mnt/Pool1/.../bitemp/compose.yaml`                     |
| `authz/manager/policies/bitemp_authz.rego`      | `/mnt/Pool1/.../bitemp/authz/manager/policies/...`       |
| `authz/manager/bundles/bitemp-pdp.yaml`         | `/mnt/Pool1/.../bitemp/authz/manager/bundles/...`        |
| `authz/manager/tags/tags.yaml`                  | `/mnt/Pool1/.../bitemp/authz/manager/tags/...`           |
| `.env` (lokaal)                                 | Dockge `.env` tab of handmatig `.env` bestand            |
