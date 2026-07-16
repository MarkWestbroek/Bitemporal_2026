# Changelog — Frontend / Omnium Studio

Alle noemenswaardige wijzigingen aan de web-frontend (`web/vite/`: Studio-werkbank,
inhoud-editor, publicatie, IDE). Formaat: [Keep a Changelog](https://keepachangelog.com);
versionering volgens [`docs/VERSIONERING.md`](../docs/VERSIONERING.md) (prefix `studio/`).

De single source of truth voor het nummer is `package.json` `"version"`.

## [Unreleased]
- Visuele FormulierDefinitie-editor is gebouwd op branch `feat/formulier-editor-studio`
  en wordt bij merge `studio/v0.4.0` (zie hieronder).

## [studio/v0.4.0] — 2026-07-16  _(bij merge van `feat/formulier-editor-studio`)_
### Toegevoegd
- **Visuele FormulierDefinitie-editor** als nieuwe Studio-activiteit "Formulieren"
  (balkgroep *Presentatie*): palette (ModelPicker) → veld met padadressering `ENT.GE.veld`
  → structuur-boom → inspector → live preview via `CustomFormulierRenderer`.
- **Opslaan naar register**: definitie als nieuwe `FormulierDefinitie` (max-id + opvoer).
- **Meervoudigheid** via het `lijst`-element: auto-wrap van meervoudige velden, herhaalbare
  sectie met item toevoegen/verwijderen; per-item opvoer/afvoer bij opslaan.
- Renderer-uitbreidingen (backwards compatible): label-/beschrijving-override, object-condities,
  padgebaseerde veldadressering naast korte namen.
### Gewijzigd
- `EntiteitFormulier`: mapping/save geëxtraheerd naar pure, geteste `customFormMapping.js`.

## [studio/v0.3.0] — 2026-07-14
### Toegevoegd
- Grafische kruisverband-view (fase 4) en kruisverbanden-matrix.
- Transformatie-generatoren (bv. "Map → Markdown-overzicht") op de map.
- State-machine-profiel v0 (gedragsdiagram).
- Diagram/selectie exporteren als afbeelding (PNG/SVG + klembord) + export-voorkeuren.

## [studio/v0.2.1] — 2026-07-13
### Toegevoegd
- Koppelingen v0 (kruisverbanden-matrix) + transformeren-raamwerk (import/export/transform).
- Studio-versie zichtbaar in de UI; versionering-conventie vastgelegd.
### Gefixt
- Prism-syntaxkleuring in de productiebundel.

## [studio/v0.2.0] — 2026-07-12
### Toegevoegd
- Consolidatie fase 0–2: Modelleren-tab-host (klassieke editors als profieltype),
  projectboom met mappen/hiërarchie/contextmenu's, project-werkbestand.
- Structuur-undo (Ctrl+Z) + multiselect in de elementen-onderboom.
- Shape-/icoon-editor in de Studio-instellingen.

## [studio/v0.1.0] — 2026-06-17
### Toegevoegd
- Raamwerk van de geïntegreerde werkbank (VS Code-schil): activity-registry, auto-hide
  panelen, menubalk; eerste activiteiten (UML/canoniek model, DMN, BPMN, berichten).

---

Vóór `studio/v0.1.0`: de frontend deelde commits met de backend; niet per component te
reconstrueren (zie `git log`).
