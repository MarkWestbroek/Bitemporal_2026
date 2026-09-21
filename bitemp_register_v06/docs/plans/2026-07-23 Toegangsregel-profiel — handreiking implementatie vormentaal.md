# Handreiking voor de design-sessie: vormentaal implementeren

**Voor:** de sessie die het ontwerpantwoord op de designbrief implementeert
**Branch:** `feat/toegangsspraak` (niet naar main; commit-stijl: zie `git log`)
**Brief:** `2026-07-23 Toegangsregel-profiel — designbrief vormentaal.md`

## Waar te bouwen

| Wat | Waar |
|---|---|
| Custom vormen (SVG) + 16px boom-iconen | nieuw: `web/vite/src/diagramprofielen/toegangsregel/shapes.jsx` — volg de conventie van `diagramprofielen/archimate/shapes.jsx` + `iconen.jsx` (eigen vormenset per profiel; registratie zie `studio/activities/vormenRegistratie.js` / `iconenRegistratie.js`) |
| Vorm/kleur per elementtype koppelen | `diagramprofielen/toegangsregel/index.js` — `elementTypes[].shape` (nu `rect`/`note`) en `kleur`; **`KLEUREN` is de ene kleurenbron** (gedeeld met de tekst-ontleding) — bij paletwijzigingen ook `studio/activities/toegangActivity.css` (`.ts-sem-*`) meetrekken |
| Lijnstijlen/markers | `elementTypes` (connectoren) in dezelfde `index.js`; geldige `lijn`: `solid`/`dash-6-3`/`dash-4-3`/`dash-4-4` (`diagramcore/canvas/ConnectorEdge.jsx`); markers: `driehoek`/`pijl-open`/`pijl-dicht`/`bol`/`ruit`/`ruit-open` |
| Regelkaarten-weergave (Tekst-zijde) | `studio/activities/ToegangDiagram.jsx` — als vormen/iconen daar ook moeten landen |

## Niet aanraken (afspraken die elders op steunen)

- **`adapter.js`**: de inhouds-stabiele ids (`trg:…`) en `mergeCoreModel` —
  layoutbehoud bij herpubliceren hangt hieraan; vormgeving hoort er niet in.
- De **element-/connector-ids en semantiek** in `index.js` (alleen
  `shape`/`kleur`/`edgePresentatie`/iconen wijzigen, geen ids of
  bron/doel-regels).
- `toegangsspraak/` (de taalkern) staat los van dit werk.

## Verifiëren

```bash
cd bitemp_register_v06/web/vite
npm test                     # let op: op Windows-bash: shopt -s globstar && node --import ./test/register-aliases.mjs --test src/**/*.test.js
npm run build
```
Relevante tests: `src/diagramprofielen/toegangsregel/adapter.test.js` (o.a.
typecontract-registratie — nieuwe shapes moeten door `registreerDiagramType`
heen valideren). Visueel: `npm run dev` → `/viz/react/studio` → activiteit
*Toegangverlening* (menu Beleid → *Publiceer naar Modelleren*) → via *Ga naar*
naar *Toegangsregels* → diagram openen.

## Na afloop

- Ontwerpantwoord archiveren naast de brief (zelfde map, zelfde datumstijl).
- Keuzes kort bijschrijven in `2026-07-23 Toegangsregel-profiel (ontwerp).md`
  (§2-tabel: kolom "Vorm" actualiseren; §7 kleurenblind-besluit).
- Niet pushen; committen op de branch mag (Co-Authored-By-regel zoals in de
  bestaande commits).
