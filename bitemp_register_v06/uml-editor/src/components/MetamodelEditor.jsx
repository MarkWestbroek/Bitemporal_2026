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
  editorNaarV3Model,
  schemaResponseNaarEditor,
  maakReferentielijstSet,
} from "../metamodel/types";
import { v3ModelNaarEditor } from "../metamodel/v3ModelNaarEditor";

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

export default function MetamodelEditor({ initialNodes = [], initialEdges = [], onV3ModelLoaded = null }) {
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
  const nodeTypeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n.type])),
    [nodes]
  );
  const datatypeNodes = useMemo(() => nodes.filter((n) => n.type === "gegevenstype"), [nodes]);
  const enumNodes = useMemo(() => nodes.filter((n) => n.type === "enumeratie"), [nodes]);
  const entiteitNodes = useMemo(() => nodes.filter((n) => n.type === "entiteit"), [nodes]);

  const swapConnectionDirection = useCallback((connection) => {
    return {
      ...connection,
      source: connection.target,
      target: connection.source,
      sourceHandle: connection.targetHandle,
      targetHandle: connection.sourceHandle,
    };
  }, []);

  const normalizeConnection = useCallback(
    (connection, currentEdges) => {
      const sourceType = nodeTypeById.get(connection.source);
      const targetType = nodeTypeById.get(connection.target);

      if (!sourceType || !targetType) {
        return connection;
      }

      // GE hoort altijd onder entiteit te hangen.
      if (sourceType === "gegevenselement" && targetType === "entiteit") {
        return swapConnectionDirection(connection);
      }

      // Enum/datatype dependency wijzen altijd van modeltype naar enum/datatype.
      if (
        (sourceType === "enumeratie" && targetType !== "enumeratie") ||
        (sourceType === "gegevenstype" && targetType !== "gegevenstype")
      ) {
        return swapConnectionDirection(connection);
      }

      // Entiteit-relatie: eerste koppeling = entiteit -> relatie (owner),
      // tweede koppeling = relatie -> entiteit (doel-entiteit).
      if (
        (sourceType === "entiteit" && targetType === "relatie") ||
        (sourceType === "relatie" && targetType === "entiteit")
      ) {
        const relatieId = sourceType === "relatie" ? connection.source : connection.target;
        const entiteitId = sourceType === "entiteit" ? connection.source : connection.target;

        const ownerEdge = currentEdges.find((e) => {
          if (e.type !== "metamodel") return false;
          if (e.target !== relatieId) return false;
          return nodeTypeById.get(e.source) === "entiteit";
        });

        if (!ownerEdge) {
          return {
            ...connection,
            source: entiteitId,
            target: relatieId,
          };
        }

        if (ownerEdge.source === entiteitId) {
          return {
            ...connection,
            source: entiteitId,
            target: relatieId,
          };
        }

        return {
          ...connection,
          source: relatieId,
          target: entiteitId,
        };
      }

      return connection;
    },
    [nodeTypeById, swapConnectionDirection]
  );

  /**
   * onConnect wordt aangeroepen wanneer een gebruiker een edge trekt
   * van een source handle naar een target handle.
   * addEdge() is een React Flow utility die de edge toevoegt aan de array.
   */
  const onConnect = useCallback(
    (connection) => {
      setEdges((eds) => {
        const normalized = normalizeConnection(connection, eds);
        const newEdge = {
          ...normalized,
          id: generateId("edge"),
          type: "metamodel",
          data: {
            rolnaam: "",
            jsonRolnaam: "",
            momentvoorkomen: "enkelvoudig",
            kardinaliteit: "0..1",
          },
        };
        return addEdge(newEdge, eds);
      });
    },
    [normalizeConnection, setEdges]
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

  /**
   * Voeg een volledige referentielijst-set toe: drie nodes (lijst, item, relatie) + twee edges.
   * Positioneert de nodes naast elkaar zodat ze visueel als groep herkenbaar zijn.
   * Zie Referentielijsten.md §7.
   */
  const handleAddReferentielijstSet = useCallback(() => {
    const set = maakReferentielijstSet();
    const baseX = 100 + Math.random() * 300;
    const baseY = 100 + Math.random() * 200;
    const newNodes = set.nodes.map((n, i) => ({
      id: n.data.id,
      type: n.type,
      position: { x: baseX + i * 280, y: baseY + (i === 2 ? 100 : 0) },
      data: n.data,
    }));
    setNodes((nds) => [...nds, ...newNodes]);
    setEdges((eds) => [...eds, ...set.edges]);
    setSelectedNodeId(newNodes[0].id);
    setSelectedEdgeId(null);
  }, [setNodes, setEdges]);

  /** Update de data van een bestaande node */
  const handleUpdateNode = useCallback(
    (nodeId, newData) => {
      setNodes((nds) => {
        const previousNode = nds.find((n) => n.id === nodeId) || null;
        const vorigeEnumNaam = previousNode?.type === "enumeratie" ? (previousNode.data?.naam || "") : "";
        const nieuweEnumNaam = previousNode?.type === "enumeratie" ? (newData?.naam || "") : "";
        const vorigeDatatypeNaam = previousNode?.type === "gegevenstype" ? (previousNode.data?.naam || "") : "";
        const nieuweDatatypeNaam = previousNode?.type === "gegevenstype" ? (newData?.naam || "") : "";
        // Ref.lijst item rename detectie (entiteit met subtype referentielijst_item)
        const isRefItem = previousNode?.type === "entiteit" && previousNode.data?.entiteitSubtype === "referentielijst_item";
        const vorigeRefItemNaam = isRefItem ? (previousNode.data?.typenaam || "") : "";
        const nieuweRefItemNaam = isRefItem ? (newData?.typenaam || "") : "";
        const isEnumRename =
          previousNode?.type === "enumeratie" &&
          vorigeEnumNaam !== "" &&
          vorigeEnumNaam !== nieuweEnumNaam;
        const isDatatypeRename =
          previousNode?.type === "gegevenstype" &&
          vorigeDatatypeNaam !== "" &&
          vorigeDatatypeNaam !== nieuweDatatypeNaam;
        const isRefItemRename =
          isRefItem &&
          vorigeRefItemNaam !== "" &&
          vorigeRefItemNaam !== nieuweRefItemNaam;

        const updatedNodes = nds.map((n) => {
          if (n.id !== nodeId) return n;
          // Als metatype veranderd is, verander ook het node type
          const newType = newData.metatype || n.type;
          return { ...n, type: newType, data: newData };
        }).map((n) => {
          if (!isEnumRename && !isDatatypeRename && !isRefItemRename) return n;
          if (n.id === nodeId) return n;
          if (!Array.isArray(n.data?.velden)) return n;

          let changed = false;
          const velden = n.data.velden.map((v) => {
            let next = v;

            if (isEnumRename && v.enumNaam === vorigeEnumNaam) {
              changed = true;
              next = { ...next, enumNaam: nieuweEnumNaam || null };
            }

            if (isDatatypeRename && v.datatypeNaam === vorigeDatatypeNaam) {
              changed = true;
              next = { ...next, datatypeNaam: nieuweDatatypeNaam || null };
            }

            // Propageer ref.lijst item hernoemen naar velden die ernaar verwijzen
            if (isRefItemRename && v.refItemNaam === vorigeRefItemNaam) {
              changed = true;
              next = { ...next, refItemNaam: nieuweRefItemNaam || null };
            }

            return next;
          });

          return changed ? { ...n, data: { ...n.data, velden } } : n;
        });

        // Houd dependency edges automatisch synchroon met enum- en refItem-veldtypes.
        setEdges((eds) => {
          const node = updatedNodes.find((n) => n.id === nodeId);
          if (!node) return eds;

          // Verzamel alle dependency targets: enum- en refItem-verwijzingen uit velden
          const enumTargets = (node.data?.velden || [])
            .map((v) => v.enumNaam)
            .filter(Boolean)
            .map((enumNaam) => {
              const enumNode = updatedNodes.find(
                (n) => n.type === "enumeratie" && n.data?.naam === enumNaam
              );
              return enumNode?.id || null;
            })
            .filter(Boolean);

          const refItemTargets = (node.data?.velden || [])
            .map((v) => v.refItemNaam)
            .filter(Boolean)
            .map((refItemNaam) => {
              const refNode = updatedNodes.find(
                (n) => n.type === "entiteit" && n.data?.entiteitSubtype === "referentielijst_item" && n.data?.typenaam === refItemNaam
              );
              return refNode?.id || null;
            })
            .filter(Boolean);

          const allTargets = new Set([...enumTargets, ...refItemTargets]);

          const existingDeps = eds.filter(
            (e) => e.source === nodeId && e.data?.isDependency === true
          );
          const keepIds = new Set(
            existingDeps
              .filter((e) => allTargets.has(e.target))
              .map((e) => e.id)
          );

          const withoutOldDeps = eds.filter(
            (e) => !(e.source === nodeId && e.data?.isDependency === true)
          );
          const keptDeps = existingDeps.filter((e) => keepIds.has(e.id));

          const existingTargets = new Set(keptDeps.map((e) => e.target));
          const newDeps = Array.from(allTargets)
            .filter((targetId) => !existingTargets.has(targetId))
            .map((targetId) => ({
              id: generateId("edge"),
              source: nodeId,
              target: targetId,
              type: "metamodel",
              data: {
                isDependency: true,
                rolnaam: "",
                jsonRolnaam: "",
                momentvoorkomen: "",
                kardinaliteit: "",
              },
            }));

          return [...withoutOldDeps, ...keptDeps, ...newDeps];
        });

        return updatedNodes;
      });
    },
    [setEdges, setNodes]
  );

  /** Verwijder een node en alle bijbehorende edges */
  const handleDeleteNode = useCallback(
    (nodeId) => {
      const nodeToDelete = nodes.find((n) => n.id === nodeId);
      if (!nodeToDelete) return;

      const verwijderType = nodeToDelete.type;
      const verwijderNaam = nodeToDelete.data?.naam || "";

      if (verwijderType === "enumeratie" || verwijderType === "gegevenstype") {
        const referenties = nodes
          .filter((n) => n.id !== nodeId && Array.isArray(n.data?.velden))
          .reduce((acc, n) => {
            const count = n.data.velden.filter((v) => {
              if (verwijderType === "enumeratie") {
                return v.enumNaam === verwijderNaam;
              }
              return v.datatypeNaam === verwijderNaam;
            }).length;
            return acc + count;
          }, 0);

        const label = verwijderType === "enumeratie" ? "enumeratie" : "gegevenstype";
        const naamTekst = verwijderNaam ? ` '${verwijderNaam}'` : "";
        const waarschuwing = referenties > 0
          ? `De ${label}${naamTekst} wordt nog ${referenties}x gebruikt in velden. Verwijderen en referenties opruimen?`
          : `Weet je zeker dat je de ${label}${naamTekst} wilt verwijderen?`;

        if (!window.confirm(waarschuwing)) {
          return;
        }

        if (referenties > 0) {
          const tweedeStap = `Laatste controle: je staat op het punt een gebruikte ${label}${naamTekst} te verwijderen. Dit haalt ${referenties} verwijzingen weg. Doorgaan?`;
          if (!window.confirm(tweedeStap)) {
            return;
          }
        }
      }

      setNodes((nds) => {
        const cleaned = nds
          .filter((n) => n.id !== nodeId)
          .map((n) => {
            if (!Array.isArray(n.data?.velden)) return n;
            const velden = n.data.velden.map((v) => {
              if (verwijderType === "enumeratie" && v.enumNaam === verwijderNaam) {
                return { ...v, enumNaam: null, enum: null };
              }
              if (verwijderType === "gegevenstype" && v.datatypeNaam === verwijderNaam) {
                return { ...v, datatypeNaam: null };
              }
              return v;
            });
            return { ...n, data: { ...n.data, velden } };
          });
        return cleaned;
      });
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      setSelectedNodeId(null);
    },
    [nodes, setNodes, setEdges]
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
    const v3Model = editorNaarV3Model(nodes, edges);
    const blob = new Blob([JSON.stringify(v3Model, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metamodel_v3.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  // Publiceer het actuele editor-model als proposed schema_versie via POST /api/schema/model.
  const handlePublishSchemaModel = useCallback(async () => {
    const v3Model = editorNaarV3Model(nodes, edges);

    const versieInput = prompt("Modelversie (verplicht):", v3Model.versie || "v3");
    if (versieInput === null) return;
    const versie = versieInput.trim();
    if (!versie) {
      alert("Publiceren geannuleerd: versie is verplicht.");
      return;
    }

    const naamInput = prompt("Modelnaam (verplicht):", v3Model.naam || "Editor export");
    if (naamInput === null) return;
    const naam = naamInput.trim();
    if (!naam) {
      alert("Publiceren geannuleerd: naam is verplicht.");
      return;
    }

    const indienerInput = prompt("Indiener (verplicht):", "uml-editor-v2");
    if (indienerInput === null) return;
    const indiener = indienerInput.trim();
    if (!indiener) {
      alert("Publiceren geannuleerd: indiener is verplicht.");
      return;
    }

    const opmerkingInput = prompt("Opmerking (optioneel):", "");
    if (opmerkingInput === null) return;
    const opmerking = opmerkingInput.trim();

    const defaultUrl =
      window.location.port === "5174"
        ? "http://localhost:8082/api/schema/model"
        : "/api/schema/model";
    const endpointInput = prompt("Schema POST endpoint:", defaultUrl);
    if (!endpointInput) return;

    const endpoint = new URL(endpointInput, window.location.origin);
    if (opmerking) {
      endpoint.searchParams.set("opmerking", opmerking);
    }

    const payload = {
      bron: "uml-editor-v2",
      indiener,
      model: {
        ...v3Model,
        versie,
        naam,
      },
    };

    try {
      const response = await fetch(endpoint.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      let body = null;
      try {
        body = rawText ? JSON.parse(rawText) : null;
      } catch {
        body = null;
      }

      if (!response.ok) {
        const message = body?.error || `HTTP ${response.status}`;
        const details = body?.details ? `\nDetails: ${body.details}` : "";
        throw new Error(`${message}${details}`);
      }

      const nieuwId = body?.id ?? "(onbekend)";
      alert(`Schema-model opgeslagen als proposed versie met ID ${nieuwId}.`);
    } catch (err) {
      console.error("Publiceren schema-model mislukt:", err);
      alert(`Publiceren mislukt: ${err.message}`);
    }
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
            return;
          }

          // Ondersteun V3 payloads: direct model of wrapper met top-level model.
          const maybeV3 = payload?.model && payload.model.entiteiten ? payload.model : payload;
          if (maybeV3 && maybeV3.entiteiten) {
            const result = v3ModelNaarEditor(maybeV3);
            setNodes(result.nodes || []);
            setEdges(result.edges || []);
            return;
          }

          throw new Error("Onbekend JSON-formaat: verwacht flowState of V3 model met entiteiten");
        } catch (err) {
          console.error("Laden mislukt:", err);
          alert(`Laden mislukt: ${err.message}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges]);

  /** Laad vanuit model/schema-API van de backend (V3 model aanbevolen) */
  const handleLoadSchema = useCallback(() => {
    const defaultUrl =
      window.location.port === "5174"
        ? "http://localhost:8082/api/schema/model"
        : "/api/schema/model";
    const url = prompt(
      "Model-API URL (V3):",
      defaultUrl
    );
    if (!url) return;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const maybeV3 = data?.model && data.model.entiteiten ? data.model : data;
        if (maybeV3 && maybeV3.entiteiten) {
          const result = v3ModelNaarEditor(maybeV3);
          setNodes(result.nodes || []);
          setEdges(result.edges || []);
          if (typeof onV3ModelLoaded === "function") {
            onV3ModelLoaded(data, url);
          }
          return;
        }

        // Fallback voor oudere schema-responses (legacy /schema of /api/viz/schema varianten).
        const { nodes: newNodes, edges: newEdges } = schemaResponseNaarEditor(data);
        setNodes(newNodes);
        setEdges(newEdges);
      })
      .catch((err) => {
        console.error("Model/schema laden mislukt:", err);
        alert(`Kan model/schema niet laden: ${err.message}`);
      });
  }, [setNodes, setEdges, onV3ModelLoaded]);

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
        onAddReferentielijstSet={handleAddReferentielijstSet}
        onSave={handleSave}
        onPublishSchemaModel={handlePublishSchemaModel}
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
                entiteitNodes={entiteitNodes}
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
