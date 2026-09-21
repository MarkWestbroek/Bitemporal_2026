# Chat: Integrate other AI models

- **Datum**: 2026-05-28 11:40
- **Sessie-ID**: `a08022e0-faab-4417-bfb2-72f9489b365b`
- **Berichten**: 4

---

## 🧑 User

Kan ik in deze chat ook andere AI modellen aansluiten waar ik apart een api-key oid voor heb? Loopt betaling daarvan dan niet via github copilot?

---

## 🤖 Assistant

Kort antwoord: **niet rechtstreeks in GitHub Copilot Chat**, maar er zijn alternatieven.

### Hoe het werkt in Copilot Chat

Via de **model picker** (dropdown linksboven in het chatvenster) kun je wisselen tussen beschikbare modellen zoals Claude, GPT-4o, Gemini, o3, etc. Deze lopen allemaal **via je Copilot-abonnement** — je hebt geen eigen API-key nodig. Betaling gaat via GitHub (en daarna naar Anthropic/OpenAI/Google).

### Eigen API-key koppelen

Dat kan **niet** in Copilot Chat zelf. Opties als je eigen keys wilt gebruiken:

- **[Continue](https://marketplace.visualstudio.com/items?itemName=Continue.continue)** — VS Code extensie die je eigen OpenAI/Anthropic/lokale Ollama-keys accepteert, heeft een eigen chatinterface naast Copilot.
- **[Cline](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev)** — zelfde principe, agentic.
- **Codestral / Mistral via hun eigen VS Code extensie** — eigen betaalrekening.

### Praktisch verschil

| | Copilot model picker | Eigen API-key extensie |
|---|---|---|
| Betaling | Copilot-abonnement | Eigen provider-account |
| Setup | Niets nodig | API-key invullen in extensie |
| In deze chat | Ja | Nee, aparte chat |

Als je wilt kijken welke modellen nu beschikbaar zijn in je Copilot-plan, klik op het model-label (nu: "Claude Sonnet 4.6") rechtsonder of linksboven in dit chatvenster.

---

## 🧑 User

welke modellen worden nu als vergelijkbaar krachtig beschouwd, vergeleken met Sonnet of Opus?
En doet de copilot chat ook nog iets meer dan de vraag doorsturen naar een Agent?

---

## 🤖 Assistant

### Vergelijkbaar krachtige modellen (mei 2026)

| Model | Aanbieder | Niveau |
|---|---|---|
| **Claude Sonnet 4.5 / 4.6** | Anthropic | Snel + sterk (dit model) |
| **Claude Opus 4** | Anthropic | Zwaarste Anthropic-model |
| **GPT-4.1 / GPT-4o** | OpenAI | Vergelijkbaar met Sonnet |
| **o3 / o4-mini** | OpenAI | Reasoning-focus (sterk bij wiskunde/code) |
| **Gemini 2.5 Pro** | Google | Vergelijkbaar topniveau, groot contextvenster |
| **Grok 3** | xAI | Vergelijkbaar, minder wijdverbreid |

Opus/o3/Gemini 2.5 Pro zitten een trede hoger qua capaciteit, maar zijn trager en duurder.

---

### Wat doet Copilot Chat meer dan "doorsturen naar een model"?

Behoorlijk veel. De waarde zit in de **context-injectie en toollaag** die Copilot er omheen bouwt:

- **Workspace-context**: bestandsstructuur, open editor, huidige selectie, git-status — dit gaat automatisch mee als systeemprompt
- **Instructiebestanden**:  en instruction-files per pad worden automatisch geladen (dus dat hele architectuuroverzicht van v06 wat je hebt ingesteld)
- **Tools / agent-loop**: Copilot besluit zelf welke tools het aanroept (bestandslezen, grep, terminal, errors ophalen) en itereert meerdere rondes zonder dat jij tussendoor hoeft te sturen
- **Memory-systeem**: user/session/repo-geheugen wordt automatisch ingeladen
- **Foutcontext**: diagnostics uit de Problems-panel worden meegestuurd bij `Fix`-acties
- **Skills en subagents**: gespecialiseerde sub-agents kunnen worden aangeroepen voor specifieke taken
- **Model routing**: bij `@workspace`, `@terminal`, `@vscode` stuurt Copilot naar de juiste context-provider vóór de modelaanroep

Het model zelf "ziet" dus een rijke, voorbewerkte prompt — niet puur jouw tekst.

---
