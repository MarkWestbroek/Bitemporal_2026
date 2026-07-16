# CLAUDE.md — werkafspraken voor Claude in deze repo

Instructies voor Claude Code bij het werken in deze monorepo. Houd dit kort; de
inhoudelijke domein- en architectuurcontext staat in de bestaande instructiebestanden.

## Actieve versie & bestaande instructies

- De **actieve** versie is `bitemp_register_v06/`. Versies v01–v05 zijn archief (v05 = referentie).
- Lees voor domein/architectuur eerst:
  - `.github/copilot-instructions.md` (bitemporeel model, hub+_Data patroon, tijdreizen, …)
  - `.github/instructions/v06-active.instructions.md`
  - de meest specifieke `docs/*.md` van het onderdeel waaraan je werkt (bv. `bitemp_register_v06/docs/STUDIO.md`).

Deze CLAUDE.md vult die aan; het herhaalt ze niet.

## Documentatie bijwerken

Documenteer wijzigingen in heldere comments én in markdown. Heb je iets **substantieels**
gewijzigd of onderzocht, werk dan in dezelfde taak de **meest specifieke** `.md` bij
(bv. `docs/STUDIO.md`, `docs/DEVLOOP.md`, `docs/CODEGEN.md`, `docs/BACKLOG.md`), anders de
relevante `README.md`. Liefst Nederlands, in lijn met de bestaande docs.

## Belangrijke chats archiveren

Bewaar betekenisvolle AI-chats (Copilot én Claude) als markdown in
`bitemp_register_v06/docs/ai-chats/` (volg `doc/copilot-chats/` als het werk daar speelt):

- **Volledige transcript** → `exports/`, **korte samenvatting** → `summaries/`
  (template: `templates/chat-summary-template.md`).
- Naamconventie: `YYYY-MM-DD-onderwerp-korte-context`, kleine letters + koppeltekens,
  **dezelfde stamnaam** voor export en samenvatting. Datum eerst (natuurlijke sortering).
- Vermeld in de export dat het een **Claude**-sessie is (de map heette historisch `copilot-chats`, nu `ai-chats`).
- **Wel** bewaren: architectuur-/datamodel-/ontwerpkeuzes, belangrijke bugfix-redeneringen,
  branding-/productbeslissingen. **Niet** bewaren: korte Q&A zonder projectimpact, exploratie
  zonder uitkomst.
- Controleer vóór commit op secrets, persoonsgegevens en interne URL's.
- Doe dit wanneer de gebruiker erom vraagt of wanneer een chat tot concrete code-/ontwerp-
  beslissingen leidde. Zie `bitemp_register_v06/docs/copilot-chat-sync.md` voor de export-hook.

> **Let op — chat-backups zijn normaal.** De gebruiker back-upt chats af en toe met een script
> (soms ook via de GitHub-UI, commit-titel `Create <bestand>.md`). Zo verschijnt er een
> chat-export in `docs/ai-chats/exports/` — vaak de *huidige* chat, op de branch waarop je
> staat. Dat is legitiem en mag meecommitten; verbaas je er niet over en zie het niet aan voor
> een onverwachte/vreemde wijziging.

## Git

- Commit of push **alleen** als de gebruiker erom vraagt. Werk niet rechtstreeks op `main`
  voor substantieel werk; maak eerst een branch.

## Productbranding (Omnium Studio)

De geïntegreerde werkbank (`/studio`) heet **Omnium Studio**. Merk-assets en de losse
landing page staan in `bitemp_register_v06/web/omnium-studio/` (zie de `README.md` daar voor
kleuren, logovarianten en het regenereren van OG-images/iconen). Houd nieuwe branding
consistent met die assets en de gradient `#60a5fa → #6366f1 → #22d3ee`.
