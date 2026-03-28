# Copilot Chat Archief (v06)

Deze map is de vervanger voor online chat-sync: je bewaart belangrijke chats als bestanden in Git.

## Structuur

- `exports/` bevat ruwe exports uit VS Code (`Chat: Export Chat...`), meestal JSON.
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

1. Exporteer belangrijke chat: `Chat: Export Chat...` naar `exports/`.
2. Maak direct een samenvatting in `summaries/` met dezelfde stamnaam.
3. Voeg beide bestanden toe aan je commit als de chat leidde tot code- of ontwerpbeslissingen.
4. Zet herbruikbare prompts om naar `.prompt.md` met `/savePrompt` en bewaar ze in een geschikte map (bijvoorbeeld `prompts/` of `docs/prompts/`).

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
