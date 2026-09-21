# Opdracht — tweede Omnium-instantie op pf.common-ground-lab.nl

> Datum: 21 september 2026. Opgesteld in een sessie in het imprint-engine-repo,
> uit te voeren in dít repo. **Start pas nadat Mark zijn lopende backend-werk
> naar `main` heeft gemerged.**
> Besluiten van Mark staan in §2; open vragen in §8.

## 1. Wat en waarom

Naast de bestaande Studio op **app.omnium-ide.nl** (alle domeinen) komt een
tweede, zelfstandige instantie op **pf.common-ground-lab.nl**: een
"live register" voor het Common Ground-portfolio, met alleen de domeinen die
daarvoor nodig zijn, gevuld met de CG-replaybestanden.

Uitgangspunt: **één frontend-image en één API-image voor beide instanties.** Wat
verschilt, is instelling: welke backend de frontend bedient en welke domeinen de
backend aanbiedt. Geen aparte build per instantie.

## 2. Besluiten (Mark, 21 september 2026)

| Vraag | Besluit |
|---|---|
| Domeinen | `register` + `CG` + een vaste **kern**: `gegevenstypen`, `extra`, `configuratie`, `ide-bestanden` |
| `abuvwxy` | **niet** in de kern: dat was een testmodel, ballast voor een live register |
| Adres | `pf.common-ground-lab.nl` |
| Data | de CG-replaybestanden (en het CG-domein zelf) — zie §6 |
| Uitvoering | in dít repo, inclusief VPS en Caddy, ná het mergen van Marks backend-werk |

## 3. Stand van de code (onderzocht 21 september 2026)

**De frontend vindt zijn backend via zijn eigen adres.** Alle API-calls zijn
relatief (`/api/…`, `/full/…`, `/graphql/query`, `/registraties`, `/admin/…`):
`web/vite/src/shared/apiBase.js:13-15` geeft `""` terug buiten de Vite-dev-
poorten. De nginx in de frontend-container stuurt alles behalve `/viz/react/`
door naar de backend: **`nginx.frontend.conf:24`, `proxy_pass http://api:8080;`
— hard-coded**, als statische `default.conf` gekopieerd in
`Dockerfile.frontend:57`. Er is geen runtime-config (`window.__CONFIG__`,
`config.json`) en geen backend-kiezer.

**Een domein is gecompileerde Go-code**, geen database-inhoud. Elk domein
registreert zijn types in `model.MetaRegistry` via een `init*MetaRegistry()`-
aanroep in `model/metaregistry_plumbing.go:409-475` (door `cmd/codegen`
gegenereerd). Routes (`routes/addroutes_helper.go:11-38`), tabellen
(`dbsetup/createmodeltables.go:34-60`), GraphQL (`dynql.BuildSchema`,
`main.go:178`) en OpenAPI (`handlers/openapi_generator.go:65`) itereren allemaal
over die registry, zonder filter. Er is **geen** `ENABLED_DOMAINS` of
vergelijkbare instelling. Een tweede instantie met alleen een lege database zou
dus nog steeds alle domeinen tonen.

Domeinlabels in de registry: `abuvwxy`, `register`, `np-loc`, `CG` (hoofdletters!),
`configuratie`, `financieel`, `ide-bestanden`, `kennis2`, `extra` (alleen
datatypes), `gegevenstypen`, `org-geo`. `propageerDomeinNaarOnderliggende()`
(r.478-513) zet het domein ook op onderliggende types.

**Compose**: `deploy/vps/docker-compose.vps.yml` heeft vaste `container_name`s
(`bitemp-postgres-06`, `bitemp-minio`, `bitemp-go-api-06`,
`bitemp-viz-frontend`) en vaste netwerknamen; een tweede stack botst daarop.
`FRONTEND_PORT`, `PG_PORT`, images, database, bucket en auth zijn wél via `.env`
instelbaar.

## 4. Werkpakketten

### A. Frontend: backend instelbaar in de proxy (±1 uur)

- Maak van `nginx.frontend.conf` een template
  (`/etc/nginx/templates/default.conf.template`; de officiële nginx-image vult
  `${…}` bij het starten in via envsubst) met `proxy_pass ${API_UPSTREAM};`.
  **Default `http://api:8080`**, zodat de bestaande deploy ongewijzigd werkt.
- Zet er `resolver 127.0.0.11 valid=30s;` bij en gebruik een variabele
  upstream (`set $api …; proxy_pass $api;`). Dan resolvet nginx de API per
  verzoek en verdwijnt de bekende 502 na het opnieuw aanmaken van de API
  (`docker-compose.vps.yml:17-18`, runbook §9) — pas die valkuil dan aan.
  Let op: met een variabele in `proxy_pass` verandert de URI-afhandeling; test
  dat `/api/…`, `/full/…`, `/graphql/query`, `/docs`, `/version` en uploads
  (20 MB) ongewijzigd werken.
- `Dockerfile.frontend:57` aanpassen. De React-bundle hoeft **niet** te veranderen.
- **Niet** doen: een backendkeuze in de browser. Dat vraagt CORS
  (`routes/addroutes.go:20-35` staat alleen localhost toe), cookies over
  domeinen heen, en aanpassingen op zes plekken met een eigen kopie van de
  API-bepaling. Eén adres per backend is eenvoudiger en houdt sessies gescheiden.

### B. Backend: `ENABLED_DOMAINS` (±een dagdeel met tests)

- Nieuwe omgevingsvariabele, bijvoorbeeld
  `ENABLED_DOMAINS=register,CG`. **Leeg of afwezig = alle domeinen** (zoals nu).
- De **kern staat altijd aan**, ook als hij niet genoemd wordt:
  `gegevenstypen`, `extra`, `configuratie`, `ide-bestanden`. De Studio heeft
  `configuratie` nodig (`/full/formulier_definities` in
  `formuliereditor/FormulierIndex.jsx:47`, `/full/weergave_definities` in
  `hooks/useWeergaveDefinitie.js:30`) en `ide-bestanden` (`ide/BestandenPanel.jsx`).
- Implementatie: na de `init()` alle types met een ander domein verwijderen uit
  `MetaRegistry`, `DatatypeRegistry` en `EnumWaarden` — vóór
  `dbsetup.CreateTables`, de routes, GraphQL en OpenAPI. Die volgen dan vanzelf.
  (Alternatief: de `init*MetaRegistry()`-aanroepen conditioneel maken; lastiger,
  want die staan in gegenereerde code.)
- Labels **hoofdletterongevoelig** vergelijken (`CG` vs `cg`) en in de
  foutmelding de echte labels noemen.
- **Afhankelijkheidscontrole bij het opstarten**: verwijst een ingeschakeld type
  naar een type uit een uitgeschakeld domein (relatie, onderliggend
  gegevenselement, datatype, enum), dan **weigert de API te starten** met een
  duidelijke melding. Geen half werkende instantie.
- **Te controleren**: leunt `register` of `CG` op `abuvwxy`? Een snelle zoekactie
  vond geen verwijzingen, maar die was grof. De controle hierboven maakt het
  hard; als er toch iets van `abuvwxy` nodig blijkt, overleg met Mark in plaats
  van het stil aan de kern toe te voegen. Ook `np-loc` hangt aan het register-
  type Referentielijst: bij `register` zonder `np-loc` moet dat gewoon werken.
- `schema_domeinen` (UI-groepering, seed "register") en `/api/schema/domeinen`
  consistent houden met wat aanstaat, zodat de UI geen domeinen toont die er
  niet zijn.
- Tests: registry na filter bevat alleen de verwachte domeinen; afhankelijkheid
  naar een uitgeschakeld domein geeft een startfout; leeg = alles; OpenAPI
  (`BeschikbareDomeinen()`) en GraphQL-schema bevatten alleen de ingeschakelde
  domeinen.

### C. De tweede stack op de VPS (±1 uur)

- Nieuwe map **`/srv/omnium-pf`**, eigen compose-project. Of
  `docker-compose.vps.yml` parametriseren (`container_name`s en netwerken via
  `${…}`), of een apart `docker-compose.pf.yml` — kies wat het minst
  dubbel werk geeft.
- Volledig gescheiden: eigen Postgres (eigen volume), eigen MinIO of eigen
  bucket, eigen `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_DROP_PASSWORD`. Dezelfde
  images als app.omnium-ide.nl, plus `ENABLED_DOMAINS=register,CG` en
  `API_UPSTREAM` naar de eigen API.
- Loopback-poorten (bezet op de VPS: 3000, 3100, 3200, 3300, 5433, 5434, 8083,
  9001): bijvoorbeeld frontend **8084**, Postgres **5435**, MinIO-console
  **9002**.
- **Geheim-regel**: genereer de `.env` op de VPS zelf (`openssl rand`), toon
  geen waarden, `chmod 600`.

### D. Caddy en DNS

- Caddy-blok (live in `/etc/caddy/Caddyfile`, repo-kopie in
  `deploy/vps/Caddyfile`), naar het model van `app.omnium-ide.nl`:
  ```
  pf.common-ground-lab.nl {
  	import veilig
  	request_body {
  		max_size 20MB
  	}
  	redir / /viz/react/ 302
  	reverse_proxy 127.0.0.1:8084
  }
  ```
  Altijd eerst `caddy validate --config <nieuw> --adapter caddyfile`, een
  backup van de live Caddyfile maken, en daarna pas `systemctl reload caddy`.
  Blok pas aanzetten als het A-record publiek naar de VPS wijst.
- **DNS**: `common-ground-lab.nl` staat op `ns1/ns2.quickhost.nl`. `pf.` lost nu
  op naar Quickhost (`83.137.145.97`) via een **wildcard**-A; er is geen AAAA.
  Nodig: een expliciet A-record `pf` → `62.129.142.42`.
  **Let op waar**: bij `omnide.nl` bleek de uitgeleverde zone die van het
  **Quickhost-klantpanel** te zijn, niet de Plesk-zone. Controleer na de
  wijziging het serienummer (`nslookup -type=SOA common-ground-lab.nl
  ns1.quickhost.nl`, stond op `2026081502`) en of `ns1.quickhost.nl` het nieuwe
  adres geeft.

### E. Backups

- Neem de nieuwe instantie op in de nachtelijke backup (Postgres-dump + MinIO-
  tar + `.env`), in een map **onder `/srv/`**: de NAS-sleutel is vastgezet op
  `rrsync -ro /srv/` en kan niets daarbuiten lezen. Bijvoorbeeld
  `/srv/omnium-pf/backups/`, met een derde Rsync-taak op de NAS
  (remote path `omnium-pf/backups/`), of meenemen in de bestaande Omnium-backup.
- Cron in UTC, een kwartier verschoven ten opzichte van de andere twee (03:00
  Omnium, 03:15 Imprint).

## 5. Werkwijze op de VPS

- SSH: `ssh vps1` (alias: gebruiker `omnium`, IP `62.129.142.42`; het A-record
  van `vps1.paratmos.nl` wijst nog niet naar de VPS). Vanuit Claude Code op
  Windows: `/c/Windows/System32/OpenSSH/ssh.exe` via de Bash-tool (die praat met
  de Windows-ssh-agent); PowerShell sloopt aanhalingstekens in remote-
  commando's.
- Op de VPS staat geen `dig`; DNS controleren met `nslookup` vanaf de desktop.
- Geheimen nooit tonen; in variabelen inlezen en doorgeven.

## 6. Data: de CG-replaybestanden

In `docs/CG PF/Replay files/`, in deze volgorde:

1. `1. Gemeenten CBS 2026.replay.json`
2. `2. Domeinen vast 2026.replay.json`
3. `3. API standaarden rationalisatie 2026.replay.json`
4. `4. Intake Portfolio Common Ground 2.replay (zonder gemeenten) CLEANED.json`
5. `5. PO email naar Persoon.Contactgegevens 2026.replay - zonder piet en test.json`
6. `6. Persooncorrecties David en cleanup 2026.replay.json`
7. `7. Extra data CG Portfolio.replay.json`

Niet: de map `oud of toch niet/`. Toelichting in `docs/CG PF/replay-mapping.md`.
Laden via het bestaande replay-mechanisme (`pages/RegistratieReplayPage.jsx` of
het onderliggende endpoint) tegen de nieuwe instantie, nadat die draait met
`ENABLED_DOMAINS=register,CG`. Controleer na elk bestand dat er geen
registraties falen op een ontbrekend type — dat zou betekenen dat de
domeinselectie te krap is.

## 7. Klaar als

- https://pf.common-ground-lab.nl toont de Studio, met een eigen login.
- OpenAPI, GraphQL en de schema-UI tonen alleen `register`, `CG` en de kern;
  geen `abuvwxy`, `financieel`, `kennis2`, `np-loc`, `org-geo`.
- De CG-data is geladen (aantallen per type genoteerd in de opleverregel).
- **app.omnium-ide.nl is ongewijzigd**: alle domeinen, eigen login, geen 502
  meer na het herstarten van de API.
- De nieuwe instantie zit in de nachtelijke backup en de NAS haalt hem op.
- Bijgewerkt: `docs/VPS_DEPLOYMENT.md` (§8 backups, §9 valkuilen, §11 tabel met
  sites en poorten), de repo-kopie van de Caddyfile, en de changelog/backlog
  volgens de gewoonten van dit repo.

## 8. Open vragen voor Mark

1. De twee replaybestanden in `docs/CG PF/` zelf (`Intake Portfolio Common
   Ground 1.replay.json` en `… 3.replay (overige velden).json`): horen die er
   ook bij, en zo ja, waar in de volgorde?
2. MinIO: een eigen MinIO-container voor pf (volledig gescheiden), of een eigen
   bucket in de bestaande (minder geheugen, maar dan hangen de stacks aan
   elkaar)? Voorstel: eigen container, in lijn met "elke stack op zichzelf".
3. Moet pf later ook OpenFTV (autorisatie) krijgen, of blijft dat profiel uit?
