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

Alles gaat via de gewone Omnium-API (`/api/meldingen`, `/api/studio/projecten`), dus dezelfde
afscherming als in de Studio.

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
toelichting.

## Testen

- `node --test tools.test.mjs` — de tools tegen een nep-API.
- `OMNIUM_URL=… OMNIUM_TOKEN=… node smoke.mjs` — de server echt over stdio (initialize,
  tools/list, tools/call), tegen een draaiende API.

## Veiligheid

- Een token werkt als de gebruiker zelf; rol en status komen per verzoek uit het register (een
  geblokkeerde gebruiker kan ook met een token niets meer).
- Alleen de sha256 van een token staat in de database; intrekken kan in hetzelfde scherm.
- Met een token maak je geen nieuw token (daarvoor log je in).
