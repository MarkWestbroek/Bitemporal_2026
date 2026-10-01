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

**Databasestructuur:** staat in `.github/copilot-instructions.md` (§Domein, §Hub + _Data) en
`bitemp_register_v06/ONTWERP_DATA_PATTERN.md`. Formele tijd leeft alleen in `wijziging` +
`registratie`, en elke insert (hub, _Data, _Aanvang, _Einde) heeft één eigen wijziging.
**Hard verwijderen** (alleen lokaal, nooit via een replay) betekent dus: de records, hun
`wijziging`-rijen en de registraties die dan leeg raken. Controleer eerst op registraties die
ook iets anders raken, en op verwijzingen (`notificatie_bezorging.registratie_id`,
`registratie.corrigeert_/maakt_ongedaan_registratie_id`). Lever SQL aan de gebruiker in één
transactie met controles vooraf en achteraf.

## Metaniveaus (M0–M3) — de basis van het project

Omnium is **modelgedreven op vier niveaus**; gebruik deze termen consequent (tabel in
`bitemp_register_v06/docs/OMNIUM_WALKTHROUGH.md` §1):

| Niveau | Hier | Waar het leeft |
|---|---|---|
| **M3** (metametamodel) | de regels waarmee modeltalen/profielen beschreven worden: `ElementType`, `ConnectorType`, `FieldType`, `CompartmentType`, verbindingsregels, resolvers, hooks | `web/vite/src/diagramcore/types/schema.js` (typecontract) en de profiel-ontwerper in Studio; eigen implementatie, niet bewezen MOF-conform |
| **M2** (profiel / modeltaal) | een descriptor op de motor: canoniek-uml, puur-uml, MIM, OAS 3.1, ArchiMate, DMN, BPMN, toegangsregel, … (zestien+) | `web/vite/src/diagramprofielen/<profiel>/index.js` (+ adapter) |
| **M1** (model) | een concreet model in zo'n taal: np-loc, het register-configuratiedomein, een OAS-document, een toegangsbeleid | V3 JSON (canoniek), SDL/YAML/… (andere profielen), de projectboom |
| **M0** (data) | geregistreerde instanties in een register dat een M1-model uitvoert | database (hub + `_Data`), API, GraphQL |

Vuistregels: een nieuwe notatie is een **M2-descriptor plus adapter, geen motorwerk** (zie
`docs/plans/2026-07-29 Overdracht Notaties`); transformaties tussen profielen (OAS → canoniek,
canoniek → GraphQL) zijn M2→M2-afbeeldingen met **kruisverbanden** in de koppelingen-matrix; de
MetaRegistry en codegen zijn de runtime-projectie van het canonieke M1-model naar M0. Laat de
niveaus niet door elkaar lopen in docs en code (een "profiel" is hier breder dan een UML Profile).

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
- **Claude-sessies** exporteer je letterlijk met `bitemp_register_v06/scripts/export-claude-chats.py`
  (leest `~/.claude/projects/<project>/*.jsonl`, vindt de projectmap zelf via git, schrijft naar
  `docs/ai-chats/exports/`). Bv. `python3 bitemp_register_v06/scripts/export-claude-chats.py
  --session <id> --title <onderwerp>`; `--all` slaat al geëxporteerde sessies over (`--force`
  overschrijft). Op Windows draait dezelfde versie als gedeelde kopie in `D:\Git\_VScode-scripts`,
  op macOS in `~/Documents/GitHub/_VScode-scripts` (VS Code-tasks *Export Claude Chats*).
- **De GitHub-repo is publiek.** Een letterlijke export komt dus openbaar online: redigeer vóór
  commit gebruikersnamen/rollen van live accounts, hostnamen en andere aanvalsinformatie, en
  meld wat je hebt geredigeerd.

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
