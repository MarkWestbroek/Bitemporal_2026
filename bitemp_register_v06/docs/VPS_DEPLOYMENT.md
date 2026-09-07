# VPS Deployment Guide — Omnium Studio op omnium.common-ground-lab.nl

> Datum: 4 september 2026. Doel: Omnium Studio publiek online vóór de demo's van
> **maandag 14 en dinsdag 15 september 2026**, met proefaccounts voor bezoekers.
> Aanleiding: Quickhost heeft per 1 september Node.js/Passenger van de shared
> hosting gehaald; alles wat een langlopend proces nodig heeft verhuist naar een VPS.
>
> Dit is de VPS-tegenhanger van [`TRUENAS_DEPLOYMENT.md`](TRUENAS_DEPLOYMENT.md).
> De stack is dezelfde; de bestanden staan in [`deploy/vps/`](../deploy/vps/).
> Tag-beleid voor images: [`DOCKER_RELEASE.md`](DOCKER_RELEASE.md).

---

## 0. Wat is anders dan op de NAS

| | TrueNAS (thuis) | VPS (publiek) |
|---|---|---|
| Bereikbaar voor | alleen het LAN | iedereen |
| Poorten | alles gepubliceerd op het LAN-IP | **niets** op het publieke IP; alleen de frontend op `127.0.0.1:8083`, Caddy ervoor |
| HTTPS | nee | ja, Caddy + Let's Encrypt, automatisch |
| Auth | uit of standaardwachtwoorden | `AUTH_ENABLED=true`, `COOKIE_SECURE=true`, sterke secrets uit `.env` |
| OpenFTV | altijd mee | achter `--profile authz`, alleen als de demo het nodig heeft |
| Backups | ZFS | `backup.sh` nachtelijk → de NAS **haalt** ze op (pull over SSH) |

Wat hetzelfde blijft: dezelfde images van Docker Hub, dezelfde containernamen,
dezelfde valkuilen (§9). Alles uit het TrueNAS-cheatsheet werkt hier ook.

### Planning

| Wanneer | Wat | § |
|---|---|---|
| vr 4 – zo 6 sep | Studio-versie bumpen, images bouwen en pushen; A-record klaarzetten | 1, 2 |
| ma 7 / di 8 sep | **Uiterste datum antwoord Quickhost.** Anders zelf VPS bestellen; basisinrichting | 3, 4 |
| wo 9 / do 10 sep | Stack + Caddy live, proefaccounts, test vanaf een ander netwerk | 5, 6, 7 |
| vr 11 sep | Backup draait, smoke test, **bevriezen** | 8, 10 |
| za 12 / zo 13 sep | niets deployen | — |
| ma 14 / di 15 sep | demo (plan B: NAS, plan C: laptop/localhost) | — |
| daarna | musicbrain + imprint naar dezelfde VPS | 11 |

---

## 1. Images bouwen en pushen (lokaal, vóór alles)

De images op Docker Hub zijn van 29 juli (`bitemp-go-api:0.5.0`, `bitemp-viz-frontend:0.6.0`).
Sindsdien: **0** Go-wijzigingen (backend hoeft niet opnieuw), **23** frontend-commits
(diagram-export, kader-selectie, ArchiMate-motivation). De frontend moet dus opnieuw.

```bash
cd ~/Documents/GitHub/Bitemporal_2026/bitemp_register_v06

# 1. Versie bumpen (bakt in de "Over Omnium Studio"-dialoog): 0.6.0 → 0.7.0
#    in web/vite/package.json, [Unreleased] in web/vite/CHANGELOG.md → [studio/v0.7.0]
#    git commit + git tag studio/v0.7.0

# 2. Bouwen — altijd linux/amd64 (de VPS), ook al is deze Mac Intel
docker build -f Dockerfile.frontend --platform linux/amd64 \
  -t markwestbroek/bitemp-viz-frontend:0.7.0 \
  -t markwestbroek/bitemp-viz-frontend:latest .

# 3. Pushen (beide tags)
docker push markwestbroek/bitemp-viz-frontend:0.7.0
docker push markwestbroek/bitemp-viz-frontend:latest
```

Controle: `curl -s https://hub.docker.com/v2/repositories/markwestbroek/bitemp-viz-frontend/tags | grep -o '"name":"[^"]*"'`.

---

## 2. DNS: A-record in Plesk

`common-ground-lab.nl` staat met DNS bij Quickhost; dat blijft zo (DNS is geen Node).
Zodra het VPS-IP bekend is:

Plesk → *Websites & Domains* → common-ground-lab.nl → *DNS Settings* → *Add Record*:

| Type | Naam | Waarde | TTL |
|---|---|---|---|
| A | `omnium` | `<VPS-IP>` | 300 |

Niets anders aanraken: het hoofddomein, de `www`, de MX-records (mail loopt via
`cordelia.exsilia.net`) en de bestaande site op `/studio/` blijven staan. Een *nieuw*
record zit nergens in een cache, dus het werkt binnen minuten. Controle:
`dig +short A omnium.common-ground-lab.nl`.

---

## 3. VPS bestellen

Eisen: **Ubuntu 24.04 LTS**, **2 vCPU / ≥ 4 GB RAM (8 GB als musicbrain er later bij komt)**,
**≥ 40 GB schijf**, datacenter in Nederland. Alleen images pullen — er wordt op de
VPS niets gebouwd, dus 4 GB is ruim voor Omnium alleen.

Kandidaten (prijzen 3 sep 2026): mijn.host VPS M (2/8 GB/40 GB, €15 actie / €25),
TransIP V3 (2/4 GB/100 GB NVMe, €20, AMS/RTM, snapshot inbegrepen), Hostinger KVM 2
(2/8 GB/100 GB, €7,99 actie / €14,99, let op vooruitbetaling).

Bij bestellen: je **SSH-publieke sleutel** meegeven (`cat ~/.ssh/id_ed25519.pub`; nog geen?
`ssh-keygen -t ed25519`). Wachtwoord-login gaat straks uit.

---

## 4. Basisinrichting (eenmalig, ±30 min)

Als root inloggen: `ssh root@<VPS-IP>`.

```bash
# Updates + basis
apt update && apt -y upgrade
apt -y install ufw unattended-upgrades fail2ban curl git
dpkg-reconfigure -plow unattended-upgrades    # "Yes"

# Eigen gebruiker, geen root-login meer
adduser --disabled-password --gecos "" omnium
usermod -aG sudo omnium
mkdir -p /home/omnium/.ssh && cp /root/.ssh/authorized_keys /home/omnium/.ssh/
chown -R omnium:omnium /home/omnium/.ssh && chmod 700 /home/omnium/.ssh
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
# → nu in een TWEEDE terminal testen: ssh omnium@<VPS-IP>   (pas daarna deze sluiten)

# Firewall: alleen ssh, http, https
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# Docker (officiële repo)
curl -fsSL https://get.docker.com | sh
usermod -aG docker omnium

# Caddy (officiële repo)
apt -y install debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt -y install caddy
```

Docker publiceert poorten normaal *langs* ufw heen. In deze stack staat alles op
`127.0.0.1`, dus dat is hier geen gat — maar daarom staat het ook zo in de compose.
Voeg nooit een `"9001:9001"` zonder `127.0.0.1:` toe.

---

## 5. Stack deployen

Vanaf nu als `omnium`. Bestanden van je Mac naar de VPS:

```bash
# op je Mac
cd ~/Documents/GitHub/Bitemporal_2026/bitemp_register_v06
ssh omnium@<VPS-IP> 'mkdir -p /srv/omnium/authz'
scp deploy/vps/docker-compose.vps.yml deploy/vps/backup.sh deploy/vps/.env.example omnium@<VPS-IP>:/srv/omnium/
scp -r authz/ omnium@<VPS-IP>:/srv/omnium/           # alleen nodig voor --profile authz
```

Op de VPS:

```bash
cd /srv/omnium
cp .env.example .env && chmod 600 .env
for i in 1 2 3 4 5; do openssl rand -base64 30 | tr -d '/+=$'; done   # vijf secrets
nano .env        # POSTGRES_PASSWORD, MINIO_SECRET_KEY, ADMIN_DROP_PASSWORD, JWT_SECRET, ADMIN_PASSWORD

docker compose -f docker-compose.vps.yml pull
docker compose -f docker-compose.vps.yml up -d
docker compose -f docker-compose.vps.yml --profile init up minio-init     # bucket, eenmalig
docker compose -f docker-compose.vps.yml ps                                # alles "healthy"/"running"?
docker logs bitemp-go-api-06 --tail 30                                     # "admin gebruiker aangemaakt", geen DB-fouten

curl -s http://127.0.0.1:8083/version            # via nginx → API
curl -sI http://127.0.0.1:8083/viz/react/studio.html | head -1
```

`/srv/omnium` is de compose-projectnaam; de volumes heten daardoor
`omnium_bitemp_postgres_data` en `omnium_bitemp_minio_data` (zo verwacht `backup.sh` ze).

---

## 6. Caddy: domein + HTTPS

```bash
sudo cp /srv/omnium/Caddyfile /etc/caddy/Caddyfile     # of: scp deploy/vps/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -n 30 --no-pager             # "certificate obtained successfully"
```

Voorwaarde: het A-record (§2) wijst al naar deze machine en poort 80/443 staan open (§4);
anders kan Let's Encrypt de uitdaging niet doen. Test van buiten:

```bash
curl -sI https://omnium.common-ground-lab.nl/ | head -3        # 302 → /viz/react/
curl -s  https://omnium.common-ground-lab.nl/version
```

Open in de browser: **https://omnium.common-ground-lab.nl/viz/react/studio.html** en log in
als `ADMIN_USERNAME`. Blijft de sessie na een refresh bestaan? Dan klopt `COOKIE_SECURE`.

**Landingspagina koppelen.** De "Open de Studio"-links op common-ground-lab.nl/studio/
zijn nu relatief en dood. Zet in `web/sync-omnium-website.ps1`
`$StudioUrl = "https://omnium.common-ground-lab.nl/viz/react/studio.html"`, draai het
script, push de omnium-website-repo; Plesk deployt (dat is statisch en werkt nog).

---

## 7. Proefaccounts

Er is geen gebruikersbeheer-UI ([`AUTH_DEVELOPER_GUIDE.md`](AUTH_DEVELOPER_GUIDE.md) §11);
gebruikers gaan rechtstreeks de tabel `gebruiker` in. Bcrypt-hash maken zonder iets te
installeren:

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbBC 10 "" 'Proef-2026-A' | tr -d ':\n'; echo
```

Dan op de VPS (`docker compose -f docker-compose.vps.yml exec postgres psql -U bitemp -d bitemp_go_db_v06`):

```sql
INSERT INTO gebruiker (gebruikersnaam, wachtwoord_hash, email, rol, actief) VALUES
  ('demo1', '$2y$10$...', NULL, 'editor', true),
  ('demo2', '$2y$10$...', NULL, 'editor', true),
  ('demo3', '$2y$10$...', NULL, 'editor', true),
  ('demo4', '$2y$10$...', NULL, 'editor', true),
  ('demo5', '$2y$10$...', NULL, 'editor', true)
ON CONFLICT (gebruikersnaam) DO NOTHING;
```

Rollen: `viewer` kijkt, `editor` modelleert, `admin` alles. Proefaccounts = `editor`.
Eén wachtwoord per account, op een kaartje bij de demo; **na afloop** allemaal uit:

```sql
UPDATE gebruiker SET actief = false WHERE gebruikersnaam LIKE 'demo%';
```

Misbruik beperken zit niet in de app (geen signup, geen quota) — met alleen handmatig
aangemaakte accounts is dat voor een demo voldoende. Wil je later open aanmelden, dan
hoort rate-limiting en een quotum per account in de API, niet in de server.

---

## 8. Backups: VPS schrijft, NAS haalt op

```bash
chmod +x /srv/omnium/backup.sh
mkdir -p /srv/omnium/backups
/srv/omnium/backup.sh                      # één keer met de hand; controleer de map
crontab -e                                 # →  0 3 * * *  /srv/omnium/backup.sh >> /srv/omnium/backups/backup.log 2>&1
```

Elke nacht: `postgres.dump` (pg_dump `-Fc`), `minio.tgz`, een kopie van `.env` en een
manifest, 14 dagen bewaard. De NAS haalt de map op — de VPS opent nooit een verbinding
naar huis: TrueNAS → *Data Protection* → *Rsync Tasks* → **Pull**, host `<VPS-IP>`, user
`omnium`, SSH-key van de NAS in `/home/omnium/.ssh/authorized_keys`, remote path
`/srv/omnium/backups/`, dagelijks om 04:00.

Terugzetten: `pg_restore -U bitemp -d bitemp_go_db_v06 --clean postgres.dump` in de
postgres-container; `minio.tgz` uitpakken in het minio-volume.

**Los daarvan**: een provider-snapshot vóór elke grote wijziging (TransIP: inbegrepen;
anders optie). Een snapshot is een noodrem, geen backup.

---

## 9. Valkuilen (overgenomen uit TrueNAS §2, plus twee nieuwe)

- **Secure cookie over http** — lokaal via `curl http://127.0.0.1:8083` werkt inloggen niet
  (cookie wordt geweigerd). Dat is correct; test inloggen altijd via de https-URL.
- **502 na API-recreate** — nginx in de frontend-container cachet het oude API-IP.
  Altijd `docker restart bitemp-viz-frontend` na `--force-recreate api`.
- **`$` in wachtwoorden** — compose leest het als variabele. `.env.example` genereert ze zonder.
- **`minio-init` stopt** — hoort zo; daarom achter `--profile init`.
- **OpenFTV** — `openftv_adl` database, `package authz` in de rego, bundle-403: zie TrueNAS §2.3–2.6.
  Alleen relevant met `--profile authz`.
- **Let's Encrypt faalt** — bijna altijd: A-record wijst nog niet hierheen, of poort 80 dicht.
  `journalctl -u caddy` zegt welke.
- **Poort per ongeluk publiek** — `ss -tlnp | grep -v 127.0.0.1` mag alleen 22, 80, 443 tonen.

---

## 10. Smoke test (vr 11 sep, daarna bevriezen)

Vanaf een **ander netwerk** (telefoon, 4G):

- [ ] `https://omnium.common-ground-lab.nl/` → redirect naar `/viz/react/`, slotje groen
- [ ] `http://` → wordt `https://`
- [ ] `/version` geeft commit + buildtime van de gepushte image
- [ ] Studio opent, inloggen als `demo1`, sessie overleeft een refresh
- [ ] Model maken, opslaan, opnieuw laden — staat het er nog (Postgres + MinIO)?
- [ ] Diagram-export werkt (dat is de fix van deze release)
- [ ] `ss -tlnp | grep -v 127.0.0.1` op de VPS: alleen 22/80/443
- [ ] `/srv/omnium/backups/` heeft een map van vannacht; NAS heeft dezelfde
- [ ] Provider-snapshot gemaakt
- [ ] Wachtwoordkaartjes demo1–5 klaar

Na deze lijst: **niets meer deployen tot na dinsdag 15.**

---

## 11. Volgende versie / later

**Updaten** (zelfde als TrueNAS §3):

```bash
cd /srv/omnium
docker compose -f docker-compose.vps.yml pull
docker compose -f docker-compose.vps.yml up -d --force-recreate api frontend
docker logs bitemp-go-api-06 --tail 10
```

Rollback: `FRONTEND_IMAGE=markwestbroek/bitemp-viz-frontend:0.6.0` in `.env`, zelfde commando.

**musicbrain en imprint erbij** (na de demo): eigen map `/srv/musicbrain`, MariaDB als
container of `apt install mariadb-server`, Next.js als systemd-service (of container) op
`127.0.0.1:3000`, en één blok in de Caddyfile — zie het commentaar onderin
`deploy/vps/Caddyfile`. De Imprint-repo krijgt daarvoor een eigen deploy-hoofdstuk.

**Plan B (NAS)** blijft `docker-compose.truenas.yml` + `TRUENAS_DEPLOYMENT.md` §4.
**Plan C** is `docker compose -f docker-compose.split.yml up` op de laptop.
