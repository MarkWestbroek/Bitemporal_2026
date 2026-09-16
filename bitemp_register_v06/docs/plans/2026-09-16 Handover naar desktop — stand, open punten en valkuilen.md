# Handover naar de desktop — stand, open punten en valkuilen (16 september 2026)

Overdracht van een lange Claude Code-sessie op de laptop (18 augustus – 16 september) naar
een nieuwe sessie op de desktop. Lees dit eerst; het vat samen wat anders pas na veel
zoeken — of helemaal niet — boven water komt.

- Volledige letterlijke export van de sessie:
  `docs/ai-chats/exports/2026-08-18-toegangsspraak-infopaper-ftv-demo-en-release-0-8-0.md`
- Samenvatting: `docs/ai-chats/summaries/` (zelfde stamnaam)

---

## Deel 1 — Waar het plan staat, hoe ver het is, wat nog openstaat

### Baseline

- **main = release studio 0.8.0 / api 0.6.0** (merge `b1fe996`, annotated tags
  `studio/v0.8.0` en `api/v0.6.0`), gepusht naar GitHub en uitgerold op de VPS op
  16 september. Gecontroleerd: `/version` meldt de juiste commit, de frontend-container
  draait precies de gepushte image, de nieuwe tabellen bestaan, alles is groen
  (515 frontend-tests, Go-build en modeltests).
- Docker Hub: `markwestbroek/bitemp-go-api:0.6.0` en `markwestbroek/bitemp-viz-frontend:0.8.0`,
  beide ook als `latest`. Rollback = het vorige nummer (`0.5.0` / `0.7.2`) in `.env` op de VPS.

### Waar de plannen en de stand staan

| Onderwerp | Document |
|---|---|
| Toegangsspraak, functioneel + technisch | `docs/TOEGANGSSPRAAK.md` |
| Taalontwerp en grammatica (EBNF) | `docs/plans/2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak (ontwerp).md` |
| ODRL-afbeelding en vooruitblik | `docs/plans/ODRL-Register-Toegangsbeleid.md`, `docs/plans/2026-08-18 ODRL 3.0 — W3C-workshop en gevolgen voor Toegangsspraak.md` |
| Extern info-paper | `docs/toegangsspraak-infopaper.pdf` (+ `.html`, figuren in `docs/img/toegangsspraak/`) |
| FTV-demo (15 sep, informeel gegeven) | `docs/plans/2026-09-15 FTV-demo Toegangsspraak — draaiboek.md` — geteste demoregels, een voorbeeldbeleid dat puur np-loc gebruikt, uitleg over de stapeling van regels |
| Demo-model np-loc-org+geo | `docs/demo-model-np-loc-org-geo.md` (opdracht: `docs/plans/2026-09-10 Opdracht …`) |
| OAS → canoniek model | `docs/STUDIO.md` → "OpenAPI → canoniek model" |
| Release en uitrol | `RELEASE.md`, `web/vite/CHANGELOG.md`, `docs/DOCKER_RELEASE.md`, `docs/VPS_DEPLOYMENT.md` §11 |
| Openstaand werk | `docs/BACKLOG.md` §27–§29 |

### Wat af is

- Info-paper met grammatica-uitleg, screenshots en diagram-exports.
- FTV-demo voorbereid en gegeven; de demoregels parseren en resolven zonder
  controle-meldingen tegen het demo-model.
- Demo-model (np-loc uitgebreid, nieuw domein `org-geo`), doorkijk over relaties in de
  modelboom (`relatieDiepte`), OAS → canoniek model, fix voor verdwenen compositielijnen.
- Release en uitrol (zie Baseline).
- Chat-export werkt weer op macOS; zie Deel 2 punt 8 voor Windows.

### Wat openstaat, in volgorde van belang

1. **Gebruikersbeheer-UI — het eerstvolgende werk.** Er is nog **geen** plan of
   backlog-item. `docs/AUTH_DEVELOPER_GUIDE.md` §11 beschrijft de huidige gang van zaken
   (admin-seed via `.env`, verdere accounts met SQL in de tabel `gebruiker`, rollen
   `admin`/`editor`/`viewer`) en beweert dat het al op de backlog staat — dat klopt niet.
   Eerste stap: plan schrijven en een backlogsectie aanmaken. Lees vóór het ontwerp
   Deel 2 punt 1.
2. **Typebewaking in Toegangsspraak mist anker-ketens.** Een enum- of typfout in een
   voorwaarde als `… van de betrokkene "Eigennaam" is` geeft géén controle-melding;
   dezelfde fout in `… van een natuurlijk persoon …` wel. Anker-ketens ("de betrokkene",
   "de aanvrager", "de aanvraag", "de gegevens") worden in `toegangsspraak/metamodel.js`
   niet tegen het model gecontroleerd. Nog niet op de backlog; kandidaat §29.12.
   Oplossingsrichting: het anker resolven via het type van het doelwit van de regel.
3. **Backlog §28** — begeleiding in de Studio (command palette, lege staten, hints,
   checklist publiceerpad, rondleiding).
4. **Backlog §29** — codegen-hygiëne (29.3 `_Input` zonder materiële plumbing, 29.4
   dubbele datatype-aliassen), OAS-vervolg (29.7, 29.8), composities (29.10 label-offsets,
   29.11 handles per diagram).
5. **Docker-tags opruimen** (DOCKER_RELEASE-checklist punt 8) — pas nodig bij ~10 tags.

---

## Deel 2 — Wat je niet vanzelf ontdekt

1. **`origin/chore/be-code-review` is nooit gemerged.** Die branch (7–8 juli) bevat een
   backend-codereview met hardening in 44 bestanden, waaronder *autorisatie daadwerkelijk
   afdwingen*, wachtwoord-hardening, een build-tag voor admin-devtools, geen lekkende
   DB-fouten meer, en concurrency-fixes in de engine. Het splitst af van main op
   4 juli, dus conflicten zijn waarschijnlijk. **Dit raakt het gebruikersbeheer direct**:
   besluit eerst of deze branch (deels) mee moet, anders bouw je het beheer op een
   auth-laag die elders al is verbeterd. Het exportscript en de CLAUDE.md-instructie van
   die branch staan inmiddels los op main.
2. **De GitHub-repo is publiek.** Alles wat je commit, inclusief chat-exports, staat open
   online. Noem geen gebruikersnamen of rollen van live accounts, hostnamen of andere
   aanvalsinformatie; de export van deze sessie is daarop geredigeerd (zie de
   redactiemarkeringen in het bestand). Dit staat nu ook in `CLAUDE.md`.
3. **Studio-URL ≠ hoofddomein.** De Studio draait op het subdomein `app.` van
   `omnium-ide.nl`; het hoofddomein zelf is een statische landingspagina (Caddy
   `root * /srv/omnium/www`) en geeft op app-paden een 404. Smoke-tests dus op het
   subdomein. `/version` antwoordt alleen op GET (HEAD geeft 404).
4. **Accounts op de live app:** alleen twee persoonlijke accounts. De proefaccounts uit
   `VPS_DEPLOYMENT.md` §7 zijn nooit aangemaakt, er valt niets uit te zetten.
5. **Toegang vanaf de desktop regelen vóór je uitrolt:** de SSH-sleutel die op de VPS
   werkt staat op de laptop (voeg de publieke sleutel van de desktop toe aan
   `~/.ssh/authorized_keys` van de stack-gebruiker), en `docker login` is per machine.
6. **Studio-sandbox persisteert.** Een al geladen canoniek model krijgt de
   compositie-connectoren pas na opnieuw inladen (*Bestand → Importeer V3 JSON…* of
   *Herlaad uit UML-model…*); de handle-fix werkt wel meteen.
7. **Taalvalkuilen bij het schrijven van beleid** (getest tegen de parser):
   - de handeling heet `bekijken`, niet "zien"; een verbod is `mag … niet` ("nooit" bestaat niet);
   - een subject met een kwalificatie ("een medewerker van afdeling West") moet een begrip
     worden: `Een medewerker West is: iemand met rol "medewerker" en afdeling "West".`;
   - rolnamen volgen het model letterlijk: bestaande np-loc-rollen zijn meervoud
     (`namen`, `partnernamen`, `naamgebruiken`, `bereikbaarheden`), de nieuwe demo-rollen
     enkelvoud (`geslacht`, `aanspraak`, `woonlocatie`);
   - "alleen … als" hoeft niet: default deny maakt elke toestemming al voorwaardelijk.
8. **Chat-export tussen machines.** De VS Code-tasks *Export Claude Chats (all/latest)*
   staan in de gebruikersinstellingen en worden via Settings Sync gedeeld. Windows
   gebruikt `python` met `D:/Git/_VScode-scripts/export-claude-chats.py`; macOS kreeg een
   `osx`-variant met `python3` en `~/Documents/GitHub/_VScode-scripts/`. **De Windows-kopie
   is nog de oude versie**: die kent `ai-chats` niet en schrijft daardoor naar het
   achtergebleven `doc/copilot-chats/` in de repo-root. Kopieer
   `bitemp_register_v06/scripts/export-claude-chats.py` over de Windows-kopie heen.
9. **Claude-geheugen en sessies zijn per machine.** De sessie en de geheugenbestanden van
   de laptop staan niet op de desktop. De feiten die ertoe doen staan in dit document.
   Staat de repo op de desktop op een ander pad (bv. `D:\Git\…`), dan past het gekopieerde
   sessiebestand niet op de projectmap; begin daar dus een verse sessie.
10. **Tooling-valkuilen in deze repo:**
    - commitberichten via een heredoc direct na `&& \` breken in zsh (de eerste regel wordt
      als commando uitgevoerd); gebruik `git commit -F <bestand>`;
    - de pre-commit hook exporteert bij elke commit de Copilot-chats — veel uitvoer, onschuldig;
    - `package-lock.json` liep achter op `package.json` (0.6.0 tegen 0.7.2); controleer
      beide bij een versiebump;
    - een `docker push` werd één keer door de permissiecontrole van Claude Code geweigerd;
      per tag als los commando ging het wel.
