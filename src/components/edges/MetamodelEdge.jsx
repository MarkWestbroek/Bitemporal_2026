/**
 * MetamodelEdge — Custom edge met rol, kardinaliteit en constraint labels.
 *
 * React Flow edges zijn standaard simpele lijnen. Door een custom edge te maken
 * kunnen we extra informatie tonen op de lijn:
 *
 *       [A] ——— rolnaam {enkelvoudig} 0..1 ———> [A_U]
 *
 * De `data` prop bevat:
 *   - rolnaam: de Go-veldnaam (bijv. "Us")
 *   - jsonRolnaam: de JSON-veldnaam (bijv. "us")
 *   - momentvoorkomen: "enkelvoudig" | "meervoudig"
 *   - kardinaliteit: "0..1", "1", "0..*", "1..*"
 *
 * We gebruiken getBezierPath() van React Flow om het pad te berekenen,
 * en gebruiken EdgeLabelRenderer om labels over de edge te plaatsen.
 */
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow,
} from "@xyflow/react";

function MetamodelEdge({
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
  const { getNode } = useReactFlow();
  const sourceNode = getNode(source);
  const targetNode = getNode(target);

  const isComposition =
    sourceNode?.type === "entiteit" &&
    ["gegevenselement", "relatie"].includes(targetNode?.type);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const constraint =
    data?.momentvoorkomen === "enkelvoudig"
      ? "{enkelvoudig}"
      : "{meervoudig}";
  const kardinaliteit = data?.kardinaliteit || "";
  const rolnaam = data?.jsonRolnaam || data?.rolnaam || "";
  const diamondColor = selected ? "#2563eb" : "#64748b";
  const { diamondCenter, diamondPoints } = getDiamondProps(sourceX, sourceY, sourcePosition);

  return (
    <>
      {/* De lijn zelf — BaseEdge tekent het SVG path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "#2563eb" : "#64748b",
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />

      {/* Compositie-ruit (◆) op de bronzijde van de edge */}
      {isComposition && (
        <g transform={`translate(${diamondCenter.x} ${diamondCenter.y})`}>
          <polygon
            points={diamondPoints}
            fill={diamondColor}
            stroke={diamondColor}
            strokeWidth="1"
          />
        </g>
      )}

      {/* Labels boven de edge — EdgeLabelRenderer plaatst HTML over de SVG */}
      <EdgeLabelRenderer>
        <div
          className="edge-label"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          {rolnaam && <span className="edge-rolnaam">{rolnaam}</span>}
          {kardinaliteit && (
            <span className="edge-kardinaliteit">{kardinaliteit}</span>
          )}
          <span className="edge-constraint">{constraint}</span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

/**
 * Geeft het middelpunt van de ruit en de punten, afgestemd op de lijnrichting.
 * HL = halve lengte LANGS de lijn (dunne as).
 * HW = halve breedte DWARS op de lijn (brede as).
 */
function getDiamondProps(x, y, sourcePosition) {
  const HL = 11;  // lange as: langs de lijnrichting
  const HW = 8;   // dunne as: dwars op de lijnrichting (16px totaal)
  const isVertical = sourcePosition === "top" || sourcePosition === "bottom";
  const points = isVertical
    ? `0,${-HL} ${HW},0 0,${HL} ${-HW},0`
    : `${-HL},0 0,${-HW} ${HL},0 0,${HW}`;
  let cx, cy;
  switch (sourcePosition) {
    case "right":  cx = x + HL; cy = y; break;
    case "left":   cx = x - HL; cy = y; break;
    case "top":    cx = x; cy = y - HL; break;
    case "bottom": cx = x; cy = y + HL; break;
    default:       cx = x; cy = y;
  }
  return { diamondCenter: { x: cx, y: cy }, diamondPoints: points };
}

export default MetamodelEdge;
