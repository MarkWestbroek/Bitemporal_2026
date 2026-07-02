/**
 * ConnectorEdge — dé generieke React Flow-edge van de diagramcore.
 *
 * Volledig declaratief: rendert wat er in `data.presentatie` staat en kent
 * géén elementtypen. De classificatie (compositie/associatie/dependency/…)
 * gebeurt in het profiel (adapter of connector-materialisatie) dat de
 * presentatie berekent. Dit is de kern van de core/profiel-splitsing voor
 * edges (plan §4.4).
 *
 * data.presentatie:
 *   lijn:        "solid" | "dash-6-3" | "dash-4-3" | "dash-4-4"
 *   kleur:       basiskleur (selected → accent, tenzij `vasteKleur`)
 *   opacity?:    number
 *   markerStart: "ruit" | null            — compositie-ruit aan bronzijde
 *   markerEnd:   "pijl-open" | "driehoek" | null
 *   labels: [ { zijde: "bron"|"doel"|"midden", offset?: {x,y},
 *               delen: [ { tekst, soort: "rolnaam"|"kardinaliteit"|"constraint"|"naam", kleur? } ] } ]
 */
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from "@xyflow/react";

const DASHES = {
  "dash-6-3": "6 3",
  "dash-4-3": "4 3",
  "dash-4-4": "4 4",
};

const SOORT_KLASSE = {
  rolnaam: "dc-edge-rolnaam",
  kardinaliteit: "dc-edge-kardinaliteit",
  constraint: "dc-edge-constraint",
  naam: "dc-edge-naam",
};

function ConnectorEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) {
  const p = data?.presentatie || {};
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const kleur = selected && !p.vasteKleur ? "#2563eb" : p.kleur || "#64748b";
  const ruitId = `dc-ruit-${id}`;
  const pijlId = `dc-pijl-${id}`;
  const driehoekId = `dc-driehoek-${id}`;

  // Labelposities: 70% richting doel resp. bron (zelfde heuristiek als de
  // umleditor-edge, voor visuele pariteit).
  const posities = {
    midden: { x: labelX, y: labelY },
    doel: { x: labelX + (targetX - labelX) * 0.7, y: labelY + (targetY - labelY) * 0.7 },
    bron: { x: labelX + (sourceX - labelX) * 0.7, y: labelY + (sourceY - labelY) * 0.7 },
  };

  return (
    <>
      <defs>
        {p.markerStart === "ruit" && (
          <marker id={ruitId} markerWidth="22" markerHeight="16" refX="2" refY="8" orient="auto" markerUnits="userSpaceOnUse">
            <polygon points="2,8 11,3 20,8 11,13" fill={kleur} stroke={kleur} strokeWidth="1" />
          </marker>
        )}
        {p.markerEnd === "pijl-open" && (
          <marker id={pijlId} markerWidth="12" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
            <path d="M 1 2 L 9 5 L 1 8" fill="none" stroke={kleur} strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        )}
        {p.markerEnd === "driehoek" && (
          <marker id={driehoekId} markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto" markerUnits="strokeWidth">
            <path d="M 1 1 L 13 7 L 1 13 Z" fill="white" stroke={kleur} strokeWidth="1.2" />
          </marker>
        )}
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={p.markerStart === "ruit" ? `url(#${ruitId})` : undefined}
        markerEnd={
          p.markerEnd === "pijl-open" ? `url(#${pijlId})`
          : p.markerEnd === "driehoek" ? `url(#${driehoekId})`
          : undefined
        }
        style={{
          stroke: kleur,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: DASHES[p.lijn] || undefined,
          opacity: p.opacity,
        }}
      />

      {(p.labels || []).map((label, i) => {
        const basis = posities[label.zijde] || posities.midden;
        const off = label.offset || { x: 0, y: 0 };
        const alleenNaam = label.delen?.length === 1 && label.delen[0].soort === "naam";
        return (
          <EdgeLabelRenderer key={i}>
            <div
              className={alleenNaam ? undefined : "dc-edge-label"}
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${basis.x + (off.x || 0)}px, ${basis.y + (off.y || 0)}px)`,
                pointerEvents: "all",
                userSelect: "none",
              }}
            >
              {label.delen.map((deel, j) => (
                <span key={j} className={SOORT_KLASSE[deel.soort] || undefined} style={deel.kleur ? { color: deel.kleur } : undefined}>
                  {deel.tekst}
                </span>
              ))}
            </div>
          </EdgeLabelRenderer>
        );
      })}
    </>
  );
}

export default ConnectorEdge;
