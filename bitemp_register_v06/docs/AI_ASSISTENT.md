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

```json
{ "type": "veld", "veld": "toelichting", "label": "Toelichting", "vorm": "ai-assist",
  "vormConfig": { "formulier": "Aanmelding initiatief", "acties": ["korter", "helder", "spelling"] } }
```

- **Acties:** `korter`, `helder` (B1), `zakelijk`, `aanvullen`, `spelling`. Er is ook altijd
  een vrij veld voor een eigen opdracht, bv. "schrijf een korte samenvatting van onze
  doelstellingen".
- **De eerste keer** vraagt het paneel welke dienst je wilt gebruiken, en de sleutel of code.

## De proxy aanzetten en codes uitgeven

**Instellingen in `.env`:**
- `AI_UPSTREAM_KEY`: de sleutel van de eigenaar. Leeg betekent de proxy staat uit (503).
- `AI_UPSTREAM_URL`: standaard DeepSeek.
- `AI_UPSTREAM_MODEL`: wordt altijd afgedwongen, zodat een client geen duur model kan kiezen.
- `AI_DATA_DIR`: standaard `data/ai`. Op pf is dat het volume `pf_ai_data` op `/data/ai`.

De nginx van de frontend stuurt `/ai/…` al door naar de API; Caddy hoeft niet te veranderen.

**Codes beheren (als admin, bv. met curl en een admin-sessie):**

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
- **`ai-extract`:** een formulier voorinvullen uit een tekst of URL.
- **Modelleer-assistentie** in de Studio.
- **Een beheerscherm voor codes.** Nu gaat dat via de API.
