# Code review — Studio React-werkbank

- **Datum:** 2026-06-30
- **Reviewer:** Claude (Claude Code, Opus 4.8)
- **Scope:** `bitemp_register_v06/web/vite/src/studio/**` (shell, register, menu's, panelen,
  activiteiten) plus de raakvlakken `pages/StudioPage.jsx`, `store/useUIStore.js` en de
  toetsenbord-handler in `pages/IdePage.jsx`.
- **Karakter:** alleen-lezen review. Er is **geen** code gewijzigd.

## Samenvatting

De Studio-werkbank is **architectonisch sterk**: een uitbreidbaar activiteit-register met een helder
contract (`Sidebar/Main/Inspector/Provider/menus`), data-gedreven menu's met override-by-id, en een
event-bus die de shell van de activiteiten ontkoppelt. De grootste verbeterkansen zitten niet in de
opzet maar in **opschoning** (gedupliceerde helpers, dode code, debug-logs), **consistentie**
(inline styles + hardgecodeerde kleuren i.p.v. de bestaande thema-variabelen) en **toegankelijkheid**
(de menubalk is grotendeels muis-gestuurd).

Prioriteit | Onderwerp | Impact
---|---|---
1 | Toetsenbord-bereikbaarheid menubalk | Functioneel defect voor toetsenbordgebruikers
2 | Hardgecodeerde kleuren → `--s-*` | Thema-bug (lichte modus) + onderhoud
3 | Gedupliceerde helpers → util | Onderhoud / DRY
4 | Dode code & debug-logs opruimen | Hygiëne

---

## 1. Taal — JavaScript, geen TypeScript

Bevestigd JS/JSX: geen `tsconfig`, geen TS-dependencies, wel JSDoc met `@param`-types. Het
activiteit-contract staat nu alleen in commentaar (`activityRegistry.js`). Overweging: minimaal de
registry-bestanden naar `.ts`, of `// @ts-check` + een JSDoc-`@typedef` voor de descriptor, zodat het
contract afdwingbaar wordt. Niet urgent, wel waardevol voor de onderhoudbaarheid die gewenst is.

## 2. "OO" en onderhoudbaarheid

In moderne React zijn class-componenten verdwenen; function-componenten + hooks zijn de norm. De
onderhoudbaarheid die met OO wordt nagestreefd, is hier gerealiseerd via **interface/polymorfisme op
het activiteit-contract**: elke activiteit implementeert dezelfde descriptor en de shell kent alleen
dat contract, niet de interne werking. Waar "echte" objecten passen, zijn ze correct ingezet:

- **Singleton-module met encapsulatie** — `activityRegistry` met private `_activiteiten`/`_index`.
- **Factory** — `maakPlaceholderActiviteit(...)`.
- **Event-bus object** — `menuBus` (on/emit met unsubscribe).

Dit is het sterkste deel van de codebase en verdient behoud.

## 3. Dubbelingen / hergebruik

1. **Gekopieerde helpers.** `downloadJson` (dmn + bericht, identiek), `downloadTekst` (dmn + bpmn) en
   `apiBase()` (dmn + bpmn + bericht) staan meermaals. `apiBase()` is zelfs ~12× projectbreed.
   → Centrale `studio/studioUtils.js` (en op termijn een project-brede `apiBase`).
2. **Provider/Context-boilerplate** is 3× bijna identiek (createContext → Provider met menuBus-
   `useEffect` → useContext). → Helper `maakActiviteitContext()` of `useMenuBus(handlers, deps)`.
3. **Tab-knoppen in `DmnMain`** delen een groot inline-style-object dat alleen op `activeTab`
   verschilt. → `<TabButton active=… onClick=…>`.

## 4. Inline styles & hardgecodeerde kleuren (thema-bug)

De shell gebruikt nette CSS-classes en `--s-*`-variabelen; de activiteit-internals gebruiken overal
inline `style={{…}}` met hardgecodeerde kleuren. Gevolgen:

- **Thema-bug:** de JSON-`<pre>` in `DmnInspector` is hardgecodeerd donker (`#0f172a`/`#e2e8f0`) en
  blijft donker in het lichte thema; bericht/bpmn gebruiken op dezelfde plek `var(--s-panel-head)`.
- `#3b82f6` (accent) staat tientallen keren inline terwijl `var(--s-accent)` bestaat — één themawissel
  vergt nu zoek-en-vervang.

→ Kleuren altijd via `--s-*`; herhaalde stijl-objecten (zoals `knop` in `bpmnActivity`) naar classes.

## 5. Dode code & kleine punten

- **`isOpen` / `isPinned`** in `useStudioStore` worden nergens aangeroepen; `StudioShell` doet de
  lookup inline. → Helpers gebruiken óf verwijderen.
- **Debug-logging:** veel `console.log("[DMN] …")` in `handleDropFieldRef` (deels met
  `eslint-disable no-console`). → Verwijderen of achter `import.meta.env.DEV`.
- `ThemaKnop` abonneert zelf op `theme` terwijl `StudioShell` dat ook al leest (dubbel maar onschadelijk).
- `handleViewChange(view)` negeert zijn parameter.

## 6. Dependencies

Binnen de studio-map: **geen overbodige** imports — alleen `react` + `zustand`; zware libs
(`bpmn-js`, `dmn-js`, `@xyflow/react`) komen via de onderliggende modules, en UML laadt `lazy`.
Aandachtspunt: `dmnActivity` laadt `DmnModeler` niet lazy, dus dmn-js zit altijd in de studio-bundle
— kandidaat voor `React.lazy`. Projectbrede dode deps zijn niet vanuit de studio te bepalen; draai
`npx depcheck` in `web/vite/`.

## 7. Veiligheid

Geen alarmerende bevindingen:

- Geen `dangerouslySetInnerHTML`, geen `eval`.
- `window.open(...)` met `"noopener"`.
- `localStorage` lezen/schrijven in `try/catch`.
- Downloads zijn lokale Blobs (geen injectie-oppervlak).

Kleine punten: `window.alert` voor "Over Omnium Studio" (oogt ruw — eigen dialoog past beter); de
`apiBase`-detectie op `window.location.port === "5174"` is broos en op meerdere plekken hardgecodeerd
(centraliseren, evt. via env-var).

## 8. Toegankelijkheid

Goede basis: `aria-pressed` op activity-knoppen, `role="menu"/"menuitem"`, `aria-haspopup`/
`aria-expanded` op submenu's, Escape sluit menu's, `role="separator"` op de splitters.

Gaten (vooral toetsenbord):

1. **Flyout-submenu's zijn muis-only** — `MenuBar` opent submenu's uitsluitend op `onMouseEnter`; de
   submenu-knop heeft geen `onClick`/`onKeyDown`. Toetsenbordgebruikers kunnen "Maak…", "Uitlijnen…"
   e.d. niet bereiken. **Grootste defect.**
2. **Geen pijltjestoets-navigatie** in de menubalk (WAI-ARIA "menubar"-pattern); ook ontbreekt
   `role="menubar"` op de balk en `aria-haspopup`/`aria-expanded` op de top-level titel-knoppen.
3. **Sneltoetsen zijn alleen labels.** "Ctrl+O/S/Z" staan in de menu's, maar de studio-shell vangt ze
   niet af; de echte handler zit in `IdePage` (regels 683-725) en werkt dus alleen binnen de UML-IDE,
   niet voor DMN/BPMN/Bericht. → Of een shell-brede handler die via de `menuBus` dispatcht, óf de
   labels weghalen waar ze niet werken.
4. **Splitter/panelen muis-only** — `startResize` luistert alleen op mouse-events: geen `tabIndex`,
   geen pijltjes-resize, geen `aria-valuenow/min/max`, geen Pointer Events (touch/pen). De auto-hide-
   overlay opent alleen op `onMouseEnter`, niet op focus.
5. **Glyph-knoppen zonder tekstalternatief** — `▕▏`/`▏▕` en `☾`/`☀` hebben wel `title` maar geen
   `aria-label`.

### A11y — eerste stappen (meeste effect)
- Flyout-submenu's toetsenbord-bereikbaar maken (1).
- Arrow-key roving + `role="menubar"` in `MenuBar` (2).
- Sneltoetsen óf shell-breed afvangen óf labels weghalen (3).

---

## Aanbevolen volgorde voor refactor

1. **Laag risico, pure opschoning:** gedeelde `download*/apiBase`-util + dode code & debug-logs weg.
2. **Thema-kleurfix:** hardgecodeerde kleuren in de activiteiten → `--s-*` (begin bij `DmnInspector`).
3. **A11y:** menubalk-toetsenbordnavigatie (apart, want grootste gedrags-impact).

Elke stap is afzonderlijk te verifiëren met `npm run build` + visuele check, en hoort op een aparte
feature-branch met kleine commits per onderwerp.
