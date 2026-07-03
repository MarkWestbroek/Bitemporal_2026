/**
 * DiagramCanvas (diagramcore) — dunne React Flow-wrapper voor de generieke motor.
 *
 * Props-gedreven en store-loos; kent geen profiel. Alles komt binnen via props:
 *
 *   diagramType        — DiagramType-descriptor (element-/field-type-lookups)
 *   elements           — Record<id, Element> (model/schema.js)
 *   diagram            — Diagram (nodes/edges/viewport)
 *   bewerkbaar?        — false (default, fase 1-spiegel) | true (fase 2)
 *   verbindingsType?   — expliciet gekozen connector-ElementType-id (taakbalk
 *                        "Verbinding"); null → automatisch afleiden uit de regels
 *   onSelectElement?   — (element|null) => void
 *   onNodePositie?     — (elementId, {x,y}) => void          (na slepen)
 *   onVerbind?         — ({connectorType, source, target, sourceHandle, targetHandle}) => void
 *   onVerwijder?       — (elementIds: string[]) => void      (Delete op selectie)
 *   onViewport?        — ({x,y,zoom}) => void                (na pannen/zoomen)
 *
 * Edges = geïmporteerde presentatie-edges (diagram.edges, fase 1-adapter)
 *       + gematerialiseerde connector-elementen (materialiseerConnectoren).
 */
import { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles/diagramcore.css";
import "../shapes/basisShapes.jsx"; // registreert de standaard-shapes
import ElementNode from "./ElementNode.jsx";
import ConnectorEdge from "./ConnectorEdge.jsx";
import { materialiseerConnectoren, vindConnectorType } from "./materialiseerConnectoren.js";

const nodeTypes = { element: ElementNode };
const edgeTypes = { connector: ConnectorEdge };

function bouwLookups(diagramType) {
  const elementTypesById = {};
  for (const et of diagramType?.elementTypes || []) elementTypesById[et.id] = et;
  const fieldTypesById = {};
  for (const ft of diagramType?.fieldTypes || []) fieldTypesById[ft.id] = ft;
  const compartmentTypesById = {};
  for (const et of diagramType?.elementTypes || []) {
    for (const ct of et.compartments || []) compartmentTypesById[ct.id] = ct;
  }
  return { elementTypesById, fieldTypesById, compartmentTypesById };
}

function CanvasBinnenkant({
  diagramType,
  elements,
  diagram,
  viewport = null,
  bewerkbaar = false,
  verbindingsType = null,
  onSelectElement,
  onNodePositie,
  onNodeSize,
  onVerbind,
  onVerwijder,
  onVerwijderConnectoren,
  onViewport,
}) {
  const lookups = useMemo(() => bouwLookups(diagramType), [diagramType]);

  // Nodes als interne React Flow-state, gevoed vanuit de props. Nodig omdat
  // selectie en slepen via node-changes lopen; de store blijft de waarheid
  // (posities gaan bij dragstop via onNodePositie terug).
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  useEffect(() => {
    const flowNodes = (diagram?.nodes || [])
      .map((ref) => {
        const element = elements[ref.elementId];
        if (!element) return null;
        const elementType = lookups.elementTypesById[element.elementType];
        if (!elementType) return null;
        return {
          id: ref.elementId,
          type: "element",
          position: ref.position || { x: 0, y: 0 },
          // Grootte per diagram-lidmaatschap (metamodel: Position.elementSize)
          ...(ref.size ? { style: { width: ref.size.width, height: ref.size.height } } : {}),
          data: {
            element,
            elementType,
            bewerkbaar,
            onResize: onNodeSize,
            fieldTypesById: lookups.fieldTypesById,
            compartmentTypesById: lookups.compartmentTypesById,
          },
        };
      })
      .filter(Boolean);
    // Behoud de selectie-vlag over rebuilds heen: elke store-wijziging (bv.
    // typen in de inspector) vervangt de nodes, en zonder dit zou React Flow
    // de selectie laten vallen — waardoor de inspector na één edit leegt.
    setNodes((huidige) => {
      const geselecteerd = new Set(huidige.filter((n) => n.selected).map((n) => n.id));
      return flowNodes.map((n) => (geselecteerd.has(n.id) ? { ...n, selected: true } : n));
    });
  }, [diagram, elements, lookups, setNodes, bewerkbaar, onNodeSize]);

  // Edges óók als interne React Flow-state: edge-selectie loopt (net als bij
  // nodes) via changes, en zonder toegepaste changes "plakt" een klik niet —
  // waardoor Delete op een connector nooit kon werken.
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  useEffect(() => {
    const geimporteerd = (diagram?.edges || []).map((e) => ({
      ...e,
      type: "connector",
      hidden: e.hidden || false,
      selectable: false, // geïmporteerde presentatie-edges zijn geen elementen
    }));
    // Gematerialiseerde connectoren zijn wél selecteerbaar (en dus met Delete
    // te wissen) zodra de canvas bewerkbaar is.
    const gematerialiseerd = materialiseerConnectoren(elements, diagram, lookups.elementTypesById).map(
      (e) => ({ ...e, type: "connector", selectable: bewerkbaar })
    );
    const flowEdges = [...geimporteerd, ...gematerialiseerd];
    setEdges((huidige) => {
      const geselecteerd = new Set(huidige.filter((e) => e.selected).map((e) => e.id));
      return flowEdges.map((e) => (geselecteerd.has(e.id) ? { ...e, selected: true } : e));
    });
  }, [diagram, elements, lookups, bewerkbaar, setEdges]);

  const handleSelectionChange = useCallback(
    ({ nodes: sel }) => {
      if (!onSelectElement) return;
      onSelectElement(sel?.length ? elements[sel[0].id] || null : null);
    },
    [onSelectElement, elements]
  );

  const handleNodeDragStop = useCallback(
    (_ev, node) => {
      if (bewerkbaar && onNodePositie && node?.id) onNodePositie(node.id, node.position);
    },
    [bewerkbaar, onNodePositie]
  );

  const isValidConnection = useCallback(
    (verbinding) => {
      if (!bewerkbaar) return false;
      const bron = elements[verbinding.source];
      const doel = elements[verbinding.target];
      return !!vindConnectorType(diagramType, bron, doel, verbindingsType);
    },
    [bewerkbaar, elements, diagramType, verbindingsType]
  );

  const handleConnect = useCallback(
    (verbinding) => {
      if (!bewerkbaar || !onVerbind) return;
      const bron = elements[verbinding.source];
      const doel = elements[verbinding.target];
      const connectorType = vindConnectorType(diagramType, bron, doel, verbindingsType);
      if (!connectorType) return;
      onVerbind({
        connectorType,
        source: verbinding.source,
        target: verbinding.target,
        sourceHandle: verbinding.sourceHandle || null,
        targetHandle: verbinding.targetHandle || null,
      });
    },
    [bewerkbaar, onVerbind, elements, diagramType, verbindingsType]
  );

  const handleNodesDelete = useCallback(
    (verwijderd) => {
      if (bewerkbaar && onVerwijder && verwijderd?.length) {
        onVerwijder(verwijderd.map((n) => n.id));
      }
    },
    [bewerkbaar, onVerwijder]
  );

  const handleEdgesDelete = useCallback(
    (verwijderd) => {
      if (!bewerkbaar || !onVerwijderConnectoren) return;
      const connectorIds = (verwijderd || [])
        .map((e) => e.data?.connectorId)
        .filter(Boolean);
      if (connectorIds.length) onVerwijderConnectoren(connectorIds);
    },
    [bewerkbaar, onVerwijderConnectoren]
  );

  const handleMoveEnd = useCallback(
    (_ev, viewport) => {
      if (onViewport) onViewport(viewport);
    },
    [onViewport]
  );

  return (
    <ReactFlow
      key={diagram?.id || "leeg"}
      className="dc-canvas"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={handleSelectionChange}
      onNodeDragStop={handleNodeDragStop}
      onConnect={handleConnect}
      isValidConnection={isValidConnection}
      onNodesDelete={handleNodesDelete}
      onEdgesDelete={handleEdgesDelete}
      onMoveEnd={handleMoveEnd}
      nodesDraggable={bewerkbaar}
      nodesConnectable={bewerkbaar}
      elementsSelectable
      deleteKeyCode={bewerkbaar ? ["Delete"] : null}
      // Zonder opgeslagen viewport: fitView op bestaande inhoud, maar een leeg
      // (nieuw) diagram start gewoon op zoom 1 — anders is de eerste node mini.
      defaultViewport={viewport || { x: 0, y: 0, zoom: 1 }}
      fitView={!viewport && (diagram?.nodes?.length || 0) > 0}
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => n.data?.element?.data?.kleur || n.data?.elementType?.kleur || "#e2e8f0"}
      />
    </ReactFlow>
  );
}

export default function DiagramCanvas(props) {
  return (
    <ReactFlowProvider>
      <CanvasBinnenkant {...props} />
    </ReactFlowProvider>
  );
}
