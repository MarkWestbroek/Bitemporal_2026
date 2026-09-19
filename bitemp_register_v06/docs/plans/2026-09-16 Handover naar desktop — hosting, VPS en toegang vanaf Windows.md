# Handover naar de desktop — hosting, VPS en toegang vanaf Windows (16 september 2026)

Tweede overdrachtsdocument van dezelfde dag. Het eerste
(`2026-09-16 Handover naar desktop — stand, open punten en valkuilen.md`) gaat over
Toegangsspraak, de release 0.8.0 en het inhoudelijke werk. Dit document gaat over wat
er *onder* de Studio zit: de hostingcrisis van 1 september, de VPS die daaruit is
gekomen, hoe Omnium daar draait, en wat je op de Windows-desktop moet regelen om daar
verder te kunnen. Het raakt ook het Imprint/MusicBrain-project; de kant van dat repo
staat in `imprint-engine/docs/overdracht.md` §0.

Het volledige runbook is `docs/VPS_DEPLOYMENT.md` (§0–§12). Dit document herhaalt dat
niet, maar zegt welke keuzes erachter zitten, wat de actuele stand is, en wat je niet
uit het runbook haalt.

---

## 1. Wat er is gebeurd (31 augustus – 16 september)

- **31 aug – 3 sep.** Na een Imprint-deploy bleek musicbrain.nl offline. Oorzaak lag
  niet bij Imprint: Quickhost (shared hosting, Plesk) heeft per 1 september Node.js en
  Passenger serverbreed uitgezet. Alle Node-sites daar geven sindsdien een Apache 403:
  musicbrain.nl, volksgebouwzeist.nl, psycholog.pi-utrecht.nl. Statische sites doen het
  nog (editor.musicbrain.nl geeft 200).
- **3 – 8 sep.** Hostingkeuze. Bekeken: Duocast (offerte, te duur), TransIP (8 GB ≈ €50),
  netcup (Amsterdam uitverkocht; de "bestelling" vz54467077 was alleen een
  €0-klantregistratie, geen VPS), Cloudflare-tunnel naar de NAS (afgewezen: NAS gaat uit,
  thuisverbinding), GitHub Actions + statisch naar Quickhost (afgewezen: Omnium heeft een
  Go-backend en Postgres). Keuze: **mijn.host .UNMANAGED .M** — 2 cores / 8 GB / 40 GB,
  Nederland, Ubuntu 26.04 LTS, €15 introductie → €25/maand excl. btw, maandelijks
  opzegbaar.
- **8 sep.** Domeinen geregistreerd bij mijn.host: **omnium-ide.nl** (in gebruik),
  plus **.com, .eu, .de, .be** (defensief; geen DNS, niets doorverwezen). `.pl` bewust
  niet. Hostnaam van de machine: **vps1.paratmos.nl** (eigen domein, los van klanten).
- **9 sep.** VPS geleverd, ingericht (§4 runbook), stack gedeployed, Caddy met
  Let's Encrypt, landingspagina uit `web/omnium-studio/` op het hoofddomein. Twee
  productiebugs gevonden en dezelfde avond/volgende ochtend gefixt (0.7.1: localStorage-
  quota in de profieleditor; 0.7.2: help-link naar GitHub).
- **10 sep.** Backups (nachtelijk op de VPS, kopie op de laptop), ontwerpdocument
  "Begeleiding in de Studio" + backlog §28, opdrachtbrief voor het lostrekken van de
  Imprint-engine (die brief is inmiddels in een tweede sessie uitgevoerd: fase 0 en 1).
- **11 – 15 sep.** WireGuard-knooppunt op de VPS (§12 runbook) zodat de MikroTik LTE-
  router in Polen (achter CGNAT) vanuit Nederland bereikbaar blijft. Getest vanaf een
  ander netwerk: WebFig via de tunnel werkt. FTV-demo op 15 sep (zie het andere
  handover-document).
- **16 sep.** Release 0.8.0 / api 0.6.0 uitgerold (andere sessie); dit document.

## 2. Besluiten en waarom

| Besluit | Waarom |
|---|---|
| VPS i.p.v. shared hosting | Omnium = Go-API + Postgres + MinIO in Docker; shared hosting kan dat niet en Quickhost heeft Node laten vallen. |
| mijn.host, NL | Nederlands, maandelijks opzegbaar, 8 GB voor €25; de rest was duurder, uitverkocht of Duits. |
| Ubuntu 26.04 LTS minimal | Nieuwste LTS; Docker- en Caddy-repo's ondersteunen hem. Nadeel: minimal image mist cron, rsync, wireguard-tools, tcpdump (inmiddels geïnstalleerd). |
| Caddy als reverse proxy | Automatische Let's Encrypt-certificaten en één leesbaar bestand; nginx zou handmatig certbot vragen. |
| Alle containerpoorten op 127.0.0.1 | Alleen Caddy is van buiten bereikbaar (80/443). Docker zet anders zijn eigen firewallregels vóór ufw. |
| omnium-ide.nl, niet een subdomein van common-ground-lab.nl | Eigen naam voor het product, los van de Common Ground-context. |
| Hostnaam op paratmos.nl | De machine gaat meer sites hosten dan Omnium (MusicBrain, Volksgebouw, PI Utrecht). |
| Geen gebruikersregistratie, wel logout | Trial-toegang is handmatig (SQL). Gebruikersbeheer-UI is het eerstvolgende werk (ander handover-document, punt 1). |
| WireGuard-hub op de VPS | De LTE-router in Polen zit achter CGNAT en is niet direct bereikbaar; de VPS heeft een vast adres. Laptop en router bellen beide naar de VPS. |

## 3. Wat er nu draait

**Machine**: vps1.paratmos.nl, IP 62.129.142.42 (alleen IPv4 in DNS; AAAA-records
bewust verwijderd — zie §7). Let op: **het A-record `vps1.paratmos.nl` wijst nog niet
naar de VPS** (het lost op naar 83.137.145.97, het paratmos-webhostingadres). Gebruik
tot dat gefixt is het IP in SSH- en WireGuard-instellingen. Open punt, zie §6.

**DNS** staat op twee panels: omnium-ide.nl (+ `app.`, `www.`) bij mijn.host;
vps1.paratmos.nl bij de registrar van paratmos.nl.

**Op de VPS** (`/srv/omnium/`, eigenaar `omnium`):

| Bestand/map | Wat |
|---|---|
| `docker-compose.vps.yml` | identiek aan `deploy/vps/` in het repo |
| `.env` | de enige plek met de productiegeheimen (`chmod 600`); niet in git, nergens anders |
| `.env.example` | kopie uit het repo |
| `Caddyfile` | kopie; **de live config is `/etc/caddy/Caddyfile`** (root). Verschilt van het repo alleen in een commentaarregel. |
| `backup.sh` | nachtelijk via cron (03:00 UTC = 05:00 CEST), houdt 3 sets; server-kopie mist alleen de commentaarkop uit het repo |
| `backups/` | `<datum>/db.dump` (pg_dump -Fc) + `minio.tgz` |
| `www/` | statische landingspagina omnium-ide.nl (kopie van `web/omnium-studio/`; bevat nog een README.md die weg kan) |

**Containers**: postgres 16, minio, `bitemp-go-api:0.6.0`, `bitemp-viz-frontend:0.8.0`
(nginx). Profielen `init` (bucket aanmaken, eenmalig) en `authz` (OpenFTV, uit).

**Caddy-sites**: `omnium-ide.nl` (statisch), `www.` (redirect), `app.omnium-ide.nl`
(→ 127.0.0.1:8083; `/` geeft 302 naar `/viz/react/`). Blokken voor omnium-ide.com en
musicbrain.nl staan als commentaar klaar.

**Accounts in de app**: twee persoonlijke accounts (één admin, één editor). De vijf
proefaccounts uit runbook §7 zijn **niet** aangemaakt.

**Beveiliging**: root-login en wachtwoordlogin via SSH uit; alleen de sleutel op de
laptop werkt (gebruiker `omnium`, sudo zonder wachtwoord). ufw: 22, 80, 443, 51820/udp,
plus forwarding binnen wg0. Verlies je de sleutel, dan is de VNC-console in het
mijn.host-panel de nooduitgang.

**WireGuard**: wg0 = 10.10.0.1/24. Peers: MikroTik LHG LTE18 (10.10.0.2, LAN
192.168.188.0/24 erachter; handshake elke paar minuten, endpoint wisselt door CGNAT)
en de laptop (10.10.0.3, split tunnel). Sleutels op de VPS in `/etc/wireguard/keys/`.
Voor MikroTik-beheer via de tunnel: WebFig op 192.168.188.1 met WireGuard aan.

**Backups buiten de VPS**: alleen een handmatige kopie op de laptop
(`~/Backups/omnium/`). De structurele rsync-pull door de NAS (06:00 lokale tijd, §8)
staat nog niet, de NAS was uit.

## 4. Toegang vanaf Windows regelen — doe dit terwijl de laptop nog binnen bereik is

Alles hieronder is per machine; niets ervan reist mee via git of Settings Sync.

### 4.1 SSH-sleutel

Op Windows (PowerShell; OpenSSH zit in Windows 10/11):

```powershell
ssh-keygen -t ed25519 -C "mark@windows" -f $env:USERPROFILE\.ssh\id_ed25519
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

De regel die dat toont (begint met `ssh-ed25519`) moet in `/home/omnium/.ssh/authorized_keys`
op de VPS **erbij**, niet erover. Vanaf de laptop, met de publieke sleutel in een bestand:

```bash
ssh omnium@62.129.142.42 'cat >> ~/.ssh/authorized_keys' < windows-key.pub
ssh omnium@62.129.142.42 'wc -l ~/.ssh/authorized_keys'    # 2 regels
```

Daarna in `%USERPROFILE%\.ssh\config` (nieuw bestand, geen extensie):

```
Host vps1
    HostName 62.129.142.42
    User omnium
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 5
```

Test: `ssh vps1`. Zet de passphrase in de Windows-ssh-agent
(`Get-Service ssh-agent | Set-Service -StartupType Automatic; Start-Service ssh-agent; ssh-add`).

### 4.2 WireGuard-peer voor de desktop (10.10.0.4)

1. Installeer WireGuard voor Windows, *Add empty tunnel*: die maakt zelf een sleutelpaar
   en toont de publieke sleutel. Vul aan:

   ```
   [Interface]
   PrivateKey = <staat er al>
   Address = 10.10.0.4/32

   [Peer]
   PublicKey = <publieke sleutel van de VPS, runbook §12>
   Endpoint = 62.129.142.42:51820
   AllowedIPs = 10.10.0.0/24, 192.168.188.0/24
   PersistentKeepalive = 25
   ```

2. Op de VPS de peer toevoegen — eerst live, dan blijvend:

   ```bash
   sudo wg set wg0 peer '<publieke sleutel van Windows>' allowed-ips 10.10.0.4/32
   sudo wg show wg0
   ```

   en hetzelfde als `[Peer]`-blok onderaan `/etc/wireguard/wg0.conf` (`sudo nano`), zodat
   het een herstart overleeft. Niet `wg-quick save` gebruiken: dat herschrijft het bestand
   en gooit de commentaren weg.

3. Op de MikroTik hoeft niets: de peer daar heeft `10.10.0.0/24` als Allowed Address,
   dus 10.10.0.4 mag er al door. Controleer dat wel even in WebFig als het niet werkt.

### 4.3 Docker Hub en images bouwen

`docker login` is per machine. Bouwen gaat op een Intel-Windows zonder `--platform`,
maar de vlag uit runbook §1 mag gewoon blijven staan. Commando's en tags: `docs/DOCKER_RELEASE.md`.

### 4.4 Backup ophalen

Windows heeft `scp`, geen `rsync` (wel via WSL of Git Bash):

```powershell
scp -r vps1:/srv/omnium/backups/ D:\Backups\omnium\
```

### 4.5 Terminalverschillen

De valkuilen van de afgelopen weken waren deels zsh-specifiek (`$S` als commando,
`/dev/udp`, heredocs na `&& \`). In PowerShell bestaan die niet, maar heredocs ook niet:
bestanden voor de server maak je lokaal in VS Code en zet je over met `scp`. Op de VPS
zelf is de shell bash; commando's uit het runbook werken daar ongewijzigd.

## 5. Terugkerende handelingen

**Nieuwe versie uitrollen** (compact; volledig in runbook §11 en `RELEASE.md`):
lokaal bumpen + `docker build`/`push` met versietag én `latest`; op de VPS:

```bash
cd /srv/omnium && ./backup.sh
nano .env                       # API_IMAGE / FRONTEND_IMAGE op de nieuwe tag
docker compose -f docker-compose.vps.yml pull
docker compose -f docker-compose.vps.yml up -d --force-recreate api frontend
curl -s https://app.omnium-ide.nl/version   # GET, geen HEAD
```

Rollback = vorige tag in `.env` en dezelfde twee compose-regels.

**Account aanmaken**: runbook §7 (bcrypt-hash via `htpasswd` in een container, dan
`INSERT INTO gebruiker …`). Wachtwoord vergeten = nieuwe hash met `UPDATE`.
Er is nog geen "wachtwoord wijzigen" in de app.

**Kijken of alles goed is**:

```bash
docker compose -f /srv/omnium/docker-compose.vps.yml ps
docker compose -f /srv/omnium/docker-compose.vps.yml logs --since 1h api
ls -la /srv/omnium/backups/           # nieuwe map van vannacht?
sudo wg show wg0                      # handshakes
sudo journalctl -u caddy --since today
```

**Bij Postgres of MinIO willen** (poorten staan alleen op localhost): SSH-tunnel,
`ssh -L 5432:127.0.0.1:5432 vps1`, dan lokaal verbinden op localhost:5432.

## 6. Open punten, op volgorde

1. **Windows-toegang** (§4) — vóór de laptop dicht gaat. Zonder tweede sleutel is de
   VNC-console de enige weg terug.
2. **A-record `vps1.paratmos.nl` → 62.129.142.42** zetten bij de registrar van
   paratmos.nl (nu wijst het naar het paratmos-webhostingadres).
3. **MusicBrain en de andere Quickhost-sites naar de VPS.** Eerst de data van Quickhost
   halen zolang die er nog is: Plesk-databaseexport, `.env` van de repo-root en
   `sites/musicbrain/.env.local` (INGEST_TOKEN, SESSION_SECRET), en de assetmap
   (`ASSET_ROOT`). Plan en volgorde: `imprint-engine/docs/overdracht.md` §0.
   Daarna Quickhost opzeggen.
4. **NAS-pull van de backups** inrichten (runbook §8): NAS-sleutel op de VPS,
   rsync-taak 06:00 lokale tijd. Tot die tijd af en toe handmatig `scp` (§4.4).
5. **2FA op mijn.host** (uitgesteld op 8 sep). GitHub-authenticator kan dezelfde app zijn.
6. **Proefaccounts** — of liever meteen de gebruikersbeheer-UI (ander handover, punt 1).
   `docs/AUTH_DEVELOPER_GUIDE.md` §11 beschrijft de huidige gang van zaken.
7. **Opruimen**: `README.md` uit `/srv/omnium/www/`; `web/sync-omnium-website.ps1`
   (synchroniseerde naar Quickhost) verwijderen of ombouwen naar `scp` naar de VPS.
8. **mijn.host-ticket over de dode resolvers**: nakijken of er antwoord is. De
   workaround (§7) blijft anders gewoon staan.
9. **Extra domeinen**: omnium-ide.com/.eu/.de/.be hebben geen DNS. Het Caddy-blok voor
   `.com` → `.nl` staat klaar; A-records erbij zetten of ze laten liggen.
10. **Duocast / netcup**: geen verplichtingen. Bij netcup bestaat alleen een klantaccount.
11. Optioneel: MikroTik op afstand herstarten per sms (`:cmd <secret> script <naam>`),
    en de serverkopie van `backup.sh` gelijktrekken met het repo (alleen commentaar).

## 7. Valkuilen die we al één keer zijn tegengekomen

- **DNS op de VPS.** De resolvers van mijn.host waren dood; `/etc/resolv.conf` staat
  hard op 1.1.1.1 / 9.9.9.9 / 8.8.8.8 en is met `chattr +i` onveranderbaar gemaakt
  (overleeft reboot, getest). Wil je hem ooit wijzigen: eerst `sudo chattr -i /etc/resolv.conf`.
  *Aanvulling 19 september:* support van mijn.host bevestigt dat de template-resolvers
  (5.254.124.23/.124) definitief buiten gebruik zijn en dat publieke resolvers de
  bedoelde oplossing zijn. Alleen een herinstallatie via het panel zet ze terug. Nog te
  controleren: of ze ook nog in `/etc/netplan/` staan. Uitgewerkt in
  `docs/VPS_DEPLOYMENT.md` §4 en §9.
- **AAAA-records.** mijn.host zet standaard AAAA-records naar een parkeeradres; daarmee
  faalt de Let's Encrypt-validatie. Verwijderd — en in het mijn.host-panel moet je na
  verwijderen nog apart op *Opslaan* klikken. ns1 liep achter op ns2/ns3.
- **cron rekent in UTC.** 03:00 in de crontab is 05:00 CEST en na 25 oktober 04:00 CET.
- **Docker vs ufw.** Docker's FORWARD-regels gaan vóór ufw. Poorten in de compose
  staan daarom op 127.0.0.1; zet ze nooit op 0.0.0.0 "om even te testen".
- **`set -e` + `grep -v`**: de crontab-installatie in één regel faalde stil omdat
  `grep -v` exit 1 geeft bij geen match. Runbook §8 heeft de goede vorm (`|| true`).
- **Bestanden die root schrijft** in `backups/` (de MinIO-tar) waren van root; de tar
  draait nu met `--user`. Als een pull ooit "permission denied" geeft: `ls -l` daar.
- **Studio en localStorage.** Sinds 0.7.1 slaat de profieleditor niet meer alle profielen
  op in localStorage. Hangt de Studio toch op een leeg scherm: `localStorage.clear()`
  in de browserconsole.
- **Help-link** wijst naar `docs/STUDIO.md` op GitHub; de ingebouwde markdown-server
  werkt niet in de image (geen `.git`). Backlog 27.1/27.3.
- **Plakken in de terminal**: meerdere regels tegelijk plakken en dan Ctrl+C stopt alleen
  het eerste commando. Wacht op een schone prompt voor je doorgaat.
- **`/version` antwoordt alleen op GET**; de Studio zit op `app.`, het hoofddomein geeft
  404 op app-paden (ander handover, punt 3).

## 8. Waar de geheimen zijn (en waar niet)

- Productiegeheimen: alleen `/srv/omnium/.env` op de VPS. Bij verlies van de VPS zijn ze
  weg; de backups bevatten ze niet. Zet ze in je wachtwoordmanager.
- WireGuard: privésleutels op de VPS (`/etc/wireguard/keys/`), en op de laptop in
  `~/Desktop/wireguard-omnium/` (**bevat ook de MikroTik-privésleutel** — verplaats
  naar de wachtwoordmanager en haal het van het bureaublad).
- SSH: `~/.ssh/id_ed25519` op de laptop (met passphrase), straks ook op Windows.
- Accounts: mijn.host (VPS + domeinen, nog zonder 2FA), Docker Hub, GitHub.
- App-wachtwoorden staan nergens leesbaar (bcrypt); resetten = nieuwe hash (§5).
- De sessie-export van deze laptop-sessie hoort in `docs/ai-chats/exports/` te komen
  (`scripts/export-claude-chats.py`), geredigeerd zoals `CLAUDE.md` voorschrijft: geen
  accountnamen, geen sleutels, geen wachtwoorden.
