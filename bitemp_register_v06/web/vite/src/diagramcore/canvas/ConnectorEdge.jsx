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
 *   vorm:        "bezier" (default) | "hoekig" (orthogonaal) | "recht"
 *                — de route van de lijn (§8.5c-familie); UML oogt
 *                herkenbaarder hoekig, grafen juist met krommen
 *   kleur:       basiskleur (selected → accent, tenzij `vasteKleur`)
 *   opacity?:    number
 *   markerStart: "ruit" | "ruit-open" | null — compositie- (◆) of
 *                aggregatie-ruit (◇) aan de bronzijde
 *   markerEnd:   "pijl-open" | "driehoek" | null
 *   labels: [ { zijde: "bron"|"doel"|"midden", offset?: {x,y},
 *               delen: [ { tekst, soort: "rolnaam"|"kardinaliteit"|"constraint"|"naam", kleur? } ] } ]
 */
import { useLayoutEffect, useRef, useState } from "react";
import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  EdgeLabelRenderer,
  BaseEdge,
  useStore,
} from "@xyflow/react";

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
  source,
  target,
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
  const padArgs = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  // Zelf-verwijzing (source == target): een "oortje" buitenom de node —
  // anders valt het pad samen met één punt en is de connector onzichtbaar
  // (bv. de ENT→ENT-verbindingsregels in de profiel-ontwerper).
  const isLus = source && source === target;
  const [edgePath, labelX, labelY] = isLus
    ? [
        `M ${sourceX} ${sourceY} C ${sourceX + 52} ${sourceY - 40}, ${sourceX + 52} ${
          sourceY + 40
        }, ${targetX} ${targetY}`,
        sourceX + 44,
        sourceY,
      ]
    : p.vorm === "hoekig"
      ? getSmoothStepPath({ ...padArgs, borderRadius: 4 })
      : p.vorm === "recht"
        ? getStraightPath(padArgs)
        : getBezierPath(padArgs);

  const kleur = selected && !p.vasteKleur
    ? "var(--dc-selectie, #2563eb)"
    : p.kleur || "var(--dc-lijn, #64748b)";
  const pijlId = `dc-pijl-${id}`;
  const driehoekId = `dc-driehoek-${id}`;

  // Sleepbare labels (vgl. editor 0.2): pointer-drag in flow-coördinaten
  // (schermafstand gedeeld door de zoom); bij loslaten meldt de edge de
  // nieuwe offset per zijde via data.onLabelOffset — de activiteit bewaart
  // hem op het connector-element (data.labelOffsets).
  const zoom = useStore((s) => s.transform[2]) || 1;
  const [sleep, setSleep] = useState(null); // {index, x, y} tijdens het slepen
  const magSlepen = typeof data?.onLabelOffset === "function";
  const startLabelSleep = (e, index, label) => {
    if (!magSlepen || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const doelEl = e.currentTarget;
    doelEl.setPointerCapture?.(e.pointerId);
    const basis = label.offset || { x: 0, y: 0 };
    const startX = e.clientX;
    const startY = e.clientY;
    let laatste = { x: basis.x || 0, y: basis.y || 0 };
    const beweeg = (ev) => {
      laatste = {
        x: (basis.x || 0) + (ev.clientX - startX) / zoom,
        y: (basis.y || 0) + (ev.clientY - startY) / zoom,
      };
      setSleep({ index, ...laatste });
    };
    const klaar = () => {
      doelEl.removeEventListener("pointermove", beweeg);
      doelEl.removeEventListener("pointerup", klaar);
      setSleep(null);
      data.onLabelOffset(label.zijde || "midden", {
        x: Math.round(laatste.x),
        y: Math.round(laatste.y),
      });
    };
    doelEl.addEventListener("pointermove", beweeg);
    doelEl.addEventListener("pointerup", klaar);
  };

  // Compositie- (◆, gevuld) of aggregatie-ruit (◇, open): de hoekpunten
  // liggen óp het pad zelf (punt-op-lengte 0, ½L en L, dwarsas loodrecht op
  // de raaklijn in het midden), zodat de ruit met de kromming van de curve
  // meebuigt — onder elke hoek.
  const heeftRuit = p.markerStart === "ruit" || p.markerStart === "ruit-open";
  // Open ruit: gevuld met de canvaskleur (--dc-marker-vulling, tokens v2) —
  // net als de generalisatie-driehoek. Zo blijft ◇ ook in het donkere thema
  // duidelijk te onderscheiden van de gevulde compositie-ruit ◆.
  const ruitVulling = p.markerStart === "ruit-open" ? "var(--dc-marker-vulling, #ffffff)" : kleur;
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
            <path d="M 1 1 L 13 7 L 1 13 Z" fill="var(--dc-marker-vulling, #ffffff)" stroke={kleur} strokeWidth="1.2" />
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

      {(() => {
        // Meerdere labels op dezelfde zijde (bv. kardinaliteit + {ordered})
        // zouden exact stapelen; zonder eigen offset schuiven volgende
        // labels 18px omlaag zodat ze naast elkaar leesbaar blijven.
        const stapel = {};
        return (p.labels || []).map((label, i) => {
        const basis = posities[label.zijde] || posities.midden;
        const zijdeKey = label.zijde || "midden";
        const stapelIdx = (stapel[zijdeKey] = (stapel[zijdeKey] ?? -1) + 1);
        // Stapeling komt bóvenop een (gesleepte) offset: offsets gelden per
        // zijde en zijn dus voor alle labels op die zijde gelijk — zonder
        // stapel-bijdrage vielen ze na één keer slepen weer samen.
        const basisOff = sleep?.index === i ? sleep : label.offset || { x: 0, y: 0 };
        const off = { x: basisOff.x || 0, y: (basisOff.y || 0) + stapelIdx * 18 };
        const alleenNaam = label.delen?.length === 1 && label.delen[0].soort === "naam";
        return (
          <EdgeLabelRenderer key={i}>
            <div
              className={alleenNaam ? undefined : "dc-edge-label"}
              onPointerDown={(e) => startLabelSleep(e, i, label)}
              title={magSlepen ? "Sleep om het label te verplaatsen" : undefined}
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${basis.x + (off.x || 0)}px, ${basis.y + (off.y || 0)}px)`,
                pointerEvents: "all",
                userSelect: "none",
                cursor: magSlepen ? "move" : undefined,
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
        });
      })()}
    </>
  );
}

/** Ruit-maat: lange as langs de lijn, dunne as dwars erop. */
const RUIT_LENGTE = 22;
const RUIT_BREEDTE = 16;

export default ConnectorEdge;
