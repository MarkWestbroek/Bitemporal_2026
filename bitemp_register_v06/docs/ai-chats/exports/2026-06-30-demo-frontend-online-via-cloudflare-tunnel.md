# Chat: Demo-frontend online zetten via Cloudflare Tunnel

- **Datum**: 2026-06-30
- **Sessie**: Claude (Opus 4.8) in VS Code
- **Onderwerp**: hostingstrategie voor een online demo van de FrontEnd (Omnium Studio, data-editor, viewer, historie-visualisatie) + uitleg Cloudflare Tunnel

> Dit is een **Claude**-sessie (de map heet historisch `copilot-chats`).

---

## 🧑 User

Ik vraag mij af hoe het best een demo van de FrontEnd (studio, maar ook de data
editor en viewer en historie visualisatie) online te zetten.

Ik zie twee opties:
1. de react FE bij mijn hosting provider en de backend op mijn NAS. Even wat gedoe
   met CORS, maar daarna werkt het wel denk ik.
2. alles op mijn NAS: veel gedoe om dat netjes onder een URL te krijgen, ipv alleen
   een IP adres.

Ik ben bang dat 1 niet zo snel is, omdat de FE 'ver' van de BE is. Het deployen van
wijzigingen is wel makkelijker, omdat je ook gewoon 1 pagina of enkel een css bestand
kunt updaten, ipv een heel docker image. Misschien is de server ook wel sneller, niet
binnen docker, maar gewoon op een webserver.

2 heeft de voorkeur vanwege FE + BE in dezelfde omgeving.

Wat denk je? We hebben al een heel epistel opgesteld over hoe op de NAS de boel onder
een domein te krijgen, maar ik heb er nog geen begin mee gemaakt. Alle opties lijken
wat ingewikkeld.

---

## 🤖 Assistant

Op basis van `docs/TRUENAS_DEPLOYMENT.md` blijkt dat er **al een volledig werkende
stack op de NAS draait** (postgres, minio, Go API én nginx+React frontend via Dockge
op `192.168.2.22`). Dat verandert het plaatje: optie 2 is grotendeels al klaar; alleen
domein + SSL ontbreekt nog (sectie 4 van dat doc).

**Advies: optie 2, via Cloudflare Tunnel.**

Belangrijkste correctie op de afweging:

- **De latency-angst bij optie 1 klopt niet.** De React-FE is een set statische
  bestanden; zodra de browser die geladen heeft draait de FE *in de browser van de
  bezoeker*, niet op de hostingserver. API-calls gaan dus rechtstreeks van browser →
  backend, ongeacht waar de statische bestanden staan. "FE ver van BE" bestaat niet als
  latency-factor; wat telt is browser → NAS, en dat is in beide opties identiek. Het
  enige verschil is de eenmalige download van de assets bij paginastart (verwaarloosbaar).
- **"Buiten docker sneller" is geen reëel argument** voor statische bestanden; docker-
  overhead daarvoor is nihil.
- **Het enige echte voordeel van optie 1 (snel een los bestand updaten) kan binnen
  optie 2**: mount de Vite-`dist/` als volume in de nginx-container i.p.v. hem in het
  image te bakken. Dan deploy je een FE-wijziging met `scp`/`rsync` zonder image-rebuild.
- **Bonus bij optie 2:** CORS verdwijnt volledig (same-origin) en de `COOKIE_SECURE`/
  HTTPS-valkuil (§2.8) is meteen opgelost.

Eerste stap: Cloudflare Tunnel (geen port-forwarding nodig) — domein → DNS naar
Cloudflare → `cloudflared`-container → hostname-regel → `COOKIE_SECURE=true`.

---

## 🧑 User

Kun je nog eens uitleggen wat ik zelf moet doen voor Cloudflare, en wil je de chat ook
transcriben naar de map, zoals standaard?

---

## 🤖 Assistant

**Wat jij zelf moet doen voor Cloudflare Tunnel** (eenmalig, ~30 min). De tunnel werkt
met een *uitgaande* verbinding vanaf een `cloudflared`-container op de NAS naar
Cloudflare; je router hoeft niets open te zetten.

1. **Domeinnaam registreren** bij een registrar (TransIP, Namecheap of Cloudflare zelf).
2. **Domein onder Cloudflare DNS brengen**: gratis Cloudflare-account → "Add a site" →
   Free-plan. Cloudflare geeft twee **nameservers**; die zet je bij je registrar als de
   nameservers van het domein. Dat is het enige DNS-handwerk (propagatie kan uren duren).
3. **Tunnel aanmaken** in het dashboard: Zero Trust → Networks → Tunnels → Create a
   tunnel → type **Cloudflared**. Geef hem een naam en **kopieer het tunnel-token**
   (komt straks als `CLOUDFLARE_TUNNEL_TOKEN` in de Dockge `.env`).
4. **Public hostname koppelen** in hetzelfde scherm: subdomain `bitemp`/`studio` +
   domein → Service `HTTP` → `localhost:8086` (nginx-frontend). Cloudflare maakt het
   DNS-record automatisch. Extra hostnames (bv. `api.` → `localhost:8085`) optioneel.
5. **Token in Dockge zetten** en de `cloudflared`-service uit compose toevoegen
   (dit codedeel kan Claude uitwerken).
6. **`COOKIE_SECURE=true`** zetten (HTTPS is nu beschikbaar).

Puur jouw handwerk: domein kopen → nameservers naar Cloudflare → tunnel + hostname
klikken → token kopiëren. SSL, certificaatvernieuwing en routering doet Cloudflare
automatisch; het compose-deel doet Claude.

(De chat is conform `CLAUDE.md` weggeschreven naar `exports/` en `summaries/`.)

---
