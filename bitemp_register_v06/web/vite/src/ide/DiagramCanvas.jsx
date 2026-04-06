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
import MetamodelEdge from "@editor/components/edges/MetamodelEdge";

import useModelStore from "../store/useModelStore";
import useUIStore from "../store/useUIStore";

const nodeTypes = {
  entiteit: EntiteitNode,
  gegevenselement: GegevensElementNode,
  relatie: RelatieNode,
  enumeratie: EnumeratieNode,
  gegevenstype: DatatypeNode,
  referentielijstInstantie: ReferentielijstInstantieNode,
};

const edgeTypes = {
  metamodel: MetamodelEdge,
};

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

function AlignToolbar({ alignNodes }) {
  return (
    <div className="ide-align-toolbar">
      {ALIGN_BUTTONS.map((btn, i) =>
        btn === "sep" ? (
          <span key={i} className="ide-align-sep" />
        ) : (
          <button key={btn.mode} title={btn.title} onClick={() => alignNodes(btn.mode)}>
            {btn.icon}
          </button>
        )
      )}
    </div>
  );
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
  const { setCenter, getNode, getZoom, getViewport, screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const reactFlowWrapper = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

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


  // Track of de selectie van dit diagram komt (voorkomt oneindige loop)
  const localSelectionRef = useRef(false);
  // Ref met actuele node-IDs zodat we nodes NIET in de useEffect dependency hoeven
  const nodeIdsRef = useRef(new Set());
  useEffect(() => {
    nodeIdsRef.current = new Set(nodes.map((n) => n.id));
  }, [nodes]);

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
        const rect = wrapper.getBoundingClientRect();

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
          setCenter(cx, cy, { zoom, duration: 300 });
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

  const handleSelectEdgeEndpoint = useCallback(
    (elementId) => {
      if (elementId && elements[elementId]) {
        setSelectedElementId(elementId);
      }
      setContextMenu(null);
    },
    [elements, setSelectedElementId]
  );

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

  const openAlignmentContextMenu = useCallback(
    (event) => {
      const selectedCount = getNodes().filter((n) => n.selected).length;
      if (selectedCount < 2) return false;
      event.preventDefault();
      event.stopPropagation();
      const pos = clampContextMenuPosition(event.clientX, event.clientY);
      setContextMenu({ x: pos.x, y: pos.y, nodeId: null });
      return true;
    },
    [getNodes]
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

  // Sla node-posities op in store na drag
  const handleNodesChangeWrapped = useCallback(
    (changes) => {
      onNodesChange(changes);
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
    [onNodesChange, diagram, diagramId, updateDiagramNodes]
  );

  // Drop vanuit ProjectBrowser
  const handleDragOver = useCallback((e) => {
    if (e.dataTransfer.types.includes("application/ide-element")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      const raw = e.dataTransfer.getData("application/ide-element");
      if (!raw) return;
      const { elementId } = JSON.parse(raw);
      if (!elementId || !elements[elementId]) return;

      // Voorkom duplicaten (element zit al op dit diagram)
      if (nodeIdsRef.current.has(elementId)) return;

      // Bereken canvas-positie (correct met zoom/pan)
      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      // Voeg toe aan diagram (via store)
      const addElementToDiagram = useModelStore.getState().addElementToDiagram;
      addElementToDiagram(diagramId, elementId, position);

      // Update lokale Flow-state ook
      const el = elements[elementId];
      setNodes((nds) => [
        ...nds,
        {
          id: elementId,
          type: el.type,
          position,
          data: { ...el.data, id: elementId },
        },
      ]);
    },
    [diagramId, elements, setNodes, screenToFlowPosition]
  );

  // ── Alignment helpers: werkt op geselecteerde nodes ──────
  const alignNodes = useCallback(
    (mode) => {
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
        // Persist naar store
        if (diagram) {
          const updatedDiagNodes = diagram.nodes.map((dn) => {
            const flowNode = updated.find((n) => n.id === dn.elementId);
            if (flowNode) return { ...dn, position: flowNode.position };
            return dn;
          });
          updateDiagramNodes(diagramId, updatedDiagNodes);
        }
        return updated;
      });
    },
    [getNodes, setNodes, diagram, diagramId, updateDiagramNodes]
  );

  const handleMoveEnd = useCallback(
    (_event, viewport) => {
      updateDiagramViewport(diagramId, viewport);
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
      className="ide-canvas"
    >
      {/* Alignment toolbar */}
      <AlignToolbar alignNodes={alignNodes} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChangeWrapped}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onSelectionContextMenu={handleSelectionContextMenu}
        onPaneClick={handlePaneClick}
        onMoveEnd={handleMoveEnd}
        defaultViewport={diagram.viewport || { x: 0, y: 0, zoom: 1 }}
        fitView={!diagram.viewport}
        fitViewOptions={{ padding: 0.15 }}
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{ type: "metamodel" }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
        const itemHover = (e) => (e.currentTarget.style.background = "#3a3f4b");
        const itemLeave = (e) => (e.currentTarget.style.background = "transparent");
        return (
          <div
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              background: "#2d2d2d",
              border: "1px solid #555",
              borderRadius: 4,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              padding: "4px 0",
              minWidth: 180,
              maxHeight: "calc(100vh - 16px)",
              overflowY: "auto",
              zIndex: 9999,
              fontSize: 12,
              color: "#ccc",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "3px 12px", color: "#888", fontSize: 11 }}>
              Uitlijnen{canAlign ? ` (${selectedCount} nodes)` : ""}
            </div>
            {ALIGN_BUTTONS.map((btn, i) => {
              if (btn === "sep") {
                return <div key={`align-sep-${i}`} style={{ height: 1, background: "#444", margin: "4px 8px" }} />;
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
            <div style={{ height: 1, background: "#444", margin: "4px 8px" }} />
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
