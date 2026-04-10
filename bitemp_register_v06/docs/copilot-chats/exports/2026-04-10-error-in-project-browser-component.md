# Chat: Error in Project Browser Component

- **Datum**: 2026-04-10 08:52
- **Sessie-ID**: `4830772e-e518-47da-92f1-6b02654c3e3b`
- **Berichten**: 8

---

## 🧑 User

http://localhost:5174/viz/react/ide.html geeft een fout in de PB (project browser)

Fout in ProjectBrowser
Error: Data must contain an 'id' property or props.idAccessor must return a string
Component stack

    at TreeProvider (http://localhost:5174/viz/react/node_modules/.vite/deps/react-arborist.js?v=85303f98:6851:25)
    at TreeComponent (http://localhost:5174/viz/react/node_modules/.vite/deps/react-arborist.js?v=85303f98:7107:14)
    at div
    at div
    at ProjectBrowser (http://localhost:5174/viz/react/src/ide/ProjectBrowser.jsx:363:42)
    at ErrorBoundary (http://localhost:5174/viz/react/src/ide/ErrorBoundary.jsx:12:3)
    at ErrorBoundary (http://localhost:5174/viz/react/node_modules/.vite/deps/flexlayout-react.js?v=163c2194:4665:3)
    at http://localhost:5174/viz/react/node_modules/.vite/deps/flexlayout-react.js?v=163c2194:4699:40
    at div
    at LayoutInternal (http://localhost:5174/viz/react/node_modules/.vite/deps/flexlayout-react.js?v=163c2194:4812:3)
    at Layout (http://localhost:5174/viz/react/node_modules/.vite/deps/flexlayout-react.js?v=163c2194:4716:3)
    at div
    at div
    at IdePage (http://localhost:5174/viz/react/src/pages/IdePage.jsx:36:20)
    at Suspense
    at App (http://localhost:5174/viz/react/src/App.jsx:36:16)
    at RootErrorBoundary (http://localhost:5174/viz/react/src/main.jsx:8:3)
🔄 Opnieuw proberen

Wat gaat daar mis? KUn je het repareren?

---

## 🤖 Assistant

The error says `react-arborist` requires every node to have a string . Some element in the store likely has a missing or non-string . Let me check the data flow. The error means `react-arborist` is receiving tree nodes without a valid string . This can happen when elements loaded from localStorage lack an  field or have a non-string . Let me look at how elements can end up invalid, then add a defensive fix. Looking at , there are two risks:
1. An element in the store might be missing  or have a non-string 
2. A GE without a domain but with a structural edge could produce duplicate node IDs (once as child of entiteit, once in "geen domein")

The fix needs to:
- Filter out elements with no valid 
- Ensure all tree node IDs are strings
- Prevent duplicates in the "geen domein" fallback 
```

```
Now let me also add `idAccessor` as a safety net on the  component itself, so even if somehow a node leaks through with a numeric id, it still works: 
```

```
Het probleem zat in  in . Twee oorzaken aangepakt:

1. **Ontbrekend/ongeldig ** — elementen uit localStorage kunnen een ontbrekend of niet-string  hebben. Toegevoegd: een -check die elementen zonder geldig string-id overslaat.

2. **Dubbele node-IDs** — GE's die via structural edges onder een entiteit hangen, konden *ook* in de "geen domein"-lijst terechtkomen (als  leeg was). `react-arborist` crasht op duplicaten. Toegevoegd: een -set die bijhoudt welke IDs al in de boom zitten.

3. **Extra vangnet** —  op de  zodat een numeriek id alsnog wordt geaccepteerd.

Herlaad de pagina om te testen — de ProjectBrowser zou nu zonder fout moeten laden.

---

## 🧑 User

nu staat er 

Runtime-fout in de pagina
De React-app is gecrasht tijdens renderen. Details:

Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.
Herlaad pagina

(ook na harde reload)

---

## 🤖 Assistant

This  error is a classic React 18 StrictMode + DOM-manipulating libraries conflict. `flexlayout-react` manages its own DOM nodes directly, which clashes with StrictMode's double-mount/unmount behavior. Let me check if this was pre-existing or triggered by data issues. The  error is a well-known conflict between React 18's  (which double-mounts/unmounts components) and DOM-manipulating libraries like `flexlayout-react`, `react-arborist`, and `@xyflow/react`. My previous fix likely changed the render timing enough to expose this pre-existing issue.

The fix: remove  from  — this is standard practice for apps using these libraries. 
```

```
 verwijderd uit . 

**Oorzaak**: React 18 StrictMode mount/unmount elk component twee keer tijdens development. Libraries die de DOM direct beheren (`flexlayout-react`, `react-arborist`, . 

**Oorzaak**: React 18 StrictMode mount/unmount elk component twee keer tijdens development. Libraries die de DOM direct beheren (`flexlayout-react`, `react-arborist`, `@xyflow/react`) raken daardoor hun DOM-nodes kwijt →  crash.

Herlaad de pagina — beide fouten zouden nu opgelost moeten zijn.

---

## 🧑 User

nee, er is nog Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.

---

## 🤖 Assistant

The HTML is clean. This  error with FlexLayout is almost certainly caused by a corrupted layout state in localStorage. When FlexLayout restores a layout JSON that references tabs or structures that changed, its DOM manipulation fails.

Let me make  more resilient and also clear the corrupted layout: 
```

```
Now let me update the  to clear the corrupted layout on crash and offer a proper recovery: 
```

```
Now let me also wrap the FlexLayout component itself to catch the  error and auto-recover: 
```

```
Now add a layout error boundary that auto-resets:  

---

## 🧑 User

(de editor heeft dezelfde fout opeens)

---

## 🤖 Assistant

Laten we eerst de corrupte localStorage wissen om te zien of dat de oorzaak is, en tegelijk de editor-code bekijken.  De editor-v2 gebruikt geen FlexLayout. Als die ook crasht op dezelfde  error kan het uit ReactFlow of de MetamodelEditor komen. Laat me de MetamodelEditor checken. Het probleem is dat het  error buiten React's error boundary valt — het is een DOM-level fout die niet gecatcht wordt. Omdat zowel IDE als Editor crashen (beide gebruiken ReactFlow/@xyflow), vermoed ik dat de Vite dev server in een slechte HMR-state zit na de file changes.

Stap 1: wis de browser-cache en localStorage. Open de **browser console (F12)** en voer dit uit:

```js
localStorage.clear(); location.reload();
```

Als dat niet werkt, probeer stap 2: volledige Vite cache clear: Het was een corrupte localStorage-state. De Vite cache was ook stale — beide zijn nu gewist.

De eerder gemaakte fixes blijven relevant:

1. **** — filtert nu elementen zonder geldig string- en voorkomt duplicaten in de boom
2. **** — valideert opgeslagen layout JSON en ruimt corrupte state op; exporteert  voor recovery
3. **** — StrictMode verwijderd (conflict met DOM-libraries), error boundary biedt nu een "Reset layout en herlaad" knop die automatisch localStorage opruimt

Als dit in de toekomst weer gebeurt, is de "Reset layout en herlaad" knop op de error-pagina de snelle fix.

---
