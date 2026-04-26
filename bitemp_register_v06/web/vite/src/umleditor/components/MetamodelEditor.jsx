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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import AssociatieAnkerNode from "./nodes/AssociatieAnkerNode";
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
import ContextMenu from "./ContextMenu";

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
  maakLeegType,
  maakReferentielijstSet,
  maakReferentielijstInstantie,
  EDGE_MODES,
} from "../metamodel/types";
import { v3ModelNaarEditor } from "../metamodel/v3ModelNaarEditor";
import { bepaalDependencyTargetIds } from "../metamodel/dependencyEdges";
import { validateV3Model } from "../../validation/validateV3Model";

/**
 * nodeTypes vertelt React Flow welke React-component bij welk node type hoort.
 * Dit object moet BUITEN de component staan (of useMemo) om infinite re-renders
 * te voorkomen — React Flow vergelijkt deze referentie.
 */
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

function isTekstInvoerElement(element) {
  if (!element) return false;
  const tag = element.tagName?.toLowerCase?.() || "";
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable === true;
}

function deepCloneGraphValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function normaliseerMetamodelNaam(rawValue, fallback = "Type") {
  const basis = String(rawValue || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return basis || fallback;
}

function haalPointerPositie(event) {
  if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
    return { x: event.clientX, y: event.clientY };
  }
  const touch = event?.changedTouches?.[0] || event?.touches?.[0] || null;
  if (touch && typeof touch.clientX === "number" && typeof touch.clientY === "number") {
    return { x: touch.clientX, y: touch.clientY };
  }
  return null;
}

function maakCanvasSignature(nodes, edges, selectedNodeId, selectedEdgeId) {
  return JSON.stringify({
    selectedNodeId: selectedNodeId || null,
    selectedEdgeId: selectedEdgeId || null,
    nodes: nodes
      .map((n) => [
        n.id,
        n.type,
        Math.round(n.position?.x ?? 0),
        Math.round(n.position?.y ?? 0),
        !!n.selected,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    edges: edges
      .map((e) => [e.id, e.source, e.target, e.sourceHandle || "", e.targetHandle || ""])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  });
}

function maakCanvasSnapshot(nodes, edges, selectedNodeId, selectedEdgeId, actieNaam = "canvas-actie") {
  return {
    actieNaam,
    nodes: deepCloneGraphValue(nodes),
    edges: deepCloneGraphValue(edges),
    selectedNodeId,
    selectedEdgeId,
    signature: maakCanvasSignature(nodes, edges, selectedNodeId, selectedEdgeId),
  };
}

export default function MetamodelEditor({ initialNodes = [], initialEdges = [], onV3ModelLoaded = null, modelNaam = "", modelVersie = "", modelBron = "", modelOpmerking = "" }) {
  /**
   * useNodesState en useEdgesState zijn React Flow hooks:
   *   - nodes/edges: de huidige array
   *   - setNodes/setEdges: directe setter
   *   - onNodesChange/onEdgesChange: event handler voor drag, select, delete, etc.
   *
   * React Flow stuurt "changes" (position change, selection change, remove) naar
   * deze handlers, die de state automatisch bijwerken.
   */
  const [nodes, setNodes, baseOnNodesChange] = useNodesState(
    vulOntbrekendeDomeinenOpNodes(initialNodes, initialEdges)
  );
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState(initialEdges);

  // Track welke node of edge geselecteerd is voor het edit panel
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [showTestInvoer, setShowTestInvoer] = useState(false);
  const [laatstGepubliceerdSchemaID, setLaatstGepubliceerdSchemaID] = useState(null);
  const [actieDialoog, setActieDialoog] = useState(null);
  const [actiefDomein, setActiefDomein] = useState(null); // null = alles tonen
  // Kleine undo/redo-stack voor canvasacties; inhoudspaneel-bewerkingen vallen hier bewust buiten.
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  // Voorkomt dat restore-acties zelf opnieuw snapshots pushen.
  const undoRestoreBezigRef = useRef(false);
  // { x, y } schermcoördinaten van het rechtsklikmenu; null = verborgen
  const [contextMenu, setContextMenu] = useState(null);
  // Actieve edge-mode: EDGE_MODES.NONE = auto-detectie, anders override.
  const [activeEdgeMode, setActiveEdgeMode] = useState(EDGE_MODES.NONE);
  const canvasRef = useRef(null);
  const reactFlowRef = useRef(null);

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

  const pushCanvasUndo = useCallback(
    (actieNaam = "canvas-actie") => {
      if (undoRestoreBezigRef.current) return;
      const snapshot = maakCanvasSnapshot(nodes, edges, selectedNodeId, selectedEdgeId, actieNaam);
      const vorige = undoStackRef.current[undoStackRef.current.length - 1];
      if (vorige?.signature === snapshot.signature) return;
      undoStackRef.current = [...undoStackRef.current, snapshot].slice(-25);
      // Een nieuwe canvasactie verbreekt de redo-keten.
      redoStackRef.current = [];
    },
    [nodes, edges, selectedNodeId, selectedEdgeId]
  );

  const restoreCanvasSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot) return false;
      undoRestoreBezigRef.current = true;

      const vorigeEdges = deepCloneGraphValue(snapshot.edges || []);
      const vorigeNodes = vulOntbrekendeDomeinenOpNodes(
        deepCloneGraphValue(snapshot.nodes || []),
        vorigeEdges
      );

      setNodes(vorigeNodes);
      setEdges(vorigeEdges);
      setSelectedNodeId(snapshot.selectedNodeId || null);
      setSelectedEdgeId(snapshot.selectedEdgeId || null);
      setContextMenu(null);

      Promise.resolve().then(() => {
        undoRestoreBezigRef.current = false;
      });
      return true;
    },
    [setNodes, setEdges]
  );

  const undoLaatsteCanvasActie = useCallback(() => {
    const snapshot = undoStackRef.current[undoStackRef.current.length - 1];
    if (!snapshot) return false;

    const huidigeSnapshot = maakCanvasSnapshot(nodes, edges, selectedNodeId, selectedEdgeId, "redo-base");
    const laatsteRedo = redoStackRef.current[redoStackRef.current.length - 1];
    if (laatsteRedo?.signature !== huidigeSnapshot.signature) {
      redoStackRef.current = [...redoStackRef.current, huidigeSnapshot].slice(-25);
    }

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    return restoreCanvasSnapshot(snapshot);
  }, [nodes, edges, selectedNodeId, selectedEdgeId, restoreCanvasSnapshot]);

  const redoLaatsteCanvasActie = useCallback(() => {
    const snapshot = redoStackRef.current[redoStackRef.current.length - 1];
    if (!snapshot) return false;

    const huidigeSnapshot = maakCanvasSnapshot(nodes, edges, selectedNodeId, selectedEdgeId, "undo-base");
    const laatsteUndo = undoStackRef.current[undoStackRef.current.length - 1];
    if (laatsteUndo?.signature !== huidigeSnapshot.signature) {
      undoStackRef.current = [...undoStackRef.current, huidigeSnapshot].slice(-25);
    }

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    return restoreCanvasSnapshot(snapshot);
  }, [nodes, edges, selectedNodeId, selectedEdgeId, restoreCanvasSnapshot]);

  // Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo voor canvasacties.
  useEffect(() => {
    function handleKeyDown(event) {
      if (isTekstInvoerElement(event.target)) return;

      const key = String(event.key).toLowerCase();
      const hasPrimary = event.ctrlKey || event.metaKey;
      if (!hasPrimary) return;

      const isUndo = !event.shiftKey && key === "z";
      const isRedo = key === "y" || (event.shiftKey && key === "z");

      if (isUndo) {
        const hadUndo = undoLaatsteCanvasActie();
        if (hadUndo) event.preventDefault();
        return;
      }

      if (isRedo) {
        const hadRedo = redoLaatsteCanvasActie();
        if (hadRedo) event.preventDefault();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undoLaatsteCanvasActie, redoLaatsteCanvasActie]);

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

  const onNodesChange = useCallback(
    (changes) => {
      const heeftRemove = Array.isArray(changes) && changes.some((c) => c?.type === "remove");
      if (heeftRemove) pushCanvasUndo("nodes-remove");
      baseOnNodesChange(changes);
    },
    [baseOnNodesChange, pushCanvasUndo]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      const heeftRemove = Array.isArray(changes) && changes.some((c) => c?.type === "remove");
      if (heeftRemove) pushCanvasUndo("edges-remove");
      baseOnEdgesChange(changes);
    },
    [baseOnEdgesChange, pushCanvasUndo]
  );

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
    undoStackRef.current = [];
    redoStackRef.current = [];
    setContextMenu(null);
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [setNodes, setEdges]);

  const swapConnectionDirection = useCallback((connection) => {
    // Bij het omdraaien van de richting moeten we ook het prefix van de
    // handle IDs aanpassen: een target-handle op de oude target-node wordt
    // een source-handle op de nieuwe source-node, en andersom.
    const swapPrefix = (h, from, to) =>
      h ? h.replace(from, to) : h;
    return {
      ...connection,
      source: connection.target,
      target: connection.source,
      sourceHandle: swapPrefix(connection.targetHandle, "target-", "source-"),
      targetHandle: swapPrefix(connection.sourceHandle, "source-", "target-"),
    };
  }, []);

  const normalizeConnection = useCallback(
    (connection, currentEdges) => {
      // Correctie: als de gebruiker begon te slepen vanaf een target-handle (id begint met
      // "target-"), draait React Flow source/target intern om. We zetten dit terug zodat
      // alle downstream-logica altijd source = de node waarvan de gebruiker sleepte.
      let connection_ = connection;
      if (connection_.sourceHandle?.startsWith("target-")) {
        connection_ = swapConnectionDirection(connection_);
      }

      const sourceType = nodeTypeById.get(connection_.source);
      const targetType = nodeTypeById.get(connection_.target);

      if (!sourceType || !targetType) {
        return connection_;
      }

      // GE hoort altijd onder entiteit te hangen.
      if (sourceType === "gegevenselement" && targetType === "entiteit") {
        return swapConnectionDirection(connection_);
      }

      // Enum/datatype dependency wijzen altijd van modeltype naar enum/datatype.
      if (
        (sourceType === "enumeratie" && targetType !== "enumeratie") ||
        (sourceType === "gegevenstype" && targetType !== "gegevenstype")
      ) {
        return swapConnectionDirection(connection_);
      }

      // Referentielijst-instantie → relatie (items-relatie): instantie is altijd bron.
      if (
        (sourceType === "referentielijstInstantie" && targetType === "relatie") ||
        (sourceType === "relatie" && targetType === "referentielijstInstantie")
      ) {
        const instantieId = sourceType === "referentielijstInstantie"
          ? connection_.source : connection_.target;
        const relatieId = sourceType === "relatie"
          ? connection_.source : connection_.target;
        return { ...connection_, source: instantieId, target: relatieId };
      }

      // Entiteit-relatie: eerste koppeling = entiteit -> relatie (owner),
      // tweede koppeling = relatie -> entiteit (doel-entiteit).
      if (
        (sourceType === "entiteit" && targetType === "relatie") ||
        (sourceType === "relatie" && targetType === "entiteit")
      ) {
        const relatieId = sourceType === "relatie" ? connection_.source : connection_.target;
        const entiteitId = sourceType === "entiteit" ? connection_.source : connection_.target;

        const ownerEdge = currentEdges.find((e) => {
          if (e.type !== "metamodel") return false;
          if (e.target !== relatieId) return false;
          const ownerType = nodeTypeById.get(e.source);
          return ownerType === "entiteit" || ownerType === "referentielijstInstantie";
        });

        if (!ownerEdge) {
          return {
            ...connection_,
            source: entiteitId,
            target: relatieId,
          };
        }

        if (ownerEdge.source === entiteitId) {
          return {
            ...connection_,
            source: entiteitId,
            target: relatieId,
          };
        }

        return {
          ...connection_,
          source: relatieId,
          target: entiteitId,
        };
      }

      return connection_;
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
      pushCanvasUndo("connect-edge");
      setEdges((eds) => {
        const normalized = normalizeConnection(connection, eds);
        const sourceType = nodeTypeById.get(normalized.source);
        const targetType = nodeTypeById.get(normalized.target);

        // === Edge-mode override ===
        // Als een edge-mode actief is, override het standaardgedrag.
        if (activeEdgeMode === EDGE_MODES.GENERALISATIE) {
          // Generalisatie alleen toestaan tussen dezelfde metatypes (ENT↔ENT of GE↔GE).
          if (sourceType !== targetType || !["entiteit", "gegevenselement"].includes(sourceType)) {
            console.warn(`Generalisatie alleen mogelijk tussen zelfde metatype (${sourceType} → ${targetType})`);
            setActiveEdgeMode(EDGE_MODES.NONE);
            return eds;
          }
          // Verwijder bestaande generalisatie-edge vanuit deze source.
          const filtered = eds.filter(
            (e) => !(e.source === normalized.source && e.data?.isGeneralization)
          );
          setActiveEdgeMode(EDGE_MODES.NONE);
          return [
            ...filtered,
            {
              ...normalized,
              id: generateId("edge"),
              type: "metamodel",
              data: { isGeneralization: true },
            },
          ];
        }

        if (activeEdgeMode === EDGE_MODES.COMPOSITIE) {
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
          setActiveEdgeMode(EDGE_MODES.NONE);
          return addEdge(newEdge, eds);
        }

        // ENT → ENT: maak direct een lege relatie in collapsed mode.
        if (sourceType === "entiteit" && targetType === "entiteit") {
          const bronNode = nodes.find((n) => n.id === normalized.source);
          const doelNode = nodes.find((n) => n.id === normalized.target);
          const bronNaam = normaliseerMetamodelNaam(
            bronNode?.data?.typenaam || bronNode?.data?.klassenaam || normalized.source,
            "Entiteit"
          );
          const doelNaam = normaliseerMetamodelNaam(
            doelNode?.data?.typenaam || doelNode?.data?.klassenaam || normalized.target,
            "Entiteit"
          );
          const basisRelatie = maakLeegType("relatie");
          const relatieId = basisRelatie.id;
          const relatieNaam = `Rel_${bronNaam}_${doelNaam}`;
          const relatiePos = {
            x: ((bronNode?.position?.x ?? 0) + (doelNode?.position?.x ?? 320)) / 2,
            y: ((bronNode?.position?.y ?? 0) + (doelNode?.position?.y ?? 0)) / 2 + 70,
          };
          const doelEntiteitNaam = doelNode?.data?.typenaam || doelNode?.data?.klassenaam || doelNode?.id || "";
          const rolnaam = (doelNode?.data?.meervoud || doelNode?.data?.klassenaam || doelEntiteitNaam || "relatie").trim();

          setNodes((nds) => [
            ...nds,
            {
              id: relatieId,
              type: "relatie",
              position: relatiePos,
              data: {
                ...basisRelatie,
                domein: bronNode?.data?.domein || doelNode?.data?.domein || actiefDomein || "",
                typenaam: relatieNaam,
                klassenaam: relatieNaam,
                meervoud: `${relatieNaam}en`,
                doelEntiteit: doelEntiteitNaam,
                velden: [],
              },
            },
          ]);
          setSelectedNodeId(relatieId);
          setSelectedEdgeId(null);

          // Bereken genormaliseerde handles voor de twee edges
          const relatieNode = { position: relatiePos, measured: { width: 120, height: 36 } };
          const h1 = berekenKortsteHandles(bronNode, relatieNode);
          const h2 = berekenKortsteHandles(relatieNode, doelNode);

          return [
            ...eds,
            {
              id: generateId("edge"),
              source: normalized.source,
              target: relatieId,
              sourceHandle: h1.sourceHandle,
              targetHandle: h1.targetHandle,
              type: "metamodel",
              data: {
                rolnaam: "",
                jsonRolnaam: relatieNaam.toLowerCase(),
                momentvoorkomen: "meervoudig",
                kardinaliteit: "0..*",
              },
            },
            {
              id: generateId("edge"),
              source: relatieId,
              target: normalized.target,
              sourceHandle: h2.sourceHandle,
              targetHandle: h2.targetHandle,
              type: "metamodel",
              data: {
                rolnaam,
                jsonRolnaam: relatieNaam.toLowerCase(),
                momentvoorkomen: "meervoudig",
                kardinaliteit: "0..*",
              },
            },
          ];
        }

        // === ASOC auto-conversie ===
        // Wanneer de tweede entiteit verbonden wordt met een relatie die al velden
        // heeft, converteren we automatisch naar het association-class patroon:
        //   [A] ── o ── [B]  +  o╌╌[REL]
        // Heeft de relatie geen velden, dan komt er een eenvoudige edge (collapsed
        // badge). De ASOC-conversie vindt dan pas plaats bij het toevoegen van het
        // eerste veld (zie handleUpdateNode).
        if (sourceType === "relatie" && targetType === "entiteit") {
          const relatieId = normalized.source;
          const doelEntiteitId = normalized.target;
          const relatieNode = nodes.find((n) => n.id === relatieId);
          const heeftVelden = (relatieNode?.data?.velden || []).length > 0;

          // Zoek de bestaande owner-edge (entiteitA → relatie)
          const ownerEdge = eds.find((e) => {
            if (e.type !== "metamodel" || e.target !== relatieId) return false;
            if (e.data?.isDependency || e.data?.isAssociation || e.data?.isAssociationClassLink) return false;
            const t = nodeTypeById.get(e.source);
            return t === "entiteit" || t === "referentielijstInstantie";
          });

          if (ownerEdge && heeftVelden) {
            const bronEntiteitId = ownerEdge.source;
            const bronNode = nodes.find((n) => n.id === bronEntiteitId);
            const doelNode = nodes.find((n) => n.id === doelEntiteitId);

            // Bereken ankerpositie: midden tussen beide entiteiten
            const bronPos = bronNode?.position || { x: 0, y: 0 };
            const doelPos = doelNode?.position || { x: 400, y: 0 };
            const ankerId = `anker_${relatieId}`;
            const ankerPos = {
              x: (bronPos.x + doelPos.x) / 2 + 80,
              y: (bronPos.y + doelPos.y) / 2,
            };

            // Voeg anker-node toe
            setNodes((nds) => [
              ...nds,
              {
                id: ankerId,
                type: "associatieAnker",
                position: ankerPos,
                data: { relatieNaam: relatieNode?.data?.typenaam || relatieId },
              },
            ]);

            // Verwijder de owner-edge en maak 3 ASOC-edges aan
            const withoutOwner = eds.filter((e) => e.id !== ownerEdge.id);
            const directioneel = relatieNode?.data?.directioneel || false;

            const asocEdge1 = {
              id: generateId("edge"),
              source: bronEntiteitId,
              target: ankerId,
              type: "metamodel",
              sourceHandle: ownerEdge.sourceHandle || null,
              targetHandle: "target-left",
              data: {
                isAssociation: true,
                directioneel,
                rolnaam: "",
                jsonRolnaam: "",
                momentvoorkomen: "",
                kardinaliteit: "",
              },
            };

            const asocEdge2 = {
              id: generateId("edge"),
              source: ankerId,
              target: doelEntiteitId,
              type: "metamodel",
              sourceHandle: "source-right",
              targetHandle: normalized.targetHandle || null,
              data: {
                isAssociation: true,
                directioneel,
                rolnaam: "",
                jsonRolnaam: "",
                momentvoorkomen: "",
                kardinaliteit: "",
              },
            };

            const asocEdge3 = {
              id: generateId("edge"),
              source: ankerId,
              target: relatieId,
              type: "metamodel",
              sourceHandle: "source-bottom",
              targetHandle: "target-top",
              data: {
                isAssociationClassLink: true,
                rolnaam: "",
                jsonRolnaam: "",
                momentvoorkomen: "",
                kardinaliteit: "",
              },
            };

            return [...withoutOwner, asocEdge1, asocEdge2, asocEdge3];
          }
        }

        // === Standaard edge-aanmaak (bestaande logica) ===
        const isReferentielijstBinding = sourceType === "referentielijstInstantie" && targetType === "relatie";
        const isDependencyConnection =
          isReferentielijstBinding ||
          ((sourceType === "entiteit" || sourceType === "gegevenselement" || sourceType === "relatie") &&
            (targetType === "enumeratie" || targetType === "gegevenstype"));

        if (isReferentielijstBinding) {
          const instantieNode = nodes.find((n) => n.id === normalized.source);
          const instantieNaam = instantieNode?.data?.systeemnaam || "";
          setNodes((nds) =>
            nds.map((n) =>
              n.id === normalized.target
                ? { ...n, data: { ...n.data, referentielijstInstantie: instantieNaam } }
                : n
            )
          );
        }

        const filteredEdges = isReferentielijstBinding
          ? eds.filter((e) => {
              if (e.type !== "metamodel" || e.data?.isDependency !== true) return true;
              if (e.target !== normalized.target) return true;
              return nodeTypeById.get(e.source) !== "referentielijstInstantie";
            })
          : eds;

        const newEdge = {
          ...normalized,
          id: generateId("edge"),
          type: "metamodel",
          data: isDependencyConnection
            ? {
                isDependency: true,
                rolnaam: isReferentielijstBinding
                  ? `⇢ ${nodes.find((n) => n.id === normalized.source)?.data?.systeemnaam || ""}`
                  : "",
                jsonRolnaam: "",
                momentvoorkomen: "",
                kardinaliteit: "",
              }
            : {
                rolnaam: "",
                jsonRolnaam: "",
                momentvoorkomen: "enkelvoudig",
                kardinaliteit: "0..1",
              },
        };
        return addEdge(newEdge, filteredEdges);
      });
    },
    [actiefDomein, activeEdgeMode, normalizeConnection, setEdges, pushCanvasUndo, nodeTypeById, nodes, setNodes]
  );

  /**
   * Alt-drag vanuit een entiteit-handle naar leeg canvas: maak daar direct
   * een nieuw gegevenselement en koppel het structureel aan de bron-entiteit.
   * (Voorheen Ctrl-drag, maar Ctrl is gereserveerd voor multiselect.)
   */
  const handleConnectEnd = useCallback(
    (event, connectionState) => {
      const heeftModifier = !!(event?.altKey || event?.ctrlKey || event?.metaKey);
      if (!heeftModifier || connectionState?.isValid) return;

      const bronNode = connectionState?.fromNode || null;
      const fromHandle = connectionState?.fromHandle;
      const handleType = fromHandle?.type || "source";
      // Ctrl-drag vanuit elke source handle van een entiteit
      if (!bronNode || bronNode.type !== "entiteit" || handleType !== "source") return;

      const pointer = haalPointerPositie(event);
      const flowPos = pointer && reactFlowRef.current?.screenToFlowPosition
        ? reactFlowRef.current.screenToFlowPosition(pointer)
        : null;
      if (!flowPos) return;

      const bronNaam = normaliseerMetamodelNaam(
        bronNode?.data?.typenaam || bronNode?.data?.klassenaam || bronNode?.id,
        "Entiteit"
      );
      const basisGE = maakLeegType("gegevenselement");
      const geNaam = `${bronNaam}_GE`;
      const geId = basisGE.id;

      pushCanvasUndo("ctrl-drag-ge");
      setNodes((nds) => [
        ...nds,
        {
          id: geId,
          type: "gegevenselement",
          position: { x: flowPos.x, y: flowPos.y },
          data: {
            ...basisGE,
            domein: bronNode?.data?.domein || actiefDomein || "",
            typenaam: geNaam,
            klassenaam: geNaam,
            meervoud: `${geNaam}s`,
            description: `Nieuw gegevenselement bij ${bronNaam}`,
          },
        },
      ]);
      // Bereken optimale handles voor de edge tussen bron en nieuw GE
      const geNode = { position: { x: flowPos.x, y: flowPos.y }, measured: { width: 180, height: 80 } };
      const { sourceHandle, targetHandle } = berekenKortsteHandles(bronNode, geNode);

      setEdges((eds) => [
        ...eds,
        {
          id: generateId("edge"),
          source: bronNode.id,
          target: geId,
          sourceHandle,
          targetHandle,
          type: "metamodel",
          data: {
            rolnaam: geNaam,
            jsonRolnaam: geNaam.toLowerCase(),
            momentvoorkomen: "enkelvoudig",
            kardinaliteit: "0..1",
          },
        },
      ]);
      setSelectedNodeId(geId);
      setSelectedEdgeId(null);
    },
    [actiefDomein, pushCanvasUndo, setEdges, setNodes]
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
    setContextMenu(null);
  }, []);

  /**
   * Gedeelde helper voor het tonen van het uitlijnmenu bij rechtsklik.
   * Werkt zowel bij rechtsklik op een node als op het canvas.
   */
  const toonContextMenu = useCallback(
    (event) => {
      const geselecteerd = nodes.filter((n) => n.selected);
      if (geselecteerd.length < 2) return false;
      event.preventDefault();
      const modelNodeTypes = ["entiteit", "gegevenselement", "relatie", "associatieAnker", "referentielijstInstantie"];
      const heeftDomeinWijziging = geselecteerd.some((n) => modelNodeTypes.includes(n.type));
      const canvasRect = canvasRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
      setContextMenu({
        x: event.clientX - canvasRect.left,
        y: event.clientY - canvasRect.top,
        count: geselecteerd.length,
        heeftDomeinWijziging,
      });
      return true;
    },
    [nodes]
  );

  const onNodeContextMenu = useCallback(
    (event, node) => {
      // Dependency toggle voor enum/datatype nodes
      if (node && (node.type === "enumeratie" || node.type === "gegevenstype")) {
        const inkomendeDeps = edges.filter(
          (e) => e.data?.isDependency === true && e.target === node.id
        );
        if (inkomendeDeps.length > 0) {
          event.preventDefault();
          const alleVerborgen = inkomendeDeps.every((e) => e.hidden);
          const canvasRect = canvasRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
          setContextMenu({
            menuType: "dependency",
            x: event.clientX - canvasRect.left,
            y: event.clientY - canvasRect.top,
            header: node.data?.naam || node.id,
            items: [
              {
                actie: alleVerborgen ? "toon-deps" : "verberg-deps",
                label: alleVerborgen ? "Toon dependencies" : "Verberg dependencies",
              },
            ],
            targetNodeId: node.id,
          });
          return;
        }
      }

      // Domein wijzigen voor model-nodes (entiteit, gegevenselement, relatie, etc.)
      const modelNodeTypes = ["entiteit", "gegevenselement", "relatie", "associatieAnker", "referentielijstInstantie"];
      if (node && modelNodeTypes.includes(node.type)) {
        event.preventDefault();
        // Zorg dat de rechts-geklikte node geselecteerd is
        const geselecteerd = nodes.filter((n) => n.selected);
        const inclusiefDitNode = geselecteerd.some((n) => n.id === node.id)
          ? geselecteerd
          : [node, ...geselecteerd];
        const canvasRect = canvasRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
        setContextMenu({
          menuType: "domein",
          x: event.clientX - canvasRect.left,
          y: event.clientY - canvasRect.top,
          count: inclusiefDitNode.length,
        });
        // Selecteer ook dit node als het nog niet geselecteerd was
        if (!geselecteerd.some((n) => n.id === node.id)) {
          setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id ? true : n.selected })));
        }
        return;
      }

      toonContextMenu(event);
    },
    [toonContextMenu, edges, nodes, setNodes]
  );

  const onPaneContextMenu = useCallback(
    (event) => { toonContextMenu(event); },
    [toonContextMenu]
  );

  const onEdgeContextMenu = useCallback(
    (event, edge) => {
      if (edge?.data?.isDependency === true) {
        event.preventDefault();
        const canvasRect = canvasRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
        setContextMenu({
          menuType: "dependency",
          x: event.clientX - canvasRect.left,
          y: event.clientY - canvasRect.top,
          header: "«use» dependency",
          items: [
            { actie: "verberg-edge", label: "Verberg deze dependency" },
          ],
          targetEdgeId: edge.id,
          targetNodeId: edge.target,
        });
        return;
      }
      toonContextMenu(event);
    },
    [toonContextMenu]
  );

  const onSelectionContextMenu = useCallback(
    (event, _nodes) => { toonContextMenu(event); },
    [toonContextMenu]
  );

  /**
   * Verwerk een dependency-contextmenu actie: verberg/toon «use» edges.
   */
  const handleDependencyAction = useCallback(
    (actie) => {
      if (!contextMenu) return;
      if (actie === "verberg-edge" && contextMenu.targetEdgeId) {
        setEdges((eds) =>
          eds.map((e) => e.id === contextMenu.targetEdgeId ? { ...e, hidden: true } : e)
        );
      } else if (actie === "verberg-deps" && contextMenu.targetNodeId) {
        setEdges((eds) =>
          eds.map((e) =>
            e.data?.isDependency === true && e.target === contextMenu.targetNodeId
              ? { ...e, hidden: true }
              : e
          )
        );
      } else if (actie === "toon-deps" && contextMenu.targetNodeId) {
        setEdges((eds) =>
          eds.map((e) =>
            e.data?.isDependency === true && e.target === contextMenu.targetNodeId
              ? { ...e, hidden: false }
              : e
          )
        );
      }
    },
    [contextMenu, setEdges]
  );

  /**
   * Verander het domein van alle geselecteerde nodes.
   */
  const handleDomeinWijzigen = useCallback(
    (domein) => {
      pushCanvasUndo("domein-wijzigen");
      setNodes((nds) =>
        nds.map((n) => (n.selected ? { ...n, data: { ...n.data, domein } } : n))
      );
    },
    [setNodes, pushCanvasUndo]
  );

  /**
   * Normaliseer alle relaties: bereken voor elke edge de kortste handle-combinatie.
   */
  const handleNormaliseerAlleRelaties = useCallback(() => {
    pushCanvasUndo("normaliseer-alle-relaties");
    setEdges((eds) =>
      eds.map((e) => {
        const srcNode = nodes.find((n) => n.id === e.source);
        const tgtNode = nodes.find((n) => n.id === e.target);
        if (!srcNode || !tgtNode) return e;
        const best = berekenKortsteHandles(srcNode, tgtNode);
        return { ...e, sourceHandle: best.sourceHandle, targetHandle: best.targetHandle };
      })
    );
  }, [nodes, setEdges, pushCanvasUndo]);

  /**
   * Snap alle nodes naar het dichtstbijzijnde gridpunt.
   */
  const GRID_SIZE = 15;
  const handleSnapAlleNaarGrid = useCallback(() => {
    pushCanvasUndo("snap-naar-grid");
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: {
          x: Math.round(n.position.x / GRID_SIZE) * GRID_SIZE,
          y: Math.round(n.position.y / GRID_SIZE) * GRID_SIZE,
        },
      }))
    );
  }, [setNodes, pushCanvasUndo]);

  /**
   * Voer een uitlijnactie uit op alle geselecteerde nodes.
   * Elke actie past de position van de geselecteerde nodes aan;
   * breedte en hoogte komen uit measured (React Flow) of defaults.
   */
  const handleAlign = useCallback(
    (actie) => {
      const geselecteerd = nodes.filter((n) => n.selected);
      if (geselecteerd.length < 2) return;

      pushCanvasUndo(`align:${actie}`);

      const w = (n) => n.measured?.width  ?? n.width  ?? 180;
      const h = (n) => n.measured?.height ?? n.height ?? 60;

      let xNieuw, yNieuw;

      if (actie === "links") {
        const minX = Math.min(...geselecteerd.map((n) => n.position.x));
        xNieuw = () => minX;
      } else if (actie === "rechts") {
        const maxX = Math.max(...geselecteerd.map((n) => n.position.x + w(n)));
        xNieuw = (n) => maxX - w(n);
      } else if (actie === "boven") {
        const minY = Math.min(...geselecteerd.map((n) => n.position.y));
        yNieuw = () => minY;
      } else if (actie === "onder") {
        const maxY = Math.max(...geselecteerd.map((n) => n.position.y + h(n)));
        yNieuw = (n) => maxY - h(n);
      } else if (actie === "midden-horizontaal") {
        const gemX = geselecteerd.reduce((som, n) => som + n.position.x + w(n) / 2, 0) / geselecteerd.length;
        xNieuw = (n) => gemX - w(n) / 2;
      } else if (actie === "midden-verticaal") {
        const gemY = geselecteerd.reduce((som, n) => som + n.position.y + h(n) / 2, 0) / geselecteerd.length;
        yNieuw = (n) => gemY - h(n) / 2;
      } else if (actie === "verdeel-horizontaal" && geselecteerd.length >= 3) {
        const sorted = [...geselecteerd].sort((a, b) => a.position.x - b.position.x);
        const eerste = sorted[0];
        const laatste = sorted[sorted.length - 1];
        const totaalRuimte = (laatste.position.x + w(laatste)) - eerste.position.x;
        const totaalBreedte = sorted.reduce((som, n) => som + w(n), 0);
        const gap = (totaalRuimte - totaalBreedte) / (sorted.length - 1);
        const posMap = new Map();
        let curX = eerste.position.x;
        for (const n of sorted) {
          posMap.set(n.id, curX);
          curX += w(n) + gap;
        }
        xNieuw = (n) => posMap.get(n.id) ?? n.position.x;
      } else if (actie === "verdeel-verticaal" && geselecteerd.length >= 3) {
        const sorted = [...geselecteerd].sort((a, b) => a.position.y - b.position.y);
        const eerste = sorted[0];
        const laatste = sorted[sorted.length - 1];
        const totaalRuimte = (laatste.position.y + h(laatste)) - eerste.position.y;
        const totaalHoogte = sorted.reduce((som, n) => som + h(n), 0);
        const gap = (totaalRuimte - totaalHoogte) / (sorted.length - 1);
        const posMap = new Map();
        let curY = eerste.position.y;
        for (const n of sorted) {
          posMap.set(n.id, curY);
          curY += h(n) + gap;
        }
        yNieuw = (n) => posMap.get(n.id) ?? n.position.y;
      } else if (actie === "snap-naar-grid") {
        handleSnapAlleNaarGrid();
        return;
      } else if (actie === "normaliseer-relaties") {
        handleNormaliseerAlleRelaties();
        return;
      } else {
        return;
      }

      const geselecteerdIds = new Set(geselecteerd.map((n) => n.id));
      setNodes((nds) =>
        nds.map((n) => {
          if (!geselecteerdIds.has(n.id)) return n;
          return {
            ...n,
            position: {
              x: xNieuw ? xNieuw(n) : n.position.x,
              y: yNieuw ? yNieuw(n) : n.position.y,
            },
          };
        })
      );
    },
    [nodes, setNodes, pushCanvasUndo, handleSnapAlleNaarGrid, handleNormaliseerAlleRelaties]
  );

  /**
   * Dubbelklik op een edge: optimaliseer de handle-posities zodat de lijn
   * zo kort mogelijk is, gegeven de actuele positie van de twee nodes.
   */
  const onEdgeDoubleClick = useCallback(
    (_event, edge) => {
      pushCanvasUndo("edge-optimaliseer");
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
    [nodes, setEdges, pushCanvasUndo]
  );

  // === Node CRUD ===

  /** Voeg een nieuw type (node) toe op een willekeurige positie */
  const handleAddNode = useCallback(
    (data, type) => {
      pushCanvasUndo("add-node");
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
    [setNodes, actiefDomein, pushCanvasUndo]
  );

  /**
   * Voeg een volledige referentielijst-set toe: drie nodes (lijst, item, relatie) + twee edges.
   * Positioneert de nodes naast elkaar zodat ze visueel als groep herkenbaar zijn.
   * Zie Referentielijsten.md §7.
   */
  const handleAddReferentielijstSet = useCallback(() => {
    pushCanvasUndo("add-referentielijst-set");
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
  }, [setNodes, setEdges, pushCanvasUndo]);

  /**
   * Voeg een referentielijst-instantie node toe.
   * Een instantie vertegenwoordigt een specifiek record van de Referentielijst-klasse.
   */
  const handleAddReferentielijstInstantie = useCallback(() => {
    pushCanvasUndo("add-referentielijst-instantie");
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
  }, [setNodes, pushCanvasUndo]);

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

        let updatedNodes = nds.map((n) => {
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

        // Propageer directioneel naar ASOC-edges wanneer een relatie-node wijzigt.
        if (previousNode?.type === "relatie") {
          const prevDir = previousNode.data?.directioneel || false;
          const newDir = newData.directioneel || false;
          if (prevDir !== newDir) {
            const relatieNaam = newData.typenaam || nodeId;
            setEdges((eds) => {
              // Zoek de anker-node voor deze relatie
              const ankerNode = updatedNodes.find(
                (n) => n.type === "associatieAnker" && n.data?.relatieNaam === relatieNaam
              ) || updatedNodes.find(
                (n) => n.type === "associatieAnker" && n.id === `anker_${nodeId}`
              );
              if (!ankerNode) return eds;
              return eds.map((e) => {
                if (e.data?.isAssociation && (e.source === ankerNode.id || e.target === ankerNode.id)) {
                  return { ...e, data: { ...e.data, directioneel: newDir } };
                }
                return e;
              });
            });
          }
        }

        // === ASOC forward/reverse conversie bij velden-wijziging ===
        if (previousNode?.type === "relatie") {
          const hadVelden = (previousNode.data?.velden || []).length > 0;
          const heeftVelden = (newData.velden || []).length > 0;

          if (!hadVelden && heeftVelden) {
            // Forward: eerste veld toegevoegd → converteer naar ASOC als er 2
            // entity-edges zijn (owner + target) maar nog geen anker.
            const relatieNaam = newData.typenaam || nodeId;
            const bestaandAnker = updatedNodes.find(
              (n) => n.type === "associatieAnker" && (
                n.data?.relatieNaam === relatieNaam || n.id === `anker_${nodeId}`
              )
            );

            if (!bestaandAnker) {
              setEdges((eds) => {
                // Zoek owner-edge (entity → relatie) en target-edge (relatie → entity)
                const ownerEdge = eds.find((e) => {
                  if (e.type !== "metamodel" || e.target !== nodeId) return false;
                  if (e.data?.isDependency) return false;
                  const t = nodeTypeById.get(e.source);
                  return t === "entiteit" || t === "referentielijstInstantie";
                });
                const targetEdge = eds.find((e) => {
                  if (e.type !== "metamodel" || e.source !== nodeId) return false;
                  if (e.data?.isDependency) return false;
                  const t = nodeTypeById.get(e.target);
                  return t === "entiteit";
                });

                if (!ownerEdge || !targetEdge) return eds;

                const bronEntiteitId = ownerEdge.source;
                const doelEntiteitId = targetEdge.target;
                const bronNode = nds.find((n) => n.id === bronEntiteitId);
                const doelNode = nds.find((n) => n.id === doelEntiteitId);
                const relatieNode = nds.find((n) => n.id === nodeId);
                const bronPos = bronNode?.position || { x: 0, y: 0 };
                const doelPos = doelNode?.position || { x: 400, y: 0 };
                const ankerId = `anker_${nodeId}`;
                const ankerPos = {
                  x: (bronPos.x + doelPos.x) / 2 + 80,
                  y: (bronPos.y + doelPos.y) / 2,
                };

                // Voeg anker-node toe en verplaats relatie onder anker
                setNodes((prev) => [
                  ...prev.map((n) =>
                    n.id === nodeId
                      ? { ...n, position: { x: ankerPos.x - 40, y: ankerPos.y + 60 } }
                      : n
                  ),
                  {
                    id: ankerId,
                    type: "associatieAnker",
                    position: ankerPos,
                    data: { relatieNaam: relatieNaam },
                  },
                ]);

                const directioneel = newData.directioneel || false;
                const ownerTargetEdgeIds = new Set([ownerEdge.id, targetEdge.id]);
                const withoutOld = eds.filter((e) => !ownerTargetEdgeIds.has(e.id));

                return [
                  ...withoutOld,
                  {
                    id: generateId("edge"),
                    source: bronEntiteitId,
                    target: ankerId,
                    type: "metamodel",
                    sourceHandle: ownerEdge.sourceHandle || null,
                    targetHandle: "target-left",
                    data: { isAssociation: true, directioneel, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
                  },
                  {
                    id: generateId("edge"),
                    source: ankerId,
                    target: doelEntiteitId,
                    type: "metamodel",
                    sourceHandle: "source-right",
                    targetHandle: targetEdge.targetHandle || null,
                    data: { isAssociation: true, directioneel, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
                  },
                  {
                    id: generateId("edge"),
                    source: ankerId,
                    target: nodeId,
                    type: "metamodel",
                    sourceHandle: "source-bottom",
                    targetHandle: "target-top",
                    data: { isAssociationClassLink: true, rolnaam: "", jsonRolnaam: "", momentvoorkomen: "", kardinaliteit: "" },
                  },
                ];
              });
            }
          }

          if (hadVelden && !heeftVelden) {
            // Reverse: laatste veld verwijderd → converteer terug naar collapsed badge.
            // Verplaats relatie naar ankerpositie, verwijder anker, herstel eenvoudige edges.
            const relatieNaam = previousNode.data?.typenaam || nodeId;
            const directioneelFlag = newData.directioneel || false;
            const ankerNode = updatedNodes.find(
              (n) => n.type === "associatieAnker" && (
                n.data?.relatieNaam === relatieNaam || n.id === `anker_${nodeId}`
              )
            );

            if (ankerNode) {
              const ankerId = ankerNode.id;
              // Verplaats relatie naar ankerpositie en verwijder anker
              updatedNodes = updatedNodes
                .filter((n) => n.id !== ankerId)
                .map((n) =>
                  n.id === nodeId
                    ? { ...n, position: { ...ankerNode.position } }
                    : n
                );

              setEdges((eds) => {
                const edge1 = eds.find((e) => e.data?.isAssociation && e.target === ankerId);
                const edge2 = eds.find((e) => e.data?.isAssociation && e.source === ankerId);
                const classLink = eds.find((e) => e.data?.isAssociationClassLink &&
                  (e.source === ankerId || e.target === ankerId));
                const asocEdgeIds = new Set([edge1?.id, edge2?.id, classLink?.id].filter(Boolean));
                const withoutAsoc = eds.filter((e) => !asocEdgeIds.has(e.id));

                const newEdges = [];
                if (edge1) {
                  newEdges.push({
                    id: generateId("edge"),
                    source: edge1.source,
                    target: nodeId,
                    type: "metamodel",
                    sourceHandle: edge1.sourceHandle,
                    targetHandle: "target-left",
                    data: { rolnaam: "", jsonRolnaam: "", momentvoorkomen: "enkelvoudig", kardinaliteit: edge1.data?.kardinaliteit || "0..1" },
                  });
                }
                if (edge2) {
                  newEdges.push({
                    id: generateId("edge"),
                    source: nodeId,
                    target: edge2.target,
                    type: "metamodel",
                    sourceHandle: "source-right",
                    targetHandle: edge2.targetHandle,
                    data: {
                      rolnaam: "", jsonRolnaam: "",
                      momentvoorkomen: "enkelvoudig",
                      kardinaliteit: edge2.data?.kardinaliteit || "0..*",
                      // Bewaar directioneel zodat de pijl naar doel zichtbaar blijft
                      ...(directioneelFlag ? { directioneel: true } : {}),
                    },
                  });
                }
                return [...withoutAsoc, ...newEdges];
              });
            }
          }
        }

        return updatedNodes;
      });
    },
    [setEdges, setNodes, nodeTypeById]
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

      pushCanvasUndo("delete-node");

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
    [nodes, setNodes, setEdges, pushCanvasUndo]
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
      pushCanvasUndo("delete-edge");
      const edgeToDelete = edges.find((e) => e.id === edgeId);
      if (edgeToDelete?.data?.isDependency === true) {
        const relatieId = nodeTypeById.get(edgeToDelete.source) === "relatie"
          ? edgeToDelete.source
          : nodeTypeById.get(edgeToDelete.target) === "relatie"
            ? edgeToDelete.target
            : null;
        const instantieId = nodeTypeById.get(edgeToDelete.source) === "referentielijstInstantie"
          ? edgeToDelete.source
          : nodeTypeById.get(edgeToDelete.target) === "referentielijstInstantie"
            ? edgeToDelete.target
            : null;

        if (relatieId && instantieId) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === relatieId
                ? { ...n, data: { ...n.data, referentielijstInstantie: "" } }
                : n
            )
          );
        }
      }

      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdgeId(null);
    },
    [edges, nodeTypeById, setEdges, setNodes, pushCanvasUndo]
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

  // Gebruik de geladen modelmetadata als basis voor exports/publiceren, zodat
  // we niet terugvallen op de generieke placeholder-versie "v3".
  const bouwExportV3Model = useCallback(
    (opts = {}) =>
      editorNaarV3Model(nodes, edges, {
        versie: opts.versie || modelVersie || "v3",
        naam: opts.naam || modelNaam || "Editor export",
        beschrijving: opts.beschrijving || modelOpmerking || "V3 export vanuit UML editor (codegen-ready)",
      }),
    [nodes, edges, modelVersie, modelNaam, modelOpmerking]
  );

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
    // Gebruik versie als default bestandsnaam, zonder .json extensie
    const versie = (v3Model?.versie || "").trim();
    if (versie) return versie;
    // Fallback: modelnaam
    const basis = (v3Model?.naam || "metamodel_v3")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "metamodel_v3";
    return basis.toLowerCase().endsWith(".json") ? basis.slice(0, -5) : basis;
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
    const v3Model = bouwExportV3Model();
    const apiBase = getDefaultApiBase();
    const standaardModelNaam = actiefDomein || modelNaam || v3Model?.naam || "";

    // Pre-validatie van het V3 model (behalve bij lokaal opslaan)
    const { errors: validationErrors, warnings: validationWarnings } =
      type !== "save" ? validateV3Model(v3Model) : { errors: [], warnings: [] };

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
        validationErrors,
        validationWarnings,
        values: {
          versie: v3Model?.versie || modelVersie || "v0.",
          naam: standaardModelNaam,
          indiener: "MW",
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
        validationErrors,
        validationWarnings,
        values: {
          versie: v3Model?.versie || modelVersie || "v0.",
          naam: standaardModelNaam,
          indiener: "MW",
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
      validationErrors,
      validationWarnings,
      values: {
        bron: laatstGepubliceerdSchemaID ? "id" : "editor",
        schemaVersieID: laatstGepubliceerdSchemaID ? String(laatstGepubliceerdSchemaID) : "",
        apiBase,
        wachtwoord: "1234",
        beschikbareDomeinen,
      },
    });
  }, [actiefDomein, bouwBeschikbareDomeinen, bouwExportV3Model, getDefaultApiBase, laatstGepubliceerdSchemaID, maakVoorstelBestandsnaam, modelNaam, modelVersie]);

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

    const v3Model = bouwExportV3Model();
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
  }, [bouwExportV3Model]);

  const publiceerSchemaModel = useCallback(async (values, { stilNaSucces = false } = {}) => {
    const v3Model = bouwExportV3Model();
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
  }, [bouwExportV3Model, getDefaultApiBase]);

  const voerRebuildUit = useCallback(async ({ bron, schemaVersieID = null, modelOverride = null, beschikbareDomeinen = [], apiBase = "", wachtwoord = "1234" }) => {
    const rauwModel = modelOverride || bouwExportV3Model();
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
  }, [bouwExportV3Model, getDefaultApiBase]);

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
  /**
   * Sla de rauwe editor-staat (nodes + edges) op met extensie .editor-flow.json.
   * Handig tijdens ontwikkelen om een werkende canvas-staat te bewaren, ook als
   * die nog niet als V3-model geldig is. handleLoad herkent deze structuur al via
   * het `flowState`-veld.
   */
  const handleSaveEditorFlow = useCallback(() => {
    const naamHint = (modelNaam || "editor").replace(/[^a-zA-Z0-9_-]/g, "_");
    const standaardNaam = `${naamHint}.editor-flow.json`;
    const naam = window.prompt("Bestandsnaam voor rauwe editor-staat:", standaardNaam);
    if (!naam) return;
    const payload = {
      _format: "editor-flow-v1",
      modelNaam: modelNaam || "",
      bewaardOp: new Date().toISOString(),
      flowState: { nodes, edges },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = naam.endsWith(".json") ? naam : `${naam}.editor-flow.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [modelNaam, nodes, edges]);
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
            if (typeof onV3ModelLoaded === "function") {
              onV3ModelLoaded(payload, file.name || "lokaal-bestand");
            }
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
        onSaveEditorFlow={handleSaveEditorFlow}
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
        onNormaliseerAlleRelaties={handleNormaliseerAlleRelaties}
        onSnapAlleNaarGrid={handleSnapAlleNaarGrid}
        activeEdgeMode={activeEdgeMode}
        onSetActiveEdgeMode={setActiveEdgeMode}
      />

      <ActionDialog
        dialog={actieDialoog}
        onChange={wijzigActieDialoogVeld}
        onClose={sluitActieDialoog}
        onSubmit={submitActieDialoog}
      />

      <div className="editor-main">
        {/* Het React Flow canvas — dit is waar de magie gebeurt */}
        <div className={`editor-canvas${activeEdgeMode !== EDGE_MODES.NONE ? ` ${activeEdgeMode.cursorClass}` : ""}`} ref={canvasRef}>
          {activeEdgeMode !== EDGE_MODES.NONE && (
            <div className="edge-mode-indicator">
              {activeEdgeMode.icon} {activeEdgeMode.label}-modus actief — sleep van bron naar doel &nbsp;
              <span style={{ opacity: 0.7, fontSize: "11px" }}>(Esc om te annuleren)</span>
            </div>
          )}
          <ReactFlow
            nodes={visueleNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onInit={(instance) => {
              reactFlowRef.current = instance;
            }}
            onConnect={onConnect}
            onConnectEnd={handleConnectEnd}
            onNodeClick={onNodeClick}
            onNodeDragStart={() => pushCanvasUndo("move-node")}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onSelectionContextMenu={onSelectionContextMenu}
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
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              menuType={contextMenu.menuType || "align"}
              itemCount={contextMenu.count}
              items={contextMenu.items}
              header={contextMenu.header}
              beschikbareDomeinen={beschikbareDomeinen}
              heeftDomeinWijziging={contextMenu.heeftDomeinWijziging}
              onAlign={handleAlign}
              onAction={handleDependencyAction}
              onDomeinWijzigen={handleDomeinWijzigen}
              onClose={() => setContextMenu(null)}
            />
          )}
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
