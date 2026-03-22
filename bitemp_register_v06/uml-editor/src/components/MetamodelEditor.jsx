/**
 * MetamodelEditor — Het hoofdcomponent dat alles samenvoegt.
 *
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  Toolbar                                                  ║
 * ╠═════════════════════════════════════════╦═════════════════╣
 * ║                                         ║  Edit Panel     ║
 * ║    React Flow Canvas                    ║  (sidebar)      ║
 * ║    (nodes + edges + handles)            ║                 ║
 * ║                                         ║                 ║
 * ╚═════════════════════════════════════════╩═════════════════╝
 *
 * React Flow architectuur:
 *   1. nodeTypes + edgeTypes: registratie van custom componenten
 *   2. useNodesState / useEdgesState: de state hooks
 *   3. onNodesChange / onEdgesChange: drag, delete, select events
 *   4. onConnect: wanneer gebruiker een verbinding trekt
 *   5. MiniMap / Controls / Background: optionele UI-helpers
 */
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
} from "@xyflow/react";

// React Flow CSS — dit MOET geïmporteerd worden, anders zie je niets
import "@xyflow/react/dist/style.css";

// Custom nodes
import EntiteitNode from "./nodes/EntiteitNode";
import GegevensElementNode from "./nodes/GegevensElementNode";
import RelatieNode from "./nodes/RelatieNode";
import EnumeratieNode from "./nodes/EnumeratieNode";
import DatatypeNode from "./nodes/DatatypeNode";

// Custom edge
import MetamodelEdge from "./edges/MetamodelEdge";

// Panels
import NodeEditPanel from "./panels/NodeEditPanel";
import EdgeEditPanel from "./panels/EdgeEditPanel";
import Toolbar from "./panels/Toolbar";
import TestInvoerPanel from "./panels/TestInvoerPanel";

// Export helpers
import { exportNaarMermaid } from "../export/exportMermaid";
import { exportNaarPlantUML } from "../export/exportPlantUML";
import { exportNaarXMI } from "../export/exportXMI";

// Data helpers
import {
  generateId,
  editorNaarMetamodel,
  schemaResponseNaarEditor,
} from "../metamodel/types";

/**
 * nodeTypes vertelt React Flow welke React-component bij welk node type hoort.
 * Dit object moet BUITEN de component staan (of useMemo) om infinite re-renders
 * te voorkomen — React Flow vergelijkt deze referentie.
 */
const nodeTypes = {
  entiteit: EntiteitNode,
  gegevenselement: GegevensElementNode,
  relatie: RelatieNode,
  enumeratie: EnumeratieNode,
  gegevenstype: DatatypeNode,
};

const edgeTypes = {
  metamodel: MetamodelEdge,
};

export default function MetamodelEditor({ initialNodes = [], initialEdges = [] }) {
  /**
   * useNodesState en useEdgesState zijn React Flow hooks:
   *   - nodes/edges: de huidige array
   *   - setNodes/setEdges: directe setter
   *   - onNodesChange/onEdgesChange: event handler voor drag, select, delete, etc.
   *
   * React Flow stuurt "changes" (position change, selection change, remove) naar
   * deze handlers, die de state automatisch bijwerken.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Track welke node of edge geselecteerd is voor het edit panel
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [showTestInvoer, setShowTestInvoer] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;
  const datatypeNodes = useMemo(() => nodes.filter((n) => n.type === "gegevenstype"), [nodes]);
  const enumNodes = useMemo(() => nodes.filter((n) => n.type === "enumeratie"), [nodes]);

  /**
   * onConnect wordt aangeroepen wanneer een gebruiker een edge trekt
   * van een source handle naar een target handle.
   * addEdge() is een React Flow utility die de edge toevoegt aan de array.
   */
  const onConnect = useCallback(
    (connection) => {
      const newEdge = {
        ...connection,
        id: generateId("edge"),
        type: "metamodel",
        data: {
          rolnaam: "",
          jsonRolnaam: "",
          momentvoorkomen: "enkelvoudig",
          kardinaliteit: "0..1",
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  /** Selectie handlers */
  const onNodeClick = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_event, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // === Node CRUD ===

  /** Voeg een nieuw type (node) toe op een willekeurige positie */
  const handleAddNode = useCallback(
    (data, type) => {
      const newNode = {
        id: data.id,
        type,
        position: {
          x: 100 + Math.random() * 400,
          y: 100 + Math.random() * 300,
        },
        data,
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(data.id);
      setSelectedEdgeId(null);
    },
    [setNodes]
  );

  /** Update de data van een bestaande node */
  const handleUpdateNode = useCallback(
    (nodeId, newData) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          // Als metatype veranderd is, verander ook het node type
          const newType = newData.metatype || n.type;
          return { ...n, type: newType, data: newData };
        })
      );
    },
    [setNodes]
  );

  /** Verwijder een node en alle bijbehorende edges */
  const handleDeleteNode = useCallback(
    (nodeId) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      setSelectedNodeId(null);
    },
    [setNodes, setEdges]
  );

  // === Edge CRUD ===

  const handleUpdateEdge = useCallback(
    (edgeId, newData, edgeProps = {}) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === edgeId ? { ...e, ...edgeProps, data: newData } : e))
      );
    },
    [setEdges]
  );

  const handleDeleteEdge = useCallback(
    (edgeId) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdgeId(null);
    },
    [setEdges]
  );

  // === Opslaan / Laden ===

  const handleSave = useCallback(() => {
    const model = editorNaarMetamodel(nodes, edges);
    const flowState = { nodes, edges };
    const payload = { model, flowState };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metamodel.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const handleLoad = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const payload = JSON.parse(evt.target.result);
          if (payload.flowState) {
            setNodes(payload.flowState.nodes || []);
            setEdges(payload.flowState.edges || []);
          }
        } catch (err) {
          console.error("Laden mislukt:", err);
          alert("Ongeldig JSON-bestand");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges]);

  /** Laad vanuit de schema-API van de bitemporele backend */
  const handleLoadSchema = useCallback(() => {
    const url = prompt(
      "Schema-API URL:",
      "http://localhost:8080/schema"
    );
    if (!url) return;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const { nodes: newNodes, edges: newEdges } =
          schemaResponseNaarEditor(data);
        setNodes(newNodes);
        setEdges(newEdges);
      })
      .catch((err) => {
        console.error("Schema laden mislukt:", err);
        alert(`Kan schema niet laden: ${err.message}`);
      });
  }, [setNodes, setEdges]);

  // ── Export handlers ──────────────────────────────────────────
  const downloadFile = useCallback((content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportMermaid = useCallback(() => {
    downloadFile(exportNaarMermaid(nodes, edges), "metamodel.mmd", "text/plain");
  }, [nodes, edges, downloadFile]);

  const handleExportPlantUML = useCallback(() => {
    downloadFile(exportNaarPlantUML(nodes, edges), "metamodel.puml", "text/plain");
  }, [nodes, edges, downloadFile]);

  const handleExportXMI = useCallback(() => {
    downloadFile(exportNaarXMI(nodes, edges), "metamodel.xmi", "application/xml");
  }, [nodes, edges, downloadFile]);

  /**
   * MiniMap nodeColor: kleurt de minimap-nodes op basis van het metatype.
   * Dit is een React Flow prop die een functie accepteert.
   */
  const minimapColor = useCallback((node) => {
    return node.data?.kleur || "#e2e8f0";
  }, []);

  return (
    <div className="editor-container">
      <Toolbar
        onAddNode={handleAddNode}
        onSave={handleSave}
        onLoad={handleLoad}
        onLoadSchema={handleLoadSchema}
        onToggleTestInvoer={() => setShowTestInvoer((v) => !v)}
        showTestInvoer={showTestInvoer}
        onExportMermaid={handleExportMermaid}
        onExportPlantUML={handleExportPlantUML}
        onExportXMI={handleExportXMI}
      />

      <div className="editor-main">
        {/* Het React Flow canvas — dit is waar de magie gebeurt */}
        <div className="editor-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{ type: "metamodel" }}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            {/* MiniMap: een klein overzichtskaartje rechtsonder */}
            <MiniMap nodeColor={minimapColor} zoomable pannable />

            {/* Controls: zoom in/out/fit knoppen */}
            <Controls />

            {/* Background: rasterpatroon op het canvas */}
            <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
          </ReactFlow>
        </div>

        {/* Sidebar: edit panel voor geselecteerde node of edge */}
        <div className="editor-sidebar">
          {selectedNode && (
            <NodeEditPanel
              node={selectedNode}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              datatypeNodes={datatypeNodes}
              enumNodes={enumNodes}
            />
          )}
          {selectedEdge && !selectedNode && (
            <EdgeEditPanel
              edge={selectedEdge}
              nodes={nodes}
              onUpdate={handleUpdateEdge}
              onDelete={handleDeleteEdge}
            />
          )}
          {!selectedNode && !selectedEdge && !showTestInvoer && (
            <div className="edit-panel empty">
              <p>Selecteer een type of relatie om te bewerken.</p>
              <p className="hint">
                Sleep vanuit een handle (●) naar een ander type om een relatie te
                maken.
              </p>
            </div>
          )}
          {showTestInvoer && (
            <TestInvoerPanel
              datatypeNodes={datatypeNodes}
              onClose={() => setShowTestInvoer(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
