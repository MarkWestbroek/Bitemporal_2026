# Drop / Paste Logic — Sequence Diagram & Analyse

## Huidige situatie — problemen

### Kernprobleem
De huidige code heeft **drie losse codepaden** (drop, paste, create) die elk op hun eigen manier edges aanmaken. Geen van deze paden maakt het **volledige ASOC-patroon** (anker + 3 edges) aan bij het plaatsen van een relatie. Het ASOC-patroon wordt alleen gecreëerd door `convertVeldenForward()` (wanneer het eerste veld aan een relatie wordt toegevoegd), niet bij drop/paste.

### Specifieke problemen
1. **Shift+drag vanuit PB** — cursor verandert niet in drag-icoon (react-arborist conflicteert met Shift)
2. **Drop relatie** — doelEdge + ownerEdge worden niet altijd correct gevonden; ASOC-anker wordt nooit gemaakt
3. **Paste** — kopieert boundary-edges (halve edges) die zinloos zijn zonder hun endpoints
4. **Orphan edges** — edges waarvan een endpoint niet op het diagram staat, worden nooit opgeruimd

---

## Huidige architectuur

### Hoe het ASOC-patroon vandaag werkt
```
Stap 1: V3 import of IDE-creatie maakt:
  - structuralEdge: ENT_A → REL (owner, compositie)
  - diagramEdge: REL → ENT_B (doelEdge, in "Overzicht" diagram)
  - Géén anker-node, géén ASOC-edges

Stap 2: Gebruiker voegt velden toe aan REL → convertVeldenForward():
  - Maakt anker_REL node (type: "associatieAnker")
  - Vervangt 2 edges door 3 ASOC-edges:
    Edge1: ENT_A → anker (isAssociation)
    Edge2: anker → ENT_B (isAssociation)
    Edge3: anker → REL   (isAssociationClassLink, dashed)

Stap 3: Gebruiker verwijdert alle velden → convertVeldenReverse():
  - Verwijdert anker + 3 ASOC-edges
  - Herstelt 2 oorspronkelijke edges
```

### Probleem: drop en paste weten niets van dit ASOC-systeem

| Actie | Maakt ownerEdge? | Maakt doelEdge? | Maakt anker? | Maakt ASOC-edges? |
|-------|-----------------|-----------------|-------------|-------------------|
| V3 import | ✅ structural | ✅ diagram | ❌ | ❌ |
| `maakRelatieTussenEntiteiten()` | ✅ structural | ✅ extraDiagram | ❌ | ❌ |
| `convertVeldenForward()` | (opruimen) | (opruimen) | ✅ | ✅ |
| `handleDrop()` | via discover | via discover | ❌ | ❌ |
| `handlePaste()` | via discover | via discover | ❌ | ❌ |

---

## Gewenst gedrag

### Principe
> Bij **elke** plaatsingsactie (drop, paste, create) moet het diagram **consistent** zijn:
> - Alle edges hebben beide endpoints op het diagram
> - Relaties met velden tonen het ASOC-patroon (anker + 3 edges)
> - Relaties zonder velden tonen 2 simpele edges (of collapsed label)
> - Orphan edges bestaan niet

### Geünificeerde logica: `materialiseerEdgesVoorDiagram()`

Eén functie die na elke plaatsing wordt aangeroepen en het diagram consistent maakt.

---

## Sequence Diagram — DROP vanuit ProjectBrowser

```mermaid
sequenceDiagram
    participant PB as ProjectBrowser
    participant DC as DiagramCanvas<br/>(handleDrop)
    participant ML as materialiseerRelaties()
    participant Store as Zustand Store
    participant RF as ReactFlow

    PB->>DC: onDrop(dragPayload)
    
    Note over DC: 1. Parse payload<br/>(single of multi-element)
    DC->>Store: getState() → elements, structuralEdges, diagrams
    
    Note over DC: 2. Filter: geldig + niet al op diagram
    
    Note over DC: 3. Plaats nodes
    loop voor elk dropItem
        DC->>Store: addElementToDiagram(diagramId, elementId, position)
    end
    DC->>RF: setNodes([...bestaand, ...nieuw])
    
    Note over DC: 4. Materialiseer relaties
    DC->>ML: materialiseerRelaties(diagramId, nieuwePlaatsingen)
    
    Note over ML: 4a. Verzamel alle nodeIds op diagram
    ML->>Store: diagrams[diagramId].nodes → allNodeIds
    
    Note over ML: 4b. Voor elke REL-node op diagram
    loop voor elke relatie op diagram
        ML->>Store: Zoek ownerEdge:<br/>structuralEdges.find(se → se.target === relId)
        ML->>Store: Zoek doelEntiteit:<br/>elements[relId].data.doelEntiteit
        
        alt owner ENT niet op diagram
            ML-->>ML: Skip: niet tekenen<br/>(of optioneel: auto-add)
        end
        alt doel ENT niet op diagram
            ML-->>ML: Skip: niet tekenen<br/>(of optioneel: auto-add)
        end
        
        alt relatie heeft velden (ASOC)
            Note over ML: Maak ASOC-patroon
            ML->>Store: addElement(anker_REL)
            ML->>Store: addElementToDiagram(ankerId, midpointPositie)
            Note over ML: Maak 3 edges:<br/>① ENT_A → anker<br/>② anker → ENT_B<br/>③ anker → REL (dashed)
        else relatie zonder velden (simpel)
            Note over ML: Maak 2 simpele edges:<br/>① ENT_A → REL (compositie)<br/>② REL → ENT_B (associatie)
        end
    end
    
    Note over ML: 4c. Voeg dependency-edges toe<br/>(enum, datatype «use»)
    loop voor elke node op diagram
        ML->>Store: Zoek dependency-edges<br/>waar beide endpoints op diagram
    end
    
    Note over ML: 4d. Ruim orphan edges op
    ML->>Store: Verwijder edges waar<br/>source of target niet op diagram
    
    ML-->>DC: { nieuweNodes[], nieuweEdges[], opgeruimd[] }
    
    DC->>Store: updateDiagramEdges(diagramId, schoneEdges)
    DC->>RF: setNodes(metAnkers)
    DC->>RF: setEdges(schoneEdges)
```

---

## Sequence Diagram — PASTE vanuit clipboard

```mermaid
sequenceDiagram
    participant User as Gebruiker
    participant DC as DiagramCanvas<br/>(handlePaste)
    participant ML as materialiseerRelaties()
    participant Store as Zustand Store
    participant RF as ReactFlow

    User->>DC: Ctrl+V (of rechtsklik → Plakken)
    
    Note over DC: 1. Lees clipboard
    DC->>DC: diagramClipboard.nodes[]
    
    Note over DC: 2. Filter: geldig + niet al op diagram
    
    Note over DC: 3. Plaats nodes op diagram
    loop voor elk clipboard-item
        DC->>Store: addElementToDiagram(diagramId, elementId, position)
    end
    DC->>RF: setNodes([...bestaand, ...nieuw])
    
    Note over DC: 4. Materialiseer relaties<br/>(ZELFDE functie als bij drop)
    DC->>ML: materialiseerRelaties(diagramId, nieuwePlaatsingen)
    
    Note over ML: Identieke logica als drop:<br/>- ASOC-patroon voor relaties met velden<br/>- Simpele edges voor relaties zonder velden<br/>- Dependency-edges<br/>- Orphan cleanup
    
    ML-->>DC: { nieuweNodes[], nieuweEdges[], opgeruimd[] }
    
    DC->>Store: updateDiagramEdges(diagramId, schoneEdges)
    DC->>RF: setNodes(metAnkers)
    DC->>RF: setEdges(schoneEdges)
```

---

## Sequence Diagram — CREATE relatie (ENT→ENT edge draw)

```mermaid
sequenceDiagram
    participant User as Gebruiker
    participant DC as DiagramCanvas<br/>(handleConnect)
    participant RC as repCreation.js<br/>(maakRelatieTussenEntiteiten)
    participant ML as materialiseerRelaties()
    participant Store as Zustand Store

    User->>DC: Sleep edge van ENT_A naar ENT_B
    DC->>RC: maakRelatieTussenEntiteiten(bronId, doelId)
    
    Note over RC: Maak nieuw REL element<br/>(nog geen velden → geen ASOC)
    RC->>Store: addElement(REL)
    RC->>Store: addStructuralEdge(ENT_A → REL)
    RC->>Store: addElementToDiagram(REL, midpoint)
    RC->>Store: addDiagramEdge(REL → ENT_B)
    
    Note over DC: Na creatie:<br/>materialiseerRelaties()
    DC->>ML: materialiseerRelaties(diagramId, [relatieId])
    Note over ML: REL heeft geen velden →<br/>simpele 2-edge configuratie
    ML-->>DC: edges
```

---

## Kernfunctie: `materialiseerRelaties()`

### Pseudo-code

```
function materialiseerRelaties(diagramId, nieuwGeplaatsteIds?) {
  const store = getState()
  const diag = store.diagrams[diagramId]
  const nodeIdsOpDiagram = new Set(diag.nodes.map(n => n.elementId))
  const bestaandeEdges = new Map(diag.edges.map(e => [`${e.source}→${e.target}`, e]))
  
  const nieuweEdges = []
  const nieuweNodes = []
  const teVerwijderenEdgeIds = new Set()
  
  // ── 1. Voor elke relatie-node op het diagram ──
  for (const nodeId of nodeIdsOpDiagram) {
    const el = store.elements[nodeId]
    if (el?.type !== "relatie") continue
    
    // Zoek owner (bron-entiteit) en doel
    const ownerEdge = store.structuralEdges.find(se => se.target === nodeId)
    const ownerId = ownerEdge?.source
    const doelId = el.data?.doelEntiteit
    
    const ownerOpDiagram = ownerId && nodeIdsOpDiagram.has(ownerId)
    const doelOpDiagram = doelId && nodeIdsOpDiagram.has(doelId)
    const heeftVelden = (el.data?.velden?.length || 0) > 0
    
    // Verwijder alle bestaande edges voor deze relatie
    // (we herbouwen ze consistent)
    markeerBestaandeRelatieEdges(nodeId, teVerwijderenEdgeIds)
    
    if (heeftVelden && ownerOpDiagram && doelOpDiagram) {
      // ── ASOC-patroon: anker + 3 edges ──
      const ankerId = `anker_${nodeId}`
      if (!store.elements[ankerId]) {
        store.addElement({ id: ankerId, type: "associatieAnker", ... })
      }
      if (!nodeIdsOpDiagram.has(ankerId)) {
        nieuweNodes.push({ elementId: ankerId, position: midpoint(owner, doel) })
        nodeIdsOpDiagram.add(ankerId)
      }
      nieuweEdges.push(
        { source: ownerId, target: ankerId, data: { isAssociation: true } },
        { source: ankerId, target: doelId, data: { isAssociation: true } },
        { source: ankerId, target: nodeId, data: { isAssociationClassLink: true } }
      )
    } else if (ownerOpDiagram && doelOpDiagram) {
      // ── Simpele relatie: 2 edges ──
      nieuweEdges.push(
        { source: ownerId, target: nodeId, data: { compositie } },
        { source: nodeId, target: doelId, data: { associatie } }
      )
    } else if (ownerOpDiagram) {
      // Alleen owner → 1 compositie-edge
      nieuweEdges.push({ source: ownerId, target: nodeId, data: { compositie } })
    } else if (doelOpDiagram) {
      // Alleen doel → 1 associatie-edge
      nieuweEdges.push({ source: nodeId, target: doelId, data: { associatie } })
    }
    // Geen endpoints op diagram → geen edges
  }
  
  // ── 2. Structurele edges (ENT→GE compositie) ──
  for (const se of store.structuralEdges) {
    if (se is ENT→GE && both on diagram && not already added) {
      nieuweEdges.push(se)
    }
  }
  
  // ── 3. Dependency-edges (enum, datatype «use») ──
  for (const diagKey of Object.keys(store.diagrams)) {
    for (const de of store.diagrams[diagKey].edges) {
      if (de.data?.isDependency && both on diagram && not already added) {
        nieuweEdges.push(de)
      }
    }
  }
  
  // ── 4. Orphan cleanup: verwijder alle edges met ontbrekende endpoints ──
  const schoneEdges = finalEdges.filter(e => 
    nodeIdsOpDiagram.has(e.source) && nodeIdsOpDiagram.has(e.target)
  )
  
  return { nieuweNodes, schoneEdges }
}
```

---

## Vergelijking: huidig vs. gewenst

| Aspect | Huidig | Gewenst |
|--------|--------|---------|
| **Drop relatie** | `discoverEdgesForNodes`: zoekt bestaande edges | `materialiseerRelaties`: bouwt correct patroon op |
| **ASOC-anker bij drop** | ❌ Wordt nooit gemaakt | ✅ Wordt gemaakt als relatie velden heeft |
| **ASOC-anker bij paste** | ❌ Alleen als alle 4 nodes gekopieerd | ✅ Automatisch aangemaakt |
| **Orphan edges** | ❌ Worden gekopieerd | ✅ Worden opgeruimd |
| **Boundary edges (paste)** | Worden meegenomen → orphans | Worden genegeerd; edges worden opnieuw berekend |
| **Codepaden** | 3 (drop, paste, create) met elk eigen edge-logica | 1 gedeelde `materialiseerRelaties()` |
| **Consistentie** | Afhankelijk van welk pad | Altijd consistent |

---

## Open vragen voor review

1. **Auto-add endpoints?** — Als een relatie wordt gedropt en owner/doel niet op het diagram staan: auto-toevoegen of alleen de aanwezige edges tekenen?
   - *Voorstel*: configureerbaar, default = alleen tekenen wat er is. Optioneel Shift+drop = auto-add.

2. **Normaliseren na drop?** — Moeten edges automatisch `berekenKortsteHandles()` krijgen?
   - *Voorstel*: ja, bij initiële plaatsing wél normaliseren.

3. **Anker lifecycle** — Als een relatie van het diagram wordt verwijderd, moet de anker ook verwijderd worden?
   - *Voorstel*: ja, anker is een visueel hulpelement, geen model-element.

4. **GE's zonder parent op diagram** — Een GE zonder zijn parent-ENT: wel of niet tekenen?
   - *Voorstel*: GE's zijn altijd geldig om te tekenen. Compositie-edge alleen als parent er ook is.
