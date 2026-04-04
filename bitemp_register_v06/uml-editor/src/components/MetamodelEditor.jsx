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
  Panel,
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
import ReferentielijstInstantieNode from "./nodes/ReferentielijstInstantieNode";

// Custom edge
import MetamodelEdge from "./edges/MetamodelEdge";

// Panels
import NodeEditPanel from "./panels/NodeEditPanel";
import EdgeEditPanel from "./panels/EdgeEditPanel";
import Toolbar from "./panels/Toolbar";
import TestInvoerPanel from "./panels/TestInvoerPanel";
import ActionDialog from "./panels/ActionDialog";

// Overlays
import DomeinBoundaryOverlay from "./overlays/DomeinBoundaryOverlay";

// Export helpers
import { exportNaarMermaid } from "../export/exportMermaid";
import { exportNaarPlantUML } from "../export/exportPlantUML";
import { exportNaarXMI } from "../export/exportXMI";

// Import helpers
import { importVanXMI } from "../import/importXMI";
import { importVanMermaid } from "../import/importMermaid";
import { importVanPlantUML } from "../import/importPlantUML";

// Data helpers
import {
  generateId,
  editorNaarV3Model,
  schemaResponseNaarEditor,
  maakReferentielijstSet,
  maakReferentielijstInstantie,
} from "../metamodel/types";
import { v3ModelNaarEditor } from "../metamodel/v3ModelNaarEditor";
import { bepaalDependencyTargetIds } from "../metamodel/dependencyEdges";

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
  referentielijstInstantie: ReferentielijstInstantieNode,
};

const edgeTypes = {
  metamodel: MetamodelEdge,
};

/**
 * Bereken welke handle-combinatie (source + target) de kortste lijn oplevert
 * tussen twee nodes, rekening houdend met node-afmetingen.
 * Gebruikt het midden van elke zijde als ankerpunt.
 */
const HANDLE_POSITIES = ["top", "bottom", "left", "right"];

function berekenKortsteHandles(srcNode, tgtNode) {
  const srcW = srcNode.measured?.width ?? srcNode.width ?? 180;
  const srcH = srcNode.measured?.height ?? srcNode.height ?? 120;
  const tgtW = tgtNode.measured?.width ?? tgtNode.width ?? 180;
  const tgtH = tgtNode.measured?.height ?? tgtNode.height ?? 120;

  function ankerpunt(node, w, h, handle) {
    const x = node.position.x;
    const y = node.position.y;
    switch (handle) {
      case "top":    return { x: x + w / 2, y: y };
      case "bottom": return { x: x + w / 2, y: y + h };
      case "left":   return { x: x,         y: y + h / 2 };
      case "right":  return { x: x + w,     y: y + h / 2 };
    }
  }

  let best = { sourceHandle: "bottom", targetHandle: "top", dist: Infinity };
  for (const sh of HANDLE_POSITIES) {
    for (const th of HANDLE_POSITIES) {
      const a = ankerpunt(srcNode, srcW, srcH, sh);
      const b = ankerpunt(tgtNode, tgtW, tgtH, th);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < best.dist) {
        best = { sourceHandle: sh, targetHandle: th, dist: d };
      }
    }
  }
  return best;
}

function bepaalEffectiefDomeinPerNode(nodes, edges) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const cache = new Map();

  function resolve(nodeId, visiting = new Set()) {
    if (cache.has(nodeId)) return cache.get(nodeId) || "";
    if (visiting.has(nodeId)) return "";
    visiting.add(nodeId);

    const node = nodeById.get(nodeId);
    let domein = node?.data?.domein || "";

    if (!domein) {
      const inkomendeEdges = edges.filter(
        (e) => e?.type === "metamodel" && !e?.data?.isDependency && e.target === nodeId
      );
      for (const edge of inkomendeEdges) {
        const bronNode = nodeById.get(edge.source);
        const bronType = bronNode?.type || "";
        if (bronType === "entiteit" || bronType === "referentielijstInstantie") {
          domein = resolve(edge.source, visiting);
          if (domein) break;
        }
      }
    }

    visiting.delete(nodeId);
    cache.set(nodeId, domein || "");
    return domein || "";
  }

  for (const node of nodes) {
    resolve(node.id);
  }
  return cache;
}

function vulOntbrekendeDomeinenOpNodes(nodes, edges) {
  const effectiefPerNode = bepaalEffectiefDomeinPerNode(nodes, edges);
  return nodes.map((node) => {
    const bestaand = node?.data?.domein || "";
    const effectief = bestaand || effectiefPerNode.get(node.id) || "";
    if (effectief === bestaand) return node;
    return {
      ...node,
      data: {
        ...node.data,
        domein: effectief,
      },
    };
  });
}

export default function MetamodelEditor({ initialNodes = [], initialEdges = [], onV3ModelLoaded = null, modelNaam = "", modelBron = "", modelOpmerking = "" }) {
  /**
   * useNodesState en useEdgesState zijn React Flow hooks:
   *   - nodes/edges: de huidige array
   *   - setNodes/setEdges: directe setter
   *   - onNodesChange/onEdgesChange: event handler voor drag, select, delete, etc.
   *
   * React Flow stuurt "changes" (position change, selection change, remove) naar
   * deze handlers, die de state automatisch bijwerken.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState(
    vulOntbrekendeDomeinenOpNodes(initialNodes, initialEdges)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Track welke node of edge geselecteerd is voor het edit panel
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [showTestInvoer, setShowTestInvoer] = useState(false);
  const [laatstGepubliceerdSchemaID, setLaatstGepubliceerdSchemaID] = useState(null);
  const [actieDialoog, setActieDialoog] = useState(null);
  const [actiefDomein, setActiefDomein] = useState(null); // null = alles tonen

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;
  const nodeTypeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n.type])),
    [nodes]
  );
  const datatypeNodes = useMemo(() => nodes.filter((n) => n.type === "gegevenstype"), [nodes]);
  const enumNodes = useMemo(() => nodes.filter((n) => n.type === "enumeratie"), [nodes]);
  const entiteitNodes = useMemo(() => nodes.filter((n) => n.type === "entiteit"), [nodes]);

  const effectiefDomeinPerNode = useMemo(() => {
    return bepaalEffectiefDomeinPerNode(nodes, edges);
  }, [nodes, edges]);

  // Verzamel unieke domeinen uit alle nodes voor de domein-selector
  const beschikbareDomeinen = useMemo(() => {
    const set = new Set();
    for (const n of nodes) {
      const d = effectiefDomeinPerNode.get(n.id) || n.data?.domein || "";
      if (d) set.add(d);
    }
    return [...set].sort();
  }, [nodes, effectiefDomeinPerNode]);

  const domeinSelectieActief = useMemo(() => {
    if (!actiefDomein) return false;
    const actieveNodes = nodes.filter(
      (n) => (effectiefDomeinPerNode.get(n.id) || n.data?.domein || "") === actiefDomein
    );
    return actieveNodes.length > 0 && actieveNodes.every((n) => !!n.selected);
  }, [nodes, actiefDomein, effectiefDomeinPerNode]);

  // Toggle selectie van alle nodes van het actieve domein en houd de toolbar-indicator synchroon.
  const handleSelecteerDomein = useCallback(() => {
    if (!actiefDomein) return;
    const moetSelecteren = !domeinSelectieActief;
    setNodes((nds) =>
      nds.map((n) => {
        const hoortBijActiefDomein = (effectiefDomeinPerNode.get(n.id) || n.data?.domein || "") === actiefDomein;
        return {
          ...n,
          selected: hoortBijActiefDomein ? moetSelecteren : false,
        };
      })
    );
  }, [actiefDomein, domeinSelectieActief, setNodes, effectiefDomeinPerNode]);

  const applyLoadedGraph = useCallback((result) => {
    const nextEdges = result?.edges || [];
    const nextNodes = vulOntbrekendeDomeinenOpNodes(result?.nodes || [], nextEdges);
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [setNodes, setEdges]);

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

      // Referentielijst-instantie → relatie (items-relatie): instantie is altijd bron.
      if (
        (sourceType === "referentielijstInstantie" && targetType === "relatie") ||
        (sourceType === "relatie" && targetType === "referentielijstInstantie")
      ) {
        const instantieId = sourceType === "referentielijstInstantie"
          ? connection.source : connection.target;
        const relatieId = sourceType === "relatie"
          ? connection.source : connection.target;
        return { ...connection, source: instantieId, target: relatieId };
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
          const ownerType = nodeTypeById.get(e.source);
          return ownerType === "entiteit" || ownerType === "referentielijstInstantie";
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

  /**
   * Dubbelklik op een edge: optimaliseer de handle-posities zodat de lijn
   * zo kort mogelijk is, gegeven de actuele positie van de twee nodes.
   */
  const onEdgeDoubleClick = useCallback(
    (_event, edge) => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edge.id) return e;
          const srcNode = nodes.find((n) => n.id === e.source);
          const tgtNode = nodes.find((n) => n.id === e.target);
          if (!srcNode || !tgtNode) return e;

          const best = berekenKortsteHandles(srcNode, tgtNode);
          return { ...e, sourceHandle: best.sourceHandle, targetHandle: best.targetHandle };
        })
      );
    },
    [nodes, setEdges]
  );

  // === Node CRUD ===

  /** Voeg een nieuw type (node) toe op een willekeurige positie */
  const handleAddNode = useCallback(
    (data, type) => {
      // Ken automatisch het actieve domein toe aan nieuwe nodes
      const nodeData = actiefDomein && !data.domein
        ? { ...data, domein: actiefDomein }
        : data;
      const newNode = {
        id: nodeData.id || data.id,
        type,
        position: {
          x: 100 + Math.random() * 400,
          y: 100 + Math.random() * 300,
        },
        data: nodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(data.id);
      setSelectedEdgeId(null);
    },
    [setNodes, actiefDomein]
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

  /**
   * Voeg een referentielijst-instantie node toe.
   * Een instantie vertegenwoordigt een specifiek record van de Referentielijst-klasse.
   */
  const handleAddReferentielijstInstantie = useCallback(() => {
    const data = maakReferentielijstInstantie();
    const newNode = {
      id: data.id,
      type: "referentielijstInstantie",
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 200 },
      data,
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(data.id);
    setSelectedEdgeId(null);
  }, [setNodes]);

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

          // Houd alle «use»-dependencies synchroon: enum, datatype én refItem.
          // Hierdoor blijft een bestaand datatype-lijntje ook staan als je alleen
          // een afgeleid veld of beschrijving aanpast.
          const allTargets = new Set(bepaalDependencyTargetIds(node.data, updatedNodes));

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

  /**
   * handleSetSupertype — stel de supertype-relatie in voor een node via een
   * generalisatie-edge (subtype → supertype). Verwijdert bestaande generalisatie-
   * edges vanuit deze node en voegt eventueel een nieuwe toe.
   */
  const handleSetSupertype = useCallback(
    (nodeId, supertypeNodeId) => {
      setEdges((eds) => {
        const filtered = eds.filter(
          (e) => !(e.source === nodeId && e.data?.isGeneralization)
        );
        if (!supertypeNodeId) return filtered;
        return [
          ...filtered,
          {
            id: generateId("edge"),
            source: nodeId,
            target: supertypeNodeId,
            type: "metamodel",
            data: { isGeneralization: true },
          },
        ];
      });
    },
    [setEdges]
  );

  // === Opslaan / Laden ===

  // Bepaal de standaard API-basis. Bij lokaal Vite-deven wijzen we standaard
  // naar de devloop-container op :8182 zodat deze naast de gewone app op :8082 kan draaien.
  const getDefaultApiBase = useCallback(() => {
    if (["5173", "5174", "5175"].includes(window.location.port)) {
      return "http://localhost:8182";
    }
    return window.location.origin;
  }, []);

  const bepaalStandaardDomeinEnPrefix = useCallback((v3Model) => {
    const domeinen = [
      ...((v3Model?.entiteiten || []).map((item) => item?.domein).filter(Boolean)),
      ...((v3Model?.entiteiten || []).flatMap((ent) => (ent?.gegevenselementen || []).map((ge) => ge?.domein)).filter(Boolean)),
      ...((v3Model?.entiteiten || []).flatMap((ent) => (ent?.relaties || []).map((rel) => rel?.domein)).filter(Boolean)),
      ...((v3Model?.datatypes || []).map((item) => item?.domein).filter(Boolean)),
      ...((v3Model?.enums || []).map((item) => item?.domein).filter(Boolean)),
    ];

    const domein = domeinen.find((value) => value && value !== "register") || domeinen[0] || "register";
    return {
      domein,
      prefix: domein.replace(/-/g, "_"),
    };
  }, []);

  const maakVoorstelBestandsnaam = useCallback((v3Model) => {
    const basis = (v3Model?.naam || "metamodel_v3")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "metamodel_v3";
    return basis.toLowerCase().endsWith(".json") ? basis : `${basis}.json`;
  }, []);

  // Bouw een lijst van beschikbare domeinen met hun prefix en mode.
  // Gecombineerd uit: domeinen in het huidige model + optioneel opgehaald van de DB API.
  const bouwBeschikbareDomeinen = useCallback(async (v3Model, apiBase) => {
    // Stap 1: Verzamel unieke domeinen uit het V3 model.
    const domeinenUitModel = new Set();
    for (const ent of v3Model?.entiteiten || []) {
      if (ent?.domein) domeinenUitModel.add(ent.domein);
    }
    for (const dt of v3Model?.datatypes || []) {
      if (dt?.domein) domeinenUitModel.add(dt.domein);
    }
    for (const en of v3Model?.enums || []) {
      if (en?.domein) domeinenUitModel.add(en.domein);
    }

    // Stap 2: Probeer ook domeinen uit de API op te halen (DB).
    const domeinenUitDB = new Set();
    try {
      const resp = await fetch(new URL("/api/schema/domeinen", apiBase).toString());
      if (resp.ok) {
        const data = await resp.json();
        for (const d of data?.domeinen || []) {
          if (d?.naam) {
            domeinenUitDB.add(d.naam);
            domeinenUitModel.add(d.naam);
          }
        }
      }
    } catch {
      // Niet beschikbaar — geen probleem, we gebruiken wat we uit het model weten.
    }

    // Stap 3: Sorteer: "register" eerst (basisfundament), dan rest alfabetisch.
    const gesorteerd = [...domeinenUitModel].sort((a, b) => {
      if (a === "register") return -1;
      if (b === "register") return 1;
      return a.localeCompare(b);
    });

    // Stap 4: Bouw de lijst met standaard prefix en mode.
    // Alle domeinen gebruiken additive mode met een prefix afgeleid van de domeinnaam.
    return gesorteerd.map((naam) => {
      return {
        naam,
        prefix: naam.replace(/-/g, "_"),
        mode: "additive",
        geselecteerd: true,
      };
    });
  }, []);

  const openActieDialoog = useCallback(async (type) => {
    const v3Model = editorNaarV3Model(nodes, edges);
    const { domein, prefix } = bepaalStandaardDomeinEnPrefix(v3Model);
    const apiBase = getDefaultApiBase();

    if (type === "save") {
      setActieDialoog({
        type,
        title: "Model opslaan als JSON",
        submitLabel: "Opslaan",
        values: {
          bestandsnaam: maakVoorstelBestandsnaam(v3Model),
        },
      });
      return;
    }

    if (type === "publish") {
      setActieDialoog({
        type,
        title: "Schema-model publiceren",
        submitLabel: "Publiceren",
        values: {
          versie: v3Model.versie || "v3",
          naam: v3Model.naam || "Editor export",
          indiener: "uml-editor-v2",
          opmerking: "",
          apiBase,
        },
      });
      return;
    }

    // Voor rebuild en publishAndRebuild: bouw domeinlijst op.
    const beschikbareDomeinen = await bouwBeschikbareDomeinen(v3Model, apiBase);

    if (type === "publishAndRebuild") {
      setActieDialoog({
        type,
        title: "Publiceer en rebuild exact dit model",
        submitLabel: "Publiceer + rebuild",
        values: {
          versie: v3Model.versie || "v3",
          naam: v3Model.naam || "Editor export",
          indiener: "uml-editor-v2",
          opmerking: "",
          apiBase,
          wachtwoord: "1234",
          schemaVersieID: laatstGepubliceerdSchemaID ? String(laatstGepubliceerdSchemaID) : "",
          beschikbareDomeinen,
        },
      });
      return;
    }

    setActieDialoog({
      type: "rebuild",
      title: "Rebuild devloop-register",
      submitLabel: "Rebuild starten",
      values: {
        bron: laatstGepubliceerdSchemaID ? "id" : "editor",
        schemaVersieID: laatstGepubliceerdSchemaID ? String(laatstGepubliceerdSchemaID) : "",
        apiBase,
        wachtwoord: "1234",
        beschikbareDomeinen,
      },
    });
  }, [bepaalStandaardDomeinEnPrefix, bouwBeschikbareDomeinen, getDefaultApiBase, laatstGepubliceerdSchemaID, maakVoorstelBestandsnaam, nodes, edges]);

  const sluitActieDialoog = useCallback(() => {
    setActieDialoog(null);
  }, []);

  const wijzigActieDialoogVeld = useCallback((veld, waarde) => {
    setActieDialoog((current) => {
      if (!current) return current;
      return {
        ...current,
        values: {
          ...current.values,
          [veld]: waarde,
        },
      };
    });
  }, []);

  const voerSaveUit = useCallback((values) => {
    let bestandsnaam = (values?.bestandsnaam || "").trim();
    if (!bestandsnaam) {
      alert("Opslaan geannuleerd: bestandsnaam is verplicht.");
      return false;
    }
    if (!bestandsnaam.toLowerCase().endsWith(".json")) {
      bestandsnaam += ".json";
    }

    const v3Model = editorNaarV3Model(nodes, edges);
    const blob = new Blob([JSON.stringify(v3Model, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = bestandsnaam;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }, [nodes, edges]);

  const publiceerSchemaModel = useCallback(async (values, { stilNaSucces = false } = {}) => {
    const v3Model = editorNaarV3Model(nodes, edges);
    const versie = (values?.versie || "").trim();
    const naam = (values?.naam || "").trim();
    const indiener = (values?.indiener || "").trim();
    const opmerking = (values?.opmerking || "").trim();
    const apiBase = (values?.apiBase || getDefaultApiBase()).trim();

    if (!versie || !naam || !indiener || !apiBase) {
      alert("Publiceren geannuleerd: versie, naam, indiener en API basis zijn verplicht.");
      return null;
    }

    const endpoint = new URL("/api/schema/model", apiBase);
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

      const nieuwId = Number(body?.id);
      if (Number.isInteger(nieuwId) && nieuwId > 0) {
        setLaatstGepubliceerdSchemaID(nieuwId);
      }

      if (!stilNaSucces) {
        alert(`Schema-model opgeslagen als proposed versie met ID ${body?.id ?? "(onbekend)"}.`);
      }

      return {
        schemaVersieID: Number.isInteger(nieuwId) && nieuwId > 0 ? nieuwId : null,
        v3Model,
      };
    } catch (err) {
      console.error("Publiceren schema-model mislukt:", err);
      alert(`Publiceren mislukt: ${err.message}`);
      return null;
    }
  }, [getDefaultApiBase, nodes, edges]);

  const voerRebuildUit = useCallback(async ({ bron, schemaVersieID = null, modelOverride = null, beschikbareDomeinen = [], apiBase = "", wachtwoord = "1234" }) => {
    const rauwModel = modelOverride || editorNaarV3Model(nodes, edges);
    const effectieveBron = (bron || "editor").trim().toLowerCase();
    const effectieveApiBase = (apiBase || getDefaultApiBase()).trim();
    const effectiefWachtwoord = (wachtwoord || "").trim();

    if (!effectieveApiBase || !effectiefWachtwoord) {
      alert("Rebuild geannuleerd: API basis en wachtwoord zijn verplicht.");
      return false;
    }

    // Bouw de multi-domein specificatie op uit de geselecteerde domeinen.
    const geselecteerdeDomeinen = (beschikbareDomeinen || []).filter((d) => d.geselecteerd);
    if (geselecteerdeDomeinen.length === 0) {
      alert("Rebuild geannuleerd: selecteer minstens één domein.");
      return false;
    }

    const endpoint = new URL(`/admin/rebuild/${encodeURIComponent(effectiefWachtwoord)}`, effectieveApiBase);
    const payload = {
      domeinen: geselecteerdeDomeinen.map((d) => ({
        domein: d.naam,
        prefix: d.prefix,
        mode: d.mode || "additive",
      })),
    };

    if (effectieveBron === "editor") {
      payload.model = rauwModel;
    } else if (effectieveBron === "id") {
      const gekozenSchemaVersieID = Number(schemaVersieID);
      if (!Number.isInteger(gekozenSchemaVersieID) || gekozenSchemaVersieID <= 0) {
        alert("Rebuild geannuleerd: voer een geldig positief schema-versie ID in.");
        return false;
      }
      payload.schema_versie_id = gekozenSchemaVersieID;
    } else if (effectieveBron === "actief" || effectieveBron === "active") {
      payload.schema_bron = "actief";
    } else if (effectieveBron === "latest_proposed" || effectieveBron === "proposed" || effectieveBron === "laatste" || effectieveBron === "latest") {
      payload.schema_bron = "latest_proposed";
    } else {
      alert("Onbekende rebuild-bron. Gebruik: editor, actief, latest_proposed of id.");
      return false;
    }

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
        throw new Error(message);
      }

      const domeinNamen = geselecteerdeDomeinen.map((d) => d.naam).join(", ");
      const idTekst = Number.isInteger(Number(schemaVersieID)) && Number(schemaVersieID) > 0 ? ` (schema ID ${schemaVersieID})` : "";
      alert(
        `Rebuild gestart via bron '${effectieveBron}'${idTekst} voor ${geselecteerdeDomeinen.length} domein(en): ${domeinNamen}. Bij een succesvolle build herstart de devloop-API automatisch.`
      );
      return true;
    } catch (err) {
      console.error("Rebuild mislukt:", err);
      alert(`Rebuild mislukt: ${err.message}`);
      return false;
    }
  }, [getDefaultApiBase, nodes, edges]);

  const submitActieDialoog = useCallback(async () => {
    if (!actieDialoog) return;

    if (actieDialoog.type === "save") {
      if (voerSaveUit(actieDialoog.values)) {
        sluitActieDialoog();
      }
      return;
    }

    if (actieDialoog.type === "publish") {
      const result = await publiceerSchemaModel(actieDialoog.values);
      if (result) {
        sluitActieDialoog();
      }
      return;
    }

    if (actieDialoog.type === "rebuild") {
      const ok = await voerRebuildUit({
        bron: actieDialoog.values.bron,
        schemaVersieID: actieDialoog.values.schemaVersieID,
        beschikbareDomeinen: actieDialoog.values.beschikbareDomeinen,
        apiBase: actieDialoog.values.apiBase,
        wachtwoord: actieDialoog.values.wachtwoord,
      });
      if (ok) {
        sluitActieDialoog();
      }
      return;
    }

    if (actieDialoog.type === "publishAndRebuild") {
      const result = await publiceerSchemaModel(actieDialoog.values, { stilNaSucces: true });
      if (!result) return;

      const ok = await voerRebuildUit({
        bron: "id",
        schemaVersieID: result.schemaVersieID,
        modelOverride: result.v3Model,
        beschikbareDomeinen: actieDialoog.values.beschikbareDomeinen,
        apiBase: actieDialoog.values.apiBase,
        wachtwoord: actieDialoog.values.wachtwoord,
      });
      if (ok) {
        sluitActieDialoog();
      }
    }
  }, [actieDialoog, publiceerSchemaModel, sluitActieDialoog, voerRebuildUit, voerSaveUit]);

  const handleSave = useCallback(() => openActieDialoog("save"), [openActieDialoog]);
  const handlePublishSchemaModel = useCallback(() => openActieDialoog("publish"), [openActieDialoog]);
  const handleRebuildModel = useCallback(() => openActieDialoog("rebuild"), [openActieDialoog]);
  const handlePublishAndRebuild = useCallback(() => openActieDialoog("publishAndRebuild"), [openActieDialoog]);

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
            applyLoadedGraph(payload.flowState || {});
            return;
          }

          // Ondersteun V3 payloads: direct model of wrapper met top-level model.
          const maybeV3 = payload?.model && payload.model.entiteiten ? payload.model : payload;
          if (maybeV3 && maybeV3.entiteiten) {
            const result = v3ModelNaarEditor(maybeV3);
            applyLoadedGraph(result);
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
  }, [applyLoadedGraph]);

  /** Laad vanuit model/schema-API van de backend (V3 model aanbevolen) */
  const handleLoadSchema = useCallback(() => {
    const defaultUrl = `${getDefaultApiBase()}/api/schema/model/code`;
    const url = prompt(
      "Model-API URL (V3, standaard = code):",
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
          applyLoadedGraph(result);
          if (typeof onV3ModelLoaded === "function") {
            onV3ModelLoaded(data, url);
          }
          return;
        }

        // Fallback voor oudere schema-responses (legacy /schema of /api/viz/schema varianten).
        const { nodes: newNodes, edges: newEdges } = schemaResponseNaarEditor(data);
        applyLoadedGraph({ nodes: newNodes, edges: newEdges });
      })
      .catch((err) => {
        console.error("Model/schema laden mislukt:", err);
        alert(`Kan model/schema niet laden: ${err.message}`);
      });
  }, [getDefaultApiBase, applyLoadedGraph, onV3ModelLoaded]);

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

  // ── Import handlers ──────────────────────────────────────────

  /** Generiek: lees een bestand van schijf en retourneer de inhoud als tekst via een Promise. */
  const leesBestandAlsTekst = useCallback((accept) => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.readAsText(file);
      };
      input.click();
    });
  }, []);

  const handleImportXMI = useCallback(async () => {
    const text = await leesBestandAlsTekst(".xmi,.xml");
    if (!text) return;
    try {
      const result = importVanXMI(text);
      applyLoadedGraph(result);
    } catch (err) {
      console.error("XMI import mislukt:", err);
      alert(`XMI import mislukt: ${err.message}`);
    }
  }, [leesBestandAlsTekst, applyLoadedGraph]);

  const handleImportMermaid = useCallback(async () => {
    const text = await leesBestandAlsTekst(".mmd,.md,.txt");
    if (!text) return;
    try {
      const result = importVanMermaid(text);
      applyLoadedGraph(result);
    } catch (err) {
      console.error("Mermaid import mislukt:", err);
      alert(`Mermaid import mislukt: ${err.message}`);
    }
  }, [leesBestandAlsTekst, applyLoadedGraph]);

  const handleImportPlantUML = useCallback(async () => {
    const text = await leesBestandAlsTekst(".puml,.plantuml,.txt");
    if (!text) return;
    try {
      const result = importVanPlantUML(text);
      applyLoadedGraph(result);
    } catch (err) {
      console.error("PlantUML import mislukt:", err);
      alert(`PlantUML import mislukt: ${err.message}`);
    }
  }, [leesBestandAlsTekst, applyLoadedGraph]);

  /**
   * MiniMap nodeColor: kleurt de minimap-nodes op basis van het metatype.
   * Dit is een React Flow prop die een functie accepteert.
   */
  const minimapColor = useCallback((node) => {
    return node.data?.kleur || "#e2e8f0";
  }, []);

  // Pas dimming toe op nodes die niet bij het actieve domein horen
  const visueleNodes = useMemo(() => {
    if (!actiefDomein) return nodes;
    return nodes.map((n) => {
      const nodeDomein = effectiefDomeinPerNode.get(n.id) || n.data?.domein || "";
      const isActief = nodeDomein === actiefDomein;
      return {
        ...n,
        className: isActief ? "" : "domein-inactief",
      };
    });
  }, [nodes, actiefDomein, effectiefDomeinPerNode]);

  // Bereken bounding box van alle nodes in het actieve domein (voor de boundary-overlay)
  const domeinBoundary = useMemo(() => {
    if (!actiefDomein) return null;
    const actieveNodes = nodes.filter((n) => (effectiefDomeinPerNode.get(n.id) || n.data?.domein || "") === actiefDomein);
    if (actieveNodes.length === 0) return null;
    const PADDING = 30;
    // Schat node-breedte en -hoogte (React Flow geeft geen measured size in state)
    const NODE_W = 220;
    const NODE_H = 120;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of actieveNodes) {
      const x = n.position?.x ?? 0;
      const y = n.position?.y ?? 0;
      const w = n.measured?.width ?? NODE_W;
      const h = n.measured?.height ?? NODE_H;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }
    return {
      x: minX - PADDING,
      y: minY - PADDING,
      width: maxX - minX + 2 * PADDING,
      height: maxY - minY + 2 * PADDING,
    };
  }, [nodes, actiefDomein, effectiefDomeinPerNode]);

  return (
    <div className="editor-container">
      <Toolbar
        onAddNode={handleAddNode}
        onAddReferentielijstSet={handleAddReferentielijstSet}
        onAddReferentielijstInstantie={handleAddReferentielijstInstantie}
        onSave={handleSave}
        onPublishSchemaModel={handlePublishSchemaModel}
        onPublishAndRebuild={handlePublishAndRebuild}
        onRebuildModel={handleRebuildModel}
        onLoad={handleLoad}
        onLoadSchema={handleLoadSchema}
        onToggleTestInvoer={() => setShowTestInvoer((v) => !v)}
        showTestInvoer={showTestInvoer}
        onExportMermaid={handleExportMermaid}
        onExportPlantUML={handleExportPlantUML}
        onExportXMI={handleExportXMI}
        onImportXMI={handleImportXMI}
        onImportMermaid={handleImportMermaid}
        onImportPlantUML={handleImportPlantUML}
        modelNaam={modelNaam}
        modelBron={modelBron}
        modelOpmerking={modelOpmerking}
        actiefDomein={actiefDomein}
        beschikbareDomeinen={beschikbareDomeinen}
        domeinSelectieActief={domeinSelectieActief}
        onSetActiefDomein={setActiefDomein}
        onSelecteerDomein={handleSelecteerDomein}
      />

      <ActionDialog
        dialog={actieDialoog}
        onChange={wijzigActieDialoogVeld}
        onClose={sluitActieDialoog}
        onSubmit={submitActieDialoog}
      />

      <div className="editor-main">
        {/* Het React Flow canvas — dit is waar de magie gebeurt */}
        <div className="editor-canvas">
          <ReactFlow
            nodes={visueleNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{ type: "metamodel" }}
            deleteKeyCode={["Backspace", "Delete"]}
            selectionKeyCode="Shift"
            selectionMode="partial"
            multiSelectionKeyCode="Control"
          >
            {/* MiniMap: een klein overzichtskaartje rechtsonder */}
            <MiniMap nodeColor={minimapColor} zoomable pannable />

            {/* Controls: zoom in/out/fit knoppen */}
            <Controls />

            {/* Background: rasterpatroon op het canvas */}
            <Background variant={BackgroundVariant.Dots} gap={15} size={1} />

            {/* Domein boundary: gestippelde rectangle om actief domein */}
            <DomeinBoundaryOverlay boundary={domeinBoundary} domein={actiefDomein} />
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
              allNodes={nodes}
              edges={edges}
              onSetSupertype={handleSetSupertype}
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
              <p className="hint">
                <strong>Dubbelklik</strong> op een lijn om de kortste route te berekenen.
              </p>
              <p className="hint">
                <strong>Shift + sleep</strong> op het canvas om meerdere elementen te selecteren.
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
