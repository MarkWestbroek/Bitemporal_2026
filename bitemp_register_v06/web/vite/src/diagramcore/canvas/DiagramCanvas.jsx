/**
 * DiagramCanvas (diagramcore) — dunne React Flow-wrapper voor de generieke motor.
 *
 * Props-gedreven en read-only (fase 1): rendert één diagram uit een core-model.
 * Kent geen store en geen profiel — alles komt binnen via props:
 *
 *   diagramType   — DiagramType-descriptor (voor element-/field-type-lookups)
 *   elements      — Record<id, Element> (model/schema.js)
 *   diagram       — Diagram (nodes/edges/viewport)
 *   onSelectElement? — (element|null) => void
 *
 * Bewerken (slepen, verbinden, verwijderen) komt in fase 2 via de store-acties.
 */
import { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles/diagramcore.css";
import "../shapes/basisShapes.jsx"; // registreert de standaard-shapes
import ElementNode from "./ElementNode.jsx";
import ConnectorEdge from "./ConnectorEdge.jsx";

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

function CanvasBinnenkant({ diagramType, elements, diagram, onSelectElement }) {
  const lookups = useMemo(() => bouwLookups(diagramType), [diagramType]);

  // Nodes als interne React Flow-state, gevoed vanuit de props. Nodig omdat
  // selectie via node-changes loopt: zonder toegepaste changes "plakt" een
  // klik-selectie niet. Posities blijven read-only (nodesDraggable=false).
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
          data: {
            element,
            elementType,
            fieldTypesById: lookups.fieldTypesById,
            compartmentTypesById: lookups.compartmentTypesById,
          },
        };
      })
      .filter(Boolean);
    setNodes(flowNodes);
  }, [diagram, elements, lookups, setNodes]);

  const edges = useMemo(
    () =>
      (diagram?.edges || []).map((e) => ({
        ...e,
        type: "connector",
        hidden: e.hidden || false,
        selectable: false,
      })),
    [diagram]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: sel }) => {
      if (!onSelectElement) return;
      onSelectElement(sel?.length ? elements[sel[0].id] || null : null);
    },
    [onSelectElement, elements]
  );

  const viewport = diagram?.viewport;

  return (
    <ReactFlow
      key={diagram?.id || "leeg"}
      className="dc-canvas"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onSelectionChange={handleSelectionChange}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      defaultViewport={viewport || undefined}
      fitView={!viewport}
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
