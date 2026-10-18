# Architectuur van Omnium — als Omnium-project

Datum: 2026-10-18 · Gemaakt door Claude (sessie PROJECT) op verzoek van Mark: "de architectuur
in onze eigen tool, zodat we via het model communiceren".

Het project **Omnium architectuur** beschrijft Omnium in Omnium, op drie niveaus, uitgaande van
de documentatie (`.github/copilot-instructions.md`, `docs/OMNIUM_WALKTHROUGH.md`, `docs/STUDIO.md`,
`docs/TRANSFORMATIES.md`, `docs/API_REFERENCE.md`, de plannen onder `docs/plans/` en
`docs/diagrammen/architectuur-overzicht.md`):

| Map | Taal | Inhoud |
|---|---|---|
| **1 Capabilities** | ArchiMate | *Capabilities van Omnium*: veertien capabilities rond de waardestroom "van model naar werkend register"; *Capabilities gerealiseerd door componenten*: de realisatierelaties naar de applicatiecomponenten |
| **2 Componenten** | ArchiMate | *Applicatiecomponenten en interfaces*: Studio (met motor, profielen, transformaties, EA-lezer, sync-client, assistent, Toegangsspraak), Go-API (MetaRegistry, engine, validatie, dynql, projecten/SSE, auth, PEP, PDP, notificaties, AI-proxy, meldingen), render-svc, MCP-server, de interfaces (REST, GraphQL, SSE, OpenAPI, render, MCP, webhook), services, data-objecten en de externe systemen; *Technologie en uitrol (VPS)*: Caddy, Docker, de drie images, Postgres, MinIO, OpenFTV, pf-instantie, Docker Hub, GitHub, NAS |
| **3 Use cases** | Use case | vier diagrammen: modelleren/transformeren/importeren, registreren/lezen/genereren, samenwerken/AI-hulp, toegang/notificeren/renderen/beheer — met de actoren modelleur, ontwerper, bouwer, registrator, lezer, collega, beheerder, AI-assistent, Imprint, Sparx EA, webhook-afnemer, melder |
| **Uitwerkingen** (onder de use cases) | Activity, Sequence | zeventien use case-realisaties, elk als diagram onder zijn use case: registreren (activity + sequence), lezen op t, codegen/rebuild, projectsync (operatie A→B, snapshot/compactie, herverbinden, sturen/ophalen, werkruimte), transformatie (sequence + roundtrip), EA-import, render-API, inloggen/PEP→PDP, toegangsbeleid, notificatie, AI via MCP, release en uitrol |

## Bestanden

- **Op app.omnium-ide.nl** staat het project (eigenaar `claude`, id `a2e7a101-…`; Mark heeft
  schrijfrecht). Dáár wordt het bijgehouden: Studio → *Project → Van server ophalen…*.
- `omnium-architectuur.studio-project.json` — export van de stand op app (werkbestand
  `studio-project` v3), als back-up en voor een andere instantie: *Project → Importeer project…*.
- `plannen/` — de plannen waarmee het model is gemaakt (`model_wijzigen`-JSON, plus
  `04-realisatie-ops.mjs` voor de view over twee mappen); het model zelf is de bron. Wijzigingen gaan via de Studio of via de MCP-tool
  `model_wijzigen` (eerst voorstel, dan toepassen).

## Hoe het gemaakt is

Met `tools/omnium-mcp/arch-driver.mjs`: dezelfde `model_wijzigen`-weg als de MCP-server
(plan → controle tegen de modeltalen → operaties → `POST …/ops`), maar met een cookie-login of
een API-token, op een lokale API met een eigen database. Daardoor is het model opgebouwd uit
operaties; op app is het met het token van gebruiker `claude` gezet (variabele
`OMNIUM_TOKEN_CLAUDE`, alleen op Marks pc).

```
node tools/omnium-mcp/arch-driver.mjs <basis> <gebruiker> <wachtwoord-env|token-env> maak "Naam"
node tools/omnium-mcp/arch-driver.mjs <basis> <gebruiker> <env> plan "Naam" "<map>" plan.json toepassen
node tools/omnium-mcp/arch-driver.mjs <basis> <gebruiker> <env> bekijk|boom|export …
```

## Aanvullen per onderwerp

Het model is een startpunt uit de documentatie; de sessies die een onderwerp het best kennen
kunnen het aanvullen via MCP (`project_bekijken`, `model_wijzigen`):

| Onderwerp | Waar in het model | Wie |
|---|---|---|
| Transformaties (lezers, regelsets, schrijvers per notatie) | 2 Componenten; uitwerking *Importeer een model* | TRANSFORMATIES |
| M3 / metametamodel, profielen, EA-metametamodel | 2 Componenten (motor, profielen); eventueel een eigen map *M3* | M3-MOF |
| Canvas, projectboom, dialogen | 2 Componenten (Studio); use cases *Modelleren* | OMNIUM-UI |
| Registratie-engine, hub + _Data, tijdreizen, afgeleide relaties | uitwerkingen *Voer een registratie op* en *Lees een entiteit op t* | BACKEND-GEN |
| Toegang (PAP, PDP, PEP, beleidsregister) | 2 Componenten; uitwerkingen *Log in* en *Stel toegangsbeleid op* | Toegang-sessie |
| Projectsync, SSE, compactie, werkruimte | uitwerkingen onder *Werk live samen* | PROJECT (deze sessie) |
| AI-hulp, MCP, meldingen | 2 Componenten; uitwerking *Wijzig een model van buiten via MCP* | AI-hulp-sessie |
| EA-import | uitwerking *Importeer een Sparx EA-pakket* | EA-sessie |

Conventies: use cases als werkwoordzin vanuit de actor; een use case-realisatie hangt als
diagram **onder** de use case (uitwerking); levenslijnen heten naar het component; ArchiMate-
elementen één keer in het model, op meerdere views.
