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
 *   markerStart: "ruit" | "ruit-open" | null — compositie- (◆) of
 *                aggregatie-ruit (◇) aan de bronzijde
 *   markerEnd:   "pijl-open" | "driehoek" | null
 *   labels: [ { zijde: "bron"|"doel"|"midden", offset?: {x,y},
 *               delen: [ { tekst, soort: "rolnaam"|"kardinaliteit"|"constraint"|"naam", kleur? } ] } ]
 */
import { useLayoutEffect, useRef, useState } from "react";
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
  const pijlId = `dc-pijl-${id}`;
  const driehoekId = `dc-driehoek-${id}`;

  // Compositie- (◆, gevuld) of aggregatie-ruit (◇, open): de hoekpunten
  // liggen óp het pad zelf (punt-op-lengte 0, ½L en L, dwarsas loodrecht op
  // de raaklijn in het midden), zodat de ruit met de kromming van de curve
  // meebuigt — onder elke hoek.
  const heeftRuit = p.markerStart === "ruit" || p.markerStart === "ruit-open";
  // Open ruit: witte vulling, net als de generalisatie-driehoek — in beide
  // thema's duidelijk te onderscheiden van de gevulde compositie-ruit.
  const ruitVulling = p.markerStart === "ruit-open" ? "white" : kleur;
  const meetRef = useRef(null);
  const [ruitPunten, setRuitPunten] = useState(null);
  useLayoutEffect(() => {
    if (!heeftRuit) return;
    const pad = meetRef.current;
    if (!pad) return;
    try {
      const totaal = pad.getTotalLength();
      const L = Math.min(RUIT_LENGTE, Math.max(8, totaal - 2));
      const p0 = pad.getPointAtLength(0);
      const pm = pad.getPointAtLength(L / 2);
      const p1 = pad.getPointAtLength(L);
      // Normaal op de raaklijn in het midden van de ruit
      const ta = pad.getPointAtLength(Math.max(L / 2 - 1, 0));
      const tb = pad.getPointAtLength(Math.min(L / 2 + 1, totaal));
      let nx = -(tb.y - ta.y);
      let ny = tb.x - ta.x;
      const nl = Math.hypot(nx, ny) || 1;
      nx = (nx / nl) * (RUIT_BREEDTE / 2);
      ny = (ny / nl) * (RUIT_BREEDTE / 2);
      setRuitPunten(
        `${p0.x},${p0.y} ${pm.x + nx},${pm.y + ny} ${p1.x},${p1.y} ${pm.x - nx},${pm.y - ny}`
      );
    } catch {
      setRuitPunten(null);
    }
  }, [heeftRuit, edgePath]);
  // Fallback (eerste render, vóór de meting): richting van de handle-zijde.
  const fallbackHoek = { right: 0, left: 180, top: -90, bottom: 90 }[sourcePosition] ?? 0;

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

      {heeftRuit && (
        <>
          {/* Onzichtbaar meetpad voor de curve-geometrie */}
          <path ref={meetRef} d={edgePath} fill="none" stroke="none" style={{ pointerEvents: "none" }} />
          {ruitPunten ? (
            <polygon points={ruitPunten} fill={ruitVulling} stroke={kleur} strokeWidth="1.2" strokeLinejoin="round" />
          ) : (
            <g transform={`translate(${sourceX} ${sourceY}) rotate(${fallbackHoek})`}>
              <polygon
                points={`0,0 ${RUIT_LENGTE / 2},${-RUIT_BREEDTE / 2} ${RUIT_LENGTE},0 ${RUIT_LENGTE / 2},${RUIT_BREEDTE / 2}`}
                fill={ruitVulling}
                stroke={kleur}
                strokeWidth="1.2"
              />
            </g>
          )}
        </>
      )}

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

/** Ruit-maat: lange as langs de lijn, dunne as dwars erop. */
const RUIT_LENGTE = 22;
const RUIT_BREEDTE = 16;

export default ConnectorEdge;
