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
import { useMemo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore as useRFStore,
  useStoreApi,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles/diagramcore.css";
import "../shapes/basisShapes.jsx"; // registreert de standaard-shapes
import ElementNode from "./ElementNode.jsx";
import ConnectorEdge from "./ConnectorEdge.jsx";
import { materialiseerConnectoren, vindConnectorType, besteZijde, ANKER_PREFIX } from "./materialiseerConnectoren.js";

/** Intern core-ElementType voor de synthetische anker-nodes (ASOC-patroon). */
const ANKER_ELEMENT_TYPE = {
  id: "__anker",
  label: "Anker",
  shape: "anker",
  handleStijl: "onzichtbaar",
  resizebaar: false,
};
import { berekenUitlijning, berekenRasterSnap } from "../layout/uitlijnen.js";

const nodeTypes = { element: ElementNode };
const edgeTypes = { connector: ConnectorEdge };

/** "#rrggbb" → rgba met alpha (voor subtiele kader-preview in de minimap). */
function hexTransparant(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return `rgba(148, 163, 184, ${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Minimap-preview per node: de vorm volgt de ShapeType — een bol wordt een
 * cirkel, een kader blijft een subtiel transparant vlak (ook mét eigen
 * achtergrondkleur), de rest een rechthoek in de elementkleur.
 */
function MiniMapNode({ id, x, y, width, height }) {
  const node = useRFStore((s) => s.nodeLookup?.get(id));
  const et = node?.data?.elementType;
  const el = node?.data?.element;
  if (et?.achtergrond) {
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={el?.data?.achtergrondKleur ? hexTransparant(el.data.achtergrondKleur, 0.22) : "rgba(148, 163, 184, 0.18)"}
        stroke={el?.data?.kleur || "#94a3b8"}
        strokeWidth={1}
      />
    );
  }
  const vulling = el?.data?.kleur || et?.kleur || "#e2e8f0";
  if (et?.shape === "bol") {
    return (
      <circle cx={x + width / 2} cy={y + height / 2} r={Math.min(width, height) / 2} fill={vulling} />
    );
  }
  return <rect x={x} y={y} width={width} height={height} rx={2} fill={vulling} />;
}

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
  selectieId = null,
  onSelectElement,
  onNodePositie,
  onNodePosities,
  onNodeSize,
  onVerbind,
  onVerwijder,
  onVerwijderConnectoren,
  onNormaliseer,
  onViewport,
  onLabelOffset,
  onKnikken,
  onContainerDrop,
  shapeSet,
  layoutApiRef,
  bouwContextMenu,
}) {
  const lookups = useMemo(() => {
    const basis = bouwLookups(diagramType);
    // Shape-set (P07): een gekozen set overschrijft per elementtype de vorm —
    // zelfde Definitie, andere gedaante (bv. MIM-vormgrammatica vs klassiek).
    // Een entry is een volledige "skin": shape + icoon + kleur. Terugwaarts
    // compatibel: een kale string telt als alleen-shape.
    if (!shapeSet) return basis;
    const overlay = { ...basis.elementTypesById };
    for (const [etId, waarde] of Object.entries(shapeSet)) {
      const et = overlay[etId];
      if (!et || !waarde) continue;
      const skin = typeof waarde === "string" ? { shape: waarde } : waarde;
      if (et.isConnector) {
        // Connectortype: de skin overschrijft de edgePresentatie (lijnstijl).
        overlay[etId] = {
          ...et,
          edgePresentatie: {
            ...(et.edgePresentatie || {}),
            ...(skin.lijn ? { lijn: skin.lijn } : {}),
            ...(skin.vorm ? { vorm: skin.vorm } : {}),
            ...("markerStart" in skin ? { markerStart: skin.markerStart || null } : {}),
            ...("markerEnd" in skin ? { markerEnd: skin.markerEnd || null } : {}),
            ...(skin.kleur ? { kleur: skin.kleur } : {}),
          },
        };
      } else {
        // Node-type: shape + icoon + kleur.
        overlay[etId] = {
          ...et,
          ...(skin.shape ? { shape: skin.shape } : {}),
          ...(skin.icoon ? { icoon: skin.icoon } : {}),
          ...(skin.kleur ? { kleur: skin.kleur } : {}),
        };
      }
    }
    return { ...basis, elementTypesById: overlay };
  }, [diagramType, shapeSet]);
  const { getNodes, screenToFlowPosition, getViewport, setViewport } = useReactFlow();
  const rfStoreApi = useStoreApi();
  // Contextmenu (rechtsklik): positie in schermcoördinaten, of null.
  const [contextMenu, setContextMenu] = useState(null);
  useEffect(() => {
    if (!contextMenu) return;
    const dicht = (e) => {
      if (!e.target.closest?.(".dc-contextmenu")) setContextMenu(null);
    };
    const esc = (e) => e.key === "Escape" && setContextMenu(null);
    window.addEventListener("pointerdown", dicht, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", dicht, true);
      window.removeEventListener("keydown", esc);
    };
  }, [contextMenu]);

  // Afgeleide weergave-compartimenten (bv. overgeërfde velden) via de
  // profiel-hook elementType.hooks.extraCompartimenten(element, ctx).
  const verrijk = useCallback(
    (element, elementType) => {
      const extra = elementType.hooks?.extraCompartimenten?.(element, { elements });
      if (!extra?.length) return element;
      return { ...element, compartimenten: [...(element.compartimenten || []), ...extra] };
    },
    [elements]
  );

  // Nodes als interne React Flow-state, gevoed vanuit de props. Nodig omdat
  // selectie en slepen via node-changes lopen; de store blijft de waarheid
  // (posities gaan bij dragstop via onNodePositie terug).
  const [nodes, setNodes, onNodesChange] = useNodesState([]);

  // Programmatische selectie (bv. klik in een projectboom) vs. canvas-echo:
  // selectiePropRef ziet wanneer de selectieId-prop wijzigt; gemeldeSelectieRef
  // onthoudt de laatst gemelde/gezette selectie-handtekening zodat
  // handleSelectionChange geen oude canvas-selectie terug de context in duwt
  // (dat hield elke nieuwe boomselectie op de eerste geselecteerde vast).
  const selectiePropRef = useRef(selectieId);
  const gemeldeSelectieRef = useRef("");
  const selectieSig = (nodeIds, edgeIds = []) =>
    nodeIds.slice().sort().join("|") + "//" + edgeIds.slice().sort().join("|");

  // Gemeten node-maten (React Flow): de kortste-weg-keuze rekent daarmee in
  // plaats van met de 200×80-schatting — anders kiest hij bij brede/lage
  // nodes de verkeerde zijde (Marks normaliseer-melding, 2026-07-04).
  const [maten, setMaten] = useState({});
  useEffect(() => {
    const volgende = {};
    for (const n of nodes) {
      if (n.measured?.width) {
        volgende[n.id] = { width: n.measured.width, height: n.measured.height };
      }
    }
    setMaten((huidig) => {
      const items = Object.entries(volgende);
      const zelfde =
        items.length === Object.keys(huidig).length &&
        items.every(([k, v]) => huidig[k]?.width === v.width && huidig[k]?.height === v.height);
      return zelfde ? huidig : volgende;
    });
  }, [nodes]);

  // Connector-materialisatie: kale edges + (bij velden) anker/box-structuur.
  const gematerialiseerd = useMemo(
    () => materialiseerConnectoren(elements, diagram, lookups.elementTypesById, maten),
    [elements, diagram, lookups, maten]
  );

  useEffect(() => {
    const flowNodes = (diagram?.nodes || [])
      .map((ref) => {
        const element = elements[ref.elementId];
        if (!element) return null;
        const elementType = lookups.elementTypesById[element.elementType];
        if (!elementType) return null;
        // Een kale connector (geen velden) heeft geen box-gedaante: zijn
        // lidmaatschap bewaart alleen posities voor als hij weer velden krijgt.
        if (
          elementType.isConnector &&
          !(element.compartimenten || []).some((c) => (c.velden || []).length > 0)
        ) {
          return null;
        }
        return {
          id: ref.elementId,
          type: "element",
          position: ref.position || { x: 0, y: 0 },
          // Grootte per diagram-lidmaatschap (metamodel: Position.elementSize)
          ...(ref.size ? { style: { width: ref.size.width, height: ref.size.height } } : {}),
          // Achtergrond-elementen (kaders) starten diep onder de rest (-10);
          // de handmatige z-order (contextmenu) telt daar bovenop, zodat ook
          // kaders onderling naar voren/achteren kunnen.
          ...(elementType.achtergrond || element.data?.zOrde
            ? { zIndex: (elementType.achtergrond ? -10 : 0) + (element.data?.zOrde || 0) }
            : {}),
          data: {
            element: verrijk(element, elementType),
            elementType,
            bewerkbaar,
            onResize: onNodeSize,
            fieldTypesById: lookups.fieldTypesById,
            compartmentTypesById: lookups.compartmentTypesById,
          },
        };
      })
      .filter(Boolean);

    // Synthetische nodes uit de connector-materialisatie: ankers (klein
    // rondje op de lijn) en auto-geplaatste connector-boxen zonder eigen
    // diagram-lidmaatschap.
    for (const extra of gematerialiseerd.extraNodes) {
      if (extra.soort === "anker") {
        flowNodes.push({
          id: extra.id,
          type: "element",
          position: extra.position,
          data: {
            element: { id: extra.id, naam: "", elementType: "__anker", data: { connectorId: extra.connectorId } },
            elementType: ANKER_ELEMENT_TYPE,
            bewerkbaar,
            fieldTypesById: lookups.fieldTypesById,
            compartmentTypesById: lookups.compartmentTypesById,
          },
        });
      } else if (extra.soort === "box") {
        const element = elements[extra.connectorId];
        const elementType = element ? lookups.elementTypesById[element.elementType] : null;
        if (!element || !elementType) continue;
        flowNodes.push({
          id: element.id,
          type: "element",
          position: extra.position,
          data: {
            element: verrijk(element, elementType),
            elementType,
            bewerkbaar,
            onResize: onNodeSize,
            fieldTypesById: lookups.fieldTypesById,
            compartmentTypesById: lookups.compartmentTypesById,
          },
        });
      }
    }

    // Behoud selectie én node-identiteit over rebuilds heen. Elke
    // store-wijziging (bv. typen in de inspector) bouwt de nodes opnieuw op;
    // door per id het bestaande node-object als basis te nemen blijven de
    // interne React Flow-velden (measured, dragging, …) bewaard. Zonder dat
    // werden alle nodes opnieuw geïnitialiseerd — met React Flow-fout #015
    // ("trying to drag a node that is not initialized") bij slepen tijdens
    // dat venster, en incidenteel een (transient) leeg canvas doordat de
    // hermeting alles verborg.
    // Wijziging van de selectieId-prop = programmatische selectie (boom,
    // inspector, net geplaatst element): die wint dan van de bewaarde
    // canvas-selectie. Ongewijzigde prop = gewone rebuild: selectie behouden.
    const selectiePropGewijzigd = selectiePropRef.current !== selectieId;
    selectiePropRef.current = selectieId;
    setNodes((huidige) => {
      const perIdHuidig = new Map(huidige.map((n) => [n.id, n]));
      let geselecteerd = new Set(huidige.filter((n) => n.selected).map((n) => n.id));
      if (selectiePropGewijzigd && !(selectieId && geselecteerd.has(selectieId))) {
        // Vervang de selectie door het (eventueel elders wonende) element;
        // staat het niet op dit diagram, dan deselecteert de canvas. De
        // handtekening vooraf melden zodat de React Flow-echo van deze
        // wijziging de context niet overschrijft.
        geselecteerd = new Set(
          selectieId && flowNodes.some((n) => n.id === selectieId) ? [selectieId] : []
        );
        gemeldeSelectieRef.current = selectieSig([...geselecteerd]);
      } else {
        // Programmatische selectie (bv. net geplaatst element) ook markeren,
        // anders "verliest" de inspector het element bij de eerstvolgende rebuild.
        if (selectieId && !huidige.length) geselecteerd.add(selectieId);
        if (selectieId && flowNodes.some((n) => n.id === selectieId) && geselecteerd.size === 0) {
          geselecteerd.add(selectieId);
        }
      }
      return flowNodes.map((n) => {
        const oud = perIdHuidig.get(n.id);
        const selected = geselecteerd.has(n.id);
        if (!oud) return selected ? { ...n, selected: true } : n;
        return {
          ...oud,
          // Tijdens een actieve drag wint de sleep-positie; de store volgt
          // pas bij dragstop (onNodePositie/onNodePosities).
          position: oud.dragging ? oud.position : n.position,
          style: n.style,
          zIndex: n.zIndex,
          data: n.data,
          selected,
        };
      });
    });
    // Programmatische element-selectie vervangt ook een hangende
    // edge-selectie (anders meldt die zich later alsnog bij de context).
    if (selectiePropGewijzigd && selectieId) {
      setEdges((hd) =>
        hd.some((e) => e.selected) ? hd.map((e) => (e.selected ? { ...e, selected: false } : e)) : hd
      );
    }
  }, [diagram, elements, lookups, gematerialiseerd, verrijk, setNodes, bewerkbaar, onNodeSize, selectieId]);

  // Edges óók als interne React Flow-state: edge-selectie loopt (net als bij
  // nodes) via changes, en zonder toegepaste changes "plakt" een klik niet —
  // waardoor Delete op een connector nooit kon werken.
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  useEffect(() => {
    // Kortste-weg-handles voor presentatie-edges zonder expliciete handles
    // (na "normaliseer relaties" zijn ze gewist).
    const refs = new Map((diagram?.nodes || []).map((n) => [n.elementId, n]));
    const mid = (id) => {
      const r = refs.get(id);
      if (!r) return null;
      return {
        x: r.position.x + (r.size?.width ?? maten[id]?.width ?? 200) / 2,
        y: r.position.y + (r.size?.height ?? maten[id]?.height ?? 80) / 2,
      };
    };
    const geimporteerd = (diagram?.edges || []).map((e) => {
      let { sourceHandle, targetHandle } = e;
      if (!sourceHandle || !targetHandle) {
        const b = mid(e.source);
        const d = mid(e.target);
        if (b && d) {
          sourceHandle = sourceHandle || `source-${besteZijde(b, d)}`;
          targetHandle = targetHandle || `target-${besteZijde(d, b)}`;
        }
      }
      return {
        ...e,
        sourceHandle,
        targetHandle,
        type: "connector",
        hidden: e.hidden || false,
        selectable: false, // geïmporteerde presentatie-edges zijn geen elementen
      };
    });
    // Gematerialiseerde connectoren zijn wél selecteerbaar (en dus met Delete
    // te wissen) zodra de canvas bewerkbaar is.
    const connectorEdges = gematerialiseerd.edges.map((e) => ({
      ...e,
      type: "connector",
      selectable: bewerkbaar,
      // Sleepbare labels (vgl. 0.2): de edge meldt de nieuwe offset per
      // zijde; de activiteit bewaart hem op het connector-element.
      data:
        bewerkbaar && e.data?.connectorId
          ? {
              ...e.data,
              ...(onLabelOffset
                ? { onLabelOffset: (zijde, offset) => onLabelOffset(e.data.connectorId, zijde, offset) }
                : {}),
              // Knikpunten alleen op de directe gedaante (daar zet de
              // materialisatie het knikken-veld, evt. null).
              ...(onKnikken && e.data.knikken !== undefined
                ? { onKnikken: (lijst) => onKnikken(e.data.connectorId, lijst) }
                : {}),
            }
          : e.data,
    }));
    const flowEdges = [...geimporteerd, ...connectorEdges];
    setEdges((huidige) => {
      const geselecteerd = new Set(huidige.filter((e) => e.selected).map((e) => e.id));
      return flowEdges.map((e) => (geselecteerd.has(e.id) ? { ...e, selected: true } : e));
    });
  }, [diagram, gematerialiseerd, bewerkbaar, setEdges, onLabelOffset, onKnikken, maten]);

  const handleSelectionChange = useCallback(
    ({ nodes: sel, edges: selEdges }) => {
      if (!onSelectElement) return;
      // Echo-demping: React Flow meldt de selectie ook na node-rebuilds
      // (nieuwe objecten, zelfde selectie). Alleen échte wijzigingen
      // doorgeven, anders overschrijft de oude canvas-selectie elke
      // programmatische selectie uit de projectboom.
      const sig = selectieSig((sel || []).map((n) => n.id), (selEdges || []).map((e) => e.id));
      if (sig === gemeldeSelectieRef.current) return;
      gemeldeSelectieRef.current = sig;
      if (sel?.length) {
        const eerste = sel[0];
        // Anker aangeklikt → selecteer de achterliggende connector.
        const id = eerste.id.startsWith(ANKER_PREFIX)
          ? eerste.id.slice(ANKER_PREFIX.length)
          : eerste.id;
        onSelectElement(elements[id] || null);
        return;
      }
      // Edge van een connector aangeklikt → selecteer dat connector-element,
      // zodat je een kale connector (bv. lege REL) in de inspector kunt
      // bewerken en er velden aan kunt geven (waarna hij materialiseert).
      const connectorId = selEdges?.find((e) => e.data?.connectorId)?.data?.connectorId;
      onSelectElement(connectorId ? elements[connectorId] || null : null);
    },
    [onSelectElement, elements]
  );

  const handleNodeDragStop = useCallback(
    (_ev, node, nodes) => {
      if (!bewerkbaar) return;
      // Bij multi-drag geeft React Flow álle meegesleepte nodes als derde
      // argument — alleen `node` persisteren liet de rest terugspringen.
      const gesleept = nodes?.length ? nodes : node ? [node] : [];
      if (gesleept.length > 1 && onNodePosities) {
        const record = {};
        for (const n of gesleept) if (n?.id) record[n.id] = n.position;
        onNodePosities(record);
      } else if (gesleept[0]?.id && onNodePositie) {
        onNodePositie(gesleept[0].id, gesleept[0].position);
      }
      // "Slepen ín een package": eindigt een enkele sleep met het middelpunt
      // binnen een container-node (ElementType.containerVoor), meld dat aan
      // de activiteit — die legt/verhangt de lidmaatschaps-connector.
      if (onContainerDrop && gesleept.length === 1 && gesleept[0]?.id) {
        const n = gesleept[0];
        const mid = {
          x: n.position.x + (n.measured?.width ?? 200) / 2,
          y: n.position.y + (n.measured?.height ?? 80) / 2,
        };
        const kandidaten = getNodes().filter((k) => {
          if (k.id === n.id) return false;
          const et = lookups.elementTypesById[k.data?.element?.elementType];
          if (!et?.containerVoor) return false;
          const w = k.measured?.width ?? 200;
          const h = k.measured?.height ?? 80;
          return (
            mid.x >= k.position.x &&
            mid.x <= k.position.x + w &&
            mid.y >= k.position.y &&
            mid.y <= k.position.y + h
          );
        });
        if (kandidaten.length) {
          // Bij geneste containers wint de kleinste (binnenste).
          kandidaten.sort(
            (a, b) =>
              (a.measured?.width ?? 200) * (a.measured?.height ?? 80) -
              (b.measured?.width ?? 200) * (b.measured?.height ?? 80)
          );
          onContainerDrop(n.id, kandidaten[0].id);
        }
      }
    },
    [bewerkbaar, onNodePositie, onNodePosities, onContainerDrop, getNodes, lookups]
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

  // Dubbelklik op een connector-edge → normaliseer die connector (anker
  // terug naar het middelpunt), zoals in de oude editor.
  const handleEdgeDoubleClick = useCallback(
    (_ev, edge) => {
      if (bewerkbaar && onNormaliseer && edge.data?.connectorId) {
        onNormaliseer([edge.data.connectorId]);
      }
    },
    [bewerkbaar, onNormaliseer]
  );

  // Rechtsklik: contextmenu met acties uit de activiteit (bouwContextMenu).
  const openContextMenu = useCallback(
    (ev, doelwit) => {
      if (!bouwContextMenu) return;
      ev.preventDefault();
      const selectieAantal = getNodes().filter((n) => n.selected).length;
      // Op een connector (edge of gematerialiseerde box/anker) krijgt de
      // activiteit het connector-id — voor connector-acties zoals lijnvorm.
      const connectorId =
        doelwit?.data?.connectorId ||
        (doelwit?.data?.elementType?.isConnector ? doelwit.id : null) ||
        (typeof doelwit?.id === "string" && doelwit.id.startsWith(ANKER_PREFIX)
          ? doelwit.id.slice(ANKER_PREFIX.length)
          : null);
      // Gewone element-node (geen connector/anker): voor node-acties zoals
      // z-order en "zelfde maat als deze".
      const nodeId =
        !connectorId && doelwit?.position && doelwit?.data?.element ? doelwit.id : null;
      const items = bouwContextMenu({ selectieAantal, connectorId, nodeId });
      if (items?.length) setContextMenu({ x: ev.clientX, y: ev.clientY, items });
    },
    [bouwContextMenu, getNodes]
  );

  // ── Imperatieve layout-API (plan §4.5) ─────────────────────────────────────
  // Uitlijnen/snap is core-geometrie op de live (gemeten) nodes; auto-layout
  // voert een LayoutStrategie van het profiel uit. Resultaten gaan als één
  // bulk-mutatie terug naar de store (één undo-stap).
  useImperativeHandle(
    layoutApiRef,
    () => {
      const naarItems = (flowNodes) =>
        flowNodes.map((n) => ({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
          width: n.measured?.width ?? 200,
          height: n.measured?.height ?? 100,
        }));
      const pasToe = (posities) => {
        const record =
          posities instanceof Map ? Object.fromEntries(posities) : posities || {};
        if (Object.keys(record).length && onNodePosities) onNodePosities(record);
      };
      return {
        /** Uitlijnen/verdelen op de selectie (minimaal 2 nodes). */
        lijnUit: (mode) => {
          const selectie = getNodes().filter((n) => n.selected);
          pasToe(berekenUitlijning(mode, naarItems(selectie)));
        },
        /**
         * Selecteer een node op het canvas (tree-klik). Alleen als hij
         * (deels) buiten beeld valt wordt het beeld minimaal bijgeschoven —
         * centreren op elke klik gaf te veel onrust.
         */
        focusNode: (elementId) => {
          const n = getNodes().find((x) => x.id === elementId);
          if (!n) return;
          setNodes((huidige) => huidige.map((x) => ({ ...x, selected: x.id === elementId })));
          const { width, height } = rfStoreApi.getState();
          const vp = getViewport();
          const w = n.measured?.width ?? 200;
          const h = n.measured?.height ?? 80;
          const marge = 32;
          const links = n.position.x * vp.zoom + vp.x;
          const boven = n.position.y * vp.zoom + vp.y;
          const rechts = links + w * vp.zoom;
          const onder = boven + h * vp.zoom;
          let dx = 0;
          let dy = 0;
          if (links < marge) dx = marge - links;
          else if (rechts > width - marge) dx = width - marge - rechts;
          if (boven < marge) dy = marge - boven;
          else if (onder > height - marge) dy = height - marge - onder;
          // Node groter dan het beeld: lijn de linker-/bovenkant uit.
          if (w * vp.zoom > width - 2 * marge) dx = marge - links;
          if (h * vp.zoom > height - 2 * marge) dy = marge - boven;
          if (dx || dy) {
            setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 200 });
          }
        },
        /** Geselecteerde nodes dezelfde maat geven als de bron-node (L02). */
        maakGelijkeMaat: (bronId) => {
          const alle = getNodes();
          const maat = alle.find((n) => n.id === bronId)?.measured;
          if (!maat?.width || !onNodeSize) return;
          for (const n of alle) {
            if (!n.selected || n.id === bronId || n.id.startsWith(ANKER_PREFIX)) continue;
            onNodeSize(n.id, { width: maat.width, height: maat.height });
          }
        },
        /** Alle nodes op het raster. */
        snapRaster: (raster = 16) => {
          pasToe(berekenRasterSnap(naarItems(getNodes()), raster));
        },
        /** Flow-coördinaat van het midden van het zichtbare canvas. */
        viewportMidden: () => {
          const el = document.querySelector(".dc-canvas");
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        },
        /** Voer een profiel-LayoutStrategie uit (heel diagram of selectie). */
        voerLayoutUit: (strategie, alleenSelectie = false) => {
          if (!strategie?.run) return;
          const flowNodes = getNodes().map((n) => ({
            id: n.id,
            type: n.data?.element?.elementType,
            position: n.position,
            measured: n.measured,
            hidden: n.hidden,
            data: n.data?.element?.data || {},
          }));
          const selectieIds = alleenSelectie
            ? getNodes().filter((n) => n.selected).map((n) => n.id)
            : null;
          if (alleenSelectie && (selectieIds?.length ?? 0) < 2) return;
          pasToe(
            strategie.run({ flowNodes, flowEdges: edges, selectieIds, elements, diagram })
          );
        },
      };
    },
    [getNodes, screenToFlowPosition, edges, elements, diagram, onNodePosities]
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
      onEdgeDoubleClick={handleEdgeDoubleClick}
      onPaneContextMenu={openContextMenu}
      onNodeContextMenu={openContextMenu}
      onEdgeContextMenu={openContextMenu}
      onSelectionContextMenu={openContextMenu}
      onPaneClick={() => setContextMenu(null)}
      onMoveEnd={handleMoveEnd}
      nodesDraggable={bewerkbaar}
      nodesConnectable={bewerkbaar}
      elementsSelectable
      deleteKeyCode={bewerkbaar ? ["Delete"] : null}
      elevateNodesOnSelect={false}
      // Zonder opgeslagen viewport: fitView op bestaande inhoud, maar een leeg
      // (nieuw) diagram start gewoon op zoom 1 — anders is de eerste node mini.
      defaultViewport={viewport || { x: 0, y: 0, zoom: 1 }}
      fitView={!viewport && (diagram?.nodes?.length || 0) > 0}
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} />
      <Controls showInteractive={false} />
      {contextMenu && (
        <div
          className="dc-contextmenu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.items.map((item, i) =>
            item.sep ? (
              <div key={i} className="dc-contextmenu-sep" />
            ) : item.kop ? (
              <div key={i} className="dc-contextmenu-kop">{item.label}</div>
            ) : (
              <button
                key={item.id || i}
                className="dc-contextmenu-item"
                disabled={item.disabled}
                onClick={() => {
                  setContextMenu(null);
                  item.onClick?.();
                }}
              >
                {item.icoon ? <span className="dc-contextmenu-icoon">{item.icoon}</span> : null}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
      <MiniMap pannable zoomable nodeComponent={MiniMapNode} />
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
