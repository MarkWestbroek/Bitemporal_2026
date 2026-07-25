# Overdracht Formulieren — verder werken op de laptop

**Datum:** 2026-07-25 · **Branch:** alles zit in `main` (gepusht) · **Werk gedaan:** 16–17 juli
**Stand:** groen — 37 unit-tests op de formulier-onderdelen, builds in orde, rooktests gedaan.
**Backlog:** F41 · F43 · F45 · F46 · F47 · F48 (+ F42 nog open)

---

## 1. Wat er staat (in één alinea)

Een **visuele FormulierDefinitie-editor** als Studio-activiteit **"Formulieren"** (groep
*presentatie*): links een index van bestaande definities én de veld-palette, midden de
structuurboom met live preview, rechts de inspector. Velden worden **padgebaseerd**
geadresseerd (`ENT.GE.veld` — hetzelfde model-adres als CEL/berichten/DMN), inclusief
**meervoudigheid** (`lijst`-element voor meervoudige GE's, met per-item opvoer/afvoer).
Definities worden **naar het register geschreven** (bitemporeel) en bestaande definities
worden **bijgewerkt** in plaats van gekopieerd. De runtime (inhoud-editor) kent nu zowel
korte namen (legacy) als volle paden, plus read-only velden (id, afgeleide/weergavevelden).
En als dogfood: de layout is óók een **diagramprofiel** — een formulier is te bekijken en te
bewerken op de diagram-motor, met een **verliesvrije round-trip** terug naar de editor.

## 2. Waar het leeft

**Code (frontend, `bitemp_register_v06/web/vite/src/`):**

| Pad | Wat |
|---|---|
| `formuliereditor/` | de editor: `layoutModel.js` (boom-ops, puur+getest), `useFormulierEditorStore.js` (zustand), `FormulierCanvas.jsx` (structuur + preview), `FormulierInspector.jsx`, `FormulierIndex.jsx` (index/boom), `saveFormulierDefinitie.js` (register-schrijfpad), `schemaResolve.js` (laden: pad → velddef), `preview.js` |
| `studio/activities/formulierActivity.jsx` | de Studio-activiteit (sidebar met tabs *Formulieren* / *Velden*) |
| `diagramprofielen/formulier/` | het profiel (`index.js`) + `adapter.js` (layout ↔ coreModel, beide richtingen) |
| `studio/activities/formulierDiagramActivity.jsx` | activiteit **"Formulier (diagram)"** (groep *modelleren*, standaard verborgen → via *Ga naar*) |
| `components/editor/customFormMapping.js` | **runtime**: mapping GE-data ↔ formuliervelden + cross-GE save (puur, 12 tests) |
| `components/editor/CustomFormulierRenderer.jsx` | de runtime-renderer (gedeeld door editor-preview én inhoud-editor) |
| `modelpicker/modelTree.js` | veld-palette; `momentvoorkomen` op de FieldRef + filter technische velden |

**Docs:**
- `docs/plans/2026-07-16 Formulier-editor Studio-activiteit (plan).md` — het hoofdplan (vocabulaire, fasering, alle ontwerpkeuzes)
- `docs/plans/2026-07-16 Formulier-profiel op de diagram-motor (dogfood-plan).md` — F48 (profiel, P1/P2 gebouwd, P3 open)
- `docs/BACKLOG.md` — regels **F41–F48**
- `docs/versiebeheer.md` — versionering-conventie (component-tags `studio/vX.Y.Z`)

## 3. Op de laptop beginnen

```bash
git fetch && git checkout main
cd bitemp_register_v06/web/vite
npm install
npm run dev        # → http://localhost:5173/viz/react/studio.html
```

- Studio → activiteit **Formulieren** (balkgroep *Presentatie*, preview-badge).
- Diagram-variant: menu **Ga naar → Formulier (diagram)**.
- Tests: `node --import ./test/register-aliases.mjs --test src/formuliereditor/*.test.js src/diagramprofielen/formulier/*.test.js src/components/editor/customFormMapping.test.js`
  (het `npm test`-glob werkt op Windows-bash niet; geef paden expliciet mee).
- **Go-backend nodig** (`:8082`) voor: index laden, opslaan, en de veld-palette. Zonder
  backend start de editor wel, maar blijft de lijst leeg.

## 4. ⚠ Wat NIET meereist via git

1. **De database.** Anders dan de andere Studio-profielen leven FormulierDefinities **in
   Postgres**, niet in een werkbestand. Op de laptop is je definitie-lijst dus leeg tot je:
   - de replay-file draait: `replay files/registraties-replay-init-formulierdefinitie-initiatief-voorbeeld.json`
     (dat is het oorspronkelijke "Initiatief voorbeeldformulier", nog in **korte-naam**-vorm), of
   - gewoon een nieuwe definitie maakt met **＋ Nieuw formulier** (aanbevolen — dan krijg je
     meteen de padadressering).
2. **localStorage.** Het formulier-**diagram** (`studio05-formulierdiagram`) en de shell-stand
   zijn machine-gebonden. Het diagram is altijd te reconstrueren: laad een definitie in
   *Formulieren* → *Formulier (diagram)* → **Herlaad uit formulier-editor**.
3. **De editor-state zelf is niet persistent.** `useFormulierEditorStore` heeft bewust géén
   `persist`: na een refresh ben je niet-opgeslagen werk kwijt. (Kandidaat-verbetering, zie §5.)

## 5. Wat er nog te doen is

**Kort en waardevol (mijn volgorde-advies):**

1. **dnd-kit** — slepen i.p.v. de ↑/↓-knoppen, en vooral: **elementen van niveau kunnen
   veranderen** (uit een conditioneel blok naar de root, in een groep). Dit is de enige echt
   gemiste UX in de editor; nu kun je alleen binnen dezelfde ouder schuiven.
2. **Gefilterde projectboom** (F44 / F48 §5b) — een boom-optie die filtert op soort (alleen
   formulieren, of formulieren + entiteiten). Vervangt op termijn `FormulierIndex` en levert
   **vrije mappen** gratis (bestaat al in Modelleren). Let op het persistentie-verschil per
   documentsoort (formdefs = DB/bitemporeel; canoniek model = metamodel + gegenereerde
   tabellen; overige profielen = werkbestand).
3. **F47 kolommen** — landingsplek staat al klaar: het profiel-element `rij` heeft een
   `richting`-property; in de layout hetzelfde patroon.
4. **Editor-state persistent maken** (zie §4.3) — kleine ingreep, voorkomt werkverlies.

**Groter / inhoudelijk:**

5. **P2 van het formulier-plan**: `virtueelVeld` (check-vragen die niet uit het model komen),
   `regel`/effect (toon/verberg), en `zetWaarde` (antwoord vult — eventueel verborgen — een
   echt DB-veld). Dit was je oorspronkelijke wens; vocabulaire is al ontworpen in het plan §4b.
6. **F42 invul-wizard** — stap-modus over dezelfde definitie (P3 van het plan).
7. **F48 P3** — één documentmodel: editor en diagram als twee controls op hetzelfde document
   (nu koppelen ze via expliciete import/terugschrijven). Plus **kruisverband-traces**: het
   `veldpad` op de diagram-elementen is dé haak voor de matrix ("welke formulieren raken
   `Initiatief.producten.naam`?").

**Kleiner, blijft liggen:**
- Doeltype-gebonden palette-filter (nu toont de palette het hele model).
- Rechtsklik-menu (hernoemen/verwijderen) in de index — hernoemen kán al via laden + naam
  wijzigen + opslaan.
- Read-only weergave van afgeleide velden bij een **lijst**-item (werkt nu op entiteitniveau).

## 6. Valkuilen & geleerde lessen (lees dit vóór je debugt)

- **Afgevoerde definitie ≠ afgevoerde meta.** Een afgevoerde `FormulierDefinitie` houdt zijn
  meta-record met `status=actief, is_standaard=true`. Filter dus **altijd** op
  `!full.afvoer` (gebeurt nu in `FormulierIndex`, `useFormulierDefinitie` en de
  degradeer-logica). Dit was de oorzaak van "actief/standaard werkt niet".
- **`baseUrl` mag `""` zijn** (same-origin in Studio) — nooit op falsy guarden (`if (!baseUrl)`
  is fout, `if (baseUrl == null)` is goed). Kostte een debug-ronde.
- **Update-in-place**: opvoer met `{ formulierdefinitie_id, rel_id, … }` versioneert het
  bestaande record (de GE-`idKolom` ís `rel_id`). Het register laat daarbij soms een **leeg
  extra hub-record** achter — onschadelijk: er blijft precies één *actueel* record.
- **Legacy-definitie #1** (korte namen, uit de replay-file) laadt in de editor met "Onbekend
  veld": er is **bewust geen legacy-resolver** (jouw keuze — één triviaal formulier).
- **Playwright + de Studio-pagina**: de zware pagina in combinatie met een route-proxy hangt
  lokaal regelmatig. Dat is een **harnas-probleem, geen productbug**. De inhoud-editor
  (`inhoud.html`) automatiseert wél betrouwbaar. Bij twijfel: unit-test de logica en verifieer
  de UI met één screenshot.
- **Testtroep opruimen.** Testdefinities landen in de échte DB. Gebruik een `ZZZ`-prefix en voer
  ze daarna af — anders "winnen" ze als standaard voor een doeltype (is mij één keer gebeurd).

## 7. Verificatie-status

| Onderdeel | Dekking |
|---|---|
| `layoutModel` (boom-ops, lijst, serialisatie) | 9 unit-tests |
| `schemaResolve` (laden: pad → velddef) | 5 unit-tests |
| `customFormMapping` (runtime mapping + cross-GE save + lijst-save + read-only) | 12 unit-tests |
| `modelTree` (technische velden-filter) | 3 unit-tests |
| `diagramprofielen/formulier/adapter` (heen, terug, round-trip) | 8 unit-tests |
| **Totaal** | **37/37 groen** |
| Tegen de echte backend geverifieerd | opslaan (create), update-in-place, degradeer-standaard, afvoeren |
| In de app geverifieerd (Playwright + screenshots) | activiteit, palette→veld, preview, lijst, save-validatie, diagram-activiteit, menu-items, regressie inhoud-editor (#38) |

**Niet end-to-end geautomatiseerd** (bewust, zie §6): de volledige klik-flow *diagram → zet
terug → preview → opslaan*. De adapter-kern is wel round-trip-getest. Dat is het eerste wat
je op de laptop met de hand zou moeten narijden.
