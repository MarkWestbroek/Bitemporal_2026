# VPS Deployment Guide — Omnium Studio op omnium-ide.nl

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

## 2. DNS: drie A-records, op twee plekken

Omnium krijgt een **eigen domein**: `omnium-ide.nl` (met `omnium-ide.com` defensief
ernaast). Bewust niet een subdomein van `common-ground-lab.nl` — dat is weliswaar
Marks eigen domein, maar het hoort bij een opdracht die kan aflopen, en Omnium is
breder dan Common Ground. De servernaam hangt om dezelfde reden aan `paratmos.nl`,
het eigen bedrijfsdomein.

Zodra het VPS-IP bekend is, drie A-records:

| Domein | Type | Naam | Waarde | Waarvoor |
|---|---|---|---|---|
| omnium-ide.nl | A | `@` | `<VPS-IP>` | landingspagina |
| omnium-ide.nl | A | `app` | `<VPS-IP>` | de Studio |
| paratmos.nl | A | `vps1` | `<VPS-IP>` | hostnaam van de server |

De hostnaam `vps1.paratmos.nl` bepaalt **niet** welke site een bezoeker krijgt — dat
doet Caddy op de Host-header. Hij verschijnt alleen in je shell-prompt, in de logs en
in mail die de server zelf verstuurt. Kun je bij mijn.host de reverse DNS (PTR) van
het IP zetten, zet die dan op dezelfde naam.

**Let op waar je moet zijn.** `omnium-ide.nl` registreer je bij mijn.host, dus die
twee records zet je in het mijn.host-paneel. `paratmos.nl` heeft zijn DNS bij
Quickhost (`ns1/ns2.exsilia.net`), dus het `vps1`-record maak je in Plesk. Zoek je
in het verkeerde paneel, dan vind je het domein niet.

Laat bij `paratmos.nl` de MX-records met rust — de mail loopt via
`mail.paratmos.nl` en die moet blijven staan.

Een *nieuw* record zit nergens in een cache, dus het werkt binnen minuten. Controle:
`dig +short A omnium-ide.nl app.omnium-ide.nl vps1.paratmos.nl`.

---

## 3. VPS bestellen

Eisen: **Ubuntu 24.04 of 26.04 LTS** (beide werken; Caddy publiceert één
repository voor alle versies en Docker ondersteunt `noble` én `resolute`), **2 vCPU / ≥ 4 GB RAM (8 GB als musicbrain er later bij komt)**,
**≥ 40 GB schijf**, datacenter in Nederland. Alleen images pullen — er wordt op de
VPS niets gebouwd, dus 4 GB is ruim voor Omnium alleen.

*Besteld: mijn.host VPS M, 2 cores / 8 GB / 40 GB, Rotterdam.* Met Omnium draaiend
is ±3 GB RAM en ±4 GB schijf in gebruik (september 2026). **Imprint bouwt wél op de
VPS**: de Next-sites prerenderen uit hun database, dus `deploy.sh` in het
Imprint-repo draait `docker build` op deze machine, één site tegelijk. Dat is de
zwaarste piek (reken op 1–2 GB extra tijdens een build). Loopt een build vast of
wordt hij gekilld: `free -h`, `dmesg | grep -i oom`, en zo nodig swap aanzetten.
Schijf: elke build laat cache achter; `docker builder prune` als `df -h` krap wordt.
Zie `docs/deploy-vps.md` in het Imprint-repo.

Kandidaten (prijzen 3 sep 2026): mijn.host VPS M (2/8 GB/40 GB, €15 actie / €25),
TransIP V3 (2/4 GB/100 GB NVMe, €20, AMS/RTM, snapshot inbegrepen), Hostinger KVM 2
(2/8 GB/100 GB, €7,99 actie / €14,99, let op vooruitbetaling).

Bij bestellen: je **SSH-publieke sleutel** meegeven (`cat ~/.ssh/id_ed25519.pub`; nog geen?
`ssh-keygen -t ed25519`). Wachtwoord-login gaat straks uit.

---

## 4. Basisinrichting (eenmalig, ±30 min)

Als root inloggen: `ssh root@<VPS-IP>`.

**Eerst DNS.** Het mijn.host-template zet `5.254.124.23` en `5.254.124.124` als
resolvers. Die zijn buiten gebruik (bevestigd door mijn.host-support, september
2026: "verouderde interne resolvers die niet meer actief zijn"). Zonder deze stap
blijft `apt update` hangen op "Resolving timed out". Dit geldt ook na elke
**herinstallatie** via het panel, want die rolt het template opnieuw uit. Een gewone
reboot houdt de instelling.

```bash
# Dode template-resolvers vervangen door publieke (advies van mijn.host zelf)
# Het template gebruikt geen netplan maar ifupdown (/etc/network/interfaces), en
# systemd-resolved staat uit: de resolvers staan alleen in resolv.conf. Controle:
grep -rn "5\.254" /etc/network /etc/netplan /etc/systemd 2>/dev/null   # verwacht: niets
rm -f /etc/resolv.conf
printf 'nameserver 1.1.1.1\nnameserver 9.9.9.9\nnameserver 8.8.8.8\n' > /etc/resolv.conf
chattr +i /etc/resolv.conf        # niemand overschrijft hem meer; wijzigen: eerst chattr -i
getent hosts archive.ubuntu.com      # moet direct een adres geven

# Updates + basis
apt update && apt -y upgrade
apt -y install ufw unattended-upgrades fail2ban curl git
dpkg-reconfigure -plow unattended-upgrades    # "Yes"

# Eigen gebruiker, geen root-login meer. Kies zelf een naam voor <gebruiker>; die hoort niet in
# deze (publieke) documentatie. Hij staat in je lokale ~/.ssh/config onder de alias van de VPS.
adduser --disabled-password --gecos "" <gebruiker>
usermod -aG sudo <gebruiker>
mkdir -p /home/<gebruiker>/.ssh && cp /root/.ssh/authorized_keys /home/<gebruiker>/.ssh/
chown -R <gebruiker>:<gebruiker> /home/<gebruiker>/.ssh && chmod 700 /home/<gebruiker>/.ssh
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
# → nu in een TWEEDE terminal testen: ssh <gebruiker>@<VPS-IP>   (pas daarna deze sluiten)

# Firewall: alleen ssh, http, https
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# Docker (officiële repo)
curl -fsSL https://get.docker.com | sh
usermod -aG docker <gebruiker>

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
ssh <gebruiker>@<VPS-IP> 'mkdir -p /srv/omnium/authz'
scp deploy/vps/docker-compose.vps.yml deploy/vps/backup.sh deploy/vps/.env.example <gebruiker>@<VPS-IP>:/srv/omnium/
scp -r authz/ <gebruiker>@<VPS-IP>:/srv/omnium/           # alleen nodig voor --profile authz
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
curl -sI https://omnium-ide.nl/         | head -3    # landingspagina, 200
curl -sI https://app.omnium-ide.nl/     | head -3    # 302 → /viz/react/
curl -s  https://app.omnium-ide.nl/version
```

Open in de browser: **https://app.omnium-ide.nl/viz/react/studio.html** en log in
als `ADMIN_USERNAME`. Blijft de sessie na een refresh bestaan? Dan klopt `COOKIE_SECURE`.

**Landingspagina.** Die staat in `web/omnium-studio/` en gaat mee naar deze machine —
geen aparte deploy-repo en geen Plesk meer nodig. Zet hem op de server neer:

```bash
scp -r web/omnium-studio/ <gebruiker>@<VPS-IP>:/tmp/www
ssh <gebruiker>@<VPS-IP> 'sudo mkdir -p /srv/omnium && sudo mv /tmp/www /srv/omnium/www && sudo chmod -R a+rX /srv/omnium/www'
```

De "Open de Studio"-links in die pagina's zijn relatief (`../vite/studio.html`) en
werken zo niet. Zet in `web/sync-omnium-website.ps1`
`$StudioUrl = "https://app.omnium-ide.nl/viz/react/studio.html"` en draai het script
vóór het kopiëren, dan worden ze herschreven.

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
sudo apt -y install cron rsync      # allebei afwezig op de minimal image; rsync is nodig voor de pull
chmod +x /srv/omnium/backup.sh
mkdir -p /srv/omnium/backups
/srv/omnium/backup.sh                      # één keer met de hand; controleer de map
crontab -e                                 # →  0 3 * * *  /srv/omnium/backup.sh >> /srv/omnium/backups/backup.log 2>&1
```

Elke nacht: `postgres.dump` (pg_dump `-Fc`), `minio.tgz`, een kopie van `.env` en een
manifest, **3 dagen** bewaard (`KEEP` in het script) — schijfruimte is op een
VPS de schaarse bron en de NAS bewaart de lange historie. De NAS haalt de map op — de VPS opent nooit een verbinding
naar huis: TrueNAS → *Data Protection* → *Rsync Tasks* → **Pull**, host `<VPS-IP>`, user
`<gebruiker>`, SSH-key van de NAS in `/home/<gebruiker>/.ssh/authorized_keys`, remote path
`/srv/omnium/backups/`, dagelijks om **06:00 lokale tijd** — de server draait op UTC, dus
cron 03:00 is 05:00 zomertijd. *Delete* uit: de VPS houdt drie dagen, de NAS bewaart
alles; grens dat op de NAS met periodieke ZFS-snapshots, niet in rsync.

**Imprint** (musicbrain.nl, imprint-engine.nl) heeft een eigen `backup.sh` en map:
cron `15 3 * * *` (een kwartier na Omnium), `/srv/imprint-backups/`. Op de NAS een
**tweede** Rsync Task met dezelfde instellingen en remote path `/srv/imprint-backups/`.
Details: `docs/deploy-vps.md` §Backups in het imprint-engine-repo. (Stand 21 september
2026: beide crons draaien, en beide NAS-taken halen elke dag om 06:00 op naar
`Pool1/backup/vps1/{omnium,imprint}`. Nog te doen: een snapshot-taak op die
dataset.)

Tussendoor, of als de NAS uitstaat, is dezelfde pull naar een laptop één regel
(buiten iCloud-mappen, want `env.txt` bevat de secrets):

```bash
rsync -av <gebruiker>@<VPS-IP>:/srv/omnium/backups/ ~/Backups/omnium/
```

Terugzetten: `pg_restore -U bitemp -d bitemp_go_db_v06 --clean postgres.dump` in de
postgres-container; `minio.tgz` uitpakken in het minio-volume.

**Los daarvan**: een provider-snapshot vóór elke grote wijziging (TransIP: inbegrepen;
anders optie). Een snapshot is een noodrem, geen backup.

---

## 9. Valkuilen (overgenomen uit TrueNAS §2, plus twee nieuwe)

- **Secure cookie over http** — lokaal via `curl http://127.0.0.1:8083` werkt inloggen niet
  (cookie wordt geweigerd). Dat is correct; test inloggen altijd via de https-URL.
- **502 na API-recreate** — opgelost in de frontend-image van na 2026-09-21: nginx zoekt de API
  per verzoek op (`resolver` + variabele upstream in `deploy/frontend/default.conf.template`).
  Gemeten: na het opnieuw aanmaken van de API op een ander IP antwoordt de nieuwe image direct;
  de oude bleef op 502 hangen tot een herstart. Draait er nog een **oudere** frontend-image, dan
  geldt de oude regel: `docker restart bitemp-viz-frontend` na `--force-recreate api`.
- **Frontend instellen zonder nieuwe image** — `API_UPSTREAM` (welke backend; `schema://host[:poort]`,
  zonder pad: met een pad weigert de container te starten), `FRAME_ANCESTORS` (wie de Studio in een
  iframe mag tonen; default `*`) en `NGINX_RESOLVER` (default `127.0.0.11`, de DNS van Docker).
  De opstartregel `frontend: API_UPSTREAM=…` in `docker logs` laat zien wat er geldt.
- **Publicatiepagina in een iframe** (bv. `pf…/viz/react/publicatie.html#/t/initiatieven` op
  commonground.nl) — in een iframe schakelt de pagina vanzelf naar embed-modus: alleen zoekveld,
  tabel en tabelnavigatie, zonder header, terug-link en titel (`web/vite/src/publicatie/embed.js`).
  Forceren kan met `?embed=1`, uitzetten met `?embed=0` (querystring vóór de `#`).
  De opmaak volgt dan commonground.nl (`publicatie/embed.css`, alleen onder `.cg-embed`):
  Rijksoverheid Sans 16px/24px, geladen van commonground.nl (CORS `*`, dus niet zelf gehost),
  zonder zebrastrepen, met het grijspalet van Pleio. Wijzigt Pleio de gehashte fontnamen, dan valt
  de tabel terug op sans-serif; pas dan de URL's in `embed.css` aan.
- **Na een deploy nog de oude pagina** (bv. het logo in het iframe) — de browser toonde een oude
  `publicatie.html` uit zijn cache, die naar de oude bundle verwijst. Sinds 22 september 2026 stuurt
  de frontend-nginx `Cache-Control: no-cache` voor alles onder `/viz/react/` behalve `assets/`
  (gehashte namen: een jaar `immutable`); zie `deploy/frontend/default.conf.template`. Met een
  oudere frontend-image: hard herladen (Cmd/Ctrl+Shift+R) of een privévenster.
- **Kolomkoppen als `Planning · startdatumPlanning`** — dan ontbreekt in die instantie een actieve
  standaard-`WeergaveDefinitie` voor het type, en toont de tabel de technische terugvalkolommen.
  Koppen, kolomkeuze, sortering en rijen per pagina zijn **data**, geen code: een nieuwe instantie
  (pf, app.omnium-ide.nl) heeft ze pas na het laden van de WeergaveDefinities (op de NAS: vier,
  o.a. `Initiatief`). Controle: `curl -s https://<host>/full/weergave_definities`.
  Laden: `replay files/registraties-replay-init-weergave-en-formulierdefinities-nas-2026-09-22.json`
  (vier WeergaveDefinities + de FormulierDefinitie voor Initiatief, actuele stand van de NAS), na
  de referentietabellen. Opnieuw maken vanaf een instantie:
  `python3 scripts/maak_definities_replay.py --bron <url> --uit <bestand>` — alleen de geldende
  versie per GE, geen historie. Het bestand bevat geen hostnaam; zet die er ook niet in (publiek repo).
- **`$` in wachtwoorden** — compose leest het als variabele. `.env.example` genereert ze zonder.
- **`minio-init` stopt** — hoort zo; daarom achter `--profile init`.
- **OpenFTV** — `openftv_adl` database, `package authz` in de rego, bundle-403: zie TrueNAS §2.3–2.6.
  Alleen relevant met `--profile authz`.
- **Let's Encrypt faalt** — bijna altijd: A-record wijst nog niet hierheen, of poort 80 dicht.
  `journalctl -u caddy` zegt welke.
- **Poort per ongeluk publiek** — `ss -tlnp | grep -v 127.0.0.1` mag alleen 22, 80, 443 tonen.
- **Alles hangt op "Resolving timed out"** (apt, `docker pull`, `git pull`, `npm ci` in
  een build, Let's Encrypt) — dan staat DNS weer op de dode template-resolvers, meestal
  na een herinstallatie. `cat /etc/resolv.conf` en §4 "Eerst DNS". Containers nemen de
  resolvers van de host over; met de host is ook elke build weer in orde.

---

## 10. Smoke test (vr 11 sep, daarna bevriezen)

Vanaf een **ander netwerk** (telefoon, 4G):

- [ ] `https://omnium-ide.nl/` toont de landingspagina, slotje groen
- [ ] `https://app.omnium-ide.nl/` → redirect naar `/viz/react/`, slotje groen
- [ ] "Open de Studio" op de landingspagina komt uit bij de Studio
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

**Vijf sites naast Omnium** (stand 21 september 2026), elk met een eigen map onder
`/srv` en hetzelfde patroon (git-checkout → `deploy/vps/deploy.sh` → container op een
loopback-poort → Caddy-blok):

| Site | Map | Poort | Repo |
|---|---|---|---|
| musicbrain.nl | `/srv/imprint` | 3000 | imprint-engine |
| imprint-engine.nl | `/srv/imprint` | 3100 | imprint-engine |
| editor.musicbrain.nl | `/srv/musicbrain-editor` | statisch | MusicBrain (GitHub Action) |
| volksgebouwzeist.nl | `/srv/volksgebouw` | 3200 | VolksgebouwZeist |
| psycholog.pi-utrecht.nl | `/srv/psycholog` | 3300 | ewa-psycholog |
| pf.common-ground-lab.nl | `/srv/omnium-pf` | 8084 (PG 5435, MinIO-console 9002) | dit repo, `docker-compose.pf.yml` + `pf.sh`; images op de VPS gebouwd |

De laatste twee zijn zelfstandige Next.js-repo's met hun eigen `deploy/vps/`-map.
Mail (contactformulier, later wachtwoord-vergeten) gaat via de relay van Quickhost:
`mail.<domein>` op poort **465** met SSL — 587 met STARTTLS weigert daar, en het kale
domein wijst na de verhuizing naar de VPS. Zie `docs/design/mail.md` in het
imprint-engine-repo.

**Imprint (musicbrain en de Imprint-site)** draait sinds 19 september 2026 naast
Omnium, als eigen compose-stack in `/srv/imprint` (git-checkout van het
imprint-engine-repo; runbook: `docs/deploy-vps.md` daar). Eén container per site
(imprint op `127.0.0.1:3100`, musicbrain straks op `:3000`) en een **eigen Postgres 17**
op `127.0.0.1:5434` — bewust niet de Postgres 16 van Omnium: andere versie, ander
repo en releaseritme, en een `down` van de ene stack mag de andere niet raken.
Caddy-blokken staan hierboven in `deploy/vps/Caddyfile`. (Het eerdere plan hier —
`/srv/musicbrain`, MariaDB, Next.js als systemd-service — is vervallen: Imprint
draait alleen nog op Postgres.)

**Plan B (NAS)** blijft `docker-compose.truenas.yml` + `TRUENAS_DEPLOYMENT.md` §4.
**Plan C** is `docker compose -f docker-compose.split.yml up` op de laptop.

---

## 12. Wat er verder op deze machine draait

De VPS is niet alleen van Omnium. Wie hier later `ufw status` of `ip addr` bekijkt
en zich afvraagt waarom poort 51820 open staat en er een `wg0` bestaat:

### 12.1 WireGuard-knooppunt (sinds 12 september 2026)

**Waarom.** Een MikroTik LHG LTE18 op een afgelegen locatie in Polen zit achter de
CGNAT van Plus (adres in `100.64.0.0/10`) en is van buiten onbereikbaar. De VPS heeft
wél een vast adres, dus beide kanten bellen naar de VPS en die zet ze aan elkaar.
Vanaf de laptop is daarna `http://192.168.188.1` (WebFig) en het LAN erachter
(camera's, later een NAS) bereikbaar alsof je ter plaatse bent.

**Opzet.**

| | adres | rol |
|---|---|---|
| VPS `wg0` | `10.10.0.1/24`, UDP 51820 | knooppunt, routeert tussen de peers, geen NAT |
| MikroTik | `10.10.0.2`, LAN `192.168.188.0/24` erachter | belt uit, `PersistentKeepalive 25` |
| laptop (macOS) | `10.10.0.3` | split tunnel: alleen `10.10.0.0/24` en `192.168.188.0/24` |

**Bestanden op de server.** `/etc/wireguard/wg0.conf` (root, 600) en
`/etc/wireguard/keys/` met `vps.key` en de drie `.pub`. De privésleutels van de
clients zijn na oplevering van de server verwijderd; die staan alleen in de
clientbestanden (laptop-`.conf`, MikroTik-invullijst) in Marks wachtwoordmanager.
Service: `wg-quick@wg0`, enabled.

**Wat er aan het systeem is veranderd — alleen toevoegingen:**

```bash
/etc/sysctl.d/99-wireguard.conf        # net.ipv4.ip_forward = 1 (stond al aan via Docker)
ufw allow 51820/udp
ufw route allow in on wg0 out on wg0   # DEFAULT_FORWARD_POLICY is DROP; dit is de enige route-regel
```

Docker zet zijn eigen `DOCKER-USER`/`DOCKER-FORWARD`-ketens vóór die van ufw, maar die
raken `wg0` niet. Pakketten `wireguard-tools` en `tcpdump` zijn erbij geïnstalleerd.
Met `tcpdump -ni eth0 udp port 51820` is aangetoond dat mijn.host geen firewall tussen
internet en de VPS heeft voor deze poort.

**Controleren.**

```bash
sudo wg show            # per peer: endpoint + "latest handshake" < ~2 min = verbonden
ping -c3 10.10.0.2      # MikroTik door de tunnel
ping -c3 192.168.188.1  # router-LAN via AllowedIPs (bewijst ook de MikroTik-firewall)
```

Aan de MikroTik-kant: `wg-vps` is toegevoegd aan de interfacelijst `LAN`, zodat de
defconf-regel *drop all not coming from LAN* de tunnel doorlaat. Zonder dat werkt de
tunnel wel, maar WebFig via de tunnel niet.

**Een peer toevoegen.** Sleutelpaar genereren (`wg genkey | tee x.key | wg pubkey`),
een `[Peer]`-blok met `AllowedIPs = 10.10.0.N/32` in `wg0.conf`, dan
`sudo wg syncconf wg0 <(sudo wg-quick strip wg0)` — zonder de tunnel te herstarten.

**Weghalen.** `sudo systemctl disable --now wg-quick@wg0`, de twee ufw-regels
verwijderen (`ufw status numbered` → `ufw delete N`), `/etc/wireguard` wissen.
