# Docker — hoe we ermee omgaan

> Datum: 2026-07-29
> Doel: één afspraak over **welke images we publiceren, hoe we ze taggen en wanneer we pushen**.
> Dit is het *beleid*. De operationele how-to's staan elders:
> - [`docker.md`](../docker.md) — bouwen, compose-varianten, env-variabelen, troubleshooting.
> - [`TRUENAS_DEPLOYMENT.md`](TRUENAS_DEPLOYMENT.md) — de NAS/Dockge-kant (pull + recreate).
> - [`versiebeheer.md`](versiebeheer.md) — waar de versienummers vandaan komen (git-tags, semver).

---

## 1. Wat publiceren we?

De stack bestaat uit vier componenten; **twee daarvan bouwen we zelf** en publiceren we op
Docker Hub onder het account `markwestbroek`:

| Component | Image | Dockerfile | Bouwen wij? |
|-----------|-------|------------|-------------|
| Backend (Go API) | `markwestbroek/bitemp-go-api` | `Dockerfile.api` | **ja** |
| Frontend (Omnium Studio) | `markwestbroek/bitemp-viz-frontend` | `Dockerfile.frontend` | **ja** |
| Database | `postgres:16-alpine` | — | nee (upstream) |
| Filestore | `minio/minio` | — | nee (upstream) |

`Dockerfile` (all-in-one, API + frontend in één image) en `Dockerfile.devloop` zijn
**lokale ontwikkel-artefacten**; die pushen we niet naar Docker Hub.

## 2. Tag-conventie

**Elke release krijgt precies twee tags: het versienummer én `latest`.**

```
markwestbroek/bitemp-go-api:0.5.0        markwestbroek/bitemp-go-api:latest
markwestbroek/bitemp-viz-frontend:0.6.0  markwestbroek/bitemp-viz-frontend:latest
```

Regels:

1. **Kale semver, zonder `v`-prefix.** De docker-tag is het componentnummer uit
   [`versiebeheer.md`](versiebeheer.md) §7 zonder het `studio/`- of `api/`-prefix en zonder `v`:
   git-tag `studio/v0.6.0` → docker-tag `0.6.0`. Reden: dit sluit aan op wat er al op Hub staat
   (`bitemp-viz-frontend:0.2.0/0.2.1`) en op `package.json`.
2. **De generatie zit in de naam, niet in de tag.** `bitemp-go-api` is per definitie de v06-API;
   het oude schema `v06.00.01` is daarmee **vervallen** (zie §7).
3. **De versie-tag is onveranderlijk.** Eenmaal gepusht overschrijven we hem nooit. Een fix
   krijgt een nieuw nummer. Dit maakt rollback betrouwbaar: `pull :<vorige versie>`.
4. **`latest` beweegt mee** en wijst altijd naar de nieuwste gepubliceerde versie. De NAS/Dockge
   draait op `latest`; de versie-tag is het vangnet.
5. **Backend en frontend bewegen onafhankelijk.** Ze mogen verschillende nummers hebben — dat is
   normaal, geen fout. Wijzigde er niets in de Go-code sinds de vorige `api/`-tag, dan pushen we
   de backend gewoon opnieuw onder hetzelfde nummer of slaan we hem over.

### Waar komt het nummer vandaan?

| Component | Bron van waarheid | Controle |
|-----------|-------------------|----------|
| Frontend | `web/vite/package.json` → `"version"` | `vite.config.js` zet dit als `__APP_VERSION__` in de bundle; zichtbaar in "Over Omnium Studio" |
| Backend | git-tag met prefix `api/` | `git describe --tags --match 'api/*'` |

**Bump het nummer vóór de build**, niet erna — de frontend bakt zijn versie in de bundle,
dus een image dat je met het oude nummer bouwt liegt over zichzelf in de UI.

## 3. Platform: altijd `linux/amd64`

De TrueNAS-server is x86_64. Bouw je op een **Apple Silicon**-Mac, dan geeft `docker build`
standaard een arm64-image dat op de NAS niet start (`exec format error`). Geef dan expliciet
het platform mee:

```bash
docker build --platform linux/amd64 -f Dockerfile.api -t markwestbroek/bitemp-go-api:0.5.0 .
```

Op een Intel-Mac, Windows- of Linux-machine is dat niet nodig (die bouwen al amd64).
Controleer bij twijfel:

```bash
docker image inspect markwestbroek/bitemp-go-api:0.5.0 --format '{{.Os}}/{{.Architecture}}'
# → linux/amd64
```

## 4. Releaseprocedure

Vooraf eenmalig: `docker login` (Docker Hub-account `markwestbroek`, gebruik een
**access token** in plaats van je wachtwoord).

Alles vanuit `bitemp_register_v06/`.

### 4.1 Backend

```bash
API_VERSIE=0.5.0                       # = de api/-git-tag zonder prefix en 'v'
COMMIT=$(git rev-parse --short HEAD)
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

docker build -f Dockerfile.api \
  --build-arg COMMIT=$COMMIT \
  --build-arg BUILD_TIME=$BUILD_TIME \
  -t markwestbroek/bitemp-go-api:$API_VERSIE \
  -t markwestbroek/bitemp-go-api:latest .

docker push markwestbroek/bitemp-go-api:$API_VERSIE
docker push markwestbroek/bitemp-go-api:latest
```

De `COMMIT`/`BUILD_TIME` build-args landen via `-ldflags` in de binary en zijn opvraagbaar
op `GET /version` — sla ze dus niet over, anders staat er `dev` in de image.

### 4.2 Frontend

```bash
FE_VERSIE=$(node -p "require('./web/vite/package.json').version")

docker build -f Dockerfile.frontend \
  -t markwestbroek/bitemp-viz-frontend:$FE_VERSIE \
  -t markwestbroek/bitemp-viz-frontend:latest .

docker push markwestbroek/bitemp-viz-frontend:$FE_VERSIE
docker push markwestbroek/bitemp-viz-frontend:latest
```

De Vite-build zit ín de Dockerfile; een lokale `npm run build` vooraf is niet nodig.
Laat `VITE_API_BASE_URL` leeg tenzij de frontend een API op een *andere* origin moet aanspreken —
standaard proxiet nginx in dezelfde image door naar de API-container.

### 4.3 Uitrollen op de NAS

Zie [`TRUENAS_DEPLOYMENT.md`](TRUENAS_DEPLOYMENT.md) §3. Kort:

```bash
sudo docker compose -f /mnt/Pool1/share/Docker/Bitemporal/bitemp/compose.yaml pull
sudo docker compose -f .../compose.yaml up -d --force-recreate api frontend
sudo docker restart bitemp-viz-frontend      # altijd: anders 502 door nginx DNS-cache
```

### 4.4 Rollback

Zet in `.env.docker` (of in de Dockge-stack) de expliciete vorige versie-tag in plaats van
`latest` en redeploy:

```dotenv
API_IMAGE=markwestbroek/bitemp-go-api:0.5.0
FRONTEND_IMAGE=markwestbroek/bitemp-viz-frontend:0.5.0
```

## 5. Checklist per release

1. [ ] Werk op een branch, niet direct op `main`.
2. [ ] Frontend gewijzigd? → bump `web/vite/package.json` **en** de root-`"version"` in
       `package-lock.json`; werk `web/vite/CHANGELOG.md` bij ([Unreleased] → nieuwe sectie).
3. [ ] Backend gewijzigd? → bepaal het nieuwe `api/`-nummer en werk `RELEASE.md` bij.
4. [ ] Bouw beide images met versie-tag **én** `latest`; controleer `linux/amd64`.
5. [ ] Push beide tags.
6. [ ] Zet de annotated git-tag(s): `git tag -a studio/v0.6.0 -m "…"` / `api/v0.5.1`, en push die.
7. [ ] Rol uit op de NAS en doe de smoke-test (§6).
8. [ ] Ruim oude tags op volgens §6 van [`docker.md`](../docker.md) §11 (laatste ~10 bewaren).

## 6. Smoke-test na deploy

```bash
curl http://<server-ip>:8085/version                 # commit + buildtime moeten kloppen
curl -I http://<server-ip>:8086/viz/react/           # 200
docker logs --tail 50 bitemp-go-api-06
```

En in de UI: **Over Omnium Studio** moet het zojuist gepushte frontend-nummer tonen.

## 7. Wat is er veranderd t.o.v. het oude schema? (2026-07-29)

Historisch gebruikte [`docker.md`](../docker.md) tags als `v06.00.01`: een eigen teller die
losstond van `package.json` en van de git-tags. Dat schema is **vervallen** ten gunste van de
component-semver uit `versiebeheer.md` §7. De oude `v04.*`-tags op Docker Hub blijven staan als
archief; nieuwe pushes volgen §2.

Ook nieuw sinds deze datum: de backend krijgt naast `latest` **altijd** een versie-tag. Voorheen
werd de API alleen als `latest` gepusht, waardoor rollback naar een specifieke API-build
onmogelijk was.
