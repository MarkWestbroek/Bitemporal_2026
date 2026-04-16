/**
 * DiagramCanvas — Wrapper rond React Flow die nodes/edges uit de Zustand store leest.
 *
 * Ontvangt een diagramId en rendert de corresponderende nodes + edges.
 * Elementen worden opgehaald uit de model store (flat Record).
 * Posities komen uit het diagram.
 *
 * Hergebruikt de bestaande node-types en edge-types uit de editor subtree.
 */
import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@editor/styles/editor.css";
import "./ide-diagram.css";

// Bestaande node/edge types uit de editor subtree
import EntiteitNode from "@editor/components/nodes/EntiteitNode";
import GegevensElementNode from "@editor/components/nodes/GegevensElementNode";
import RelatieNode from "@editor/components/nodes/RelatieNode";
import EnumeratieNode from "@editor/components/nodes/EnumeratieNode";
import DatatypeNode from "@editor/components/nodes/DatatypeNode";
import ReferentielijstInstantieNode from "@editor/components/nodes/ReferentielijstInstantieNode";
import AssociatieAnkerNode from "@editor/components/nodes/AssociatieAnkerNode";
import MetamodelEdge from "@editor/components/edges/MetamodelEdge";

import useModelStore from "../store/useModelStore";
import useUIStore from "../store/useUIStore";
import { maakRelatieTussenEntiteiten, voegNieuwRepToe } from "./repCreation";
import { generateId, EDGE_MODES } from "@editor/metamodel/types";

const nodeTypes = {
  entiteit: EntiteitNode,
  gegevenselement: GegevensElementNode,
  relatie: RelatieNode,
  associatieAnker: AssociatieAnkerNode,
  enumeratie: EnumeratieNode,
  gegevenstype: DatatypeNode,
  referentielijstInstantie: ReferentielijstInstantieNode,
};

const edgeTypes = {
  metamodel: MetamodelEdge,
};

// ── Module-level clipboard voor kopiëren/plakken tussen diagrammen ──
// (Module-level zodat clipboard bewaard blijft bij wisselen van diagram-tab)
let diagramClipboard = null; // { nodes: [{elementId, dx, dy}], edges: [...], originDiagramId }

/**
 * Bouw React Flow nodes vanuit diagram-refs + element data.
 */
function buildFlowNodes(diagram, elements) {
  if (!diagram?.nodes) return [];
  return diagram.nodes
    .map((ref) => {
      const el = elements[ref.elementId];
      if (!el) return null;
      return {
        id: ref.elementId,
        type: el.type,
        position: ref.position || { x: 0, y: 0 },
        data: { ...el.data, id: ref.elementId },
      };
    })
    .filter(Boolean);
}

function buildFlowEdges(diagram) {
  return (diagram?.edges || []).map((e) => ({
    ...e,
    type: e.type || "metamodel",
    hidden: e.hidden || false, // useEdges hidden flag doorvoeren naar React Flow
    selectable: false, // Voorkom dat edges mee-geselecteerd worden bij multi-select
    selected: false,
  }));
}

function clampContextMenuPosition(x, y, width = 220, height = 360) {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
  };
}

/**
 * Ontdek alle edges die horen bij een set nodes op een diagram.
 *
 * Scant twee bronnen:
 * 1) structuralEdges (model-level: ENT→GE, ENT→REL compositie-edges)
 * 2) diagram.edges van ALLE diagrammen (diagram-level: doelEdges, use-edges,
 *    anker-edges, ASOC-links — alles wat niet in structuralEdges zit)
 *
 * Retourneert alleen edges waar beide endpoints in `nodeIdSet` zitten
 * en die nog niet in `excludePairs` voorkomen.
 *
 * @param {Object} store - useModelStore.getState()
 * @param {Object} elements - elements record
 * @param {Set<string>} nodeIdSet - alle node-ids op het doeldiagram (existing + nieuw)
 * @param {Set<string>} excludePairs - "source→target" paren die al bestaan
 * @returns {Array<Object>} nieuwe diagram-edges
 */
function discoverEdgesForNodes(store, elements, nodeIdSet, excludePairs) {
  const found = [];
  const addedPairs = new Set(excludePairs);

  const tryAdd = (edge) => {
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) return;
    const pair = `${edge.source}→${edge.target}`;
    if (addedPairs.has(pair)) return;
    addedPairs.add(pair);
    found.push(edge);
  };

  // 1) Structural edges
  let seChecked = 0, seMatched = 0;
  for (const se of store.structuralEdges) {
    seChecked++;
    if (!nodeIdSet.has(se.source) || !nodeIdSet.has(se.target)) continue;
    seMatched++;
    const sourceType = elements[se.source]?.type;
    const targetType = elements[se.target]?.type;
    const targetEl = elements[se.target];
    const isDependency = se.data?.isDependency ||
      ((sourceType === "entiteit" || sourceType === "gegevenselement" || sourceType === "relatie") &&
        (targetType === "enumeratie" || targetType === "gegevenstype")) ||
      (sourceType === "referentielijstInstantie" && targetType === "relatie");

    const edgeData = se.data || (isDependency
      ? { isDependency: true, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" }
      : {
          rolnaam: targetEl?.naam || "",
          jsonRolnaam: targetEl?.data?.meervoud || (targetEl?.naam || "").toLowerCase(),
          momentvoorkomen: targetType === "relatie" ? "meervoudig" : "enkelvoudig",
          kardinaliteit: targetType === "relatie" ? "0..*" : "0..1",
        });

    tryAdd({
      id: se.id || `${se.source}-${se.target}`,
      source: se.source,
      target: se.target,
      sourceHandle: se.sourceHandle || null,
      targetHandle: se.targetHandle || null,
      type: "metamodel",
      data: edgeData,
    });
  }

  // 2) Diagram-edges van alle diagrammen (vangt ASOC, doelEdges, use-edges, etc.)
  let diagEdgesChecked = 0;
  for (const diagKey of Object.keys(store.diagrams)) {
    const d = store.diagrams[diagKey];
    for (const de of d.edges || []) {
      diagEdgesChecked++;
      tryAdd({
        id: de.id,
        source: de.source,
        target: de.target,
        sourceHandle: de.sourceHandle || null,
        targetHandle: de.targetHandle || null,
        type: de.type || "metamodel",
        data: de.data || {},
        hidden: de.hidden || false,
      });
    }
  }

  return found;
}

// ─── Alignment icons als kleine inline SVG's (16×16) ────────
const S = 16; // icon size
const AlignIcon = ({ children, ...props }) => (
  <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>{children}</svg>
);
const ALIGN_BUTTONS = [
  { mode: "left",   title: "Links uitlijnen",           icon: <AlignIcon><line x1="2" y1="1" x2="2" y2="15"/><rect x="2" y="3" width="8" height="3" fill="currentColor" stroke="none"/><rect x="2" y="9" width="11" height="3" fill="currentColor" stroke="none"/></AlignIcon> },
  { mode: "center-h", title: "Centreer horizontaal",    icon: <AlignIcon><line x1="8" y1="1" x2="8" y2="15"/><rect x="3" y="3" width="10" height="3" fill="currentColor" stroke="none"/><rect x="5" y="9" width="6" height="3" fill="currentColor" stroke="none"/></AlignIcon> },
  { mode: "right",  title: "Rechts uitlijnen",          icon: <AlignIcon><line x1="14" y1="1" x2="14" y2="15"/><rect x="6" y="3" width="8" height="3" fill="currentColor" stroke="none"/><rect x="3" y="9" width="11" height="3" fill="currentColor" stroke="none"/></AlignIcon> },
  "sep",
  { mode: "top",    title: "Boven uitlijnen",           icon: <AlignIcon><line x1="1" y1="2" x2="15" y2="2"/><rect x="3" y="2" width="3" height="8" fill="currentColor" stroke="none"/><rect x="9" y="2" width="3" height="11" fill="currentColor" stroke="none"/></AlignIcon> },
  { mode: "center-v", title: "Centreer verticaal",      icon: <AlignIcon><line x1="1" y1="8" x2="15" y2="8"/><rect x="3" y="3" width="3" height="10" fill="currentColor" stroke="none"/><rect x="9" y="5" width="3" height="6" fill="currentColor" stroke="none"/></AlignIcon> },
  { mode: "bottom", title: "Onder uitlijnen",           icon: <AlignIcon><line x1="1" y1="14" x2="15" y2="14"/><rect x="3" y="6" width="3" height="8" fill="currentColor" stroke="none"/><rect x="9" y="3" width="3" height="11" fill="currentColor" stroke="none"/></AlignIcon> },
  "sep",
  { mode: "distribute-h", title: "Verdeel horizontaal", icon: <AlignIcon><line x1="1" y1="1" x2="1" y2="15"/><line x1="15" y1="1" x2="15" y2="15"/><rect x="4" y="4" width="3" height="8" fill="currentColor" stroke="none"/><rect x="9" y="4" width="3" height="8" fill="currentColor" stroke="none"/></AlignIcon> },
  { mode: "distribute-v", title: "Verdeel verticaal",   icon: <AlignIcon><line x1="1" y1="1" x2="15" y2="1"/><line x1="1" y1="15" x2="15" y2="15"/><rect x="4" y="4" width="8" height="3" fill="currentColor" stroke="none"/><rect x="4" y="9" width="8" height="3" fill="currentColor" stroke="none"/></AlignIcon> },
];

const CREATE_BUTTONS = [
  { kind: "entiteit", label: "ENT", title: "Nieuwe entiteit" },
  { kind: "gegevenselement", label: "GE", title: "Nieuw gegevenselement" },
  { kind: "relatie", label: "REL", title: "Nieuwe relatie" },
  { kind: "enumeratie", label: "ENUM", title: "Nieuwe enumeratie" },
  { kind: "gegevenstype", label: "TYPE", title: "Nieuw gegevenstype" },
  { kind: "referentielijst", label: "REFSET", title: "Nieuwe referentielijst-set" },
  { kind: "referentielijstInstantie", label: "REF", title: "Nieuwe referentielijst-instantie" },
];

function AlignToolbar({ alignNodes, onNormaliseer, onSnapGrid, embedded = false, isVertical = false }) {
  return (
    <div
      className="ide-align-toolbar"
      style={embedded ? { position: "static", top: "auto", left: "auto", transform: "none", boxShadow: "none", border: "none", background: "transparent", padding: 0, flexDirection: isVertical ? "column" : "row" } : undefined}
    >
      {ALIGN_BUTTONS.map((btn, i) =>
        btn === "sep" ? (
          <span key={i} className="ide-align-sep" style={isVertical ? { width: "100%", height: 1, margin: "2px 0" } : undefined} />
        ) : (
          <button key={btn.mode} title={btn.title} onClick={() => alignNodes(btn.mode)}>
            {btn.icon}
          </button>
        )
      )}
      {(onNormaliseer || onSnapGrid) && <span className="ide-align-sep" />}
      {onNormaliseer && (
        <button title="Normaliseer alle relaties" onClick={onNormaliseer}>
          ↔
        </button>
      )}
      {onSnapGrid && (
        <button title="Snap alle nodes naar het grid" onClick={onSnapGrid}>
          ⊞
        </button>
      )}
    </div>
  );
}

const FLOATING_TOOLBAR_STORAGE_KEY = "ide-floating-toolbar-layouts";
const DEFAULT_TOOLBAR_LAYOUTS = {
  create: { x: 12, y: 12, orientation: "horizontal" },
  layout: { x: 12, y: 82, orientation: "horizontal" },
  verbinding: { x: 12, y: 152, orientation: "horizontal" },
};

function leesToolbarLayouts() {
  if (typeof window === "undefined") return DEFAULT_TOOLBAR_LAYOUTS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FLOATING_TOOLBAR_STORAGE_KEY) || "null");
    return {
      create: { ...DEFAULT_TOOLBAR_LAYOUTS.create, ...(parsed?.create || {}) },
      layout: { ...DEFAULT_TOOLBAR_LAYOUTS.layout, ...(parsed?.layout || {}) },
      verbinding: { ...DEFAULT_TOOLBAR_LAYOUTS.verbinding, ...(parsed?.verbinding || {}) },
    };
  } catch {
    return DEFAULT_TOOLBAR_LAYOUTS;
  }
}

function bewaarToolbarLayouts(layouts) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // localStorage niet beschikbaar is niet fataal.
  }
}

function snapToolbarLayout(layout, containerRect, toolbarRect) {
  if (!containerRect || !toolbarRect) return layout;
  const leftThreshold = 42;
  const edgePadding = 8;
  const topThreshold = 42;
  const rightDistance = containerRect.width - (layout.x + toolbarRect.width);
  const bottomDistance = containerRect.height - (layout.y + toolbarRect.height);

  if (layout.x <= leftThreshold) {
    return { ...layout, x: edgePadding, orientation: "vertical" };
  }
  if (rightDistance <= leftThreshold) {
    return {
      ...layout,
      x: Math.max(edgePadding, containerRect.width - toolbarRect.width - edgePadding),
      orientation: "vertical",
    };
  }
  if (layout.y <= topThreshold) {
    return { ...layout, y: edgePadding, orientation: "horizontal" };
  }
  if (bottomDistance <= topThreshold) {
    return {
      ...layout,
      y: Math.max(edgePadding, containerRect.height - toolbarRect.height - edgePadding),
      orientation: "horizontal",
    };
  }
  return layout;
}

function FloatingToolbar({ title, layout, onLayoutChange, children }) {
  const rootRef = useRef(null);
  const dragStateRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const state = dragStateRef.current;
      if (!state) return;
      const rect = state.containerRect;
      const toolbarRect = rootRef.current?.getBoundingClientRect();
      const width = toolbarRect?.width || 220;
      const height = toolbarRect?.height || 48;
      const nextX = Math.min(
        Math.max(8, event.clientX - rect.left - state.offsetX),
        Math.max(8, rect.width - width - 8)
      );
      const nextY = Math.min(
        Math.max(8, event.clientY - rect.top - state.offsetY),
        Math.max(8, rect.height - height - 8)
      );
      onLayoutChange({ ...layout, x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      const state = dragStateRef.current;
      if (!state) return;
      dragStateRef.current = null;
      const toolbarRect = rootRef.current?.getBoundingClientRect();
      onLayoutChange(snapToolbarLayout(layout, state.containerRect, toolbarRect));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [layout, onLayoutChange]);

  const handleDragStart = useCallback((event) => {
    if (event.button !== 0) return;
    const canvas = rootRef.current?.closest(".ide-canvas");
    const containerRect = canvas?.getBoundingClientRect();
    if (!containerRect) return;
    dragStateRef.current = {
      containerRect,
      offsetX: event.clientX - containerRect.left - (layout.x || 0),
      offsetY: event.clientY - containerRect.top - (layout.y || 0),
    };
    event.preventDefault();
    event.stopPropagation();
  }, [layout]);

  const isVertical = layout?.orientation === "vertical";

  return (
    <div
      ref={rootRef}
      style={{
        position: "absolute",
        left: layout?.x ?? 12,
        top: layout?.y ?? 12,
        zIndex: 12,
        display: "flex",
        flexDirection: "column",
        gap: 0,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--ide-toolbar-border)",
        background: "var(--ide-toolbar-bg)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
        maxWidth: isVertical ? 90 : "min(720px, calc(100% - 16px))",
      }}
    >
      <div
        onMouseDown={handleDragStart}
        style={{
          cursor: "grab",
          userSelect: "none",
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.2,
          color: "var(--ide-toolbar-color)",
          borderBottom: "1px solid var(--ide-toolbar-border)",
          background: "rgba(15, 23, 42, 0.18)",
        }}
        title="Sleep de toolbar naar een rand om hem verticaal of horizontaal te laten snappen"
      >
        ⋮⋮ {title}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          alignItems: isVertical ? "stretch" : "center",
          gap: 4,
          flexWrap: isVertical ? "nowrap" : "wrap",
          padding: 6,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Kortste-handle berekening (dubbelklik op edge) ─────────

const HANDLE_POSITIES = ["top", "right", "bottom", "left"];

function berekenKortsteHandles(srcNode, tgtNode) {
  const srcW = srcNode.measured?.width ?? srcNode.width ?? 180;
  const srcH = srcNode.measured?.height ?? srcNode.height ?? 120;
  const tgtW = tgtNode.measured?.width ?? tgtNode.width ?? 180;
  const tgtH = tgtNode.measured?.height ?? tgtNode.height ?? 120;

  function ankerpunt(node, w, h, handle) {
    const x = node.position.x;
    const y = node.position.y;
    switch (handle) {
      case "top":    return { x: x + w / 2, y };
      case "bottom": return { x: x + w / 2, y: y + h };
      case "left":   return { x,             y: y + h / 2 };
      case "right":  return { x: x + w,     y: y + h / 2 };
    }
  }

  let best = { sourceHandle: "source-bottom", targetHandle: "target-top", dist: Infinity };
  for (const sh of HANDLE_POSITIES) {
    for (const th of HANDLE_POSITIES) {
      const a = ankerpunt(srcNode, srcW, srcH, sh);
      const b = ankerpunt(tgtNode, tgtW, tgtH, th);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < best.dist) {
        best = { sourceHandle: `source-${sh}`, targetHandle: `target-${th}`, dist: d };
      }
    }
  }
  return best;
}

// ─── Inner canvas (moet binnen ReactFlowProvider) ───────────

function DiagramCanvasInner({ diagramId }) {
  const diagram = useModelStore((s) => s.diagrams[diagramId]);
  const elements = useModelStore((s) => s.elements);
  const updateDiagramNodes = useModelStore((s) => s.updateDiagramNodes);
  const updateDiagramEdges = useModelStore((s) => s.updateDiagramEdges);
  const updateDiagramViewport = useModelStore((s) => s.updateDiagramViewport);
  const addStructuralEdge = useModelStore((s) => s.addStructuralEdge);
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectedEdgeId = useUIStore((s) => s.selectedEdgeId);
  const setSelectedElementId = useUIStore((s) => s.setSelectedElementId);
  const setSelectedEdgeId = useUIStore((s) => s.setSelectedEdgeId);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const setActiveDiagramId = useUIStore((s) => s.setActiveDiagramId);
  const theme = useUIStore((s) => s.theme);
  const { setCenter, getNode, getZoom, getViewport, screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const reactFlowWrapper = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [toolbarLayouts, setToolbarLayouts] = useState(() => leesToolbarLayouts());
  const [activeEdgeMode, setActiveEdgeMode] = useState(EDGE_MODES.NONE);

  // Escape-toets: reset edge-mode naar NONE.
  useEffect(() => {
    function handleEscapeKey(event) {
      if (event.key === "Escape" && activeEdgeMode !== EDGE_MODES.NONE) {
        setActiveEdgeMode(EDGE_MODES.NONE);
      }
    }
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [activeEdgeMode]);

  const initialNodes = useMemo(
    () => buildFlowNodes(diagram, elements),
    [diagram, elements]
  );
  const initialEdges = useMemo(() => buildFlowEdges(diagram), [diagram]);
  const elementTypeById = useMemo(
    () => new Map(Object.values(elements).map((el) => [el.id, el.type])),
    [elements]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const updateToolbarLayout = useCallback((toolbarId, nextLayout) => {
    setToolbarLayouts((prev) => {
      const next = {
        ...prev,
        [toolbarId]: {
          ...(prev?.[toolbarId] || DEFAULT_TOOLBAR_LAYOUTS[toolbarId] || {}),
          ...nextLayout,
        },
      };
      bewaarToolbarLayouts(next);
      return next;
    });
  }, []);

  // Track of de selectie van dit diagram komt (voorkomt oneindige loop)
  const localSelectionRef = useRef(false);
  // Ref met actuele node-IDs zodat we nodes NIET in de useEffect dependency hoeven
  const nodeIdsRef = useRef(new Set());
  useEffect(() => {
    nodeIdsRef.current = new Set(nodes.map((n) => n.id));
  }, [nodes]);

  // ── Sync: element-data uit store → diagram nodes (naam, kleur, etc.) ──
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const el = elements[n.id];
        if (!el) return n;
        const newData = { ...el.data, id: n.id };
        // Snelle check: skip als data niet veranderd is (vergelijk naam, kleur, velden)
        if (
          n.data?.klassenaam === newData.klassenaam &&
          n.data?.kleur === newData.kleur &&
          n.data?.description === newData.description &&
          n.data?.velden === newData.velden
        ) {
          return n;
        }
        return { ...n, data: newData };
      })
    );
  }, [elements, setNodes]);

  // ── ASOC forward/reverse conversie bij velden-wijziging op relatie-elementen ──
  const prevRelatieVeldenRef = useRef({});
  useEffect(() => {
    if (!diagram) return;
    const diagNodeIds = new Set((diagram.nodes || []).map((n) => n.elementId));
    const prevVelden = prevRelatieVeldenRef.current;
    const nextVelden = {};
    const forwardIds = [];
    const reverseIds = [];

    for (const [id, el] of Object.entries(elements)) {
      if (el.type !== "relatie" || !diagNodeIds.has(id)) continue;
      const vCount = (el.data?.velden || []).length;
      nextVelden[id] = vCount;
      const prevCount = prevVelden[id] ?? 0;
      if (prevCount === 0 && vCount > 0) forwardIds.push(id);
      if (prevCount > 0 && vCount === 0) reverseIds.push(id);
    }
    prevRelatieVeldenRef.current = nextVelden;

    // ── Forward: velden toegevoegd → converteer naar ASOC (batch alle relaties) ──
    if (forwardIds.length > 0) {
      let currentEdges = [...(diagram.edges || [])];
      let currentNodes = [...(diagram.nodes || [])];
      const store = useModelStore.getState();
      let changed = false;

      for (const fwdId of forwardIds) {
        const relatieEl = elements[fwdId];
        const relatieNaam = relatieEl?.data?.typenaam || fwdId;
        const ankerId = `anker_${fwdId}`;
        // Check of er al een anker bestaat
        if (currentNodes.some((n) => n.elementId === ankerId)) continue;

        // Zoek owner-edge (ENT → relatie) en target-edge (relatie → ENT)
        const ownerEdge = currentEdges.find((e) => {
          if (e.target !== fwdId) return false;
          if (e.data?.isDependency) return false;
          const t = elementTypeById.get(e.source);
          return t === "entiteit" || t === "referentielijstInstantie";
        });
        const targetEdge = currentEdges.find((e) => {
          if (e.source !== fwdId) return false;
          if (e.data?.isDependency) return false;
          const t = elementTypeById.get(e.target);
          return t === "entiteit";
        });

        if (!ownerEdge || !targetEdge) continue;

        const bronNodeRef = currentNodes.find((n) => n.elementId === ownerEdge.source);
        const doelNodeRef = currentNodes.find((n) => n.elementId === targetEdge.target);
        const bronPos = bronNodeRef?.position || { x: 0, y: 0 };
        const doelPos = doelNodeRef?.position || { x: 400, y: 0 };
        const ankerPos = {
          x: (bronPos.x + doelPos.x) / 2 + 80,
          y: (bronPos.y + doelPos.y) / 2,
        };
        const relatiePos = { x: ankerPos.x - 40, y: ankerPos.y + 60 };

        // Maak anker-element in de store (type=associatieAnker, visueel-only)
        if (!store.elements[ankerId]) {
          store.addElement({
            id: ankerId,
            naam: relatieNaam,
            type: "associatieAnker",
            domein: relatieEl?.domein || "",
            data: { relatieNaam },
          });
        }

        const directioneel = relatieEl?.data?.directioneel || false;
        const ownerTargetEdgeIds = new Set([ownerEdge.id, targetEdge.id]);
        currentEdges = currentEdges.filter((e) => !ownerTargetEdgeIds.has(e.id));
        currentEdges.push(
          {
            id: generateId("edge"),
            source: ownerEdge.source,
            target: ankerId,
            type: "metamodel",
            sourceHandle: ownerEdge.sourceHandle || null,
            targetHandle: "target-left",
            data: { isAssociation: true, directioneel, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
          },
          {
            id: generateId("edge"),
            source: ankerId,
            target: targetEdge.target,
            type: "metamodel",
            sourceHandle: "source-right",
            targetHandle: targetEdge.targetHandle || null,
            data: { isAssociation: true, directioneel, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
          },
          {
            id: generateId("edge"),
            source: ankerId,
            target: fwdId,
            type: "metamodel",
            sourceHandle: "source-bottom",
            targetHandle: "target-top",
            data: { isAssociationClassLink: true, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
          },
        );

        // Verplaats relatie-node en voeg anker-node toe
        currentNodes = currentNodes.map((n) =>
          n.elementId === fwdId ? { ...n, position: relatiePos } : n
        );
        currentNodes.push({ elementId: ankerId, position: ankerPos });
        changed = true;
      }

      if (changed) {
        updateDiagramNodes(diagramId, currentNodes);
        updateDiagramEdges(diagramId, currentEdges);
      }
    }

    // ── Reverse: laatste veld verwijderd → terug naar collapsed (batch) ──
    if (reverseIds.length > 0) {
      let currentEdges = [...(diagram.edges || [])];
      let currentNodes = [...(diagram.nodes || [])];
      const store = useModelStore.getState();
      let changed = false;

      for (const revId of reverseIds) {
        const ankerId = `anker_${revId}`;
        const ankerNodeRef = currentNodes.find((n) => n.elementId === ankerId);
        if (!ankerNodeRef) continue;

        const edge1 = currentEdges.find((e) => e.data?.isAssociation && e.target === ankerId);
        const edge2 = currentEdges.find((e) => e.data?.isAssociation && e.source === ankerId);
        const classLink = currentEdges.find((e) => e.data?.isAssociationClassLink &&
          (e.source === ankerId || e.target === ankerId));
        const asocEdgeIds = new Set([edge1?.id, edge2?.id, classLink?.id].filter(Boolean));
        currentEdges = currentEdges.filter((e) => !asocEdgeIds.has(e.id));

        const directioneelFlag = elements[revId]?.data?.directioneel || false;
        if (edge1) {
          currentEdges.push({
            id: generateId("edge"),
            source: edge1.source,
            target: revId,
            type: "metamodel",
            sourceHandle: edge1.sourceHandle,
            targetHandle: "target-left",
            data: { rolnaam: "", jsonRolnaam: "", momentvoorkomen: "enkelvoudig", kardinaliteit: edge1.data?.kardinaliteit || "0..1" },
          });
        }
        if (edge2) {
          currentEdges.push({
            id: generateId("edge"),
            source: revId,
            target: edge2.target,
            type: "metamodel",
            sourceHandle: "source-right",
            targetHandle: edge2.targetHandle,
            data: {
              rolnaam: "", jsonRolnaam: "",
              momentvoorkomen: "enkelvoudig",
              kardinaliteit: edge2.data?.kardinaliteit || "0..*",
              ...(directioneelFlag ? { directioneel: true } : {}),
            },
          });
        }

        // Verplaats relatie naar ankerpositie, verwijder anker uit diagram
        currentNodes = currentNodes
          .filter((n) => n.elementId !== ankerId)
          .map((n) => n.elementId === revId ? { ...n, position: ankerNodeRef.position } : n);

        // Verwijder anker-element uit model store
        if (store.elements[ankerId]) {
          store.deleteElement(ankerId);
        }
        changed = true;
      }

      if (changed) {
        updateDiagramNodes(diagramId, currentNodes);
        updateDiagramEdges(diagramId, currentEdges);
      }
    }
  }, [elements, diagram, diagramId, elementTypeById, updateDiagramNodes, updateDiagramEdges]);

  // ── Sync: diagram store → React Flow (posities, nodes, edges) voor undo/redo ──
  const diagramNodesRef = useRef(diagram?.nodes);
  const diagramEdgesRef = useRef(diagram?.edges);
  useEffect(() => {
    const storeNodes = diagram?.nodes || [];
    const storeEdges = diagram?.edges || [];
    const prevNodes = diagramNodesRef.current || [];
    const prevEdges = diagramEdgesRef.current || [];
    diagramNodesRef.current = storeNodes;
    diagramEdgesRef.current = storeEdges;

    // Vergelijk store-nodes met vorige snapshot (niet met RF-state, voorkomt loop)
    if (storeNodes !== prevNodes) {
      setNodes((currentRFNodes) => {
        // Snelle check: zelfde lengte en zelfde posities?
        if (currentRFNodes.length === storeNodes.length) {
          const positionMap = new Map(storeNodes.map((sn) => [sn.elementId, sn.position]));
          const allMatch = currentRFNodes.every((n) => {
            const sp = positionMap.get(n.id);
            return sp && n.position.x === sp.x && n.position.y === sp.y;
          });
          if (allMatch) return currentRFNodes;
        }
        // Rebuild vanuit store
        return buildFlowNodes(diagram, elements);
      });
    }

    if (storeEdges !== prevEdges) {
      setEdges(buildFlowEdges(diagram));
    }
  }, [diagram, elements, setNodes, setEdges]);

  // ── Sync: browser-selectie → diagram highlight + center ──
  useEffect(() => {
    if (!selectedElementId || localSelectionRef.current) {
      localSelectionRef.current = false;
      return;
    }
    // Check via ref (geen dependency op nodes, voorkomt oneindige loop)
    if (!nodeIdsRef.current.has(selectedElementId)) return;

    // Markeer node als selected (defensief: in try/catch zodat het panel nooit crasht)
    try {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: n.id === selectedElementId,
        }))
      );
    } catch (err) {
      console.warn("[DiagramCanvas] setNodes fout:", err);
    }

    // Pan naar node, alleen als deze buiten het zichtbare viewport valt
    const raf = requestAnimationFrame(() => {
      try {
        const node = getNode(selectedElementId);
        if (!node) return;
        const wrapper = reactFlowWrapper.current;
        if (!wrapper) return;

        const zoom = getZoom();
        const vp = getViewport();
        // Guard: als ReactFlow nog niet geïnitialiseerd is, zijn zoom/vp NaN
        if (!zoom || !isFinite(zoom) || !isFinite(vp?.x) || !isFinite(vp?.y)) return;
        if (!isFinite(node.position?.x) || !isFinite(node.position?.y)) return;

        const rect = wrapper.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        // Node positie in screen-pixels
        const nx = node.position.x * zoom + vp.x;
        const ny = node.position.y * zoom + vp.y;
        const nw = (node.measured?.width ?? 200) * zoom;
        const nh = (node.measured?.height ?? 100) * zoom;

        // Marge: 30px van de rand = al "buiten beeld"
        const margin = 30;
        const isVisible =
          nx + nw > margin &&
          nx < rect.width - margin &&
          ny + nh > margin &&
          ny < rect.height - margin;

        if (!isVisible) {
          const cx = node.position.x + (node.measured?.width ?? 200) / 2;
          const cy = node.position.y + (node.measured?.height ?? 100) / 2;
          if (isFinite(cx) && isFinite(cy)) {
            setCenter(cx, cy, { zoom, duration: 300 });
          }
        }
      } catch (err) {
        console.warn("[DiagramCanvas] setCenter fout:", err);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedElementId, setNodes, setCenter, getNode, getZoom, getViewport]);

  // ── Sync: edge-selectie → zichtbare highlight op edge ──
  useEffect(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, selected: e.id === selectedEdgeId })));
    if (selectedEdgeId) {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    }
  }, [selectedEdgeId, setEdges, setNodes]);

  // Markeer dit diagram als actief bij interactie
  const handlePaneClick = useCallback(() => {
    setActiveDiagramId(diagramId);
    clearSelection();
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    setContextMenu(null);
  }, [diagramId, setActiveDiagramId, clearSelection, setEdges]);

  const handleNodeClick = useCallback(
    (_event, node) => {
      localSelectionRef.current = true;
      setActiveDiagramId(diagramId);
      setSelectedElementId(node.id);
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      setContextMenu(null);
    },
    [diagramId, setActiveDiagramId, setSelectedElementId, setEdges]
  );

  const handleEdgeClick = useCallback(
    (_event, edge) => {
      setActiveDiagramId(diagramId);
      setSelectedEdgeId(edge.id);
      setEdges((eds) => eds.map((e) => ({ ...e, selected: e.id === edge.id })));
      setContextMenu(null);
    },
    [diagramId, setActiveDiagramId, setSelectedEdgeId, setEdges]
  );

  // ── Dubbelklik op edge: bereken kortste handle-combinatie ──
  const handleEdgeDoubleClick = useCallback(
    (_event, edge) => {
      const srcNode = getNode(edge.source);
      const tgtNode = getNode(edge.target);
      if (!srcNode || !tgtNode) return;
      const { sourceHandle, targetHandle } = berekenKortsteHandles(srcNode, tgtNode);
      // Update edge in React Flow local state
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edge.id ? { ...e, sourceHandle, targetHandle } : e
        )
      );
      // Persist naar diagram store
      if (diagram) {
        const updatedEdges = (diagram.edges || []).map((e) =>
          e.id === edge.id ? { ...e, sourceHandle, targetHandle } : e
        );
        updateDiagramEdges(diagramId, updatedEdges);
      }
      // Update structurele edge indien aanwezig (top-level velden)
      const store = useModelStore.getState();
      const seIdx = store.structuralEdges.findIndex((e) => e.id === edge.id);
      if (seIdx >= 0) {
        const updated = store.structuralEdges.map((e) =>
          e.id === edge.id ? { ...e, sourceHandle, targetHandle } : e
        );
        useModelStore.setState({ structuralEdges: updated, isDirty: true });
      }
    },
    [diagram, diagramId, getNode, setEdges, updateDiagramEdges]
  );

  // ── Context menu op node/edge (rechtermuisklik) ───────────
  const [contextMenu, setContextMenu] = useState(null); // { x, y, nodeId?, edgeId? }
  const removeElementFromDiagram = useModelStore((s) => s.removeElementFromDiagram);

  const handleNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      event.stopPropagation();
      localSelectionRef.current = true;
      setActiveDiagramId(diagramId);
      setSelectedElementId(node.id);
      const pos = clampContextMenuPosition(event.clientX, event.clientY);
      setContextMenu({ x: pos.x, y: pos.y, nodeId: node.id });
    },
    [diagramId, setActiveDiagramId, setSelectedElementId]
  );

  const handleRemoveFromDiagram = useCallback(() => {
    if (!contextMenu?.nodeId) return;
    removeElementFromDiagram(diagramId, contextMenu.nodeId);
    setNodes((nds) => nds.filter((n) => n.id !== contextMenu.nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== contextMenu.nodeId && e.target !== contextMenu.nodeId));
    setContextMenu(null);
  }, [contextMenu, diagramId, removeElementFromDiagram, setNodes, setEdges]);

  const handleRemoveEdgeFromDiagram = useCallback(() => {
    if (!contextMenu?.edgeId) return;
    const edgeId = contextMenu.edgeId;
    // Verwijder edge uit diagram store
    const updateDE = useModelStore.getState().updateDiagramEdges;
    if (diagram) {
      updateDE(diagramId, diagram.edges.filter((e) => e.id !== edgeId));
    }
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setContextMenu(null);
  }, [contextMenu, diagramId, diagram, setEdges]);

  // Toggle hidden flag op een dependency edge (verberg/toon «use» lijn)
  const handleToggleEdgeHidden = useCallback(() => {
    if (!contextMenu?.edgeId) return;
    const edgeId = contextMenu.edgeId;
    const updateDE = useModelStore.getState().updateDiagramEdges;
    if (diagram) {
      updateDE(
        diagramId,
        diagram.edges.map((e) =>
          e.id === edgeId ? { ...e, hidden: !e.hidden } : e
        )
      );
    }
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId ? { ...e, hidden: !e.hidden } : e
      )
    );
    setContextMenu(null);
  }, [contextMenu, diagramId, diagram, setEdges]);

  const handleSelectEdgeEndpoint = useCallback(
    (elementId) => {
      if (elementId && elements[elementId]) {
        setSelectedElementId(elementId);
      }
      setContextMenu(null);
    },
    [elements, setSelectedElementId]
  );

  // ── Kopiëren/plakken van visuele elementen tussen diagrammen ──────

  /**
   * Kopieer geselecteerde nodes (+ onderlinge edges) naar het module-level clipboard.
   * Als singleNodeId is meegegeven en er geen geselecteerde nodes zijn,
   * kopieer dan alleen die ene node (handig bij rechtermuisklik op een node).
   */
  const handleCopySelection = useCallback(
    (singleNodeId = null) => {
      let selected = getNodes().filter((n) => n.selected);
      // Fallback: rechtermuisklik op een niet-geselecteerde node
      if (selected.length === 0 && singleNodeId) {
        const node = getNodes().find((n) => n.id === singleNodeId);
        if (node) selected = [node];
      }
      if (selected.length === 0) return;

      // Bereken center van selectie als referentiepunt voor relatieve posities
      const cx = selected.reduce((s, n) => s + n.position.x, 0) / selected.length;
      const cy = selected.reduce((s, n) => s + n.position.y, 0) / selected.length;

      const selectedIds = new Set(selected.map((n) => n.id));

      // Bewaar ALLE edges die minstens één endpoint in de selectie hebben:
      // - internalEdges: beide endpoints in selectie (altijd plakken)
      // - boundaryEdges: één endpoint in selectie (plakken als de andere kant op het doeldiagram staat)
      const internalEdges = [];
      const boundaryEdges = [];
      for (const e of edges) {
        const srcIn = selectedIds.has(e.source);
        const tgtIn = selectedIds.has(e.target);
        if (!srcIn && !tgtIn) continue;
        const { selected: _sel, ...clean } = e;
        if (srcIn && tgtIn) {
          internalEdges.push(clean);
        } else {
          boundaryEdges.push(clean);
        }
      }

      diagramClipboard = {
        nodes: selected.map((n) => ({
          elementId: n.id,
          dx: n.position.x - cx,
          dy: n.position.y - cy,
        })),
        internalEdges,
        boundaryEdges,
        originDiagramId: diagramId,
      };
    },
    [diagramId, edges, getNodes]
  );

  /**
   * Plak clipboard-inhoud op het huidige diagram.
   * Elementen die al op het diagram staan worden overgeslagen (alleen visuele referenties).
   * Edges worden automatisch aangemaakt op basis van structurele edges + clipboard-edges.
   */
  const handlePasteClipboard = useCallback(() => {
    if (!diagramClipboard || diagramClipboard.nodes.length === 0) return;
    const store = useModelStore.getState();
    const diag = store.diagrams[diagramId];
    if (!diag) return;

    const addElToDiag = store.addElementToDiagram;
    const existingNodeIds = new Set((diag.nodes || []).map((n) => n.elementId));

    // Filter: alleen elementen die nog in het model bestaan en nog niet op dit diagram staan
    const toPaste = diagramClipboard.nodes.filter(
      (n) => elements[n.elementId] && !existingNodeIds.has(n.elementId)
    );
    if (toPaste.length === 0) return;

    // Plak in het midden van de huidige viewport
    const wrapper = reactFlowWrapper.current;
    const centerScreen = wrapper
      ? { x: wrapper.clientWidth / 2, y: wrapper.clientHeight / 2 }
      : { x: 400, y: 300 };
    const pasteCenter = screenToFlowPosition(centerScreen);

    const newNodes = [];
    const pastedIds = new Set();

    for (const item of toPaste) {
      const position = {
        x: pasteCenter.x + item.dx,
        y: pasteCenter.y + item.dy,
      };
      addElToDiag(diagramId, item.elementId, position);
      const el = elements[item.elementId];
      newNodes.push({
        id: item.elementId,
        type: el.type,
        position,
        data: { ...el.data, id: item.elementId },
      });
      pastedIds.add(item.elementId);
    }

    setNodes((nds) => [...nds, ...newNodes]);

    // ── Auto-create edges: clipboard-edges + helper voor rest ──
    const allNodeIds = new Set([...existingNodeIds, ...pastedIds]);
    const currentDiagEdges = diag.edges || [];
    const newFlowEdges = [];
    const newDiagEdges = [];

    const addedPairs = new Set(currentDiagEdges.map((e) => `${e.source}→${e.target}`));

    const addEdgeIfNew = (edge) => {
      const pair = `${edge.source}→${edge.target}`;
      if (addedPairs.has(pair)) return;
      addedPairs.add(pair);
      newDiagEdges.push(edge);
      newFlowEdges.push({ ...edge, selectable: false, selected: false });
    };

    // ── 1) Clipboard edges eerst (bewaart visuele representatie uit brondiagram) ──
    for (const clipEdge of (diagramClipboard.internalEdges || diagramClipboard.edges || [])) {
      if (!allNodeIds.has(clipEdge.source) || !allNodeIds.has(clipEdge.target)) continue;
      addEdgeIfNew(clipEdge);
    }
    for (const bEdge of (diagramClipboard.boundaryEdges || [])) {
      if (!allNodeIds.has(bEdge.source) || !allNodeIds.has(bEdge.target)) continue;
      addEdgeIfNew({ ...bEdge, hidden: bEdge.hidden || false });
    }

    // ── 2) Helper: ontdek overige edges (structural + alle diagrammen) ──
    const discovered = discoverEdgesForNodes(store, elements, allNodeIds, addedPairs);
    for (const de of discovered) {
      addEdgeIfNew(de);
    }

    if (newDiagEdges.length > 0) {
      store.updateDiagramEdges(diagramId, [...currentDiagEdges, ...newDiagEdges]);
      setEdges((eds) => [...eds, ...newFlowEdges]);
    }
  }, [diagramId, elements, setNodes, setEdges, screenToFlowPosition]);

  // Ctrl+C / Ctrl+V: kopiëren en plakken van visuele elementen tussen diagrammen
  useEffect(() => {
    function handleCopyPasteKey(event) {
      // Negeer als focus in een input/textarea/contenteditable zit
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
      if (!(event.ctrlKey || event.metaKey)) return;

      // Reageer als dit het actieve diagram is, of als er geselecteerde nodes zijn
      // (activeDiagramId is niet altijd up-to-date, bijv. na Shift+drag box-selectie)
      const uiState = useUIStore.getState();
      if (uiState.activeDiagramId && uiState.activeDiagramId !== diagramId) return;

      if (event.key === "c") {
        // Zet activeDiagramId zodat paste op het juiste diagram werkt
        uiState.setActiveDiagramId(diagramId);
        handleCopySelection();
      } else if (event.key === "v") {
        event.preventDefault();
        handlePasteClipboard();
      }
    }
    document.addEventListener("keydown", handleCopyPasteKey);
    return () => document.removeEventListener("keydown", handleCopyPasteKey);
  }, [diagramId, handleCopySelection, handlePasteClipboard]);

  const swapConnectionDirection = useCallback((connection) => ({
    ...connection,
    source: connection.target,
    target: connection.source,
    sourceHandle: connection.targetHandle,
    targetHandle: connection.sourceHandle,
  }), []);

  const normalizeConnection = useCallback(
    (connection, currentEdges) => {
      const sourceType = elementTypeById.get(connection.source);
      const targetType = elementTypeById.get(connection.target);

      if (!sourceType || !targetType) return connection;

      if (sourceType === "gegevenselement" && targetType === "entiteit") {
        return swapConnectionDirection(connection);
      }

      if (
        (sourceType === "enumeratie" && targetType !== "enumeratie") ||
        (sourceType === "gegevenstype" && targetType !== "gegevenstype")
      ) {
        return swapConnectionDirection(connection);
      }

      if (
        (sourceType === "referentielijstInstantie" && targetType === "relatie") ||
        (sourceType === "relatie" && targetType === "referentielijstInstantie")
      ) {
        const instantieId = sourceType === "referentielijstInstantie" ? connection.source : connection.target;
        const relatieId = sourceType === "relatie" ? connection.source : connection.target;
        return { ...connection, source: instantieId, target: relatieId };
      }

      if (
        (sourceType === "entiteit" && targetType === "relatie") ||
        (sourceType === "relatie" && targetType === "entiteit")
      ) {
        const relatieId = sourceType === "relatie" ? connection.source : connection.target;
        const entiteitId = sourceType === "entiteit" ? connection.source : connection.target;

        const ownerEdge = currentEdges.find((e) => {
          if (e.type !== "metamodel") return false;
          if (e.target !== relatieId) return false;
          const ownerType = elementTypeById.get(e.source);
          return ownerType === "entiteit" || ownerType === "referentielijstInstantie";
        });

        if (!ownerEdge || ownerEdge.source === entiteitId) {
          return { ...connection, source: entiteitId, target: relatieId };
        }

        return { ...connection, source: relatieId, target: entiteitId };
      }

      return connection;
    },
    [elementTypeById, swapConnectionDirection]
  );

  const handleConnect = useCallback(
    (connection) => {
      if (!connection?.source || !connection?.target || connection.source === connection.target) return;

      setActiveDiagramId(diagramId);
      const currentEdges = getEdges();
      const normalized = normalizeConnection(connection, currentEdges);
      const sourceType = elementTypeById.get(normalized.source);
      const targetType = elementTypeById.get(normalized.target);

      // === Edge-mode override ===
      if (activeEdgeMode === EDGE_MODES.GENERALISATIE) {
        if (sourceType !== targetType || !["entiteit", "gegevenselement"].includes(sourceType)) {
          console.warn(`Generalisatie alleen mogelijk tussen zelfde metatype (${sourceType} → ${targetType})`);
          setActiveEdgeMode(EDGE_MODES.NONE);
          return;
        }
        const filtered = currentEdges.filter(
          (e) => !(e.source === normalized.source && e.data?.isGeneralization)
        );
        const genEdge = {
          ...normalized,
          id: `edge_${normalized.source}_${normalized.target}_${Date.now()}`,
          type: "metamodel",
          data: { isGeneralization: true },
        };
        const nextEdges = [...filtered, genEdge];
        setEdges(nextEdges);
        updateDiagramEdges(diagramId, nextEdges.map(({ selected, ...rest }) => rest));
        setActiveEdgeMode(EDGE_MODES.NONE);
        return;
      }

      if (activeEdgeMode === EDGE_MODES.COMPOSITIE) {
        const compEdge = {
          ...normalized,
          id: `edge_${normalized.source}_${normalized.target}_${Date.now()}`,
          type: "metamodel",
          data: {
            rolnaam: "",
            jsonRolnaam: "",
            momentvoorkomen: "enkelvoudig",
            kardinaliteit: "0..1",
          },
        };
        const nextEdges = addEdge(compEdge, currentEdges);
        setEdges(nextEdges);
        updateDiagramEdges(diagramId, nextEdges.map(({ selected, ...rest }) => rest));
        setActiveEdgeMode(EDGE_MODES.NONE);
        return;
      }

      // ENT → ENT maakt in de IDE direct een lege relatie-node in collapsed mode.
      if (sourceType === "entiteit" && targetType === "entiteit") {
        const bronNode = getNode(normalized.source);
        const doelNode = getNode(normalized.target);
        maakRelatieTussenEntiteiten({
          diagramId,
          bronEntiteitId: normalized.source,
          doelEntiteitId: normalized.target,
          bronPositie: bronNode?.position,
          doelPositie: doelNode?.position,
          position: {
            x: ((bronNode?.position?.x ?? 0) + (doelNode?.position?.x ?? 320)) / 2,
            y: ((bronNode?.position?.y ?? 0) + (doelNode?.position?.y ?? 0)) / 2 + 70,
          },
        });
        return;
      }

      const isStructuralConnection = sourceType === "entiteit" && ["gegevenselement", "relatie"].includes(targetType);
      const isReferentielijstBinding = sourceType === "referentielijstInstantie" && targetType === "relatie";
      const isDependencyConnection =
        isReferentielijstBinding ||
        ((sourceType === "entiteit" || sourceType === "gegevenselement" || sourceType === "relatie") &&
          (targetType === "enumeratie" || targetType === "gegevenstype"));

      const bestaatAl = currentEdges.some(
        (e) =>
          e.source === normalized.source &&
          e.target === normalized.target &&
          (e.sourceHandle || null) === (normalized.sourceHandle || null) &&
          (e.targetHandle || null) === (normalized.targetHandle || null)
      );
      if (bestaatAl) return;

      const doelElement = elements[normalized.target];
      const newEdge = {
        ...normalized,
        id: `edge_${normalized.source}_${normalized.target}_${Date.now()}`,
        type: "metamodel",
        selectable: false,
        selected: true,
        data: isDependencyConnection
          ? {
              isDependency: true,
              rolnaam: isReferentielijstBinding ? `⇢ ${elements[normalized.source]?.naam || ""}` : "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: "",
            }
          : {
              rolnaam: doelElement?.naam || "",
              jsonRolnaam: doelElement?.data?.meervoud || (doelElement?.naam || "").toLowerCase(),
              momentvoorkomen: targetType === "relatie" ? "meervoudig" : "enkelvoudig",
              kardinaliteit: targetType === "relatie" ? "0..*" : "0..1",
            },
      };

      const nextEdges = addEdge(
        newEdge,
        currentEdges.map((e) => ({ ...e, selected: false }))
      );
      setEdges(nextEdges);
      updateDiagramEdges(
        diagramId,
        nextEdges.map(({ selected, ...rest }) => rest)
      );
      if (isStructuralConnection) {
        addStructuralEdge({
          id: newEdge.id,
          source: newEdge.source,
          target: newEdge.target,
          sourceHandle: newEdge.sourceHandle || null,
          targetHandle: newEdge.targetHandle || null,
          data: newEdge.data,
        });
      }
      setSelectedEdgeId(newEdge.id);
    },
    [
      addStructuralEdge,
      activeEdgeMode,
      diagramId,
      elementTypeById,
      elements,
      getEdges,
      normalizeConnection,
      setActiveDiagramId,
      setEdges,
      setSelectedEdgeId,
      updateDiagramEdges,
    ]
  );

  const handleConnectEnd = useCallback(
    (event, connectionState) => {
      const heeftModifier = !!(event?.altKey || event?.ctrlKey || event?.metaKey);
      if (!heeftModifier || connectionState?.isValid) return;

      const bronNode = connectionState?.fromNode || null;
      const fromHandle = connectionState?.fromHandle;
      const handleType = fromHandle?.type || "source";
      // Alt-drag (of Ctrl/Meta) vanuit elke source handle van een entiteit
      if (!bronNode || bronNode.type !== "entiteit" || handleType !== "source") return;

      const pointer = (() => {
        if (typeof event?.clientX === "number" && typeof event?.clientY === "number") {
          return { x: event.clientX, y: event.clientY };
        }
        const touch = event?.changedTouches?.[0] || event?.touches?.[0] || null;
        return touch ? { x: touch.clientX, y: touch.clientY } : null;
      })();
      if (!pointer) return;

      voegNieuwRepToe("gegevenselement", {
        diagramId,
        parentId: bronNode.id,
        parentDomein: bronNode?.data?.domein || "",
        position: screenToFlowPosition(pointer),
      });
    },
    [diagramId, screenToFlowPosition]
  );

  const openAlignmentContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const pos = clampContextMenuPosition(event.clientX, event.clientY);
      setContextMenu({ x: pos.x, y: pos.y, nodeId: null });
      return true;
    },
    []
  );

  const handlePaneContextMenu = useCallback(
    (event) => {
      openAlignmentContextMenu(event);
    },
    [openAlignmentContextMenu]
  );

  const handleEdgeContextMenu = useCallback(
    (event, edge) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveDiagramId(diagramId);
      setSelectedEdgeId(edge.id);
      // Probeer eerst alignment menu (bij ≥2 geselecteerde nodes)
      if (openAlignmentContextMenu(event)) return;
      // Anders: edge-specifiek contextmenu
      const pos = clampContextMenuPosition(event.clientX, event.clientY);
      setContextMenu({ x: pos.x, y: pos.y, nodeId: null, edgeId: edge.id });
    },
    [diagramId, openAlignmentContextMenu, setActiveDiagramId, setSelectedEdgeId]
  );

  const handleSelectionContextMenu = useCallback(
    (event, _nodes) => {
      openAlignmentContextMenu(event);
    },
    [openAlignmentContextMenu]
  );

  // Sluit context menu bij klik erbuiten, defocus, scroll, resize of Escape
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const onVisibility = () => {
      if (document.hidden) close();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", close, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [contextMenu]);

  // Sla node-posities op in store na drag; sync verwijderingen naar store
  const handleNodesChangeWrapped = useCallback(
    (changes) => {
      onNodesChange(changes);

      // Verwijder nodes die via Delete-toets uit React Flow verwijderd zijn
      const removeChanges = changes.filter((c) => c.type === "remove");
      if (removeChanges.length > 0) {
        const rmStore = useModelStore.getState();
        for (const rc of removeChanges) {
          rmStore.removeElementFromDiagram(diagramId, rc.id);
        }
        // Verwijder ook edges die naar verwijderde nodes wijzen
        const removedIds = new Set(removeChanges.map((c) => c.id));
        setEdges((eds) => eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)));
      }

      // Alleen bij position-changes die "dragging: false" hebben (einde drag)
      const posChanges = changes.filter(
        (c) => c.type === "position" && c.dragging === false && c.position
      );
      if (posChanges.length > 0 && diagram) {
        const updatedDiagNodes = diagram.nodes.map((dn) => {
          const change = posChanges.find((c) => c.id === dn.elementId);
          if (change) return { ...dn, position: change.position };
          return dn;
        });
        updateDiagramNodes(diagramId, updatedDiagNodes);
      }
    },
    [onNodesChange, diagram, diagramId, updateDiagramNodes, setEdges]
  );

  // Drop vanuit ProjectBrowser
  const handleDragOver = useCallback((e) => {
    const types = Array.from(e.dataTransfer?.types || []);
    const isLikelyIdeDrag =
      types.includes("application/ide-element") ||
      types.includes("application/json") ||
      types.includes("text/plain");
    if (!isLikelyIdeDrag) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      const store = useModelStore.getState();
      const diag = store.diagrams[diagramId];
      if (!diag) return;
      const existingNodeIds = new Set((diag.nodes || []).map((n) => n.elementId));

      const raw =
        e.dataTransfer.getData("application/ide-element") ||
        e.dataTransfer.getData("application/json") ||
        "";
      if (!raw) return;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        console.warn("[handleDrop] kon drag payload niet parsen:", raw);
        return;
      }

      // Supporteer zowel nieuw multi-formaat als oud enkel formaat
      let dropItems;
      if (parsed.elements) {
        dropItems = parsed.elements;
      } else if (parsed.elementId) {
        dropItems = [parsed];
      } else {
        return;
      }

      // Filter ongeldige en dubbele elementen
      dropItems = dropItems.filter(
        (item) => item.elementId && elements[item.elementId] && !existingNodeIds.has(item.elementId)
      );
      if (dropItems.length === 0) return;

      // ── Auto-add gerelateerde entiteiten voor relaties (owner + doel) ──
      // Zonder beide endpoints kan een ASOC-edge niet zichtbaar worden.
      const allDropIds = new Set(dropItems.map((d) => d.elementId));
      const autoItems = [];
      for (const item of dropItems) {
        const el = elements[item.elementId];
        if (el?.type !== "relatie") continue;
        // Doel-entiteit
        const doelId = el.data?.doelEntiteit;
        if (doelId && elements[doelId] && !existingNodeIds.has(doelId) && !allDropIds.has(doelId)) {
          autoItems.push({ elementId: doelId, _auto: true });
          allDropIds.add(doelId);
        }
        // Owner-entiteit (bron): zoek via structuralEdges
        for (const se of store.structuralEdges) {
          if (se.target === item.elementId && elements[se.source]?.type === "entiteit") {
            if (!existingNodeIds.has(se.source) && !allDropIds.has(se.source)) {
              autoItems.push({ elementId: se.source, _auto: true });
              allDropIds.add(se.source);
            }
            break;
          }
        }
      }
      if (autoItems.length > 0) {
        dropItems = [...dropItems, ...autoItems];
      }

      // Bereken canvas-positie (correct met zoom/pan)
      const basePosition = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const addElementToDiagram = store.addElementToDiagram;
      const newNodes = [];
      let explicitIdx = 0;
      let autoIdx = 0;

      dropItems.forEach((item) => {
        const { elementId } = item;
        let position;
        if (item._auto) {
          // Auto-toegevoegde entiteiten: horizontaal rechts van drop-punt
          position = {
            x: basePosition.x + 300 + autoIdx * 250,
            y: basePosition.y - 30,
          };
          autoIdx++;
        } else {
          position = {
            x: basePosition.x + explicitIdx * 40,
            y: basePosition.y + explicitIdx * 40,
          };
          explicitIdx++;
        }

        addElementToDiagram(diagramId, elementId, position);

        const el = elements[elementId];
        newNodes.push({
          id: elementId,
          type: el.type,
          position,
          data: { ...el.data, id: elementId },
        });
      });

      setNodes((nds) => [...nds, ...newNodes]);

      // ── Auto-create edges: structural + alle diagrammen scannen ──
      if (diag) {
        const allNodeIds = new Set([...existingNodeIds, ...dropItems.map((d) => d.elementId)]);
        const currentDiagEdges = diag.edges || [];
        const existingPairs = new Set(currentDiagEdges.map((e) => `${e.source}→${e.target}`));

        const discovered = discoverEdgesForNodes(store, elements, allNodeIds, existingPairs);

        if (discovered.length > 0) {
          store.updateDiagramEdges(diagramId, [...currentDiagEdges, ...discovered]);
          setEdges((eds) => [
            ...eds,
            ...discovered.map((e) => ({ ...e, selectable: false, selected: false })),
          ]);
        }
      }
    },
    [diagramId, elements, setNodes, setEdges, screenToFlowPosition]
  );

  // ── Layout helpers: snap, normaliseer en uitlijnen ──────
  const snapNodesToGrid = useCallback(() => {
    setNodes((nds) => {
      const updated = nds.map((node) => ({
        ...node,
        position: {
          x: Math.round((node.position?.x ?? 0) / 15) * 15,
          y: Math.round((node.position?.y ?? 0) / 15) * 15,
        },
      }));
      if (diagram) {
        const updatedDiagNodes = diagram.nodes.map((dn) => {
          const flowNode = updated.find((node) => node.id === dn.elementId);
          return flowNode ? { ...dn, position: flowNode.position } : dn;
        });
        updateDiagramNodes(diagramId, updatedDiagNodes);
      }
      return updated;
    });
  }, [diagram, diagramId, setNodes, updateDiagramNodes]);

  const normaliseerRelaties = useCallback(() => {
    setEdges((eds) => {
      const updated = eds.map((edge) => {
        const srcNode = getNode(edge.source);
        const tgtNode = getNode(edge.target);
        if (!srcNode || !tgtNode) return edge;
        const { sourceHandle, targetHandle } = berekenKortsteHandles(srcNode, tgtNode);
        return { ...edge, sourceHandle, targetHandle };
      });
      if (diagram) {
        updateDiagramEdges(
          diagramId,
          updated.map(({ selected, ...rest }) => rest)
        );
      }
      return updated;
    });
  }, [diagram, diagramId, getNode, setEdges, updateDiagramEdges]);

  const handleCreateRep = useCallback((kind, extra = {}) => {
    voegNieuwRepToe(kind, {
      diagramId,
      domein: useUIStore.getState().actiefDomein || diagram?.domein || "",
      ...extra,
    });
  }, [diagram, diagramId]);

  const alignNodes = useCallback(
    (mode) => {
      if (mode === "normaliseer-relaties") {
        normaliseerRelaties();
        return;
      }
      if (mode === "snap-grid") {
        snapNodesToGrid();
        return;
      }

      const selected = getNodes().filter((n) => n.selected);
      if (selected.length < 2) return;

      let updater;
      switch (mode) {
        case "left": {
          const minX = Math.min(...selected.map((n) => n.position.x));
          updater = (n) => (selected.some((s) => s.id === n.id) ? { ...n, position: { ...n.position, x: minX } } : n);
          break;
        }
        case "right": {
          const maxX = Math.max(...selected.map((n) => n.position.x + (n.measured?.width ?? 200)));
          updater = (n) =>
            selected.some((s) => s.id === n.id)
              ? { ...n, position: { ...n.position, x: maxX - (n.measured?.width ?? 200) } }
              : n;
          break;
        }
        case "top": {
          const minY = Math.min(...selected.map((n) => n.position.y));
          updater = (n) => (selected.some((s) => s.id === n.id) ? { ...n, position: { ...n.position, y: minY } } : n);
          break;
        }
        case "bottom": {
          const maxY = Math.max(...selected.map((n) => n.position.y + (n.measured?.height ?? 100)));
          updater = (n) =>
            selected.some((s) => s.id === n.id)
              ? { ...n, position: { ...n.position, y: maxY - (n.measured?.height ?? 100) } }
              : n;
          break;
        }
        case "center-h": {
          const avgX = selected.reduce((s, n) => s + n.position.x + (n.measured?.width ?? 200) / 2, 0) / selected.length;
          updater = (n) =>
            selected.some((s) => s.id === n.id)
              ? { ...n, position: { ...n.position, x: avgX - (n.measured?.width ?? 200) / 2 } }
              : n;
          break;
        }
        case "center-v": {
          const avgY = selected.reduce((s, n) => s + n.position.y + (n.measured?.height ?? 100) / 2, 0) / selected.length;
          updater = (n) =>
            selected.some((s) => s.id === n.id)
              ? { ...n, position: { ...n.position, y: avgY - (n.measured?.height ?? 100) / 2 } }
              : n;
          break;
        }
        case "distribute-h": {
          const sorted = [...selected].sort((a, b) => a.position.x - b.position.x);
          const first = sorted[0].position.x;
          const last = sorted[sorted.length - 1].position.x;
          const step = (last - first) / (sorted.length - 1);
          const posMap = new Map(sorted.map((n, i) => [n.id, first + i * step]));
          updater = (n) => (posMap.has(n.id) ? { ...n, position: { ...n.position, x: posMap.get(n.id) } } : n);
          break;
        }
        case "distribute-v": {
          const sorted = [...selected].sort((a, b) => a.position.y - b.position.y);
          const first = sorted[0].position.y;
          const last = sorted[sorted.length - 1].position.y;
          const step = (last - first) / (sorted.length - 1);
          const posMap = new Map(sorted.map((n, i) => [n.id, first + i * step]));
          updater = (n) => (posMap.has(n.id) ? { ...n, position: { ...n.position, y: posMap.get(n.id) } } : n);
          break;
        }
        default:
          return;
      }

      setNodes((nds) => {
        const updated = nds.map(updater);
        if (diagram) {
          const updatedDiagNodes = diagram.nodes.map((dn) => {
            const flowNode = updated.find((n) => n.id === dn.elementId);
            return flowNode ? { ...dn, position: flowNode.position } : dn;
          });
          updateDiagramNodes(diagramId, updatedDiagNodes);
        }
        return updated;
      });
    },
    [getNodes, setNodes, diagram, diagramId, updateDiagramNodes, normaliseerRelaties, snapNodesToGrid]
  );

  const handleMoveEnd = useCallback(
    (_event, viewport) => {
      // Guard: sla geen gecorrumpeerde viewport op
      if (viewport && isFinite(viewport.x) && isFinite(viewport.y) && isFinite(viewport.zoom) && viewport.zoom > 0) {
        updateDiagramViewport(diagramId, viewport);
      }
    },
    [diagramId, updateDiagramViewport]
  );

  if (!diagram) {
    return (
      <div style={{ padding: 20, color: "#888" }}>
        Diagram "{diagramId}" niet gevonden.
      </div>
    );
  }

  return (
    <div
      ref={reactFlowWrapper}
      style={{
        width: "100%",
        height: "100%",
        outline: isDragOver ? "2px dashed #4a9eff" : "none",
        outlineOffset: "-2px",
      }}
      className={`ide-canvas${activeEdgeMode !== EDGE_MODES.NONE ? ` ${activeEdgeMode.cursorClass}` : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <FloatingToolbar
        title="Maken"
        layout={toolbarLayouts.create}
        onLayoutChange={(nextLayout) => updateToolbarLayout("create", nextLayout)}
      >
        {CREATE_BUTTONS.map((button) => (
          <button
            key={button.kind}
            title={button.title}
            onClick={() => handleCreateRep(button.kind)}
            style={{
              minWidth: 52,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--ide-toolbar-border)",
              background: "var(--ide-toolbar-bg-secondary, rgba(255,255,255,0.04))",
              color: "var(--ide-toolbar-color)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {button.label}
          </button>
        ))}
      </FloatingToolbar>

      <FloatingToolbar
        title="Layout"
        layout={toolbarLayouts.layout}
        onLayoutChange={(nextLayout) => updateToolbarLayout("layout", nextLayout)}
      >
        <AlignToolbar
          alignNodes={alignNodes}
          onNormaliseer={normaliseerRelaties}
          onSnapGrid={snapNodesToGrid}
          embedded
          isVertical={toolbarLayouts.layout?.orientation === "vertical"}
        />
      </FloatingToolbar>

      <FloatingToolbar
        title="Verbinding"
        layout={toolbarLayouts.verbinding}
        onLayoutChange={(nextLayout) => updateToolbarLayout("verbinding", nextLayout)}
      >
        {[EDGE_MODES.COMPOSITIE, EDGE_MODES.GENERALISATIE].map((mode) => (
          <button
            key={mode.key}
            onClick={() => setActiveEdgeMode(activeEdgeMode === mode ? EDGE_MODES.NONE : mode)}
            title={`${mode.label}-verbinding tekenen`}
            aria-pressed={activeEdgeMode === mode}
            style={{
              minWidth: 52,
              padding: "6px 8px",
              borderRadius: 6,
              border: activeEdgeMode === mode
                ? "1px solid #60a5fa"
                : "1px solid var(--ide-toolbar-border)",
              background: activeEdgeMode === mode
                ? "rgba(30, 58, 95, 0.92)"
                : "var(--ide-toolbar-bg-secondary, rgba(255,255,255,0.04))",
              color: activeEdgeMode === mode
                ? "#93c5fd"
                : "var(--ide-toolbar-color)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              boxShadow: activeEdgeMode === mode ? "0 0 6px rgba(96,165,250,0.35)" : "none",
            }}
          >
            {mode.icon} {mode.label}
          </button>
        ))}
      </FloatingToolbar>

      {activeEdgeMode !== EDGE_MODES.NONE && (
        <div className="edge-mode-indicator">
          {activeEdgeMode.icon} {activeEdgeMode.label}-modus actief — sleep van bron naar doel &nbsp;
          <span style={{ opacity: 0.7, fontSize: "11px" }}>(Esc om te annuleren)</span>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={theme}
        onNodesChange={handleNodesChangeWrapped}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectEnd={handleConnectEnd}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onSelectionContextMenu={handleSelectionContextMenu}
        onPaneClick={handlePaneClick}
        onMoveEnd={handleMoveEnd}
        defaultViewport={
          diagram.viewport && isFinite(diagram.viewport.x) && isFinite(diagram.viewport.y) && isFinite(diagram.viewport.zoom) && diagram.viewport.zoom > 0
            ? diagram.viewport
            : { x: 0, y: 0, zoom: 1 }
        }
        fitView={!diagram.viewport}
        fitViewOptions={{ padding: 0.15 }}
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{ type: "metamodel" }}
        deleteKeyCode={["Backspace", "Delete"]}
        selectionKeyCode="Shift"
        selectionMode="partial"
        multiSelectionKeyCode="Control"
        edgesFocusable={false}
        minZoom={0.05}
        maxZoom={3}
      >
        <Background variant="dots" gap={15} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          style={{ height: 100, width: 140 }}
        />
      </ReactFlow>
      {/* Node context menu */}
      {contextMenu && (() => {
        const selectedCount = nodes.filter((n) => n.selected).length;
        const canAlign = selectedCount >= 2;
        const canDistribute = selectedCount >= 3;
        const disabledStyle = { opacity: 0.4, cursor: "default", pointerEvents: "none" };
        const enabledStyle = { cursor: "pointer" };
        const itemHover = (e) => (e.currentTarget.style.background = "var(--ide-menu-hover, #3a3f4b)");
        const itemLeave = (e) => (e.currentTarget.style.background = "transparent");
        return (
          <div
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              background: "var(--ide-menu-bg, #2d2d2d)",
              border: "1px solid var(--ide-menu-border, #555)",
              borderRadius: 4,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              padding: "4px 0",
              minWidth: 180,
              maxHeight: "calc(100vh - 16px)",
              overflowY: "auto",
              zIndex: 9999,
              fontSize: 12,
              color: "var(--ide-menu-color, #ccc)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "3px 12px", color: "var(--ide-panel-color-muted, #888)", fontSize: 11 }}>
              Uitlijnen{canAlign ? ` (${selectedCount} nodes)` : ""}
            </div>
            {ALIGN_BUTTONS.map((btn, i) => {
              if (btn === "sep") {
                return <div key={`align-sep-${i}`} style={{ height: 1, background: "var(--ide-menu-sep, #444)", margin: "4px 8px" }} />;
              }
              const isDistribute = btn.mode === "distribute-h" || btn.mode === "distribute-v";
              const isEnabled = isDistribute ? canDistribute : canAlign;
              return (
                <div
                  key={btn.mode}
                  style={{
                    padding: "5px 12px",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    ...(isEnabled ? enabledStyle : disabledStyle),
                  }}
                  onMouseEnter={isEnabled ? itemHover : undefined}
                  onMouseLeave={isEnabled ? itemLeave : undefined}
                  onClick={isEnabled ? () => { alignNodes(btn.mode); setContextMenu(null); } : undefined}
                >
                  <span style={{ display: "inline-flex", width: 16, height: 16, flexShrink: 0 }}>
                    {btn.icon}
                  </span>
                  <span>{btn.title}</span>
                </div>
              );
            })}
            <div style={{ height: 1, background: "var(--ide-menu-sep, #444)", margin: "4px 8px" }} />
            <div
              style={{ padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
              onMouseEnter={itemHover}
              onMouseLeave={itemLeave}
              onClick={() => { normaliseerRelaties(); setContextMenu(null); }}
            >
              ↔ Normaliseer relaties
            </div>
            <div
              style={{ padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
              onMouseEnter={itemHover}
              onMouseLeave={itemLeave}
              onClick={() => { snapNodesToGrid(); setContextMenu(null); }}
            >
              ⊞ Snap nodes naar grid
            </div>
            <div style={{ height: 1, background: "var(--ide-menu-sep, #444)", margin: "4px 8px" }} />
            {/* Kopiëren: beschikbaar als er geselecteerde nodes zijn of als er een node-contextmenu is */}
            {(selectedCount > 0 || contextMenu.nodeId) && (
              <div
                style={{ padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
                onMouseEnter={itemHover}
                onMouseLeave={itemLeave}
                onClick={() => { handleCopySelection(contextMenu.nodeId); setContextMenu(null); }}
              >
                📋 Kopiëren (Ctrl+C)
              </div>
            )}
            {/* Plakken: beschikbaar als er iets op het clipboard staat */}
            {diagramClipboard && diagramClipboard.nodes.length > 0 && (
              <div
                style={{ padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
                onMouseEnter={itemHover}
                onMouseLeave={itemLeave}
                onClick={() => { handlePasteClipboard(); setContextMenu(null); }}
              >
                📋 Plakken (Ctrl+V)
              </div>
            )}
            <div style={{ height: 1, background: "var(--ide-menu-sep, #444)", margin: "4px 8px" }} />
            {contextMenu.nodeId && (
              <div
                style={{ padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
                onMouseEnter={itemHover}
                onMouseLeave={itemLeave}
                onClick={handleRemoveFromDiagram}
              >
                🗑️ Verwijder node van diagram
              </div>
            )}
            {contextMenu.edgeId && (() => {
              const edge = edges.find((e) => e.id === contextMenu.edgeId);
              const srcName = edge && elements[edge.source]?.naam;
              const tgtName = edge && elements[edge.target]?.naam;
              const isDep = edge?.data?.isDependency;
              return (
                <>
                  {srcName && (
                    <div
                      style={{ padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
                      onMouseEnter={itemHover}
                      onMouseLeave={itemLeave}
                      onClick={() => handleSelectEdgeEndpoint(edge.source)}
                    >
                      📦 Selecteer bron: {srcName}
                    </div>
                  )}
                  {tgtName && (
                    <div
                      style={{ padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
                      onMouseEnter={itemHover}
                      onMouseLeave={itemLeave}
                      onClick={() => handleSelectEdgeEndpoint(edge.target)}
                    >
                      📦 Selecteer doel: {tgtName}
                    </div>
                  )}
                  {isDep && (
                    <div
                      style={{ padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
                      onMouseEnter={itemHover}
                      onMouseLeave={itemLeave}
                      onClick={handleToggleEdgeHidden}
                    >
                      {edge.hidden ? "👁️ Toon «use» lijn" : "🙈 Verberg «use» lijn"}
                    </div>
                  )}
                  <div
                    style={{ padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
                    onMouseEnter={itemHover}
                    onMouseLeave={itemLeave}
                    onClick={handleRemoveEdgeFromDiagram}
                  >
                    🗑️ Verwijder edge van diagram
                  </div>
                </>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Wrapper met Provider ───────────────────────────────────

export default function DiagramCanvas({ diagramId }) {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner diagramId={diagramId} />
    </ReactFlowProvider>
  );
}
