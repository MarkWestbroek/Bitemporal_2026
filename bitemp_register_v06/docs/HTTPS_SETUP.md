# HTTPS Setup voor common-ground-lab.nl

> Aangemaakt: 20 april 2026
> Context: de CG-wrapper (`demos/initiatieven-cg-wrapper.html`) embed de publicatiepagina
> via een iframe. Browsers blokkeren HTTP-iframes op HTTPS-pagina's (mixed content).
> Dit document beschrijft de opties om HTTPS op de TrueNAS-server te krijgen.

---

## Probleem

De wrapper-pagina staat op `https://common-ground-lab.nl` (HTTPS).
De iframe-src wijst naar `http://77.161.190.210:8086/viz/react/publicatie.html?embed=1#/t/initiatieven` (HTTP).

Browsers blokkeren dit als **mixed content**:
- De iframe toont niets (lege ruimte)
- Externe resources (logo etc.) worden ook geblokkeerd

**Oplossing**: de register-server moet ook via HTTPS bereikbaar zijn.

---

## Wat al gedaan is

1. **Logo**: inline SVG in de wrapper (geen extern HTTP-verzoek meer) — **opgelost**
2. **`?embed=1` querystring**: header van de publicatiepagina verbergen in embed-modus — **opgelost**
3. **nginx `frame-ancestors`**: `Content-Security-Policy: frame-ancestors *` header toegevoegd in `nginx.frontend.conf` — **opgelost**
4. **Mixed content fallback**: JavaScript detecteert HTTPS→HTTP mismatch en toont een nette fallback met "open in nieuw tabblad"-knop — **opgelost**
5. **Frontend image gepusht**: `markwestbroek/bitemp-viz-frontend:latest` met nieuwe nginx-config — **opgelost**

**Nog te doen**: HTTPS voor de backend-server (een van de opties hieronder).

---

## Optie A: Cloudflare Tunnel (aanbevolen voor snelste opzet)

### Wat is het?
Een uitgaande verbinding van je NAS naar Cloudflare's edge-netwerk. Cloudflare geeft je een `https://` URL zonder dat je poorten hoeft te forwarden op je router.

### Hoeveel werk? ~30 minuten

### Stappen

1. **Cloudflare-account** aanmaken (gratis plan volstaat): https://dash.cloudflare.com/sign-up

2. **Domein toevoegen** aan Cloudflare:
   - Ga naar "Add a site" → `common-ground-lab.nl`
   - Cloudflare geeft je 2 nameservers (bijv. `ada.ns.cloudflare.com`, `lee.ns.cloudflare.com`)
   - Ga naar je domeinregistrar en **wijzig de nameservers** naar die van Cloudflare
   - Wacht tot propagatie klaar is (meestal 5-30 minuten, kan tot 24 uur duren)

3. **Tunnel aanmaken** in Cloudflare dashboard:
   - Ga naar Zero Trust → Networks → Tunnels
   - "Create a tunnel" → naam: `bitemp`
   - Kies "Docker" als installatiemethode
   - Kopieer het `TUNNEL_TOKEN`

4. **Routes instellen** in het Tunnel-dashboard:
   | Public hostname                    | Service                              |
   |------------------------------------|--------------------------------------|
   | `common-ground-lab.nl`             | `http://bitemp-viz-frontend:8080`    |
   | `api.common-ground-lab.nl`         | `http://api:8080`                    |
   | `minio.common-ground-lab.nl`       | `http://minio:9001` (optioneel)      |
   | `openftv.common-ground-lab.nl`     | `http://openftv-mi:8180` (optioneel) |

5. **Docker-container toevoegen** aan de compose op TrueNAS:
   ```yaml
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
   Voeg `CLOUDFLARE_TUNNEL_TOKEN=<jouw-token>` toe aan de `.env` in Dockge.

6. **Wrapper HTML aanpassen** — wijzig `IFRAME_SRC`:
   ```javascript
   var IFRAME_SRC = "https://common-ground-lab.nl/viz/react/publicatie.html?embed=1#/t/initiatieven";
   ```

7. **Cookie-instelling**: zet `COOKIE_SECURE=true` in de `.env` van Dockge.

### Voordelen
- Geen port-forwarding op router nodig
- NAS niet direct bereikbaar vanaf internet (veiliger)
- SSL automatisch, geen certificaatbeheer
- Snelste opzet (~30 min)

### Nadelen
- **VS-jurisdictie**: Cloudflare is een Amerikaans bedrijf. Verkeer loopt via hun edge (TLS-termination). Ze *kunnen* in theorie meekijken. Het dichtstbijzijnde datacenter voor NL is Amsterdam of Frankfurt, dus latency is minimaal (+2-5ms). Voor een publieke demo/PoC is dit prima; voor productie met persoonsgegevens is het een aandachtspunt.
- **Alleen HTTP(S)**: een Tunnel kan geen raw TCP proxyen. Dus PostgreSQL (poort 5433), MinIO S3 API (poort 9000) en andere niet-HTTP-diensten zijn **niet** via de tunnel bereikbaar. Voor DB-toegang heb je dan nog steeds VPN of direct LAN-toegang nodig.
- **Afhankelijkheid**: als Cloudflare een storing heeft, is je site onbereikbaar.

---

## Optie B: Caddy + Let's Encrypt op de NAS (volledige controle)

### Wat is het?
Caddy is een reverse proxy die automatisch Let's Encrypt certificaten aanvraagt en vernieuwt. Draait als Docker-container op je NAS.

### Hoeveel werk? ~45 minuten

### Stappen

1. **Port-forwarding** op je router:
   - Poort 80 → NAS IP (voor ACME HTTP-01 challenge)
   - Poort 443 → NAS IP (voor HTTPS-verkeer)

2. **DNS instellen**: A-record `common-ground-lab.nl` → je publieke IP
   - Als je IP dynamisch is: DynDNS instellen (bijv. via Cloudflare API, DuckDNS, of je router)

3. **Caddy container toevoegen** aan compose:
   ```yaml
   caddy:
     image: caddy:2-alpine
     container_name: bitemp-caddy
     restart: unless-stopped
     ports:
       - "80:80"
       - "443:443"
     volumes:
       - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
       - caddy_data:/data
       - caddy_config:/config
     networks:
       - bitemp_net

   volumes:
     caddy_data:
     caddy_config:
   ```

4. **Caddyfile** aanmaken (`caddy/Caddyfile`):
   ```
   common-ground-lab.nl {
       reverse_proxy bitemp-viz-frontend:8080
   }

   api.common-ground-lab.nl {
       reverse_proxy api:8080
   }

   # Optioneel:
   minio.common-ground-lab.nl {
       reverse_proxy minio:9001
   }
   ```
   Caddy regelt automatisch Let's Encrypt certificaten (gratis, 90 dagen, auto-renew).

5. **Frontend poort 8086 verwijderen**: Caddy neemt het over op poort 443. Je kunt poort 8086 uit de compose halen (of houden voor LAN-toegang).

6. **Wrapper HTML aanpassen**: zelfde als bij optie A.

7. **Cookie-instelling**: `COOKIE_SECURE=true`.

### Voordelen
- **Geen derde partij** — TLS-terminatie op je eigen NAS, verkeer gaat niet via de VS
- **Alle poorten mogelijk** — je kunt ook TCP-poorten forwarden voor DB, MinIO, etc.
- **Volledige controle** over certificaten en configuratie
- Let's Encrypt certificaten zijn gratis

### Nadelen
- Je NAS is **direct bereikbaar** vanaf internet → groter aanvalsoppervlak
- Port-forwarding op je router nodig (sommige ISPs blokkeren poort 80/443)
- Als je publiek IP wisselt: DynDNS nodig
- Iets meer onderhoud (hoewel Caddy auto-renew doet)

---

## Optie C: Caddy + Cloudflare DNS-challenge (tussenoplossing)

### Wat is het?
Caddy met de Cloudflare DNS-01 challenge plugin. Certificaat wordt gevalideerd via de Cloudflare DNS API in plaats van via poort 80.

### Verschil met optie A en B
- DNS bij Cloudflare, maar **geen tunnel** — verkeer gaat direct naar je NAS
- TLS-terminatie op je eigen NAS (niet bij Cloudflare)
- Poort 80 hoeft niet open, alleen poort 443

### Stappen
1. Domein bij Cloudflare DNS (nameservers wijzigen)
2. Cloudflare API token aanmaken (Zone:DNS:Edit)
3. Caddy image met Cloudflare plugin bouwen of gebruiken: `caddy:2-builder` + `xcaddy build --with github.com/caddy-dns/cloudflare`
4. Poort 443 forwarden op router
5. Caddyfile met `tls { dns cloudflare {env.CF_API_TOKEN} }`

### Voordelen
- Geen poort 80 nodig
- TLS op eigen NAS (geen VS-proxy)
- Alle poorten beschikbaar

### Nadelen
- Poort 443 moet nog steeds geforward worden
- Custom Caddy image nodig (iets meer werk)
- DNS moet bij Cloudflare staan

---

## Vergelijkingstabel

| Criterium                      | A: Cloudflare Tunnel | B: Caddy + LE     | C: Caddy + CF DNS |
|-------------------------------|---------------------|--------------------|--------------------|
| Opzettijd                     | ~30 min             | ~45 min            | ~60 min            |
| Port-forwarding nodig         | Nee                 | Ja (80 + 443)      | Ja (alleen 443)    |
| TLS-terminatie                | Bij Cloudflare (VS) | Op eigen NAS       | Op eigen NAS       |
| NAS direct bereikbaar         | Nee                 | Ja                 | Ja                 |
| DB/TCP-poorten via tunnel     | Nee (alleen HTTP)   | Ja                 | Ja                 |
| VS-afhankelijkheid            | Ja                  | Nee                | Alleen DNS         |
| Certificaatbeheer             | Automatisch (CF)    | Automatisch (LE)   | Automatisch (LE)   |
| Gratis                        | Ja                  | Ja                 | Ja                 |

---

## Aanbeveling

**Voor nu (snel de demo live):** Optie A — Cloudflare Tunnel. Minimaal werk, geen router-config.

**Als DB-poorten ook extern bereikbaar moeten zijn of VS-gevoeligheid zwaar weegt:** Optie B — Caddy + Let's Encrypt.

**Combinatie is ook mogelijk:** Cloudflare Tunnel voor publieke webpagina's + WireGuard VPN voor interne diensten (DB, MinIO).

---

## Gerelateerde bestanden

| Bestand                                          | Beschrijving                                      |
|-------------------------------------------------|---------------------------------------------------|
| `demos/initiatieven-cg-wrapper.html`            | CG-styled wrapper met iframe (pas `IFRAME_SRC` aan na HTTPS) |
| `nginx.frontend.conf`                           | Nginx config met `frame-ancestors *` header       |
| `web/vite/src/publicatie/main.jsx`              | `?embed=1` support voor header verbergen          |
| `docs/TRUENAS_DEPLOYMENT.md`                    | TrueNAS deployment guide (sectie 4 = SSL opties)  |
| `docker-compose.truenas.yml`                    | Basis compose; cloudflared/caddy hier toevoegen   |

---

## Checklist na HTTPS-activatie

- [ ] `IFRAME_SRC` in `demos/initiatieven-cg-wrapper.html` wijzigen naar `https://...`
- [ ] `COOKIE_SECURE=true` instellen in Dockge `.env`
- [ ] Frontend container herstarten op TrueNAS
- [ ] Testen: wrapper-pagina op common-ground-lab.nl → iframe moet laden
- [ ] Testen: directe URL `https://common-ground-lab.nl/viz/react/publicatie.html` werkt
- [ ] Optioneel: API direct testen op `https://api.common-ground-lab.nl/`
