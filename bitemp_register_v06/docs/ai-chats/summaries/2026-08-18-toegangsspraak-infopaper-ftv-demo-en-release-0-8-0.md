# Chat Samenvatting

## Metadata

- Datum: 2026-08-18 t/m 2026-09-16
- Titel: Toegangsspraak — info-paper, FTV-demo, consolidatie en release studio 0.8.0 / api 0.6.0
- Bestandstamnaam: 2026-08-18-toegangsspraak-infopaper-ftv-demo-en-release-0-8-0
- Gerelateerde export: ../exports/2026-08-18-toegangsspraak-infopaper-ftv-demo-en-release-0-8-0.md
- Gerelateerde branch/commit: `fc2eca5` (info-paper), `feat/toegangsspraak-demo-model`, `feat/archimate-exchange`, release-merge `b1fe996` met tags `studio/v0.8.0` en `api/v0.6.0`, `docs/sessie-export-en-handover-2026-09-16`
- AI: **Claude** (Claude Code, VS Code-extensie op de laptop)

## Doel

Eén lange werksessie rond Toegangsspraak, de klare-taal-beleidstaal voor toegangsbeleid:
een extern deelbaar info-paper schrijven, de FTV-werkgroepdemo van 15 september
voorbereiden, daarna het werk van meerdere parallelle chats consolideren tot een release,
die uitrollen op de VPS, en tot slot de overstap naar de desktop mogelijk maken.

## Beslissingen

- **Info-paper beantwoordt de grammaticavraag expliciet.** Toegangsspraak is een
  gecontroleerde natuurlijke taal met een formele (LL(1)-achtige) EBNF-grammatica en een
  handgeschreven recursive-descent parser — geen NLP. Operatoren, handelingen en plichten
  zijn *data* (registers), niet grammatica: het ODRL-Profile-mechanisme doorgetrokken naar
  de taal. Screenshots en svg-exports uit de tool zelf als figuren.
- **Terugduwen van model naar tekst bestaat al** ("Lees terug uit Modelleren",
  `terugweg.js`) — in de demo live te tonen, geen plan-slide.
- **Prio van regels: bewust géén numerieke prioriteiten.** Vast combinatie-algoritme:
  default deny, toestemmingen stapelen als OF, een verbod wint altijd (ODRL
  `conflict: prohibit`). Volgorde in de tekst doet er niet toe.
- **Het demo-model en OAS → canoniek zijn aan een parallelle chat uitbesteed** via een
  opdrachtdocument, zodat deze chat op de taal en de demo kon focussen.
- **Een gemengde working tree gesplitst per onderwerp** in plaats van als één commit:
  de fix voor verdwenen compositielijnen op `feat/archimate-exchange`, het demo-model en
  OAS → canoniek op een nieuwe branch `feat/toegangsspraak-demo-model`. Beide met
  `--no-ff` naar main.
- **Release studio 0.8.0 / api 0.6.0** als baseline vóór het volgende werk
  (gebruikersbeheer-UI). Minor-bumps: nieuwe functionaliteit, en een modelwijziging die
  alleen tabellen tóévoegt.
- **Chat-export werkend gemaakt op macOS** zonder de Windows-kant te breken: een
  `osx`-variant in de (via Settings Sync gedeelde) VS Code-task, en het script herkent nu
  `ai-chats` naast het historische `copilot-chats`.

## Waarom deze keuze

- Het info-paper is voor collega's buiten de organisatie; de vraag "zit er een formele
  grammatica onder?" was dé twijfel, dus die kreeg een eigen hoofdstuk met de echte EBNF
  en de echte parserstructuur — alles geverifieerd tegen de code.
- Vaste conflictregels maken beleid leesbaar zonder verborgen ordening; gelaagd beleid
  (uitzondering op uitzondering) hoort bij het ODRL-v2-spoor.
- Splitsen per onderwerp houdt de geschiedenis leesbaar en maakt elke merge los
  testbaar; de compositie-fix is daarom ook afzonderlijk getest in een worktree.
- De modelwijziging is veilig uit te rollen: `dbsetup.CreateTables` maakt tabellen met
  `CREATE TABLE IF NOT EXISTS` over de hele MetaRegistry, dus puur aanvullend.

## Gewijzigde onderdelen

- Bestanden: `docs/toegangsspraak-infopaper.html/.pdf`, `docs/img/toegangsspraak/`,
  `docs/TOEGANGSSPRAAK.md`, `docs/plans/2026-09-15 FTV-demo Toegangsspraak — draaiboek.md`,
  `docs/plans/2026-09-10 Opdracht demo-model np-loc-org-geo en OAS-naar-canoniek.md`,
  `web/vite/package.json` + `package-lock.json` (0.8.0; de lock stond nog op 0.6.0),
  `web/vite/CHANGELOG.md`, `RELEASE.md`, `scripts/export-claude-chats.py` (nu op main,
  herkent `ai-chats`), `CLAUDE.md` (export-instructie en de waarschuwing dat de repo
  publiek is), handover in `docs/plans/2026-09-16 Handover naar desktop — stand, open punten en valkuilen.md`.
- API routes: geen.
- DB/SQL: geen migratie; bij uitrol zijn de tabellen van `org-geo` en de np-loc-uitbreiding
  automatisch aangemaakt en gecontroleerd.
- Frontend: geen codewijziging in deze chat zelf (de feature-code kwam uit de parallelle
  chats); wel versie en changelog.

## Open punten

- **Typebewaking mist ketens die op een anker eindigen** ("… van de betrokkene"): een
  typfout in een enum-waarde glipt daar door. Alleen ketens die op een type eindigen
  ("… van een natuurlijk persoon") worden gecontroleerd. Nog niet op de backlog.
- **Gebruikersbeheer-UI** heeft nog geen plan- of backlogdocument; AUTH_DEVELOPER_GUIDE §11
  zegt ten onrechte dat het al op de backlog staat.
- **`chore/be-code-review` is nooit gemerged** (backend-review en auth-hardening van
  7 juli) — relevant vóór het gebruikersbeheer.
- Backlog §28 (begeleiding) en §29.3/29.4/29.7/29.8/29.10/29.11.

## Volgende stap

Besluiten wat er met `chore/be-code-review` gebeurt (mergen, deels overnemen of sluiten) en
daarna een plan voor de gebruikersbeheer-UI schrijven. Zie de handover in `docs/plans/`.
