# Opdracht — tweede Omnium-instantie op pf.common-ground-lab.nl

> Datum: 21 september 2026. Opgesteld in een sessie in het imprint-engine-repo, uit te voeren in
> dít repo. De voorwaarde "start pas na de merge van het backend-werk" is vervuld: die merge staat
> sinds 21 september op `main` (`32b69a6a`).
>
> **Herzien op 21 september 2026 (avond)**, na bespreking met Mark in de sessie in dít repo. De
> belangrijkste wijzigingen ten opzichte van de eerste versie:
>
> - **Werkpakket B (`ENABLED_DOMAINS`) vervalt.** Het register is modelgedreven en gegenereerd; een
>   compacter register ontstaat door een compacter model te genereren, niet door typen achteraf uit
>   de registry te filteren. Zie §4.
> - **Het eerste doel is nu een test**: hoe werkt de Studio binnen een **iframe** en onder een
>   **eigen domeinnaam**. Daarvoor volstaan **A, C en D**, met de huidige backend en het volledige
>   model.
> - **F (OpenFTV) en de proef-replay zijn uitgesteld** tot na die test.
> - **Nieuw: §3a**, de gevolgen van de backend-merge voor de VPS-images.
>
> De bestandsnaam noemt nog "domeinfilter"; die is bewust niet hernoemd, om verwijzingen heel te houden.

## 1. Wat en waarom

Naast de bestaande Studio op **app.omnium-ide.nl** komt een tweede, zelfstandige instantie op
**pf.common-ground-lab.nl**: uiteindelijk een "live register" voor het Common Ground-portfolio.

**Eerste doel (nu):** een tweede instantie om te testen hoe de Studio zich gedraagt

1. binnen een **iframe** (ingebed in de Pleio-site van commonground.nl), en
2. onder een **eigen domeinnaam**.

Uitgangspunt blijft: **één frontend-image voor beide instanties.** Wat verschilt, is instelling:
welke backend de frontend bedient.

**Later:** de instantie krijgt een eigen, compacter register (alleen wat het portfolio nodig heeft),
gevuld met de CG-replaybestanden, met OpenFTV aan. Zie §9.

## 2. Besluiten (Mark, 21 september 2026)

| Vraag | Besluit |
|---|---|
| Adres | `pf.common-ground-lab.nl`. Als inbedden daar vastloopt op cookies (§5): een subdomein op `commonground.nl` regelen is ook mogelijk |
| Domeinen, nu | **alle**, met de huidige backend en het huidige model. Geen filter |
| Domeinen, later | `register` + `CG` + de kern (`gegevenstypen`, `extra`, `configuratie`, `ide-bestanden`), **via model en generator**, niet via een runtime-filter. `abuvwxy` hoort daar niet bij: testmodel, ballast voor een live register |
| Inloggen en bewerken | **voor onszelf, en dat mag buiten het iframe**: rechtstreeks op het eigen adres. Binnen het iframe volstaat lezen |
| Data | de CG-replaybestanden; **Mark laadt ze zelf**, met de hand (de set wijzigt nog). Referentietabellen altijd eerst |
| MinIO | een **eigen MinIO-container** voor pf, volledig gescheiden van Omnium |
| Autorisatie | **OpenFTV aan** op pf (*eat your own dogfood*), maar **ná** de iframe-test. Zie F |
| Uitvoering | in dít repo, inclusief VPS en Caddy |

## 3. Stand van de code (onderzocht 21 september 2026)

**De frontend vindt zijn backend via zijn eigen adres.** Alle API-calls zijn relatief (`/api/…`,
`/full/…`, `/graphql/query`, `/registraties`, `/admin/…`): `web/vite/src/shared/apiBase.js` geeft
`""` terug buiten de Vite-dev-poorten. De nginx in de frontend-container stuurt alles behalve
`/viz/react/` door naar de backend: **`nginx.frontend.conf`, `proxy_pass http://api:8080;`,
hard-coded**, als statische `default.conf` gekopieerd in `Dockerfile.frontend`. Er is geen
runtime-config en geen backend-kiezer.

**Een domein is gegenereerde Go-code uit het model.** Elk domein registreert zijn types in
`model.MetaRegistry` via een `init*MetaRegistry()`-aanroep (door `cmd/codegen` gegenereerd). Routes,
tabellen, GraphQL en OpenAPI itereren over die registry. De generator werkt al **per domein**
(vlag `-domein`, modus `additive`), en `docs/CODEGEN.md` §11 beschrijft de bewezen
domeinonafhankelijkheid. Afhankelijkheden lopen van np-loc naar `Gemeente` (CG) en
`LandenlijstLand` (register), niet andersom; `register` + `CG` zonder `np-loc` is dus haalbaar
(snelle zoekactie, geen bewijs).

**Compose**: `deploy/vps/docker-compose.vps.yml` heeft vaste `container_name`s
(`bitemp-postgres-06`, `bitemp-minio`, `bitemp-go-api-06`, `bitemp-viz-frontend`) en vaste
netwerknamen; een tweede stack botst daarop. `FRONTEND_PORT`, `PG_PORT`, images, database, bucket
en auth zijn wél via `.env` instelbaar.

**Inbedden en cookies** (nagekeken in de code):

- `nginx.frontend.conf` stuurt op `/viz/react/` de header `Content-Security-Policy: frame-ancestors *`
  mee, en het Caddy-snippet `veilig` zet geen `X-Frame-Options`. **De pagina laadt dus in een iframe.**
- De sessiecookie van de API staat op **`SameSite=Lax`** (`handlers/auth_handler.go`). Een iframe op
  een ander domein is voor de browser een derde partij; zo'n cookie wordt dan niet meegestuurd.
  **Binnen het iframe werkt lezen, inloggen niet.** Dat is volgens het besluit in §2 geen bezwaar.

### 3a. Gevolgen van de backend-merge voor de VPS-images

Sinds de merge van 21 september bestaan alle routes onder **`/admin/`** alleen in een build met
**`-tags devtools`**. De VPS-images (`Dockerfile`, `Dockerfile.api`) bouwen **zonder** die tag.

- **pf:** een productie-build is precies goed voor een live register: geen `droptables`, geen
  `rebuild`, kleiner aanvalsoppervlak. Leegmaken gaat dan **niet via de API** maar via het
  Postgres-volume van pf (`docker compose down` + volume weg) of via `psql`; de tabellen worden bij
  het opstarten vanzelf opnieuw aangemaakt. `ADMIN_DROP_PASSWORD` is in de compose een verplichte
  variabele zonder functie; gewoon een waarde genereren.
- **app.omnium-ide.nl: nog te beslissen (Mark).** Bij de eerstvolgende deploy van een nieuwe
  API-image verdwijnen daar dezelfde routes. De frontend roept `/admin/rebuild/` en `/admin/diff/`
  aan; wordt de Studio op de VPS daarvoor gebruikt, dan geeft dat straks een 404. Keuze: een aparte
  devtools-image voor de Studio, of accepteren dat rebuild alleen lokaal kan. **Tot dat besluit er
  is: geen nieuwe API-image naar app.omnium-ide.nl.** Werkpakket A raakt alleen de frontend-image.
- Verder na de merge: bij `AUTH_ENABLED=true` is `JWT_SECRET` verplicht (anders start de API
  niet) en dev-defaults voor beheerwachtwoorden worden geweigerd; de autorisatie staat standaard op
  dicht bij een fout; de connectiepool is instelbaar (`DB_MAX_OPEN_CONNS`, default 25, per instantie).

## 4. Werkpakketten

Volgorde voor nu: **A → C → D → iframe-test**. Daarna E, en later F en het compacte register.

### A. Frontend: backend instelbaar in de proxy

> **Status: uitgevoerd op 21 september 2026** (commit `2e69a6a5`), gebouwd en getest met de echte
> image. De template staat in `deploy/frontend/default.conf.template`, de opstartcontrole in
> `deploy/frontend/15-api-upstream.envsh`; de compose geeft `API_UPSTREAM` en `FRAME_ANCESTORS` door.
> **Nog nodig vóór C:** de frontend-image opnieuw bouwen en naar de registry pushen; een oudere image
> kent `API_UPSTREAM` niet. Inloggen via de proxy is niet apart getest (die regels zijn ongewijzigd):
> probeer dat op pf als eerste. Onderstaande punten beschrijven wat er gebouwd is.

- Maak van `nginx.frontend.conf` een template (`/etc/nginx/templates/default.conf.template`; de
  officiële nginx-image vult `${…}` bij het starten in via envsubst) met de upstream uit
  **`API_UPSTREAM`**. **Default `http://api:8080`**, zodat de bestaande deploy ongewijzigd werkt.
- Zet er een `resolver` bij en gebruik een variabele upstream (`set $api …; proxy_pass $api;`). Dan
  resolvet nginx de API per verzoek en verdwijnt de bekende 502 na het opnieuw aanmaken van de
  API-container (`docker-compose.vps.yml`, runbook §9); pas die valkuil dan aan in het runbook.
  Let op: met een variabele in `proxy_pass` verandert de URI-afhandeling; test dat `/api/…`,
  `/full/…`, `/graphql/query`, `/docs`, `/version`, querystrings en uploads (20 MB) ongewijzigd werken.
- `Dockerfile.frontend` aanpassen. De React-bundle hoeft **niet** te veranderen.
- **Niet** doen: een backendkeuze in de browser. Dat vraagt CORS (`routes/addroutes.go` staat
  alleen localhost toe), cookies over domeinen heen, en aanpassingen op zes plekken met een eigen
  kopie van de API-bepaling. Eén adres per backend is eenvoudiger en houdt sessies gescheiden.
- **Inbedden instelbaar maken** (toegevoegd bij de herziening): `frame-ancestors *` staat iedereen
  toe de Studio in te bedden. Voor de test is dat goed; voor een instantie met login is het een
  risico op clickjacking. Maak de waarde instelbaar (**`FRAME_ANCESTORS`**, default `*` = huidig
  gedrag), zodat pf later een lijst met toegestane sites kan krijgen zonder nieuwe image.

### B. ~~Backend: `ENABLED_DOMAINS`~~ — vervallen

Het plan was een omgevingsvariabele die na de `init()` typen uit `MetaRegistry`, `DatatypeRegistry`
en `EnumWaarden` verwijdert, met een afhankelijkheidscontrole bij het opstarten.

**Waarom vervallen (Mark, 21 september):** dit vergeet dat het register **modelgedreven en
gegenereerd** is. Een compacter register ontstaat door een compacter model, waaruit het register
wordt gegenereerd; dan zit er vanzelf precies in wat nodig is, en kloppen routes, tabellen, GraphQL
en OpenAPI zonder extra mechanisme. De generator kan al code genereren voor een beperkte set
domeinen. Een runtime-filter zou een **tweede waarheid naast het model** introduceren, met eigen
tests en eigen foutmodi.

Wat ervoor in de plaats komt, staat in §9 (later).

### C. De tweede stack op de VPS

- Nieuwe map **`/srv/omnium-pf`**, eigen compose-project. Of `docker-compose.vps.yml`
  parametriseren (`container_name`s en netwerken via `${…}`), of een apart
  `docker-compose.pf.yml`; kies wat het minst dubbel werk geeft.
- Volledig gescheiden: eigen Postgres (eigen volume), **eigen MinIO-container** (besluit Mark),
  eigen `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_DROP_PASSWORD`.
- Images: de **nieuwe frontend-image** (uit A) met `API_UPSTREAM` naar de eigen API, en voor de API
  **de huidige code met het volledige model** (productie-build, zie §3a).
- Loopback-poorten (bezet op de VPS: 3000, 3100, 3200, 3300, 5433, 5434, 8083, 9001):
  bijvoorbeeld frontend **8084**, Postgres **5435**, MinIO-console **9002**.
- **Geheim-regel**: genereer de `.env` op de VPS zelf (`openssl rand`), toon geen waarden, `chmod 600`.

### D. Caddy en DNS

- Caddy-blok (live in `/etc/caddy/Caddyfile`, repo-kopie in `deploy/vps/Caddyfile`), naar het model
  van `app.omnium-ide.nl`:
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
  Altijd eerst `caddy validate --config <nieuw> --adapter caddyfile`, een backup van de live
  Caddyfile maken, en daarna pas `systemctl reload caddy`. Blok pas aanzetten als het A-record
  publiek naar de VPS wijst.
- **DNS**: `common-ground-lab.nl` staat op `ns1/ns2.quickhost.nl`. `pf.` lost nu op naar Quickhost
  (`83.137.145.97`) via een **wildcard**-A; er is geen AAAA. Nodig: een expliciet A-record
  `pf` → `62.129.142.42`. **Let op waar**: bij `omnide.nl` bleek de uitgeleverde zone die van het
  **Quickhost-klantpanel** te zijn, niet de Plesk-zone. Controleer na de wijziging het serienummer
  (`nslookup -type=SOA common-ground-lab.nl ns1.quickhost.nl`, stond op `2026081502`) en of
  `ns1.quickhost.nl` het nieuwe adres geeft.

### E. Backups

- Neem de nieuwe instantie op in de nachtelijke backup (Postgres-dump + MinIO-tar + `.env`), in een
  map **onder `/srv/`**: de NAS-sleutel is vastgezet op `rrsync -ro /srv/` en kan niets daarbuiten
  lezen. Bijvoorbeeld `/srv/omnium-pf/backups/`, met een derde Rsync-taak op de NAS (remote path
  `omnium-pf/backups/`), of meenemen in de bestaande Omnium-backup.
- Cron in UTC, een kwartier verschoven ten opzichte van de andere twee (03:00 Omnium, 03:15 Imprint).
- Mag ná de iframe-test, maar vóórdat Mark echte data laadt.

### F. OpenFTV (autorisatie) op pf — uitgesteld tot na de iframe-test

Op pf staat straks het Common Ground-portfolio; daar hoort het eigen autorisatiemodel aan te staan
(*eat your own dogfood*, besluit Mark). Voor de eerste test voegt het drie containers en een
beleidsvraag toe aan iets dat snel moet laten zien hoe inbedden werkt; daarom later.

- In de huidige compose zit OpenFTV achter het profiel `authz` (`openftv-db`, `openftv-manager`,
  `openftv-pdp`, met `./authz/manager` en `./authz/pdp`). Voor pf gaat dat profiel aan, met eigen
  containers en een eigen database; geen gedeelde PDP met app.omnium-ide.nl.
- API: `AUTHZ_PDP_ENABLED=true`, `OPENFTV_PDP_URL` naar de eigen PDP.
- **Volgorde (toegevoegd bij de herziening):** sinds de backend-merge staat de autorisatie
  **standaard op dicht bij een fout**. Zorg dat de regel *toegestaan voor ingelogde beheerders* in de
  PDP staat **vóórdat** `AUTHZ_PDP_ENABLED` aangaat, anders sluit de instantie zichzelf buiten.
  Noteer de gekozen waarde van `AUTHZ_DENY_ON_ERROR` in het runbook.
- Beleid: begin met de bundel die de FTV-demo gebruikte
  (`2026-09-15 FTV-demo Toegangsspraak — draaiboek.md`) en het ontwerp in
  `2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak`. Welke regels pf precies krijgt (wie mag
  het portfolio lezen, wie mag wijzigen) is een inhoudelijke keuze: leg een voorstel aan Mark voor.
- Geheugen: drie extra containers (Postgres 15, manager, PDP). De VPS heeft ruimte (±6 GB vrij bij
  normaal gebruik), maar meet het na het starten.
- Test: een verzoek dat het beleid moet weigeren, wordt ook echt geweigerd; een toegestaan verzoek
  komt erdoor; en app.omnium-ide.nl draait zonder PDP zoals nu.

## 5. Inbedden in een iframe: wat te verwachten en te testen

| Onderdeel | Verwachting | Waarom |
|---|---|---|
| De Studio laden in een iframe op de Pleio-site | werkt | `frame-ancestors *`, geen `X-Frame-Options` |
| Lezen binnen het iframe (publicatie, inhoud bekijken) | werkt | lezen vraagt geen sessie |
| Inloggen en bewerken **binnen** het iframe | werkt **niet** | sessiecookie is `SameSite=Lax`; in een iframe op een ander domein is dat een cookie van een derde partij |
| Inloggen en bewerken **rechtstreeks** op pf.common-ground-lab.nl | werkt | zelfde site, gewone cookie. **Dit is de afgesproken werkwijze** (§2) |

Als inloggen binnen het iframe later toch nodig is, zijn er twee routes:

1. **Een subdomein op `commonground.nl`** (bv. `pf.commonground.nl`). Dan zijn de Pleio-pagina en de
   Studio voor de browser **dezelfde site** en wordt de `Lax`-cookie gewoon meegestuurd. Vraagt
   alleen een DNS-record en een Caddy-blok; **geen codewijziging**. Dit is de voorkeursroute.
2. De cookie op `SameSite=None; Secure` zetten. Werkt alleen zolang de browser cookies van derden
   toelaat, en dat wordt steeds vaker geblokkeerd. Niet doen tenzij route 1 onmogelijk is.

Ook testen: werken links en downloads binnen het iframe, klopt de hoogte en het scrollen, en doet
de Pleio-site zelf niets met een eigen Content-Security-Policy (`frame-src`) die het iframe blokkeert.

## 6. Werkwijze op de VPS

- SSH: `ssh vps1`. Dat is een alias in de lokale `~/.ssh/config`; gebruikersnaam en sleutel staan
  daar en bewust niet in dit document (de repo is publiek). Het A-record van `vps1.paratmos.nl`
  wijst nog niet naar de VPS, dus de alias gebruikt het IP-adres. Vanuit Claude Code op Windows:
  `/c/Windows/System32/OpenSSH/ssh.exe` via de Bash-tool (die praat met de Windows-ssh-agent);
  PowerShell sloopt aanhalingstekens in remote-commando's.
- Op de VPS staat geen `dig`; DNS controleren met `nslookup` vanaf de desktop.
- Geheimen nooit tonen; in variabelen inlezen en doorgeven.

## 7. Data: de CG-replaybestanden

**Mark laadt de data zelf**, met de hand: de set replaybestanden (nu vijf of zes, in
`docs/CG PF/Replay files/`, toelichting in `docs/CG PF/replay-mapping.md`) wijzigt nog.
**Referentietabellen altijd eerst**, daarna de rest. De opdracht levert een **lege, draaiende
instantie** op, klaar om te replayen via het bestaande mechanisme (`pages/RegistratieReplayPage.jsx`
of het onderliggende endpoint).

De eerder geplande **proef-replay vervalt voorlopig**: die moest bewijzen dat de domeinselectie
klopt, en die selectie is er nu niet. Hij komt terug bij het compacte register (§9). Leegmaken kan
op de VPS alleen via het volume of `psql` (§3a).

## 8. Klaar als

**Nu (iframe-test):**

- https://pf.common-ground-lab.nl toont de Studio, met een eigen login, op de huidige code en het
  volledige model.
- De Studio laadt in een iframe op een pagina van een ander domein; lezen werkt daar; inloggen en
  bewerken werken rechtstreeks op het eigen adres. De bevindingen van de test staan genoteerd.
- **app.omnium-ide.nl is ongewijzigd** in gedrag: alle domeinen, eigen login, en geen 502 meer na
  het herstarten van de API. Er is **geen nieuwe API-image** naartoe gegaan zolang §3a niet is beslist.
- Bijgewerkt: `docs/VPS_DEPLOYMENT.md` (§9 valkuilen: de 502; §11 tabel met sites en poorten), de
  repo-kopie van de Caddyfile, en de changelog/backlog volgens de gewoonten van dit repo.

**Daarna:** de instantie zit in de nachtelijke backup en de NAS haalt hem op (E); OpenFTV draait op
pf met een eigen PDP en een te weigeren verzoek wordt geweigerd (F).

## 9. Later: een eigen, compacter register voor pf

In plaats van werkpakket B. Uit te werken als de iframe-test goed is verlopen.

- Eén **model** met alleen `register`, `CG` en de kern (`gegevenstypen`, `extra`, `configuratie`,
  `ide-bestanden`); de Studio heeft `configuratie` nodig (`/full/formulier_definities`,
  `/full/weergave_definities`) en `ide-bestanden` (`ide/BestandenPanel.jsx`).
- Daaruit **genereren** (`cmd/codegen`, per domein) en een **eigen API-image** voor pf bouwen. Eén
  frontend-image blijft voor beide instanties gelden; het uitgangspunt "één API-image" uit de eerste
  versie vervalt hiermee bewust.
- Uit te zoeken: hoe de build-variant eruitziet (eigen map met gegenereerde code, of build-tags per
  domein), en of `register` en `CG` echt nergens op `abuvwxy` of `np-loc` leunen. De bestaande
  validatie in de generator en de compiler maken dat hard: wat ontbreekt, bouwt niet.
- Dán de proef-replay (bijvoorbeeld `1. Gemeenten CBS 2026.replay.json`), daarna leegmaken, daarna
  laadt Mark de echte set.

## 10. Beantwoord door Mark (21 september 2026)

1. De replaybestanden: de set (vijf of zes) wijzigt nog; **Mark laadt ze zelf**.
2. MinIO: **eigen container** voor pf.
3. OpenFTV: **ja, aan op pf**; het CG-portfolio moet zelf laten zien wat het predikt. Volgorde: na
   de iframe-test.
4. Domeinfilter in de backend: **nee**. Compacter via model en generator, later.
5. Inloggen binnen het iframe: **niet nodig**; bewerken is voor onszelf en kan buiten de Pleio-site.
   Anders is een subdomein op `commonground.nl` mogelijk.

Open: welke toegangsregels pf krijgt (F), en of app.omnium-ide.nl een devtools-image krijgt (§3a).
