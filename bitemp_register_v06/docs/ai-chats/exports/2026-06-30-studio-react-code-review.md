# Studio React-pagina's — code review

> **Assistent:** Claude (Claude Code, Opus 4.8) — dit is een **Claude**-sessie.
> **Datum:** 2026-06-30
> **Scope:** alleen onderzoek/review, geen codewijzigingen. Gericht op `bitemp_register_v06/web/vite/src/studio/`.

---

## Vraag (gebruiker)

> Zou je de studio react pagina's een code review willen doen? Verander niets, maar onderzoek alleen.
>
> Mijn voorkeur heeft het om OO te werken. Ik weet eigenlijk zelfs niet eens goed of js of ts is gebruikt. (Denk js)
>
> - Worden objecten gebruikt als dat opportuun is, of beter (m.i. bijna altijd) voor de onderhoudbaarheid?
> - Is er voldoende hergebruikt, geen dubbelingen?
> - Zijn er geen overbodige dependencies?
> - … wat je zelf nog aan kunt vullen. (Veiligheid enz.)
> - Toegankelijkheid is altijd lastig met een grafische UI. Ik heb al wel redelijk wat key combinaties ingebouwd, maar dat zal nog beter kunnen wellicht.

## Onderzochte bestanden

`src/studio/`: `StudioShell.jsx`, `useStudioStore.js`, `activityRegistry.js`, `buildMenus.js`,
`ActivityBar.jsx`, `MenuBar.jsx`, `SidePanel.jsx`, `menuBus.js`, `icons.jsx`, `studio.css`,
`activities/{index,PlaceholderActivity,umlActivity,dmnActivity,bpmnActivity,berichtActivity}.jsx`,
plus `pages/StudioPage.jsx`, `store/useUIStore.js` en `pages/IdePage.jsx` (toetsenbord-handler).

---

## Bevindingen (samengevat)

### Taal
Het is **JavaScript (JSX), geen TypeScript** — geen `tsconfig`, geen TS-deps, wel JSDoc-types.
Het activiteit-contract leeft alleen in commentaar; met TS (of `@ts-check` + typedef) zou dat
afdwingbaar zijn.

### "OO" / architectuur
Moderne React = function-componenten + hooks; class-OO is hier niet de norm. De onderhoudbaarheid
die de gebruiker met OO zoekt, is hier vervuld via het **activiteit-contract** (interface/polymorfisme):
elke activiteit implementeert dezelfde descriptor (`Sidebar/Main/Inspector/Provider/menus`) en de
shell kent alleen dat contract. Waar objecten passen, zijn ze goed gebruikt:
- `activityRegistry` = singleton-module met private `_activiteiten`/`_index`;
- `maakPlaceholderActiviteit` = factory;
- `menuBus` = event-bus voor ontkoppeling.

Dit is het sterkste deel van de code: data-gedreven menu's (override-by-id), uitbreidbaar register,
herbruikbaar `SidePanel`.

### Dubbelingen / hergebruik
- `downloadJson` / `downloadTekst` / `apiBase()` zijn gekopieerd over dmn/bpmn/bericht-activities
  (`apiBase()` zelfs ~12× projectbreed). → centrale util.
- Provider/Context-boilerplate 3× bijna identiek → helper of `useMenuBus`-hook.
- Twee tab-knoppen in `DmnMain` delen groot inline-style-object → `<TabButton>`.

### Inline styles & hardgecodeerde kleuren (thema-bug)
De shell gebruikt nette CSS-classes + `--s-*`-variabelen, maar de activiteit-internals gebruiken
overal inline styles met hardgecodeerde kleuren. Concreet: de JSON-`<pre>` in `DmnInspector`
(`#0f172a`/`#e2e8f0`) blijft donker in het lichte thema, terwijl bericht/bpmn `var(--s-panel-head)`
gebruiken. `#3b82f6` staat tientallen keren inline i.p.v. `var(--s-accent)`.

### Dode code / kleine punten
- `isOpen`/`isPinned` in de store worden nergens aangeroepen (StudioShell inlinet de lookup).
- Veel `console.log("[DMN] …")` debug-output in `handleDropFieldRef`.
- `ThemaKnop` abonneert dubbel op `theme`; `handleViewChange(view)` negeert zijn param.

### Dependencies
Binnen de studio-map geen overbodige imports (alleen react + zustand; zware libs via onderliggende
modules, deels `lazy`). `DmnModeler` wordt echter niet lazy geladen → dmn-js zit altijd in de
studio-bundle. Projectbrede dode deps: niet vanuit studio te bepalen → `npx depcheck` aanraden.

### Veiligheid
Niets alarmerends: geen `dangerouslySetInnerHTML`/`eval`, `window.open` met `noopener`, localStorage
in try/catch, lokale Blob-downloads. Kleine punten: `window.alert` voor "Over", broze
`port === "5174"`-detectie hardgecodeerd op meerdere plekken.

### Toegankelijkheid (aandachtspunt gebruiker)
Goede basis (`aria-pressed`, `role="menu/menuitem"`, Escape sluit, `role="separator"`), maar gaten:
1. **Flyout-submenu's zijn muis-only** (`onMouseEnter`); toetsenbordgebruiker kan "Maak…",
   "Uitlijnen…" niet bereiken — grootste defect.
2. Geen pijltjestoets-navigatie / `role="menubar"` / `aria-haspopup` op top-level titels.
3. Menu-sneltoetsen (Ctrl+O/S/Z) zijn **alleen labels** in de studio-shell; de echte handler zit in
   `IdePage` (regels 683-725), dus werkt niet voor DMN/BPMN/Bericht.
4. Splitter/panelen muis-only (geen toetsenbord-resize, geen `aria-valuenow`, geen Pointer Events;
   auto-hide opent alleen op hover, niet op focus).
5. Glyph-knoppen (`▕▏`, `☾`) hebben `title` maar geen `aria-label`.

## Prioriteiten
1. Toetsenbord-bereikbaarheid van de menu's (a11y 1-3).
2. Hardgecodeerde kleuren → `--s-*` (te beginnen bij de donkere `<pre>`).
3. Duplicatie weghalen: `downloadJson/downloadTekst/apiBase` → util.
4. Opruimen: dode `isOpen`/`isPinned`, debug-logs.

---

## Vervolgvraag (gebruiker)

> Ik wil wel iets van de refactoring oppakken, maar voorzichtig. Eerst deze chat wegschrijven, dan
> van de code-review een rapport maken. Daarna: hoe pakken we zo'n refactor veilig op? In een aparte
> branch, zodat terugzetten makkelijker is dan graven in commits?

## Uitkomst

- Volledig rapport vastgelegd in `docs/STUDIO-code-review-2026-06-30.md` (gekoppeld vanuit `STUDIO.md`).
- Deze export + samenvatting weggeschreven.
- Refactor-aanpak: aparte feature-branch, kleine commits per onderwerp, beginnen met de laagste-risico
  / hoogste-winst opschoning (gedeelde download/api-util + thema-kleurfix), daarna eventueel a11y.
