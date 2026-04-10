/**
 * ProjectBrowser — Domein/element tree voor de IDE.
 *
 * Toont het model als boomstructuur met react-arborist:
 *   📁 domein
 *   ├ 📦 Entiteit
 *   │ ├ 📎 GE
 *   │ └ 🔗 Relatie
 *   ├ 📄 Datatype
 *   ├ 📋 Enumeratie
 *   └ 📌 RefInstantie
 *   📐 Diagrammen
 *
 * Features:
 * - Zoekbalk bovenaan voor filteren
 * - Multi-select (Ctrl+klik) met multi-drag naar diagram
 * - Diagram-selectie → browser scrollt naar en highlight het element
 * - Dubbelklik op element → scroll-to op diagram
 * - Dubbelklik op diagram → opent tab
 */
import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { Tree } from "react-arborist";
import useModelStore from "../store/useModelStore";
import useUIStore from "../store/useUIStore";
import BrowserContextMenu from "./BrowserContextMenu";

// Iconen per element-type
const ICONS = {
  domain: "📁",
  entiteit: "📦",
  gegevenselement: "📎",
  relatie: "🔗",
  enumeratie: "📋",
  gegevenstype: "📄",
  referentielijstInstantie: "📌",
  diagrams: "📐",
  diagram: "📐",
};

/**
 * Bouw een boomstructuur uit de store.
 */
function buildTree(elements, structuralEdges, diagrams, domains) {
  const tree = [];
  // Houd bij welke element-ids al in de boom zitten (voorkom duplicaten)
  const geplaatst = new Set();

  // Helper: alleen elementen met een geldig string-id verwerken
  const geldigId = (el) => el && typeof el.id === "string" && el.id !== "";

  // Groepeer elementen per domein
  for (const domein of domains) {
    const domeinNode = {
      id: `domain_${domein}`,
      name: domein,
      nodeType: "domain",
      children: [],
    };

    // Filter elementen voor dit domein
    const domeinElements = Object.values(elements).filter((el) => geldigId(el) && el.domein === domein);

    // Entiteiten met hun GE's en relaties
    const entiteiten = domeinElements.filter((el) => el.type === "entiteit");
    for (const ent of entiteiten) {
      const entNode = {
        id: ent.id,
        name: ent.naam,
        nodeType: "entiteit",
        kleur: ent.data?.kleur,
        children: [],
      };
      geplaatst.add(ent.id);

      // Vind GE's die structureel onder deze entiteit hangen
      const childEdges = structuralEdges.filter((e) => e.source === ent.id);
      for (const edge of childEdges) {
        const child = elements[edge.target];
        if (child && geldigId(child)) {
          entNode.children.push({
            id: child.id,
            name: child.naam,
            nodeType: child.type,
            kleur: child.data?.kleur,
          });
          geplaatst.add(child.id);
        }
      }

      domeinNode.children.push(entNode);
    }

    // Enumeraties
    for (const el of domeinElements.filter((el) => el.type === "enumeratie")) {
      domeinNode.children.push({
        id: el.id,
        name: el.naam,
        nodeType: "enumeratie",
        kleur: el.data?.kleur,
      });
      geplaatst.add(el.id);
    }

    // Datatypes
    for (const el of domeinElements.filter((el) => el.type === "gegevenstype")) {
      domeinNode.children.push({
        id: el.id,
        name: el.naam,
        nodeType: "gegevenstype",
        kleur: el.data?.kleur,
      });
      geplaatst.add(el.id);
    }

    // Referentielijst-instanties
    for (const el of domeinElements.filter((el) => el.type === "referentielijstInstantie")) {
      domeinNode.children.push({
        id: el.id,
        name: el.naam,
        nodeType: "referentielijstInstantie",
        kleur: el.data?.kleur,
      });
      geplaatst.add(el.id);
    }

    tree.push(domeinNode);
  }

  // Elementen zonder domein — alleen als ze nog niet geplaatst zijn en een geldig id hebben
  const geenDomein = Object.values(elements).filter(
    (el) => geldigId(el) && !el.domein && !geplaatst.has(el.id)
  );
  if (geenDomein.length > 0) {
    const geenDomeinNode = {
      id: "domain_",
      name: "(geen domein)",
      nodeType: "domain",
      children: geenDomein.map((el) => ({
        id: el.id,
        name: el.naam,
        nodeType: el.type,
        kleur: el.data?.kleur,
      })),
    };
    tree.push(geenDomeinNode);
  }

  // Diagrammen-map
  const diagramList = Object.values(diagrams);
  if (diagramList.length > 0) {
    tree.push({
      id: "diagrams_root",
      name: "Diagrammen",
      nodeType: "diagrams",
      children: diagramList.map((d) => ({
        id: `diagram_${d.id}`,
        name: d.naam || d.id,
        nodeType: "diagram",
        diagramId: d.id,
      })),
    });
  }

  return tree;
}

// ─── Multi-selectie state (module-level, gedeeld tussen TreeNode en PB) ──────
let _multiSelected = new Set();   // set van element-id's
let _setMultiSelected = null;     // setter van useState in PB
let _lastClickedId = null;        // voor shift-range selectie
let _flatVisibleIds = [];          // platte lijst zichtbare draggable node-ids

// ─── Node renderer ──────────────────────────────────────────

function TreeNode({ node, style }) {
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const dragGhostRef = useRef(null);
  const isDetailSelected = node.data.id === selectedElementId;
  const isMultiSelected = _multiSelected.has(node.data.id);
  const isHighlighted = isDetailSelected || isMultiSelected;
  const isFolder = node.children && node.children.length > 0;
  const isDraggable = !["domain", "diagrams", "diagram"].includes(node.data.nodeType);

  const handleClick = useCallback((e) => {
    // Domein-klik: selecteer in DetailsPanel, maar niet draggable/multi-select
    if (node.data.nodeType === "domain") {
      useUIStore.getState().setSelectedElementId(node.data.id);
      return;
    }
    if (!isDraggable) return;
    if (e.shiftKey && _lastClickedId) {
      // Shift-klik: selecteer bereik tussen laatste klik en huidige
      const startIdx = _flatVisibleIds.indexOf(_lastClickedId);
      const endIdx = _flatVisibleIds.indexOf(node.data.id);
      if (startIdx >= 0 && endIdx >= 0) {
        const lo = Math.min(startIdx, endIdx);
        const hi = Math.max(startIdx, endIdx);
        _setMultiSelected?.((prev) => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) {
            next.add(_flatVisibleIds[i]);
          }
          return next;
        });
      }
      e.stopPropagation();
      e.preventDefault();
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle multi-selectie
      _setMultiSelected?.((prev) => {
        const next = new Set(prev);
        if (next.has(node.data.id)) {
          next.delete(node.data.id);
        } else {
          next.add(node.data.id);
        }
        return next;
      });
      _lastClickedId = node.data.id;
      e.stopPropagation();
      e.preventDefault();
    } else {
      // Klik zonder Ctrl/Shift → wis multi-selectie, selecteer enkel element
      _setMultiSelected?.(new Set());
      _lastClickedId = node.data.id;
    }
  }, [node.data.id, isDraggable]);

  return (
    <div
      style={{
        ...style,
        paddingLeft: node.level * 16 + 6,
        display: "flex",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        background: isMultiSelected ? "var(--ide-tree-selected-alpha, #264f78aa)" : isDetailSelected ? "var(--ide-tree-selected, #264f78)" : "transparent",
        borderRadius: 2,
        paddingRight: 4,
        fontSize: 13,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: isHighlighted ? "var(--ide-tree-highlight-color, #fff)" : "var(--ide-panel-color, #ccc)",
      }}
      onClick={handleClick}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) {
          e.preventDefault();
          return;
        }

        // Bepaal welke elementen meegesleept worden
        const dragItems = [];
        if (_multiSelected.size > 0) {
          // Multi-drag: alle geselecteerde + het huidige element
          const allIds = new Set(_multiSelected);
          allIds.add(node.data.id);
          for (const id of allIds) {
            // Haal naam en type op via de tree data (of fallback naar node.data)
            dragItems.push({ elementId: id });
          }
        } else {
          dragItems.push({
            elementId: node.data.id,
            type: node.data.nodeType,
            name: node.data.name,
          });
        }

        e.dataTransfer.setData(
          "application/ide-element",
          JSON.stringify({ elements: dragItems })
        );
        e.dataTransfer.setData("text/plain", dragItems.map((d) => d.name || d.elementId).join(", "));
        e.dataTransfer.effectAllowed = "copy";

        // Drag ghost
        if (dragGhostRef.current) {
          document.body.removeChild(dragGhostRef.current);
          dragGhostRef.current = null;
        }
        const ghost = document.createElement("div");
        ghost.textContent = dragItems.length > 1
          ? `${dragItems.length} elementen`
          : node.data.name;
        ghost.style.cssText = "position:fixed;top:-999px;left:-999px;padding:4px 10px;background:var(--ide-tree-selected, #264f78);color:var(--ide-tree-highlight-color, #fff);border-radius:4px;font-size:12px;white-space:nowrap;pointer-events:none;z-index:99999;";
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        dragGhostRef.current = ghost;
      }}
      onDragEnd={() => {
        if (dragGhostRef.current) {
          document.body.removeChild(dragGhostRef.current);
          dragGhostRef.current = null;
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const event = new CustomEvent("ide-context-menu", {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, nodeData: node.data },
        });
        e.currentTarget.dispatchEvent(event);
      }}
    >
      {isFolder ? (
        <span
          style={{ fontSize: 10, width: 12, textAlign: "center", flexShrink: 0, userSelect: "none" }}
          onClick={(e) => { e.stopPropagation(); node.toggle(); }}
        >
          {node.isOpen ? "▼" : "▶"}
        </span>
      ) : (
        <span style={{ width: 12, flexShrink: 0 }} />
      )}
      <span style={{ flexShrink: 0 }}>{ICONS[node.data.nodeType] || "•"}</span>
      {node.data.kleur && (
        <span style={{
          display: "inline-block", width: 8, height: 8, borderRadius: "50%",
          background: node.data.kleur, flexShrink: 0, border: "1px solid rgba(255,255,255,0.2)",
        }} />
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{node.data.name}</span>
      {isMultiSelected && <span style={{ fontSize: 9, opacity: 0.6, marginLeft: "auto" }}>✓</span>}
    </div>
  );
}

// ─── Hoofdcomponent ─────────────────────────────────────────

export default function ProjectBrowser({ onOpenDiagram, onCreateDiagram }) {
  const elements = useModelStore((s) => s.elements);
  const structuralEdges = useModelStore((s) => s.structuralEdges);
  const diagrams = useModelStore((s) => s.diagrams);
  const domains = useModelStore((s) => s.domains);
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectieVersie = useUIStore((s) => s.selectieVersie);
  const setSelectedElementId = useUIStore((s) => s.setSelectedElementId);
  const treeRef = useRef(null);
  const [zoekterm, setZoekterm] = useState("");
  const [contextMenu, setContextMenu] = useState(null); // { x, y, nodeData }
  const [multiSelected, setMultiSelected] = useState(new Set());

  // Module-scope refs bijwerken zodat TreeNode erbij kan
  _multiSelected = multiSelected;
  _setMultiSelected = setMultiSelected;

  const treeData = useMemo(
    () => buildTree(elements, structuralEdges, diagrams, domains),
    [elements, structuralEdges, diagrams, domains]
  );

  // Bouw platte lijst van draggable node-ids voor shift-range selectie
  useMemo(() => {
    const NON_DRAGGABLE = new Set(["domain", "diagrams", "diagram"]);
    const ids = [];
    function walk(nodes) {
      for (const n of nodes) {
        if (!NON_DRAGGABLE.has(n.nodeType)) ids.push(n.id);
        if (n.children) walk(n.children);
      }
    }
    walk(treeData);
    _flatVisibleIds = ids;
  }, [treeData]);

  // ── Sync: diagram-selectie → browser opent parents + scrollt naar node ──────────
  useEffect(() => {
    if (!selectedElementId || !treeRef.current) return;

    const tree = treeRef.current;
    const timer = setTimeout(() => {
      try {
        tree.openParents?.(selectedElementId);
        tree.scrollTo?.(selectedElementId, "smart");
      } catch (err) {
        console.warn("[ProjectBrowser] scroll-to fout:", err);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedElementId, selectieVersie, treeData]);

  // ── Context menu acties ─────────────────────────────────
  const handleContextAction = useCallback(
    (action, nodeData) => {
      switch (action) {
        case "toonInDiagram":
        case "toonDetails":
          setSelectedElementId(nodeData.id);
          break;
        case "hernoem": {
          if (nodeData.nodeType === "diagram" && nodeData.diagramId) {
            const nieuweNaam = window.prompt("Diagram hernoemen:", nodeData.name);
            if (nieuweNaam && nieuweNaam !== nodeData.name) {
              useModelStore.getState().renameDiagram(nodeData.diagramId, nieuweNaam);
            }
          } else {
            const el = useModelStore.getState().elements[nodeData.id];
            if (el) {
              const nieuweNaam = window.prompt("Element hernoemen:", el.naam);
              if (nieuweNaam && nieuweNaam !== el.naam) {
                useModelStore.getState().updateElement(nodeData.id, { naam: nieuweNaam, data: { klassenaam: nieuweNaam } });
              }
            }
          }
          break;
        }
        case "kopieerID":
          navigator.clipboard?.writeText(nodeData.id);
          break;
        case "nieuwDiagram":
          onCreateDiagram?.();
          break;
        case "openDiagram":
          if (nodeData.diagramId) onOpenDiagram?.(nodeData.diagramId, nodeData.name);
          break;
      }
    },
    [setSelectedElementId, onCreateDiagram, onOpenDiagram]
  );

  const handleSelect = useCallback(
    (nodes) => {
      if (nodes.length === 0) return;
      const node = nodes[0];
      const data = node.data;

      // Domein- en diagrammen-map zijn niet selecteerbaar als element
      if (data.nodeType === "domain" || data.nodeType === "diagrams") return;

      // Diagram → open tab
      if (data.nodeType === "diagram" && data.diagramId) {
        onOpenDiagram?.(data.diagramId, data.name);
        return;
      }

      // Element → selecteer in details panel
      setSelectedElementId(data.id);
    },
    [setSelectedElementId, onOpenDiagram]
  );

  const handleActivate = useCallback(
    (node) => {
      // Dubbelklik / Enter op diagram → open tab
      const data = node.data;
      if (data.nodeType === "diagram" && data.diagramId) {
        onOpenDiagram?.(data.diagramId, data.name);
      }
    },
    [onOpenDiagram]
  );

  // Dynamische hoogte: vul de container
  const containerRef = useRef(null);
  const [treeHeight, setTreeHeight] = useState(600);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTreeHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Context menu event listener ─────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      setContextMenu(e.detail);
    };
    el.addEventListener("ide-context-menu", handler);
    return () => el.removeEventListener("ide-context-menu", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Zoekbalk */}
      <div style={{ padding: "4px 6px", borderBottom: "1px solid var(--ide-panel-border, #3a3a3a)", flexShrink: 0 }}>
        <input
          type="text"
          value={zoekterm}
          onChange={(e) => setZoekterm(e.target.value)}
          placeholder="🔍 Zoek element…"
          style={{
            width: "100%",
            background: "var(--ide-tree-search-bg, #2a2a2a)",
            border: "1px solid var(--ide-tree-search-border, #444)",
            borderRadius: 3,
            padding: "3px 6px",
            color: "var(--ide-panel-color, #ccc)",
            fontSize: 12,
            outline: "none",
          }}
        />
      </div>
      {/* Boom */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <Tree
          ref={treeRef}
          data={treeData}
          idAccessor={(d) => String(d.id)}
          openByDefault={false}
          width="100%"
          height={treeHeight - 32}
          indent={16}
          rowHeight={26}
          searchTerm={zoekterm}
          searchMatch={(node, term) => {
            const name = (node.data.name || "").toLowerCase();
            return name.includes(term.toLowerCase());
          }}
          onSelect={handleSelect}
          onActivate={handleActivate}
          disableDrag
          disableDrop
        >
          {TreeNode}
        </Tree>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <BrowserContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeData={contextMenu.nodeData}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}
    </div>
  );
}
