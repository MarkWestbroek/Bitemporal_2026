# omnium-mcp — Omnium als MCP-server

Een MCP-server (Model Context Protocol) waarmee een AI-client — Claude Code in VS Code, Claude
Desktop, … — Omnium kan lezen en meldingen kan behandelen, **met de rechten van één gebruiker**.
Eerste stap van AI-1 (BACKLOG, 14-10-2026); opzet zoals de MusicBrain-MCP (stdio, de officiële SDK).

## Tools

| Tool | Wat |
|---|---|
| `omnium_wie_ben_ik` | met welke gebruiker, rol en instantie de server werkt |
| `meldingen_lijst` | meldingen (open of alle); een melder ziet de eigen, een beheerder alle |
| `melding_bekijken` | één melding: beschrijving, context (versie, browser, plek, pad), gesprek **en de schermafbeeldingen** |
| `melding_reageren` | een reactie plaatsen |
| `melding_behandelen` | status, toelichting, prioriteit, behandelaar (beheerder) |
| `projecten_lijst` | de Studio-projecten waar je bij mag, met je recht |
| `modeltalen` | de modelleertalen (M2): typen, relaties met hun regels, aanwijzingen |
| `project_bekijken` | de projectboom; of wat er in een map staat, **met ids** |
| `model_wijzigen` | een plan (JSON) laten controleren en, met `toepassen: true`, doorvoeren |

Alles gaat via de gewone Omnium-API (`/api/meldingen`, `/api/studio/projecten`), dus dezelfde
afscherming als in de Studio.

### Modellen (stap 2, 14-10)

`model_wijzigen` gebruikt **dezelfde regelset en toepasser als de ✨ assistent in de Studio**
(`web/vite/src/studio/assistent/assistentKern.js` en `wijziging.js`): de AI-client levert het
plan, de server-kant van de MCP controleert het tegen de taal (onbekende typen en verboden
relaties eruit, omgekeerde associaties gedraaid) en maakt er projectsync-operaties van
(`nieuweMap`, `patchElementen`, `patchDiagrammen`, `plaatsPerMap`, `patchLinks`). Die gaan naar
`POST /api/studio/projecten/:id/ops`; een open Studio ziet ze live. Zonder `toepassen` krijg je
alleen het voorstel. De stand van een project = snapshot + operaties, nagespeeld in Node-stores
(zoals de EA-import uit git).

Het plan:

```json
{"uitleg": "…",
 "diagrammen": [{"sleutel": "d1", "taal": "usecase05", "naam": "…", "map": "Submap"}, {"sleutel": "d2", "bestaand": "<diagram-id>"}],
 "elementen": [{"sleutel": "u1", "type": "usecase", "naam": "…", "diagram": "d1", "in": "<container>"}, {"bestaand": "<element-id>", "naam": "nieuwe naam"}],
 "connectoren": [{"type": "associatie", "bron": "a1", "doel": "<bestaand id>"}],
 "verbanden": [{"van": "x1", "naar": "u1", "soort": "realiseert"}],
 "opstelling": [{"diagram": "<id>", "actie": "naast-elkaar", "elementen": ["…"]}, {"diagram": "<id>", "actie": "leesvolgorde-lr"}],
 "posities": [{"diagram": "<id>", "element": "<id>", "x": 400, "y": 200}, {"diagram": "<id>", "element": "<id>", "naast": "<id>", "kant": "rechts", "afstand": 60}],
 "verwijderen": ["<id van een bestaand element of een bestaande relatie>"],
 "nietGedaan": ["Kleuren kan ik niet zetten."]}
```

**Grenzen (18-10).** De server-instructies en de beschrijving van `model_wijzigen` zeggen wat
níet kan: diagrammen of mappen weghalen, kleuren, lijnroutes, elementmaten. Wat het plan vraagt
maar niet doorgaat, staat in het antwoord onder *Weggelaten* of *NIET GEDAAN*, zodat de
aanroepende AI het niet als gedaan meldt. `project_bekijken` met een map toont per element waar het
staat (`op <diagram> @ x,y (b×h)`). Layouts per taal staan in `modeltalen` (`Layouts …`); de
MCP laadt de strategie uit de profielmodule, of bouwt de algemene layout op de leesvolgorde uit
`profielen.json`.

Vereisten: de Studio-code in `web/vite` moet zijn afhankelijkheden hebben (`npm install` daar).
De talen staan in `profielen.json`; **na een wijziging aan een profiel opnieuw genereren** met
`node scripts/profielen-voor-mcp.mjs` (vanuit `web/vite`).

## Instellen (eenmalig)

1. **Afhankelijkheden:** `cd bitemp_register_v06/tools/omnium-mcp && npm install`
2. **Token:** Studio → *Gebruikers* → *Mijn API-tokens* → *Token maken*. Kopieer het (je ziet
   het één keer).
3. **Omgevingsvariabelen** (niet in de repo; de repo is openbaar):
   - Windows: `setx OMNIUM_TOKEN "omt_…"` (en eventueel `setx OMNIUM_URL "http://localhost:8082"`
     voor een lokale API; standaard `https://app.omnium-ide.nl`), daarna VS Code opnieuw starten.
   - macOS/Linux: `export OMNIUM_TOKEN=omt_…` in je shellprofiel.
4. **Claude Code:** de repo heeft een `.mcp.json` met de server `omnium`. Bij de eerste keer vraagt
   Claude Code of je die projectserver vertrouwt; `/mcp` toont de stand.

Daarna kun je in een chat bijvoorbeeld zeggen: *"Welke meldingen staan er open? Pak #5 op."* —
de sessie leest de melding met schermafbeelding, past de code aan, en zet de status met een
toelichting. Of: *"Maak in project Zandbak, map Test, een activiteitendiagram onder use case
test"* — de sessie bekijkt de map, maakt een plan, laat het controleren en past het toe.

## Testen

- `node --test tools.test.mjs` — de tools tegen een nep-API (ook de modeltools: snapshot + ops
  naspelen, voorstel zonder POST, toepassen met de juiste operaties, leesrecht weigert).
- `OMNIUM_URL=… OMNIUM_TOKEN=… node smoke.mjs` — de server echt over stdio (initialize,
  tools/list, tools/call), tegen een draaiende API.

## Veiligheid

- Een token werkt als de gebruiker zelf; rol en status komen per verzoek uit het register (een
  geblokkeerde gebruiker kan ook met een token niets meer).
- Alleen de sha256 van een token staat in de database; intrekken kan in hetzelfde scherm.
- Met een token maak je geen nieuw token (daarvoor log je in).
