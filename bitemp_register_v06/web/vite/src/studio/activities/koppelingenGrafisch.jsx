/**
 * koppelingenGrafisch — de **grafische** kruisverband-view (consolidatieplan
 * fase 4): een vrij canvas dat elementen uit *verschillende* profielen naast
 * elkaar toont en de trace-relaties ertussen als gerichte lijnen.
 *
 * Anders dan een gewoon diagramcore-diagram: geen "Maken"-taakbalk (elementen
 * ontstaan in hun eigen profiel), wél een soort-keuze; je **trekt een
 * traceer-relatie van element X naar element Y** (verbinden = link leggen).
 * De knopen zijn de eindpunten van bestaande links plus wat je zelf toevoegt;
 * hun posities en de losse knopen bewaart de kruis-store.
 *
 * Onder water één React Flow-canvas dat leest uit `useKruisStore` (links,
 * posities) en de per-profiel-stores (element-namen/typen/kleur).
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getProfieltype, getProfieltypen, effectieveStijl } from "../profieltypeRegistry";
import ProfielIcoon from "../ProfielIcoon.jsx";
import { useKruisStore, refKey, refUit, vanNaar, TRACE_SOORTEN } from "./koppelingenActivity.jsx";

const traceerbaar = () => getProfieltypen().filter((p) => !p.klassiek);

/** Element-info bij een ref (naam, kleur, profiel). */
function elementInfo(ref) {
  const p = getProfieltype(ref.profielId);
  const el = p?.useStore.getState().elements[ref.elementId];
  return { profiel: p, naam: el?.naam || ref.elementId, bestaat: !!el };
}

// ── Knoop: gekleurde kaart met profiel-icoon + naam ─────────────────
function KruisNode({ data }) {
  return (
    <div
      style={{
        minWidth: 120,
        maxWidth: 200,
        padding: "6px 10px",
        borderRadius: 8,
        border: `2px solid ${data.kleur || "var(--s-border)"}`,
        background: "var(--s-panel)",
        color: "var(--s-fg)",
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        boxShadow: data.ontbreekt ? "none" : "0 1px 3px rgba(0,0,0,0.2)",
        opacity: data.ontbreekt ? 0.5 : 1,
      }}
      title={`${data.naam} — ${data.profielLabel}`}
    >
      <Handle type="target" position={Position.Left} style={{ background: data.kleur }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
        <span style={{ color: data.kleur, display: "inline-flex" }}>{data.icoon}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.naam}</span>
      </div>
      <div style={{ fontSize: 10, color: "var(--s-fg-muted)" }}>{data.profielLabel}</div>
      <Handle type="source" position={Position.Right} style={{ background: data.kleur }} />
    </div>
  );
}

const nodeTypes = { kruis: KruisNode };

// ── Contextmenu op een edge (soort/richting/verwijderen) ────────────
function EdgeMenu({ menu, sluit }) {
  const zetSoort = useKruisStore((s) => s.zetSoort);
  const draaiOm = useKruisStore((s) => s.draaiOm);
  const verwijderLink = useKruisStore((s) => s.verwijderLink);
  React.useEffect(() => {
    if (!menu) return;
    const onDown = () => sluit();
    const onKey = (e) => e.key === "Escape" && sluit();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, sluit]);
  if (!menu) return null;
  const l = menu.link;
  const items = [
    { kop: `Trace-relatie` },
    ...TRACE_SOORTEN.map((t) => ({
      label: t,
      actief: l.soort === t,
      onClick: () => zetSoort(l.rij, l.kolom, t),
    })),
    { sep: true },
    { label: "Richting omdraaien", onClick: () => draaiOm(l.id) },
    { label: "Verwijderen", onClick: () => verwijderLink(l.id) },
  ];
  return (
    <div className="studio-ctxmenu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
      {items.map((it, i) =>
        it.sep ? (
          <div key={i} className="studio-ctxmenu__sep" />
        ) : it.kop ? (
          <div key={i} style={{ padding: "4px 10px 2px", fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--s-fg-muted)" }}>{it.kop}</div>
        ) : (
          <button key={it.label + i} type="button" className="studio-ctxmenu__item" onClick={() => { sluit(); it.onClick(); }} style={{ display: "flex", gap: 8 }}>
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.actief && <span style={{ color: "var(--s-accent, #4f46e5)" }}>✓</span>}
          </button>
        )
      )}
    </div>
  );
}

// ── Element-picker om een knoop toe te voegen ───────────────────────
function NodePicker({ onKies }) {
  const [profielId, setProfielId] = useState("");
  const [elementId, setElementId] = useState("");
  const profielen = traceerbaar();
  const p = profielId ? getProfieltype(profielId) : null;
  const elementen = p
    ? Object.values(p.useStore.getState().elements)
        .filter((el) => {
          const et = (p.descriptor.elementTypes || []).find((t) => t.id === el.elementType);
          return !et?.isConnector;
        })
        .sort((a, b) => (a.naam || a.id).localeCompare(b.naam || b.id))
    : [];
  const veld = { font: "inherit", fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel)", color: "var(--s-fg)" };
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <select value={profielId} onChange={(e) => { setProfielId(e.target.value); setElementId(""); }} style={veld}>
        <option value="">profiel…</option>
        {profielen.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
      </select>
      <select value={elementId} onChange={(e) => setElementId(e.target.value)} style={veld} disabled={!p}>
        <option value="">element…</option>
        {elementen.map((el) => <option key={el.id} value={el.id}>{el.naam || el.id}</option>)}
      </select>
      <button
        type="button"
        className="dc-mini-knop"
        disabled={!profielId || !elementId}
        onClick={() => { onKies({ profielId, elementId }); setElementId(""); }}
      >
        ＋ knoop
      </button>
    </div>
  );
}

// ── Het canvas ──────────────────────────────────────────────────────
function Canvas() {
  const links = useKruisStore((s) => s.links);
  const posities = useKruisStore((s) => s.posities);
  const losseNodes = useKruisStore((s) => s.losseNodes);
  const soort = useKruisStore((s) => s.soort);
  const zetKeuze = useKruisStore((s) => s.zetKeuze);
  const legLink = useKruisStore((s) => s.legLink);
  const zetPositie = useKruisStore((s) => s.zetPositie);
  const voegNodeToe = useKruisStore((s) => s.voegNodeToe);
  const verwijderNode = useKruisStore((s) => s.verwijderNode);
  const verwijderLink = useKruisStore((s) => s.verwijderLink);
  const [menu, setMenu] = useState(null);

  // Alle betrokken refKeys: eindpunten van links + losse knopen.
  const alleKeys = useMemo(() => {
    const set = new Set(losseNodes);
    for (const l of links) {
      set.add(refKey(l.rij));
      set.add(refKey(l.kolom));
    }
    return [...set];
  }, [links, losseNodes]);

  // Default-layout: kolom per profiel, elementen gestapeld. Opgeslagen
  // posities winnen; drag persisteert.
  const nodes = useMemo(() => {
    const perProfiel = {};
    for (const key of alleKeys) {
      const { profielId } = refUit(key);
      (perProfiel[profielId] ??= []).push(key);
    }
    const profielVolgorde = Object.keys(perProfiel);
    return alleKeys.map((key) => {
      const ref = refUit(key);
      const info = elementInfo(ref);
      const stijl = info.profiel ? effectieveStijl(info.profiel) : {};
      const kolom = profielVolgorde.indexOf(ref.profielId);
      const rij = perProfiel[ref.profielId].indexOf(key);
      const pos = posities[key] || { x: 40 + kolom * 260, y: 40 + rij * 96 };
      return {
        id: key,
        type: "kruis",
        position: pos,
        data: {
          naam: info.naam,
          profielLabel: info.profiel?.label || ref.profielId,
          kleur: stijl.kleur,
          icoon: info.profiel ? <ProfielIcoon profiel={info.profiel} /> : null,
          ontbreekt: !info.bestaat,
        },
      };
    });
  }, [alleKeys, posities]);

  const edges = useMemo(
    () =>
      links.map((l) => {
        const { van, naar } = vanNaar(l);
        return {
          id: l.id,
          source: refKey(van),
          target: refKey(naar),
          label: l.soort,
          labelStyle: { fontSize: 10, fill: "var(--s-fg)" },
          labelBgStyle: { fill: "var(--s-panel)" },
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "var(--s-fg-muted)" },
        };
      }),
    [links]
  );

  const onConnect = useCallback(
    (c) => { if (c.source && c.target) legLink(refUit(c.source), refUit(c.target), soort); },
    [legLink, soort]
  );
  const onNodeDragStop = useCallback((_e, node) => zetPositie(node.id, node.position), [zetPositie]);
  const onEdgesDelete = useCallback((weg) => weg.forEach((e) => verwijderLink(e.id)), [verwijderLink]);
  const onNodesDelete = useCallback((weg) => weg.forEach((n) => verwijderNode(n.id)), [verwijderNode]);
  const onEdgeContextMenu = useCallback(
    (e, edge) => {
      e.preventDefault();
      const l = useKruisStore.getState().links.find((x) => x.id === edge.id);
      if (l) setMenu({ x: e.clientX, y: e.clientY, link: l });
    },
    []
  );

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 10px", borderBottom: "1px solid var(--s-border)", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "var(--s-fg-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          Nieuwe relatie:
          <select value={soort} onChange={(e) => zetKeuze({ soort: e.target.value })} style={{ font: "inherit", fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel)", color: "var(--s-fg)" }}>
            {TRACE_SOORTEN.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <NodePicker onKies={(ref) => voegNodeToe(ref)} />
        <span style={{ fontSize: 11, color: "var(--s-fg-muted)", marginLeft: "auto" }}>
          Sleep van de rechter- naar de linkerstip om een relatie te leggen · rechtsklik op een lijn voor soort/richting · Delete verwijdert.
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }} className="dc-canvasvlak">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onEdgesDelete={onEdgesDelete}
          onNodesDelete={onNodesDelete}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneClick={() => setMenu(null)}
          deleteKeyCode={["Delete"]}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
        <EdgeMenu menu={menu} sluit={() => setMenu(null)} />
      </div>
    </div>
  );
}

export default function KoppelingenGrafisch() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
