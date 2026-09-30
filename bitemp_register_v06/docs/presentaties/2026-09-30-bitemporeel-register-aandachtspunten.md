# Presentatie "Bitemporeel modelgedreven register" — aandachtspunten

> Aangemaakt: 2026-09-30 (Claude-sessie). Hoort bij het slide-deck
> <https://claude.ai/artifact/TzcxFVU3uxCLY59F855JP8> (18 slides, Nederlands, Omnium-huisstijl).
> Doel: de plekken waar het deck iets claimt dat de repo (nog) niet volledig dekt, zodat je
> ze tijdens de presentatie paraat hebt en ze na afloop kunt oplossen.

## 1. Licentie: het deck zegt EUPL, de repo zegt MIT

- `bitemp_register_v06/README.md` (§Licentie, rond r. 503) vermeldt **MIT** en verwijst naar een
  `LICENSE`-bestand.
- Er staat **geen `LICENSE`-bestand** in de repo. De enige licentiebestanden zijn van
  third-party componenten (method-draw).
- EUPL-1.2 komt alleen voor als licentie van de gebruikte `@utrecht` NL Design System-componenten
  (package-lock, `docs/plans/2026-03-29 Forms plan 01.md`).
- **Actie vóór publiek gebruik van de slide:** kies de licentie (EUPL-1.2 ligt voor de hand voor
  Common Ground), voeg `LICENSE` toe, pas de README aan en controleer dat de gebruikte
  dependencies met de EUPL verenigbaar zijn (EUPL-1.2 is compatibel met o.a. GPL, AGPL, MPL;
  MIT/BSD-componenten zijn geen probleem).
- Tot die tijd: zeg "open source, EUPL is de beoogde licentie".

## 2. Materieel tijdreizen: opgeslagen en zichtbaar, nog niet bevraagbaar via de API

- Formeel tijdreizen werkt: `GET /full/{pad}/:id?peiltijdstip=…` (of `?t=`), ook in GraphQL.
- Materiële tijd (aanvang/einde) wordt opgeslagen, getoond op de tijdlijnpagina en gebruikt in
  QueryDefinities en notificaties ("materieel geldige record").
- Er is **nog geen `?geldig_op=`** of ander peilmoment op de materiële as: backlog **B31**
  (`docs/BACKLOG.md`, `materiele_tijd.md` §8).
- De slide "Twee tijdsassen" claimt dat niet expliciet; de nuance staat in de sprekersnotities.
  Als iemand vraagt "kan ik de situatie per 1 januari opvragen?": ja voor formele tijd, materieel
  staat gepland.

## 3. Dashboardvoorbeeld bevat plaatshouders

- De slide "Dashboards" toont de echte structuur van het moderatiedashboard van het
  CG-portfolio (tellers *Openstaande aanmeldingen* en *Publiek in het portfolio*, tabel
  *Te beoordelen*), maar met de woorden "aantal", "initiatief", "fase", "organisatie" op de plek
  van echte waarden.
- **Optie:** vervang de tegel door een schermafdruk van `dashboard.html?dashboard=moderatie`
  (vereist login) of laat het dashboard live zien in demo 1.
- Nog niet gebouwd: grafiektegels en een dashboard-activiteit in de Studio (backlog DU1
  "aantallen per entiteitstype"). De slide zegt alleen aantal/tabel/lijst, dat klopt.

## 4. Kleinere nuances per slide

| Slide | Claim | Werkelijkheid / bron |
|---|---|---|
| Common Ground-proof | "Bewezen in de praktijk op pf.common-ground-lab.nl" | Klopt (api 0.8.0, iframe op commonground.nl). De verschilanalyse met de RA Common Ground Registers (`docs/extern/verschilanalyse.md`) noemt ook waar de RA breder is: Keycloak, OTEL, FSC, Open Notificaties, AVG/archivering, zoeken. |
| Common Ground-proof | "Volgt NL API Strategie ADR 2.1.0" | Compliance-tabel in `docs/OPENAPI.md` (r. ~207): alles ✅ behalve `/core/uri-version` (bewust uitgesteld). |
| Framework | "Tien domeinen in één codebasis" | 10 `*_metaregistry.go` in `model/`; een deel is test/referentie (abuvwxy, kennis2, ide-bestanden). |
| CQRS | "Schrijven en lezen gescheiden" | Geen aparte persistente read models; `full_*` leest direct uit de store via views. De eigen analyse (`docs/API-standaarden-analyse.md`) scoort CQRS+ES op ≈90 %. UBB-analyse noemt projecties als gap. |
| Performant | 3.500 req/s, p95 23 ms, tijdreis 28 ms | `docs/REGRESSIETEST.md` "Referentiecijfers", meting 18-09-2026 op een **ontwikkellaptop**, PG16 in Docker, 2.000 NP + 2.000 LOC, pool 25. Geen productie-hardware. Oudere v05-benchmarks hebben veel failures; niet citeren. |
| Doorlooptijd | Greenfield: 5 entiteiten → 153 routes met één commando | `docs/CODEGEN.md` §11 (7 april 2026). Er is **geen gemeten doorlooptijd** voor een compleet nieuw register; alleen "6.000 registraties in ~1,5 min" (replay) is gemeten. |
| MDA | Model gaat verliesvrij heen en weer (SHA256) | Geldt voor Code ↔ V3 JSON ↔ editor. **XMI-roundtrip is nog niet verliesvrij.** Migratiescripts bij modelwijzigingen worden ten dele gegenereerd (zie `web/omnium-studio/features/register.html`, "Evolueren"). |
| Standaarden | Haal Centraal | Komt alleen voor in analyses, **niet geïmplementeerd**. Staat niet op de slide; niet claimen bij vragen. |
| Stack | "Nachtelijke back-up" | VPS-back-up wordt door de NAS opgehaald (`docs/VPS_DEPLOYMENT.md`). Geen off-site/derde locatie. |
| Studio | Screenshot np-loc | `web/omnium-studio/assets/shots/uml-overzicht.png`; de API-activiteit is nog een "CONCEPT"-placeholder (daarom niet gebruikt). |

## 5. Openbaarheid en hostnamen

- Het deck noemt `pf.common-ground-lab.nl` en `commonground.nl`; beide zijn publieke sites,
  geen interne hostnamen. `app.omnium-ide.nl` staat niet op de slides (wel in de notities van
  de demo). Controleer bij delen of dat gewenst is.
- Het deck is privé totdat het via het Share-menu wordt gedeeld.

## 6. Niet gecontroleerd

- Het deck is **niet gerenderd of nagekeken op layout** (tekstoverloop, kaarthoogtes). Loop de
  slides één keer door in de editor vóór gebruik; kandidaten voor overloop zijn "Framework"
  (lijst met zes punten) en "Dashboards" (tabel in rechterkaart).

## Demo-checklist (bij de slide "Demo's")

1. **Werkend register:** registreren → corrigeren → ongedaan maken → `/full/...?peiltijdstip=`
   in Swagger of GraphiQL; tijdlijnpagina; moderatiedashboard.
2. **Voortbrengingsproces:** entiteit toevoegen in de Studio → Publiceer + Rebuild
   (devloop-container, `exit 42`-herstart) → nieuwe routes in `/openapi.json` en GraphiQL →
   formulier verschijnt vanzelf → replay om te vullen. Draaiboek FTV-demo van 15-09 als basis
   (`docs/plans/2026-09-15 FTV-demo…draaiboek.md`).
