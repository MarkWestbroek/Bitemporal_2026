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
import { useMemo, useCallback, useEffect, useImperativeHandle, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
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
  layoutApiRef,
  bouwContextMenu,
}) {
  const lookups = useMemo(() => bouwLookups(diagramType), [diagramType]);
  const { getNodes, screenToFlowPosition } = useReactFlow();
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

  // Connector-materialisatie: kale edges + (bij velden) anker/box-structuur.
  const gematerialiseerd = useMemo(
    () => materialiseerConnectoren(elements, diagram, lookups.elementTypesById),
    [elements, diagram, lookups]
  );

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
          // Achtergrond-elementen (boundaries/kaders) renderen ónder de rest
          ...(elementType.achtergrond ? { zIndex: -1 } : {}),
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
    setNodes((huidige) => {
      const perIdHuidig = new Map(huidige.map((n) => [n.id, n]));
      const geselecteerd = new Set(huidige.filter((n) => n.selected).map((n) => n.id));
      // Programmatische selectie (bv. net geplaatst element) ook markeren,
      // anders "verliest" de inspector het element bij de eerstvolgende rebuild.
      if (selectieId && !huidige.length) geselecteerd.add(selectieId);
      if (selectieId && flowNodes.some((n) => n.id === selectieId) && geselecteerd.size === 0) {
        geselecteerd.add(selectieId);
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
        x: r.position.x + (r.size?.width ?? 200) / 2,
        y: r.position.y + (r.size?.height ?? 80) / 2,
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
        bewerkbaar && onLabelOffset && e.data?.connectorId
          ? {
              ...e.data,
              onLabelOffset: (zijde, offset) => onLabelOffset(e.data.connectorId, zijde, offset),
            }
          : e.data,
    }));
    const flowEdges = [...geimporteerd, ...connectorEdges];
    setEdges((huidige) => {
      const geselecteerd = new Set(huidige.filter((e) => e.selected).map((e) => e.id));
      return flowEdges.map((e) => (geselecteerd.has(e.id) ? { ...e, selected: true } : e));
    });
  }, [diagram, gematerialiseerd, bewerkbaar, setEdges, onLabelOffset]);

  const handleSelectionChange = useCallback(
    ({ nodes: sel, edges: selEdges }) => {
      if (!onSelectElement) return;
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
    },
    [bewerkbaar, onNodePositie, onNodePosities]
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
    (ev) => {
      if (!bouwContextMenu) return;
      ev.preventDefault();
      const selectieAantal = getNodes().filter((n) => n.selected).length;
      const items = bouwContextMenu({ selectieAantal });
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
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => {
          // Achtergrond-elementen (kaders) niet als dekkend blok tonen —
          // zelfde subtiele tint als op het canvas.
          if (n.data?.elementType?.achtergrond) {
            return n.data?.element?.data?.achtergrondKleur || "rgba(148, 163, 184, 0.18)";
          }
          return n.data?.element?.data?.kleur || n.data?.elementType?.kleur || "#e2e8f0";
        }}
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
