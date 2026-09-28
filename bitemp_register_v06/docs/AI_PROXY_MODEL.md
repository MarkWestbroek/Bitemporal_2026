# AI-proxy: een ander model kiezen (DeepSeek, Claude, …)

Hoe je instelt welk model de Omnium-proxy (`/ai/v1/chat/completions`, `handlers/ai_proxy.go`)
gebruikt. Het gaat om de route **toegangscode**. Gebruikers met een eigen sleutel kiezen zelf
in het AI-paneel. Achtergrond: [`AI_ASSISTENT.md`](AI_ASSISTENT.md).

## Waar

In `/srv/omnium-pf/.env` op de VPS (lokaal: `bitemp_register_v06/.env`):

| Variabele | Betekenis |
|---|---|
| `AI_UPSTREAM_URL` | Het OpenAI-compatibele endpoint (`…/chat/completions`). Leeg = DeepSeek. |
| `AI_UPSTREAM_KEY` | De sleutel van de eigenaar. Leeg = de proxy staat uit (503). |
| `AI_UPSTREAM_MODEL` | Het model. Wordt altijd afgedwongen, zodat een gebruiker met een code geen duurder model kan kiezen. |

Zet **geen commentaar achter een waarde** (`AI_UPSTREAM_MODEL=deepseek-chat # …`). Docker
neemt dat mogelijk mee als deel van de waarde.

## Instellingen per dienst

**DeepSeek** (sinds 28-09-2026 op pf):
```
AI_UPSTREAM_URL=            (leeg = https://api.deepseek.com/chat/completions)
AI_UPSTREAM_KEY=sk-…
AI_UPSTREAM_MODEL=deepseek-chat
```

**Claude**, via het OpenAI-compatibele endpoint van Anthropic:
```
AI_UPSTREAM_URL=https://api.anthropic.com/v1/chat/completions
AI_UPSTREAM_KEY=sk-ant-…    (console.anthropic.com)
AI_UPSTREAM_MODEL=claude-sonnet-5
```

Welk Claude-model:
- `claude-sonnet-5`: aanbevolen voor codes die je aan anderen geeft; goed en duidelijk goedkoper.
- `claude-opus-5`: het sterkst, maar per token een stuk duurder. Via de proxy betaalt de eigenaar
  alles.
- `claude-haiku-4-5-20251001`: het goedkoopst.

**Alibaba (Qwen)** of een andere OpenAI-compatibele dienst: zet de URL van die dienst, de
sleutel en de modelnaam. Een Alibaba-sleutel werkt alleen in zijn eigen regio.

## Beperkingen van Claude via het compatibele endpoint

- **Geen gegarandeerde JSON.** De invulhulp stuurt `response_format: json_object`, maar dat
  endpoint volgt dat niet strikt. De prompt vraagt om JSON, en `leesJson` haalt JSON ook uit
  tekst eromheen. Meestal gaat het goed, maar niet gegarandeerd.
- **Geen `effort`, geen fallback bij een weigering, geen structured outputs.** Die zitten alleen
  in de eigen Messages API.
- **Beter:** met een **eigen Claude-sleutel** in het paneel gaat alles via de officiële SDK, met
  al die functies.
- **De nette proxy-versie** spreekt met de Go-SDK de eigen Messages API. Die staat bij *Nog niet*
  in `AI_ASSISTENT.md`.

## Toepassen op pf

Na het wijzigen van `.env` moet de api-container opnieuw worden aangemaakt. Een `docker restart`
leest de env-file niet opnieuw.

```bash
BASE=/srv/omnium-pf; COMPOSE=$BASE/src/bitemp_register_v06/deploy/vps/docker-compose.pf.yml
docker compose -p omnium-pf -f "$COMPOSE" --env-file "$BASE/.env" up -d --no-deps --force-recreate api
```

Of de hele deploy: `bash /srv/omnium-pf/src/bitemp_register_v06/deploy/vps/pf.sh deploy`.

**Controleren:**
- Zonder code: `curl -X POST https://pf.common-ground-lab.nl/ai/v1/chat/completions -d '{}'` geeft
  **401** (*onbekende toegangscode*) als de proxy aanstaat, en **503** als er geen sleutel is.
- Daarna maak je in Omnium Studio onder **AI-toegang** een code aan en probeer je hem in het
  AI-paneel (dienst *Omnium-server*). Het antwoord toont de modelnaam die de dienst terugmeldt.
- De admin-endpoints (`/api/ai/codes`) werken met een login-cookie die alleen over https werkt.
  Test ze dus via het domein, niet via `localhost:8084`.

**Sleutels veilig overzetten:** geef een sleutel via stdin door (`… | ssh vps1 '…'`), niet als
argument op de opdrachtregel of in een log. Maak eerst een backup van `.env`
(`.env.bak-<datum>`).
