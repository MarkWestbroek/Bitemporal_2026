# Chat Samenvatting

> **Claude**-sessie (Claude Code) — de map heette historisch `copilot-chats`.

## Metadata

- Datum: 2026-07-25
- Titel: Controle op ongepushte branches, merge-volgorde en opruiming vóór een reis
- Bestandstamnaam: 2026-07-25-check-for-unmerged-local-branches-not-pushed-to-github
- Gerelateerde export: exports/2026-07-25-check-for-unmerged-local-branches-not-pushed-to-github.md
- Gerelateerde branch/commit: `main` — `0fe14e4b` (merge studio01-oas-31-30),
  `8fe64305` (chat-exports); PR #12 en #13 gemerged in dezelfde ronde

## Doel

Vóór enkele weken laptopwerk zeker weten dat er niets alleen lokaal stond, bepalen wat er
nog ongemerged was en in welke volgorde dat naar main moest, en de branchlijst opruimen.
Operationele sessie: geen ontwerpbesluiten, wel een paar werkafspraken die het bewaren waard
zijn.

## Beslissingen

- **Merge de afgeronde branch vóór de branch waaraan nog gewerkt wordt.** Beide raakten
  dezelfde twee bestanden; door de open PR (#12, 3 commits achter) eerst te mergen kwam de
  conflictlast niet op het áfgeronde werk te liggen terwijl de actieve branch doorgroeide.
- **`chore/be-code-review` blijft bewust ongemerged** — radicale backend-wijzigingen die de
  gebruiker eerst zelf wil testen. Verifieerd dat dit veilig kan: 44 gewijzigde bestanden,
  allemaal Go/docs, en van de 651 bestanden die main sindsdien wijzigde overlappen er maar
  twee (`CLAUDE.md`, `handlers/full_handlers.go`), die schoon automergen.
- **"Achter op main" is geen maat voor risico.** 175 commits achter zei niets; de echte maat
  is de *doorsnede* van wat beide kanten wijzigden.
- **Opruimen met `git branch -d`, nooit `-D`** — `-d` weigert bij ongemergd werk en is
  daarmee de veilige variant. 23 gemergede branches verwijderd (26 → 3).
- **Chat-exports horen op main**, na alle merges behalve de code review.

## Waarom deze keuze

De vraag "staat alles op GitHub?" is met `git status` niet te beantwoorden: branches zonder
upstream *lijken* ongepusht terwijl hun commits al via een PR in main zitten. De sluitende
controle is `git log --branches --not --remotes` — commits die op geen enkele remote
voorkomen. Voor de merge-volgorde is `git merge-tree --write-tree` gebruikt als **droge
proefmerge**: die geeft het echte antwoord zonder de werkkopie aan te raken, en toonde dat
alle volgordes schoon mergen — waarna de volgorde op inhoudelijke gronden gekozen kon worden
in plaats van op gevoel.

## Gewijzigde onderdelen

- Bestanden: `docs/ai-chats/exports/` — twee exports toegevoegd/aangevuld op main
- API routes: n.v.t.
- DB/SQL: n.v.t.
- Frontend: n.v.t. (repo-hygiëne)
- Branches: `feat/sequence-v1-hermetisch` (PR #12) en `feat/toegangsspraak` (PR #13)
  gemerged; `feat/studio01-oas-31-30` gemerged (één chat-archiefbestand); 23 gemergede
  lokale branches verwijderd. Resteert: `main`, `chore/be-code-review`,
  `docs/versionering-multicomponent`

## Open punten

- `chore/be-code-review` wacht op de test-ronde. **Let op bij het mergen**: die branch voegt
  chat-exports toe in `docs/copilot-chats/`, een map die main inmiddels `docs/ai-chats/`
  noemt. Git meldt dat als *file location*-waarschuwing (geen conflict); de bestanden na de
  merge even verplaatsen. Bij `feat/studio01-oas-31-30` loste git dit zelf op via
  hernoemdetectie — reken er dus niet op dat het altijd handwerk is, maar controleer het wel.
- De backup van chat-exports levert soms bestanden op die al via een merge op main staan;
  vergelijk op inhoud (`git hash-object` tegen `origin/main:<pad>`) voordat je commit, anders
  commit je een oudere versie over een nieuwere heen.

## Volgende stap

Onderweg `chore/be-code-review` testen en daarna mergen; de branchlijst blijft verder schoon.
