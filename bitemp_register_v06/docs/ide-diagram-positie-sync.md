# IDE diagram-positie synchronisatie

> **Status**: ontwerp gereed, nog niet geïmplementeerd
> **Aangemaakt**: 2026-04-20
> **Backlog**: I36

---

## Probleemstelling

De IDE werkt met meerdere diagrammen (bijv. `overzicht`, `code_import_code`, domein-specifieke diagrammen). Elke node heeft een positie per diagram — hetzelfde element kan op verschillende plekken staan in verschillende diagrammen.

### Schrijven: diagram-specifiek

`updateDiagramNodes()` in `web/vite/src/store/useModelStore.js` (regel ~294) slaat posities op in **alleen het actieve diagram**:

```js
updateDiagramNodes: (diagramId, nodes) =>
  set((state) => ({
    diagrams: {
      ...state.diagrams,
      [diagramId]: { ...state.diagrams[diagramId], nodes },
    },
  })),
```

Aanroepplaatsen in `DiagramCanvas.jsx`: regels 888, 954, 1671, 1799, 1919 — allemaal met de lokale `diagramId`.

### Lezen: altijd `overzicht`

`elementPositie()` in `web/vite/src/store/adapters.js` (regel ~591) leest posities **altijd uit het `overzicht` diagram** (`DEFAULT_DIAGRAM_ID = "overzicht"`):

```js
function elementPositie(diagrams, elementId) {
  const overzicht = diagrams?.[DEFAULT_DIAGRAM_ID];
  if (!overzicht) return undefined;
  const node = (overzicht.nodes || []).find((n) => n.elementId === elementId);
  return node?.position || undefined;
}
```

Hetzelfde geldt voor `diagramEdgeData()` en `collectUseEdges()` op de regels direct na `elementPositie()`.

### Gevolg

Als je nodes versleept in een ander diagram dan `overzicht`, worden de nieuwe posities nooit meegenomen in:
- De V3 JSON export (`storeNaarV3Model()` via `adapters.js`)
- De V3 publicatie naar de API
- De Go metaregistry na codegen

Je hebt de posities dan wél zichtbaar in de IDE (in dat ene diagram), maar ze gaan verloren bij elke export/import-cyclus.

---

## Drie oplossingsopties

### Optie A — Sync naar `overzicht` bij elke node-wijziging ⭐ (aanbevolen)

**Idee**: na het updaten van het actieve diagram ook de positie van elke node meeschrijven naar `overzicht`.

**Implementatie** in `useModelStore.js`:

```js
updateDiagramNodes: (diagramId, nodes) =>
  set((state) => {
    const newDiagrams = {
      ...state.diagrams,
      [diagramId]: { ...state.diagrams[diagramId], nodes },
    };

    // Sync posities naar overzicht als we in een ander diagram werken
    if (diagramId !== DEFAULT_DIAGRAM_ID && newDiagrams[DEFAULT_DIAGRAM_ID]) {
      const overzichtNodes = newDiagrams[DEFAULT_DIAGRAM_ID].nodes.map((ovNode) => {
        const match = nodes.find((n) => n.elementId === ovNode.elementId);
        return match ? { ...ovNode, position: match.position } : ovNode;
      });
      newDiagrams[DEFAULT_DIAGRAM_ID] = {
        ...newDiagrams[DEFAULT_DIAGRAM_ID],
        nodes: overzichtNodes,
      };
    }

    return { diagrams: newDiagrams };
  }),
```

**Voordelen**:
- Minimale wijziging (~15 regels)
- `elementPositie()` en `diagramEdgeData()` hoeven niet aangepast
- `overzicht` blijft altijd de canonical bron
- Werkt direct voor alle exportpaden

**Nadelen**:
- `overzicht` groeit mee met wijzigingen in andere diagrammen — dat is de bedoeling, maar wel bewust
- Nodes die _niet_ in `overzicht` bestaan (alleen in een ander diagram) worden niet gesynchroniseerd — dat is correct gedrag

**Aanroepplaatsen**: geen wijzigingen nodig in `DiagramCanvas.jsx`.

---

### Optie B — `elementPositie()` leest uit het actieve diagram, met fallback

**Idee**: geef het actieve diagram mee aan de export-functie en lees posities eerst uit dat diagram.

**Implementatie** in `adapters.js`:

```js
function elementPositie(diagrams, elementId, voorkeurDiagramId = DEFAULT_DIAGRAM_ID) {
  // Probeer eerst het voorkeurdiagram
  const voorkeur = diagrams?.[voorkeurDiagramId];
  const voorkeurNode = (voorkeur?.nodes || []).find((n) => n.elementId === elementId);
  if (voorkeurNode?.position) return voorkeurNode.position;

  // Fallback naar overzicht
  const overzicht = diagrams?.[DEFAULT_DIAGRAM_ID];
  const overzichtNode = (overzicht?.nodes || []).find((n) => n.elementId === elementId);
  return overzichtNode?.position || undefined;
}
```

Dan moet `storeNaarV3Model()` (het exportpunt) het actieve diagram-ID meegeven:

```js
// In adapters.js: storeNaarV3Model aanpassen
export function storeNaarV3Model(store, activeDiagramId) {
  const { diagrams, elements } = store;
  // ... alle calls naar elementPositie(...) aanpassen naar elementPositie(diagrams, id, activeDiagramId)
}
```

**Voordelen**:
- Export respecteert het diagram dat je actief hebt
- Geen schrijf-side bijeffecten

**Nadelen**:
- De export is afhankelijk van _welk diagram toevallig actief is_ — niet deterministisch
- 7 aanroepplaatsen van `elementPositie()` aanpassen + doorgeven van `activeDiagramId` door de call-chain
- `diagramEdgeData()` en `collectUseEdges()` moeten ook aangepast worden

---

### Optie C — Canonical positie per element (los van diagrammen)

**Idee**: sla één "master positie" per element op in de store, buiten de diagrammen. Diagrammen bevatten dan alleen locale overrides.

**Store structuur**:
```js
{
  elements: { ... },
  elementPosities: {          // nieuw: canonical positie per elementId
    "abc123": { x: 100, y: 200 },
    ...
  },
  diagrams: {
    "overzicht": {
      nodes: [{ elementId: "abc123", position: null }],  // null = gebruik canonical
      ...
    },
    "code_import_code": {
      nodes: [{ elementId: "abc123", position: { x: 500, y: 300 } }],  // lokale override
      ...
    }
  }
}
```

`elementPositie()` leest dan uit `elementPosities`, en een diagram-node met `position: null` valt terug op de canonical positie.

**Voordelen**:
- Architectureel het schoonst
- Export is altijd consistent, ongeacht welk diagram actief is
- Diagrammen kunnen lokale layouts hebben zonder de canonical te overschrijven

**Nadelen**:
- Grootste wijziging: store-structuur, alle `updateDiagramNodes()` aanroepen, alle reads aanpassen
- Bestaande IDE exports (JSON-bestanden) zijn niet meer compatible zonder migratie
- Meer complexiteit in de store-logica

---

## Aanbeveling

**Optie A** voor nu. Het lost het probleem direct op met minimale impact. Als later multi-diagram layouts een eersterangs feature worden (bijv. per-diagram layout opslaan en wisselen zonder overschrijven), kan alsnog naar Optie C worden gemigreerd.

---

## Betrokken bestanden

| Bestand | Rol |
|---|---|
| `web/vite/src/store/useModelStore.js` | `updateDiagramNodes()` — schrijfpad (optie A: hier aanpassen) |
| `web/vite/src/store/adapters.js` | `elementPositie()`, `diagramEdgeData()`, `collectUseEdges()` — leespad (optie B: hier aanpassen) |
| `web/vite/src/ide/DiagramCanvas.jsx` | Aanroepplaatsen `updateDiagramNodes()` — regels 888, 954, 1671, 1799, 1919 |
| `web/vite/src/store/useModelStore.js` | `DEFAULT_DIAGRAM_ID = "overzicht"` (regel 34) |
| `web/vite/src/ide/repCreation.js` | `DEFAULT_DIAGRAM_ID` gebruikt op regels 19, 207, 210, 213, 286, 287, 440 |
