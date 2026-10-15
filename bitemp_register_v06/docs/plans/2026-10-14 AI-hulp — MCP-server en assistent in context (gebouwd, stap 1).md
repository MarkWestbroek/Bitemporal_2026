# AI-hulp — MCP-server en assistent in context (gebouwd, stap 1)

*2026-10-14, 's nachts gebouwd na "na de 0.20.1-release mag je verder met de AI-hulp" (Mark).
BACKLOG: AI-1 (MCP-API) en AI-2 (assistent in context), hoge prioriteit. Branch
`feat/omnium-mcp` (worktree `D:\Git\Bitemporal_2026_meld`), gemerged naar main 14-10 (b68399ff).
Stap 1b en AI-1 stap 2: zie §5 (branch `feat/assistent-mappen`).*

## 1. Eén gedachte, twee ingangen

Zoals in de MusicBrain-editor: dezelfde mogelijkheden van buiten (MCP, een AI-client zoals Claude
Code in VS Code) en van binnen (de assistent in de Studio). Beide werken **met de rechten van de
gebruiker** en laten een wijziging eerst als voorstel zien.

## 2. AI-1 stap 1: persoonlijke API-tokens + MCP-server

- **Tokens** (`middleware/token.go`, `gebruikers/token.go`, tabel `gebruiker_token`):
  `Authorization: Bearer omt_…` werkt als de gebruiker zelf; rol en status per verzoek uit het
  register. Alleen de sha256 bewaard; 1–365 dagen; intrekken; "laatst gebruikt". Met een token maak
  je geen nieuw token. Studio: *Gebruikers → Mijn API-tokens*.
- **`tools/omnium-mcp`** (stdio, `@modelcontextprotocol/sdk` 1.32.1): `omnium_wie_ben_ik`,
  `meldingen_lijst`, `melding_bekijken` (met de schermafbeeldingen als afbeelding),
  `melding_reageren`, `melding_behandelen`, `projecten_lijst`. Koppeling: `.mcp.json` in de
  repo-root, token als omgevingsvariabele `OMNIUM_TOKEN` (nooit in de repo). README in de map.
- **Getest:** unittests van de tools (nep-API), Go-unittests (Bearer, geldigheid), en end-to-end
  over het echte MCP-protocol tegen een lokale API met jouw testmeldingen (#5 kwam mee mét
  schermafbeelding); een token kan geen token maken (403), een fout token geeft 401.

## 3. AI-2 stap 1: de assistent in de Studio

Vorm zoals de transformaties (lezer → regelset → toepasser):

| | Hier |
|---|---|
| lezer | de AI leest de opdracht en levert een **plan** (JSON; bij Claude structured outputs) |
| regelset | het **profiel (M2)**: alleen bestaande element- en relatietypen, en alleen relaties die de verbindingsregels toestaan (`assistentKern.js`) |
| toepasser | `planNaarCoreModel` + `importeerModel`: één undo-stap, gesynct (anderen zien het live) |

- **Rechtsklik op een map → ✨ Vraag de assistent…**: kies de taal (laatste keuze onthouden),
  beschrijf wat je wilt; het voorstel toont elementen per type en de relaties, plus wat is
  weggelaten en waarom. **Toepassen** maakt de elementen, relaties en een diagram (automatische
  opstelling) in die map en opent het. Bijsturen ("noem de actor Klant") houdt het gesprek vast.
- **Rechtsklik op een element** (met een compartiment voor velden, bv. een gegevenselement):
  "voeg aap: string, noot: int, mies: tekst toe" → nieuwe velden; bestaande namen niet dubbel.
- **AI-dienst:** de bestaande AI-instellingen (eigen sleutel voor Claude/DeepSeek/…, of een
  toegangscode voor de Omnium-proxy). Zonder instelling vraagt de assistent eerst daarom.
- **Getest:** unittests op jouw voorbeeld (7 elementen, 5 relaties; een verzonnen type, een
  extend van actor naar use case en een include die niet bestaat worden met uitleg weggelaten);
  e2e met een gemockte AI (model in een map, velden met bijsturen, zonder instelling).
- **Niet getest met een echte AI:** daarvoor is een sleutel of toegangscode nodig. De prompt
  geeft daarom ook zelf de JSON-vorm (DeepSeek en de proxy krijgen geen schema).

## 4. Volgende stappen (voorstel)

1. **Proberen met een echte AI** (Claude met eigen sleutel, of DeepSeek via de proxy) op jouw twee
   voorbeelden; prompt bijstellen op wat er misgaat.
2. **AI-1 stap 2: modellen via de MCP.** Lezen (project → mappen, diagrammen, elementen per taal)
   en wijzigen als projectsync-operaties (dan ziet de Studio het live), met dezelfde regelset
   (`assistentKern.js`) als de assistent: één set modeloperaties, twee ingangen.
3. **AI-2 vervolg:** ook vanaf het canvas (rechtsklik op een element of leeg vlak), bestaande
   elementen wijzigen (hernoemen, relaties leggen tussen bestaande elementen), en het nieuwe
   diagram meteen passend in beeld.
4. **MCP op afstand** (streamable HTTP achter de API) zodat Claude Desktop of een andere machine
   zonder de repo kan koppelen.

## 5. Stap 1b en AI-1 stap 2 (14-10, avond — na Marks eerste proef)

Mark probeerde de assistent met DeepSeek Flash via de proxy: *"maak een map use case model met
daarin een diagram met use case test en actor gebruiker"* — de map ontbrak; *"maak een
associatie tussen gebruiker en test"* — de assistent kende de bestaande elementen niet. Zijn
wensen: mappen (en meerdere samenhangende talen, bv. een use case met een activiteitendiagram
eronder), **bestaande elementen** ("heel belangrijk"), **doorpraten na Toepassen** ("je sluit
het, kijkt, en ziet dat het toch nog niet goed is"), Flash als standaard ("het moet snel gaan")
en een strengere controle. Gebouwd:

| | |
|---|---|
| plan | `diagrammen` (nieuw in een taal, evt. in een submap; of `bestaand`), `elementen` (nieuw op een diagram, evt. `in` een container; of `bestaand`: hernoemen / op een diagram zetten), `connectoren` (sleutel of bestaand id), `verbanden` (kruisverband tussen talen) |
| regelset | `assistentKern.controleerPlan` op een **profielsamenvatting als data** (ook in Node): typen, verbindingsregels, toegestane leden van containers; plus `descriptor.assistent` (M2): `aanwijzingen` in de prompt en `paren` die de controle afdwingt (associatie actor → use case: omgekeerd wordt gedraaid, actor–actor valt weg). Verband met een diagram → eerste element erop. |
| toepasser | `wijziging.maakWijziging` → mappen, per profiel elementen/diagrammen (nieuwe knopen op een bestaand diagram rechts ernaast), plaatsing, links; Studio: `pasWijzigingToe` (nieuwe store-actie, één undo-stap, sync via het vangnet); MCP: `naarOps` |
| context | `bestaandInMap`: diagrammen, elementen en relaties in de map en submappen, met ids, gaan mee in de prompt |
| Studio | talen als chips (+ automatisch: genoemd in de opdracht of al in de map), gesprekslog, één invoerveld (Vraag / Aanpassen), Toepassen, *nieuw gesprek*; rechtsklik op een element opent het gesprek over zijn map |
| MCP | `modeltalen`, `project_bekijken`, `model_wijzigen` (voorstel, of `toepassen: true` → `POST …/ops`); talen uit `profielen.json` (`web/vite/scripts/profielen-voor-mcp.mjs`) |

**Flash of Pro** (14-10, zelfde prompt via de proxy): Flash 2–4 s en ~1,4k tokens, Pro 40–64 s en
5–7k tokens (denkt eerst; ~15–20× duurder per vraag). Pro was inhoudelijk beter op een lastige
opdracht, maar te traag voor een gesprek; met de aanwijzingen en de strengere controle levert
Flash nu goede plannen (Marks scenario's: 1,2–7 s per beurt). **Flash blijft de standaard.**

**Getest:** unittests (kern + toepasser, 11), MCP-tools tegen een nep-API (9), e2e met gemockte AI
(4), Flash-scenario's via de proxy, en de MCP end-to-end tegen een lokale API (project lezen uit
snapshot + operaties, voorstel, toepassen, opnieuw lezen).

**Vervolg:** vanaf het canvas (rechtsklik op een element of leeg vlak); elementen of relaties
weghalen (nu alleen toevoegen, hernoemen en op een diagram zetten); MCP op afstand (HTTP).
