# AI-assistent in Omnium

Sinds 27-09-2026. De eerste toepassing is de vorm **`ai-assist`**: een tekstvak met een assistent
die een voorstel doet. Dezelfde bouwstenen zijn bedoeld voor latere AI-functies, zoals
modelleer-assistentie in de Studio.

## Uitgangspunten

- **De mens beslist.** De assistent doet een voorstel; de invuller kiest *Overnemen*,
  *Invoegen* of *Weggooien*. Er komt nooit iets zonder die keuze in een veld.
- **Weinig delen.** Naar de AI-dienst gaan alleen de tekst van het veld, de opdracht, het label
  en de beschrijving van het veld, en eventueel de naam van het formulier. De rest van het
  formulier gaat niet mee.
- **Niet op openbare formulieren.** Op het aanmeldformulier (`aanmelden.html`) staat AI uit: tekst
  van een onbekende invuller naar een AI-dienst sturen is een gegevensverwerking (AVG).
  Technisch: `AiToegestaan` (`shared/ai/AiContext.jsx`).
- **Eigen sleutel of toegangscode**, naar het voorbeeld van de MusicBrain-editor:
  - **Eigen sleutel** (Claude of DeepSeek): de browser praat rechtstreeks met de dienst. De
    sleutel staat alleen in die browser (`localStorage`, `omnium.ai.v1`).
  - **Toegangscode**: de browser praat met de proxy op deze server, die de sleutel van de
    eigenaar gebruikt. Zo kan de eigenaar anderen laten proberen zonder zijn sleutel weg te
    geven.
- **Diensten in het paneel:**
  - Claude, DeepSeek;
  - **Alibaba Model Studio** (OpenAI-compatibel; het endpoint hangt af van regio en workspace,
    bv. `https://<WorkspaceId>.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions`,
    en een sleutel werkt alleen in zijn eigen regio);
  - **"andere OpenAI-compatibele dienst"** met een eigen endpoint (alleen https);
  - de Omnium-server (toegangscode).

  Weigert een dienst aanroepen vanuit de browser (CORS), dan meldt het paneel dat. De oplossing
  is die dienst achter de proxy te zetten (`AI_UPSTREAM_URL`) en een toegangscode te gebruiken.
  **GitHub Models** kan niet: GitHub heeft die dienst per 30 juli 2026 stopgezet, en een
  Copilot-abonnement heeft geen API-sleutel voor eigen apps.
- **Productie later anders.** Voor het officiële domein komt er een lokale LLM, of een
  Nederlands of Europees initiatief als de voorwaarden in orde zijn.

## Onderdelen

| Onderdeel | Bestand |
|---|---|
| Profielen (dienst, sleutel of code, model) | `web/vite/src/shared/ai/aiProfielen.js` |
| De vraag (acties, context) en invoegen | `web/vite/src/shared/ai/aiAssist.js` (getest) |
| De aanroep | `web/vite/src/shared/ai/vraagAi.js` |
| Het veld met het paneel | `web/vite/src/components/editor/AiAssistVeld.jsx` |
| De proxy | `handlers/ai_proxy.go` (getest met een nep-upstream) |

**De aanroep, per dienst:**
- **Claude:** via de officiële `@anthropic-ai/sdk`, pas geladen als hij nodig is.
  - Standaardmodel `claude-opus-5`, met `effort: "low"` voor korte herschrijftaken.
  - `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): weigert het model een
    verzoek, dan probeert de API het zelf opnieuw met een ander model.
  - Fouten worden Nederlandse meldingen: ongeldige sleutel, te veel verzoeken, overbelast,
    geweigerd.
- **DeepSeek en de proxy:** het OpenAI-formaat (`chat/completions`).

## De vorm in een formulier

**Proberen:** replay `registraties-replay-init-formulierdefinitie-voorbeeld-ai-assist-2026-09-28.json`
(code `voorbeeld-ai-assist`), dan `inhoud.html#/t/initiatieven/nieuw?formulier=voorbeeld-ai-assist`.

```json
{ "type": "veld", "veld": "toelichting", "label": "Toelichting", "vorm": "ai-assist",
  "vormConfig": { "formulier": "Aanmelding initiatief", "acties": ["korter", "helder", "spelling"] } }
```

- **Acties:** `korter`, `helder` (B1), `zakelijk`, `aanvullen`, `spelling`. Er is ook altijd
  een vrij veld voor een eigen opdracht, bv. "schrijf een korte samenvatting van onze
  doelstellingen".
- **De eerste keer** vraagt het paneel welke dienst je wilt gebruiken, en de sleutel of code.
- **Welk model:** onder ⚙ haalt *Modellen ophalen* de lijst bij de dienst zelf op (Claude:
  `models.list()` via de SDK; OpenAI-compatibel: `GET …/models`). Kies er een of typ een naam. De
  naam die de dienst terugmeldt, bv. *deepseek-flash* voor `deepseek-chat`, staat bij het
  voorstel.

## De invulhulp: een heel formulier voorinvullen (sinds 28-09)

Boven een formulier in de nieuw-modus staat **✨ Invullen met AI** (niet op het openbare
aanmeldformulier).

**Hoe het werkt:**
1. **Bron:** plak een tekst, of geef een webadres.
2. **Voorstellen:** de AI-dienst krijgt de bron en een beschrijving van de velden (naam, uitleg,
   keuzelijst), en geeft per veld een voorstel of `null`.
3. **Kiezen:** in een tabel staan veld, huidige waarde en voorstel naast elkaar. Lege velden
   staan standaard aangevinkt, gevulde niet. *Overnemen* zet alleen wat is aangevinkt.

**Webadressen:** de meeste AI-diensten (DeepSeek, Qwen) kunnen zelf geen URL openen, want hun
chat-API heeft geen web-tool. Daarom haalt de **server** de pagina op en krijgt het model de
tekst (`POST /api/ai/lees-url`, `handlers/ai_lees_url.go`).
- Een GitHub-repo-URL wordt de README, een blob-URL het ruwe bestand.
- Uit HTML komt alleen de zichtbare tekst.
- Maximaal 2 MB en 60.000 tekens voor het model.
- Alleen voor editors.
- Tegen SSRF: alleen http(s) op poort 80/443, en elk IP wordt bij het verbinden gecontroleerd
  (geen loopback, privé, link-local of metadata-adressen, ook niet na een redirect), met hooguit
  5 redirects in 10 s.

**Het antwoord is JSON:**
- Claude krijgt het schema via structured outputs (`output_config.format`, `json_schema`,
  effort `medium`).
- DeepSeek, Alibaba en de proxy krijgen `response_format: json_object`.

  Daarna controleert `naarVoorstellen` streng: alleen de gevraagde velden, waarden uit de
  keuzelijst, de juiste soort, en een datum als `JJJJ-MM-DD`.

**Wat niet wordt ingevuld:**
- lijsten (rijen);
- verwijzingen naar andere records (organisatie, gemeente);
- vaste waarden en alleen-lezen velden.

**Wat er naar de dienst gaat:** de bron en de veldnamen, niet wat al is ingevuld. De bron wordt
als data gemarkeerd, en het model krijgt de opdracht geen instructies uit de bron te volgen.

**Bijsturen (dialoog):** na de voorstellen kun je bijsturen ("maak de omschrijving korter",
"het type is Standaard"). Het gesprek gaat mee (vraag, antwoord, jouw opmerking), en het model
geeft een nieuw, volledig voorstel. In het AI-veld (`ai-assist`) werkt dat net zo: "nog korter",
"noem ook de gemeenten".

**Transparantie:**
- *Niet overgenomen (n)* toont per veld waarom iets niet is overgenomen: *geen antwoord*, of
  *staat niet in de keuzelijst*.
- *Ruw antwoord (JSON)* toont wat het model precies gaf.
- Een antwoord op een keuzelijst krijgt wat speling: hoofdletters, leestekens, en het begin van
  de optie (`laag 5 (interactie)` → *Laag 5*). Bij twijfel wordt er niets gekozen.
- Het model mag voor keuzelijsten de best passende optie afleiden als de bron het duidelijk
  beschrijft; voor namen, cijfers en feiten blijft het streng.

**Code:** `shared/ai/aiInvulhulp.js` (puur, getest) en `components/editor/AiInvulhulp.jsx`.

## De proxy aanzetten en codes uitgeven

**Instellingen in `.env`:**
- `AI_UPSTREAM_KEY`: de sleutel van de eigenaar. Leeg betekent de proxy staat uit (503).
- `AI_UPSTREAM_URL`: standaard DeepSeek.
- `AI_UPSTREAM_MODEL`: wordt altijd afgedwongen, zodat een client geen duur model kan kiezen.
- `AI_DATA_DIR`: standaard `data/ai`. Op pf is dat het volume `pf_ai_data` op `/data/ai`.

De nginx van de frontend stuurt `/ai/…` al door naar de API; Caddy hoeft niet te veranderen.

**Een ander model of een andere dienst** achter de proxy, bijvoorbeeld Claude in plaats van
DeepSeek: zie [`AI_PROXY_MODEL.md`](AI_PROXY_MODEL.md).

**Codes beheren** kan in Omnium Studio, activiteit **AI-toegang** onder *beheer*
(`studio/activities/aiToegangActivity.jsx`): aanmaken met naam, looptijd en daglimieten, de code
één keer zien en kopiëren, het verbruik van vandaag bekijken, en intrekken. Onder water zijn dat
de volgende admin-endpoints:

```text
POST   /api/ai/codes           {"naam": "Collega X", "dagen": 14, "perDag": 100, "maxTokensPerDag": 200000}
GET    /api/ai/codes           lijst met het verbruik van vandaag (zonder de codes zelf)
DELETE /api/ai/codes/Collega%20X   intrekken (werkt meteen)
```

**Hoe de codes werken:**
- Een code (`om-…`) is **alleen bij het aanmaken** zichtbaar. Bewaard wordt een SHA-256-hash,
  en die wordt in constante tijd vergeleken.
- Codes **verlopen**, standaard na 14 dagen.
- Er zijn daglimieten op **aanroepen** en op **tokens**. Er wordt pas geteld na een geslaagde
  aanroep.
- Verder: maximaal 30 aanroepen per minuut per IP, `stream` wordt weggehaald, het verzoek mag
  maximaal 512 KB zijn, en van een fout van de upstream komt alleen de boodschap door.

**Verbeteringen ten opzichte van de MusicBrain-proxy:**
- codes verlopen;
- alleen een hash van de code wordt bewaard;
- er is een daglimiet op tokens;
- er wordt pas na succes geteld;
- er is een limiet per IP;
- foutmeldingen van de upstream worden ingekort tot hun boodschap.

## Nog niet

- **Claude via de proxy.** Die komt met de Go-SDK, niet via een OpenAI-compatibele omweg.
- **Invulhulp ook bij bewerken** en voor lijsten en verwijzingen (zoek-en-koppel).
- **Modelleer-assistentie** in de Studio.
