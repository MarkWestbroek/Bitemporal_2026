# AI-chat Archief (v06)

Deze map (voorheen `copilot-chats`) is de vervanger voor online chat-sync: je bewaart belangrijke
chats (Copilot én Claude) als bestanden in Git.

Voor automatische export en synchronisatie via Git, zie ook `../copilot-chat-sync.md`.

## Structuur

- `exports/` bevat geëxporteerde chats uit het exportscript in `scripts/export-copilot-chats.py`.
- `summaries/` bevat korte samenvattingen per chat in Markdown.
- `templates/` bevat invultemplates.

## Naamconventie

Gebruik dit patroon voor zowel export als samenvatting:

`YYYY-MM-DD-onderwerp-korte-context`

Voorbeelden:

- `2026-03-28-registreer-handler-opvoer-afvoer.json`
- `2026-03-28-registreer-handler-opvoer-afvoer.md`
- `2026-03-29-schema-api-nieuw-veld-aanvang.md`

Richtlijnen:

- Datum eerst voor natuurlijke sortering.
- Gebruik kleine letters en koppeltekens.
- Houd de titel kort maar herkenbaar.
- Gebruik voor een export en samenvatting exact dezelfde stamnaam.

## Snel workflow

1. Draai het exportscript of gebruik de git hook om chats naar `exports/` te schrijven.
2. Maak direct een samenvatting in `summaries/` met dezelfde stamnaam.
3. Voeg beide bestanden toe aan je commit als de chat leidde tot code- of ontwerpbeslissingen.
4. Zet herbruikbare prompts om naar `.prompt.md` met `/savePrompt` en bewaar ze in een geschikte map (bijvoorbeeld `prompts/` of `docs/prompts/`).

## Installatie hook

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File bitemp_register_v06/scripts/install-chat-hook.ps1
```

Git Bash of andere POSIX shell:

```sh
sh bitemp_register_v06/scripts/install-chat-hook.sh
```

Na installatie draait de export bij elke `git commit`, ook vanuit GitHub Desktop.

## Beslisregel: wel of niet bewaren?

Wel bewaren:

- Architectuurkeuzes
- Belangrijke bugfix-redeneringen
- Data model beslissingen
- Query/tijdreis keuzes met impact

Niet bewaren:

- Korte Q&A zonder projectimpact
- Tijdelijke exploratie zonder uitkomst

## Privacy en security

Controleer voor commit:

- Geen secrets, tokens of wachtwoorden
- Geen gevoelige persoonsgegevens
- Geen interne URLs die je niet wilt delen
