# Chat Samenvatting

## Metadata

- Datum: 2026-06-30
- Titel: Demo-frontend online zetten via Cloudflare Tunnel
- Bestandstamnaam: 2026-06-30-demo-frontend-online-via-cloudflare-tunnel
- Gerelateerde export: ../exports/2026-06-30-demo-frontend-online-via-cloudflare-tunnel.md
- Gerelateerde branch/commit: main (geen code gewijzigd)

## Doel

Bepalen hoe een online demo van de FrontEnd (Omnium Studio + data-editor, viewer,
historie-visualisatie) het best gehost wordt: FE bij hostingprovider met BE op NAS
(optie 1) versus alles op de NAS onder één domein (optie 2).

## Beslissingen

- Kies **optie 2: alles op de NAS**, want de volledige stack draait daar al (Dockge op
  `192.168.2.22`: postgres, minio, Go API, nginx+React). Alleen domein + SSL ontbreekt.
- Domein + SSL via **Cloudflare Tunnel** (`cloudflared`-container) — geen port-forwarding,
  automatische SSL, NAS niet direct vanaf internet bereikbaar.
- Voor snelle FE-deploys binnen optie 2: **Vite-`dist/` als volume mounten** in de
  nginx-container i.p.v. in het image bakken; deployen via `scp`/`rsync`.
- Na HTTPS: **`COOKIE_SECURE=true`** zetten.

## Waarom deze keuze

- De "FE ver van BE = traag"-zorg bij optie 1 is een misverstand: de React-FE draait in
  de browser van de bezoeker, dus API-calls gaan altijd browser → NAS, ongeacht waar de
  statische assets staan. Latency is in beide opties gelijk.
- "Buiten docker sneller" is verwaarloosbaar voor statische bestanden.
- Optie 2 laat CORS volledig verdwijnen (same-origin) en lost de Secure-cookie-over-HTTP
  valkuil (TRUENAS_DEPLOYMENT.md §2.8) op.
- De volume-mount geeft de enige echte plus van optie 1 (los bestand updaten) zonder de
  architectuur te splitsen.

## Gewijzigde onderdelen

- Bestanden: geen code; alleen deze chat-export + samenvatting toegevoegd.
- API routes: n.v.t.
- DB/SQL: n.v.t.
- Frontend: n.v.t. (deploy-strategie besproken, nog niet uitgevoerd)

## Open punten

- `cloudflared`-service concreet uitwerken in `docker-compose.truenas.yml` + `.env`.
- Eventueel FE-volume-mount voor nginx implementeren voor snellere deploys.
- Beslissen of API/MinIO-console ook een eigen public hostname krijgen.

## Volgende stap

Domein registreren en onder Cloudflare DNS brengen; daarna de `cloudflared`-service
toevoegen aan de compose en `CLOUDFLARE_TUNNEL_TOKEN` in Dockge zetten.
