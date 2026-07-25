# Overdracht Toegangsspraak — verder werken op de laptop

**Datum:** 2026-07-24 · **Branch:** `feat/toegangsspraak` (±30 commits bovenop main)
**Stand:** alles groen — 383 unit tests, build in orde, rooktests gedaan.

---

## 1. Wat er staat (22–24 juli in één alinea)

Toegangsspraak: een Nederlandstalige, gecontroleerde beleidstaal voor
toegangsregels, met een Studio-editor (live parsen, zinsontleding,
tweezijdige autocomplete, metamodel-typebewaking, keten-verkorting,
existentie-voorwaarden), drie projecties van dezelfde AST (klare taal ·
ODRL/NLGov · diagram), het toegangsregel-profiel op de diagram-motor
(vormentaal, projectboom, publiceren met layout-behoud, verliesvrije
terugweg diagram→tekst), kruisverbanden naar het canoniek model en de
ArchiMate-koppeling (wet → Constraint, doel → Goal, begrippen → Business
object/rol). Zie `docs/toegangsspraak-teaser.md` voor het verhaal met
plaatjes.

## 2. Mergen naar main?

**Kan.** Proef-merge (`git merge-tree main feat/toegangsspraak`) is op
2026-07-24 **zonder conflicten** — ook al is main intussen doorbewogen
(sequence-v1, diagramcore-fixes). Het werk is een afgerond, gedocumenteerd
geheel; de open punten (§5) zijn vervolgwerk, geen half werk. Advies:

1. `git push -u origin feat/toegangsspraak` (sowieso — dit is óók de
   laptop-overdracht én een backup);
2. PR naar main zoals gebruikelijk in deze repo, merge wanneer het jou
   uitkomt. Niets hoeft eerst "af".

## 3. Op de laptop beginnen

```bash
git fetch && git checkout feat/toegangsspraak   # of main, na de merge
cd bitemp_register_v06/web/vite
npm install
npm run dev        # → http://localhost:5173/viz/react/studio
```

- Studio → activiteit **Toegangverlening** (in de balk, preview-badge).
- Tests: `npm test` (op Windows-bash zonodig:
  `shopt -s globstar && node --import ./test/register-aliases.mjs --test src/**/*.test.js`).
- Zonder draaiende Go-backend werkt alles behalve de schema-API-functies
  (modelboom, typebewaking, metamodel-autocomplete).

## 4. ⚠ Wat NIET meereist via git: de browser-state

De Studio bewaart zijn werk in **localStorage van de browser** — dus
machine-gebonden: het gepubliceerde toegangsregels-model (incl. je
zorgvuldige layout!), kruisverbanden, ArchiMate-elementen, shell-stand.

- **Overdraagbaar via de exports** die al gecommit staan:
  `docs/exports/Studio exports/` (o.a. `2026-07-23 alles studio.json` en
  `profielen/`). Op de laptop importeren via het Bestand-menu van de
  Studio (project-werkbestand).
- De **beleidstekst zelf** is altijd reproduceerbaar: tekst in de
  Toegangverlening-editor plakken → *Publiceer naar Modelleren* bouwt het
  diagram-model opnieuw op (stabiele ids; layout begint dan wel op de
  standaard-startstand).

## 5. Openstaand (volgorde van oppakken)

| Wat | Waar beschreven |
|---|---|
| Plicht-subgrammatica implementeren ná werkgroep-besluit | taalontwerp §12.2 |
| Drop uit projectboom/ModelPicker op gegevensselectie (canvas-drop raakt `DiagramCanvas`; veld-niveau vergt attributen in de boom) | profiel-plan, "Vervolg: droppen…" |
| Autocomplete-doorsnede (domein-filter / universele projectboom) | taalontwerp §12 |
| Lidwoord + telbaarheid als metamodel-metadata | taalontwerp §12 punt 5 |
| Whitepaper fase 2/3: bitemporele opslag policies, vertalers ODRL→Rego/Cedar, NLGov-profiel formaliseren, AuthZEN | ODRL-plan §7 / whitepaper §9 |
| Vragen aan de werkgroep (naam, plichten, BO/GEMMA, kleurenblind-toets) | `docs/toegangsspraak-teaser.md` |

## 6. Kaart

| Wat | Waar |
|---|---|
| Functioneel + technisch overzicht | `docs/TOEGANGSSPRAAK.md` |
| Taal: grammatica, besluiten, status | `docs/plans/2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak (ontwerp).md` |
| Profiel: ontwerp + stappen 1–5 | `docs/plans/2026-07-23 Toegangsregel-profiel (ontwerp).md` |
| Vormentaal: brief / antwoord / handreiking | `docs/plans/2026-07-23 … designbrief…`, `2026-07-24 … (ontwerp-antwoord)`, `2026-07-23 … handreiking…` |
| Teaser werkgroep (met screenshots) | `docs/toegangsspraak-teaser.md` |
| Taalkern (parser/renderer/ODRL/metamodel/AC) | `web/vite/src/toegangsspraak/` |
| Profiel + adapter + terugweg + koppelingen | `web/vite/src/diagramprofielen/toegangsregel/` |
| Editor-activiteit + diagramweergave + motor-activiteit | `web/vite/src/studio/activities/toegang*.jsx`, `ToegangDiagram.jsx` |

## 7. Praktische afspraken

- Twee worktrees op deze machine: `Bitemporal_2026` (hoofd) en
  `Bitemporal_2026_gedrag` (waar `feat/toegangsspraak` uitgecheckt stond,
  o.a. voor de design-sessie). Niet tegelijk in dezelfde bestanden werken.
- Commit-stijl: `feat|fix|docs|chore(scope): …` in het Nederlands, met de
  Co-Authored-By-regel voor Claude-werk; committen op de branch, pushen in
  overleg.
- De Playwright-rooktests draaien op poort **5175** (eigen poort, na
  afloop alleen het eigen proces stoppen).
