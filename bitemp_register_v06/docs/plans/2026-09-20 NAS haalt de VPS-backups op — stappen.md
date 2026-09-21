# NAS haalt de VPS-backups op — stappen

> **Bijgewerkt 21 september 2026: gedaan, op de snapshot-taak na.** Beide
> Rsync-taken (Omnium en Imprint) draaien dagelijks om 06:00 en zijn met
> **Run Now** getest: alle dagmappen staan op de NAS in
> `/mnt/Pool1/backup/vps1/{omnium,imprint}` (logisch 2,33 MB en 114 MB; ZFS
> comprimeert Omnium 4,9×). De NAS-sleutel staat alleen-lezen op de VPS via
> `rrsync`; de ACL laat alleen root in de mappen. Wat we tegenkwamen staat in
> §"Ervaringen" onderaan. Rest: stap 6, de snapshot-taak.
>
> Geschreven 19 september 2026, om de volgende dag af te werken.
> Achtergrond: `docs/VPS_DEPLOYMENT.md` §8 (dit repo) en `docs/deploy-vps.md`
> §Backups in het imprint-engine-repo.

## Waar het om gaat

Op de VPS (`62.129.142.42`, de deploy-gebruiker uit de lokale `~/.ssh/config`) draaien elke nacht twee backups:

| Stack | Script | Map op de VPS | Tijd (cron, UTC) |
|---|---|---|---|
| Omnium | `/srv/omnium/backup.sh` | `/srv/omnium/backups/` | 03:00 (05:00 zomertijd) |
| Imprint (musicbrain.nl, imprint-engine.nl) | `/srv/imprint/deploy/vps/backup.sh` | `/srv/imprint-backups/` | 03:15 (05:15 zomertijd) |

De VPS bewaart er **3 dagen** van. De NAS moet ze ophalen, anders staan de
backups op dezelfde machine als het origineel: dat helpt tegen een fout in de
admin, niet tegen het wegvallen van de VPS. De VPS belt nooit naar huis, de NAS
haalt op (pull).

Gecontroleerd op 19 september: beide crons draaien, `rsync` 3.4.1 en `rrsync`
staan op de VPS, poort 22 staat open.

Elke dagmap bevat `env.txt` met **alle productiegeheimen**. Het doel op de NAS
hoort dus niet in een gedeelde of gesynchroniseerde map.

## Stappen

### 1. Een plek op de NAS

Maak een dataset, bijvoorbeeld `<pool>/backups/vps1`, met twee submappen:
`omnium` en `imprint`. Alleen jouw beheerder mag erin; geen SMB-share erop.

### 2. Een SSH-sleutel voor de NAS

TrueNAS SCALE: **Credentials → Backup Credentials → SSH Keypairs → Add →
Generate Keypair**, naam bijvoorbeeld `vps1-backup`. Kopieer de **publieke**
sleutel (de regel die met `ssh-ed25519` of `ssh-rsa` begint).

De Rsync Task draait als een gebruiker op de NAS. Kijk bij het aanmaken (stap 4)
of je daar een keypair uit de keychain kunt kiezen. Kan dat niet in jouw versie,
dan moet de privésleutel in `~/.ssh/` van die NAS-gebruiker staan.

### 3. De sleutel op de VPS zetten, alleen-lezen

Vanaf de desktop (daar werkt `ssh vps1`). Plak de publieke sleutel van de NAS
tussen de enkele aanhalingstekens:

```powershell
ssh vps1 "printf '%s\n' 'command=\"rrsync -ro /srv/\",restrict ssh-ed25519 AAAA…  truenas-vps1-backup' >> ~/.ssh/authorized_keys"
ssh vps1 "tail -1 ~/.ssh/authorized_keys"
```

Wat het voorvoegsel doet: deze sleutel kan **alleen rsync-lezen onder `/srv/`**,
geen shell, geen schrijven, geen port forwarding. Wordt de NAS ooit gekraakt,
dan kan die sleutel niets op de VPS veranderen. Gevolg: in de Rsync Task is het
remote path **relatief aan `/srv/`** (zie de tabel in stap 4).

Let op: `printf '%s\n'` en niet `echo "…\n…"`. Met een letterlijke `\n` belandden
op 19 september twee sleutels op één regel, en de tweede werkte niet.

Liever geen beperking? Laat dan `command=…,restrict ` weg en gebruik de
volledige paden (`/srv/omnium/backups/` en `/srv/imprint-backups/`).

Ook mogelijk: stuur de publieke sleutel naar Claude, dan zet die hem erop.

### 4. Twee Rsync Tasks

**Data Protection → Rsync Tasks → Add**, twee keer:

| Veld | Omnium | Imprint |
|---|---|---|
| Path (lokaal, op de NAS) | `…/backups/vps1/omnium` | `…/backups/vps1/imprint` |
| User | je NAS-beheerder (die bij de sleutel kan) | idem |
| Direction | **Pull** | **Pull** |
| Rsync Mode | **SSH** | **SSH** |
| Remote Host | `62.129.142.42` | `62.129.142.42` |
| Remote SSH Port | 22 | 22 |
| Remote user | de deploy-gebruiker (naam in de lokale `~/.ssh/config`) | idem |
| Remote Path — met `rrsync`-beperking | `omnium/backups/` | `imprint-backups/` |
| Remote Path — zonder beperking | `/srv/omnium/backups/` | `/srv/imprint-backups/` |
| Schedule | dagelijks **06:00** | dagelijks **06:00** |
| Recursive, Times, Compress, Archive | aan | aan |
| **Delete** | **uit** | **uit** |

Waarom 06:00: dan zijn beide backups (05:00 en 05:15 zomertijd; in de winter
04:00 en 04:15) ruim klaar. Waarom *Delete* uit: de VPS gooit na 3 dagen weg,
de NAS moet dat juist niet overnemen.

Gebruik als host het **IP-adres**: het A-record van `vps1.paratmos.nl` wijst nog
naar de oude webhosting.

### 5. Proberen

Zet beide taken met **Run Now** aan het werk en controleer op de NAS:

- Er zijn dagmappen verschenen: `2026-09-…T03-00-01/` (Omnium) en
  `2026-09-19T19-53-12/` of later (Imprint).
- Imprint: per map `musicbrain.dump`, `imprint.dump`, twee `*-assets.tgz`,
  `env.txt` en `manifest.txt`. De musicbrain-assets zijn ongeveer 38 MB.
- Omnium: `postgres.dump`, `minio.tgz`, `env.txt`, `manifest.txt`.

Gaat het mis, kijk dan in de takenlog van TrueNAS. Veelvoorkomende oorzaken:
- "Permission denied (publickey)": de sleutel staat niet goed in
  `authorized_keys` (stap 3), of de taak draait als een andere NAS-gebruiker
  dan die de sleutel heeft.
- "Host key verification failed": log één keer met de hand in vanaf de shell
  van de NAS, als dezelfde gebruiker, en accepteer de sleutel van de VPS.
  Met `rrsync` levert dat geen shell op, en dat is goed; het gaat alleen om het
  accepteren.
- Een map die niet gevonden wordt: controleer het remote path. Met de
  `rrsync`-beperking is het relatief (`imprint-backups/`), zonder beperking
  absoluut.

### 6. Historie op de NAS

Zet een **Periodic Snapshot Task** op de dataset `…/backups/vps1`, bijvoorbeeld
dagelijks om 07:00, een maand bewaard. De rsync zonder *Delete* laat de mappen
toch al staan; de snapshots beschermen daarnaast tegen een taak die per
ongeluk iets overschrijft.

### 7. Afvinken

- Imprint-repo, `docs/backlog.md` §6: "Cron voor `backup.sh` + NAS-pull" op
  gedaan zetten.
- Dit repo, `docs/VPS_DEPLOYMENT.md` §8: de regel "beide NAS-taken moeten nog"
  aanpassen, en in de handover van 16 september §3 de alinea "Backups buiten
  de VPS" bijwerken.

## Ervaringen (21 september 2026)

Wat in TrueNAS SCALE anders bleek te werken dan hierboven beschreven:

- **`Validate Remote Path` uitvinken.** TrueNAS controleert dat pad met een
  los commando op de VPS, en dat mag de NAS-sleutel niet: die is vastgezet op
  `rrsync -ro /srv/`. Met het vinkje aan faalt de taak.
- **Remote Path is relatief**, juist door die beperking: `imprint-backups/` en
  `omnium/backups/`, niet `/srv/…`.
- **Twee velden heten "user"**: `User` bij Source is de gebruiker *op de NAS*
  die in de dataset schrijft (`root`), `Username` in de SSH-verbinding is de
  gebruiker *op de VPS* (de deploy-gebruiker; de naam staat in de lokale
  `~/.ssh/config`, bewust niet in dit openbare repo). Eén SSH-verbinding volstaat voor beide
  taken.
- **Setup Method "Semi-automatic" is voor TrueNAS↔TrueNAS.** Voor de VPS is het
  **Manual**, of je kiest in de taak "SSH private key stored in user's home
  directory" als de sleutel met `ssh-keygen` als root op de NAS is gemaakt
  (comment `root@truenas`).
- **Host-sleutel invullen mag gewoon**: dat is publieke informatie. De drie van
  de VPS (ed25519, RSA, ECDSA) zijn op 21 september vergeleken met
  `ssh-keyscan` en identiek. ed25519-vingerafdruk:
  `SHA256:WFqOuAQtODE35kBCz57wtlMLs15C/em5AslKNhtzbJ4`.
- **ACL op de dataset**: zet `Other` op `None` (recursief). In de dagmappen
  staan `env.txt`-bestanden met alle productiegeheimen van de VPS.
- De Imprint-backup bevat sinds 21 september ook de volumes en `.env` van
  volksgebouwzeist.nl en psycholog.pi-utrecht.nl (±120 MB per dagmap, vooral
  de MusicBrain-assets).
