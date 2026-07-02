# React 18 Concurrent Mode + XyFlow 12 ResizeObserver Race Condition

**Status**: Fixed (2026-04-26)  
**Severity**: Critical (blocks page load)  
**Impact**: MetamodelEditor (editor-v2) + DiagramCanvasInner (IDE)  

## Problem

On every page load of `/react/editor-v2.html` or `/react/ide.html`, the browser throws:

```
Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node
```

The error bubbles to the React error boundary, rendering the entire page useless until a manual reload.

## Root Cause Analysis

### React 18 Concurrent Mode Rendering Pipeline

React 18 (without StrictMode) commits DOM in **asynchronous microtask batches**:

1. **Render phase**: virtualize the component tree (synchronous, repeatable)
2. **Commit phase** (multiple sub-phases, in `useLayoutEffect` order):
   - `beforeMutation`: run code before DOM is mutated
   - `mutation`: apply DOM changes (appendChild, removeChild, etc.)
   - `layout`: run `useLayoutEffect` hooks
   - `passive`: run `useEffect` hooks (lower priority)

The critical detail: **`useLayoutEffect` runs BEFORE the browser's next paint**, giving developers a window to measure/adjust DOM before pixels hit the screen.

### XyFlow 12 ResizeObserver Installation

XyFlow mounts a `ResizeObserver` in a `useLayoutEffect`:

```js
// Inside XyFlow's internal code (simplified)
useLayoutEffect(() => {
  const ro = new ResizeObserver((entries) => {
    // Calculate new viewport based on canvas size
    // Update internal state
    updateFlowViewport(entries[0].contentRect);
  });
  
  // THIS LINE: observe() can trigger the callback SYNCHRONOUSLY
  ro.observe(canvasElement);
}, [canvasElement]);
```

### The Race Condition

**Chrome's ResizeObserver implementation fires synchronously** when `observe()` is called if the element already has layout dimensions:

1. MetamodelEditor or DiagramCanvasInner renders `<ReactFlow>`
2. React's commit phase runs all `useLayoutEffect` hooks
3. XyFlow's `useLayoutEffect` runs and calls `observe()`
4. ResizeObserver callback fires **immediately (same microtask queue)**
5. XyFlow reads canvas dimensions and updates internal state (e.g., viewport, nodes)
6. XyFlow's state update triggers a re-render of internal components
7. **Meanwhile, React is still in its commit phase**, having not yet finished transferring all DOM nodes
8. XyFlow's re-render tries to remove/move DOM nodes that React hasn't handed over yet
9. `removeChild` throws because the node is still under React's control

### Why Single-Mount Pattern Doesn't Help

EditorV2Page already has:

```js
const [data, setData] = useState(null);
if (data === null) return <LoadingSpinner />;
// MetamodelEditor only mounts once, after data is ready
return <MetamodelEditor initialNodes={...} initialEdges={...} />;
```

This prevents **React re-mounting** MetamodelEditor, but doesn't prevent **XyFlow's ResizeObserver from firing during React's initial commit sequence**.

The race happens during the **first and only mount**, not on subsequent re-mounts.

## Solution: One-Frame Deferral

Defer the mounting of `<ReactFlow>` by one `requestAnimationFrame`:

```js
const [reactFlowGereed, setReactFlowGereed] = useState(false);

useEffect(() => {
  const raf = requestAnimationFrame(() => setReactFlowGereed(true));
  return () => cancelAnimationFrame(raf);
}, []);

// In JSX:
{reactFlowGereed && <ReactFlow nodes={nodes} edges={edges} ... />}
```

### Why This Works

```
JavaScript Event Loop Timeline:
┌─────────────────────────────────────────┐
│ Microtask Queue (synchronous)           │
├─────────────────────────────────────────┤
│ 1. React render + commit phases         │
│    - Render virtual tree                │
│    - Commit: beforeMutation             │
│    - Commit: mutation (DOM ops)         │
│    - Commit: layout (useLayoutEffect)   │
│      └─ XyFlow's useLayoutEffect        │
│         └─ observe() called             │
│            └─ ResizeObserver fires      │ ← RACE HAPPENS HERE
│    - Commit: passive (useEffect)        │
│      └─ requestAnimationFrame scheduled │
│                                          │
│ 2. Browser recalculates layout          │
│                                          │
│ 3. Paint (pixels rendered)              │
│                                          │
├─────────────────────────────────────────┤
│ Animation Frame Callback (next frame)   │
├─────────────────────────────────────────┤
│ 4. requestAnimationFrame callback fires │
│    - setReactFlowGereed(true)           │
│    - React re-renders, mounts ReactFlow│
│      └─ <ReactFlow> now in virtual tree│
│      └─ React commit runs again         │
│         └─ XyFlow useLayoutEffect runs  │
│            └─ observe() called          │
│               └─ ResizeObserver fires   │ ← SAFE: React already handed over DOM
│                                         │
│ 5. Browser recalculates layout          │
│                                          │
│ 6. Paint (pixels rendered)              │
└─────────────────────────────────────────┘
```

Key insight:
- **Without deferral**: ResizeObserver fires in the same microtask queue as React's commit
- **With deferral**: ResizeObserver fires in a **separate animation frame** after React's commit is fully done and the browser has painted once

The ~16ms delay (one frame at 60 Hz) is imperceptible.

## Implementation Details

### MetamodelEditor.jsx

**Location**: [Line 292–300](../web/vite/src/umleditor/components/MetamodelEditor.jsx#L292-L300)

```js
const [reactFlowGereed, setReactFlowGereed] = useState(false);
useEffect(() => {
  const raf = requestAnimationFrame(() => setReactFlowGereed(true));
  return () => cancelAnimationFrame(raf);
}, []);
```

**In JSX** (around line 2511):
```jsx
{reactFlowGereed && <ReactFlow
  nodes={visueleNodes}
  edges={edges}
  ... props ...
>
  {/* children */}
</ReactFlow>}
```

The containing `<div className="editor-canvas">` remains **always rendered** (so layout doesn't shift). Only the `<ReactFlow>` component is deferred.

### DiagramCanvasInner (DiagramCanvas.jsx)

**Location**: [Line 728–736](../web/vite/src/ide/DiagramCanvas.jsx#L728-L736)

Same pattern. Note: DiagramCanvasInner is **inside** the `ReactFlowProvider`, so the provider wraps the conditional render — this is correct.

### Edge Case: Escape Cleanup

Both components have event listeners that reference `activeEdgeMode`. The `useEffect` cleanup is independent and already present, so no changes needed.

## Testing

### Manual Verification
1. Clear browser cache / hard reload (`Cmd+Shift+R` on macOS)
2. Navigate to `/react/editor-v2.html` → should load without crash
3. Navigate to `/react/ide.html` → should load without crash
4. Resize browser window → should not trigger crash (ResizeObserver still works)
5. Open DevTools → Elements panel should show full DOM tree (no orphaned nodes)

### Automated Testing
No specific unit test added because:
- The race is timing-dependent and hard to reproduce in JSDOM/RTL
- React 18 concurrent mode is not fully simulated in testing libraries
- The fix is a known workaround pattern in the React community

Instead: rely on **integration testing** (Vite dev server + manual browser testing) and **code review** of the deferral logic.

## Related Issues

- **Not StrictMode-related**: StrictMode is already disabled in `main.jsx` with a comment explaining why. The race happens in production (non-StrictMode) because of concurrent rendering.
- **Not unique to XyFlow**: Any library that installs a ResizeObserver in useLayoutEffect without debouncing is vulnerable. Other affected libraries: `react-virtualized`, `react-window`, custom canvas/graph libraries.
- **React 17 vs 18**: React 17 has synchronous rendering (no microtask batching) so the race doesn't occur. v06 uses React 18.3.1.

## References

- [React Concurrency Explainer](https://react.dev/learn/render-and-commit)
- [ResizeObserver Spec](https://w3c.github.io/resize-observer/)
- [Chrome ResizeObserver Behavior](https://developer.chrome.com/articles/resize-observer/)
- XyFlow v12 source: `useLayoutEffect` hook in core library (not exposed in public API)

## Future Improvements

1. **XyFlow Upstream**: if XyFlow v13+ adds a debounce/batching mechanism to ResizeObserver, this deferral can be removed.
2. **React 19**: if React 19 changes concurrent-mode semantics, the deferral may become unnecessary (TBD).
3. **Measurement**: profile the actual delay with `performance.mark()` / `performance.measure()` to confirm imperceptibility.

---

# Tweede oorzaak: dubbele main.jsx-instantie in dev (Fast Refresh footer)

**Status**: Fixed (2026-07-03)
**Severity**: High (crash bij page load, alleen dev-server)
**Impact**: alle pagina's die via `src/main.jsx` laden (`/studio`, `/ide`, …)

Naast de ResizeObserver-race hierboven bleek er een **tweede, onafhankelijke**
bron van dezelfde `removeChild`-crash te bestaan — dev-only, grillig, en
jarenlang onvindbaar. Symptomen bij page load:

```
Warning: You are calling ReactDOMClient.createRoot() on a container that has
already been passed to createRoot() before.
NotFoundError: Failed to execute 'removeChild' on 'Node': …
```

## Oorzaak (drie schakels)

1. **Fast Refresh-footer importeert de module zichzelf.** `@vitejs/plugin-react`
   injecteert onderin elk JSX-bestand — dus ook entry `src/main.jsx` — een
   footer met `import * as currentExports from "<eigen module>"`. Vite's
   import-analysis plakt daar een `?t=<timestamp>` achter zodra de module ooit
   in deze serversessie geïnvalideerd is.
2. **De HTML laadt de module zónder query.** `studio.html` verwijst naar
   `/src/main.jsx` (plain). Zodra de footer `?t=…` draagt, ziet de browser
   **twee verschillende URL's → twee module-instanties → main.jsx executeert
   twee keer → twee `createRoot()` op dezelfde `#root`**. Beide roots muteren
   dezelfde DOM en de tweede commit crasht op `removeChild`.
3. **De timestamp raakte "vergiftigd" buiten je om.** Twee triggers gezien:
   Vite's **dep-optimizer** die bij (her)start of nieuwe dependencies modules
   invalideert, en de eigen HMR-guard in `main.jsx` die
   `import.meta.hot.invalidate()` aanriep. Eén keer vergiftigd = crash bij
   **elke volgende page load** tot de dev-server herstart — vandaar het
   grillige, onreproduceerbare karakter.

Bijvangst: de HMR-guard zelf was **dode code** — hij matchte op bestandspaden
(`/web/vite/src/studio/…`) terwijl `vite:beforeUpdate` root-relatieve URL's
levert (`/src/studio/…`). De "volledige reload bij React Flow/FlexLayout-
wijzigingen" heeft dus nooit gewerkt; partiële HMR-updates kwamen altijd door.

## Fix (drielaags, alle in `src/main.jsx`)

1. **Idempotente root** — de `Root` wordt op de container zelf bewaard
   (`container.__omniumRoot`); een tweede module-instantie kan nooit meer een
   tweede `createRoot()` doen. Dit dooft de crash definitief, ongeacht wie de
   timestamp nog vergiftigt (dep-optimizer blijft dat doen).
2. **`window.location.reload()` i.p.v. `import.meta.hot.invalidate()`** in de
   HMR-guard — een echte page-reload zonder de module graph te vervuilen
   (invalidate maakte het probleem juist erger: door de Fast Refresh-footer is
   main.jsx self-accepting, dus invalidate her-executeerde de entry in-place).
3. **Matchlijst gerepareerd** naar root-relatieve paden (`/src/studio/` enz.,
   incl. de nieuwe `/src/diagramcore/` en `/src/diagramprofielen/`), zodat de
   guard nu wél doet wat hij belooft.

## Verificatie (Playwright, 2026-07-03)

- Vergiftigde graph + fix: page load → **0 errors** (voorheen 4).
- Schone serverstart: footer krijgt door de dep-optimizer alsnog `?t`;
  main.jsx wordt aantoonbaar dubbel gefetcht (plain + `?t`) maar is nu
  onschadelijk — 0 errors.
- Guard-trigger: bewerken van `src/studio/menuBus.js` met open pagina → nette
  volledige page-reload per wijziging, 0 errors, graph blijft schoon.

Productie-builds hadden hier nooit last van (`import.meta.hot` en de Fast
Refresh-footer bestaan alleen in dev).
